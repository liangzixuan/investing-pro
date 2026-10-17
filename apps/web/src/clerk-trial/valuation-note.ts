import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import type { AuthoredValuationScenario } from "@research-cockpit/personal-market-analytics";
import {
  captureValuationCalculationGuard,
  VALUATION_SCENARIOS,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";

export type ValuationNoteModel = "dcf" | "exit";
export interface PreparedValuationNote {
  readonly note: string;
  readonly excerpt: string;
  readonly model: ValuationNoteModel;
  readonly scenario: AuthoredValuationScenario;
}
export interface ValuationNotePreparation {
  readonly preview: PreparedValuationNote | null;
  readonly reason: string | null;
}
export interface ValuationNoteCapture {
  readonly capture: ManagedValuationCalculation;
  readonly model: ValuationNoteModel;
  readonly scenario: AuthoredValuationScenario;
  readonly note: string;
  readonly isCurrent: () => boolean;
  readonly apply: (note: string) => void;
}
const previews = new WeakMap<
  PreparedValuationNote,
  { current: () => boolean; apply: (note: string) => void }
>();
const stale =
  "The assumptions, note or company visit changed. Preview the valuation note again.";

/** Prepare the complete note from one explicit calculation without saving. */
export function prepareValuationNote(
  input: ValuationNoteCapture,
): ValuationNotePreparation {
  const refuse = (reason: string): ValuationNotePreparation => ({
    preview: null,
    reason,
  });
  if (
    !input ||
    typeof input !== "object" ||
    typeof input.note !== "string" ||
    typeof input.isCurrent !== "function" ||
    typeof input.apply !== "function"
  )
    return refuse(stale);
  const guard = captureValuationCalculationGuard(input.capture);
  const current = () => Boolean(guard?.() && input.isCurrent());
  if (!safelyCurrent(current)) return refuse(stale);
  if (
    (input.model !== "dcf" && input.model !== "exit") ||
    typeof input.scenario !== "string" ||
    !VALUATION_SCENARIOS.includes(input.scenario)
  )
    return refuse("Select one valuation model and scenario.");
  if (normalizeWatchlistNote(input.note) === null)
    return refuse("Correct the current note before adding this valuation.");
  const excerpt = valuationExcerpt(input.capture, input.model, input.scenario);
  if (excerpt === null)
    return refuse(
      "Calculate valid assumptions for this model before preparing a valuation note.",
    );
  if (normalizeWatchlistNote(input.note)!.endsWith(excerpt))
    return refuse("This valuation is already at the end of the note draft.");
  const note = input.note ? `${input.note} ${excerpt}` : excerpt;
  if ([...note].length > 2000 || normalizeWatchlistNote(note) === null)
    return refuse(
      "The complete note must fit the existing single-line, 2,000-character limit. Shorten the note before adding this valuation.",
    );
  if (!safelyCurrent(current)) return refuse(stale);
  const preview = Object.freeze({
    note,
    excerpt,
    model: input.model,
    scenario: input.scenario,
  });
  // Copy callbacks so later mutation of a caller's options cannot retarget append.
  const isCurrent = input.isCurrent;
  previews.set(preview, {
    current: () => Boolean(guard?.() && isCurrent()),
    apply: input.apply,
  });
  return { preview, reason: null };
}
export function isValuationNoteCurrent(
  preview: PreparedValuationNote,
): boolean {
  const capability = previews.get(preview);
  if (!capability) return false;
  if (safelyCurrent(capability.current)) return true;
  previews.delete(preview);
  return false;
}
export function appendValuationNote(preview: PreparedValuationNote): {
  appended: boolean;
  message: string;
} {
  if (!isValuationNoteCurrent(preview))
    return { appended: false, message: stale };
  const capability = previews.get(preview)!;
  previews.delete(preview);
  try {
    capability.apply(preview.note);
  } catch {
    return {
      appended: false,
      message:
        "The valuation note could not be applied. Review the current draft and prepare a new preview.",
    };
  }
  return {
    appended: true,
    message:
      "Valuation added to the note draft. Review and save all changes in My Watchlist.",
  };
}
function safelyCurrent(current: () => boolean): boolean {
  try {
    return current();
  } catch {
    return false;
  }
}
function valuationExcerpt(
  capture: ManagedValuationCalculation,
  model: ValuationNoteModel,
  scenario: AuthoredValuationScenario,
): string | null {
  const { listing } = capture.owner;
  const identity = `${listing.symbol} (${listing.exchangeMic}), listing ${listing.listingId}, security ${listing.securityId}, class ${listing.shareClassId}, issuer ${listing.issuerId}, CIK ${capture.owner.cik ?? "unavailable"}, catalog ${capture.owner.catalogSnapshotSha256}`;
  const context = `Authored valuation: ${identity}; ${scenario} scenario. All money is USD; shares are diluted shares; rates are percent. Assumptions are authored, not reported financial facts or current prices. Scenario context, not a recommendation.`;
  if (model === "dcf") {
    const result = capture.dcfResult;
    if (result.status !== "available") return null;
    const input = result.inputs;
    const value = result.scenarios[scenario];
    return `${context} DCF ${result.modelVersion}, schema ${result.schemaVersion}: starting unlevered cash flow ${input.startingUnleveredCashFlowUsd}; signed enterprise-to-equity bridge ${input.enterpriseToEquityBridgeUsd}; shares ${input.dilutedShares}; years ${input.forecastYears}; WACC ${input.waccPercent}%; terminal growth ${input.terminalGrowthPercent}%; annual cash-flow growth ${input.scenarios[scenario].annualCashFlowGrowthPercent}%. Enterprise value ${value.enterpriseValueUsd}; equity value ${value.equityValueUsd}; value/share ${value.status === "available" ? value.valuePerShareUsd : `unavailable (${value.reason})`}; explicit cash-flow present value ${value.presentValueOfExplicitCashFlowUsd}; terminal present value ${value.presentValueOfTerminalValueUsd}; terminal value ${value.terminalValueUsd}; terminal share of enterprise value ${value.terminalValuePercentOfEnterpriseValue}%. Method: CF(t)=starting CF*(1+growth)^t; discount each year-end CF by (1+WACC)^t; terminal=final CF*(1+terminal growth)/(WACC-terminal growth); enterprise=sum of present values; equity=enterprise-signed bridge; value/share=equity/shares. Decimal arithmetic, half-up; money and value/share 2 decimals.`;
  }
  const result = capture.exitResult;
  if (result.status !== "available") return null;
  const input = result.inputs;
  const assumption = input.scenarios[scenario];
  const value = result.scenarios[scenario];
  return `${context} Exit multiple ${result.modelVersion}, engine ${value.modelVersion}, schema ${result.schemaVersion}: base revenue ${input.baseRevenue}; cash ${input.cash}; debt ${input.debt}; shares ${input.dilutedShares}; years ${input.horizonYears}; discount ${input.discountRatePercent}%; annual revenue growth ${assumption.annualRevenueGrowthPercent}%; target EBITDA margin ${assumption.targetEbitdaMarginPercent}%; exit multiple ${assumption.exitMultiple}x. Final revenue ${value.yearNRevenue}; final EBITDA ${value.yearNEbitda}; terminal enterprise value ${value.terminalEnterpriseValue}; present enterprise value ${value.presentEnterpriseValue}; equity value ${value.equityValue}; value/share ${value.status === "available" ? value.valuePerShare : `unavailable (${value.reason}; calculated ${value.valuePerShare})`}. Method: revenue=base revenue*(1+growth)^years; EBITDA=revenue*margin; terminal enterprise=EBITDA*exit multiple; discount year-end terminal enterprise by (1+discount)^years; equity=present enterprise+cash-debt; value/share=equity/shares. Interim cash flows excluded. Decimal arithmetic, half-up; money 3 decimals; value/share 2 decimals.`;
}
