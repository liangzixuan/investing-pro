import {
  isMainWatchlistPayload,
  membershipMatchesResult,
} from "@research-cockpit/contracts";
import {
  calculateAuthoredCashFlowDcf,
  type AuthoredCashFlowDcfInput,
  type AuthoredCashFlowDcfResult,
  type AuthoredValuationScenario,
} from "@research-cockpit/personal-market-analytics";
import {
  calculateAuthoredExitMultiple,
  type AuthoredExitMultipleInput,
  type AuthoredExitMultipleResult,
} from "@research-cockpit/research-core/valuation";
import type { ManagedResearchSelection } from "./managed-research-selection";

export const VALUATION_SCENARIOS = Object.freeze([
  "conservative",
  "base",
  "expansion",
] as const);
export const VALUATION_DRAFT_FIELD_MAX_CODE_POINTS = 512;
export const AUTHORED_VALUATION_EXPLANATION =
  "All monetary assumptions and calculated values use USD. Inputs are authored assumptions, not reported financial facts or current prices. Results are scenario context, not a recommendation.";
export type DcfField = Exclude<keyof AuthoredCashFlowDcfInput, "scenarios">;
export type ExitField = Exclude<keyof AuthoredExitMultipleInput, "scenarios">;
export type ExitScenarioField =
  keyof AuthoredExitMultipleInput["scenarios"]["base"];
export type DcfDraft = Readonly<Record<DcfField, string>> &
  Pick<AuthoredCashFlowDcfInput, "scenarios">;
export type ExitDraft = Readonly<Record<ExitField, string>> &
  Pick<AuthoredExitMultipleInput, "scenarios">;
export interface ManagedValuationCalculation {
  readonly owner: ManagedResearchSelection;
  readonly dcfDraft: DcfDraft;
  readonly exitDraft: ExitDraft;
  readonly dcfInput: Omit<AuthoredCashFlowDcfInput, "forecastYears"> & {
    readonly forecastYears: number | null;
  };
  readonly exitInput: Omit<AuthoredExitMultipleInput, "horizonYears"> & {
    readonly horizonYears: number | null;
  };
  readonly dcfResult: AuthoredCashFlowDcfResult;
  readonly exitResult: AuthoredExitMultipleResult;
  readonly explanation: typeof AUTHORED_VALUATION_EXPLANATION;
}
export interface ManagedValuationSnapshot {
  readonly owner: ManagedResearchSelection | null;
  readonly context: ManagedResearchSelection | null;
  readonly editable: boolean;
  readonly dirty: boolean;
  readonly dcfDraft: DcfDraft;
  readonly exitDraft: ExitDraft;
  readonly calculation: ManagedValuationCalculation | null;
  readonly retired: boolean;
  readonly inputIssue: string | null;
}
const dcfFields: readonly DcfField[] = [
  "startingUnleveredCashFlowUsd",
  "enterpriseToEquityBridgeUsd",
  "dilutedShares",
  "forecastYears",
  "waccPercent",
  "terminalGrowthPercent",
];
const exitFields: readonly ExitField[] = [
  "baseRevenue",
  "cash",
  "debt",
  "dilutedShares",
  "horizonYears",
  "discountRatePercent",
];
const exitScenarioFields: readonly ExitScenarioField[] = [
  "annualRevenueGrowthPercent",
  "targetEbitdaMarginPercent",
  "exitMultiple",
];
const captures = new WeakMap<
  ManagedValuationCalculation,
  () => ManagedValuationSnapshot
>();

/** A preview receives one exact snapshot's lifetime, including a Back/return fence. */
export function captureValuationCalculationGuard(
  capture: ManagedValuationCalculation,
): (() => boolean) | null {
  const read = captures.get(capture);
  if (!read) return null;
  const snapshot = read();
  if (!snapshot.editable || snapshot.calculation !== capture) return null;
  return () =>
    read() === snapshot &&
    snapshot.editable &&
    snapshot.calculation === capture;
}

/** One bounded, transient draft belongs to one full listing and catalog identity. */
export class ManagedValuationWorkbench {
  private listeners = new Set<() => void>();
  private calculation: ManagedValuationCalculation | null = null;
  private readonly rejectedFields = new Set<string>();
  private snapshot: ManagedValuationSnapshot = freeze({
    owner: null,
    context: null,
    editable: false,
    dirty: false,
    dcfDraft: emptyDcf(),
    exitDraft: emptyExit(),
    calculation: null,
    retired: false,
    inputIssue: null,
  });
  getSnapshot = (): ManagedValuationSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  hasDraft = (): boolean => this.snapshot.dirty;

