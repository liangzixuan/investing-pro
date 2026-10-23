package local.investment.personal;

import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.junit.Assert.*;

import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** Read-only product observations share one absolute budget per requested page condition. */
final class ReportRevisitPage {
    enum Readiness { DOM, NATIVE }
    enum Budget {
        ACTION(10_000), STARTUP(30_000);
        final long millis;
        Budget(long millis) { this.millis = millis; }
    }
    record Script(String expression) {}
    record Element(Locator locator, String selector) {
        static Element css(String selector) { return new Element(Locator.CSS_SELECTOR, selector); }
        static Element xpath(String selector) { return new Element(Locator.XPATH, selector); }
        static Element revisit(String label) { return xpath("//details[contains(@class,'managed-report-revisit')]//button[normalize-space(.)='" + label + "']"); }
    }
    record Check(String description, Script predicate, Readiness readiness, View dismissedDialog) {
        Check(String description, Script predicate) { this(description, predicate, Readiness.DOM, null); }
        Check nativeReady() { return new Check(description, predicate, Readiness.NATIVE, dismissedDialog); }
    }
    record Draft(String before, AnnualReads annual) {}
    enum AnnualReads { NONE, ONE }
    private final ActivityScenario<MainActivity> scenario;
    ReportRevisitPage(ActivityScenario<MainActivity> scenario) { this.scenario = scenario; }
    private static final class Wait {
        final Check check;
        final long deadline;
        final AtomicReference<String> nativeState = new AtomicReference<>("not checked");
        final AtomicReference<String> readState = new AtomicReference<>("not observed");
        int missedCallbacks;
        Wait(Check check, Budget budget) { this.check = check; deadline = SystemClock.uptimeMillis() + budget.millis; }
        boolean remaining() { return SystemClock.uptimeMillis() < deadline; }
        long remainingMillis() { return deadline - SystemClock.uptimeMillis(); }
    }
    private static final class Observation {
        final CountDownLatch returned = new CountDownLatch(1);
        final AtomicReference<String> result = new AtomicReference<>();
        boolean completed(Wait wait) throws InterruptedException {
            long remaining = wait.remainingMillis();
            if (remaining <= 0) return false;
            if (returned.await(Math.min(2_000, remaining), TimeUnit.MILLISECONDS)) return true;
            wait.missedCallbacks++;
            return false;
        }
        boolean passed(Wait wait) { if (!wait.remaining()) return false; return "true".equals(result.get()); }
    }
    void click(Element target) { onWebView().withElement(findElement(target.locator, target.selector)).perform(webClick()); }
    void await(Check check) throws Exception { await(new Wait(check, Budget.ACTION)); }
    void awaitStartup(Check check) throws Exception { await(new Wait(check, Budget.STARTUP)); }
    private void await(Wait wait) throws Exception {
        while (wait.remaining()) {
            if (!idleAfterDialog(wait)) break;
            Observation observed = query(wait);
            if (!observed.completed(wait)) continue;
            if (observed.passed(wait)) return;
            if (wait.check.dismissedDialog == null) Thread.sleep(50);
        }
        failWaiting(wait);
    }
    private boolean idleAfterDialog(Wait wait) {
        if (wait.check.dismissedDialog == null) return true;
        long remaining = wait.remainingMillis();
        if (remaining <= 0) return false;
        try {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(50, remaining);
            return true;
        } catch (java.util.concurrent.TimeoutException timeout) {
            wait.nativeState.set("accessibility did not become idle before the page deadline");
            return false;
        }
    }
    private record Callback(Wait waiting, Observation observed, String value) {}
    private Observation query(Wait wait) {
        Observation observed = new Observation();
        scenario.onActivity(activity -> {
            if (!wait.remaining()) { observed.returned.countDown(); return; }
            WebView webView = activity.getBridge().getWebView();
            if (!nativeAdmitted(activity, webView, wait)) { observed.returned.countDown(); return; }
            if (!wait.remaining()) { observed.returned.countDown(); return; }
            webView.evaluateJavascript(ReportRevisitReadObservation.wrap(wait.check.predicate.expression), value -> {
                acceptResult(activity, webView, new Callback(wait, observed, value));
                observed.returned.countDown();
            });
        });
        return observed;
    }
    private void acceptResult(MainActivity activity, WebView webView, Callback result) {
        if (!result.waiting.remaining()) return;
        if (!nativeAdmitted(activity, webView, result.waiting)) return;
        if (!result.waiting.remaining()) return;
        ReportRevisitReadObservation.Result decoded = ReportRevisitReadObservation.decode(result.value);
        if (!result.waiting.remaining()) return;
        result.waiting.readState.set(decoded.observation());
        result.observed.result.set(decoded.passed() ? "true" : "false");
    }
    private boolean nativeAdmitted(MainActivity activity, WebView webView, Wait wait) {
        if (wait.check.readiness == Readiness.DOM) return true;
        if (!fixtureNativeReady(activity, webView, wait.nativeState)) return false;
        View dialog = wait.check.dismissedDialog;
        if (dialog == null) return true;
        boolean attached = dialog.isAttachedToWindow();
        boolean shown = dialog.isShown();
        wait.nativeState.set(wait.nativeState.get() + ", selectedDialogAttached=" + attached + ", selectedDialogShown=" + shown);
        if (attached) return false;
        return !shown;
    }
    private void failWaiting(Wait wait) {
        String diagnostic = "missed callbacks=" + wait.missedCallbacks + "; read=" + wait.readState.get();
        if (wait.check.readiness == Readiness.NATIVE)
            diagnostic += "; native=" + wait.nativeState.get() + "; activeWindow=" + NativeReadinessFailureObservation.capture();
        Log.e("ManagedFixture", "Timed out waiting for " + wait.check.description + ": " + diagnostic);
        fail("Timed out waiting for " + wait.check.description + ": " + diagnostic);
    }
    String raw(Script script) throws Exception {
        long deadline = SystemClock.uptimeMillis() + Budget.ACTION.millis;
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script.expression, value -> {
            if (SystemClock.uptimeMillis() < deadline) result.set(value);
            returned.countDown();
        }));
        long remaining = deadline - SystemClock.uptimeMillis();
        assertTrue("Fixture observation retains its original budget", remaining > 0);
        assertTrue("Fixture observation callback", returned.await(remaining, TimeUnit.MILLISECONDS));
        assertTrue("Fixture observation completes before its original deadline", SystemClock.uptimeMillis() < deadline);
        assertNotNull("Fixture observation returned a value", result.get());
        return result.get();
    }
    String read(Script script) throws Exception {
        Object value = new org.json.JSONTokener(raw(script)).nextValue();
        assertTrue(value instanceof String);
        return (String)value;
    }
    void requireUnchanged(Draft expected) throws Exception {
        String draft = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
        String diagnostics = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
        await(new Check("full original draft/order and explicit source counters retained", new Script("JSON.stringify(" + draft + ")===" + JSONObject.quote(expected.before) + " && " + diagnostics + ".annual===" + expected.annual.ordinal() + " && " + diagnostics + ".eod===0 && " + diagnostics + ".filings===0 && " + diagnostics + ".save===0 && " + diagnostics + ".token===0 && " + diagnostics + ".signOut===0")));
    }
    private boolean fixtureNativeReady(MainActivity activity, WebView webView, AtomicReference<String> diagnostic) {
        Lifecycle.State state = activity.getLifecycle().getCurrentState();
        boolean attached = webView.isAttachedToWindow();
        boolean shown = webView.isShown();
        boolean hardware = webView.isHardwareAccelerated();
        boolean activityFocused = activity.hasWindowFocus();
        boolean webViewFocused = webView.hasWindowFocus();
        boolean focused = activityFocused && webViewFocused;
        boolean callbacks = activity.getOnBackPressedDispatcher().hasEnabledCallbacks();
        diagnostic.set("state=" + state + ", attached=" + attached + ", shown=" + shown +
            ", hardware=" + hardware + ", activityFocused=" + activityFocused +
            ", webViewFocused=" + webViewFocused + ", focused=" + focused + ", callbacks=" + callbacks);
        return state == Lifecycle.State.RESUMED && attached && shown && hardware && focused && callbacks;
    }
}
