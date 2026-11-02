package local.investment.personal;

import static org.junit.Assert.*;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;

import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
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
    private final ActivityScenario<MainActivity> scenario;
    private final ReadDom readDom;
    private final String original;
    private final AtomicBoolean active = new AtomicBoolean(true);
    private final AtomicBoolean selected = new AtomicBoolean();
    private final AtomicBoolean committed = new AtomicBoolean();
    private final ServedEditorSession session = ServedEditorSession.current();
    private WebView bound;
    private long generation, edit;

    private ReassessmentNativeEditor(ActivityScenario<MainActivity> scenario, ReadDom readDom, String original) {
        this.scenario=scenario;this.readDom=readDom;this.original=original;
    }
    static ReassessmentNativeEditor bind(ActivityScenario<MainActivity> scenario, ReadDom readDom, String original) throws Exception {
        assertNotSame("Native correspondence waits must not block the UI thread", Looper.getMainLooper(), Looper.myLooper());
        ReassessmentNativeEditor editor=new ReassessmentNativeEditor(scenario,readDom,original);
        try { editor.awaitCorrespondence(); return editor; }
        catch(Exception|AssertionError failure) { try{editor.close();}catch(Exception cleanup){failure.addSuppressed(cleanup);} throw failure; }
    }
    private Dom currentDom() throws Exception {
        Dom dom=readDom.read();
        assertTrue("Exact original editable DOM field remains focused",dom.current&&original.equals(dom.text));
        assertTrue("Observed DOM selection is in the complete original value",dom.start>=0&&dom.end>=dom.start&&dom.end<=original.length());
        return dom;
    }
    private void awaitCorrespondence() throws Exception {
        long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        String last="no framework-served editor observed";
        scenario.onActivity(activity->bound=activity.getBridge().getWebView());
        do {
            Dom before=currentDom();requireView();
            Bundle observed=session.command("observe",new Bundle(),deadline);
            Dom after=currentDom();requireView();
            NativeText nativeText=new NativeText(observed.getString("text"),observed.getInt("offset",-1),
                observed.getInt("partialStart",-1),observed.getInt("start",-1),observed.getInt("end",-1));
            last="servedGeneration="+observed.getLong("generation")+","+nativeText.describe(after);
            Log.i("SavedValuationNativeEditor",last);
            if(observed.getBoolean("ready")&&before.equals(after)&&nativeText.matches(after)&&SystemClock.uptimeMillis()<deadline) {
                generation=observed.getLong("generation");
                Bundle receipt=session.command("bind",fields(after),deadline);
                edit=receipt.getLong("edit");
                requireView();assertEquals("Exact DOM text and selection remain stable through served binding",after,currentDom());
                assertTrue("One framework-served binding remains within the original deadline",edit>0&&active.get()&&SystemClock.uptimeMillis()<deadline);
                return;
            }
            awaitFrame(deadline);
        } while(SystemClock.uptimeMillis()<deadline);
        fail("Native editor does not correspond to the exact DOM field: "+last);
    }
    private Bundle fields(Dom dom) {
        Bundle data=new Bundle();data.putLong("generation",generation);data.putString("original",original);
        data.putInt("start",dom.start);data.putInt("end",dom.end);return data;
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
    private <T> T await(CompletableFuture<T> future,long deadline) throws Exception {
        assertNotSame("Only instrumentation may await native callbacks",Looper.getMainLooper(),Looper.myLooper());
        long remaining=deadline-SystemClock.uptimeMillis();assertTrue("Original native editor deadline remains",remaining>0);
        T value=future.get(remaining,TimeUnit.MILLISECONDS);
        assertTrue("Native observation completed within the original deadline",active.get()&&SystemClock.uptimeMillis()<deadline);
        return value;
    }
    private void requireView() {
        assertNotNull("Native editor WebView exists",bound);
        scenario.onActivity(activity->{
            assertSame("Exact native WebView still owns this edit",bound,activity.getBridge().getWebView());
            assertTrue("Exact native editor remains resumed and focused",isDisplayed().matches(bound)&&bound.hasFocus()&&bound.hasWindowFocus()&&
                bound.isAttachedToWindow()&&activity.getLifecycle().getCurrentState()==Lifecycle.State.RESUMED);
        });
    }
    void selectAll() throws Exception {
        requireView();Dom dom=currentDom();long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        assertTrue("No late or repeated Select all",active.get()&&SystemClock.uptimeMillis()<deadline&&selected.compareAndSet(false,true));
        Bundle data=fields(dom);data.putLong("edit",edit);
        // Provider rechecks the complete native original/selection before the one native dispatch.
        session.command("select",data,deadline);
    }
    void commit(String value) throws Exception {
        requireView();Dom dom=currentDom();assertTrue("Complete original DOM selection remains before native replacement",dom.start==0&&dom.end==original.length());
        long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        assertTrue("No late or repeated native replacement",active.get()&&SystemClock.uptimeMillis()<deadline&&selected.get()&&committed.compareAndSet(false,true));
        Bundle data=fields(dom);data.putLong("edit",edit);data.putString("value",value);
        // Provider rechecks the complete native selection before the one native commit.
        session.command("commit",data,deadline);
    }
    @Override public void close() throws Exception {
        if(!active.getAndSet(false))return;
        if(edit>0){Bundle data=new Bundle();data.putLong("edit",edit);session.command("release",data,SystemClock.uptimeMillis()+TIMEOUT_MS);}
    }
}
