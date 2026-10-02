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
    private static final String ANNUAL = "button[aria-label='Annual report for saved ZERO']";
    private static final String DISCOVER = ".trial-panel[aria-labelledby='managed-discover-heading']";
    private static final String CATALOG_REFRESH = DISCOVER + " .trial-toolbar button";
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
            selectCatalogRecovery();
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
        assertFixtureBoundary();
        // The fixture starts at one genuine root document, without leftover disconnected-route history.
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        assertRootHistory();
        Log.i("ManagedFixture", "source=" + expectedSourceSha + ", files=" + copiedFiles + ", bytes=" + copiedBytes);
    }

    @Test
    public void annualBackPreservesDraftAndRootBackDoesNothing() throws Exception {
        prepareDraftAndOpenAnnual();
        awaitPage("opening Annual performs no read", DIAGNOSTICS + ".annual === 0");
        pressBack();
        assertClosedDraft(true);
        assertRootHistory();
        pressBack();
        // Installed App defaults to a no-op at root. It must not exit or reopen Annual.
        assertClosedDraft(true);
        assertRootHistory();
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
        assertRootHistory();
        assertFixtureBoundary();
    }

    @Test
    public void backgroundResumePreservesDraftAndAnnualCancellation() throws Exception {
        prepareDraftAndOpenAnnual();
        click(".managed-annual-report .trial-actions button:first-child");
        assertPendingAnnualDraft();
        assertFixtureReadCounts(0, 0);
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
        assertFixtureReadCounts(0, 0);
        assertFixtureBoundary();
        assertRootHistory();
        Log.i("ManagedLifecycle", "phase=resumed-pending, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());

        pressBack();
        assertClosedDraft(true);
        assertFixtureReadCounts(1, 0);
        click("#settle-cancelled-read");
        assertFixtureReadCounts(1, 1);
        assertClosedDraft(false);
        assertRootHistory();
        pressBack();
        assertClosedDraft(false);
        assertFixtureReadCounts(1, 1);
        assertRootHistory();
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
        assertRootHistory();
        assertFixtureBoundary();
    }

    @Test
    public void catalogStartupFailureRecoversWithoutReloadOrDraftLoss() throws Exception {
        awaitPage("initial catalog failure offers Refresh catalog",
            "document.querySelector(" + JSONObject.quote(DISCOVER + " > p[role=status]") + ")?.textContent === " + JSONObject.quote(CATALOG_FAILURE) +
            " && " + DIAGNOSTICS + ".catalogRecovery === true && " + DIAGNOSTICS + ".status === 1");
        double documentTimeOrigin = readDocumentTimeOrigin();
        AtomicReference<WeakReference<MainActivity>> originalActivity = new AtomicReference<>();
        AtomicReference<WeakReference<WebView>> originalWebView = new AtomicReference<>();
        scenario.onActivity(activity -> {
            originalActivity.set(new WeakReference<>(activity));
            originalWebView.set(new WeakReference<>(activity.getBridge().getWebView()));
        });
        click("button[aria-label='Move ZERO down']");
        awaitPage("draft reordered before catalog recovery",
            "document.querySelector('.managed-memberships > li > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        assertCatalogRecoveryState(1, 0, "", false, false, CATALOG_FAILURE);
        retainCatalogRecoveryScreenshot("catalogStartupFailure", CATALOG_REFRESH,
            CATALOG_REFRESH + ", " + DISCOVER + " > p[role=status]");
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
        retainCatalogRecoveryScreenshot("catalogRecovered", ".workspace-global-search",
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
        click("button[aria-label='Move ZERO down']");
        awaitPage("EOD draft reordered", "document.querySelector('.managed-memberships > li > strong')?.textContent === 'ONE'");
        typeIntoInput("managed-note-1", NOTE);
        click("button[aria-label='EOD close history for saved ZERO']");
        awaitPage("EOD opens without fetching",
            "document.querySelector('#managed-eod-heading')?.textContent === 'EOD close history · ZERO'");
        assertEodState(0, 0, 0, false, false);

        clickEodAction("Load one-month close history");
        assertEodState(1, 0, 0, false, true);
        awaitPage("EOD exposes exact invented closes and provenance",
            "document.querySelector('.managed-eod-history caption')?.textContent === 'One-month raw closing prices in USD'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history tbody tr')).map(tr => Array.from(tr.cells).map(e => e.textContent.trim()).join('|')).join(';') === '2026-09-18|100.25;2026-09-19|101.5'" +
            " && Array.from(document.querySelectorAll('.managed-eod-history .managed-metadata dd')).map(e => e.textContent).join('|') === '101.5|2026-09-19|2026-08-20 to 2026-09-20|2026-09-20T00:00:00.000Z|2026-09-20T00:00:01.000Z'" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('Tiingo')" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('2026-08-20')" +
            " && document.querySelector('.managed-eod-history')?.textContent.includes('2026-09-20')");
        retainEodLoadedScreenshot();
        assertEodState(1, 0, 0, false, true);
        Log.i("ManagedEod", "phase=loaded; " + pageDiagnostic());

        clickEodAction("Refresh close history");
        assertEodState(2, 0, 0, true, false);
        clickEodAction("Cancel close history");
        assertEodState(2, 1, 0, false, false);
        Log.i("ManagedEod", "phase=cancelled; " + pageDiagnostic());
        click("#settle-cancelled-eod");
        assertEodState(2, 1, 1, false, false);
        awaitPage("late invented EOD values remain absent",
            "!document.querySelector('.managed-eod-history')?.textContent.includes('998.25')" +
            " && !document.querySelector('.managed-eod-history')?.textContent.includes('999.75')");
        pressBack();
        awaitPage("native Back closes EOD and restores its originating control",
            "document.querySelector('.managed-eod-history') === null" +
            " && document.activeElement === document.querySelector(\"button[aria-label='EOD close history for saved ZERO']\")");
        assertEodDraftAndCounts(2, 1, 1);
        assertRootHistory();
        pressBack();
        awaitPage("root Back leaves both detail panels closed",
            "document.querySelector('.managed-eod-history') === null && document.querySelector('.managed-annual-report') === null");
        assertEodDraftAndCounts(2, 1, 1);
        scenario.onActivity(activity -> {
            assertNotNull("Original EOD Activity was collected", originalActivity.get().get());
            assertNotNull("Original EOD WebView was collected", originalWebView.get().get());
            assertSame("EOD journey must preserve the Activity", originalActivity.get().get(), activity);
            assertSame("EOD journey must preserve the WebView", originalWebView.get().get(), activity.getBridge().getWebView());
        });
        assertEquals("EOD journey must preserve the document", documentTimeOrigin, readDocumentTimeOrigin(), 0.0);
        assertRootHistory();
        assertFixtureBoundary();
        Log.i("ManagedEod", "phase=late-discarded-back-root, documentTimeOrigin=" + documentTimeOrigin + "; " + pageDiagnostic());
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
    private void selectCatalogRecovery() throws IOException {
        File index = new File(fixtureDirectory, "index.html");
        byte[] original = Files.readAllBytes(index.toPath());
        assertTrue("Fixture index exceeded its bound", original.length > 0 && original.length <= 65536);
        String html = new String(original, StandardCharsets.UTF_8);
        assertEquals("Fixture must have one head end", html.indexOf("</head>"), html.lastIndexOf("</head>"));
        assertTrue("Fixture head is absent", html.contains("</head>"));
        assertFalse("Fixture scenario was already selected", html.contains("investment-android-test-scenario"));
        byte[] selected = html.replace("</head>",
            "<meta name=\"investment-android-test-scenario\" content=\"catalog-startup-recovery\"></head>")
            .getBytes(StandardCharsets.UTF_8);
        assertTrue("Selected fixture index exceeded its bound", selected.length <= 65536);
        copiedBytes += selected.length - original.length;
        Files.write(index.toPath(), selected);
    }

    private void assertCatalogRecoveryState(int statusCalls, int searchCalls, String query, boolean pending, boolean recovered, String message) throws Exception {
        awaitPage("catalog recovery status=" + statusCalls + ", search=" + searchCalls + ", pending=" + pending,
            "(() => { const d = " + DIAGNOSTICS + "; const discover = document.querySelector(" + JSONObject.quote(DISCOVER) + ");" +
            " const refresh = discover.querySelector('.trial-toolbar button');" +
            " const search = discover.querySelector('button[type=submit]');" +
            " const receipt = discover.querySelector('.managed-catalog-receipt');" +
            " return d.catalogRecovery && d.load === 1 && d.status === " + statusCalls + " && d.search === " + searchCalls +
            " && d.catalogReleased === " + (recovered ? 1 : 0) +
            " && d.save === 0 && d.resolve === 0 && d.annual === 0 && d.token === 0 && d.signOut === 0" +
            " && d.aborted === 0 && d.lateResolved === 0" +
            " && refresh.disabled === " + pending + " && refresh.textContent === " + JSONObject.quote(pending ? "Loading catalog…" : "Refresh catalog") +
            " && search.disabled === " + pending + " && search.textContent === 'Search'" +
            " && document.querySelector('#workspace-company-query')?.disabled === false" +
            " && document.querySelector('#workspace-company-query')?.value === " + JSONObject.quote(query) +
            " && discover.querySelector(':scope > p[role=status]')?.textContent === " + JSONObject.quote(message) +
            " && (receipt !== null) === " + recovered +
            (recovered ? " && receipt.querySelector('summary').textContent === '2 available listings · Catalog as of 2026-09-20T00:00:00.000Z'" +
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
            "document.querySelector('#managed-annual-heading')?.textContent === 'Annual report · ZERO'" +
            " && document.querySelector('.managed-annual-report')?.getAttribute('aria-busy') === 'true'" +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE) +
            " && document.querySelector('#managed-note-0')?.value === 'Invented second note'" +
            " && document.querySelector('#workspace-company-query')?.value === 'ZERO'" +
            " && document.querySelector('.managed-results strong')?.textContent === 'ZERO'" +
            " && Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'" +
            " && document.body.textContent.includes('Version 1 · Unsaved changes')");
    }

    private void assertFixtureReadCounts(int aborted, int lateResolved) throws Exception {
        awaitPage("exact fixture calls, aborted=" + aborted + ", lateResolved=" + lateResolved,
            DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1" +
            " && " + DIAGNOSTICS + ".search === 1 && " + DIAGNOSTICS + ".annual === 1" +
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
        click("button[aria-label='Move ZERO down']");
        awaitPage("watchlist reordered", "Array.from(document.querySelectorAll('.managed-memberships > li > strong')).map(e => e.textContent).join(',') === 'ONE,ZERO'");
        typeIntoInput("managed-note-1", NOTE);
        awaitPage("draft note edited", "document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(NOTE));
        click(ANNUAL);
        awaitPage("Annual panel opened", "document.querySelector('#managed-annual-heading')?.textContent === 'Annual report · ZERO'");
        assertRootHistory();
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
        awaitPage("test-only source, origin and disconnected boundaries",
            "location.origin === 'https://localhost' && location.hash === ''" +
            " && document.querySelector('meta[name=investment-build-sha]')?.content === " + JSONObject.quote(expectedSourceSha) +
            " && document.querySelector('meta[name=investment-android-test]')?.content === 'managed-workspace'" +
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content === " + JSONObject.quote(CSP) +
            " && window.Capacitor?.getPlatform() === 'android'" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DIAGNOSTICS + ".save === 0 && " + DIAGNOSTICS + ".resolve === 0");
    }

    private void assertRootHistory() {
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            WebBackForwardList history = webView.copyBackForwardList();
            String diagnostic = "index=" + history.getCurrentIndex() + ", size=" + history.getSize() +
                ", canGoBack=" + webView.canGoBack() + ", callbacks=" + activity.getOnBackPressedDispatcher().hasEnabledCallbacks();
            Log.i("ManagedBack", diagnostic);
            assertEquals(diagnostic, 0, history.getCurrentIndex());
            assertEquals(diagnostic, 1, history.getSize());
            assertFalse(diagnostic, webView.canGoBack());
            assertTrue(diagnostic, activity.getOnBackPressedDispatcher().hasEnabledCallbacks());
            assertEquals("https://localhost/", webView.getUrl());
        });
    }

    private void click(String selector) {
        onWebView().withElement(findElement(Locator.CSS_SELECTOR, selector)).perform(webClick());
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
        String rawGeometry = observed.get();
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
