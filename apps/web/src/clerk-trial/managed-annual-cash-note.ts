import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { annualCashGeneration } from "../lib/sec-annual-cash-response";

function hasConsistentCash(
  response: PersonalSecAnnualEvidenceResponseDto,
): boolean {
  const { evidence, security } = response;
  const { generation } = evidence;
  if (
    security.cik !== evidence.cik ||
    generation.sources.companyFacts.status !== "available" ||
    generation.sources.submissions.status !== "available" ||
    generation.sources.companyFacts.fetchedAt === null ||
    generation.sources.submissions.fetchedAt === null
  )
    return false;
  try {
    return annualCashGeneration(
      evidence.cashGeneration,
      evidence,
      new Set(evidence.observations.map((row) => row.id)),
    );
  } catch {
    return false;
  }
}

/** Formats admitted cash evidence; the caller owns current-response and draft guards. */
export function annualCashNoteExcerpt(
  response: PersonalSecAnnualEvidenceResponseDto,
  showingPrevious: boolean,
): string | null {
  const { target, generation, cik, cashGeneration } = response.evidence;
  const { operatingCashFlow, ppePurchases, operatingCashFlowLessPpePurchases } =
    cashGeneration.resolution;
  if (
    target.status !== "target" ||
    operatingCashFlow.status !== "available" ||
    ppePurchases.status !== "available" ||
    operatingCashFlowLessPpePurchases.status !== "available" ||
    !hasConsistentCash(response)
  )
    return null;

  const filing = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  return [
    `Observed Annual cash generation: ${response.security.symbol} (${response.security.exchangeMic}); CIK ${cik}; ${target.form} ${operatingCashFlow.startDate} to ${operatingCashFlow.endDate}.`,
    `Reported operating cash flow (NetCashProvidedByUsedInOperatingActivities) USD ${operatingCashFlow.value}; reported PP&E purchases (PaymentsToAcquirePropertyPlantAndEquipment) USD ${ppePurchases.value}.`,
    `App calculation: operating cash flow less PP&E purchases USD ${operatingCashFlowLessPpePurchases.value}. Same filing and period; no adjustments for leases, acquisitions or other investing cash flows.`,
    `Filed ${target.filedDate}; accession ${target.accessionNumber}; filing ${filing}.`,
    `Original load cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; Company Facts captured ${generation.sources.companyFacts.fetchedAt}; Submissions captured ${generation.sources.submissions.fetchedAt}.`,
    operatingCashFlowLessPpePurchases.currentUseEligible
      ? "Current-use policy at original load: eligible."
      : "Historical evidence; current-use policy at original load: unavailable.",
    ...(showingPrevious ? ["Retained previous report."] : []),
    "Evidence dates are unchanged; this action does not refresh sources.",
  ].join(" ");
}
