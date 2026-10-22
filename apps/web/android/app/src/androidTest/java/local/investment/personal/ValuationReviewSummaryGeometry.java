package local.investment.personal;

import static org.junit.Assert.*;

import android.graphics.RectF;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.inspector.WindowInspector;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Observes the existing complete-comparison action before one native summary touch. */
final class ValuationReviewSummaryGeometry {
    private static final String TARGET =
        "const summaries=document.querySelectorAll('#managed-valuation-file-review-heading ~ details > summary'),summary=summaries[0];" +
        "if(summaries.length!==1||!summary.isConnected||summary.hasAttribute('disabled')||summary.closest('[inert]')" +
        "||!summary.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return null;";
    private static final String SCROLL =
        "(() => {" + TARGET + "summary.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});return true;})()";
    private static final String GEOMETRY =
        "(() => {" + TARGET + "const r=summary.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;" +
        "return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:v.width,height:v.height," +
        "offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,domScrollX:scrollX,domScrollY:scrollY," +
        "finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio,scrollX,scrollY].every(Number.isFinite)" +
        "&&r.width>0&&r.height>0&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
        "visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height," +
        "hit:summary.contains(document.elementFromPoint(x,y))};})()";

    private final long deadline;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final CompletableFuture<String> result = new CompletableFuture<>();
    private Phase phase = Phase.SCROLL;
    private ViewTreeObserver observer;
    private Runnable callback;

    private ValuationReviewSummaryGeometry(Duration timeout) {
        deadline = SystemClock.uptimeMillis() + timeout.toMillis();
    }

    static String await(ActivityScenario<MainActivity> scenario, Duration timeout) throws Exception {
        return new ValuationReviewSummaryGeometry(timeout).observe(scenario);
    }

    private String observe(ActivityScenario<MainActivity> scenario) throws Exception {
        try {
            scenario.onActivity(activity -> step(() -> scroll(activity)));
            long remaining = deadline - SystemClock.uptimeMillis();
            assertTrue("Review summary geometry deadline remains", remaining > 0);
            return result.get(remaining, TimeUnit.MILLISECONDS);
        } catch (Exception failure) {
            throw new java.io.IOException("Review summary geometry failed at " + phase, failure);
        } finally {
            result.cancel(false);
            cleanup();
        }
    }

    private void scroll(MainActivity activity) {
        WebView page = activity.getBridge().getWebView();
        requireVisibleHardware(page);
        page.evaluateJavascript(SCROLL, value -> step(() -> {
            assertEquals("The exact enabled review summary must scroll", "true", value);
            phase = Phase.VISUAL_STATE;
            page.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                @Override public void onComplete(long requestId) {
                    step(() -> commitFrame(page, activity.getWindow()));
                }
            });
        }));
    }

    private void commitFrame(WebView page, Window window) {
        requireVisibleHardware(page);
        phase = Phase.FRAME_COMMIT;
        callback = () -> main.post(() -> step(() -> measure(page, window)));
        observer = page.getViewTreeObserver();
        observer.registerFrameCommitCallback(callback);
        page.invalidate();
    }

    private void measure(WebView page, Window window) {
        requireVisibleHardware(page);
        phase = Phase.FRESH_GEOMETRY;
        page.evaluateJavascript(GEOMETRY, raw -> step(() -> {
            requireVisibleHardware(page);
            JSONObject geometry = new JSONObject(raw);
            assertTrue("Committed review summary geometry must be finite", geometry.getBoolean("finite"));
            assertTrue("Committed review summary must be fully visible", geometry.getBoolean("visible"));
            assertTrue("Committed review summary must own its touch center", geometry.getBoolean("hit"));
            requireScrollAligned(page, geometry);
            requireUnobscured(page, window, geometry);
            assertTrue("Review summary observation finishes within its deadline", SystemClock.uptimeMillis() < deadline);
            result.complete(raw);
        }));
    }

    private static void requireScrollAligned(WebView page, JSONObject geometry) throws Exception {
        double scale = geometry.getDouble("scale") * geometry.getDouble("ratio");
        assertTrue("Review summary visual-to-native scale is valid", Double.isFinite(scale) && scale > 0);
        assertEquals("Review summary horizontal scroll matches the DOM",
            geometry.getDouble("domScrollX") * scale, page.getScrollX(), 1.0);
        assertEquals("Review summary vertical scroll matches the DOM",
            geometry.getDouble("domScrollY") * scale, page.getScrollY(), 1.0);
    }

    private static void requireUnobscured(WebView page, Window window, JSONObject geometry) throws Exception {
        List<View> roots = WindowInspector.getGlobalWindowViews();
        assertNotNull("Current-process window roots must be observable", roots);
        assertTrue("Review summary window observation stays bounded", roots.size() <= 8);
        View mainDecor = window.peekDecorView();
        assertNotNull("Review summary activity decor must exist", mainDecor);
        assertTrue("Current-process roots include the activity decor", roots.contains(mainDecor));
        int[] location = new int[2];
        page.getLocationOnScreen(location);
        double scale = geometry.getDouble("scale") * geometry.getDouble("ratio");
        float x = location[0] + (float) ((geometry.getDouble("x") - geometry.getDouble("offsetLeft")) * scale);
        float y = location[1] + (float) ((geometry.getDouble("y") - geometry.getDouble("offsetTop")) * scale);
        assertTrue("Review summary screen point must be finite", Float.isFinite(x) && Float.isFinite(y));
        for (View root : roots) {
            assertNotNull("Observed window root must exist", root);
            if (root == mainDecor) continue;
            if (!root.isAttachedToWindow()) continue;
            if (!root.isShown()) continue;
            if (root.getWindowVisibility() != View.VISIBLE) continue;
            assertTrue("Visible other window must have measurable bounds", root.getWidth() > 0 && root.getHeight() > 0);
            root.getLocationOnScreen(location);
            RectF bounds = new RectF(location[0], location[1],
                location[0] + root.getWidth(), location[1] + root.getHeight());
            assertFalse("Review summary touch must be outside every visible other app window", bounds.contains(x, y));
        }
    }

    private static void requireVisibleHardware(WebView page) {
        assertTrue("Review summary needs an attached visible hardware WebView",
            page.isAttachedToWindow() && page.isShown() && page.isHardwareAccelerated());
        assertTrue("Review summary WebView must retain native focus", page.hasWindowFocus() && page.hasFocus());
    }

    private void step(Observation observation) {
        if (result.isDone()) return;
        if (SystemClock.uptimeMillis() >= deadline) {
            result.completeExceptionally(new java.util.concurrent.TimeoutException("Review summary observation deadline expired"));
            return;
        }
        try { observation.run(); }
        catch (Exception | AssertionError failure) { result.completeExceptionally(failure); }
    }

    private void cleanup() {
        try {
            main.post(() -> {
                try {
                    if (observer == null) return;
                    if (!observer.isAlive()) return;
                    if (callback == null) return;
                    observer.unregisterFrameCommitCallback(callback);
                } catch (RuntimeException | AssertionError failure) { cleanupWarning(); }
            });
        } catch (RuntimeException | AssertionError failure) { cleanupWarning(); }
    }

    private static void cleanupWarning() {
        try { Log.w("ValuationReviewSummary", "Frame cleanup unavailable; original outcome preserved"); }
        catch (RuntimeException | AssertionError ignored) { }
    }

    private enum Phase { SCROLL, VISUAL_STATE, FRAME_COMMIT, FRESH_GEOMETRY }
    private interface Observation { void run() throws Exception; }
}
