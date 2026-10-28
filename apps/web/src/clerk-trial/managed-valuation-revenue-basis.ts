import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualRevenueConcept,
  type PersonalSecAnnualCanonicalResponseDto,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import { VALUATION_ARITHMETIC } from "@research-cockpit/research-core/valuation";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import { getManagedAnnualView } from "./managed-annual-view";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  captureValuationCalculationGuard,
  type ManagedValuationCalculation,
  type ManagedValuationInputCapture,
  type ManagedValuationBaseRevenueCapture,
  type ManagedValuationWorkbench,
} from "./managed-valuation-workbench";

export interface AnnualRevenueBasisSource {
  readonly responseOrigin: NonNullable<
    ManagedAnnualReportState["responseOrigin"]
  >;
  readonly concept: PersonalSecAnnualRevenueConcept;
  readonly value: string;
  readonly unit: "USD";
  readonly startDate: string;
  readonly endDate: string;
  readonly accessionNumber: string;
  readonly filedDate: string;
  readonly form: string;
  readonly filingUrl: string;
  readonly cutoffAt: string;
  readonly completedAt: string;
  readonly companyFactsCapturedAt: string;
  readonly submissionsCapturedAt: string;
  readonly currentUseEligible: boolean;
  readonly showingPrevious: boolean;
  readonly observationIds: readonly `sec-fact:${string}`[];
}
export interface PreparedValuationRevenueBasis {
  readonly selection: ManagedResearchSelection;
  readonly source: AnnualRevenueBasisSource;
  readonly before: ValuationAssumptionEntry;
  readonly after: ValuationAssumptionEntry;
  readonly beforeRevenue: string;
  readonly afterRevenue: string;
  readonly excerpt: string;
}
export interface AppliedValuationRevenueBasis {
  readonly selection: ManagedResearchSelection;
  readonly source: AnnualRevenueBasisSource;
  readonly baseRevenue: string;
  readonly excerpt: string;
}
export interface ValuationRevenueBasisInput {
  readonly selection: ManagedResearchSelection;
  readonly annual: ManagedAnnualReportState;
  readonly concept: string;
  readonly isCurrent: () => boolean;
}
interface PreviewCapture {
  readonly handle: PreparedValuationRevenueBasis;
  readonly inputs: ManagedValuationInputCapture;
  readonly field: ManagedValuationBaseRevenueCapture;
  readonly current: () => boolean;
}
interface AppliedCapture {
  readonly current: () => boolean;
  retired: boolean;
  checking: boolean;
}
const appliedCaptures = new WeakMap<
  AppliedValuationRevenueBasis,
  AppliedCapture
>();
const stale =
  "The source, assumptions or company visit changed. Preview the Annual revenue basis again.";
const unavailable =
  "Select an available positive Annual revenue basis that fits the authored model's decimal limits.";

