import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import { VALUATION_ARITHMETIC } from "@research-cockpit/research-core/valuation";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import { getManagedAnnualView } from "./managed-annual-view";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ManagedResearchSelection } from "./managed-research-selection";

export interface AnnualRevenueBasisSource {
  readonly cik: string;
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
export const ANNUAL_REVENUE_BASIS_STALE =
  "The source, assumptions or company visit changed. Preview the Annual revenue basis again.";
const unavailable =
  "Select an available positive Annual revenue basis that fits the authored model's decimal limits.";
type AnnualResponse = PersonalSecAnnualCanonicalResponseDto;
type AnnualView = NonNullable<ReturnType<typeof getManagedAnnualView>>;
type AnnualTarget = Extract<
  AnnualResponse["evidence"]["target"],
  { status: "target" }
>;
type AvailableRevenue = Extract<
  AnnualView["operatingResults"]["resolution"]["margins"][number]["revenue"],
  { status: "available" }
>;
interface SelectedRevenue {
  readonly concept: PersonalSecAnnualRevenueConcept;
  readonly revenue: AvailableRevenue;
}

/** Lexical admission uses the existing authored-model operand limits. */
function modelRevenueOperand(value: string) {
  if (value.length > VALUATION_ARITHMETIC.maximumDecimalLength) return null;
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > VALUATION_ARITHMETIC.maximumFractionalDigits)
    return null;
  return { whole: whole!, fraction };
}
/** Admit a positive bounded operand without rounding or running a calculator. */
function positiveModelRevenue(value: string) {
  const operand = modelRevenueOperand(value);
  if (!operand) return false;
  if (!/[1-9]/u.test(value)) return false;
  const maximum = BigInt(VALUATION_ARITHMETIC.maximumAbsoluteOperand);
  const integer = BigInt(operand.whole);
  if (integer > maximum) return false;
  return integer !== maximum || !/[1-9]/u.test(operand.fraction);
}
function settledAnnualResponse(annual: ManagedAnnualReportState) {
  if (annual.running) return false;
  if (annual.checkingSeed) return false;
  if (annual.responseOrigin === null) return false;
  return annual.response !== null;
}
function sourceReady(annual: ManagedAnnualReportState) {
  if (!annual.supported) return false;
  if (annual.catalogChanged) return false;
  if (annual.error && !annual.showingPrevious) return false;
  return settledAnnualResponse(annual);
}
function sourceSecurityMatches(
  selection: ManagedResearchSelection,
  response: AnnualResponse,
) {
  if (response.catalogSnapshotSha256 !== selection.catalogSnapshotSha256)
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
function sourceIdentity(
  selection: ManagedResearchSelection,
  annual: ManagedAnnualReportState,
) {
  if (!companyEvidenceSelectionMatches(selection, annual.selection))
    return false;
  if (annual.response === null) return false;
  return sourceSecurityMatches(selection, annual.response);
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
      return { source: null, reason: ANNUAL_REVENUE_BASIS_STALE };
    return resolveRevenue(annual, concept);
  } catch {
    return { source: null, reason: unavailable };
  }
}
function capturedSourceClock(
  source: AnnualResponse["evidence"]["generation"]["sources"]["companyFacts"],
) {
  if (source.status !== "available") return null;
  return source.fetchedAt;
}
function sourceClocks(generation: AnnualResponse["evidence"]["generation"]) {
  const facts = capturedSourceClock(generation.sources.companyFacts);
  const submissions = capturedSourceClock(generation.sources.submissions);
  if (facts === null) return null;
  if (submissions === null) return null;
  return {
    cutoffAt: generation.cutoffAt,
    completedAt: generation.completedAt,
    companyFactsCapturedAt: facts,
    submissionsCapturedAt: submissions,
  };
}
function selectedRevenue(
  view: AnnualView,
  concept: string,
): SelectedRevenue | null {
  const basis = view.operatingResults.resolution.margins.find(
    (value) => value.concept === concept,
  );
  if (!basis) return null;
  const revenue = basis.revenue;
  if (revenue.status !== "available") return null;
  if (revenue.unit !== "USD") return null;
  if (!positiveModelRevenue(revenue.value)) return null;
  return { concept: basis.concept, revenue };
}
function captureRevenueSource(
  annual: ManagedAnnualReportState,
  target: AnnualTarget,
  selected: SelectedRevenue,
  clocks: NonNullable<ReturnType<typeof sourceClocks>>,
): AnnualRevenueBasisSource {
  const response = annual.response!,
    { revenue, concept } = selected;
  return Object.freeze({
    cik: response.evidence.cik,
    responseOrigin: annual.responseOrigin!,
    concept,
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
  });
}
function resolveRevenue(
  annual: ManagedAnnualReportState,
  concept: string,
): { source: AnnualRevenueBasisSource | null; reason: string | null } {
  const response = annual.response!,
    view = getManagedAnnualView(response);
  const { target, generation } = response.evidence;
  if (!view) return { source: null, reason: unavailable };
  if (target.status !== "target") return { source: null, reason: unavailable };
  const clocks = sourceClocks(generation);
  if (!clocks) return { source: null, reason: unavailable };
  const selected = selectedRevenue(view, concept);
  if (!selected) return { source: null, reason: unavailable };
  return {
    source: captureRevenueSource(annual, target, selected, clocks),
    reason: null,
  };
}

export function annualRevenueSourceExcerpt(
  selection: ManagedResearchSelection,
  source: AnnualRevenueBasisSource,
) {
  return [
    `Annual revenue basis for authored starting revenue: ${selection.listing.symbol} (${selection.listing.exchangeMic}); ${source.concept} USD ${source.value}, ${source.startDate} to ${source.endDate}.`,
    `SEC source CIK ${source.cik}; ${source.form} filed ${source.filedDate}; accession ${source.accessionNumber}; ${source.filingUrl}.`,
    `Original cutoff ${source.cutoffAt}; completed ${source.completedAt}; Company Facts captured ${source.companyFactsCapturedAt}; Submissions captured ${source.submissionsCapturedAt}.`,
    source.currentUseEligible
      ? "Current-use policy at original load: eligible."
      : "Historical evidence; current-use policy at original load: unavailable.",
    ...(source.showingPrevious ? ["Retained previous report."] : []),
    "Chosen reported revenue supplies authored starting revenue only. No other assumption or DCF cash flow is inferred; source dates are unchanged.",
  ].join(" ");
}
