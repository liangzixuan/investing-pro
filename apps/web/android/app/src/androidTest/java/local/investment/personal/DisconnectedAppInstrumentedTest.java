package local.investment.personal;

import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.getText;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.graphics.Bitmap;
import android.os.SystemClock;
import android.webkit.WebSettings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestName;
import org.junit.runner.RunWith;

/** Tests the installed disconnected bundle. No credentials, API calls, or router mocks. */
@RunWith(AndroidJUnit4.class)
public class DisconnectedAppInstrumentedTest {
    private static final String ORIGIN = "https://localhost";
    private static final String MARKETS = "#/markets";
    private static final String WATCHLIST = "#/discover?view=watchlist";
    private static final String LOCKED_HEADING = "Sign in to search companies.";
    private static final String DISCONNECTED_CSP =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; " +
        "object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final long PAGE_TIMEOUT_MS = 10_000;

    @Rule public final TestName testName = new TestName();

    private ActivityScenario<MainActivity> scenario;
    private String expectedSourceSha;

    @Before
    public void launchFreshActivity() throws Exception {
        expectedSourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull("Pass the commit used to build the mobile assets as expectedSourceSha", expectedSourceSha);
        assertTrue("Expected a full source SHA", expectedSourceSha.matches("[0-9a-f]{40}"));
        assertFalse("This suite must use the disconnected profile", BuildConfig.CLERK_AUTH_ENABLED);
        scenario = ActivityScenario.launch(MainActivity.class);
        awaitLockedRoute(MARKETS);
    }

    @Test
    public void packagedAppLaunchesWithDisconnectedGuards() throws Exception {
        assertNativeBoundary();
        assertLockedPage();
        onWebView()
            .withElement(findElement(Locator.CSS_SELECTOR, ".mobile-connection-notice"))
            .check(webMatches(getText(), containsString("This build cannot load or save your research.")));

        // Exercise an actual local control without opening any account or data flow.
        onWebView()
            .withElement(findElement(Locator.CSS_SELECTOR, ".mobile-license-notices > summary"))
            .perform(webClick());
        awaitPage("open-source notices opened", "document.querySelector('.mobile-license-notices')?.open === true");
        onWebView()
            .withElement(findElement(Locator.CSS_SELECTOR, ".mobile-license-notices > pre"))
            .check(webMatches(getText(), containsString("Capacitor")));
        assertLockedPage();
    }

    @Test
    public void localNavigationAndHardwareBackKeepWorkspaceLocked() throws Exception {
        visitLockedWatchlistAndReturnHome();
        pressBack();
        awaitLockedRoute(WATCHLIST);
        assertLockedPage();
        pressBack();
        awaitLockedRoute(MARKETS);
        assertLockedPage();
    }

    @Test
    public void recreatedActivityReloadsPackagedAppAndBackStillWorks() throws Exception {
        openWatchlistRoute();
        assertLockedPage();
        scenario.recreate();
        // Capacitor restores plugin state, not WebView route history. The bundled entry loads again.
        awaitLockedRoute(MARKETS);
        assertNativeBoundary();
        assertLockedPage();
        visitLockedWatchlistAndReturnHome();
        pressBack();
        awaitLockedRoute(WATCHLIST);
        assertLockedPage();
    }

    private void assertNativeBoundary() {
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNotNull("Capacitor bridge loaded", activity.getBridge());
            assertNotNull("Native App plugin loaded", activity.getBridge().getPlugin("App"));
            assertNull("Disconnected builds must not register authentication", activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            assertTrue("Capacitor enables JavaScript; the test does not change this setting", activity.getBridge().getWebView().getSettings().getJavaScriptEnabled());
        });
    }

    private void assertLockedPage() throws Exception {
        onWebView()
            .withElement(findElement(Locator.CSS_SELECTOR, ".personal-locked-state > h1"))
            .check(webMatches(getText(), is(LOCKED_HEADING)));
        onWebView()
            .withElement(findElement(Locator.CSS_SELECTOR, ".owner-session-state"))
            .check(webMatches(getText(), is("LOCKED")));
        awaitPage(
            "disconnected source and access boundaries",
            "location.origin === " + JSONObject.quote(ORIGIN) +
            " && document.querySelector('meta[name=investment-build-sha]')?.content === " + JSONObject.quote(expectedSourceSha) +
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content === " + JSONObject.quote(DISCONNECTED_CSP) +
            " && document.querySelector('#workspace-company-query')?.disabled === true" +
            " && document.querySelector('.workspace-global-search button')?.disabled === true" +
            " && document.querySelector('.workspace-navigation') === null" +
            " && document.querySelector('#watchlist-title') === null" +
            " && window.Capacitor?.getPlatform() === 'android'"
        );
    }

    private void openWatchlistRoute() throws Exception {
        // Navigate through the real WebView to a supported local hash route. No auth state is injected.
        scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl(ORIGIN + "/" + WATCHLIST));
        awaitLockedRoute(WATCHLIST);
    }

    private void visitLockedWatchlistAndReturnHome() throws Exception {
        openWatchlistRoute();
        assertLockedPage();
        onWebView()
            .withElement(findElement(Locator.CSS_SELECTOR, "a.workspace-brand[href='#/markets']"))
            .perform(webClick());
        awaitLockedRoute(MARKETS);
        assertLockedPage();
    }

    private void awaitLockedRoute(String hash) throws Exception {
        awaitPage(
            "locked route " + hash,
            "location.hash === " + JSONObject.quote(hash) +
            " && document.querySelector('.personal-locked-state > h1')?.textContent === " + JSONObject.quote(LOCKED_HEADING) +
            " && document.querySelector('.owner-session-state')?.textContent === 'Locked'"
        );
    }

    /** Bounded observation of React rendering, with no JS state changes or fixed startup sleep. */
    private void awaitPage(String description, String predicate) throws Exception {
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        while (SystemClock.uptimeMillis() < deadline) {
            CountDownLatch returned = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();
            scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                "Boolean(" + predicate + ")",
                value -> {
                    result.set(value);
                    returned.countDown();
                }
            ));
            assertTrue("WebView stopped responding while waiting for " + description, returned.await(2, TimeUnit.SECONDS));
            if ("true".equals(result.get())) return;
            Thread.sleep(50);
        }
        fail("Timed out waiting for " + description);
    }

    @After
    public void retainScreenshotAndCloseActivity() throws IOException {
        if (scenario == null) return;
        try {
            String configuredOutput = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
            File output = configuredOutput == null
                ? new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalCacheDir(), "instrumentation-screenshots")
                : new File(configuredOutput);
            assertTrue("Cannot create screenshot output", output.isDirectory() || output.mkdirs());
            Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull("No emulator screenshot returned", screenshot);
            try (FileOutputStream stream = new FileOutputStream(new File(output, testName.getMethodName() + ".png"))) {
                assertTrue("Cannot encode screenshot", screenshot.compress(Bitmap.CompressFormat.PNG, 100, stream));
            } finally {
                screenshot.recycle();
            }
        } finally {
            scenario.close();
        }
    }
}
