package local.investment.personal;

import static org.junit.Assert.*;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.ViewTreeObserver;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONArray;

/** One committed scroll and fresh geometry before the valuation file chooser's real touch. */
final class ValuationChooserGeometry {
    private ValuationChooserGeometry() {}

    private static final String TARGET =
        "const input=document.querySelector('#managed-valuation-draft-files input[type=file]'),label=input?.closest('label');" +
        "if(!input||input.disabled||!label||label.control!==input||!input.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return null;" +
        "const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()==='Select a valuation inputs file');" +
        "if(!text)return null;";

    // Passive, fixed-field diagnostics in the invented test page only. A new arm retires
    // the previous listeners; at most 32 records are retained per arm of the trace.
    private static final String TRACE =
        "window.__valuationChooserTrace?.controller.abort();window.__valuationChooserTrace?.events.splice(0);" +
        "const trace={controller:new AbortController(),events:[]};window.__valuationChooserTrace=trace;" +
        "for(const type of ['pointerdown','pointerup','pointercancel','click'])for(const capture of [true,false])" +
        "document.addEventListener(type,event=>{" +
        "const target=event.target,activation=navigator.userActivation;" +
        "trace.events.push({type:event.type,phase:capture?'capture':'bubble'," +
        "target:target===input?'input':target===label?'label':label.contains(target)?'label-child':'outside'," +
        "trusted:event.isTrusted,prevented:event.defaultPrevented,x:event.clientX,y:event.clientY," +
        "pointerId:event.pointerId??null,inputEnabled:!input.disabled,inputFocused:document.activeElement===input," +
        "active:activation?.isActive??null,hasBeenActive:activation?.hasBeenActive??null});" +
        "if(trace.events.length===32)trace.controller.abort();},{capture,passive:true,signal:trace.controller.signal});";

    private static final String DRAIN =
        "(() => {const trace=window.__valuationChooserTrace;if(!trace)return [];" +
        "trace.controller.abort();const events=trace.events;trace.events=[];" +
        "delete window.__valuationChooserTrace;return events;})()";
    private static final java.util.Set<String> TRACE_FIELDS = java.util.Set.of(
        "type", "phase", "target", "trusted", "prevented", "x", "y", "pointerId",
        "inputEnabled", "inputFocused", "active", "hasBeenActive");

    private static final String SCROLL =
        "(() => {" + TARGET + TRACE + "label.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true;})()";

    private static final String GEOMETRY =
        "(() => {" + TARGET +
        "const range=document.createRange();range.selectNodeContents(text);" +
        "const r=range.getBoundingClientRect(),ir=input.getBoundingClientRect(),v=visualViewport;" +
        "const x=r.left+r.width/2,y=r.top+r.height/2;" +
        "return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:v.width,height:v.height," +
        "offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,domScrollX:scrollX,domScrollY:scrollY," +
        "finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,ir.left,ir.top,ir.right,ir.bottom,ir.width,ir.height," +
        "v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio,scrollX,scrollY].every(Number.isFinite)" +
        "&&r.width>0&&r.height>0&&ir.width>0&&ir.height>0&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
        "visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height" +
        "&&ir.left>=v.offsetLeft&&ir.top>=v.offsetTop&&ir.right<=v.offsetLeft+v.width&&ir.bottom<=v.offsetTop+v.height," +
        "hit:label.contains(document.elementFromPoint(x,y))};})()";

