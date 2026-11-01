import {
  createPortfolioDatedReviewFixture,
  type PortfolioDatedReviewFixture,
} from "./portfolio-dated-review-fixture";
import {
  createReviewFilingsEvidenceFixture,
  type ReviewFilingsEvidenceFixture,
} from "./review-filings-evidence-fixture";
import {
  createPortfolioHeldDueChecksFixture,
  type PortfolioHeldDueChecksFixture,
} from "./portfolio-held-due-checks-fixture";
import {
  createPortfolioReportComparisonFixture,
  type PortfolioReportComparisonFixture,
} from "./portfolio-report-comparison-fixture";
import {
  createPortfolioScreenSelectionFixture,
  type PortfolioScreenSelectionFixture,
} from "./portfolio-screen-selection-fixture";
import {
  createReportComparisonCheckFixture,
  type ReportComparisonCheckFixture,
} from "./report-comparison-check-fixture";
import {
  createCompanyResearchChecksFixture,
  type CompanyResearchChecksFixture,
} from "./company-research-checks-fixture";
import {
  createResearchDraftSetFixture,
  type ResearchDraftSetFixtureControls,
} from "./research-draft-set-fixture";
import {
  createValuationCollectionRecoveryFixture,
  type ValuationCollectionRecoveryControls,
} from "./valuation-collection-recovery-fixture";
import {
  createReviewCompletionNativeFixture,
  type ReviewCompletionMetadata,
} from "./review-check-completion-fixture";
import {
  createFilingAssessmentNativeFixture,
  type FilingAssessmentNativeMetadata,
} from "./filing-check-assessment-fixture";
import {
  createScreenComparisonFollowupNativeFixture,
  type ScreenComparisonFollowupNativeMetadata,
} from "./screen-comparison-followup-fixture";
import {
  createScreenComparisonReportNativeFixture,
  type ScreenComparisonReportNativeMetadata,
} from "./screen-comparison-report-fixture";
import { createMarketsBriefingNativeFixture } from "./markets-briefing-fixture";
import { createCpiHeadlineFollowupNativeFixture } from "./cpi-headline-followup-fixture";
import { createValuationScenarioFollowupNativeFixture } from "./valuation-scenario-followup-fixture";
import {
  annualRevenueModelInputs,
  createAnnualRevenueModelBasisNativeFixture,
} from "./annual-revenue-model-basis-fixture";
import {
  createReviewedCompanySourcePassNativeFixture,
  type ReviewedCompanySourcePassControls,
} from "./reviewed-company-source-pass-fixture";
import {
  createInterimStatementsNativeFixture,
  type NativeInterimStatementsMetadata,
} from "./interim-statements-fixture";
import { createPortfolioCompositionNativeFixture } from "./portfolio-composition-fixture";
import { createCalendarFollowupNativeFixture } from "./calendar-followup-fixture";
import {
  createMarketsSourceReviewNativeFixture,
  type SourceReviewFixtureControls,
} from "./markets-source-review-fixture";
import { createHoldingFollowupNativeFixture } from "./holding-followup-fixture";
import { createFollowupsReviewReportNativeFixture } from "./native-followups-review-report-fixture";
import { createFilingDatedQuestionNativeFixture } from "./filing-dated-question-fixture";
import { createFollowupAssessmentNoteNativeFixture } from "./followup-assessment-note-fixture";
import { createFollowupsReviewSessionNativeFixture } from "./followups-review-session-fixture";
import {
  createCompanySnapshotLoadingNativeFixture,
  type SnapshotLoadingFixtureControls,
} from "./company-snapshot-loading-fixture";
import { createPortfolioReviewReportNativeFixture } from "./native-portfolio-review-report-fixture";
import { createPortfolioCloseNativeFixture } from "./portfolio-close-fixture";
import { createReportRevisitNativeFixture } from "./report-revisit-fixture";
import { inventedManagedResearchCoverage } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import {
  createScreenComparisonNativeFixture,
  type NativeScreenComparisonMetadata,
} from "./screen-comparison-fixture";
import {
  createAnnualStatementsNativeFixture,
  type NativeAnnualStatementsMetadata,
} from "./annual-statements-fixture";
import { createPriceStudiesNativeFixture } from "./price-studies-fixture";
import {
  createValuationPriceNativeFixture,
  type NativeValuationPriceMetadata,
} from "./valuation-price-fixture";
import {
  createFinancialScreenNativeFixture,
  type NativeFinancialScreenMetadata,
} from "./financial-screen-fixture";
import {
  createPortfolioNativeFixture,
  type PortfolioNativeControls,
} from "./portfolio-fixture";
import { createFinancialReviewNativeFixture } from "./financial-review-native-fixture";
import { createFilingsReviewNativeFixture } from "./filings-review-fixture";
import { withDraftFileCatalogFixture } from "./draft-file-catalog-fixture";
import { balanceSheetPacket } from "./balance-sheet-fixture";
import { liquidityHistoryPacket } from "./liquidity-history-fixture";
import { operatingHistoryPacket } from "./operating-history-fixture";
import { inventedOperatingPacket } from "./operating-fixture";
import {
  operatingComparisonPacket,
  operatingComparisonNoteDraft,
} from "./operating-comparison-fixture";
import type {
  MainWatchlistPayload,
  ResearchFollowup,
  ManagedCatalogSnapshotDto,
  ManagedEodHistoryResponseDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecAnnualCanonicalResponseDto,
  PersonalEconomicCalendarDto,
  ManagedSecFilingsResponseDto,
  PersonalMonetaryAnnouncementsDto,
  ValuationAssumptionEntry,
  ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import { createResearchFollowupsFixture } from "./followups-fixture";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedEodHistoryResponse,
  parseManagedWatchlistCommand,
  parseManagedResearchFollowupsCommand,
  parseManagedEconomicCalendar,
  parseManagedSecFilingsRequest,
  PERSONAL_BEA_CALENDAR_SOURCE,
  PERSONAL_FED_MONETARY_SOURCE,
  parseManagedMonetaryAnnouncements,
  parseValuationAssumptionEntry,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  MANAGED_VALUATION_DCF_MODEL_VERSION,
  MANAGED_VALUATION_EXIT_MODEL_VERSION,
} from "@research-cockpit/contracts";
import {
  ManagedEodHistoryError,
  type ManagedApi,
} from "../../src/clerk-trial/managed-api";
import { listingMembership } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import {
  annualHistoryRows,
  response,
  row,
} from "../../src/features/research/test-canonical-annual-ui-fixture";
import {
  annualCashHistoryRows,
  cashRow,
} from "../../src/features/research/sec-annual-cash-fixture";
import { liquidityRow } from "../../src/features/research/sec-annual-liquidity-fixture";
import { TrialApiError } from "../../src/clerk-trial/api";
import { inventedFilingsPacket } from "./filings-fixture";
import {
  annualComparisonResponse,
  annualComparisonBalanceRows,
  parseAnnualComparisonFixture,
} from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import { fedAnnouncementsFixture } from "../../src/clerk-trial/fed-announcements-fixture";

const digest = `sha256:${"a".repeat(64)}` as const;
export const authoredValuationPrefix = "Authored valuation thesis";
export const authoredValuationNoteDraft = [
  authoredValuationPrefix,
  `Authored valuation: ZERO (XNAS), listing listing-zero, security security-zero, class class-zero, issuer issuer-zero, CIK unavailable, catalog ${digest}; base scenario.`,
  "All money is USD; shares are diluted shares; rates are percent. Assumptions are authored, not reported financial facts or current prices. Scenario context, not a recommendation.",
  "DCF authored-cash-flow-dcf-v1, schema 1.0.0: starting unlevered cash flow 100; signed enterprise-to-equity bridge 100; shares 10; years 5; WACC 10%; terminal growth 0%; annual cash-flow growth 10%.",
  "Enterprise value 1500.00; equity value 1400.00; value/share 140.00; explicit cash-flow present value 500.00; terminal present value 1000.00; terminal value 1610.51; terminal share of enterprise value 66.67%.",
  "Method: CF(t)=starting CF*(1+growth)^t; discount each year-end CF by (1+WACC)^t; terminal=final CF*(1+terminal growth)/(WACC-terminal growth); enterprise=sum of present values; equity=enterprise-signed bridge; value/share=equity/shares. Decimal arithmetic, half-up; money and value/share 2 decimals.",
].join(" ");
export const thesisReviewNoteDraft =
  "Original thesis Thesis review (my assessment). Research purpose: Review a holding | Time horizon: The next two filed reports | My thesis: Margins can recover | Supporting evidence: Invented report 2026-10-01 | Opposing evidence: Demand remains uncertain | Confirmation condition: Two stronger reported periods | Invalidation condition: Cash keeps falling | Next check: Read the next filed report";
export const annualComparisonNoteDraft = [
  "Draft survives native Back Observed Annual cash comparison; exact, unscaled USD. OCF = NetCashProvidedByUsedInOperatingActivities; PP&E = PaymentsToAcquirePropertyPlantAndEquipment.",
  "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 10-K 2025-01-01 to 2025-12-31; reported OCF USD 1000; reported PP&E USD 250; app calculation OCF less PP&E USD 750.",
  "CIK 0000000001; filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm.",
  "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load. Retained previous report.",
  "ONE (One Company; One Class A; Class A; XNAS, US): 10-K 2024-07-01 to 2025-06-30; reported OCF USD 900; reported PP&E USD 300; app calculation OCF less PP&E USD 600.",
  "CIK 0000000002; filed 2025-08-01; accession 0000000002-25-000001; filing https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm.",
  "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load.",
  "The app calculation uses each company's same filing and period; no adjustment for leases, acquisitions or other investing cash flows.",
  "Company periods may differ; no cross-company calculation or ranking. Evidence dates are unchanged; this action does not refresh sources.",
].join(" ");
export const signOutNoteDraft = "Sign-out review draft";
export const filingsNoteDraft =
  "Draft survives native Back Observed SEC filing reference: ZERO (XNAS); CIK 0000000001; Form 8-K; accession 0000000001-26-000026; filed 2026-09-19; report date unavailable; filing index https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000026-index.htm. Source: SEC Submissions; requested window 2026-06-23 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; retrieved 2026-09-20T00:00:01.000Z; completed 2026-09-20T00:00:02.000Z. Only the current recent-filings object was checked; older continuation files were not loaded; complete window coverage is not established. The source lists older continuation files. Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
export const annualNoteDraft =
  "Annual research draft Observed Annual report: ZERO (XNAS); 10-K 2025-01-01 to 2025-12-31; Revenues revenue USD 1000; NetIncomeLoss USD 100; net margin 10%. Same-filing annual comparison: prior 2024-01-01 to 2024-12-31; Revenues revenue USD 800 to 1000, change USD 200 (25%); NetIncomeLoss USD -80 to 100, change USD 180 (Unavailable: prior value is negative). Reported net margin -10% to 10%, change 20 percentage points. Period length, accounting changes and restatements are unadjusted; not as-originally-filed history or organic growth. Additional same-filing annual period: 2023-01-01 to 2023-12-31; Revenues revenue USD 640; NetIncomeLoss USD 32; net margin 5%. Earlier same-filing annual comparison: prior 2023-01-01 to 2023-12-31; current 2024-01-01 to 2024-12-31; Revenues revenue change USD 160 (25%); NetIncomeLoss change USD -112 (-350%). Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";
