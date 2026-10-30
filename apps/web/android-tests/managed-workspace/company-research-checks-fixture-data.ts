import type { SharedNativeFixture } from "./fixture";
import { holdingFollowupLedger } from "./holding-followup-fixture";
import {
  filingAssessmentOriginal,
  filingAssessmentExpected,
} from "./filing-check-assessment-fixture-data";
export {
  filingAssessmentRaw as companyCheckAssessment,
  filingAssessmentResult as companyCheckResult,
  filingAssessmentCitation as companyCheckCitation,
} from "./filing-check-assessment-fixture-data";
export const companyCheckNote =
  "Full unsaved company note · Café 東京 📈 <script>literal</script>\n" +
  "Keep the complete authored capacity assumptions and uncertainty. ".repeat(
    12,
  );
export const companyCheckIndependentResult =
  "Independent unsaved ONE assessment · Café 東京 📈";
export function companyChecksData(base: SharedNativeFixture) {
  const digest = base.researchCoverage.catalogSnapshotSha256;
  const watchlist = {
    schemaVersion: 1 as const,
    name: "My Watchlist" as const,
    snapshotSha256: digest,
    memberships: base.researchCoverage.listings
      .slice(0, 2)
      .map(({ listing }) => ({ ...listing, note: "Original saved note" })),
  };
  const portfolio = holdingFollowupLedger(base).payload!;
  const followups = filingAssessmentOriginal(base);
  return { watchlist, portfolio, followups };
}
export function companyChecksExpected(
  base: SharedNativeFixture,
  completedOn: string,
) {
  const payload = filingAssessmentExpected(base, completedOn);
  return {
    ...payload,
    entries: payload.entries.map((entry, index) =>
      index === 1 ? { ...entry, result: companyCheckIndependentResult } : entry,
    ),
  };
}
