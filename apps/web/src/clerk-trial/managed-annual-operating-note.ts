import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualOperatingMarginDto,
} from "@research-cockpit/contracts";
import { annualOperatingResults } from "../lib/sec-annual-operating-response";

/** Formats one admitted basis; the workspace owns current response and draft guards. */
export function annualOperatingNoteExcerpt(
  response: PersonalSecAnnualEvidenceResponseDto,
  basis: PersonalSecAnnualOperatingMarginDto,
  showingPrevious: boolean,
): string | null {
  const { evidence, security } = response;
  const { generation, target, operatingResults, cashGeneration, liquidity } =
    evidence;
  if (
    security.cik !== evidence.cik ||
    target.status !== "target" ||
    generation.sources.companyFacts.status !== "available" ||
    generation.sources.submissions.status !== "available" ||
    !operatingResults.resolution.margins.includes(basis)
  )
    return null;
  const ids = new Set(
    [
      ...evidence.observations,
      ...cashGeneration.operatingCashFlow.observations,
      ...cashGeneration.ppePurchases.observations,
      ...liquidity.currentAssets.observations,
      ...liquidity.currentLiabilities.observations,
    ].map((row) => row.id),
  );
  try {
    if (!annualOperatingResults(operatingResults, evidence, ids)) return null;
  } catch {
    return null;
  }
  const income = operatingResults.resolution.operatingIncome;
  const { revenue, operatingMargin } = basis;
  if (
    income.status !== "available" ||
    revenue.status !== "available" ||
    operatingMargin.status !== "available"
  )
    return null;
  const filing = `https://www.sec.gov/Archives/edgar/data/${evidence.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  return [
    `Observed Annual operating results: ${security.symbol} (${security.exchangeMic}); CIK ${evidence.cik}; ${target.form}, ${income.startDate} to ${income.endDate}.`,
    `Reported operating income (OperatingIncomeLoss) USD ${income.value}; reported revenue (${basis.concept}) USD ${revenue.value}.`,
    `App calculation: operating margin ${operatingMargin.value}% = operating income / positive revenue * 100 (two decimal places, half up). Same filing and exact period; revenue bases stay separate.`,
    `Filed ${target.filedDate}; accession ${target.accessionNumber}; filing ${filing}.`,
    `Original load cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; Company Facts captured ${generation.sources.companyFacts.fetchedAt}; Submissions captured ${generation.sources.submissions.fetchedAt}.`,
    operatingMargin.currentUseEligible
      ? "Current-use policy at original load: eligible."
      : "Historical evidence; current-use policy at original load: unavailable.",
    ...(showingPrevious ? ["Retained previous report."] : []),
    "Evidence dates are unchanged; this action does not refresh sources.",
  ].join(" ");
}
