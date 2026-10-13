import type {
  PersonalSecAnnualBasisDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
  PersonalSecAnnualResolutionDto,
} from "@research-cockpit/contracts";
import {
  comparePersonalSecAnnualEvidence,
  resolvePersonalSecAnnualEvidence,
  type PersonalSecAnnualComparison,
} from "@research-cockpit/personal-financial-analytics";
import { annualComparisonPercentText } from "../lib/sec-annual-comparison-display";

type Response = PersonalSecAnnualEvidenceResponseDto;
type UnavailableComparison = Extract<
  PersonalSecAnnualComparison,
  { status: "unavailable" }
>;

export interface ManagedAnnualComparisonDisplay {
  readonly basisChoices: readonly Readonly<
    Pick<PersonalSecAnnualBasisDto, "concept" | "status">
  >[];
  readonly selectedBasis: string | null;
  readonly current: Readonly<{
    startDate: string;
    endDate: string;
    revenueUSD: string;
    netIncomeUSD: string;
    netMarginPercent: string | null;
    observationIds: readonly string[];
  }> | null;
  readonly currentReason: string | null;
  readonly currentUse: Readonly<{
    eligible: boolean;
    message: string;
    utilityAge: PersonalSecAnnualResolutionDto["utilityAge"];
  }> | null;
  readonly revenueChange: Readonly<{
    differenceUSD: string;
    percentText: string;
    priorStartDate: string;
    priorEndDate: string;
    currentStartDate: string;
    currentEndDate: string;
    observationIds: readonly string[];
  }> | null;
  readonly revenueChangeReason: string | null;
  readonly source: Readonly<{
    cik: string;
    catalogSnapshotSha256: string;
    target: Response["evidence"]["target"];
    generation: Response["evidence"]["generation"];
    filingUrl: string | null;
  }> | null;
}

const comparisonReasons: Readonly<
  Record<UnavailableComparison["reason"], string>
> = {
  current_report_unavailable: "A valid current annual pair is required.",
  current_use_unavailable:
    "The report is outside the current-use policy at its original load.",
  previous_period_missing:
    "The immediately preceding annual revenue and net-income period is missing for this basis.",
  previous_period_ambiguous:
    "The preceding annual observations have conflicting start dates.",
  previous_period_invalid:
    "The preceding annual period or metadata cannot be admitted.",
  filing_metadata_mismatch:
    "The comparison inputs do not match the selected filing metadata.",
  previous_values_conflicted:
    "The preceding annual observations contain conflicting values.",
};

/** Presentation of one validated packet; basis selection never joins companies or filings. */
export function projectAnnualComparison(
  response: Response | null,
  requestedBasis?: string,
): ManagedAnnualComparisonDisplay {
  if (response === null)
    return Object.freeze({
      basisChoices: Object.freeze([]),
      selectedBasis: requestedBasis ?? null,
      current: null,
      currentReason: "Load an Annual report to inspect reported amounts.",
      currentUse: null,
      revenueChange: null,
      revenueChangeReason: "Load an Annual report to inspect reported change.",
      source: null,
    });

  const resolution = resolvePersonalSecAnnualEvidence(response.evidence);
  const selectedBasis =
    requestedBasis ??
    resolution.bases.find((basis) => basis.status === "eligible")?.concept ??
    resolution.bases[0]?.concept ??
    null;
  const basis = resolution.bases.find((item) => item.concept === selectedBasis);
  const current = currentAmounts(basis);
  const currentReason = current === null ? basisReason(basis) : null;
  return Object.freeze({
    basisChoices: Object.freeze(
      resolution.bases.map(({ concept, status }) =>
        Object.freeze({ concept, status }),
      ),
    ),
    selectedBasis,
    current,
    currentReason,
    currentUse: Object.freeze({
      eligible: resolution.currentTargetEligible,
      message: resolution.currentTargetEligible
        ? "Within current-use limits at this load."
        : "Unavailable under the current-use policy at this load. Any valid reported amounts remain historical; reported change is unavailable.",
      utilityAge: resolution.utilityAge,
    }),
    ...revenueChange(response, basis, currentReason),
    source: sourceCoordinates(response),
  });
}

function currentAmounts(
  basis: PersonalSecAnnualBasisDto | undefined,
): ManagedAnnualComparisonDisplay["current"] {
  const pair = basis?.pairs.find((item) => item.status === "eligible");
  if (
    !pair ||
    pair.startDate === null ||
    pair.revenue === null ||
    pair.netIncome === null
  )
    return null;
  return Object.freeze({
    startDate: pair.startDate,
    endDate: pair.endDate,
    revenueUSD: pair.revenue,
    netIncomeUSD: pair.netIncome,
    netMarginPercent: pair.netMarginPercent,
    observationIds: pairObservationIds(pair),
  });
}

function pairObservationIds(pair: PersonalSecAnnualPairDto) {
  return Object.freeze([
    ...pair.revenueObservationIds,
    ...pair.incomeObservationIds,
  ]);
}

function basisReason(basis: PersonalSecAnnualBasisDto | undefined): string {
  if (!basis || basis.status === "missing")
    return "The selected revenue basis is missing from this report. Choose another basis explicitly.";
  if (basis.status === "withheld")
    return "Annual amounts are withheld because the selected report evidence is incomplete. Inspect its source details.";
  return "No valid same-filing annual revenue and net-income pair is available for this basis. Inspect its source details.";
}

function revenueChange(
  response: Response,
  basis: PersonalSecAnnualBasisDto | undefined,
  currentReason: string | null,
): Pick<
  ManagedAnnualComparisonDisplay,
  "revenueChange" | "revenueChangeReason"
> {
  if (!basis || currentReason !== null)
    return { revenueChange: null, revenueChangeReason: currentReason };
  const change = comparePersonalSecAnnualEvidence(
    response.evidence,
    basis.concept,
  );
  if (change.status === "unavailable")
    return {
      revenueChange: null,
      revenueChangeReason: comparisonReasons[change.reason],
    };
  return {
    revenueChange: Object.freeze({
      differenceUSD: change.revenue.difference,
      percentText: annualComparisonPercentText(change.revenue),
      priorStartDate: change.priorStartDate,
      priorEndDate: change.priorEndDate,
      currentStartDate: change.currentStartDate,
      currentEndDate: change.currentEndDate,
      observationIds: change.observationIds,
    }),
    revenueChangeReason: null,
  };
}

function sourceCoordinates(
  response: Response,
): ManagedAnnualComparisonDisplay["source"] {
  const { cik, target, generation } = response.evidence;
  return Object.freeze({
    cik,
    catalogSnapshotSha256: response.catalogSnapshotSha256,
    target,
    generation,
    filingUrl:
      target.status === "target"
        ? `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`
        : null,
  });
}
