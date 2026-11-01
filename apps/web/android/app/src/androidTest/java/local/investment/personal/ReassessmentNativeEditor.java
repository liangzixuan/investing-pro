package local.investment.personal;

import static org.junit.Assert.*;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.InputType;
import android.util.Log;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.ExtractedText;
import android.view.inputmethod.ExtractedTextRequest;
import android.view.inputmethod.InputConnection;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Binds one invented DOM editor to its actual native connection before one replacement. */
final class ReassessmentNativeEditor implements AutoCloseable {
    private static final long TIMEOUT_MS = 10_000;
    record Dom(String text, int start, int end, boolean current) {}
    interface ReadDom { Dom read() throws Exception; }
    private record Connection(WebView view, InputConnection input, Handler handler, int inputType) {}
    private record NativeText(String text, int offset, int partialStart, int start, int end) {
        boolean matches(Dom dom) {
            return text != null && offset == 0 && partialStart == -1 && text.equals(dom.text)
                && Math.min(start, end) == dom.start && Math.max(start, end) == dom.end
                && start >= 0 && end >= 0 && start <= text.length() && end <= text.length();
        }
        String describe(Dom dom) {
            return "textPresent="+(text!=null)+",length="+(text==null?-1:text.length())+
                ",offset="+offset+",partialStart="+partialStart+",start="+start+",end="+end+
                ",textEqualsDom="+(text!=null&&text.equals(dom.text));
        }
    }
    private interface Operation<T> { T run() throws Exception; }
    private final ActivityScenario<MainActivity> scenario;
    private final ReadDom readDom;
    private final String original;
    private final AtomicBoolean active = new AtomicBoolean(true);
    private final AtomicBoolean selected = new AtomicBoolean();
    private final AtomicBoolean committed = new AtomicBoolean();
    private Connection bound;