export const priceNoteDraft =
  "Price research draft Observed raw-close comparison: ZERO (XNAS); 2026-09-17 USD 100.000000000000000001 to 2026-09-18 USD 107.500000000000000002; raw close change +$7.500000000000000001 (+7.5000%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. Raw closes are not adjusted for splits or dividends and are not live quotes. Evidence dates are unchanged; this action does not refresh sources.";
export const marketsPriceNoteDraft =
  "Markets research draft Observed raw-close comparison: BETA (XNAS); 2026-09-18 USD 20.75 to 2026-09-19 USD 20.5; raw close change -$0.25 (-1.2048%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. Raw closes are not adjusted for splits or dividends and are not live quotes. Retained previous history; newer prices were not confirmed. Evidence dates are unchanged; this action does not refresh sources.";
export const recoveryNoteDraft = "Retained recovery draft";
export const fedNoteDraft =
  "Draft survives native Back Observed Federal Reserve announcement: Invented announcement without a publication time. Announcement URL: https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm. Source publication time: unknown. Source: Board of Governors of the Federal Reserve System; monetary-policy feed " +
  PERSONAL_FED_MONETARY_SOURCE.feedUrl +
  ". Original feed retrieved at: 2026-10-23T18:00:00.000Z (UTC). Only feed metadata was loaded; article contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
export const recoverySavedNote = "New saved research note";
export const beaAgenda = parseManagedEconomicCalendar({
  schemaVersion: "1.0.0",
  source: PERSONAL_BEA_CALENDAR_SOURCE,
  fetchedAt: "2026-10-20T18:00:00.000Z",
  window: {
    fromInclusive: "2026-10-20T18:00:00.000Z",
    toExclusive: "2026-11-19T18:00:00.000Z",
  },
  events: [
    { series: "Invented GDP", scheduledAt: "2026-10-29T12:30:00.000Z" },
    { series: "Invented Income", scheduledAt: "2026-10-29T12:30:00.000Z" },
    { series: "Invented Trade", scheduledAt: "2026-11-04T13:30:00.000Z" },
  ],
});
if (!beaAgenda) throw new Error("Invalid invented BEA agenda");
export const fedAnnouncements = parseManagedMonetaryAnnouncements(
  fedAnnouncementsFixture(),
);
if (!fedAnnouncements) throw new Error("Invalid invented Fed announcements");
export const marketsDayAnnouncements = parseManagedMonetaryAnnouncements({
  ...fedAnnouncements,
  fetchedAt: "2026-10-30T18:00:00.000Z",
  items: [
    {
      title: "Invented evening monetary announcement",
      url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261030a.htm",
      publishedAt: "2026-10-30T00:30:00.000Z",
    },
    fedAnnouncements.items[1],
  ],
});
if (!marketsDayAnnouncements)
  throw new Error("Invalid invented Markets day announcements");
function fedPacket(
  fetchedAt: string,
  empty = false,
): PersonalMonetaryAnnouncementsDto {
  const packet = parseManagedMonetaryAnnouncements({
    ...fedAnnouncements,
    fetchedAt,
    ...(empty ? { items: [], availableItemCount: 0 } : {}),
  });
  if (!packet) throw new Error("Invalid invented announcements variant");
  return structuredClone(packet);
}
const zero: PersonalSecurityMasterSearchResultDto = {
  cik: "0000000001",
  country: "US",
  exchangeMic: "XNAS",
  instrumentType: "common_stock",
  issuerId: "issuer-zero",
  issuerName: "Zero Company",
  listingId: "listing-zero",
  matchKind: "current_symbol_exact",
  matchedValue: "ZERO",
  securityId: "security-zero",
  securityName: "Zero Class A",
  shareClassId: "class-zero",
  shareClassName: "Class A",
  symbol: "ZERO",
};
const { note, ...identity } = listingMembership(zero);
const marketsCohort = [
  {
    ...identity,
    issuerId: "issuer-alfa",
    issuerName: "Alfa Company",
    listingId: "listing-alfa",
    securityId: "security-alfa",
    securityName: "Alfa Common Stock",
    shareClassId: "class-alfa",
    shareClassName: "Common Stock",
    symbol: "ALFA",
  },
  {
    ...identity,
    issuerId: "issuer-beta",
    issuerName: "Beta Company",
    listingId: "listing-beta-a",
    securityId: "security-beta-a",
    securityName: "Beta Class A",
    shareClassId: "class-beta-a",
    shareClassName: "Class A",
    symbol: "BETA",
  },
  {
    ...identity,
    issuerId: "issuer-beta",
    issuerName: "Beta Company",
    listingId: "listing-beta-c",
    securityId: "security-beta-c",
    securityName: "Beta Class C",
    shareClassId: "class-beta-c",
    shareClassName: "Class C",
    symbol: "BETB",
  },
] as const;
const payload: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: digest,
  memberships: [
    { ...identity, note },
    {
      ...identity,
      issuerId: "issuer-one",
      issuerName: "One Company",
      listingId: "listing-one",
      securityId: "security-one",
      securityName: "One Class A",
      shareClassId: "class-one",
      symbol: "ONE",
      note: "Invented second note",
    },
  ],
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "android-invented-catalog",
  catalogVersion: "fixture-v1",
  acquiredAt: "2026-09-20T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented Android test data. No provider was contacted.",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 5,
    activeListings: 5,
    admittedSourceRecords: 5,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 4,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 5,
    staleSourceRecords: 0,
    shareClasses: 5,
    totalSecurities: 5,
    unsupportedSourceRecords: 0,
  },
};

/** Test-APK-only data port. There is no fetch, credential, storage, or native-auth fallback. */

/** Exact two-command allowlist for the existing native thesis journey. */
function isDeclaredThesisFollowup(
  command: Parameters<ManagedApi["saveFollowups"]>[0],
  saves: number,
  watchlist: MainWatchlistPayload,
) {
  const captured = parseManagedResearchFollowupsCommand(command);
  const entry = captured?.payload.entries[0];
  if (!captured || !entry) return false;
  if (saves > 1 || captured.expectedVersion !== saves) return false;
  if (saves === 1 && entry.completedOn === null) return false;
  return (
    encodeResearchFollowupsPayload(captured.payload) ===
    encodeResearchFollowupsPayload(
      thesisFollowupPayload(entry, saves, watchlist),
    )
  );
}

function thesisFollowupPayload(
  entry: ResearchFollowup,
  saves: number,
  watchlist: MainWatchlistPayload,
) {
  const { note, ...listing } = watchlist.memberships[0]!;
  void note;
  const completion =
    saves === 0
      ? { status: "open" as const, completedOn: null, result: "" }
      : {
          status: "completed" as const,
          completedOn: entry.completedOn!,
          result: "Checked the authored thesis",
        };
  return {
    schemaVersion: 1 as const,
    entries: [
      {
        ...entry,
        listing,
        catalogSnapshotSha256: digest,
        check: "Read the next filed report",
        dueOn: "2020-01-01",
        ...completion,
      },
    ],
  };
}

