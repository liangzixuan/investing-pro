import { createNativeScreenComparisonReportFixture } from "./native-screen-comparison-report-fixture";
import { createNativeFollowupsReviewReportFixture } from "./native-followups-review-report-fixture";
import { createNativeValuationCollectionDraftFileFixture } from "./native-valuation-collection-file-fixture";
import { createNativeResearchDraftSetFileFixture } from "./native-research-draft-set-file-fixture";
import { Capacitor } from "@capacitor/core";
import { createFixture } from "./fixture";
import {
  createNativeFinancialScreenRecipeFixture,
  createNativeFinancialScreenRecipeSession,
} from "./native-financial-screen-recipe-fixture";
import { createNativeReportFixture } from "./native-report-fixture";
import { createNativePortfolioReviewReportFixture } from "./native-portfolio-review-report-fixture";
import { createNativeExportFixture } from "./native-export-fixture";
import { createNativeDraftFileFixture } from "./native-draft-file-fixture";
import { createNativeValuationDraftFileFixture } from "./native-valuation-draft-file-fixture";
if (
  Capacitor.getPlatform() !== "android" ||
  location.origin !== "https://localhost"
)
  throw new Error("This invented fixture runs only in Android instrumentation");
// Instrumentation selects this fixed scenario in its copied test document before mounting.
const allowedScenarios = [
  "catalog-startup-recovery",
  "company-direct-entry",
  "annual-note",
  "annual-cash-history",
  "annual-operating-results",
  "annual-operating-history",
  "annual-liquidity-history",
  "annual-financial-review",
  "annual-statements",
  "interim-statements",
  "authored-valuation",
  "saved-valuation",
  "annual-revenue-model-basis",
  "valuation-scenario-followup",
  "cpi-headline-followup",
  "annual-balance-sheet",
  "annual-operating-comparison",
  "company-snapshot",
  "company-snapshot-loading",
  "reviewed-company-source-pass",
  "report-revisit",
  "research-followups",
  "followups-review-session",
  "holding-followup",
  "markets-source-review",
  "markets-calendar-followup",
  "filing-dated-question",
  "followup-assessment-note",
  "review-check-completion",
  "valuation-collection-recovery",
  "research-draft-set",
  "filing-check-assessment",
  "portfolio-ledger",
  "portfolio-close-review",
  "portfolio-review-report",
  "portfolio-composition-review",
  "followups-review-report",
  "markets-day-view",
  "company-price-ranges",
  "thesis-review",
  "price-comparison-note",
  "price-studies",
  "screen-comparison",
  "screen-comparison-report",
  "screen-comparison-followup",
  "financial-screen",
  "valuation-price",
  "company-filings",
  "watchlist-filings-review",
  "markets-price-handoff",
  "watchlist-recovery",
  "signout-save-review",
  "signout-uncertain-review",
  "raw-close-comparison",
  "bea-agenda",
  "bea-agenda-comparison",
  "bea-session-retirement",
  "fed-announcements",
  "annual-comparison",
  "markets-selected-price",
  "watchlist-comparison",
  "watchlist-export",
  "watchlist-draft-file",
] as const;
type FixtureScenario = (typeof allowedScenarios)[number];
const scenarioSet = new Set<unknown>(allowedScenarios);
function admitScenario(
  value: string | null | undefined,
): FixtureScenario | undefined {
  if (value === undefined) return undefined;
  if (scenarioSet.has(value)) return value as FixtureScenario;
  throw new Error("Unknown invented Android test scenario");
}
export const scenario = admitScenario(
  document
    .querySelector('meta[name="investment-android-test-scenario"]')
    ?.getAttribute("content"),
);
// Fixed test input before the router mounts; no navigation or account bypass.
if (scenario === "company-direct-entry")
  history.replaceState(null, "", "/?company=listing-zero&section=annual");
export const fixture = await createFixture(scenario ?? "default");
export const nativeReport =
  scenario === "company-snapshot" ||
  scenario === "reviewed-company-source-pass" ||
  scenario === "annual-revenue-model-basis" ||
  scenario === "annual-statements" ||
  scenario === "interim-statements"
    ? createNativeReportFixture()
    : null;
export const nativePortfolioReviewReport =
  scenario === "portfolio-review-report" ||
  scenario === "portfolio-composition-review"
    ? createNativePortfolioReviewReportFixture()
    : null;
export const nativeExport =
  scenario === "watchlist-export" ? createNativeExportFixture() : null;
export const nativeDraftFile =
  scenario === "watchlist-draft-file" ? createNativeDraftFileFixture() : null;
export const nativeScreenRecipe = createNativeFinancialScreenRecipeSession(
  scenario === "financial-screen"
    ? createNativeFinancialScreenRecipeFixture()
    : null,
);
export const nativeResearchDraftSetFile =
  scenario === "research-draft-set"
    ? createNativeResearchDraftSetFileFixture()
    : null;
export const nativeValuationCollectionDraftFile =
  scenario === "valuation-collection-recovery"
    ? createNativeValuationCollectionDraftFileFixture()
    : null;
export const nativeValuationDraftFile =
  scenario === "saved-valuation"
    ? createNativeValuationDraftFileFixture()
    : null;

export const nativeFollowupsReviewReport =
  scenario === "followups-review-report" ||
  scenario === "filing-check-assessment" ||
  scenario === "review-check-completion"
    ? createNativeFollowupsReviewReportFixture()
    : null;

export const nativeScreenComparisonReport =
  scenario === "screen-comparison-report"
    ? createNativeScreenComparisonReportFixture()
    : null;
