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
import java.util.UUID;

/** Prepares one owned editor, then proves complete native selection before replacement. */
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
    private final AtomicBoolean corresponded = new AtomicBoolean();
    private final AtomicBoolean committed = new AtomicBoolean();
    private final ServedEditorSession session = ServedEditorSession.current();
    private WebView bound;
    private long generation, edit;
    private final String nodeLease = "__servedEditorLease_" + UUID.randomUUID().toString().replace("-", "");
    private boolean nodeLeaseRequested;

    private ReassessmentNativeEditor(ActivityScenario<MainActivity> scenario, ReadDom readDom, String original) {
        this.scenario=scenario;this.readDom=readDom;this.original=original;
    }
    static ReassessmentNativeEditor bind(ActivityScenario<MainActivity> scenario, ReadDom readDom, String original) throws Exception {
        assertNotSame("Native correspondence waits must not block the UI thread", Looper.getMainLooper(), Looper.myLooper());
        ReassessmentNativeEditor editor=new ReassessmentNativeEditor(scenario,readDom,original);
        try { editor.awaitOwnership(); return editor; }
        catch(Exception|AssertionError failure) { editor.retireAfterFailure(failure);throw failure; }
    }
    private Dom currentDom() throws Exception {
        Dom dom=readDom.read();
        assertTrue("Exact original editable DOM field remains focused",dom.current&&original.equals(dom.text));
        assertTrue("Observed DOM selection is in the complete original value",dom.start>=0&&dom.end>=dom.start&&dom.end<=original.length());
        return dom;
    }
    private void awaitOwnership() throws Exception {
        long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;
        String last="no framework-served editor observed";
        scenario.onActivity(activity->bound=activity.getBridge().getWebView());
        currentDom();requireView();
        nodeLeaseRequested=true;
        assertEquals("Capture the exact active DOM node without editing it", "true", evaluateLease(
            "(()=>{const node=document.activeElement;if(!node||!node.isConnected)return false;window['"+nodeLease+
            "']=()=>node.isConnected&&document.activeElement===node;return true;})()",deadline,false));
        currentDom();requireNodeLease(deadline);
        do {
            Dom before=currentDom();requireView();requireNodeLease(deadline);
            Bundle observed=session.command("observe",new Bundle(),deadline);
            Dom after=currentDom();requireView();requireNodeLease(deadline);
            NativeText nativeText=new NativeText(observed.getString("text"),observed.getInt("offset",-1),
                observed.getInt("partialStart",-1),observed.getInt("start",-1),observed.getInt("end",-1));
            last="servedGeneration="+observed.getLong("generation")+","+nativeText.describe(after);
            Log.i("SavedValuationNativeEditor",last);
            if(observed.getBoolean("ready")&&before.equals(after)&&SystemClock.uptimeMillis()<deadline) {
                generation=observed.getLong("generation");
                Bundle receipt=session.command("bind",fields(after),deadline);
                edit=receipt.getLong("edit");
                requireView();requireNodeLease(deadline);assertEquals("Exact DOM original remains stable through ownership preparation",after,currentDom());
                assertTrue("One framework-served ownership token remains within the original deadline",edit>0&&active.get()&&SystemClock.uptimeMillis()<deadline);
                return;
            }
            awaitFrame(deadline);
        } while(SystemClock.uptimeMillis()<deadline);
        fail("Framework editor ownership was not prepared: "+last);
    }
    private String evaluateLease(String script,long deadline,boolean cleanup) throws Exception {
        CompletableFuture<String> result=new CompletableFuture<>();
        try {
            scenario.onActivity(activity->{
                if((!cleanup&&!active.get())||SystemClock.uptimeMillis()>=deadline){result.completeExceptionally(new IllegalStateException("Late node observation"));return;}
                bound.evaluateJavascript(script,result::complete);
            });
            long remaining=deadline-SystemClock.uptimeMillis();assertTrue("Node observation retains its deadline",remaining>0);
            String value=result.get(remaining,TimeUnit.MILLISECONDS);
            assertTrue("Node observation completed before its deadline",(cleanup||active.get())&&SystemClock.uptimeMillis()<deadline);
            return value;
        } finally {result.cancel(false);}
    }
    private void requireNodeLease(long deadline) throws Exception {
        assertEquals("The same connected active DOM node owns this edit","true",evaluateLease("Boolean(window['"+nodeLease+"']?.())",deadline,false));
    }
    private void awaitSelectedCorrespondence(long deadline) throws Exception {
        String last="no selected native original observed";
        do {
            Dom before=currentDom();requireView();requireNodeLease(deadline);
            Bundle data=fields(before);data.putLong("edit",edit);
            Bundle observed=session.command("observe-edit",data,deadline);
            Dom after=currentDom();requireView();requireNodeLease(deadline);
            assertEquals("The prepared framework generation still owns selection",generation,observed.getLong("generation"));
            NativeText nativeText=new NativeText(observed.getString("text"),observed.getInt("offset",-1),
                observed.getInt("partialStart",-1),observed.getInt("start",-1),observed.getInt("end",-1));
            last="servedGeneration="+generation+","+nativeText.describe(after);Log.i("SavedValuationNativeEditor",last);
            if(observed.getBoolean("ready")&&before.equals(after)&&after.start==0&&after.end==original.length()&&nativeText.matches(after)&&SystemClock.uptimeMillis()<deadline){
                corresponded.set(true);return;
            }
            awaitFrame(deadline);
        }while(SystemClock.uptimeMillis()<deadline);
        fail("Complete native and DOM selection did not converge: "+last);
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
        try {
            long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;requireView();Dom dom=currentDom();requireNodeLease(deadline);
            assertTrue("No late or repeated Select all",active.get()&&SystemClock.uptimeMillis()<deadline&&selected.compareAndSet(false,true));
            Bundle data=fields(dom);data.putLong("edit",edit);
            session.command("select",data,deadline);
            currentDom();requireView();requireNodeLease(deadline);
            awaitSelectedCorrespondence(deadline);
        }catch(Exception|AssertionError failure){retireAfterFailure(failure);throw failure;}
    }
    void commit(String value) throws Exception {
        try {
            long deadline=SystemClock.uptimeMillis()+TIMEOUT_MS;requireView();Dom dom=currentDom();requireNodeLease(deadline);
            assertTrue("Complete original DOM selection remains before native replacement",dom.start==0&&dom.end==original.length());
            assertTrue("No late or repeated native replacement",active.get()&&SystemClock.uptimeMillis()<deadline&&selected.get()&&corresponded.get()&&committed.compareAndSet(false,true));
            Bundle data=fields(dom);data.putLong("edit",edit);data.putString("value",value);
            // Provider independently rechecks the complete native original and full selection.
            session.command("commit",data,deadline);requireView();requireNodeLease(deadline);
        }catch(Exception|AssertionError failure){retireAfterFailure(failure);throw failure;}
    }
    private void retireAfterFailure(Throwable failure) {
        try{close();}catch(Exception|AssertionError cleanup){failure.addSuppressed(cleanup);}
    }
    @Override public void close() throws Exception {
        if(!active.getAndSet(false))return;
        Throwable failure=null;
        try {
            if(edit>0){Bundle data=new Bundle();data.putLong("edit",edit);session.command("release",data,SystemClock.uptimeMillis()+TIMEOUT_MS);}
        }catch(Throwable releaseFailure){failure=releaseFailure;}
        try {
            if(nodeLeaseRequested&&bound!=null)evaluateLease("delete window['"+nodeLease+"']",SystemClock.uptimeMillis()+TIMEOUT_MS,true);
        }catch(Throwable cleanupFailure){if(failure==null)failure=cleanupFailure;else failure.addSuppressed(cleanupFailure);}
        if(failure instanceof Error error)throw error;
        if(failure instanceof Exception exception)throw exception;
        if(failure!=null)throw new IllegalStateException("Native editor cleanup failed",failure);
    }
}
