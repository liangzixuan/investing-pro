import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
} from "@research-cockpit/contracts";

/** Formats one pair from the already admitted report; never loads or saves data. */
export function annualNoteExcerpt(
  response: PersonalSecAnnualEvidenceResponseDto,
  pair: PersonalSecAnnualPairDto,
  showingPrevious: boolean,
): string | null {
  const { target, completeness, resolution, generation, cik } =
    response.evidence;
  if (
    target.status !== "target" ||
    completeness.status !== "complete" ||
    !resolution.selectedReportPairEligible ||
    !resolution.bases.some(
      (basis) =>
        basis.status === "eligible" &&
        basis.concept === pair.concept &&
        basis.pairs.includes(pair),
    ) ||
    pair.status !== "eligible" ||
    pair.accessionNumber !== target.accessionNumber ||
    pair.endDate !== target.reportDate ||
    pair.startDate === null ||
    pair.revenue === null ||
    pair.netIncome === null ||
    pair.netMarginPercent === null ||
    generation.sources.companyFacts.status !== "available" ||
    generation.sources.submissions.status !== "available" ||
    generation.sources.companyFacts.fetchedAt === null ||
    generation.sources.submissions.fetchedAt === null
  )
    return null;

  const filing = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  return [
    `Observed Annual report: ${response.security.symbol} (${response.security.exchangeMic}); ${target.form} ${pair.startDate} to ${pair.endDate}; ${pair.concept} revenue USD ${pair.revenue}; NetIncomeLoss USD ${pair.netIncome}; net margin ${pair.netMarginPercent}%.`,
    `Filed ${target.filedDate}; accession ${target.accessionNumber}; filing ${filing}.`,
    `Original load cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; Company Facts captured ${generation.sources.companyFacts.fetchedAt}; Submissions captured ${generation.sources.submissions.fetchedAt}.`,
    resolution.currentTargetEligible
      ? "Current-use policy at original load: eligible."
      : "Historical evidence; current-use policy at original load: unavailable.",
    ...(showingPrevious ? ["Retained previous report."] : []),
    "Evidence dates are unchanged; this action does not refresh sources.",
  ].join(" ");
}
