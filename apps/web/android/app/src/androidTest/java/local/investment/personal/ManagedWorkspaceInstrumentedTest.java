package local.investment.personal;

import static androidx.test.espresso.Espresso.closeSoftKeyboard;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.action.ViewActions.typeTextIntoFocusedView;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.supportsInputMethods;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.junit.Assert.*;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.WebBackForwardList;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.PerformException;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.espresso.action.CoordinatesProvider;
import androidx.test.espresso.action.EspressoKey;
import androidx.test.espresso.action.GeneralClickAction;
import androidx.test.espresso.action.Press;
import androidx.test.espresso.action.Tap;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestName;
import org.junit.runner.RunWith;

/** Real managed UI and App Back bridge; invented data lives only in the test APK and RAM. */
@RunWith(AndroidJUnit4.class)
public class ManagedWorkspaceInstrumentedTest {
    private static final String FIXTURE = "managed-workspace";
    private static final java.util.Set<String> ALLOWED_FIXTURE_SCENARIOS = java.util.Set.of(
        "catalog-startup-recovery",
        "company-direct-entry",
        "markets-selected-price",
        "annual-note",
        "annual-statements",
        "annual-cash-history",
        "annual-operating-results",
        "annual-operating-history",
        "annual-liquidity-history",
        "annual-balance-sheet",
        "annual-financial-review",
        "annual-operating-comparison",
        "markets-price-handoff",
        "watchlist-recovery",
        "signout-save-review",
        "signout-uncertain-review",
        "raw-close-comparison",
        "price-comparison-note",
        "price-studies",
        "financial-screen",
        "screen-comparison",
        "thesis-review",
        "company-snapshot",
        "authored-valuation",
        "valuation-price",
        "research-followups",
        "portfolio-ledger",
        "markets-day-view",
        "company-price-ranges",
        "bea-agenda",
        "bea-agenda-comparison",
        "bea-session-retirement",
        "watchlist-comparison",
        "watchlist-export",
        "company-filings",
        "fed-announcements",
        "annual-comparison",
        "watchlist-draft-file");
    private static final java.util.Map<String, String> DRAFT_FILE_SCENARIOS = java.util.Map.of(
        "watchlistDraftFileUsesSystemExportImportAndExplicitRestore", "watchlist-draft-file",
        "watchlistDraftFileRejectsAnotherAccountAndRetiresChooser", "watchlist-draft-file");
    private static final String ANNUAL_COMPARISON_NOTE =
        "Draft survives native Back Observed Annual cash comparison; exact, unscaled USD. OCF = NetCashProvidedByUsedInOperatingActivities; PP&E = PaymentsToAcquirePropertyPlantAndEquipment. " +
        "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 10-K 2025-01-01 to 2025-12-31; reported OCF USD 1000; reported PP&E USD 250; app calculation OCF less PP&E USD 750. " +
        "CIK 0000000001; filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load. Retained previous report. " +
        "ONE (One Company; One Class A; Class A; XNAS, US): 10-K 2024-07-01 to 2025-06-30; reported OCF USD 900; reported PP&E USD 300; app calculation OCF less PP&E USD 600. " +
        "CIK 0000000002; filed 2025-08-01; accession 0000000002-25-000001; filing https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm. " +
        "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load. " +
        "The app calculation uses each company's same filing and period; no adjustment for leases, acquisitions or other investing cash flows. " +
        "Company periods may differ; no cross-company calculation or ranking. Evidence dates are unchanged; this action does not refresh sources.";
    private static final String ANNUAL_COMPARISON_LIQUIDITY_PREFIX = "Latest ONE liquidity thesis";
    private static final String ANNUAL_COMPARISON_LIQUIDITY_NOTE = ANNUAL_COMPARISON_LIQUIDITY_PREFIX + " " +
        "Observed Annual liquidity comparison; exact, unscaled USD; current ratio is a multiple. " +
        "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. " +
        "Reported current assets (AssetsCurrent) USD 1500; reported current liabilities (LiabilitiesCurrent) USD 600. " +
        "App calculations: working capital USD 900; current ratio 2.50 multiple (two decimal places, half up). " +
        "Same filing and date. Current assets are not all cash. " +
        "Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. Retained previous report. " +
        "Evidence dates are unchanged; this action does not refresh sources. " +
        "ONE (One Company; One Class A; Class A; XNAS, US): Observed Annual liquidity: ONE (XNAS); CIK 0000000002; 10-K balances at 2025-06-30. " +
        "Reported current assets (AssetsCurrent) USD 900; reported current liabilities (LiabilitiesCurrent) USD 1200. " +
        "App calculations: working capital USD -300; current ratio 0.75 multiple (two decimal places, half up). " +
        "Same filing and date. Current assets are not all cash. " +
        "Filed 2025-08-01; accession 0000000002-25-000001; filing https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm. " +
        "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. " +
        "Evidence dates are unchanged; this action does not refresh sources. " +
        "Company balance dates may differ; no cross-company calculation or ranking.";
    private static final String NOTE = "Draft survives native Back";
    private static final String LIQUIDITY_NOTE_INITIAL =
        "Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. " +
        "Reported current assets (AssetsCurrent) USD 120.125; reported current liabilities (LiabilitiesCurrent) USD 80.025. " +
        "App calculations: working capital USD 40.1; current ratio 1.50 multiple (two decimal places, half up). " +
        "Same filing and date. " +
        "Current assets are not all cash. " +
        "Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. " +
        "Evidence dates are unchanged; this action does not refresh sources.";
    private static final String LIQUIDITY_NOTE_RETAINED =
        "Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. " +
        "Reported current assets (AssetsCurrent) USD 120.125; reported current liabilities (LiabilitiesCurrent) USD 80.025. " +
        "App calculations: working capital USD 40.1; current ratio 1.50 multiple (two decimal places, half up). " +
        "Same filing and date. " +
        "Current assets are not all cash. " +
        "Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. " +
        "Retained previous report. " +
        "Evidence dates are unchanged; this action does not refresh sources.";
    private static final String LIQUIDITY_NOTE_ZERO =
        "Observed Annual liquidity: ZERO (XNAS); CIK 0000000001; 10-K balances at 2025-12-31. " +
        "Reported current assets (AssetsCurrent) USD 120.125; reported current liabilities (LiabilitiesCurrent) USD 0. " +
        "App calculations: working capital USD 120.125; current ratio unavailable because current liabilities are zero. " +
        "Same filing and date. " +
        "Current assets are not all cash. " +
        "Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original load cutoff 2026-09-21T00:00:00.000Z; completed 2026-09-21T00:00:02.000Z; Company Facts captured 2026-09-21T00:00:01.000Z; Submissions captured 2026-09-21T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. " +
        "Evidence dates are unchanged; this action does not refresh sources.";
    private static final String WATCHLIST_COMPARISON_EXISTING_NOTE = "Latest ONE research note";
    private static final String WATCHLIST_COMPARISON_NOTE = WATCHLIST_COMPARISON_EXISTING_NOTE + " " +
        "Observed raw-close watchlist comparison: 2026-09-17 to 2026-09-18; " +
        "2 shared observed dates in this interval, 3 across the loaded histories. " +
        "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 2026-09-17 USD 100 to 2026-09-18 USD 110; " +
        "raw close change +$10 (+10.0000%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; " +
        "original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. " +
        "ONE (One Company; One Class A; Class A; XNAS, US): 2026-09-17 USD 100 to 2026-09-18 USD 95; " +
        "raw close change -$5 (-5.0000%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; " +
        "original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. " +
        "Raw closes are not adjusted for splits or dividends and are not live quotes. Missing dates are not filled. " +
        "Evidence dates are unchanged; this action does not refresh sources.";
    private static final String FILINGS_NOTE = NOTE + " " +
        "Observed SEC filing reference: ZERO (XNAS); CIK 0000000001; Form 8-K; accession 0000000001-26-000026; " +
        "filed 2026-09-19; report date unavailable; filing index https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000026-index.htm. " +
        "Source: SEC Submissions; requested window 2026-06-23 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; " +
        "retrieved 2026-09-20T00:00:01.000Z; completed 2026-09-20T00:00:02.000Z. " +
        "Only the current recent-filings object was checked; older continuation files were not loaded; " +
        "complete window coverage is not established. The source lists older continuation files. " +
        "Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
    private static final String SIGNOUT_NOTE = "Sign-out review draft";
    private static final String COMPANY_NOTE = "Company draft captured in research";
    private static final String MARKETS_PRICE_NOTE =
        "Markets research draft Observed raw-close comparison: BETA (XNAS); 2026-09-18 USD 20.75 to 2026-09-19 USD 20.5; " +
        "raw close change -$0.25 (-1.2048%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; " +
        "original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. " +
        "Raw closes are not adjusted for splits or dividends and are not live quotes. " +
        "Retained previous history; newer prices were not confirmed. Evidence dates are unchanged; this action does not refresh sources.";
    private static final String INVALID_COMPANY_NOTE = "Company draft\nNeeds correction";
    private static final String NOTE_ERROR =
        "Use at most 2,000 characters. Remove embedded line breaks and unsupported characters.";
    private static final String PRICE_NOTE = "Price research draft " +
        "Observed raw-close comparison: ZERO (XNAS); 2026-09-17 USD 100.000000000000000001 " +
        "to 2026-09-18 USD 107.500000000000000002; " +
        "raw close change +$7.500000000000000001 (+7.5000%). Source: Tiingo; " +
        "requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; " +
        "completed 2026-09-20T00:00:01.000Z. Raw closes are not adjusted for splits or dividends and are not live quotes. " +
        "Evidence dates are unchanged; this action does not refresh sources.";
    private static final String PRICE_STUDIES_NOTE = "Price studies draft " +
        "ZERO XNAS raw close studies: Loaded-window raw close change: 10.0000% " +
        "(3 observed closes; 2026-09-17 through 2026-09-19; Raw price change excludes dividends and split adjustments.); " +
        "Maximum observed drawdown: 0.0000% (3 observed closes; 2026-09-17 through 2026-09-19; " +
        "Nonnegative decline magnitude; peak 2026-09-17, trough 2026-09-17.). " +
        "Tiingo raw USD closes, unadjusted for splits/dividends; observed gaps are not filled. " +
        "Loaded 1m window 2026-08-20 through 2026-09-20; requested 2026-09-20T00:00:00.000Z; " +
        "completed 2026-09-20T00:00:01.000Z. Formula set 1.0.0; derived percentages rounded half-up to 4 decimal places. " +
        "Descriptive observations, not a recommendation or forecast.";
    private static final String ANNUAL_NOTE = "Annual research draft " +
        "Observed Annual report: ZERO (XNAS); 10-K 2025-01-01 to 2025-12-31; Revenues revenue USD 1000; " +
        "NetIncomeLoss USD 100; net margin 10%. " +
        "Same-filing annual comparison: prior 2024-01-01 to 2024-12-31; Revenues revenue USD 800 to 1000, change USD 200 (25%); " +
        "NetIncomeLoss USD -80 to 100, change USD 180 (Unavailable: prior value is negative). " +
        "Reported net margin -10% to 10%, change 20 percentage points. " +
        "Period length, accounting changes and restatements are unadjusted; " +
        "not as-originally-filed history or organic growth. " +
        "Additional same-filing annual period: 2023-01-01 to 2023-12-31; Revenues revenue USD 640; " +
        "NetIncomeLoss USD 32; net margin 5%. " +
        "Earlier same-filing annual comparison: prior 2023-01-01 to 2023-12-31; current 2024-01-01 to 2024-12-31; " +
        "Revenues revenue change USD 160 (25%); NetIncomeLoss change USD -112 (-350%). " +
        "Filed 2026-02-01; accession 0000000001-26-000001; " +
        "filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; " +
        "Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";
    private static final String ANNUAL_CASH_NOTE = "Cash research draft " +
        "Observed Annual cash generation: ZERO (XNAS); CIK 0000000001; 10-K 2025-01-01 to 2025-12-31. " +
        "Reported operating cash flow (NetCashProvidedByUsedInOperatingActivities) USD 120.125; " +
        "reported PP&E purchases (PaymentsToAcquirePropertyPlantAndEquipment) USD 20.025. " +
        "App calculation: operating cash flow less PP&E purchases USD 100.1. " +
        "Same filing and period; no adjustments for leases, acquisitions or other investing cash flows. " +
        "Filed 2026-02-01; accession 0000000001-26-000001; " +
        "filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; " +
        "Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
        "Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";
    private static final String ANNUAL = "button[aria-label='Annual report for saved ZERO']";
    private static final String DISCOVER = ".trial-panel[aria-labelledby='managed-discover-heading']";
    private static final String CATALOG_REFRESH = ".managed-search-bar > button";
    private static final String CATALOG_STATUS = ".managed-discovery-status";
    private static final String CATALOG_FAILURE =
        "The catalog could not be loaded. Select Refresh catalog to try again.";
    private static final String CSP =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; " +
        "base-uri 'none'; form-action 'none'";
    private static final String DRAFT =
        "JSON.parse(document.getElementById('fixture-workspace-draft').textContent)";
    private static final String DIAGNOSTICS =
        "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FOLLOWUPS =
        "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String FOLLOWUP_DRAFT =
        "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String PORTFOLIO =
        "JSON.parse(document.querySelector('#fixture-portfolio-state').textContent)";
    private static final String PORTFOLIO_DRAFT =
        "JSON.parse(document.querySelector('#fixture-portfolio-draft').textContent)";
    private static final long PAGE_TIMEOUT_MS = 10_000;
    private static final long MAX_ASSET_BYTES = 4 * 1024 * 1024;

    @Rule public final TestName testName = new TestName();
    private ActivityScenario<MainActivity> scenario;
    private File fixtureDirectory;
    private final List<File> createdFixturePaths = new ArrayList<>();
    private String expectedSourceSha;
    private int copiedFiles;
    private long copiedBytes;

    @Before
    public void launchInventedManagedWorkspace() throws Exception {
        expectedSourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull("Pass the actual bundled commit as expectedSourceSha", expectedSourceSha);
        assertTrue(expectedSourceSha.matches("[0-9a-f]{40}"));
        assertFalse("Test assets must run in the disconnected profile", BuildConfig.CLERK_AUTH_ENABLED);
        File cache = InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir();
        fixtureDirectory = File.createTempFile("managed-instrumentation-", "", cache);
        createdFixturePaths.add(fixtureDirectory);
        assertTrue(fixtureDirectory.delete() && fixtureDirectory.mkdir());
        copyFixture(InstrumentationRegistry.getInstrumentation().getContext().getAssets(),
            FIXTURE, fixtureDirectory, 0);
        assertTrue("Fixture index is absent", new File(fixtureDirectory, "index.html").isFile());
        if (testName.getMethodName().equals("catalogStartupFailureRecoversWithoutReloadOrDraftLoss"))
            selectFixtureScenario("catalog-startup-recovery");
        if (testName.getMethodName().equals("companyFilingsPagingCancelAndBackPreserveDraft"))
            selectFixtureScenario("company-filings");
        if (testName.getMethodName().equals("portfolioLedgerKeepsExactFifoAndIndependentSave"))
            selectFixtureScenario("portfolio-ledger");
        boolean coldCompanyLink = testName.getMethodName().equals("companyLinkDirectEntryAndBackPreserveDraft");
        if (coldCompanyLink) selectFixtureScenario("company-direct-entry");
        if (testName.getMethodName().equals("selectedMarketPriceLoadRefreshAndCancelPreserveDraft"))
            selectFixtureScenario("markets-selected-price");
        if (testName.getMethodName().equals("watchlistComparisonUsesLoadedSharedDatesAndPreservesDraft"))
            selectFixtureScenario("watchlist-comparison");
        if (testName.getMethodName().equals("marketsLoadCancelAndNavigationPreserveDraft"))
            selectFixtureScenario("markets-price-handoff");
        if (testName.getMethodName().equals("rawCloseComparisonUsesObservedDatesAndPreservesDraft"))
            selectFixtureScenario("raw-close-comparison");
        if (testName.getMethodName().equals("annualEvidenceNoteDraftReviewSaveAndReloadPreservesSource"))
            selectFixtureScenario("annual-note");
        if (testName.getMethodName().equals("annualStatementsPreviewAppendSaveAndCapturePreserveSources"))
            selectFixtureScenario("annual-statements");
        if (testName.getMethodName().equals("annualFinancialReviewRequiresPreviewAndExplicitSave"))
            selectFixtureScenario("annual-financial-review");
        if (testName.getMethodName().equals("authoredValuationPreviewSaveReportAndRetirementPreserveBoundaries"))
            selectFixtureScenario("authored-valuation");
        if (testName.getMethodName().equals("valuationPriceComparisonPreviewSaveFreshReadAndReportPreserveSources"))
            selectFixtureScenario("valuation-price");
        if (testName.getMethodName().equals("annualBalanceSheetCapturesExactTotalsAndRetiresLateRefresh"))
            selectFixtureScenario("annual-balance-sheet");
        if (testName.getMethodName().equals("annualLiquidityHistoryRetainsDatesAndRefusals"))
            selectFixtureScenario("annual-liquidity-history");
        if (testName.getMethodName().equals("annualOperatingHistoryRetainsReplacesAndRetiresExactPeriods"))
            selectFixtureScenario("annual-operating-history");
        if (testName.getMethodName().equals("annualCashHistoryKeepsExactPeriodsAndRetiresWithSession"))
            selectFixtureScenario("annual-cash-history");
        if (testName.getMethodName().equals("annualOperatingResultsRetainFactsDraftAndRetireWithSession"))
            selectFixtureScenario("annual-operating-results");
        if (testName.getMethodName().equals("companyPriceRangesRetainDatesAndFenceCancelledVisits"))
            selectFixtureScenario("company-price-ranges");
        if (testName.getMethodName().equals("loadedCompanySnapshotKeepsSeparateEvidenceWithoutAutomaticReads") ||
            testName.getMethodName().equals("preparedCompanyReportUsesSystemPickerAndPreservesDraft"))
            selectFixtureScenario("company-snapshot");
        if (testName.getMethodName().equals("priceComparisonNoteDraftReviewSaveAndReloadPreservesSource"))
            selectFixtureScenario("price-comparison-note");
        if (testName.getMethodName().equals("priceStudiesPreviewSaveReloadAndReportPreserveRawSource"))
            selectFixtureScenario("price-studies");
        if (testName.getMethodName().equals("screenComparisonKeepsIndependentStatementsSourcesAndResearchBack"))
            selectFixtureScenario("screen-comparison");
        if (testName.getMethodName().equals("financialScreenExplicitRunInspectionAndResearchBackPreserveDraft"))
            selectFixtureScenario("financial-screen");
        if (testName.getMethodName().equals("thesisReviewPreviewAppendSaveAndReloadPreservesDraft"))
            selectFixtureScenario("thesis-review");
        if (testName.getMethodName().equals("watchlistReplayReviewAndFailedReadPreserveDraft"))
            selectFixtureScenario("watchlist-recovery");
        if (testName.getMethodName().equals("signOutReviewKeepsDraftAndUpdatesAfterSave"))
            selectFixtureScenario("signout-save-review");
        if (testName.getMethodName().equals("uncertainSignOutReviewClearsLocalStateAndFencesLateReceipt"))
            selectFixtureScenario("signout-uncertain-review");
        if (testName.getMethodName().equals("beaAgendaRefreshCancelAndNavigationPreserveDraft"))
            selectFixtureScenario("bea-agenda");
        if (testName.getMethodName().equals("beaAgendaComparisonKeepsOriginalWindowsAndRetainedPair"))
            selectFixtureScenario("bea-agenda-comparison");
        if (testName.getMethodName().equals("beaSessionExpiryClearsAgendaAndFencesLateResponse"))
            selectFixtureScenario("bea-session-retirement");
        if (testName.getMethodName().equals("watchlistAnnualComparisonKeepsSeparateFilingsAndPreservesDraft"))
            selectFixtureScenario("annual-comparison");
        if (testName.getMethodName().equals("operatingComparisonNoteKeepsSeparateSourcesAndExplicitSave"))
            selectFixtureScenario("annual-operating-comparison");
        if (testName.getMethodName().equals("fedAnnouncementsRetainDatesCancelAndRetireWithSession"))
            selectFixtureScenario("fed-announcements");
        if (testName.getMethodName().equals("marketsDayViewKeepsSourcesSeparateAndRetiresLateResponses"))
            selectFixtureScenario("markets-day-view");
        if (testName.getMethodName().equals("savedWatchlistExportUsesSystemPickerAndPreservesDraft"))
            selectFixtureScenario("watchlist-export");
        selectDraftFileFixtureScenario();
        if (testName.getMethodName().equals("researchFollowupsSaveResearchAndCompleteAcrossSessions") ||
            testName.getMethodName().equals("dailyResearchReviewKeepsDraftAndCompletesThroughResearch") ||
            testName.getMethodName().equals("researchFollowupsReplayAndSessionRetirementFenceLateReplies"))
            selectFixtureScenario("research-followups");
        assertTrue(copiedFiles > 0 && copiedFiles <= 64 && copiedBytes <= MAX_ASSET_BYTES);

        scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App"));
            assertNull("No native authentication in this fixture", activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,
                activity.getBridge().getWebView().getSettings().getMixedContentMode());
            // Public Capacitor seam; it changes this bridge instance, not a persisted server preference.
            activity.getBridge().setServerBasePath(fixtureDirectory.getAbsolutePath());
        });
        awaitPage("managed fixture ready", "document.querySelector('#fixture-diagnostics') !== null" +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1" +
            " && document.querySelector('#managed-note-0')?.disabled === false", true);
        if (coldCompanyLink)
            awaitPage("cold company metadata admitted without research",
                DIAGNOSTICS + ".resolve === 1 && document.querySelector('#managed-annual-heading') !== null");
        assertFixtureBoundary(coldCompanyLink ? 1 : 0);
        // Preserve the selected initial URL, removing only leftover disconnected-document history.
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        if (coldCompanyLink) assertCompanyHistory("listing-zero", "annual", true);
        else assertRootHistory();
        Log.i("ManagedFixture", "source=" + expectedSourceSha + ", files=" + copiedFiles + ", bytes=" + copiedBytes);
    }

    @Test
    public void valuationPriceComparisonPreviewSaveFreshReadAndReportPreserveSources() throws Exception {
        double origin = readDocumentTimeOrigin();
        String metadata = "JSON.parse(document.querySelector('#fixture-valuation-price').textContent)";
        String valuation = "JSON.parse(document.querySelector('#fixture-valuation-draft').textContent)";
        String prefix = readFixtureString(metadata + ".prefix");
        String expected = readFixtureString(metadata + ".expectedNote");
        String model = ".managed-valuation-workbench", context = model + " .managed-valuation-price-context";
        String preview = ".managed-valuation-note-preview";
        assertTrue("The complete independent comparison note fits the unchanged cap", expected.codePointCount(0, expected.length()) <= 2000);
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", prefix);
        click(ANNUAL);
        awaitPage("initial valuation price Annual visit commits before opening the workbench",
            "(() => { const panel=document.querySelector('.managed-annual-report'), back=document.querySelector('.managed-company-visit .trial-toolbar > button'), heading=document.querySelector('#managed-annual-heading'), v=" + valuation + ";" +
            " return location.pathname==='/' && location.search==='?company=listing-zero&section=annual' && location.hash===''" +
            " && document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            " && back?.disabled===false && back.textContent==='Back to workspace'" +
            " && heading?.textContent==='Annual report' && document.activeElement===heading && panel?.getAttribute('aria-busy')==='false'" +
            " && v.editable===true && v.dirty===false && v.calculation===null && document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(prefix) + "; })()", true);
        click(model + " > summary");
        String[][] fields = {
            {"dcf-startingUnleveredCashFlowUsd", "100"}, {"dcf-enterpriseToEquityBridgeUsd", "100"},
            {"dcf-dilutedShares", "10"}, {"dcf-waccPercent", "10"}, {"dcf-terminalGrowthPercent", "0"},
            {"dcf-conservative", "0"}, {"dcf-base", "10"}, {"dcf-expansion", "20"},
            {"exit-baseRevenue", "1000"}, {"exit-cash", "100"}, {"exit-debt", "200"},
            {"exit-dilutedShares", "100"}, {"exit-discountRatePercent", "10"},
            {"exit-conservative-annualRevenueGrowthPercent", "0"}, {"exit-conservative-targetEbitdaMarginPercent", "20"}, {"exit-conservative-exitMultiple", "10"},
            {"exit-base-annualRevenueGrowthPercent", "10"}, {"exit-base-targetEbitdaMarginPercent", "20"}, {"exit-base-exitMultiple", "10"},
            {"exit-expansion-annualRevenueGrowthPercent", "20"}, {"exit-expansion-targetEbitdaMarginPercent", "20"}, {"exit-expansion-exitMultiple", "10"}
        };
        for (String[] field : fields) {
            String selector = model + " input[id$='-" + field[0] + "']";
            awaitPage("one empty associated authored comparison editor: " + field[0],
                "(() => { const inputs = document.querySelectorAll(" + JSONObject.quote(selector) + "); const input = inputs[0]; return inputs.length === 1 && input.disabled === false && input.value === '' && [...document.querySelectorAll('.managed-valuation-workbench label')].some(label => label.htmlFor === input.id); })()");
            typeIntoInput(readFixtureString("document.querySelector(" + JSONObject.quote(selector) + ").id"), field[1]);
        }
        awaitPage("authored inputs alone never calculate or request Price", valuation + ".calculation === null");
        assertPriceNoteCounts(0, 0, 1);
        click(model + " > button");
        awaitPage("explicit authored Calculate yields independent model values before Price",
            valuation + ".calculation.dcfResult.scenarios.base.valuePerShareUsd === '140.00' && " + valuation + ".calculation.exitResult.scenarios.base.valuePerShare === '19.00'");
        assertPriceNoteCounts(0, 0, 1);
        onWebView().withElement(findElement(Locator.XPATH, "//details[contains(concat(' ',normalize-space(@class),' '),' managed-valuation-workbench ')]/button[normalize-space(.)='Open Price section']")).perform(webClick());
        awaitPage("opening the existing Price section commits before its explicit load",
            "(() => { const heading=document.querySelector('#managed-eod-heading'), panel=document.querySelector('.managed-eod-history');" +
            " return location.pathname==='/' && location.search==='?company=listing-zero&section=price' && location.hash===''" +
            " && heading?.textContent==='EOD close history' && document.activeElement===heading && panel?.getAttribute('aria-busy')==='false'; })()", true);
        assertPriceNoteCounts(0, 0, 1);
        clickEodAction("Load one-month close history");
        String exact = valuationPriceRowsExact(context);
        awaitPage("all six comparisons use the last observed close, with independently pinned values and differences", exact);
        assertPriceNoteCounts(1, 0, 1);
        retainAnnualNoteFrame("valuationPriceDcfDifference", context + " tbody tr:nth-child(2) > td:last-child", context + " tbody tr:nth-child(2) > td:last-child", 1);
        click(context + " > details > summary");
        awaitPage("complete dated source inspection keeps exact source dates, listing, class, catalog and raw close",
            "(() => { const root=document.querySelector(" + JSONObject.quote(context) + "); const source=root?.querySelector(':scope > details'); const values=[...source.querySelectorAll('dd')].map(e=>e.textContent);" +
            " return source.open && values.join('|') === 'Tiingo · USD · raw close, unadjusted for splits or dividends|2026-09-19|110.000000000000000003|1m · 2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z|listing-zero · security-zero · class-zero · Class A · XNAS|sha256:'+'a'.repeat(64)+'|watchlist · Unavailable'; })()");
        click(".managed-valuation-note > summary");
        awaitPage("dated comparison inclusion is optional and starts unchecked",
            "document.querySelector('.managed-valuation-price-opt-in input')?.checked === false && document.querySelector('.managed-valuation-price-opt-in input')?.disabled === false && document.querySelector('.managed-valuation-price-opt-in')?.textContent === 'Include dated price comparison'");
        click(".managed-valuation-price-opt-in input");
        click(".managed-valuation-note > button");
        awaitPage("the opt-in whole-note preview retains the complete authored excerpt and exact dated comparison without appending",
            "document.querySelector('.managed-valuation-note-preview .trial-saved-note')?.textContent === " + JSONObject.quote(expected) +
            " && document.querySelector('.managed-valuation-note-preview > button')?.disabled === false && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(prefix));
        assertPriceNoteCounts(1, 0, 1);
        retainValuationPriceNoteFrame("valuationPriceNotePreview", expected);
        click(preview + " > button");
        awaitPage("one Append consumes the complete preview without saving",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) +
            " && document.querySelector('.managed-valuation-note-preview') === null && " + DRAFT + ".dirty === true");
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("schema5 captures all six comparisons and original graphs once with exact assumptions, source and methodology",
            "(() => { const field=document.querySelector('#managed-report-document'); if(!field?.readOnly)return false; const d=JSON.parse(field.value), c=d.valuationPrice, p=d.sources.price.response, v=d.valuation;" +
            " const base=(model)=>c.rows.find(row=>row.model===model && row.scenario==='base'); return d.schemaVersion==='5.0.0' && d.authoredResearch.note===" + JSONObject.quote(expected) +
            " && d.listing.listingId==='listing-zero' && d.listing.shareClassId==='class-zero' && d.catalogSnapshotSha256==='sha256:'+'a'.repeat(64)" +
            " && d.sources.annual.status==='not_loaded' && d.sources.filings.status==='not_loaded' && d.sources.price.status==='loaded'" +
            " && p.provider==='Tiingo' && p.currency==='USD' && p.priceBasis==='raw_close' && p.range==='1m' && p.window.startDate==='2026-08-20' && p.window.endDate==='2026-09-20'" +
            " && p.requestStartedAt==='2026-09-20T00:00:00.000Z' && p.completedAt==='2026-09-20T00:00:01.000Z'" +
            " && p.rows.map(row=>row.date+'='+row.close).join('|')==='2026-09-17=100.000000000000000001|2026-09-18=107.500000000000000002|2026-09-19=110.000000000000000003'" +
            " && c.reason===null && c.reference.sourcePath==='sources.price.response' && c.reference.rawCloseUsd==='110.000000000000000003' && c.reference.date==='2026-09-19' && c.reference.showingPrevious===false" +
            " && !('response' in c.reference) && !('calculation' in c) && !('selection' in c) && field.value.split(JSON.stringify(p)).length===2" +
            " && c.rows.length===6 && c.rows.map(row=>row.model+':'+row.scenario).join('|')==='dcf:conservative|dcf:base|dcf:expansion|exit:conservative|exit:base|exit:expansion'" +
            " && c.rows.every((row,index)=>row.result.status==='available' && row.modelValuePerShareUsd===['90.00','140.00','209.91','11.42','19.00','29.90'][index] && row.result.differencePercent===['-18.18','27.27','90.83','-89.62','-82.73','-72.82'][index])" +
            " && base('dcf').modelValuePerShareUsd==='140.00' && base('dcf').result.differencePercent==='27.27' && base('exit').modelValuePerShareUsd==='19.00' && base('exit').result.differencePercent==='-82.73'" +
            " && c.methodology.engine==='calculateAuthoredPriceComparison' && c.methodology.percentDecimalPlaces===2 && c.methodology.rounding==='round_half_up' && c.methodology.modelPath==='valuation'" +
            " && v.dcfDraft.startingUnleveredCashFlowUsd==='100' && v.exitDraft.cash==='100' && v.dcfResult.sensitivity.cells.length===25 && v.exitResult.sensitivity.cells.length===25; })()");
        String captured = ".managed-company-report .managed-valuation-price-context";
        awaitPage("passive captured report view keeps the same dated comparison without action controls", valuationPriceRowsExact(captured) + " && document.querySelectorAll(" + JSONObject.quote(captured + " button," + captured + " input," + captured + " select," + captured + " textarea") + ").length===0");
        retainValuationPriceComparisonFrame("valuationPriceCapturedComparison", captured);
        assertPriceNoteCounts(1, 0, 1);
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("Review closes research and retains the exact full comparison note without Save", "document.querySelector('.managed-company-visit')===null && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='My Watchlist'");
        assertFullNoteReading("managed-note-0", expected, true);
        clickWatchlistAction("Save watchlist");
        awaitPage("explicit whole-list Save acknowledges the complete dated comparison", DIAGNOSTICS + ".save===1 && " + DRAFT + ".baseVersion===2 && " + DRAFT + ".dirty===false");
        clickWatchlistAction("Load saved watchlist");
        awaitPage("fresh saved read preserves exact complete note and unrelated member", DIAGNOSTICS + ".load===2 && " + DRAFT + ".memberships?.[0]?.note===" + JSONObject.quote(expected) + " && " + DRAFT + ".memberships?.[1]?.note==='Invented second note'");
        assertPriceNoteCounts(1, 1, 2);
        selectWatchlistNote(0);
        click(ANNUAL);
        awaitPage("same-company return retains authored calculations without silently restoring Price",
            "(() => { const panel=document.querySelector('.managed-annual-report'), back=document.querySelector('.managed-company-visit .trial-toolbar > button'), heading=document.querySelector('#managed-annual-heading');" +
            " return location.pathname==='/' && location.search==='?company=listing-zero&section=annual' && location.hash===''" +
            " && document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            " && back?.disabled===false && back.textContent==='Back to workspace'" +
            " && heading?.textContent==='Annual report' && document.activeElement===heading && panel?.getAttribute('aria-busy')==='false'" +
            " && " + valuation + ".calculation?.dcfResult.scenarios.base.valuePerShareUsd==='140.00' && " + valuation + ".dcfDraft.waccPercent==='10' && document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(expected) + "; })()", true);
        pressBack();
        awaitPage("native Back preserves saved notes, both identities and transient inputs", "document.querySelector('.managed-company-visit')===null && " + valuation + ".context===null && " + valuation + ".dcfDraft.startingUnleveredCashFlowUsd==='100' && " + DRAFT + ".memberships?.map(m=>m.symbol).join('|')==='ZERO|ONE'");
        assertPriceNoteCounts(1, 1, 2);
        assertEquals("The complete valuation/Price workflow retains one document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private String valuationPriceRowsExact(String scope) {
        // Independent exact-rational pins: DCF sum/terminal at 10% and exit 20*((10,11,12)/11)^5-1,
        // rounded per-share to cents, then compared to raw 110.000000000000000003 at two decimals.
        return "(() => { const root=document.querySelector(" + JSONObject.quote(scope) + "); if(!root)return false; const rows=[...root.querySelectorAll('tbody tr')], base=rows[1], exit=rows[4];" +
            " return rows.length===6 && rows.map(row=>row.querySelector('th')?.textContent).join('|')==='Cash flow DCF|Cash flow DCF|Cash flow DCF|Exit multiple|Exit multiple|Exit multiple'" +
            " && rows.every((row,index)=>[...row.querySelectorAll('td')].map(e=>e.textContent).join('|')===['Conservative|90.00|-18.18%','Base|140.00|27.27%','Expansion|209.91|90.83%','Conservative|11.42|-89.62%','Base|19.00|-82.73%','Expansion|29.90|-72.82%'][index])" +
            " && [...base.querySelectorAll('td')].map(e=>e.textContent).join('|')==='Base|140.00|27.27%' && [...exit.querySelectorAll('td')].map(e=>e.textContent).join('|')==='Base|19.00|-82.73%'" +
            " && root.textContent.includes('Reference raw close: 110.000000000000000003 USD observed on 2026-09-19.') && !root.textContent.includes('observed on 2026-09-20.')" +
            " && root.textContent.includes('not current quotes') && root.textContent.includes('authored diluted share counts') && root.textContent.includes('2026-09-20T00:00:01.000Z'); })()";
    }

    private void retainValuationPriceNoteFrame(String name, String expected) throws Exception {
        String fragment = "Dated raw-close comparison: Tiingo raw USD 110.000000000000000003 on 2026-09-19; 1m window 2026-08-20 through 2026-09-20; source request 2026-09-20T00:00:00.000Z, completed 2026-09-20T00:00:01.000Z; loaded response. Displayed authored value/share 140.00; difference 27.27% = 100*(model/close-1), half-up to 2 decimals.";
        String range = "const text=document.querySelector('.managed-valuation-note-preview > .trial-saved-note');" +
            " if(text?.textContent!==" + JSONObject.quote(expected) + " || text.children.length!==0 || !text.closest('details')?.open || !text.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;" +
            " const fragment=" + JSONObject.quote(fragment) + ", start=text.textContent.indexOf(fragment), node=text.firstChild;" +
            " if(start<0 || !node || node.nodeType!==Node.TEXT_NODE || node.length<start+fragment.length)return false;" +
            " const range=document.createRange();range.setStart(node,start);range.setEnd(node,start+fragment.length);";
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { " + range + " const r=range.getBoundingClientRect(),v=visualViewport;if(!v)return false;window.scrollBy({top:r.top-v.offsetTop-24,behavior:'instant'});return true; })()",
            ignored -> scrolled.countDown()));
        assertTrue("Valuation comparison note fragment did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { " + range + " const v=visualViewport,rects=[...range.getClientRects()];return v && rects.length>0 && rects.every(r=>{" +
            " if(!(r.width>0 && r.height>0 && r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width && r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height))return false;" +
            " const dx=Math.min(2,r.width/4),dy=Math.min(2,r.height/4);return [r.left+dx,(r.left+r.right)/2,r.right-dx].every(x=>[r.top+dy,(r.top+r.bottom)/2,r.bottom-dy].every(y=>text.contains(document.elementFromPoint(x,y))));}); })()";
        awaitPage("Actual valuation note source, value and percentage fragment visible and uncovered: " + name, visible);
        retainScreenshot(name);
        awaitPage("Actual valuation note comparison fragment remains visible and uncovered: " + name, visible);
    }

    private void retainValuationPriceComparisonFrame(String name, String scope) throws Exception {
        String selector = scope + " tbody tr:nth-child(5) > td:last-child";
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector(" + JSONObject.quote(selector) + ").scrollIntoView({block:'center',inline:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Captured valuation comparison value did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const targets=[...document.querySelectorAll(" + JSONObject.quote(selector) + ")],e=targets[0],v=visualViewport;" +
            " if(targets.length!==1 || !v || e.textContent!=='-82.73%' || !e.isConnected || e.closest('[hidden],[inert]') || !e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;" +
            " const r=e.getBoundingClientRect();if(!(r.width>0 && r.height>0 && r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width && r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height))return false;" +
            " const dx=Math.min(8,r.width/4),dy=Math.min(8,r.height/4);return [r.left+dx,(r.left+r.right)/2,r.right-dx].every(x=>[r.top+dy,(r.top+r.bottom)/2,r.bottom-dy].every(y=>e.contains(document.elementFromPoint(x,y)))); })()";
        awaitPage("Actual captured exit-base comparison value visible and uncovered: " + name, visible);
        retainScreenshot(name);
        awaitPage("Actual captured exit-base comparison value remains visible and uncovered: " + name, visible);
    }

    @Test
    public void authoredValuationPreviewSaveReportAndRetirementPreserveBoundaries() throws Exception {
        double origin = readDocumentTimeOrigin();
        String valuation = "JSON.parse(document.querySelector('#fixture-valuation-draft').textContent)";
        String metadata = "JSON.parse(document.querySelector('#fixture-valuation-expected').textContent)";
        String prefix = readFixtureString(metadata + ".prefix");
        String expected = readFixtureString(metadata + ".expectedNote");
        String preview = ".managed-valuation-note-preview";
        String model = ".managed-valuation-workbench";
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", prefix);
        click(ANNUAL);
        awaitPage("authored company visit settles without any source request",
            "new URL(location.href).searchParams.get('company') === 'listing-zero' && new URL(location.href).searchParams.get('section') === 'annual'" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(prefix) +
            " && " + valuation + ".editable === true && " + valuation + ".dirty === false");
        click(model + " > summary");
        awaitPage("valuation starts with missing operands and conventional year counts only",
            "document.querySelector('.managed-valuation-workbench')?.open === true" +
            " && " + valuation + ".dcfDraft.startingUnleveredCashFlowUsd === '' && " + valuation + ".exitDraft.cash === ''" +
            " && " + valuation + ".dcfDraft.forecastYears === '5' && " + valuation + ".exitDraft.horizonYears === '5'" +
            " && " + valuation + ".calculation === null");
        String[][] fields = {
            {"dcf-startingUnleveredCashFlowUsd", "100"}, {"dcf-enterpriseToEquityBridgeUsd", "100"},
            {"dcf-dilutedShares", "10"}, {"dcf-waccPercent", "10"}, {"dcf-terminalGrowthPercent", "0"},
            {"dcf-conservative", "0"}, {"dcf-base", "10"}, {"dcf-expansion", "20"},
            {"exit-baseRevenue", "1000"}, {"exit-cash", "100"}, {"exit-debt", "200"},
            {"exit-dilutedShares", "100"}, {"exit-discountRatePercent", "10"},
            {"exit-conservative-annualRevenueGrowthPercent", "0"}, {"exit-conservative-targetEbitdaMarginPercent", "20"}, {"exit-conservative-exitMultiple", "10"},
            {"exit-base-annualRevenueGrowthPercent", "10"}, {"exit-base-targetEbitdaMarginPercent", "20"}, {"exit-base-exitMultiple", "10"},
            {"exit-expansion-annualRevenueGrowthPercent", "20"}, {"exit-expansion-targetEbitdaMarginPercent", "20"}, {"exit-expansion-exitMultiple", "10"}
        };
        for (String[] field : fields) {
            String selector = model + " input[id$='-" + field[0] + "']";
            awaitPage("one fresh associated valuation editor: " + field[0],
                "(() => { const inputs = document.querySelectorAll(" + JSONObject.quote(selector) + "); const input = inputs[0];" +
                " return inputs.length === 1 && input.disabled === false && input.value === '' && [...document.querySelectorAll('.managed-valuation-workbench label')].some(label => label.htmlFor === input.id); })()");
            String id = readFixtureString("document.querySelector(" + JSONObject.quote(selector) + ").id");
            typeIntoInput(id, field[1]);
            awaitPage("typing retains raw assumptions without running either calculation", valuation + ".calculation === null");
        }
        click(model + " > button");
        String exactResults = "(() => { const dcf = document.querySelector('.managed-valuation-workbench [aria-label=\"Cash flow DCF scenarios\"] tbody tr:nth-child(2)');" +
            " const exit = document.querySelector('.managed-valuation-workbench [aria-label=\"Exit multiple scenarios\"] tbody tr:nth-child(2)');" +
            " const v = " + valuation + "; return dcf?.querySelector('th')?.textContent === 'Base' && exit?.querySelector('th')?.textContent === 'Base'" +
            " && [...dcf.querySelectorAll('td')].map(e => e.textContent).join('|') === '10.0000|1500.00|1400.00|140.00|66.67'" +
            " && [...exit.querySelectorAll('td')].map(e => e.textContent).join('|') === '1610.510|322.102|2000.000|1900.000|19.00'" +
            " && v.calculation.dcfResult.sensitivity.cells.length === 25 && v.calculation.exitResult.sensitivity.cells.length === 25; })()";
        awaitPage("explicit Calculate shows the two exact base outcomes and full independent sensitivities", exactResults);
        awaitPage("both valuation tables keep complete scenario names on one line inside each header",
            "(() => { const headers = [...document.querySelectorAll('.managed-valuation-workbench [aria-label=\"Cash flow DCF scenarios\"] tbody th, .managed-valuation-workbench [aria-label=\"Exit multiple scenarios\"] tbody th')];" +
            " return headers.length === 6 && headers.every(header => { const range = document.createRange(); range.selectNodeContents(header);" +
            " const lines = [...range.getClientRects()], cell = header.getBoundingClientRect(); return lines.length === 1" +
            " && lines[0].left >= cell.left && lines[0].right <= cell.right; }); })()");
        retainAnnualNoteFrame("authoredValuationResults", model + " [aria-label='Cash flow DCF calculated scenarios'] > h4", model + " [aria-label='Cash flow DCF calculated scenarios'] > h4", 1);
        click(".managed-valuation-note > summary");
        click(".managed-valuation-note > button");
        awaitPage("complete note preview does not append or save",
            "document.querySelector('.managed-valuation-note-preview .trial-saved-note')?.textContent === " + JSONObject.quote(expected) +
            " && document.querySelector('.managed-valuation-note-preview > button')?.disabled === false" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(prefix) + " && " + DIAGNOSTICS + ".save === 0");
        retainAnnualNoteFrame("authoredValuationPreview", preview + " > h4", preview + " > h4", 1);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("schema two report keeps exact authored assumptions, complete results and both sensitivity grids without sources",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false; const d = JSON.parse(field.value), v = d.valuation;" +
            " return d.schemaVersion === '5.0.0' && d.authoredResearch.note === " + JSONObject.quote(prefix) +
            " && d.listing.listingId === 'listing-zero' && v.dcfDraft.startingUnleveredCashFlowUsd === '100' && v.exitDraft.cash === '100'" +
            " && v.dcfInput.forecastYears === 5 && v.exitInput.horizonYears === 5" +
            " && v.dcfResult.scenarios.base.valuePerShareUsd === '140.00' && v.exitResult.scenarios.base.valuePerShare === '19.00'" +
            " && v.dcfResult.scenarios.base.projection.length === 5 && v.dcfResult.sensitivity.cells.length === 25 && v.exitResult.sensitivity.cells.length === 25" +
            " && v.dcfResult.modelVersion === 'authored-cash-flow-dcf-v1' && v.exitResult.modelVersion === 'authored-exit-multiple-v1'" +
            " && Object.values(d.sources).every(source => source.status === 'not_loaded'); })()");
        String captured = readFixtureString("document.querySelector('#managed-report-document').value");
        click(".managed-company-report > summary");
        String wacc = readFixtureString("document.querySelector('.managed-valuation-workbench input[id$=\"-dcf-waccPercent\"]').id");
        touchInput(wacc);
        replaceFocusedInput(wacc, "10", "11");
        awaitPage("an authored input edit disables the previous note preview and removes the old report",
            "document.querySelector('.managed-valuation-note-preview > button')?.disabled === true" +
            " && document.querySelector('.managed-valuation-note-preview > h4')?.textContent === 'Previous note preview'" +
            " && document.querySelector('#managed-prepared-report-heading') === null && document.querySelector('#managed-report-document') === null" +
            " && " + valuation + ".calculation === null && " + DIAGNOSTICS + ".save === 0");
        assertEquals("Previously captured raw report bytes keep their original WACC", "10", new JSONObject(captured).getJSONObject("valuation").getJSONObject("dcfDraft").getString("waccPercent"));
        touchInput(wacc);
        replaceFocusedInput(wacc, "11", "10");
        awaitPage("restoring the input does not revive old preview", "document.querySelector('.managed-valuation-note-preview > button')?.disabled === true");
        click(model + " > button");
        awaitPage("a new explicit Calculate restores both independently calculated models", exactResults);
        click(".managed-valuation-note > button");
        awaitPage("new preview is current before append", "document.querySelector('.managed-valuation-note-preview > button')?.disabled === false");
        click(preview + " > button");
        awaitPage("append writes the exact complete note once without persistence",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(expected) + " && " + DRAFT + ".dirty === true && " + DIAGNOSTICS + ".save === 0" +
            " && document.querySelector('.managed-valuation-note-preview') === null");
        pressBack();
        awaitPage("native Back retains authored input draft and note in My Watchlist",
            "document.querySelector('.managed-company-visit') === null && " + valuation + ".context === null" +
            " && " + valuation + ".dcfDraft.startingUnleveredCashFlowUsd === '100' && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(expected));
        clickWatchlistAction("Save watchlist");
        awaitPage("one explicit full-list Save acknowledges the exact appended note", DIAGNOSTICS + ".save === 1 && " + DRAFT + ".baseVersion === 2 && " + DRAFT + ".dirty === false");
        clickWatchlistAction("Load saved watchlist");
        awaitPage("fresh saved read retains the same note and the unrelated second membership", DIAGNOSTICS + ".load === 2 && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note' && " + DRAFT + ".dirty === false");
        selectWatchlistNote(0);
        click(ANNUAL);
        awaitPage("return to the same exact company restores its transient calculation", valuation + ".editable === true && " + valuation + ".calculation?.dcfResult.scenarios.base.valuePerShareUsd === '140.00'");
        click(model + " > summary");
        awaitPage("same-company return retains both full authored models", exactResults);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("new report captures the saved note together with the retained raw valuation", "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false; const d = JSON.parse(field.value); return d.schemaVersion === '5.0.0' && d.authoredResearch.note === " + JSONObject.quote(expected) +
            " && d.valuation.dcfDraft.waccPercent === '10' && d.valuation.exitDraft.cash === '100' && d.valuation.dcfResult.sensitivity.cells.length === 25 && d.valuation.exitResult.sensitivity.cells.length === 25; })()");
        retainAnnualNoteFrame("authoredValuationReport", "#managed-prepared-report-heading", "#managed-prepared-report-heading", 1);
        click("#managed-signout-open");
        awaitPage("sign-out review names temporary valuation inputs even after note Save",
            "document.querySelector('#managed-signout-review')?.textContent.includes('Valuation inputs are temporary.')" +
            " && [...document.querySelectorAll('#managed-signout-review dt')].find(e => e.textContent === 'Valuation inputs')?.nextElementSibling?.textContent === 'Temporary inputs will be discarded.'" +
            " && document.activeElement?.id === 'managed-signout-stay' && " + DRAFT + ".dirty === false");
        // This review includes the valuation warning as its third paragraph.
        // The older sign-out fixture helper owns a different five-target review and draft.
        CountDownLatch valuationReviewScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('#managed-signout-review')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> valuationReviewScrolled.countDown()));
        assertTrue("Valuation sign-out review did not scroll into view", valuationReviewScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String valuationSignOutVisible = "(() => { const targets=Array.from(document.querySelectorAll('#managed-signout-review h2, #managed-signout-review p, #managed-signout-review button'));" +
            " const v=visualViewport, nav=document.querySelector('.managed-navigation'), navRect=nav?.getBoundingClientRect();" +
            " const overlay=nav && nav.checkVisibility() && ['fixed','sticky'].includes(getComputedStyle(nav).position);" +
            " return v && nav?.isConnected && nav.checkVisibility() && targets.length === 6 && targets.every(e=>{const r=e.getBoundingClientRect();" +
            " if (!e.isConnected || e.closest('[hidden], [inert]') || !e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})" +
            " || r.width <= 0 || r.height <= 0 || r.left < v.offsetLeft || r.right > v.offsetLeft+v.width" +
            " || r.top < v.offsetTop || r.bottom > v.offsetTop+v.height) return false;" +
            " if (overlay && r.left < navRect.right && r.right > navRect.left && r.top < navRect.bottom && r.bottom > navRect.top) return false;" +
            " const dx=Math.min(8,r.width/4), dy=Math.min(8,r.height/4);" +
            " return [r.left+dx,(r.left+r.right)/2,r.right-dx].every(x=>[r.top+dy,(r.top+r.bottom)/2,r.bottom-dy].every(y=>e.contains(document.elementFromPoint(x,y))));});})()";
        awaitPage("entire valuation sign-out explanation and both actions visible before capture", valuationSignOutVisible);
        retainScreenshot("authoredValuationSignOut");
        awaitPage("entire valuation sign-out review and focus retained through capture",
            valuationSignOutVisible + " && document.activeElement?.id === 'managed-signout-stay'");
        awaitPage("valuation capture preserves exact saved ZERO then ONE, temporary assumptions and zero pending source requests",
            "(() => { const draft = " + DRAFT + ", d = " + DIAGNOSTICS + ", v = " + valuation + ";" +
            " return draft.baseVersion === 2 && draft.dirty === false && draft.memberships?.length === 2" +
            " && draft.memberships[0].listingId === 'listing-zero' && draft.memberships[0].symbol === 'ZERO' && draft.memberships[0].note === " + JSONObject.quote(expected) +
            " && draft.memberships[1].listingId === 'listing-one' && draft.memberships[1].symbol === 'ONE' && draft.memberships[1].note === 'Invented second note'" +
            " && v.editable && v.dirty && !v.retired && v.context?.listing.listingId === 'listing-zero'" +
            " && v.calculation?.dcfResult.scenarios.base.valuePerShareUsd === '140.00' && v.calculation?.exitResult.scenarios.base.valuePerShare === '19.00'" +
            " && d.save === 1 && d.load === 2 && d.status === 1 && d.signOut === 0 && d.annual === 0 && d.eod === 0 && d.filings === 0 && d.marketsEod === 0" +
            " && d.calendar === 0 && d.fed === 0 && d.search === 0 && d.resolve === 0 && d.token === 0; })()");
        click("#managed-signout-stay");
        awaitPage("Keep editing restores fixed workspace navigation and preserves valuation and saved note",
            "document.querySelector('#managed-signout-review') === null && getComputedStyle(document.querySelector('.managed-navigation')).position === 'fixed'" +
            " && " + valuation + ".calculation !== null && " + DIAGNOSTICS + ".signOut === 0");
        click("#managed-signout-open");
        click("#managed-signout-confirm");
        awaitPage("session retirement clears every raw valuation operand and result",
            "(() => { const v = " + valuation + "; return v.retired && !v.dirty && !v.editable && v.owner === null && v.context === null && v.calculation === null" +
            " && Object.values(v.dcfDraft).filter(value => typeof value === 'string').every(value => value === '')" +
            " && Object.values(v.exitDraft).filter(value => typeof value === 'string').every(value => value === '')" +
            " && Object.values(v.dcfDraft.scenarios).every(s => s.annualCashFlowGrowthPercent === '')" +
            " && Object.values(v.exitDraft.scenarios).every(s => Object.values(s).every(value => value === ''))" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " + DIAGNOSTICS + ".signOut === 1; })()");
        awaitPage("valuation journey makes no research/provider calls, duplicate writes, tokens or document reload",
            "(() => { const d = " + DIAGNOSTICS + "; return d.save === 1 && d.load === 2 && d.status === 1 && d.annual === 0 && d.eod === 0 && d.filings === 0 && d.marketsEod === 0 && d.calendar === 0 && d.fed === 0 && d.search === 0 && d.resolve === 0 && d.token === 0; })()");
        assertEquals("authored valuation keeps the original document", origin, readDocumentTimeOrigin(), 0.0);
    }

    @Test
    public void portfolioLedgerKeepsExactFifoAndIndependentSave() throws Exception {
        double origin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Independent Portfolio research note");
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("Portfolio journey explicitly loads only the empty Follow-ups resource",
            FOLLOWUPS + ".load === 1 && " + FOLLOWUP_DRAFT + ".baseVersion === 0");
        authorFollowup("Keep the independent Follow-ups draft", "2026-10-30");
        String watchlist = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String followups = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)");
        openPortfolioView();
        awaitPage("Portfolio opens with five labelled workspace actions and no automatic resource read",
            "(() => { const buttons = [...document.querySelectorAll('nav[aria-label=Workspace] > button')];" +
            " return buttons.length === 5 && buttons.map(e => e.textContent).join('|') === 'Markets|Discover|My Watchlist|Follow-ups|Portfolio'" +
            " && buttons.every(e => e.getBoundingClientRect().height >= 44)" +
            " && " + PORTFOLIO + ".load === 0 && " + PORTFOLIO + ".save === 0 && " + PORTFOLIO_DRAFT + ".ledger === null; })()");
        click("#managed-portfolio-load");
        awaitPage("explicit Portfolio read returns version zero and no invented opening cash",
            PORTFOLIO + ".load === 1 && " + PORTFOLIO_DRAFT + ".baseVersion === 0 && " + PORTFOLIO_DRAFT + ".ledger === null" +
            " && document.querySelector('#managed-portfolio-opening-cash')?.value === '' && document.querySelector('#managed-portfolio-save')?.disabled === true");
        typeIntoInput("managed-portfolio-opening-date", "2026-10-01");
        typeIntoInput("managed-portfolio-opening-cash", "1000.00");
        click("#managed-portfolio-start");
        awaitPage("Start creates only the authored opening draft",
            PORTFOLIO_DRAFT + ".ledger?.opening?.cashUsd === '1000.00' && " + PORTFOLIO_DRAFT + ".dirty === true && " + PORTFOLIO + ".save === 0");
        typeIntoInput("managed-portfolio-search", "ZERO");
        clickPortfolioButton("Search catalog");
        awaitPage("one explicit catalog search offers the complete ZERO identity",
            DIAGNOSTICS + ".search === 1 && [...document.querySelectorAll('.managed-portfolio button')].some(e => e.textContent === 'Register ZERO' && !e.disabled)");
        clickPortfolioButton("Register ZERO");
        awaitPage("registration resolves exactly the selected identity without source reads",
            PORTFOLIO_DRAFT + ".ledger?.identities?.length === 1 && " + PORTFOLIO_DRAFT + ".ledger.identities[0].listingId === 'listing-zero' && " + DIAGNOSTICS + ".resolve === 1");
        typePortfolioField("Transaction shares", "2.000000");
        awaitPage("unapplied native input protects Portfolio and all workspace navigation",
            PORTFOLIO_DRAFT + ".pendingEditor === true && " + PORTFOLIO_DRAFT + ".ledger.transactions.length === 0" +
            " && document.querySelector('#managed-portfolio-load')?.disabled === true && document.querySelector('#managed-portfolio-review')?.disabled === true" +
            " && document.querySelector('#managed-portfolio-save')?.disabled === true && document.querySelector('#managed-portfolio-search')?.disabled === true" +
            " && [...document.querySelectorAll('nav[aria-label=Workspace] > button')].every(e => e.disabled) && " + PORTFOLIO + ".save === 0");
        clickPortfolioButton("Reset transaction form");
        awaitPage("explicit reset releases only the pending raw form",
            PORTFOLIO_DRAFT + ".pendingEditor === false && document.querySelector('[aria-label=\"Transaction shares\"]')?.value === '' && " + PORTFOLIO_DRAFT + ".ledger.transactions.length === 0");
        addPortfolioTrade("buy", "Buy", "2.000000", "200.00");
        addPortfolioTrade("sell", "Sell", "1.000000", "150.00");
        assertPortfolioFifo(0, true);
        awaitPage("both trade commands retain exact authored values and dates without a Save",
            "(() => { const t = " + PORTFOLIO_DRAFT + ".ledger.transactions; return t.length === 2" +
            " && t.map(e => [e.type,e.listingId,e.shares,e.grossUsd,e.feeUsd].join('|')).join(';') === 'buy|listing-zero|2.000000|200.00|1.00;sell|listing-zero|1.000000|150.00|1.00'" +
            " && /^\\d{4}-\\d{2}-\\d{2}$/.test(t[0].date) && t[0].date <= t[1].date && t[0].date >= '2026-10-01' && " + PORTFOLIO + ".save === 0; })()");
        retainAnnualNoteFrame("portfolioAuthoredFifo", ".managed-portfolio [aria-label='Current authored holdings']",
            ".managed-portfolio [aria-label='Current authored holdings'] > h3, .managed-portfolio [aria-label='Current authored holdings'] dl, .managed-portfolio [aria-label='Authored holdings table']", 3);
        String ledger = readFixtureString("JSON.stringify(" + PORTFOLIO_DRAFT + ".ledger)");
        clickPortfolioButton("Research ZERO");
        assertCompanyHistory("listing-zero", "price", false);
        awaitPage("Portfolio Research opens the exact company with no implicit financial requests",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && " + DIAGNOSTICS + ".resolve === 1" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0 && " + PORTFOLIO + ".save === 0");
        closeSoftKeyboard();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        awaitPage("native Back restores Portfolio opener and every independent draft",
            "document.querySelector('.managed-company-visit') === null && document.activeElement?.textContent === 'Research ZERO'" +
            " && JSON.stringify(" + PORTFOLIO_DRAFT + ".ledger) === " + JSONObject.quote(ledger) +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlist) +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(followups));
        assertReturnedRootHistory("listing-zero", "price");
        click("#managed-portfolio-review-identities");
        awaitPage("explicit identity review captures one current registry without rewriting history",
            DIAGNOSTICS + ".resolve === 2 && [...document.querySelectorAll('.managed-portfolio button')].some(e => e.textContent === 'Apply reviewed identities' && !e.disabled)");
        clickPortfolioButton("Apply reviewed identities");
        click("#managed-portfolio-review");
        awaitPage("whole-ledger review precedes the only explicit Save",
            "document.querySelector('.managed-portfolio-review') !== null && document.activeElement?.textContent === 'Review this portfolio draft'" +
            " && document.querySelector('#managed-portfolio-save')?.disabled === false && " + PORTFOLIO + ".save === 0");
        chooseNativeSelectOption("#fixture-portfolio-next-save", "lost-ack", "Commit and lose acknowledgement");
        click("#managed-portfolio-save");
        awaitPage("lost acknowledgement retains the exact draft and exposes explicit reconciliation",
            PORTFOLIO + ".save === 1 && " + PORTFOLIO + ".commits === 1 && " + PORTFOLIO_DRAFT + ".uncertain === true" +
            " && document.querySelector('#managed-portfolio-reconcile')?.disabled === false && JSON.stringify(" + PORTFOLIO_DRAFT + ".ledger) === " + JSONObject.quote(ledger));
        click("#managed-portfolio-reconcile");
        awaitPage("reconciliation replays exactly the original command without another commit",
            PORTFOLIO + ".save === 2 && " + PORTFOLIO + ".commits === 1 && " + PORTFOLIO + ".replays === 1 && " + PORTFOLIO_DRAFT + ".replayPending === true");
        click("#managed-portfolio-load");
        awaitPage("Load latest requires an explicit saved-version choice", PORTFOLIO + ".load === 2 && document.querySelector('#managed-portfolio-use-saved')?.disabled === false");
        click("#managed-portfolio-use-saved");
        assertPortfolioFifo(1, false);
        awaitPage("Portfolio save/replay never writes Watchlist or Follow-ups",
            DIAGNOSTICS + ".save === 0 && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUPS + ".commits === 0" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlist) +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(followups));
        click("#managed-signout-open");
        awaitPage("sign-out review identifies the two unsaved independent drafts",
            "document.querySelector('#managed-signout-review')?.textContent.includes('WatchlistUnsaved local changes.')" +
            " && document.querySelector('#managed-signout-review')?.textContent.includes('Follow-upsUnsaved local changes.') && " + PORTFOLIO + ".signOut === 0");
        click("#managed-signout-confirm");
        awaitPage("one sign-out retires all three draft lifetimes",
            PORTFOLIO_DRAFT + ".owner === 'retired' && " + PORTFOLIO_DRAFT + ".ledger === null && " + DRAFT + ".memberships === null && " + FOLLOWUP_DRAFT + ".entries === null" +
            " && " + PORTFOLIO + ".signOut === 1 && " + FOLLOWUPS + ".signOut === 1");
        click("#fixture-portfolio-fresh-session");
        awaitPage("fresh invented session reads neither Portfolio nor Follow-ups automatically",
            PORTFOLIO + ".session === 2 && " + PORTFOLIO + ".load === 2 && " + PORTFOLIO_DRAFT + ".ledger === null && " + FOLLOWUPS + ".load === 1" +
            " && " + DIAGNOSTICS + ".load === 2 && " + DIAGNOSTICS + ".status === 2 && " + DRAFT + ".memberships?.[0]?.note === ''");
        openPortfolioView();
        click("#managed-portfolio-load");
        awaitPage("only explicit fresh-session Load recovers the saved Portfolio", PORTFOLIO + ".load === 3");
        assertPortfolioFifo(1, false);
        assertFixtureBoundary(2, 0);
        awaitPage("final isolated counters remain exact and all financial providers remain untouched",
            PORTFOLIO + ".load === 3 && " + PORTFOLIO + ".save === 2 && " + PORTFOLIO + ".commits === 1 && " + PORTFOLIO + ".replays === 1 && " + PORTFOLIO + ".token === 0" +
            " && " + DIAGNOSTICS + ".search === 1 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0 && " + FOLLOWUPS + ".save === 0");
        assertEquals("Portfolio fresh session keeps the same native document", origin, readDocumentTimeOrigin(), 0.0);
    }

    @Test
    public void marketsDayViewKeepsSourcesSeparateAndRetiresLateResponses() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Independent calendar draft");
        openFollowupsView();
        awaitPage("day review has not automatically loaded follow-ups", FOLLOWUPS + ".load === 0 && " + FOLLOWUPS + ".save === 0");
        click("#managed-followups-load");
        awaitPage("one explicit day-review follow-up load admits version zero", FOLLOWUPS + ".load === 1 && " + FOLLOWUP_DRAFT + ".baseVersion === 0");
        String check = "Read the original schedule and publication dates";
        String id = authorFollowup(check, "2026-10-30");
        assertFollowupEntry(id, check, "2026-10-30", "", "open", null, 0, true);
        String watchlistBefore = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String followupsBefore = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ")");
        selectWorkspaceView("Markets");
        assertDayViewCounts(0, 0, 0, 0, 0, 0, 1);
        awaitPage("both day-view sources start explicitly unloaded",
            "document.querySelector('.managed-markets-day-view')?.textContent.includes('BEA schedule not loaded.')" +
            " && document.querySelector('.managed-markets-day-view')?.textContent.includes('Fed announcements not loaded.')" +
            " && document.querySelectorAll('.managed-markets-day-view [data-day-source]').length === 0");
        String originalLocation = readFixtureString("location.href");
        String originalHistoryLength = readFixtureString("String(history.length)");
        click(".managed-day-sources [aria-label='BEA source status'] a");
        awaitPage("Inspect agenda focuses its existing heading without routing",
            "document.activeElement?.id === 'bea-agenda-title' && location.href === " + JSONObject.quote(originalLocation) +
            " && String(history.length) === " + JSONObject.quote(originalHistoryLength));
        assertDayViewCounts(0, 0, 0, 0, 0, 0, 1);
        clickBeaAction("Load agenda");
        awaitPage("only the requested BEA packet is admitted", DIAGNOSTICS + ".calendar === 1 && " + DIAGNOSTICS + ".fed === 0" +
            " && document.querySelectorAll('.managed-markets-day-view [data-day-source=bea]').length === 3");
        click(".managed-day-sources [aria-label='Federal Reserve source status'] a");
        awaitPage("Inspect announcements focuses its existing heading without routing",
            "document.activeElement?.id === 'fed-announcements-title' && location.href === " + JSONObject.quote(originalLocation) +
            " && String(history.length) === " + JSONObject.quote(originalHistoryLength));
        assertDayViewCounts(1, 0, 0, 0, 0, 0, 1);
        clickFedAction("Load announcements");
        awaitPage("day view retains independent retrieval clocks and original coverage",
            "(() => { const q = document.querySelector('.managed-markets-day-view');" +
            " const bea = q?.querySelector('[aria-label=\"BEA source status\"]'), fed = q?.querySelector('[aria-label=\"Federal Reserve source status\"]');" +
            " return [...(bea?.querySelectorAll('time') ?? [])].map(t => t.dateTime).join('|') === '2026-10-20T18:00:00.000Z|2026-10-20T18:00:00.000Z|2026-11-19T18:00:00.000Z'" +
            " && fed?.querySelector('time')?.dateTime === '2026-10-30T18:00:00.000Z'" +
            " && bea.textContent.includes('3 scheduled releases in this loaded 30-day window.') && fed.textContent.includes('2 of 2 announcements from this loaded feed.')" +
            " && q.querySelectorAll('[data-day-source]').length === 5 && q.textContent.includes('Scheduled releases do not confirm publication or released values.')" +
            " && q.textContent.includes('no company relevance or alert is inferred.'); })()");
        chooseNativeSelectOption("#managed-day-date", "2026-10-29", "Thu, Oct 29, 2026 · 3");
        awaitPage("Eastern date joins schedules and the next-UTC-date publication without assigning the unknown time",
            "(() => { const q = document.querySelector('.managed-markets-day-view'), group = q?.querySelector('[aria-label=\"Thu, Oct 29, 2026\"]');" +
            " const rows = [...(group?.querySelectorAll('[data-day-source]') ?? [])], unknown = q?.querySelector('[aria-label=\"Unknown publication time\"]');" +
            " return rows.map(e => e.dataset.daySource).join('|') === 'bea|bea|fed'" +
            " && rows.map(e => e.querySelector('a')?.textContent).join('|') === 'Invented GDP|Invented Income|Invented evening monetary announcement'" +
            " && rows.map(e => e.querySelector('time')?.dateTime).join('|') === '2026-10-29T12:30:00.000Z|2026-10-29T12:30:00.000Z|2026-10-30T00:30:00.000Z'" +
            " && rows.map(e => e.querySelector('.managed-day-kind')?.textContent).join('|') === 'Scheduled · BEA|Scheduled · BEA|Published · Federal Reserve'" +
            " && rows[0].querySelector('a').href === 'https://www.bea.gov/news/schedule'" +
            " && rows[2].querySelector('a').href === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261030a.htm'" +
            " && rows[0].querySelector('time').textContent.includes('8:30:00 AM EDT') && rows[2].querySelector('time').textContent.includes('8:30:00 PM EDT')" +
            " && unknown?.querySelectorAll('[data-day-source=fed]').length === 1 && unknown.querySelector('time') === null" +
            " && unknown.querySelector('a')?.href === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && unknown.textContent.includes('Publication time unknown. This item is not assigned to a date.')" +
            " && q.textContent.includes('3 dated items shown · 1 unknown-time items shown · 5 total loaded items.'); })()");
        retainAnnualNoteFrame("marketsDayViewMixedSources", ".managed-markets-day-view section[aria-label='Thu, Oct 29, 2026']", ".managed-markets-day-view section[aria-label='Thu, Oct 29, 2026'] > h3, .managed-markets-day-view section[aria-label='Thu, Oct 29, 2026'] li", 4);
        chooseNativeSelectOption("#managed-day-source", "bea", "BEA schedule");
        awaitPage("BEA filter keeps only its two scheduled rows",
            "document.querySelectorAll('.managed-markets-day-view [data-day-source=bea]').length === 2" +
            " && document.querySelectorAll('.managed-markets-day-view [data-day-source=fed]').length === 0" +
            " && document.querySelector('#managed-day-date')?.value === '2026-10-29'");
        chooseNativeSelectOption("#managed-day-source", "fed", "Federal Reserve announcements");
        awaitPage("Fed filter keeps its dated publication and separate unknown time",
            "document.querySelectorAll('.managed-markets-day-view [data-day-source=bea]').length === 0" +
            " && document.querySelectorAll('.managed-markets-day-view [data-day-source=fed]').length === 2" +
            " && document.querySelector('.managed-markets-day-view [aria-label=\"Unknown publication time\"] time') === null" +
            " && document.querySelector('#managed-day-date')?.value === '2026-10-29'");
        chooseNativeSelectOption("#managed-day-source", "all", "Both sources");
        click("nav[aria-label='On Markets'] [data-markets-jump=day]");
        awaitPage("Day view jump focuses its owned visible heading and keeps local filters",
            "document.activeElement?.id === 'managed-markets-day-heading' && document.activeElement.checkVisibility()" +
            " && document.querySelector('#managed-day-source')?.value === 'all' && document.querySelector('#managed-day-date')?.value === '2026-10-29'" +
            " && [...document.querySelectorAll('.managed-day-filters select,.managed-day-sources a')].every(e => e.getBoundingClientRect().height >= 44)" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth" +
            " && location.href === " + JSONObject.quote(originalLocation) + " && String(history.length) === " + JSONObject.quote(originalHistoryLength));
        assertDayViewCounts(1, 1, 0, 0, 0, 0, 1);
        String packetBefore = readFixtureString(dayViewPacket());
        assertDayViewRetained(watchlistBefore, followupsBefore, packetBefore);
        clickBeaAction("Refresh agenda");
        awaitPage("BEA failure qualifies only the previous schedule",
            "document.querySelector('.managed-day-sources [aria-label=\"BEA source status\"] [role=alert]') !== null" +
            " && document.querySelector('.managed-day-sources [aria-label=\"BEA source status\"]')?.textContent.includes('Previous schedule.')" +
            " && document.querySelector('.managed-day-sources [aria-label=\"Federal Reserve source status\"] [role=alert]') === null" +
            " && !document.querySelector('.managed-day-sources [aria-label=\"Federal Reserve source status\"]').textContent.includes('Previous announcements.')");
        assertDayViewCounts(2, 1, 0, 0, 0, 0, 1);
        assertDayViewRetained(watchlistBefore, followupsBefore, packetBefore);
        clickFedAction("Refresh announcements");
        awaitPage("Fed failure retains and qualifies its separate packet",
            "document.querySelector('.managed-day-sources [aria-label=\"Federal Reserve source status\"] [role=alert]') !== null" +
            " && document.querySelector('.managed-day-sources [aria-label=\"Federal Reserve source status\"]')?.textContent.includes('Previous announcements.')");
        assertDayViewCounts(2, 2, 0, 0, 0, 0, 1);
        assertDayViewRetained(watchlistBefore, followupsBefore, packetBefore);
        clickBeaAction("Refresh agenda");
        awaitPage("third calendar read is held", DIAGNOSTICS + ".calendar === 3 && document.querySelector('.bea-release-agenda [aria-busy=true]') !== null");
        clickBeaAction("Cancel agenda");
        click("#settle-cancelled-calendar");
        assertDayViewCounts(3, 2, 1, 1, 0, 0, 1);
        assertDayViewRetained(watchlistBefore, followupsBefore, packetBefore);
        clickFedAction("Refresh announcements");
        awaitPage("third announcement read is held", DIAGNOSTICS + ".fed === 3 && document.querySelector('.fed-announcements [aria-busy=true]') !== null");
        clickFedAction("Cancel announcements");
        click("#settle-cancelled-announcements");
        assertDayViewCounts(3, 3, 1, 1, 1, 1, 1);
        assertDayViewRetained(watchlistBefore, followupsBefore, packetBefore);
        clickBeaAction("Refresh agenda");
        clickFedAction("Refresh announcements");
        awaitPage("both fourth source reads are held before expiry",
            DIAGNOSTICS + ".calendar === 4 && " + DIAGNOSTICS + ".fed === 4" +
            " && document.querySelector('.bea-release-agenda [aria-busy=true]') !== null && document.querySelector('.fed-announcements [aria-busy=true]') !== null");
        assertDayViewRetained(watchlistBefore, followupsBefore, packetBefore);
        click(CATALOG_REFRESH);
        awaitPage("session expiry clears both dirty resources and both source views",
            DIAGNOSTICS + ".status === 2 && document.querySelector('.managed-navigation') === null" +
            " && document.querySelector('.managed-markets-day-view') === null && document.querySelector('.bea-release-agenda') === null && document.querySelector('.fed-announcements') === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " + DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false" +
            " && " + FOLLOWUP_DRAFT + ".owner === 'retired' && " + FOLLOWUP_DRAFT + ".entries === null && " + FOLLOWUP_DRAFT + ".baseVersion === null && " + FOLLOWUP_DRAFT + ".dirty === false");
        click("#settle-cancelled-calendar");
        click("#settle-cancelled-announcements");
        assertDayViewCounts(4, 4, 2, 2, 2, 2, 2);
        awaitPage("both late packets leave the retired session and drafts cleared",
            "document.querySelector('.managed-navigation') === null && document.querySelector('.managed-markets-day-view') === null" +
            " && " + DRAFT + ".memberships === null && " + FOLLOWUP_DRAFT + ".entries === null" +
            " && !document.body.textContent.includes('Invented evening monetary announcement') && !document.body.textContent.includes('Independent calendar draft')");
        assertEquals("Day review preserves the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private String dayViewPacket() {
        return "(() => { const q = document.querySelector('.managed-markets-day-view'); return JSON.stringify({" +
            "date:q?.querySelector('#managed-day-date')?.value,source:q?.querySelector('#managed-day-source')?.value," +
            "clocks:[...(q?.querySelectorAll('time') ?? [])].map(e=>[e.dateTime,e.textContent])," +
            "rows:[...(q?.querySelectorAll('[data-day-source]') ?? [])].map(e=>[e.dataset.daySource,e.textContent,e.querySelector('a')?.href])}); })()";
    }

    private void assertDayViewRetained(String watchlistBefore, String followupsBefore, String packetBefore) throws Exception {
        assertEquals("Day source actions preserve the entire watchlist draft", watchlistBefore, readFixtureString("JSON.stringify(" + DRAFT + ")"));
        assertEquals("Day source actions preserve the entire independent follow-up draft", followupsBefore, readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ")"));
        assertEquals("Source clocks, raw dates, rows and filters stay exact", packetBefore, readFixtureString(dayViewPacket()));
    }

    private void assertDayViewCounts(int calendar, int fed, int calendarAborted, int calendarLate, int fedAborted, int fedLate, int status) throws Exception {
        awaitPage("day review uses only its bounded explicit source calls",
            DIAGNOSTICS + ".calendar === " + calendar + " && " + DIAGNOSTICS + ".fed === " + fed +
            " && " + DIAGNOSTICS + ".calendarAborted === " + calendarAborted + " && " + DIAGNOSTICS + ".calendarLateResolved === " + calendarLate +
            " && " + DIAGNOSTICS + ".fedAborted === " + fedAborted + " && " + DIAGNOSTICS + ".fedLateResolved === " + fedLate +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === " + status + " && " + DIAGNOSTICS + ".marketsResolve === 2" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0" +
            " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + FOLLOWUPS + ".load === 1 && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUPS + ".commits === 0");
    }

    @Test
    public void dailyResearchReviewKeepsDraftAndCompletesThroughResearch() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Independent daily review draft");
        openFollowupsView();
        awaitPage("daily review starts without an automatic follow-up read",
            FOLLOWUPS + ".load === 0 && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUP_DRAFT + ".entries === null");
        click("#managed-followups-load");
        awaitPage("explicit daily-review load admits the empty independent resource",
            FOLLOWUPS + ".load === 1 && " + FOLLOWUP_DRAFT + ".baseVersion === 0 && " + FOLLOWUP_DRAFT + ".entries?.length === 0");
        String assessedDay = readFixtureString("document.querySelector('#managed-followups-assessed-day').getAttribute('datetime')");
        assertTrue("Daily review uses the displayed captured UTC day", assessedDay.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"));
        String check = "Inspect the reported raw close for this authored check";
        String id = authorFollowup(check, assessedDay);
        assertFollowupEntry(id, check, assessedDay, "", "open", null, 0, true);
        chooseNativeSelectOption("#managed-followups-filter", "all", "All");
        String entriesBefore = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)");
        String watchlistBefore = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String dailyReview = "#managed-daily-review-" + id;
        selectWorkspaceView("Markets");
        String queue = "(() => { const q = document.querySelector('.managed-daily-research-review');" +
            " const button = document.querySelector(" + JSONObject.quote(dailyReview) + "); const row = button?.closest('li');" +
            " return q && row && row.closest('section')?.getAttribute('aria-label') === 'Due today'" +
            " && q.querySelector('time')?.getAttribute('datetime') === " + JSONObject.quote(assessedDay) +
            " && q.querySelectorAll('[id^=managed-daily-review-]').length === 1" +
            " && row.querySelector('.managed-daily-research-check')?.textContent === " + JSONObject.quote(check) +
            " && row.querySelector('.managed-daily-research-identity strong')?.textContent === 'ZERO'" +
            " && row.querySelector('.managed-daily-research-identity')?.textContent.includes('Zero Company')" +
            " && row.querySelector('.managed-listing-detail')?.textContent === 'Class A · XNAS · Common stock'" +
            " && row.querySelector('.managed-daily-research-check + p')?.textContent === " + JSONObject.quote("Due " + assessedDay) +
            " && button.textContent === 'Review check' && button.disabled === false && button.getBoundingClientRect().height >= 44" +
            " && q.querySelector('.managed-daily-research-status[role=status]')?.textContent.trim() === 'Unsaved follow-up changes. Loaded version 0.'" +
            " && " + FOLLOWUP_DRAFT + ".baseVersion === 0 && " + FOLLOWUP_DRAFT + ".saved?.version === 0 && " + FOLLOWUP_DRAFT + ".saved?.payload.entries.length === 0 && " + FOLLOWUP_DRAFT + ".dirty === true" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(entriesBefore) +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlistBefore) +
            " && " + FOLLOWUPS + ".load === 1 && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUPS + ".commits === 0" +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".marketsResolve === 2" +
            " && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0 && " + DIAGNOSTICS + ".save === 0" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
        awaitPage("Markets shows the exact due draft without financial reads or saves", queue);
        retainAnnualNoteFrame("followupsDailyReviewQueue", ".managed-daily-research-review [aria-label='Due today'] li", ".managed-daily-research-review [aria-label='Due today'] li", 1);
        awaitPage("retaining the daily queue does not alter either draft or source budget", queue);
        click(dailyReview);
        awaitPage("Review opens the same entry and focuses its editor heading",
            "document.activeElement === document.querySelector('#managed-followup-editor-heading')" +
            " && document.querySelector('#managed-followups-filter')?.value === 'open' && " + FOLLOWUP_DRAFT + ".filter === 'open'" +
            " && document.querySelector('#managed-followups-assessed-day')?.getAttribute('datetime') === " + JSONObject.quote(assessedDay) +
            " && " + FOLLOWUP_DRAFT + ".selectedId === " + JSONObject.quote(id) +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(entriesBefore) +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlistBefore) +
            " && " + FOLLOWUPS + ".load === 1 && " + FOLLOWUPS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".eod === 0");
        assertFollowupEntry(id, check, assessedDay, "", "open", null, 0, true);
        String opener = "#managed-followup-research-" + id;
        click(opener);
        awaitPage("daily check research resolves its current listing without reading a source",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-company-identity')?.textContent.includes('Zero Class A · Class A · XNAS')" +
            " && " + DIAGNOSTICS + ".resolve === 1 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && document.querySelector('#managed-research-note')?.value === 'Independent daily review draft'");
        assertCompanyHistory("listing-zero", "price", false);
        assertCompanySourceOverview(false, false, false);
        click(".managed-company-evidence-actions [aria-label='Price source'] .trial-actions button:first-child");
        awaitPage("one explicit daily-check Price load retains its source clocks and raw values",
            DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && [...document.querySelectorAll('.managed-eod-history .managed-metadata dd')].map(e => e.textContent).join('|') === '101.5|2026-09-19|2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'");
        awaitPage("daily-check Price evidence keeps its observed coverage", observedCloseRangeExact("One month", 2,
            "2026-09-18", "2026-09-19", "101.5", "2026-09-19", "100.25", "2026-09-18"));
        assertCompanySourceOverview(true, false, false);
        closeSoftKeyboard();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        awaitPage("Back restores the authored daily check, opener focus and both unsaved drafts",
            "document.querySelector('.managed-company-visit') === null && document.activeElement === document.querySelector(" + JSONObject.quote(opener) + ")" +
            " && " + FOLLOWUP_DRAFT + ".selectedId === " + JSONObject.quote(id) + " && " + FOLLOWUP_DRAFT + ".filter === 'open'" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(entriesBefore) +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlistBefore));
        assertReturnedRootHistory("listing-zero", "price");
        String result = "Observed raw close USD 101.5 on 2026-09-19; source completed 2026-09-20T00:00:01.000Z";
        typeIntoInput("managed-followup-result", result);
        assertEquals("Research does not refresh the captured daily-review day", assessedDay,
            readFixtureString("document.querySelector('#managed-followups-assessed-day').getAttribute('datetime')"));
        click("#managed-followup-complete");
        assertFollowupEntry(id, check, assessedDay, result, "completed", assessedDay, 0, true);
        click("#managed-followups-save");
        awaitPage("explicit completion save writes only the follow-up resource",
            FOLLOWUPS + ".save === 1 && " + FOLLOWUPS + ".commits === 1 && " + FOLLOWUPS + ".version === 1" +
            " && " + DIAGNOSTICS + ".save === 0 && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlistBefore));
        assertFollowupEntry(id, check, assessedDay, result, "completed", assessedDay, 1, false);
        freshFollowupSession(2, 1);
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("fresh explicit read recovers the completed daily check", FOLLOWUPS + ".load === 2 && " + FOLLOWUP_DRAFT + ".baseVersion === 1");
        chooseNativeSelectOption("#managed-followups-filter", "completed", "Completed");
        selectFollowup(id);
        assertFollowupEntry(id, check, assessedDay, result, "completed", assessedDay, 1, false);
        assertFixtureBoundary(1, 0);
        awaitPage("daily review accounts for the existing Markets catalog resolve and no implicit source read",
            DIAGNOSTICS + ".load === 2 && " + DIAGNOSTICS + ".status === 2 && " + DIAGNOSTICS + ".marketsResolve === 3" +
            " && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".search === 0" +
            " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0 && " + DIAGNOSTICS + ".save === 0" +
            " && " + FOLLOWUPS + ".session === 2 && " + FOLLOWUPS + ".load === 2 && " + FOLLOWUPS + ".save === 1 && " + FOLLOWUPS + ".commits === 1 && " + FOLLOWUPS + ".token === 0 && " + FOLLOWUPS + ".signOut === 0" +
            " && " + DRAFT + ".dirty === false && " + DRAFT + ".memberships?.[0]?.note === '' && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'");
        assertEquals("Daily review keeps the same native document across fresh invented sessions", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
    }

    @Test
    public void researchFollowupsSaveResearchAndCompleteAcrossSessions() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Independent watchlist draft");
        openFollowupsView();
        awaitPage("opening Follow-ups makes no resource or financial read",
            FOLLOWUPS + ".load === 0 && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUP_DRAFT + ".entries === null" +
            " && document.querySelector('#managed-followups-load')?.disabled === false");
        click("#managed-followups-load");
        awaitPage("explicit load admits only the empty version-zero resource",
            FOLLOWUPS + ".load === 1 && " + FOLLOWUP_DRAFT + ".baseVersion === 0 && " + FOLLOWUP_DRAFT + ".entries?.length === 0");
        String check = "Inspect the next reported raw close";
        String id = authorFollowup(check, "2026-10-30");
        assertFollowupEntry(id, check, "2026-10-30", "", "open", null, 0, true);
        click("#managed-followups-save");
        awaitPage("only the follow-up store commits while the watchlist draft remains unsaved",
            FOLLOWUPS + ".save === 1 && " + FOLLOWUPS + ".commits === 1 && " + FOLLOWUPS + ".version === 1" +
            " && " + DRAFT + ".dirty === true && " + DRAFT + ".baseVersion === 1" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Independent watchlist draft' && " + DIAGNOSTICS + ".save === 0");
        assertFollowupEntry(id, check, "2026-10-30", "", "open", null, 1, false);
        freshFollowupSession(2, 1);
        openFollowupsView();
        awaitPage("fresh session does not automatically read follow-ups",
            FOLLOWUPS + ".load === 1 && " + FOLLOWUP_DRAFT + ".entries === null && " + DRAFT + ".memberships?.[0]?.note === ''");
        click("#managed-followups-load");
        awaitPage("fresh explicit read recovers the separate saved resource", FOLLOWUPS + ".load === 2 && " + FOLLOWUP_DRAFT + ".baseVersion === 1");
        selectFollowup(id);
        assertFollowupEntry(id, check, "2026-10-30", "", "open", null, 1, false);
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Watchlist draft during follow-up research");
        openFollowupsView();
        chooseNativeSelectOption("#managed-followups-filter", "all", "All");
        typeIntoInput("managed-followup-result", "Review in progress");
        String entriesBefore = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)");
        String watchlistBefore = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String opener = "#managed-followup-research-" + id;
        click(opener);
        awaitPage("Research resolves the exact listing once without loading a source",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-company-identity')?.textContent.includes('Zero Class A · Class A · XNAS')" +
            " && " + DIAGNOSTICS + ".resolve === 1 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && document.querySelector('#managed-research-note')?.value === 'Watchlist draft during follow-up research'");
        assertCompanyHistory("listing-zero", "price", false);
        assertCompanySourceOverview(false, false, false);
        click(".managed-company-evidence-actions [aria-label='Price source'] .trial-actions button:first-child");
        awaitPage("one explicit Price load retains its exact admitted raw closes and source clock",
            DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && [...document.querySelectorAll('.managed-eod-history .managed-metadata dd')].map(e => e.textContent).join('|') === '101.5|2026-09-19|2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'");
        awaitPage("follow-up Price read preserves observed coverage", observedCloseRangeExact("One month", 2,
            "2026-09-18", "2026-09-19", "101.5", "2026-09-19", "100.25", "2026-09-18"));
        assertCompanySourceOverview(true, false, false);
        closeSoftKeyboard();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        awaitPage("native Back restores the exact row opener, filter and both unsaved drafts",
            "document.querySelector('.managed-company-visit') === null && document.activeElement === document.querySelector(" + JSONObject.quote(opener) + ")" +
            " && " + FOLLOWUP_DRAFT + ".selectedId === " + JSONObject.quote(id) + " && " + FOLLOWUP_DRAFT + ".filter === 'all'" +
            " && document.querySelector('#managed-followups-filter')?.value === 'all'" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(entriesBefore) +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlistBefore));
        assertReturnedRootHistory("listing-zero", "price");
        retainAnnualNoteFrame("followupsResearchReturn", "label[for=managed-followup-check]", "label[for=managed-followup-check]", 1);
        String result = "Observed raw close USD 101.5 on 2026-09-19; source completed 2026-09-20T00:00:01.000Z";
        touchInput("managed-followup-result");
        replaceFocusedInput("managed-followup-result", "Review in progress", result);
        String completedOn = readFixtureString("document.querySelector('#managed-followups-assessed-day').getAttribute('datetime')");
        assertTrue("Completion uses the displayed captured UTC day", completedOn.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"));
        click("#managed-followup-complete");
        assertFollowupEntry(id, check, "2026-10-30", result, "completed", completedOn, 1, true);
        click("#managed-followups-save");
        awaitPage("completion commits only the follow-up resource",
            FOLLOWUPS + ".save === 2 && " + FOLLOWUPS + ".commits === 2 && " + FOLLOWUPS + ".version === 2" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlistBefore));
        assertFollowupEntry(id, check, "2026-10-30", result, "completed", completedOn, 2, false);
        freshFollowupSession(3, 2);
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("third explicit read keeps the persisted completion and clears only local selection",
            FOLLOWUPS + ".load === 3 && " + FOLLOWUP_DRAFT + ".baseVersion === 2 && " + FOLLOWUP_DRAFT + ".selectedId === null");
        chooseNativeSelectOption("#managed-followups-filter", "completed", "Completed");
        selectFollowup(id);
        assertFollowupEntry(id, check, "2026-10-30", result, "completed", completedOn, 2, false);
        awaitPage("the saved check never saved the separate watchlist draft",
            DRAFT + ".dirty === false && " + DRAFT + ".memberships?.[0]?.note === '' && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'");
        assertFollowupBoundaries(3, 1, 1);
        assertEquals("Fresh invented sessions keep the same native document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedFollowups", "phase=three-sessions-explicit-save-research-back-completion; " + pageDiagnostic());
    }

    @Test
    public void researchFollowupsReplayAndSessionRetirementFenceLateReplies() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Independent replay watchlist draft");
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("explicit empty follow-up read precedes recovery authoring", FOLLOWUPS + ".load === 1 && " + FOLLOWUP_DRAFT + ".entries?.length === 0");
        String check = "Review the next filed source";
        String id = authorFollowup(check, "2026-11-01");
        chooseNativeSelectOption("#fixture-followups-next-save", "lost-ack", "Commit and lose acknowledgement");
        click("#managed-followups-save");
        awaitPage("lost acknowledgement preserves exact draft and blocks further authoring",
            FOLLOWUPS + ".save === 1 && " + FOLLOWUPS + ".commits === 1 && " + FOLLOWUPS + ".version === 1 && " + FOLLOWUPS + ".replays === 0" +
            " && " + FOLLOWUP_DRAFT + ".uncertain === true && document.querySelector('#managed-followup-check')?.readOnly === true" +
            " && document.querySelector('#managed-followups-save')?.disabled === true && document.querySelector('#managed-followups-reconcile')?.disabled === false");
        String uncertainEntries = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)");
        click("#managed-followups-reconcile");
        awaitPage("exact original command replay confirms one commit and still requires latest-version review",
            FOLLOWUPS + ".save === 2 && " + FOLLOWUPS + ".commits === 1 && " + FOLLOWUPS + ".replays === 1 && " + FOLLOWUPS + ".keyConflicts === 0" +
            " && " + FOLLOWUP_DRAFT + ".uncertain === false && " + FOLLOWUP_DRAFT + ".replayPending === true && " + FOLLOWUP_DRAFT + ".conflict === true" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries) === " + JSONObject.quote(uncertainEntries) +
            " && document.querySelector('#managed-followups-use-saved')?.disabled === true && document.querySelector('#managed-followups-keep-draft')?.disabled === true");
        click("#managed-followups-load");
        awaitPage("fresh latest read enables both explicit choices without a new write",
            FOLLOWUPS + ".load === 2 && " + FOLLOWUPS + ".save === 2 && " + FOLLOWUP_DRAFT + ".saved?.version === 1" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".saved.payload.entries) === " + JSONObject.quote(uncertainEntries) +
            " && document.querySelector('#managed-followups-use-saved')?.disabled === false && document.querySelector('#managed-followups-keep-draft')?.disabled === false");
        retainAnnualNoteFrame("followupsReplayReview", ".managed-followups > .managed-followups-warning", ".managed-followups > .managed-followups-warning", 1);
        click("#managed-followups-use-saved");
        assertFollowupEntry(id, check, "2026-11-01", "", "open", null, 1, false);
        awaitPage("the latest choice clears replay only and keeps the separate watchlist draft",
            FOLLOWUP_DRAFT + ".conflict === false && " + FOLLOWUP_DRAFT + ".replayPending === false" +
            " && " + DRAFT + ".dirty === true && " + DRAFT + ".memberships?.[0]?.note === 'Independent replay watchlist draft'");
        typeIntoInput("managed-followup-result", "Committed before the delayed acknowledgement");
        chooseNativeSelectOption("#fixture-followups-next-save", "hold", "Commit and hold acknowledgement");
        click("#managed-followups-save");
        awaitPage("held Save has committed exactly once and awaits only its acknowledgement",
            FOLLOWUPS + ".save === 3 && " + FOLLOWUPS + ".commits === 2 && " + FOLLOWUPS + ".version === 2 && " + FOLLOWUPS + ".held === 1" +
            " && " + FOLLOWUPS + ".settled === 0 && " + FOLLOWUP_DRAFT + ".phase === 'saving' && " + FOLLOWUP_DRAFT + ".baseVersion === 1");
        freshFollowupSession(2, 2);
        awaitPage("fresh-session disposal aborts the old wait without erasing its committed store",
            FOLLOWUPS + ".aborted === 1 && " + FOLLOWUPS + ".held === 1 && " + FOLLOWUPS + ".version === 2");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "New session watchlist draft");
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("new session explicitly reads the already committed version", FOLLOWUPS + ".load === 3 && " + FOLLOWUP_DRAFT + ".baseVersion === 2");
        selectFollowup(id);
        assertFollowupEntry(id, check, "2026-11-01", "Committed before the delayed acknowledgement", "open", null, 2, false);
        touchInput("managed-followup-check");
        replaceFocusedInput("managed-followup-check", check, "Unsaved check before session expiry");
        chooseNativeSelectOption("#fixture-followups-next-read", "retire", "Expire session");
        click("#managed-followups-load");
        awaitPage("a normal follow-up read authentication failure retires both resources and clears the product fields",
            FOLLOWUPS + ".load === 4 && " + FOLLOWUPS + ".retirements === 1 && " + FOLLOWUP_DRAFT + ".owner === 'retired'" +
            " && " + FOLLOWUP_DRAFT + ".phase === 'retired' && " + FOLLOWUP_DRAFT + ".entries === null && " + FOLLOWUP_DRAFT + ".saved === null && " + FOLLOWUP_DRAFT + ".selectedId === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && document.querySelector('#managed-followup-check') === null && document.querySelector('#managed-note-0') === null" +
            " && document.querySelector('.managed-company-visit') === null && document.querySelector('.managed-navigation') === null");
        retainAnnualNoteFrame("followupsRetired", ".managed-save-status", ".managed-save-status", 1);
        String retiredDraft = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ")");
        String retiredWatchlist = readFixtureString("JSON.stringify(" + DRAFT + ")");
        click("#fixture-followups-settle");
        awaitPage("the old session acknowledgement cannot restore either retired draft",
            FOLLOWUPS + ".settled === 1 && " + FOLLOWUPS + ".held === 0 && " + FOLLOWUPS + ".commits === 2 && " + FOLLOWUPS + ".save === 3" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ") === " + JSONObject.quote(retiredDraft) +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(retiredWatchlist) +
            " && document.querySelector('#managed-followup-check') === null && document.querySelector('#managed-note-0') === null");
        freshFollowupSession(3, 4);
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("another explicit session read confirms only the committed packet survived", FOLLOWUPS + ".load === 5 && " + FOLLOWUP_DRAFT + ".baseVersion === 2");
        selectFollowup(id);
        assertFollowupEntry(id, check, "2026-11-01", "Committed before the delayed acknowledgement", "open", null, 2, false);
        awaitPage("recovery does not repeat a commit or retain a discarded local note",
            FOLLOWUPS + ".save === 3 && " + FOLLOWUPS + ".commits === 2 && " + FOLLOWUPS + ".replays === 1 && " + FOLLOWUPS + ".conflicts === 0" +
            " && " + DRAFT + ".memberships?.[0]?.note === '' && " + DRAFT + ".dirty === false");
        assertFollowupBoundaries(3, 0, 0);
        assertEquals("Recovery preserves the native document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedFollowups", "phase=exact-replay-latest-choice-expiry-and-old-session-late-fence; " + pageDiagnostic());
    }

    private void openFollowupsView() throws Exception {
        onWebView().withElement(findElement(Locator.XPATH,
            "//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']")).perform(webClick());
        awaitPage("Follow-ups is the actual visible product view",
            "[...document.querySelectorAll('.managed-navigation button')].some(b => b.textContent === 'Follow-ups' && b.getAttribute('aria-current') === 'page')" +
            " && document.querySelector('#managed-followups-heading')?.checkVisibility() === true" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth");
    }

    private String authorFollowup(String check, String dueOn) throws Exception {
        chooseNativeSelectOption("#managed-followups-member", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        typeIntoInput("managed-followups-new-due", dueOn);
        click("#managed-followups-add");
        awaitPage("one actual watchlist member becomes a blank selected authored check",
            FOLLOWUP_DRAFT + ".entries?.length === 1 && " + FOLLOWUP_DRAFT + ".entries[0].listing.listingId === 'listing-zero'" +
            " && " + FOLLOWUP_DRAFT + ".entries[0].check === '' && " + FOLLOWUP_DRAFT + ".selectedId === " + FOLLOWUP_DRAFT + ".entries[0].id" +
            " && document.querySelector('#managed-followups-save')?.disabled === true && " + DIAGNOSTICS + ".save === 0");
        String id = readFixtureString(FOLLOWUP_DRAFT + ".selectedId");
        assertTrue("Entry is an actual generated v4 UUID", id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        typeIntoInput("managed-followup-check", check);
        return id;
    }

    private void selectFollowup(String id) throws Exception {
        assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        click("#managed-followup-select-" + id);
        awaitPage("explicit row selection opens the same saved entry", FOLLOWUP_DRAFT + ".selectedId === " + JSONObject.quote(id) +
            " && document.querySelector('#managed-followup-select-" + id + "')?.getAttribute('aria-pressed') === 'true'");
    }

    private void freshFollowupSession(int sessionNumber, int expectedFollowupReads) throws Exception {
        click("#fixture-followups-fresh-session");
        awaitPage("fresh invented session owns empty local follow-ups and the separately loaded watchlist",
            FOLLOWUPS + ".session === " + sessionNumber + " && " + FOLLOWUPS + ".load === " + expectedFollowupReads +
            " && " + FOLLOWUP_DRAFT + ".session === " + sessionNumber + " && " + FOLLOWUP_DRAFT + ".owner === 'active'" +
            " && " + FOLLOWUP_DRAFT + ".entries === null && " + FOLLOWUP_DRAFT + ".baseVersion === null && " + FOLLOWUP_DRAFT + ".filter === 'open'" +
            " && " + DIAGNOSTICS + ".load === " + sessionNumber + " && " + DIAGNOSTICS + ".status === " + sessionNumber +
            " && " + DRAFT + ".phase === 'idle' && " + DRAFT + ".dirty === false && " + DRAFT + ".memberships?.length === 2");
    }

    private void assertFollowupEntry(String id, String check, String dueOn, String result,
            String status, String completedOn, int version, boolean dirty) throws Exception {
        awaitPage("complete follow-up identity, authored fields and version are exact",
            "(() => { const d = " + FOLLOWUP_DRAFT + ", e = d.entries?.[0], l = e?.listing;" +
            " const expected = {country:'US',exchangeMic:'XNAS',instrumentType:'common_stock',issuerId:'issuer-zero',issuerName:'Zero Company',listingId:'listing-zero',securityId:'security-zero',securityName:'Zero Class A',shareClassId:'class-zero',shareClassName:'Class A',symbol:'ZERO'};" +
            " return d.owner === 'active' && d.phase === 'idle' && d.entries.length === 1 && d.baseVersion === " + version + " && d.dirty === " + dirty +
            " && e.id === " + JSONObject.quote(id) + " && d.selectedId === e.id && Object.keys(e).length === 8" +
            " && e.catalogSnapshotSha256 === 'sha256:' + 'a'.repeat(64) && Object.keys(l).length === 11 && Object.keys(expected).every(key => l[key] === expected[key])" +
            " && e.check === " + JSONObject.quote(check) + " && e.dueOn === " + JSONObject.quote(dueOn) + " && e.result === " + JSONObject.quote(result) +
            " && e.status === " + JSONObject.quote(status) + " && e.completedOn === " + (completedOn == null ? "null" : JSONObject.quote(completedOn)) +
            " && document.querySelector('#managed-followup-check')?.value === e.check && document.querySelector('#managed-followup-due')?.value === e.dueOn" +
            " && document.querySelector('#managed-followup-result')?.value === e.result && document.querySelector('#managed-followup-check')?.readOnly === false" +
            " && [...document.querySelectorAll('.managed-followups button,.managed-followups input,.managed-followups select,.managed-followups textarea')].filter(el => el.checkVisibility()).every(el => el.getBoundingClientRect().height >= 44)" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
    }

    private void assertFollowupBoundaries(int sessions, int resolves, int priceReads) throws Exception {
        assertFixtureBoundary(resolves, 0);
        awaitPage("follow-up journeys stay within their exact synthetic request budget",
            DIAGNOSTICS + ".load === " + sessions + " && " + DIAGNOSTICS + ".status === " + sessions +
            " && " + DIAGNOSTICS + ".eod === " + priceReads + " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".marketsResolve === " + sessions + " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0" +
            " && " + FOLLOWUPS + ".session === " + sessions + " && " + FOLLOWUPS + ".token === 0 && " + FOLLOWUPS + ".signOut === 0");
    }

    @Test
    public void savedWatchlistExportUsesSystemPickerAndPreservesDraft() throws Exception {
        android.content.Context testContext = InstrumentationRegistry.getInstrumentation().getContext();
        android.content.Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(appContext);
        android.content.pm.ProviderInfo provider = testContext.getPackageManager().resolveContentProvider(
            SavedWatchlistTestDocumentsProvider.AUTHORITY, 0);
        assertNotNull("The invented destination must exist only in the test package", provider);
        assertEquals(testContext.getPackageName(), provider.packageName);
        android.content.pm.ProviderInfo observer = testContext.getPackageManager().resolveContentProvider(
            SavedWatchlistTestObservationProvider.AUTHORITY, 0);
        assertNotNull(observer);
        assertEquals(testContext.getPackageName(), observer.packageName);
        android.content.pm.PackageInfo appPackage = appContext.getPackageManager().getPackageInfo(
            appContext.getPackageName(), android.content.pm.PackageManager.GET_PROVIDERS);
        if (appPackage.providers != null) for (android.content.pm.ProviderInfo item : appPackage.providers) {
            assertNotEquals("Runtime APK must not declare the invented provider", provider.authority, item.authority);
            assertNotEquals("Runtime APK must not declare the test observer", observer.authority, item.authority);
        }
        scenario.onActivity(activity -> {
            com.getcapacitor.Plugin plugin = activity.getBridge().getPlugin("InvestmentWatchlistExport").getInstance();
            assertTrue(plugin instanceof InvestmentWatchlistExportPlugin);
            assertNull("Exports must never enter saved Activity options", ((InvestmentWatchlistExportPlugin) plugin).saveInstanceState());
        });
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-watchlist-search", "ZERO");
        selectWatchlistNote(0);
        touchInput("managed-note-0");
        replaceFocusedInput("managed-note-0", "Invented saved note: café 東京 📈", "Unsaved export draft");
        closeSoftKeyboard();
        double documentTimeOrigin = readDocumentTimeOrigin();
        String expectedText = readExportFixtureText();
        assertTrue(expectedText.contains("Invented saved note: café 東京 📈"));
        assertTrue(expectedText.contains("Invented second note"));
        assertFalse(expectedText.contains("Unsaved export draft"));
        WatchlistSystemPicker picker = new WatchlistSystemPicker();
        try {
            click("#managed-watchlist-export");
            picker.cancel();
            awaitPage("cancelled export returns to the same draft", "document.querySelector('#managed-watchlist-export-status')?.textContent.includes('cancelled')");
            assertEquals(0, WatchlistTestDocuments.outputs(appContext).length);
            assertExportDraftAndReads(documentTimeOrigin);
            click("#managed-watchlist-export");
            picker.saveToInventedRoot();
            awaitPage("native writer completed", "document.querySelector('#managed-watchlist-export-status')?.textContent === 'Exported saved version 1.'");
            WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(appContext);
            assertEquals(1, outputs.length);
            assertArrayEquals(expectedText.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.read(appContext, outputs[0]));
            assertEquals("Investment-watchlist-v1.txt", outputs[0].name);
            click("#fixture-export-replay");
            awaitPage("consumed handle and duplicate chooser refused",
                "JSON.parse(document.querySelector('#fixture-export-protocol').textContent).replayRefused === 1 && " +
                "JSON.parse(document.querySelector('#fixture-export-protocol').textContent).duplicateRefused === 2");
            assertArrayEquals(expectedText.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.read(appContext, outputs[0]));
            assertExportDraftAndReads(documentTimeOrigin);
            WatchlistTestDocuments.clear(appContext);
            startInvalidExportProbe("unicode", 1);
            picker.saveToInventedRoot();
            assertInvalidExportRefused(appContext, 1);
            WatchlistTestDocuments.clear(appContext);
            startInvalidExportProbe("oversize", 2);
            picker.saveToInventedRoot();
            assertInvalidExportRefused(appContext, 2);
            assertExportDraftAndReads(documentTimeOrigin);
            WatchlistTestDocuments.clear(appContext);
            click("#fixture-export-retire");
            click("#managed-watchlist-export");
            picker.saveToInventedRoot();
            awaitPage("retired session fences late picker response", DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null");
            outputs = WatchlistTestDocuments.outputs(appContext);
            assertEquals("The picker may create an empty destination before the retired callback", 1, outputs.length);
            assertEquals("Retirement must prevent the text write", 0, outputs[0].size);
            assertFixtureBoundary();
            WatchlistTestDocuments.clear(appContext);
            click("#fixture-export-choose-only");
            picker.saveToInventedRoot();
            awaitPage("one unconsumed handle awaits recreation",
                "JSON.parse(document.querySelector('#fixture-export-choice').textContent)?.handle?.length === 36");
            JSONObject choice = new JSONObject(readFixtureString(
                "document.querySelector('#fixture-export-choice').textContent"));
            assertRecreatedExportHandleRefused(choice);
            outputs = WatchlistTestDocuments.outputs(appContext);
            assertEquals(1, outputs.length);
            assertEquals("Recreation must discard an unconsumed handle", 0, outputs[0].size);
        } finally {
            WatchlistTestDocuments.clear(appContext);
        }
    }

    @Test
    public void watchlistDraftFileUsesSystemExportImportAndExplicitRestore() throws Exception {
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(context);
        try {
            WatchlistTestDocuments.Output output = exportInventedDraftFile(context);
            double timeOrigin = readDocumentTimeOrigin();
            click("#fixture-draft-file-fresh-session");
            awaitFreshDraftFileSession();
            openDraftFileControls();
            selectInventedDraftFile(output);
            assertCompleteDraftFileComparison();
            retainDraftFileFrame("watchlistDraftFileCandidateReview", "#managed-draft-file-review-heading ~ .managed-draft-file-list");
            clickDraftFileAction("Keep current draft");
            awaitPage("cancel commits idle state before returning focus to the enabled input",
                "!document.querySelector('#managed-draft-file-review-heading') && " +
                "document.activeElement === document.querySelector('#managed-watchlist-draft-files input[type=file]') && " +
                "document.activeElement.disabled === false && " + DRAFT + ".dirty === false");
            selectInventedDraftFile(output);
            assertCompleteDraftFileComparison();
            clickDraftFileAction("Restore file to current draft");
            awaitPage("explicit restore changes only the local draft and requires a catalog review",
                DRAFT + ".dirty === true && " + DRAFT + ".baseVersion === 1 && " +
                DRAFT + ".memberships[0].note === 'Unconfirmed file draft' && " +
                "document.activeElement === document.querySelector('#managed-watchlist-heading') && " +
                "document.querySelector('#managed-save-issue')?.textContent.includes('Review imported file listings') && " +
                "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save watchlist' && b.disabled)");
            retainDraftFileFrame("watchlistDraftFileRestoredCatalogRequired", "#managed-save-issue");
            clickDraftCatalogAction("Review catalog changes");
            awaitPage("all imported listings require explicit catalog acceptance",
                "document.querySelector('#managed-review-heading')?.parentElement.textContent.includes('2 of 2 listings reviewed') && " +
                "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Apply reviewed catalog' && !b.disabled)");
            clickDraftCatalogAction("Apply reviewed catalog");
            awaitPage("catalog acceptance enables a separate Save without sending it",
                "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save watchlist' && !b.disabled) && " +
                DRAFT + ".memberships[0].note === 'Unconfirmed file draft' && " + DIAGNOSTICS + ".save === 0");
            assertDraftFileNoAutomaticSave(2, 1);
            assertEquals("Fresh session keeps the current WebView document", timeOrigin, readDocumentTimeOrigin(), 0.0);
            assertEquals(1, WatchlistTestDocuments.outputs(context).length);
        } finally {
            WatchlistTestDocuments.clear(context);
        }
    }

    @Test
    public void watchlistDraftFileRejectsAnotherAccountAndRetiresChooser() throws Exception {
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(context);
        try {
            WatchlistTestDocuments.Output output = exportInventedDraftFile(context);
            click("#fixture-draft-file-other-account");
            awaitFreshDraftFileSession();
            openDraftFileControls();
            selectInventedDraftFile(output);
            awaitPage("a different account cannot review or restore the selected file",
                "!document.querySelector('#managed-draft-file-review-heading') && " +
                "document.querySelector('#managed-watchlist-draft-files')?.textContent.includes('belongs to another account or backend') && " +
                DRAFT + ".dirty === false && " + DRAFT + ".memberships[0].note === 'Invented saved note: café 東京 📈'");
            selectWatchlistNote(0);
            touchInput("managed-note-0");
            replaceFocusedInput("managed-note-0", "Invented saved note: café 東京 📈", "Other account local draft");
            closeSoftKeyboard();
            click("#fixture-draft-file-retire");
            clickDraftFileAction("Save draft file");
            new WatchlistSystemPicker().saveToInventedRoot();
            awaitPage("retirement fences the late native chooser and clears local notes",
                DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " +
                DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false && " +
                "JSON.parse(document.querySelector('#fixture-draft-file-protocol').textContent).choices === 2 && " +
                "JSON.parse(document.querySelector('#fixture-draft-file-protocol').textContent).writes === 1 && " +
                "document.querySelector('#managed-watchlist-draft-files') === null && " +
                "document.querySelector('[data-managed-note-listing-id]') === null");
            WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
            assertEquals(2, outputs.length);
            long empty = java.util.Arrays.stream(outputs).filter(item -> item.size == 0).count();
            assertEquals("The retired chooser may create a destination but must not write text", 1L, empty);
            assertDraftFileNoAutomaticSave(2);
        } finally {
            WatchlistTestDocuments.clear(context);
        }
    }

    private WatchlistTestDocuments.Output exportInventedDraftFile(android.content.Context context) throws Exception {
        scenario.onActivity(activity -> {
            InvestmentWatchlistDraftFilePlugin plugin = (InvestmentWatchlistDraftFilePlugin)
                activity.getBridge().getPlugin("InvestmentWatchlistDraftFile").getInstance();
            assertNull("Draft files must not enter saved Activity options", plugin.saveInstanceState());
        });
        selectWorkspaceView("My Watchlist");
        selectWatchlistNote(0);
        touchInput("managed-note-0");
        replaceFocusedInput("managed-note-0", "Invented saved note: café 東京 📈", "Unconfirmed file draft");
        closeSoftKeyboard();
        openDraftFileControls();
        clickDraftFileAction("Save draft file");
        new WatchlistSystemPicker().saveToInventedRoot();
        awaitPage("the real native writer completes the unconfirmed draft file",
            "document.querySelector('#managed-watchlist-draft-files')?.textContent.includes('Draft file saved.') && " +
            "JSON.parse(document.querySelector('#fixture-draft-file-protocol').textContent).writes === 1");
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
        assertEquals(1, outputs.length);
        String text = readFixtureString("JSON.parse(document.querySelector('#fixture-draft-file-protocol').textContent).text");
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        assertTrue(bytes.length <= 266240);
        assertArrayEquals(bytes, WatchlistTestDocuments.read(context, outputs[0]));
        JSONObject file = new JSONObject(text);
        assertEquals("investment-watchlist-draft", file.getString("format"));
        assertEquals(1, file.getInt("version"));
        assertEquals(1, file.getInt("baseVersion"));
        assertEquals("Unconfirmed file draft", file.getJSONObject("draft").getJSONArray("memberships").getJSONObject(0).getString("note"));
        assertEquals("Investment-watchlist-draft-" + file.getString("capturedAt").replace(':', '-').replace('.', '-') + ".json", outputs[0].name);
        assertDraftFileNoAutomaticSave(1);
        return outputs[0];
    }

    private void awaitFreshDraftFileSession() throws Exception {
        awaitPage("fresh verified account session reads its saved Watchlist before importing",
            DIAGNOSTICS + ".load === 2 && " + DIAGNOSTICS + ".status === 2 && " +
            DRAFT + ".phase === 'idle' && " + DRAFT + ".dirty === false && " +
            DRAFT + ".memberships[0].note === 'Invented saved note: café 東京 📈'");
        selectWorkspaceView("My Watchlist");
    }

    private void openDraftFileControls() throws Exception {
        click("#managed-watchlist-draft-files > summary");
        awaitPage("draft controls become ready only after scope and saved read",
            "document.querySelector('#managed-watchlist-draft-files')?.open === true && " +
            "document.querySelector('#managed-watchlist-draft-files input[type=file]')?.disabled === false");
    }

    private void selectInventedDraftFile(WatchlistTestDocuments.Output output) throws Exception {
        touchDraftFileChooserLabel();
        new WatchlistSystemPicker().openInventedDocument(output.name);
    }

    /** A real gesture activates the file chooser again after Cancel returns DOM focus. */
    private void touchDraftFileChooserLabel() throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const input=document.querySelector('#managed-watchlist-draft-files input[type=file]'),label=input?.closest('label');" +
            " if(!input || input.disabled || !label)return null;" +
            " if(label.control!==input || !input.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return null;" +
            " const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim()==='Select a Watchlist draft file');" +
            " if(!text)return null; label.scrollIntoView({block:'center',inline:'center',behavior:'instant'});" +
            " const range=document.createRange();range.selectNodeContents(text);const r=range.getBoundingClientRect(),ir=input.getBoundingClientRect(),v=visualViewport;" +
            " const x=r.left+r.width/2,y=r.top+r.height/2;" +
            " return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:v.width,height:v.height," +
            " offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
            " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,ir.left,ir.top,ir.right,ir.bottom,ir.width,ir.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite)" +
            " &&r.width>0&&r.height>0&&ir.width>0&&ir.height>0&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
            " visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height" +
            " &&ir.left>=v.offsetLeft&&ir.top>=v.offsetTop&&ir.right<=v.offsetLeft+v.width&&ir.bottom<=v.offsetTop+v.height," +
            " hit:label.contains(document.elementFromPoint(x,y))}; })()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Draft file chooser label geometry returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        touchEditorGeometry("Watchlist draft file chooser label", observed.get());
    }

    private void assertCompleteDraftFileComparison() throws Exception {
        awaitPage("full candidate and current drafts precede every restore choice",
            "(() => { const review = document.querySelector('#managed-draft-file-review-heading')?.parentElement;" +
            " const lists = review?.querySelectorAll('.managed-draft-file-list');" +
            " return lists?.length === 2 && lists[0].children.length === 2 && lists[1].children.length === 2" +
            " && [...lists[0].querySelectorAll('.trial-saved-note')].map(e => e.textContent).join('|') === 'Unconfirmed file draft|Invented second note'" +
            " && [...lists[1].querySelectorAll('.trial-saved-note')].map(e => e.textContent).join('|') === 'Invented saved note: café 東京 📈|Invented second note'" +
            " && review.textContent.includes('File metadata does not verify')" +
            " && " + DRAFT + ".dirty === false && " + DIAGNOSTICS + ".save === 0" +
            " && document.querySelector('#managed-watchlist-draft-files input[type=file]').value === ''; })()");
    }

    private void clickDraftFileAction(String label) {
        assertTrue(label.equals("Save draft file") || label.equals("Keep current draft") || label.equals("Restore file to current draft"));
        onWebView().withElement(findElement(Locator.XPATH,
            "//details[@id='managed-watchlist-draft-files']//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void retainDraftFileFrame(String name, String selector) throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector(" + JSONObject.quote(selector) + ")?.scrollIntoView({block:'center',inline:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Draft file frame target scroll completed", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const target=document.querySelector(" + JSONObject.quote(selector) + "),v=visualViewport;" +
            " if(!target || !v || !target.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) || document.documentElement.scrollWidth>innerWidth+1)return false;" +
            " const controls=[...document.querySelectorAll('#managed-watchlist-draft-files button,#managed-watchlist-draft-files input')].filter(e=>e.getClientRects().length);" +
            " if(!controls.length || controls.some(e=>{const r=e.getBoundingClientRect();return r.width<=0 || r.left<v.offsetLeft || r.right>v.offsetLeft+v.width;}))return false;" +
            " const r=target.getBoundingClientRect();return r.width>0 && r.height>0 && r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width" +
            " && r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height && target.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)); })()";
        awaitPage("Draft file target and complete control widths are visible without horizontal overflow: " + name, visible);
        retainScreenshot(name);
        awaitPage("Draft file target remains committed after PixelCopy: " + name, visible);
    }

    private void clickDraftCatalogAction(String label) {
        assertTrue(label.equals("Review catalog changes") || label.equals("Apply reviewed catalog"));
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertDraftFileNoAutomaticSave(int sessions) throws Exception {
        assertDraftFileNoAutomaticSave(sessions, 0);
    }

    private void assertDraftFileNoAutomaticSave(int sessions, int expectedResolves) throws Exception {
        awaitPage("draft files make no saved mutation, authentication or research request",
            DIAGNOSTICS + ".load === " + sessions + " && " + DIAGNOSTICS + ".status === " + sessions +
            " && " + DIAGNOSTICS + ".marketsResolve === " + sessions +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".search === 0" +
            " && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0");
        assertFixtureBoundary(expectedResolves);
    }

    private void startInvalidExportProbe(String kind, int sequence) throws Exception {
        JSONObject before = new JSONObject(readFixtureString(
            "JSON.stringify(JSON.parse(document.querySelector('#fixture-export-protocol').textContent).invalidProbe)"));
        assertEquals(sequence - 1, before.getInt("sequence"));
        assertEquals(sequence == 1 ? "idle" : "settled", before.getString("phase"));
        assertTrue(before.isNull("failure"));
        assertFalse(before.getBoolean("cleanupFailed"));
        AtomicReference<android.webkit.WebView> page = new AtomicReference<>();
        scenario.onActivity(activity -> page.set(activity.getBridge().getWebView()));
        click("#fixture-export-" + kind);
        // Read the retained WebView on its UI thread even after DocumentsUI pauses this Activity.
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> page.get().evaluateJavascript(
            "JSON.stringify(JSON.parse(document.querySelector('#fixture-export-protocol').textContent).invalidProbe)",
            value -> { result.set(value); returned.countDown(); }));
        assertTrue("Invalid export probe start diagnostic must return", returned.await(2, TimeUnit.SECONDS));
        Object decoded = new org.json.JSONTokener(result.get()).nextValue();
        assertTrue(decoded instanceof String);
        JSONObject started = new JSONObject((String) decoded);
        Log.i("ManagedExportProbe", started.toString());
        assertEquals("The actual click must start the current probe", sequence, started.getInt("sequence"));
        assertEquals(kind, started.getString("kind"));
        assertEquals("The current probe must await the real picker: " + started, "choosing", started.getString("phase"));
        assertTrue(started.isNull("failure"));
    }

    private void assertInvalidExportRefused(android.content.Context context, int count) throws Exception {
        try {
            awaitPage("invalid native text refused and cleanup settled before the next probe",
                "(() => { const state = JSON.parse(document.querySelector('#fixture-export-protocol').textContent);" +
                " const probe = state.invalidProbe; return state.invalidRefused === " + count +
                " && probe.sequence === " + count + " && probe.kind === " + JSONObject.quote(count == 1 ? "unicode" : "oversize") +
                " && probe.phase === 'settled' && probe.failure === null && probe.cleanupFailed === false; })()");
        } catch (AssertionError failure) {
            throw new AssertionError(failure.getMessage() + "; invalidProbe=" + readFixtureString(
                "JSON.stringify(JSON.parse(document.querySelector('#fixture-export-protocol').textContent).invalidProbe)"), failure);
        }
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
        assertEquals(1, outputs.length);
        assertEquals(0, outputs[0].size);
    }

    private void assertExportDraftAndReads(double documentTimeOrigin) throws Exception {
        awaitPage("export preserves dirty filtered draft and all request counts",
            DRAFT + ".dirty === true && " + DRAFT + ".baseVersion === 1 && " +
            DRAFT + ".memberships[0].note === 'Unsaved export draft' && " + DRAFT + ".memberships.length === 2 && " +
            "document.querySelector('#managed-watchlist-search')?.value === 'ZERO' && " +
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".save === 0 && " +
            DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 0 && " +
            DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0");
        assertEquals("Same Activity picker return preserves the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private String readExportFixtureText() throws Exception {
        return readFixtureString("JSON.parse(document.querySelector('#fixture-export-document').textContent).text");
    }

    private String readFixtureString(String expression) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            expression,
            value -> { result.set(value); returned.countDown(); }));
        assertTrue("Saved export diagnostic must return", returned.await(2, TimeUnit.SECONDS));
        Object decoded = new org.json.JSONTokener(result.get()).nextValue();
        assertTrue(decoded instanceof String);
        return (String) decoded;
    }

    /** A direct native refusal probe after a real picker supplied the now-retired handle. */
    private void assertRecreatedExportHandleRefused(JSONObject choice) throws Exception {
        AtomicReference<com.getcapacitor.Plugin> previous = new AtomicReference<>();
        scenario.onActivity(activity -> {
            previous.set(activity.getBridge().getPlugin("InvestmentWatchlistExport").getInstance());
            assertNull(((InvestmentWatchlistExportPlugin) previous.get()).saveInstanceState());
        });
        scenario.recreate();
        CompletableFuture<String> result = new CompletableFuture<>();
        com.getcapacitor.JSObject options = new com.getcapacitor.JSObject()
            .put("operationId", choice.getString("operationId"))
            .put("handle", choice.getString("handle")).put("text", "Must not be written");
        com.getcapacitor.PluginCall probe = new com.getcapacitor.PluginCall(
            null, "InvestmentWatchlistExport", "invented-recreation-probe", "write", options) {
            @Override public void reject(String message, String code) { result.complete(code); }
            @Override public void resolve(com.getcapacitor.JSObject value) { result.complete("unexpected_write"); }
        };
        scenario.onActivity(activity -> {
            InvestmentWatchlistExportPlugin current = (InvestmentWatchlistExportPlugin)
                activity.getBridge().getPlugin("InvestmentWatchlistExport").getInstance();
            assertNotSame(previous.get(), current);
            assertNull(current.saveInstanceState());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            current.write(probe);
            activity.getBridge().setServerBasePath(fixtureDirectory.getAbsolutePath());
        });
        assertEquals("invalid_handle", result.get(2, TimeUnit.SECONDS));
        // Recreation can deliver JS callbacks before the new WebView can draw.
        // Require native readiness before the final committed-window capture.
        awaitPage("recreated fixture loaded without restoring export",
            "document.querySelector('#fixture-export-choice')?.textContent === 'null' && " +
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".save === 0", true);
    }

    @Test
    public void operatingComparisonNoteKeepsSeparateSourcesAndExplicitSave() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        String prefix = readFixtureString("JSON.parse(document.querySelector('#fixture-operating-comparison').textContent).prefix");
        String expectedNote = readFixtureString("JSON.parse(document.querySelector('#fixture-operating-comparison').textContent).expectedNote");
        assertEquals("Café 東京📈", prefix);
        assertEquals(1532, expectedNote.codePointCount(0, expectedNote.length()));
        assertEquals(1540, expectedNote.getBytes(StandardCharsets.UTF_8).length);
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        typeIntoInput("managed-note-1", NOTE);
        click(ANNUAL);
        replaceReportNoteWithNativeIme(NOTE, prefix);
        pressBack();
        awaitPage("native Unicode authorship returns to comparison without reading a financial source",
            "document.querySelector('.managed-company-visit') === null && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(prefix));
        assertAnnualComparisonCounts(0, 0, 0);
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-left-company']", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-right-company']", "listing-one", "ONE · One Company · Class A · XNAS");
        assertAnnualComparisonCounts(0, 0, 0);
        clickAnnualComparisonAction("Load first annual report");
        awaitPage("one explicit report leaves the second operating column unloaded",
            "(() => { const row = document.querySelector('[data-annual-comparison-operating=operatingIncome]');" +
            " return row?.querySelectorAll('td')[0]?.textContent.includes('-250.125') && row.querySelectorAll('td')[1]?.textContent === 'Not loaded'; })()");
        clickAnnualComparisonAction("Load second annual report");
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-left-basis']", "Revenues", "Revenue · revenue/net-income pair unavailable");
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-right-basis']", "SalesRevenueNet", "Net sales revenue · revenue/net-income pair unavailable");
        assertOperatingComparisonValues("1000", "-25.01%", "Revenue");
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-left-basis']", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax · revenue/net-income pair unavailable");
        assertOperatingComparisonValues("500", "-50.03%", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonCounts(2, 0, 0);
        click(".managed-annual-comparison-source:first-child details > summary");
        click(".managed-annual-comparison-source:last-child details > summary");
        assertOperatingComparisonSources();
        assertAnnualComparisonSources();
        String firstObservation = "[data-annual-comparison-operating-source='left'] > ol:first-of-type > li:first-child > details > summary";
        retainAnnualNoteFrame("annualOperatingComparisonSource", firstObservation, firstObservation, 1);
        click(".managed-annual-report-opener[aria-label='Open full Annual report for ONE (One Company; Class A; XNAS)']");
        assertComparisonReportVisit("ONE", "One Company", "0000000002-25-000001", "2025-06-30", false);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("full-report handoff retains the complete operating packet without loading net income",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field) return false; const doc = JSON.parse(field.value);" +
            " const report = doc.sources.annual.response, rows = report.evidence.facts.observations;" +
            " const expected = {SalesRevenueNet:'2025-06-30|750;2024-06-30|600',OperatingIncomeLoss:'2025-06-30|125.25',NetCashProvidedByUsedInOperatingActivities:'2025-06-30|900',PaymentsToAcquirePropertyPlantAndEquipment:'2025-06-30|300',AssetsCurrent:'2025-06-30|900',LiabilitiesCurrent:'2025-06-30|1200'};" +
            " return report.security.symbol === 'ONE' && report.schemaVersion === '6.0.0' && rows.length === 7 && !rows.some(row => row.concept === 'NetIncomeLoss')" +
            " && rows.every(row => Object.hasOwn(expected,row.concept) && row.unit === 'USD' && row.accessionNumber === '0000000002-25-000001' && /^sec-fact:[a-f0-9]{64}$/.test(row.id))" +
            " && Object.entries(expected).every(([concept, values]) => rows.filter(row => row.concept === concept).map(row => row.endDate + '|' + row.value).join(';') === values)" +
            " && doc.sources.annual.financials.operatingResults.resolution.operatingIncome.value === '125.25'" +
            " && report.evidence.generation.completedAt === '2026-09-20T00:00:02.000Z'" +
            " && doc.sources.price.status === 'not_loaded' && doc.sources.filings.status === 'not_loaded'; })()");
        pressBack();
        assertOperatingComparisonValues("500", "-50.03%", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonCounts(2, 0, 0);
        clickAnnualComparisonAction("Refresh first annual report");
        awaitPage("transient refresh failure retains the original operating packet and clocks",
            "document.querySelector('.managed-annual-comparison-choice:first-child [role=alert]') !== null" +
            " && document.querySelector('.managed-annual-comparison-choice:first-child .discovery-warning time')?.dateTime === '2026-09-20T00:00:02.000Z'");
        assertOperatingComparisonValues("500", "-50.03%", "Customer contract revenue, excluding assessed tax");
        clickAnnualComparisonAction("Refresh first annual report");
        awaitPage("operating refresh is explicitly held", DIAGNOSTICS + ".annual === 4");
        clickAnnualComparisonAction("Cancel first annual report");
        click("#settle-cancelled-annual-comparison");
        assertAnnualComparisonCounts(4, 1, 1);
        assertOperatingComparisonValues("500", "-50.03%", "Customer contract revenue, excluding assessed tax");
        assertOperatingComparisonSources();
        chooseNativeSelectOption("#managed-annual-comparison-note-group", "operating", "Operating results");
        chooseNativeSelectOption("#managed-annual-comparison-note-destination", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        clickAnnualComparisonAction("Add Annual comparison to note draft");
        assertOperatingComparisonNote(expectedNote, 1, true);
        clickAnnualComparisonAction("Add Annual comparison to note draft");
        awaitPage("duplicate operating comparison cannot append a second paragraph",
            "document.querySelector('.managed-annual-comparison-note-status')?.textContent === 'This exact Annual comparison reference is already in the note draft.'");
        assertOperatingComparisonNote(expectedNote, 1, true);
        clickAnnualComparisonAction("Review note");
        awaitPage("Review selects the full exact Unicode operating note before Save",
            "document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(expectedNote) +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.querySelector('.managed-watchlist-choice[aria-pressed=true]')?.dataset.watchlistSelection === 'listing-zero'");
        click("#managed-unsaved-review-summary");
        awaitPage("unsaved review exposes both complete original filing references",
            "document.querySelector('#managed-unsaved-review')?.open === true && document.querySelector('#managed-unsaved-review').textContent.includes(" + JSONObject.quote(expectedNote) + ")");
        assertAnnualComparisonCounts(4, 1, 1);
        clickWatchlistAction("Save watchlist");
        assertOperatingComparisonNote(expectedNote, 2, false);
        clickWatchlistAction("Load saved watchlist");
        assertOperatingComparisonNote(expectedNote, 2, false);
        assertAnnualComparisonCounts(4, 1, 1, 1, 2);
        assertOperatingComparisonValues("500", "-50.03%", "Customer contract revenue, excluding assessed tax");
        clickAnnualComparisonAction("Refresh second annual report");
        awaitPage("second operating packet is held before session expiry", DIAGNOSTICS + ".annual === 5");
        click(CATALOG_REFRESH);
        awaitPage("retirement removes both operating reports and the draft",
            DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && document.querySelector('.managed-annual-comparison') === null");
        click("#settle-cancelled-annual-comparison");
        assertAnnualComparisonCounts(5, 2, 2, 1, 2);
        awaitPage("retired late operating packet cannot restore evidence, note or controls",
            "document.querySelector('.managed-annual-comparison') === null && document.querySelector('.managed-navigation') === null" +
            " && (() => { const product = document.querySelector('.managed-frame'); return product && !product.textContent.includes('999.875') && !product.textContent.includes(" + JSONObject.quote(prefix) + "); })()" +
            " && " + DIAGNOSTICS + ".status === 2 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
        assertEquals(documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private void assertOperatingComparisonValues(String leftRevenue, String leftMargin, String leftBasis) throws Exception {
        awaitPage("operating operands retain separate fiscal periods despite unavailable net-income pairs",
            "(() => { const rows = [...document.querySelectorAll('[data-annual-comparison-operating]')];" +
            " const expected = [['operatingIncome','Operating income','Reported · USD','-250.125','125.25'], ['revenue','Operating revenue basis','Reported · USD'," + JSONObject.quote(leftRevenue) + ",'750'], ['operatingMargin','Operating margin','App calculation · %'," + JSONObject.quote(leftMargin) + ",'16.7%']];" +
            " const periods = ['2025-01-01 to 2025-12-31','2024-07-01 to 2025-06-30'];" +
            " return rows.length === 3 && rows.every((row,i) => { const cells = [...row.querySelectorAll('td')], header = row.querySelector('th');" +
            " return row.dataset.annualComparisonOperating === expected[i][0] && header.scope === 'row' && header.firstChild.textContent === expected[i][1]" +
            " && header.querySelector('small').textContent === expected[i][2] && cells.length === 2 && cells.every((cell,side) => {" +
            " const small = [...cell.querySelectorAll('small')]; return cell.querySelector('.sec-annual-liquidity-amount')?.textContent === expected[i][3+side]" +
            " && small[i === 1 ? 1 : 0]?.textContent === periods[side] && small.at(-1)?.textContent === 'Within current-use limits at this load.'; }); })" +
            " && rows[1].querySelectorAll('td')[0].querySelector('small').textContent === " + JSONObject.quote(leftBasis) +
            " && rows[1].querySelectorAll('td')[1].querySelector('small').textContent === 'Net sales revenue'" +
            " && [...document.querySelectorAll('.managed-annual-comparison select[id$=\"-basis\"]')].every(s => s.selectedOptions[0].textContent.includes('revenue/net-income pair unavailable'))" +
            " && [...document.querySelectorAll('.managed-annual-comparison-table tbody tr')][3].textContent.includes('Unavailable')" +
            " && !document.querySelector('.managed-annual-comparison').textContent.includes('999.875')" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
    }

    private void assertOperatingComparisonSources() throws Exception {
        awaitPage("complete operating observations retain each filing and original source times",
            "(() => { const sources = [...document.querySelectorAll('[data-annual-comparison-operating-source]')];" +
            " return sources.length === 2 && sources.every((source,side) => { const item = source.querySelector('ol:first-of-type > li > details');" +
            " const pairs = item ? [...item.querySelectorAll('dl > div')] : []; const field = label => pairs.find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;" +
            " const period = side === 0 ? '2025-01-01 to 2025-12-31' : '2024-07-01 to 2025-06-30'; const value = side === 0 ? '-250.125' : '125.25';" +
            " return source.dataset.annualComparisonOperatingSource === (side === 0 ? 'left' : 'right')" +
            " && source.querySelector('h4')?.textContent === 'Operating sources and calculation inputs'" +
            " && source.querySelector(':scope > p')?.textContent === 'Annual cutoff 2026-09-20T00:00:00.000Z. Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
            " && item?.querySelector('summary')?.textContent === 'OperatingIncomeLoss · ' + period + ' · ' + value + ' USD'" +
            " && field('Exact USD observation') === value && field('Accession') === (side === 0 ? '0000000001-26-000001' : '0000000002-25-000001')" +
            " && field('Company Facts source pointer') === '/facts/us-gaap/OperatingIncomeLoss/units/USD/0'" +
            " && /^sec-fact:[a-f0-9]{64}$/.test(field('Observation identifier')) && source.textContent.includes(field('Observation identifier')); }); })()");
    }

    private void assertOperatingComparisonNote(String expected, int version, boolean dirty) throws Exception {
        awaitPage("operating note preserves all Unicode prose, provenance, other note and order",
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'" +
            " && " + DRAFT + ".baseVersion === " + version + " && " + DRAFT + ".dirty === " + dirty);
    }

    @Test
    public void watchlistAnnualComparisonKeepsSeparateFilingsAndPreservesDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        awaitPage("Annual comparison starts without selections or automatic source reads",
            "(() => { const p = document.querySelector('.managed-annual-comparison');" +
            " const selects = p?.querySelectorAll('.managed-annual-comparison-choice select'); return selects?.length === 2" +
            " && [...selects].every(s => s.value === '' && !s.disabled && s.getBoundingClientRect().height >= 44)" +
            " && p.querySelectorAll('time').length === 0; })()");
        assertAnnualComparisonCounts(0, 0, 0);
        click("button[aria-label='Move ZERO down']");
        awaitPage("Annual comparison draft order changes before note editing",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-left-company']", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-right-company']", "listing-one", "ONE · One Company · Class A · XNAS");
        assertAnnualComparisonCounts(0, 0, 0);
        assertAnnualComparisonDraft();
        clickAnnualComparisonAction("Load first annual report");
        awaitPage("first explicitly loaded report exposes its own basis", "document.querySelector('.managed-annual-comparison select[id$=\"-left-basis\"]') !== null");
        clickAnnualComparisonAction("Load second annual report");
        awaitPage("second explicitly loaded report exposes its own basis", "document.querySelector('.managed-annual-comparison select[id$=\"-right-basis\"]')?.value === 'SalesRevenueNet'");
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-left-basis']", "Revenues", "Revenue");
        assertAnnualComparisonValues("1000", "10%", "25%", "Revenues", "Revenue");
        retainAnnualNoteFrame("annualComparisonBalanceSheet", "[data-annual-comparison-balance-sheet=totalAssets] td:first-of-type",
            "[data-annual-comparison-balance-sheet=totalAssets] td:first-of-type", 1);
        assertAnnualComparisonSources();
        click(".managed-annual-comparison-source:first-child details > summary");
        click(".managed-annual-comparison-source:last-child details > summary");
        awaitPage("each open disclosure keeps complete evidence and its own exact identity",
            "(() => { const panels = [...document.querySelectorAll('.managed-annual-comparison-source')];" +
            " return panels.length === 2 && panels.every(p => p.querySelector('details').open" +
            " && p.textContent.includes('Complete for the four requested USD concepts')" +
            " && p.textContent.includes('2026-09-20T00:00:00.000Z'))" +
            " && panels[0].textContent.includes('CIK 0000000001') && panels[0].textContent.includes('Accession 0000000001-26-000001')" +
            " && panels[1].textContent.includes('CIK 0000000002') && panels[1].textContent.includes('Accession 0000000002-25-000001'); })()");
        inspectAnnualComparisonCashMarginInputs();
        chooseNativeSelectOption(".managed-annual-comparison select[id$='-left-basis']", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonCounts(2, 0, 0);
        assertAnnualComparisonDraft();
        click(".managed-annual-report-opener[aria-label='Open full Annual report for ONE (One Company; Class A; XNAS)']");
        assertComparisonReportVisit("ONE", "One Company", "0000000002-25-000001", "2025-06-30", false);
        assertAnnualComparisonCounts(2, 0, 0);
        pressBack();
        awaitPage("Back returns focus to the exact second comparison opener",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.activeElement?.getAttribute('aria-label') === 'Open full Annual report for ONE (One Company; Class A; XNAS)'");
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonDraft();
        clickAnnualComparisonAction("Refresh first annual report");
        awaitPage("failed refresh retains the selected basis and original completion time",
            "document.querySelector('.managed-annual-comparison-choice:first-child [role=alert]') !== null" +
            " && document.querySelector('.managed-annual-comparison-choice:first-child .discovery-warning time')?.dateTime === '2026-09-20T00:00:02.000Z'");
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonCounts(3, 0, 0);
        clickAnnualComparisonAction("Refresh first annual report");
        awaitPage("one first-company report is pending", DIAGNOSTICS + ".annual === 4" +
            " && [...document.querySelectorAll('.managed-annual-comparison button')].some(b => b.textContent === 'Cancel first annual report')");
        clickAnnualComparisonAction("Cancel first annual report");
        assertAnnualComparisonCounts(4, 1, 0);
        click("#settle-cancelled-annual-comparison");
        assertAnnualComparisonCounts(4, 1, 1);
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonSources();
        selectWorkspaceView("Markets");
        selectWorkspaceView("My Watchlist");
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonCounts(4, 1, 1);
        assertAnnualComparisonDraft();
        assertAnnualComparisonLiquidityNote();
        chooseNativeSelectOption("#managed-annual-comparison-note-group", "cash", "Cash generation");
        chooseNativeSelectOption("#managed-annual-comparison-note-destination", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        click(".managed-annual-report-opener[aria-label='Open full Annual report for ZERO (Zero Company; Class A; XNAS)']");
        assertComparisonReportVisit("ZERO", "Zero Company", "0000000001-26-000001", "2025-12-31", true);
        assertAnnualComparisonCounts(4, 1, 1);
        pressBack();
        awaitPage("Back keeps the note group and destination with the original comparison opener",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.activeElement?.getAttribute('aria-label') === 'Open full Annual report for ZERO (Zero Company; Class A; XNAS)'" +
            " && document.querySelector('#managed-annual-comparison-note-group')?.value === 'cash'" +
            " && document.querySelector('#managed-annual-comparison-note-destination')?.value === 'listing-zero'");
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        assertAnnualComparisonDraft();
        clickAnnualComparisonAction("Add Annual comparison to note draft");
        assertAnnualComparisonNote(1, true);
        assertAnnualComparisonCounts(4, 1, 1);
        clickAnnualComparisonAction("Add Annual comparison to note draft");
        awaitPage("duplicate Annual comparison is refused without changing the exact note",
            "document.querySelector('.managed-annual-comparison-note-action').textContent.includes('This exact Annual comparison reference is already in the note draft.')");
        assertAnnualComparisonNote(1, true);
        typeIntoInput("managed-watchlist-search", "ONE");
        selectWatchlistNote(0);
        String annualReviewState = readFixtureString("JSON.stringify({draft:" + DRAFT + ",calls:" + DIAGNOSTICS + ",href:location.href})");
        awaitPage("duplicate refusal retains the exact Annual destination's Review control",
            "(() => { const b = [...document.querySelectorAll('.managed-annual-comparison-note-action > button')].find(b => b.textContent === 'Review note');" +
            " return b && b.getAttribute('aria-disabled') === 'false' && b.getBoundingClientRect().height >= 44" +
            " && document.querySelector('#managed-note-0')?.dataset.managedNoteListingId === 'listing-one'; })()");
        clickAnnualComparisonAction("Review note");
        assertComparisonNoteReader("managed-note-1", "listing-zero", "ZERO", ANNUAL_COMPARISON_NOTE, "ONE");
        assertEquals("Annual Review preserves the complete draft, counters and URL", annualReviewState,
            readFixtureString("JSON.stringify({draft:" + DRAFT + ",calls:" + DIAGNOSTICS + ",href:location.href})"));
        assertAnnualComparisonCounts(4, 1, 1);
        click("button[aria-label='Clear watchlist search']");
        selectWatchlistNote(1);
        assertAnnualComparisonNote(1, true);
        click("#managed-unsaved-review-summary");
        awaitPage("review exposes the complete comparison note before Save",
            "document.querySelector('#managed-unsaved-review')?.open === true" +
            " && document.querySelector('#managed-unsaved-review').textContent.includes(" + JSONObject.quote(ANNUAL_COMPARISON_NOTE) + ")");
        clickWatchlistAction("Save watchlist");
        assertAnnualComparisonNote(2, false);
        clickWatchlistAction("Load saved watchlist");
        assertAnnualComparisonNote(2, false);
        assertAnnualComparisonCounts(4, 1, 1, 1, 2);
        assertAnnualComparisonValues("500", "20%", "100%", "RevenueFromContractWithCustomerExcludingAssessedTax", "Customer contract revenue, excluding assessed tax");
        clickAnnualComparisonAction("Refresh second annual report");
        awaitPage("second-company report is pending before retirement", DIAGNOSTICS + ".annual === 5" +
            " && [...document.querySelectorAll('.managed-annual-comparison button')].some(b => b.textContent === 'Cancel second annual report')");
        click(CATALOG_REFRESH);
        awaitPage("session expiry removes both reports and the full unsaved draft",
            DIAGNOSTICS + ".status === 2 && document.querySelector('.managed-navigation') === null" +
            " && document.querySelector('.managed-annual-comparison') === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && " + DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false");
        click("#settle-cancelled-annual-comparison");
        assertAnnualComparisonCounts(5, 2, 2, 1, 2);
        awaitPage("late Annual completion cannot restore retired evidence or notes",
            "document.querySelector('.managed-annual-comparison') === null && document.querySelector('.managed-navigation') === null" +
            " && !document.body.textContent.includes('0000000002-25-000001')" +
            " && !document.body.textContent.includes(" + JSONObject.quote(NOTE) + ")");
        assertEquals("Annual comparison preserves the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private void clickAnnualComparisonAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(@class,'managed-annual-comparison')]//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertComparisonReportVisit(String symbol, String issuer, String accession, String periodEnd, boolean previous) throws Exception {
        awaitPage("full Annual visit reuses the selected company's original checked evidence",
            "(() => { const panel = document.querySelector('.managed-annual-report'); const text = panel?.textContent ?? '';" +
            " return document.querySelector('#managed-company-heading')?.textContent === 'Company research · ' + " + JSONObject.quote(symbol) +
            " && location.search === " + JSONObject.quote("?company=listing-" + symbol.toLowerCase(java.util.Locale.ROOT) + "&section=annual") +
            " && document.querySelector('.managed-company-visit .trial-toolbar > button')?.disabled === false" +
            " && document.activeElement === document.querySelector('#managed-annual-heading')" +
            " && document.querySelector('.managed-company-identity strong')?.textContent === " + JSONObject.quote(issuer) +
            " && panel?.getAttribute('aria-busy') === 'false'" +
            " && text.includes('The loaded watchlist comparison report is available in this company visit.')" +
            " && panel.querySelector('.managed-annual-origin')?.textContent === 'Showing the report loaded in the watchlist comparison. Original source and observation times are unchanged.'" +
            " && text.includes(" + JSONObject.quote(accession) + ") && text.includes(" + JSONObject.quote(periodEnd) + ")" +
            " && text.includes('2026-09-20T00:00:00.000Z')" +
            " && text.includes('Showing the previous report, completed 2026-09-20T00:00:02.000Z') === " + previous +
            " && [...panel.querySelectorAll('button')].some(b => b.textContent === 'Refresh annual report' && !b.disabled); })()", true);
    }

    private void assertAnnualComparisonValues(String revenue, String margin, String change, String rawBasis, String basisLabel) throws Exception {
        awaitPage("exact Annual values retain distinct fiscal periods and bases",
            "(() => { const rows = document.querySelectorAll('.managed-annual-comparison-table tbody tr');" +
            " const cells = i => [...rows[i].querySelectorAll('td')]; return rows.length === 22" +
            " && [...cells(0)[0].querySelectorAll('time')].map(t => t.dateTime).join('|') === '2025-01-01|2025-12-31'" +
            " && [...cells(0)[1].querySelectorAll('time')].map(t => t.dateTime).join('|') === '2024-07-01|2025-06-30'" +
            " && cells(1)[0].textContent === " + JSONObject.quote(basisLabel) +
            " && cells(1)[1].textContent === 'Net sales revenue'" +
            " && document.querySelector('.managed-annual-comparison select[id$=\"-left-basis\"]')?.value === " + JSONObject.quote(rawBasis) +
            " && document.querySelector('.managed-annual-comparison select[id$=\"-right-basis\"]')?.value === 'SalesRevenueNet'" +
            " && document.querySelector('[data-annual-comparison-selected-basis=left]')?.textContent === 'Selected basis: ' + " + JSONObject.quote(basisLabel) +
            " && document.querySelector('[data-annual-comparison-selected-basis=right]')?.textContent === 'Selected basis: Net sales revenue'" +
            " && ['left', 'right'].every(side => { const select = document.querySelector('.managed-annual-comparison select[id$=\"-' + side + '-basis\"]');" +
            " const full = document.querySelector('[data-annual-comparison-selected-basis=' + side + ']');" +
            " return full?.id && select?.getAttribute('aria-describedby')?.split(' ').includes(full.id); })" +
            " && cells(2)[0].textContent === " + JSONObject.quote(revenue) + " && cells(2)[1].textContent === '750'" +
            " && cells(3)[0].textContent === '100' && cells(3)[1].textContent === '150'" +
            " && cells(4)[0].textContent === " + JSONObject.quote(margin) + " && cells(4)[1].textContent === '20%'" +
            " && cells(5)[0].firstChild.textContent === " + JSONObject.quote(change) + " && cells(5)[1].firstChild.textContent === '25%'" +
            " && cells(5)[0].textContent.includes('2024-01-01 to 2024-12-31')" +
            " && cells(5)[1].textContent.includes('2023-07-01 to 2024-06-30'); })()");
        assertAnnualComparisonCash();
        assertAnnualComparisonCashMargins();
        assertAnnualComparisonLiquidity();
        assertAnnualComparisonBalanceSheet();
        assertAnnualComparisonBalanceSheetSources();
    }

    private void assertAnnualComparisonCashMargins() throws Exception {
        String[][] expectations = {
            {"three fixed cash margin bases retain each side's revenue, percentage, period and refusal independently of income selection",
            "(() => { const rows = [...document.querySelectorAll('[data-annual-comparison-cash-margin]')];" +
            " const concepts = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'];" +
            " const labels = ['Customer contract revenue, excluding assessed tax', 'Revenue', 'Net sales revenue'];" +
            " const revenue = [['500', null], ['1000', null], [null, '750']], ratios = [['150.00%', null], ['75.00%', null], [null, '80.00%']];" +
            " const periods = ['2025-01-01 to 2025-12-31', '2024-07-01 to 2025-06-30'];" +
            " const missing = \"No observation covers the selected annual filing's period.\";" +
            " return rows.length === 3 && rows.every((row, index) => { const header = row.querySelector('th'), cells = [...row.querySelectorAll('td')];" +
            " return row.dataset.annualComparisonCashMargin === concepts[index] && header?.scope === 'row'" +
            " && header.firstChild.textContent === 'Cash generation relative to revenue'" +
            " && [...header.querySelectorAll('small')].map(e => e.textContent).join('|') === labels[index] + '|' + concepts[index]" +
            " && cells.length === 2 && cells.every((cell, side) => { const values = [...cell.querySelectorAll(':scope > p')];" +
            " return values.length === 2 && values[0].querySelector(':scope > small')?.textContent === 'Reported revenue · USD'" +
            " && values[1].querySelector(':scope > small')?.textContent === 'Operating cash flow less PP&E purchases / reported revenue (%) · App calculation'" +
            " && values.every((value, valueIndex) => { const expected = valueIndex === 0 ? revenue[index][side] : ratios[index][side];" +
            " if (expected === null) return value.querySelector(':scope > span')?.textContent === 'Unavailable. ' + (valueIndex === 0 ? '' : 'Reported revenue: ') + missing" +
            " && value.querySelectorAll(':scope > small').length === 1 && !value.querySelector('.sec-annual-liquidity-amount');" +
            " return value.querySelector('.sec-annual-liquidity-amount')?.textContent === expected" +
            " && [...value.querySelectorAll(':scope > small')].map(e => e.textContent).slice(1).join('|') === periods[side] + '|Within current-use limits at this load.'; }); }); }); })()"},
            {"cash margin inputs keep all original side-specific operand IDs, complete coordinates and source clocks outside the old raw-cash block",
            "(() => { const sources = [...document.querySelectorAll('[data-annual-comparison-cash-margin-source]')];" +
            " const concepts = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'];" +
            " const labels = ['Customer contract revenue, excluding assessed tax', 'Revenue', 'Net sales revenue'];" +
            " const field = (row, label) => [...row.querySelectorAll(':scope > dl > div')].find(pair => pair.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;" +
            " const coordinates = row => [...row.querySelectorAll(':scope > dl > div > dd')].map(e => e.textContent);" +
            " return sources.length === 2 && sources.every((source, side) => { const company = source.closest('.managed-annual-comparison-source');" +
            " const rawCash = company.querySelector('[data-annual-comparison-cash-source]');" +
            " const cashRows = [...rawCash.querySelectorAll(':scope > section > ol > li > details')];" +
            " const revenueRows = [...company.querySelectorAll(':scope > details > .sec-filing-context > details > ol > li > details')];" +
            " const inputs = [...source.querySelectorAll(':scope > details')];" +
            " const date = side === 0 ? '2025-12-31' : '2025-06-30', filed = side === 0 ? '2026-02-01' : '2025-08-01';" +
            " const accession = side === 0 ? '0000000001-26-000001' : '0000000002-25-000001';" +
            " return source.dataset.annualComparisonCashMarginSource === (side === 0 ? 'left' : 'right')" +
            " && source.previousElementSibling === rawCash && source.parentElement === company.querySelector(':scope > details')" +
            " && source.querySelector(':scope > h4')?.textContent === 'Cash generation relative to revenue inputs'" +
            " && cashRows.length === 2 && inputs.length === 3 && inputs.every((input, index) => {" +
            " const hasRevenue = side === 0 ? index < 2 : index === 2;" +
            " const revenue = revenueRows.find(row => field(row, 'Company Facts source pointer') === '/facts/us-gaap/' + concepts[index] + '/units/USD/0');" +
            " const originals = hasRevenue ? [...cashRows, revenue] : cashRows; if (originals.some(row => !row)) return false;" +
            " const ids = originals.map(row => field(row, 'Observation identifier'));" +
            " const groups = [...input.querySelectorAll(':scope > section')], rows = [...input.querySelectorAll(':scope > section > ol > li > details')];" +
            " return input.classList.contains('sec-annual-cash-margin-inputs') && input.querySelector(':scope > summary')?.textContent === 'Cash margin inputs · ' + labels[index]" +
            " && input.querySelector(':scope > p:first-of-type')?.textContent === 'Cutoff 2026-09-20T00:00:00.000Z. Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
            " && input.querySelector(':scope > p:nth-of-type(2)')?.textContent === 'Selected filing ' + accession + '; report date ' + date + '; filed ' + filed + '.'" +
            " && ids.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id)) && new Set(ids).size === ids.length" +
            " && groups.length === 3 && groups.map(group => group.querySelectorAll(':scope > ol > li').length).join('|') === (hasRevenue ? '1|1|1' : '1|1|0')" +
            " && groups.map((group, operand) => group.querySelector(':scope > p')?.textContent).join('|') === 'Operating cash flow references: ' + ids[0] + '|PP&E purchases references: ' + ids[1] + '|' + concepts[index] + ' references: ' + (hasRevenue ? ids[2] : 'None')" +
            " && rows.length === originals.length && rows.every((row, operand) => coordinates(row).length === 10 && JSON.stringify(coordinates(row)) === JSON.stringify(coordinates(originals[operand])))" +
            " && input.querySelector(':scope > p:last-of-type')?.textContent === 'Calculation references: ' + ids.join(' · '); }); }); })()"}
        };
        for (String[] expectation : expectations) {
            awaitPage(expectation[0], expectation[1]);
        }
    }

    private void inspectAnnualComparisonCashMarginInputs() throws Exception {
        String summary = "[data-annual-comparison-cash-margin-source=left] > details:nth-of-type(2) > summary";
        String before = readFixtureString("JSON.stringify({draft:" + DRAFT + ",calls:" + DIAGNOSTICS + ",href:location.href,length:history.length})");
        awaitPage("new comparison input disclosures start closed inside the open original company sources",
            "document.querySelectorAll('[data-annual-comparison-cash-margin-source] > details').length === 6" +
            " && [...document.querySelectorAll('[data-annual-comparison-cash-margin-source] > details')].every(e => !e.open && e.parentElement.parentElement.open)");
        focusCashHistoryControl(summary);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native Space opens one exact 44px cash-margin input summary with visible focus",
            "(() => { const summary = document.querySelector(" + JSONObject.quote(summary) + ");" +
            " return summary?.parentElement.open && document.activeElement === summary && summary.getBoundingClientRect().height >= 44" +
            " && getComputedStyle(summary).outlineStyle !== 'none' && parseFloat(getComputedStyle(summary).outlineWidth) >= 2" +
            " && document.querySelectorAll('[data-annual-comparison-cash-margin-source] > details[open]').length === 1; })()");
        assertAnnualComparisonCashMargins();
        focusCashHistoryControl(summary);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native Space closes cash-margin inputs while preserving the exact focused summary",
            "document.activeElement === document.querySelector(" + JSONObject.quote(summary) + ")" +
            " && [...document.querySelectorAll('[data-annual-comparison-cash-margin-source] > details')].every(e => !e.open)");
        assertEquals("Inspecting cash-margin inputs preserves both source counts, the complete draft and navigation", before,
            readFixtureString("JSON.stringify({draft:" + DRAFT + ",calls:" + DIAGNOSTICS + ",href:location.href,length:history.length})"));
    }


    private void assertAnnualComparisonCash() throws Exception {
        awaitPage("cash values keep each company's exact period and remain independent of the revenue basis",
            "(() => { const rows = [...document.querySelectorAll('[data-annual-comparison-cash]')];" +
            " const keys = ['operatingCashFlow', 'ppePurchases', 'operatingCashFlowLessPpePurchases'];" +
            " const labels = ['Operating cash flow', 'PP&E purchases', 'Operating cash flow less PP&E purchases'];" +
            " const expected = [['1000', '900'], ['250', '300'], ['750', '600']];" +
            " const periods = ['2025-01-01 to 2025-12-31', '2024-07-01 to 2025-06-30'];" +
            " return rows.length === 3 && rows.every((row, i) => { const header = row.querySelector('th');" +
            " const cells = [...row.querySelectorAll('td')]; return row.dataset.annualComparisonCash === keys[i]" +
            " && header?.scope === 'row' && header.firstChild.textContent === labels[i]" +
            " && header.querySelector('small')?.textContent === (i === 2 ? 'App calculation' : 'Reported') + ' · USD'" +
            " && cells.length === 2 && cells.every((cell, side) => cell.querySelector('.sec-annual-cash-amount')?.textContent === expected[i][side]" +
            " && cell.querySelectorAll('small')[0]?.textContent === periods[side]" +
            " && cell.querySelectorAll('small')[1]?.textContent === 'Within current-use limits at this load.'" +
            " && !cell.querySelector('.sec-annual-cash-unavailable')); })" +
            " && document.querySelector('.managed-annual-comparison-table tbody th')?.textContent === 'Revenue / net income period'" +
            " && document.querySelector('.managed-annual-comparison').textContent.includes('It does not adjust for leases, acquisitions or other investing cash flows.'); })()");
    }

    private void assertAnnualComparisonSources() throws Exception {
        awaitPage("original source dates and separate filing URLs remain unchanged",
            "(() => { const sources = [...document.querySelectorAll('.managed-annual-comparison-source')];" +
            " return sources.length === 2 && sources.every(s => s.querySelector('time')?.dateTime === '2026-09-20T00:00:02.000Z')" +
            " && sources[0].querySelector(':scope > a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm'" +
            " && sources[1].querySelector(':scope > a')?.href === 'https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm'" +
            " && sources.every(s => s.querySelector(':scope > a')?.target === '_blank' && s.querySelector(':scope > a')?.rel === 'noopener noreferrer')" +
            " && sources[0].textContent.includes('filed 2026-02-01') && sources[1].textContent.includes('filed 2025-08-01')" +
            " && sources.every((source, i) => { const side = i === 0 ? 'left' : 'right';" +
            " const raw = document.querySelector('.managed-annual-comparison select[id$=\"-' + side + '-basis\"]')?.value;" +
            " return source.querySelector('[data-annual-comparison-source-basis=' + side + ']')?.textContent === 'Selected SEC revenue concept: ' + raw; })" +
            " && sources.every((source, side) => { const cash = source.querySelector('[data-annual-comparison-cash-source]');" +
            " const inputs = cash?.querySelectorAll('section');" +
            " const concepts = ['NetCashProvidedByUsedInOperatingActivities', 'PaymentsToAcquirePropertyPlantAndEquipment'];" +
            " const values = side === 0 ? ['1000', '250'] : ['900', '300'];" +
            " const period = side === 0 ? '2025-01-01 to 2025-12-31' : '2024-07-01 to 2025-06-30';" +
            " const accession = side === 0 ? '0000000001-26-000001' : '0000000002-25-000001';" +
            " const ids = []; return cash?.closest('details') === source.querySelector('details')" +
            " && cash.dataset.annualComparisonCashSource === (side === 0 ? 'left' : 'right')" +
            " && cash.textContent.includes('Company Facts captured 2026-09-20T00:00:01.000Z')" +
            " && cash.textContent.includes('Submissions captured 2026-09-20T00:00:02.000Z')" +
            " && cash.textContent.includes('Completed 2026-09-20T00:00:02.000Z')" +
            " && inputs.length === 2 && [...inputs].every((input, i) => { const pairs = [...input.querySelectorAll('dl > div')];" +
            " const field = label => pairs.find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;" +
            " const id = field('Observation identifier'); ids.push(id); return id && input.querySelectorAll('ol > li').length === 1" +
            " && input.querySelector('summary')?.textContent === concepts[i] + ' · ' + period + ' · ' + values[i] + ' USD'" +
            " && input.textContent.includes('Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.')" +
            " && field('Exact USD observation') === values[i] && field('Accession') === accession" +
            " && field('Company Facts source pointer') === '/facts/us-gaap/' + concepts[i] + '/units/USD/0'; })" +
            " && cash.lastElementChild.textContent === 'Calculation references: ' + ids.join(' · '); }); })()");
        assertAnnualComparisonLiquiditySources();
    }

    private void assertAnnualComparisonBalanceSheet() throws Exception {
        awaitPage("reported balance totals retain independent exact dates and refusals through every comparison lifetime",
            "(() => { const rows = [...document.querySelectorAll('[data-annual-comparison-balance-sheet]')];" +
            " const keys = ['totalAssets', 'totalLiabilities', 'shareholdersEquity'];" +
            " const labels = ['Total assets', 'Total liabilities', 'Shareholders’ equity · parent'];" +
            " const values = [['1000.125', '1000.' + '0'.repeat(58) + '1'], ['0', '1200.25'], ['-200.125', null]];" +
            " const dates = ['2025-12-31', '2025-06-30']; return rows.length === 3 && rows.every((row, i) => {" +
            " const cells = [...row.querySelectorAll('td')], header = row.querySelector('th');" +
            " return row.dataset.annualComparisonBalanceSheet === keys[i] && header?.scope === 'row'" +
            " && header.firstChild.textContent === labels[i] && header.querySelector('small')?.textContent === 'Reported · USD'" +
            " && cells.length === 2 && cells.every((cell, side) => values[i][side] === null" +
            " ? cell.textContent === 'Unavailable. This reported balance concept is absent from the source.' && !cell.querySelector('.sec-annual-liquidity-amount')" +
            " : cell.querySelector('.sec-annual-liquidity-amount')?.textContent === values[i][side]" +
            " && cell.querySelectorAll('small')[0]?.textContent === 'At ' + dates[side]" +
            " && cell.querySelectorAll('small')[1]?.textContent === 'Within current-use limits at this load.'); })" +
            " && document.querySelector('.managed-annual-comparison').textContent.includes('Parent equity excludes noncontrolling interests.')" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
    }

    private void assertAnnualComparisonBalanceSheetSources() throws Exception {
        awaitPage("balance totals keep complete original observation references inside each existing source disclosure",
            "(() => { const sources = [...document.querySelectorAll('[data-annual-comparison-balance-sheet-source]')];" +
            " return sources.length === 2 && sources.every((source, side) => {" +
            " const inputs = [...source.querySelectorAll(':scope > section')], concepts = ['Assets', 'Liabilities', 'StockholdersEquity'];" +
            " const expected = side === 0 ? ['1000.125', '0', '-200.125'] : ['1000.' + '0'.repeat(58) + '1', '1200.25', null];" +
            " const date = side === 0 ? '2025-12-31' : '2025-06-30', accession = side === 0 ? '0000000001-26-000001' : '0000000002-25-000001';" +
            " return source.dataset.annualComparisonBalanceSheetSource === (side === 0 ? 'left' : 'right')" +
            " && source.closest('details') === source.closest('.managed-annual-comparison-source').querySelector(':scope > details')" +
            " && source.querySelector(':scope > p')?.textContent === 'Annual cutoff 2026-09-20T00:00:00.000Z. Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
            " && inputs.length === 3 && inputs.every((input, i) => { const rows = [...input.querySelectorAll('ol > li')];" +
            " if (expected[i] === null) return rows.length === 0 && input.textContent.includes('Value references: None');" +
            " const fields = [...input.querySelectorAll('dl > div')], field = label => fields.find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;" +
            " const id = field('Observation identifier'); return rows.length === 1 && /^sec-fact:[a-f0-9]{64}$/.test(id)" +
            " && input.textContent.includes('Value references: ' + id) && field('Exact USD observation') === expected[i]" +
            " && field('Source end date') === date && field('Accession') === accession" +
            " && field('Company Facts source pointer') === '/facts/us-gaap/' + concepts[i] + '/units/USD/0'" +
            " && input.querySelector('a')?.href === 'https://www.sec.gov/Archives/edgar/data/' + (side + 1) + '/' + accession + '-index.htm'; }); }); })()");
    }

    private void assertAnnualComparisonLiquidity() throws Exception {
        awaitPage("liquidity keeps exact balances, independent dates and units through basis and report lifetimes",
            "(() => { const rows = [...document.querySelectorAll('[data-annual-comparison-liquidity]')];" +
            " const keys = ['currentAssets', 'currentLiabilities', 'workingCapital', 'currentRatio'];" +
            " const labels = ['Current assets', 'Current liabilities', 'Working capital', 'Current ratio'];" +
            " const expected = [['1500', '900'], ['600', '1200'], ['900', '-300'], ['2.50×', '0.75×']];" +
            " const dates = ['2025-12-31', '2025-06-30'];" +
            " return rows.length === 4 && rows.every((row, i) => { const header = row.querySelector('th');" +
            " const cells = [...row.querySelectorAll('td')]; return row.dataset.annualComparisonLiquidity === keys[i]" +
            " && header?.scope === 'row' && header.firstChild.textContent === labels[i]" +
            " && header.querySelector('small')?.textContent === (i < 2 ? 'Reported' : 'App calculation') + ' · ' + (i === 3 ? 'multiple' : 'USD')" +
            " && cells.length === 2 && cells.every((cell, side) => cell.querySelector('.sec-annual-liquidity-amount')?.textContent === expected[i][side]" +
            " && cell.querySelectorAll('small')[0]?.textContent === 'At ' + dates[side]" +
            " && cell.querySelectorAll('small')[1]?.textContent === 'Within current-use limits at this load.'" +
            " && !cell.querySelector('.sec-annual-liquidity-unavailable')); }); })()");
    }

    private void assertAnnualComparisonLiquiditySources() throws Exception {
        awaitPage("each liquidity disclosure retains original instant observations and calculation references",
            "(() => { const sources = [...document.querySelectorAll('.managed-annual-comparison-source')];" +
            " return sources.length === 2 && sources.every((source, side) => {" +
            " const liquidity = source.querySelector('[data-annual-comparison-liquidity-source]');" +
            " const inputs = liquidity?.querySelectorAll(':scope > section');" +
            " const concepts = ['AssetsCurrent', 'LiabilitiesCurrent'];" +
            " const values = side === 0 ? ['1500', '600'] : ['900', '1200'];" +
            " const date = side === 0 ? '2025-12-31' : '2025-06-30';" +
            " const filed = side === 0 ? '2026-02-01' : '2025-08-01';" +
            " const accession = side === 0 ? '0000000001-26-000001' : '0000000002-25-000001';" +
            " const url = 'https://www.sec.gov/Archives/edgar/data/' + (side + 1) + '/' + accession + '-index.htm';" +
            " const ids = []; return liquidity?.closest('details') === source.querySelector('details')" +
            " && liquidity.dataset.annualComparisonLiquiditySource === (side === 0 ? 'left' : 'right')" +
            " && liquidity.querySelector(':scope > p')?.textContent === 'Annual cutoff 2026-09-20T00:00:00.000Z. Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
            " && inputs.length === 2 && [...inputs].every((input, i) => { const pairs = [...input.querySelectorAll('dl > div')];" +
            " const field = label => pairs.find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;" +
            " const id = field('Observation identifier'); ids.push(id); return id && input.querySelectorAll('ol > li').length === 1" +
            " && input.querySelector('summary')?.textContent === concepts[i] + ' · Source end ' + date + ' · ' + values[i] + ' USD'" +
            " && input.querySelector(':scope > p')?.textContent === 'Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.'" +
            " && field('Exact USD observation') === values[i] && field('Source end date') === date" +
            " && field('Source start date') === 'Not supplied' && field('Source duration') === 'Not supplied; an instant balance requires no duration.'" +
            " && field('Accession') === accession && field('Reported form / filed date') === '10-K · ' + filed" +
            " && field('Joined report / accepted time') === date + ' · ' + filed + 'T00:00:00.000Z'" +
            " && field('Company Facts source pointer') === '/facts/us-gaap/' + concepts[i] + '/units/USD/0'" +
            " && input.querySelector('a')?.href === url && input.querySelector('a')?.target === '_blank'" +
            " && input.querySelector('a')?.rel === 'noreferrer'; })" +
            " && ids[0] !== ids[1] && [...liquidity.querySelectorAll(':scope > p')].slice(-2).map(p => p.textContent).join('|') === 'Working capital references: ' + ids.join(' · ') + '|Current ratio references: ' + ids.join(' · '); }); })()");
    }

    private void assertAnnualComparisonLiquidityNote() throws Exception {
        chooseNativeSelectOption("#managed-annual-comparison-note-group", "liquidity", "Liquidity");
        chooseNativeSelectOption("#managed-annual-comparison-note-destination", "listing-one", "ONE · One Company · Class A · XNAS");
        selectWatchlistNote(0);
        touchInput("managed-note-0");
        replaceFocusedInput("managed-note-0", "Invented second note", ANNUAL_COMPARISON_LIQUIDITY_PREFIX);
        closeSoftKeyboard();
        selectWatchlistNote(1);
        awaitPage("liquidity action keeps the chosen destination after editing its latest prefix",
            "document.querySelector('#managed-annual-comparison-note-group')?.value === 'liquidity'" +
            " && document.querySelector('#managed-annual-comparison-note-destination')?.value === 'listing-one'" +
            " && document.querySelector('.managed-annual-comparison-note-action button')?.getAttribute('aria-disabled') === 'false'");
        clickAnnualComparisonAction("Add Annual comparison to note draft");
        assertAnnualComparisonLiquidityDraft();
        assertAnnualComparisonCounts(4, 1, 1);
        clickAnnualComparisonAction("Add Annual comparison to note draft");
        awaitPage("duplicate liquidity comparison retains the whole note and exposes its refusal",
            "document.querySelector('.managed-annual-comparison-note-help')?.textContent === 'This exact Annual comparison reference is already in the note draft.'" +
            " && document.querySelector('.managed-annual-comparison-note-status')?.textContent === 'This exact Annual comparison reference is already in the note draft.'" +
            " && document.querySelector('.managed-annual-comparison-note-action button')?.getAttribute('aria-disabled') === 'true'");
        assertAnnualComparisonLiquidityDraft();
        assertAnnualComparisonCounts(4, 1, 1);
        selectWatchlistNote(0);
        touchInput("managed-note-0");
        replaceFocusedInput("managed-note-0", ANNUAL_COMPARISON_LIQUIDITY_NOTE, "Invented second note");
        closeSoftKeyboard();
        selectWatchlistNote(1);
        assertAnnualComparisonDraft();
        assertAnnualComparisonCounts(4, 1, 1);
    }

    private void assertAnnualComparisonLiquidityDraft() throws Exception {
        awaitPage("liquidity appends exact separately dated evidence to ONE while ZERO remains selected",
            DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(ANNUAL_COMPARISON_LIQUIDITY_NOTE) +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.map(member => member.listingId).join(',') === 'listing-one,listing-zero'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'" +
            " && " + DRAFT + ".baseVersion === 1 && " + DRAFT + ".dirty === true" +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('.managed-watchlist-choice[aria-pressed=true]')?.dataset.watchlistSelection === 'listing-zero'" +
            " && document.querySelectorAll('.managed-watchlist-choice[aria-pressed=true]').length === 1");
    }

    private void assertAnnualComparisonDraft() throws Exception {
        awaitPage("Annual comparison preserves complete unsaved order, notes and version",
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'" +
            " && " + DRAFT + ".baseVersion === 1 && " + DRAFT + ".dirty === true");
    }

    private void assertAnnualComparisonNote(int version, boolean dirty) throws Exception {
        awaitPage("Annual comparison note keeps complete order, other prose and explicit saved state",
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(ANNUAL_COMPARISON_NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'" +
            " && " + DRAFT + ".baseVersion === " + version + " && " + DRAFT + ".dirty === " + dirty);
    }

    private void assertAnnualComparisonCounts(int reads, int aborted, int late) throws Exception {
        assertAnnualComparisonCounts(reads, aborted, late, 0, 1);
    }

    private void assertAnnualComparisonCounts(int reads, int aborted, int late, int saves, int loads) throws Exception {
        awaitPage("bounded Annual reads and explicit saves without other providers",
            DIAGNOSTICS + ".annual === " + reads + " && " + DIAGNOSTICS + ".aborted === " + aborted +
            " && " + DIAGNOSTICS + ".lateResolved === " + late + " && " + DIAGNOSTICS + ".save === " + saves +
            " && " + DIAGNOSTICS + ".load === " + loads + " && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0" +
            " && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0");
    }


    @Test
    public void fedAnnouncementsRetainDatesCancelAndRetireWithSession() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        awaitPage("Federal Reserve feed is unloaded until explicitly requested",
            "document.querySelector('.fed-announcements') !== null && document.querySelector('.fed-announcements time') === null" +
            " && document.querySelector('.fed-announcements-actions > button')?.textContent === 'Load announcements'" +
            " && document.querySelector('.fed-announcements-actions > button')?.getBoundingClientRect().height >= 44");
        assertFedCounts(0, 0, 0, 0, 1);
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("announcements test reorders the draft before editing",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Markets");
        assertFedDraft();
        clickFedAction("Load announcements");
        assertFedPacket("2026-10-20T18:00:00.000Z");
        awaitPage("first admitted feed establishes only a baseline",
            "document.querySelector('.managed-fed-refresh-comparison') === null" +
            " && document.querySelectorAll('.fed-announcements-new').length === 0" +
            " && document.querySelector('#managed-fed-updates-view')?.value === 'all'" +
            " && document.querySelector('#managed-fed-updates-view option[value=new]')?.disabled === true" +
            " && document.querySelector('#managed-fed-updates-view')?.getBoundingClientRect().height >= 44");
        assertFedCounts(1, 0, 0, 0, 1);
        awaitPage("loaded Fed note tools start closed with original sources and titles outside",
            "document.querySelector('#managed-fed-note-disclosure')?.open === false" +
            " && document.querySelector('#managed-fed-note-disclosure-toggle')?.textContent === 'Add an announcement to a note'" +
            " && document.querySelector('#managed-fed-note-disclosure-toggle')?.getBoundingClientRect().height >= 44" +
            " && document.querySelector('#managed-fed-note-disclosure #managed-fed-note-announcement') !== null" +
            " && document.querySelector('.fed-announcements-source')?.closest('details') === null" +
            " && document.querySelector('.fed-announcements-list')?.closest('details') === null");
        awaitPage("announcement title search requests literal keyboard input",
            "(() => { const input = document.querySelector('#managed-fed-title-search');" +
            " return input?.autocapitalize === 'none' && input.getAttribute('autocorrect') === 'off'" +
            " && input.spellcheck === false; })()");
        typeIntoInput("managed-fed-title-search", "no matching invented title");
        awaitPage("title search shares an empty view with the note picker without a read",
            "document.querySelector('#managed-fed-title-count')?.textContent.includes('0 of 2 loaded announcements.')" +
            " && document.querySelector('.fed-announcements-list') === null" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 1" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('No loaded announcements match this title search.')" +
            " && document.querySelector('#managed-fed-title-search')?.getBoundingClientRect().height >= 44");
        clickFedAction("Clear title search");
        assertFedPacket("2026-10-20T18:00:00.000Z");
        typeIntoInput("managed-fed-title-search", "  INVENTED  ");
        assertFedCounts(1, 0, 0, 0, 1);
        clickFedAction("Refresh announcements");
        awaitPage("failed refresh qualifies the retained original feed",
            "document.querySelector('.fed-announcements [role=alert]')?.textContent.includes('previously loaded announcements')" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Previous announcements. This attempt has not confirmed a newer feed.')");
        assertFedPacket("2026-10-20T18:00:00.000Z");
        assertFedCounts(2, 0, 0, 0, 1);
        clickFedAction("Refresh announcements");
        awaitPage("third announcements read is held", DIAGNOSTICS + ".fed === 3" +
            " && document.querySelector('.fed-announcements [aria-busy=true]') !== null");
        clickFedAction("Cancel announcements");
        assertFedCounts(3, 1, 0, 0, 1);
        click("#settle-cancelled-announcements");
        assertFedCounts(3, 1, 1, 0, 1);
        assertFedPacket("2026-10-20T18:00:00.000Z");
        awaitPage("failure, held read, Cancel and late settlement preserve the title query",
            "document.querySelector('#managed-fed-title-search')?.value === '  INVENTED  '" +
            " && document.querySelector('#managed-fed-title-count')?.textContent.includes('2 of 2 loaded announcements.')");
        awaitPage("Cancel preserves the original fetchedAt and qualifies retained content",
            "document.querySelector('.fed-announcements [role=status]')?.textContent === 'Announcements refresh cancelled. Refresh again when ready.'" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Previous announcements.')");
        assertFedDraft();
        clickFedAction("Refresh announcements");
        assertFedEmpty();
        assertFedComparison("2026-10-20T18:00:00.000Z", "2026-10-21T18:00:00.000Z", 0, 0);
        awaitPage("accepted empty replacement clears the query with an explicit reset notice",
            "document.querySelector('#managed-fed-title-search')?.value === ''" +
            " && document.querySelector('#managed-fed-title-count')?.textContent.includes('Feed response changed; showing all loaded announcements.')");
        click(".managed-fed-refresh-comparison summary");
        awaitPage("comparison disclosure opens with an accessible native target",
            "document.querySelector('.managed-fed-refresh-comparison details')?.open === true" +
            " && document.querySelector('.managed-fed-refresh-comparison summary')?.getBoundingClientRect().height >= 44");
        assertFedCounts(4, 1, 1, 0, 1);
        awaitPage("valid empty replacement clears old failures and retained qualification",
            "document.querySelector('.fed-announcements [role=alert]') === null" +
            " && !document.querySelector('.fed-announcements').textContent.includes('Previous announcements.')");
        chooseNativeSelectOption("#managed-fed-updates-view", "new", "Newly observed links");
        awaitPage("empty comparison remains an available zero-result updates view",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelector('#managed-fed-updates-view option[value=new]')?.disabled === false" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('No announcements were listed in this loaded feed.')");
        clickFedAction("Refresh announcements");
        awaitPage("fifth announcements read is pending before navigation", DIAGNOSTICS + ".fed === 5" +
            " && document.querySelector('.fed-announcements [aria-busy=true]') !== null" +
            " && document.querySelector('#managed-fed-updates-view')?.value === 'new'");
        selectWorkspaceView("My Watchlist");
        assertFedCounts(5, 2, 1, 0, 1);
        selectWatchlistNote(0);
        chooseNativeSelectOption("#managed-watchlist-search-scope", "notes", "Research notes");
        typeIntoInput("managed-watchlist-search", "Invented second");
        awaitPage("Fed review will target a different note outside the retained notes search",
            "document.querySelector('#managed-note-0')?.dataset.managedNoteListingId === 'listing-one'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && document.querySelector('.managed-watchlist-choice[aria-pressed=true]')?.dataset.watchlistSelection === 'listing-one'");
        click("#settle-cancelled-announcements");
        assertFedCounts(5, 2, 2, 0, 1);
        assertFedDraft();
        selectWorkspaceView("Markets");
        assertFedEmpty();
        assertFedComparison("2026-10-20T18:00:00.000Z", "2026-10-21T18:00:00.000Z", 0, 0);
        awaitPage("navigation remount resets the reading view without another feed request",
            "document.querySelector('#managed-fed-updates-view')?.value === 'all'" +
            " && document.querySelector('#managed-fed-title-search')?.value === ''");
        assertFedCounts(5, 2, 2, 0, 1);
        clickFedAction("Refresh announcements");
        assertFedPacket("2026-10-23T18:00:00.000Z");
        assertFedComparison("2026-10-21T18:00:00.000Z", "2026-10-23T18:00:00.000Z", 2, 2);
        awaitPage("newly observed markers preserve both current links and note choices",
            "Array.from(document.querySelectorAll('.fed-announcements-new')).every(label => label.textContent === 'Newly observed in this refresh')" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 2" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 3");
        assertFedCounts(6, 2, 2, 0, 1);
        assertFedDraft();
        chooseNativeSelectOption("#managed-fed-updates-view", "new", "Newly observed links");
        typeIntoInput("managed-fed-title-search", "WITHOUT A PUBLICATION");
        awaitPage("updates and title search share one current reference while full comparison remains visible",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelector('#managed-fed-title-count')?.textContent.includes('1 of 2 loaded announcements.')" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 1" +
            " && document.querySelector('.fed-announcements-list li > a')?.href === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 2" +
            " && document.querySelector('.managed-fed-refresh-count')?.textContent === 'Newly observed in this refresh: 2 of 2 links in the loaded feed.'" +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === false");
        clickFedAction("Clear title search");
        awaitPage("clearing the title search retains the explicitly selected updates view",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 2");
        chooseNativeSelectOption("#managed-fed-updates-view", "all", "All loaded announcements");
        assertFedCounts(6, 2, 2, 0, 1);
        appendAndSaveFedReference();
        clickFedAction("Refresh announcements");
        awaitPage("seventh announcements read is held before session expiry", DIAGNOSTICS + ".fed === 7" +
            " && document.querySelector('.fed-announcements [aria-busy=true]') !== null");
        chooseNativeSelectOption("#managed-fed-updates-view", "new", "Newly observed links");
        awaitPage("the retained comparison remains readable during a pending feed request",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelector('#managed-fed-updates-view')?.disabled === false");
        click(CATALOG_REFRESH);
        awaitPage("expired session removes the loaded feed and unsaved draft",
            DIAGNOSTICS + ".status === 2 && document.querySelector('.managed-navigation') === null" +
            " && document.querySelector('.fed-announcements') === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && " + DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false");
        click("#settle-cancelled-announcements");
        assertFedCounts(7, 3, 3, 1, 2);
        awaitPage("late announcements cannot remount a retired session",
            "document.querySelector('.fed-announcements') === null && document.querySelector('.managed-navigation') === null" +
            " && !document.body.textContent.includes('Invented monetary policy announcement')" +
            " && !document.body.textContent.includes(" + JSONObject.quote(NOTE) + ")");
        assertEquals("Announcements preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private void clickFedAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(@class,'fed-announcements')]//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertFedPacket(String fetchedAt) throws Exception {
        awaitPage("Fed packet preserves source identities, exact dates and absent publication time",
            "document.querySelector('.fed-announcements-note time')?.dateTime === " + JSONObject.quote(fetchedAt) +
            " && Array.from(document.querySelectorAll('.fed-announcements-list li > a')).map(e => e.textContent).join('|') === 'Invented monetary policy announcement|Invented announcement without a publication time'" +
            " && document.querySelector('.fed-announcements-list li:first-child time')?.dateTime === '2026-10-19T18:00:00.000Z'" +
            " && document.querySelector('.fed-announcements-list li:last-child p')?.textContent === 'Unknown publication time'" +
            " && document.querySelector('.fed-announcements-list li:first-child a')?.href === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019a.htm'" +
            " && document.querySelector('.fed-announcements-source a')?.href === 'https://www.federalreserve.gov/feeds/feeds.htm'" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Loaded 2 of 2 announcements from this feed.')");
    }

    private void assertFedComparison(String previousAt, String currentAt, int newlyObserved, int currentCount) throws Exception {
        awaitPage("compared feeds retain both original clocks and the complete current-list count",
            "document.querySelector('.managed-fed-refresh-count')?.textContent === " +
            JSONObject.quote("Newly observed in this refresh: " + newlyObserved + " of " + currentCount + " links in the loaded feed.") +
            " && Array.from(document.querySelectorAll('.managed-fed-refresh-comparison time')).map(time => time.dateTime).join('|') === " +
            JSONObject.quote(previousAt + "|" + currentAt) +
            " && document.querySelector('.managed-fed-refresh-comparison summary')?.textContent === 'Compared loaded feeds'" +
            " && document.querySelectorAll('.fed-announcements-new').length === " + newlyObserved);
    }

    private void assertFedEmpty() throws Exception {
        awaitPage("valid empty feed replaces prior items with its own exact fetchedAt",
            "document.querySelector('.fed-announcements-note time')?.dateTime === '2026-10-21T18:00:00.000Z'" +
            " && document.querySelector('.fed-announcements-list') === null" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Loaded 0 of 0 announcements from this feed.')" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('No announcements were listed in this loaded feed.')");
    }

    private void assertFedDraft() throws Exception {
        awaitPage("announcements preserve complete unsaved watchlist order, notes and version",
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'" +
            " && " + DRAFT + ".baseVersion === 1 && " + DRAFT + ".dirty === true");
    }

    private void appendAndSaveFedReference() throws Exception {
        String complete = "Draft survives native Back Observed Federal Reserve announcement: Invented announcement without a publication time. Announcement URL: https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm. Source publication time: unknown. Source: Board of Governors of the Federal Reserve System; monetary-policy feed https://www.federalreserve.gov/feeds/press_monetary.xml. Original feed retrieved at: 2026-10-23T18:00:00.000Z (UTC). Only feed metadata was loaded; article contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        awaitPage("Fed reference starts with two explicit empty choices",
            "document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === ''" +
            " && document.querySelector('.managed-fed-note-action button')?.getAttribute('aria-disabled') === 'true'");
        click("#managed-fed-note-disclosure-toggle");
        awaitPage("Fed note tools open explicitly before a reference choice",
            "document.querySelector('#managed-fed-note-disclosure')?.open === true");
        chooseNativeSelectOption("#managed-fed-note-announcement",
            "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm",
            "Invented announcement without a publication time");
        chooseNativeSelectOption("#managed-fed-note-destination", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        typeIntoInput("managed-fed-title-search", " MONETARY   POLICY ");
        awaitPage("excluding the chosen announcement clears it while preserving its exact destination and whole-feed count",
            "document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 1" +
            " && document.querySelector('.managed-fed-note-action')?.textContent.includes('The chosen announcement is outside the current announcement view.')" +
            " && document.querySelector('.managed-fed-refresh-count')?.textContent.includes('2 of 2 links in the loaded feed.')");
        clickFedAction("Clear title search");
        awaitPage("Clear requires a fresh announcement choice without a fallback",
            "document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 3");
        typeIntoInput("managed-fed-title-search", " WITHOUT A   PUBLICATION ");
        chooseNativeSelectOption("#managed-fed-note-announcement",
            "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm",
            "Invented announcement without a publication time");
        assertFedDraft();
        assertFedCounts(6, 2, 2, 0, 1);
        clickFedAction("Add announcement to note draft");
        String exact = "(() => { const expected = JSON.parse(" + JSONObject.quote(originalDraft) + ");" +
            " expected.memberships[1].note = " + JSONObject.quote(complete) + ";" +
            " return JSON.stringify(" + DRAFT + ") === JSON.stringify(expected); })()";
        awaitPage("Fed reference appends only the chosen note and retains all original metadata", exact +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'Announcement reference added to the ZERO (Class A, XNAS) note draft. Review and save all changes in My Watchlist.'" +
            " && document.activeElement === document.querySelector('.managed-fed-note-action button')");
        clickFedAction("Add announcement to note draft");
        awaitPage("an identical Fed reference cannot append twice", exact +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'This exact announcement reference is already in the note draft.'");
        assertFedCounts(6, 2, 2, 0, 1);
        touchInput("managed-fed-title-search");
        replaceFocusedInput("managed-fed-title-search", " WITHOUT A   PUBLICATION ", " WITHOUT ");
        awaitPage("a matching query keeps the selected announcement and duplicate feedback for Review", exact +
            " && document.querySelector('#managed-fed-note-announcement')?.value === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'This exact announcement reference is already in the note draft.'");
        click("#managed-fed-note-disclosure-toggle");
        awaitPage("closing Fed tools preserves exact choices feedback and the whole draft", exact +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === false" +
            " && document.activeElement === document.querySelector('#managed-fed-note-disclosure-toggle')" +
            " && document.querySelector('#managed-fed-note-announcement')?.value === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'This exact announcement reference is already in the note draft.'");
        click("#managed-fed-note-disclosure-toggle");
        awaitPage("reopening Fed tools keeps the chosen reference and Review", exact +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === true" +
            " && document.querySelector('#managed-fed-note-announcement')?.value === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && Array.from(document.querySelectorAll('.managed-fed-note-action button')).some(button => button.textContent === 'Review in My Watchlist')");
        clickFedAction("Review in My Watchlist");
        awaitPage("Fed Review opens and focuses its exact destination while preserving the complete draft and search", exact +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.activeElement === document.querySelector('#managed-note-1-reading-toggle')" +
            " && document.querySelector('#managed-watchlist-search')?.value === 'Invented second'" +
            " && document.querySelector('#managed-watchlist-search-scope')?.value === 'notes'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && document.querySelector('.managed-watchlist-detail')?.textContent.includes('Selected ZERO is outside this search.')");
        assertFullNoteReading("managed-note-1", complete, true);
        assertFedCounts(6, 2, 2, 0, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        String saved = "(() => { const expected = JSON.parse(" + JSONObject.quote(originalDraft) + ");" +
            " expected.memberships[1].note = " + JSONObject.quote(complete) + "; expected.baseVersion = 2; expected.dirty = false;" +
            " return JSON.stringify(" + DRAFT + ") === JSON.stringify(expected); })()";
        awaitPage("explicit Save acknowledges the exact Fed note and full reordered payload", saved +
            " && document.body.textContent.includes('Version 2 · Saved')");
        assertFedCounts(6, 2, 2, 1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("reload preserves the full saved Fed reference and other note", saved +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(complete) +
            " && document.querySelector('#managed-note-1')?.disabled === false");
        assertFedCounts(6, 2, 2, 1, 2);
        assertFullNoteReading("managed-note-1", complete, true);
        selectWorkspaceView("Markets");
        assertFedPacket("2026-10-23T18:00:00.000Z");
        assertFedComparison("2026-10-21T18:00:00.000Z", "2026-10-23T18:00:00.000Z", 2, 2);
        awaitPage("returning to Markets requires fresh choices without another feed read", saved +
            " && document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === ''" +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === false");
        assertFedCounts(6, 2, 2, 1, 2);
    }

    private void assertFedCounts(int reads, int aborted, int late, int saves, int loads) throws Exception {
        awaitPage("bounded Fed reads and explicit watchlist operations without another source request",
            DIAGNOSTICS + ".fed === " + reads + " && " + DIAGNOSTICS + ".fedAborted === " + aborted +
            " && " + DIAGNOSTICS + ".fedLateResolved === " + late + " && " + DIAGNOSTICS + ".save === " + saves +
            " && " + DIAGNOSTICS + ".load === " + loads + " && " + DIAGNOSTICS + ".calendar === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0");
    }


    @Test
    public void beaAgendaComparisonKeepsOriginalWindowsAndRetainedPair() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareBeaDraft();
        clickBeaAction("Load agenda");
        awaitPage("first empty accepted agenda has no comparison", "document.querySelector('.managed-bea-refresh-comparison') === null" +
            " && document.querySelector('.bea-agenda-empty')?.textContent.includes('No BEA releases are listed')");
        awaitPage("first loaded agenda starts in All with unavailable updates disabled",
            "document.querySelector('#managed-bea-release-view')?.value === 'all'" +
            " && document.querySelector('#managed-bea-release-view option[value=new]')?.disabled === true");
        assertBeaCounts(1, 0, 0);
        clickBeaAction("Refresh agenda");
        awaitPage("second accepted agenda marks exact current entries and preserves both windows",
            "document.querySelector('.managed-bea-refresh-count')?.textContent.includes('3 of 3 scheduled releases.')" +
            " && document.querySelectorAll('.bea-agenda-new').length === 3" +
            " && Array.from(document.querySelectorAll('.managed-bea-refresh-comparison time')).map(t => t.dateTime).join('|') === '2026-10-20T17:59:00.000Z|2026-10-20T17:59:00.000Z|2026-11-19T17:59:00.000Z|2026-10-20T18:00:00.000Z|2026-10-20T18:00:00.000Z|2026-11-19T18:00:00.000Z'" +
            " && document.querySelector('.managed-bea-refresh-comparison summary')?.getBoundingClientRect().height >= 44" +
            " && document.querySelector('.managed-bea-refresh-comparison')?.textContent.includes('Windows move with each load.')");
        chooseNativeSelectOption("#managed-bea-release-view", "new", "Not in previous agenda");
        awaitPage("updates view uses the accepted pair without another agenda read",
            "document.querySelector('#managed-bea-release-view')?.value === 'new'" +
            " && document.querySelectorAll('.bea-agenda-day li').length === 3 && " + DIAGNOSTICS + ".calendar === 2");
        typeIntoInput("managed-bea-release-search", "Trade");
        awaitPage("series filter narrows rows and note choices while whole comparison remains",
            "document.querySelectorAll('.bea-agenda-day li').length === 1 && document.querySelectorAll('.bea-agenda-new').length === 1" +
            " && document.querySelectorAll('#managed-bea-note-release option').length === 2" +
            " && document.querySelector('.managed-bea-refresh-count')?.textContent.includes('3 of 3 scheduled releases.')");
        clickBeaAction("Refresh agenda");
        awaitPage("third read retains the accepted pair while pending", DIAGNOSTICS + ".calendar === 3 && document.querySelector('.bea-release-agenda [aria-busy=true]') !== null");
        clickBeaAction("Cancel agenda");
        click("#settle-cancelled-calendar");
        assertBeaCounts(3, 1, 1);
        awaitPage("cancelled late response keeps accepted pair and query", "document.querySelector('#managed-bea-release-search')?.value === 'Trade'" +
            " && document.querySelector('.managed-bea-refresh-count')?.textContent.includes('3 of 3 scheduled releases.')");
        awaitPage("cancel keeps all local release controls on the retained pair",
            "document.querySelector('#managed-bea-release-view')?.value === 'new'" +
            " && document.querySelectorAll('.bea-agenda-day li').length === 1");
        assertBeaDraft();
        selectWorkspaceView("My Watchlist");
        selectWorkspaceView("Markets");
        awaitPage("navigation resets filters while retaining accepted comparison", "document.querySelector('#managed-bea-release-search')?.value === ''" +
            " && document.querySelectorAll('.bea-agenda-new').length === 3");
        awaitPage("returning to Markets resets only the local Release view",
            "document.querySelector('#managed-bea-release-view')?.value === 'all'");
        clickBeaAction("Refresh agenda");
        awaitPage("verified empty replacement compares only the preceding accepted agenda",
            "document.querySelector('.managed-bea-refresh-count')?.textContent.includes('0 of 0 scheduled releases.')" +
            " && Array.from(document.querySelectorAll('.managed-bea-refresh-comparison time')).map(t => t.dateTime).join('|') === '2026-10-20T18:00:00.000Z|2026-10-20T18:00:00.000Z|2026-11-19T18:00:00.000Z|2026-10-20T18:01:00.000Z|2026-10-20T18:01:00.000Z|2026-11-19T18:01:00.000Z'" +
            " && document.querySelectorAll('.bea-agenda-new').length === 0 && document.querySelector('.bea-agenda-days') === null");
        chooseNativeSelectOption("#managed-bea-release-view", "new", "Not in previous agenda");
        awaitPage("an empty current agenda retains a valid updates choice and the verified empty explanation",
            "document.querySelector('#managed-bea-release-view')?.value === 'new'" +
            " && document.querySelector('.bea-agenda-empty')?.textContent.includes('No BEA releases are listed')" +
            " && !document.querySelector('.bea-agenda-empty')?.textContent.includes('No releases absent from the previous agenda match')");
        assertBeaCounts(4, 1, 1);
        assertBeaDraft();
        assertEquals("Agenda comparisons preserve the original document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    @Test
    public void beaAgendaRefreshCancelAndNavigationPreserveDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareBeaDraft();
        assertBeaCounts(0, 0, 0);
        assertMarketsNavigation(0);
        clickBeaAction("Load agenda");
        assertBeaPacket();
        assertBeaCounts(1, 0, 0);
        assertBeaDraft();

        awaitPage("loaded agenda starts with note tools closed and source dates outside",
            "document.querySelector('#managed-bea-note-disclosure')?.open === false" +
            " && document.querySelector('#managed-bea-note-disclosure-toggle')?.textContent === 'Add a release to a note'" +
            " && document.querySelector('#managed-bea-note-disclosure-toggle')?.getBoundingClientRect().height >= 44" +
            " && document.querySelector('#managed-bea-note-disclosure #managed-bea-note-release') !== null" +
            " && document.querySelector('.bea-agenda-source')?.closest('details') === null" +
            " && document.querySelector('.bea-release-agenda .bea-agenda-note time')?.closest('details') === null");

        chooseNativeSelectOption("#managed-bea-release-date", "2026-10-29", "Thu, Oct 29, 2026 (2)");
        assertBeaDate("2026-10-29", "Invented GDP|Invented Income", 2);
        assertMarketsNavigation(1);
        assertBeaCounts(1, 0, 0);
        assertBeaDraft();
        clickBeaAction("Refresh agenda");
        awaitPage("failed refresh labels the original loaded window",
            "document.querySelector('.bea-release-agenda [role=alert]')?.textContent.includes('previous loaded window')");
        assertBeaDate("2026-10-29", "Invented GDP|Invented Income", 2);
        chooseNativeSelectOption("#managed-bea-release-date", "", "All loaded dates");
        assertBeaPacket();
        assertBeaCounts(2, 0, 0);
        chooseNativeSelectOption("#managed-bea-release-date", "2026-11-04", "Wed, Nov 4, 2026 (1)");
        clickBeaAction("Refresh agenda");
        awaitPage("one calendar refresh is held", DIAGNOSTICS + ".calendar === 3" +
            " && document.querySelector('.bea-release-agenda [aria-busy=true]') !== null");
        assertBeaDate("2026-11-04", "Invented Trade", 1);
        assertMarketsNavigation(3);
        clickBeaAction("Cancel agenda");
        assertBeaCounts(3, 1, 0);
        assertBeaDate("2026-11-04", "Invented Trade", 1);
        click("#settle-cancelled-calendar");
        assertBeaCounts(3, 1, 1);
        assertBeaDate("2026-11-04", "Invented Trade", 1);
        chooseNativeSelectOption("#managed-bea-release-date", "", "All loaded dates");
        assertBeaPacket();
        assertBeaDraft();

        chooseNativeSelectOption("#managed-bea-release-date", "2026-10-29", "Thu, Oct 29, 2026 (2)");
        clickBeaAction("Refresh agenda");
        awaitPage("fourth explicit calendar read is pending", DIAGNOSTICS + ".calendar === 4");
        selectWorkspaceView("My Watchlist");
        assertBeaCounts(4, 2, 1);
        click("#settle-cancelled-calendar");
        assertBeaCounts(4, 2, 2);
        assertBeaDraft();
        selectWorkspaceView("Markets");
        assertBeaPacket();
        awaitPage("returning after Markets unmount resets only the local date view",
            "document.querySelector('#managed-bea-release-date')?.value === ''" +
            " && document.querySelector('#managed-bea-release-date-count')?.textContent.includes('3 of 3 loaded BEA releases.')");
        assertBeaCounts(4, 2, 2);
        scenario.moveToState(Lifecycle.State.CREATED);
        scenario.moveToState(Lifecycle.State.RESUMED);
        assertBeaPacket();
        assertBeaCounts(4, 2, 2);
        assertBeaDraft();
        typeIntoInput("managed-bea-release-search", "No matching invented series");
        awaitPage("release search has no match without losing dates or choosing an event",
            "document.querySelector('#managed-bea-release-date-count')?.textContent.includes('0 of 3 loaded BEA releases.')" +
            " && document.querySelectorAll('.bea-agenda-day li').length === 0" +
            " && document.querySelectorAll('#managed-bea-release-date option').length === 3" +
            " && document.querySelectorAll('#managed-bea-note-release option').length === 1" +
            " && document.querySelector('#managed-bea-note-release')?.value === ''");
        clickBeaAction("Clear search");
        assertBeaPacket();
        awaitPage("Clear search retains its focused control and clears only the query",
            "document.querySelector('#managed-bea-release-search')?.value === ''" +
            " && document.activeElement?.textContent === 'Clear search'");
        typeIntoInput("managed-bea-release-search", "gDp");
        awaitPage("mixed-case search gives the agenda and picker the same original event",
            "document.querySelector('#managed-bea-release-date-count')?.textContent.includes('1 of 3 loaded BEA releases.')" +
            " && Array.from(document.querySelectorAll('.bea-agenda-day li span')).map(e => e.textContent).join('|') === 'Invented GDP'" +
            " && Array.from(document.querySelectorAll('#managed-bea-note-release option')).map(e => e.value).join('|') === '|0'" +
            " && document.querySelector('.bea-release-agenda .bea-agenda-note time')?.dateTime === '2026-10-20T18:00:00.000Z'");
        assertBeaCounts(4, 2, 2);
        assertBeaDraft();
        appendAndReviewBeaReference();
        assertEquals("Calendar actions preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    @Test
    public void beaSessionExpiryClearsAgendaAndFencesLateResponse() throws Exception {
        prepareBeaDraft();
        clickBeaAction("Load agenda");
        assertBeaPacket();
        clickBeaAction("Refresh agenda");
        awaitPage("calendar read is held before session expiry", DIAGNOSTICS + ".calendar === 2");
        assertBeaCounts(2, 0, 0);
        // The global catalog action can expire the session while Markets and its
        // held agenda read remain mounted; retirement must abort both models.
        click(CATALOG_REFRESH);
        awaitPage("expired session removes retained agenda and the entire draft",
            DIAGNOSTICS + ".status === 2 && document.querySelector('.managed-navigation') === null" +
            " && " + DRAFT + ".memberships === null && " + DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false" +
            " && document.querySelector('#managed-note-0') === null && document.querySelector('.bea-release-agenda') === null");
        click("#settle-cancelled-calendar");
        assertBeaCounts(2, 1, 1);
        awaitPage("late response cannot remount the retired workspace",
            "document.querySelector('.managed-navigation') === null && document.querySelector('.bea-release-agenda') === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && !document.body.textContent.includes('Invented GDP') && !document.body.textContent.includes(" + JSONObject.quote(NOTE) + ")");
        assertFixtureBoundary();
    }

    private void prepareBeaDraft() throws Exception {
        awaitPage("calendar starts unloaded", "document.querySelector('.bea-release-agenda') !== null" +
            " && document.querySelector('.bea-release-agenda time') === null && " + DIAGNOSTICS + ".calendar === 0");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("calendar test reorders the draft", "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Markets");
        assertBeaDraft();
    }

    private void clickBeaAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(@class,'bea-release-agenda')]//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertMarketsNavigation(int calendarReads) throws Exception {
        String originalLocation = readFixtureString("location.href");
        String originalHistoryLength = readFixtureString("String(history.length)");
        String packet = "JSON.stringify({draft:" + DRAFT + ", date:document.querySelector('#managed-bea-release-date')?.value ?? ''," +
            " agenda:document.querySelector('.bea-release-agenda')?.textContent," +
            " clocks:[...document.querySelectorAll('.bea-release-agenda time')].map(t => t.dateTime)," +
            " source:document.querySelector('.bea-agenda-source a')?.href," +
            " busy:document.querySelector('.bea-release-agenda [aria-busy]')?.getAttribute('aria-busy')})";
        String originalPacket = readFixtureString(packet);
        awaitPage("Markets offers five labelled native-sized section links",
            "(() => { const links = [...document.querySelectorAll('nav[aria-label=\"On Markets\"] > a')];" +
            " return links.length === 5 && links.map(a => a.textContent).join('|') === 'Company board|Research checks due|Markets day view|Economic calendar|Fed announcements'" +
            " && links.every(a => { const r = a.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; }); })()");
        for (String section : new String[] {"board", "review", "day", "calendar", "announcements"}) {
            String selector = "nav[aria-label='On Markets'] > a[data-markets-jump='" + section + "']";
            String targetId = section.equals("board") ? "managed-markets-heading" :
                section.equals("review") ? "managed-daily-research-heading" :
                section.equals("day") ? "managed-markets-day-heading" :
                section.equals("calendar") ? "bea-agenda-title" : "fed-announcements-title";
            String geometry = readFixtureString(
                "(() => { const link = document.querySelector(" + JSONObject.quote(selector) + ");" +
                " if (!link) return JSON.stringify(null); link.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});" +
                " const r = link.getBoundingClientRect(), v = visualViewport; const x = r.left + r.width / 2, y = r.top + r.height / 2;" +
                " return JSON.stringify({x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom," +
                " width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
                " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite)" +
                " &&r.width>=44&&r.height>=44&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
                " visible:link.isConnected&&!link.closest('[hidden], [inert]')&&getComputedStyle(link).visibility==='visible'" +
                " &&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height," +
                " hit:link.contains(document.elementFromPoint(x,y))}); })()");
            touchObservedGeometry("markets-jump-" + section, geometry);
            awaitPage("native Markets jump focuses its visible owned heading: " + section,
                "(() => { const target = document.getElementById(" + JSONObject.quote(targetId) + ");" +
                " const owner = document.querySelector('.managed-markets-content');" +
                " if (!target || !owner?.contains(target) || document.activeElement !== target || !target.isConnected" +
                " || target.closest('[hidden], [inert]') || getComputedStyle(target).visibility !== 'visible') return false;" +
                " const r = target.getBoundingClientRect(), v = visualViewport;" +
                " const nav = document.querySelector('.managed-navigation')?.getBoundingClientRect();" +
                " const bottom = Math.min(v.offsetTop + v.height, nav?.top > v.offsetTop ? nav.top : Infinity);" +
                " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
                " && r.top >= v.offsetTop && r.bottom <= bottom" +
                " && location.href === " + JSONObject.quote(originalLocation) +
                " && String(history.length) === " + JSONObject.quote(originalHistoryLength) + "; })()");
        }
        assertEquals("Markets jumps preserve the exact agenda, selected date and whole draft", originalPacket, readFixtureString(packet));
        assertBeaCounts(calendarReads, 0, 0);
        awaitPage("Markets jumps leave other source and authentication counts unchanged",
            DIAGNOSTICS + ".fed === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    private void assertBeaPacket() throws Exception {
        awaitPage("BEA packet preserves both simultaneous releases, DST and original dates",
            "document.querySelector('.bea-release-agenda .bea-agenda-note time')?.dateTime === '2026-10-20T18:00:00.000Z'" +
            " && Array.from(document.querySelectorAll('.bea-agenda-day li span')).map(e => e.textContent).join('|') === 'Invented GDP|Invented Income|Invented Trade'" +
            " && Array.from(document.querySelectorAll('.bea-agenda-day li time')).map(e => e.dateTime).join('|') === '2026-10-29T12:30:00.000Z|2026-10-29T12:30:00.000Z|2026-11-04T13:30:00.000Z'" +
            " && Array.from(document.querySelectorAll('.bea-agenda-day li time')).map(e => e.textContent).join('|') === '8:30 AM EDT|8:30 AM EDT|8:30 AM EST'" +
            " && document.querySelectorAll('.bea-agenda-day').length === 2" +
            " && document.querySelector('.bea-agenda-source a')?.href === 'https://www.bea.gov/news/schedule'");
    }

    private void assertBeaDate(String date, String series, int visible) throws Exception {
        awaitPage("release date filters only the loaded packet and preserves provenance",
            "document.querySelector('#managed-bea-release-date')?.value === " + JSONObject.quote(date) +
            " && document.querySelector('#managed-bea-release-date-count')?.textContent.includes(" + JSONObject.quote(visible + " of 3 loaded BEA releases.") + ")" +
            " && Array.from(document.querySelectorAll('.bea-agenda-day li span')).map(e => e.textContent).join('|') === " + JSONObject.quote(series) +
            " && document.querySelectorAll('.bea-agenda-day').length === 1" +
            " && document.querySelector('.bea-release-agenda .bea-agenda-note time')?.dateTime === '2026-10-20T18:00:00.000Z'" +
            " && document.querySelector('.bea-agenda-source a')?.href === 'https://www.bea.gov/news/schedule'");
    }

    private void assertBeaDraft() throws Exception {
        awaitPage("calendar preserves unsaved watchlist order, notes and base version",
            "" + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
    }

    private void appendAndReviewBeaReference() throws Exception {
        String complete = "Draft survives native Back Scheduled BEA release: Invented GDP. Scheduled time: Thu, Oct 29, 2026, 8:30 AM EDT (America/New_York); 2026-10-29T12:30:00.000Z (UTC). Source: U.S. Bureau of Economic Analysis; official schedule https://www.bea.gov/news/schedule. Original agenda retrieved at: 2026-10-20T18:00:00.000Z (UTC). Loaded window: 2026-10-20T18:00:00.000Z inclusive to 2026-11-19T18:00:00.000Z exclusive (UTC). Only schedule metadata was loaded; forecasts and released values were not supplied. Scheduled times may change; this reference does not confirm a release or company relevance. Retained previous agenda; a newer schedule was not confirmed. Evidence dates are unchanged; this action does not refresh sources.";
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        awaitPage("BEA reference requires two explicit empty choices",
            "document.querySelector('#managed-bea-note-release')?.value === ''" +
            " && document.querySelector('#managed-bea-note-destination')?.value === ''" +
            " && document.querySelector('.managed-bea-note-action button')?.getAttribute('aria-disabled') === 'true'");
        click("#managed-bea-note-disclosure-toggle");
        awaitPage("note tools open explicitly before choosing a release",
            "document.querySelector('#managed-bea-note-disclosure')?.open === true");
        chooseNativeSelectOption("#managed-bea-note-release", "0", "    8:30 AM EDT · Invented GDP");
        chooseNativeSelectOption("#managed-bea-note-destination", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        assertBeaDraft();
        assertBeaCounts(4, 2, 2);
        clickBeaAction("Add release to note draft");
        String exact = "(() => { const expected = JSON.parse(" + JSONObject.quote(originalDraft) + ");" +
            " expected.memberships[1].note = " + JSONObject.quote(complete) + ";" +
            " return JSON.stringify(" + DRAFT + ") === JSON.stringify(expected); })()";
        awaitPage("BEA append preserves the exact retained schedule and every other draft field", exact +
            " && document.querySelector('.managed-bea-note-status')?.textContent.includes('note draft')" +
            " && document.activeElement === document.querySelector('.managed-bea-note-action button')");
        clickBeaAction("Add release to note draft");
        awaitPage("duplicate BEA reference is refused without losing Review", exact +
            " && document.querySelector('.managed-bea-note-status')?.textContent.includes('already in the note draft')");
        click("#managed-bea-note-disclosure-toggle");
        awaitPage("closing note tools retains exact choices, feedback and draft", exact +
            " && document.querySelector('#managed-bea-note-disclosure')?.open === false" +
            " && document.activeElement === document.querySelector('#managed-bea-note-disclosure-toggle')" +
            " && document.querySelector('#managed-bea-note-release')?.value === '0'" +
            " && document.querySelector('#managed-bea-note-destination')?.value === 'listing-zero'" +
            " && document.querySelector('.managed-bea-note-status')?.textContent.includes('already in the note draft')");
        assertBeaCounts(4, 2, 2);
        click("#managed-bea-note-disclosure-toggle");
        awaitPage("reopening note tools retains exact choices and Review", exact +
            " && document.querySelector('#managed-bea-note-disclosure')?.open === true" +
            " && document.querySelector('#managed-bea-note-release')?.value === '0'" +
            " && document.querySelector('#managed-bea-note-destination')?.value === 'listing-zero'" +
            " && [...document.querySelectorAll('.managed-bea-note-action button')].some(b => b.textContent === 'Review in My Watchlist' && b.getAttribute('aria-disabled') === 'false')");
        clickBeaAction("Review in My Watchlist");
        awaitPage("BEA Review opens and focuses the exact current destination", exact +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.activeElement === document.querySelector('#managed-note-1-reading-toggle')");
        assertFullNoteReading("managed-note-1", complete, true);
        assertBeaCounts(4, 2, 2);
        touchInput("managed-note-1");
        replaceFocusedInput("managed-note-1", complete, NOTE);
        awaitPage("restoring the original draft preserves every field and save count",
            "JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        selectWorkspaceView("Markets");
        assertBeaPacket();
        assertBeaDraft();
        assertBeaCounts(4, 2, 2);
        awaitPage("returning to Markets requires fresh BEA choices without reading again",
            "document.querySelector('#managed-bea-note-release')?.value === ''" +
            " && document.querySelector('#managed-bea-note-destination')?.value === ''" +
            " && document.querySelector('#managed-bea-release-search')?.value === ''" +
            " && document.querySelector('#managed-bea-note-disclosure')?.open === false");
    }

    private void assertBeaCounts(int reads, int aborted, int late) throws Exception {
        awaitPage("bounded BEA requests and no implicit price, annual or save actions",
            DIAGNOSTICS + ".calendar === " + reads + " && " + DIAGNOSTICS + ".calendarAborted === " + aborted +
            " && " + DIAGNOSTICS + ".calendarLateResolved === " + late + " && " + DIAGNOSTICS + ".save === 0" +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".annual === 0" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0");
    }

    @Test
    public void signOutReviewKeepsDraftAndUpdatesAfterSave() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareSignOutDraft();
        assertSignOutCounts(0, 0, 0, 0, 0);
        click("#managed-signout-open");
        assertSignOutReview("Sign out with unsaved changes?", "Your changes have not been confirmed as saved.");
        assertSignOutDraft();
        retainSignOutReviewScreenshot("signoutDirtyReview", "managed-signout-stay");
        click("#managed-signout-stay");
        awaitPage("cancel sign-out returns to its opener without discarding the draft",
            "document.querySelector('#managed-signout-review') === null && document.activeElement?.id === 'managed-signout-open'");
        assertSignOutDraft();
        assertSignOutCounts(0, 0, 0, 0, 0);
        Log.i("ManagedSignOut", "phase=draft-kept; " + pageDiagnostic());

        clickWatchlistAction("Save watchlist");
        awaitPage("one save is held and the local draft remains mounted", DIAGNOSTICS + ".save === 1" +
            " && document.querySelector('#managed-note-1')?.disabled === true");
        click("#managed-signout-open");
        assertSignOutReview("Check this save before signing out", "The save is still in progress.");
        assertSignOutDraft();
        assertSignOutCounts(1, 0, 0, 0, 0);
        retainSignOutReviewScreenshot("signoutPendingSaveReview", "managed-signout-stay");
        click("#settle-signout-save");
        // The one-use fixture trigger becomes disabled; the review must not steal focus back.
        awaitPage("save settles while its review remains open without refocusing its action",
            "document.querySelector('#managed-signout-review h2')?.textContent === 'Sign out this session?'" +
            " && document.querySelector('#managed-signout-review p')?.textContent.includes('There are no unconfirmed local changes.')" +
            " && document.activeElement === document.body" +
            " && document.querySelector('#managed-note-1')?.disabled === false");
        assertSignOutDraft();
        assertSignOutCounts(1, 0, 1, 1, 0);
        assertSignOutSavedPayload();
        retainSignOutReviewScreenshot("signoutSavedReview", "");
        click("#managed-signout-stay");
        awaitPage("cancel settled review returns to opener", "document.querySelector('#managed-signout-review') === null" +
            " && document.activeElement?.id === 'managed-signout-open'");
        click("#managed-signout-open");
        assertSignOutCleared();
        assertSignOutCounts(1, 0, 1, 1, 1);
        assertSignOutSavedPayload();
        assertEquals("Sign-out review keeps the original document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedSignOut", "phase=clean-signout-cleared; " + pageDiagnostic());
    }

    @Test
    public void uncertainSignOutReviewClearsLocalStateAndFencesLateReceipt() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareSignOutDraft();
        clickWatchlistAction("Save watchlist");
        awaitPage("invented save commits with an uncertain acknowledgement",
            "document.body.textContent.includes('The save result is uncertain.') && " + DIAGNOSTICS + ".save === 1" +
            " && " + DIAGNOSTICS + ".reviewSaveCommits === 1");
        click("#managed-signout-open");
        assertSignOutReview("Check this save before signing out", "The save result is uncertain.");
        awaitPage("uncertain review explains server outcome and later read",
            "document.querySelector('#managed-signout-review p')?.textContent.includes('The server may already have saved it.')" +
            " && document.querySelector('#managed-signout-review p')?.textContent.includes('Sign in again and load the saved version')");
        assertSignOutDraft();
        assertSignOutSavedPayload();
        retainSignOutReviewScreenshot("signoutUncertainReview", "managed-signout-stay");
        click("#managed-signout-stay");
        awaitPage("uncertain review cancellation retains recovery without signing out",
            "document.querySelector('#managed-signout-review') === null && document.activeElement?.id === 'managed-signout-open'");
        assertSignOutDraft();
        assertSignOutCounts(1, 0, 1, 0, 0);
        Log.i("ManagedSignOut", "phase=uncertain-kept; " + pageDiagnostic());

        clickWatchlistAction("Reconcile pending save");
        awaitPage("original command reconciliation is held", DIAGNOSTICS + ".save === 2" +
            " && document.body.textContent.includes('Reconciling the original save')");
        click("#managed-signout-open");
        assertSignOutReview("Check this save before signing out", "The save result is uncertain.");
        assertSignOutDraft();
        assertSignOutCounts(2, 0, 1, 0, 0);
        retainSignOutReviewScreenshot("signoutReconcilingReview", "managed-signout-stay");
        click("#managed-signout-confirm");
        assertSignOutCleared();
        assertSignOutCounts(2, 1, 1, 0, 1);
        assertSignOutSavedPayload();
        Log.i("ManagedSignOut", "phase=confirmed-cleared; " + pageDiagnostic());
        click("#settle-signout-save");
        awaitPage("one late reconciliation receipt settled", DIAGNOSTICS + ".reviewSaveSettled === 1");
        assertSignOutCleared();
        assertSignOutCounts(2, 1, 1, 1, 1);
        assertSignOutSavedPayload();
        assertEquals("Late reconciliation cannot reload the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedSignOut", "phase=late-receipt-ignored; " + pageDiagnostic());
    }

    private void prepareSignOutDraft() throws Exception {
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", SIGNOUT_NOTE);
        selectWatchlistNote(1);
        click("button[aria-label='Move ONE up']");
        selectWatchlistNote(1);
        assertSignOutDraft();
    }

    private void assertSignOutDraft() throws Exception {
        awaitPage("exact sign-out note and order remain mounted",
            "" + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(SIGNOUT_NOTE) +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e=>e.textContent).join(',') === 'ONE,ZERO'");
    }

    private void assertSignOutReview(String heading, String explanation) throws Exception {
        awaitPage("current sign-out review and safe initial focus",
            "document.querySelector('#managed-signout-review h2')?.textContent === " + JSONObject.quote(heading) +
            " && document.querySelector('#managed-signout-review p')?.textContent.includes(" + JSONObject.quote(explanation) + ")" +
            " && document.activeElement?.id === 'managed-signout-stay'" +
            " && document.querySelector('#managed-signout-open')?.getAttribute('aria-expanded') === 'true'" +
            " && document.querySelector('#managed-signout-confirm')?.disabled === false");
    }

    private void assertSignOutCounts(int saves, int aborted, int commits, int settled, int signOuts) throws Exception {
        awaitPage("bounded sign-out scenario counts",
            DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".reviewSaveAborted === " + aborted +
            " && " + DIAGNOSTICS + ".reviewSaveCommits === " + commits + " && " + DIAGNOSTICS + ".reviewSaveSettled === " + settled +
            " && " + DIAGNOSTICS + ".signOut === " + signOuts +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1" +
            " && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".eodAborted === 0 && " + DIAGNOSTICS + ".eodLateResolved === 0" +
            " && " + DIAGNOSTICS + ".marketsAborted === 0 && " + DIAGNOSTICS + ".marketsLateResolved === 0");
    }

    private void assertSignOutSavedPayload() throws Exception {
        awaitPage("sign-out leaves the exact invented saved note and order intact",
            "(() => { const saved=JSON.parse(document.querySelector('#fixture-signout-saved').textContent);" +
            " return saved.version === 2 && saved.payload.name === 'My Watchlist' && saved.payload.schemaVersion === 1" +
            " && saved.payload.memberships.length === 2 && saved.payload.memberships[0].listingId === 'listing-one'" +
            " && saved.payload.memberships[0].note === 'Invented second note' && saved.payload.memberships[1].listingId === 'listing-zero'" +
            " && saved.payload.memberships[1].note === " + JSONObject.quote(SIGNOUT_NOTE) + "; })()");
    }

    private void assertSignOutCleared() throws Exception {
        awaitPage("signed-out workspace stays cleared without a sign-out review",
            "document.body.textContent.includes('Signed out. All three local drafts have been cleared.')" +
            " && document.querySelector('.managed-navigation') === null && document.querySelector('.managed-search-bar') === null" +
            " && document.querySelector('#managed-note-0') === null && document.querySelector('#managed-note-1') === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && " + DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false" +
            " && document.querySelector('#managed-signout-review') === null && document.querySelector('.managed-company-visit') === null");
    }

    private void retainSignOutReviewScreenshot(String name, String focusedId) throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('#managed-signout-review')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Sign-out review did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const targets=Array.from(document.querySelectorAll('#managed-signout-review h2, #managed-signout-review p, #managed-signout-review button'));" +
            " const v=visualViewport; return v && targets.length === 5 && targets.every(e=>{const r=e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft+v.width && r.top >= v.offsetTop && r.bottom <= v.offsetTop+v.height;});})()";
        awaitPage("entire sign-out explanation and both actions visible before capture", visible);
        retainScreenshot(name);
        String focus = focusedId.isEmpty() ? "document.activeElement === document.body" : "document.activeElement?.id === " + JSONObject.quote(focusedId);
        awaitPage("entire sign-out review and focus retained through capture", visible + " && " + focus);
        assertSignOutDraft();
        Log.i("ManagedSignOut", "phase=" + name + "; " + pageDiagnostic());
    }

    @Test
    public void companyLinkDirectEntryAndBackPreserveDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        assertCompanyHistory("listing-zero", "annual", true);
        awaitPage("cold Annual link admits exact ZERO without fabricated source evidence",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-company-identity strong')?.textContent === 'Zero Company'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Zero Class A · Class A · XNAS'" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null" +
            " && document.activeElement?.id === 'managed-annual-heading'");
        assertCompanyLinkCounts();
        typeIntoInput("managed-research-note", NOTE);
        click(".managed-company-sections button[aria-label='Price section for ZERO']");
        awaitPage("cold link Price switch retains only the draft",
            "document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('.managed-eod-history .managed-metadata') === null" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE));
        assertCompanyHistory("listing-zero", "price", true);
        assertCompanyLinkCounts();
        click(".managed-company-sections button[aria-label='Annual section for ZERO']");
        awaitPage("cold link returns to unloaded Annual with its shared draft",
            "document.activeElement?.id === 'managed-annual-heading'" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE));
        assertCompanyHistory("listing-zero", "annual", true);
        assertCompanyLinkCounts();
        pressBack();
        awaitPage("one native Back from a cold company link uses the Markets fallback",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'Markets'" +
            " && document.activeElement === document.querySelector('.managed-navigation [aria-current=page]')");
        assertRootHistory();
        assertCompanyLinkCounts();
        selectWorkspaceView("My Watchlist");
        awaitPage("cold-link Back retains exact unsaved note and membership order",
            "" + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
        pressBack();
        assertRootHistory();
        assertCompanyLinkCounts();
        assertFixtureBoundary(1);
        assertEquals("Cold company navigation preserves the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedCompanyLink", "phase=cold-link-back-draft-retained; " + pageDiagnostic());
    }

    private void assertCompanyLinkCounts() throws Exception {
        awaitPage("company URL and board resolve metadata without research or writes",
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1" +
            " && " + DIAGNOSTICS + ".resolve === 1 && " + DIAGNOSTICS + ".search === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0" +
            " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".token === 0" +
            " && " + DIAGNOSTICS + ".signOut === 0 && " + DIAGNOSTICS + ".aborted === 0" +
            " && " + DIAGNOSTICS + ".lateResolved === 0 && " + DIAGNOSTICS + ".eodAborted === 0" +
            " && " + DIAGNOSTICS + ".eodLateResolved === 0 && " + DIAGNOSTICS + ".marketsAborted === 0" +
            " && " + DIAGNOSTICS + ".marketsLateResolved === 0");
    }

    @Test
    public void annualBackPreservesDraftAndRootBackDoesNothing() throws Exception {
        prepareDraftAndOpenAnnual();
        awaitPage("opening Annual performs no read", DIAGNOSTICS + ".annual === 0");
        pressBack();
        assertClosedDraft(true);
        assertReturnedRootHistory("listing-zero", "annual");
        pressBack();
        // Installed App defaults to a no-op at root. It must not exit or reopen Annual.
        assertClosedDraft(true);
        assertReturnedRootHistory("listing-zero", "annual");
        assertFixtureBoundary();
    }

    @Test
    public void preparedCompanyReportUsesSystemPickerAndPreservesDraft() throws Exception {
        android.content.Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(appContext);
        double documentTimeOrigin = readDocumentTimeOrigin();
        String note = "Unsaved Café 東京 📈 with exact whitespace  ";
        WatchlistSystemPicker picker = new WatchlistSystemPicker();
        try {
            prepareDraftAndOpenAnnual();
            click(".managed-annual-report .trial-actions button:first-child");
            awaitPage("one explicit Annual source is ready for native report saving",
                DIAGNOSTICS + ".annual === 1 && document.querySelector('.managed-annual-report .sec-quarterly-comparison') !== null");
            replaceReportNoteWithNativeIme(NOTE, note);
            click(".managed-company-report > summary");
            prepareNativeCompanyReport(note);
            awaitPage("native report inspection starts closed and never creates a browser download action",
                "document.querySelector('.managed-report-document')?.open === false && " +
                "document.querySelector('#managed-report-document') === null && " +
                "!document.querySelector('.managed-report-delivery')?.textContent.includes('Download report (JSON)')");
            click(".managed-report-document > summary");
            awaitPage("the complete prepared JSON contains the exact unsaved Unicode draft and loaded source",
                "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly || !field.value) return false;" +
                " const report = JSON.parse(field.value); return report.authoredResearch.note === " + JSONObject.quote(note) +
                " && report.purpose === 'investment.company-research' && report.schemaVersion === '5.0.0'" +
                " && report.listing.listingId === 'listing-zero' && report.listing.symbol === 'ZERO' && report.listing.exchangeMic === 'XNAS'" +
                " && report.sources.annual.response.evidence.generation.completedAt === '2026-09-20T00:00:02.000Z'" +
                " && report.sources.price.status === 'not_loaded' && report.sources.filings.status === 'not_loaded'; })()");
            String expectedText = readFixtureString("document.querySelector('#managed-report-document').value");
            JSONObject report = new JSONObject(expectedText);
            String filename = "Investment-research-ZERO-XNAS-" + report.getString("preparedAt").replaceAll("[-:.]", "") + ".json";
            click(".managed-report-document > summary");
            awaitPage("closing inspection does not remove the current native Save action",
                "document.querySelector('#managed-report-document') === null && " +
                "document.querySelector('.managed-report-delivery button')?.disabled === false");
            click(".managed-report-delivery button");
            picker.cancel();
            awaitPage("cancelled report picker returns to the same prepared draft",
                "document.querySelector('.managed-report-delivery [role=status]')?.textContent === 'Report save cancelled.'");
            assertEquals(0, WatchlistTestDocuments.outputs(appContext).length);
            assertNativeReportDraftAndReads(documentTimeOrigin, note);
            click(".managed-report-delivery button");
            picker.saveToInventedRoot();
            awaitPage("native report writer confirms the explicitly chosen document",
                "document.querySelector('.managed-report-delivery [role=status]')?.textContent === " +
                JSONObject.quote("Saved report " + filename + " to the chosen document."));
            WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(appContext);
            assertEquals(1, outputs.length);
            assertEquals(filename, outputs[0].name);
            assertArrayEquals(expectedText.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.readReport(appContext, outputs[0]));
            click("#fixture-report-replay");
            awaitPage("wrong operations, wrong handles, duplicate picker and consumed report handle all refuse",
                "(() => { const state = JSON.parse(document.querySelector('#fixture-report-protocol').textContent);" +
                " return state.mismatchRefused === 2 && state.duplicateRefused === 1 && state.replayRefused === 1 && !state.protocolError; })()");
            assertArrayEquals(expectedText.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.readReport(appContext, outputs[0]));
            assertNativeReportDraftAndReads(documentTimeOrigin, note);
            retainAnnualNoteFrame("companyReportSaved", ".managed-report-delivery",
                ".managed-report-delivery > p, .managed-report-delivery > .managed-report-delivery-actions > button", 3);
            for (String kind : new String[] { "maximum", "oversize", "unicode", "purpose", "filename" }) {
                WatchlistTestDocuments.clear(appContext);
                JSONObject started = startNativeReportProbe(kind, picker);
                picker.saveToInventedRoot();
                assertNativeReportProbe(appContext, kind, started);
                assertNativeReportDraftAndReads(documentTimeOrigin, note);
            }
            WatchlistTestDocuments.clear(appContext);
            int priorCancels = new JSONObject(readFixtureString(
                "document.querySelector('#fixture-report-protocol').textContent")).getInt("cancelsSettled");
            WatchlistTestDocuments.armReportOpen(appContext);
            click(".managed-report-delivery button");
            picker.saveToInventedRoot();
            awaitNativeReportOpenEntered(appContext);
            android.os.Bundle enteredOpen = WatchlistTestDocuments.reportOpenState(appContext);
            assertTrue(enteredOpen.getBoolean("armed") && enteredOpen.getBoolean("entered"));
            String heldGeneration = enteredOpen.getString("generation");
            assertNotNull(heldGeneration);
            String openingNote = "Changed while opening report destination";
            replaceReportNoteWithNativeIme(note, openingNote);
            awaitPage("the edited report retires and native cancellation acknowledges before the provider is released",
                "document.querySelector('.managed-report-delivery') === null && " +
                "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).cancelsSettled > " + priorCancels);
            awaitPage("the held write has not settled before its explicit release",
                "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).writesSettled === 1");
            WatchlistTestDocuments.releaseReportOpen(appContext);
            awaitPage("cancelled held-open report write settles without restoring a delivery action",
                "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).writesSettled === 2 && " +
                "document.querySelector('.managed-report-delivery') === null");
            android.os.Bundle releasedOpen = WatchlistTestDocuments.reportOpenState(appContext);
            assertEquals(heldGeneration, releasedOpen.getString("generation"));
            assertTrue("The same held provider must return its descriptor after normal release: " + releasedOpen,
                releasedOpen.getBoolean("armed") && releasedOpen.getBoolean("entered") &&
                releasedOpen.getBoolean("releasedNormally") && releasedOpen.getBoolean("descriptorReturned") &&
                !releasedOpen.getBoolean("timedOut") && !releasedOpen.getBoolean("reset"));
            assertEmptyNativeReportDestination(appContext);
            assertNativeReportDraftAndReads(documentTimeOrigin, openingNote);
            prepareNativeCompanyReport(openingNote);
            WatchlistTestDocuments.clear(appContext);
            click("#fixture-report-edit");
            click(".managed-report-delivery button");
            picker.saveToInventedRoot();
            awaitPage("an intervening actual draft edit fences the late chosen report destination",
                DRAFT + ".memberships?.[1]?.note === 'Changed after report choice' && " +
                "document.querySelector('.managed-report-delivery') === null && document.querySelector('#managed-report-document') === null");
            assertEmptyNativeReportDestination(appContext);
            assertNativeReportDraftAndReads(documentTimeOrigin, "Changed after report choice");
            prepareNativeCompanyReport("Changed after report choice");
            WatchlistTestDocuments.clear(appContext);
            click("#fixture-report-retire");
            click(".managed-report-delivery button");
            picker.saveToInventedRoot();
            awaitPage("retired session fences the chosen report and clears the authored draft",
                DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " +
                "document.querySelector('.managed-report-delivery') === null && document.querySelector('#managed-report-document') === null");
            assertEmptyNativeReportDestination(appContext);
            assertNativeReportReadCounts();
            assertEquals(documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
            assertFixtureBoundary();
            WatchlistTestDocuments.clear(appContext);
            click("#fixture-report-choose-only");
            picker.saveToInventedRoot();
            awaitPage("one unwritten report handle awaits recreation",
                "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).choice?.handle?.length === 36");
            JSONObject choice = new JSONObject(readFixtureString(
                "JSON.stringify(JSON.parse(document.querySelector('#fixture-report-protocol').textContent).choice)"));
            assertRecreatedReportHandleRefused(choice);
            assertEmptyNativeReportDestination(appContext);
        } finally {
            WatchlistTestDocuments.clear(appContext);
        }
    }

    private void prepareNativeCompanyReport(String note) throws Exception {
        click(".managed-company-report .trial-actions button:first-child");
        awaitPage("explicit preparation enables a full-size native Save control for the exact current note",
            "document.querySelector('#managed-prepared-report-heading')?.textContent === 'Research report · ZERO' && " +
            "document.querySelector('.managed-company-report-note')?.textContent === " + JSONObject.quote(note) + " && " +
            "document.querySelector('.managed-report-delivery button')?.textContent === 'Save report (JSON)' && " +
            "document.querySelector('.managed-report-delivery button')?.disabled === false && " +
            "document.querySelector('.managed-report-delivery button')?.getBoundingClientRect().height >= 44");
    }

    /** Commit invented Unicode through the real focused native IME connection, not DOM assignment. */
    private void replaceReportNoteWithNativeIme(String expectedBefore, String note) throws Exception {
        touchInput("managed-research-note");
        awaitNativeEditor("managed-research-note");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder()
            .withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        awaitPage("native select-all covers the original exact report note",
            "document.activeElement === document.querySelector('#managed-research-note') && " +
            "document.activeElement.value === " + JSONObject.quote(expectedBefore) + " && " +
            "document.activeElement.selectionStart === 0 && document.activeElement.selectionEnd === " + expectedBefore.length());
        awaitNativeEditor("managed-research-note");
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "commit the exact invented report note through native IME"; }
            @Override public void perform(UiController controller, View view) {
                assertTrue(view.hasFocus() && view.hasWindowFocus());
                android.view.inputmethod.InputConnection input = ((WebView) view).onCreateInputConnection(
                    new android.view.inputmethod.EditorInfo());
                assertNotNull("The actual WebView editor must supply a native connection", input);
                assertTrue("Native IME commit must dispatch", input.commitText(note, 1));
                controller.loopMainThreadUntilIdle();
            }
        });
        awaitPage("native Unicode input preserves the raw authored note and trailing whitespace",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(note) + " && " +
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(note));
        closeSoftKeyboard();
    }

    private void assertNativeReportDraftAndReads(double documentTimeOrigin, String note) throws Exception {
        awaitPage("report delivery preserves the exact unsaved draft and makes no source or Save request",
            DRAFT + ".dirty === true && " + DRAFT + ".baseVersion === 1 && " +
            DRAFT + ".memberships?.length === 2 && " +
            DRAFT + ".memberships?.[0]?.listingId === 'listing-one' && " +
            DRAFT + ".memberships?.[0]?.note === 'Invented second note' && " +
            DRAFT + ".memberships?.[1]?.listingId === 'listing-zero' && " +
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(note));
        assertNativeReportReadCounts();
        assertEquals("Same Activity report picker return preserves the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private void assertNativeReportReadCounts() throws Exception {
        awaitPage("report writing makes no automatic source, account or watchlist Save request",
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 1 && " +
            DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 0 && " +
            DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".token === 0");
    }

    private void awaitNativeReportOpenEntered(android.content.Context context) throws Exception {
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        while (SystemClock.uptimeMillis() < deadline) {
            if (WatchlistTestDocuments.reportOpenEntered(context)) return;
            long remaining = deadline - SystemClock.uptimeMillis();
            if (remaining > 0) Thread.sleep(Math.min(50, remaining));
        }
        fail("The real report provider did not enter its held open before the existing page deadline");
    }

    private JSONObject startNativeReportProbe(String kind, WatchlistSystemPicker picker) throws Exception {
        AtomicReference<WebView> page = new AtomicReference<>();
        scenario.onActivity(activity -> page.set(activity.getBridge().getWebView()));
        click("#fixture-report-" + kind);
        picker.awaitOpen();
        // The digest is asynchronous. Observe the retained page only after the actual picker opens.
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> page.get().evaluateJavascript(
            "JSON.stringify(JSON.parse(document.querySelector('#fixture-report-protocol').textContent).probe)",
            value -> { result.set(value); returned.countDown(); }));
        assertTrue("Report probe metadata must return while DocumentsUI owns the foreground", returned.await(2, TimeUnit.SECONDS));
        Object decoded = new org.json.JSONTokener(result.get()).nextValue();
        assertTrue(decoded instanceof String);
        JSONObject started = new JSONObject((String) decoded);
        assertEquals(kind, started.getString("kind"));
        assertEquals("choosing", started.getString("phase"));
        assertTrue(started.isNull("error"));
        assertTrue(started.getString("sha256").matches("[0-9a-f]{64}"));
        assertTrue(started.getInt("byteLength") > 0);
        return started;
    }

    private void assertNativeReportProbe(android.content.Context context, String kind, JSONObject started) throws Exception {
        String expectedOutcome = kind.equals("maximum") ? "written" : "refused";
        awaitPage("the current complete report boundary probe settles with its expected outcome",
            "(() => { const probe = JSON.parse(document.querySelector('#fixture-report-protocol').textContent).probe;" +
            " return probe.kind === " + JSONObject.quote(kind) + " && probe.phase === 'settled' && probe.error === null" +
            " && probe.outcome === " + JSONObject.quote(expectedOutcome) +
            " && probe.sha256 === " + JSONObject.quote(started.getString("sha256")) + "; })()");
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
        assertEquals(1, outputs.length);
        if (kind.equals("maximum")) {
            byte[] bytes = WatchlistTestDocuments.readReport(context, outputs[0]);
            assertEquals(InvestmentCompanyReportPlugin.MAX_REPORT_BYTES, started.getInt("byteLength"));
            assertEquals(InvestmentCompanyReportPlugin.MAX_REPORT_BYTES, bytes.length);
            assertEquals(started.getString("sha256"), java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(bytes)));
            JSONObject document = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
            assertEquals("investment.company-research", document.getString("purpose"));
            assertEquals("Café 東京 📈", document.getJSONObject("authoredResearch").getString("note"));
        } else {
            assertEquals("Invalid report input must not write any chosen-file bytes", 0, outputs[0].size);
        }
    }

    private void assertEmptyNativeReportDestination(android.content.Context context) {
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
        assertEquals(1, outputs.length);
        assertEquals("The picker may create a destination, but the retired report must not write", 0, outputs[0].size);
    }

    private void assertRecreatedReportHandleRefused(JSONObject choice) throws Exception {
        AtomicReference<com.getcapacitor.Plugin> previous = new AtomicReference<>();
        scenario.onActivity(activity -> {
            previous.set(activity.getBridge().getPlugin("InvestmentCompanyReport").getInstance());
            assertNull(((InvestmentCompanyReportPlugin) previous.get()).saveInstanceState());
        });
        scenario.recreate();
        CompletableFuture<String> result = new CompletableFuture<>();
        com.getcapacitor.JSObject options = new com.getcapacitor.JSObject()
            .put("operationId", choice.getString("operationId"))
            .put("handle", choice.getString("handle")).put("text", "Must not be written");
        com.getcapacitor.PluginCall probe = new com.getcapacitor.PluginCall(
            null, "InvestmentCompanyReport", "invented-report-recreation-probe", "write", options) {
            @Override public void reject(String message, String code) { result.complete(code); }
            @Override public void resolve(com.getcapacitor.JSObject value) { result.complete("unexpected_write"); }
        };
        scenario.onActivity(activity -> {
            InvestmentCompanyReportPlugin current = (InvestmentCompanyReportPlugin)
                activity.getBridge().getPlugin("InvestmentCompanyReport").getInstance();
            assertNotSame(previous.get(), current);
            assertNull(current.saveInstanceState());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            current.write(probe);
            activity.getBridge().setServerBasePath(fixtureDirectory.getAbsolutePath());
        });
        assertEquals("invalid_handle", result.get(2, TimeUnit.SECONDS));
        awaitPage("recreated fixture restores no chosen report or prepared report state",
            "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).choice === null && " +
            "document.querySelector('.managed-report-delivery') === null && " +
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".save === 0 && " +
            DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0", true);
        assertFixtureBoundary();
    }

    @Test
    public void loadedCompanySnapshotKeepsSeparateEvidenceWithoutAutomaticReads() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareDraftAndOpenAnnual();
        assertCompanySourceOverview(false, false, false);
        String snapshot = "document.querySelector('.managed-company-snapshot')";
        awaitPage("snapshot starts closed without fetching either source",
            snapshot + "?.open === false && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0");
        click(".managed-company-snapshot > summary");
        awaitPage("opening snapshot keeps both sources unloaded", snapshot + ".open && " +
            snapshot + ".textContent.includes('No close history loaded') && " +
            snapshot + ".textContent.includes('No annual evidence loaded') && " +
            DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0");
        click(".managed-snapshot-grid > section[aria-label='Snapshot price'] > button");
        awaitPage("snapshot Price action navigates without fetching",
            "document.querySelector('#managed-eod-heading') !== null && " + DIAGNOSTICS + ".eod === 0");
        click(".managed-company-evidence-actions [aria-label='Annual source'] .trial-actions button:last-child");
        awaitPage("overview Inspect Annual navigates without a source read",
            "document.querySelector('#managed-annual-heading') !== null && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0");
        click(".managed-company-evidence-actions [aria-label='Price source'] .trial-actions button:first-child");
        awaitPage("snapshot keeps exact loaded raw-close dates and basis",
            snapshot + ".open && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".annual === 0 && " +
            "document.querySelector('[aria-label=\"Snapshot price\"] dl')?.textContent === 'Last raw close · USD101.5Trading date2026-09-19' && " +
            snapshot + ".textContent.includes('2026-08-20 to 2026-09-20') && " +
            snapshot + ".textContent.includes('2026-09-20T00:00:01.000Z') && " +
            snapshot + ".textContent.includes('unadjusted for splits or dividends') && " +
            snapshot + ".textContent.includes('No annual evidence loaded')");
        awaitPage("snapshot range retains both exact closes, dates and actual loaded coverage",
            observedCloseRangeAt(".managed-company-snapshot [aria-label='Snapshot price'] .managed-observed-close-range",
                "One month", 2, "2026-09-18", "2026-09-19", "101.5", "2026-09-19", "100.25", "2026-09-18"));
        assertCompanySourceOverview(true, false, false);
        retainAnnualNoteFrame("companySnapshotPrice", "[aria-label='Snapshot price'] h3",
            "[aria-label='Snapshot price'] > h3, [aria-label='Snapshot price'] > dl", 2);
        click(".managed-snapshot-grid > section[aria-label='Snapshot annual'] > button");
        awaitPage("snapshot Annual action navigates without fetching",
            "document.querySelector('#managed-annual-heading') !== null && " + DIAGNOSTICS + ".annual === 0");
        click(".managed-company-evidence-actions [aria-label='Price source'] .trial-actions button:last-child");
        awaitPage("overview Inspect Price keeps the loaded packet and performs no new read",
            "document.querySelector('#managed-eod-heading') !== null && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".filings === 0");
        click(".managed-company-evidence-actions [aria-label='Annual source'] .trial-actions button:first-child");
        String basis = "[aria-label='Snapshot revenue basis Revenues']";
        awaitPage("snapshot combines separately loaded evidence without changing original dates",
            snapshot + ".open && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " +
            "Array.from(document.querySelectorAll(\"" + basis + " dd\")).map(e => e.textContent).join('|') === '1000|100|10%' && " +
            snapshot + ".textContent.includes('2025-01-01 to 2025-12-31') && " +
            snapshot + ".textContent.includes('2026-09-20T00:00:02.000Z') && " +
            snapshot + ".textContent.includes('101.5') && " +
            snapshot + ".textContent.includes('Operating cash flow') && " +
            snapshot + ".textContent.includes('Current ratio') && " +
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE));
        assertCompanySourceOverview(true, true, false);
        retainAnnualNoteFrame("companySnapshotAnnualBasis", basis + " > h4",
            basis + " > h4, " + basis + " > div > p, " + basis + " > div > dl", 3);
        click(".managed-snapshot-grid > section[aria-label='Snapshot filings'] > button");
        awaitPage("snapshot Filings action navigates without fetching",
            "document.querySelector('#managed-filings-heading') !== null && " + DIAGNOSTICS + ".filings === 0");
        click(".managed-company-evidence-actions [aria-label='Annual source'] .trial-actions button:last-child");
        awaitPage("overview Inspect Annual keeps both loaded packets and performs no Filings read",
            "document.querySelector('#managed-annual-heading') !== null && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".filings === 0");
        click(".managed-company-evidence-actions [aria-label='Filings source'] .trial-actions button:first-child");
        String filingCard = "[aria-label='Snapshot filings']";
        awaitPage("snapshot shows only observed metadata and retains separate evidence and the draft",
            snapshot + ".open && " + DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " +
            "document.querySelector(\"" + filingCard + "\")?.textContent.includes('Newest observed filing') && " +
            "document.querySelector(\"" + filingCard + "\")?.textContent.includes('2026-06-23 to 2026-09-20') && " +
            "document.querySelector(\"" + filingCard + "\")?.textContent.includes('26 loaded filings') && " +
            "document.querySelector(\"" + filingCard + "\")?.textContent.includes('2026-09-20T00:00:01.000Z') && " +
            snapshot + ".textContent.includes('101.5') && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE));
        retainAnnualNoteFrame("companySnapshotFilings", filingCard + " > h3",
            filingCard + " > h3, " + filingCard + " > p, " + filingCard + " .managed-watchlist-filings-summary", 3);
        assertCompanySourceOverview(true, true, true);
        retainAnnualNoteFrame("companyResearchSources", ".managed-company-evidence-actions [aria-label='Price source']",
            ".managed-company-evidence-actions [aria-label='Price source']", 1);
        assertPreparedCompanyReport();
        pressBack();
        assertClosedDraft(true);
        awaitPage("leaving company removes its snapshot", snapshot + " === null && document.querySelector('.managed-company-evidence-actions') === null");
        click(ANNUAL);
        awaitPage("a new company visit does not restore prior snapshot evidence",
            snapshot + "?.open === false && " + snapshot + ".textContent.includes('No close history loaded') && " +
            snapshot + ".textContent.includes('No annual evidence loaded') && " +
            snapshot + ".textContent.includes('No filing metadata loaded') && " +
            DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".save === 0");
        awaitPage("new company visit starts without a prepared report",
            "document.querySelector('.managed-company-report')?.open === false && document.querySelector('#managed-prepared-report-heading') === null");
        assertCompanySourceOverview(false, false, false);
        assertEquals(documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private void assertCompanySourceOverview(boolean priceLoaded, boolean annualLoaded, boolean filingsLoaded) throws Exception {
        awaitPage("overview keeps exact independent source states, original dates and explicit actions",
            "(() => { const overview = document.querySelector('.managed-company-evidence-actions');" +
            " const expected = [['Price'," + priceLoaded + ",'2026-09-20T00:00:01.000Z'],['Annual'," + annualLoaded + ",'2026-09-20T00:00:02.000Z'],['Filings'," + filingsLoaded + ",'2026-09-20T00:00:02.000Z']];" +
            " return overview?.getAttribute('aria-label') === 'Company research sources' && overview.querySelectorAll('.managed-evidence-action-grid > section').length === 3" +
            " && expected.every(([title,loaded,clock]) => { const card = overview.querySelector('[aria-label=\"' + title + ' source\"]'); const buttons = [...(card?.querySelectorAll('.trial-actions > button') ?? [])]; const times = [...(card?.querySelectorAll('time') ?? [])];" +
            " return card?.getAttribute('aria-busy') === 'false' && card.querySelector('.managed-evidence-source-state')?.textContent === (loaded ? 'Source response loaded.' : 'Not loaded.')" +
            " && times.length === (loaded ? 1 : 0) && (!loaded || (times[0].dateTime === clock && times[0].textContent === clock))" +
            " && buttons.length === 2 && buttons[0].textContent === (loaded ? 'Refresh ' : 'Load ') + title + (title === 'Price' ? ' · One month' : '') && buttons[1].textContent === 'Inspect ' + title" +
            " && buttons.every(button => !button.disabled && button.getBoundingClientRect().height >= 44 && button.getBoundingClientRect().width >= 44); })" +
            " && overview.querySelector('[aria-label=\"Price source\"]')?.textContent.includes('Requested range: One month.')" +
            " && " + (priceLoaded ? "overview.querySelector('[aria-label=\"Price source\"]')?.textContent.includes('Loaded range: One month.')" : "!overview.querySelector('[aria-label=\"Price source\"]')?.textContent.includes('Loaded range:')") +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
    }

    private void assertPreparedCompanyReport() throws Exception {
        click(".managed-company-report > summary");
        awaitPage("opening report makes no request or saved change",
            "document.querySelector('#managed-prepared-report-heading') === null && " +
            DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".save === 0");
        click(".managed-company-report .trial-actions button:first-child");
        String report = "document.querySelector('.managed-company-report')";
        awaitPage("explicit prepared report keeps exact authored draft and original source dates",
            "document.querySelector('#managed-prepared-report-heading')?.textContent === 'Research report · ZERO' && " +
            "document.querySelector('.managed-company-report-note')?.textContent === " + JSONObject.quote(NOTE) + " && " +
            report + ".textContent.includes('2026-08-20 to 2026-09-20') && " +
            report + ".textContent.includes('2026-09-20T00:00:02.000Z') && " +
            report + ".textContent.includes('2026-06-23 to 2026-09-20') && " +
            report + ".textContent.includes('Preparation does not renew the source dates') && " +
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) + " && " + DIAGNOSTICS + ".save === 0");
        awaitPage("captured report has no overview source request or Cancel actions",
            "document.querySelector('.managed-company-report .managed-company-evidence-actions') === null && " +
            "[...document.querySelectorAll('.managed-company-report button')].every(button => !/^(Load|Refresh|Cancel|Inspect) (Price|Annual|Filings)(?: ·|$)/.test(button.textContent.trim())) && " +
            DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".save === 0");
        retainAnnualNoteFrame("companyResearchReport", "#managed-prepared-report-heading",
            "#managed-prepared-report-heading, #managed-report-note-heading, .managed-company-report-note", 3);
        assertPreparedReportDocument();
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", NOTE, NOTE + " changed");
        awaitPage("intervening draft edit immediately removes the prepared report",
            "document.querySelector('#managed-prepared-report-heading') === null && " +
            "document.querySelector('.managed-company-report-note') === null && " +
            "document.querySelector('#managed-report-document') === null && " +
            report + ".textContent.includes('Prepare a new report')");
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", NOTE + " changed", NOTE);
        awaitPage("restoring a note does not silently restore the old report",
            "document.querySelector('#managed-prepared-report-heading') === null && " +
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) + " && " +
            DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".save === 0");
    }

    private void assertPreparedReportDocument() throws Exception {
        awaitPage("report document starts closed with no serialized textarea",
            "document.querySelector('.managed-report-document')?.open === false && " +
            "document.querySelector('#managed-report-document') === null");
        click(".managed-report-document > summary");
        awaitPage("report JSON retains the exact draft, complete admitted packets and source clocks",
            "(() => { const field = document.querySelector('#managed-report-document'); " +
            "if (!field?.readOnly || !field.value) return false; const value = JSON.parse(field.value); " +
            "return value.purpose === 'investment.company-research' && value.schemaVersion === '5.0.0' && " +
            "value.authoredResearch.status === 'watchlist_draft' && value.authoredResearch.note === " + JSONObject.quote(NOTE) + " && " +
            "value.listing.listingId === 'listing-zero' && value.listing.symbol === 'ZERO' && " +
            "value.sources.price.response.completedAt === '2026-09-20T00:00:01.000Z' && " +
            "value.sources.annual.response.evidence.generation.completedAt === '2026-09-20T00:00:02.000Z' && " +
            "value.sources.filings.response.completedAt === '2026-09-20T00:00:02.000Z' && " +
            "document.querySelector('.managed-report-delivery button')?.textContent === 'Save report (JSON)' && " +
            "document.querySelector('.managed-report-delivery button')?.disabled === false && " +
            "value.sources.annual.financials.cashGeneration.resolution !== undefined && " +
            "value.sources.annual.financials.liquidity.resolution !== undefined && " +
            "Array.isArray(value.sources.annual.response.evidence.facts.observations) && value.sources.annual.response.evidence.facts.scans.length === 32 && " +
            "Array.isArray(value.sources.filings.response.issuer.filings) && " +
            "value.sources.filings.response.window.fromDate === '2026-06-23' && " +
            DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".save === 0; })()");
        retainAnnualNoteFrame("companyResearchDocument", ".managed-report-document > summary",
            ".managed-report-document > summary, #managed-report-document-scope, label[for='managed-report-document'], #managed-report-document", 4);
    }

    @Test
    public void annualBackAbortsPendingReadAndDiscardsLateResult() throws Exception {
        prepareDraftAndOpenAnnual();
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("one pending invented Annual read", DIAGNOSTICS + ".annual === 1 && " +
            DIAGNOSTICS + ".aborted === 0 && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'");
        pressBack();
        awaitPage("Back aborts the exact pending read", DIAGNOSTICS + ".aborted === 1");
        assertClosedDraft(true);
        click("#settle-cancelled-read");
        awaitPage("late synthetic response settled", DIAGNOSTICS + ".lateResolved === 1");
        assertClosedDraft(false);
        awaitPage("late completion has not created report values",
            "document.querySelector('.managed-annual-report') === null && " +
            DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".aborted === 1");
        assertReturnedRootHistory("listing-zero", "annual");
        assertFixtureBoundary();
    }

    @Test
    public void backgroundResumePreservesDraftAndAnnualCancellation() throws Exception {
        prepareDraftAndOpenAnnual();
        click(".managed-annual-report .trial-actions button:first-child");
        assertPendingAnnualDraft();
        assertFixtureReadCounts(1, 0, 0);
        assertCompanyHistory("listing-zero", "annual", false);
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
            assertTrue("The bridge must initially be active", activity.getBridge().getApp().isActive());
            Log.i("ManagedLifecycle", "phase=before-stop, documentTimeOrigin=" + documentTimeOrigin +
                ", activity=" + System.identityHashCode(activity) +
                ", webView=" + System.identityHashCode(activity.getBridge().getWebView()));
        });
        assertEquals(Lifecycle.State.RESUMED, scenario.getState());

        // Drive onPause/onStop without recreation. Do not evaluate JavaScript while stopped.
        scenario.moveToState(Lifecycle.State.CREATED);
        assertEquals(Lifecycle.State.CREATED, scenario.getState());
        scenario.onActivity(activity -> {
            assertNotNull("Stopping: original Activity was collected", originalActivity.get().get());
            assertNotNull("Stopping: original WebView was collected", originalWebView.get().get());
            assertSame("Stopping must preserve the Activity", originalActivity.get().get(), activity);
            assertSame("Stopping must preserve the WebView", originalWebView.get().get(), activity.getBridge().getWebView());
            assertFalse("onStop must mark the bridge inactive", activity.getBridge().getApp().isActive());
            Log.i("ManagedLifecycle", "phase=stopped, state=CREATED, active=false, activity=" +
                System.identityHashCode(activity) + ", webView=" + System.identityHashCode(activity.getBridge().getWebView()));
        });
        scenario.moveToState(Lifecycle.State.RESUMED);
        assertEquals(Lifecycle.State.RESUMED, scenario.getState());
        scenario.onActivity(activity -> {
            assertNotNull("Resume: original Activity was collected", originalActivity.get().get());
            assertNotNull("Resume: original WebView was collected", originalWebView.get().get());
            assertSame("Resume must preserve the Activity", originalActivity.get().get(), activity);
            assertSame("Resume must preserve the WebView", originalWebView.get().get(), activity.getBridge().getWebView());
            assertTrue("onResume must mark the bridge active", activity.getBridge().getApp().isActive());
            Log.i("ManagedLifecycle", "phase=resumed, state=RESUMED, active=true, activity=" +
                System.identityHashCode(activity) + ", webView=" + System.identityHashCode(activity.getBridge().getWebView()));
        });
        assertEquals("Resume must preserve the document time origin", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertPendingAnnualDraft();
        assertFixtureReadCounts(1, 0, 0);
        assertFixtureBoundary();
        assertCompanyHistory("listing-zero", "annual", false);
        Log.i("ManagedLifecycle", "phase=resumed-pending, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());

        pressBack();
        assertClosedDraft(true);
        assertFixtureReadCounts(1, 1, 0);
        click("#settle-cancelled-read");
        assertFixtureReadCounts(1, 1, 1);
        assertClosedDraft(false);
        assertReturnedRootHistory("listing-zero", "annual");
        pressBack();
        assertClosedDraft(false);
        assertFixtureReadCounts(1, 1, 1);
        assertReturnedRootHistory("listing-zero", "annual");
        assertFixtureBoundary();
        assertEquals("Back must preserve the resumed document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedLifecycle", "phase=cancelled-late-discarded-root, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
    }

    @Test
    public void annualRefreshFailureKeepsReportUntilExplicitRecovery() throws Exception {
        click("#enable-refresh-scenario");
        prepareDraftAndOpenAnnual();
        click(".managed-annual-report .trial-actions button:first-child");
        assertRefreshReport(1, false, false, false);
        assertRefreshLiquiditySources(false);
        assertLiquidityNoteDraft(LIQUIDITY_NOTE_INITIAL, 1);
        Log.i("ManagedRefresh", "phase=initial; " + pageDiagnostic());

        click(".managed-annual-report .trial-actions button:first-child");
        assertRefreshReport(2, true, true, false);
        awaitPage("refresh action disabled while pending",
            "document.querySelector('.managed-annual-report .trial-actions button:first-child')?.disabled === true");
        Log.i("ManagedRefresh", "phase=pending; " + pageDiagnostic());
        click("#fail-held-refresh");
        assertRefreshReport(2, true, false, false);
        awaitPage("refresh failure leaves an explicit retry", DIAGNOSTICS + ".refreshFailed === 1" +
            " && document.querySelector('.managed-annual-report [role=alert]')?.textContent.includes('refresh failed')" +
            " && document.querySelector('.managed-annual-report .trial-actions button:first-child')?.textContent === 'Refresh annual report'" +
            " && document.querySelector('.managed-annual-report .trial-actions button:first-child')?.disabled === false");
        Log.i("ManagedRefresh", "phase=failed-retained; " + pageDiagnostic());
        assertLiquidityNoteDraft(LIQUIDITY_NOTE_RETAINED, 2);
        retainRefreshFailureScreenshot();

        click(".managed-annual-report .trial-actions button:first-child");
        assertRefreshReport(3, false, false, true);
        assertRefreshLiquiditySources(true);
        assertLiquidityNoteDraft(LIQUIDITY_NOTE_ZERO, 3);
        awaitPage("successful refresh clears the old failure",
            "document.querySelector('.managed-annual-report [role=alert]') === null");
        Log.i("ManagedRefresh", "phase=recovered; " + pageDiagnostic());
        pressBack();
        assertClosedDraft(true);
        awaitPage("Back adds no API operation", DIAGNOSTICS + ".annual === 3 && " +
            DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".refreshFailed === 1");
        assertReturnedRootHistory("listing-zero", "annual");
        assertFixtureBoundary();
    }

    @Test
    public void catalogStartupFailureRecoversWithoutReloadOrDraftLoss() throws Exception {
        selectWorkspaceView("Discover");
        awaitPage("initial catalog failure offers Refresh catalog",
            "document.querySelector(" + JSONObject.quote(CATALOG_STATUS) + ")?.textContent === " + JSONObject.quote(CATALOG_FAILURE) +
            " && " + DIAGNOSTICS + ".catalogRecovery === true && " + DIAGNOSTICS + ".status === 1");
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("draft reordered before catalog recovery",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Discover");
        assertCatalogRecoveryState(1, 0, "", false, false, CATALOG_FAILURE);
        retainCatalogRecoveryScreenshot("catalogStartupFailure", CATALOG_REFRESH,
            CATALOG_REFRESH + ", " + CATALOG_STATUS);
        assertCatalogRecoveryState(1, 0, "", false, false, CATALOG_FAILURE);
        Log.i("ManagedCatalogRecovery", "phase=failed; " + pageDiagnostic());

        // Editing the query deliberately retires a catalog read and clears its error.
        // Enter it while idle; the pending-read checks below focus it without editing.
        typeIntoInput("workspace-company-query", "ZERO");
        assertCatalogRecoveryState(1, 0, "ZERO", false, false, "");
        click(CATALOG_REFRESH);
        assertCatalogRecoveryState(2, 0, "ZERO", true, false, "");
        touchInput("workspace-company-query");
        awaitPage("query remains focusable during catalog recovery",
            "document.activeElement === document.querySelector('#workspace-company-query')");
        awaitNativeEditor("workspace-company-query");
        closeSoftKeyboard();
        assertCatalogRecoveryState(2, 0, "ZERO", true, false, "");
        Log.i("ManagedCatalogRecovery", "phase=pending-query-focusable; " + pageDiagnostic());

        click("#release-catalog-recovery");
        assertCatalogRecoveryState(2, 0, "ZERO", false, true, "");
        click(".workspace-global-search button[type=submit]");
        assertCatalogRecoveryState(2, 1, "ZERO", false, true, "1 matching listings in this catalog.");
        retainCatalogRecoveryScreenshot("catalogRecovered", ".managed-results",
            ".managed-results strong, .managed-catalog-receipt > summary");
        assertCatalogRecoveryState(2, 1, "ZERO", false, true, "1 matching listings in this catalog.");
        scenario.onActivity(activity -> {
            assertNotNull("Original Activity was collected", originalActivity.get().get());
            assertNotNull("Original WebView was collected", originalWebView.get().get());
            assertSame("Catalog recovery must preserve the Activity", originalActivity.get().get(), activity);
            assertSame("Catalog recovery must preserve the WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("Catalog recovery must preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertRootHistory();
        assertFixtureBoundary();
        Log.i("ManagedCatalogRecovery", "phase=recovered, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
    }

    @Test
    public void watchlistComparisonUsesLoadedSharedDatesAndPreservesDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        String scope = ".managed-watchlist-comparison";
        String first = scope + " .managed-watchlist-comparison-listing:first-child select";
        String second = scope + " .managed-watchlist-comparison-listing:last-child select";
        String start = scope + " .managed-price-comparison-date:first-child select";
        String end = scope + " .managed-price-comparison-date:last-child select";
        awaitPage("comparison starts without a selected pair or reads",
            "Array.from(document.querySelectorAll('.managed-watchlist-comparison-listing select, .managed-watchlist-comparison .managed-price-comparison-date select')).every(e => e.value === '' && !e.disabled)" +
            " && document.querySelectorAll('.managed-watchlist-comparison-listing select, .managed-watchlist-comparison .managed-price-comparison-date select').length === 4" +
            " && document.querySelector('#managed-watchlist-comparison-note-destination')?.value === ''" +
            " && document.querySelector('label[for=managed-watchlist-comparison-note-destination]')?.textContent === 'Add comparison to'" +
            " && document.querySelector('.managed-watchlist-comparison-note-action > button')?.getAttribute('aria-disabled') === 'true'" +
            " && document.querySelector('.managed-watchlist-comparison .managed-price-comparison-status')?.textContent === 'Choose two distinct watchlist listings to compare.'" +
            " && " + DIAGNOSTICS + ".eod === 0");
        chooseNativeSelectOption(first, "listing-zero", "ZERO · Zero Company · Class A · XNAS — not loaded");
        chooseNativeSelectOption(second, "listing-one", "ONE · One Company · Class A · XNAS — not loaded");
        awaitPage("selection alone does not load either history",
            "document.querySelector('.managed-watchlist-comparison .managed-price-comparison-status')?.textContent === 'Comparison unavailable. Load both selected histories using their Dated price controls.'" +
            " && document.querySelector('.managed-watchlist-comparison table') === null && " + DIAGNOSTICS + ".eod === 0");
        typeIntoInput("managed-note-0", NOTE);
        click("[data-watchlist-price-load]");
        awaitPage("first explicit watchlist read alone cannot produce a pair",
            DIAGNOSTICS + ".eod === 1 && document.querySelector('.managed-watchlist-comparison table') === null" +
            " && document.querySelector('[data-watchlist-price-load]')?.disabled === false");
        click("[data-watchlist-selection='listing-one']");
        awaitPage("second exact member owns the next explicit read",
            "document.querySelector('[data-watchlist-price-load]')?.textContent === 'Load ONE price'");
        click("[data-watchlist-price-load]");
        assertWatchlistPair("2026-09-19", "90", "120", "-$10 (-10.0000%)", "+$20 (+20.0000%)", 3);
        assertWatchlistComparisonDraft(false);
        awaitPage("native comparison controls have labels and touch targets",
            "Array.from(document.querySelectorAll('.managed-watchlist-comparison select')).every(e => e.id && document.querySelector('label[for=\"' + e.id + '\"]') && e.getBoundingClientRect().height >= 44)" +
            " && document.querySelector(" + JSONObject.quote(start) + ")?.value === '2026-09-17'" +
            " && Array.from(document.querySelector(" + JSONObject.quote(end) + ").options).map(e => e.value).join('|') === '|2026-09-18|2026-09-19'");
        chooseNativeSelectOption(end, "2026-09-18", "2026-09-18");
        assertWatchlistPair("2026-09-18", "110", "95", "+$10 (+10.0000%)", "-$5 (-5.0000%)", 2);
        click(".managed-watchlist-price-path > summary");
        assertWatchlistPricePath();
        String method = ".managed-watchlist-price-path-method";
        String methodSummary = method + " > summary";
        awaitPage("chart method starts closed with its native touch target",
            "(() => { const d = document.querySelector(" + JSONObject.quote(method) + ");" +
            " return d?.open === false && d.querySelector('summary')?.textContent === 'Chart method and limits'" +
            " && d.querySelector('summary').getBoundingClientRect().height >= 44; })()");
        click(methodSummary);
        awaitPage("complete method remains inspectable without closing the chart",
            "(() => { const d = document.querySelector(" + JSONObject.quote(method) + ");" +
            " return d?.open === true && d.querySelector('p').getBoundingClientRect().height > 0" +
            " && d.querySelector('p').textContent.replace(/\\s+/g, ' ').trim() === " + JSONObject.quote(
                "Index = 100 × raw close / starting raw close, rounded half up to four decimal places. " +
                "Chart coordinates are approximate; the vertical scale follows the values. " +
                "Straight lines guide the eye between shared observations; dates are spaced by observation, " +
                "with no filled gaps. Omitted dates can hide declines. This is not a USD price or a " +
                "split/dividend-adjusted return.") + "; })()");
        assertWatchlistPricePath();
        click(methodSummary);
        awaitPage("method closes independently of the chart",
            "document.querySelector(" + JSONObject.quote(method) + ")?.open === false");
        assertWatchlistPricePath();
        chooseNativeSelectOption(end, "", "Choose an observed date");
        awaitPage("blank end withholds comparison numbers without reading",
            "document.querySelector('.managed-watchlist-comparison table') === null" +
            " && document.querySelector('.managed-watchlist-comparison .managed-price-comparison-status')?.textContent === 'Choose an ending date after the starting date.'" +
            " && document.querySelector('.managed-watchlist-comparison-note-action > button')?.getAttribute('aria-disabled') === 'true'" +
            " && document.querySelector('.managed-watchlist-comparison [role=region]')?.tabIndex === -1");
        awaitPage("blank end retains the open disclosure and exact-data host without stale canvas",
            "document.querySelector('.managed-watchlist-price-path')?.open === true" +
            " && document.querySelector('.managed-watchlist-price-path-canvas') === null" +
            " && document.querySelector('.managed-watchlist-price-path-data')?.tabIndex === 0" +
            " && document.querySelector('.managed-watchlist-price-path-data table') === null");
        assertWatchlistComparisonDraft(false);
        chooseNativeSelectOption(end, "2026-09-18", "2026-09-18");
        assertWatchlistPair("2026-09-18", "110", "95", "+$10 (+10.0000%)", "-$5 (-5.0000%)", 2);
        assertWatchlistPricePath();
        click(".managed-watchlist-price-path > summary");
        awaitPage("closing the optional chart disposes its canvas without changing the exact data",
            "document.querySelector('.managed-watchlist-price-path')?.open === false" +
            " && document.querySelector('.managed-watchlist-price-path-canvas') === null" +
            " && document.querySelectorAll('.managed-watchlist-price-path-data tbody tr').length === 2");
        click("[data-watchlist-selection='listing-zero']");
        click("button[aria-label='Move ZERO down']");
        typeIntoInput("managed-watchlist-search", "ONE");
        awaitPage("comparison choices retain both full-draft listings through search",
            "document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-comparison-listing select')).every(e => Array.from(e.options).map(o => o.value).join('|') === '|listing-one|listing-zero')");
        assertWatchlistPair("2026-09-18", "110", "95", "+$10 (+10.0000%)", "-$5 (-5.0000%)", 2);
        assertWatchlistComparisonDraft(true);
        click("button[aria-label='Clear watchlist search']");
        click(".managed-watchlist-comparison .managed-price-comparison-source > summary");
        awaitPage("both original histories retain exact coverage and request dates",
            "(() => { const sections = document.querySelectorAll('.managed-watchlist-comparison .managed-price-comparison-provenance > section');" +
            " return sections.length === 2 && Array.from(sections).map(e => e.querySelector('h4')?.textContent).join('|') === 'ZERO · XNAS|ONE · XNAS'" +
            " && Array.from(sections).every(e => Array.from(e.querySelectorAll('dd')).map(d => d.textContent).join('|') === '2026-08-20 to 2026-09-20|2026-09-17 to 2026-09-19|3 / 0|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'); })()");
        click(".managed-watchlist-comparison .managed-price-comparison-source > summary");
        retainAnnualNoteFrame("watchlistSharedPriceComparison", scope + " > .managed-price-comparison-scroll",
            scope + " .managed-price-comparison-status, " + scope + " > .managed-price-comparison-scroll", 2);
        assertWatchlistPair("2026-09-18", "110", "95", "+$10 (+10.0000%)", "-$5 (-5.0000%)", 2);
        assertWatchlistComparisonDraft(true);
        appendWatchlistComparisonToOneNote();
        click(".managed-watchlist-price-path > summary");
        assertWatchlistPricePath();
        selectWorkspaceView("Discover");
        selectWorkspaceView("My Watchlist");
        awaitPage("top-level exit retires pair and loaded histories without automatic reads",
            "Array.from(document.querySelectorAll('.managed-watchlist-comparison select')).every(e => e.value === '')" +
            " && document.querySelector('.managed-watchlist-comparison table') === null" +
            " && document.querySelector('.managed-watchlist-comparison .managed-price-comparison-provenance') === null" +
            " && document.querySelector('#managed-watchlist-selected-price > strong')?.textContent === 'Price not loaded'");
        awaitPage("retirement preserves the mounted disclosure but clears all chart data",
            "document.querySelector('.managed-watchlist-price-path')?.open === true" +
            " && document.querySelector('.managed-watchlist-price-path-canvas') === null" +
            " && document.querySelector('.managed-watchlist-price-path-data table') === null");
        assertWatchlistComparisonDraft(true, WATCHLIST_COMPARISON_NOTE);
        assertFixtureBoundary();
        assertRootHistory();
        assertEquals("Comparison controls preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedWatchlistComparison", "phase=two-explicit-reads-shared-interval-draft-preserved-retired; " + pageDiagnostic());
    }

    private void assertWatchlistPair(String end, String zeroClose, String oneClose,
            String zeroChange, String oneChange, int count) throws Exception {
        awaitPage("exact shared watchlist comparison through " + end,
            "(() => { const c = document.querySelector('.managed-watchlist-comparison'); const rows = c?.querySelectorAll('.managed-price-comparison-scroll tbody tr');" +
            " if (!rows || rows.length !== 2) return false;" +
            " return c.querySelector('.managed-price-comparison-status')?.textContent === " +
                JSONObject.quote("2026-09-17 to " + end + " · " + count + " shared observed dates in this interval · 3 across the loaded histories") +
            " && c.querySelector('[role=region]')?.getAttribute('aria-label') === 'Watchlist raw price comparison results'" +
            " && c.querySelector('[role=region]')?.tabIndex === 0" +
            " && Array.from(rows).map(r => r.cells[0].querySelector('strong')?.textContent).join('|') === 'ZERO|ONE'" +
            " && rows[0].cells[0].textContent.includes('Zero Company · Class A · XNAS')" +
            " && rows[1].cells[0].textContent.includes('One Company · Class A · XNAS')" +
            " && Array.from(rows).every(r => r.cells[0].querySelector('time')?.dateTime === '2026-09-20T00:00:01.000Z')" +
            " && Array.from(rows).every(r => r.cells[1].textContent === '100')" +
            " && rows[0].cells[2].textContent === " + JSONObject.quote(zeroClose) +
            " && rows[1].cells[2].textContent === " + JSONObject.quote(oneClose) +
            " && rows[0].querySelector('.managed-market-change > strong')?.textContent === " + JSONObject.quote("Raw close change: " + zeroChange) +
            " && rows[1].querySelector('.managed-market-change > strong')?.textContent === " + JSONObject.quote("Raw close change: " + oneChange) +
            " && Array.from(c.querySelectorAll('.managed-market-change-basis')).every(e => e.textContent.includes('2026-09-17 to ' + " + JSONObject.quote(end) + ")); })()");
    }

    private void assertWatchlistPricePath() throws Exception {
        awaitPage("optional chart preserves both exact short-interval paths",
            "(() => { const d = document.querySelector('.managed-watchlist-price-path'); const plot = d?.querySelector('[role=img]');" +
            " const rows = d?.querySelectorAll('tbody tr'); return d?.open === true && d.querySelector('summary')?.getBoundingClientRect().height >= 44" +
            " && plot?.getAttribute('aria-label') === 'ZERO Class A XNAS; ONE Class A XNAS: raw closes indexed to 100 on 2026-09-17, through 2026-09-18. 2 shared observations. Exact values follow the chart.'" +
            " && plot.querySelector('canvas') !== null && rows.length === 2" +
            " && Array.from(rows).map(r => r.cells[0].textContent).join('|') === '2026-09-17|2026-09-18'" +
            " && Array.from(rows[0].querySelectorAll('td span')).map(e => e.textContent).join('|') === '100|100.0000|100|100.0000'" +
            " && Array.from(rows[1].querySelectorAll('td span')).map(e => e.textContent).join('|') === '110|110.0000|95|95.0000'" +
            " && d.querySelector('[role=region]')?.getAttribute('aria-label') === 'Watchlist price path exact data'" +
            " && " + DIAGNOSTICS + ".eod === 2; })()");
    }

    private void assertWatchlistComparisonDraft(boolean reordered) throws Exception {
        assertWatchlistComparisonDraft(reordered, "Invented second note");
    }

    private void assertWatchlistComparisonDraft(boolean reordered, String oneNote) throws Exception {
        String zero = "{listingId:'listing-zero',symbol:'ZERO',note:" + JSONObject.quote(NOTE) + "}";
        String one = "{listingId:'listing-one',symbol:'ONE',note:" + JSONObject.quote(oneNote) + "}";
        String expected = reordered ? "[" + one + "," + zero + "]" : "[" + zero + "," + one + "]";
        awaitPage("comparison preserves full draft and exactly two explicit price requests",
            "JSON.stringify(" + DRAFT + ".memberships) === JSON.stringify(" + expected + ")" +
            " && " + DRAFT + ".dirty === true && " + DRAFT + ".baseVersion === 1" +
            " && (() => { const d = " + DIAGNOSTICS + "; return d.eod === 2 && d.eodAborted === 0 && d.eodLateResolved === 0" +
            " && d.load === 1 && d.status === 1 && d.save === 0 && d.search === 0 && d.resolve === 0" +
            " && d.marketsEod === 0 && d.marketsResolve === 1 && d.annual === 0 && d.filings === 0 && d.calendar === 0; })()");
    }

    private void appendWatchlistComparisonToOneNote() throws Exception {
        String destination = "#managed-watchlist-comparison-note-destination";
        awaitPage("note destination requires an explicit current pair choice",
            "document.querySelector(" + JSONObject.quote(destination) + ")?.value === ''" +
            " && Array.from(document.querySelector(" + JSONObject.quote(destination) + ").options).map(o => o.value).join('|') === '|listing-zero|listing-one'" +
            " && document.querySelector('.managed-watchlist-comparison-note-action > button')?.getAttribute('aria-disabled') === 'true'");
        chooseNativeSelectOption(destination, "listing-one", "ONE · One Company · Class A · XNAS");
        assertWatchlistComparisonDraft(true);
        click("[data-watchlist-selection='listing-one']");
        touchInput("managed-note-0");
        replaceFocusedInput("managed-note-0", "Invented second note", WATCHLIST_COMPARISON_EXISTING_NOTE);
        click("[data-watchlist-selection='listing-zero']");
        assertWatchlistComparisonDraft(true, WATCHLIST_COMPARISON_EXISTING_NOTE);
        awaitPage("destination remains ONE while ZERO owns the visible editor",
            "document.querySelector(" + JSONObject.quote(destination) + ")?.value === 'listing-one'" +
            " && document.querySelector('#managed-note-1')?.getAttribute('data-managed-note-listing-id') === 'listing-zero'" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('.managed-watchlist-comparison-note-action > button')?.getAttribute('aria-disabled') === 'false'");
        click(".managed-watchlist-comparison-note-action > button");
        assertWatchlistComparisonDraft(true, WATCHLIST_COMPARISON_NOTE);
        awaitPage("comparison appends to the latest chosen note without selecting its editor",
            "document.querySelector('#managed-note-1')?.getAttribute('data-managed-note-listing-id') === 'listing-zero'" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('.managed-watchlist-comparison-note-status')?.textContent === 'Comparison added to the ONE (Class A, XNAS) note draft. Review and save all changes in My Watchlist.'");
        typeIntoInput("managed-watchlist-search", "ZERO");
        String priceReviewState = readFixtureString("JSON.stringify({draft:" + DRAFT + ",calls:" + DIAGNOSTICS + ",href:location.href})");
        awaitPage("successful price append exposes a readable exact-destination Review control",
            "(() => { const b = [...document.querySelectorAll('.managed-watchlist-comparison-note-action > button')].find(b => b.textContent === 'Review note');" +
            " return b && b.getAttribute('aria-disabled') === 'false' && b.getBoundingClientRect().height >= 44" +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'; })()");
        onWebView().withElement(findElement(Locator.XPATH,
            "//div[contains(@class,'managed-watchlist-comparison-note-action')]/button[normalize-space(.)='Review note']")).perform(webClick());
        assertComparisonNoteReader("managed-note-0", "listing-one", "ONE", WATCHLIST_COMPARISON_NOTE, "ZERO");
        assertEquals("price Review preserves the complete draft, counters and URL", priceReviewState,
            readFixtureString("JSON.stringify({draft:" + DRAFT + ",calls:" + DIAGNOSTICS + ",href:location.href})"));
        assertWatchlistComparisonDraft(true, WATCHLIST_COMPARISON_NOTE);
        click("button[aria-label='Clear watchlist search']");
        selectWatchlistNote(1);
        chooseNativeSelectOption("#managed-watchlist-search-scope", "notes", "Research notes");
        typeIntoInput("managed-watchlist-search", "Observed raw-close watchlist comparison");
        awaitPage("note search retrieves the appended comparison while ZERO stays selected",
            "document.querySelector('#managed-watchlist-search')?.value === 'Observed raw-close watchlist comparison'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join('|') === 'ONE'" +
            " && document.querySelector('#managed-note-1')?.getAttribute('data-managed-note-listing-id') === 'listing-zero'" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE));
        assertWatchlistComparisonDraft(true, WATCHLIST_COMPARISON_NOTE);
        click("button[aria-label='Clear watchlist search']");
    }

    @Test
    public void eodLoadCancelAndBackPreserveDraftAndDiscardLateResult() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        typeIntoInput("workspace-company-query", "ZERO");
        click(".workspace-global-search button[type=submit]");
        awaitPage("invented EOD listing discovered", DIAGNOSTICS + ".search === 1" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("EOD draft reordered", "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        awaitPage("watchlist price waits for an explicit read",
            "document.querySelector('[data-watchlist-price-load]')?.textContent === 'Load ZERO price'" +
            " && document.querySelector('#managed-watchlist-selected-price > strong')?.textContent === 'Price not loaded'" +
            " && " + DIAGNOSTICS + ".eod === 0");
        click("[data-watchlist-price-load]");
        assertEodDraftAndCounts(1, 0, 0);
        click(".managed-watchlist-price-source > summary");
        assertWatchlistDatedPrice();
        click("button[aria-label='Move ZERO up']");
        awaitPage("loaded price follows its exact reordered draft member",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ZERO'" +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-watchlist-selected-price > strong')?.textContent === '$101.5'" +
            " && " + DIAGNOSTICS + ".eod === 1");
        click("button[aria-label='Move ZERO down']");
        typeIntoInput("managed-watchlist-search", "ZERO");
        awaitPage("local search preserves loaded price and the complete draft",
            "document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && document.querySelectorAll('[data-watchlist-selection]').length === 1" +
            " && document.querySelector('[data-watchlist-selection]')?.getAttribute('data-watchlist-selection') === 'listing-zero'" +
            " && " + DRAFT + ".memberships?.length === 2 && " + DIAGNOSTICS + ".eod === 1");
        click("button[aria-label='Clear watchlist search']");
        assertEodDraftAndCounts(1, 0, 0);
        assertWatchlistDatedPrice();
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("EOD reuses the exact watchlist history without fetching",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'" +
            " && document.querySelector('.managed-eod-origin')?.textContent === 'Showing history loaded in My Watchlist. Original dates and request times are unchanged.'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.textContent === 'Refresh close history'");
        assertEodState(1, 0, 0, false, true);
        String initialHistory =
            "document.querySelector('.managed-eod-history caption')?.textContent === 'Raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-18|100.25;2026-09-19|101.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '101.5|2026-09-19|2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Tiingo')" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('2026-08-20')" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('2026-09-20')";
        awaitPage("EOD exposes exact invented closes and provenance", initialHistory);
        retainEodLoadedScreenshot();
        assertEodState(1, 0, 0, false, true);
        Log.i("ManagedEod", "phase=loaded; " + pageDiagnostic());
        touchEodObservation(false);
        awaitPage("first observed raw close selected by native touch",
            inspectedEodClose("2026-09-18", "100.25"));
        assertEodDraftAndCounts(1, 0, 0);
        touchEodObservation(true);
        String inspectedClose = inspectedEodClose("2026-09-19", "101.5");
        awaitPage("last observed raw close selected by native touch", inspectedClose);
        assertEodDraftAndCounts(1, 0, 0);
        retainScreenshot("eodInspectedClose");
        awaitPage("exact dated raw close remained readable through capture", inspectedClose);
        click(".managed-eod-history .managed-eod-exact-values > summary");
        awaitPage("inspection preserves the complete accessible table", initialHistory +
            " && document.querySelector('.managed-eod-history .managed-eod-exact-values')?.open === true" +
            " && document.querySelector('.managed-eod-table-scroll')?.getAttribute('role') === 'region'" +
            " && document.querySelector('.managed-eod-table-scroll')?.getAttribute('aria-label') === 'ZERO exact raw closing prices'" +
            " && document.querySelector('.managed-eod-table-scroll')?.tabIndex === 0");
        assertEodState(1, 0, 0, false, true);
        Log.i("ManagedEod", "phase=inspected-first-and-last; " + pageDiagnostic());

        String previousNotice = "Showing previous close history, completed 2026-09-20T00:00:01.000Z. " +
            "This refresh has not confirmed newer prices. Trading dates, requested window and request times are unchanged.";
        String retainedHistory = initialHistory +
            " && document.querySelector('.managed-eod-previous')?.textContent === " + JSONObject.quote(previousNotice);
        clickEodAction("Refresh close history");
        assertEodState(2, 0, 0, true, true);
        awaitPage("pending refresh retains exact original history and provenance", retainedHistory +
            " && document.querySelector('.managed-eod-history [role=status]')?.textContent === 'Refreshing close history for ZERO…'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.disabled === true");
        clickEodAction("Cancel close history");
        assertEodState(2, 1, 0, false, true);
        awaitPage("cancelled refresh retains original history and permits explicit Refresh", retainedHistory +
            " && document.querySelector('.managed-eod-history [role=status]')?.textContent === 'Close history refresh cancelled. Try again when ready.'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.textContent === 'Refresh close history'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.disabled === false");
        Log.i("ManagedEod", "phase=cancelled; " + pageDiagnostic());
        click("#settle-cancelled-eod");
        assertEodState(2, 1, 1, false, true);
        awaitPage("late completion cannot replace retained history", retainedHistory);
        awaitPage("late invented EOD values remain absent",
            "!document.querySelector('.managed-eod-history')?.textContent.includes('998.25')" +
            " && !document.querySelector('.managed-eod-history')?.textContent.includes('999.75')");
        clickEodAction("Refresh close history");
        assertEodState(3, 1, 1, false, true);
        String failedRefresh = retainedHistory +
            " && document.querySelector('.managed-eod-history [role=alert]')?.textContent === 'The close history refresh failed. Try again when ready.'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.textContent === 'Refresh close history'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.disabled === false" +
            " && document.querySelector('.managed-eod-history')?.getAttribute('aria-busy') === 'false'" +
            " && " + DIAGNOSTICS + ".eod === 3";
        awaitPage("typed refresh failure retains original values and dates", failedRefresh);
        CountDownLatch failureScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-eod-history [role=alert]').scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> failureScrolled.countDown()));
        assertTrue("EOD refresh failure did not scroll into view", failureScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visibleFailure = failedRefresh +
            " && (() => { const panel = document.querySelector('.managed-eod-history'); const v = visualViewport;" +
            " const visible = e => { if (!e || !v) return false; const r = e.getBoundingClientRect();" +
            " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; };" +
            " return visible(panel?.querySelector('[role=alert]')) && visible(panel?.querySelector('.managed-eod-previous'))" +
            " && visible(panel?.querySelector('.managed-metadata')); })()";
        awaitPage("failed refresh, previous-history notice and original dates are visible", visibleFailure);
        retainScreenshot("eodRefreshPreviousHistory");
        awaitPage("failed refresh stayed unchanged through capture", visibleFailure);
        assertEodDraftAndCounts(3, 1, 1);
        Log.i("ManagedEod", "phase=failed-refresh-captured; " + pageDiagnostic());

        clickEodAction("Refresh close history");
        assertEodState(4, 1, 1, false, true);
        awaitPage("explicit recovery replaces every history value and request date",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-19|102.75;2026-09-20|103.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '103.5|2026-09-20|2026-08-21 to 2026-09-21|2026-09-21T00:00:00.000Z|2026-09-21T00:00:02.000Z'" +
            " && document.querySelector('.managed-eod-previous') === null" +
            " && document.querySelector('.managed-eod-origin') === null" +
            " && document.querySelector('.managed-eod-history [role=alert]') === null" +
            " && document.querySelector('.managed-eod-history [role=status]')?.textContent === 'One-month raw closing prices loaded.'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.textContent === 'Refresh close history'" +
            " && document.querySelector('.managed-eod-history .trial-actions button:first-child')?.disabled === false" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Tiingo')" +
            " && !document.querySelector('.managed-eod-history')?.textContent.includes('100.25')" +
            " && !document.querySelector('.managed-eod-history')?.textContent.includes('101.5')" +
            " && !document.querySelector('.managed-eod-history')?.textContent.includes('998.25')" +
            " && !document.querySelector('.managed-eod-history')?.textContent.includes('999.75')");
        awaitPage("replacement disposes the old inspection readout",
            "document.querySelector('.managed-eod-tooltip') === null");
        touchEodObservation(false);
        awaitPage("replacement inspection uses its own first dated close",
            inspectedEodClose("2026-09-19", "102.75"));
        assertEodDraftAndCounts(4, 1, 1);
        Log.i("ManagedEod", "phase=refresh-recovered; " + pageDiagnostic());
        pressBack();
        awaitPage("native Back closes EOD and restores its originating control",
            "document.querySelector('.managed-eod-history') === null" +
            " && document.querySelector('.managed-eod-tooltip') === null" +
            " && document.activeElement === document.querySelector(\"button[aria-label='EOD close history for saved ZERO']\")");
        assertEodDraftAndCounts(4, 1, 1);
        assertWatchlistDatedPrice();
        assertReturnedRootHistory("listing-zero", "price");
        pressBack();
        awaitPage("root Back leaves both detail panels closed",
            "document.querySelector('.managed-eod-history') === null && document.querySelector('.managed-annual-report') === null");
        assertEodDraftAndCounts(4, 1, 1);
        scenario.onActivity(activity -> {
            assertNotNull("Original EOD Activity was collected", originalActivity.get().get());
            assertNotNull("Original EOD WebView was collected", originalWebView.get().get());
            assertSame("EOD journey must preserve the Activity", originalActivity.get().get(), activity);
            assertSame("EOD journey must preserve the WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("EOD journey must preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertReturnedRootHistory("listing-zero", "price");
        assertFixtureBoundary();
        Log.i("ManagedEod", "phase=late-discarded-back-root, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
    }

    @Test
    public void companyFilingsPagingCancelAndBackPreserveDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareDraftAndOpenAnnual();
        click(".managed-company-sections button[aria-label='Filings section for ZERO']");
        awaitPage("Filings opens unloaded with heading focus and no source request",
            "document.activeElement?.id === 'managed-filings-heading'" +
            " && document.querySelector('#managed-filings-heading')?.textContent === 'SEC filings'" +
            " && document.querySelector('.managed-filings-results') === null" +
            " && document.querySelector('.managed-filings-toolbar .trial-actions > button')?.textContent === 'Load filings'");
        assertFilingsDraftAndCounts(0, 0, 0);
        assertCompanyHistory("listing-zero", "filings", false);
        pressBack();
        assertClosedDraft(true);
        assertReturnedRootHistory("listing-zero", "filings");
        String selectedFilings = ".managed-watchlist-filings";
        String viewFilings = selectedFilings + " button[aria-label^='View filings for ZERO (']";
        awaitPage("selected filing check starts unloaded without a source read",
            "document.querySelector('[data-watchlist-filings-load]')?.textContent === 'Load filings'" +
            " && document.querySelector('[data-watchlist-filings-load]')?.disabled === false" +
            " && document.querySelector('.managed-watchlist-filings-summary') === null");
        assertFilingsDraftAndCounts(0, 0, 0);
        click("[data-watchlist-filings-load]");
        String selectedPacket = "document.querySelector('.managed-watchlist-filings-summary')?.textContent.includes('26 loaded filings')" +
            " && document.querySelector('.managed-watchlist-filings-summary')?.textContent.includes('2026-06-23 to 2026-09-20')" +
            " && document.querySelector('.managed-watchlist-filings-summary a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm'" +
            " && document.querySelector('.managed-watchlist-filings-summary a')?.textContent.includes('Form 10-Q')" +
            " && document.querySelector('.managed-watchlist-filings-summary time')?.textContent === '2026-09-19'" +
            " && document.querySelector('.managed-watchlist-filings-source')?.textContent.includes('2026-09-20T00:00:00.000Z')" +
            " && document.querySelector('.managed-watchlist-filings-source')?.textContent.includes('2026-09-20T00:00:01.000Z')" +
            " && document.querySelector('.managed-watchlist-filings-source')?.textContent.includes('2026-09-20T00:00:02.000Z')";
        awaitPage("selected filing read shows exact original dates and coverage", selectedPacket);
        assertFilingsDraftAndCounts(1, 0, 0);
        click(viewFilings);
        awaitPage("View filings hands off the same packet without another read",
            "document.activeElement?.id === 'managed-filings-heading'" +
            " && document.querySelector('.managed-filings-status')?.textContent.includes('loaded watchlist filings')");
        awaitPage("a watchlist handoff establishes a baseline without a refresh claim",
            "document.querySelector('.managed-filings-refresh-comparison') === null" +
            " && document.querySelector('[data-filings-new-accession]') === null");
        assertCompanyHistory("listing-zero", "filings", false);
        assertFilingsDraftAndCounts(1, 0, 0);
        String loaded = "document.querySelector('.managed-filings-count')?.textContent.includes('26 of 26 loaded filings')" +
            " && document.querySelector('.managed-filings-period')?.textContent.includes('2026-06-23 to 2026-09-20')" +
            " && document.querySelector('.managed-filings-period')?.textContent.includes('CIK 0000000001')" +
            " && document.querySelector('.managed-filings-source')?.textContent.includes('Retrieved 2026-09-20T00:00:01.000Z')" +
            " && Array.from(document.querySelectorAll('.managed-filings-source-details dt')).some(dt => dt.textContent === 'Request started' && dt.nextElementSibling?.textContent === '2026-09-20T00:00:00.000Z')" +
            " && Array.from(document.querySelectorAll('.managed-filings-source-details dt')).some(dt => dt.textContent === 'Completed' && dt.nextElementSibling?.textContent === '2026-09-20T00:00:02.000Z')" +
            " && document.querySelector('.managed-filings-source a')?.href === 'https://data.sec.gov/submissions/CIK0000000001.json'";
        awaitPage("explicit load shows exact dates, identity and original SEC index link", loaded +
            " && document.querySelectorAll('.managed-filings-list > li').length === 25" +
            " && document.querySelector('.managed-filings-list > li:first-child a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm'" +
            " && document.querySelector('.managed-filings-list > li:first-child a')?.textContent.includes('Form 10-Q')" +
            " && Array.from(document.querySelectorAll('.managed-filings-list > li:first-child dd')).map(e => e.textContent).join('|') === '2026-09-19|2026-06-30'");
        assertFilingsDraftAndCounts(1, 0, 0);
        awaitPage("form choices come only from exact loaded forms",
            "document.querySelector('#managed-filings-form')?.disabled === false" +
            " && document.querySelector('#managed-filings-form')?.value === ''" +
            " && Array.from(document.querySelectorAll('#managed-filings-form option')).map(e => e.value).join('|') === '|10-Q|8-K'" +
            " && (document.querySelector('.managed-filings-filter-reset')?.textContent ?? '') === ''");
        awaitPage("first loaded list offers no fabricated refresh difference",
            "document.querySelector('#managed-filings-refresh-view')?.value === 'all'" +
            " && document.querySelector('#managed-filings-refresh-view')?.disabled === false" +
            " && document.querySelector('#managed-filings-refresh-view option[value=new]')?.disabled === true" +
            " && document.querySelector('#managed-filings-refresh-view')?.getBoundingClientRect().height >= 44");
        awaitPage("source detail starts closed while the dated result remains visible", loaded +
            " && document.querySelector('.managed-filings-source-details')?.open === false" +
            " && document.querySelector('.managed-filings-source-details > summary')?.textContent === 'Filings source and coverage'" +
            " && document.querySelector('.managed-filings-source-details > summary')?.getBoundingClientRect().height >= 44" +
            " && !document.querySelector('.managed-filings-source')?.closest('details')");
        click(".managed-filings-source-details > summary");
        awaitPage("opening source detail retains exact clocks and complete coverage limits", loaded +
            " && document.querySelector('.managed-filings-source-details')?.open === true" +
            " && document.querySelector('.managed-filings-source-details')?.textContent.includes('Older continuation files were not loaded')" +
            " && document.querySelector('.managed-filings-source-details')?.textContent.includes('The source lists older continuation files.')");
        assertFilingsDraftAndCounts(1, 0, 0);
        chooseNativeSelectOption("#managed-filings-form", "10-Q", "10-Q");
        awaitPage("native form selection shows one observed quarterly filing without losing focus",
            "document.activeElement?.id === 'managed-filings-form'" +
            " && document.querySelector('.managed-filings-count')?.textContent === '1 of 26 loaded filings · Page 1 of 1'" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 1" +
            " && document.querySelector('.managed-filings-list a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm'" +
            " && document.querySelector('.managed-filings-pagination > button:last-child')?.getAttribute('aria-disabled') === 'true'");
        assertFilingsDraftAndCounts(1, 0, 0);
        awaitPage("local filtering preserves the open source detail",
            "document.querySelector('.managed-filings-source-details')?.open === true");
        click(".managed-filings-source-details > summary");
        awaitPage("source detail closes without removing dated result context", loaded.replace("26 of 26 loaded filings", "1 of 26 loaded filings") +
            " && document.querySelector('.managed-filings-source-details')?.open === false");
        assertFilingsDraftAndCounts(1, 0, 0);
        retainAnnualNoteFrame("companyFilingsFormFilter", "label[for=managed-filings-form]",
            "label[for=managed-filings-form], #managed-filings-form", 2);
        retainAnnualNoteFrame("companyFilingsFilteredResult", ".managed-filings-count",
            ".managed-filings-count, .managed-filings-list > li", 2);
        chooseNativeSelectOption("#managed-filings-form", "8-K", "8-K");
        awaitPage("second exact form retains all twenty-five matching filings",
            "document.activeElement?.id === 'managed-filings-form'" +
            " && document.querySelector('.managed-filings-count')?.textContent === '25 of 26 loaded filings · Page 1 of 1'" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 25" +
            " && document.querySelector('.managed-filings-list > li:first-child a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000002-index.htm'" +
            " && document.querySelector('.managed-filings-list > li:last-child a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000026-index.htm'");
        assertFilingsDraftAndCounts(1, 0, 0);
        chooseNativeSelectOption("#managed-filings-form", "", "All forms");
        awaitPage("All forms restores page one from the same loaded packet", loaded +
            " && document.activeElement?.id === 'managed-filings-form'" +
            " && document.querySelector('.managed-filings-count')?.textContent.includes('Page 1 of 2')" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 25");
        assertFilingsDraftAndCounts(1, 0, 0);
        retainAnnualNoteFrame("companyFilingsFirstRow", ".managed-filings-list > li:first-child", ".managed-filings-list > li:first-child", 1);
        click(".managed-filings-pagination > button:last-child");
        awaitPage("local page two keeps focus and exposes the last exact accession", loaded +
            " && document.querySelector('.managed-filings-count')?.textContent.includes('Page 2 of 2')" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 1" +
            " && document.querySelector('.managed-filings-list a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000026-index.htm'" +
            " && document.querySelector('.managed-filings-list')?.textContent.includes('Not reported')" +
            " && document.querySelector('.managed-filings-pagination > button:last-child')?.getAttribute('aria-disabled') === 'true'" +
            " && document.activeElement === document.querySelector('.managed-filings-pagination > button:last-child')");
        assertFilingsDraftAndCounts(1, 0, 0);
        retainAnnualNoteFrame("companyFilingsPageTwo", ".managed-filings-count", ".managed-filings-count, .managed-filings-list > li, .managed-filings-pagination", 3);
        click(".managed-filings-toolbar .trial-actions > button:first-child");
        awaitPage("refresh retains the original packet and offers Cancel", loaded +
            " && document.querySelector('.managed-company-filings')?.getAttribute('aria-busy') === 'true'" +
            " && document.querySelector('.managed-filings-toolbar .trial-actions > button:last-child')?.textContent === 'Cancel filings'" +
            " && document.querySelector('.managed-filings-warning')?.textContent.includes('previous filings response')");
        click(".managed-company-sections button[aria-label='Annual section for ZERO']");
        awaitPage("switching cancels filings and focuses unloaded Annual",
            "document.activeElement?.id === 'managed-annual-heading' && document.querySelector('.managed-company-filings') === null");
        assertFilingsDraftAndCounts(2, 1, 0);
        click("#settle-cancelled-filings");
        assertFilingsDraftAndCounts(2, 1, 1);
        click(".managed-company-sections button[aria-label='Filings section for ZERO']");
        awaitPage("return retains accepted filings after late completion", loaded +
            " && document.activeElement?.id === 'managed-filings-heading'");
        assertFilingsDraftAndCounts(2, 1, 1);
        click(".managed-filings-toolbar .trial-actions > button:first-child");
        awaitPage("failed explicit refresh retains original provenance", loaded +
            " && document.querySelector('.managed-filings-status')?.getAttribute('role') === 'alert'" +
            " && document.querySelector('.managed-filings-warning')?.textContent.includes('previous filings response')");
        assertFilingsDraftAndCounts(3, 1, 1);
        chooseNativeSelectOption("#managed-filings-form", "8-K", "8-K");
        awaitPage("retained source can be filtered without another read",
            "document.querySelector('.managed-filings-count')?.textContent === '25 of 26 loaded filings · Page 1 of 1'" +
            " && document.querySelector('.managed-filings-warning')?.textContent.includes('previous filings response')");
        assertFilingsDraftAndCounts(3, 1, 1);
        click(".managed-filings-toolbar .trial-actions > button:first-child");
        awaitPage("valid empty response replaces earlier rows without claiming complete history",
            "document.querySelector('.managed-filings-empty')?.textContent === 'No matching filings were observed in the checked source object.'" +
            " && document.querySelector('.managed-filings-count')?.textContent === '0 of 0 loaded filings · Page 1 of 1'" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 0" +
            " && document.querySelector('.managed-filings-warning') === null" +
            " && document.querySelector('.managed-filings-results')?.textContent.includes('Older continuation files were not loaded')");
        awaitPage("empty response resets the enabled filter to All forms with a notice",
            "document.querySelector('#managed-filings-form')?.value === ''" +
            " && document.querySelector('#managed-filings-form')?.disabled === false" +
            " && document.querySelectorAll('#managed-filings-form option').length === 1" +
            " && document.querySelector('.managed-filings-filter-reset')?.textContent === 'Filings response changed; showing All forms, all filing dates and All loaded filings from page one.'");
        awaitPage("completed empty response leaves Refresh available",
            "document.querySelector('.managed-filings-toolbar .trial-actions > button:first-child')?.disabled === false");
        assertFilingsDraftAndCounts(4, 1, 1);
        String emptyComparison = "document.querySelector('.managed-filings-refresh-count')?.textContent === 'Newly observed in this refresh: 0 of 0 filings in the displayed response.'" +
            " && document.querySelector('[data-filings-new-accession]') === null" +
            " && document.querySelector('.managed-filings-refresh-comparison')?.textContent.includes('This does not establish when they were published or that either list is complete.')";
        awaitPage("an empty successful refresh still compares the two admitted lists", emptyComparison +
            " && document.querySelector('.managed-filings-refresh-comparison details')?.open === false" +
            " && document.querySelector('.managed-filings-refresh-comparison summary')?.getBoundingClientRect().height >= 44");
        click(".managed-filings-refresh-comparison summary");
        awaitPage("native disclosure exposes both original lists and their incomplete coverage", emptyComparison +
            " && document.querySelector('.managed-filings-refresh-comparison details')?.open === true" +
            " && document.querySelector('[aria-label=\"Previous loaded list\"]')?.textContent.includes('26 of 26 matching entries')" +
            " && document.querySelector('[aria-label=\"Current loaded list\"]')?.textContent.includes('0 of 0 matching entries')" +
            " && Array.from(document.querySelectorAll('.managed-filings-compared-lists section')).every(s => s.textContent.includes('2026-06-23 to 2026-09-20') && s.textContent.includes('2026-09-20T00:00:00.000Z') && s.textContent.includes('2026-09-20T00:00:01.000Z') && s.textContent.includes('2026-09-20T00:00:02.000Z') && s.textContent.includes('Listed by the source; not loaded.') && s.querySelector('a')?.href === 'https://data.sec.gov/submissions/CIK0000000001.json')");
        assertFilingsDraftAndCounts(4, 1, 1);
        chooseNativeSelectOption("#managed-filings-refresh-view", "new", "Newly observed");
        awaitPage("zero-new comparison is selectable and retains exact source context", emptyComparison +
            " && document.activeElement?.id === 'managed-filings-refresh-view'" +
            " && document.querySelector('#managed-filings-refresh-view')?.value === 'new'" +
            " && document.querySelector('.managed-filings-count')?.textContent === '0 of 0 loaded filings · Page 1 of 1'" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 0" +
            " && document.querySelector('.managed-filings-refresh-comparison details')?.open === true");
        assertFilingsDraftAndCounts(4, 1, 1);
        click(".managed-filings-toolbar .trial-actions > button:first-child");
        awaitPage("last refresh is pending before native Back", "document.querySelector('.managed-company-filings')?.getAttribute('aria-busy') === 'true'");
        awaitPage("pending refresh retains the last accepted comparison and refresh view", emptyComparison +
            " && document.querySelector('#managed-filings-refresh-view')?.value === 'new'");
        assertCompanyHistory("listing-zero", "filings", false);
        closeSoftKeyboard();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            android.view.WindowInsets insets = webView.getRootWindowInsets();
            assertNotNull("Filings Back requires observed native window insets", insets);
            boolean imeVisible = insets.isVisible(android.view.WindowInsets.Type.ime());
            Log.i("ManagedBack", "phase=filings-native-ready, activityFocus=" + activity.hasWindowFocus() +
                ", viewFocus=" + webView.hasFocus() + ", windowFocus=" + webView.hasWindowFocus() +
                ", imeVisible=" + imeVisible);
            assertTrue("Filings Activity must have focus before Back", activity.hasWindowFocus());
            assertTrue("Filings WebView must have focus before Back", webView.hasFocus());
            assertTrue("Filings window must have focus before Back", webView.hasWindowFocus());
            assertFalse("Filings Back requires the native keyboard to be hidden", imeVisible);
        });
        pressBack();
        assertClosedDraft(false);
        awaitPage("Back restores the selected filing opener and its unchanged original packet", selectedPacket +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(viewFilings) + ")");
        assertFilingsDraftAndCounts(5, 2, 1);
        click("#settle-cancelled-filings");
        awaitPage("late filings cannot recreate a closed visit", "document.querySelector('.managed-company-visit') === null && document.querySelector('.managed-filings-results') === null");
        assertFilingsDraftAndCounts(5, 2, 2);
        assertReturnedRootHistory("listing-zero", "filings");
        Log.i("ManagedFilings", "phase=pages-cancel-failure-empty-back-late; " + pageDiagnostic());
        click(ANNUAL);
        click(".managed-company-sections button[aria-label='Filings section for ZERO']");
        click(".managed-filings-toolbar .trial-actions > button:first-child");
        awaitPage("reopened Filings requires one fresh explicit read", loaded +
            " && document.querySelectorAll('.managed-filings-list > li').length === 25");
        awaitPage("a reopened visit clears its prior comparison",
            "document.querySelector('.managed-filings-refresh-comparison') === null");
        assertFilingsDraftAndCounts(6, 2, 2);
        click(".managed-filings-pagination > button:last-child");
        String add = ".managed-filings-list button[aria-label='Add Form 8-K filing 0000000001-26-000026 reference to note draft']";
        awaitPage("page two exposes the exact observed row's draft action",
            "document.querySelector('.managed-filings-count')?.textContent.includes('Page 2 of 2')" +
            " && document.querySelector(" + JSONObject.quote(add) + ")?.getAttribute('aria-disabled') === 'false'" +
            " && document.querySelector(" + JSONObject.quote(add) + ")?.textContent === 'Add reference to note draft'");
        retainAnnualNoteFrame("companyFilingsNoteSource", ".managed-filings-list > li", ".managed-filings-list > li", 1);
        click(add);
        awaitPage("explicit append preserves the complete reference and focused row action",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(FILINGS_NOTE) +
            " && document.querySelector('.managed-filings-note-status')?.textContent === " +
            JSONObject.quote("Filing reference added to the note draft. Review and save all changes in My Watchlist.") +
            " && document.querySelector(" + JSONObject.quote(add) + ")?.getAttribute('aria-disabled') === 'true'" +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(add) + ")");
        assertFilingsNoteDraft(1, true);
        assertFilingsNoteCounts(0, 1);
        click(add);
        awaitPage("a second activation cannot append an identical paragraph",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(FILINGS_NOTE) +
            " && document.querySelector('.managed-filings-note-status')?.textContent === " +
            JSONObject.quote("This exact filing reference is already in the note draft.") +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(add) + ")");
        // Exact textarea bytes are checked; this frame shows only the visible controls.
        retainAnnualNoteFrame("companyFilingsNoteDraft", "#managed-research-note-heading",
            "#managed-research-note-heading, [aria-labelledby=managed-research-note-heading] > .trial-actions > button, " +
            "label[for=managed-research-note], #managed-research-note, #managed-research-note-help", 6);
        assertFilingsNoteDraft(1, true);
        assertFilingsNoteCounts(0, 1);
        assertFixtureBoundary();
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("Review returns to the complete unsaved watchlist and focuses the exact filing-note reader",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.activeElement === document.querySelector('#managed-note-1-reading-toggle')");
        assertFullNoteReading("managed-note-1", FILINGS_NOTE, true);
        assertFilingsNoteDraft(1, true);
        assertFilingsNoteCounts(0, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("only explicit Save acknowledges the filing note", DIAGNOSTICS + ".save === 1 && document.body.textContent.includes('Version 2 · Saved')");
        assertFilingsNoteDraft(2, false);
        assertFilingsNoteCounts(1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("reload restores the exact reordered filing note", DIAGNOSTICS + ".load === 2 && document.querySelector('#managed-note-1')?.disabled === false");
        assertFilingsNoteDraft(2, false);
        assertFilingsNoteCounts(1, 2);
        assertEquals("Filings journey preserves its document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertExactHistory(1, "https://localhost/", "https://localhost/");
        assertFixtureBoundary(0, 1);
        Log.i("ManagedFilings", "phase=reference-appended-reviewed-saved-reloaded; " + pageDiagnostic());
        verifyFilingsAfterAnnual(documentTimeOrigin);
    }

    private void verifyFilingsAfterAnnual(double documentTimeOrigin) throws Exception {
        click(ANNUAL);
        awaitPage("saved company Annual opens without another source read",
            "document.querySelector('#managed-annual-heading') !== null && " + DIAGNOSTICS + ".annual === 0");
        assertFilingsNoteDraft(2, false);
        assertFilingsNoteCounts(1, 2);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("one explicit Annual load supplies the original filing date",
            DIAGNOSTICS + ".annual === 1" +
            " && document.querySelector('.managed-annual-report .trial-actions button:first-child')?.textContent === 'Refresh annual report'" +
            " && document.querySelector('.managed-annual-report')?.textContent.includes('2026-02-01')");
        click(".managed-company-sections button[aria-label='Filings section for ZERO']");
        awaitPage("new Filings visit stays unloaded until its explicit read",
            "document.querySelector('.managed-filings-results') === null && " + DIAGNOSTICS + ".filings === 6");
        click(".managed-filings-toolbar .trial-actions > button:first-child");
        String source = "document.querySelector('.managed-filings-period')?.textContent.includes('2026-06-23 to 2026-09-20')" +
            " && document.querySelector('.managed-filings-source')?.textContent.includes('Retrieved 2026-09-20T00:00:01.000Z')" +
            " && Array.from(document.querySelectorAll('.managed-filings-source-details dt')).some(dt => dt.textContent === 'Request started' && dt.nextElementSibling?.textContent === '2026-09-20T00:00:00.000Z')" +
            " && Array.from(document.querySelectorAll('.managed-filings-source-details dt')).some(dt => dt.textContent === 'Completed' && dt.nextElementSibling?.textContent === '2026-09-20T00:00:02.000Z')";
        awaitPage("loaded metadata offers a native date choice from the same company Annual", source +
            " && document.querySelector('.managed-filings-count')?.textContent === '26 of 26 loaded filings · Page 1 of 2'" +
            " && document.querySelector('label[for=managed-filings-date]')?.textContent === 'Filing date'" +
            " && document.querySelector('#managed-filings-date')?.getBoundingClientRect().height >= 44" +
            " && Array.from(document.querySelectorAll('#managed-filings-date option')).map(e => e.value).join('|') === 'all|after-annual'");
        click(".managed-filings-annual-context > summary");
        awaitPage("Annual baseline retains its original accession and source dates",
            "document.querySelector('.managed-filings-annual-context')?.open === true" +
            " && document.querySelector('.managed-filings-annual-details a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm'" +
            " && document.querySelector('.managed-filings-annual-details')?.textContent.includes('Filed 2026-02-01')" +
            " && document.querySelector('.managed-filings-annual-details')?.textContent.includes('Annual cutoff 2026-09-20T00:00:00.000Z')" +
            " && document.querySelector('.managed-filings-annual-details')?.textContent.includes('Completed 2026-09-20T00:00:02.000Z')" +
            " && document.querySelector('.managed-filings-annual-details')?.textContent.includes('Submissions captured 2026-09-20T00:00:02.000Z')" +
            " && document.querySelector('.managed-filings-annual-details')?.textContent.includes('predates the loaded window')");
        chooseNativeSelectOption("#managed-filings-date", "after-annual", "Filed after Annual report");
        awaitPage("date scope excludes the Annual accession from the unchanged loaded packet", source +
            " && document.activeElement?.id === 'managed-filings-date'" +
            " && document.querySelector('.managed-filings-count')?.textContent === '25 of 26 loaded filings · Page 1 of 1'" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 25" +
            " && document.querySelector('.managed-filings-list > li:first-child a')?.href.endsWith('0000000001-26-000002-index.htm')" +
            " && document.querySelector('.managed-filings-list > li:last-child a')?.href.endsWith('0000000001-26-000026-index.htm')");
        assertFilingsAnnualScopeCounts();
        chooseNativeSelectOption("#managed-filings-form", "10-Q", "10-Q");
        awaitPage("combined filters show a qualified empty result without discarding source metadata", source +
            " && document.querySelector('.managed-filings-count')?.textContent === '0 of 26 loaded filings · Page 1 of 1'" +
            " && document.querySelectorAll('.managed-filings-list > li').length === 0" +
            " && document.querySelector('.managed-filings-empty')?.textContent.includes('does not establish that no subsequent filings exist')");
        chooseNativeSelectOption("#managed-filings-form", "8-K", "8-K");
        awaitPage("combined date and Form choices preserve the twenty-five original matches", source +
            " && document.querySelector('.managed-filings-count')?.textContent === '25 of 26 loaded filings · Page 1 of 1'");
        chooseNativeSelectOption("#managed-filings-form", "", "All forms");
        chooseNativeSelectOption("#managed-filings-date", "all", "All loaded filings");
        awaitPage("clearing the local choices restores the original first accession", source +
            " && document.querySelector('.managed-filings-count')?.textContent === '26 of 26 loaded filings · Page 1 of 2'" +
            " && document.querySelector('.managed-filings-list > li:first-child a')?.href.endsWith('0000000001-26-000001-index.htm')");
        assertFilingsAnnualScopeCounts();
        assertFilingsNoteDraft(2, false);
        closeSoftKeyboard();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        awaitPage("Back closes local filings scope and returns focus to its saved-company opener",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(ANNUAL) + ")");
        assertFilingsAnnualScopeCounts();
        assertFilingsNoteDraft(2, false);
        assertExactHistory(1, "https://localhost/", "https://localhost/", companyUrl("listing-zero", "filings"));
        assertEquals("Date filtering preserves the original document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private void assertFilingsAnnualScopeCounts() throws Exception {
        awaitPage("local date and Form choices retain only the two explicit post-save source reads",
            DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".filings === 7" +
            " && " + DIAGNOSTICS + ".filingsAborted === 2 && " + DIAGNOSTICS + ".filingsLateResolved === 2" +
            " && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".save === 1 && " + DIAGNOSTICS + ".load === 2" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".calendar === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    private void assertFilingsNoteDraft(int version, boolean dirty) throws Exception {
        awaitPage("filing note keeps both complete notes, order and save version",
            DRAFT + ".baseVersion === " + version + " && " + DRAFT + ".dirty === " + dirty +
            " && " + DRAFT + ".memberships?.length === 2" +
            " && " + DRAFT + ".memberships[0]?.listingId === 'listing-one'" +
            " && " + DRAFT + ".memberships[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships[1]?.listingId === 'listing-zero'" +
            " && " + DRAFT + ".memberships[1]?.note === " + JSONObject.quote(FILINGS_NOTE) +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && Array.from(document.querySelectorAll('[aria-labelledby=managed-watchlist-heading] button')).find(button => button.textContent === 'Save watchlist')?.disabled === " + !dirty);
    }

    private void assertFilingsNoteCounts(int saves, int loads) throws Exception {
        awaitPage("filing append and save have only explicit requests",
            DIAGNOSTICS + ".filings === 6 && " + DIAGNOSTICS + ".filingsAborted === 2 && " + DIAGNOSTICS + ".filingsLateResolved === 2" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".calendar === 0" +
            " && " + DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".load === " + loads +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    private void assertFilingsDraftAndCounts(int reads, int aborted, int late) throws Exception {
        awaitPage("filings counts and complete draft stay in their owners",
            DIAGNOSTICS + ".filings === " + reads + " && " + DIAGNOSTICS + ".filingsAborted === " + aborted +
            " && " + DIAGNOSTICS + ".filingsLateResolved === " + late +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".calendar === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".load === 1" +
            " && " + DRAFT + ".baseVersion === 1 && " + DRAFT + ".dirty === true" +
            " && " + DRAFT + ".memberships?.length === 2" +
            " && " + DRAFT + ".memberships[0]?.listingId === 'listing-one'" +
            " && " + DRAFT + ".memberships[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships[1]?.listingId === 'listing-zero'" +
            " && " + DRAFT + ".memberships[1]?.note === " + JSONObject.quote(NOTE));
    }

    @Test
    public void switchingResearchPanelsPreservesDraftAndDiscardsLateAnnual() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        prepareDraftAndOpenAnnual();
        awaitPage("Annual opens without a research request",
            DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null");
        click(".managed-annual-report .trial-actions button:first-child");
        assertPendingAnnualDraft();
        assertFixtureReadCounts(1, 0, 0);

        click(".managed-company-sections button[aria-label='Price section for ZERO']");
        String unloadedEod =
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Price section for ZERO']\")?.getAttribute('aria-pressed') === 'true'" +
            " && document.querySelector('.managed-annual-report') === null" +
            " && document.querySelector('.managed-eod-history')?.getAttribute('aria-busy') === 'false'" +
            " && document.querySelector('.managed-eod-history .managed-metadata') === null" +
            " && document.querySelector('.managed-eod-history .managed-eod-chart') === null" +
            " && document.querySelector('.managed-eod-history table') === null" +
            " && Array.from(document.querySelectorAll('.managed-eod-history button')).some(b => b.textContent === 'Load one-month close history' && !b.disabled)";
        awaitPage("switch aborts Annual and opens unloaded EOD", unloadedEod +
            " && document.activeElement?.id === 'managed-eod-heading'");
        assertResearchSwitchDraftAndCounts(1, 0, 0);
        click("#settle-cancelled-read");
        assertResearchSwitchDraftAndCounts(1, 0, 1);
        awaitPage("late Annual completion cannot reopen a panel or load EOD", unloadedEod);
        Log.i("ManagedResearchSwitch", "phase=late-annual-discarded; " + pageDiagnostic());

        clickEodAction("Load one-month close history");
        String loadedEod =
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Price section for ZERO']\")?.getAttribute('aria-pressed') === 'true'" +
            " && document.querySelector('.managed-annual-report') === null" +
            " && document.querySelector('.managed-eod-history')?.getAttribute('aria-busy') === 'false'" +
            " && document.querySelector('.managed-eod-history caption')?.textContent === 'Raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-18|100.25;2026-09-19|101.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '101.5|2026-09-19|2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Tiingo')" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Annual section for ZERO']\")?.disabled === false";
        awaitPage("explicit EOD load returns the same listing's exact closes and provenance", loadedEod);
        assertResearchSwitchDraftAndCounts(1, 1, 1);
        Log.i("ManagedResearchSwitch", "phase=eod-loaded; " + pageDiagnostic());

        click(".managed-company-sections button[aria-label='Annual section for ZERO']");
        String unloadedAnnual =
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Annual section for ZERO']\")?.getAttribute('aria-pressed') === 'true'" +
            " && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'false'" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null" +
            " && document.querySelector('.managed-annual-report [role=alert]') === null" +
            " && document.querySelector('.managed-eod-history') === null" +
            " && document.querySelector('.managed-eod-chart') === null" +
            " && Array.from(document.querySelectorAll('.managed-annual-report button')).some(b => b.textContent === 'Load annual report' && !b.disabled)";
        awaitPage("cancelled Annual remains unloaded when revisited", unloadedAnnual +
            " && document.activeElement?.id === 'managed-annual-heading'");
        assertResearchSwitchDraftAndCounts(1, 1, 1);

        click(".managed-annual-report .trial-actions button:first-child");
        String loadedAnnual =
            "(() => { const report = document.querySelector('.managed-annual-report .sec-quarterly-comparison');" +
            " const generations = JSON.parse(document.querySelector('#fixture-report-generations').textContent);" +
            " const wanted = generations.recovered;" +
            " return document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Annual section for ZERO']\")?.getAttribute('aria-pressed') === 'true'" +
            " && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'false'" +
            " && report !== null && report.textContent.includes(wanted.sha256)" +
            " && report.textContent.includes(wanted.completedAt) && report.textContent.includes(wanted.cutoffAt)" +
            " && report.textContent.includes(wanted.sources.companyFacts.fetchedAt)" +
            " && report.textContent.includes(wanted.sources.submissions.fetchedAt)" +
            " && !report.textContent.includes(generations.initial.sha256)" +
            " && Array.from(report.querySelectorAll('.managed-annual-values tbody tr td:first-of-type')).map(e => e.textContent).join(',') === '2000,300,15%'" +
            " && document.querySelector('.managed-annual-report .trial-actions button:first-child')?.textContent === 'Refresh annual report'" +
            " && document.querySelector('.managed-eod-history') === null" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Price section for ZERO']\")?.disabled === false; })()";
        awaitPage("explicit fresh Annual replaces only the discarded request", loadedAnnual);
        assertResearchSwitchDraftAndCounts(2, 1, 1);

        click(".managed-company-sections button[aria-label='Price section for ZERO']");
        awaitPage("return to Price retains exact rows and provenance without another request", loadedEod +
            " && document.activeElement?.id === 'managed-eod-heading'");
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainSwitchedEodScreenshot(loadedEod);
        awaitPage("retained Price evidence stays unchanged through capture", loadedEod);
        click(".managed-company-sections button[aria-label='Annual section for ZERO']");
        awaitPage("second Annual visit retains the same validated report", loadedAnnual +
            " && document.activeElement?.id === 'managed-annual-heading'");
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        click(".managed-company-sections button[aria-label='Price section for ZERO']");
        awaitPage("second Price return retains the same dated evidence", loadedEod +
            " && document.activeElement?.id === 'managed-eod-heading'");
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        Log.i("ManagedResearchSwitch", "phase=loaded-sections-retained; " + pageDiagnostic());
        assertCompanyHistory("listing-zero", "price", false);
        closeSoftKeyboard();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            android.view.WindowInsets insets = webView.getRootWindowInsets();
            assertNotNull("Panel-switch Back requires observed native window insets", insets);
            boolean imeVisible = insets.isVisible(android.view.WindowInsets.Type.ime());
            Log.i("ManagedBack", "phase=panel-switch-native-ready, activityFocus=" + activity.hasWindowFocus() +
                ", viewFocus=" + webView.hasFocus() + ", windowFocus=" + webView.hasWindowFocus() +
                ", imeVisible=" + imeVisible);
            assertTrue("Panel-switch Activity must have focus before Back", activity.hasWindowFocus());
            assertTrue("Panel-switch WebView must have focus before Back", webView.hasFocus());
            assertTrue("Panel-switch window must have focus before Back", webView.hasWindowFocus());
            assertFalse("Panel-switch Back requires the native keyboard to be hidden", imeVisible);
        });
        pressBack();
        assertClosedDraft(true);
        awaitPage("native Back leaves both research panels closed",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-annual-report') === null && document.querySelector('.managed-eod-history') === null");
        assertResearchSwitchDraftAndCounts(2, 1, 1);

        click(ANNUAL);
        awaitPage("reopening the same company starts a new unloaded Annual visit", unloadedAnnual);
        click(".managed-company-sections button[aria-label='Price section for ZERO']");
        awaitPage("leaving the previous visit also cleared its Price response", unloadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        click(".managed-company-visit .trial-toolbar > button");
        assertClosedDraft(true);
        awaitPage("on-screen Back closes the fresh company visit", "document.querySelector('.managed-company-visit') === null");
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        scenario.onActivity(activity -> {
            assertNotNull("Original research Activity was collected", originalActivity.get().get());
            assertNotNull("Original research WebView was collected", originalWebView.get().get());
            assertSame("Panel switching must preserve the Activity", originalActivity.get().get(), activity);
            assertSame("Panel switching must preserve the WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("Panel switching must preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertReturnedRootHistory("listing-zero", "price");
        assertFixtureBoundary();
        Log.i("ManagedResearchSwitch", "phase=back-original-opener, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
    }

    @Test
    public void marketsLoadCancelAndNavigationPreserveDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        awaitPage("Markets is the default with resolved identities and no price reads",
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'Markets'" +
            " && " + DIAGNOSTICS + ".marketsResolve === 1 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && document.querySelectorAll('.managed-market-row').length === 3" +
            " && document.querySelector('.managed-market-change') === null" +
            " && document.querySelector('.managed-market-detail table') === null" +
            " && document.querySelector('.managed-market-detail canvas') === null" +
            " && document.querySelector('[aria-labelledby=managed-watchlist-heading]')?.hidden === true");
        typeIntoInput("workspace-company-query", "ZERO");
        click(".workspace-global-search button[type=submit]");
        awaitPage("Search opens visible Discover without a price read",
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'Discover'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && " + DIAGNOSTICS + ".search === 1 && " + DIAGNOSTICS + ".marketsEod === 0");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("Markets journey reorders the mounted draft",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Markets");
        awaitPage("second Markets visit resolves again without loading prices",
            DIAGNOSTICS + ".marketsResolve === 2 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && Array.from(document.querySelectorAll('.managed-market-close strong')).every(e => e.textContent === 'Not loaded')");
        clickMarketsAction("Load board prices");
        assertMarketsRows(false);
        assertMarketsRawChanges(false);
        assertMarketsSharedComparison(false);
        awaitPage("both visible shared date controls are at least 44 pixels high",
            "document.querySelector('.managed-markets .managed-price-comparison-start-select')?.getBoundingClientRect().height >= 44" +
            " && document.querySelector('.managed-markets .managed-price-comparison-end-select')?.getBoundingClientRect().height >= 44");
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-start-select", "", "Choose an observed date");
        assertMarketsComparisonDates("", "2026-09-19", "|2026-09-18", "|2026-09-19");
        awaitPage("an empty shared Start withholds figures without replacing End",
            "document.querySelector('.managed-markets .managed-price-comparison-values') === null" +
            " && document.querySelector('.managed-markets .managed-price-comparison-status')?.textContent === 'Choose a starting date before the ending date.'" +
            " && document.querySelectorAll('.managed-markets .managed-price-comparison-provenance > section').length === 3");
        assertMarketsDraftAndCounts(2, 3, 0, 0);
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-start-select", "2026-09-18", "2026-09-18");
        assertMarketsSharedComparison(false);
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-end-select", "", "Choose an observed date");
        assertMarketsComparisonDates("2026-09-18", "", "|2026-09-18", "|2026-09-19");
        awaitPage("an empty shared End withholds figures and keeps the original coverage",
            "document.querySelector('.managed-markets .managed-price-comparison-values') === null" +
            " && document.querySelector('.managed-markets .managed-price-comparison-status')?.textContent === 'Choose an ending date after the starting date.'" +
            " && document.querySelector('.managed-markets .managed-price-comparison-order select')?.value === 'board'" +
            " && Array.from(document.querySelectorAll('.managed-markets .managed-price-comparison-provenance section dd:nth-of-type(3)')).map(e => e.textContent).join('|') === '2 / 0|2 / 0|2 / 0'");
        assertMarketsDraftAndCounts(2, 3, 0, 0);
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-end-select", "2026-09-19", "2026-09-19");
        assertMarketsSharedComparison(false);
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-order select", "highest", "Highest raw change");
        assertMarketsComparisonOrder("highest", "ALFA,BETB,BETA",
            "ALFA|10.25|10.5|+2.4390%;BETB|30.5|30.5|0.0000%;BETA|20.75|20.5|-1.2048%");
        assertMarketsDraftAndCounts(2, 3, 0, 0);
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-order select", "board", "Board order");
        assertMarketsSharedComparison(false);
        awaitPage("explicit board order restores the original comparison",
            "document.querySelector('.managed-markets .managed-price-comparison-order select')?.value === 'board'" +
            " && document.querySelector('.managed-markets .managed-price-comparison th[aria-sort]')?.getAttribute('aria-sort') === 'none'");
        chooseNativeSelectOption(".managed-markets .managed-price-comparison-order select", "lowest", "Lowest raw change");
        assertMarketsComparisonOrder("lowest", "BETA,BETB,ALFA",
            "BETA|20.75|20.5|-1.2048%;BETB|30.5|30.5|0.0000%;ALFA|10.25|10.5|+2.4390%");
        assertMarketsDetail("ALFA", "2026-09-18|10.25;2026-09-19|10.5", false);
        assertMarketsDraftAndCounts(2, 3, 0, 0);
        awaitPage("three loaded rows keep distinct share classes",
            "Array.from(document.querySelectorAll('.managed-market-identity small')).map(e => e.textContent).join('|') === 'Common Stock · XNAS|Class A · XNAS|Class C · XNAS'" +
            " && document.querySelector('.managed-markets .trial-actions button:first-child')?.textContent === 'Refresh board prices'");
        click("button[aria-label='Select BETB on company board']");
        assertMarketsDetail("BETB", "2026-09-18|30.5;2026-09-19|30.5", false);
        click("button[aria-label='Select ALFA on company board']");
        assertMarketsDetail("ALFA", "2026-09-18|10.25;2026-09-19|10.5", false);
        assertMarketsDraftAndCounts(2, 3, 0, 0);
        retainMarketsRawChangeScreenshot();
        retainMarketsLoadedScreenshot();
        Log.i("ManagedMarkets", "phase=three-loaded-explicit, reads=3; " + pageDiagnostic());

        clickMarketsAction("Refresh board prices");
        assertMarketsRows(true);
        assertMarketsRawChanges(true);
        awaitPage("the completed first refresh replaces its whole dated response",
            "Array.from(document.querySelectorAll('.managed-market-detail tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-19|11.25;2026-09-20|11.5'" +
            " && Array.from(document.querySelectorAll('.managed-market-detail .managed-metadata dd')).map(e => e.textContent).join('|') === '2026-08-21 to 2026-09-21|2026-09-21T00:00:00.000Z|2026-09-21T00:00:02.000Z'");
        awaitPage("refresh is sequential and holds only the second row",
            DIAGNOSTICS + ".marketsEod === 5 && " + DIAGNOSTICS + ".marketsAborted === 0" +
            " && document.querySelector('.managed-markets .trial-actions button:first-child')?.disabled === true" +
            " && document.querySelectorAll('.managed-market-rows .managed-eod-previous').length === 2" +
            " && Array.from(document.querySelectorAll('.managed-market-rows .managed-eod-previous')).every(e => e.textContent === 'Previous history · completed 2026-09-20T00:00:01.000Z. This refresh has not confirmed newer prices.')" +
            " && Array.from(document.querySelectorAll('.managed-market-rows > li')).filter(e => e.querySelector('.managed-eod-previous')).map(e => e.querySelector('.managed-market-identity strong').textContent).join(',') === 'BETA,BETB'");
        assertMarketsSharedComparison(true);
        awaitPage("unavailable comparison retains the enabled order preference",
            "document.querySelector('.managed-markets .managed-price-comparison-order select')?.value === 'lowest'" +
            " && document.querySelector('.managed-markets .managed-price-comparison-order select')?.disabled === false");
        clickMarketsAction("Cancel board prices");
        assertMarketsDraftAndCounts(2, 5, 1, 0);
        assertMarketsRawChanges(true);
        assertMarketsSharedComparison(true);
        awaitPage("Cancel restores focus after the load action is enabled",
            "document.activeElement === document.querySelector('.managed-markets .trial-actions button:first-child')" +
            " && document.activeElement.disabled === false" +
            " && document.querySelector('.managed-market-rows .managed-eod-previous') !== null");
        click("button[aria-label='Select BETA on company board']");
        assertMarketsDetail("BETA", "2026-09-18|20.75;2026-09-19|20.5", true);
        click("button[aria-label='Board price history for BETA']");
        awaitPage("board opens the same dated BETA response without another request",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · BETA'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Beta Class A · Class A · XNAS'" +
            " && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'" +
            " && document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('.managed-market-detail table') !== null");
        assertMarketsCompanyHistory("20.5", "2026-09-19", "2026-08-20 to 2026-09-20",
            "2026-09-20T00:00:00.000Z", "2026-09-20T00:00:01.000Z", "2026-09-18|20.75;2026-09-19|20.5", true, true);
        assertCompanyHistory("listing-beta-a", "price", false);
        assertMarketsDraftAndCounts(2, 5, 1, 0);
        click("#settle-cancelled-markets");
        assertMarketsDraftAndCounts(2, 5, 1, 1);
        assertMarketsRows(true);
        assertMarketsRawChanges(true);
        assertMarketsSharedComparison(true);
        assertMarketsDetail("BETA", "2026-09-18|20.75;2026-09-19|20.5", true);
        awaitPage("late board values cannot replace the retained response",
            "!document.querySelector('.managed-markets')?.textContent.includes('998.25')" +
            " && !document.querySelector('.managed-markets')?.textContent.includes('999.75')");
        assertMarketsCompanyHistory("20.5", "2026-09-19", "2026-08-20 to 2026-09-20",
            "2026-09-20T00:00:00.000Z", "2026-09-20T00:00:01.000Z", "2026-09-18|20.75;2026-09-19|20.5", true, true);
        retainAnnualNoteFrame("marketsPriceHandoffPrevious", ".managed-eod-history .managed-eod-origin",
            ".managed-eod-history .managed-eod-origin, .managed-eod-history .managed-eod-previous, .managed-eod-history .managed-eod-quote", 3);
        assertMarketsDraftAndCounts(2, 5, 1, 1);
        Log.i("ManagedMarkets", "phase=cancelled-late-discarded, reads=5; " + pageDiagnostic());
        pressBack();
        awaitPage("native Back restores the original board opener and its previous history",
            "document.querySelector('.managed-eod-history') === null" +
            " && document.activeElement === document.querySelector(\"button[aria-label='Board price history for BETA']\")");
        assertMarketsDetail("BETA", "2026-09-18|20.75;2026-09-19|20.5", true);
        assertMarketsRawChanges(true);
        assertReturnedRootHistory("listing-beta-a", "price");
        pressBack();
        assertMarketsRows(true);
        assertMarketsDraftAndCounts(2, 5, 1, 1);
        click("button[aria-label='Board Annual report for BETA']");
        awaitPage("Annual-first entry stays unloaded without reading either provider",
            "document.activeElement?.id === 'managed-annual-heading'" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null" +
            " && document.querySelector('.managed-eod-history') === null");
        assertCompanyHistory("listing-beta-a", "annual", false);
        assertMarketsDraftAndCounts(2, 5, 1, 1);
        click(".managed-company-sections button[aria-label='Price section for BETA']");
        awaitPage("Price reveals the response seeded at Annual entry", "document.activeElement?.id === 'managed-eod-heading'");
        assertCompanyHistory("listing-beta-a", "price", false);
        assertMarketsCompanyHistory("20.5", "2026-09-19", "2026-08-20 to 2026-09-20",
            "2026-09-20T00:00:00.000Z", "2026-09-20T00:00:01.000Z", "2026-09-18|20.75;2026-09-19|20.5", true, true);
        assertMarketsDraftAndCounts(2, 5, 1, 1);
        click("[aria-labelledby=managed-research-note-heading] button:first-child");
        awaitPage("explicit add appends only BETA with an empty note",
            "document.querySelector('#managed-research-note')?.value === ''" +
            " && " + DRAFT + ".memberships?.[2]?.note === ''" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO,BETA'");
        typeIntoInput("managed-research-note", "Markets research draft");
        String companyScope = ".managed-eod-history";
        assertEmptyComparison(companyScope, "BETA", "|2026-09-18");
        chooseComparisonDate(companyScope, "2026-09-18");
        awaitPage("seeded history supports the exact observed comparison",
            rawCloseComparison(companyScope, "2026-09-18", "20.75", "2026-09-19", "20.5", "Raw close change: -$0.25 (-1.2048%)"));
        click(companyScope + " .managed-price-note-action button");
        awaitPage("append retains the old Markets evidence and previous-history qualification",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(MARKETS_PRICE_NOTE));
        assertMarketsHandoffDraftAndCounts(2, 0, 0, 1);
        Log.i("ManagedMarketsHandoff", "phase=annual-first-comparison-appended, eod=0, save=0; " + pageDiagnostic());
        clickEodAction("Refresh close history");
        assertMarketsCompanyHistory("21.5", "2026-09-20", "2026-08-21 to 2026-09-21",
            "2026-09-21T00:00:00.000Z", "2026-09-21T00:00:02.000Z", "2026-09-19|21.25;2026-09-20|21.5", false, false);
        assertEmptyComparison(companyScope, "BETA", "|2026-09-19");
        assertMarketsHandoffDraftAndCounts(2, 1, 0, 1);
        assertMarketsDetail("BETA", "2026-09-18|20.75;2026-09-19|20.5", true);
        pressBack();
        awaitPage("Back restores the Annual opener and unchanged Markets history",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.activeElement === document.querySelector(\"button[aria-label='Board Annual report for BETA']\")");
        assertMarketsDetail("BETA", "2026-09-18|20.75;2026-09-19|20.5", true);
        assertMarketsRawChanges(true);
        assertReturnedRootHistory("listing-beta-a", "price");
        awaitPage("company Back retains the mounted comparison order",
            "document.querySelector('.managed-markets .managed-price-comparison-order select')?.value === 'lowest'");
        selectWorkspaceView("Discover");
        awaitPage("leaving Markets retires all its price views",
            "document.querySelector('.managed-markets') === null && document.querySelector('.managed-eod-chart') === null" +
            " && document.querySelector('.managed-markets .managed-price-comparison') === null");
        selectWorkspaceView("Markets");
        awaitPage("returning Markets resolves fresh identities but remains unloaded",
            DIAGNOSTICS + ".marketsResolve === 3" +
            " && document.querySelectorAll('.managed-market-row').length === 3" +
            " && Array.from(document.querySelectorAll('.managed-market-close strong')).every(e => e.textContent === 'Not loaded')" +
            " && document.querySelector('.managed-market-change') === null" +
            " && document.querySelector('.managed-market-detail table') === null" +
            " && document.querySelector('.managed-market-detail canvas') === null" +
            " && document.querySelector('.managed-markets .managed-eod-previous') === null" +
            " && document.querySelector('.managed-markets .managed-price-comparison-values') === null" +
            " && document.querySelector('.managed-markets .managed-price-comparison-order select')?.value === 'board'" +
            " && document.querySelector('.managed-markets .managed-price-comparison-order select')?.disabled === false" +
            " && document.querySelector('.managed-markets .managed-price-comparison-provenance') === null" +
            " && document.querySelector('.managed-markets .managed-price-comparison-status')?.textContent.includes('Comparison unavailable.')" +
            " && !document.querySelector('.managed-markets .managed-price-comparison')?.textContent.includes('2026-09-')");
        assertMarketsHandoffDraftAndCounts(3, 1, 0, 1);
        selectWorkspaceView("My Watchlist");
        awaitPage("the final watchlist draft is visible and unchanged",
            "document.querySelector('[aria-labelledby=managed-watchlist-heading]')?.hidden === false");
        assertMarketsHandoffDraftAndCounts(3, 1, 0, 1);
        scenario.onActivity(activity -> {
            assertNotNull("Original Markets Activity was collected", originalActivity.get().get());
            assertNotNull("Original Markets WebView was collected", originalWebView.get().get());
            assertSame("Markets navigation must preserve Activity", originalActivity.get().get(), activity);
            assertSame("Markets navigation must preserve WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("Markets navigation must preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertReturnedRootHistory("listing-beta-a", "price");
        assertFixtureBoundary();
        Log.i("ManagedMarkets", "phase=left-cleared-draft-retained, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("one explicit save acknowledges the exact three-member draft", DIAGNOSTICS + ".save === 1");
        assertMarketsHandoffDraftAndCounts(3, 1, 1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("reload returns the saved Markets comparison", DIAGNOSTICS + ".load === 2");
        assertMarketsHandoffDraftAndCounts(3, 1, 1, 2);
        assertEquals("Markets note save and reload preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertReturnedRootHistory("listing-beta-a", "price");
        Log.i("ManagedMarketsHandoff", "phase=company-refreshed-board-retained-saved-reloaded, eod=1, save=1; " + pageDiagnostic());
    }

    @Test
    public void selectedMarketPriceLoadRefreshAndCancelPreserveDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        awaitPage("selected-price journey starts with metadata only",
            DIAGNOSTICS + ".marketsResolve === 1 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && document.querySelectorAll('.managed-market-row').length === 3");
        typeIntoInput("workspace-company-query", "ZERO");
        click(".workspace-global-search button[type=submit]");
        awaitPage("search remains separate from price reads",
            DIAGNOSTICS + ".search === 1 && document.querySelector('.managed-results strong')?.textContent === 'ZERO'");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("selected-price journey reorders the shared draft",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Markets");
        awaitPage("returning to Markets resolves all identities without a price read",
            DIAGNOSTICS + ".marketsResolve === 2 && document.querySelectorAll('.managed-market-row').length === 3");
        for (String symbol : new String[] {"BETB", "BETA", "ALFA"}) {
            click("button[aria-label='Select " + symbol + " on company board']");
            awaitPage("selecting " + symbol + " only changes the displayed listing",
                "document.querySelector('.managed-market-period')?.textContent === " + JSONObject.quote(symbol + " · one month") +
                " && Array.from(document.querySelectorAll('.managed-market-close strong')).map(e => e.textContent).join('|') === 'Not loaded|Not loaded|Not loaded'" +
                " && document.querySelector('.managed-market-detail table') === null" +
                " && document.querySelector('.managed-market-detail canvas') === null" +
                " && document.querySelector('.managed-market-change') === null");
            assertMarketsDraftAndCounts(2, 0, 0, 0);
        }
        clickMarketsAction("Load ALFA price");
        assertSelectedMarketRows(false, false);
        assertMarketsDetail("ALFA", "2026-09-18|10.25;2026-09-19|10.5", false);
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        awaitPage("the one-row action now offers an explicit refresh",
            "Array.from(document.querySelectorAll('.managed-market-detail button')).some(b => b.textContent === 'Refresh ALFA price' && !b.disabled)");
        retainSelectedMarketPriceScreenshot();
        Log.i("ManagedSelectedPrice", "phase=one-loaded-others-unloaded, reads=1; " + pageDiagnostic());

        clickMarketsAction("Refresh ALFA price");
        awaitPage("the selected refresh retains only ALFA's prior response",
            DIAGNOSTICS + ".marketsEod === 2 && " + DIAGNOSTICS + ".marketsAborted === 0" +
            " && document.querySelector('.managed-markets-toolbar .trial-actions button:first-child')?.disabled === true" +
            " && Array.from(document.querySelectorAll('.managed-markets-toolbar .trial-actions button')).some(b => b.textContent === 'Cancel price loading')");
        assertSelectedMarketRows(false, true);
        click("button[aria-label='Select BETA on company board']");
        awaitPage("changing selection cannot retarget the active ALFA request",
            "document.querySelector('.managed-market-period')?.textContent === 'BETA · one month'" +
            " && document.querySelector('.managed-market-detail table') === null" +
            " && document.querySelector('.managed-market-detail canvas') === null" +
            " && Array.from(document.querySelectorAll('.managed-market-detail button')).some(b => b.textContent === 'Load BETA price' && b.disabled)");
        assertMarketsDraftAndCounts(2, 2, 0, 0);
        click("button[aria-label='Select ALFA on company board']");
        assertMarketsDetail("ALFA", "2026-09-18|10.25;2026-09-19|10.5", true);
        clickMarketsAction("Cancel price loading");
        assertMarketsDraftAndCounts(2, 2, 1, 0);
        assertSelectedMarketRows(false, true);
        awaitPage("selected cancellation returns focus to the original ALFA action",
            "document.activeElement?.closest('.managed-market-detail') !== null" +
            " && document.activeElement?.textContent === 'Refresh ALFA price' && document.activeElement.disabled === false" +
            " && !Array.from(document.querySelectorAll('.managed-markets-toolbar button')).some(b => b.textContent === 'Cancel price loading')");
        click("#settle-cancelled-markets");
        assertMarketsDraftAndCounts(2, 2, 1, 1);
        assertSelectedMarketRows(false, true);
        assertMarketsDetail("ALFA", "2026-09-18|10.25;2026-09-19|10.5", true);
        awaitPage("late selected prices never replace the original dated response",
            "!document.querySelector('.managed-markets')?.textContent.includes('998.25')" +
            " && !document.querySelector('.managed-markets')?.textContent.includes('999.75')");
        Log.i("ManagedSelectedPrice", "phase=selected-cancelled-late-discarded, reads=2; " + pageDiagnostic());

        clickMarketsAction("Refresh ALFA price");
        assertSelectedMarketRows(true, false);
        assertRefreshedSelectedMarketDetail();
        assertMarketsDraftAndCounts(2, 3, 1, 1);
        click("button[aria-label='Board price history for ALFA']");
        awaitPage("selected board history opens the refreshed response in company research",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ALFA'" +
            " && document.activeElement?.id === 'managed-eod-heading'");
        assertMarketsCompanyHistory("11.5", "2026-09-20", "2026-08-21 to 2026-09-21",
            "2026-09-21T00:00:00.000Z", "2026-09-21T00:00:02.000Z", "2026-09-19|11.25;2026-09-20|11.5", true, false);
        assertCompanyHistory("listing-alfa", "price", false);
        assertMarketsDraftAndCounts(2, 3, 1, 1);
        pressBack();
        awaitPage("one native Back restores the same selected-price opener",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.activeElement === document.querySelector(\"button[aria-label='Board price history for ALFA']\")");
        assertReturnedRootHistory("listing-alfa", "price");
        assertSelectedMarketRows(true, false);
        assertRefreshedSelectedMarketDetail();
        assertMarketsDraftAndCounts(2, 3, 1, 1);
        selectWorkspaceView("My Watchlist");
        awaitPage("the selected-price journey preserves the visible unsaved draft",
            "document.querySelector('[aria-labelledby=managed-watchlist-heading]')?.hidden === false");
        assertMarketsDraftAndCounts(2, 3, 1, 1);
        scenario.onActivity(activity -> {
            assertNotNull("Selected-price Activity was collected", originalActivity.get().get());
            assertNotNull("Selected-price WebView was collected", originalWebView.get().get());
            assertSame("Selected-price research must preserve Activity", originalActivity.get().get(), activity);
            assertSame("Selected-price research must preserve WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("Selected-price research must preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
        Log.i("ManagedSelectedPrice", "phase=selected-refreshed-back-draft-retained, reads=3; " + pageDiagnostic());
    }

    @Test
    public void rawCloseComparisonUsesObservedDatesAndPreservesDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        typeIntoInput("workspace-company-query", "ZERO");
        click(".workspace-global-search button[type=submit]");
        awaitPage("comparison search is metadata only", DIAGNOSTICS + ".search === 1");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("comparison draft reordered", "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Markets");
        awaitPage("comparison board resolved without reading prices", DIAGNOSTICS + ".marketsResolve === 2");
        click("button[aria-label='Select ALFA on company board']");
        assertMarketsDraftAndCounts(2, 0, 0, 0);
        clickMarketsAction("Load ALFA price");
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        String scope = ".managed-market-detail";
        assertEmptyComparison(scope, "ALFA", "|2026-09-17|2026-09-18");
        assertMarketsDetail("ALFA", "2026-09-17|100.000000000000000001;2026-09-18|107.500000000000000002;2026-09-19|110.000000000000000003", false);
        chooseComparisonDate(scope, "2026-09-17");
        String earlier = rawCloseComparison(scope, "2026-09-17", "100.000000000000000001",
            "2026-09-19", "110.000000000000000003", "Raw close change: +$10.000000000000000002 (+10.0000%)");
        awaitPage("first of three exact observations compared with latest", earlier);
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        retainComparisonFrame("rawCloseComparedEarlier", scope);
        awaitPage("earlier exact comparison unchanged through capture", earlier);
        Log.i("ManagedComparison", "phase=earlier-long-decimal, reads=1; " + pageDiagnostic());

        chooseComparisonEndDate(scope, "2026-09-18");
        String pastInterval = rawCloseComparison(scope, "2026-09-17", "100.000000000000000001",
            "2026-09-18", "107.500000000000000002", "Raw close change: +$7.500000000000000001 (+7.5000%)");
        awaitPage("past endpoint compares only the two chosen observations", pastInterval);
        assertMarketsDetail("ALFA", "2026-09-17|100.000000000000000001;2026-09-18|107.500000000000000002;2026-09-19|110.000000000000000003", false);
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        chooseComparisonDate(scope, "2026-09-18");
        awaitPage("a later start clears the invalid ending date without inventing another interval",
            "document.querySelector('.managed-market-detail .managed-raw-close-comparison-start-select')?.value === '2026-09-18'" +
            " && document.querySelector('.managed-market-detail .managed-raw-close-comparison-end-select')?.value === ''" +
            " && document.querySelector('.managed-market-detail .managed-raw-close-comparison-result')?.textContent === ''");
        chooseComparisonEndDate(scope, "2026-09-19");
        awaitPage("an explicit ending date restores an ordered interval",
            rawCloseComparison(scope, "2026-09-18", "107.500000000000000002",
                "2026-09-19", "110.000000000000000003", "Raw close change: +$2.500000000000000001 (+2.3256%)"));
        assertMarketsDraftAndCounts(2, 1, 0, 0);

        click("button[aria-label='Select BETA on company board']");
        awaitPage("unloaded listing has no previous listing comparison",
            "document.querySelector('.managed-market-detail .managed-raw-close-comparison') === null");
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        click("button[aria-label='Select ALFA on company board']");
        assertEmptyComparison(scope, "ALFA", "|2026-09-17|2026-09-18");
        chooseComparisonDate(scope, "2026-09-18");
        String retained = rawCloseComparison(scope, "2026-09-18", "107.500000000000000002",
            "2026-09-19", "110.000000000000000003", "Raw close change: +$2.500000000000000001 (+2.3256%)");
        awaitPage("second observed date compared without another request", retained);
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        clickMarketsAction("Refresh ALFA price");
        assertMarketsDraftAndCounts(2, 2, 0, 0);
        awaitPage("pending refresh retains selected date and exact prior values", retained +
            " && document.querySelector('.managed-market-detail .managed-eod-previous') !== null");
        clickMarketsAction("Cancel price loading");
        assertMarketsDraftAndCounts(2, 2, 1, 0);
        awaitPage("cancelled refresh keeps the same comparison", retained);
        click("#settle-cancelled-markets");
        assertMarketsDraftAndCounts(2, 2, 1, 1);
        awaitPage("late reply cannot replace the retained comparison", retained);
        Log.i("ManagedComparison", "phase=retained-cancelled-late, reads=2; " + pageDiagnostic());
        clickMarketsAction("Refresh ALFA price");
        assertMarketsDraftAndCounts(2, 3, 1, 1);
        // September 18 still exists in the new response; its old selection must nevertheless reset.
        assertEmptyComparison(scope, "ALFA", "|2026-09-18|2026-09-19");
        awaitPage("new response replaces all three exact rows",
            "Array.from(document.querySelectorAll('.managed-market-detail tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-18|120.000000000000000004;2026-09-19|126.000000000000000005;2026-09-20|132.000000000000000006'" +
            " && document.querySelector('.managed-market-detail .managed-eod-previous') === null");
        retainComparisonFrame("rawCloseComparisonReplaced", scope);
        assertEmptyComparison(scope, "ALFA", "|2026-09-18|2026-09-19");
        assertMarketsDraftAndCounts(2, 3, 1, 1);

        selectWorkspaceView("My Watchlist");
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("company Price opens unloaded without a comparison",
            "document.querySelector('#managed-eod-heading') !== null" +
            " && document.querySelector('.managed-eod-history .managed-raw-close-comparison') === null");
        assertCompanyHistory("listing-zero", "price", false);
        assertEodDraftAndCounts(0, 0, 0);
        clickEodAction("Load one-month close history");
        assertEmptyComparison(".managed-eod-history", "ZERO", "|2026-09-18");
        chooseComparisonDate(".managed-eod-history", "2026-09-18");
        awaitPage("company Price uses the same exact comparison control",
            rawCloseComparison(".managed-eod-history", "2026-09-18", "100.25",
                "2026-09-19", "101.5", "Raw close change: +$1.25 (+1.2469%)"));
        assertEodDraftAndCounts(1, 0, 0);
        pressBack();
        awaitPage("native Back retires the company comparison and restores opener",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-raw-close-comparison') === null" +
            " && document.activeElement === document.querySelector(\"button[aria-label='EOD close history for saved ZERO']\")");
        assertEodDraftAndCounts(1, 0, 0);
        awaitPage("only explicit board and company loads affected counters",
            DIAGNOSTICS + ".marketsResolve === 2 && " + DIAGNOSTICS + ".marketsEod === 3" +
            " && " + DIAGNOSTICS + ".marketsAborted === 1 && " + DIAGNOSTICS + ".marketsLateResolved === 1");
        assertReturnedRootHistory("listing-zero", "price");
        assertEquals("Comparison preserves the mounted document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
        Log.i("ManagedComparison", "phase=response-reset-company-back-draft-retained, boardReads=3, companyReads=1; " + pageDiagnostic());
    }

    private void assertEmptyComparison(String scope, String symbol, String dates) throws Exception {
        awaitPage("comparison starts empty for " + symbol,
            "(() => { const panel = document.querySelector(" + JSONObject.quote(scope + " .managed-raw-close-comparison") + ");" +
            " const select = panel?.querySelector('.managed-raw-close-comparison-start-select');" +
            " const end = panel?.querySelector('.managed-raw-close-comparison-end-select');" +
            " return select && !select.disabled && select.value === '' && end && !end.disabled" +
            " && end.value === Array.from(end.options).at(-1)?.value && end.value !== ''" +
            " && Array.from(panel.querySelectorAll('label')).find(label => label.htmlFor === end.id)?.textContent === " + JSONObject.quote(symbol + " comparison end date") +
            " && panel.querySelector('label')?.textContent === " + JSONObject.quote(symbol + " comparison start date") +
            " && panel.querySelector('label')?.htmlFor === select.id" +
            " && Array.from(select.options).map(o => o.value).join('|') === " + JSONObject.quote(dates) +
            " && panel.querySelector('.managed-raw-close-comparison-result')?.textContent === ''; })()");
    }

    private String rawCloseComparison(String scope, String date, String start, String endDate, String end, String change) {
        return "(() => { const panel = document.querySelector(" + JSONObject.quote(scope + " .managed-raw-close-comparison") + ");" +
            " return panel?.querySelector('.managed-raw-close-comparison-start-select')?.value === " + JSONObject.quote(date) +
            " && panel.querySelector('.managed-raw-close-comparison-end-select')?.value === " + JSONObject.quote(endDate) +
            " && panel.querySelector('.managed-raw-close-comparison-start-date')?.textContent === " + JSONObject.quote(date) +
            " && panel.querySelector('.managed-raw-close-comparison-start-date')?.dateTime === " + JSONObject.quote(date) +
            " && panel.querySelector('.managed-raw-close-comparison-start-close')?.textContent === " + JSONObject.quote(start) +
            " && panel.querySelector('.managed-raw-close-comparison-end-date')?.textContent === " + JSONObject.quote(endDate) +
            " && panel.querySelector('.managed-raw-close-comparison-end-date')?.dateTime === " + JSONObject.quote(endDate) +
            " && panel.querySelector('.managed-raw-close-comparison-end-close')?.textContent === " + JSONObject.quote(end) +
            " && panel.querySelector('.managed-raw-close-comparison-change')?.textContent === " + JSONObject.quote(change) +
            " && panel.querySelector('.managed-raw-close-comparison-result')?.getAttribute('role') === 'status'" +
            " && panel.textContent.includes('Raw closes are not adjusted for splits or dividends.'); })()";
    }

    private void chooseComparisonDate(String scope, String date) throws Exception {
        chooseNativeSelectOption(scope + " .managed-raw-close-comparison-start-select", date, date);
    }

    private void chooseComparisonEndDate(String scope, String date) throws Exception {
        chooseNativeSelectOption(scope + " .managed-raw-close-comparison-end-select", date, date);
    }

    @Test
    public void companyPriceRangesRetainDatesAndFenceCancelledVisits() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareDraftAndOpenAnnual();
        click(".managed-company-sections button[aria-label='Price section for ZERO']");
        awaitPage("company Price starts with a staged month and no read",
            "document.querySelector('#managed-eod-range')?.value === '1m' && " +
            "document.querySelector('#managed-eod-range')?.disabled === false && " +
            "document.querySelector('.managed-eod-history .managed-eod-table-scroll > table > tbody') === null && " + DIAGNOSTICS + ".eod === 0" +
            " && document.querySelector('.managed-observed-close-range') === null");
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        chooseNativeSelectOption("#managed-eod-range", "1y", "One year");
        awaitPage("the labelled range picker fits the narrow viewport with a full native target",
            "(() => { const select = document.querySelector('#managed-eod-range'), v = visualViewport;" +
            " if (!select || !v) return false; const r = select.getBoundingClientRect();" +
            " return document.querySelector('label[for=managed-eod-range]')?.textContent.includes('History range')" +
            " && Array.from(select.options).map(o => o.value + '|' + o.textContent).join(';') === '1m|One month;1y|One year'" +
            " && r.height >= 44 && r.width > 0 && v.width <= 600" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
        assertEodDraftAndCounts(0, 0, 0);
        awaitPage("staging a year changes only the explicit load choice",
            "document.querySelector('.managed-eod-history .trial-actions button')?.textContent === 'Load one-year close history' && " +
            "document.querySelector('.managed-eod-history .managed-eod-table-scroll > table > tbody') === null");
        clickEodAction("Load one-year close history");
        String year =
            "document.querySelector('.managed-eod-history caption')?.textContent === 'Raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2025-09-22|80.125;2026-03-20|90.25;2026-09-19|101.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '101.5|2026-09-19|2025-09-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Loaded request range: One year.')" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('not adjusted for splits or dividends and are not live quotes')" +
            " && " + observedCloseRangeExact("One year", 3, "2025-09-22", "2026-09-19", "101.5", "2026-09-19", "80.125", "2025-09-22");
        awaitPage("one year keeps exact sparse observed dates and original request metadata", year);
        assertEodDraftAndCounts(1, 0, 0);
        click(".managed-eod-source > summary");
        retainAnnualNoteFrame("companyPriceYearSource", ".managed-eod-source > summary",
            ".managed-eod-source > summary, .managed-eod-source dd", 4);
        awaitPage("source capture preserves loaded year", year);
        chooseNativeSelectOption("#managed-eod-range", "1m", "One month");
        awaitPage("staging month does not relabel or reload the year", year + " && " + DIAGNOSTICS + ".eod === 1");
        clickEodAction("Load one-month close history");
        awaitPage("held month disables range selection and retains year metadata", year +
            " && document.querySelector('#managed-eod-range')?.value === '1m'" +
            " && document.querySelector('#managed-eod-range')?.disabled === true" +
            " && document.querySelector('.managed-eod-history')?.getAttribute('aria-busy') === 'true'");
        assertEodDraftAndCounts(2, 0, 0);
        clickEodAction("Cancel close history");
        awaitPage("Cancel enables range selection without replacing the year", year +
            " && document.querySelector('#managed-eod-range')?.disabled === false" +
            " && document.querySelector('.managed-eod-history [role=status]')?.textContent === 'Close history refresh cancelled. Try again when ready.'" +
            " && document.querySelector('.managed-eod-previous')?.textContent.includes('2026-09-20T00:00:01.000Z')");
        assertEodDraftAndCounts(2, 1, 0);
        click("#settle-cancelled-eod");
        assertEodDraftAndCounts(2, 1, 1);
        awaitPage("late cancelled month cannot replace or relabel retained year", year +
            " && !document.querySelector('.managed-eod-history').textContent.includes('999.75')");
        clickEodAction("Load one-month close history");
        String month =
            "Array.from(document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-19|102.75;2026-09-20|103.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '103.5|2026-09-20|2026-08-21 to 2026-09-21|2026-09-21T00:00:00.000Z|2026-09-21T00:00:02.000Z'" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Loaded request range: One month.')" +
            " && document.querySelector('.managed-eod-previous') === null" +
            " && " + observedCloseRangeExact("One month", 2, "2026-09-19", "2026-09-20", "103.5", "2026-09-20", "102.75", "2026-09-19");
        awaitPage("explicit month recovery replaces the data and its own original dates together", month);
        assertEodDraftAndCounts(3, 1, 1);
        awaitPage("range operations preserve every draft field",
            "JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        chooseNativeSelectOption("#managed-eod-range", "1y", "One year");
        awaitPage("year staging keeps recovered month", month + " && " + DIAGNOSTICS + ".eod === 3");
        clickEodAction("Load one-year close history");
        awaitPage("year refresh is held with the range disabled",
            DIAGNOSTICS + ".eod === 4 && document.querySelector('#managed-eod-range')?.disabled === true");
        pressBack();
        awaitPage("native Back closes the pending visit and preserves the exact draft",
            "document.querySelector('.managed-eod-history') === null && " +
            "JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft) +
            " && document.querySelector('.managed-observed-close-range') === null");
        assertEodDraftAndCounts(4, 2, 1);
        click("#settle-cancelled-eod");
        assertEodDraftAndCounts(4, 2, 2);
        awaitPage("late year completion cannot reopen the company",
            "document.querySelector('.managed-eod-history') === null && document.querySelector('#managed-company-heading') === null" +
            " && document.querySelector('.managed-observed-close-range') === null");
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("new company visit resets staging and carries no disposed packet",
            "document.querySelector('#managed-eod-range')?.value === '1m' && " +
            "document.querySelector('.managed-eod-history .managed-eod-table-scroll > table > tbody') === null && " + DIAGNOSTICS + ".eod === 4" +
            " && document.querySelector('.managed-observed-close-range') === null");
        clickEodAction("Load one-month close history");
        awaitPage("last month read is held before explicit session expiry",
            DIAGNOSTICS + ".eod === 5 && document.querySelector('#managed-eod-range')?.disabled === true");
        click(CATALOG_REFRESH);
        awaitPage("catalog 401 retires the pending range and clears its draft",
            DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " +
            "document.querySelector('.managed-eod-history') === null && " +
            DIAGNOSTICS + ".status === 2 && " + DIAGNOSTICS + ".eodAborted === 3");
        click("#settle-cancelled-eod");
        awaitPage("late retired month cannot restore history, data or draft",
            DIAGNOSTICS + ".eodLateResolved === 3 && " + DIAGNOSTICS + ".eod === 5 && " +
            DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " +
            "document.querySelector('.managed-eod-history') === null && " +
            "document.querySelector('.managed-observed-close-range') === null && " +
            "document.querySelector('#managed-company-heading') === null && " +
            "document.querySelector('#managed-research-note') === null && " +
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".search === 1 && " +
            DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0 && " +
            DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0");
        assertFixtureBoundary();
        assertEquals("Range journey preserves the original document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        Log.i("ManagedPriceRanges", "phase=retired-after-cancel-back-and-late-completions; " + pageDiagnostic());
    }

    private String observedCloseRangeExact(String range, int count, String firstDate, String lastDate,
            String highest, String highestDate, String lowest, String lowestDate) {
        return observedCloseRangeAt(".managed-eod-history .managed-observed-close-range", range, count, firstDate, lastDate,
            highest, highestDate, lowest, lowestDate);
    }

    private String observedCloseRangeAt(String selector, String range, int count, String firstDate, String lastDate,
            String highest, String highestDate, String lowest, String lowestDate) {
        return "(() => { const roots = document.querySelectorAll(" + JSONObject.quote(selector) + ");" +
            " const root = roots[0], groups = root ? [...root.querySelectorAll('dl > div')] : [];" +
            " const expected = [['Highest reported close · USD', " + JSONObject.quote(highest) + ", " + JSONObject.quote(highestDate) + "]," +
            " ['Lowest reported close · USD', " + JSONObject.quote(lowest) + ", " + JSONObject.quote(lowestDate) + "]];" +
            " return roots.length === 1 && root.getAttribute('role') === 'group' && root.getAttribute('aria-label') === 'Observed raw-close range'" +
            " && groups.length === 2 && groups.every((group,i) => group.querySelector('dt')?.textContent === expected[i][0]" +
            " && group.querySelector('dd > span')?.textContent === expected[i][1] && group.querySelector('time')?.dateTime === expected[i][2]" +
            " && group.querySelector('time')?.textContent === expected[i][2])" +
            " && root.textContent.includes(" + JSONObject.quote("Loaded request range: " + range + ".") + ")" +
            " && root.textContent.includes(" + JSONObject.quote("Among " + count + " reported closes from " + firstDate + " to " + lastDate + ".") + ")" +
            " && !root.textContent.includes('First of ')" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
    }

    private void chooseNativeSelectOption(String selector, String optionValue, String label) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> id = new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            assertTrue("Select WebView must accept focus", webView.requestFocus());
            webView.evaluateJavascript(
                "(() => { const select = document.querySelector(" + JSONObject.quote(selector) + ");" +
                " if (!(select instanceof HTMLSelectElement) || select.disabled || !select.id) return null;" +
                " select.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});" +
                " select.focus({preventScroll:true}); return select.id; })()",
                value -> { id.set(value); returned.countDown(); });
        });
        assertTrue("Native select id was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        assertNotNull(id.get());
        String actualId = new org.json.JSONArray("[" + id.get() + "]").getString(0);
        assertFalse("Native select must have its real labelled id", actualId.isEmpty());
        awaitPage("exact enabled native select has DOM focus",
            "(() => { const select = document.getElementById(" + JSONObject.quote(actualId) + ");" +
            " return select instanceof HTMLSelectElement && !select.disabled && document.activeElement === select" +
            " && select === document.querySelector(" + JSONObject.quote(selector) + ")" +
            " && [...select.options].some(option => option.value === " + JSONObject.quote(optionValue) + " && !option.disabled); })()");
        // Native Space opens the picker without a tap becoming a long press under load.
        onView(isAssignableFrom(WebView.class)).check((view, noViewFoundException) -> {
            if (noViewFoundException != null) throw noViewFoundException;
            assertTrue("Select WebView must have focus", view.hasFocus());
            assertTrue("Select window must have focus", view.hasWindowFocus());
        }).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        // Wait for WebView's native dialog instead of searching the Activity root.
        AtomicReference<View> dialogDecor = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label))
            .inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view, noViewFoundException) -> {
                if (noViewFoundException != null) throw noViewFoundException;
                dialogDecor.set(view.getRootView());
            })
            .perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull("The selected native dialog decor must be observed", dialogDecor.get());
        awaitPage("native option selected and exact dialog dismissed",
            "document.getElementById(" + JSONObject.quote(actualId) + ")?.value === " + JSONObject.quote(optionValue),
            true, dialogDecor.get());
    }

    private void retainComparisonFrame(String name, String scope) throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector(" + JSONObject.quote(scope + " .managed-raw-close-comparison") + ").scrollIntoView({block:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Comparison frame did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const panel = document.querySelector(" + JSONObject.quote(scope + " .managed-raw-close-comparison") + ");" +
            " const v = visualViewport; if (!panel || !v || v.width > 600) return false;" +
            " const targets = [panel, ...panel.querySelectorAll('label,select,p,dt,dd,strong')];" +
            " return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("comparison values fit the narrow native frame", visible);
        retainScreenshot(name);
        awaitPage("comparison values remain inside the captured native frame", visible);
    }

    @Test
    public void companyNoteDraftReviewSaveAndReloadPreservesIdentity() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        awaitPage("invented Markets identities ready without price reads",
            DIAGNOSTICS + ".marketsResolve === 1 && document.querySelectorAll('.managed-market-row').length === 3");
        click("button[aria-label='Select ALFA on company board']");
        String priceOpener = "button[aria-label='Board price history for ALFA']";
        click(priceOpener);
        awaitPage("unsaved ALFA opens with explicit draft action and no automatic research",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ALFA'" +
            " && document.querySelector('.managed-company-identity strong')?.textContent === 'Alfa Company'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Alfa Common Stock · Common Stock · XNAS'" +
            " && document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('#managed-research-note') === null" +
            " && document.querySelector('[aria-labelledby=managed-research-note-heading] button:first-child')?.textContent === 'Add to watchlist draft'" +
            " && document.querySelector('[aria-labelledby=managed-research-note-heading] button:first-child')?.disabled === false");
        assertCompanyNoteCounts(0, 1);
        click("[aria-labelledby=managed-research-note-heading] button:first-child");
        awaitPage("adding appends a blank draft membership without saving",
            "document.querySelector('#managed-research-note')?.value === ''" +
            " && " + DRAFT + ".memberships?.[2]?.note === ''" +
            " && document.querySelector('[aria-labelledby=managed-research-note-heading] button:first-child')?.textContent === 'In watchlist draft'" +
            " && document.querySelector('[aria-labelledby=managed-research-note-heading] button:first-child')?.disabled === true" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE,ALFA'");
        assertCompanyNoteCounts(0, 1);
        typeIntoInput("managed-research-note", COMPANY_NOTE);
        assertCompanyNoteDraft(1, true);
        click(".managed-company-sections button[aria-label='Annual section for ALFA']");
        awaitPage("Annual switch retains the shared note and stays unloaded",
            "document.activeElement?.id === 'managed-annual-heading'" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(COMPANY_NOTE));
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        click(".managed-company-sections button[aria-label='Price section for ALFA']");
        awaitPage("Price switch retains the note without loading history",
            "document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('.managed-eod-history .managed-metadata') === null" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(COMPANY_NOTE));
        String companyChoice = "#managed-research-company-select";
        String openCompany = ".managed-research-company-controls button";
        awaitPage("company choices include the unsaved addition in full draft order",
            "document.querySelector('label[for=managed-research-company-select]')?.textContent === 'Company in My Watchlist'" +
            " && document.querySelector(" + JSONObject.quote(companyChoice) + ")?.value === ''" +
            " && [...document.querySelector(" + JSONObject.quote(companyChoice) + ").options].map(o => o.value).join(',') === ',listing-zero,listing-one,listing-alfa'" +
            " && document.querySelector(" + JSONObject.quote(openCompany) + ")?.getAttribute('aria-disabled') === 'true'" +
            " && [document.querySelector(" + JSONObject.quote(companyChoice) + "), document.querySelector(" + JSONObject.quote(openCompany) + ")].every(e => e.getBoundingClientRect().height >= 44)");
        chooseNativeSelectOption(companyChoice, "listing-alfa", "ALFA · Alfa Company · Common Stock · XNAS");
        awaitPage("choosing the current company keeps Open unavailable",
            "document.querySelector(" + JSONObject.quote(openCompany) + ")?.getAttribute('aria-disabled') === 'true'");
        click(openCompany);
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        chooseNativeSelectOption(companyChoice, "listing-one", "ONE · One Company · Class A · XNAS");
        awaitPage("choosing another company leaves the current company and note intact",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ALFA'" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(COMPANY_NOTE));
        assertCompanyNoteCounts(0, 1);
        click(openCompany);
        awaitPage("explicit Open shows the other exact note in the same unloaded Price section",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ONE'" +
            " && document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('#managed-research-note')?.value === 'Invented second note'" +
            " && document.querySelector('.managed-eod-history .managed-metadata') === null");
        assertCompanyNoteCounts(0, 1);
        chooseNativeSelectOption(companyChoice, "listing-alfa", "ALFA · Alfa Company · Common Stock · XNAS");
        click(openCompany);
        awaitPage("returning to the unsaved company restores its complete draft without a read",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ALFA'" +
            " && document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(COMPANY_NOTE));
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        retainCompanyNoteScreenshot();
        assertFixtureBoundary();
        pressBack();
        awaitPage("native Back restores the original board opener",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(priceOpener) + ")");
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        click("button[aria-label='Board Annual report for ALFA']");
        awaitPage("a new visit reads the shared draft without an Annual call",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(COMPANY_NOTE) +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null" +
            " && document.activeElement?.id === 'managed-annual-heading'");
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", COMPANY_NOTE, INVALID_COMPANY_NOTE);
        assertInvalidCompanyNote("managed-research-note", "managed-research-note-help");
        retainAnnualNoteFrame("companyNoteInvalidResearch", "label[for=managed-research-note]",
            "label[for=managed-research-note], #managed-research-note, #managed-research-note-error", 3);
        assertInvalidCompanyNote("managed-research-note", "managed-research-note-help");
        assertFixtureBoundary();
        awaitPage("company Review targets ALFA while the watchlist still holds another selected note",
            "document.querySelector('#managed-note-0')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.querySelector('#managed-note-2') === null");
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("review closes research and focuses the exact full invalid company-note reader",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-2')?.dataset.managedNoteListingId === 'listing-alfa'" +
            " && document.activeElement === document.querySelector('#managed-note-2-reading-toggle')" +
            " && document.querySelector('#managed-watchlist-heading')?.closest('section')?.hidden === false");
        assertFullNoteReading("managed-note-2", INVALID_COMPANY_NOTE, true);
        assertInvalidCompanyNote("managed-note-2", "managed-watchlist-note-help");
        retainAnnualNoteFrame("companyNoteInvalidWatchlist", "label[for=managed-note-2]",
            "label[for=managed-note-2], #managed-note-2, #managed-note-2-error", 3);
        assertInvalidCompanyNote("managed-note-2", "managed-watchlist-note-help");
        Log.i("ManagedCompanyNote", "phase=invalid-retained, save=0; " + pageDiagnostic());
        // Touch the recovery action, then verify its focus without tapping the textarea.
        selectWatchlistNote(0);
        typeIntoInput("managed-watchlist-search", "zero");
        awaitPage("local search hides the invalid choice without changing the complete draft",
            "document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 3 listings'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO'" +
            " && document.querySelector('#managed-note-0')?.value === ''" +
            " && document.querySelector('#managed-note-2') === null" +
            " && document.querySelector('button[aria-label=\"Move ZERO up\"]')?.disabled === true" +
            " && document.querySelector('button[aria-label=\"Move ZERO down\"]')?.disabled === true" +
            " && document.querySelector('#managed-watchlist-order-help')?.textContent === 'Clear search to change the full watchlist order.'" +
            " && document.querySelector('#managed-watchlist-note-help + .trial-actions > button:first-child')?.disabled === true" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ZERO,ONE,ALFA'" +
            " && " + DRAFT + ".memberships?.[0]?.note === ''" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(INVALID_COMPANY_NOTE) +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
        assertCompanyNoteCounts(0, 1);
        click("#managed-unsaved-review-summary");
        awaitPage("unsaved review includes the complete invalid note outside search results",
            "(() => { const review = document.querySelector('#managed-unsaved-review');" +
            " const entry = review?.querySelector('[data-managed-review-listing-id=listing-alfa]');" +
            " const sides = entry?.querySelectorAll('.managed-version-side');" +
            " return review?.open === true && sides?.length === 2" +
            " && sides[0].querySelector('h5')?.textContent === 'Last confirmed saved version 1'" +
            " && sides[0].textContent.includes('Not in this version')" +
            " && sides[1].querySelector('h5')?.textContent === 'Current draft'" +
            " && sides[1].querySelector('.trial-saved-note')?.textContent === " + JSONObject.quote(INVALID_COMPANY_NOTE) +
            " && document.querySelector('#managed-watchlist-search')?.value === 'zero'; })()");
        assertCompanyNoteCounts(0, 1);
        touchInput("managed-note-validation-focus");
        awaitPage("recovery action focuses the exact invalid listing",
            "document.activeElement === document.querySelector('#managed-note-2')" +
            " && document.activeElement?.getAttribute('data-managed-note-listing-id') === 'listing-alfa'" +
            " && document.querySelector('#managed-watchlist-search')?.value === ''" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '3 of 3 listings'");
        replaceFocusedInput("managed-note-2", INVALID_COMPANY_NOTE, COMPANY_NOTE);
        assertCorrectedCompanyNote();
        awaitPage("open unsaved review follows the corrected full draft without saving",
            "document.querySelector('#managed-unsaved-review')?.open === true" +
            " && document.querySelector('#managed-unsaved-review [data-managed-review-listing-id=listing-alfa] .trial-saved-note')?.textContent === " + JSONObject.quote(COMPANY_NOTE));
        // This frame covers the guidance and enabled Save; exact note bytes are asserted separately.
        retainAnnualNoteFrame("companyNoteCorrectedSave", "#managed-watchlist-note-help",
            "#managed-watchlist-note-help, #managed-watchlist-note-help + .trial-actions > button:first-child", 2);
        assertCorrectedCompanyNote();
        Log.i("ManagedCompanyNote", "phase=corrected-unsaved, save=0; " + pageDiagnostic());
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        awaitPage("watchlist search has one labelled native scope selector",
            "(() => { const scope = document.querySelector('#managed-watchlist-search-scope');" +
            " return scope instanceof HTMLSelectElement && scope.value === 'identity' && !scope.disabled" +
            " && scope.getBoundingClientRect().height >= 44" +
            " && document.querySelector('label[for=managed-watchlist-search-scope]')?.textContent === 'Search in'" +
            " && [...scope.options].map(option => option.value + '|' + option.textContent).join(';') === 'identity|Listing identity;notes|Research notes'; })()");
        typeIntoInput("managed-watchlist-search", "Captured in research");
        awaitPage("identity search does not silently search note text",
            "document.querySelector('#managed-watchlist-search-count')?.textContent === '0 of 3 listings'" +
            " && document.querySelectorAll('.managed-watchlist-choices li > button').length === 0" +
            " && document.querySelector('#managed-note-2')?.value === " + JSONObject.quote(COMPANY_NOTE));
        chooseNativeSelectOption("#managed-watchlist-search-scope", "notes", "Research notes");
        awaitPage("research-note scope finds the existing unsaved phrase without retargeting the editor",
            "document.querySelector('#managed-watchlist-search')?.value === 'Captured in research'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 3 listings'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ALFA'" +
            " && document.querySelector('#managed-note-2')?.getAttribute('data-managed-note-listing-id') === 'listing-alfa'" +
            " && document.querySelector('#managed-note-2')?.value === " + JSONObject.quote(COMPANY_NOTE) +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ZERO,ONE,ALFA'" +
            " && " + DRAFT + ".memberships?.[0]?.note === ''" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(COMPANY_NOTE));
        String noteContext = "[data-watchlist-note-context='listing-alfa']";
        awaitPage("the result explains its match with the exact original note and accessible description",
            "(() => { const preview = document.querySelector(" + JSONObject.quote(noteContext) + ");" +
            " const choice = document.querySelector(\"[data-watchlist-selection='listing-alfa']\");" +
            " return preview?.textContent === " + JSONObject.quote("Note: " + COMPANY_NOTE) +
            " && choice?.getAttribute('aria-describedby')?.split(/\\s+/).includes(preview.id)" +
            " && choice?.getAttribute('aria-label') === 'Edit research note for ALFA, Common Stock, XNAS'; })()");
        assertCompanyNoteCounts(0, 1);
        touchInput("managed-note-2");
        replaceFocusedInput("managed-note-2", COMPANY_NOTE, NOTE);
        awaitPage("editing out of note results retains the exact visible focused selected editor",
            "(() => { const input = document.querySelector('#managed-note-2');" +
            " return input instanceof HTMLTextAreaElement && document.activeElement === input" +
            " && input.getClientRects().length > 0 && !input.disabled" +
            " && input.getAttribute('data-managed-note-listing-id') === 'listing-alfa'" +
            " && input.value === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-watchlist-search-scope')?.value === 'notes'" +
            " && document.querySelector('#managed-watchlist-search')?.value === 'Captured in research'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '0 of 3 listings'" +
            " && document.querySelectorAll('.managed-watchlist-choices li > button').length === 0; })()");
        awaitPage("editing out of the results removes the stale note context",
            "document.querySelectorAll('[data-watchlist-note-context]').length === 0");
        assertCompanyNoteCounts(0, 1);
        replaceFocusedInput("managed-note-2", NOTE, COMPANY_NOTE);
        awaitPage("restoring the original note restores its match without moving focus",
            "document.activeElement === document.querySelector('#managed-note-2')" +
            " && document.querySelector('#managed-note-2')?.value === " + JSONObject.quote(COMPANY_NOTE) +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 3 listings'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ALFA'");
        awaitPage("restored result shows the exact note context again",
            "document.querySelector(" + JSONObject.quote(noteContext) + ")?.textContent === " + JSONObject.quote("Note: " + COMPANY_NOTE));
        awaitPage("filtered note search preserves the complete draft and unrelated notes",
            DRAFT + ".memberships.map(member => member.listingId + ':' + member.symbol).join('|') === 'listing-zero:ZERO|listing-one:ONE|listing-alfa:ALFA'" +
            " && " + DRAFT + ".memberships[0].note === ''" +
            " && " + DRAFT + ".memberships[1].note === 'Invented second note'" +
            " && " + DRAFT + ".memberships[2].note === " + JSONObject.quote(COMPANY_NOTE) +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
        assertCompanyNoteCounts(0, 1);
        click("button[aria-label='Clear watchlist search']");
        awaitPage("Clear preserves Research notes and the selected draft while restoring all choices",
            "document.querySelector('#managed-watchlist-search')?.value === ''" +
            " && document.querySelector('#managed-watchlist-search-scope')?.value === 'notes'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '3 of 3 listings'" +
            " && document.activeElement === document.querySelector('#managed-watchlist-search')" +
            " && document.querySelector('#managed-note-2')?.value === " + JSONObject.quote(COMPANY_NOTE));
        awaitPage("clearing the phrase removes all search-only note excerpts",
            "document.querySelectorAll('[data-watchlist-note-context]').length === 0");
        closeSoftKeyboard();
        chooseNativeSelectOption("#managed-watchlist-search-scope", "identity", "Listing identity");
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        typeIntoInput("managed-watchlist-search", "alfa");
        awaitPage("filtered Save retains the exact selected note at its full-draft index",
            "document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 3 listings'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ALFA'" +
            " && document.querySelector('#managed-note-2')?.getAttribute('data-managed-note-listing-id') === 'listing-alfa'" +
            " && document.querySelector('#managed-note-2')?.value === " + JSONObject.quote(COMPANY_NOTE) +
            " && document.querySelector('#managed-watchlist-note-help + .trial-actions > button:first-child')?.disabled === false");
        assertCompanyNoteCounts(0, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("existing full-list Save completes the one invented versioned write",
            DIAGNOSTICS + ".save === 1 && document.body.textContent.includes('Version 2 · Saved')");
        awaitPage("saving filtered listings preserves search and all three saved draft memberships",
            "document.querySelector('#managed-watchlist-search')?.value === 'alfa'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 3 listings'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ZERO,ONE,ALFA'" +
            " && " + DRAFT + ".memberships?.[0]?.note === ''" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(COMPANY_NOTE));
        awaitPage("confirmed Save clears differences while retaining the open review",
            "document.querySelector('#managed-unsaved-review')?.open === true" +
            " && document.querySelector('#managed-unsaved-review')?.textContent.includes('No differences from last confirmed saved version 2.')" +
            " && document.querySelectorAll('#managed-unsaved-review [data-managed-review-listing-id]').length === 0");
        assertCompanyNoteCounts(1, 1);
        click("button[aria-label='Clear watchlist search']");
        awaitPage("clearing local search restores choices and focuses its persistent input",
            "document.querySelector('#managed-watchlist-search')?.value === ''" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '3 of 3 listings'" +
            " && document.activeElement === document.querySelector('#managed-watchlist-search')");
        assertCompanyNoteDraft(2, false);
        assertCompanyNoteCounts(1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("explicit saved reload completes", DIAGNOSTICS + ".load === 2" +
            " && document.querySelector('#managed-note-2')?.disabled === false");
        assertCompanyNoteDraft(2, false);
        assertCompanyNoteCounts(1, 2);
        scenario.onActivity(activity -> {
            assertNotNull("Original note Activity was collected", originalActivity.get().get());
            assertNotNull("Original note WebView was collected", originalWebView.get().get());
            assertSame("Draft review and save preserve Activity", originalActivity.get().get(), activity);
            assertSame("Draft review and save preserve WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("Draft review and save preserve document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        // Explicit watchlist review replaces the company entry instead of restoring Markets.
        assertExactHistory(1, "https://localhost/", "https://localhost/");
        Log.i("ManagedCompanyNote", "phase=saved-reloaded, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
        assertCompleteSoftwareLicenses();
        assertCompanyNoteDraft(2, false);
        assertCompanyNoteCounts(1, 2);
        assertFixtureBoundary(0, 1);
    }

    private void assertCompleteSoftwareLicenses() throws Exception {
        awaitPage("software licenses start closed without text",
            "document.querySelector('.trial-notices > button')?.textContent === 'Software licenses'" +
            " && document.querySelector('#trial-license-text')?.hidden === true" +
            " && document.querySelector('#trial-license-text pre') === null");
        click(".trial-notices > button");
        awaitPage("complete local software licenses are visible",
            "document.querySelector('.trial-notices > button')?.textContent === 'Hide software licenses'" +
            " && document.querySelector('#trial-license-text')?.hidden === false" +
            " && document.querySelector('#trial-license-text pre')?.textContent.length > 0" +
            " && document.querySelector('#trial-license-text [role=status]') === null");
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const region = document.querySelector('#trial-license-text');" +
            " const bytes = new TextEncoder().encode(region.querySelector('pre').textContent);" +
            " region.dataset.testLicenseBytes = String(bytes.byteLength);" +
            " crypto.subtle.digest('SHA-256', bytes).then(hash => {" +
            " region.dataset.testLicenseHash = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');" +
            " }).catch(() => { region.dataset.testLicenseHash = 'failed'; }); })()", null));
        awaitPage("every canonical notice, icon and font license byte is retained",
            "document.querySelector('#trial-license-text')?.dataset.testLicenseBytes === '2388267'" +
            " && document.querySelector('#trial-license-text')?.dataset.testLicenseHash === '395a57fe9bcebb08fd09e8bfb75224ba550bf2c5773431c9fdec1bff88e9a04a'");
        click(".trial-notices > button");
        awaitPage("Hide software licenses closes the complete local text",
            "document.querySelector('.trial-notices > button')?.getAttribute('aria-expanded') === 'false'" +
            " && document.querySelector('#trial-license-text')?.hidden === true");
    }

    @Test
    public void priceComparisonNoteDraftReviewSaveAndReloadPreservesSource() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        awaitPage("invented board admission completed without source reads", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Price research draft");
        click("button[aria-label='EOD close history for saved ZERO']");
        String scope = ".managed-eod-history";
        String comparison = scope + " .managed-raw-close-comparison";
        String add = scope + " .managed-price-note-action button";
        awaitPage("saved ZERO Price opens unloaded with the existing note and no append action",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Zero Class A · Class A · XNAS'" +
            " && document.querySelector('#managed-research-note')?.value === 'Price research draft'" +
            " && document.querySelector(" + JSONObject.quote(comparison) + ") === null" +
            " && document.querySelector(" + JSONObject.quote(add) + ") === null");
        assertPriceNoteCounts(0, 0, 1);
        clickEodAction("Load one-month close history");
        assertEmptyComparison(scope, "ZERO", "|2026-09-17|2026-09-18");
        awaitPage("no append before choosing an observed date", "document.querySelector(" + JSONObject.quote(add) + ") === null");
        assertPriceNoteCounts(1, 0, 1);
        chooseComparisonDate(scope, "2026-09-17");
        chooseComparisonEndDate(scope, "2026-09-18");
        String exactComparison = rawCloseComparison(scope, "2026-09-17", "100.000000000000000001",
            "2026-09-18", "107.500000000000000002", "Raw close change: +$7.500000000000000001 (+7.5000%)");
        awaitPage("selected earlier date exposes the explicit draft action",
            exactComparison + " && document.querySelector(" + JSONObject.quote(add) + ")?.disabled === false" +
            " && Array.from(document.querySelectorAll('.managed-eod-quote dd')).map(item => item.textContent).join('|') === '110.000000000000000003|2026-09-19'" +
            " && document.querySelector(" + JSONObject.quote(add) + ")?.textContent === 'Add comparison to note draft'");
        retainAnnualNoteFrame("priceComparisonNoteSource", comparison,
            comparison + " label, " + comparison + " select, " + comparison + " > p, " +
            comparison + " > .managed-raw-close-comparison-result, " + add, 7);
        awaitPage("comparison remains exact through source capture", exactComparison);
        assertPriceNoteCounts(1, 0, 1);
        Log.i("ManagedPriceNote", "phase=selected-exact-comparison, eod=1, save=0; " + pageDiagnostic());
        click(add);
        awaitPage("one explicit append preserves prose and full original price provenance",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(PRICE_NOTE) +
            " && document.querySelector('.managed-price-note-action [role=status]')?.textContent === " +
            JSONObject.quote("Price comparison added to the note draft. Review and save all changes in My Watchlist."));
        assertPriceNoteDraft(1, true);
        assertPriceNoteCounts(1, 0, 1);
        // Full textarea bytes are asserted; this frame claims only the visible note controls.
        retainAnnualNoteFrame("priceComparisonNoteDraft", "#managed-research-note-heading",
            "#managed-research-note-heading, [aria-labelledby=managed-research-note-heading] > .trial-actions > button, " +
            "label[for=managed-research-note], #managed-research-note, #managed-research-note-help", 6);
        assertPriceNoteDraft(1, true);
        assertPriceNoteCounts(1, 0, 1);
        assertFixtureBoundary();
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("Review opens the exact price-note reader without another read or save",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-0')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.activeElement === document.querySelector('#managed-note-0-reading-toggle')" +
            " && document.querySelector('#managed-watchlist-heading')?.closest('section')?.hidden === false");
        assertFullNoteReading("managed-note-0", PRICE_NOTE, true);
        assertPriceNoteDraft(1, true);
        assertPriceNoteCounts(1, 0, 1);
        Log.i("ManagedPriceNote", "phase=appended-reviewed-unsaved, eod=1, save=0; " + pageDiagnostic());
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("one explicit whole-list save acknowledges version two", DIAGNOSTICS + ".save === 1 && document.body.textContent.includes('Version 2 · Saved')");
        assertPriceNoteDraft(2, false);
        assertPriceNoteCounts(1, 1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("reload returns the exact saved price paragraph", DIAGNOSTICS + ".load === 2 && document.querySelector('#managed-note-0')?.disabled === false");
        assertPriceNoteDraft(2, false);
        assertPriceNoteCounts(1, 1, 2);
        assertEquals("Price note review, save and reload preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertExactHistory(1, "https://localhost/", "https://localhost/");
        Log.i("ManagedPriceNote", "phase=saved-reloaded, exactNoteLength=" + PRICE_NOTE.length() + "; " + pageDiagnostic());
    }

    @Test
    public void financialScreenExplicitRunInspectionAndResearchBackPreserveDraft() throws Exception {
        double origin = readDocumentTimeOrigin();
        String screen = ".managed-financial-screen";
        String row = screen + " .managed-screen-table tbody > tr";
        String evidence = row + " .managed-screen-evidence";
        String cashSource = evidence + " > details:nth-last-of-type(5)";
        awaitPage("screening starts without a source request", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Screening research draft");
        selectWatchlistNote(1);
        touchInput("managed-note-1");
        replaceFocusedInput("managed-note-1", "Invented second note", "Unrelated screen draft");
        selectWorkspaceView("Discover");
        awaitPage("Discover keeps the explicit screen and has not resolved or read its cohort",
            "document.querySelector(" + JSONObject.quote(screen + " > h3") + ")?.textContent === 'Annual financial screen'" +
            " && document.querySelectorAll(" + JSONObject.quote(row) + ").length === 0");
        assertFinancialScreenCounts(0, 0);
        clickFinancialScreenAction("Load screening cohort");
        awaitPage("explicit cohort resolution admits the sole invented exact listing without an Annual read",
            "document.querySelectorAll('.managed-screen-cohort input[type=checkbox]').length === 1" +
            " && document.querySelector('.managed-screen-cohort input')?.checked === true" +
            " && document.querySelector('.managed-screen-cohort label')?.textContent === 'ZERO · XNASZero Company'");
        assertFinancialScreenCounts(1, 0);
        clickFinancialScreenAction("Add criterion");
        awaitPage("the explicitly added cash-flow criterion requires Apply before Run",
            "document.querySelector('.managed-screen-clause select:first-of-type')?.value === 'operatingCashFlow'" +
            " && document.querySelector('.managed-screen-clause input')?.value === '0'" +
            " && [...document.querySelectorAll('.managed-financial-screen button')].find(b => b.textContent === 'Run screen (1 companies)')?.disabled === true");
        clickFinancialScreenAction("Apply criteria");
        awaitPage("valid applied criteria enable the one-company explicit Run",
            "[...document.querySelectorAll('.managed-financial-screen button')].find(b => b.textContent === 'Run screen (1 companies)')?.disabled === false");
        assertFinancialScreenCounts(1, 0);
        clickFinancialScreenAction("Run screen (1 companies)");
        String exact = financialScreenExact();
        awaitPage("screened exact values and independent missing operating income share one original Annual packet", exact);
        assertFinancialScreenCounts(1, 1);
        retainAnnualNoteFrame("financialScreenCashFlow", row + " > td:nth-of-type(3) > span",
            row + " > td:nth-of-type(3) > span", 1);
        awaitPage("exact screen values survive horizontal source-table inspection", exact);
        click(evidence + " > summary");
        awaitPage("cash-flow inspection opens the named original source rather than an inferred metric",
            "document.querySelector(" + JSONObject.quote(evidence) + ")?.open === true" +
            " && document.querySelector(" + JSONObject.quote(cashSource + " > summary") + ")?.textContent === 'Reported operating cash flow source'");
        click(cashSource + " > summary");
        String originalCash = "(() => { const source = document.querySelector(" + JSONObject.quote(cashSource) + ");" +
            " const groups = [...(source?.querySelectorAll('.managed-annual-statement-observation dl > div') ?? [])];" +
            " const values = groups.map(group => group.querySelector('dd')?.textContent);" +
            " const meta = JSON.parse(document.querySelector('#fixture-financial-screen').textContent), g = meta.generation;" +
            " return source?.open === true && groups.length === 10 && /^sec-fact:[a-f0-9]{64}$/.test(values[0])" +
            " && values[1] === 'USD 120.125' && values[2] === '2025-01-01 through 2025-12-31'" +
            " && values[4] === '/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0'" +
            " && values[5] === '10-K · 0000999999-26-000001 · filed 2026-02-01' && values[6] === 'matched'" +
            " && values[7] === 'Form 10-K; report date 2025-12-31; filed 2026-02-01; accepted 2026-02-01T00:00:00.000Z'" +
            " && values[8] === 'https://www.sec.gov/Archives/edgar/data/1/0000999999-26-000001-index.htm'" +
            " && g.cutoffAt === '2026-09-20T00:00:00.000Z' && g.completedAt === '2026-09-20T00:00:03.000Z'" +
            " && g.sources.companyFacts.fetchedAt === '2026-09-20T00:00:02.000Z' && g.sources.submissions.fetchedAt === '2026-09-20T00:00:01.000Z'" +
            " && document.querySelector(" + JSONObject.quote(evidence + " > p") + ")?.textContent === 'CIK 0000000001. Original load cutoff '+g.cutoffAt+'; completed '+g.completedAt+'. Generation '+g.sha256+'.'; })()";
        awaitPage("source inspection preserves exact amount, joined filing, pointer, complete reference and original clocks", originalCash);
        retainAnnualNoteFrame("financialScreenOriginalAmount", cashSource + " .managed-annual-statement-observation dl > div:nth-child(2)",
            cashSource + " .managed-annual-statement-observation dl > div:nth-child(2)", 1);
        awaitPage("the inspected original source stays exact after its visible frame", originalCash);
        click(row + " > th > label input[type=checkbox]");
        awaitPage("shortlist is explicit and does not save the watchlist", "document.querySelector(" + JSONObject.quote(row + " > th > label input") + ")?.checked === true");
        assertFinancialScreenCounts(1, 1);
        click(row + " > th > button");
        awaitPage("Research admits the exact screening Annual seed without another source read",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-annual-origin')?.textContent === 'Showing the report loaded for financial screening. Original source and observation times are unchanged.'" +
            " && document.querySelector('#managed-research-note')?.value === 'Screening research draft'" +
            " && document.querySelector('.managed-annual-statements')?.textContent.includes('2026-09-20T00:00:03.000Z')");
        assertFinancialScreenCounts(1, 1);
        pressBack();
        awaitPage("native Back restores the exact captured screen, shortlist, applied criterion and opener",
            exact + " && document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'Discover'" +
            " && document.querySelector('.managed-screen-clause select:first-of-type')?.value === 'operatingCashFlow'" +
            " && document.querySelector('.managed-screen-clause input')?.value === '0'" +
            " && document.querySelector(" + JSONObject.quote(row + " > th > label input") + ")?.checked === true" +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(row + " > th > button") + ")");
        retainAnnualNoteFrame("financialScreenReturnedCriteria", screen + " .managed-screen-clause", screen + " .managed-screen-clause", 1);
        assertFinancialScreenCounts(1, 1);
        awaitPage("screening preserves both authored note drafts, identities, order and unsaved state",
            DRAFT + ".memberships?.map(m => m.symbol).join('|') === 'ZERO|ONE'" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Screening research draft'" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Unrelated screen draft'" +
            " && " + DRAFT + ".baseVersion === 1 && " + DRAFT + ".dirty === true");
        assertEquals("The screening journey retains one document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(1, 0);
    }

    @Test
    public void screenComparisonKeepsIndependentStatementsSourcesAndResearchBack() throws Exception {
        double origin = readDocumentTimeOrigin();
        String pair = ".managed-screen-comparison";
        String left = pair + " .managed-screen-comparison-company:first-child";
        String right = pair + " .managed-screen-comparison-company:last-child";
        String selector = pair + " .managed-annual-statement-selector select";
        awaitPage("comparison startup has no financial reads", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Comparison left draft");
        selectWatchlistNote(1);
        touchInput("managed-note-1");
        replaceFocusedInput("managed-note-1", "Invented second note", "Comparison right draft");
        selectWorkspaceView("Discover");
        assertFinancialScreenCounts(0, 0);
        clickFinancialScreenAction("Load screening cohort");
        awaitPage("two exact companies are selected without source reads",
            "[...document.querySelectorAll('.managed-screen-cohort label')].map(e=>e.textContent).join('|') === 'ZERO · XNASZero Company|ONE · XNASOne Company'" +
            " && [...document.querySelectorAll('.managed-screen-cohort input')].every(e=>e.checked)");
        clickFinancialScreenAction("Add criterion");
        clickFinancialScreenAction("Apply criteria");
        clickFinancialScreenAction("Run screen (2 companies)");
        awaitPage("first explicit read leaves comparison actions disabled while the paced run waits",
            DIAGNOSTICS + ".annual === 1 && [...document.querySelectorAll('.managed-screen-table button')].filter(e=>e.textContent.startsWith('Compare ')).every(e=>e.disabled)");
        // This new journey observes the existing 20-second inter-company pacing unchanged.
        Thread.sleep(20_000);
        awaitPage("both original Annual packets complete before pair selection", DIAGNOSTICS + ".annual === 2 && [...document.querySelectorAll('.managed-screen-table button')].find(e=>e.textContent==='Compare left ZERO')?.disabled === false");
        clickFinancialScreenAction("Compare left ZERO");
        clickFinancialScreenAction("Compare right ONE");
        awaitPage("two owned identities and independent Income dates are compared",
            screenComparisonStatementExact("Income statement") +
            " && document.querySelector(" + JSONObject.quote(left + " > h5") + ")?.textContent === 'Left company: ZERO · Zero Company'" +
            " && document.querySelector(" + JSONObject.quote(right + " > h5") + ")?.textContent === 'Right company: ONE · One Company'" +
            " && " + screenComparisonCellExact(left, "Revenues", "USD 1000", "2025-01-01 through 2025-12-31") +
            " && " + screenComparisonCellExact(right, "Net sales revenue (legacy basis)", "USD 750", "2024-07-01 through 2025-06-30"));
        retainScreenComparisonFrame("screenComparisonLeftIdentity", left + " > h5");
        retainScreenComparisonFrame("screenComparisonRightIdentity", right + " > h5");
        click(left + " .managed-annual-statement-context > summary");
        click(right + " .managed-annual-statement-context > summary");
        awaitPage("both source contexts retain their original independent filing dates and load clocks",
            "(() => { const companies=[...document.querySelectorAll('.managed-screen-comparison-company')]; return companies.every((e,i)=>{ const context=e.querySelector('.managed-annual-statement-context'), text=context?.textContent ?? '';" +
            " return context?.open===true && text.includes(i===0?'10-K · report date 2025-12-31 · filed 2026-02-01.':'10-K · report date 2025-06-30 · filed 2025-08-01.')" +
            " && text.includes('Company Facts captured 2026-09-20T00:00:01.000Z') && text.includes('Submissions captured 2026-09-20T00:00:02.000Z') && text.includes('Original load completed 2026-09-20T00:00:02.000Z'); }); })()");
        retainScreenComparisonFrame("screenComparisonRightOriginalClocks", right + " .managed-annual-statement-source-clocks");
        click(left + " .managed-annual-statement-context .managed-annual-statement-inspect > summary");
        click(right + " .managed-annual-statement-context .managed-annual-statement-inspect > summary");
        awaitPage("each original cutoff, exact issuer and source reference remains inspectable",
            "(() => { const companies=[...document.querySelectorAll('.managed-screen-comparison-company')]; return companies.every((e,i)=>{ const context=e.querySelector('.managed-annual-statement-context .managed-annual-statement-inspect'), groups=[...context.querySelectorAll('dl > div')], get=name=>groups.find(g=>g.querySelector('dt')?.textContent===name)?.querySelector('dd')?.textContent, cik=i===0?'0000000001':'0000000002';" +
            " return context.open && get('Issuer CIK')===cik && get('Original load cutoff')==='2026-09-20T00:00:00.000Z' && /^sha256:[a-f0-9]{64}$/.test(get('Generation digest'))" +
            " && get('Company Facts source').startsWith('available · https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json') && get('Company Facts source').includes('Captured 2026-09-20T00:00:01.000Z')" +
            " && get('Submissions source').startsWith('available · https://data.sec.gov/submissions/CIK'+cik+'.json') && get('Submissions source').includes('Captured 2026-09-20T00:00:02.000Z'); }); })()");
        click(left + " .managed-annual-statement-context > summary");
        click(right + " .managed-annual-statement-context > summary");
        chooseNativeSelectOption(selector, "balance_sheet", "Balance sheet");
        awaitPage("Balance retains exact decimals and independent missing parent equity",
            screenComparisonStatementExact("Balance sheet") +
            " && " + screenComparisonCellExact(left, "Total assets", "USD 1000.125", "At 2025-12-31") +
            " && " + screenComparisonCellExact(right, "Total assets", "USD 1000." + "0".repeat(58) + "1", "At 2025-06-30") +
            " && (()=>{ const row=[...document.querySelector(" + JSONObject.quote(right) + ").querySelectorAll('tbody tr')].find(e=>e.querySelector('th > span')?.textContent==='Equity or deficit attributable to parent'); return row?.querySelector('td')?.textContent.includes('Unavailable.'); })()");
        chooseNativeSelectOption(selector, "cash_flow", "Cash flow");
        String cashLabel = "Net operating cash flow, including discontinued operations";
        String cashLeft = left + " tbody tr:first-child > td:first-of-type .managed-annual-statement-cell";
        String cashRight = right + " tbody tr:first-child > td:first-of-type .managed-annual-statement-cell";
        String cashExact = screenComparisonStatementExact("Cash flow") +
            " && " + screenComparisonCellExact(left, cashLabel, "USD 1000", "2025-01-01 through 2025-12-31") +
            " && " + screenComparisonCellExact(right, cashLabel, "USD 900", "2024-07-01 through 2025-06-30");
        awaitPage("Cash flow preserves each exact value and original period", cashExact);
        retainScreenComparisonFrame("screenComparisonLeftCashPeriod", cashLeft);
        retainScreenComparisonFrame("screenComparisonRightCashPeriod", cashRight);
        String source = right + " tbody tr:first-child .managed-annual-statement-inspect";
        click(source + " > summary");
        String original = "(() => { const root=document.querySelector(" + JSONObject.quote(source) + "), d=[...root.querySelectorAll('.managed-annual-statement-observation dd')].map(e=>e.textContent);" +
            " return root.open && d.length===10 && /^sec-fact:[a-f0-9]{64}$/.test(d[0]) && d[1]==='USD 900' && d[2]==='2024-07-01 through 2025-06-30'" +
            " && d[4]==='/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0'" +
            " && d[5]==='10-K · 0000000002-25-000001 · filed 2025-08-01'" +
            " && d[8]==='https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm'; })()";
        awaitPage("right source belongs to its own issuer and filing without a left-side fallback", original);
        retainScreenComparisonFrame("screenComparisonRightSourceAmount", source + " .managed-annual-statement-observation dl > div:nth-child(2)");
        awaitPage("inspection keeps both independent table periods", cashExact + " && " + original);
        clickFinancialScreenAction("Research ONE from comparison");
        String visit = "(() => { const panel=document.querySelector('.managed-annual-report'), heading=document.querySelector('#managed-annual-heading'), back=document.querySelector('.managed-company-visit .trial-toolbar > button');" +
            " return location.pathname==='/' && location.search==='?company=listing-one&section=annual' && location.hash===''" +
            " && document.querySelector('#managed-company-heading')?.textContent==='Company research · ONE' && heading?.textContent==='Annual report' && document.activeElement===heading" +
            " && panel?.getAttribute('aria-busy')==='false' && back?.disabled===false && back.textContent==='Back to workspace'" +
            " && document.querySelector('.managed-annual-origin')?.textContent==='Showing the report loaded for financial screening. Original source and observation times are unchanged.'" +
            " && document.querySelector('#managed-research-note')?.value==='Comparison right draft' && panel.textContent.includes('2025-06-30'); })()";
        awaitPage("exact seeded Annual visit commits before native Back", visit, true);
        assertFinancialScreenCounts(1, 2);
        awaitPage("same visit remains ready for its single Back", visit, true);
        pressBack();
        awaitPage("single native Back retains exact pair, results, criteria and comparison opener",
            screenComparisonStatementExact("Cash flow") +
            " && document.querySelector(" + JSONObject.quote(selector) + ")?.value==='cash_flow'" +
            " && location.pathname==='/' && location.search==='' && location.hash==='' && document.querySelector('.managed-company-visit')===null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Discover'" +
            " && document.querySelector('.managed-screen-clause select:first-of-type')?.value==='operatingCashFlow' && document.querySelector('.managed-screen-clause input')?.value==='0'" +
            " && document.activeElement===[...document.querySelectorAll('.managed-screen-comparison button')].find(e=>e.textContent==='Research ONE from comparison')" +
            " && [...document.querySelectorAll('.managed-screen-table button[aria-pressed=true]')].map(e=>e.textContent).join('|')==='Compare right ONE|Compare left ZERO'", true);
        assertFinancialScreenCounts(1, 2);
        awaitPage("both independent authored notes remain unsaved and ordered",
            DRAFT + ".memberships?.map(m=>m.symbol).join('|')==='ZERO|ONE' && " + DRAFT + ".memberships?.[0]?.note==='Comparison left draft' && " + DRAFT + ".memberships?.[1]?.note==='Comparison right draft' && " + DRAFT + ".dirty===true && " + DRAFT + ".baseVersion===1");
        assertEquals("Comparison retains one document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(1, 0);
    }

    private String screenComparisonStatementExact(String label) {
        return "(() => { const root=document.querySelector('.managed-screen-comparison'), companies=[...root.querySelectorAll('.managed-screen-comparison-company')];" +
            " return companies.length===2 && companies.every((e,i)=>e.querySelector('.managed-annual-statement-table')?.getAttribute('aria-label')===" + JSONObject.quote(label + " reported USD table") +
            " && e.querySelector('thead th:nth-child(2)')?.childNodes[0]?.textContent===(i===0?'2025-12-31':'2025-06-30'))" +
            " && root.querySelectorAll('input[type=checkbox]').length===0 && document.documentElement.scrollWidth<=document.documentElement.clientWidth; })()";
    }

    private String screenComparisonCellExact(String company, String label, String amount, String period) {
        return "(() => { const root=document.querySelector(" + JSONObject.quote(company) + "), row=[...root.querySelectorAll('tbody tr')].find(e=>e.querySelector('th > span')?.textContent===" + JSONObject.quote(label) + "); const cell=row?.querySelector('td');" +
            " return cell?.querySelector('strong')?.textContent===" + JSONObject.quote(amount) + " && cell?.querySelector('small')?.textContent===" + JSONObject.quote(period) + "; })()";
    }

    private void retainScreenComparisonFrame(String name, String selector) throws Exception {
        retainAnnualNoteFrame(name, selector, selector, 1);
        String visible = "(() => { const e=document.querySelector(" + JSONObject.quote(selector) + "), r=e.getBoundingClientRect(), v=visualViewport;" +
            " return r.width>0 && r.height>0 && r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width && r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height" +
            " && [0.1,0.5,0.9].every(x=>[0.1,0.5,0.9].every(y=>{ const h=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y); return h && (h===e || e.contains(h)); })); })()";
        awaitPage("comparison actual identity or value/period is unobscured: " + name, visible);
        retainScreenshot(name);
        awaitPage("comparison actual content remains unobscured: " + name, visible);
    }

    private String financialScreenExact() {
        return "(() => { const root = document.querySelector('.managed-financial-screen'), rows = [...root.querySelectorAll('.managed-screen-table tbody > tr')];" +
            " if (rows.length !== 1) return false; const cells = [...rows[0].querySelectorAll(':scope > td')];" +
            " return cells.length === 7 && cells[0].textContent === 'match' && cells[1].textContent === 'Unknown: concept missing'" +
            " && cells.slice(2).map(cell => cell.querySelector('span')?.childNodes[0]?.textContent).join('|') === '120.125|100.1|40.1|-200.125|1.50'" +
            " && cells.slice(2).map(cell => cell.querySelector('small')?.textContent).join('|') === '2025-01-01 to 2025-12-31|2025-01-01 to 2025-12-31|As of 2025-12-31|As of 2025-12-31|As of 2025-12-31'" +
            " && rows[0].querySelector('th > button')?.textContent === 'Research ZERO' && rows[0].querySelector('th > button')?.disabled === false" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
    }

    private void assertFinancialScreenCounts(int resolves, int annual) throws Exception {
        awaitPage("financial screen retains its exact finite read counts",
            "(() => { const d = " + DIAGNOSTICS + "; return d.load === 1 && d.status === 1 && d.marketsResolve === 1" +
            " && d.resolve === " + resolves + " && d.annual === " + annual + " && d.save === 0 && d.eod === 0 && d.filings === 0" +
            " && d.search === 0 && d.calendar === 0 && d.fed === 0 && d.token === 0 && d.signOut === 0; })()");
    }

    private void clickFinancialScreenAction(String text) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(concat(' ',normalize-space(@class),' '),' managed-financial-screen ')]//button[normalize-space(.)='" + text + "']")).perform(webClick());
    }

    @Test
    public void priceStudiesPreviewSaveReloadAndReportPreserveRawSource() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        String studies = ".managed-eod-history .managed-price-studies";
        String review = studies + " > .managed-price-studies-review";
        String preview = review + " > .managed-price-studies-preview";
        String choices = studies + " tbody input[type=checkbox]";
        awaitPage("invented Price studies startup makes no source request", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Price studies draft");
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("Price studies require the explicit company history load",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('#managed-research-note')?.value === 'Price studies draft'" +
            " && document.querySelector(" + JSONObject.quote(studies) + ") === null");
        assertPriceNoteCounts(0, 0, 1);
        clickEodAction("Load one-month close history");
        String exactStudies = priceStudiesTableExact(studies, true);
        awaitPage("raw studies keep exact values, their own insufficient samples and the last observed date",
            exactStudies + " && document.querySelector(" + JSONObject.quote(review) + ")?.open === false" +
            " && document.querySelector(" + JSONObject.quote(preview) + ") === null" +
            " && document.querySelector('#managed-research-note')?.value === 'Price studies draft'");
        assertPriceNoteCounts(1, 0, 1);
        retainAnnualNoteFrame("priceStudiesLoaded", studies + " tbody tr:first-child",
            studies + " tbody tr:first-child", 1);
        awaitPage("source study values remain exact after the visible source frame", exactStudies);
        click(studies + " tbody tr:nth-child(1) input[type=checkbox]");
        click(studies + " tbody tr:nth-child(2) input[type=checkbox]");
        click(review + " > summary");
        awaitPage("only the two explicitly chosen available studies enter the review",
            "document.querySelector(" + JSONObject.quote(review) + ")?.open === true" +
            " && document.querySelector(" + JSONObject.quote(review + " > summary") + ")?.textContent === 'Review selected study results (2)'" +
            " && [...document.querySelectorAll(" + JSONObject.quote(choices) + ")].map(e => e.checked).join('|') === 'true|true'" +
            " && document.querySelector(" + JSONObject.quote(review + " > button") + ")?.textContent === 'Preview complete note'" +
            " && document.querySelector(" + JSONObject.quote(review + " > button") + ")?.disabled === false");
        click(review + " > button");
        String exactPreview = "document.querySelector(" + JSONObject.quote(preview + " > .managed-price-studies-note-text") + ")?.textContent === " + JSONObject.quote(PRICE_STUDIES_NOTE) +
            " && document.querySelector(" + JSONObject.quote(preview + " > button") + ")?.textContent === 'Add study results to note draft'" +
            " && document.querySelector(" + JSONObject.quote(preview + " > button") + ")?.disabled === false" +
            " && document.querySelector('#managed-research-note')?.value === 'Price studies draft'" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Price studies draft'";
        awaitPage("whole exact preview preserves authored prefix and all original price provenance without appending", exactPreview);
        assertPriceNoteCounts(1, 0, 1);
        retainAnnualNoteFrame("priceStudiesAppend", preview + " > button", preview + " > button", 1);
        awaitPage("complete note remains unchanged before explicit Append", exactPreview);
        click(preview + " > button");
        awaitPage("one explicit Append consumes the preview and changes only the watchlist note draft",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(PRICE_STUDIES_NOTE) +
            " && document.querySelector(" + JSONObject.quote(preview) + ") === null" +
            " && document.querySelector(" + JSONObject.quote(review + " > [role=status]") + ")?.textContent === 'Study results added to the note draft. Review and save all changes in My Watchlist.'");
        assertPriceStudiesDraft(1, true);
        assertPriceNoteCounts(1, 0, 1);
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("Review opens the complete price-studies note reader without requesting or saving",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.activeElement === document.querySelector('#managed-note-0-reading-toggle')");
        assertFullNoteReading("managed-note-0", PRICE_STUDIES_NOTE, true);
        assertPriceStudiesDraft(1, true);
        assertPriceNoteCounts(1, 0, 1);
        clickWatchlistAction("Save watchlist");
        awaitPage("explicit full-list Save acknowledges version two", DIAGNOSTICS + ".save === 1 && " + DRAFT + ".baseVersion === 2 && " + DRAFT + ".dirty === false");
        assertPriceStudiesDraft(2, false);
        clickWatchlistAction("Load saved watchlist");
        awaitPage("fresh saved read restores the exact full study paragraph", DIAGNOSTICS + ".load === 2 && document.querySelector('#managed-note-0')?.disabled === false");
        assertPriceStudiesDraft(2, false);
        assertPriceNoteCounts(1, 1, 2);
        selectWatchlistNote(0);
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("a new company visit retains the saved note but does not silently restore price evidence",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(PRICE_STUDIES_NOTE) +
            " && document.querySelector(" + JSONObject.quote(studies) + ") === null");
        assertPriceNoteCounts(1, 1, 2);
        clickEodAction("Load one-month close history");
        awaitPage("the second explicit load admits the same original raw inputs for the captured report", exactStudies);
        assertPriceNoteCounts(2, 1, 2);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        String captured = ".managed-company-report .captured-price-studies";
        String passive = priceStudiesTableExact(captured, false) +
            " && document.querySelector('.managed-company-report-note')?.textContent === " + JSONObject.quote(PRICE_STUDIES_NOTE) +
            " && document.querySelectorAll('.managed-company-report .captured-price-studies :is(button,input,select,textarea)').length === 0";
        awaitPage("captured HTML displays the same passive descriptive studies and the complete saved note", passive);
        retainAnnualNoteFrame("priceStudiesCapturedReport", captured + " tbody tr:first-child",
            captured + " tbody tr:first-child", 1);
        awaitPage("passive captured study values remain exact after their visible frame", passive);
        click(".managed-report-document > summary");
        awaitPage("schema4 retains exact raw inputs, original clocks, formulas and independent sample refusals",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false;" +
            " const d = JSON.parse(field.value), p = d.sources.price, r = p.response, c = p.studies?.calculation, m = c?.metrics;" +
            " if (!m) return false; const available = [m.selectedWindowReturn,m.maximumDrawdown];" +
            " const refused = [m.trailing20SessionAnnualizedVolatility,m.smaTrend.sma20,m.smaTrend.sma50,m.smaTrend.sma200,m.trailing252SessionCloseRangePosition];" +
            " const all = [...available,...refused];" +
            " return d.purpose === 'investment.company-research' && d.schemaVersion === '5.0.0'" +
            " && d.authoredResearch.status === 'watchlist_draft' && d.authoredResearch.note === " + JSONObject.quote(PRICE_STUDIES_NOTE) +
            " && d.listing.listingId === 'listing-zero' && d.listing.symbol === 'ZERO' && d.catalogSnapshotSha256 === 'sha256:'+'a'.repeat(64)" +
            " && d.sources.annual.status === 'not_loaded' && d.sources.filings.status === 'not_loaded' && d.valuation === null" +
            " && p.status === 'loaded' && p.retainedPrevious === false && p.lastAttemptFailed === false && p.responseOrigin === 'company' && p.studies.status === 'available'" +
            " && r.schemaVersion === '1.0.0' && r.provider === 'Tiingo' && r.currency === 'USD' && r.priceBasis === 'raw_close' && r.range === '1m'" +
            " && r.window.startDate === '2026-08-20' && r.window.endDate === '2026-09-20'" +
            " && r.requestStartedAt === '2026-09-20T00:00:00.000Z' && r.completedAt === '2026-09-20T00:00:01.000Z'" +
            " && r.rows.map(row => row.date+'='+row.close).join('|') === '2026-09-17=100.000000000000000001|2026-09-18=107.500000000000000002|2026-09-19=110.000000000000000003'" +
            " && c.schemaVersion === '1.0.0' && c.formulaSetVersion === '1.0.0' && c.mode === 'raw' && c.asOfDate === '2026-09-19' && c.asOfDate !== r.window.endDate" +
            " && c.inputWindow.firstDate === '2026-09-17' && c.inputWindow.lastDate === '2026-09-19' && c.inputWindow.sessionCount === 3 && c.inputWindow.sessionPolicy === 'observed_sessions_only_no_gap_filling'" +
            " && all.length === 7 && all.every(metric => metric.formulaVersion === '1.0.0' && metric.observedSessions === 3 && metric.sampleFirstDate === '2026-09-17' && metric.sampleLastDate === '2026-09-19'" +
            " && metric.parameters.roundingDecimalPlaces === 4 && metric.parameters.roundingMethod === 'round_half_up' && metric.parameters.sessionPolicy === 'observed_sessions_only_no_gap_filling')" +
            " && available.every(metric => metric.status === 'available') && m.selectedWindowReturn.valuePercent === '10.0000' && m.maximumDrawdown.valuePercent === '0.0000'" +
            " && m.selectedWindowReturn.formulaId === 'selected_window_simple_return_percent' && m.selectedWindowReturn.parameters.definition === 'last_close_over_first_close_minus_one'" +
            " && m.maximumDrawdown.formulaId === 'maximum_drawdown_magnitude_percent' && m.maximumDrawdown.parameters.sign === 'nonnegative_magnitude' && m.maximumDrawdown.peakDate === '2026-09-17' && m.maximumDrawdown.troughDate === '2026-09-17'" +
            " && refused.every(metric => metric.status === 'insufficient_history' && !('valuePercent' in metric) && !('distancePercent' in metric)) && refused.map(metric => metric.requiredSessions).join('|') === '21|20|50|200|200'" +
            " && m.trailing20SessionAnnualizedVolatility.parameters.returnObservations === 20 && m.trailing20SessionAnnualizedVolatility.parameters.annualizationSessions === 252 && m.trailing20SessionAnnualizedVolatility.parameters.varianceDenominator === 'n_minus_one'" +
            " && m.smaTrend.sma20.parameters.windowSessions === 20 && m.smaTrend.sma50.parameters.windowSessions === 50 && m.smaTrend.sma200.parameters.windowSessions === 200 && m.trailing252SessionCloseRangePosition.parameters.maximumWindowSessions === 252; })()");
        assertPriceStudiesDraft(2, false);
        assertPriceNoteCounts(2, 1, 2);
        awaitPage("study note and report make no unrelated source request",
            DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0");
        assertEquals("Study note review, Save, fresh read and report preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private String priceStudiesTableExact(String scope, boolean editable) {
        return "(() => { const root = document.querySelector(" + JSONObject.quote(scope) + "); if (!root) return false; const rows = [...root.querySelectorAll('tbody tr')];" +
            " const labels = ['Loaded-window raw close change','Maximum observed drawdown','Annualized volatility · 20 log returns','Last close versus 20-observation SMA','Last close versus 50-observation SMA','Last close versus 200-observation SMA','Trailing observed close-range position'];" +
            " const values = ['10.0000%','0.0000%','Unavailable: needs 21 observed closes','Unavailable: needs 20 observed closes','Unavailable: needs 50 observed closes','Unavailable: needs 200 observed closes','Unavailable: needs 200 observed closes'];" +
            " return rows.length === 7 && rows.every((row,index) => row.querySelector('th')?.childNodes[0]?.textContent === labels[index] && row.querySelector('th > small')?.textContent === '3 observed closes; 2026-09-17 through 2026-09-19' && row.querySelector('td > strong')?.textContent === values[index])" +
            " && root.textContent.includes('Calculated through 2026-09-19 from the loaded 1m history.') && !root.textContent.includes('Calculated through 2026-09-20')" +
            " && root.textContent.includes('Observed closes are unadjusted for splits or dividends; gaps are not filled.')" +
            " && root.querySelectorAll('input[type=checkbox]').length === " + (editable ? 2 : 0) +
            (editable ? " && [...root.querySelectorAll('input[type=checkbox]')].every(input => input.disabled === false && input.closest('label')?.textContent.includes('Include '))" : "") + "; })()";
    }

    private void assertPriceStudiesDraft(int version, boolean dirty) throws Exception {
        awaitPage("Price studies preserve the exact full note, unrelated note, order and saved state",
            DRAFT + ".memberships?.map(member => member.symbol).join('|') === 'ZERO|ONE'" +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(PRICE_STUDIES_NOTE) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && " + DRAFT + ".baseVersion === " + version + " && " + DRAFT + ".dirty === " + dirty +
            " && document.body.textContent.includes(" + JSONObject.quote("Version " + version + (dirty ? " · Unsaved changes" : " · Saved")) + ")");
    }

    private void assertPriceNoteDraft(int version, boolean dirty) throws Exception {
        awaitPage("price note preserves the complete paragraph, other note and membership order",
            "Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE'" +
            " && document.querySelectorAll('.managed-watchlist-choices li').length === 2" +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(PRICE_NOTE) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && document.body.textContent.includes(" + JSONObject.quote("Version " + version + (dirty ? " · Unsaved changes" : " · Saved")) + ")" +
            " && Array.from(document.querySelectorAll('[aria-labelledby=managed-watchlist-heading] button')).find(button => button.textContent === 'Save watchlist')?.disabled === " + !dirty);
    }

    private void assertPriceNoteCounts(int eod, int saves, int loads) throws Exception {
        awaitPage("price note has only its explicit company load, save and reload",
            DIAGNOSTICS + ".eod === " + eod + " && " + DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".load === " + loads +
            " && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".eodAborted === 0 && " + DIAGNOSTICS + ".eodLateResolved === 0" +
            " && " + DIAGNOSTICS + ".marketsAborted === 0 && " + DIAGNOSTICS + ".marketsLateResolved === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    @Test
    public void annualOperatingResultsRetainFactsDraftAndRetireWithSession() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        awaitPage("operating results startup performs no source read", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", NOTE);
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        click(ANNUAL);
        String operating = ".managed-annual-report section[aria-label='Annual operating results']";
        String basis = operating + " > section[aria-label='Operating margin basis Revenues']";
        String add = basis + " .managed-annual-operating-note-action button";
        awaitPage("opening Annual leaves operating evidence unloaded and preserves the exact draft",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector(" + JSONObject.quote(operating) + ") === null" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        assertOperatingCounts(0, 0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        String exact = operatingResultsExact();
        awaitPage("the explicit load admits negative operating income and three independent named revenue margins",
            exact + " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        assertOperatingCounts(1, 0, 0, 1);
        retainAnnualNoteFrame("annualOperatingBasis", basis,
            basis + " > h5, " + basis + " > dl, " + add, 3);
        focusCashHistoryControl(operating + " > details > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native keyboard opens exact operating references without refreshing evidence",
            exact + " && document.querySelector(" + JSONObject.quote(operating + " > details") + ")?.open === true" +
            " && document.activeElement === document.querySelector(" + JSONObject.quote(operating + " > details > summary") + ")" +
            " && document.querySelector(" + JSONObject.quote(operating) + ").textContent.includes('/facts/us-gaap/OperatingIncomeLoss/units/USD/0')" +
            " && document.querySelector(" + JSONObject.quote(operating) + ").textContent.includes('2026-09-20T00:00:02.000Z')");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        click(".managed-company-snapshot > summary");
        awaitPage("snapshot retains operating results despite unavailable net income",
            "document.querySelector('.managed-company-snapshot')?.open === true" +
            " && (() => { const root = document.querySelector('.managed-company-snapshot section[aria-label=\"Snapshot operating results\"]'); const values = root ? [...root.querySelectorAll('dl > div')] : [];" +
            " const expected = {'Reported operating income · USD':'-250.125', 'Operating margin · Revenue':'-25.01%', 'Operating margin · Net sales revenue':'-31.27%', 'Operating margin · Customer contract revenue, excluding assessed tax':'-50.03%'};" +
            " return values.length === 4 && values.every(row => row.querySelector('.sec-annual-liquidity-amount')?.textContent === expected[row.querySelector('dt')?.textContent]); })()" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        click(".managed-company-snapshot > summary");
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("complete report retains the operating graph, raw revenue and missing net income",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false;" +
            " const doc = JSON.parse(field.value), annual = doc.sources.annual.response;" +
            " return doc.purpose === 'investment.company-research' && doc.schemaVersion === '5.0.0' && annual.schemaVersion === '6.0.0'" +
            " && annual.evidence.facts.observations.find(row => row.concept === 'OperatingIncomeLoss').value === '-250.125'" +
            " && doc.sources.annual.financials.operatingResults.resolution.margins.length === 3" +
            " && annual.evidence.facts.observations.filter(row => row.concept !== 'OperatingIncomeLoss').length === 3 && annual.evidence.facts.observations.filter(row => row.concept !== 'OperatingIncomeLoss').every(row => ['Revenues','SalesRevenueNet','RevenueFromContractWithCustomerExcludingAssessedTax'].includes(row.concept))" +
            " && annual.evidence.generation.completedAt === '2026-09-20T00:00:02.000Z'" +
            " && doc.sources.price.status === 'not_loaded' && doc.sources.filings.status === 'not_loaded'" +
            " && doc.authoredResearch.note === " + JSONObject.quote(NOTE) + "; })()");
        String originalAnnual = readFixtureString("JSON.stringify(JSON.parse(document.querySelector('#managed-report-document').value).sources.annual.response)");
        click(".managed-company-report > summary");
        assertOperatingCounts(1, 0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("failed refresh retains exact original operating values and invalidates the old capture",
            exact + " && " + DIAGNOSTICS + ".refreshFailed === 1" +
            " && document.querySelector('.managed-annual-report [role=alert]') !== null" +
            " && document.querySelector('#managed-prepared-report-heading') === null" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        assertOperatingCounts(2, 0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("third operating read holds while preserving the original packet", exact + " && " + DIAGNOSTICS + ".annual === 3 && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'");
        click(".managed-annual-report .trial-actions button:nth-child(2)");
        awaitPage("Cancel aborts only the pending read", exact + " && " + DIAGNOSTICS + ".aborted === 1");
        click("#settle-cancelled-read");
        awaitPage("late changed operating packet cannot replace the original values or draft",
            exact + " && " + DIAGNOSTICS + ".lateResolved === 1 && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft));
        assertOperatingCounts(3, 1, 1, 1);
        click(add);
        String expectedNote = NOTE + " Observed Annual operating results: ZERO (XNAS); CIK 0000000001; 10-K, 2025-01-01 to 2025-12-31. " +
            "Reported operating income (OperatingIncomeLoss) USD -250.125; reported revenue (Revenues) USD 1000. " +
            "App calculation: operating margin -25.01% = operating income / positive revenue * 100 (two decimal places, half up). Same filing and exact period; revenue bases stay separate. " +
            "Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
            "Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. " +
            "Current-use policy at original load: eligible. Retained previous report. Evidence dates are unchanged; this action does not refresh sources.";
        awaitPage("one explicit append retains the entire prior draft and exact chosen operating paragraph",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expectedNote) +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(expectedNote) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && [...document.querySelectorAll('.managed-watchlist-choices li > button > strong')].map(e => e.textContent).join('|') === 'ZERO|ONE'");
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("new report preserves complete original source packet and the full unsaved appended note",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field) return false; const doc = JSON.parse(field.value);" +
            " return doc.authoredResearch.note === " + JSONObject.quote(expectedNote) +
            " && doc.sources.annual.retainedPrevious === true && JSON.stringify(doc.sources.annual.response) === " + JSONObject.quote(originalAnnual) + "; })()");
        assertOperatingCounts(3, 1, 1, 1);
        click(".managed-company-report > summary");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("fourth operating read remains pending with the unsaved note", exact + " && " + DIAGNOSTICS + ".annual === 4 && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expectedNote));
        click(CATALOG_REFRESH);
        awaitPage("normal session expiry clears company evidence, captures and the local draft",
            DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && document.querySelector('.managed-company-research') === null && document.querySelector('.managed-company-snapshot') === null" +
            " && document.querySelector('#managed-prepared-report-heading') === null && document.querySelector('#managed-report-document') === null" +
            " && " + DIAGNOSTICS + ".aborted === 2");
        click("#settle-cancelled-read");
        awaitPage("retired-session late operating result cannot restore sources or the draft",
            DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && " + DIAGNOSTICS + ".lateResolved === 2" +
            " && document.querySelector('.managed-annual-report') === null && document.querySelector('.managed-company-research') === null");
        assertOperatingCounts(4, 2, 2, 2);
        assertEquals(documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private String operatingResultsExact() {
        return "(() => { const root = document.querySelector('.managed-annual-report section[aria-label=\"Annual operating results\"]');" +
            " const expected = { Revenues: ['1000','-25.01%','Revenue'], SalesRevenueNet: ['800','-31.27%','Net sales revenue'], RevenueFromContractWithCustomerExcludingAssessedTax: ['500','-50.03%','Customer contract revenue, excluding assessed tax'] };" +
            " const bases = root ? [...root.querySelectorAll(':scope > section')] : [];" +
            " return root?.querySelector(':scope > dl .sec-annual-liquidity-amount')?.textContent === '-250.125' && bases.length === 3" +
            " && bases.every(basis => { const concept = basis.getAttribute('aria-label').replace('Operating margin basis ', ''); const amounts = [...basis.querySelectorAll('.sec-annual-liquidity-amount')].map(e => e.textContent);" +
            " return expected[concept] && basis.querySelector('h5').textContent === expected[concept][2] && JSON.stringify(amounts) === JSON.stringify(expected[concept].slice(0,2)); })" +
            " && root.textContent.includes('2025-01-01 to 2025-12-31') && root.textContent.includes('2026-09-20T00:00:02.000Z')" +
            " && !root.textContent.includes('999.875') && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; })()";
    }

    private void assertOperatingCounts(int annual, int aborted, int late, int status) throws Exception {
        awaitPage("operating evidence uses only its explicit reads and no persistence or other sources",
            DIAGNOSTICS + ".annual === " + annual + " && " + DIAGNOSTICS + ".aborted === " + aborted +
            " && " + DIAGNOSTICS + ".lateResolved === " + late + " && " + DIAGNOSTICS + ".status === " + status +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0 && " + DIAGNOSTICS + ".search === 0" +
            " && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    @Test
    public void annualStatementsPreviewAppendSaveAndCapturePreserveSources() throws Exception {
        double origin = readDocumentTimeOrigin();
        String metadata = "JSON.parse(document.querySelector('#fixture-annual-statements').textContent)";
        String prefix = readFixtureString(metadata + ".prefix");
        String expected = readFixtureString(metadata + ".expectedNote");
        String reader = ".managed-annual-statements";
        String selector = reader + " .managed-annual-statement-selector select";
        String tools = ".managed-annual-statements-note";
        String preview = ".managed-annual-statements-note-preview";
        String incomeChoice = reader + " input[aria-label^='Include Net income or loss attributable to parent, '][aria-label*='through 2025-12-31,']";
        String assetsChoice = reader + " input[aria-label^='Include Total assets, at 2024-12-31,']";
        awaitPage("statement fixture starts without financial requests", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        typeIntoInput("managed-note-1", NOTE);
        click(ANNUAL);
        awaitPage("explicit Annual visit keeps the authored draft before a source read",
            "document.querySelector('.managed-annual-report .trial-actions button:first-child')?.disabled === false && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE));
        replaceReportNoteWithNativeIme(NOTE, prefix);
        assertFinancialReviewCounts(0, 0, 0, 0, 1, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("Income is the first loaded Annual reading surface with three actual dates and an exact signed unsafe amount",
            statementTableExact("Income statement") + " && document.querySelector(" + JSONObject.quote(reader) + ")?.textContent.includes('-9007199254740993.123456789012345678')" +
            " && document.querySelector(" + JSONObject.quote(tools) + ")?.open === false && document.querySelector(" + JSONObject.quote(preview) + ") === null");
        assertFinancialReviewCounts(1, 0, 0, 0, 1, 1);
        retainAnnualNoteFrame("annualStatementsIncome", reader + " h3", reader + " h3, " + selector, 2);
        String coverage = reader + " .managed-annual-statement-context";
        awaitPage("statement coverage starts closed while original load and source states remain visible",
            "document.querySelector(" + JSONObject.quote(coverage) + ")?.open === false" +
            " && document.querySelector('.managed-annual-statement-summary')?.textContent.includes('Original load completed 2026-09-20T00:00:03.000Z')" +
            " && document.querySelector('.managed-annual-statement-summary')?.textContent.includes('Company Facts: available')");
        click(coverage + " > summary");
        String sourceClocksExact = "(() => { const text = document.querySelector('.managed-annual-statement-source-clocks')?.textContent ?? ''; return text.includes('Company Facts captured 2026-09-20T00:00:02.000Z')" +
            " && text.includes('Submissions captured 2026-09-20T00:00:01.000Z') && text.includes('Original load completed 2026-09-20T00:00:03.000Z'); })()";
        awaitPage("statement coverage exposes original source clocks without changing evidence",
            "document.querySelector(" + JSONObject.quote(coverage) + ")?.open === true && " + sourceClocksExact);
        retainAnnualNoteFrame("annualStatementsSourceClocks", coverage + " .managed-annual-statement-source-clocks", coverage + " .managed-annual-statement-source-clocks", 1);
        awaitPage("both original source clocks remain exact after capture", sourceClocksExact);
        click(coverage + " > summary");
        awaitPage("statement coverage closes without changing the exact table", "document.querySelector(" + JSONObject.quote(coverage) + ")?.open === false && " + statementTableExact("Income statement"));
        click(incomeChoice);
        String incomeAmount = reader + " td:has(input[aria-label^='Include Net income or loss attributable to parent, '][aria-label*='through 2025-12-31,']) .managed-annual-statement-amount";
        String incomeExact = "document.querySelector(" + JSONObject.quote(incomeAmount) + ")?.textContent === 'USD -9007199254740993.123456789012345678' && document.querySelector(" + JSONObject.quote(incomeChoice) + ")?.checked === true";
        awaitPage("the selected income cell displays the exact signed full-USD amount", incomeExact);
        retainAnnualNoteFrame("annualStatementsExactIncome", incomeAmount, incomeAmount, 1);
        awaitPage("the selected exact income amount remains unchanged after capture", incomeExact);
        chooseNativeSelectOption(selector, "balance_sheet", "Balance sheet");
        awaitPage("Balance sheet retains instant dates and exact comparative assets", statementTableExact("Balance sheet") +
            " && document.querySelector(" + JSONObject.quote(assetsChoice) + ")?.checked === false");
        click(assetsChoice);
        chooseNativeSelectOption(selector, "cash_flow", "Cash flow");
        awaitPage("Cash flow keeps independently reported signed comparatives", statementTableExact("Cash flow") +
            " && document.querySelector(" + JSONObject.quote(reader) + ")?.textContent.includes('USD -80.0625')");
        retainAnnualNoteFrame("annualStatementsCash", reader + " h3", reader + " h3, " + selector, 2);
        chooseNativeSelectOption(selector, "balance_sheet", "Balance sheet");
        click(tools + " > summary");
        click(tools + " > button");
        awaitPage("complete source-linked Unicode note is previewed without append or Save", statementPreviewExact(expected) +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(prefix));
        click(assetsChoice);
        click(assetsChoice);
        awaitPage("editing and restoring a selected cell cannot revive the previous preview",
            "document.querySelector(" + JSONObject.quote(preview) + ") === null && document.querySelector(" + JSONObject.quote(assetsChoice) + ")?.checked === true" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(prefix));
        click(tools + " > button");
        awaitPage("a new explicit preview owns the restored selection", statementPreviewExact(expected));
        retainStatementPreviewTextFrame("annualStatementsPreviewFirst", expected, false);
        retainStatementPreviewTextFrame("annualStatementsPreviewLast", expected, true);
        retainAnnualNoteFrame("annualStatementsAppend", preview + " > button", preview + " > button", 1);
        click(preview + " > button");
        awaitPage("one Append changes only the full current note draft", "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) +
            " && document.querySelector(" + JSONObject.quote(preview) + ") === null && " + DRAFT + ".dirty === true");
        assertFinancialReviewCounts(1, 0, 0, 0, 1, 1);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("schema4 captures all32 scans and95 original observations once with exact selected-cell references",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false; const d = JSON.parse(field.value), a = d.sources.annual, e = a.response.evidence;" +
            " const rows = e.facts.observations, ids = new Set(rows.map(row => row.id));" +
            " return d.schemaVersion === '5.0.0' && a.response.schemaVersion === '6.0.0' && d.authoredResearch.note === " + JSONObject.quote(expected) +
            " && e.facts.scans.length === 32 && rows.length === 95 && ids.size === 95 && rows.every(row => !('metric' in row))" +
            " && field.value.split(String.fromCharCode(34) + 'observations' + String.fromCharCode(34) + ':').length === 2 && a.statements.statements.reduce((count,s) => count+s.rows.length,0) === 32" +
            " && a.statements.statements.length === 3 && a.statements.statements.every(s => s.columns.map(c => c.endDate).join('|') === '2025-12-31|2024-12-31|2023-12-31')" +
            " && a.statements.statements.flatMap(s => s.rows.flatMap(r => r.cells)).every(c => c.status !== 'available' || (c.observationIds.length > 0 && c.observationIds.every(id => ids.has(id))))" +
            " && rows.find(row => row.concept === 'NetIncomeLoss' && row.endDate === '2025-12-31').value === '-9007199254740993.123456789012345678'" +
            " && rows.find(row => row.concept === 'Assets' && row.endDate === '2024-12-31').value === '900.5' && !rows.some(row => row.concept === 'IncomeTaxExpenseBenefit' && row.endDate === '2024-12-31')" +
            " && e.generation.sha256 === " + metadata + ".generation.sha256 && d.sources.price.status === 'not_loaded' && d.sources.filings.status === 'not_loaded'; })()");
        String document = readFixtureString("document.querySelector('#managed-report-document').value");
        android.content.Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(appContext);
        WatchlistSystemPicker picker = new WatchlistSystemPicker();
        try {
            click(".managed-report-delivery button");
            picker.saveToInventedRoot();
            awaitPage("the real native writer confirms the chosen complete statement JSON", "document.querySelector('.managed-report-delivery [role=status]')?.textContent.startsWith('Saved report ')");
            WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(appContext);
            assertEquals(1, outputs.length);
            assertArrayEquals(document.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.readReport(appContext, outputs[0]));
        } finally { WatchlistTestDocuments.clear(appContext); }
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        assertFullNoteReading("managed-note-1", expected, true);
        onWebView().withElement(findElement(Locator.XPATH, "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("explicit Review then Save acknowledges the exact full note", DIAGNOSTICS + ".save === 1 && " + DRAFT + ".baseVersion === 2 && " + DRAFT + ".dirty === false");
        onWebView().withElement(findElement(Locator.XPATH, "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("fresh read preserves order, both identities and the complete saved note", DIAGNOSTICS + ".load === 2 && " + DRAFT + ".memberships?.map(m => m.symbol).join('|') === 'ONE|ZERO' && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note' && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(expected));
        click(ANNUAL);
        awaitPage("new visit cannot restore old statement selections or evidence", "document.querySelector(" + JSONObject.quote(reader) + ") === null && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected));
        click(CATALOG_REFRESH);
        awaitPage("retirement clears both saved-draft view and statement preview", DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && document.querySelector('.managed-company-visit') === null && document.querySelector(" + JSONObject.quote(preview) + ") === null");
        assertFinancialReviewCounts(1, 0, 0, 1, 2, 2);
        assertEquals("Statement workflow never reloads the document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private void retainStatementPreviewTextFrame(String name, String expected, boolean last) throws Exception {
        String range = "const text = document.querySelector('.managed-annual-statements-note-preview > p');" +
            " if (text?.textContent !== " + JSONObject.quote(expected) + " || text.children.length !== 0 || !text.closest('details')?.open) return false;" +
            " const node = text.firstChild; if (!node || node.nodeType !== Node.TEXT_NODE || node.length < 80) return false;" +
            " const range = document.createRange(); range.setStart(node," + (last ? "node.length - 80" : "0") + "); range.setEnd(node," + (last ? "node.length" : "80") + ");";
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { " + range + " const r = range.getBoundingClientRect(), v = visualViewport; if (!v) return false; window.scrollBy({top:r.top-v.offsetTop-24,behavior:'instant'}); return true; })()",
            ignored -> scrolled.countDown()));
        assertTrue("Statement preview text range did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { " + range + " const v = visualViewport, rects = [...range.getClientRects()]; return v && rects.length > 0 && rects.every(r => {" +
            " if (!(r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height)) return false;" +
            " const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return hit === text || text.contains(hit); }); })()";
        awaitPage("Complete statement preview range is visible and uncovered: " + name, visible);
        retainScreenshot(name);
        awaitPage("Complete statement preview range remains visible and uncovered: " + name, visible);
    }

    private String statementTableExact(String label) {
        return "(() => { const table = document.querySelector('.managed-annual-statements .managed-annual-statement-table');" +
            " return table?.getAttribute('aria-label') === " + JSONObject.quote(label + " reported USD table") +
            " && table.querySelector('caption')?.textContent === " + JSONObject.quote(label + " · exact reported USD") +
            " && [...table.querySelectorAll('thead th[scope=col]')].slice(1).map(c => c.childNodes[0].textContent).join('|') === '2025-12-31|2024-12-31|2023-12-31'" +
            " && getComputedStyle(table).overflowX === 'auto' && document.documentElement.scrollWidth <= document.documentElement.clientWidth" +
            " && document.querySelector('.managed-annual-statement-selector select')?.getBoundingClientRect().height >= 44; })()";
    }

    private String statementPreviewExact(String expected) {
        return "(() => { const root = document.querySelector('.managed-annual-statements-note-preview'), note = root?.querySelector('p');" +
            " return note?.textContent === " + JSONObject.quote(expected) + " && note.children.length === 0 && [...note.textContent.normalize('NFC')].length <= 2000" +
            " && root.querySelector('h4')?.textContent === 'Complete note preview' && root.querySelector('button')?.disabled === false" +
            " && note.textContent.includes('-9007199254740993.123456789012345678') && note.textContent.includes('900.5')" +
            " && (note.textContent.match(/sec-fact:[a-f0-9]{64}/g) || []).length === 2; })()";
    }

    @Test
    public void annualFinancialReviewRequiresPreviewAndExplicitSave() throws Exception {
        double origin = readDocumentTimeOrigin();
        String metadata = "JSON.parse(document.querySelector('#fixture-financial-review').textContent)";
        String note = readFixtureString(metadata + ".prefix");
        String expected = readFixtureString(metadata + ".expectedNote");
        String tools = ".managed-financial-review-note";
        String preview = ".managed-financial-review-preview";
        awaitPage("financial review starts with no source request", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("financial review retains both exact memberships", DRAFT + ".memberships?.map(m => m.symbol).join(',') === 'ONE,ZERO'");
        typeIntoInput("managed-note-1", NOTE);
        click(ANNUAL);
        awaitPage("settled actual Annual route permits the explicit source load",
            "new URL(location.href).searchParams.get('company') === 'listing-zero' && new URL(location.href).searchParams.get('section') === 'annual'" +
            " && document.querySelector('.managed-annual-report .trial-actions button:first-child')?.disabled === false && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE));
        replaceReportNoteWithNativeIme(NOTE, note);
        assertFinancialReviewCounts(0, 0, 0, 0, 1, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("one explicit Annual load supplies five independent facts and closed note tools",
            financialReviewFactsExact() + " && document.querySelector(" + JSONObject.quote(tools) + ")?.open === false" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(note));
        click(".managed-financial-review button[aria-label='Inspect Reported operating income']");
        awaitPage("Inspect focuses original operating inputs without another source read",
            "document.activeElement === document.querySelector('[data-annual-report-target=operating]') && " + financialReviewFactsExact());
        assertFinancialReviewCounts(1, 0, 0, 0, 1, 1);
        focusCashHistoryControl(tools + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native keyboard opens the existing closed note tools",
            "document.querySelector(" + JSONObject.quote(tools) + ")?.open === true && document.querySelectorAll(" + JSONObject.quote(tools + " input[type=checkbox]") + ").length === 5");
        click(tools + " label:nth-of-type(1) input");
        click(tools + " label:nth-of-type(5) input");
        awaitPage("two explicit facts enable Preview on the settled Company route",
            "document.querySelector(" + JSONObject.quote(tools + " > button") + ")?.disabled === false && new URL(location.href).searchParams.get('section') === 'annual'" +
            " && [...document.querySelectorAll(" + JSONObject.quote(tools + " input[type=checkbox]") + ")].map(e => e.checked).join(',') === 'true,false,false,false,true'");
        click(tools + " > button");
        awaitPage("complete Unicode preview retains both exact source facts before any append",
            financialReviewPreviewExact(expected, true) + " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(note));
        retainAnnualNoteFrame("financialReviewPreview", preview + " > h5", preview + " > h5", 1);
        replaceReportNoteWithNativeIme(note, note + " edited");
        replaceReportNoteWithNativeIme(note + " edited", note);
        awaitPage("editing then restoring the note does not revive the previous preview", financialReviewPreviewExact(expected, false));
        click(tools + " > button");
        awaitPage("a new explicit preview is current again", financialReviewPreviewExact(expected, true));
        click(preview + " > button");
        awaitPage("append changes the complete draft exactly once without saving",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(expected) + " && " + DRAFT + ".dirty === true" +
            " && document.querySelector(" + JSONObject.quote(tools + " [role=status]") + ")?.textContent === 'Financial review added to the note draft. Review and save all changes in My Watchlist.'");
        assertFinancialReviewCounts(1, 0, 0, 0, 1, 1);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("captured report retains the complete note and all independent Annual inputs",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false; const d = JSON.parse(field.value), a = d.sources.annual.response, e = a.evidence, f = d.sources.annual.financials;" +
            " return JSON.stringify(d).includes(" + JSONObject.quote(expected) + ") && a.schemaVersion === '6.0.0' && e.facts.observations.filter(row => ['Revenues','SalesRevenueNet','RevenueFromContractWithCustomerExcludingAssessedTax','NetIncomeLoss'].includes(row.concept)).length === 0" +
            " && f.operatingResults.resolution.operatingIncome.value === '250.125' && f.cashGeneration.resolution.operatingCashFlow.value === '120.125'" +
            " && f.cashGeneration.resolution.operatingCashFlowLessPpePurchases.value === '-80.125' && f.liquidity.resolution.workingCapital.value === '0'" +
            " && f.balanceSheet.resolution.shareholdersEquity.value === '-7.5' && e.generation.completedAt === '2026-09-20T00:00:02.000Z'" +
            " && e.generation.sha256 === " + metadata + ".generation.sha256 && " + JSONObject.quote(expected) + ".includes(f.operatingResults.resolution.operatingIncome.observationIds[0])" +
            " && " + JSONObject.quote(expected) + ".includes(f.balanceSheet.resolution.shareholdersEquity.observationIds[0]); })()");
        click(".managed-company-report > summary");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("failed refresh retains exact facts and the appended draft",
            financialReviewFactsExact() + " && " + DIAGNOSTICS + ".refreshFailed === 1 && document.querySelector('.managed-annual-report [role=alert]') !== null" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) + " && document.querySelector('#managed-report-document') === null");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("third explicit request is held without replacing facts", financialReviewFactsExact() + " && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'");
        click(".managed-annual-report .trial-actions button:nth-child(2)");
        awaitPage("Cancel aborts only the held source", DIAGNOSTICS + ".aborted === 1");
        click("#settle-cancelled-read");
        awaitPage("changed late completion cannot replace retained facts or draft",
            financialReviewFactsExact() + " && " + DIAGNOSTICS + ".lateResolved === 1 && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) +
            " && document.querySelector('.managed-company-visit') !== null && !document.querySelector('.managed-company-visit').textContent.includes('999.875')");
        assertFinancialReviewCounts(3, 1, 1, 0, 1, 1);
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("Review opens the exact watchlist note reader without saving",
            "document.querySelector('.managed-company-visit') === null && document.activeElement === document.querySelector('#managed-note-1-reading-toggle')");
        assertFullNoteReading("managed-note-1", expected, true);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("one explicit whole-watchlist Save acknowledges version two", DIAGNOSTICS + ".save === 1 && " + DRAFT + ".baseVersion === 2 && " + DRAFT + ".dirty === false");
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("explicit reload preserves both full memberships and the complete saved Unicode note",
            DIAGNOSTICS + ".load === 2 && " + DRAFT + ".memberships?.length === 2 && " + DRAFT + ".memberships?.[0]?.listingId === 'listing-one'" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note' && " + DRAFT + ".memberships?.[1]?.listingId === 'listing-zero'" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(expected) + " && " + DRAFT + ".dirty === false");
        assertFinancialReviewCounts(3, 1, 1, 1, 2, 1);
        click(ANNUAL);
        awaitPage("new visit is unloaded and preserves the saved note without a source read",
            "document.querySelector('.managed-financial-review') === null && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(expected) +
            " && document.querySelector('.managed-annual-report .trial-actions button:first-child')?.disabled === false");
        assertFinancialReviewCounts(3, 1, 1, 1, 2, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("fourth explicit source read holds for session retirement", DIAGNOSTICS + ".annual === 4 && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'");
        click(CATALOG_REFRESH);
        String retired = DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && document.querySelector('.managed-company-visit') === null && document.querySelector('.managed-financial-review') === null";
        awaitPage("session retirement clears the draft and preview", retired + " && " + DIAGNOSTICS + ".aborted === 2");
        click("#settle-cancelled-read");
        awaitPage("retired late financial facts cannot restore the source, draft or preview", retired + " && " + DIAGNOSTICS + ".lateResolved === 2 && !document.querySelector('.managed-frame').textContent.includes('999.875')");
        assertFinancialReviewCounts(4, 2, 2, 1, 2, 2);
        assertEquals("Financial review never reloads the document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(0, 1);
    }

    private String financialReviewFactsExact() {
        return "(() => { const root = document.querySelector('.managed-financial-review'); const rows = [...(root?.querySelectorAll('.managed-financial-review-facts > div') || [])];" +
            " const labels = ['Reported operating incomeReported · USD','Reported operating cash flowReported · USD','Operating cash flow less PP&E purchasesApp calculation · USD','Working capitalApp calculation · USD','Reported parent equityReported · USD'];" +
            " const values = ['250.125','120.125','-80.125','0','-7.5'], signs = ['positive','positive','negative','zero','negative'];" +
            " return rows.length === 5 && rows.every((row,i) => row.querySelector('dt')?.textContent === labels[i] && row.querySelector('dd > span')?.textContent === values[i]" +
            " && row.querySelector('dd')?.textContent.includes('Amount sign: ' + signs[i]) && row.querySelector('dd')?.textContent.includes(i === 3 || i === 4 ? '2025-12-31' : '2025-01-01 to 2025-12-31')" +
            " && row.querySelector('button')?.textContent === 'Inspect inputs') && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
    }

    private String financialReviewPreviewExact(String expected, boolean current) {
        return "(() => { const root = document.querySelector('.managed-financial-review-preview'), text = root?.querySelector('p'); return text?.textContent === " + JSONObject.quote(expected) +
            " && text.children.length === 0 && root.querySelector('h5')?.textContent === " + JSONObject.quote(current ? "Complete note preview" : "Previous note preview") +
            " && root.querySelector('button')?.disabled === " + !current +
            " && text.textContent.startsWith('Financial review thesis · Café 東京 📈 Financial review: ZERO (XNAS), listing listing-zero, CIK 0000000001.')" +
            " && text.textContent.includes('USD 250.125; period 2025-01-01 to 2025-12-31') && text.textContent.includes('USD -7.5; as of 2025-12-31')" +
            " && (text.textContent.match(/sec-fact:[a-f0-9]{64}/g) || []).length === 2 && text.textContent.includes('Original load: cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z')" +
            " && text.textContent.includes('Company Facts available, captured 2026-09-20T00:00:01.000Z') && text.textContent.includes('Submissions available, captured 2026-09-20T00:00:02.000Z')" +
            " && text.textContent.includes('current use eligible') && text.textContent.endsWith('No source refresh.') && [...text.textContent.normalize('NFC')].length <= 2000; })()";
    }

    private void assertFinancialReviewCounts(int annual, int aborted, int late, int saves, int loads, int status) throws Exception {
        awaitPage("financial review has only its exact explicit reads, Save and reload",
            DIAGNOSTICS + ".annual === " + annual + " && " + DIAGNOSTICS + ".aborted === " + aborted + " && " + DIAGNOSTICS + ".lateResolved === " + late +
            " && " + DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".load === " + loads + " && " + DIAGNOSTICS + ".status === " + status +
            " && " + DIAGNOSTICS + ".marketsResolve === 1 && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    @Test
    public void annualBalanceSheetCapturesExactTotalsAndRetiresLateRefresh() throws Exception {
        double origin = readDocumentTimeOrigin();
        String note = "Balance sheet draft · Café 東京 📈";
        awaitPage("balance-sheet startup performs no financial read", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("balance-sheet draft keeps exact reordered listings", DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'");
        typeIntoInput("managed-note-1", NOTE);
        click(ANNUAL);
        awaitPage("opening Annual preserves the draft without loading totals", "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE) + " && document.querySelector('.sec-annual-balance-sheet') === null");
        replaceReportNoteWithNativeIme(NOTE, note);
        String draft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        assertOperatingCounts(0, 0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        String exact = balanceSheetExact(draft);
        String root = ".managed-annual-report .sec-annual-balance-sheet";
        String source = root + " > .sec-annual-balance-sheet-source";
        String table = root + " > .sec-annual-balance-sheet-results";
        awaitPage("one Annual read supplies three signed instant totals independently of income", exact + " && document.querySelector(" + JSONObject.quote(source) + ")?.open === false");
        click("[data-annual-report-jump='balanceSheet']");
        awaitPage("Balance sheet navigation focuses the exact heading without another read", exact + " && document.activeElement === document.querySelector('[data-annual-report-target=balanceSheet]')");
        focusCashHistoryControl(table);
        awaitPage("the totals region exposes visible keyboard focus and contains its layout",
            "(() => { const table = document.querySelector(" + JSONObject.quote(table) + "); return table?.getAttribute('role') === 'region' && table.tabIndex === 0" +
            " && table.getAttribute('aria-label') === 'Annual balance sheet results' && document.activeElement === table" +
            " && getComputedStyle(table).outlineStyle !== 'none' && parseFloat(getComputedStyle(table).outlineWidth) >= 2" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
        retainAnnualNoteFrame("balanceSheetLoaded", table + " table", table + " tbody tr", 3);
        String history = root + " > .managed-annual-balance-sheet-history";
        String historyTable = history + " .managed-balance-sheet-history-table";
        String historyReferences = history + " .managed-balance-sheet-history-references";
        awaitPage("balance history and its references start closed without another read", exact +
            " && document.querySelector(" + JSONObject.quote(history) + ")?.open === false && document.querySelector(" + JSONObject.quote(historyReferences) + ")?.open === false");
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native keyboard opens independent reported dates and keeps disclosure focus", exact +
            " && document.querySelector(" + JSONObject.quote(history) + ")?.open === true && document.activeElement === document.querySelector(" + JSONObject.quote(history + " > summary") + ")");
        focusCashHistoryControl(historyTable);
        awaitPage("balance history is a keyboard-focusable contained financial table", exact +
            " && (() => { const table = document.querySelector(" + JSONObject.quote(historyTable) + "), r = table?.getBoundingClientRect(), v = visualViewport;" +
            " return table?.getAttribute('role') === 'region' && table.tabIndex === 0 && table.getAttribute('aria-label') === 'Reported balance sheet history amounts'" +
            " && document.activeElement === table && getComputedStyle(table).outlineStyle !== 'none' && parseFloat(getComputedStyle(table).outlineWidth) >= 2" +
            " && r.width <= v.width && table.scrollWidth > table.clientWidth && table.scrollLeft === 0; })()");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_DPAD_RIGHT));
        awaitPage("native Right scrolls balance history while retaining exact independent cells", exact +
            " && document.querySelector(" + JSONObject.quote(historyTable) + ").scrollLeft > 0 && document.activeElement === document.querySelector(" + JSONObject.quote(historyTable) + ")");
        retainAnnualNoteFrame("balanceSheetHistoryLoaded", historyTable + " thead th:nth-child(3)", historyTable + " thead th:nth-child(3), " + historyTable + " tbody td:nth-of-type(2)", 4);
        String change = history + " > .managed-annual-balance-sheet-change";
        awaitPage("signed changes use the first two shared dates without borrowing the older liability", exact + " && " + balanceSheetChangeExact());
        retainAnnualNoteFrame("balanceSheetChangeLoaded", change + " > h6", change + " > h6, " + change + " > dl > div", 4);
        focusCashHistoryControl(historyReferences + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native keyboard exposes each date and metric's exact source references", exact +
            " && document.querySelector(" + JSONObject.quote(historyReferences) + ")?.open === true && document.activeElement === document.querySelector(" + JSONObject.quote(historyReferences + " > summary") + ")");
        assertOperatingCounts(1, 0, 0, 1);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("closing balance history preserves current totals and every captured observation", exact +
            " && document.querySelector(" + JSONObject.quote(history) + ")?.open === false");
        focusCashHistoryControl(source + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native keyboard opens all three exact source records and original clocks",
            exact + " && document.querySelector(" + JSONObject.quote(source) + ")?.open === true && document.activeElement === document.querySelector(" + JSONObject.quote(source + " > summary") + ")" +
            " && " + balanceSheetSourceExact());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        click(".managed-company-snapshot > summary");
        awaitPage("snapshot reuses all three reported totals without loading Price or Filings",
            "document.querySelector('.managed-company-snapshot')?.open === true && " + balanceSheetSnapshotExact(".managed-company-snapshot") + " && " + exact);
        click(".managed-company-snapshot > summary");
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("the captured read-only report retains complete exact totals, sources and missing income",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field?.readOnly) return false;" +
            " const doc = JSON.parse(field.value), annual = doc.sources.annual.response, e = annual.evidence, b = doc.sources.annual.financials.balanceSheet;" +
            " const keys = ['totalAssets','totalLiabilities','shareholdersEquity'], concepts = ['Assets','Liabilities','StockholdersEquity'], amounts = ['1000.125','1200.25','-200.125'];" +
            " return doc.purpose === 'investment.company-research' && doc.schemaVersion === '5.0.0' && annual.schemaVersion === '6.0.0'" +
            " && annual.security.symbol === 'ZERO' && annual.security.listingId === 'listing-zero' && e.facts.observations.filter(row => ['Revenues','SalesRevenueNet','RevenueFromContractWithCustomerExcludingAssessedTax','NetIncomeLoss'].includes(row.concept)).length === 0 && doc.sources.annual.financials.income.resolution.pairs.length === 0" +
            " && keys.every((key,i) => { const observations = e.facts.observations.filter(row => row.concept === concepts[i]), value = b.resolution[key], row = observations[0];" +
            " return observations.length === [3,2,3][i] && row.value === amounts[i] && row.concept === concepts[i] && row.unit === 'USD' && row.startDate === null && row.durationDays === null" +
            " && row.endDate === '2025-12-31' && row.accessionNumber === '0000000001-26-000001' && row.filing.reportDate === '2025-12-31'" +
            " && row.sourceLocator === '/facts/us-gaap/' + concepts[i] + '/units/USD/0' && /^sec-fact:[a-f0-9]{64}$/.test(row.id)" +
            " && value.status === 'available' && value.value === amounts[i] && value.unit === 'USD' && value.asOfDate === '2025-12-31' && value.currentUseEligible === true" +
            " && value.observationIds.length === 1 && value.observationIds[0] === row.id" +
            " && observations.every((item,j) => item.endDate === [['2025-12-31','2024-12-31','2023-09-30'],['2025-12-31','2023-09-30'],['2025-12-31','2024-12-31','2023-09-30']][i][j]" +
            " && item.value === [['1000.125','900.5','800.875'],['1200.25','900'],['-200.125','0','-98.625']][i][j] && item.filing.reportDate === '2025-12-31'" +
            " && item.accessionNumber === '0000000001-26-000001' && item.unit === 'USD' && item.startDate === null && item.durationDays === null" +
            " && item.sourceLocator === '/facts/us-gaap/' + concepts[i] + '/units/USD/' + j && /^sec-fact:[a-f0-9]{64}$/.test(item.id)); })" +
            " && e.generation.cutoffAt === '2026-09-20T00:00:00.000Z' && e.generation.completedAt === '2026-09-20T00:00:02.000Z'" +
            " && e.generation.sources.companyFacts.fetchedAt === '2026-09-20T00:00:01.000Z' && e.generation.sources.submissions.fetchedAt === '2026-09-20T00:00:02.000Z'" +
            " && doc.sources.price.status === 'not_loaded' && doc.sources.filings.status === 'not_loaded' && doc.authoredResearch.note === " + JSONObject.quote(note) + "; })()" +
            " && " + balanceSheetSnapshotExact("section[aria-labelledby=managed-prepared-report-heading]") + " && " + exact);
        String captured = readFixtureString("JSON.stringify(JSON.parse(document.querySelector('#managed-report-document').value).sources.annual)");
        assertOperatingCounts(1, 0, 0, 1);
        click(".managed-company-report > summary");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("failed refresh retains all totals, dates, sources and draft while invalidating old capture",
            exact + " && " + balanceSheetSourceExact() + " && " + DIAGNOSTICS + ".refreshFailed === 1" +
            " && document.querySelector('.managed-annual-report [role=alert]') !== null && document.querySelector('#managed-prepared-report-heading') === null");
        assertOperatingCounts(2, 0, 0, 1);
        JSONObject capturedAnnual = new JSONObject(captured);
        JSONObject capturedEvidence = capturedAnnual.getJSONObject("response").getJSONObject("evidence");
        assertEquals("Captured Annual clock remains the original load", "2026-09-20T00:00:02.000Z", capturedEvidence.getJSONObject("generation").getString("completedAt"));
        assertEquals("Captured parent equity remains its exact signed source value", "-200.125", capturedAnnual.getJSONObject("financials").getJSONObject("balanceSheet").getJSONObject("resolution").getJSONObject("shareholdersEquity").getString("value"));
        assertEquals("Captured prior assets retain the exact subtraction operand", "900.5", canonicalAnnualConceptRows(capturedEvidence, "Assets").getJSONObject(1).getString("value"));
        assertEquals("Captured older liability retains its own date and cannot fill the missing prior cell", "2023-09-30", canonicalAnnualConceptRows(capturedEvidence, "Liabilities").getJSONObject(1).getString("endDate"));
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("third explicit refresh holds without replacing any total", exact + " && " + DIAGNOSTICS + ".annual === 3 && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'");
        click(CATALOG_REFRESH);
        String retired = DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && document.querySelector('.managed-company-research') === null && document.querySelector('.sec-annual-balance-sheet') === null && document.querySelector('.managed-annual-balance-sheet-history') === null" +
            " && document.querySelector('.managed-annual-balance-sheet-change') === null" +
            " && document.querySelector('.managed-company-snapshot') === null && document.querySelector('#managed-prepared-report-heading') === null && document.querySelector('#managed-report-document') === null";
        awaitPage("aggregate expiry clears the report, all three totals and the watchlist draft", retired + " && " + DIAGNOSTICS + ".aborted === 1");
        click("#settle-cancelled-read");
        awaitPage("changed late totals cannot restore the retired company or authored text", retired + " && " + DIAGNOSTICS + ".lateResolved === 1" +
            " && !document.querySelector('.managed-frame').textContent.includes(" + JSONObject.quote(note) + ") && !document.querySelector('.managed-frame').textContent.includes('999.875')");
        assertOperatingCounts(3, 1, 1, 2);
        assertEquals("Balance-sheet journey preserves the original native document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private String balanceSheetExact(String draft) {
        return "(() => { const root = document.querySelector('.managed-annual-report .sec-annual-balance-sheet'), table = root?.querySelector(':scope > .sec-annual-balance-sheet-results');" +
            " const rows = [...(table?.querySelectorAll('tbody tr') || [])], labels = ['Total assets','Total liabilities','Shareholders’ equity · parent'], amounts = ['1000.125','1200.25','-200.125'];" +
            " return document.querySelectorAll('.managed-annual-report .sec-annual-balance-sheet').length === 1 && root.getAttribute('aria-label') === 'Annual balance sheet totals'" +
            " && root.querySelector('h4')?.textContent === 'Balance sheet totals' && table.querySelector('caption')?.textContent === 'Balances at 2025-12-31'" +
            " && rows.length === 3 && rows.every((row,i) => row.cells.length === 2 && row.querySelector('th')?.getAttribute('scope') === 'row'" +
            " && row.querySelector('th')?.textContent === labels[i] + 'Reported · USD' && row.querySelector('td > span')?.textContent === amounts[i]" +
            " && [...row.querySelectorAll('td > small')].map(e => e.textContent).join('|') === 'At 2025-12-31|Within current-use limits at this load.')" +
            " && root.textContent.includes('Parent equity excludes noncontrolling interests.') && !root.textContent.includes('999.875')" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(draft) + " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })() && " + balanceSheetHistoryExact();
    }

    private String balanceSheetSourceExact() {
        return "(() => { const source = document.querySelector('.managed-annual-report .sec-annual-balance-sheet-source'), groups = [...(source?.querySelectorAll(':scope > section') || [])];" +
            " const concepts = ['Assets','Liabilities','StockholdersEquity'], amounts = ['1000.125','1200.25','-200.125'], ids = [];" +
            " return groups.length === 3 && groups.every((group,i) => { const rows = [...group.querySelectorAll('ol > li > details')], row = rows[0];" +
            " const field = label => [...(row?.querySelectorAll('dl > div') || [])].find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent; const id = field('Observation identifier'); ids.push(id);" +
            " return rows.length === [3,2,3][i] && row.querySelector('summary')?.textContent === concepts[i] + ' · Source end 2025-12-31 · ' + amounts[i] + ' USD'" +
            " && field('Exact USD observation') === amounts[i] && field('Source end date') === '2025-12-31' && field('Source start date') === 'Not supplied'" +
            " && field('Source duration') === 'Not supplied; an instant balance requires no duration.' && field('Accession') === '0000000001-26-000001'" +
            " && field('Joined report / accepted time') === '2025-12-31 · 2026-02-01T00:00:00.000Z' && field('Company Facts source pointer') === '/facts/us-gaap/' + concepts[i] + '/units/USD/0'" +
            " && /^sec-fact:[a-f0-9]{64}$/.test(id) && [...group.querySelectorAll(':scope > p')].some(p => p.textContent === 'Value references: ' + id)" +
            " && row.querySelector('a')?.getAttribute('href') === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm'" +
            " && rows.every((item,j) => { const field = label => [...item.querySelectorAll('dl > div')].find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent;" +
            " return field('Source end date') === [['2025-12-31','2024-12-31','2023-09-30'],['2025-12-31','2023-09-30'],['2025-12-31','2024-12-31','2023-09-30']][i][j]" +
            " && field('Exact USD observation') === [['1000.125','900.5','800.875'],['1200.25','900'],['-200.125','0','-98.625']][i][j]" +
            " && field('Joined report / accepted time') === '2025-12-31 · 2026-02-01T00:00:00.000Z' && field('Accession') === '0000000001-26-000001'" +
            " && field('Company Facts source pointer') === '/facts/us-gaap/' + concepts[i] + '/units/USD/' + j && /^sec-fact:[a-f0-9]{64}$/.test(field('Observation identifier')); }); }) && new Set(ids).size === 3" +
            " && source.textContent.includes('Annual cutoff 2026-09-20T00:00:00.000Z') && source.textContent.includes('Company Facts captured 2026-09-20T00:00:01.000Z')" +
            " && source.textContent.includes('Submissions captured 2026-09-20T00:00:02.000Z') && source.textContent.includes('Completed 2026-09-20T00:00:02.000Z'); })()";
    }

    private String balanceSheetHistoryExact() {
        return "(() => { const history = document.querySelector('.managed-annual-report .managed-annual-balance-sheet-history'), table = history?.querySelector('.managed-balance-sheet-history-table');" +
            " const dates = ['2025-12-31','2024-12-31','2023-09-30'], labels = ['Total assets','Total liabilities','Shareholders’ equity · parent'];" +
            " const values = [['1000.125','900.5','800.875'],['1200.25','Unavailable. No reported amount at this date.','900'],['-200.125','0','-98.625']];" +
            " const heads = [...(table?.querySelectorAll('thead th time') || [])], rows = [...(table?.querySelectorAll('tbody tr') || [])];" +
            " const references = [...(history?.querySelectorAll('.managed-balance-sheet-history-references dl > div') || [])];" +
            " const source = [...document.querySelectorAll('.managed-annual-report .sec-annual-balance-sheet-source > section')];" +
            " return history?.querySelector(':scope > summary')?.textContent === 'Reported balance sheet history' && table.querySelector('caption')?.textContent === 'Reported balances · 3 dates · newest first'" +
            " && heads.length === 3 && heads.every((head,i) => head.textContent === dates[i] && head.getAttribute('datetime') === dates[i])" +
            " && rows.length === 3 && rows.every((row,i) => row.cells.length === 4 && row.cells[0].textContent === labels[i] + 'Reported · USD' && row.cells[0].getAttribute('scope') === 'row'" +
            " && [...row.querySelectorAll('td')].every((cell,j) => cell.textContent === values[i][j])) && references.length === 3" +
            " && references.every((group,i) => { const time = group.querySelector('dt time'), refs = [...group.querySelectorAll('dd > p')]; return time?.textContent === dates[i] && time.getAttribute('datetime') === dates[i]" +
            " && refs.length === 3 && refs.every((ref,j) => { const original = [...(source[j]?.querySelectorAll('ol > li > details') || [])].find(item => item.querySelector('summary')?.textContent.includes('Source end ' + dates[i]));" +
            " const id = [...(original?.querySelectorAll('dl > div') || [])].find(pair => pair.querySelector('dt')?.textContent === 'Observation identifier')?.querySelector('dd')?.textContent;" +
            " return ref.getAttribute('data-balance-history-references') === ['totalAssets','totalLiabilities','shareholdersEquity'][j] && ref.textContent === labels[j] + ': ' + (id || 'None'); }); })" +
            " && history.textContent.includes('Selected filing report date 2025-12-31') && history.textContent.includes('Earlier dates are historical comparatives in this filing, not current-use values.')" +
            " && history.textContent.includes('Original Annual cutoff 2026-09-20T00:00:00.000Z') && history.textContent.includes('Company Facts captured 2026-09-20T00:00:01.000Z')" +
            " && history.textContent.includes('Submissions captured 2026-09-20T00:00:02.000Z') && history.textContent.includes('Original load completed 2026-09-20T00:00:02.000Z')" +
            " && !history.textContent.includes('901.5'); })() && " + balanceSheetChangeExact();
    }

    private String balanceSheetChangeExact() {
        return "(() => { const history = document.querySelector('.managed-annual-report .managed-annual-balance-sheet-history'), change = history?.querySelector(':scope > .managed-annual-balance-sheet-change');" +
            " const rows = [...(change?.querySelectorAll(':scope > dl > div') || [])], times = [...(change?.querySelectorAll(':scope > p:first-of-type time') || [])];" +
            " const keys = ['totalAssets','totalLiabilities','shareholdersEquity'], labels = ['Total assets change','Total liabilities change','Parent equity change'];" +
            " const values = ['99.625','Unavailable. Prior amount: No reported amount at this date.','-200.125'];" +
            " return history.querySelectorAll('.managed-annual-balance-sheet-change').length === 1 && change.getAttribute('aria-label') === 'Reported balance sheet change'" +
            " && change.querySelector(':scope > h6')?.textContent === 'Reported balance sheet change' && times.length === 2" +
            " && times.every((time,i) => time.textContent === ['2024-12-31','2025-12-31'][i] && time.getAttribute('datetime') === time.textContent)" +
            " && rows.length === 3 && rows.every((row,i) => row.getAttribute('data-balance-change') === keys[i]" +
            " && row.querySelector('dt')?.textContent === labels[i] + ' · USDApp calculation' && row.querySelector('dd')?.textContent === values[i]" +
            " && (i === 1 ? row.querySelector('.managed-annual-unavailable') !== null && row.querySelector('.managed-balance-sheet-change-amount') === null : row.querySelector('.managed-balance-sheet-change-amount')?.textContent === values[i]))" +
            " && change.textContent.includes('Current minus prior, using the first two displayed dates.')" +
            " && change.textContent.includes('Older dates do not replace missing or refused inputs.')" +
            " && !change.textContent.includes('2023-09-30') && !change.textContent.includes('300.25')" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
    }

    private String balanceSheetSnapshotExact(String container) {
        return "(() => { const root = document.querySelector(" + JSONObject.quote(container) + ")?.querySelector('[aria-label=\"Snapshot balance sheet totals\"]');" +
            " const rows = [...(root?.querySelectorAll('dl > div') || [])], labels = ['Total assets · USD','Total liabilities · USD','Shareholders’ equity · parent · USD'], amounts = ['1000.125','1200.25','-200.125'];" +
            " return rows.length === 3 && rows.every((row,i) => row.querySelector('dt')?.textContent === labels[i] && row.querySelector('dd > span')?.textContent === amounts[i]" +
            " && [...row.querySelectorAll('dd > small')].map(e => e.textContent).join('|') === 'At 2025-12-31|Within current-use limits at this load.') && root.textContent.includes('Parent equity excludes noncontrolling interests.'); })()";
    }

    @Test
    public void annualLiquidityHistoryRetainsDatesAndRefusals() throws Exception {
        double origin = readDocumentTimeOrigin();
        String note = "Liquidity history thesis · Café 東京 📈";
        awaitPage("liquidity-history startup performs no financial read", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("liquidity draft retains exact listing order", DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'");
        typeIntoInput("managed-note-1", NOTE);
        click(ANNUAL);
        awaitPage("liquidity history waits for explicit Annual load", "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE) + " && document.querySelector('.managed-annual-liquidity-history') === null");
        replaceReportNoteWithNativeIme(NOTE, note);
        String draft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        assertOperatingCounts(0, 0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        String history = ".managed-annual-liquidity-history";
        String table = history + " .managed-liquidity-history-table";
        String exact = liquidityHistoryExact(false, draft);
        awaitPage("reported dates start closed with exact raw balances and per-cell refusals", exact +
            " && document.querySelector('.managed-annual-liquidity-history')?.open === false && document.querySelector('.managed-liquidity-history-references')?.open === false");
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native Space opens reported liquidity dates", exact + " && document.querySelector('.managed-annual-liquidity-history').open");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_TAB));
        awaitPage("native Tab focuses the contained liquidity table",
            "(() => { const table = document.querySelector('.managed-liquidity-history-table'); const r = table?.getBoundingClientRect(), v = visualViewport;" +
            " return table && document.activeElement === table && getComputedStyle(table).outlineStyle !== 'none' && parseFloat(getComputedStyle(table).outlineWidth) >= 2" +
            " && table.scrollWidth > table.clientWidth && getComputedStyle(table).overflowX === 'auto' && v && v.width <= 600" +
            " && r.width > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_DPAD_RIGHT));
        awaitPage("native Right scrolls only liquidity history", exact + " && document.querySelector('.managed-liquidity-history-table').scrollLeft > 0 && document.activeElement === document.querySelector('.managed-liquidity-history-table')");
        retainAnnualNoteFrame("liquidityHistoryLoaded", table + " thead th:nth-child(2)", table + " thead th:nth-child(2), " + table + " tbody td:nth-of-type(1)", 5);
        focusCashHistoryControl(history + " .managed-liquidity-history-references > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("each reported balance date retains all exact original source references and filing report date",
            "(() => { const refs = document.querySelector('.managed-liquidity-history-references'), source = document.querySelector('.sec-annual-liquidity-source'); const entries = [...refs.querySelectorAll('dl > div')];" +
            " const dates = ['2025-12-31','2024-12-28','2023-12-30']; const ids = []; return refs.open && entries.length === 3 && entries.every((entry,i) => {" +
            " const observations = [...source.querySelectorAll(':scope > section > ol > li > details')].filter(d => d.querySelector('summary')?.textContent.includes('Source end ' + dates[i] + ' ·'));" +
            " const field = (d,label) => [...d.querySelectorAll('dl > div')].find(p => p.querySelector('dt')?.textContent === label)?.querySelector('dd')?.textContent; const found = observations.map(d => field(d,'Observation identifier')); ids.push(...found);" +
            " return entry.querySelector('time')?.dateTime === dates[i] && entry.querySelector('time')?.textContent === dates[i] && found.length === 2 && found.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id))" +
            " && entry.querySelector('dd')?.textContent.split(' · ').sort().join('|') === found.sort().join('|')" +
            " && observations.every(d => field(d,'Accession') === '0000000001-26-000001' && field(d,'Joined report / accepted time') === '2025-12-31 · 2026-02-01T00:00:00.000Z'); }) && new Set(ids).size === 6; })()");
        assertOperatingCounts(1, 0, 0, 1);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("full report captures every liquidity comparative row and original metadata without another load",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field) return false; const doc = JSON.parse(field.value), e = doc.sources.annual.response.evidence; const assets = e.facts.observations.filter(row => row.concept === 'AssetsCurrent'), liabilities = e.facts.observations.filter(row => row.concept === 'LiabilitiesCurrent');" +
            " return doc.authoredResearch.note === " + JSONObject.quote(note) + " && e.facts.observations.filter(row => ['Revenues','SalesRevenueNet','RevenueFromContractWithCustomerExcludingAssessedTax','NetIncomeLoss'].includes(row.concept)).length === 0" +
            " && assets.map(row => row.endDate + '|' + row.value).join(';') === '2025-12-31|120.125;2024-12-28|-5;2023-12-30|0'" +
            " && liabilities.map(row => row.endDate + '|' + row.value).join(';') === '2025-12-31|180.025;2024-12-28|2;2023-12-30|0'" +
            " && [...assets,...liabilities].every(row => row.filing.reportDate === '2025-12-31' && row.accessionNumber === '0000000001-26-000001')" +
            " && e.generation.cutoffAt === '2026-09-20T00:00:00.000Z' && e.generation.completedAt === '2026-09-20T00:00:02.000Z'" +
            " && e.generation.sources.companyFacts.fetchedAt === '2026-09-20T00:00:01.000Z' && e.generation.sources.submissions.fetchedAt === '2026-09-20T00:00:02.000Z'" +
            " && doc.sources.price.status === 'not_loaded' && doc.sources.filings.status === 'not_loaded'; })()");
        String captured = readFixtureString("JSON.stringify(JSON.parse(document.querySelector('#managed-report-document').value).sources.annual.response)");
        click(".managed-company-report > summary");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("failed refresh retains exact reported dates, cell refusals, original clocks and Unicode draft", exact + " && " + DIAGNOSTICS + ".refreshFailed === 1");
        assertOperatingCounts(2, 0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("third liquidity-history read is held", DIAGNOSTICS + ".annual === 3");
        click(".managed-annual-report .trial-actions button:nth-child(2)");
        click("#settle-cancelled-read");
        awaitPage("Cancel fences changed late balances while retaining every original refusal", exact + " && " + DIAGNOSTICS + ".lateResolved === 1");
        assertOperatingCounts(3, 1, 1, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("replacement stops at the actual missing side without borrowing older balances", liquidityHistoryExact(true, draft));
        awaitPage("replacement preserves the blocked and older complete source rows",
            "(() => { const source = document.querySelector('.sec-annual-liquidity-source'); return source?.textContent.includes('AssetsCurrent · Source end 2024-06-29 · 25 USD') && !source.textContent.includes('LiabilitiesCurrent · Source end 2024-06-29')" +
            " && source.textContent.includes('AssetsCurrent · Source end 2023-12-30 · 500 USD') && source.textContent.includes('LiabilitiesCurrent · Source end 2023-12-30 · 100 USD'); })()");
        assertOperatingCounts(4, 1, 1, 1);
        JSONObject capturedEvidence = new JSONObject(captured).getJSONObject("evidence");
        assertEquals("Captured report retains its initial clock after live replacement", "2026-09-20T00:00:02.000Z", capturedEvidence.getJSONObject("generation").getString("completedAt"));
        assertEquals("Captured report retains all initial asset dates", 3, canonicalAnnualConceptRows(capturedEvidence, "AssetsCurrent").length());
        assertEquals("Captured report retains its original first raw balance", "120.125", canonicalAnnualConceptRows(capturedEvidence, "AssetsCurrent").getJSONObject(0).getString("value"));
        click(".managed-company-visit .trial-toolbar > button");
        awaitPage("leaving clears loaded liquidity history while restoring the exact unsaved draft and Annual opener",
            "document.querySelector('.managed-company-visit') === null && document.querySelector('.managed-annual-liquidity-history') === null && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(draft) + " && document.activeElement === document.querySelector(" + JSONObject.quote(ANNUAL) + ")");
        click(ANNUAL);
        awaitPage("reopening starts a new unloaded liquidity visit without another read", "document.querySelector('#managed-annual-heading') !== null && document.querySelector('.managed-annual-liquidity-history') === null && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(note));
        assertOperatingCounts(4, 1, 1, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("fifth liquidity-history read is held before session expiry", DIAGNOSTICS + ".annual === 5");
        click(CATALOG_REFRESH);
        awaitPage("expiry retires the whole draft and all history before late completion", DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && document.querySelector('.managed-company-research') === null && document.querySelector('.managed-annual-liquidity-history') === null && " + DIAGNOSTICS + ".aborted === 2");
        click("#settle-cancelled-read");
        awaitPage("retired late balances cannot restore history or authored Unicode prose", DIAGNOSTICS + ".lateResolved === 2 && document.querySelector('.managed-annual-liquidity-history') === null && !document.querySelector('.managed-frame').textContent.includes(" + JSONObject.quote(note) + ")");
        assertOperatingCounts(5, 2, 2, 2);
        awaitPage("only the one explicit failure occurred", DIAGNOSTICS + ".refreshFailed === 1");
        assertEquals("Liquidity lifetime preserves the original document", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private String liquidityHistoryExact(boolean replacement, String draft) {
        String sign = "Unavailable. This calculation requires nonnegative reported balances.";
        String zero = "Unavailable. Current ratio requires current liabilities greater than zero.";
        String values = replacement ? "Current assetsReported · USD|200.125|60;Current liabilitiesReported · USD|100|0;Working capitalApp calculation · USD|100.125|60;Current ratioApp calculation · multiple|2.00×|" + zero :
            "Current assetsReported · USD|120.125|-5|0;Current liabilitiesReported · USD|180.025|2|0;Working capitalApp calculation · USD|-59.9|" + sign + "|0;Current ratioApp calculation · multiple|0.67×|" + sign + "|" + zero;
        String dates = replacement ? "2025-12-31|2024-12-28" : "2025-12-31|2024-12-28|2023-12-30";
        String day = replacement ? "2026-09-21" : "2026-09-20";
        return "(() => { const history = document.querySelector('.managed-annual-liquidity-history'), table = history?.querySelector('.managed-liquidity-history-table'); const dates = " + JSONObject.quote(dates) + ";" +
            " const rows = [...(table?.querySelectorAll('tbody tr') || [])]; const stopped = history?.querySelector(':scope > p.managed-annual-unavailable');" +
            " return document.querySelectorAll('.managed-annual-liquidity-history').length === 1 && history.querySelector(':scope > summary')?.textContent === 'Reported liquidity history'" +
            " && table?.getAttribute('role') === 'region' && table.tabIndex === 0 && table.getAttribute('aria-label') === 'Reported liquidity history balances'" +
            " && table.querySelector('caption')?.textContent === 'Reported balances · " + (replacement ? "2" : "3") + " dates · newest first'" +
            " && [...table.querySelectorAll('thead th[scope=col]')].slice(1).map(th => th.querySelector('time')?.dateTime).join('|') === dates" +
            " && [...table.querySelectorAll('thead th[scope=col]')].slice(1).map(th => th.querySelector('time')?.textContent).join('|') === dates" +
            " && rows.length === 4 && rows.every(row => row.cells.length === " + (replacement ? "3" : "4") + ") && rows.map(row => [...row.cells].map(c => c.textContent).join('|')).join(';') === " + JSONObject.quote(values) +
            " && " + (replacement ? "stopped?.textContent === 'History stops at reported balance date 2024-06-29. One or both reported balances are missing at the required date. Older dates are not substituted.' && !history.textContent.includes('2023-12-30')" : "!stopped") +
            " && history.textContent.includes('filing 0000000001-26-000001') && history.textContent.includes('Selected filing report date 2025-12-31') && history.textContent.includes('These dates need not be consecutive fiscal year-ends.')" +
            " && history.textContent.includes('Original Annual cutoff " + day + "T00:00:00.000Z') && history.textContent.includes('Company Facts captured " + day + "T00:00:01.000Z')" +
            " && history.textContent.includes('Submissions captured " + day + "T00:00:02.000Z') && history.textContent.includes('Original load completed " + day + "T00:00:02.000Z')" +
            " && !history.textContent.includes('999.875') && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(draft) +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
    }

    @Test
    public void annualOperatingHistoryRetainsReplacesAndRetiresExactPeriods() throws Exception {
        double origin = readDocumentTimeOrigin();
        awaitPage("operating-history startup performs no financial read", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Operating history draft");
        String draft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        click(ANNUAL);
        awaitPage("operating history waits for explicit Annual load", "document.querySelector('.managed-annual-operating-history') === null && document.querySelector('.managed-annual-operating-change') === null && document.querySelector('#managed-research-note')?.value === 'Operating history draft'");
        assertAnnualNoteCounts(0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        String history = "[aria-label='Reported operating history Revenues']";
        String table = history + " .managed-operating-history-table";
        String exact = operatingHistoryExact(false, draft);
        awaitPage("three named histories start closed with exact independent comparative rows", exact +
            " && [...document.querySelectorAll('.managed-annual-operating-history')].every(d => !d.open)");
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native Space opens only the requested basis history", exact +
            " && document.querySelector(\"" + history + "\").open && [...document.querySelectorAll('.managed-annual-operating-history')].filter(d => d.open).length === 1");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_TAB));
        awaitPage("native Tab reaches a contained keyboard-scrollable operating table",
            "(() => { const table = document.querySelector(\"" + table + "\"); const r = table?.getBoundingClientRect(), v = visualViewport;" +
            " return table && document.activeElement === table && getComputedStyle(table).outlineStyle !== 'none' && parseFloat(getComputedStyle(table).outlineWidth) >= 2" +
            " && table.scrollWidth > table.clientWidth && getComputedStyle(table).overflowX === 'auto' && v && v.width <= 600" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_DPAD_RIGHT));
        awaitPage("native Right scrolls only the operating table", exact + " && document.querySelector(\"" + table + "\").scrollLeft > 0");
        retainAnnualNoteFrame("operatingHistoryLoaded", table + " thead th:nth-child(2)", table + " thead th:nth-child(2), " + table + " tbody td:nth-of-type(1)", 4);
        String change = history + " .managed-annual-operating-change";
        retainAnnualNoteFrame("operatingHistoryChange", change + " > h6", change + " > h6, " + change + " > dl", 2);
        focusCashHistoryControl(history + " .managed-operating-history-references > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("each history period retains the complete original operating and revenue references",
            "(() => { const entries = [...document.querySelectorAll(\"" + history + " .managed-operating-history-references dl > div\")]; const source = document.querySelector('.sec-annual-operating-source');" +
            " const periods = ['2025-01-01 to 2025-12-31','2024-01-01 to 2024-12-31','2023-01-01 to 2023-12-31']; const ids = [];" +
            " return entries.length === 3 && entries.every((entry,i) => { const found = [...source.querySelectorAll('ol > li > details')].filter(d => { const text = d.querySelector('summary')?.textContent; return text?.includes(periods[i]) && (text.startsWith('OperatingIncomeLoss ·') || text.startsWith('Revenues ·')); }).map(d => [...d.querySelectorAll('dl > div')].find(p => p.querySelector('dt')?.textContent === 'Observation identifier')?.querySelector('dd')?.textContent);" +
            " ids.push(...found); return found.length === 2 && found.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id)) && entry.querySelector('dt')?.textContent === periods[i] && entry.querySelector('dd')?.textContent.split(' · ').sort().join('|') === found.sort().join('|'); }) && new Set(ids).size === 6; })()");
        assertAnnualNoteCounts(1, 0, 1);
        click(".managed-company-report > summary");
        click(".managed-company-report .trial-actions button:first-child");
        click(".managed-report-document > summary");
        awaitPage("prepared report serializes every comparative row and original clock without reading",
            "(() => { const field = document.querySelector('#managed-report-document'); if (!field) return false; const doc = JSON.parse(field.value), evidence = doc.sources.annual.response.evidence;" +
            " return evidence.facts.observations.filter(row => row.concept === 'OperatingIncomeLoss').length === 3 && evidence.facts.observations.filter(row => row.concept !== 'OperatingIncomeLoss').length === 6 && evidence.facts.observations.filter(row => row.concept !== 'OperatingIncomeLoss').every(row => ['Revenues','SalesRevenueNet','RevenueFromContractWithCustomerExcludingAssessedTax'].includes(row.concept))" +
            " && evidence.facts.observations.filter(row => row.concept === 'OperatingIncomeLoss').map(row => row.endDate).join('|') === '2025-12-31|2024-12-31|2023-12-31'" +
            " && evidence.generation.completedAt === '2026-09-20T00:00:02.000Z' && doc.sources.price.status === 'not_loaded' && doc.sources.filings.status === 'not_loaded'; })()");
        click(".managed-company-report > summary");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("failed refresh retains every original history and draft", exact + " && " + DIAGNOSTICS + ".annual === 2 && " + DIAGNOSTICS + ".refreshFailed === 1");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("third operating-history read is held", DIAGNOSTICS + ".annual === 3");
        click(".managed-annual-report .trial-actions button:nth-child(2)");
        click("#settle-cancelled-read");
        awaitPage("Cancel fences the changed late history packet", exact + " && " + DIAGNOSTICS + ".aborted === 1 && " + DIAGNOSTICS + ".lateResolved === 1");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("successful replacement uses only the new two-period packet and original replacement clock", operatingHistoryExact(true, draft) + " && " + DIAGNOSTICS + ".annual === 4");
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("fifth operating-history read is held before expiry", DIAGNOSTICS + ".annual === 5");
        click(CATALOG_REFRESH);
        awaitPage("expiry removes all histories and retires the unsaved draft", DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null && document.querySelector('.managed-annual-operating-history') === null && document.querySelector('.managed-annual-operating-change') === null && document.querySelector('.managed-company-research') === null && " + DIAGNOSTICS + ".aborted === 2");
        click("#settle-cancelled-read");
        awaitPage("retired late history cannot restore evidence or authored prose", DIAGNOSTICS + ".lateResolved === 2 && document.querySelector('.managed-annual-operating-history') === null && document.querySelector('.managed-annual-operating-change') === null && !document.querySelector('.managed-frame').textContent.includes('Operating history draft')");
        awaitPage("history made only explicit reads and no persistence calls",
            DIAGNOSTICS + ".annual === 5 && " + DIAGNOSTICS + ".aborted === 2 && " + DIAGNOSTICS + ".lateResolved === 2 && " + DIAGNOSTICS + ".refreshFailed === 1" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 2 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0" +
            " && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
        assertEquals(origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private String operatingHistoryExact(boolean replacement, String draft) {
        String values = replacement ? "Operating income · USDReported|125.25|0;Revenue · USDReported|750|600;Operating margin · %App calculation|16.7%|0%" : "Operating income · USDReported|-250.125|0|80.125;Revenue · USDReported|1000|800|640;Operating margin · %App calculation|-25.01%|0%|12.52%";
        String periods = replacement ? "2025-01-01 to 2025-12-31|2024-01-01 to 2024-12-31" : "2025-01-01 to 2025-12-31|2024-01-01 to 2024-12-31|2023-01-01 to 2023-12-31";
        return "(() => { const histories = [...document.querySelectorAll('.managed-annual-operating-history')]; const history = document.querySelector('[aria-label=\"Reported operating history Revenues\"]'); const table = history?.querySelector('.managed-operating-history-table');" +
            " const expectedCounts = [['Revenues'," + (replacement ? "2" : "3") + "],['SalesRevenueNet',2],['RevenueFromContractWithCustomerExcludingAssessedTax',1]];" +
            " return histories.length === 3 && expectedCounts.every(([concept,count]) => histories.filter(d => d.getAttribute('aria-label') === 'Reported operating history ' + concept && d.querySelectorAll('thead th[scope=col]').length === count + 1).length === 1)" +
            " && table?.querySelector('caption')?.textContent === 'Revenue · " + (replacement ? "2" : "3") + " periods · newest first'" +
            " && [...table.querySelectorAll('thead th')].slice(1).map(th => [...th.querySelectorAll('time')].map(t => t.dateTime).join(' to ')).join('|') === " + JSONObject.quote(periods) +
            " && [...table.querySelectorAll('tbody tr')].map(row => [...row.cells].map(c => c.textContent).join('|')).join(';') === " + JSONObject.quote(values) +
            " && history.textContent.includes('filing 0000000001-26-000001') && history.textContent.includes('Original load completed " + (replacement ? "2026-09-21" : "2026-09-20") + "T00:00:02.000Z')" +
            " && !history.textContent.includes('999.875') && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(draft) +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()" + " && " + operatingChangeExact(replacement);
    }

    private String operatingChangeExact(boolean replacement) {
        String income = replacement ? "125.25" : "-250.125";
        String revenuePoints = replacement ? "16.7 percentage points" : "-25.01 percentage points";
        String salesPoints = replacement ? "15.66 percentage points" : "-31.27 percentage points";
        String day = replacement ? "2026-09-21" : "2026-09-20";
        return "(() => { const changes = [...document.querySelectorAll('.managed-annual-operating-change')];" +
            " const expected = [['Revenues'," + JSONObject.quote(revenuePoints) + "],['SalesRevenueNet'," + JSONObject.quote(salesPoints) + "]];" +
            " return changes.length === 3 && expected.every(([concept,points]) => { const history = document.querySelector('[aria-label=\"Reported operating history ' + concept + '\"]');" +
            " const change = history?.querySelector(':scope > .managed-annual-operating-change'); const groups = [...(change?.querySelectorAll(':scope > dl > div') ?? [])];" +
            " return change?.getAttribute('aria-label') === 'Reported operating change ' + concept && change.querySelector(':scope > h6')?.textContent === 'Reported operating change'" +
            " && groups.length === 2 && groups.map(g => g.querySelector('dt')?.textContent).join('|') === 'Operating income change · USDApp calculation|Operating margin change · percentage pointsApp calculation'" +
            " && groups.map(g => g.querySelector('dd')?.textContent).join('|') === " + JSONObject.quote(income + "|") + " + points" +
            " && [...change.querySelectorAll('time')].map(t => t.dateTime + ':' + t.textContent).join('|') === '2024-01-01:2024-01-01|2024-12-31:2024-12-31|2025-01-01:2025-01-01|2025-12-31:2025-12-31'" +
            " && change.textContent.includes('Same filing 0000000001-26-000001') && change.textContent.includes('Original load completed " + day + "T00:00:02.000Z')" +
            " && change.textContent.includes('unrounded operating-income-to-revenue ratios') && change.textContent.includes('History calculation references below')" +
            " && change.querySelectorAll('button,input,select,textarea,details,summary').length === 0; })" +
            " && (() => { const refused = document.querySelector('[aria-label=\"Reported operating change RevenueFromContractWithCustomerExcludingAssessedTax\"]');" +
            " return refused?.querySelector('dl') === null && refused?.querySelector('.managed-annual-unavailable')?.textContent === 'Operating change unavailable. The immediately preceding operating-income and selected-revenue pair is unavailable. One or both operating inputs are missing for the required annual period. Older periods are not substituted.'; })()" +
            " && changes.every(c => !c.textContent.includes('999.875')); })()";
    }

    @Test
    public void annualCashHistoryKeepsExactPeriodsAndRetiresWithSession() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        awaitPage("cash-history startup admits no source read", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Annual research draft");
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        click(ANNUAL);
        awaitPage("cash history waits for the explicit Annual load",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-annual-cash-history') === null" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        assertAnnualNoteCounts(0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        String history = ".managed-annual-cash-history";
        String region = ".managed-cash-history-table";
        String references = ".managed-cash-history-references";
        String exact =
            "(() => { const history = document.querySelector('.managed-annual-cash-history');" +
            " const region = history?.querySelector('.managed-cash-history-table');" +
            " const rows = [...(region?.querySelectorAll('tbody tr') || [])];" +
            " const expected = ['Operating cash flowReported|120.125|-50|500', 'PP&E purchasesReported|20.025|0|750', 'Operating cash flow less PP&E purchasesApp calculation|100.1|-50|-250'];" +
            " return history?.querySelector(':scope > summary')?.textContent === 'Reported cash history'" +
            " && region?.getAttribute('role') === 'region' && region.tabIndex === 0" +
            " && region.getAttribute('aria-label') === 'Reported cash history amounts'" +
            " && region.querySelector('caption')?.textContent === 'Annual cash amounts · 3 periods · newest first'" +
            " && [...region.querySelectorAll('thead th[scope=col]')].slice(1).map(th => [...th.querySelectorAll('time')].map(t => t.dateTime).join(' to ')).join('|') === '2025-01-01 to 2025-12-31|2024-01-01 to 2024-12-31|2023-01-01 to 2023-12-31'" +
            " && rows.length === 3 && rows.every((row, i) => [...row.cells].map(cell => cell.textContent).join('|') === expected[i])" +
            " && [...document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values .sec-annual-cash-amount')].map(e => e.textContent).join(',') === '120.125,20.025,100.1'" +
            " && [...document.querySelectorAll('section[aria-label=\"Annual revenue basis Revenues\"] .managed-annual-values tbody td')].map(e => e.textContent).join(',') === '1000,800,640,100,-80,32,10%,-10%,5%'" +
            " && history.textContent.includes('Original load completed 2026-09-20T00:00:02.000Z.')" +
            " && history.textContent.includes('Earlier periods are historical comparatives in this filing.')" +
            " && history.textContent.includes('Period lengths, accounting changes and restatements are unadjusted.')" +
            " && document.querySelector('.sec-annual-cash-source > p:first-of-type')?.textContent === 'Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
            " && JSON.parse(document.querySelector('#fixture-report-generations').textContent).initial.cutoffAt === '2026-09-20T00:00:00.000Z'" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft) + "; })()";
        awaitPage("cash history starts closed with exact independent same-filing amounts", exact +
            " && document.querySelector('.managed-annual-cash-history')?.open === false" +
            " && document.querySelector('.managed-cash-history-references')?.open === false");
        awaitPage("closed cash history has no mounted trend canvas", exact +
            " && document.querySelector('.managed-annual-cash-trend .managed-annual-trend-canvas') === null" +
            " && document.querySelector('[data-cash-trend-metric]')?.value === 'operatingCashFlow'");
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("native Space opens the focused history disclosure", exact +
            " && document.querySelector('.managed-annual-cash-history')?.open === true" +
            " && document.activeElement === document.querySelector('.managed-annual-cash-history > summary')");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_TAB));
        assertAnnualCashTrendChoices(exact);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_TAB));
        awaitPage("native Tab reaches the contained cash table with a visible focus outline",
            "(() => { const table = document.querySelector('.managed-cash-history-table'); const r = table?.getBoundingClientRect(), v = visualViewport;" +
            " return table && document.activeElement === table && getComputedStyle(table).outlineStyle !== 'none'" +
            " && parseFloat(getComputedStyle(table).outlineWidth) >= 2 && table.scrollWidth > table.clientWidth" +
            " && getComputedStyle(table).overflowX === 'auto' && v && v.width <= 600 && r.width > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; })()");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_DPAD_RIGHT));
        awaitPage("native Right scrolls only the focused cash table", exact +
            " && document.querySelector('.managed-cash-history-table').scrollLeft > 0" +
            " && document.activeElement === document.querySelector('.managed-cash-history-table')" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1");
        retainAnnualNoteFrame("cashHistoryLoaded", region + " thead th:nth-child(2)",
            region + " thead th:nth-child(2), " + region + " tbody td:nth-of-type(1)", 4);
        awaitPage("capture retains the exact data, draft and table focus", exact +
            " && document.activeElement === document.querySelector('.managed-cash-history-table')");
        focusCashHistoryControl(references + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("history references match both original cash observations for every exact period",
            "(() => { const refs = document.querySelector('.managed-cash-history-references');" +
            " const source = document.querySelector('.sec-annual-cash-source');" +
            " const periods = ['2025-01-01 to 2025-12-31', '2024-01-01 to 2024-12-31', '2023-01-01 to 2023-12-31'];" +
            " const entries = [...refs.querySelectorAll('dl > div')]; const ids = [];" +
            " return refs.open && document.activeElement === refs.querySelector('summary') && entries.length === 3" +
            " && entries.every((entry, i) => { const expected = [...source.querySelectorAll(':scope > section')].map(section => {" +
            " const observation = [...section.querySelectorAll('ol > li > details')].find(d => d.querySelector('summary').textContent.includes(periods[i]));" +
            " return observation?.querySelectorAll('dd')[9]?.textContent; }); ids.push(...expected);" +
            " return entry.querySelector('dt')?.textContent === periods[i] && expected.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id))" +
            " && entry.querySelector('dd')?.textContent === expected.join(' · '); }) && new Set(ids).size === 6" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; })()");
        assertAnnualNoteCounts(1, 0, 1);
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        // A closed details subtree can retain its last layout bounds. Check rendering
        // and native keyboard exclusion instead of treating cached height as visibility.
        awaitPage("closing history hides its table while preserving the same evidence and note", exact +
            " && document.querySelector('.managed-annual-cash-history')?.open === false" +
            " && document.querySelector('.managed-cash-history-table').checkVisibility() === false" +
            " && document.activeElement === document.querySelector('.managed-annual-cash-history > summary')");
        awaitPage("closing cash history disposes the canvas and retains the selected calculation", exact +
            " && document.querySelector('.managed-annual-cash-trend .managed-annual-trend-canvas') === null" +
            " && document.querySelector('[data-cash-trend-metric]')?.value === 'operatingCashFlowLessPpePurchases'");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_TAB));
        awaitPage("native Tab skips the closed history table and its nested references", exact +
            " && document.querySelector('.managed-annual-cash-history')?.open === false" +
            " && document.activeElement === document.querySelector('.sec-annual-cash-source > summary')");
        focusCashHistoryControl(history + " > summary");
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
        awaitPage("reopening history uses the same single Annual result", exact +
            " && document.querySelector('.managed-annual-cash-history')?.open === true" +
            " && document.querySelector('.managed-cash-history-table').checkVisibility() === true");
        assertAnnualNoteCounts(1, 0, 1);
        assertAnnualCashTrendMetric(exact, "operatingCashFlowLessPpePurchases", "Operating cash flow less PP&E purchases", "App calculation", 2, "-250|-50|100.1");
        awaitPage("history adds no other source reads or persistence",
            DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0");
        click(CATALOG_REFRESH);
        awaitPage("normal status expiry removes the loaded history and retires the whole draft",
            DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && document.querySelector('.managed-annual-cash-history') === null" +
            " && document.querySelector('.managed-cash-history-references') === null" +
            " && document.querySelector('.managed-company-research') === null" +
            " && document.querySelector('.managed-navigation') === null" +
            " && " + DIAGNOSTICS + ".status === 2 && " + DIAGNOSTICS + ".annual === 1" +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".save === 0" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0");
        awaitPage("session retirement removes cash trend controls and mounted canvas",
            "document.querySelector('.managed-annual-cash-trend') === null" +
            " && document.querySelector('[data-cash-trend-metric]') === null" +
            " && document.querySelector('[data-cash-trend-selected-metric]') === null" +
            " && document.querySelector('.managed-annual-cash-trend .managed-annual-trend-canvas') === null");
        assertEquals(documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
    }

    private void assertAnnualCashTrendChoices(String exact) throws Exception {
        String picker = "[data-cash-trend-metric]";
        awaitPage("native Tab reaches the labelled cash trend metric with visible focus", exact +
            " && (() => { const select = document.querySelector('[data-cash-trend-metric]'); const r = select?.getBoundingClientRect(), v = visualViewport;" +
            " return select instanceof HTMLSelectElement && !select.disabled && select.value === 'operatingCashFlow'" +
            " && document.activeElement === select && select.labels.length === 1 && select.labels[0].querySelector('span')?.textContent === 'Cash trend metric'" +
            " && Array.from(select.options).map(o => o.value).join('|') === 'operatingCashFlow|ppePurchases|operatingCashFlowLessPpePurchases'" +
            " && Array.from(select.options).map(o => o.textContent).join('|') === 'Operating cash flow|PP&E purchases|Operating cash flow less PP&E purchases'" +
            " && getComputedStyle(select).outlineStyle !== 'none' && parseFloat(getComputedStyle(select).outlineWidth) >= 2" +
            " && v && r.height >= 44 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; })()");
        chooseNativeSelectOption(picker, "operatingCashFlow", "Operating cash flow");
        assertAnnualCashTrendMetric(exact, "operatingCashFlow", "Operating cash flow", "Reported", 0, "500|-50|120.125");
        chooseNativeSelectOption(picker, "ppePurchases", "PP&E purchases");
        assertAnnualCashTrendMetric(exact, "ppePurchases", "PP&E purchases", "Reported", 1, "750|0|20.025");
        chooseNativeSelectOption(picker, "operatingCashFlowLessPpePurchases", "Operating cash flow less PP&E purchases");
        assertAnnualCashTrendMetric(exact, "operatingCashFlowLessPpePurchases", "Operating cash flow less PP&E purchases", "App calculation", 2, "-250|-50|100.1");
        retainAnnualNoteFrame("cashTrendCalculated", "[data-cash-trend-selected-metric]",
            "[data-cash-trend-selected-metric], .managed-annual-cash-trend .managed-annual-trend-canvas canvas", 2);
        focusCashHistoryControl(picker);
    }

    private void assertAnnualCashTrendMetric(String exact, String metric, String label, String basis, int row, String values) throws Exception {
        awaitPage("cash trend preserves the exact selected metric, original periods and source: " + metric, exact +
            " && (() => { const trend = document.querySelector('.managed-annual-cash-trend');" +
            " const select = trend?.querySelector('[data-cash-trend-metric]'), selected = trend?.querySelector('[data-cash-trend-selected-metric]');" +
            " const chart = trend?.querySelector('.managed-annual-trend-canvas'), canvas = chart?.querySelector('canvas');" +
            " const rows = document.querySelectorAll('.managed-cash-history-table tbody tr');" +
            " return document.querySelector('.managed-annual-cash-history')?.open === true" +
            " && select?.value === " + JSONObject.quote(metric) + " && !select.disabled" +
            " && selected?.textContent === " + JSONObject.quote("Selected metric: " + label + " · " + basis) +
            " && selected.id && select.getAttribute('aria-describedby')?.split(' ').includes(selected.id)" +
            " && chart?.getAttribute('role') === 'img' && chart.getAttribute('aria-label') === " + JSONObject.quote(label + " in USD across 3 reported annual periods from one filing, oldest to newest. Negative amounts extend below zero; known zero has zero height. Exact amounts and dates remain in the table below.") +
            " && trend.querySelectorAll('canvas').length === 1 && canvas.width > 0 && canvas.height > 0 && canvas.checkVisibility()" +
            " && Array.from(rows[" + row + "].querySelectorAll('td')).reverse().map(e => e.textContent).join('|') === " + JSONObject.quote(values) +
            " && trend.querySelector('.managed-annual-basis-help')?.textContent === 'Same-filing amounts in USD, oldest to newest. Chart coordinates are approximate; exact amounts and dates remain in the table below.'" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; })()");
        assertAnnualNoteCounts(1, 0, 1);
    }


    private void focusCashHistoryControl(String selector) throws Exception {
        CountDownLatch focused = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            assertTrue("Cash-history WebView must accept focus", webView.requestFocus());
            webView.evaluateJavascript("(() => { const target = document.querySelector(" + JSONObject.quote(selector) + ");" +
                " target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}); target.focus({preventScroll:true}); })()",
                ignored -> focused.countDown());
        });
        assertTrue("Cash-history focus was not returned", focused.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        awaitPage("exact cash-history disclosure receives visible focus",
            "(() => { const target = document.querySelector(" + JSONObject.quote(selector) + ");" +
            " const r = target?.getBoundingClientRect(), v = visualViewport;" +
            " return target && document.activeElement === target && v && r.height >= 44" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; })()");
    }

    @Test
    public void annualEvidenceNoteDraftReviewSaveAndReloadPreservesSource() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        awaitPage("invented board admission completed without source reads", DIAGNOSTICS + ".marketsResolve === 1");
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Annual research draft");
        click(ANNUAL);
        awaitPage("exact saved ZERO opens with existing prose and unloaded Annual",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-company-identity strong')?.textContent === 'Zero Company'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Zero Class A · Class A · XNAS'" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'" +
            " && document.querySelector('.managed-annual-report .sec-quarterly-comparison') === null");
        assertAnnualNoteCounts(0, 0, 1);
        click(".managed-annual-report .trial-actions button:first-child");
        String basis = "section[aria-label='Annual revenue basis Revenues']";
        String amounts = basis + " .managed-annual-values";
        String history = basis + " > div > details:first-of-type";
        String add = basis + " button[aria-label='Add Revenues annual evidence to note draft']";
        String exactReport =
            "(() => { const report = document.querySelector('.sec-quarterly-comparison');" +
            " const generation = JSON.parse(document.querySelector('#fixture-report-generations').textContent).initial;" +
            " return report !== null && report.textContent.includes(generation.sha256)" +
            " && report.textContent.includes(generation.cutoffAt) && report.textContent.includes(generation.completedAt)" +
            " && report.textContent.includes(generation.sources.companyFacts.fetchedAt) && report.textContent.includes(generation.sources.submissions.fetchedAt)" +
            " && Array.from(report.querySelectorAll('.managed-annual-values tbody tr td:first-of-type')).map(e => e.textContent).join(',') === '1000,100,10%'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(amounts + " thead th:nth-child(2) time") + ")).map(e => e.dateTime).join(',') === '2025-01-01,2025-12-31'" +
            " && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'" +
            " && document.querySelector('.managed-annual-summary .managed-annual-age')?.textContent === 'Revenue and income are within current-use limits at this load.'" +
            " && document.querySelector('.managed-annual-financial-region')?.getAttribute('aria-label') === 'Annual financial results'" +
            " && document.querySelector('.managed-annual-financial-region')?.tabIndex === 0" +
            " && Array.from(report.querySelectorAll('a')).some(a => a.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm')" +
            " && document.querySelector(" + JSONObject.quote(add) + ")?.disabled === false; })()";
        awaitPage("one observed Annual pair has exact values, period and filing link", exactReport);
        awaitPage("friendly revenue heading and compact missing bases preserve separate concepts",
            "document.querySelector(" + JSONObject.quote(basis + " > h4") + ")?.textContent === 'Revenue'" +
            " && document.querySelector('.managed-annual-missing-bases > h4')?.textContent === 'Other revenue bases'" +
            " && document.querySelectorAll('.managed-annual-missing-bases [data-annual-missing-basis]').length === 2" +
            " && Array.from(document.querySelectorAll('.managed-annual-missing-bases [data-annual-missing-basis]')).map(e => e.getAttribute('data-annual-missing-basis') + '|' + e.querySelector('dt')?.textContent + '|' + e.querySelector('dd')?.textContent).join(';') === " +
                JSONObject.quote("RevenueFromContractWithCustomerExcludingAssessedTax|Customer contract revenue, excluding assessed tax|Missing from this report's loaded evidence.;SalesRevenueNet|Net sales revenue|Missing from this report's loaded evidence.") +
            " && document.querySelector(\"section[aria-label='Annual revenue basis RevenueFromContractWithCustomerExcludingAssessedTax']\") === null" +
            " && document.querySelector(\"section[aria-label='Annual revenue basis SalesRevenueNet']\") === null" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        assertAnnualCashGeneration();
        assertAnnualCashMargins();
        String comparison = basis + " .managed-annual-changes[aria-label='Reported annual comparison Revenues']";
        awaitPage("same-filing annual comparison retains exact dates, amounts and both changes",
            "document.querySelector(" + JSONObject.quote(comparison) + ")?.getAttribute('aria-label') === 'Reported annual comparison Revenues'" +
            " && document.querySelector(" + JSONObject.quote(comparison + " > caption > span") + ")?.textContent === 'Prior: 2024-01-01 to 2024-12-31. Current: 2025-01-01 to 2025-12-31.'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(comparison + " tbody tr") + ")).map(tr => Array.from(tr.cells).map(e => e.textContent).join('|')).join(';') === 'Revenue|200|25%;Net income|180|Unavailable: prior value is negative'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(amounts + " tbody td") + ")).map(e => e.textContent).join(',') === '1000,800,640,100,-80,32,10%,-10%,5%'" +
            " && document.querySelector(" + JSONObject.quote(basis + " .managed-annual-margin-change") + ")?.textContent === 'Net margin change · 20 percentage points'" +
            " && document.querySelector('.managed-annual-summary .managed-annual-basis-help')?.textContent.includes('Period length, accounting changes and restatements are unadjusted.')" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(history + " > section > ol") + ")).slice(0,2).map(e => e.children.length).join(',') === '2,2'" +
            " && document.querySelector('.managed-annual-provenance')?.open === false");
        assertAnnualNoteCounts(1, 0, 1);
        assertAnnualReportNavigation();
        assertAnnualTrendPresentation();
        awaitPage("trend presentation preserves the exact report and draft", exactReport +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        assertAnnualNoteCounts(1, 0, 1);
        click(history + " > summary");
        awaitPage("three adjacent annual periods retain exact dates, values and original inputs",
            "document.querySelector(" + JSONObject.quote(history) + ")?.open === true" +
            " && document.querySelector(" + JSONObject.quote(history + " > summary") + ")?.textContent === 'Inspect annual history inputs · Revenues'" +
            " && document.querySelector(" + JSONObject.quote(amounts + " > caption") + ")?.textContent === 'Reported annual amounts · 3 periods · newest first'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(amounts + " thead th[scope=col]") + ")).slice(1).map(th => Array.from(th.querySelectorAll('time')).map(e => e.dateTime).join(' to ')).join(',') === '2025-01-01 to 2025-12-31,2024-01-01 to 2024-12-31,2023-01-01 to 2023-12-31'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(history + " > section > h5") + ")).map(e => e.textContent).join(',') === '2025-01-01 to 2025-12-31,2024-01-01 to 2024-12-31,2023-01-01 to 2023-12-31'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(history + " > section > ol") + ")).map(e => e.children.length).join(',') === '2,2,2'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(history + " > section > ol > li > details > summary") + ")).map(e => e.textContent).join(';') === 'Revenues · 2025-01-01 to 2025-12-31 · 1000 USD;NetIncomeLoss · 2025-01-01 to 2025-12-31 · 100 USD;Revenues · 2024-01-01 to 2024-12-31 · 800 USD;NetIncomeLoss · 2024-01-01 to 2024-12-31 · -80 USD;Revenues · 2023-01-01 to 2023-12-31 · 640 USD;NetIncomeLoss · 2023-01-01 to 2023-12-31 · 32 USD'" +
            " && document.querySelector(" + JSONObject.quote(history) + ")?.textContent.includes('0000000001-26-000001')" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        assertAnnualNoteCounts(1, 0, 1);
        retainAnnualNoteFrame("annualEvidenceHistorySummary", ".managed-annual-summary", ".managed-annual-summary", 1);
        retainAnnualNoteFrame("annualEvidenceHistoryCurrent", amounts + " thead th:nth-child(2)", amounts + " thead th:nth-child(2), " + amounts + " tbody td:nth-of-type(1)", 4);
        retainAnnualNoteFrame("annualEvidenceHistoryPrior", amounts + " thead th:nth-child(3)", amounts + " thead th:nth-child(3), " + amounts + " tbody td:nth-of-type(2)", 4);
        retainAnnualNoteFrame("annualEvidenceHistoryEarlier", amounts + " thead th:nth-child(4)", amounts + " thead th:nth-child(4), " + amounts + " tbody td:nth-of-type(3)", 4);
        String earlierComparison = basis + " .managed-annual-changes[aria-label='Earlier reported annual comparison Revenues']";
        awaitPage("earlier adjacent amounts use original dates and exact signed changes",
            "document.querySelector(" + JSONObject.quote(earlierComparison) + ")?.getAttribute('aria-label') === 'Earlier reported annual comparison Revenues'" +
            " && document.querySelector(" + JSONObject.quote(earlierComparison + " > caption > span") + ")?.textContent === 'Prior: 2023-01-01 to 2023-12-31. Current: 2024-01-01 to 2024-12-31.'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(earlierComparison + " tbody tr") + ")).map(tr => Array.from(tr.cells).map(e => e.textContent).join('|')).join(';') === 'Revenue|160|25%;Net income|-112|-350%'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(history + " > section > ol") + ")).slice(1).map(e => e.children.length).join(',') === '2,2'" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        retainAnnualNoteFrame("annualEvidenceEarlierComparisonRevenue", earlierComparison + " thead th:last-child",
            earlierComparison + " thead th:not(:first-child), " + earlierComparison + " tbody tr:first-child td", 4);
        retainAnnualNoteFrame("annualEvidenceEarlierComparisonIncome", earlierComparison + " tbody tr:nth-child(2) td:last-child",
            earlierComparison + " tbody tr:nth-child(2) td", 2);
        assertAnnualNoteCounts(1, 0, 1);
        click(history + " > summary");
        awaitPage("closing annual inputs preserves visible financials, draft and selected report",
            "document.querySelector(" + JSONObject.quote(history) + ")?.open === false" +
            " && document.querySelector(" + JSONObject.quote(amounts) + ") !== null" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        // Capture the period columns and comparison cells within the fitted tables.
        retainAnnualNoteFrame("annualEvidenceNoteSource", basis + " > h4",
            basis + " > h4, " + amounts + " thead th:nth-child(2), " + amounts + " tbody td:first-of-type", 5);
        awaitPage("source pair remains unchanged through capture", exactReport);
        retainAnnualNoteFrame("annualEvidenceComparisonSource", comparison + " thead th:last-child",
            comparison + " thead th:not(:first-child), " + comparison + " tbody tr:first-child td", 4);
        retainAnnualNoteFrame("annualEvidenceComparisonIncome", comparison + " tbody tr:nth-child(2) td:last-child",
            comparison + " tbody tr:nth-child(2) td", 2);
        retainAnnualNoteFrame("annualEvidenceComparisonMargin", basis + " .managed-annual-margin-change",
            basis + " .managed-annual-margin-change", 1);
        click(".managed-annual-provenance > summary");
        awaitPage("financial methodology remains inspectable without another read",
            "document.querySelector('.managed-annual-provenance')?.open === true" +
            " && document.querySelectorAll('.managed-annual-provenance .managed-annual-basis-sources [data-annual-source-basis]').length === 3" +
            " && Array.from(document.querySelectorAll('.managed-annual-provenance .managed-annual-basis-sources [data-annual-source-basis]')).map(e => e.getAttribute('data-annual-source-basis') + '|' + e.querySelector('dt')?.textContent + '|' + e.querySelector('dd')?.textContent).sort().join(';') === " +
                JSONObject.quote("RevenueFromContractWithCustomerExcludingAssessedTax|RevenueFromContractWithCustomerExcludingAssessedTax|missing;Revenues|Revenues|eligible;SalesRevenueNet|SalesRevenueNet|missing") +
            " && document.querySelector('.managed-annual-provenance > p.sec-quarterly-caveat:last-of-type')?.textContent.includes('Percentage change is (current − prior) ÷ prior × 100')" +
            " && document.querySelector('.managed-annual-provenance > p.sec-quarterly-caveat:last-of-type')?.textContent.includes('Margin change subtracts the unrounded ratios')" +
            " && document.querySelector('.managed-annual-provenance > p.sec-quarterly-caveat:last-of-type')?.textContent.includes('unusual items in NetIncomeLoss')");
        retainAnnualNoteFrame("annualEvidenceComparisonDisclosure", ".managed-annual-provenance > p.sec-quarterly-caveat:last-of-type",
            ".managed-annual-provenance > p.sec-quarterly-caveat:last-of-type", 1);
        click(".managed-annual-provenance > summary");
        retainAnnualNoteFrame("annualEvidenceNoteAction", add, add, 1);
        awaitPage("source pair remains unchanged through comparison and action captures", exactReport);
        assertAnnualNoteCounts(1, 0, 1);
        assertAnnualCashNoteDraft();
        click(add);
        awaitPage("explicit chosen pair appends exact provenance to the existing draft",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(ANNUAL_NOTE) +
            " && document.querySelector('.managed-annual-note-action [role=status]')?.textContent === " +
                JSONObject.quote("Annual evidence added to the note draft. Review and save all changes in My Watchlist."));
        assertAnnualNoteDraft(1, true);
        assertAnnualCashNoteCapacity();
        assertAnnualNoteCounts(1, 0, 1);
        // The textarea contains the whole exact note, but this frame claims only its visible controls.
        retainAnnualNoteFrame("annualEvidenceNoteDraft", "#managed-research-note-heading",
            "#managed-research-note-heading, [aria-labelledby=managed-research-note-heading] > .trial-actions > button, " +
            "label[for=managed-research-note], #managed-research-note, #managed-research-note-help", 6);
        assertAnnualNoteDraft(1, true);
        assertAnnualNoteCounts(1, 0, 1);
        assertFixtureBoundary();
        touchInput("managed-research-note-reading-toggle");
        assertFullNoteReading("managed-research-note", ANNUAL_NOTE, true);
        assertAnnualNoteCounts(1, 0, 1);
        retainFullNoteTextFrame("annualNoteReadingStart", "managed-research-note", false);
        retainFullNoteTextFrame("annualNoteReadingEnd", "managed-research-note", true);
        assertFullNoteReading("managed-research-note", ANNUAL_NOTE, true);
        assertAnnualNoteCounts(1, 0, 1);
        touchInput("managed-research-note-reading-toggle");
        assertFullNoteReading("managed-research-note", ANNUAL_NOTE, false);
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("Review opens the exact Annual-note reader without a save or research read",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-0')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.activeElement === document.querySelector('#managed-note-0-reading-toggle')" +
            " && document.querySelector('#managed-watchlist-heading')?.closest('section')?.hidden === false");
        assertAnnualNoteDraft(1, true);
        assertAnnualNoteCounts(1, 0, 1);
        assertFullNoteReading("managed-note-0", ANNUAL_NOTE, true);
        assertAnnualNoteCounts(1, 0, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("one explicit full-list save acknowledges version two", DIAGNOSTICS + ".save === 1 && document.body.textContent.includes('Version 2 · Saved')");
        assertAnnualNoteDraft(2, false);
        assertAnnualNoteCounts(1, 1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        awaitPage("explicit reload returns the saved exact Annual note", DIAGNOSTICS + ".load === 2 && document.querySelector('#managed-note-0')?.disabled === false");
        assertAnnualNoteDraft(2, false);
        assertAnnualNoteCounts(1, 1, 2);
        assertFullNoteReading("managed-note-0", ANNUAL_NOTE, true);
        assertEquals("Annual note review, save and reload preserve document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertExactHistory(1, "https://localhost/", "https://localhost/");
        Log.i("ManagedAnnualNote", "phase=observed-pair-appended-saved-reloaded, exactNoteLength=" + ANNUAL_NOTE.length() + "; " + pageDiagnostic());
    }

    @Test
    public void thesisReviewPreviewAppendSaveAndReloadPreservesDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Original thesis");
        click(".managed-thesis-review > summary");
        awaitPage("review requires authored conditions and keeps the note unchanged",
            "document.querySelector('.managed-thesis-review button')?.disabled === true" +
            " && document.querySelector('#managed-note-0')?.value === 'Original thesis'");
        chooseNativeSelectOption("#managed-note-0-review-purpose", "holding_review", "Review a holding");
        typeIntoInput("managed-note-0-review-horizon", "The next two filed reports");
        typeIntoInput("managed-note-0-review-thesis", "Margins can recover");
        typeIntoInput("managed-note-0-review-support", "Invented report 2026-10-01");
        typeIntoInput("managed-note-0-review-counter", "Demand remains uncertain");
        typeIntoInput("managed-note-0-review-confirm", "Two stronger reported periods");
        typeIntoInput("managed-note-0-review-invalidate", "Cash keeps falling");
        typeIntoInput("managed-note-0-review-next", "Read the next filed report");
        String excerpt = "Thesis review (my assessment). Research purpose: Review a holding" +
            " | Time horizon: The next two filed reports | My thesis: Margins can recover" +
            " | Supporting evidence: Invented report 2026-10-01" +
            " | Opposing evidence: Demand remains uncertain" +
            " | Confirmation condition: Two stronger reported periods" +
            " | Invalidation condition: Cash keeps falling | Next check: Read the next filed report";
        String expected = "Original thesis " + excerpt;
        awaitPage("complete preview precedes the explicit draft append",
            "document.querySelector('.managed-thesis-review .trial-saved-note')?.textContent === " + JSONObject.quote(excerpt) +
            " && document.querySelector('#managed-note-0')?.value === 'Original thesis'" +
            " && " + DIAGNOSTICS + ".save === 0" +
            " && document.querySelector('.managed-thesis-review button')?.disabled === false" +
            " && [...document.querySelectorAll('.managed-thesis-review input,.managed-thesis-review select')].every(e => e.getBoundingClientRect().height >= 44)");
        click(".managed-thesis-review button");
        awaitPage("one append preserves both identities and blocks an immediate duplicate",
            "document.querySelector('#managed-note-0')?.value === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && document.querySelector('.managed-thesis-review button')?.disabled === true" +
            " && " + DIAGNOSTICS + ".save === 0");
        clickWatchlistAction("Save watchlist");
        awaitPage("explicit Save keeps the complete authored review",
            DIAGNOSTICS + ".save === 1 && document.body.textContent.includes('Version 2 · Saved')" +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(expected));
        clickWatchlistAction("Load saved watchlist");
        awaitPage("reload retains the whole note and the other share class",
            DIAGNOSTICS + ".load === 2 && " + DIAGNOSTICS + ".save === 1" +
            " && document.querySelector('#managed-note-0')?.value === " + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'");
        assertFixtureBoundary(0, 1);
        assertEquals("Thesis review preserves the mounted document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
    }

    @Test
    public void watchlistReplayReviewAndFailedReadPreserveDraft() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", "Retained recovery draft");
        closeSoftKeyboard();
        clickWatchlistAction("Save watchlist");
        awaitPage("uncertain save retains the captured draft and locks edits",
            DIAGNOSTICS + ".save === 1 && " + DIAGNOSTICS + ".recoveryCommits === 1" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Retained recovery draft'" +
            " && document.querySelector('#managed-note-0')?.disabled === true" +
            " && document.querySelector('.managed-save-status')?.textContent.includes('uncertain')" +
            " && document.querySelector('.managed-version-review') === null");
        touchInput("managed-note-0-reading-toggle");
        assertFullNoteReading("managed-note-0", "Retained recovery draft", true);
        awaitPage("reading a paused draft sends no save or read",
            DIAGNOSTICS + ".save === 1 && " + DIAGNOSTICS + ".load === 1" +
            " && document.querySelector('#managed-note-0')?.disabled === true");
        clickWatchlistAction("Reconcile pending save");
        awaitPage("original command replay confirms its one invented commit without another write",
            DIAGNOSTICS + ".save === 2 && " + DIAGNOSTICS + ".recoveryCommits === 1" +
            " && " + DIAGNOSTICS + ".recoveryReplays === 1 && " + DIAGNOSTICS + ".load === 1" +
            " && document.querySelector('.managed-save-status')?.textContent.includes('from the original command')" +
            " && document.querySelector('#managed-note-0')?.disabled === true" +
            " && document.querySelector('.managed-version-review') === null");
        clickWatchlistAction("Load saved watchlist");
        assertRecoveryReview();
        String row = "[data-managed-review-listing-id=listing-zero]";
        retainAnnualNoteFrame("watchlistRecoveryVersions", row + " h4",
            row + " h4," + row + " .managed-version-side", 3);
        assertRecoveryReview();
        retainAnnualNoteFrame("watchlistRecoveryChoices", ".managed-version-review + .trial-actions",
            ".managed-version-review + .trial-actions > button", 2);
        assertRecoveryReview();
        Log.i("ManagedWatchlistRecovery", "phase=original-replay-and-version-review; " + pageDiagnostic());
        clickWatchlistAction("Load saved watchlist");
        awaitPage("a pending repeat read revokes previous review and choices without losing draft",
            DIAGNOSTICS + ".load === 3 && " + DIAGNOSTICS + ".recoveryReadFailed === 0" +
            " && document.querySelector('.managed-version-review') === null" +
            " && !Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Use saved version' || b.textContent === 'Keep my draft')" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Retained recovery draft'" +
            " && document.querySelector('#managed-note-0')?.disabled === true");
        click("#fail-recovery-read");
        awaitPage("failed repeat read cannot offer old saved choices",
            DIAGNOSTICS + ".recoveryReadFailed === 1 && " + DIAGNOSTICS + ".save === 2" +
            " && document.querySelector('.managed-save-status')?.textContent.includes('could not be loaded')" +
            " && document.querySelector('.managed-version-review') === null" +
            " && !Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Use saved version' || b.textContent === 'Keep my draft')" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Retained recovery draft'" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && document.querySelector('#managed-note-0')?.disabled === true");
        retainAnnualNoteFrame("watchlistRecoveryFailedRead", ".managed-save-status", ".managed-save-status", 1);
        Log.i("ManagedWatchlistRecovery", "phase=failed-repeat-read-draft-retained; " + pageDiagnostic());
        clickWatchlistAction("Load saved watchlist");
        assertRecoveryReview();
        clickWatchlistAction("Use saved version");
        awaitPage("explicit saved choice uses the whole later version and sends no save",
            DIAGNOSTICS + ".load === 4 && " + DIAGNOSTICS + ".save === 2" +
            " && " + DIAGNOSTICS + ".recoveryCommits === 1 && " + DIAGNOSTICS + ".recoveryReplays === 1" +
            " && " + DIAGNOSTICS + ".recoveryReadFailed === 1" +
            " && document.querySelector('.managed-version-review') === null" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'New saved research note'" +
            " && document.querySelector('#managed-note-1')?.disabled === false" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 3 · Saved')");
        awaitPage("recovery makes no research or authentication requests",
            DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0" +
            " && " + DIAGNOSTICS + ".marketsEod === 0 && " + DIAGNOSTICS + ".search === 0" +
            " && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".token === 0" +
            " && " + DIAGNOSTICS + ".signOut === 0 && location.origin === 'https://localhost'");
        assertEquals("Recovery preserves the mounted document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertRootHistory();
        Log.i("ManagedWatchlistRecovery", "phase=fresh-read-explicit-saved-choice; " + pageDiagnostic());
    }

    private void clickWatchlistAction(String label) {
        assertTrue("Only the fixed recovery actions are admitted", label.equals("Save watchlist") ||
            label.equals("Reconcile pending save") || label.equals("Load saved watchlist") || label.equals("Use saved version"));
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertRecoveryReview() throws Exception {
        awaitPage("review pairs exact listing IDs, complete notes and both membership positions",
            "(() => { const review = document.querySelector('.managed-version-review');" +
            " const zero = review?.querySelector('[data-managed-review-listing-id=listing-zero]');" +
            " const one = review?.querySelector('[data-managed-review-listing-id=listing-one]');" +
            " const sides = zero?.querySelectorAll('.managed-version-side');" +
            " return review?.querySelector('h3')?.textContent === 'Review saved version 3 and my draft'" +
            " && review.querySelectorAll('li').length === 2 && sides?.length === 2" +
            " && sides[0].querySelector('.trial-saved-note')?.textContent === 'New saved research note'" +
            " && sides[1].querySelector('.trial-saved-note')?.textContent === 'Retained recovery draft'" +
            " && sides[0].textContent.includes('Position 2') && sides[1].textContent.includes('Position 1')" +
            " && one?.textContent.includes('Invented second note') && one.textContent.includes('Order differs')" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Retained recovery draft'" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && document.querySelector('#managed-note-0')?.disabled === true" +
            " && Array.from(document.querySelectorAll('.managed-version-review + .trial-actions > button')).map(b => b.textContent).join(',') === 'Use saved version,Keep my draft'; })()");
    }

    private void assertAnnualCashNoteDraft() throws Exception {
        String action = ".managed-annual-cash-note-action > button";
        awaitPage("cash action is labelled, associated and available at the original load",
            "(() => { const b = document.querySelector(" + JSONObject.quote(action) + ");" +
            " return b && !b.disabled && b.getAttribute('aria-disabled') === 'false'" +
            " && b.textContent === 'Add cash generation to note draft'" +
            " && b.getBoundingClientRect().height >= 44" +
            " && document.getElementById(b.getAttribute('aria-describedby'))?.textContent.includes('Nothing is saved here.'); })()");
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", "Annual research draft", "Cash research draft");
        click(action);
        String exact = "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(ANNUAL_CASH_NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(ANNUAL_CASH_NOTE) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE'" +
            " && document.querySelectorAll('.managed-watchlist-choices li').length === 2";
        awaitPage("cash append uses the latest prefix and exact amounts, calculation and original provenance", exact +
            " && document.querySelector('.managed-annual-cash-note-status')?.textContent === " +
                JSONObject.quote("Cash generation added to the note draft. Review and save all changes in My Watchlist."));
        assertAnnualNoteCounts(1, 0, 1);
        awaitPage("exact duplicate remains focusable and has its associated refusal",
            "(() => { const b = document.querySelector(" + JSONObject.quote(action) + "); return b && !b.disabled" +
            " && b.getAttribute('aria-disabled') === 'true'" +
            " && document.getElementById(b.getAttribute('aria-describedby'))?.textContent.includes('already in the note draft'); })()");
        click(action);
        awaitPage("duplicate cash action cannot append again", exact);
        assertAnnualNoteCounts(1, 0, 1);
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", ANNUAL_CASH_NOTE, "Annual research draft");
        awaitPage("editing the note clears obsolete duplicate feedback before the original pair journey",
            "document.querySelector('#managed-research-note')?.value === 'Annual research draft'" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Annual research draft'" +
            " && document.querySelector(" + JSONObject.quote(action) + ")?.getAttribute('aria-disabled') === 'false'" +
            " && document.querySelector('.managed-annual-cash-note-status')?.textContent === ''");
        assertAnnualNoteCounts(1, 0, 1);
    }

    private void assertAnnualCashNoteCapacity() throws Exception {
        String action = ".managed-annual-cash-note-action > button";
        awaitPage("cash action rechecks capacity against the latest complete Annual note",
            "(() => { const b = document.querySelector(" + JSONObject.quote(action) + "); return b && !b.disabled" +
            " && b.getAttribute('aria-disabled') === 'true'" +
            " && document.getElementById(b.getAttribute('aria-describedby'))?.textContent.includes('complete note must fit within 2,000 characters'); })()");
        click(action);
        awaitPage("capacity refusal leaves the latest raw note unchanged",
            "document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(ANNUAL_NOTE) +
            " && document.querySelector('.managed-annual-cash-note-status')?.textContent.includes('complete note must fit within 2,000 characters')");
        assertAnnualNoteDraft(1, true);
        assertAnnualNoteCounts(1, 0, 1);
    }

    private void assertAnnualNoteDraft(int version, boolean dirty) throws Exception {
        awaitPage("Annual note preserves the full exact paragraph, identities, other note and order",
            "Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE'" +
            " && document.querySelectorAll('.managed-watchlist-choices li').length === 2" +
            " && " + DRAFT + ".memberships?.[0]?.note === " + JSONObject.quote(ANNUAL_NOTE) +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && document.body.textContent.includes(" + JSONObject.quote("Version " + version + (dirty ? " · Unsaved changes" : " · Saved")) + ")");
    }

    private void assertAnnualReportNavigation() throws Exception {
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String originalLocation = readFixtureString("location.href");
        String originalHistoryLength = readFixtureString("String(history.length)");
        awaitPage("loaded report has six explicit destinations and initially closed source details",
            "(() => { const nav = document.querySelector('nav[aria-label=\"On this report\"]');" +
            " const links = [...(nav?.querySelectorAll('a') || [])];" +
            " return links.length === 6 && links.map(a => a.textContent).join('|') === 'Revenue and net income|Operating results|Cash generation|Liquidity|Balance sheet totals|Report source details'" +
            " && links.every(a => a.getBoundingClientRect().height >= 44 && document.getElementById(a.getAttribute('href').slice(1))?.getAttribute('data-annual-report-target') === a.getAttribute('data-annual-report-jump'))" +
            " && document.querySelector('.managed-annual-provenance')?.open === false; })()");
        for (String section : new String[] {"income", "operating", "cash", "liquidity", "balanceSheet", "sources"}) {
            click("a[data-annual-report-jump='" + section + "']");
            awaitPage("report jump focuses its visible destination without changing history or draft: " + section,
                "(() => { const target = document.querySelector('[data-annual-report-target=\"" + section + "\"]');" +
                " if (!target || document.activeElement !== target) return false;" +
                " const r = target.getBoundingClientRect(); const v = visualViewport;" +
                " const bottomNav = document.querySelector('.managed-navigation')?.getBoundingClientRect();" +
                " const bottom = Math.min(v.offsetTop + v.height, bottomNav?.top > v.offsetTop ? bottomNav.top : Infinity);" +
                " return r.top >= v.offsetTop && Math.min(r.bottom, r.top + 30) <= bottom" +
                " && location.href === " + JSONObject.quote(originalLocation) +
                " && String(history.length) === " + JSONObject.quote(originalHistoryLength) +
                " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft) +
                " && document.querySelector('.managed-annual-provenance').open === " + section.equals("sources") + "; })()");
            assertAnnualNoteCounts(1, 0, 1);
        }
        click(".managed-annual-provenance > summary");
        awaitPage("explicit close restores the source disclosure before the original note journey",
            "document.querySelector('.managed-annual-provenance')?.open === false" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        assertAnnualNoteCounts(1, 0, 1);
    }

    private void assertAnnualTrendPresentation() throws Exception {
        String controls = "document.querySelector('[data-annual-trend-basis]')?.disabled === false" +
            " && document.querySelector('[data-annual-trend-metric]')?.disabled === false";
        awaitPage("annual trend starts collapsed with explicit basis and metric choices",
            "document.querySelector('.managed-annual-trend')?.open === false" +
            " && document.querySelector('[data-annual-trend-basis]')?.value === 'Revenues'" +
            " && document.querySelector('[data-annual-trend-selected-basis]')?.textContent === 'Selected basis: Revenue'" +
            " && document.querySelector('[data-annual-trend-metric]')?.value === 'revenue'" +
            " && Array.from(document.querySelectorAll('[data-annual-trend-basis] option')).map(e => e.value).join(',') === 'RevenueFromContractWithCustomerExcludingAssessedTax,Revenues,SalesRevenueNet'" +
            " && Array.from(document.querySelectorAll('[data-annual-trend-basis] option')).map(e => e.textContent).join('|') === 'Customer contract revenue, excluding assessed tax|Revenue|Net sales revenue'" +
            " && document.querySelector('[data-annual-trend-selected-basis]')?.id" +
            " && document.querySelector('[data-annual-trend-basis]')?.getAttribute('aria-describedby')?.split(' ').includes(document.querySelector('[data-annual-trend-selected-basis]').id)" +
            " && document.querySelector('.managed-annual-trend-canvas') === null && " + controls);
        click(".managed-annual-trend > summary");
        awaitPage("opening trend renders only the admitted three-period revenue basis",
            "document.querySelector('.managed-annual-trend')?.open === true" +
            " && document.querySelector('.managed-annual-trend-canvas')?.getAttribute('aria-label').startsWith('Revenues: Revenue in USD across 3 reported annual periods')" +
            " && document.querySelector('.managed-annual-trend-canvas canvas') !== null");
        chooseNativeSelectOption("[data-annual-trend-metric]", "net_income", "Net income");
        awaitPage("native metric choice renders the same periods for signed net income",
            "document.querySelector('.managed-annual-trend-canvas')?.getAttribute('aria-label').startsWith('Revenues: Net income in USD across 3 reported annual periods')" +
            " && document.querySelector('.managed-annual-trend-canvas canvas') !== null");
        chooseNativeSelectOption("[data-annual-trend-basis]", "SalesRevenueNet", "Net sales revenue");
        awaitPage("missing basis removes the old chart and preserves both selectors",
            "document.querySelector('.managed-annual-trend-canvas') === null" +
            " && document.querySelector('.managed-annual-trend [role=status]')?.textContent.includes('no valid current annual pair')" +
            " && document.querySelector('[data-annual-trend-basis]')?.value === 'SalesRevenueNet'" +
            " && document.querySelector('[data-annual-trend-selected-basis]')?.textContent === 'Selected basis: Net sales revenue'" +
            " && document.querySelector('[data-annual-trend-metric]')?.value === 'net_income' && " + controls);
        chooseNativeSelectOption("[data-annual-trend-basis]", "Revenues", "Revenue");
        awaitPage("returning to the admitted basis keeps the chosen metric",
            "document.querySelector('.managed-annual-trend-canvas')?.getAttribute('aria-label').startsWith('Revenues: Net income in USD across 3 reported annual periods')" +
            " && document.querySelector('.managed-annual-trend-canvas canvas') !== null");
        click(".managed-annual-trend > summary");
        awaitPage("closing trend removes its canvas without resetting controls",
            "document.querySelector('.managed-annual-trend')?.open === false" +
            " && document.querySelector('.managed-annual-trend-canvas') === null" +
            " && document.querySelector('[data-annual-trend-basis]')?.value === 'Revenues'" +
            " && document.querySelector('[data-annual-trend-selected-basis]')?.textContent === 'Selected basis: Revenue'" +
            " && document.querySelector('[data-annual-trend-metric]')?.value === 'net_income'");
    }

    private void assertAnnualCashGeneration() throws Exception {
        String cash = ".sec-annual-cash";
        String source = cash + " > .sec-annual-cash-source";
        String inputs = source + " > section > ol > li > details";
        awaitPage("cash reports exact independent amounts and a same-period subtraction",
            "document.querySelector('.sec-annual-cash')?.getAttribute('aria-label') === 'Annual cash generation'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values dt')).map(e => e.textContent).join('|') === 'Operating cash flowReported · USD|PP&E purchasesReported · USD|Operating cash flow less PP&E purchasesApp calculation · USD'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values .sec-annual-cash-amount')).map(e => e.textContent).join(',') === '120.125,20.025,100.1'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values dd small:first-of-type')).map(e => e.textContent).join('|') === '2025-01-01 to 2025-12-31|2025-01-01 to 2025-12-31|2025-01-01 to 2025-12-31'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values dd small:last-of-type')).every(e => e.textContent === 'Within current-use limits at this load.')" +
            " && document.querySelector('.sec-annual-cash > p:last-of-type')?.textContent.includes('It does not adjust for leases, acquisitions or other investing cash flows.')" +
            " && document.querySelector('.sec-annual-cash-source')?.open === false" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
        click(source + " > summary");
        awaitPage("cash disclosure retains original capture times and complete bounded inputs",
            "document.querySelector('.sec-annual-cash-source')?.open === true" +
            " && document.querySelector('.sec-annual-cash-source > p:first-of-type')?.textContent === 'Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash-source > section > p')).map(e => e.textContent).join('|') === 'Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.|Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(inputs + " > summary") + ")).map(e => e.textContent).join('|') === 'NetCashProvidedByUsedInOperatingActivities · 2025-01-01 to 2025-12-31 · 120.125 USD|PaymentsToAcquirePropertyPlantAndEquipment · 2025-01-01 to 2025-12-31 · 20.025 USD'");
        click(source + " > section:nth-of-type(1) > ol > li > details > summary");
        click(source + " > section:nth-of-type(2) > ol > li > details > summary");
        awaitPage("both cash operands keep exact filing coordinates and calculation references",
            "(() => { const rows = Array.from(document.querySelectorAll(" + JSONObject.quote(inputs) + "));" +
            " const values = rows.map(row => Array.from(row.querySelectorAll('dd')).map(e => e.textContent));" +
            " const shared = '|365 days|2025 · FY|CY2025|10-K · 2026-02-01|0000000001-26-000001|Matched to current submissions · 10-K · 2026-02-01|2025-12-31 · 2026-02-01T00:00:00.000Z|';" +
            " const ids = values.map(row => row[9]);" +
            " return rows.length === 2 && rows.every(row => row.open)" +
            " && values[0].slice(0, 9).join('|') === '120.125' + shared + '/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0'" +
            " && values[1].slice(0, 9).join('|') === '20.025' + shared + '/facts/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment/units/USD/0'" +
            " && ids.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id)) && ids[0] !== ids[1]" +
            " && document.querySelector('.sec-annual-cash-source > p:last-of-type')?.textContent === 'Calculation references: ' + ids.join(' · '); })()");
        assertAnnualNoteCounts(1, 0, 1);
        click(source + " > summary");
        awaitPage("closing cash details preserves values and the existing unsaved note",
            "document.querySelector('.sec-annual-cash-source')?.open === false" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values .sec-annual-cash-amount')).map(e => e.textContent).join(',') === '120.125,20.025,100.1'" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'");
    }

    private void assertAnnualCashMargins() throws Exception {
        String root = ".sec-annual-cash-margins";
        String currentRevenue = "section[aria-label='Annual revenue basis Revenues'] > div > details:first-of-type > section:first-of-type > ol > li:first-child > details";
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String originalLocation = readFixtureString("location.href");
        String originalHistoryLength = readFixtureString("String(history.length)");
        String originalGeneration = readFixtureString("JSON.stringify(JSON.parse(document.querySelector('#fixture-report-generations').textContent).initial)");
        String originalIds = readFixtureString(
            "JSON.stringify([...Array.from(document.querySelectorAll('.sec-annual-cash-source > section > ol > li > details')).map(row => row.querySelectorAll('dd')[9]?.textContent)," +
            " document.querySelector(" + JSONObject.quote(currentRevenue) + ")?.querySelectorAll('dd')[9]?.textContent])");
        String exact =
            "(() => { const root = document.querySelector('.sec-annual-cash-margins');" +
            " const bases = Array.from(root?.querySelectorAll(':scope > section[data-cash-margin-basis]') || []);" +
            " const expectedIds = " + originalIds + ";" +
            " const period = '2025-01-01 to 2025-12-31', eligible = 'Within current-use limits at this load.';" +
            " const missing = \"No observation covers the selected annual filing's period.\";" +
            " const generation = JSON.parse(document.querySelector('#fixture-report-generations').textContent).initial;" +
            " return root?.getAttribute('aria-label') === 'Annual cash generation margins'" +
            " && root.querySelector(':scope > h5')?.textContent === 'Cash generation relative to revenue'" +
            " && root.querySelector(':scope > p')?.textContent === 'Operating cash flow less PP&E purchases / reported revenue (%). Each revenue concept is a separate basis. The app uses the same filing and period, then rounds the percentage once to two decimal places.'" +
            " && bases.length === 3 && bases.map(b => b.dataset.cashMarginBasis).join('|') === 'RevenueFromContractWithCustomerExcludingAssessedTax|Revenues|SalesRevenueNet'" +
            " && bases.map(b => b.querySelector(':scope > h6')?.textContent).join('|') === 'Customer contract revenue, excluding assessed tax|Revenue|Net sales revenue'" +
            " && bases.every((b, i) => { const cells = Array.from(b.querySelectorAll(':scope > dl > div > dd'));" +
            " const labels = Array.from(b.querySelectorAll(':scope > dl > div > dt')).map(e => e.textContent);" +
            " return cells.length === 2 && labels.join('|') === 'Reported revenue · USD|Operating cash flow less PP&E purchases / reported revenue (%)App calculation'" +
            " && (i === 1 ? cells.map(c => c.querySelector(':scope > span')?.textContent).join('|') === '1000|10.01%'" +
            " && cells.every(c => c.querySelector(':scope > small:first-of-type')?.textContent === period && c.querySelector(':scope > small:last-of-type')?.textContent === eligible)" +
            " : cells[0].textContent === 'Unavailable. ' + missing && cells[1].textContent === 'Unavailable. Reported revenue: ' + missing); })" +
            " && root.querySelectorAll('button,input,select,textarea').length === 0" +
            " && expectedIds.length === 3 && expectedIds.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id)) && new Set(expectedIds).size === 3" +
            " && JSON.stringify(generation) === " + JSONObject.quote(originalGeneration) +
            " && document.querySelector('.sec-quarterly-comparison')?.textContent.includes(generation.sha256)" +
            " && document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Zero Class A · Class A · XNAS'" +
            " && document.querySelector('#managed-research-note')?.getAttribute('data-managed-note-listing-id') === 'listing-zero'" +
            " && document.querySelector('#managed-research-note')?.value === 'Annual research draft'" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft) +
            " && location.href === " + JSONObject.quote(originalLocation) + " && String(history.length) === " + JSONObject.quote(originalHistoryLength) +
            " && " + DIAGNOSTICS + ".filings === 0 && " + DIAGNOSTICS + ".calendar === 0 && " + DIAGNOSTICS + ".fed === 0; })()";
        awaitPage("cash margins preserve one exact percentage and two independent missing revenue bases", exact +
            " && document.querySelectorAll('.sec-annual-cash-margins > section > details').length === 3" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash-margins > section > details')).every(e => e.open === false)");
        assertAnnualNoteCounts(1, 0, 1);
        for (String concept : new String[] {"RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"}) {
            boolean hasRevenue = concept.equals("Revenues");
            String basis = root + " > section[data-cash-margin-basis='" + concept + "']";
            String inputs = basis + " > .sec-annual-cash-margin-inputs";
            String summary = inputs + " > summary";
            focusCashHistoryControl(summary);
            onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
            awaitPage("native Space opens only the selected margin inputs with visible focus: " + concept, exact +
                " && (() => { const inputs = document.querySelector(" + JSONObject.quote(inputs) + "), summary = document.querySelector(" + JSONObject.quote(summary) + ");" +
                " return inputs?.open === true && document.activeElement === summary && getComputedStyle(summary).outlineStyle !== 'none'" +
                " && parseFloat(getComputedStyle(summary).outlineWidth) >= 2" +
                " && document.querySelectorAll('.sec-annual-cash-margins > section > details[open]').length === 1; })()");
            toggleAnnualCashMarginOperands(inputs, hasRevenue, true);
            awaitPage("cash margin inputs retain all exact operands, joined source IDs and original clocks: " + concept, exact +
                " && (() => { const inputs = document.querySelector(" + JSONObject.quote(inputs) + "); const expectedIds = " + originalIds + ";" +
                " const hasRevenue = " + hasRevenue + ";" +
                " const cells = Array.from(inputs.querySelectorAll(':scope > dl > div > dd'));" +
                " const groups = Array.from(inputs.querySelectorAll(':scope > section'));" +
                " const rows = Array.from(inputs.querySelectorAll(':scope > section > ol > li > details'));" +
                " const values = rows.map(row => Array.from(row.querySelectorAll('dd')).map(e => e.textContent));" +
                " const shared = '|365 days|2025 · FY|CY2025|10-K · 2026-02-01|0000000001-26-000001|Matched to current submissions · 10-K · 2026-02-01|2025-12-31 · 2026-02-01T00:00:00.000Z|';" +
                " return inputs.querySelector(':scope > p:first-of-type')?.textContent === 'Cutoff 2026-09-20T00:00:00.000Z. Company Facts captured 2026-09-20T00:00:01.000Z. Submissions captured 2026-09-20T00:00:02.000Z. Completed 2026-09-20T00:00:02.000Z.'" +
                " && inputs.querySelector(':scope > p:nth-of-type(2)')?.textContent === 'Selected filing 0000000001-26-000001; report date 2025-12-31; filed 2026-02-01.'" +
                " && cells.length === 3 && cells.slice(0,2).map(c => c.querySelector(':scope > span')?.textContent).join('|') === '120.125|20.025'" +
                " && cells.slice(0,hasRevenue ? 3 : 2).every(c => c.querySelector(':scope > small:first-of-type')?.textContent === '2025-01-01 to 2025-12-31' && c.querySelector(':scope > small:last-of-type')?.textContent === 'Within current-use limits at this load.')" +
                " && (hasRevenue ? cells[2].querySelector(':scope > span')?.textContent === '1000' : cells[2].textContent === \"Unavailable. No observation covers the selected annual filing's period.\")" +
                " && groups.length === 3 && groups.map(g => g.querySelectorAll(':scope > ol > li').length).join(',') === (hasRevenue ? '1,1,1' : '1,1,0')" +
                " && rows.length === (hasRevenue ? 3 : 2) && rows.every(row => row.open === hasRevenue)" +
                " && values[0].slice(0,9).join('|') === '120.125' + shared + '/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0'" +
                " && values[1].slice(0,9).join('|') === '20.025' + shared + '/facts/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment/units/USD/0'" +
                " && (!hasRevenue || values[2].slice(0,9).join('|') === '1000' + shared + '/facts/us-gaap/Revenues/units/USD/0')" +
                " && values.every((value,i) => value.length === 10 && value[9] === expectedIds[i])" +
                " && groups[0].querySelector(':scope > p')?.textContent === 'Operating cash flow references: ' + expectedIds[0]" +
                " && groups[1].querySelector(':scope > p')?.textContent === 'PP&E purchases references: ' + expectedIds[1]" +
                " && groups[2].querySelector(':scope > p')?.textContent === " + JSONObject.quote(concept + " references: ") + " + (hasRevenue ? expectedIds[2] : 'None')" +
                " && inputs.querySelector(':scope > p:last-of-type')?.textContent === 'Calculation references: ' + expectedIds.slice(0,hasRevenue ? 3 : 2).join(' · '); })()");
            toggleAnnualCashMarginOperands(inputs, hasRevenue, false);
            focusCashHistoryControl(summary);
            onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
            awaitPage("cash margin inputs close without changing values, source clocks or draft: " + concept, exact +
                " && document.querySelector(" + JSONObject.quote(inputs) + ")?.open === false" +
                " && document.activeElement === document.querySelector(" + JSONObject.quote(summary) + ")" +
                " && Array.from(document.querySelectorAll('.sec-annual-cash-margins details')).every(e => e.open === false)");
            assertAnnualNoteCounts(1, 0, 1);
        }
        String amounts = root + " > section[data-cash-margin-basis='Revenues'] > dl > div > dd > span";
        retainAnnualNoteFrame("annualCashMarginRevenue", amounts, amounts, 2);
        awaitPage("cash margin capture preserves the original Annual note journey", exact);
        assertAnnualNoteCounts(1, 0, 1);
    }


    private void toggleAnnualCashMarginOperands(String inputs, boolean hasRevenue, boolean open) throws Exception {
        if (!hasRevenue) return;
        for (int operand = 1; operand <= 3; operand++) {
            String observation = inputs + " > section:nth-of-type(" + operand + ") > ol > li > details > summary";
            focusCashHistoryControl(observation);
            onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_SPACE));
            awaitPage("native Space " + (open ? "opens" : "closes") + " original margin operand " + operand,
                "document.querySelector(" + JSONObject.quote(observation) + ")?.parentElement.open === " + open);
        }
    }

    private void assertAnnualNoteCounts(int annual, int saves, int loads) throws Exception {
        awaitPage("Annual note has only its explicit source load, save and reload",
            DIAGNOSTICS + ".annual === " + annual + " && " + DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".load === " + loads +
            " && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".eodAborted === 0 && " + DIAGNOSTICS + ".eodLateResolved === 0" +
            " && " + DIAGNOSTICS + ".marketsAborted === 0 && " + DIAGNOSTICS + ".marketsLateResolved === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    private void assertComparisonNoteReader(String id, String listingId, String symbol, String expected, String query) throws Exception {
        assertFullNoteReading(id, expected, true);
        awaitPage("comparison Review keeps search and focuses the exact full-note reader above navigation",
            "(() => { const input = document.getElementById(" + JSONObject.quote(id) + ");" +
            " const summary = document.getElementById(" + JSONObject.quote(id + "-reading-toggle") + ");" +
            " const text = document.getElementById(" + JSONObject.quote(id + "-reading-text") + ");" +
            " const v = visualViewport, r = summary?.getBoundingClientRect(), nav = document.querySelector('.managed-navigation')?.getBoundingClientRect();" +
            " const range = document.createRange(); if (!text?.firstChild || !r || !v) return false; range.setStart(text.firstChild, 0); range.setEnd(text.firstChild, 1);" +
            " const first = range.getBoundingClientRect(), bottom = Math.min(v.offsetTop + v.height, nav?.top > v.offsetTop ? nav.top : Infinity);" +
            " return input?.dataset.managedNoteListingId === " + JSONObject.quote(listingId) + " && input.value === " + JSONObject.quote(expected) +
            " && document.activeElement === summary && r.height >= 44 && r.top >= v.offsetTop && r.bottom <= bottom" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width && first.height > 0 && first.top >= v.offsetTop && first.bottom <= bottom" +
            " && document.querySelector('#managed-watchlist-search')?.value === " + JSONObject.quote(query) +
            " && document.querySelector('#managed-watchlist-search-scope')?.value === 'identity'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && document.querySelector('.managed-watchlist-detail')?.textContent.includes('Selected ' + " + JSONObject.quote(symbol) + " + ' is outside this search.'); })()");
    }

    private void assertFullNoteReading(String id, String expected, boolean open) throws Exception {
        awaitPage("full current draft is literal wrapped text: " + id,
            "(() => { const text = document.getElementById(" + JSONObject.quote(id + "-reading-text") + ");" +
            " const disclosure = text?.closest('details'); const summary = disclosure?.querySelector('summary');" +
            " return text?.textContent === " + JSONObject.quote(expected) +
            " && text.children.length === 0 && getComputedStyle(text).whiteSpace === 'pre-wrap'" +
            " && getComputedStyle(text).overflowWrap === 'anywhere' && text.scrollWidth <= text.clientWidth" +
            " && disclosure?.open === " + open +
            " && summary?.id === " + JSONObject.quote(id + "-reading-toggle") +
            " && summary.textContent.startsWith('Read full note for ')" +
            " && getComputedStyle(summary).minHeight === '44px'; })()");
    }

    // These two frames cover only the first or last eighty characters.
    // The separate assertion checks every character of the complete paragraph.
    private void retainFullNoteTextFrame(String name, String id, boolean last) throws Exception {
        String range = "const text = document.getElementById(" + JSONObject.quote(id + "-reading-text") + ");" +
            " if (!text || text.textContent !== " + JSONObject.quote(ANNUAL_NOTE) + " || text.children.length !== 0) return false;" +
            " const node = text.firstChild; if (!node || node.nodeType !== Node.TEXT_NODE) return false;" +
            " const length = node.length; if (length < 80) return false; const range = document.createRange();" +
            " range.setStart(node," + (last ? "length - 80" : "0") + ");" +
            " range.setEnd(node," + (last ? "length" : "80") + ");";
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { " + range + " const r = range.getBoundingClientRect(), v = visualViewport;" +
            " if (!v) return false; window.scrollBy({top:r.top-v.offsetTop-16,behavior:'instant'}); return true; })()",
            ignored -> scrolled.countDown()));
        assertTrue("Full-note text range did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { " + range +
            " const v = visualViewport, rects = Array.from(range.getClientRects());" +
            " return v && text.closest('details')?.open && rects.length > 0 && rects.every(r =>" +
            " r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height); })()";
        awaitPage("Full-note declared text range is visible: " + name, visible);
        retainScreenshot(name);
        awaitPage("Full-note declared text range stayed visible: " + name, visible);
    }

    private void retainAnnualNoteFrame(String name, String scrollSelector, String selectors, int count) throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector(" + JSONObject.quote(scrollSelector) + ").scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Annual note frame did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const targets = Array.from(document.querySelectorAll(" + JSONObject.quote(selectors) + "));" +
            " const v = visualViewport; return v && targets.length === " + count + " && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("Annual note frame targets visible: " + name, visible);
        retainScreenshot(name);
        awaitPage("Annual note frame targets remained visible: " + name, visible);
    }

    private void assertInvalidCompanyNote(String id, String helpId) throws Exception {
        awaitPage("invalid note retains raw text and its associated field error: " + id,
            "(() => { const note = document.getElementById(" + JSONObject.quote(id) + ");" +
            " const error = document.getElementById(" + JSONObject.quote(id + "-error") + ");" +
            " const save = document.querySelector('#managed-watchlist-note-help + .trial-actions > button:first-child');" +
            " const focus = document.querySelector('#managed-note-validation-focus');" +
            " return note?.value === " + JSONObject.quote(INVALID_COMPANY_NOTE) +
            " && note.disabled === false && note.maxLength === 4000" +
            " && note.getAttribute('data-managed-note-listing-id') === 'listing-alfa'" +
            " && note.getAttribute('aria-invalid') === 'true'" +
            " && note.getAttribute('aria-describedby') === " + JSONObject.quote(helpId + " " + id + "-error") +
            " && document.getElementById(" + JSONObject.quote(helpId) + ") !== null" +
            " && note.scrollHeight <= note.clientHeight && note.scrollWidth <= note.clientWidth" +
            " && error?.textContent === " + JSONObject.quote(NOTE_ERROR) +
            " && error.getAttribute('role') === 'status' && error.getAttribute('aria-live') === 'polite'" +
            " && save?.textContent === 'Save watchlist' && save.disabled === true" +
            " && focus?.textContent === 'Go to first invalid note' && focus.disabled === false" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE,ALFA'" +
            " && " + DRAFT + ".memberships?.[0]?.note === ''" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(INVALID_COMPANY_NOTE) +
            " && document.body.textContent.includes('Version 1 · Unsaved changes'); })()");
        assertCompanyNoteCounts(0, 1);
    }

    private void assertCorrectedCompanyNote() throws Exception {
        awaitPage("native correction clears the error and enables explicit Save",
            "(() => { const note = document.querySelector('#managed-note-2');" +
            " const error = document.querySelector('#managed-note-2-error');" +
            " const save = document.querySelector('#managed-watchlist-note-help + .trial-actions > button:first-child');" +
            " return note?.value === " + JSONObject.quote(COMPANY_NOTE) +
            " && note.disabled === false && note.getAttribute('data-managed-note-listing-id') === 'listing-alfa'" +
            " && note.getAttribute('aria-invalid') === null" +
            " && note.getAttribute('aria-describedby') === 'managed-watchlist-note-help'" +
            " && error?.textContent === '' && error.getAttribute('role') === 'status'" +
            " && error.getAttribute('aria-live') === 'polite'" +
            " && document.querySelector('#managed-note-validation-focus') === null" +
            " && save?.textContent === 'Save watchlist' && save.disabled === false; })()");
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
    }

    private void assertCompanyNoteDraft(int version, boolean dirty) throws Exception {
        awaitPage("company note preserves exact membership order and unrelated notes",
            "Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE,ALFA'" +
            " && " + DRAFT + ".memberships?.[0]?.note === ''" +
            " && " + DRAFT + ".memberships?.[1]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(COMPANY_NOTE) +
            " && document.body.textContent.includes(" + JSONObject.quote("Version " + version + (dirty ? " · Unsaved changes" : " · Saved")) + ")");
    }

    private void assertCompanyNoteCounts(int saves, int loads) throws Exception {
        awaitPage("company draft actions have no research, auth or unexpected write calls",
            DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".load === " + loads +
            " && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".marketsResolve === 1" +
            " && " + DIAGNOSTICS + ".search === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".eodAborted === 0 && " + DIAGNOSTICS + ".eodLateResolved === 0" +
            " && " + DIAGNOSTICS + ".marketsAborted === 0 && " + DIAGNOSTICS + ".marketsLateResolved === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    private void retainCompanyNoteScreenshot() throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('#managed-research-note-heading')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Company note did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const targets = Array.from(document.querySelectorAll(" +
            "'#managed-research-note-heading, [aria-labelledby=managed-research-note-heading] > .trial-actions > button, label[for=managed-research-note], #managed-research-note, #managed-research-note-help'));" +
            " const v = visualViewport; const note = document.querySelector('#managed-research-note');" +
            " return v && targets.length === 6 && note?.value === " + JSONObject.quote(COMPANY_NOTE) +
            " && note.scrollHeight <= note.clientHeight && note.scrollWidth <= note.clientWidth" +
            " && targets.every(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("company note label, text, draft actions and save guidance fully visible", visible);
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        retainScreenshot("companyResearchNoteDraft");
        awaitPage("company note and draft actions stayed visible through capture", visible);
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
    }

    private void clickMarketsAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(concat(' ',normalize-space(@class),' '),' managed-markets ')]//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertMarketsRows(boolean refreshedFirst) throws Exception {
        String expected = refreshedFirst
            ? "ALFA|$11.5|USD · 2026-09-20;BETA|$20.5|USD · 2026-09-19;BETB|$30.5|USD · 2026-09-19"
            : "ALFA|$10.5|USD · 2026-09-19;BETA|$20.5|USD · 2026-09-19;BETB|$30.5|USD · 2026-09-19";
        awaitPage("all exact board closes and independent trading dates",
            "Array.from(document.querySelectorAll('.managed-market-row')).map(e => e.querySelector('.managed-market-identity strong').textContent + '|' + e.querySelector('.managed-market-close strong').textContent + '|' + e.querySelector('.managed-market-close small').textContent).join(';') === " + JSONObject.quote(expected));
    }

    private void assertMarketsRawChanges(boolean refreshedFirst) throws Exception {
        String first = refreshedFirst
            ? "ALFA|Raw close change: +$0.25 (+2.2222%)|2026-09-19 to 2026-09-20"
            : "ALFA|Raw close change: +$0.25 (+2.4390%)|2026-09-18 to 2026-09-19";
        String qualification = " · not adjusted for splits or dividends.";
        String expected = first + qualification +
            ";BETA|Raw close change: -$0.25 (-1.2048%)|2026-09-18 to 2026-09-19" + qualification +
            ";BETB|Raw close change: $0 (0.0000%)|2026-09-18 to 2026-09-19" + qualification;
        awaitPage("exact within-response positive, negative and flat raw changes with both dates",
            "Array.from(document.querySelectorAll('.managed-market-rows > li')).map(e => {" +
            " const p = e.querySelector('.managed-market-change'); if (!p) return 'missing';" +
            " const value = p.querySelector('strong')?.textContent;" +
            " return e.querySelector('.managed-market-identity strong').textContent + '|' + value + '|' + p.querySelector('.managed-market-change-basis')?.textContent;" +
            " }).join(';') === " + JSONObject.quote(expected));
    }

    private void assertMarketsSharedComparison(boolean refreshedFirst) throws Exception {
        String originalCoverage = "2026-08-20 to 2026-09-20|2026-09-18 to 2026-09-19|2 / " +
            (refreshedFirst ? "1" : "0") + "|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z";
        String firstCoverage = refreshedFirst
            ? "2026-08-21 to 2026-09-21|2026-09-19 to 2026-09-20|2 / 1|2026-09-21T00:00:00.000Z|2026-09-21T00:00:02.000Z"
            : originalCoverage;
        String expectedCoverage = "ALFA · XNAS|Alfa Company · Common Stock|" + firstCoverage + "|false;" +
            "BETA · XNAS|Beta Company · Class A|" + originalCoverage + "|" + refreshedFirst + ";" +
            "BETB · XNAS|Beta Company · Class C|" + originalCoverage + "|" + refreshedFirst;
        String output = refreshedFirst
            ? "comparison.querySelector('.managed-price-comparison-values') === null" +
                " && comparison.querySelector('.managed-price-comparison-status')?.textContent === 'Comparison needs at least two dates observed for every listing. 1 shared observed date is loaded. Shared date: 2026-09-19.'" +
                " && comparison.querySelector('.managed-eod-previous')?.textContent === 'Previous history retained for BETA, BETB. Those original requests remain in this comparison.'"
            : "comparison.querySelector('.managed-price-comparison-window')?.textContent === '2026-09-18 to 2026-09-19 · 2 shared observed dates in this interval · 2 across the loaded histories'" +
                " && Array.from(comparison.querySelectorAll('tbody tr')).map(tr => tr.querySelector('th strong')?.textContent + '|' + Array.from(tr.querySelectorAll('td')).map(e => e.textContent).join('|')).join(';') === 'ALFA|10.25|10.5|+2.4390%;BETA|20.75|20.5|-1.2048%;BETB|30.5|30.5|0.0000%'" +
                " && Array.from(comparison.querySelectorAll('tbody th time')).map(e => e.textContent).join('|') === '2026-09-20T00:00:01.000Z|2026-09-20T00:00:01.000Z|2026-09-20T00:00:01.000Z'" +
                " && comparison.querySelector('.managed-eod-previous') === null";
        awaitPage("complete-board shared observations and original per-listing request provenance",
            "(() => { const comparison = document.querySelector('.managed-markets .managed-price-comparison'); if (!comparison) return false;" +
            " return " + output +
            " && Array.from(comparison.querySelectorAll('.managed-price-comparison-provenance > section')).map(section =>" +
            " section.querySelector('h4')?.textContent + '|' + section.querySelector('p')?.textContent + '|' +" +
            " Array.from(section.querySelectorAll('dd')).map(e => e.textContent).join('|') + '|' +" +
            " (section.querySelector('.managed-eod-previous') !== null)).join(';') === " + JSONObject.quote(expectedCoverage) +
            "; })()");
        assertMarketsComparisonDates(refreshedFirst ? "" : "2026-09-18", refreshedFirst ? "" : "2026-09-19",
            refreshedFirst ? "" : "|2026-09-18", refreshedFirst ? "" : "|2026-09-19");
    }

    private void assertMarketsComparisonDates(String start, String end, String startOptions, String endOptions) throws Exception {
        awaitPage("shared native date controls stay labelled and mounted with exact observed options",
            "(() => { const first = document.querySelector('.managed-markets .managed-price-comparison-start-select');" +
            " const last = document.querySelector('.managed-markets .managed-price-comparison-end-select');" +
            " return first instanceof HTMLSelectElement && last instanceof HTMLSelectElement" +
            " && !first.disabled && !last.disabled && first.value === " + JSONObject.quote(start) +
            " && last.value === " + JSONObject.quote(end) +
            " && first.labels[0]?.querySelector('span')?.textContent === 'Shared comparison start date'" +
            " && last.labels[0]?.querySelector('span')?.textContent === 'Shared comparison end date'" +
            " && [...first.options].map(e => e.value).join('|') === " + JSONObject.quote(startOptions) +
            " && [...last.options].map(e => e.value).join('|') === " + JSONObject.quote(endOptions) + "; })()");
    }

    private void assertMarketsComparisonOrder(String order, String symbols, String expectedRows) throws Exception {
        String sort = order.equals("highest") ? "descending" : "ascending";
        String coverage = "2026-08-20 to 2026-09-20|2026-09-18 to 2026-09-19|2 / 0|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z";
        String expectedCoverage = "ALFA · XNAS|Alfa Company · Common Stock|" + coverage + "|false;" +
            "BETA · XNAS|Beta Company · Class A|" + coverage + "|false;" +
            "BETB · XNAS|Beta Company · Class C|" + coverage + "|false";
        awaitPage("native comparison order preserves exact values and original per-listing evidence: " + order,
            "(() => { const comparison = document.querySelector('.managed-markets .managed-price-comparison'); if (!comparison) return false;" +
            " const select = comparison.querySelector('.managed-price-comparison-order select');" +
            " return select instanceof HTMLSelectElement && !select.disabled && select.value === " + JSONObject.quote(order) +
            " && select.labels[0]?.querySelector('span')?.textContent === 'Comparison order'" +
            " && comparison.querySelector('th[aria-sort]')?.getAttribute('aria-sort') === " + JSONObject.quote(sort) +
            " && comparison.querySelector('.managed-price-comparison-window')?.textContent === '2026-09-18 to 2026-09-19 · 2 shared observed dates in this interval · 2 across the loaded histories'" +
            " && Array.from(comparison.querySelectorAll('tbody tr')).map(tr => tr.querySelector('th strong')?.textContent + '|' + Array.from(tr.querySelectorAll('td')).map(e => e.textContent).join('|')).join(';') === " + JSONObject.quote(expectedRows) +
            " && Array.from(comparison.querySelectorAll('.managed-price-comparison-provenance h4')).map(e => e.textContent.split(' · ')[0]).join(',') === " + JSONObject.quote(symbols) +
            " && Array.from(comparison.querySelectorAll('.managed-price-comparison-provenance > section')).map(section =>" +
            " section.querySelector('h4')?.textContent + '|' + section.querySelector('p')?.textContent + '|' +" +
            " Array.from(section.querySelectorAll('dd')).map(e => e.textContent).join('|') + '|' +" +
            " (section.querySelector('.managed-eod-previous') !== null)).sort().join(';') === " + JSONObject.quote(expectedCoverage) +
            "; })()");
    }

    private void assertMarketsDetail(String symbol, String rows, boolean previous) throws Exception {
        awaitPage("selected board history and source dates: " + symbol,
            "document.querySelector('.managed-market-period')?.textContent === " + JSONObject.quote(symbol + " · one month") +
            " && document.querySelector('.managed-market-detail caption')?.textContent === 'Raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-market-detail tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === " + JSONObject.quote(rows) +
            " && Array.from(document.querySelectorAll('.managed-market-detail .managed-metadata dd')).map(e => e.textContent).join('|') === '2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && (document.querySelector('.managed-market-detail .managed-eod-previous') !== null) === " + previous +
            " && document.querySelector('.managed-market-detail')?.textContent.includes('Data provided by Tiingo.')");
    }

    private void assertMarketsDraftAndCounts(int resolves, int reads, int aborted, int late) throws Exception {
        awaitPage("Markets exact calls and mounted draft",
            DIAGNOSTICS + ".marketsResolve === " + resolves + " && " + DIAGNOSTICS + ".marketsEod === " + reads +
            " && " + DIAGNOSTICS + ".marketsAborted === " + aborted + " && " + DIAGNOSTICS + ".marketsLateResolved === " + late +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 1" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
    }

    private void assertMarketsCompanyHistory(String close, String date, String window, String started,
            String completed, String rows, boolean fromMarkets, boolean previous) throws Exception {
        String metadata = close + "|" + date + "|" + window + "|" + started + "|" + completed;
        awaitPage("company history preserves complete response dates and explicit origin",
            "document.querySelector('.managed-eod-history caption')?.textContent === 'Raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === " + JSONObject.quote(rows) +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === " + JSONObject.quote(metadata) +
            " && (document.querySelector('.managed-eod-history .managed-eod-origin') !== null) === " + fromMarkets +
            (fromMarkets ? " && document.querySelector('.managed-eod-history .managed-eod-origin')?.textContent === 'Showing history loaded in Markets. Original dates and request times are unchanged.'" : "") +
            " && (document.querySelector('.managed-eod-history .managed-eod-previous') !== null) === " + previous +
            (previous ? " && document.querySelector('.managed-eod-history .managed-eod-previous')?.textContent === " +
                JSONObject.quote("Showing previous close history, completed " + completed + ". This refresh has not confirmed newer prices. Trading dates, requested window and request times are unchanged.") : "") +
            " && document.querySelector('.managed-eod-history [role=alert]') === null" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Data provided by Tiingo.')");
    }

    private void assertMarketsHandoffDraftAndCounts(int resolves, int eod, int saves, int loads) throws Exception {
        awaitPage("handoff keeps source reads explicit and preserves the complete three-member draft",
            DIAGNOSTICS + ".marketsResolve === " + resolves + " && " + DIAGNOSTICS + ".marketsEod === 5" +
            " && " + DIAGNOSTICS + ".marketsAborted === 1 && " + DIAGNOSTICS + ".marketsLateResolved === 1" +
            " && " + DIAGNOSTICS + ".eod === " + eod + " && " + DIAGNOSTICS + ".save === " + saves + " && " + DIAGNOSTICS + ".load === " + loads +
            " && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 1 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".eodAborted === 0 && " + DIAGNOSTICS + ".eodLateResolved === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[2]?.note === " + JSONObject.quote(MARKETS_PRICE_NOTE) +
            " && document.querySelectorAll('.managed-watchlist-choices li').length === 3" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO,BETA'" +
            " && document.body.textContent.includes(" + JSONObject.quote(saves == 0 ? "Version 1 · Unsaved changes" : "Version 2 · Saved") + ")" +
            " && Array.from(document.querySelectorAll('[aria-labelledby=managed-watchlist-heading] button')).find(button => button.textContent === 'Save watchlist')?.disabled === " + (saves != 0));
    }

    private void assertSelectedMarketRows(boolean refreshed, boolean previous) throws Exception {
        String first = refreshed ? "ALFA|$11.5|USD · 2026-09-20" : "ALFA|$10.5|USD · 2026-09-19";
        String change = refreshed ? "Raw close change: +$0.25 (+2.2222%)" : "Raw close change: +$0.25 (+2.4390%)";
        String dates = refreshed ? "2026-09-19 to 2026-09-20" : "2026-09-18 to 2026-09-19";
        awaitPage("only ALFA owns a dated history and raw change",
            "Array.from(document.querySelectorAll('.managed-market-row')).map(e => e.querySelector('.managed-market-identity strong').textContent + '|' + e.querySelector('.managed-market-close strong').textContent + '|' + e.querySelector('.managed-market-close small').textContent).join(';') === " +
                JSONObject.quote(first + ";BETA|Not loaded|Load prices when ready;BETB|Not loaded|Load prices when ready") +
            " && document.querySelectorAll('.managed-market-rows .managed-market-change').length === 1" +
            " && document.querySelector('.managed-market-rows > li:first-child .managed-market-change strong')?.textContent === " + JSONObject.quote(change) +
            " && document.querySelector('.managed-market-rows > li:first-child .managed-market-change-basis')?.textContent === " +
                JSONObject.quote(dates + " · not adjusted for splits or dividends.") +
            " && Array.from(document.querySelectorAll('.managed-market-rows > li')).filter(e => e.querySelector('.managed-eod-previous')).map(e => e.querySelector('.managed-market-identity strong').textContent).join(',') === " + JSONObject.quote(previous ? "ALFA" : "") +
            " && Array.from(document.querySelectorAll('.managed-market-rows > li')).slice(1).every(e => e.querySelector('.managed-market-change') === null && e.querySelector('.managed-eod-previous') === null)" +
            " && Array.from(document.querySelectorAll('.managed-market-identity small')).map(e => e.textContent).join('|') === 'Common Stock · XNAS|Class A · XNAS|Class C · XNAS'");
    }

    private void assertRefreshedSelectedMarketDetail() throws Exception {
        awaitPage("selected ALFA refresh replaces all values and request dates together",
            "document.querySelector('.managed-market-period')?.textContent === 'ALFA · one month'" +
            " && document.querySelector('.managed-market-detail caption')?.textContent === 'Raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-market-detail tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-19|11.25;2026-09-20|11.5'" +
            " && Array.from(document.querySelectorAll('.managed-market-detail .managed-metadata dd')).map(e => e.textContent).join('|') === '2026-08-21 to 2026-09-21|2026-09-21T00:00:00.000Z|2026-09-21T00:00:02.000Z'" +
            " && document.querySelector('.managed-market-detail .managed-eod-previous') === null" +
            " && Array.from(document.querySelectorAll('.managed-market-detail button')).some(b => b.textContent === 'Refresh ALFA price' && !b.disabled)");
    }

    private void retainSelectedMarketPriceScreenshot() throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-market-rows')?.scrollIntoView({block:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Selected-price rows did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const rows = Array.from(document.querySelectorAll('.managed-market-rows > li')); const v = visualViewport;" +
            " if (rows.length !== 3 || !v) return false; const targets = rows.flatMap(row => [row.querySelector('.managed-market-identity'), row.querySelector('.managed-market-close')]);" +
            " targets.push(rows[0].querySelector('.managed-market-change'), rows[0].querySelector('.managed-market-change-basis'));" +
            " return document.documentElement.scrollWidth <= document.documentElement.clientWidth" +
            " && targets.every(e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("ALFA's dated price and both untouched listings are fully visible", visible);
        assertSelectedMarketRows(false, false);
        assertMarketsDraftAndCounts(2, 1, 0, 0);
        retainScreenshot("marketsSelectedPrice");
        awaitPage("one loaded listing and two unloaded listings stayed visible through capture", visible);
        assertSelectedMarketRows(false, false);
        assertMarketsDraftAndCounts(2, 1, 0, 0);
    }

    private void retainMarketsRawChangeScreenshot() throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-market-rows > li')?.scrollIntoView({block:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Markets raw-change row did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const row = document.querySelector('.managed-market-rows > li'); const v = visualViewport;" +
            " if (!row || !v) return false; const targets = [row.querySelector('.managed-market-identity')," +
            " row.querySelector('.managed-market-close'), row.querySelector('.managed-market-change'), row.querySelector('.managed-market-change-basis')];" +
            " return document.documentElement.scrollWidth <= document.documentElement.clientWidth" +
            " && targets.every(e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("ALFA identity, close, raw change and both dates fully visible", visible);
        assertMarketsRawChanges(false);
        assertMarketsDraftAndCounts(2, 3, 0, 0);
        retainScreenshot("marketsBoardRawChanges");
        awaitPage("dated raw change stayed visible through capture", visible);
        assertMarketsRawChanges(false);
        assertMarketsDraftAndCounts(2, 3, 0, 0);
    }

    private void retainMarketsLoadedScreenshot() throws Exception {
        awaitPage("Markets real canvas rendered",
            "document.querySelector('.managed-market-detail canvas')?.width > 0 && document.querySelector('.managed-market-detail canvas')?.height > 0");
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-market-detail canvas')?.scrollIntoView({block:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Markets canvas did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const c = document.querySelector('.managed-market-detail canvas'); const v = visualViewport;" +
            " if (!c || !v || c.width <= 0 || c.height <= 0) return false; const r = c.getBoundingClientRect();" +
            " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; })()";
        awaitPage("Markets canvas visible", visible);
        retainScreenshot("marketsBoardLoaded");
        awaitPage("Markets canvas remained visible through capture", visible);
    }

    private void assertResearchSwitchDraftAndCounts(int annualReads, int eodReads, int lateAnnual) throws Exception {
        assertFixtureReadCounts(annualReads, 1, lateAnnual);
        awaitPage("panel switching retains draft and exact EOD calls",
            DIAGNOSTICS + ".eod === " + eodReads + " && " + DIAGNOSTICS + ".eodAborted === 0" +
            " && " + DIAGNOSTICS + ".eodLateResolved === 0" +
            " && (document.querySelector('.managed-company-visit') === null || (" +
            "document.querySelector('.managed-company-identity strong')?.textContent === 'Zero Company'" +
            " && document.querySelector('.managed-company-identity span')?.textContent === 'Zero Class A · Class A · XNAS'" +
            " && document.querySelectorAll('.managed-company-sections button').length === 3" +
            " && document.querySelectorAll('.managed-company-sections button[aria-pressed=true]').length === 1))" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
    }

    private void retainSwitchedEodScreenshot(String loadedEod) throws Exception {
        awaitPage("switched EOD canvas rendered",
            "document.querySelector('.managed-eod-history canvas')?.width > 0" +
            " && document.querySelector('.managed-eod-history canvas')?.height > 0");
        CountDownLatch headerScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('#managed-company-heading')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> headerScrolled.countDown()));
        assertTrue("Company visit header did not scroll into view", headerScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String headerVisible = "(() => { const targets = Array.from(document.querySelectorAll(" +
            "'#managed-company-heading, .managed-company-visit > .trial-toolbar > button, .managed-company-identity strong, .managed-company-identity span'));" +
            " const v = visualViewport; return v && targets.length === 4 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("company identity and Back fully visible", headerVisible);
        awaitPage("retained Price evidence before company header capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainScreenshot("researchCompanyHeader");
        awaitPage("company identity and Back stayed visible through capture", headerVisible);
        awaitPage("retained Price evidence after company header capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);

        CountDownLatch sectionsScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-company-sections')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> sectionsScrolled.countDown()));
        assertTrue("Company section controls did not scroll into view", sectionsScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String sectionsVisible = "(() => { const targets = Array.from(document.querySelectorAll(" +
            "'.managed-company-sections button, #managed-eod-heading')); const v = visualViewport;" +
            " return v && targets.length === 4 && targets.every(e => { const r = e.getBoundingClientRect();" +
            " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("all three section controls and active Price heading fully visible", sectionsVisible);
        awaitPage("retained Price evidence before section controls capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainScreenshot("researchCompanySections");
        awaitPage("section controls and Price heading stayed visible through capture", sectionsVisible);
        awaitPage("retained Price evidence after section controls capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);

        CountDownLatch metadataScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-eod-history .managed-eod-quote')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> metadataScrolled.countDown()));
        assertTrue("Retained history metadata did not scroll into view", metadataScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String metadataVisible = "(() => { const targets = Array.from(document.querySelectorAll(" +
            "'.managed-eod-history .managed-eod-quote > dt, .managed-eod-history .managed-eod-quote > dd'));" +
            " const v = visualViewport; return v && targets.length === 4 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("retained close and trading date label and value pairs visible", metadataVisible);
        awaitPage("retained Price evidence before history capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainScreenshot("researchSwitchEodLoaded");
        awaitPage("retained history metadata stayed visible through capture", metadataVisible);
        awaitPage("retained Price evidence after history capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);

        awaitPage("history source disclosure starts closed",
            "document.querySelector('.managed-eod-source')?.open === false");
        click(".managed-eod-source > summary");
        awaitPage("history source disclosure opens",
            "document.querySelector('.managed-eod-source')?.open === true");
        CountDownLatch sourceScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-eod-source')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> sourceScrolled.countDown()));
        assertTrue("Retained history source did not scroll into view", sourceScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String sourceVisible = "(() => { const details = document.querySelector('.managed-eod-source');" +
            " const targets = Array.from(details?.querySelectorAll('summary, .managed-metadata > dt, .managed-metadata > dd, p') || []);" +
            " const v = visualViewport; return details?.open && v && targets.length === 8 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("source window, request dates and Tiingo explanation visible", sourceVisible);
        awaitPage("retained Price evidence before source capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainScreenshot("researchSwitchEodSource");
        awaitPage("retained source stayed visible through capture", sourceVisible);
        awaitPage("retained Price evidence after source capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        click(".managed-eod-source > summary");
        awaitPage("closing source preserves exact retained history",
            "document.querySelector('.managed-eod-source')?.open === false && (" + loadedEod + ")");
        assertResearchSwitchDraftAndCounts(2, 1, 1);
    }

    private void clickEodAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(concat(' ',normalize-space(@class),' '),' managed-eod-history ')]//button[normalize-space(.)='" + label + "']"))
            .perform(webClick());
    }

    private void assertWatchlistDatedPrice() throws Exception {
        awaitPage("watchlist retains its own exact close, change and original request dates",
            "(() => { const row = document.querySelector('[data-watchlist-selection=\"listing-zero\"]');" +
            " const selected = document.querySelector('#managed-watchlist-selected-price');" +
            " const readouts = [row?.querySelector('.managed-watchlist-price-readout'), selected];" +
            " return row?.querySelector(':scope > strong')?.textContent === 'ZERO'" +
            " && row?.getAttribute('aria-pressed') === 'true'" +
            " && readouts.every(value => value?.querySelector(':scope > strong')?.textContent === '$101.5'" +
            " && value?.querySelector('small')?.textContent === 'USD raw close · 2026-09-19'" +
            " && value?.querySelector('.managed-market-change > strong')?.textContent === 'Raw close change: +$1.25 (+1.2469%)'" +
            " && Array.from(value.querySelectorAll('time')).map(time => time.textContent).join('|') === '2026-09-18|2026-09-19')" +
            " && document.querySelector('[data-watchlist-price-load]')?.textContent === 'Refresh ZERO price'" +
            " && document.querySelector('[data-watchlist-price-load]')?.disabled === false" +
            " && document.querySelector('.managed-watchlist-price-source')?.open === true" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-price-source dd')).map(value => value.textContent).join('|') === '2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && document.querySelector('.managed-watchlist-price-source')?.textContent.includes('Data provided by Tiingo.')" +
            " && document.querySelector('.managed-watchlist-prices .managed-eod-previous') === null; })()");
    }

    private void assertEodState(int reads, int aborted, int late, boolean pending, boolean rows) throws Exception {
        assertEodDraftAndCounts(reads, aborted, late);
        awaitPage("EOD state reads=" + reads + ", pending=" + pending + ", rows=" + rows,
            "document.querySelector('.managed-eod-history') !== null" +
            " && document.querySelector('.managed-annual-report') === null" +
            " && document.querySelector('.managed-eod-history')?.getAttribute('aria-busy') === '" + pending + "'" +
            " && (document.querySelector('.managed-eod-history .managed-metadata') !== null) === " + rows +
            " && (document.querySelector('.managed-eod-history .managed-eod-chart') !== null) === " + rows +
            " && document.querySelectorAll('.managed-eod-history .managed-eod-table-scroll > table > tbody tr').length === " + (rows ? 2 : 0));
    }

    private void assertEodDraftAndCounts(int reads, int aborted, int late) throws Exception {
        awaitPage("EOD preserves draft and exact operation counts",
            "" + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')" +
            " && " + DIAGNOSTICS + ".eod === " + reads + " && " + DIAGNOSTICS + ".eodAborted === " + aborted +
            " && " + DIAGNOSTICS + ".eodLateResolved === " + late +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 1" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    private String inspectedEodClose(String date, String close) {
        return "(() => { const c = document.querySelector('.managed-eod-history canvas');" +
            " const t = document.querySelector('.managed-eod-history .managed-eod-tooltip'); const v = visualViewport;" +
            " if (!c || !t || !v || v.width > 600) return false;" +
            " const visible = e => { if (!e) return false; const r = e.getBoundingClientRect();" +
            " for (let p=e;p;p=p.parentElement) { const s=getComputedStyle(p);" +
            " if (s.visibility !== 'visible' || s.display === 'none' || Number(s.opacity) === 0) return false; }" +
            " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; };" +
            " const frame=t.parentElement, bounds=c.getBoundingClientRect(), tip=frame.getBoundingClientRect();" +
            " return document.querySelectorAll('.managed-eod-tooltip').length === 1" +
            " && t.getAttribute('role') === 'tooltip'" +
            " && t.querySelector('.managed-eod-tooltip-date')?.textContent === " + JSONObject.quote(date) +
            " && t.querySelector('.managed-eod-tooltip-close')?.textContent === " + JSONObject.quote("Raw close (USD): " + close) +
            " && visible(c) && visible(frame) && visible(t) && visible(t.querySelector('.managed-eod-tooltip-date'))" +
            " && visible(t.querySelector('.managed-eod-tooltip-close'))" +
            " && tip.left >= bounds.left && tip.right <= bounds.right && tip.top >= bounds.top && tip.bottom <= bounds.bottom; })()";
    }

    private void touchEodObservation(boolean last) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const c=document.querySelector('.managed-eod-history canvas'); if (!c) return null;" +
            " c.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});" +
            " const r=c.getBoundingClientRect(),v=visualViewport;" +
            // Current shared chart grid and two equal category bands; input is a real native touch.
            " const x=r.left+64+(r.width-84)*" + (last ? "0.75" : "0.25") + ",y=r.top+24+(r.height-72)/2;" +
            " return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
            " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite)" +
            " &&r.width>84&&r.height>72&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
            " visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height," +
            " hit:c===document.elementFromPoint(x,y)};})()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Chart touch geometry was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        touchObservedGeometry(last ? "eod-last-observation" : "eod-first-observation", observed.get());
    }

    private void retainEodLoadedScreenshot() throws Exception {
        awaitPage("invented EOD canvas rendered",
            "document.querySelector('.managed-eod-history canvas')?.width > 0" +
            " && document.querySelector('.managed-eod-history canvas')?.height > 0");
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-eod-history canvas')?.scrollIntoView({block:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("EOD chart did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const c = document.querySelector('.managed-eod-history canvas'); const v = visualViewport;" +
            " if (!c || !v || c.width <= 0 || c.height <= 0) return false; const r = c.getBoundingClientRect();" +
            " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; })()";
        awaitPage("invented EOD canvas visible", visible);
        retainScreenshot("eodLoaded");
        awaitPage("invented EOD canvas stayed visible", visible);
    }

    private org.json.JSONArray canonicalAnnualConceptRows(JSONObject evidence, String concept) throws org.json.JSONException {
        org.json.JSONArray observations = evidence.getJSONObject("facts").getJSONArray("observations");
        org.json.JSONArray selected = new org.json.JSONArray();
        for (int index = 0; index < observations.length(); index++) {
            JSONObject row = observations.getJSONObject(index);
            if (row.getString("concept").equals(concept)) selected.put(row);
        }
        return selected;
    }

    /** Fixed metadata in this test's copied HTML is read before the fixture's sole React mount. */
    private void selectDraftFileFixtureScenario() throws IOException {
        String selected = DRAFT_FILE_SCENARIOS.getOrDefault(testName.getMethodName(), "");
        if (!selected.isEmpty()) selectFixtureScenario(selected);
    }

    private void selectFixtureScenario(String scenarioName) throws IOException {
        assertTrue("Only fixed invented fixture scenarios are allowed",
            ALLOWED_FIXTURE_SCENARIOS.contains(scenarioName));
        File index = new File(fixtureDirectory, "index.html");
        byte[] original = Files.readAllBytes(index.toPath());
        assertTrue("Fixture index exceeded its bound", original.length > 0 && original.length <= 65536);
        String html = new String(original, StandardCharsets.UTF_8);
        assertEquals("Fixture must have one head end", html.indexOf("</head>"), html.lastIndexOf("</head>"));
        assertTrue("Fixture head is absent", html.contains("</head>"));
        assertFalse("Fixture scenario was already selected", html.contains("investment-android-test-scenario"));
        byte[] selected = html.replace("</head>",
            "<meta name=\"investment-android-test-scenario\" content=\"" + scenarioName + "\"></head>")
            .getBytes(StandardCharsets.UTF_8);
        assertTrue("Selected fixture index exceeded its bound", selected.length <= 65536);
        copiedBytes += selected.length - original.length;
        Files.write(index.toPath(), selected);
    }

    private void assertCatalogRecoveryState(int statusCalls, int searchCalls, String query, boolean pending, boolean recovered, String message) throws Exception {
        awaitPage("catalog recovery status=" + statusCalls + ", search=" + searchCalls + ", pending=" + pending,
            "(() => { const d = " + DIAGNOSTICS + "; const discover = document.querySelector(" + JSONObject.quote(DISCOVER) + ");" +
            " const refresh = document.querySelector(" + JSONObject.quote(CATALOG_REFRESH) + ");" +
            " const search = document.querySelector('.workspace-global-search button[type=submit]');" +
            " const receipt = discover.querySelector('.managed-catalog-receipt');" +
            " return d.catalogRecovery && d.load === 1 && d.status === " + statusCalls + " && d.search === " + searchCalls +
            " && d.catalogReleased === " + (recovered ? 1 : 0) +
            " && d.save === 0 && d.resolve === 0 && d.annual === 0 && d.token === 0 && d.signOut === 0" +
            " && d.aborted === 0 && d.lateResolved === 0" +
            " && refresh.disabled === " + pending + " && refresh.textContent === " + JSONObject.quote(pending ? "Loading catalog…" : "Refresh catalog") +
            " && search.disabled === " + pending + " && search.textContent === 'Search'" +
            " && document.querySelector('#workspace-company-query')?.disabled === false" +
            " && document.querySelector('#workspace-company-query')?.value === " + JSONObject.quote(query) +
            " && document.querySelector(" + JSONObject.quote(CATALOG_STATUS) + ")?.textContent === " + JSONObject.quote(message) +
            " && (receipt !== null) === " + recovered +
            (recovered ? " && receipt.querySelector('summary').textContent === '5 available listings · Catalog as of 2026-09-20T00:00:00.000Z'" +
                " && receipt.textContent.includes('android-invented-catalog · fixture-v1')" +
                " && receipt.textContent.includes('Synthetic engineering data')" +
                " && receipt.textContent.includes('sha256:' + 'a'.repeat(64))" : "") +
            " && Array.from(discover.querySelectorAll('.managed-results strong')).map(e => e.textContent).join(',') === " + JSONObject.quote(searchCalls == 1 ? "ZERO" : "") +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')" +
            " && document.querySelector('.managed-annual-report') === null; })()");
    }

    private void retainCatalogRecoveryScreenshot(String name, String scrollSelector, String visibleSelectors) throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector(" + JSONObject.quote(scrollSelector) + ").scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Catalog screenshot did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const targets = Array.from(document.querySelectorAll(" + JSONObject.quote(visibleSelectors) + "));" +
            " const v = visualViewport; return v && targets.length === 2 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("catalog screenshot targets visible: " + name, visible);
        retainScreenshot(name);
        awaitPage("catalog screenshot targets remained visible: " + name, visible);
    }

    private void assertLiquidityNoteDraft(String excerpt, int annualCalls) throws Exception {
        String action = ".managed-annual-liquidity-note-action > button";
        String status = ".managed-annual-liquidity-note-status";
        String originalDraft = readFixtureString("JSON.stringify(" + DRAFT + ")");
        String originalCalls = readFixtureString("JSON.stringify(" + DIAGNOSTICS + ")");
        String prefix = "Latest liquidity research draft " + annualCalls + ".";
        String complete = prefix + " " + excerpt;
        awaitPage("liquidity action is labelled, associated, focusable and available",
            "(() => { const b = document.querySelector(" + JSONObject.quote(action) + ");" +
            " return b && !b.disabled && b.getAttribute('aria-disabled') === 'false'" +
            " && b.textContent === 'Add liquidity to note draft' && b.getBoundingClientRect().height >= 44" +
            " && document.getElementById(b.getAttribute('aria-describedby'))?.textContent.includes('Nothing is saved here.'); })()");
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", NOTE, prefix);
        click(action);
        String exact = "(() => { const expected = JSON.parse(" + JSONObject.quote(originalDraft) + ");" +
            " expected.memberships[1].note = " + JSONObject.quote(complete) + ";" +
            " return JSON.stringify(" + DRAFT + ") === JSON.stringify(expected)" +
            " && expected.memberships.map(m => m.listingId).join(',') === 'listing-one,listing-zero'" +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(complete) +
            " && document.body.textContent.includes('Version 1 · Unsaved changes'); })()";
        awaitPage("liquidity append uses latest prose and exact values, qualification and original dates", exact +
            " && document.querySelector(" + JSONObject.quote(status) + ")?.textContent === " +
                JSONObject.quote("Liquidity added to the note draft. Review and save all changes in My Watchlist."));
        awaitPage("liquidity duplicate remains focusable with an associated refusal",
            "(() => { const b = document.querySelector(" + JSONObject.quote(action) + "); return b && !b.disabled" +
            " && b.getAttribute('aria-disabled') === 'true'" +
            " && document.getElementById(b.getAttribute('aria-describedby'))?.textContent === " +
                JSONObject.quote("This exact liquidity reference is already in the note draft.") + "; })()");
        click(action);
        awaitPage("duplicate liquidity activation leaves the complete draft unchanged", exact +
            " && document.querySelector(" + JSONObject.quote(status) + ")?.textContent === " +
                JSONObject.quote("This exact liquidity reference is already in the note draft."));
        awaitPage("liquidity drafting adds no source read or durable write",
            "JSON.stringify(" + DIAGNOSTICS + ") === " + JSONObject.quote(originalCalls) +
            " && " + DIAGNOSTICS + ".annual === " + annualCalls + " && " + DIAGNOSTICS + ".save === 0" +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".aborted === 0" +
            " && " + DIAGNOSTICS + ".lateResolved === 0");
        assertFixtureBoundary();
        touchInput("managed-research-note");
        replaceFocusedInput("managed-research-note", complete, NOTE);
        awaitPage("restoring the original note clears duplicate refusal before inherited checks",
            "JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(originalDraft) +
            " && document.querySelector('#managed-research-note')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector(" + JSONObject.quote(action) + ")?.getAttribute('aria-disabled') === 'false'" +
            " && document.querySelector(" + JSONObject.quote(status) + ")?.textContent === ''");
    }

    private void assertRefreshReport(int annualCalls, boolean previous, boolean running, boolean recovered) throws Exception {
        String generation = recovered ? "recovered" : "initial";
        awaitPage("Annual refresh evidence: calls=" + annualCalls + ", previous=" + previous + ", running=" + running,
            "(() => { const report = document.querySelector('.sec-quarterly-comparison');" +
            " const panel = document.querySelector('.managed-annual-report');" +
            " const generations = JSON.parse(document.querySelector('#fixture-report-generations').textContent);" +
            " const wanted = generations." + generation + ";" +
            " const other = generations." + (recovered ? "initial" : "recovered") + ";" +
            " return report !== null && report.textContent.includes(wanted.sha256)" +
            " && report.textContent.includes(wanted.completedAt) && report.textContent.includes(wanted.cutoffAt)" +
            " && report.textContent.includes(wanted.sources.companyFacts.fetchedAt)" +
            " && report.textContent.includes(wanted.sources.submissions.fetchedAt)" +
            " && !report.textContent.includes(other.sha256)" +
            " && Array.from(report.querySelectorAll('.managed-annual-values tbody tr td:first-of-type')).map(e => e.textContent).join(',') === " +
                JSONObject.quote(recovered ? "2000,300,15%" : "1000,100,10%") +
            " && panel.textContent.includes('Showing the previous report') === " + previous +
            " && panel.getAttribute('aria-busy') === '" + running + "'" +
            " && " + DIAGNOSTICS + ".annual === " + annualCalls +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 1" +
            " && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes'); })()");
        assertRefreshLiquidity(recovered);
    }

    private void assertRefreshLiquidity(boolean recovered) throws Exception {
        awaitPage("Annual liquidity retains exact balances and independently bounds current ratio",
            "(() => { const panel = document.querySelector('.sec-annual-liquidity');" +
            " const rows = Array.from(panel?.querySelectorAll(':scope > .sec-annual-liquidity-results tbody tr') ?? []);" +
            " const amounts = rows.map(row => row.querySelector('.sec-annual-liquidity-amount')?.textContent ?? 'Unavailable');" +
            " return panel?.getAttribute('aria-label') === 'Annual liquidity' && rows.length === 4" +
            " && panel.querySelector('caption')?.textContent === 'Balances at 2025-12-31'" +
            " && rows.map(row => row.querySelector('th').textContent).join('|') === 'Current assetsReported · USD|Current liabilitiesReported · USD|Working capitalApp calculation · USD|Current ratioApp calculation · multiple'" +
            " && amounts.join(',') === " + JSONObject.quote(recovered ? "120.125,0,120.125,Unavailable" : "120.125,80.025,40.1,1.50×") +
            " && rows.slice(0, " + (recovered ? 3 : 4) + ").every(row => row.querySelector('td > small:first-of-type')?.textContent === 'At 2025-12-31' && row.querySelector('td > small:last-of-type')?.textContent === 'Within current-use limits at this load.')" +
            " && (rows[3].querySelector('.sec-annual-liquidity-unavailable')?.textContent ?? '') === " + JSONObject.quote(recovered ? "Unavailable. Current ratio requires current liabilities greater than zero." : "") +
            " && panel.querySelector('p').textContent.includes('Current ratio is a rounded multiple.')" +
            " && panel.querySelector('p:last-of-type').textContent.includes('rounds to two decimal places, half up.'); })()");
    }

    private void assertRefreshLiquiditySources(boolean recovered) throws Exception {
        String source = ".sec-annual-liquidity > .sec-annual-liquidity-source";
        String inputs = source + " > section > ol > li > details";
        String capturedDay = recovered ? "2026-09-21" : "2026-09-20";
        awaitPage("liquidity provenance starts closed",
            "document.querySelector('.sec-annual-liquidity > .sec-annual-liquidity-source')?.open === false");
        click(source + " > summary");
        awaitPage("liquidity shows its original cutoff and bounded instant observations",
            "document.querySelector('.sec-annual-liquidity > .sec-annual-liquidity-source')?.open === true" +
            " && document.querySelector('.sec-annual-liquidity > .sec-annual-liquidity-source > p:first-of-type')?.textContent === " + JSONObject.quote("Annual cutoff " + capturedDay + "T00:00:00.000Z. Company Facts captured " + capturedDay + "T00:00:01.000Z. Submissions captured " + capturedDay + "T00:00:02.000Z. Completed " + capturedDay + "T00:00:02.000Z.") +
            " && Array.from(document.querySelectorAll('.sec-annual-liquidity > .sec-annual-liquidity-source > section > p')).map(e => e.textContent).join('|') === 'Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.|Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(inputs + " > summary") + ")).map(e => e.textContent).join('|') === " + JSONObject.quote("AssetsCurrent · Source end 2025-12-31 · 120.125 USD|LiabilitiesCurrent · Source end 2025-12-31 · " + (recovered ? "0" : "80.025") + " USD"));
        click(source + " > section:nth-of-type(1) > ol > li > details > summary");
        click(source + " > section:nth-of-type(2) > ol > li > details > summary");
        awaitPage("instant operands retain exact filing coordinates and both calculation references",
            "(() => { const rows = Array.from(document.querySelectorAll(" + JSONObject.quote(inputs) + "));" +
            " const values = rows.map(row => Array.from(row.querySelectorAll('dd')).map(e => e.textContent));" +
            " const shared = '|2025-12-31|Not supplied|Not supplied; an instant balance requires no duration.|2025 · FY|CY2025Q4I|10-K · 2026-02-01|0000000001-26-000001|Matched to current submissions · 10-K · 2026-02-01|2025-12-31 · 2026-02-01T00:00:00.000Z|Open original filing index|';" +
            " const ids = values.map(row => row[12]);" +
            " const paragraphs = Array.from(document.querySelectorAll('.sec-annual-liquidity > .sec-annual-liquidity-source > p'));" +
            " return rows.length === 2 && rows.every(row => row.open)" +
            " && values[0].slice(0, 12).join('|') === '120.125' + shared + '/facts/us-gaap/AssetsCurrent/units/USD/0'" +
            " && values[1].slice(0, 12).join('|') === " + JSONObject.quote(recovered ? "0" : "80.025") + " + shared + '/facts/us-gaap/LiabilitiesCurrent/units/USD/0'" +
            " && rows.every(row => row.querySelector('a')?.href === 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm' && row.querySelector('a')?.target === '_blank' && row.querySelector('a')?.rel === 'noreferrer')" +
            " && ids.every(id => /^sec-fact:[a-f0-9]{64}$/.test(id)) && ids[0] !== ids[1]" +
            " && paragraphs.at(-2)?.textContent === 'Working capital references: ' + ids.join(' · ')" +
            " && paragraphs.at(-1)?.textContent === 'Current ratio references: ' + ids.join(' · '); })()");
        click(source + " > section:nth-of-type(1) > ol > li > details > summary");
        click(source + " > section:nth-of-type(2) > ol > li > details > summary");
        click(source + " > summary");
        awaitPage("closing liquidity provenance preserves the native draft and read count",
            "document.querySelector('.sec-annual-liquidity > .sec-annual-liquidity-source')?.open === false" +
            " && " + DIAGNOSTICS + ".annual === " + (recovered ? 3 : 1) +
            " && " + DIAGNOSTICS + ".save === 0 && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE));
    }

    private void retainRefreshFailureScreenshot() throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-annual-report [role=alert]').scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Failed-refresh status did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visibleFailure =
            "(() => { const panel = document.querySelector('.managed-annual-report');" +
            " const failure = panel?.querySelector('[role=alert]');" +
            " const notice = Array.from(document.querySelectorAll('.managed-annual-help')).find(e => e.textContent.startsWith('Showing the previous report'));" +
            " const report = panel?.querySelector('.sec-quarterly-comparison');" +
            " const original = JSON.parse(document.querySelector('#fixture-report-generations').textContent).initial;" +
            " const v = visualViewport; const visible = e => { if (!e || !v) return false;" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; };" +
            " return visible(failure) && visible(notice) && panel.getAttribute('aria-busy') === 'false'" +
            " && failure.textContent === 'The annual report refresh failed. Try refreshing again when you are ready.'" +
            " && notice.textContent.includes(original.completedAt) && report?.textContent.includes(original.sha256)" +
            " && panel.querySelector('.trial-actions button:first-child')?.disabled === false" +
            " && " + DIAGNOSTICS + ".annual === 2 && " + DIAGNOSTICS + ".refreshFailed === 1; })()";
        awaitPage("failed refresh and previous-report notice visible", visibleFailure);
        retainScreenshot("annualRefreshPreviousReport");
        awaitPage("failed refresh stayed unchanged through capture", visibleFailure);
        Log.i("ManagedRefresh", "phase=failed-screenshot-captured; " + pageDiagnostic());
    }

    private void assertPendingAnnualDraft() throws Exception {
        awaitPage("same pending Annual and unsaved draft",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'" +
            " && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
    }

    private void assertFixtureReadCounts(int annualReads, int aborted, int lateResolved) throws Exception {
        awaitPage("exact fixture calls, aborted=" + aborted + ", lateResolved=" + lateResolved,
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1" +
            " && " + DIAGNOSTICS + ".search === 1 && " + DIAGNOSTICS + ".annual === " + annualReads +
            " && " + DIAGNOSTICS + ".aborted === " + aborted +
            " && " + DIAGNOSTICS + ".lateResolved === " + lateResolved +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0");
    }

    /** Read-only document-generation evidence; never called while the Activity is stopped. */
    private double readDocumentTimeOrigin() throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "performance.timeOrigin", value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Document time origin was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        assertNotNull("Document time origin is absent", observed.get());
        double timeOrigin = Double.parseDouble(observed.get());
        assertTrue("Document time origin must be finite and positive", Double.isFinite(timeOrigin) && timeOrigin > 0);
        return timeOrigin;
    }

    private void prepareDraftAndOpenAnnual() throws Exception {
        typeIntoInput("workspace-company-query", "ZERO");
        click(".workspace-global-search button");
        awaitPage("Discover returns the invented exact listing", DIAGNOSTICS + ".search === 1" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("watchlist reordered", "Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'");
        typeIntoInput("managed-note-1", NOTE);
        awaitPage("draft note edited", "" + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE));
        click(ANNUAL);
        awaitPage("Annual panel opened", "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'" +
            " && document.querySelector(\".managed-company-sections button[aria-label='Price section for ZERO']\")?.disabled === false");
        assertCompanyHistory("listing-zero", "annual", false);
    }

    private void assertClosedDraft(boolean restoredFocus) throws Exception {
        awaitPage("Annual closed with the same draft", "document.querySelector('.managed-annual-report') === null" +
            " && " + DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-watchlist-choices li > button > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".load === 1" +
            (restoredFocus ? " && document.activeElement === document.querySelector(" + JSONObject.quote(ANNUAL) + ")" : ""));
    }

    private void assertFixtureBoundary() throws Exception {
        assertFixtureBoundary(0);
    }

    private void assertFixtureBoundary(int expectedResolves) throws Exception {
        assertFixtureBoundary(expectedResolves, 0);
    }

    private void assertFixtureBoundary(int expectedResolves, int expectedSaves) throws Exception {
        awaitPage("test-only source, origin and disconnected boundaries",
            "location.origin === 'https://localhost' && location.hash === ''" +
            " && document.querySelector('meta[name=investment-build-sha]')?.content === " + JSONObject.quote(expectedSourceSha) +
            " && document.querySelector('meta[name=investment-android-test]')?.content === 'managed-workspace'" +
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content === " + JSONObject.quote(CSP) +
            " && window.Capacitor?.getPlatform() === 'android'" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DIAGNOSTICS + ".save === " + expectedSaves + " && " + DIAGNOSTICS + ".resolve === " + expectedResolves);
    }

    private void assertRootHistory() throws Exception {
        assertExactHistory(0, "https://localhost/");
    }

    private void assertReturnedRootHistory(String listing, String section) throws Exception {
        assertExactHistory(0, "https://localhost/", companyUrl(listing, section));
    }

    private void assertCompanyHistory(String listing, String section, boolean direct) throws Exception {
        if (direct) assertExactHistory(0, companyUrl(listing, section));
        else assertExactHistory(1, "https://localhost/", companyUrl(listing, section));
    }

    private String companyUrl(String listing, String section) {
        assertTrue("Only fixed invented company IDs", listing.matches("listing-(zero|alfa|beta-a|beta-c)"));
        assertTrue("Only supported public sections", section.equals("price") || section.equals("annual") || section.equals("filings"));
        return "https://localhost/?company=" + listing + "&section=" + section;
    }

    private void assertExactHistory(int expectedIndex, String... expectedUrls) throws Exception {
        awaitPage("exact company URL transition committed",
            "location.href === " + JSONObject.quote(expectedUrls[expectedIndex]));
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            WebBackForwardList history = webView.copyBackForwardList();
            String diagnostic = "index=" + history.getCurrentIndex() + ", size=" + history.getSize() +
                ", canGoBack=" + webView.canGoBack() + ", callbacks=" + activity.getOnBackPressedDispatcher().hasEnabledCallbacks();
            Log.i("ManagedBack", diagnostic);
            assertEquals(diagnostic, expectedIndex, history.getCurrentIndex());
            assertEquals(diagnostic, expectedUrls.length, history.getSize());
            assertEquals(diagnostic, expectedIndex > 0, webView.canGoBack());
            for (int index = 0; index < expectedUrls.length; index++)
                assertEquals(diagnostic, expectedUrls[index], history.getItemAtIndex(index).getUrl());
            assertTrue(diagnostic, activity.getOnBackPressedDispatcher().hasEnabledCallbacks());
            assertEquals(expectedUrls[expectedIndex], webView.getUrl());
        });
    }

    private void click(String selector) {
        onWebView().withElement(findElement(Locator.CSS_SELECTOR, selector)).perform(webClick());
    }

    private void openPortfolioView() throws Exception {
        onWebView().withElement(findElement(Locator.XPATH, "//nav[@aria-label='Workspace']/button[normalize-space(.)='Portfolio']")).perform(webClick());
        awaitPage("Portfolio view commits and focuses its heading",
            "document.querySelector('#managed-portfolio-heading')?.textContent === 'Portfolio' && document.activeElement === document.querySelector('#managed-portfolio-heading')");
    }

    private void clickPortfolioButton(String label) {
        assertTrue("Only fixed alphabetic Portfolio button labels", label.matches("[A-Za-z ]+"));
        onWebView().withElement(findElement(Locator.XPATH, "//section[@aria-labelledby='managed-portfolio-heading']//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertPortfolioFifo(int version, boolean dirty) throws Exception {
        awaitPage("exact authored FIFO holdings, cash and gain at version " + version,
            "(() => { const d = " + PORTFOLIO_DRAFT + "; const p = d.projection; const rows = document.querySelectorAll('.managed-portfolio [aria-label=\"Authored holdings table\"] tbody tr');" +
            " return d.baseVersion === " + version + " && d.dirty === " + dirty + " && d.pendingEditor === false && p?.status === 'valid'" +
            " && p.portfolio.cashUsd === '948.00' && p.portfolio.holdings.length === 1 && p.portfolio.holdings[0].shares === '1'" +
            " && p.portfolio.holdings[0].identity.listingId === 'listing-zero' && p.portfolio.holdings[0].totalCostBasisUsd === '100.50' && p.realized.totalGainUsd === '48.50'" +
            " && rows.length === 1 && rows[0].querySelector('th')?.textContent.includes('ZERO')" +
            " && [...rows[0].querySelectorAll('td')].slice(0,2).map(e => e.textContent).join('|') === '1|USD 100.50'" +
            " && [...document.querySelectorAll('.managed-portfolio [aria-label=\"Current authored holdings\"] dl dd')].map(e => e.textContent).join('|') === 'USD 948.00|USD 48.50|USD 48.50|0 of 1'; })()");
    }

    private void addPortfolioTrade(String type, String label, String shares, String amount) throws Exception {
        String date = readFixtureString("document.querySelector('.managed-portfolio [aria-label=\"Transaction date\"]')?.value");
        assertTrue("Native trade retains its displayed authored UTC date", date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"));
        chooseNativeSelectOption(".managed-portfolio [aria-label='Transaction type']", type, label);
        chooseNativeSelectOption(".managed-portfolio [aria-label='Transaction listing']", "listing-zero", "ZERO");
        typePortfolioField("Transaction shares", shares);
        typePortfolioField("Transaction amount", amount);
        typePortfolioField("Transaction fee", "1.00");
        clickPortfolioButton("Add transaction to draft");
        awaitPage("explicit " + type + " applies and resets the native raw form",
            PORTFOLIO_DRAFT + ".pendingEditor === false && " + PORTFOLIO_DRAFT + ".ledger.transactions.length === " + (type.equals("buy") ? 1 : 2) +
            " && document.querySelector('[aria-label=\"Transaction shares\"]')?.value === '' && " + PORTFOLIO + ".save === 0" +
            " && " + PORTFOLIO_DRAFT + ".ledger.transactions.at(-1).date === " + JSONObject.quote(date));
    }

    private void typePortfolioField(String label, String text) throws Exception {
        assertTrue("Only the three fixed Portfolio decimal editors", label.equals("Transaction shares") || label.equals("Transaction amount") || label.equals("Transaction fee"));
        String selector = ".managed-portfolio input[aria-label='" + label + "']";
        String before = readFixtureString("document.querySelector(" + JSONObject.quote(selector) + ")?.value");
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const input = document.querySelector(" + JSONObject.quote(selector) + ");" +
            " if (!input) return null; input.scrollIntoView({block:'center',inline:'center',behavior:'instant'});" +
            " const r = input.getBoundingClientRect(), v = visualViewport; const x = r.left + r.width / 2, y = r.top + r.height / 2;" +
            " return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
            " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite) && r.width>0 && r.height>0 && v.width>0 && v.height>0 && v.scale>0 && devicePixelRatio>0," +
            " visible:r.left>=v.offsetLeft && r.top>=v.offsetTop && r.right<=v.offsetLeft+v.width && r.bottom<=v.offsetTop+v.height,hit:input.contains(document.elementFromPoint(x,y))}; })()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Portfolio input geometry returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        touchEditorGeometry(label, observed.get());
        awaitPage("native Portfolio editor is focused: " + label,
            "document.activeElement === document.querySelector(" + JSONObject.quote(selector) + ") && document.activeElement.disabled === false");
        awaitNativeEditor(label);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        awaitPage("native Portfolio select-all covers the complete raw value",
            "(() => { const input = document.querySelector(" + JSONObject.quote(selector) + "); return input && document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === " + before.length() + "; })()");
        awaitNativeEditor(label);
        onView(isAssignableFrom(WebView.class)).perform(typeTextIntoFocusedView(text));
        awaitPage("native Portfolio decimal text is exact: " + label,
            "document.querySelector(" + JSONObject.quote(selector) + ")?.value === " + JSONObject.quote(text));
        closeSoftKeyboard();
    }

    private void selectWorkspaceView(String label) throws Exception {
        onWebView().withElement(findElement(Locator.XPATH,
            "//nav[@aria-label='Workspace']/button[normalize-space(.)='" + label + "']")).perform(webClick());
        String expectedHeading = label.equals("My Watchlist") ? "managed-watchlist-heading" :
            label.equals("Discover") ? "managed-discover-heading" : "managed-markets-heading";
        awaitPage("visible workspace view: " + label,
            "Array.from(document.querySelectorAll('.managed-navigation button')).some(b => b.textContent === " + JSONObject.quote(label) +
            " && b.getAttribute('aria-current') === 'page')" +
            " && document.getElementById(" + JSONObject.quote(expectedHeading) + ")?.closest('section')?.hidden === false");
        if (label.equals("My Watchlist")) assertVisibleWatchlistDraft();
    }

    /** Inspect each real selected editor, then return to the selection used by the journey. */
    private void assertVisibleWatchlistDraft() throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const choices = Array.from(document.querySelectorAll('.managed-watchlist-choice'));" +
            " return [choices.length, choices.findIndex(choice => choice.getAttribute('aria-pressed') === 'true')]; })()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Watchlist selection was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        assertNotNull(observed.get());
        org.json.JSONArray selection = new org.json.JSONArray(observed.get());
        int count = selection.getInt(0);
        int selected = selection.getInt(1);
        assertTrue("Only the bounded invented watchlist is inspected", count >= 0 && count <= 3);
        awaitPage("visible listing order matches the current fixture-owned draft",
            "Array.from(document.querySelectorAll('.managed-watchlist-choice')).map(e => e.dataset.watchlistSelection).join('|') === " +
            DRAFT + ".memberships.map(member => member.listingId).join('|')");
        if (count == 0) return;
        assertTrue("Exactly one current listing must be selected", selected >= 0 && selected < count);
        for (int index = 0; index < count; index++) selectWatchlistNote(index);
        selectWatchlistNote(selected);
    }

    private void selectWatchlistNote(int index) throws Exception {
        assertTrue("Only bounded invented note positions are selected", index >= 0 && index < 3);
        awaitPage("watchlist is visible before selecting a note",
            "document.querySelector('[aria-labelledby=managed-watchlist-heading]')?.hidden === false");
        String selector = ".managed-watchlist-choices li:nth-child(" + (index + 1) + ") .managed-watchlist-choice";
        click(selector);
        awaitPage("selected editor retains the exact listing and raw draft at position " + index,
            "(() => { const choice = document.querySelector(" + JSONObject.quote(selector) + ");" +
            " const input = document.getElementById(" + JSONObject.quote("managed-note-" + index) + ");" +
            " const member = " + DRAFT + ".memberships?.[" + index + "];" +
            " return member && choice?.getAttribute('aria-pressed') === 'true'" +
            " && document.querySelectorAll('.managed-watchlist-choice[aria-pressed=true]').length === 1" +
            " && choice.dataset.watchlistSelection === member.listingId" +
            " && input?.dataset.managedNoteListingId === member.listingId" +
            " && input.value === member.note && input.getClientRects().length > 0; })()");
    }

    private void typeIntoInput(String id, String text) throws Exception {
        if (id.matches("managed-note-[0-9]+"))
            selectWatchlistNote(Integer.parseInt(id.substring("managed-note-".length())));
        touchInput(id);
        awaitPage("input focused: " + id,
            "document.activeElement === document.getElementById(" + JSONObject.quote(id) + ")");
        awaitNativeEditor(id);
        // Native keyboard events exercise React's controlled onChange path.
        // This action requires an already focused editor and does not tap the WebView center.
        onView(isAssignableFrom(WebView.class)).perform(typeTextIntoFocusedView(text));
        awaitPage("native input value: " + id,
            "document.getElementById(" + JSONObject.quote(id) + ")?.value === " + JSONObject.quote(text));
        closeSoftKeyboard();
    }

    private void replaceFocusedInput(String id, String expectedBefore, String text) throws Exception {
        String focused = "(() => { const input = document.getElementById(" + JSONObject.quote(id) + ");" +
            " return input && document.activeElement === input && input.disabled === false" +
            " && input.value === " + JSONObject.quote(expectedBefore) + "; })()";
        awaitPage("replacement keeps the exact observed editor and raw value: " + id, focused);
        awaitNativeEditor(id);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder()
            .withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        awaitPage("native select all covers the complete previous note: " + id,
            focused + " && document.getElementById(" + JSONObject.quote(id) + ").selectionStart === 0" +
            " && document.getElementById(" + JSONObject.quote(id) + ").selectionEnd === " + expectedBefore.length());
        awaitNativeEditor(id);
        onView(isAssignableFrom(WebView.class)).perform(typeTextIntoFocusedView(text));
        awaitPage("native replacement produces the exact raw note: " + id,
            "document.activeElement === document.getElementById(" + JSONObject.quote(id) + ")" +
            " && document.getElementById(" + JSONObject.quote(id) + ")?.value === " + JSONObject.quote(text));
        closeSoftKeyboard();
    }

    private void touchInput(String id) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        // Center both axes before enforcing full visibility at fractional viewport edges.
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const input = document.getElementById(" + JSONObject.quote(id) + ");" +
            " if (!input) return null; input.scrollIntoView({block:'center',inline:'center',behavior:'instant'});" +
            " const r = input.getBoundingClientRect(), v = visualViewport;" +
            " const x = r.left + r.width / 2, y = r.top + r.height / 2;" +
            " return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom," +
            " width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
            " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite)" +
            " &&r.width>0&&r.height>0&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
            " visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height," +
            " hit:input.contains(document.elementFromPoint(x,y))};})()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Input geometry was not returned: " + id, returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        touchEditorGeometry(id, observed.get());
    }

    private void touchObservedGeometry(String id, String rawGeometry) throws Exception {
        touchObservedGeometry(id, rawGeometry, null);
    }

    private void touchObservedGeometry(String id, String rawGeometry, ViewAction rollbackAction) throws Exception {
        onView(isAssignableFrom(WebView.class)).perform(new GeneralClickAction(
            Tap.SINGLE, observedTouchCoordinates(id, rawGeometry), Press.FINGER,
            InputDevice.SOURCE_TOUCHSCREEN, 0, rollbackAction));
    }

    private void touchEditorGeometry(String id, String rawGeometry) throws Exception {
        CoordinatesProvider provider = observedTouchCoordinates(id, rawGeometry);
        AtomicReference<float[]> coordinates = new AtomicReference<>();
        onView(isAssignableFrom(WebView.class)).check((view, noViewFoundException) -> {
            if (noViewFoundException != null) throw noViewFoundException;
            assertTrue("Editor WebView retains the native click visibility constraint",
                androidx.test.espresso.matcher.ViewMatchers.isDisplayingAtLeast(90).matches(view));
            coordinates.set(provider.calculateCoordinates(view));
        });
        float[] point = coordinates.get();
        assertNotNull("Editor native touch coordinates returned", point);
        long downTime = SystemClock.uptimeMillis();
        long deadline = downTime + PAGE_TIMEOUT_MS;
        MotionEvent down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, point[0], point[1], 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            // Public, app-scoped injection waits for retiring window animations before DOWN.
            // Call on the instrumentation thread; never bypass Android's obscured-touch guard.
            InstrumentationRegistry.getInstrumentation().sendPointerSync(down);
        } finally {
            down.recycle();
        }
        MotionEvent up = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            InstrumentationRegistry.getInstrumentation().sendPointerSync(up);
        } finally {
            up.recycle();
        }
        assertTrue("Single editor touch finishes within the page deadline", SystemClock.uptimeMillis() < deadline);
    }

    private CoordinatesProvider observedTouchCoordinates(String id, String rawGeometry) throws Exception {
        assertNotNull("Input geometry was null: " + id, rawGeometry);
        Log.i("ManagedInputGeometry", "id=" + id + ", geometry=" + rawGeometry.substring(0, Math.min(rawGeometry.length(), 2048)));
        JSONObject geometry = new JSONObject(rawGeometry);
        assertTrue("Invalid observed input geometry: " + id, geometry.getBoolean("finite"));
        assertTrue("Input must be fully inside the visual viewport: " + id, geometry.getBoolean("visible"));
        assertTrue("Input center must be unobscured: " + id, geometry.getBoolean("hit"));
        double cssX = geometry.getDouble("x"), cssY = geometry.getDouble("y");
        double cssWidth = geometry.getDouble("width"), cssHeight = geometry.getDouble("height");
        double offsetLeft = geometry.getDouble("offsetLeft"), offsetTop = geometry.getDouble("offsetTop");
        double pixelsPerCssPixel = geometry.getDouble("scale") * geometry.getDouble("ratio");
        assertTrue("Invalid visual-to-native scale", Double.isFinite(pixelsPerCssPixel) && pixelsPerCssPixel > 0);
        // A real touch activates Android's editor connection; a JS click can focus only the DOM.
        // DOM rectangles and hit testing use layout CSS coordinates; native touch uses the visual viewport.
        return view -> {
                int[] location = new int[2];
                view.getLocationOnScreen(location);
                float localX = (float) ((cssX - offsetLeft) * pixelsPerCssPixel);
                float localY = (float) ((cssY - offsetTop) * pixelsPerCssPixel);
                Rect visible = new Rect();
                boolean hasVisibleRect = view.getLocalVisibleRect(visible);
                int scrollX = view.getScrollX(), scrollY = view.getScrollY();
                // getLocalVisibleRect includes the View's own scroll; touch coordinates do not.
                visible.offset(-scrollX, -scrollY);
                String nativeGeometry = "id=" + id + ", width=" + view.getWidth() + ", height=" + view.getHeight() +
                    ", screenX=" + location[0] + ", screenY=" + location[1] + ", visible=" + visible.toShortString() +
                    ", scrollX=" + scrollX + ", scrollY=" + scrollY +
                    ", localX=" + localX + ", localY=" + localY;
                Log.i("ManagedInputGeometry", nativeGeometry);
                // Allow coordinate rounding; an IME may shrink the visual height without resizing the WebView.
                double tolerance = pixelsPerCssPixel + 1;
                if (!(Math.abs(cssWidth * pixelsPerCssPixel - view.getWidth()) <= tolerance
                    && cssHeight * pixelsPerCssPixel > 0 && cssHeight * pixelsPerCssPixel <= view.getHeight() + tolerance))
                    throw new PerformException.Builder().withActionDescription("touch input: " + id)
                        .withViewDescription("Managed fixture WebView: " + nativeGeometry)
                        .withCause(new IllegalStateException("Visual viewport does not match native bounds")).build();
                if (!(Float.isFinite(localX) && Float.isFinite(localY) && hasVisibleRect
                    && visible.contains(Math.round(localX), Math.round(localY))))
                    throw new PerformException.Builder().withActionDescription("touch input: " + id)
                        .withViewDescription("Managed fixture WebView: " + nativeGeometry)
                        .withCause(new IllegalStateException("Input touch is outside the visible WebView")).build();
                return new float[] { location[0] + localX, location[1] + localY };
            };
    }

    private void awaitNativeEditor(String id) {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "wait for native input connection: " + id; }
            @Override public void perform(UiController uiController, View view) {
                long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
                String diagnostic;
                do {
                    boolean inputConnection = supportsInputMethods().matches(view);
                    boolean ready = view.hasFocus() && view.hasWindowFocus() && inputConnection;
                    diagnostic = "id=" + id + ", focus=" + view.hasFocus() + ", windowFocus=" +
                        view.hasWindowFocus() + ", inputConnection=" + inputConnection;
                    if (ready) {
                        Log.i("ManagedInput", diagnostic);
                        return;
                    }
                    long remaining = deadline - SystemClock.uptimeMillis();
                    if (remaining <= 0) break;
                    uiController.loopMainThreadForAtLeast(Math.min(50, remaining));
                } while (SystemClock.uptimeMillis() < deadline);
                throw new PerformException.Builder().withActionDescription(getDescription())
                    .withViewDescription("Managed fixture WebView: " + diagnostic)
                    .withCause(new IllegalStateException("Native editor was not ready"))
                    .build();
            }
        });
    }

    /** Fixed test-APK subtree only, bounded to 64 files and 4 MiB; no main-asset replacement. */
    private void copyFixture(AssetManager assets, String source, File target, int depth) throws IOException {
        if (depth > 3) throw new IOException("Fixture nesting limit exceeded");
        String[] entries = assets.list(source);
        if (entries == null || entries.length == 0 || entries.length > 64)
            throw new IOException("Invalid fixture directory");
        for (String name : entries) {
            if (!name.matches("[A-Za-z0-9_][A-Za-z0-9_.-]*")) throw new IOException("Invalid fixture asset name");
            File destination = new File(target, name);
            String child = source + "/" + name;
            String[] children = assets.list(child);
            if (children != null && children.length > 0) {
                if (!destination.mkdir()) throw new IOException("Cannot create fixture subdirectory");
                createdFixturePaths.add(destination);
                copyFixture(assets, child, destination, depth + 1);
            } else {
                if (++copiedFiles > 64 || !destination.createNewFile()) throw new IOException("Fixture file limit or collision");
                createdFixturePaths.add(destination);
                try (InputStream input = assets.open(child); FileOutputStream output = new FileOutputStream(destination)) {
                    byte[] bytes = new byte[8192];
                    int count;
                    while ((count = input.read(bytes)) != -1) {
                        copiedBytes += count;
                        if (copiedBytes > MAX_ASSET_BYTES) throw new IOException("Fixture byte limit exceeded");
                        output.write(bytes, 0, count);
                    }
                }
            }
        }
    }

    private void awaitPage(String description, String predicate) throws Exception {
        awaitPage(description, predicate, false);
    }

    private void awaitPage(String description, String predicate, boolean requireNativeReady) throws Exception {
        awaitPage(description, predicate, requireNativeReady, null);
    }

    private void awaitPage(String description, String predicate, boolean requireNativeReady, View dismissedDialog) throws Exception {
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        int missedCallbacks = 0;
        AtomicReference<String> nativeState = new AtomicReference<>("not checked");
        while (SystemClock.uptimeMillis() < deadline) {
            if (dismissedDialog != null) {
                long remainingIdle = deadline - SystemClock.uptimeMillis();
                if (remainingIdle <= 0) break;
                try {
                    // Observe public accessibility quiescence within this same deadline.
                    // It does not establish that every compositor dim layer has retired.
                    InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(50, remainingIdle);
                } catch (java.util.concurrent.TimeoutException timeout) {
                    nativeState.set("accessibility did not become idle before the page deadline");
                    break;
                }
            }
            CountDownLatch returned = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                if (requireNativeReady && !nativePageReady(activity, webView, nativeState, dismissedDialog)) {
                    returned.countDown();
                    return;
                }
                webView.evaluateJavascript("Boolean(" + predicate + ")", value -> {
                    if (!requireNativeReady || (nativePageReady(activity, webView, nativeState, dismissedDialog) &&
                        SystemClock.uptimeMillis() < deadline)) result.set(value);
                    returned.countDown();
                });
            });
            long remaining = deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) break;
            // A loading WebView can miss a callback; keep the same overall page deadline.
            if (!returned.await(Math.min(2_000, remaining), TimeUnit.MILLISECONDS)) {
                missedCallbacks++;
                continue;
            }
            if ("true".equals(result.get())) return;
            if (dismissedDialog == null) Thread.sleep(50);
        }
        String diagnostic = "missed callbacks=" + missedCallbacks +
            (requireNativeReady ? "; native=" + nativeState.get() : "") + "; " + pageDiagnostic();
        Log.e("ManagedFixture", "Timed out waiting for " + description + ": " + diagnostic);
        fail("Timed out waiting for " + description + ": " + diagnostic);
    }

    private boolean nativePageReady(MainActivity activity, WebView webView,
            AtomicReference<String> diagnostic, View dismissedDialog) {
        boolean ready = fixtureNativeReady(activity, webView, diagnostic);
        if (dismissedDialog == null) return ready;
        boolean attached = dismissedDialog.isAttachedToWindow();
        boolean shown = dismissedDialog.isShown();
        diagnostic.set(diagnostic.get() + ", selectedDialogAttached=" + attached + ", selectedDialogShown=" + shown);
        return ready && !attached && !shown;
    }

    /** Observe startup admission on the UI thread; never force the Activity to resume. */
    private boolean fixtureNativeReady(MainActivity activity, WebView webView, AtomicReference<String> diagnostic) {
        Lifecycle.State state = activity.getLifecycle().getCurrentState();
        boolean attached = webView.isAttachedToWindow();
        boolean shown = webView.isShown();
        boolean hardware = webView.isHardwareAccelerated();
        boolean focused = activity.hasWindowFocus() && webView.hasWindowFocus();
        boolean callbacks = activity.getOnBackPressedDispatcher().hasEnabledCallbacks();
        diagnostic.set("state=" + state + ", attached=" + attached + ", shown=" + shown +
            ", hardware=" + hardware + ", focused=" + focused + ", callbacks=" + callbacks);
        return state == Lifecycle.State.RESUMED && attached && shown && hardware && focused && callbacks;
    }

    /** Finite observations of this invented fixture only; no model writes or production hooks. */
    private String pageDiagnostic() throws InterruptedException {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "JSON.stringify({observedRanges:(()=>{const roots=[...document.querySelectorAll('.managed-observed-close-range')];return {count:roots.length,roots:roots.slice(0,2).map(root=>{const groups=[...root.querySelectorAll('dl > div')];return {role:root.getAttribute('role')?.slice(0,128),label:root.getAttribute('aria-label')?.slice(0,128),groupCount:groups.length,groups:groups.slice(0,2).map(group=>{const time=group.querySelector('time');return {dt:group.querySelector('dt')?.textContent?.slice(0,128),spanCount:group.querySelectorAll('dd > span').length,span:group.querySelector('dd > span')?.textContent?.slice(0,128),timeCount:group.querySelectorAll('time').length,timeText:time?.textContent?.slice(0,64),dateTime:time?.dateTime?.slice(0,64),datetimeAttribute:time?.getAttribute('datetime')};}),coverage:root.textContent?.slice(0,1024),ties:root.textContent?.includes('First of ')};})};})()," +
            " documentWidths:{scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}," +
            " viewport:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null,scrollX:scrollX," +
            " researchNavigation:{buttonCount:document.querySelectorAll('.managed-company-sections button').length,buttons:[...document.querySelectorAll('.managed-company-sections button')].slice(0,6).map(button=>{const r=button.getBoundingClientRect(),style=getComputedStyle(button);return {text:button.textContent?.slice(0,64),label:button.getAttribute('aria-label')?.slice(0,128),pressed:button.getAttribute('aria-pressed'),disabled:button.disabled,hidden:button.hidden,visible:typeof button.checkVisibility==='function'?button.checkVisibility():null,display:style.display,visibility:style.visibility,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}),headings:[...document.querySelectorAll('#managed-company-content h3')].slice(0,4).map(h=>({id:h.id,text:h.textContent?.slice(0,128)}))}," +
            " location:{pathname:location.pathname.slice(0,512),search:location.search.slice(0,512)},historyStateKeys:history.state&&typeof history.state==='object'?Object.keys(history.state).slice(0,16).map(key=>key.slice(0,64)):[]," +
            " query: document.querySelector('#workspace-company-query')?.value?.slice(0,128)," +
            " focused: document.activeElement?.id?.slice(0,128)," +
            " counters: document.querySelector('#fixture-diagnostics')?.textContent?.slice(0,1024)," +
            " catalogMessage: document.querySelector('.workspace-global-search')?.nextElementSibling?.textContent?.slice(0,256)," +
            " results: Array.from(document.querySelectorAll('.managed-results strong')).slice(0,5).map(e=>e.textContent?.slice(0,16))," +
            " annual: document.querySelector('#managed-annual-heading')?.textContent?.slice(0,128)," +
            " annualMessage: document.querySelector('.managed-annual-report > [role]')?.textContent?.slice(0,256)," +
            " annualCoordinates: document.querySelector('.sec-quarterly-comparison-coordinates')?.textContent?.slice(0,1024)," +
            " annualGeneration: Array.from(document.querySelectorAll('.sec-quarterly-comparison dt')).find(e=>e.textContent==='Source generation')?.nextElementSibling?.textContent?.slice(0,80)})",
            value -> { result.set(value); returned.countDown(); }));
        if (!returned.await(2, TimeUnit.SECONDS)) return "diagnostic unavailable";
        String observed = result.get();
        return observed == null ? "diagnostic null" : observed.substring(0, Math.min(observed.length(), 8192));
    }

    @After
    public void retainScreenshotAndCloseActivity() throws Exception {
        try {
            if (scenario == null) return;
            retainScreenshot(testName.getMethodName());
        } finally {
            try {
                if (scenario != null) scenario.close();
            } finally {
                // Remove only paths this test created, children before parents; never clear app data.
                for (int index = createdFixturePaths.size() - 1; index >= 0; index--) {
                    File created = createdFixturePaths.get(index);
                    assertTrue("Fixture cleanup escaped its own directory",
                        created.equals(fixtureDirectory) || created.getCanonicalPath().startsWith(
                            fixtureDirectory.getCanonicalPath() + File.separator));
                    assertTrue("Cannot remove owned fixture path", !created.exists() || created.delete());
                }
            }
        }
    }

    private void retainScreenshot(String name) throws Exception {
        String configured = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
        File output = configured == null
            ? new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalCacheDir(), "instrumentation-screenshots")
            : new File(configured);
        assertTrue(output.isDirectory() || output.mkdirs());
        Bitmap screenshot = captureCommittedWindow(name);
        try (FileOutputStream stream = new FileOutputStream(new File(output, name + ".png"))) {
            assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, stream));
        } finally {
            screenshot.recycle();
        }
    }

    /** DOM readiness, a submitted hardware frame, then one copy of that window's latest buffer. */
    private Bitmap captureCommittedWindow(String name) throws Exception {
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        Handler main = new Handler(Looper.getMainLooper());
        CompletableFuture<Bitmap> captured = new CompletableFuture<>();
        AtomicReference<String> phase = new AtomicReference<>("visual-state");
        AtomicReference<ViewTreeObserver> observer = new AtomicReference<>();
        AtomicReference<Runnable> frameCallback = new AtomicReference<>();
        try {
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                Window window = activity.getWindow();
                assertTrue("Screenshot needs an attached visible hardware WebView",
                    webView.isAttachedToWindow() && webView.isShown() && webView.isHardwareAccelerated());
                webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) {
                        if (captured.isDone() || SystemClock.uptimeMillis() >= deadline) return;
                        phase.set("frame-commit");
                        Runnable committed = () -> main.post(() -> {
                            if (captured.isDone() || SystemClock.uptimeMillis() >= deadline) return;
                            phase.set("pixel-copy");
                            View decor = window.peekDecorView();
                            int width = decor == null ? 0 : decor.getWidth();
                            int height = decor == null ? 0 : decor.getHeight();
                            if (width <= 0 || height <= 0 || (long) width * height > 16_777_216) {
                                captured.completeExceptionally(new IOException("Invalid screenshot window dimensions"));
                                return;
                            }
                            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                            try {
                                PixelCopy.request(window, bitmap, result -> {
                                    if (result != PixelCopy.SUCCESS) {
                                        bitmap.recycle();
                                        captured.completeExceptionally(new IOException("PixelCopy result=" + result));
                                    } else {
                                        // A timed-out caller never owns a still-running copy's bitmap.
                                        if (captured.complete(bitmap))
                                            Log.i("ManagedScreenshot", "name=" + name + ", visualReady=true, frameCommitted=true, pixelCopy=SUCCESS, width=" + width + ", height=" + height);
                                        else bitmap.recycle();
                                    }
                                }, main);
                            } catch (RuntimeException error) {
                                bitmap.recycle();
                                captured.completeExceptionally(error);
                            }
                        });
                        ViewTreeObserver current = webView.getViewTreeObserver();
                        observer.set(current);
                        frameCallback.set(committed);
                        current.registerFrameCommitCallback(committed);
                        // The next draw after visual completion includes the already-asserted DOM.
                        webView.invalidate();
                    }
                });
            });
            long remaining = deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) throw new IOException("Screenshot deadline expired before waiting");
            return captured.get(remaining, TimeUnit.MILLISECONDS);
        } catch (Exception error) {
            if (!captured.cancel(false) && !captured.isCompletedExceptionally()) {
                Bitmap completed = captured.getNow(null);
                if (completed != null) completed.recycle();
            }
            throw new IOException("Screenshot did not complete: " + name + ", phase=" + phase.get(), error);
        } finally {
            main.post(() -> {
                ViewTreeObserver current = observer.get();
                Runnable callback = frameCallback.get();
                if (current != null && current.isAlive() && callback != null)
                    current.unregisterFrameCommitCallback(callback);
            });
        }
    }
}