async function createSharedFixture(
  scenarioName:
    | "default"
    | "catalog-startup-recovery"
    | "company-direct-entry"
    | "annual-note"
    | "annual-cash-history"
    | "annual-operating-results"
    | "annual-operating-history"
    | "annual-liquidity-history"
    | "annual-balance-sheet"
    | "annual-operating-comparison"
    | "company-snapshot"
    | "research-followups"
    | "markets-day-view"
    | "company-price-ranges"
    | "thesis-review"
    | "price-comparison-note"
    | "company-filings"
    | "markets-price-handoff"
    | "watchlist-recovery"
    | "signout-save-review"
    | "signout-uncertain-review"
    | "raw-close-comparison"
    | "bea-agenda"
    | "bea-agenda-comparison"
    | "bea-session-retirement"
    | "fed-announcements"
    | "annual-comparison"
    | "markets-selected-price"
    | "watchlist-comparison"
    | "watchlist-export"
    | "watchlist-draft-file"
    | "authored-valuation" = "default",
) {
  // These journeys reuse the one-read Annual source behavior. The snapshot
  // admits one Filings read; cash history adds only same-filing cash rows.
  const scenario =
    scenarioName === "company-snapshot" ||
    scenarioName === "research-followups" ||
    scenarioName === "annual-cash-history"
      ? "annual-note"
      : scenarioName === "annual-operating-comparison"
        ? "annual-comparison"
        : scenarioName;
  const annualBase = await response(
    scenario === "annual-note"
      ? annualHistoryRows().map((observation) =>
          observation.metric === "net_income" &&
          observation.endDate === "2024-12-31"
            ? { ...observation, value: "-80" }
            : observation,
        )
      : undefined,
  );
  const annual =
    scenario === "annual-note"
      ? await parseAnnualComparisonFixture(
          annualBase,
          scenarioName === "annual-cash-history"
            ? annualCashHistoryRows()
            : [
                cashRow("operating_cash_flow", "120.125"),
                cashRow("ppe_purchases", "20.025"),
              ],
        )
      : annualBase;
  const historyScenario =
    scenarioName === "annual-operating-history" ||
    scenarioName === "annual-liquidity-history";
  const historyPacket =
    scenarioName === "annual-liquidity-history"
      ? liquidityHistoryPacket
      : operatingHistoryPacket;
  const annualHistory = historyScenario ? await historyPacket() : null;
  const annualHistoryReplacement = historyScenario
    ? await historyPacket(true)
    : null;
  const annualHistoryLate = historyScenario
    ? await historyPacket(false, true)
    : null;
  const balanceScenario = scenarioName === "annual-balance-sheet";
  const annualBalance = balanceScenario ? await balanceSheetPacket() : null;
  const annualBalanceLate = balanceScenario
    ? await balanceSheetPacket(true)
    : null;
  const operatingAnnual =
    scenarioName === "annual-operating-results"
      ? await inventedOperatingPacket()
      : null;
  const operatingLate =
    scenarioName === "annual-operating-results"
      ? await inventedOperatingPacket("2026-09-21T00:00:00.000Z", "999.875")
      : null;
  const recovered = await response(
    [row("Revenues", "2000"), row("NetIncomeLoss", "300")],
    "2026-09-21T00:00:00.000Z",
  );
  const refreshAnnual = await parseAnnualComparisonFixture(annual, undefined, [
    liquidityRow("current_assets", "120.125"),
    liquidityRow("current_liabilities", "80.025"),
  ]);
  const refreshRecovered = await parseAnnualComparisonFixture(
    recovered,
    undefined,
    [
      liquidityRow("current_assets", "120.125"),
      liquidityRow("current_liabilities", "0"),
    ],
  );
  const comparisonReports =
    scenario === "annual-comparison"
      ? scenarioName === "annual-operating-comparison"
        ? await Promise.all([
            operatingComparisonPacket("left"),
            operatingComparisonPacket("right"),
            operatingComparisonPacket("left", true),
            operatingComparisonPacket("right", true),
          ])
        : await Promise.all([
            annualComparisonResponse("left", {
              mode: "multiple-bases",
              balanceRows: annualComparisonBalanceRows("left"),
            }),
            annualComparisonResponse("right", {
              balanceRows: annualComparisonBalanceRows("right"),
            }),
            annualComparisonResponse("left", {
              cutoffAt: "2026-09-21T00:00:00.000Z",
              balanceRows: annualComparisonBalanceRows("left"),
            }),
            annualComparisonResponse("right", {
              cutoffAt: "2026-09-21T00:00:00.000Z",
              balanceRows: annualComparisonBalanceRows("right"),
            }),
          ])
      : null;
  const eodPacket = (kind: "initial" | "late" | "recovered") => {
    const request = {
      catalogSnapshotSha256: digest,
      listingId: "listing-zero",
      range: "1m" as const,
    };
    const packet = parseManagedEodHistoryResponse(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: digest,
        security: identity,
        range: "1m",
        provider: "Tiingo",
        currency: "USD",
        priceBasis: "raw_close",
        window:
          kind === "recovered"
            ? { startDate: "2026-08-21", endDate: "2026-09-21" }
            : { startDate: "2026-08-20", endDate: "2026-09-20" },
        requestStartedAt:
          kind === "recovered"
            ? "2026-09-21T00:00:00.000Z"
            : "2026-09-20T00:00:00.000Z",
        completedAt:
          kind === "recovered"
            ? "2026-09-21T00:00:02.000Z"
            : "2026-09-20T00:00:01.000Z",
        rows:
          scenario === "price-comparison-note" && kind === "initial"
            ? [
                { date: "2026-09-17", close: "100.000000000000000001" },
                { date: "2026-09-18", close: "107.500000000000000002" },
                { date: "2026-09-19", close: "110.000000000000000003" },
              ]
            : kind === "recovered"
              ? [
                  { date: "2026-09-19", close: "102.75" },
                  { date: "2026-09-20", close: "103.5" },
                ]
              : [
                  {
                    date: "2026-09-18",
                    close: kind === "late" ? "998.25" : "100.25",
                  },
                  {
                    date: "2026-09-19",
                    close: kind === "late" ? "999.75" : "101.5",
                  },
                ],
      },
      request,
    );
    if (!packet) throw new Error("Invalid invented EOD packet");
    return packet;
  };
  const eodInitial = eodPacket("initial");
  const eodLate = eodPacket("late");
  const eodRecovered = eodPacket("recovered");
  const priceRangeOrder = ["1y", "1m", "1m", "1y", "1m"] as const;
  const priceRangePacket = (index: number) => {
    const range = priceRangeOrder[index];
    if (!range) throw new Error("Unexpected invented price-range packet");
    const base = index === 2 ? eodRecovered : eodInitial;
    const packet = parseManagedEodHistoryResponse(
      {
        ...base,
        range,
        window:
          range === "1y"
            ? { startDate: "2025-09-20", endDate: "2026-09-20" }
            : base.window,
        rows:
          range === "1y"
            ? [
                { date: "2025-09-22", close: "80.125" },
                { date: "2026-03-20", close: "90.25" },
                { date: "2026-09-19", close: index === 0 ? "101.5" : "999.75" },
              ]
            : index === 2
              ? base.rows
              : eodLate.rows,
      },
      { catalogSnapshotSha256: digest, listingId: "listing-zero", range },
    );
    if (!packet) throw new Error("Invalid invented price-range packet");
    return packet;
  };
  const comparisonListings = payload.memberships.map((member) => {
    const { note, ...listing } = member;
    void note;
    return listing;
  });
  const comparisonPacket = (index: number) => {
    const security = comparisonListings[index];
    if (!security)
      throw new Error("Unknown invented watchlist comparison listing");
    const closes = index === 0 ? ["100", "110", "90"] : ["100", "95", "120"];
    const parsed = parseManagedEodHistoryResponse(
      {
        ...eodInitial,
        security,
        rows: closes.map((close, offset) => ({
          date: `2026-09-${17 + offset}`,
          close,
        })),
      },
      {
        catalogSnapshotSha256: digest,
        listingId: security.listingId,
        range: "1m",
      },
    );
    if (!parsed)
      throw new Error("Invalid invented watchlist comparison packet");
    return parsed;
  };
  const marketsPacket = (
    index: number,
    kind: "initial" | "refreshed" | "late",
  ) => {
    const listing = marketsCohort[index];
    if (!listing) throw new Error("Unknown invented Markets listing");
    const request = {
      catalogSnapshotSha256: digest,
      listingId: listing.listingId,
      range: "1m" as const,
    };
    const refreshed = kind === "refreshed";
    const start =
      kind === "late"
        ? "998.25"
        : refreshed
          ? `${(index + 1) * 10 + 1}.25`
          : ["10.25", "20.75", "30.5"][index]!;
    const close =
      kind === "late"
        ? "999.75"
        : `${(index + 1) * 10 + (refreshed ? 1 : 0)}.5`;
    const parsed = parseManagedEodHistoryResponse(
      {
        ...eodInitial,
        security: listing,
        window: refreshed ? eodRecovered.window : eodInitial.window,
        requestStartedAt: refreshed
          ? eodRecovered.requestStartedAt
          : eodInitial.requestStartedAt,
        completedAt: refreshed
          ? eodRecovered.completedAt
          : eodInitial.completedAt,
        rows:
          scenario === "raw-close-comparison" && index === 0 && kind !== "late"
            ? refreshed
              ? [
                  { date: "2026-09-18", close: "120.000000000000000004" },
                  { date: "2026-09-19", close: "126.000000000000000005" },
                  { date: "2026-09-20", close: "132.000000000000000006" },
                ]
              : [
                  { date: "2026-09-17", close: "100.000000000000000001" },
                  { date: "2026-09-18", close: "107.500000000000000002" },
                  { date: "2026-09-19", close: "110.000000000000000003" },
                ]
            : refreshed
              ? [
                  { date: "2026-09-19", close: start },
                  { date: "2026-09-20", close },
                ]
              : [
                  { date: "2026-09-18", close: start },
                  { date: "2026-09-19", close },
                ],
      },
      request,
    );
    if (!parsed) throw new Error("Invalid invented Markets packet");
    return parsed;
  };
  const marketsInitial = marketsCohort.map((_listing, index) =>
    marketsPacket(index, "initial"),
  );
  const marketsRefreshed = marketsPacket(0, "refreshed");
  const selectedPriceScenario =
    scenario === "markets-selected-price" ||
    scenario === "raw-close-comparison";
  const marketsLate = marketsPacket(selectedPriceScenario ? 0 : 1, "late");
  const signOutScenario =
    scenario === "signout-save-review" ||
    scenario === "signout-uncertain-review";
  const followups =
    scenarioName === "research-followups" || scenarioName === "markets-day-view"
      ? createResearchFollowupsFixture()
      : null;
  const thesisFollowups =
    scenario === "thesis-review" ? createResearchFollowupsFixture() : null;
  const followupStorage = followups ?? thesisFollowups;
  let state = {
    load: 0,
    status: 0,
    search: 0,
    save: 0,
    resolve: 0,
    annual: 0,
    interimReport: 0,
    interimPortfolioLoad: 0,
    interimPortfolioSave: 0,
    interimFollowupsLoad: 0,
    interimFollowupsSave: 0,
    filings: 0,
    filingsAborted: 0,
    filingsLateResolved: 0,
    aborted: 0,
    lateResolved: 0,
    token: 0,
    signOut: 0,
    refreshScenario: false,
    refreshFailed: 0,
    catalogRecovery: scenario === "catalog-startup-recovery",
    catalogReleased: 0,
    eod: 0,
    eodAborted: 0,
    eodLateResolved: 0,
    marketsResolve: 0,
    marketsEod: 0,
    marketsAborted: 0,
    marketsLateResolved: 0,
    recoveryCommits: 0,
    recoveryReplays: 0,
    recoveryReadFailed: 0,
    reviewSaveAborted: 0,
    reviewSaveSettled: 0,
    reviewSaveCommits: 0,
    calendar: 0,
    calendarAborted: 0,
    calendarLateResolved: 0,
    fed: 0,
    fedAborted: 0,
    fedLateResolved: 0,
  };
  const listeners = new Set<() => void>();
  const count = (
    key: Exclude<keyof typeof state, "refreshScenario" | "catalogRecovery">,
  ) => {
    state = { ...state, [key]: state[key] + 1 };
    for (const listener of listeners) listener();
  };
  let pending: ((value: PersonalSecAnnualCanonicalResponseDto) => void) | null =
    null;
  let pendingAnnualComparison:
    ((value: PersonalSecAnnualCanonicalResponseDto) => void) | null = null;
  let rejectRefresh: ((error: unknown) => void) | null = null;
  let pendingFilings: ((value: ManagedSecFilingsResponseDto) => void) | null =
    null;
  let releaseCatalog: (() => void) | null = null;
  let pendingEod: ((value: ManagedEodHistoryResponseDto) => void) | null = null;
  let pendingCalendar: ((value: PersonalEconomicCalendarDto) => void) | null =
    null;
  let pendingFed: ((value: PersonalMonetaryAnnouncementsDto) => void) | null =
    null;
  let pendingMarkets: ((value: ManagedEodHistoryResponseDto) => void) | null =
    null;
  const unexpected = (
    key: "save" | "resolve" | "token" | "signOut",
  ): Promise<never> => {
    count(key);
    return Promise.reject(new Error(`Unexpected fixture operation: ${key}`));
  };
  let savedWatchlist = { version: 1, payload: structuredClone(payload) };
  if (scenario === "watchlist-export" || scenario === "watchlist-draft-file")
    savedWatchlist = {
      ...savedWatchlist,
      payload: {
        ...savedWatchlist.payload,
        memberships: savedWatchlist.payload.memberships.map((member, index) =>
          index === 0
            ? { ...member, note: "Invented saved note: café 東京 📈" }
            : member,
        ),
      },
    };
  const signOutPayload: MainWatchlistPayload = {
    ...payload,
    memberships: [
      payload.memberships[1]!,
      { ...payload.memberships[0]!, note: signOutNoteDraft },
    ],
  };
  let signOutCommand: ReturnType<typeof parseManagedWatchlistCommand> = null;
  let pendingSignOutSave: (() => void) | null = null;
  let recoveryCommand: ReturnType<typeof parseManagedWatchlistCommand> = null;
  let rejectRecoveryRead: ((error: unknown) => void) | null = null;
  const recoveryPayload: MainWatchlistPayload = {
    ...payload,
    memberships: payload.memberships.map((member, index) =>
      index === 0 ? { ...member, note: recoveryNoteDraft } : member,
    ),
  };
  const laterSavedPayload: MainWatchlistPayload = {
    ...payload,
    memberships: [
      payload.memberships[1]!,
      { ...payload.memberships[0]!, note: recoverySavedNote },
    ],
  };
  const completedFilingsNote = () =>
    state.filings === 6 &&
    state.filingsAborted === 2 &&
    state.filingsLateResolved === 2 &&
    state.save === 1 &&
    state.load === 2;
  const api: ManagedApi = {
    cpiHeadlines: () => {
      throw new Error("Unexpected invented CPI headline read");
    },
    blsCalendar: () =>
      Promise.reject(new Error("BLS requires an explicit fixture action")),
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    savePortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    loadFollowups: (signal) =>
      followupStorage?.api.loadFollowups(signal) ??
      Promise.reject(
        new Error("Follow-ups require an explicit fixture action"),
      ),
    saveFollowups: (command, signal) => {
      if (
        thesisFollowups &&
        !isDeclaredThesisFollowup(
          command,
          thesisFollowups.getSnapshot().save,
          payload,
        )
      )
        return Promise.reject(
          new Error("Only the declared thesis follow-up commands are admitted"),
        );
      return (
        followupStorage?.api.saveFollowups(command, signal) ??
        Promise.reject(
          new Error("Follow-ups require an explicit fixture action"),
        )
      );
    },
    recentFilings: (input, signal) => {
      if (balanceScenario) {
        count("filings");
        throw new Error("Unexpected balance-sheet Filings read");
      }
      if (scenarioName === "annual-operating-results" || historyScenario) {
        count("filings");
        throw new Error("Unexpected operating-results Filings read");
      }
      if (scenario === "company-price-ranges") {
        count("filings");
        throw new Error("Unexpected invented price-range Filings read");
      }
      const request = parseManagedSecFilingsRequest(input);
      if (scenarioName === "company-snapshot" || followups) {
        if (
          signal.aborted ||
          state.filings !== 0 ||
          (followups
            ? state.resolve !== 1
            : state.annual !== 1 || state.eod !== 1) ||
          request?.catalogSnapshotSha256 !== digest ||
          request.listingId !== "listing-zero" ||
          request.symbol !== "ZERO"
        )
          throw new Error("Unexpected invented snapshot filings request");
        count("filings");
        return Promise.resolve(inventedFilingsPacket(identity));
      }
      if (
        scenario !== "company-filings" ||
        signal.aborted ||
        pendingFilings ||
        request?.catalogSnapshotSha256 !== digest ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO" ||
        (state.filings >= 6 && !(completedFilingsNote() && state.annual === 1))
      )
        throw new Error("Unexpected invented company filings request");
      count("filings");
      if (state.filings === 1 || state.filings === 6 || state.filings === 7)
        return Promise.resolve(inventedFilingsPacket(identity));
      if (state.filings === 3)
        return Promise.reject(new TrialApiError("unavailable"));
      if (state.filings === 4)
        return Promise.resolve(inventedFilingsPacket(identity, true));
      signal.addEventListener("abort", () => count("filingsAborted"), {
        once: true,
      });
      // Ignore abort deliberately: the real model must discard this completion.
      return new Promise((resolve) => {
        pendingFilings = resolve;
      });
    },
    load: (signal) => {
      count("load");
      if (balanceScenario && (signal.aborted || state.load !== 1))
        throw new Error("Unexpected balance-sheet watchlist read");
      if (scenario === "watchlist-recovery") {
        if (signal.aborted)
          return Promise.reject(new Error("Cancelled recovery fixture read"));
        if (state.load === 1 && state.save === 0)
          return Promise.resolve(structuredClone(savedWatchlist));
        if (state.save !== 2 || state.recoveryReplays !== 1)
          return Promise.reject(
            new Error("Reconcile before reading the recovery fixture"),
          );
        if (state.load === 3)
          return new Promise((_, reject) => {
            rejectRecoveryRead = reject;
          });
        if (
          state.load === 2 ||
          (state.load === 4 && state.recoveryReadFailed === 1)
        )
          return Promise.resolve({
            version: 3,
            payload: structuredClone(laterSavedPayload),
          });
        return Promise.reject(
          new Error("Unexpected extra recovery fixture read"),
        );
      }
      return Promise.resolve(structuredClone(savedWatchlist));
    },
    status: () => {
      count("status");
      if (balanceScenario && state.status !== 1) {
        if (
          state.status !== 2 ||
          state.annual !== 3 ||
          !pending ||
          state.refreshFailed !== 1
        )
          throw new Error("Hold the third balance-sheet read before expiry");
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenario === "company-price-ranges" && state.status !== 1) {
        if (
          state.status !== 2 ||
          state.eod !== 5 ||
          !pendingEod ||
          state.eodAborted !== 2 ||
          state.eodLateResolved !== 2
        )
          return Promise.reject(
            new Error("Hold the fifth price-range read before expiry"),
          );
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (historyScenario && state.status === 2) {
        if (
          state.annual !== 5 ||
          !pending ||
          state.aborted !== 1 ||
          state.lateResolved !== 1
        )
          throw new Error("Hold the fifth annual-history read before expiry");
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenarioName === "annual-operating-results" && state.status === 2) {
        if (state.annual !== 4 || !pending)
          throw new Error(
            "Hold the fourth operating-results read before expiry",
          );
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenarioName === "annual-cash-history" && state.status === 2) {
        if (state.annual !== 1)
          return Promise.reject(
            new Error("Load the one cash-history report before expiry"),
          );
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenario === "annual-comparison" && state.status === 2) {
        if (state.annual !== 5 || !pendingAnnualComparison)
          return Promise.reject(
            new Error("Hold the fifth comparison read before expiry"),
          );
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenario === "fed-announcements" && state.status === 2) {
        if (state.fed !== 7 || !pendingFed)
          return Promise.reject(
            new Error("Hold the seventh announcements read before expiry"),
          );
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenario === "markets-day-view" && state.status === 2) {
        if (
          state.calendar !== 4 ||
          state.fed !== 4 ||
          !pendingCalendar ||
          !pendingFed ||
          state.calendarAborted !== 1 ||
          state.calendarLateResolved !== 1 ||
          state.fedAborted !== 1 ||
          state.fedLateResolved !== 1
        )
          throw new Error("Hold both fourth day-view reads before expiry");
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (scenario === "bea-session-retirement" && state.status === 2) {
        if (state.calendar !== 2 || !pendingCalendar)
          return Promise.reject(
            new Error("Hold the second calendar read before expiry"),
          );
        return Promise.reject(new TrialApiError("unauthenticated"));
      }
      if (state.catalogRecovery) {
        if (state.status === 1)
          return Promise.reject(new TrialApiError("unavailable"));
        if (state.status === 2)
          return new Promise<{ snapshot: ManagedCatalogSnapshotDto }>(
            (resolve) => {
              releaseCatalog = () =>
                resolve({ snapshot: structuredClone(snapshot) });
            },
          );
        return Promise.reject(
          new Error("Unexpected extra fixture status read"),
        );
      }
      return Promise.resolve({ snapshot: structuredClone(snapshot) });
    },
    monetaryAnnouncements: (signal) => {
      const dayView = scenario === "markets-day-view";
      if (
        signal.aborted ||
        (scenario !== "fed-announcements" && !dayView) ||
        pendingFed ||
        state.fed >= (dayView ? 4 : 7)
      )
        throw new Error("Unexpected invented announcements read");
      count("fed");
      if (state.fed === 1)
        return Promise.resolve(
          structuredClone(
            dayView ? marketsDayAnnouncements! : fedAnnouncements!,
          ),
        );
      if (state.fed === 6)
        return Promise.resolve(fedPacket("2026-10-23T18:00:00.000Z"));
      if (state.fed === 2)
        return Promise.reject(new TrialApiError("unavailable"));
      if (!dayView && state.fed === 4)
        return Promise.resolve(fedPacket("2026-10-21T18:00:00.000Z", true));
      return new Promise<PersonalMonetaryAnnouncementsDto>((resolve) => {
        pendingFed = resolve;
        // Completion deliberately arrives after cancellation to test the model fence.
        signal.addEventListener("abort", () => count("fedAborted"), {
          once: true,
        });
      });
    },
    economicCalendar: (signal) => {
      const comparison = scenario === "bea-agenda-comparison";
      const dayView = scenario === "markets-day-view";
      if (
        signal.aborted ||
        (scenario !== "bea-agenda" &&
          scenario !== "bea-session-retirement" &&
          !comparison &&
          !dayView) ||
        pendingCalendar ||
        state.calendar >=
          (comparison || dayView || scenario === "bea-agenda" ? 4 : 2)
      )
        throw new Error("Unexpected invented calendar read");
      count("calendar");
      if (comparison && (state.calendar === 1 || state.calendar === 4)) {
        const fetchedAt =
          state.calendar === 1
            ? "2026-10-20T17:59:00.000Z"
            : "2026-10-20T18:01:00.000Z";
        const empty = parseManagedEconomicCalendar({
          ...beaAgenda!,
          fetchedAt,
          window: {
            fromInclusive: fetchedAt,
            toExclusive:
              state.calendar === 1
                ? "2026-11-19T17:59:00.000Z"
                : "2026-11-19T18:01:00.000Z",
          },
          events: [],
        });
        if (!empty) throw new Error("Invalid invented comparison agenda");
        return Promise.resolve(empty);
      }
      if (comparison && state.calendar === 2)
        return Promise.resolve(structuredClone(beaAgenda!));
      if (state.calendar === 1)
        return Promise.resolve(structuredClone(beaAgenda!));
      if ((scenario === "bea-agenda" || dayView) && state.calendar === 2)
        return Promise.reject(new TrialApiError("unavailable"));
      return new Promise<PersonalEconomicCalendarDto>((resolve) => {
        pendingCalendar = resolve;
        // Deliberately ignores cancellation until the test releases the response.
        signal.addEventListener("abort", () => count("calendarAborted"), {
          once: true,
        });
      });
    },
    search: (query) => {
      count("search");
      if (balanceScenario) throw new Error("Unexpected balance-sheet search");
      if (query !== "ZERO")
        return Promise.reject(new Error("Unexpected fixture query"));
      return Promise.resolve({
        snapshot: structuredClone(snapshot),
        results: [structuredClone(zero)],
        limitApplied: 25,
        totalMatches: 1,
        normalizedQuery: "ZERO",
      });
    },
    save: (command, signal) => {
      if (balanceScenario) return unexpected("save");
      if (followups) return unexpected("save");
      if (scenarioName === "annual-operating-results" || historyScenario)
        return unexpected("save");
      if (scenario === "company-price-ranges") return unexpected("save");
      if (scenario === "watchlist-comparison") return unexpected("save");
      const captured = parseManagedWatchlistCommand(command);
      if (scenario === "authored-valuation") {
        const expected = {
          ...payload,
          memberships: payload.memberships.map((member, index) =>
            index === 0
              ? { ...member, note: authoredValuationNoteDraft }
              : member,
          ),
        };
        if (
          signal.aborted ||
          state.save !== 0 ||
          state.load !== 1 ||
          state.status !== 1 ||
          state.annual !== 0 ||
          state.eod !== 0 ||
          state.filings !== 0 ||
          state.marketsEod !== 0 ||
          state.calendar !== 0 ||
          state.fed !== 0 ||
          state.resolve !== 0 ||
          savedWatchlist.version !== 1 ||
          captured?.expectedVersion !== 1 ||
          encodeMainWatchlistPayload(captured.payload) !==
            encodeMainWatchlistPayload(expected)
        )
          return unexpected("save");
        count("save");
        savedWatchlist = {
          version: 2,
          payload: structuredClone(captured.payload),
        };
        return Promise.resolve({
          ...structuredClone(savedWatchlist),
          replayed: false,
        });
      }
      if (scenario === "thesis-review") {
        const expected = {
          ...payload,
          memberships: payload.memberships.map((member, index) =>
            index === 0 ? { ...member, note: thesisReviewNoteDraft } : member,
          ),
        };
        if (
          signal.aborted ||
          state.save !== 0 ||
          state.load !== 1 ||
          state.status !== 1 ||
          state.annual !== 0 ||
          state.eod !== 0 ||
          state.marketsEod !== 0 ||
          state.resolve !== 0 ||
          state.filings !== 0 ||
          state.calendar !== 0 ||
          state.fed !== 0 ||
          savedWatchlist.version !== 1 ||
          captured?.expectedVersion !== 1 ||
          encodeMainWatchlistPayload(captured.payload) !==
            encodeMainWatchlistPayload(expected)
        )
          return unexpected("save");
        count("save");
        savedWatchlist = {
          version: 2,
          payload: structuredClone(captured.payload),
        };
        return Promise.resolve({
          ...structuredClone(savedWatchlist),
          replayed: false,
        });
      }
      if (scenario === "annual-comparison") {
        const expected: MainWatchlistPayload = {
          ...payload,
          memberships: [
            payload.memberships[1]!,
            {
              ...payload.memberships[0]!,
              note:
                scenarioName === "annual-operating-comparison"
                  ? operatingComparisonNoteDraft
                  : annualComparisonNoteDraft,
            },
          ],
        };
        if (
          signal.aborted ||
          state.save !== 0 ||
          state.load !== 1 ||
          state.status !== 1 ||
          state.annual !== 4 ||
          state.aborted !== 1 ||
          state.lateResolved !== 1 ||
          pendingAnnualComparison ||
          savedWatchlist.version !== 1 ||
          captured?.expectedVersion !== 1 ||
          encodeMainWatchlistPayload(captured.payload) !==
            encodeMainWatchlistPayload(expected)
        )
          return unexpected("save");
        count("save");
        savedWatchlist = {
          version: 2,
          payload: structuredClone(captured.payload),
        };
        return Promise.resolve({
          ...structuredClone(savedWatchlist),
          replayed: false,
        });
      }
      if (signOutScenario) {
        if (
          signal.aborted ||
          state.load !== 1 ||
          state.status !== 1 ||
          state.signOut !== 0 ||
          captured?.expectedVersion !== 1 ||
          encodeMainWatchlistPayload(captured.payload) !==
            encodeMainWatchlistPayload(signOutPayload) ||
          pendingSignOutSave ||
          state.reviewSaveSettled !== 0 ||
          state.reviewSaveAborted !== 0
        )
          return unexpected("save");
        if (state.save === 0) {
          signOutCommand = structuredClone(captured);
          count("save");
          if (scenario === "signout-uncertain-review") {
            savedWatchlist = {
              version: 2,
              payload: structuredClone(captured.payload),
            };
            count("reviewSaveCommits");
            return Promise.reject(new TrialApiError("commit_unknown"));
          }
        } else if (
          scenario === "signout-uncertain-review" &&
          state.save === 1 &&
          state.reviewSaveCommits === 1 &&
          signOutCommand &&
          captured.idempotencyKey === signOutCommand.idempotencyKey &&
          encodeMainWatchlistPayload(captured.payload) ===
            encodeMainWatchlistPayload(signOutCommand.payload)
        )
          count("save");
        else return unexpected("save");
        signal.addEventListener("abort", () => count("reviewSaveAborted"), {
          once: true,
        });
        // Deliberately permit a late receipt: the real coordinator must fence it after sign-out.
        return new Promise((resolve) => {
          pendingSignOutSave = () => {
            if (scenario === "signout-save-review") {
              savedWatchlist = {
                version: 2,
                payload: structuredClone(captured.payload),
              };
              count("reviewSaveCommits");
            }
            resolve({
              ...structuredClone(savedWatchlist),
              replayed: scenario === "signout-uncertain-review",
            });
          };
        });
      }
      if (scenario === "watchlist-recovery") {
        if (
          signal.aborted ||
          state.load !== 1 ||
          state.status !== 1 ||
          captured?.expectedVersion !== 1 ||
          encodeMainWatchlistPayload(captured.payload) !==
            encodeMainWatchlistPayload(recoveryPayload)
        )
          return unexpected("save");
        if (state.save === 0 && state.recoveryCommits === 0) {
          recoveryCommand = structuredClone(captured);
          savedWatchlist = {
            version: 2,
            payload: structuredClone(captured.payload),
          };
          count("save");
          count("recoveryCommits");
          return Promise.reject(new TrialApiError("commit_unknown"));
        }
        if (
          state.save !== 1 ||
          state.recoveryCommits !== 1 ||
          !recoveryCommand ||
          captured.idempotencyKey !== recoveryCommand.idempotencyKey ||
          encodeMainWatchlistPayload(captured.payload) !==
            encodeMainWatchlistPayload(recoveryCommand.payload)
        )
          return unexpected("save");
        count("save");
        count("recoveryReplays");
        return Promise.resolve({
          ...structuredClone(savedWatchlist),
          replayed: true,
        });
      }
      const expected = {
        ...payload,
        memberships:
          scenario === "company-filings" || scenario === "fed-announcements"
            ? [
                payload.memberships[1]!,
                {
                  ...payload.memberships[0]!,
                  note:
                    scenario === "company-filings"
                      ? filingsNoteDraft
                      : fedNoteDraft,
                },
              ]
            : scenario === "markets-price-handoff"
              ? [
                  payload.memberships[1]!,
                  {
                    ...payload.memberships[0]!,
                    note: "Draft survives native Back",
                  },
                  { ...marketsCohort[1], note: marketsPriceNoteDraft },
                ]
              : scenario === "annual-note" ||
                  scenario === "price-comparison-note"
                ? payload.memberships.map((member, index) =>
                    index === 0
                      ? {
                          ...member,
                          note:
                            scenario === "annual-note"
                              ? annualNoteDraft
                              : priceNoteDraft,
                        }
                      : member,
                  )
                : [
                    ...payload.memberships,
                    {
                      ...marketsCohort[0],
                      note: "Company draft captured in research",
                    },
                  ],
      };
      // One invented full-list save only. Other cases still require zero writes.
      if (
        signal.aborted ||
        (scenario === "annual-note" && state.annual !== 1) ||
        (scenario === "price-comparison-note" && state.eod !== 1) ||
        (scenario === "fed-announcements" &&
          (state.fed !== 6 ||
            state.fedAborted !== 2 ||
            state.fedLateResolved !== 2 ||
            state.load !== 1 ||
            state.status !== 1 ||
            state.annual !== 0 ||
            state.filings !== 0 ||
            state.eod !== 0 ||
            state.marketsEod !== 0 ||
            state.calendar !== 0)) ||
        (scenario === "company-filings" &&
          (state.filings !== 6 ||
            state.filingsAborted !== 2 ||
            state.filingsLateResolved !== 2 ||
            state.annual !== 0 ||
            state.eod !== 0 ||
            state.calendar !== 0)) ||
        (scenario === "markets-price-handoff" &&
          (state.marketsResolve !== 3 ||
            state.marketsEod !== 5 ||
            state.marketsAborted !== 1 ||
            state.marketsLateResolved !== 1 ||
            state.eod !== 1 ||
            state.annual !== 0)) ||
        savedWatchlist.version !== 1 ||
        captured?.expectedVersion !== 1 ||
        encodeMainWatchlistPayload(captured.payload) !==
          encodeMainWatchlistPayload(expected)
      )
        return unexpected("save");
      count("save");
      savedWatchlist = {
        version: 2,
        payload: structuredClone(captured.payload),
      };
      return Promise.resolve({
        ...structuredClone(savedWatchlist),
        replayed: false,
      });
    },
    resolve: (request, signal) => {
      if (balanceScenario && state.marketsResolve !== 0)
        return unexpected("resolve");
      if (scenario === "watchlist-comparison" && state.marketsResolve !== 0)
        return unexpected("resolve");
      if (
        (scenario === "company-direct-entry" || followups) &&
        request.listingIds.length === 1 &&
        request.listingIds[0] === identity.listingId
      ) {
        if (
          signal.aborted ||
          request.snapshotSha256 !== digest ||
          state.resolve !== 0
        )
          return unexpected("resolve");
        const resolved = parseManagedCatalogResolveResponse(
          {
            snapshotSha256: digest,
            results: [{ listingId: identity.listingId, listing: identity }],
          },
          request,
        );
        if (!resolved)
          throw new Error("Invalid invented company-link identity");
        count("resolve");
        return Promise.resolve(resolved);
      }
      if (
        signal.aborted ||
        request.snapshotSha256 !== digest ||
        request.listingIds.join("|") !==
          marketsCohort.map((listing) => listing.listingId).join("|")
      )
        return unexpected("resolve");
      const resolved = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: digest,
          results: marketsCohort.map((listing) => ({
            listingId: listing.listingId,
            listing,
          })),
        },
        request,
      );
      if (!resolved)
        throw new Error("Invalid invented Markets resolve response");
      count("marketsResolve");
      return Promise.resolve(resolved);
    },
    eodHistory: (request, signal) => {
      if (balanceScenario) {
        count("eod");
        throw new Error("Unexpected balance-sheet Price read");
      }
      if (followups) {
        if (
          signal.aborted ||
          state.resolve !== 1 ||
          state.eod !== 0 ||
          request.catalogSnapshotSha256 !== digest ||
          request.listingId !== "listing-zero" ||
          request.range !== "1m"
        )
          throw new Error("Unexpected invented follow-up Price request");
        count("eod");
        return Promise.resolve(structuredClone(eodInitial));
      }
      if (scenarioName === "annual-operating-results" || historyScenario) {
        count("eod");
        throw new Error("Unexpected operating-results eod operation");
      }
      if (scenario === "company-price-ranges") {
        const index = state.eod;
        const expectedSettled = index < 2 ? 0 : index < 4 ? 1 : 2;
        if (
          signal.aborted ||
          pendingEod ||
          index >= priceRangeOrder.length ||
          request.catalogSnapshotSha256 !== digest ||
          request.listingId !== "listing-zero" ||
          request.range !== priceRangeOrder[index] ||
          state.eodAborted !== expectedSettled ||
          state.eodLateResolved !== expectedSettled ||
          state.status !== 1
        )
          throw new Error("Unexpected invented price-range request or order");
        const packet = priceRangePacket(index);
        count("eod");
        if (index === 0 || index === 2) return Promise.resolve(packet);
        signal.addEventListener("abort", () => count("eodAborted"), {
          once: true,
        });
        // Ignore abort deliberately: Cancel, Back and retirement must fence this packet.
        return new Promise((resolve) => {
          pendingEod = resolve;
        });
      }
      if (scenario === "watchlist-comparison") {
        const expected = comparisonListings[state.eod];
        if (
          signal.aborted ||
          !expected ||
          request.catalogSnapshotSha256 !== digest ||
          request.range !== "1m" ||
          request.listingId !== expected.listingId
        )
          throw new Error("Unexpected invented watchlist comparison request");
        const packet = comparisonPacket(state.eod);
        count("eod");
        return Promise.resolve(packet);
      }
      if (
        scenario === "price-comparison-note" &&
        (request.listingId !== "listing-zero" || state.eod !== 0)
      )
        throw new Error("Unexpected extra fixture price note read");
      const marketIndex = marketsCohort.findIndex(
        (listing) => listing.listingId === request.listingId,
      );
      if (scenario === "markets-price-handoff" && marketIndex === -1)
        throw new Error("Unexpected invented handoff listing");
      if (marketIndex !== -1) {
        if (scenario === "markets-price-handoff" && state.marketsEod === 5) {
          if (
            signal.aborted ||
            pendingMarkets ||
            request.catalogSnapshotSha256 !== digest ||
            request.range !== "1m" ||
            marketIndex !== 1 ||
            state.marketsAborted !== 1 ||
            state.marketsLateResolved !== 1 ||
            state.marketsResolve !== 2 ||
            state.eod !== 0
          )
            throw new Error("Unexpected invented company handoff refresh");
          count("eod");
          return Promise.resolve(
            structuredClone(marketsPacket(1, "refreshed")),
          );
        }
        if (selectedPriceScenario) {
          if (
            signal.aborted ||
            pendingMarkets ||
            state.marketsResolve < 1 ||
            request.catalogSnapshotSha256 !== digest ||
            request.range !== "1m" ||
            marketIndex !== 0 ||
            state.marketsEod >= 3 ||
            (state.marketsEod === 2 &&
              (state.marketsAborted !== 1 || state.marketsLateResolved !== 1))
          )
            throw new Error("Unexpected invented selected-price request");
          count("marketsEod");
          if (state.marketsEod === 1)
            return Promise.resolve(structuredClone(marketsInitial[0]!));
          if (state.marketsEod === 3)
            return Promise.resolve(structuredClone(marketsRefreshed));
          signal.addEventListener("abort", () => count("marketsAborted"), {
            once: true,
          });
          // The cancelled ALFA reply must not replace its prior dated history.
          return new Promise((resolve) => {
            pendingMarkets = resolve;
          });
        }
        const expectedIndex =
          state.marketsEod < 3 ? state.marketsEod : state.marketsEod - 3;
        if (
          signal.aborted ||
          pendingMarkets ||
          state.marketsResolve < 1 ||
          request.catalogSnapshotSha256 !== digest ||
          request.range !== "1m" ||
          state.marketsEod >= 5 ||
          marketIndex !== expectedIndex
        )
          throw new Error("Unexpected invented Markets EOD request or order");
        count("marketsEod");
        if (state.marketsEod <= 3)
          return Promise.resolve(structuredClone(marketsInitial[marketIndex]!));
        if (state.marketsEod === 4)
          return Promise.resolve(structuredClone(marketsRefreshed));
        signal.addEventListener("abort", () => count("marketsAborted"), {
          once: true,
        });
        // The late reply ignores abort; the board must fence it and never start the third row.
        return new Promise((resolve) => {
          pendingMarkets = resolve;
        });
      }
      if (
        signal.aborted ||
        pendingEod ||
        request.catalogSnapshotSha256 !== digest ||
        request.listingId !== "listing-zero" ||
        request.range !== "1m"
      )
        throw new Error("Unexpected fixture EOD request");
      count("eod");
      if (state.eod === 1) return Promise.resolve(structuredClone(eodInitial));
      if (state.eod === 3)
        return Promise.reject(new ManagedEodHistoryError("unavailable"));
      if (state.eod === 4)
        return Promise.resolve(structuredClone(eodRecovered));
      if (state.eod !== 2) throw new Error("Unexpected extra fixture EOD read");
      signal.addEventListener("abort", () => count("eodAborted"), {
        once: true,
      });
      // Deliberately ignores abort so the real EOD model must fence the late reply.
      return new Promise((resolve) => {
        pendingEod = resolve;
      });
    },
    interimReport: () => {
      count("interimReport");
      return Promise.reject(new TrialApiError("unavailable"));
    },
    annualReport: (request, signal) => {
      if (balanceScenario) {
        if (
          !annualBalance ||
          signal.aborted ||
          pending ||
          request.schemaVersion !== "6.0.0" ||
          request.catalogSnapshotSha256 !== digest ||
          request.listingId !== "listing-zero" ||
          request.symbol !== "ZERO" ||
          state.status !== 1 ||
          state.annual >= 3 ||
          (state.annual === 2 && state.refreshFailed !== 1)
        )
          throw new Error("Unexpected balance-sheet Annual request or order");
        count("annual");
        if (state.annual === 1)
          return Promise.resolve(structuredClone(annualBalance));
        if (state.annual === 2) {
          count("refreshFailed");
          return Promise.reject(new TrialApiError("unavailable"));
        }
        signal.addEventListener("abort", () => count("aborted"), {
          once: true,
        });
        // Deliberately ignores abort; the real model must discard the late totals.
        return new Promise((resolve) => {
          pending = resolve;
        });
      }
      if (followups && state.resolve !== 1)
        throw new Error(
          "Resolve the invented follow-up identity before Annual",
        );
      if (historyScenario) {
        if (
          !annualHistory ||
          !annualHistoryReplacement ||
          signal.aborted ||
          pending ||
          request.schemaVersion !== "6.0.0" ||
          request.catalogSnapshotSha256 !== digest ||
          request.listingId !== "listing-zero" ||
          request.symbol !== "ZERO" ||
          state.annual >= 5 ||
          (state.annual === 2 && state.refreshFailed !== 1) ||
          (state.annual >= 3 &&
            (state.aborted !== 1 || state.lateResolved !== 1))
        )
          throw new Error("Unexpected annual-history Annual request or order");
        count("annual");
        if (state.annual === 1)
          return Promise.resolve(structuredClone(annualHistory));
        if (state.annual === 2) {
          count("refreshFailed");
          return Promise.reject(new TrialApiError("unavailable"));
        }
        if (state.annual === 4)
          return Promise.resolve(structuredClone(annualHistoryReplacement));
        signal.addEventListener("abort", () => count("aborted"), {
          once: true,
        });
        return new Promise((resolve) => {
          pending = resolve;
        });
      }
      if (scenarioName === "annual-operating-results") {
        if (
          !operatingAnnual ||
          signal.aborted ||
          pending ||
          request.schemaVersion !== "6.0.0" ||
          request.catalogSnapshotSha256 !== digest ||
          request.listingId !== "listing-zero" ||
          request.symbol !== "ZERO" ||
          state.annual >= 4 ||
          (state.annual === 2 && state.refreshFailed !== 1) ||
          (state.annual === 3 &&
            (state.aborted !== 1 || state.lateResolved !== 1))
        )
          throw new Error(
            "Unexpected operating-results Annual request or order",
          );
        count("annual");
        if (state.annual === 1)
          return Promise.resolve(structuredClone(operatingAnnual));
        if (state.annual === 2) {
          count("refreshFailed");
          return Promise.reject(new TrialApiError("unavailable"));
        }
        signal.addEventListener("abort", () => count("aborted"), {
          once: true,
        });
        // Ignore abort deliberately; the real model must fence both late packets.
        return new Promise((resolve) => {
          pending = resolve;
        });
      }
      if (scenario === "company-price-ranges") {
        count("annual");
        throw new Error("Unexpected invented price-range Annual read");
      }
      if (scenario === "annual-comparison") {
        const second = state.annual === 1 || state.annual === 4;
        if (
          !comparisonReports ||
          signal.aborted ||
          pendingAnnualComparison ||
          request.schemaVersion !== "6.0.0" ||
          request.catalogSnapshotSha256 !== digest ||
          request.listingId !== (second ? "listing-one" : "listing-zero") ||
          request.symbol !== (second ? "ONE" : "ZERO") ||
          state.annual >= 5 ||
          (state.annual === 4 &&
            (state.aborted !== 1 || state.lateResolved !== 1))
        )
          throw new Error(
            "Unexpected invented Annual comparison request or order",
          );
        count("annual");
        if (state.annual <= 2)
          return Promise.resolve(
            structuredClone(comparisonReports[state.annual - 1]!),
          );
        if (state.annual === 3)
          return Promise.reject(new TrialApiError("unavailable"));
        signal.addEventListener("abort", () => count("aborted"), {
          once: true,
        });
        // Deliberately ignore abort so the real comparison must fence the late packet.
        return new Promise((resolve) => {
          pendingAnnualComparison = resolve;
        });
      }
      if (scenario === "watchlist-comparison")
        throw new Error("Unexpected invented watchlist comparison Annual read");
      if (scenario === "price-comparison-note")
        throw new Error("Unexpected fixture price note Annual read");
      if (scenario === "markets-price-handoff")
        throw new Error("Unexpected fixture handoff Annual read");
      if (
        signal.aborted ||
        pending ||
        request.schemaVersion !== "6.0.0" ||
        request.catalogSnapshotSha256 !== digest ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO"
      )
        throw new Error("Unexpected fixture annual request");
      if (scenario === "annual-note") {
        if (state.annual !== 0)
          throw new Error("Unexpected extra fixture annual note read");
        count("annual");
        return Promise.resolve(structuredClone(annual));
      }
      if (scenario === "company-filings") {
        if (!completedFilingsNote() || state.annual !== 0)
          throw new Error("Annual baseline requires the saved filings note");
        count("annual");
        return Promise.resolve(structuredClone(annual));
      }
      count("annual");
      if (!state.refreshScenario && state.annual === 2) {
        if (state.aborted !== 1 || state.lateResolved !== 1)
          throw new Error("The cancelled Annual request must settle first");
        return Promise.resolve(structuredClone(recovered));
      }
      if (!state.refreshScenario && state.annual !== 1)
        throw new Error("Unexpected extra fixture annual read");
      signal.addEventListener("abort", () => count("aborted"), { once: true });
      if (state.refreshScenario) {
        if (state.annual === 1)
          return Promise.resolve(structuredClone(refreshAnnual));
        if (state.annual === 2)
          return new Promise<PersonalSecAnnualCanonicalResponseDto>(
            (_resolve, reject) => {
              rejectRefresh = reject;
            },
          );
        if (state.annual === 3)
          return Promise.resolve(structuredClone(refreshRecovered));
        throw new Error("Unexpected extra fixture annual refresh");
      }
      // Deliberately ignores cancellation: the real model must reject this late completion.
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
  };
  const session: TrialSession = followups?.nextSession() ?? {
    userId: "invented-android-user",
    sessionId: "invented-android-session",
    getToken: () => unexpected("token"),
    signOut: () => {
      if (scenario === "authored-valuation") {
        if (
          state.signOut !== 0 ||
          state.save !== 1 ||
          state.load < 2 ||
          state.annual !== 0 ||
          state.eod !== 0 ||
          state.filings !== 0 ||
          state.marketsEod !== 0 ||
          state.calendar !== 0 ||
          state.fed !== 0 ||
          savedWatchlist.version !== 2 ||
          savedWatchlist.payload.memberships[0]?.note !==
            authoredValuationNoteDraft
        )
          return unexpected("signOut");
        count("signOut");
        return Promise.resolve();
      }
      if (
        !signOutScenario ||
        state.signOut !== 0 ||
        state.reviewSaveCommits !== 1 ||
        (scenario === "signout-save-review"
          ? state.save !== 1 ||
            state.reviewSaveSettled !== 1 ||
            state.reviewSaveAborted !== 0
          : state.save !== 2 ||
            state.reviewSaveSettled !== 0 ||
            state.reviewSaveAborted !== 1)
      )
        return unexpected("signOut");
      count("signOut");
      return Promise.resolve();
    },
  };
  return {
    api: withDraftFileCatalogFixture({
      api,
      scenario,
      snapshotSha256: digest,
      savedDraft: () => savedWatchlist.payload,
      resolveCount: () => state.resolve,
      recordResolve: () => count("resolve"),
      refuseResolve: () => unexpected("resolve"),
    }),
    session,
    followups: followupStorage,
    marketsCohort,
    researchCoverage: inventedManagedResearchCoverage,
    priceCoverage:
      scenario === "watchlist-comparison"
        ? comparisonListings
        : [identity, ...marketsCohort],
    settleCancelledAnnualComparison: () => {
      if (
        !comparisonReports ||
        !pendingAnnualComparison ||
        state.aborted !== state.lateResolved + 1
      )
        throw new Error(
          "Only an aborted invented Annual comparison may settle",
        );
      const resolve = pendingAnnualComparison;
      pendingAnnualComparison = null;
      resolve(structuredClone(comparisonReports[state.annual === 4 ? 2 : 3]));
      void Promise.resolve().then(() => count("lateResolved"));
    },
    settleCancelledFilings: () => {
      if (
        !pendingFilings ||
        state.filingsAborted !== state.filingsLateResolved + 1
      )
        throw new Error("Only an aborted invented filings read may settle");
      const resolve = pendingFilings;
      pendingFilings = null;
      resolve(inventedFilingsPacket(identity));
      void Promise.resolve().then(() => count("filingsLateResolved"));
    },
    settleCancelledCalendar: () => {
      if (
        !pendingCalendar ||
        state.calendarAborted !== state.calendarLateResolved + 1
      )
        throw new Error("Only an aborted invented calendar read may settle");
      const resolve = pendingCalendar;
      pendingCalendar = null;
      resolve({ ...structuredClone(beaAgenda!), events: [] });
      void Promise.resolve().then(() => count("calendarLateResolved"));
    },
    settleCancelledAnnouncements: () => {
      if (!pendingFed || state.fedAborted !== state.fedLateResolved + 1)
        throw new Error(
          "Only an aborted invented announcements read may settle",
        );
      const resolve = pendingFed;
      pendingFed = null;
      resolve(fedPacket("2026-10-22T18:00:00.000Z"));
      void Promise.resolve().then(() => count("fedLateResolved"));
    },
    generations: {
      get initial() {
        return (state.refreshScenario ? refreshAnnual : annual).evidence
          .generation;
      },
      get recovered() {
        return (state.refreshScenario ? refreshRecovered : recovered).evidence
          .generation;
      },
    },
    signOutSavedWatchlist: () => {
      if (!signOutScenario)
        throw new Error(
          "Only sign-out scenarios expose their invented saved watchlist",
        );
      return structuredClone(savedWatchlist);
    },
    settleSignOutSave: () => {
      if (
        !pendingSignOutSave ||
        state.reviewSaveSettled !== 0 ||
        (scenario === "signout-save-review"
          ? state.save !== 1 ||
            state.signOut !== 0 ||
            state.reviewSaveCommits !== 0 ||
            state.reviewSaveAborted !== 0
          : scenario !== "signout-uncertain-review" ||
            state.save !== 2 ||
            state.signOut !== 1 ||
            state.reviewSaveCommits !== 1 ||
            state.reviewSaveAborted !== 1)
      )
        throw new Error("Only the fixed held sign-out save may settle");
      const settle = pendingSignOutSave;
      pendingSignOutSave = null;
      settle();
      void Promise.resolve().then(() => count("reviewSaveSettled"));
    },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    failRecoveryRead: () => {
      if (
        scenario !== "watchlist-recovery" ||
        state.load !== 3 ||
        state.recoveryReadFailed !== 0 ||
        !rejectRecoveryRead
      )
        throw new Error("Only the third recovery fixture read may fail");
      const reject = rejectRecoveryRead;
      rejectRecoveryRead = null;
      count("recoveryReadFailed");
      reject(new TrialApiError("unavailable"));
    },
    settleCancelledMarkets: () => {
      if (
        !pendingMarkets ||
        state.marketsEod !== (selectedPriceScenario ? 2 : 5) ||
        state.marketsAborted !== 1 ||
        state.marketsLateResolved !== 0
      )
        throw new Error("Only the cancelled Markets row may settle");
      const resolve = pendingMarkets;
      pendingMarkets = null;
      resolve(structuredClone(marketsLate));
      void Promise.resolve().then(() => count("marketsLateResolved"));
    },
    releaseCatalogRecovery: () => {
      if (
        !state.catalogRecovery ||
        state.status !== 2 ||
        state.catalogReleased !== 0 ||
        !releaseCatalog
      )
        throw new Error("Only the second fixture status read may recover");
      const release = releaseCatalog;
      releaseCatalog = null;
      count("catalogReleased");
      release();
    },
    settleCancelledEod: () => {
      if (scenario === "company-price-ranges") {
        if (
          !pendingEod ||
          ![2, 4, 5].includes(state.eod) ||
          state.eodAborted !== state.eodLateResolved + 1
        )
          throw new Error(
            "Only an aborted invented price-range read may settle",
          );
        const resolve = pendingEod;
        pendingEod = null;
        resolve(priceRangePacket(state.eod - 1));
        void Promise.resolve().then(() => count("eodLateResolved"));
        return;
      }
      if (
        !pendingEod ||
        state.eod !== 2 ||
        state.eodAborted !== 1 ||
        state.eodLateResolved !== 0
      )
        throw new Error("Only the cancelled fixture EOD read may settle");
      const resolve = pendingEod;
      pendingEod = null;
      resolve(structuredClone(eodLate));
      void Promise.resolve().then(() => count("eodLateResolved"));
    },
    settleCancelledRead: () => {
      if (balanceScenario) {
        if (
          !annualBalanceLate ||
          !pending ||
          state.annual !== 3 ||
          state.status !== 2 ||
          state.aborted !== 1 ||
          state.lateResolved !== 0
        )
          throw new Error("Only the retired balance-sheet read may settle");
        const resolve = pending;
        pending = null;
        resolve(structuredClone(annualBalanceLate));
        void Promise.resolve().then(() => count("lateResolved"));
        return;
      }
      if (historyScenario) {
        if (
          !annualHistoryLate ||
          !pending ||
          state.aborted !== state.lateResolved + 1 ||
          ![3, 5].includes(state.annual)
        )
          throw new Error("Only an aborted annual-history read may settle");
        const resolve = pending;
        pending = null;
        resolve(structuredClone(annualHistoryLate));
        void Promise.resolve().then(() => count("lateResolved"));
        return;
      }
      if (scenarioName === "annual-operating-results") {
        if (
          !operatingLate ||
          !pending ||
          state.aborted !== state.lateResolved + 1 ||
          ![3, 4].includes(state.annual)
        )
          throw new Error("Only an aborted operating-results read may settle");
        const resolve = pending;
        pending = null;
        resolve(structuredClone(operatingLate));
        void Promise.resolve().then(() => count("lateResolved"));
        return;
      }
      if (!pending || state.aborted !== 1 || state.lateResolved !== 0)
        throw new Error("Only the cancelled fixture read may settle");
      const resolve = pending;
      pending = null;
      resolve(structuredClone(annual));
      // The model's await continuation runs before this observable settled diagnostic.
      void Promise.resolve().then(() => count("lateResolved"));
    },
    enableRefreshScenario: () => {
      if (
        state.refreshScenario ||
        state.annual !== 0 ||
        pending ||
        rejectRefresh
      )
        throw new Error("Only a fresh fixture can select the refresh sequence");
      state = { ...state, refreshScenario: true };
      for (const listener of listeners) listener();
    },
    failRefresh: () => {
      if (
        !state.refreshScenario ||
        state.annual !== 2 ||
        !rejectRefresh ||
        state.refreshFailed !== 0
      )
        throw new Error("Only the second fixture annual read may fail");
      const reject = rejectRefresh;
      rejectRefresh = null;
      count("refreshFailed");
      reject(new TrialApiError("unavailable"));
    },
  };
}

