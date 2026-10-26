package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static org.junit.Assert.*;

import android.graphics.Rect;
import android.os.SystemClock;
import android.util.Log;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** One observed DOM target maps to one guarded app-scoped native touch. */
final class ReportRevisitTouch {
    enum Field {
        REPORT_ASSESSMENT(".managed-report-revisit textarea:not([readonly])", "report comparison assessment"),
        COMPANY_NOTE("#managed-note-0", "company note"),
        FOLLOWUP_DUE("#managed-followups-new-due", "Follow-up due date"),
        FOLLOWUP_QUESTION("#managed-followup-check", "Follow-up question"),
        FOLLOWUP_RESULT("#managed-research-followup-result", "Follow-up assessment");
        final String selector;
        final String description;
        Field(String selector, String description) { this.selector = selector; this.description = description; }
        static Field forId(String id) {
            return switch (id) {
                case "managed-note-0" -> COMPANY_NOTE;
                case "managed-followups-new-due" -> FOLLOWUP_DUE;
                case "managed-followup-check" -> FOLLOWUP_QUESTION;
                case "managed-research-followup-result" -> FOLLOWUP_RESULT;
                default -> throw new IllegalArgumentException("Unsupported native fixture field");
            };
        }
    }
    private final ReportRevisitPage page;
    ReportRevisitTouch(ReportRevisitPage page) { this.page = page; }
    void fileChooser() throws Exception {
        String root = ".managed-report-revisit", labelText = "Select a company report file";
        Geometry geometry = new Geometry(page.raw(new ReportRevisitPage.Script(
            "(() => { const input=document.querySelector(" + JSONObject.quote(root + " input[type=file]") + "),label=input?.closest('label');" +
            " if(!input || input.disabled || !label)return null;" +
            " if(label.control!==input || !input.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return null;" +
            " const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim()===" + JSONObject.quote(labelText) + ");" +
            " if(!text)return null; label.scrollIntoView({block:'center',inline:'center',behavior:'instant'});" +
            " const range=document.createRange();range.selectNodeContents(text);const r=range.getBoundingClientRect(),ir=input.getBoundingClientRect(),v=visualViewport;" +
            " const x=r.left+r.width/2,y=r.top+r.height/2;" +
            " return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:v.width,height:v.height," +
            " offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
            " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,ir.left,ir.top,ir.right,ir.bottom,ir.width,ir.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite)" +
            " &&r.width>0&&r.height>0&&ir.width>0&&ir.height>0&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
            " visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height" +
            " &&ir.left>=v.offsetLeft&&ir.top>=v.offsetTop&&ir.right<=v.offsetLeft+v.width&&ir.bottom<=v.offsetTop+v.height," +
            " hit:label.contains(document.elementFromPoint(x,y))}; })()")));
        dispatch(new Target("Report revisit input chooser", geometry));
    }
    void assessment() throws Exception { input(Field.REPORT_ASSESSMENT); }
    void input(Field field) throws Exception {
        String selector = field.selector;
        Geometry geometry = new Geometry(page.read(new ReportRevisitPage.Script("JSON.stringify((()=>{const input=document.querySelector('" + selector + "');input.scrollIntoView({block:'center',behavior:'instant'});const r=input.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:input.contains(document.elementFromPoint(x,y))};})())")));
        dispatch(new Target(field.description, geometry));
    }
    private record Target(String description, Geometry geometry) {}
    private static final class Geometry {
        final JSONObject value;
        final double pixelsPerCssPixel;
        Geometry(String raw) throws Exception {
            assertNotNull("Input geometry was null", raw);
            Log.i("ManagedInputGeometry", "report revisit geometry=" + raw.substring(0, Math.min(raw.length(), 2048)));
            value = new JSONObject(raw);
            assertTrue("Invalid observed input geometry", value.getBoolean("finite"));
            assertTrue("Input must be fully inside the visual viewport", value.getBoolean("visible"));
            assertTrue("Input center must be unobscured", value.getBoolean("hit"));
            pixelsPerCssPixel = value.getDouble("scale") * value.getDouble("ratio");
            assertTrue("Invalid visual-to-native scale", Double.isFinite(pixelsPerCssPixel));
            assertTrue("Invalid visual-to-native scale", pixelsPerCssPixel > 0);
        }
        float localX() throws Exception { return (float)((value.getDouble("x") - value.getDouble("offsetLeft")) * pixelsPerCssPixel); }
        float localY() throws Exception { return (float)((value.getDouble("y") - value.getDouble("offsetTop")) * pixelsPerCssPixel); }
        void requireViewport(View view) throws Exception {
            double tolerance = pixelsPerCssPixel + 1;
            assertTrue("Visual viewport does not match native width", Math.abs(value.getDouble("width") * pixelsPerCssPixel - view.getWidth()) <= tolerance);
            double height = value.getDouble("height") * pixelsPerCssPixel;
            assertTrue("Visual viewport has positive native height", height > 0);
            assertTrue("Visual viewport does not exceed native height", height <= view.getHeight() + tolerance);
        }
    }
    private static final class NativePoint {
        final float[] screen;
        NativePoint(View view, Geometry geometry) throws Exception {
            geometry.requireViewport(view);
            int[] location = new int[2]; view.getLocationOnScreen(location);
            float localX = geometry.localX(), localY = geometry.localY();
            Rect visible = new Rect(); boolean hasVisibleRect = view.getLocalVisibleRect(visible);
            int scrollX = view.getScrollX(), scrollY = view.getScrollY(); visible.offset(-scrollX, -scrollY);
            assertTrue("Input native X is finite", Float.isFinite(localX));
            assertTrue("Input native Y is finite", Float.isFinite(localY));
            assertTrue("Input has a native visible rectangle", hasVisibleRect);
            assertTrue("Input touch stays inside visible WebView", visible.contains(Math.round(localX), Math.round(localY)));
            Log.i("ManagedInputGeometry", "report revisit native=" + view.getWidth() + "x" + view.getHeight() + ", screen=" + location[0] + "," + location[1] + ", visible=" + visible.toShortString() + ", scroll=" + scrollX + "," + scrollY + ", local=" + localX + "," + localY);
            screen = new float[]{location[0] + localX, location[1] + localY};
        }
    }
    private void dispatch(Target target) throws Exception {
        AtomicReference<NativePoint> point = new AtomicReference<>();
        onView(isAssignableFrom(WebView.class)).check((view, noViewFoundException) -> {
            if (noViewFoundException != null) throw noViewFoundException;
            assertTrue("Editor WebView retains native click visibility", androidx.test.espresso.matcher.ViewMatchers.isDisplayingAtLeast(90).matches(view));
            try { point.set(new NativePoint(view, target.geometry)); }
            catch (Exception error) { throw new AssertionError("Invalid report revisit native geometry", error); }
        });
        assertNotNull("Editor native touch coordinates returned", point.get());
        Gesture gesture = new Gesture(point.get());
        send(new TouchEvent(gesture, Phase.DOWN));
        send(new TouchEvent(gesture, Phase.UP));
        assertTrue("Single editor touch finishes within the page deadline", SystemClock.uptimeMillis() < gesture.deadline);
    }
    private enum Phase { DOWN, UP }
    private static final class Gesture {
        final NativePoint point;
        final long startedAt = SystemClock.uptimeMillis();
        final long deadline = startedAt + 10_000;
        Gesture(NativePoint point) { this.point = point; }
    }
    private record TouchEvent(Gesture gesture, Phase phase) {}
    private void send(TouchEvent touch) {
        int action = touch.phase == Phase.DOWN ? MotionEvent.ACTION_DOWN : MotionEvent.ACTION_UP;
        long eventTime = touch.phase == Phase.DOWN ? touch.gesture.startedAt : SystemClock.uptimeMillis();
        NativePoint point = touch.gesture.point;
        MotionEvent event = MotionEvent.obtain(touch.gesture.startedAt, eventTime, action, point.screen[0], point.screen[1], 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            Log.i("ManagedEditorTouch", "report revisit dispatch action=" + action + " uptime=" + SystemClock.uptimeMillis());
            InstrumentationRegistry.getInstrumentation().sendPointerSync(event);
            Log.i("ManagedEditorTouch", "report revisit dispatch returned uptime=" + SystemClock.uptimeMillis());
        } finally { event.recycle(); }
    }
}
