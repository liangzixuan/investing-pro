import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  MANAGED_VALUATION_DCF_MODEL_VERSION,
  MANAGED_VALUATION_EXIT_MODEL_VERSION,
  parseValuationAssumptionEntry,
  parseValuationAssumptionsPayload,
  type ValuationAssumptionEntry,
  type ValuationAssumptionsPayload,
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
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { getManagedResearchCoverageCik } from "./managed-research-eligibility";

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
export interface ManagedValuationInputCapture {
  readonly entry: ValuationAssumptionEntry;
  readonly revision: symbol;
}
export interface ManagedValuationBaseRevenueCapture {
  readonly value: string;
  readonly revision: symbol;
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
  private editorRevision = Symbol();
  private baseRevenueRevision = Symbol();
  private previousBaseRevenueRevision: symbol | null = null;
  private lastBaseRevenueEdit: ManagedValuationSnapshot | null = null;
  private readonly baseRevenueCaptures = new WeakMap<
    ManagedValuationBaseRevenueCapture,
    {
      readonly owner: ManagedResearchSelection;
      readonly context: ManagedResearchSelection;
    }
  >();
  private savedInputRevision: symbol | null = null;
  private retainedInputs = false;
  private readonly inputCaptures = new WeakMap<
    ManagedValuationInputCapture,
    ManagedValuationSnapshot
  >();
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
    const owner = this.nextOwner(context);
    if (!sameSelection(owner, this.snapshot.owner)) {
      this.calculation = null;
      this.editorRevision = Symbol();
    }
    if (
      !sameRevenueContext(owner, this.snapshot.owner) ||
      !sameRevenueContext(context, this.snapshot.context)
    )
      this.retireBaseRevenueCapture();
    this.publish({ ...this.snapshot, owner, context });
  }
  private nextOwner(
    context: ManagedResearchSelection | null,
  ): ManagedResearchSelection | null {
    if (this.hasDraft() || this.retainedInputs)
      return this.snapshot.owner ?? context;
    return context ?? this.snapshot.owner;
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
    this.editorRevision = Symbol();
    this.retireBaseRevenueCapture();
    this.retainedInputs = false;
    this.savedInputRevision = null;
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
    if (field === "baseRevenue") this.retireBaseRevenueCapture();
    const published = this.edited({
      exitDraft: freeze({ ...this.snapshot.exitDraft, [field]: value }),
    });
    if (field === "baseRevenue" && this.snapshot === published)
      this.lastBaseRevenueEdit = published;
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
  private retireBaseRevenueCapture() {
    this.lastBaseRevenueEdit = null;
    this.previousBaseRevenueRevision = this.baseRevenueRevision;
    this.baseRevenueRevision = Symbol();
  }
  captureBaseRevenue(): ManagedValuationBaseRevenueCapture | null {
    const { owner, context, editable, exitDraft } = this.snapshot;
    if (!editable || !owner || !context) return null;
    const capture = Object.freeze({
      value: exitDraft.baseRevenue,
      revision: this.baseRevenueRevision,
    });
    this.baseRevenueCaptures.set(capture, { owner, context });
    return capture;
  }
  private baseRevenueOwnerCurrent(capture: ManagedValuationBaseRevenueCapture) {
    const owned = this.baseRevenueCaptures.get(capture);
    if (!owned || !this.snapshot.editable) return false;
    if (!sameRevenueContext(owned.owner, this.snapshot.owner)) return false;
    return sameRevenueContext(owned.context, this.snapshot.context);
  }
  isBaseRevenueCaptureCurrent(
    capture: ManagedValuationBaseRevenueCapture,
  ): boolean {
    if (!this.baseRevenueOwnerCurrent(capture)) return false;
    if (capture.revision !== this.baseRevenueRevision) return false;
    return capture.value === this.snapshot.exitDraft.baseRevenue;
  }
  /** Accept only this one field transition; a reentrant change and return cannot revive it. */
  captureBaseRevenueAfterApply(
    before: ManagedValuationBaseRevenueCapture,
    value: string,
  ): ManagedValuationBaseRevenueCapture | null {
    if (!this.baseRevenueOwnerCurrent(before)) return null;
    if (this.snapshot.exitDraft.baseRevenue !== value) return null;
    const expected =
      before.value === value
        ? this.baseRevenueRevision
        : this.previousBaseRevenueRevision;
    if (before.revision !== expected) return null;
    if (before.value !== value && this.lastBaseRevenueEdit !== this.snapshot)
      return null;
    return this.captureBaseRevenue();
  }
  captureInputs(): ManagedValuationInputCapture | null {
    const snapshot = this.snapshot;
    if (!snapshot.editable || snapshot.inputIssue) return null;
    const entry = this.authoredEntry();
    if (!entry) return null;
    const capture = Object.freeze({ entry, revision: this.editorRevision });
    this.inputCaptures.set(capture, snapshot);
    return capture;
  }
  private authoredEntry(): ValuationAssumptionEntry | null {
    const snapshot = this.snapshot;
    if (!snapshot.owner) return null;
    return parseValuationAssumptionEntry({
      catalogSnapshotSha256: snapshot.owner.catalogSnapshotSha256,
      listing: snapshot.owner.listing,
      cik: snapshot.owner.cik,
      dcf: {
        modelVersion: MANAGED_VALUATION_DCF_MODEL_VERSION,
        inputs: snapshot.dcfDraft,
      },
      exit: {
        modelVersion: MANAGED_VALUATION_EXIT_MODEL_VERSION,
        inputs: snapshot.exitDraft,
      },
    });
  }
  isInputCaptureCurrent(capture: ManagedValuationInputCapture): boolean {
    const snapshot = this.inputCaptures.get(capture);
    if (!snapshot || !snapshot.editable) return false;
    return snapshot === this.snapshot;
  }
  acknowledgeSavedInputs(capture: ManagedValuationInputCapture): boolean {
    if (!this.inputCaptures.has(capture)) return false;
    if (this.snapshot.retired || this.snapshot.inputIssue) return false;
    if (this.editorRevision !== capture.revision) return false;
    this.retainedInputs = true;
    this.savedInputRevision = this.editorRevision;
    const published = this.publish({ ...this.snapshot, dirty: false });
    return this.snapshot === published;
  }
  reconcileSavedInputs(value: ValuationAssumptionsPayload | null): void {
    if (this.snapshot.retired) return;
    if (this.savedInputRevision !== this.editorRevision) return;
    const authored = this.authoredEntry();
    const saved = parseValuationAssumptionsPayload(value);
    if (
      authored &&
      saved?.entries.some((entry) => sameAuthoredInputs(authored, entry))
    )
      return;
    this.savedInputRevision = null;
    this.publish({ ...this.snapshot, dirty: true });
  }
  restoreInputs(
    value: ValuationAssumptionEntry,
    expectedSnapshot: ManagedValuationSnapshot,
  ): boolean {
    return this.applyReviewedInputs(value, expectedSnapshot, true);
  }
  restoreDraftInputs(
    value: ValuationAssumptionEntry,
    expectedSnapshot: ManagedValuationSnapshot,
  ): boolean {
    return this.applyReviewedInputs(value, expectedSnapshot, false);
  }
  private applyReviewedInputs(
    value: ValuationAssumptionEntry,
    expectedSnapshot: ManagedValuationSnapshot,
    confirmed: boolean,
  ): boolean {
    if (this.snapshot !== expectedSnapshot || this.snapshot.retired)
      return false;
    const entry = parseValuationAssumptionEntry(value);
    const context = this.snapshot.context;
    if (!entry || !context) return false;
    if (!confirmed && (!this.snapshot.editable || entry.cik !== context.cik))
      return false;
    const owner = copySelection({
      catalogSnapshotSha256: entry.catalogSnapshotSha256,
      listing: entry.listing,
      cik: entry.cik,
      origin: context.origin,
    });
    if (!sameSelection(owner, context)) return false;
    this.calculation = null;
    this.editorRevision = Symbol();
    this.retireBaseRevenueCapture();
    this.savedInputRevision = confirmed ? this.editorRevision : null;
    this.retainedInputs = true;
    this.rejectedFields.clear();
    const published = this.publish({
      ...this.snapshot,
      owner: context,
      dirty: !confirmed,
      dcfDraft: entry.dcf.inputs,
      exitDraft: entry.exit.inputs,
      calculation: null,
      inputIssue: null,
    });
    return this.snapshot === published;
  }
  retire(): void {
    if (this.snapshot.retired) return;
    this.calculation = null;
    this.editorRevision = Symbol();
    this.retireBaseRevenueCapture();
    this.retainedInputs = false;
    this.savedInputRevision = null;
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
      if (key === "exit.baseRevenue") this.retireBaseRevenueCapture();
      this.rejectedFields.add(key);
      this.calculation = null;
      this.editorRevision = Symbol();
      this.publish({
        ...this.snapshot,
        dirty: true,
        inputIssue: this.rejectedInputMessage(),
      });
      return false;
    }
    if (this.rejectedFields.delete(key)) {
      this.editorRevision = Symbol();
      const published = this.publish({
        ...this.snapshot,
        inputIssue: this.rejectedInputMessage(),
      });
      if (this.snapshot !== published) return false;
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
  ): ManagedValuationSnapshot {
    this.calculation = null;
    this.editorRevision = Symbol();
    return this.publish({ ...this.snapshot, ...change, dirty: true });
  }
  private publish(next: ManagedValuationSnapshot): ManagedValuationSnapshot {
    const editable = !next.retired && sameSelection(next.owner, next.context);
    const published = freeze({
      ...next,
      editable,
      calculation: editable ? this.calculation : null,
    });
    this.snapshot = published;
    for (const listener of [...this.listeners]) listener();
    return published;
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
    compatibleCik(left.cik, right.cik) &&
    membershipMatchesResult({ ...left.listing, note: "" }, right.listing)
  );
}
function sameRevenueContext(
  left: ManagedResearchSelection | null,
  right: ManagedResearchSelection | null,
) {
  if (left === null || right === null) return left === right;
  return companyEvidenceSelectionMatches(left, right);
}
function compatibleCik(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return true;
  return left === right;
}
function sameAuthoredInputs(
  left: ValuationAssumptionEntry,
  right: ValuationAssumptionEntry,
): boolean {
  if (left.catalogSnapshotSha256 !== right.catalogSnapshotSha256) return false;
  if (!compatibleCik(left.cik, right.cik)) return false;
  if (!membershipMatchesResult({ ...left.listing, note: "" }, right.listing))
    return false;
  return (
    JSON.stringify(left.dcf) === JSON.stringify(right.dcf) &&
    JSON.stringify(left.exit) === JSON.stringify(right.exit)
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
    return freezeSelection({
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listing: { ...raw.listing },
      cik: raw.cik,
      origin: raw.origin,
    });
  } catch {
    return null;
  }
}
function freezeSelection(value: unknown): ManagedResearchSelection | null {
  const selection = freeze(value as ManagedResearchSelection);
  const knownCik = getManagedResearchCoverageCik(selection);
  if (knownCik === null || selection.cik === null) return selection;
  return knownCik === selection.cik ? selection : null;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