export type SharedNativeFixture = Awaited<
  ReturnType<typeof createSharedFixture>
>;
export type NativeFinancialReviewMetadata = {
  readonly prefix: string;
  readonly expectedNote: string;
  readonly generation: SharedNativeFixture["generations"]["initial"];
};
export type ManagedNativeFixture = SharedNativeFixture & {
  readonly portfolioDatedReview?: PortfolioDatedReviewFixture;
  readonly reviewFilingsEvidence?: ReviewFilingsEvidenceFixture;
  readonly portfolioHeldDueChecks?: PortfolioHeldDueChecksFixture;
  readonly portfolioReportComparison?: PortfolioReportComparisonFixture;
  readonly portfolioScreenSelection?: PortfolioScreenSelectionFixture;
  readonly companyResearchChecks?: CompanyResearchChecksFixture;
  readonly reportComparisonCheck?: ReportComparisonCheckFixture;
  readonly reviewedCompanySourcePass?: ReviewedCompanySourcePassControls;
  readonly sourceReview?: SourceReviewFixtureControls;
  readonly companySnapshotLoading?: SnapshotLoadingFixtureControls;
  readonly filingsReview?: {
    readonly prefix: string;
    readonly expectedNote: string;
  };
  readonly financialReview: NativeFinancialReviewMetadata | null;
  readonly portfolio?: PortfolioNativeControls;
  readonly annualStatements?: NativeAnnualStatementsMetadata;
  readonly interimReview?: NativeInterimStatementsMetadata;
  readonly financialScreen?: NativeFinancialScreenMetadata;
  readonly valuationPrice?: NativeValuationPriceMetadata;
  readonly screenComparison?: NativeScreenComparisonMetadata;
  readonly screenComparisonReport?: ScreenComparisonReportNativeMetadata;
  readonly filingAssessment?: FilingAssessmentNativeMetadata;
  readonly reviewCompletion?: ReviewCompletionMetadata;
  readonly collectionRecovery?: ValuationCollectionRecoveryControls;
  readonly researchDraftSet?: ResearchDraftSetFixtureControls;
  readonly screenComparisonFollowup?: ScreenComparisonFollowupNativeMetadata;
  readonly savedValuation?: SavedValuationNativeControls;
};