/** Match the existing model operand limits without running either authored calculator. */
function positiveModelRevenue(value: string) {
  if (value.length > VALUATION_ARITHMETIC.maximumDecimalLength) return false;
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > VALUATION_ARITHMETIC.maximumFractionalDigits)
    return false;
  if (!/[1-9]/u.test(value)) return false;
  const maximum = BigInt(VALUATION_ARITHMETIC.maximumAbsoluteOperand);
  const integer = BigInt(whole!);
  if (integer > maximum) return false;
  return integer !== maximum || !/[1-9]/u.test(fraction);
}
function sourceReady(annual: ManagedAnnualReportState) {
  if (!annual.supported || annual.catalogChanged) return false;
  if (annual.running || annual.checkingSeed) return false;
  if (annual.error && !annual.showingPrevious) return false;
  if (annual.responseOrigin === null) return false;
  return annual.response !== null;
}
function sourceIdentity(
  selection: ManagedResearchSelection,
  annual: ManagedAnnualReportState,
) {
  if (!companyEvidenceSelectionMatches(selection, annual.selection))
    return false;
  const response = annual.response;
  if (
    !response ||
    response.catalogSnapshotSha256 !== selection.catalogSnapshotSha256
  )
    return false;
  if (response.security.cik !== response.evidence.cik) return false;
  if (selection.cik !== null && selection.cik !== response.security.cik)
    return false;
  return (
    [
      "country",
      "exchangeMic",
      "issuerId",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
    ] as const
  ).every((key) => response.security[key] === selection.listing[key]);
}
/** Resolve one manual revenue choice independently of operating-income availability. */
export function resolveAnnualRevenueBasis(
  selection: ManagedResearchSelection,
  annual: ManagedAnnualReportState,
  concept: string,
): { source: AnnualRevenueBasisSource | null; reason: string | null } {
  try {
    if (
      !PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some((value) => value === concept)
    )
      return { source: null, reason: "Choose one named Annual revenue basis." };
    if (!sourceReady(annual))
      return {
        source: null,
        reason:
          "Load a supported Annual report before previewing its revenue basis.",
      };
    if (!sourceIdentity(selection, annual))
      return { source: null, reason: stale };
    return resolveRevenue(annual, concept);
  } catch {
    return { source: null, reason: unavailable };
  }
}
function sourceClocks(
  generation: PersonalSecAnnualCanonicalResponseDto["evidence"]["generation"],
) {
  const facts = generation.sources.companyFacts,
    submissions = generation.sources.submissions;
  if (facts.status !== "available" || submissions.status !== "available")
    return null;
  if (facts.fetchedAt === null || submissions.fetchedAt === null) return null;
  return {
    cutoffAt: generation.cutoffAt,
    completedAt: generation.completedAt,
    companyFactsCapturedAt: facts.fetchedAt,
    submissionsCapturedAt: submissions.fetchedAt,
  };
}
function resolveRevenue(
  annual: ManagedAnnualReportState,
  concept: string,
): { source: AnnualRevenueBasisSource | null; reason: string | null } {
  const response = annual.response!;
  const view = getManagedAnnualView(response);
  const { target, generation } = response.evidence;
  if (!view || target.status !== "target")
    return { source: null, reason: unavailable };
  const clocks = sourceClocks(generation);
  if (!clocks) return { source: null, reason: unavailable };
  const basis = view.operatingResults.resolution.margins.find(
    (value) => value.concept === concept,
  );
  const revenue = basis?.revenue;
  if (!basis || revenue?.status !== "available")
    return { source: null, reason: unavailable };
  if (revenue.unit !== "USD" || !positiveModelRevenue(revenue.value))
    return { source: null, reason: unavailable };
  return {
    source: Object.freeze({
      responseOrigin: annual.responseOrigin!,
      concept: basis.concept,
      value: revenue.value,
      unit: revenue.unit,
      startDate: revenue.startDate,
      endDate: revenue.endDate,
      accessionNumber: revenue.accessionNumber,
      filedDate: target.filedDate,
      form: target.form,
      filingUrl: `https://www.sec.gov/Archives/edgar/data/${response.evidence.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`,
      ...clocks,
      currentUseEligible: revenue.currentUseEligible,
      showingPrevious: annual.showingPrevious,
      observationIds: Object.freeze([...revenue.observationIds]),
    }),
    reason: null,
  };
}
function excerpt(
  selection: ManagedResearchSelection,
  source: AnnualRevenueBasisSource,
) {
  return [
    `Annual revenue basis for authored starting revenue: ${selection.listing.symbol} (${selection.listing.exchangeMic}); ${source.concept} USD ${source.value}, ${source.startDate} to ${source.endDate}.`,
    `${source.form} filed ${source.filedDate}; accession ${source.accessionNumber}; ${source.filingUrl}.`,
    `Original cutoff ${source.cutoffAt}; completed ${source.completedAt}; Company Facts captured ${source.companyFactsCapturedAt}; Submissions captured ${source.submissionsCapturedAt}.`,
    source.currentUseEligible
      ? "Current-use policy at original load: eligible."
      : "Historical evidence; current-use policy at original load: unavailable.",
    ...(source.showingPrevious ? ["Retained previous report."] : []),
    "Chosen reported revenue supplies authored starting revenue only. No other assumption or DCF cash flow is inferred; source dates are unchanged.",
  ].join(" ");
}
function safelyCurrent(current: () => boolean) {
  try {
    return current() === true;
  } catch {
    return false;
  }
}
function copySelection(selection: ManagedResearchSelection) {
  return Object.freeze({
    ...selection,
    listing: Object.freeze({ ...selection.listing }),
  });
}
function ownedSource(context: AppliedValuationRevenueBasis) {
  const capture = appliedCaptures.get(context);
  if (!capture || capture.retired || capture.checking) return false;
  capture.checking = true;
  const current = safelyCurrent(capture.current);
  capture.checking = false;
  if (!current) capture.retired = true;
  return current;
}
export function annualRevenueBasisContextIsOwned(
  context: AppliedValuationRevenueBasis,
  selection: ManagedResearchSelection,
  calculation: ManagedValuationCalculation | null,
): boolean {
  if (!appliedCaptures.has(context)) return false;
  if (!companyEvidenceSelectionMatches(selection, context.selection))
    return false;
  if (!ownedSource(context) || !calculation) return false;
  if (!companyEvidenceSelectionMatches(selection, calculation.owner))
    return false;
  if (calculation.exitDraft.baseRevenue !== context.baseRevenue) return false;
  return captureValuationCalculationGuard(calculation)?.() === true;
}
export function annualRevenueBasisExcerpt(
  context: AppliedValuationRevenueBasis,
): string | null {
  return ownedSource(context) ? context.excerpt : null;
}