    private ReassessmentNativeEditor(ActivityScenario<MainActivity> scenario, ReadDom readDom, String original) {
        this.scenario=scenario;this.readDom=readDom;this.original=original;
    }
    static ReassessmentNativeEditor bind(ActivityScenario<MainActivity> scenario, ReadDom readDom, String original) throws Exception {
        assertNotSame("Native correspondence waits must not block the UI thread", Looper.getMainLooper(), Looper.myLooper());
        ReassessmentNativeEditor editor=new ReassessmentNativeEditor(scenario,readDom,original);
        try { editor.awaitCorrespondence(); return editor; }
        catch(Exception|AssertionError failure) { editor.close(); throw failure; }
    }
    private Dom currentDom() throws Exception {
        Dom dom=readDom.read();
        assertTrue("Exact original editable DOM field remains focused",dom.current&&original.equals(dom.text));
        assertTrue("Observed DOM selection is in the complete original value",dom.start>=0&&dom.end>=dom.start&&dom.end<=original.length());
        return dom;
    }
    private Connection acquire() {
        AtomicReference<Connection> result=new AtomicReference<>();
        scenario.onActivity(activity->{
            WebView view=activity.getBridge().getWebView();
            assertTrue("Native editor belongs to the resumed focused view",isDisplayed().matches(view)&&view.hasFocus()&&view.hasWindowFocus()&&
                view.isAttachedToWindow()&&activity.getLifecycle().getCurrentState()==Lifecycle.State.RESUMED);
            EditorInfo info=new EditorInfo();InputConnection input=view.onCreateInputConnection(info);
            if(input==null||(info.inputType&InputType.TYPE_MASK_CLASS)==InputType.TYPE_NULL) {
                Log.i("SavedValuationNativeEditor","connection="+(input!=null)+",inputType="+info.inputType);return;
            }
            Handler selected=input.getHandler();
            Handler handler=new Handler(selected==null?Looper.getMainLooper():selected.getLooper());
            result.set(new Connection(view,input,handler,info.inputType));
        });
        return result.get();
    }
    private NativeText extract(Connection connection) {
        assertSame("Native getter runs on its connection callback looper",connection.handler.getLooper(),Looper.myLooper());
        ExtractedTextRequest request=new ExtractedTextRequest();request.hintMaxChars=original.length();
        ExtractedText text=connection.input.getExtractedText(request,0);
        return text==null?new NativeText(null,-1,-1,-1,-1):
            new NativeText(text.text==null?null:text.text.toString(),text.startOffset,text.partialStartOffset,text.selectionStart,text.selectionEnd);
    }
    private void awaitCorrespondence() throws Exception {
        long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        String last="no native editor observed";
        currentDom();
        Connection candidate=acquire();
        assertNotNull("Settled native caret supplies one editable connection",candidate);
        do {
            Dom before=currentDom();
            requireView(candidate);
            NativeText nativeText=invoke(candidate.handler,deadline,()->extract(candidate));
            Dom after=currentDom();
            requireView(candidate);
            last="class="+candidate.input.getClass().getName()+",inputType="+candidate.inputType+
                ",callbackMain="+(candidate.handler.getLooper()==Looper.getMainLooper())+","+nativeText.describe(after);
            Log.i("SavedValuationNativeEditor",last);
            if(before.equals(after)&&nativeText.matches(after)&&SystemClock.uptimeMillis()<deadline) {
                bound=candidate;return;
            }
            awaitFrame(deadline);
        } while(SystemClock.uptimeMillis()<deadline);
        fail("Native editor does not correspond to the exact DOM field: "+last);
    }
    private void awaitFrame(long deadline) throws Exception {
        CompletableFuture<Void> future=new CompletableFuture<>();AtomicReference<WebView> view=new AtomicReference<>();
        Runnable frame=()->{if(active.get()&&SystemClock.uptimeMillis()<deadline)future.complete(null);};
        try {
            scenario.onActivity(activity->{WebView web=activity.getBridge().getWebView();view.set(web);web.postOnAnimation(frame);});
            await(future,deadline);
        } finally {
            future.cancel(false);
            scenario.onActivity(activity->{if(view.get()!=null)view.get().removeCallbacks(frame);});
        }
    }
    private <T> T invoke(Handler handler,long deadline,Operation<T> operation) throws Exception {
        CompletableFuture<T> future=new CompletableFuture<>();AtomicBoolean pending=new AtomicBoolean(true);
        Runnable task=()->{
            if(!pending.get()||!active.get()||SystemClock.uptimeMillis()>=deadline)return;
            try { T value=operation.run();if(pending.get())future.complete(value); }
            catch(Exception|AssertionError failure) {future.completeExceptionally(failure);}
        };
        try {assertTrue("Native callback handler accepts the bounded operation",handler.post(task));return await(future,deadline);}
        finally {pending.set(false);handler.removeCallbacks(task);future.cancel(false);}
    }
    private <T> T await(CompletableFuture<T> future,long deadline) throws Exception {
        assertNotSame("Only instrumentation may await native callbacks",Looper.getMainLooper(),Looper.myLooper());
        long remaining=deadline-SystemClock.uptimeMillis();assertTrue("Original native editor deadline remains",remaining>0);
        T value=future.get(remaining,TimeUnit.MILLISECONDS);
        assertTrue("Native observation completed within the original deadline",active.get()&&SystemClock.uptimeMillis()<deadline);
        return value;
    }
    private void requireView(Connection connection) {
        assertNotNull("Native editor connection exists",connection);
        scenario.onActivity(activity->{
            assertSame("Exact native WebView still owns this edit",connection.view,activity.getBridge().getWebView());
            assertTrue("Exact native editor remains resumed and focused",isDisplayed().matches(connection.view)&&connection.view.hasFocus()&&connection.view.hasWindowFocus()&&
                activity.getLifecycle().getCurrentState()==Lifecycle.State.RESUMED);
        });
    }
    void selectAll() throws Exception {
        requireView(bound);Dom dom=currentDom();long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        invoke(bound.handler,deadline,()->{
            NativeText text=extract(bound);assertTrue("Bound native original and selection remain exact before Select all",text.matches(dom));
            assertTrue("No late or repeated Select all",active.get()&&SystemClock.uptimeMillis()<deadline&&selected.compareAndSet(false,true));
            assertTrue("One native Select all dispatch",bound.input.performContextMenuAction(android.R.id.selectAll));return true;
        });
    }
    void commit(String value) throws Exception {
        requireView(bound);Dom dom=currentDom();assertTrue("Complete original DOM selection remains before native replacement",dom.start==0&&dom.end==original.length());
        long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        invoke(bound.handler,deadline,()->{
            NativeText text=extract(bound);assertTrue("Bound native full selection remains exact before commit",text.matches(dom));
            assertTrue("No late or repeated native replacement",active.get()&&SystemClock.uptimeMillis()<deadline&&selected.get()&&committed.compareAndSet(false,true));
            assertTrue("One native replacement dispatch",bound.input.commitText(value,1));return true;
        });
    }
    @Override public void close() {active.set(false);}
}