export interface SavedValuationNativeControls {
  readonly expected: ValuationAssumptionEntry;
  readonly getSnapshot: () => Readonly<{
    load: number;
    save: number;
    resolve: number;
  }>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly saved: () => ManagedValuationAssumptionsDto;
}
export const savedValuationInputs = parseValuationAssumptionEntry({
  catalogSnapshotSha256: digest,
  listing: identity,
  cik: null,
  dcf: {
    modelVersion: MANAGED_VALUATION_DCF_MODEL_VERSION,
    inputs: {
      startingUnleveredCashFlowUsd: "100.00",
      enterpriseToEquityBridgeUsd: "100.00",
      dilutedShares: "10.00",
      forecastYears: "5",
      waccPercent: "10.00",
      terminalGrowthPercent: "0.00",
      scenarios: {
        conservative: { annualCashFlowGrowthPercent: "0.00" },
        base: { annualCashFlowGrowthPercent: "10.00" },
        expansion: { annualCashFlowGrowthPercent: "20.00" },
      },
    },
  },
  exit: {
    modelVersion: MANAGED_VALUATION_EXIT_MODEL_VERSION,
    inputs: {
      baseRevenue: "1000.00",
      cash: "100.00",
      debt: "200.00",
      dilutedShares: "100.00",
      horizonYears: "5",
      discountRatePercent: "10.00",
      scenarios: {
        conservative: {
          annualRevenueGrowthPercent: "0.00",
          targetEbitdaMarginPercent: "20.00",
          exitMultiple: "10.00",
        },
        base: {
          annualRevenueGrowthPercent: "10.00",
          targetEbitdaMarginPercent: "20.00",
          exitMultiple: "10.00",
        },
        expansion: {
          annualRevenueGrowthPercent: "20.00",
          targetEbitdaMarginPercent: "20.00",
          exitMultiple: "10.00",
        },
      },
    },
  },
});
if (!savedValuationInputs)
  throw new Error("Invalid invented saved valuation inputs");

