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
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import android.content.Context;
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


/** Invented daily saved-input evaluation, complete passive return and independent resource saves. */
@RunWith(AndroidJUnit4.class)
public class ManagedWatchlistDailyReportTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-watchlist-saved-scenario').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String A="button[aria-label='Annual report for saved GOOGL']";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ServedEditorSession imeSession;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,stage="startup",paired,price;
    private String editingSelector,nativeEditingState;

    @Before public void launchDailyReport()throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.WATCHLIST_DAILY_REPORT);assets.prepare();
        imeSession=ServedEditorSession.open();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        page.awaitStartup(new Check("saved scenario fixture starts independently unloaded",new Script(D+".counts.status===1&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".view.view==='watchlist'")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));
    }
    @Test public void finishedDailyReportPreservesCompleteEvidenceThroughPickerCancelChosenHtmlAndSeparateSaves()throws Exception {
        try { chooseAndEvaluate(); investigateAndReturn(); finishAndSave(); freshLoad(); }
        catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void chooseAndEvaluate()throws Exception {
        stage="explicit group, partial Price and confirmed collection";
        click("//button[normalize-space(.)='Load saved watchlist']");
        open("details.managed-filings-review");
        chooseFixtureMembers();
        tap("#watchlist-daily-start");
        click("//fieldset[legend[normalize-space(.)='Sources for this daily review']]/label[starts-with(normalize-space(.),'Price')]/input");
        tap("#watchlist-daily-preview");tap("#watchlist-daily-run");
        await("one complete Price packet, one failed Price, unsupported third listing",D+".counts.eod===2&&"+D+".group.daily.phase==='settled'&&"+D+".group.rows[0].price.response!==null&&"+D+".group.rows[1].price.error&&"+D+".group.rows[2].price.available===false");
        tap("#watchlist-saved-scenario-load");tap("#watchlist-saved-scenario-preview");
        await("all chosen rows retain exact confirmed maps and missing reason",D+".review.plan.rows.length===3&&JSON.stringify("+D+".review.plan.rows.slice(0,2).map(r=>r.entry))===JSON.stringify("+D+".original.valuations.payload.entries)&&"+D+".review.plan.rows[2].reason==='missing_saved_inputs'&&"+D+".calculations===0&&"+D+".evaluations===0");
        tap("#watchlist-saved-scenario-evaluate");
        await("one explicit group evaluation retains six comparisons per admitted listing",D+".evaluations===1&&"+D+".calculations===0&&"+D+".review.reading.rows.slice(0,2).every(r=>r.comparison.rows.length===6)&&"+D+".review.reading.rows[0].calculation.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&"+D+".review.reading.rows[1].calculation.exitResult.status==='unavailable'&&"+D+".review.reading.rows[2].calculation===null");
        paired=page.read(new Script("JSON.stringify("+D+".review.reading)"));
        price=page.read(new Script("JSON.stringify("+D+".group.rows[0].price)"));
        click("//li[@data-saved-scenario-listing='invented-review-filings-googl']//summary[normalize-space(.)='Complete retained Price state and response']");
        await("full captured Price state and all original clocks are accessible","JSON.stringify(JSON.parse([...document.querySelectorAll('li[data-saved-scenario-listing=\"invented-review-filings-googl\"] details')].find(e=>e.querySelector('summary')?.textContent==='Complete retained Price state and response').querySelector('pre').textContent))==="+q(price));
        boundary();
    }
    private void chooseFixtureMembers()throws Exception {
        String original=D+".original.watchlist.payload.memberships";
        JSONArray members=new JSONArray(page.read(new Script("JSON.stringify("+original+")")));
        assertEquals("Three exact fixture listings",3,members.length());
        assertEquals("GOOGL",members.getJSONObject(0).getString("symbol"));
        assertEquals("GOOG",members.getJSONObject(1).getString("symbol"));
        for(int index=0;index<members.length();index++){
            JSONObject member=members.getJSONObject(index);
            String label=member.getString("symbol")+" · "+member.getString("issuerName")+" · "+member.getString("shareClassName")+" · "+member.getString("exchangeMic");
            click("//fieldset[legend[normalize-space(.)='Companies for this review']]/label[normalize-space(.)="+q(label)+"]/input");
        }
        String identity="m=>[m.listingId,m.symbol,m.issuerName,m.shareClassName,m.exchangeMic]";
        await("exact original fixture identities are chosen once and in order","new Set("+original+".map(m=>m.listingId)).size===3&&JSON.stringify("+D+".group.chosen.map(m=>m.listing).map("+identity+"))===JSON.stringify("+original+".map("+identity+"))");
    }
    private void investigateAndReturn()throws Exception {
        stage="owned Research, current revised authority and Back";
        tap(".managed-filings-review-companies button:first-child");tap("#watchlist-daily-inspect");
        await("current Research has exact group Price evidence",D+".view.research.selection.listing.symbol==='GOOGL'&&"+D+".counts.eod===2");
        open(".managed-valuation-assumptions");
        click("//section[@data-valuation-listing-id='invented-review-filings-googl']/button[normalize-space(.)='Review saved inputs for GOOGL']");tap("#managed-valuation-use-inputs");
        open(".managed-valuation-workbench:not(.managed-valuation-assumptions)");
        replace("input[id$='-dcf-startingUnleveredCashFlowUsd']","110.00");
        click("//button[normalize-space(.)='Calculate authored scenarios']");
        await("only current revised calculation receives action authority",D+".calculations===1&&"+D+".workbench.calculation.dcfResult.scenarios.base.valuePerShareUsd==='155.00'&&JSON.stringify("+D+".review.reading)==="+q(paired));
        open(".managed-valuation-followup");tap("#valuation-followup-load");
        choose("#valuation-followup-model","Cash flow DCF","dcf");
        choose("#valuation-followup-scenario","Base","base");
        replace("#valuation-followup-question","Review the saved Class A assumptions after the dated close.");replace("#valuation-followup-due","2026-12-31");
        tap("#valuation-followup-preview");tap("#valuation-followup-create");
        replace("#managed-research-note","Revised Class A saved assumptions. Café 東京 📈");
        pressBack();
        await("Back retains exact passive reading and original group source without reevaluation",D+".view.research===null&&JSON.stringify("+D+".review.reading)==="+q(paired)+"&&JSON.stringify("+D+".group.rows[0].price)==="+q(price)+"&&"+D+".evaluations===1&&"+D+".counts.eod===2");
        assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
    }
    private void finishAndSave()throws Exception {
        stage="passive Finish and independent saves";
        tap("#watchlist-daily-finish");
        await("Finish keeps full reading and removes all evaluation and Inspect actions",D+".group.daily.phase==='finished'&&JSON.stringify("+D+".review.reading)==="+q(paired)+"&&document.querySelectorAll('#watchlist-saved-scenario-load,#watchlist-saved-scenario-preview,#watchlist-saved-scenario-evaluate,#watchlist-daily-inspect').length===0");
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_DAILY_REPORT_FINISHED,"#managed-watchlist-daily-report-heading","Finished group and report action; complete evidence asserted separately.");
        saveDailyReport();
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap(A);open(".managed-valuation-assumptions");
        tap("#managed-valuation-stage-review");tap("#managed-valuation-stage");tap("#managed-valuation-review");tap("#managed-valuation-save");
        await("valuation Save alone persists revised inputs",D+".counts.valuationSave===1&&"+D+".counts.save===0&&"+F+".save===0&&"+D+".saved.valuations.payload.entries[0].dcf.inputs.startingUnleveredCashFlowUsd==='110.00'");
        pressBack();open("#managed-unsaved-review");click("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']");
        await("Watchlist Save does not save Follow-ups",D+".counts.save===1&&"+F+".save===0");
        tap(".managed-watchlist-choices li:nth-child(2) .managed-watchlist-choice");replace("#managed-note-1","Deliberately unsaved Class C draft");
        navigate("Follow-ups");tap("#managed-followups-save");await("third resource saved independently",F+".commits===1");boundary();
    }
    private void freshLoad()throws Exception {
        stage="fresh owner and independent Loads";
        tap("#fixture-followups-fresh-session");await("fresh session clears transient readings and drafts",D+".counts.status===2&&"+D+".review.reading===null&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".workbench.calculation===null");
        await("fresh session has no retained daily report",PAYLOAD+"===null");
        navigate("My Watchlist");click("//button[normalize-space(.)='Load saved watchlist']");
        await("only saved notes reload and unsaved Class C edit is absent",D+".watchlist.draft.memberships[0].note==='Revised Class A saved assumptions. Café 東京 📈'&&"+D+".watchlist.draft.memberships[1].note!=='Deliberately unsaved Class C draft'");
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap(A);open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("fresh confirmed raw inputs do not invent a reading",D+".valuations.saved.payload.entries[0].dcf.inputs.startingUnleveredCashFlowUsd==='110.00'&&"+D+".review.reading===null&&"+D+".workbench.calculation===null");
        pressBack();navigate("Follow-ups");tap("#managed-followups-load");await("saved authored check reloads",D+".followups.draft.entries.length===2&&"+D+".followups.draft.entries.some(e=>e.check.includes('Review the saved Class A assumptions after the dated close.'))");boundary();
    }
    private void boundary()throws Exception {await("isolated source and independent persistence counters","location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]').content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]').content==='watchlist-daily-report'&&document.querySelector('meta[http-equiv=Content-Security-Policy]').content==="+q(CSP)+"&&"+D+".counts.eod===2&&"+D+".counts.unexpected===0");}
    private void open(String selector)throws Exception {if(!"true".equals(page.read(new Script("String(document.querySelector("+q(selector)+")?.open===true)"))))tap(selector+" > summary");}
    private void choose(String selector,String label,String value)throws Exception {tap(selector);AtomicReference<View> dialog=new AtomicReference<>();onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());assertNotNull(dialog.get());page.await(new Check("native option chooses exact value",new Script("document.querySelector("+q(selector)+").value==="+q(value)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));keyboard.closeSoftKeyboard();}
    private void click(String xpath)throws Exception {page.click(Element.xpath(xpath));}
    private void navigate(String name)throws Exception {click("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]");await("requested route settled",D+".view.view==="+q(name.equals("Follow-ups")?"followups":"watchlist"));}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private static String q(String value){return JSONObject.quote(value);}
    private void diagnose(){try{Log.e("WatchlistSavedScenario","stage="+stage+", "+page.raw(new Script("JSON.stringify({url:location.href,active:document.activeElement?.id,data:"+D+"})")));}catch(Exception|AssertionError failure){Log.e("WatchlistSavedScenario","Diagnostic unavailable",failure);}}
    @After public void closeInventedSavedScenario()throws Exception {
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
        page.read(new Script("(()=>{document.querySelector("+q(heading)+").scrollIntoView({block:'start',behavior:'instant'});return 'scrolled';})()"));committedFrame();page.await(new Check("scoped committed heading visible without horizontal overflow",new Script("(()=>{const e=document.querySelector("+q(heading)+"),r=e.getBoundingClientRect();return e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());Log.i("WatchlistDailyReportFrameScope",scope);new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,name)).retain();
    }

    private void tap(String selector)throws Exception {
        page.await(new Check("requested native control is present enabled and visible before scrolling",new Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("Watchlist daily report native control "+selector,geometry);
    }
    private void committedFrame()throws Exception {
        long deadline=SystemClock.uptimeMillis()+10000;CompletableFuture<Void> committed=new CompletableFuture<>();Handler main=new Handler(Looper.getMainLooper());AtomicReference<ViewTreeObserver> observer=new AtomicReference<>();AtomicReference<Runnable> callback=new AtomicReference<>();
        try{scenario.onActivity(a->{WebView web=a.getBridge().getWebView();assertTrue(web.isAttachedToWindow()&&web.isShown()&&web.isHardwareAccelerated());web.postVisualStateCallback(0,new WebView.VisualStateCallback(){@Override public void onComplete(long id){if(committed.isDone()||SystemClock.uptimeMillis()>=deadline)return;Runnable frame=()->main.post(()->{if(SystemClock.uptimeMillis()<deadline)committed.complete(null);});ViewTreeObserver current=web.getViewTreeObserver();observer.set(current);callback.set(frame);current.registerFrameCommitCallback(frame);web.invalidate();}});});long remaining=deadline-SystemClock.uptimeMillis();assertTrue(remaining>0);committed.get(remaining,TimeUnit.MILLISECONDS);}finally{committed.cancel(false);main.post(()->{ViewTreeObserver current=observer.get();Runnable frame=callback.get();if(current!=null&&current.isAlive()&&frame!=null)current.unregisterFrameCommitCallback(frame);});}
    }
    private ReassessmentNativeEditor.Dom readEditingDom(String selector) throws Exception {
        JSONObject value=new JSONObject(page.raw(new Script("(()=>{const e=document.querySelector("+q(selector)+");return {value:e?.value??'',start:e?.selectionStart??-1,end:e?.selectionEnd??-1,current:!!e&&document.activeElement===e&&!e.disabled&&!e.readOnly};})()")));
        return new ReassessmentNativeEditor.Dom(value.getString("value"),value.getInt("start"),value.getInt("end"),value.getBoolean("current"));
    }
    private void replace(String selector,String value)throws Exception {
        editingSelector=selector;
        String original=page.read(new Script("document.querySelector("+q(selector)+").value"));
        tap(selector);
        String focused="(()=>{const e=document.querySelector("+q(selector)+");return !!e&&document.activeElement===e&&!e.disabled&&!e.readOnly&&e.value==="+q(original)+";})()";
        page.await(new Check("exact original field owns native focus",new Script(focused)).nativeReady());
        nativeEditingState=keyboard.awaitVisibleEditor(selector);
        page.await(new Check("settled IME preserves exact original field",new Script(focused)).nativeReady());
        try(ReassessmentNativeEditor editor=ReassessmentNativeEditor.bind(scenario,()->readEditingDom(selector),original)) {
            editor.selectAll();
            await("native selection covers complete original",focused+"&&document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");
            editor.commit(value);
            await("full authored value reaches the controlled field","document.querySelector("+q(selector)+").value==="+q(value));
        }
        keyboard.closeSoftKeyboard();
    }
    private static final String PAYLOAD="document.querySelector('[data-watchlist-daily-report-payload=\"true\"]')";
    private static final String T="JSON.parse(document.querySelector('#fixture-watchlist-daily-report').textContent)";
    private static final String SAME="(function equal(a,b){if(Object.is(a,b))return true;if(a===null||b===null||typeof a!==\"object\"||typeof b!==\"object\")return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]));const k=Object.keys(a);return k.length===Object.keys(b).length&&k.every(n=>Object.hasOwn(b,n)&&equal(a[n],b[n]));})";
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    private String effects()throws Exception {return page.read(new Script("JSON.stringify({counts:"+D+".counts,followupCounts:"+F+",watchlist:"+D+".watchlist,followups:"+D+".followups,valuations:"+D+".valuations,evaluations:"+D+".evaluations,calculations:"+D+".calculations})"));}
    private void saveDailyReport()throws Exception {
        stage="finished daily capture, complete preview, cancelled picker and chosen HTML";
        WatchlistTestDocuments.clear(context());
        String before=effects();
        tap("#managed-watchlist-daily-report-prepare");
        await("complete report capture owns requested heading focus",PAYLOAD+"!==null&&document.activeElement.id==='managed-watchlist-daily-report-heading'");
        String captured=page.read(new Script(PAYLOAD+".textContent"));
        String p="JSON.parse("+PAYLOAD+".textContent)";
        await("complete ordered evidence and six retained outcomes match actual owner",p+".kind==='watchlist_daily_review'&&"+p+".rows.length===3&&"+SAME+"("+p+".daily,"+D+".group.daily)&&"+SAME+"("+p+".rows.map(r=>r.evidence),"+D+".group.rows)&&"+SAME+"("+p+".scenarios.rows,"+D+".review.plan.rows)&&"+SAME+"("+p+".scenarios.outcomes,"+D+".review.reading.rows)&&"+p+".scenarios.collectionVersion===5&&"+p+".scenarios.capturedAt==="+D+".review.plan.capturedAt&&"+p+".scenarios.evaluatedAt==="+D+".review.reading.evaluatedAt&&Number.isFinite(Date.parse("+p+".preparedAt))&&"+p+".resources.watchlist.dirty===true&&"+p+".resources.followups.dirty===true");
        await("exact current authored notes and checks accompany each chosen listing",p+".rows.every(r=>{const id=r.evidence.member.listing.listingId,m="+D+".watchlist.draft.memberships.find(x=>x.listingId===id),c="+D+".followups.draft.entries.filter(x=>x.listing.listingId===id);return r.watchlist.status==='ready'&&"+SAME+"(r.watchlist.value,m)&&(c.length===1?r.check.status==='ready'&&"+SAME+"(r.check.value,c[0]):c.length===0&&r.check.status==='absent'&&r.check.value===null);})");
        click("//summary[normalize-space(.)='Preview complete daily review report']");
        await("complete preview retains missing and invalid authored evidence","document.querySelector('article[aria-label=\"Complete Watchlist daily review report\"]').checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&"+p+".scenarios.rows[1].entry.exit.inputs.baseRevenue==='unfinished 1..'&&"+p+".scenarios.rows[2].reason==='missing_saved_inputs'");
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_DAILY_REPORT_PREVIEW,"#managed-watchlist-daily-report-heading","Complete report preview heading; every payload field and unopened disclosure is checked separately.");
        assertEquals(before,effects());
        tap("#managed-watchlist-daily-report-save");
        WatchlistSystemPicker picker=new WatchlistSystemPicker();picker.awaitOpen(30_000);picker.cancel();
        await("picker cancellation retains report without write",T+".choices===1&&"+T+".writeRequests===0&&"+PAYLOAD+".textContent==="+q(captured));
        assertEquals(0,WatchlistTestDocuments.outputs(context()).length);assertEquals(before,effects());
        tap("#managed-watchlist-daily-report-save");picker.awaitOpen(30_000);picker.saveToInventedRoot();
        await("one chosen-document write",T+".choices===2&&"+T+".writeRequests===1&&"+T+".writes===1");
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(1,outputs.length);
        WatchlistTestDocuments.Output output=outputs[0];assertTrue(output.name.matches("Investment-watchlist-daily-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals("text/html",context().getContentResolver().getType(output.uri));
        byte[] bytes;try(InputStream stream=context().getContentResolver().openInputStream(output.uri)){assertNotNull(stream);bytes=stream.readNBytes(8388609);}
        assertTrue(bytes.length>0&&bytes.length<=8388608);assertEquals(output.size,bytes.length);
        String html=new String(bytes,StandardCharsets.UTF_8);assertArrayEquals(bytes,html.getBytes(StandardCharsets.UTF_8));
        assertEquals(page.read(new Script(T+".text")),html);
        assertEquals(Integer.parseInt(page.read(new Script("String("+T+".byteLength)"))),bytes.length);
        assertTrue(WatchlistDailyReportHtmlDocumentPolicy.INSTANCE.acceptsText(output.name,html));
        String readback=page.read(new Script("JSON.stringify((()=>{const d=new DOMParser().parseFromString("+q(html)+",'text/html');return {payload:d.querySelector('[data-watchlist-daily-report-payload=\"true\"]').textContent,active:d.querySelectorAll('script,img,iframe,form,button,input,select,canvas,object,link').length,purpose:d.querySelector('meta[name=investment-report-purpose]').content,title:d.title};})())"));
        JSONObject observed=new JSONObject(readback);assertEquals(captured,observed.getString("payload"));assertEquals(0,observed.getInt("active"));assertEquals("investment.watchlist-daily-html",observed.getString("purpose"));assertEquals("Watchlist daily review",observed.getString("title"));
        assertEquals(before,effects());
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_DAILY_REPORT_SAVED,"#managed-watchlist-daily-report-heading","Chosen daily-review document confirmed; complete native byte readback and independent save boundaries asserted separately.");
    }
}
