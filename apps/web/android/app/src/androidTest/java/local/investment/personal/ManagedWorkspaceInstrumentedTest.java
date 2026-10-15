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
        if (testName.getMethodName().equals("loadedCompanySnapshotKeepsSeparateEvidenceWithoutAutomaticReads") ||
            testName.getMethodName().equals("preparedCompanyReportUsesSystemPickerAndPreservesDraft"))
            selectFixtureScenario("company-snapshot");
        if (testName.getMethodName().equals("priceComparisonNoteDraftReviewSaveAndReloadPreservesSource"))
            selectFixtureScenario("price-comparison-note");
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
        if (testName.getMethodName().equals("fedAnnouncementsRetainDatesCancelAndRetireWithSession"))
            selectFixtureScenario("fed-announcements");
        if (testName.getMethodName().equals("savedWatchlistExportUsesSystemPickerAndPreservesDraft"))
            selectFixtureScenario("watchlist-export");
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
        awaitPage("recreated fixture loaded without restoring export",
            "document.querySelector('#fixture-export-choice')?.textContent === 'null' && " +
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".save === 0");
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
            " && document.querySelector('.managed-company-identity strong')?.textContent === " + JSONObject.quote(issuer) +
            " && panel?.getAttribute('aria-busy') === 'false'" +
            " && text.includes('The loaded watchlist comparison report is available in this company visit.')" +
            " && panel.querySelector('.managed-annual-origin')?.textContent === 'Showing the report loaded in the watchlist comparison. Original source and observation times are unchanged.'" +
            " && text.includes(" + JSONObject.quote(accession) + ") && text.includes(" + JSONObject.quote(periodEnd) + ")" +
            " && text.includes('2026-09-20T00:00:00.000Z')" +
            " && text.includes('Showing the previous report, completed 2026-09-20T00:00:02.000Z') === " + previous +
            " && [...panel.querySelectorAll('button')].some(b => b.textContent === 'Refresh annual report' && !b.disabled); })()");
    }

    private void assertAnnualComparisonValues(String revenue, String margin, String change, String rawBasis, String basisLabel) throws Exception {
        awaitPage("exact Annual values retain distinct fiscal periods and bases",
            "(() => { const rows = document.querySelectorAll('.managed-annual-comparison-table tbody tr');" +
            " const cells = i => [...rows[i].querySelectorAll('td')]; return rows.length === 13" +
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
        assertAnnualComparisonLiquidity();
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
        awaitPage("Markets offers three labelled native-sized section links",
            "(() => { const links = [...document.querySelectorAll('nav[aria-label=\"On Markets\"] > a')];" +
            " return links.length === 3 && links.map(a => a.textContent).join('|') === 'Company board|Economic calendar|Fed announcements'" +
            " && links.every(a => { const r = a.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; }); })()");
        for (String section : new String[] {"board", "calendar", "announcements"}) {
            String selector = "nav[aria-label='On Markets'] > a[data-markets-jump='" + section + "']";
            String targetId = section.equals("board") ? "managed-markets-heading" :
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
            "document.body.textContent.includes('Signed out. Local watchlist data has been cleared.')" +
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
                " && report.purpose === 'investment.company-research' && report.schemaVersion === '1.0.0'" +
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
                ".managed-report-delivery > p, .managed-report-delivery > button", 3);
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
            String openingNote = "Changed while opening report destination";
            replaceReportNoteWithNativeIme(note, openingNote);
            awaitPage("the edited report retires and native cancellation acknowledges before the provider is released",
                "document.querySelector('.managed-report-delivery') === null && " +
                "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).cancelsSettled > " + priorCancels);
            WatchlistTestDocuments.releaseReportOpen(appContext);
            awaitPage("cancelled held-open report write settles without restoring a delivery action",
                "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).writesSettled === 2 && " +
                "document.querySelector('.managed-report-delivery') === null");
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
            DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".filings === 0");
        assertFixtureBoundary();
    }

    @Test
    public void loadedCompanySnapshotKeepsSeparateEvidenceWithoutAutomaticReads() throws Exception {
        double documentTimeOrigin = readDocumentTimeOrigin();
        prepareDraftAndOpenAnnual();
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
        clickEodAction("Load one-month close history");
        awaitPage("snapshot keeps exact loaded raw-close dates and basis",
            snapshot + ".open && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".annual === 0 && " +
            "document.querySelector('[aria-label=\"Snapshot price\"] dl')?.textContent === 'Last raw close · USD101.5Trading date2026-09-19' && " +
            snapshot + ".textContent.includes('2026-08-20 to 2026-09-20') && " +
            snapshot + ".textContent.includes('2026-09-20T00:00:01.000Z') && " +
            snapshot + ".textContent.includes('unadjusted for splits or dividends') && " +
            snapshot + ".textContent.includes('No annual evidence loaded')");
        retainAnnualNoteFrame("companySnapshotPrice", "[aria-label='Snapshot price'] h3",
            "[aria-label='Snapshot price'] h3, [aria-label='Snapshot price'] dl", 2);
        click(".managed-snapshot-grid > section[aria-label='Snapshot annual'] > button");
        awaitPage("snapshot Annual action navigates without fetching",
            "document.querySelector('#managed-annual-heading') !== null && " + DIAGNOSTICS + ".annual === 0");
        click(".managed-annual-report .trial-actions button:first-child");
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
        retainAnnualNoteFrame("companySnapshotAnnualBasis", basis + " > h4",
            basis + " > h4, " + basis + " > div > p, " + basis + " > div > dl", 3);
        click(".managed-snapshot-grid > section[aria-label='Snapshot filings'] > button");
        awaitPage("snapshot Filings action navigates without fetching",
            "document.querySelector('#managed-filings-heading') !== null && " + DIAGNOSTICS + ".filings === 0");
        click(".managed-company-filings .trial-actions button:first-child");
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
        assertPreparedCompanyReport();
        pressBack();
        assertClosedDraft(true);
        awaitPage("leaving company removes its snapshot", snapshot + " === null");
        click(ANNUAL);
        awaitPage("a new company visit does not restore prior snapshot evidence",
            snapshot + "?.open === false && " + snapshot + ".textContent.includes('No close history loaded') && " +
            snapshot + ".textContent.includes('No annual evidence loaded') && " +
            snapshot + ".textContent.includes('No filing metadata loaded') && " +
            DIAGNOSTICS + ".annual === 1 && " + DIAGNOSTICS + ".eod === 1 && " + DIAGNOSTICS + ".filings === 1 && " + DIAGNOSTICS + ".save === 0");
        awaitPage("new company visit starts without a prepared report",
            "document.querySelector('.managed-company-report')?.open === false && document.querySelector('#managed-prepared-report-heading') === null");
        assertEquals(documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary();
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
            "return value.purpose === 'investment.company-research' && value.schemaVersion === '1.0.0' && " +
            "value.authoredResearch.status === 'watchlist_draft' && value.authoredResearch.note === " + JSONObject.quote(NOTE) + " && " +
            "value.listing.listingId === 'listing-zero' && value.listing.symbol === 'ZERO' && " +
            "value.sources.price.response.completedAt === '2026-09-20T00:00:01.000Z' && " +
            "value.sources.annual.response.evidence.generation.completedAt === '2026-09-20T00:00:02.000Z' && " +
            "value.sources.filings.response.completedAt === '2026-09-20T00:00:02.000Z' && " +
            "document.querySelector('.managed-report-delivery button')?.textContent === 'Save report (JSON)' && " +
            "document.querySelector('.managed-report-delivery button')?.disabled === false && " +
            "value.sources.annual.response.evidence.cashGeneration.resolution !== undefined && " +
            "value.sources.annual.response.evidence.liquidity.resolution !== undefined && " +
            "Array.isArray(value.sources.annual.response.evidence.observations) && " +
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
            "document.querySelector('.managed-eod-history caption')?.textContent === 'One-month raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-18|100.25;2026-09-19|101.5'" +
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
            " && document.querySelector('.managed-eod-history [role=status]')?.textContent === 'Close history refresh cancelled. Refresh again when ready.'" +
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
            " && document.querySelector('.managed-eod-history [role=alert]')?.textContent === 'The close history refresh failed. Select Refresh to try again.'" +
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
            " && Array.from(document.querySelectorAll('.managed-eod-history tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-19|102.75;2026-09-20|103.5'" +
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
            " && document.querySelector('.managed-eod-history caption')?.textContent === 'One-month raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-18|100.25;2026-09-19|101.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '101.5|2026-09-19|2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Tiingo')";
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
            " && document.querySelector('.managed-eod-history') === null; })()";
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
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label))
            .inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .perform(androidx.test.espresso.action.ViewActions.click());
        awaitPage("native option selected",
            "document.getElementById(" + JSONObject.quote(actualId) + ")?.value === " + JSONObject.quote(optionValue));
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
        awaitPage("loaded report has four explicit destinations and initially closed source details",
            "(() => { const nav = document.querySelector('nav[aria-label=\"On this report\"]');" +
            " const links = [...(nav?.querySelectorAll('a') || [])];" +
            " return links.length === 4 && links.map(a => a.textContent).join('|') === 'Revenue and net income|Cash generation|Liquidity|Report source details'" +
            " && links.every(a => a.getBoundingClientRect().height >= 44 && document.getElementById(a.getAttribute('href').slice(1))?.getAttribute('data-annual-report-target') === a.getAttribute('data-annual-report-jump'))" +
            " && document.querySelector('.managed-annual-provenance')?.open === false; })()");
        for (String section : new String[] {"income", "cash", "liquidity", "sources"}) {
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
            " && Array.from(document.querySelectorAll('.sec-annual-cash-values dt')).map(e => e.textContent).join('|') === 'Operating cash flowReported · USD|PP&E purchasesReported · USD|Operating cash flow less PP&E purchasesApp calculation · USD'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash > .sec-annual-cash-values .sec-annual-cash-amount')).map(e => e.textContent).join(',') === '120.125,20.025,100.1'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash-values dd small:first-of-type')).map(e => e.textContent).join('|') === '2025-01-01 to 2025-12-31|2025-01-01 to 2025-12-31|2025-01-01 to 2025-12-31'" +
            " && Array.from(document.querySelectorAll('.sec-annual-cash-values dd small:last-of-type')).every(e => e.textContent === 'Within current-use limits at this load.')" +
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
            " && document.querySelector('.managed-market-detail caption')?.textContent === 'One-month raw closing prices in USD'" +
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
            "document.querySelector('.managed-eod-history caption')?.textContent === 'One-month raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === " + JSONObject.quote(rows) +
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
            " && document.querySelector('.managed-market-detail caption')?.textContent === 'One-month raw closing prices in USD'" +
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
            " && document.querySelectorAll('.managed-eod-history tbody tr').length === " + (rows ? 2 : 0));
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

    /** Fixed metadata in this test's copied HTML is read before the fixture's sole React mount. */
    private void selectFixtureScenario(String scenarioName) throws IOException {
        assertTrue("Only fixed invented fixture scenarios are allowed",
            scenarioName.equals("catalog-startup-recovery") || scenarioName.equals("company-direct-entry") ||
            scenarioName.equals("markets-selected-price") || scenarioName.equals("annual-note") ||
            scenarioName.equals("markets-price-handoff") || scenarioName.equals("watchlist-recovery") ||
            scenarioName.equals("signout-save-review") || scenarioName.equals("signout-uncertain-review") ||
            scenarioName.equals("raw-close-comparison") || scenarioName.equals("price-comparison-note") ||
            scenarioName.equals("thesis-review") ||
            scenarioName.equals("company-snapshot") ||
            scenarioName.equals("bea-agenda") || scenarioName.equals("bea-agenda-comparison") || scenarioName.equals("bea-session-retirement") ||
            scenarioName.equals("watchlist-comparison") || scenarioName.equals("watchlist-export") || scenarioName.equals("company-filings") || scenarioName.equals("fed-announcements") || scenarioName.equals("annual-comparison"));
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
            " const rows = Array.from(panel?.querySelectorAll('tbody tr') ?? []);" +
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
        String source = ".sec-annual-liquidity-source";
        String inputs = source + " > section > ol > li > details";
        String capturedDay = recovered ? "2026-09-21" : "2026-09-20";
        awaitPage("liquidity provenance starts closed",
            "document.querySelector('.sec-annual-liquidity-source')?.open === false");
        click(source + " > summary");
        awaitPage("liquidity shows its original cutoff and bounded instant observations",
            "document.querySelector('.sec-annual-liquidity-source')?.open === true" +
            " && document.querySelector('.sec-annual-liquidity-source > p:first-of-type')?.textContent === " + JSONObject.quote("Annual cutoff " + capturedDay + "T00:00:00.000Z. Company Facts captured " + capturedDay + "T00:00:01.000Z. Submissions captured " + capturedDay + "T00:00:02.000Z. Completed " + capturedDay + "T00:00:02.000Z.") +
            " && Array.from(document.querySelectorAll('.sec-annual-liquidity-source > section > p')).map(e => e.textContent).join('|') === 'Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.|Scanned 1 rows: 0 invalid, 0 identical duplicates. Returned 1 of 1 selected-filing observations; 0 omitted.'" +
            " && Array.from(document.querySelectorAll(" + JSONObject.quote(inputs + " > summary") + ")).map(e => e.textContent).join('|') === " + JSONObject.quote("AssetsCurrent · Source end 2025-12-31 · 120.125 USD|LiabilitiesCurrent · Source end 2025-12-31 · " + (recovered ? "0" : "80.025") + " USD"));
        click(source + " > section:nth-of-type(1) > ol > li > details > summary");
        click(source + " > section:nth-of-type(2) > ol > li > details > summary");
        awaitPage("instant operands retain exact filing coordinates and both calculation references",
            "(() => { const rows = Array.from(document.querySelectorAll(" + JSONObject.quote(inputs) + "));" +
            " const values = rows.map(row => Array.from(row.querySelectorAll('dd')).map(e => e.textContent));" +
            " const shared = '|2025-12-31|Not supplied|Not supplied; an instant balance requires no duration.|2025 · FY|CY2025Q4I|10-K · 2026-02-01|0000000001-26-000001|Matched to current submissions · 10-K · 2026-02-01|2025-12-31 · 2026-02-01T00:00:00.000Z|Open original filing index|';" +
            " const ids = values.map(row => row[12]);" +
            " const paragraphs = Array.from(document.querySelectorAll('.sec-annual-liquidity-source > p'));" +
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
            "document.querySelector('.sec-annual-liquidity-source')?.open === false" +
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
        awaitPage("Annual panel opened", "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'");
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
        touchInput(id, null);
    }

    private void touchInput(String id, ViewAction rollbackAction) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const input = document.getElementById(" + JSONObject.quote(id) + ");" +
            " if (!input) return null; input.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});" +
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
        touchObservedGeometry(id, observed.get(), rollbackAction);
    }

    private void touchObservedGeometry(String id, String rawGeometry) throws Exception {
        touchObservedGeometry(id, rawGeometry, null);
    }

    private void touchObservedGeometry(String id, String rawGeometry, ViewAction rollbackAction) throws Exception {
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
        onView(isAssignableFrom(WebView.class)).perform(new GeneralClickAction(
            Tap.SINGLE,
            view -> {
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
            }, Press.FINGER, InputDevice.SOURCE_TOUCHSCREEN, 0, rollbackAction));
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
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        int missedCallbacks = 0;
        AtomicReference<String> nativeState = new AtomicReference<>("not checked");
        while (SystemClock.uptimeMillis() < deadline) {
            CountDownLatch returned = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                if (requireNativeReady && !fixtureNativeReady(activity, webView, nativeState)) {
                    returned.countDown();
                    return;
                }
                webView.evaluateJavascript("Boolean(" + predicate + ")", value -> {
                    if (!requireNativeReady || (fixtureNativeReady(activity, webView, nativeState) &&
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
            Thread.sleep(50);
        }
        String diagnostic = "missed callbacks=" + missedCallbacks +
            (requireNativeReady ? "; native=" + nativeState.get() : "") + "; " + pageDiagnostic();
        Log.e("ManagedFixture", "Timed out waiting for " + description + ": " + diagnostic);
        fail("Timed out waiting for " + description + ": " + diagnostic);
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
            "JSON.stringify({query: document.querySelector('#workspace-company-query')?.value?.slice(0,128)," +
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
        return observed == null ? "diagnostic null" : observed.substring(0, Math.min(observed.length(), 4096));
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