function refuseSavedValuation(): never {
  throw new Error("Unexpected invented saved valuation operation");
}
class SavedValuationNativeStore implements SavedValuationNativeControls {
  constructor(
    readonly expected: ValuationAssumptionEntry = savedValuationInputs!,
  ) {}
  private stored: ManagedValuationAssumptionsDto = {
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  };
  private state: Readonly<{ load: number; save: number; resolve: number }> =
    Object.freeze({ load: 0, save: 0, resolve: 0 });
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = () => this.state;
  readonly saved = () => structuredClone(this.stored);
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private count(key: keyof SavedValuationNativeStore["state"]) {
    this.state = Object.freeze({ ...this.state, [key]: this.state[key] + 1 });
    for (const listener of [...this.listeners]) listener();
  }
  readonly load: ManagedApi["loadValuationAssumptions"] = (signal) => {
    if (signal.aborted || this.state.load >= 2) return refuseSavedValuation();
    if (this.state.load !== this.state.save) return refuseSavedValuation();
    this.count("load");
    return Promise.resolve(this.saved());
  };
  private captureSave(
    input: Parameters<ManagedApi["saveValuationAssumptions"]>[0],
    signal: AbortSignal,
  ) {
    const command = parseManagedValuationAssumptionsCommand(input);
    if (signal.aborted || !command) return refuseSavedValuation();
    if (this.state.load !== 1 || this.state.save !== 0)
      return refuseSavedValuation();
    if (this.state.resolve !== 1 || command.expectedVersion !== 0)
      return refuseSavedValuation();
    if (
      JSON.stringify(command.payload.entries) !==
      JSON.stringify([this.expected])
    )
      return refuseSavedValuation();
    return command;
  }
  readonly save: ManagedApi["saveValuationAssumptions"] = (input, signal) => {
    const command = this.captureSave(input, signal);
    const receipt = parseManagedValuationAssumptionsReceipt(
      { version: 1, payload: command.payload, replayed: false },
      command,
    );
    if (!receipt) return refuseSavedValuation();
    this.stored = { version: receipt.version, payload: receipt.payload };
    this.count("save");
    return Promise.resolve(receipt);
  };
  resolve(
    request: Parameters<ManagedApi["resolve"]>[0],
    signal: AbortSignal,
    fallback: ManagedApi["resolve"],
  ) {
    if (request.listingIds.join("|") !== identity.listingId)
      return fallback(request, signal);
    if (signal.aborted || request.snapshotSha256 !== digest)
      return refuseSavedValuation();
    if (this.state.resolve !== 0 || this.state.load !== 1)
      return refuseSavedValuation();
    const resolved = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: digest,
        results: [{ listingId: identity.listingId, listing: identity }],
      },
      request,
    );
    if (!resolved) return refuseSavedValuation();
    this.count("resolve");
    return Promise.resolve(resolved);
  }
}
export function createSavedValuationNativeFixture(
  base: SharedNativeFixture,
  expected: ValuationAssumptionEntry = savedValuationInputs!,
): ManagedNativeFixture & {
  readonly savedValuation: SavedValuationNativeControls;
} {
  const store = new SavedValuationNativeStore(expected);
  return {
    ...base,
    api: {
      ...base.api,
      loadValuationAssumptions: store.load,
      saveValuationAssumptions: store.save,
      resolve: (request, signal) =>
        store.resolve(request, signal, base.api.resolve),
    },
    financialReview: null,
    savedValuation: store,
  };
}