/** Explicit source choice and one-use input replacement; never calculates, reads or saves. */
export class ManagedValuationRevenueBasis {
  private preview: PreviewCapture | null = null;
  private applied: AppliedValuationRevenueBasis | null = null;
  private revision = 0;
  private applying = false;
  private preparing = false;
  constructor(private readonly model: ManagedValuationWorkbench) {
    model.subscribe(() => this.reconcile());
  }
  retirePreview() {
    this.revision++;
    this.preview = null;
  }
  invalidate() {
    this.retirePreview();
    this.applied = null;
  }
  reconcile() {
    const preview = this.preview;
    if (preview) this.isCurrent(preview.handle);
    if (this.applied && !ownedSource(this.applied)) this.applied = null;
  }
  getApplied(
    selection: ManagedResearchSelection,
  ): AppliedValuationRevenueBasis | null {
    this.reconcile();
    if (!this.applied) return null;
    return companyEvidenceSelectionMatches(selection, this.applied.selection)
      ? this.applied
      : null;
  }
  prepare(input: ValuationRevenueBasisInput): {
    preview: PreparedValuationRevenueBasis | null;
    reason: string | null;
  } {
    if (this.applying || this.preparing)
      return { preview: null, reason: stale };
    this.preparing = true;
    try {
      return this.capture(input);
    } finally {
      this.preparing = false;
    }
  }
  private capture(input: ValuationRevenueBasisInput) {
    this.retirePreview();
    const revision = this.revision;
    if (!safelyCurrent(input.isCurrent))
      return { preview: null, reason: stale };
    if (revision !== this.revision) return { preview: null, reason: stale };
    const snapshot = this.model.getSnapshot();
    if (!companyEvidenceSelectionMatches(input.selection, snapshot.owner))
      return { preview: null, reason: stale };
    if (!companyEvidenceSelectionMatches(input.selection, snapshot.context))
      return { preview: null, reason: stale };
    const resolved = resolveAnnualRevenueBasis(
      input.selection,
      input.annual,
      input.concept,
    );
    if (!resolved.source) return { preview: null, reason: resolved.reason };
    return this.captureInputs(input, resolved.source, revision);
  }
  private captureInputs(
    input: ValuationRevenueBasisInput,
    source: AnnualRevenueBasisSource,
    revision: number,
  ) {
    const inputs = this.model.captureInputs(),
      field = this.model.captureBaseRevenue();
    if (!inputs || !field) return { preview: null, reason: stale };
    const selection = copySelection(input.selection);
    const before = inputs.entry;
    const after = Object.freeze({
      ...before,
      exit: Object.freeze({
        ...before.exit,
        inputs: Object.freeze({
          ...before.exit.inputs,
          baseRevenue: source.value,
        }),
      }),
    });
    const handle = Object.freeze({
      selection,
      source,
      before,
      after,
      beforeRevenue: field.value,
      afterRevenue: source.value,
      excerpt: excerpt(selection, source),
    });
    const current = () =>
      safelyCurrent(input.isCurrent) &&
      companyEvidenceSelectionMatches(input.selection, selection);
    const captured = { handle, inputs, field, current };
    if (!current() || revision !== this.revision)
      return { preview: null, reason: stale };
    if (!this.model.isInputCaptureCurrent(inputs))
      return { preview: null, reason: stale };
    this.preview = captured;
    return { preview: handle, reason: null };
  }
  isCurrent(preview: PreparedValuationRevenueBasis): boolean {
    const captured = this.preview;
    if (!captured || captured.handle !== preview) return false;
    const revision = this.revision;
    const current = safelyCurrent(captured.current);
    if (revision !== this.revision) return false;
    if (!current || !this.model.isInputCaptureCurrent(captured.inputs)) {
      this.retirePreview();
      return false;
    }
    return true;
  }
  apply(preview: PreparedValuationRevenueBasis): {
    applied: boolean;
    message: string;
  } {
    const captured = this.preview;
    if (!captured || captured.handle !== preview || this.applying)
      return { applied: false, message: stale };
    this.preview = null;
    const revision = ++this.revision;
    this.applying = true;
    try {
      return this.applyCaptured(captured, revision);
    } finally {
      this.applying = false;
    }
  }
  private applyCaptured(captured: PreviewCapture, revision: number) {
    if (!safelyCurrent(captured.current) || revision !== this.revision)
      return { applied: false, message: stale };
    if (!this.model.isInputCaptureCurrent(captured.inputs))
      return { applied: false, message: stale };
    this.applied = null;
    const value = captured.handle.source.value;
    if (!this.model.setExitField("baseRevenue", value))
      return { applied: false, message: stale };
    return this.attachApplied(captured, revision);
  }
  private attachApplied(captured: PreviewCapture, revision: number) {
    const field = this.model.captureBaseRevenueAfterApply(
      captured.field,
      captured.handle.source.value,
    );
    const inputs = this.model.captureInputs();
    if (!field || !inputs) return { applied: false, message: stale };
    if (JSON.stringify(inputs.entry) !== JSON.stringify(captured.handle.after))
      return { applied: false, message: stale };
    if (!safelyCurrent(captured.current) || revision !== this.revision)
      return { applied: false, message: stale };
    if (!this.model.isInputCaptureCurrent(inputs))
      return { applied: false, message: stale };
    if (!this.model.isBaseRevenueCaptureCurrent(field))
      return { applied: false, message: stale };
    const context = Object.freeze({
      selection: captured.handle.selection,
      source: captured.handle.source,
      baseRevenue: field.value,
      excerpt: captured.handle.excerpt,
    });
    this.applied = context;
    appliedCaptures.set(context, {
      current: () =>
        this.applied === context &&
        this.model.isBaseRevenueCaptureCurrent(field) &&
        safelyCurrent(captured.current),
      retired: false,
      checking: false,
    });
    return {
      applied: true,
      message:
        "Annual revenue applied to authored starting revenue. Calculate separately; no other input was changed.",
    };
  }
}
