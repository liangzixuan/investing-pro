package local.investment.personal;

import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.Espresso.onView;
import static org.junit.Assert.*;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;


/** Invented due-check source evidence, owned return and independent Follow-ups Save. */
@RunWith(AndroidJUnit4.class)
public class ManagedFollowupsReviewEvidenceTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-followups-evidence').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String SAME_JSON="(function same(a,b){if(Object.is(a,b))return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));})";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ServedEditorSession imeSession;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,stage="startup",editingSelector,nativeEditingState;
    private final String[] readings=new String[3];
    @Before public void launchEvidence()throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.FOLLOWUPS_REVIEW_EVIDENCE);assets.prepare();imeSession=ServedEditorSession.open();scenario=ActivityScenario.launch(MainActivity.class);
        page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        page.awaitStartup(new Check("Follow-ups-only fixture starts without Watchlist or source loads",new Script(D+".counts.status===1&&"+D+".view.view==='followups'&&"+D+".watchlist.draft===null&&"+D+".followups.draft===null&&"+D+".counts.requests.length===0")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));
    }
    @Test public void chosenDueChecksKeepCompleteSourceReadingsThroughOwnedBackFinishAndSeparateSave()throws Exception {
        try {startReview();for(int i=0;i<3;i++)reviewCompany(i);finishAndSave();freshLoad();}catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void startReview()throws Exception {
        stage="explicit Follow-ups Load and chosen order";tap("#managed-followups-load");
        await("full independent resource loads with future check preserved",D+".followups.draft.entries.length===4&&"+F+".load===1&&"+D+".watchlist.draft===null");
        open(".managed-followups-review");tap("#managed-followups-review-enter");
        for(int i=0;i<3;i++)tap("#managed-followups-review-choose-76000000-0000-4000-8000-"+String.format(java.util.Locale.ROOT,"%012d",i+1));
        tap("#managed-followups-review-start");await("Start retains exact chosen check order and requests nothing",D+".review.phase==='reviewing'&&"+D+".review.chosen.length===3&&"+D+".review.chosen.every((r,i)=>r.entry.id==="+D+".original.entries[i].id)&&"+D+".counts.requests.length===0");
    }
    private void runPass()throws Exception {
        click("//section[@aria-label='Reviewed company source pass']//button[normalize-space(.)='Preview company source pass']");
        await("explicit preview has four selected source decisions",D+".pass.phase==='preview'&&"+D+".pass.preview.rows.filter(r=>r.selected).length===4");
        click("//section[@aria-label='Reviewed company source pass']//button[normalize-space(.)='Run reviewed company source pass']");
        await("source pass settles without automatic continuation",D+".pass.phase!=='running'&&"+D+".pass.phase!=='preview'&&"+D+".evidence.canCapture");
    }
    private void retain()throws Exception {tap("#managed-followups-evidence-capture");await("explicit retention commits complete reading and exact focus",D+".evidence.selected.reading!==null&&document.activeElement.id==='managed-followups-evidence-capture-heading'");}
    private void reviewCompany(int index)throws Exception {
        stage="chosen company "+index;int before=index==0?0:index==1?5:9;
        tap("#managed-followups-review-research");await("exact chosen listing opens without source reads",D+".view.research.selection.origin==='followups'&&"+D+".view.research.selection.listing.listingId==="+D+".original.entries["+index+"].listing.listingId&&"+D+".counts.requests.length==="+before);
        click("//section[@aria-label='Reviewed company source pass']//label[normalize-space(.)='Interim']/input");runPass();
        if(index==0){retain();await("partial failure retains both loaded sources and unattempted Interim","JSON.stringify("+D+".evidence.selected.reading.sourcePass.rows.map(r=>r.disposition))==='[\"loaded\",\"loaded\",\"failed\",\"not_attempted\"]'&&"+D+".counts.requests.length===3");String partial=page.read(new Script("JSON.stringify("+D+".evidence.selected.reading)"));runPass();await("explicit continuation retains original Price and Annual",D+".counts.requests.length===5&&JSON.stringify("+D+".evidence.selected.reading)==="+q(partial)+"&&"+D+".pass.rows[0].disposition==='retained'&&"+D+".pass.rows[1].disposition==='retained'");}
        retain();readings[index]=page.read(new Script("JSON.stringify("+D+".evidence.selected.reading)"));inspectReading(index);
        if(index==0)frame(FollowupsReportFrameCapture.Frame.FOLLOWUPS_EVIDENCE_RETAINED,"#managed-followups-evidence-capture-heading","Current chosen-check capture heading. Full source packets, views, exact raw values and clocks are asserted separately; this frame does not show the entire reading.");
        if(index<2){open("#managed-research-followup-assessment");String assessment=page.read(new Script(D+".assessments["+index+"]"));replace("#managed-research-followup-result",assessment);await("assessment changes only the selected authored check while capture stays original",D+".followups.draft.entries["+index+"].result==="+q(assessment)+"&&JSON.stringify("+D+".evidence.selected.reading)==="+q(readings[index]));}
        pressBack();await("one owned Back preserves exact reading and chosen position",D+".view.research===null&&"+D+".view.view==='followups'&&"+D+".review.position==="+index+"&&JSON.stringify("+D+".evidence.rows["+index+"].reading)==="+q(readings[index]));assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
        if(index==0)tap("#managed-followups-review-complete");
        if(index<2)tap("#managed-followups-review-next");
    }
    private void inspectReading(int index)throws Exception {
        if(index<2)await("full source responses preserve listing identities, original clocks and raw decimals","(()=>{const d="+D+",r=d.evidence.selected.reading,e=r.evidence,i="+index+";return "+SAME_JSON+"(e.price.response,d.packets.price[i])&&"+SAME_JSON+"(e.annual.response,d.packets.annual[i])&&"+SAME_JSON+"(e.filings.response,d.packets.filings[i])&&"+SAME_JSON+"(e.interim.response,d.packets.interim[i])&&e.annual.response.evidence.facts.observations.some(o=>o.value==='9007199254740993.123456789012345678')&&r.capturedAt!==e.price.response.completedAt&&r.capturedAt!==e.filings.response.completedAt;})()");
        else await("unsupported row remains complete with no provider request",D+".evidence.selected.reading.sourcePass.rows.every(r=>r.disposition==='unsupported')&&"+D+".counts.requests.length===9");
        String scope="//section[@aria-labelledby='managed-followups-evidence-capture-heading']";
        click(scope+"/details/summary[normalize-space(.)='Inspect retained source reading']");
        click(scope+"//summary[normalize-space(.)='Complete retained check reading']");
        await("visible full raw disclosure equals the entire retained payload with no live actions","(()=>{const e=document.querySelector('section[aria-labelledby=managed-followups-evidence-capture-heading] article[aria-label=\"Retained check source reading\"]'),p=[...e.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Complete retained check reading');return p.open&&p.querySelector('pre')&&"+SAME_JSON+"(JSON.parse(p.querySelector('pre').textContent),"+D+".evidence.selected.reading)&&e.querySelectorAll('button,input,select,textarea').length===0;})()");
        click(scope+"/details/summary[normalize-space(.)='Inspect retained source reading']");
    }
    private void finishAndSave()throws Exception {
        stage="passive Finish then independent authored Save";tap("#managed-followups-review-finish");
        await("Finish keeps all three full readings and unrelated check without saving",D+".evidence.phase==='finished'&&"+D+".evidence.rows.length===3&&"+D+".counts.requests.length===9&&"+F+".commits===0&&"+D+".followups.draft.entries[0].status==='completed'&&"+SAME_JSON+"("+D+".followups.draft.entries[3],"+D+".original.entries[3])");
        for(int i=0;i<3;i++)assertEquals(readings[i],page.read(new Script("JSON.stringify("+D+".evidence.rows["+i+"].reading)")));
        frame(FollowupsReportFrameCapture.Frame.FOLLOWUPS_EVIDENCE_FINISHED,"#managed-followups-review-heading","Finished chosen-check review heading. Three full readings, assessments, independent completion and unsaved status are asserted separately.");
        tap("#managed-followups-save");await("only full authored Follow-ups payload is saved; packets are temporary",F+".commits===1&&"+D+".saved.entries.length===4&&"+D+".watchlist.draft===null&&"+D+".evidence.rows.length===0&&"+D+".counts.requests.length===9");boundary();
    }
    private void freshLoad()throws Exception {
        String saved=page.read(new Script("JSON.stringify("+D+".saved)"));tap("#fixture-followups-fresh-session");await("new session has no passive source reading or draft",D+".counts.status===2&&"+D+".followups.draft===null&&"+D+".evidence.rows.length===0");tap("#managed-followups-load");await("full saved checks reload exactly without source reads",SAME_JSON+"("+D+".followups.saved.payload,JSON.parse("+q(saved)+"))&&"+F+".load===2&&"+D+".counts.requests.length===9&&"+D+".watchlist.draft===null");boundary();
    }
    private void boundary()throws Exception {await("exact disconnected fixture and source boundary","location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]').content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]').content==='followups-review-evidence'&&document.querySelector('meta[http-equiv=Content-Security-Policy]').content==="+q(CSP)+"&&"+D+".counts.rejected===0&&"+D+".watchlist.draft===null");}
    private void open(String selector)throws Exception {if(!"true".equals(page.read(new Script("String(document.querySelector("+q(selector)+")?.open===true)"))))tap(selector+" > summary");}
    private void click(String xpath)throws Exception {page.click(Element.xpath(xpath));}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private static String q(String value){return JSONObject.quote(value);}
    private void diagnose(){try{diagnoseEditing("failure");Log.e("FollowupsEvidence","stage="+stage+", "+page.raw(new Script("JSON.stringify({url:location.href,active:document.activeElement?.id,phase:"+D+".evidence.phase,counts:"+D+".counts,pass:"+D+".pass.phase})")));}catch(Exception|AssertionError failure){Log.e("FollowupsEvidence","Diagnostic unavailable",failure);}}
    @After public void closeInventedEvidence()throws Exception {
        Throwable failure=null;
        try{if(imeSession!=null)imeSession.close();}catch(Throwable cleanup){failure=cleanup;}
        try{if(scenario!=null)scenario.close();}catch(Throwable cleanup){if(failure==null)failure=cleanup;else failure.addSuppressed(cleanup);}
        try{if(assets!=null)assets.close();}catch(Throwable cleanup){if(failure==null)failure=cleanup;else failure.addSuppressed(cleanup);}
        if(failure instanceof Error error)throw error;
        if(failure instanceof Exception exception)throw exception;
        if(failure!=null)throw new IllegalStateException("Fixture cleanup failed",failure);
    }
    private void frame(FollowupsReportFrameCapture.Frame name,String heading,String scope)throws Exception{
        committedFrame();
        page.read(new Script("(()=>{document.querySelector("+q(heading)+").scrollIntoView({block:'start',behavior:'instant'});return 'scrolled';})()"));committedFrame();page.await(new Check("scoped committed heading visible without horizontal overflow",new Script("(()=>{const e=document.querySelector("+q(heading)+"),r=e.getBoundingClientRect();return e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());Log.i("FollowupsEvidenceFrameScope",scope);new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,name)).retain();
    }

    private void tap(String selector)throws Exception {
        page.await(new Check("requested native control is present enabled and visible before scrolling",new Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("Follow-ups evidence native control "+selector,geometry);
    }
    private void committedFrame()throws Exception {
        long deadline=SystemClock.uptimeMillis()+10000;CompletableFuture<Void> committed=new CompletableFuture<>();Handler main=new Handler(Looper.getMainLooper());AtomicReference<ViewTreeObserver> observer=new AtomicReference<>();AtomicReference<Runnable> callback=new AtomicReference<>();
        try{scenario.onActivity(a->{WebView web=a.getBridge().getWebView();assertTrue(web.isAttachedToWindow()&&web.isShown()&&web.isHardwareAccelerated());web.postVisualStateCallback(0,new WebView.VisualStateCallback(){@Override public void onComplete(long id){if(committed.isDone()||SystemClock.uptimeMillis()>=deadline)return;Runnable frame=()->main.post(()->{if(SystemClock.uptimeMillis()<deadline)committed.complete(null);});ViewTreeObserver current=web.getViewTreeObserver();observer.set(current);callback.set(frame);current.registerFrameCommitCallback(frame);web.invalidate();}});});long remaining=deadline-SystemClock.uptimeMillis();assertTrue(remaining>0);committed.get(remaining,TimeUnit.MILLISECONDS);}finally{committed.cancel(false);main.post(()->{ViewTreeObserver current=observer.get();Runnable frame=callback.get();if(current!=null&&current.isAlive()&&frame!=null)current.unregisterFrameCommitCallback(frame);});}
    }
    private ReassessmentNativeEditor.Dom readEditingDom(String selector) throws Exception {
        JSONObject value=new JSONObject(page.raw(new Script("(()=>{const e=document.querySelector("+q(selector)+");return {value:e?.value??'',start:e?.selectionStart??-1,end:e?.selectionEnd??-1,current:!!e&&document.activeElement===e&&!e.disabled&&!e.readOnly};})()")));
        return new ReassessmentNativeEditor.Dom(value.getString("value"),value.getInt("start"),value.getInt("end"),value.getBoolean("current"));
    }
    private void diagnoseEditing(String phase) throws Exception {
        if (editingSelector == null) return;
        String observed = page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(editingSelector)+");return {selector:"+q(editingSelector)+",present:!!e,tag:e?.tagName??null,focused:!!e&&document.activeElement===e,disabled:e?.disabled??null,readOnly:e?.readOnly??null,valueLength:e?.value?.length??null,selectionStart:e?.selectionStart??null,selectionEnd:e?.selectionEnd??null};})())"));
        AtomicReference<String> nativeNow=new AtomicReference<>();
        scenario.onActivity(activity->{
            WebView web=activity.getBridge().getWebView();android.view.WindowInsets insets=web.getRootWindowInsets();
            nativeNow.set("imeVisible="+(insets!=null&&insets.isVisible(android.view.WindowInsets.Type.ime()))+
                ",focus="+web.hasFocus()+",windowFocus="+web.hasWindowFocus()+",resumed="+(activity.getLifecycle().getCurrentState()==androidx.lifecycle.Lifecycle.State.RESUMED));
        });
        Log.i("FollowupsEvidenceEditing", "phase="+phase+", "+observed+", nativeBeforeSelection="+nativeEditingState+", nativeNow="+nativeNow.get());
    }
    private void replace(String selector,String value)throws Exception {
        editingSelector=selector;nativeEditingState="not yet observed";
        String original=page.read(new Script("document.querySelector("+q(selector)+").value"));

        try {
            tap(selector);
            String focused="(()=>{const e=document.querySelector("+q(selector)+");return !!e&&document.activeElement===e&&!e.disabled&&!e.readOnly&&e.value==="+q(original)+";})()";
            page.await(new Check("exact assessment and original value own native focus before IME",new Script(focused)).nativeReady());
            nativeEditingState=keyboard.awaitVisibleEditor(selector);
            page.await(new Check("settled IME retains exact focused field and original value",new Script(focused)).nativeReady());
            // Bind the settled native selection directly. A second coordinate tap can hit
            // Android's text-selection actions even when the DOM still reports this field.
            page.await(new Check("settled native caret retains exact field and original value",new Script(focused)).nativeReady());
            try (ReassessmentNativeEditor editor=ReassessmentNativeEditor.bind(scenario,()->readEditingDom(selector),original)) {
                diagnoseEditing("before-select-all");
                editor.selectAll();
                await("native selection covers the whole original assessment",focused+"&&document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");
                diagnoseEditing("after-select-all");
                editor.commit(value);
                await("full Unicode assessment reaches the real controlled input","document.querySelector("+q(selector)+").value==="+q(value));
            }
            keyboard.closeSoftKeyboard();
        } finally { editingSelector=null; }
    }
}