const nativeFixtureFactories = new Map<
  string,
  () => Promise<ManagedNativeFixture>
>([
  [
    "portfolio-screen-selection",
    async () =>
      createPortfolioScreenSelectionFixture(await createSharedFixture()),
  ],
  [
    "report-comparison-check",
    async () =>
      createReportComparisonCheckFixture(
        await createSharedFixture("company-snapshot"),
      ),
  ],
  [
    "company-research-checks",
    async () => createCompanyResearchChecksFixture(await createSharedFixture()),
  ],
  [
    "research-draft-set",
    async () => createResearchDraftSetFixture(await createSharedFixture()),
  ],
  [
    "valuation-collection-recovery",
    async () =>
      createValuationCollectionRecoveryFixture(await createSharedFixture()),
  ],
  [
    "review-check-completion",
    async () =>
      createReviewCompletionNativeFixture(await createSharedFixture()),
  ],
  [
    "filing-check-assessment",
    async () =>
      createFilingAssessmentNativeFixture(await createSharedFixture()),
  ],
  [
    "screen-comparison-followup",
    async () =>
      createScreenComparisonFollowupNativeFixture(await createSharedFixture()),
  ],
  [
    "screen-comparison-report",
    async () =>
      createScreenComparisonReportNativeFixture(await createSharedFixture()),
  ],
  [
    "markets-briefing",
    async () => createMarketsBriefingNativeFixture(await createSharedFixture()),
  ],
  [
    "cpi-headline-followup",
    async () =>
      createCpiHeadlineFollowupNativeFixture(await createSharedFixture()),
  ],
  [
    "valuation-scenario-followup",
    async () =>
      createValuationScenarioFollowupNativeFixture(await createSharedFixture()),
  ],
  [
    "annual-revenue-model-basis",
    async () =>
      createAnnualRevenueModelBasisNativeFixture(
        createSavedValuationNativeFixture(
          await createSharedFixture("annual-note"),
          annualRevenueModelInputs(savedValuationInputs),
        ),
      ),
  ],
  [
    "markets-calendar-followup",
    async () =>
      createCalendarFollowupNativeFixture(await createSharedFixture()),
  ],
  [
    "markets-source-review",
    async () =>
      createMarketsSourceReviewNativeFixture(await createSharedFixture()),
  ],
  [
    "holding-followup",
    async () =>
      createHoldingFollowupNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "followups-review-report",
    async () =>
      createFollowupsReviewReportNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "filing-dated-question",
    async () =>
      createFilingDatedQuestionNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "followup-assessment-note",
    async () =>
      createFollowupAssessmentNoteNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "followups-review-session",
    async () =>
      createFollowupsReviewSessionNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "reviewed-company-source-pass",
    async () =>
      createReviewedCompanySourcePassNativeFixture(
        await createSharedFixture("company-snapshot"),
      ),
  ],
  [
    "company-snapshot-loading",
    async () =>
      createCompanySnapshotLoadingNativeFixture(
        await createSharedFixture("company-snapshot"),
      ),
  ],
  [
    "report-revisit",
    async () =>
      createReportRevisitNativeFixture(
        await createSharedFixture("company-snapshot"),
      ),
  ],
  [
    "watchlist-filings-review",
    async () => createFilingsReviewNativeFixture(await createSharedFixture()),
  ],
  [
    "screen-comparison",
    async () =>
      createScreenComparisonNativeFixture(await createSharedFixture()),
  ],
  [
    "valuation-price",
    async () =>
      createValuationPriceNativeFixture(
        await createSharedFixture("price-comparison-note"),
      ),
  ],
  [
    "financial-screen",
    async () => createFinancialScreenNativeFixture(await createSharedFixture()),
  ],
  [
    "price-studies",
    async () =>
      createPriceStudiesNativeFixture(
        await createSharedFixture("price-comparison-note"),
      ),
  ],
  [
    "interim-statements",
    async () =>
      createInterimStatementsNativeFixture(
        await createSharedFixture("annual-note"),
      ),
  ],
  [
    "annual-statements",
    async () =>
      createAnnualStatementsNativeFixture(
        await createSharedFixture("annual-note"),
      ),
  ],
  [
    "portfolio-dated-review",
    async () => createPortfolioDatedReviewFixture(await createSharedFixture()),
  ],
  [
    "review-filings-evidence",
    async () => createReviewFilingsEvidenceFixture(await createSharedFixture()),
  ],
  [
    "portfolio-held-due-checks",
    async () =>
      createPortfolioHeldDueChecksFixture(await createSharedFixture()),
  ],
  [
    "portfolio-comparison-report",
    async () =>
      createPortfolioReportComparisonFixture(await createSharedFixture()),
  ],
  [
    "portfolio-report-comparison",
    async () =>
      createPortfolioReportComparisonFixture(await createSharedFixture()),
  ],
  [
    "portfolio-composition-review",
    async () =>
      createPortfolioCompositionNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "portfolio-review-report",
    async () =>
      createPortfolioReviewReportNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "portfolio-close-review",
    async () =>
      createPortfolioCloseNativeFixture(
        createPortfolioNativeFixture(
          await createSharedFixture("research-followups"),
        ),
      ),
  ],
  [
    "portfolio-ledger",
    async () =>
      createPortfolioNativeFixture(
        await createSharedFixture("research-followups"),
      ),
  ],
  [
    "annual-financial-review",
    async () =>
      createFinancialReviewNativeFixture(
        await createSharedFixture("annual-note"),
      ),
  ],
  [
    "saved-valuation",
    async () => createSavedValuationNativeFixture(await createSharedFixture()),
  ],
]);

