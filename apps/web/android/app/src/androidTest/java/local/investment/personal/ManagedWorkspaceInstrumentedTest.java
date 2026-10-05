package local.investment.personal;

import static androidx.test.espresso.Espresso.closeSoftKeyboard;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
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
    private static final String NOTE = "Draft survives native Back";
    private static final String COMPANY_NOTE = "Company draft captured in research";
    private static final String ANNUAL = "button[aria-label='Annual report for saved ZERO']";
    private static final String DISCOVER = ".trial-panel[aria-labelledby='managed-discover-heading']";
    private static final String CATALOG_REFRESH = ".managed-search-bar > button";
    private static final String CATALOG_STATUS = ".managed-search-bar + p[role=status]";
    private static final String CATALOG_FAILURE =
        "The catalog could not be loaded. Select Refresh catalog to try again.";
    private static final String CSP =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; " +
        "base-uri 'none'; form-action 'none'";
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
        boolean coldCompanyLink = testName.getMethodName().equals("companyLinkDirectEntryAndBackPreserveDraft");
        if (coldCompanyLink) selectFixtureScenario("company-direct-entry");
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
            " && document.querySelector('#managed-note-0')?.disabled === false");
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
            "document.querySelector('#managed-note-0')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-1')?.value === 'Invented second note'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE'" +
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
        retainRefreshFailureScreenshot();

        click(".managed-annual-report .trial-actions button:first-child");
        assertRefreshReport(3, false, false, true);
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
            "document.querySelector('.managed-memberships > li > strong')?.textContent === 'ONE'");
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
        awaitPage("EOD draft reordered", "document.querySelector('.managed-memberships > li > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("EOD opens without fetching",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'");
        assertEodState(0, 0, 0, false, false);

        clickEodAction("Load one-month close history");
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
        awaitPage("inspection preserves the complete accessible table", initialHistory +
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
            " && Array.from(report.querySelectorAll('.sec-quarterly-value')).map(e => e.textContent).join(',') === '2000,300,15'" +
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
            " && document.querySelector('#managed-note-0')?.closest('section')?.hidden === true");
        typeIntoInput("workspace-company-query", "ZERO");
        click(".workspace-global-search button[type=submit]");
        awaitPage("Search opens visible Discover without a price read",
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'Discover'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && " + DIAGNOSTICS + ".search === 1 && " + DIAGNOSTICS + ".marketsEod === 0");
        selectWorkspaceView("My Watchlist");
        click("button[aria-label='Move ZERO down']");
        awaitPage("Markets journey reorders the mounted draft",
            "document.querySelector('.managed-memberships > li > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        selectWorkspaceView("Markets");
        awaitPage("second Markets visit resolves again without loading prices",
            DIAGNOSTICS + ".marketsResolve === 2 && " + DIAGNOSTICS + ".marketsEod === 0" +
            " && Array.from(document.querySelectorAll('.managed-market-close strong')).every(e => e.textContent === 'Not loaded')");
        clickMarketsAction("Load board prices");
        assertMarketsRows(false);
        assertMarketsRawChanges(false);
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
        clickMarketsAction("Cancel board prices");
        assertMarketsDraftAndCounts(2, 5, 1, 0);
        assertMarketsRawChanges(true);
        awaitPage("Cancel restores focus after the load action is enabled",
            "document.activeElement === document.querySelector('.managed-markets .trial-actions button:first-child')" +
            " && document.activeElement.disabled === false" +
            " && document.querySelector('.managed-market-rows .managed-eod-previous') !== null");
        click("#settle-cancelled-markets");
        assertMarketsDraftAndCounts(2, 5, 1, 1);
        assertMarketsRows(true);
        assertMarketsRawChanges(true);
        click("button[aria-label='Select BETA on company board']");
        assertMarketsDetail("BETA", "2026-09-18|20.75;2026-09-19|20.5", true);
        awaitPage("late board values cannot replace the retained response",
            "!document.querySelector('.managed-markets')?.textContent.includes('998.25')" +
            " && !document.querySelector('.managed-markets')?.textContent.includes('999.75')");
        Log.i("ManagedMarkets", "phase=cancelled-late-discarded, reads=5; " + pageDiagnostic());

        click("button[aria-label='Board price history for BETA']");
        awaitPage("board opens separate EOD panel unloaded without another request",
            "document.querySelector('#managed-company-heading')?.textContent === 'Company research · BETA' && document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history'" +
            " && document.activeElement?.id === 'managed-eod-heading'" +
            " && document.querySelector('.managed-eod-history table') === null" +
            " && document.querySelector('.managed-eod-history .managed-metadata') === null" +
            " && document.querySelector('.managed-market-detail table') !== null");
        assertMarketsDraftAndCounts(2, 5, 1, 1);
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
        selectWorkspaceView("Discover");
        awaitPage("leaving Markets retires all its price views",
            "document.querySelector('.managed-markets') === null && document.querySelector('.managed-eod-chart') === null");
        selectWorkspaceView("Markets");
        awaitPage("returning Markets resolves fresh identities but remains unloaded",
            DIAGNOSTICS + ".marketsResolve === 3" +
            " && document.querySelectorAll('.managed-market-row').length === 3" +
            " && Array.from(document.querySelectorAll('.managed-market-close strong')).every(e => e.textContent === 'Not loaded')" +
            " && document.querySelector('.managed-market-change') === null" +
            " && document.querySelector('.managed-market-detail table') === null" +
            " && document.querySelector('.managed-market-detail canvas') === null" +
            " && document.querySelector('.managed-markets .managed-eod-previous') === null");
        assertMarketsDraftAndCounts(3, 5, 1, 1);
        selectWorkspaceView("My Watchlist");
        awaitPage("the final watchlist draft is visible and unchanged",
            "document.querySelector('#managed-note-1')?.closest('section')?.hidden === false");
        assertMarketsDraftAndCounts(3, 5, 1, 1);
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
            " && document.querySelector('#managed-note-2')?.value === ''" +
            " && document.querySelector('[aria-labelledby=managed-research-note-heading] button:first-child')?.textContent === 'In watchlist draft'" +
            " && document.querySelector('[aria-labelledby=managed-research-note-heading] button:first-child')?.disabled === true" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE,ALFA'");
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
        click("[aria-labelledby=managed-research-note-heading] button:nth-child(2)");
        awaitPage("review closes research and focuses the visible My Watchlist control",
            "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.activeElement === document.querySelector('.managed-navigation [aria-current=page]')" +
            " && document.querySelector('#managed-watchlist-heading')?.closest('section')?.hidden === false");
        assertCompanyNoteDraft(1, true);
        assertCompanyNoteCounts(0, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        awaitPage("existing full-list Save completes the one invented versioned write",
            DIAGNOSTICS + ".save === 1 && document.body.textContent.includes('Version 2 · Saved')");
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
    }

    private void assertCompanyNoteDraft(int version, boolean dirty) throws Exception {
        awaitPage("company note preserves exact membership order and unrelated notes",
            "Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ZERO,ONE,ALFA'" +
            " && document.querySelector('#managed-note-0')?.value === ''" +
            " && document.querySelector('#managed-note-1')?.value === 'Invented second note'" +
            " && document.querySelector('#managed-note-2')?.value === " + JSONObject.quote(COMPANY_NOTE) +
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
            "'#managed-research-note-heading, [aria-labelledby=managed-research-note-heading] button, label[for=managed-research-note], #managed-research-note, #managed-research-note-help'));" +
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
            " return e.querySelector('.managed-market-identity strong').textContent + '|' + value + '|' + p.querySelector('span')?.textContent;" +
            " }).join(';') === " + JSONObject.quote(expected));
    }

    private void assertMarketsDetail(String symbol, String rows, boolean previous) throws Exception {
        awaitPage("selected board history and source dates: " + symbol,
            "document.querySelector('#managed-market-detail-heading')?.textContent === " + JSONObject.quote(symbol + " · one month") +
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
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
    }

    private void retainMarketsRawChangeScreenshot() throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-market-rows > li')?.scrollIntoView({block:'center',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Markets raw-change row did not scroll into view", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const row = document.querySelector('.managed-market-rows > li'); const v = visualViewport;" +
            " if (!row || !v) return false; const targets = [row.querySelector('.managed-market-identity')," +
            " row.querySelector('.managed-market-close'), row.querySelector('.managed-market-change'), row.querySelector('.managed-market-change span')];" +
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
            " && document.querySelectorAll('.managed-company-sections button').length === 2" +
            " && document.querySelectorAll('.managed-company-sections button[aria-pressed=true]').length === 1))" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
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
            " return v && targets.length === 3 && targets.every(e => { const r = e.getBoundingClientRect();" +
            " return r.width > 0 && r.height > 0 && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("both section controls and active Price heading fully visible", sectionsVisible);
        awaitPage("retained Price evidence before section controls capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainScreenshot("researchCompanySections");
        awaitPage("section controls and Price heading stayed visible through capture", sectionsVisible);
        awaitPage("retained Price evidence after section controls capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);

        CountDownLatch metadataScrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector('.managed-eod-history .managed-metadata')?.scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> metadataScrolled.countDown()));
        assertTrue("Retained history metadata did not scroll into view", metadataScrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String metadataVisible = "(() => { const targets = Array.from(document.querySelectorAll(" +
            "'.managed-eod-history .managed-metadata > dt, .managed-eod-history .managed-metadata > dd'));" +
            " const v = visualViewport; return v && targets.length === 10 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("all five retained history label and value pairs visible", metadataVisible);
        awaitPage("retained Price evidence before history capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
        retainScreenshot("researchSwitchEodLoaded");
        awaitPage("retained history metadata stayed visible through capture", metadataVisible);
        awaitPage("retained Price evidence after history capture", loadedEod);
        assertResearchSwitchDraftAndCounts(2, 1, 1);
    }

    private void clickEodAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(concat(' ',normalize-space(@class),' '),' managed-eod-history ')]//button[normalize-space(.)='" + label + "']"))
            .perform(webClick());
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
            "document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
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
            scenarioName.equals("catalog-startup-recovery") || scenarioName.equals("company-direct-entry"));
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
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
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
            " && Array.from(report.querySelectorAll('.sec-quarterly-value')).map(e => e.textContent).join(',') === " +
                JSONObject.quote(recovered ? "2000,300,15" : "1000,100,10") +
            " && panel.textContent.includes('Showing the previous report') === " + previous +
            " && panel.getAttribute('aria-busy') === '" + running + "'" +
            " && " + DIAGNOSTICS + ".annual === " + annualCalls +
            " && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && " + DIAGNOSTICS + ".search === 1" +
            " && " + DIAGNOSTICS + ".aborted === 0 && " + DIAGNOSTICS + ".lateResolved === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes'); })()");
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
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
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
        awaitPage("watchlist reordered", "Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'");
        typeIntoInput("managed-note-1", NOTE);
        awaitPage("draft note edited", "document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE));
        click(ANNUAL);
        awaitPage("Annual panel opened", "document.querySelector('#managed-company-heading')?.textContent === 'Company research · ZERO' && document.querySelector('#managed-annual-heading')?.textContent === 'Annual report'");
        assertCompanyHistory("listing-zero", "annual", false);
    }

    private void assertClosedDraft(boolean restoredFocus) throws Exception {
        awaitPage("Annual closed with the same draft", "document.querySelector('.managed-annual-report') === null" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".load === 1" +
            (restoredFocus ? " && document.activeElement === document.querySelector(" + JSONObject.quote(ANNUAL) + ")" : ""));
    }

    private void assertFixtureBoundary() throws Exception {
        assertFixtureBoundary(0);
    }

    private void assertFixtureBoundary(int expectedResolves) throws Exception {
        awaitPage("test-only source, origin and disconnected boundaries",
            "location.origin === 'https://localhost' && location.hash === ''" +
            " && document.querySelector('meta[name=investment-build-sha]')?.content === " + JSONObject.quote(expectedSourceSha) +
            " && document.querySelector('meta[name=investment-android-test]')?.content === 'managed-workspace'" +
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content === " + JSONObject.quote(CSP) +
            " && window.Capacitor?.getPlatform() === 'android'" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === " + expectedResolves);
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
        assertTrue("Only supported public sections", section.equals("price") || section.equals("annual"));
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
    }

    private void typeIntoInput(String id, String text) throws Exception {
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

    private void touchInput(String id) throws Exception {
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
        touchObservedGeometry(id, observed.get());
    }

    private void touchObservedGeometry(String id, String rawGeometry) throws Exception {
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
            }, Press.FINGER, InputDevice.SOURCE_TOUCHSCREEN, 0));
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
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        int missedCallbacks = 0;
        while (SystemClock.uptimeMillis() < deadline) {
            CountDownLatch returned = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();
            scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                "Boolean(" + predicate + ")", value -> { result.set(value); returned.countDown(); }));
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
        String diagnostic = "missed callbacks=" + missedCallbacks + "; " + pageDiagnostic();
        Log.e("ManagedFixture", "Timed out waiting for " + description + ": " + diagnostic);
        fail("Timed out waiting for " + description + ": " + diagnostic);
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