  activate(selection: ManagedResearchSelection | null): void {
    if (this.snapshot.retired) return;
    const context = selection === null ? null : copySelection(selection);
    if (selection !== null && context === null) return;
    const owner =
      !this.hasDraft() && context ? context : (this.snapshot.owner ?? context);
    if (!sameSelection(owner, this.snapshot.owner)) this.calculation = null;
    this.publish({ ...this.snapshot, owner, context });
  }
  discardAndUse(selection: ManagedResearchSelection): void {
    if (this.snapshot.retired) return;
    const owner = copySelection(selection);
    if (
      !owner ||
      !sameSelection(owner, this.snapshot.context) ||
      owner.origin !== this.snapshot.context?.origin
    )
      return;
    this.calculation = null;
    this.rejectedFields.clear();
    this.publish({
      owner,
      context: owner,
      editable: true,
      dirty: false,
      dcfDraft: emptyDcf(),
      exitDraft: emptyExit(),
      calculation: null,
      retired: false,
      inputIssue: null,
    });
  }
  setDcfField(field: DcfField, value: string): boolean {
    if (
      !this.canEdit(
        field,
        dcfFields,
        value,
        typeof field === "string" ? `dcf.${field}` : "invalid",
      )
    )
      return false;
    if (this.snapshot.dcfDraft[field] === value) return true;
    this.edited({
      dcfDraft: freeze({ ...this.snapshot.dcfDraft, [field]: value }),
    });
    return true;
  }
  setDcfScenario(scenario: AuthoredValuationScenario, value: string): boolean {
    if (
      !this.canEdit(
        scenario,
        VALUATION_SCENARIOS,
        value,
        typeof scenario === "string" ? `dcf.${scenario}.growth` : "invalid",
      )
    )
      return false;
    const draft = this.snapshot.dcfDraft;
    if (draft.scenarios[scenario].annualCashFlowGrowthPercent === value)
      return true;
    this.edited({
      dcfDraft: freeze({
        ...draft,
        scenarios: {
          ...draft.scenarios,
          [scenario]: { annualCashFlowGrowthPercent: value },
        },
      }),
    });
    return true;
  }
  setExitField(field: ExitField, value: string): boolean {
    if (
      !this.canEdit(
        field,
        exitFields,
        value,
        typeof field === "string" ? `exit.${field}` : "invalid",
      )
    )
      return false;
    if (this.snapshot.exitDraft[field] === value) return true;
    this.edited({
      exitDraft: freeze({ ...this.snapshot.exitDraft, [field]: value }),
    });
    return true;
  }
  setExitScenario(
    scenario: AuthoredValuationScenario,
    field: ExitScenarioField,
    value: string,
  ): boolean {
    if (
      typeof field !== "string" ||
      !exitScenarioFields.includes(field) ||
      !this.canEdit(
        scenario,
        VALUATION_SCENARIOS,
        value,
        typeof scenario === "string" ? `exit.${scenario}.${field}` : "invalid",
      )
    )
      return false;
    const draft = this.snapshot.exitDraft;
    if (draft.scenarios[scenario][field] === value) return true;
    this.edited({
      exitDraft: freeze({
        ...draft,
        scenarios: {
          ...draft.scenarios,
          [scenario]: { ...draft.scenarios[scenario], [field]: value },
        },
      }),
    });
    return true;
  }
  calculate(): ManagedValuationCalculation | null {
    if (
      !this.snapshot.editable ||
      !this.snapshot.owner ||
      this.snapshot.inputIssue
    )
      return null;
    const { owner, dcfDraft, exitDraft } = this.snapshot;
    const dcfInput = freeze({
      ...dcfDraft,
      forecastYears: years(dcfDraft.forecastYears),
    });
    const exitInput = freeze({
      ...exitDraft,
      horizonYears: years(exitDraft.horizonYears),
    });
    this.calculation = freeze({
      owner,
      dcfDraft,
      exitDraft,
      dcfInput,
      exitInput,
      dcfResult: calculateAuthoredCashFlowDcf(dcfInput),
      exitResult: calculateAuthoredExitMultiple(exitInput),
      explanation: AUTHORED_VALUATION_EXPLANATION,
    });
    captures.set(this.calculation, this.getSnapshot);
    this.publish(this.snapshot);
    return this.calculation;
  }
  retire(): void {
    if (this.snapshot.retired) return;
    this.calculation = null;
    this.rejectedFields.clear();
    this.publish({
      owner: null,
      context: null,
      editable: false,
      dirty: false,
      dcfDraft: emptyDcf(""),
      exitDraft: emptyExit(""),
      calculation: null,
      retired: true,
      inputIssue: null,
    });
  }
  private canEdit(
    field: unknown,
    fields: readonly string[],
    value: unknown,
    key: string,
  ): boolean {
    const valid =
      this.snapshot.editable &&
      typeof field === "string" &&
      fields.includes(field) &&
      typeof value === "string";
    if (!valid) return false;
    if ([...value].length > VALUATION_DRAFT_FIELD_MAX_CODE_POINTS) {
      this.rejectedFields.add(key);
      this.calculation = null;
      this.publish({
        ...this.snapshot,
        dirty: true,
        inputIssue: this.rejectedInputMessage(),
      });
      return false;
    }
    if (this.rejectedFields.delete(key)) {
      this.publish({
        ...this.snapshot,
        inputIssue: this.rejectedInputMessage(),
      });
    }
    return true;
  }
  private rejectedInputMessage() {
    return this.rejectedFields.size
      ? `An entry exceeds 512 characters and was not accepted. Previous field text remains visible for: ${[...this.rejectedFields].map(rejectedFieldLabel).join(", ")}. Replace each listed field with a shorter entry or discard the inputs before calculating.`
      : null;
  }
  private edited(
    change: Partial<Pick<ManagedValuationSnapshot, "dcfDraft" | "exitDraft">>,
  ): void {
    this.calculation = null;
    this.publish({ ...this.snapshot, ...change, dirty: true });
  }
  private publish(next: ManagedValuationSnapshot): void {
    const editable = !next.retired && sameSelection(next.owner, next.context);
    this.snapshot = freeze({
      ...next,
      editable,
      calculation: editable ? this.calculation : null,
    });
    for (const listener of [...this.listeners]) listener();
  }
}
function rejectedFieldLabel(key: string) {
  const [model, field, scenarioField] = key.split(".");
  const labels: Readonly<Record<string, string>> = {
    startingUnleveredCashFlowUsd: "starting unlevered cash flow",
    enterpriseToEquityBridgeUsd: "enterprise-to-equity bridge",
    dilutedShares: "diluted shares",
    forecastYears: "forecast years",
    waccPercent: "WACC",
    terminalGrowthPercent: "terminal growth",
    baseRevenue: "starting revenue",
    cash: "cash",
    debt: "debt",
    horizonYears: "horizon years",
    discountRatePercent: "discount rate",
    annualRevenueGrowthPercent: "annual revenue growth",
    targetEbitdaMarginPercent: "target EBITDA margin",
    exitMultiple: "exit EBITDA multiple",
    growth: "annual cash flow growth",
  };
  const prefix = model === "dcf" ? "DCF" : "Exit multiple";
  return scenarioField
    ? `${prefix} ${field} scenario ${labels[scenarioField]}`
    : `${prefix} ${labels[field!]}`;
}
function emptyDcf(forecastYears = "5"): DcfDraft {
  return freeze({
    startingUnleveredCashFlowUsd: "",
    enterpriseToEquityBridgeUsd: "",
    dilutedShares: "",
    forecastYears,
    waccPercent: "",
    terminalGrowthPercent: "",
    scenarios: {
      conservative: { annualCashFlowGrowthPercent: "" },
      base: { annualCashFlowGrowthPercent: "" },
      expansion: { annualCashFlowGrowthPercent: "" },
    },
  });
}
function emptyExit(horizonYears = "5"): ExitDraft {
  const scenario = () => ({
    annualRevenueGrowthPercent: "",
    targetEbitdaMarginPercent: "",
    exitMultiple: "",
  });
  return freeze({
    baseRevenue: "",
    cash: "",
    debt: "",
    dilutedShares: "",
    horizonYears,
    discountRatePercent: "",
    scenarios: {
      conservative: scenario(),
      base: scenario(),
      expansion: scenario(),
    },
  });
}
function years(raw: string): number | null {
  return /^(?:[1-9]|10)$/u.test(raw) ? Number(raw) : null;
}
function sameSelection(
  left: ManagedResearchSelection | null,
  right: ManagedResearchSelection | null,
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.catalogSnapshotSha256 === right.catalogSnapshotSha256 &&
    left.cik === right.cik &&
    membershipMatchesResult({ ...left.listing, note: "" }, right.listing)
  );
}
function plainData(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, "value"),
    )
  );
}
function copySelection(raw: unknown): ManagedResearchSelection | null {
  try {
    if (
      !plainData(raw) ||
      !plainData(raw.listing) ||
      Object.keys(raw).length !== 4 ||
      Object.keys(raw.listing).length !== 11 ||
      ![
        "discover",
        "watchlist",
        "markets",
        "route",
        "followups",
        "portfolio",
      ].includes(raw.origin as string) ||
      !(
        raw.cik === null ||
        (typeof raw.cik === "string" && /^[0-9]{10}$/u.test(raw.cik))
      )
    )
      return null;
    if (
      !isMainWatchlistPayload({
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: raw.catalogSnapshotSha256,
        memberships: [{ ...raw.listing, note: "" }],
      })
    )
      return null;
    return freeze({
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listing: { ...raw.listing },
      cik: raw.cik,
      origin: raw.origin,
    }) as ManagedResearchSelection;
  } catch {
    return null;
  }
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
