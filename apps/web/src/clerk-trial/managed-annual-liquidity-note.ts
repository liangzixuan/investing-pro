import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { getManagedAnnualView } from "./managed-annual-view";

/** Formats admitted liquidity; the caller owns current-response and draft guards. */
export function annualLiquidityNoteExcerpt(
  response: PersonalSecAnnualCanonicalResponseDto,
  showingPrevious: boolean,
): string | null {
  const view = getManagedAnnualView(response);
  if (view === null) return null;
  const { target, generation, cik } = response.evidence;
  const { currentAssets, currentLiabilities, workingCapital, currentRatio } =
    view.liquidity.resolution;
  if (
    target.status !== "target" ||
    currentAssets.status !== "available" ||
    currentLiabilities.status !== "available" ||
    workingCapital.status !== "available" ||
    (currentRatio.status !== "available" &&
      (currentRatio.reason !== "nonpositive_current_liabilities" ||
        currentLiabilities.value !== "0"))
  )
    return null;

  const ratio =
    currentRatio.status === "available"
      ? `current ratio ${currentRatio.value} multiple (two decimal places, half up).`
      : "current ratio unavailable because current liabilities are zero.";
  const filing = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  return [
    `Observed Annual liquidity: ${response.security.symbol} (${response.security.exchangeMic}); CIK ${cik}; ${target.form} balances at ${workingCapital.asOfDate}.`,
    `Reported current assets (AssetsCurrent) USD ${currentAssets.value}; reported current liabilities (LiabilitiesCurrent) USD ${currentLiabilities.value}.`,
    `App calculations: working capital USD ${workingCapital.value}; ${ratio}`,
    "Same filing and date. Current assets are not all cash.",
    `Filed ${target.filedDate}; accession ${target.accessionNumber}; filing ${filing}.`,
    `Original load cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; Company Facts captured ${generation.sources.companyFacts.fetchedAt}; Submissions captured ${generation.sources.submissions.fetchedAt}.`,
    workingCapital.currentUseEligible
      ? "Current-use policy at original load: eligible."
      : "Historical evidence; current-use policy at original load: unavailable.",
    ...(showingPrevious ? ["Retained previous report."] : []),
    "Evidence dates are unchanged; this action does not refresh sources.",
  ].join(" ");
}