    static PreparedTouch await(ActivityScenario<MainActivity> scenario, long timeoutMs) throws Exception {
        long deadline = SystemClock.uptimeMillis() + timeoutMs;
        Handler main = new Handler(Looper.getMainLooper());
        CompletableFuture<String> result = new CompletableFuture<>();
        AtomicReference<String> phase = new AtomicReference<>("scroll");
        AtomicReference<WebView> page = new AtomicReference<>();
        AtomicReference<ViewTreeObserver> observer = new AtomicReference<>();
        AtomicReference<Runnable> callback = new AtomicReference<>();
        try {
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                page.set(webView);
                step(result, deadline, () -> {
                    requireVisibleHardware(webView);
                    webView.evaluateJavascript(SCROLL, value -> step(result, deadline, () -> {
                        assertEquals("The exact enabled valuation chooser must scroll", "true", value);
                        phase.set("visual-state");
                        webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                            @Override public void onComplete(long requestId) {
                                step(result, deadline, () -> {
                                    requireVisibleHardware(webView);
                                    phase.set("frame-commit");
                                    Runnable committed = () -> main.post(() -> step(result, deadline, () -> {
                                        requireVisibleHardware(webView);
                                        phase.set("fresh-geometry");
                                        webView.evaluateJavascript(GEOMETRY, geometry -> step(result, deadline, () -> {
                                            requireVisibleHardware(webView);
                                            JSONObject measured = new JSONObject(geometry);
                                            assertTrue("Committed chooser geometry must be finite", measured.getBoolean("finite"));
                                            assertTrue("Committed chooser and input must be visible", measured.getBoolean("visible"));
                                            assertTrue("Committed chooser label must own its touch center", measured.getBoolean("hit"));
                                            assertScrollAligned(webView, measured);
                                            result.complete(geometry);
                                        }));
                                    }));
                                    ViewTreeObserver current = webView.getViewTreeObserver();
                                    observer.set(current);
                                    callback.set(committed);
                                    current.registerFrameCommitCallback(committed);
                                    webView.invalidate();
                                });
                            }
                        });
                    }));
                });
            });
            long remaining = deadline - SystemClock.uptimeMillis();
            assertTrue("Valuation chooser geometry deadline remains", remaining > 0);
            String geometry = result.get(remaining, TimeUnit.MILLISECONDS);
            return new PreparedTouch(page.get(), geometry);
        } catch (Exception error) {
            throw new java.io.IOException("Valuation chooser geometry failed at " + phase.get(), error);
        } finally {
            result.cancel(false);
            main.post(() -> unregister(observer.get(), callback.get()));
        }
    }

    static final class PreparedTouch {
        final String geometry;
        private final WebView page;
        PreparedTouch(WebView page, String geometry) {
            this.page = page;
            this.geometry = geometry;
        }
        void logTrace(long timeoutMs) {
            try {
                logChunks(checkedTrace(readTrace(page, timeoutMs)));
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                Log.w("ValuationChooserEvent", "Diagnostic read interrupted; original outcome preserved");
            } catch (Exception | AssertionError failure) {
                Log.w("ValuationChooserEvent", "Diagnostic read unavailable: " + failure.getClass().getSimpleName());
            }
        }
    }

    /** Observe the retained test WebView even when DocumentsUI has paused its Activity. */
    private static String readTrace(WebView page, long timeoutMs) throws Exception {
        CompletableFuture<String> result = new CompletableFuture<>();
        new Handler(Looper.getMainLooper()).post(() -> {
            if (result.isDone()) return;
            try {
                page.evaluateJavascript(DRAIN, result::complete);
            } catch (RuntimeException | AssertionError failure) {
                result.completeExceptionally(failure);
            }
        });
        try {
            return result.get(timeoutMs, TimeUnit.MILLISECONDS);
        } finally {
            result.cancel(false);
        }
    }

    private static String checkedTrace(String raw) throws Exception {
        assertNotNull("Chooser trace response must exist", raw);
        assertTrue("Chooser trace response stays bounded", raw.length() <= 16384);
        JSONArray records = new JSONArray(raw);
        assertTrue("Chooser trace retains at most 32 records", records.length() <= 32);
        for (int index = 0; index < records.length(); index++) checkRecord(records.getJSONObject(index));
        return records.toString();
    }

    private static void checkRecord(JSONObject record) throws Exception {
        assertEquals("Chooser trace has only fixed metadata fields", TRACE_FIELDS.size(), record.length());
        for (String field : TRACE_FIELDS) assertTrue("Chooser trace field must exist", record.has(field));
        checkEnum(record, "type", java.util.Set.of("pointerdown", "pointerup", "pointercancel", "click"));
        checkEnum(record, "phase", java.util.Set.of("capture", "bubble"));
        checkEnum(record, "target", java.util.Set.of("input", "label", "label-child", "outside"));
        for (String field : new String[] { "trusted", "prevented", "inputEnabled", "inputFocused" }) {
            assertTrue("Chooser trace flag must be boolean", record.get(field) instanceof Boolean);
        }
        for (String field : new String[] { "active", "hasBeenActive" }) checkOptionalFlag(record, field);
        checkNumber(record, "x");
        checkNumber(record, "y");
        if (!record.isNull("pointerId")) checkNumber(record, "pointerId");
    }

    private static void checkEnum(JSONObject record, String field, java.util.Set<String> allowed) throws Exception {
        assertTrue("Chooser trace category must be a string", record.get(field) instanceof String);
        assertTrue("Chooser trace category must be fixed", allowed.contains(record.getString(field)));
    }

    private static void checkOptionalFlag(JSONObject record, String field) throws Exception {
        if (record.isNull(field)) return;
        assertTrue("Chooser activation flag must be boolean or null", record.get(field) instanceof Boolean);
    }

    private static void checkNumber(JSONObject record, String field) throws Exception {
        Object value = record.get(field);
        assertTrue("Chooser trace coordinate must be numeric", value instanceof Number);
        assertTrue("Chooser trace coordinate must be finite", Double.isFinite(((Number) value).doubleValue()));
    }

    private static void logChunks(String checked) {
        final int width = 2000;
        int parts = Math.max(1, (checked.length() + width - 1) / width);
        for (int start = 0; start < checked.length(); start += width) {
            Log.i("ValuationChooserEvent", "part=" + (start / width + 1) + "/" + parts + " " +
                checked.substring(start, Math.min(start + width, checked.length())));
        }
    }

    private static void unregister(ViewTreeObserver observer, Runnable callback) {
        if (observer == null) return;
        if (!observer.isAlive()) return;
        if (callback == null) return;
        observer.unregisterFrameCommitCallback(callback);
    }

    private static void requireVisibleHardware(WebView webView) {
        assertTrue("Valuation chooser needs an attached visible hardware WebView",
            webView.isAttachedToWindow() && webView.isShown() && webView.isHardwareAccelerated());
        assertTrue("Valuation chooser WebView window must retain focus", webView.hasWindowFocus());
    }

    private static void assertScrollAligned(WebView webView, JSONObject geometry) throws Exception {
        double scale = geometry.getDouble("scale") * geometry.getDouble("ratio");
        assertTrue("Committed chooser visual-to-native scale is valid", Double.isFinite(scale) && scale > 0);
        double x = geometry.getDouble("domScrollX") * scale;
        double y = geometry.getDouble("domScrollY") * scale;
        Log.i("ValuationChooserGeometry", "visualReady=true, frameCommitted=true, domScrollX=" +
            geometry.getDouble("domScrollX") + ", domScrollY=" + geometry.getDouble("domScrollY") +
            ", pixelsPerCssPixel=" + scale + ", nativeScrollX=" + webView.getScrollX() +
            ", nativeScrollY=" + webView.getScrollY() + ", windowFocus=" + webView.hasWindowFocus() +
            ", viewFocus=" + webView.hasFocus() + ", attached=" + webView.isAttachedToWindow() +
            ", shown=" + webView.isShown() + ", hardware=" + webView.isHardwareAccelerated());
        // The native scroll is integral; allow only its rounding to the nearest device pixel.
        assertEquals("Committed chooser horizontal scroll matches the DOM", x, webView.getScrollX(), 1.0);
        assertEquals("Committed chooser vertical scroll matches the DOM", y, webView.getScrollY(), 1.0);
    }

    private interface Observation { void run() throws Exception; }

    private static void step(CompletableFuture<String> result, long deadline, Observation observation) {
        if (result.isDone()) return;
        if (SystemClock.uptimeMillis() >= deadline) {
            result.completeExceptionally(new java.util.concurrent.TimeoutException("Valuation chooser observation deadline expired"));
            return;
        }
        try {
            observation.run();
        } catch (Exception | AssertionError failure) {
            result.completeExceptionally(failure);
        }
    }
}