/** Dispatch only the new fixed journey; all existing scenario bodies remain unchanged. */
export async function createFixture(
  scenario:
    | Parameters<typeof createSharedFixture>[0]
    | "annual-financial-review"
    | "annual-statements"
    | "interim-statements"
    | "price-studies"
    | "screen-comparison"
    | "screen-comparison-report"
    | "review-check-completion"
    | "valuation-collection-recovery"
    | "company-research-checks"
    | "report-comparison-check"
    | "portfolio-screen-selection"
    | "portfolio-report-comparison"
    | "portfolio-comparison-report"
    | "review-filings-evidence"
    | "portfolio-held-due-checks"
    | "research-draft-set"
    | "filing-check-assessment"
    | "screen-comparison-followup"
    | "financial-screen"
    | "valuation-price"
    | "saved-valuation"
    | "annual-revenue-model-basis"
    | "valuation-scenario-followup"
    | "cpi-headline-followup"
    | "markets-briefing"
    | "portfolio-ledger"
    | "portfolio-dated-review"
    | "portfolio-close-review"
    | "portfolio-review-report"
    | "portfolio-composition-review"
    | "followups-review-report"
    | "company-snapshot-loading"
    | "reviewed-company-source-pass"
    | "followups-review-session"
    | "markets-source-review"
    | "markets-calendar-followup"
    | "holding-followup"
    | "filing-dated-question"
    | "followup-assessment-note"
    | "watchlist-filings-review"
    | "report-revisit" = "default",
): Promise<ManagedNativeFixture> {
  const create = nativeFixtureFactories.get(scenario);
  if (create) return create();
  return {
    ...(await createSharedFixture(
      scenario as Parameters<typeof createSharedFixture>[0],
    )),
    financialReview: null,
  };
}
