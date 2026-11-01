package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static org.junit.Assert.*;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.espresso.action.EspressoKey;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.math.BigDecimal;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** One invented Watchlist journey; source reads, authored checks and persistence stay explicit. */
@RunWith(AndroidJUnit4.class)
public class ManagedWatchlistDailyReviewTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-watchlist-daily-review').textContent)";
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,watchlist,stage="startup";
    private int eod,filings;

    @Before public void launchInventedDailyReview() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.WATCHLIST_DAILY_REVIEW);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        try {page.awaitStartup(new Check("current disconnected Watchlist starts with independently unloaded drafts",new Script("location.href==='https://localhost/'&&"+D+".counts.status===1&&"+D+".watchlist.draft===null&&"+D+".followups.draft===null&&"+D+".view.view==='watchlist'&&document.querySelector('#managed-watchlist-heading')!==null")).nativeReady());scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));boundary(1,0,0,0);}
        catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    @Test public void orderedWatchlistReviewKeepsPartialSourcesThroughResearchBackFinishAndSeparateSave() throws Exception {
        try {loadAndChoose();runPartialAndContinue();for(int i=0;i<2;i++)inspectResearchAndBack(i);finishAndSave();}
        catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void loadAndChoose() throws Exception {
        stage="explicit Watchlist Load and ordered listing/source selection";
        page.click(Element.xpath("//button[normalize-space(.)='Load saved watchlist']"));
        await("only Watchlist is loaded",D+".watchlist.baseVersion===3&&"+D+".followups.draft===null");watchlist=read(".watchlistCanonical");
        tap("details.managed-filings-review > summary");
        for(String symbol:new String[]{"GOOGL","GOOG","NVDA"})page.click(Element.xpath("//fieldset[legend[normalize-space(.)='Companies for this review']]/label[starts-with(normalize-space(.),"+q(symbol+" ·")+")]/input"));
        await("exact chosen class order is retained",D+".group.chosen.map(r=>r.listing.symbol).join('|')==='GOOGL|GOOG|NVDA'");
        tap("#watchlist-daily-start");await("Start owns the group without source reads",D+".group.daily.phase==='ready'&&"+D+".group.selected.listing.symbol==='GOOGL'&&document.querySelector('#watchlist-daily-run').disabled");boundary(1,1,0,0);
        sourceChoice("Price");tap("#watchlist-daily-preview");
        await("unchecked Filings rows remain explicit and preview receives focus",D+".group.daily.plan.rows.filter(r=>r.source==='filings').every(r=>r.disposition==='not-selected')&&document.activeElement===document.querySelector('#watchlist-daily-plan-heading')");
        sourceChoice("Filings");await("changed choices need a fresh preview","document.querySelector('#watchlist-daily-run').disabled");tap("#watchlist-daily-preview");boundary(1,1,0,0);
    }
    private void runPartialAndContinue() throws Exception {
        stage="partial sequential pass and explicit continuation";
        tap("#watchlist-daily-run");eod=2;filings=1;
        await("timeout stops later missing reads but retains earlier full evidence",D+".group.daily.phase==='settled'&&"+D+".group.daily.outcomes.map(r=>r.status).join('|')==='loaded|loaded|failed|unattempted|unsupported|unsupported'&&document.querySelector('#watchlist-daily-outcomes').textContent.includes('Request failed')&&document.querySelector('#watchlist-daily-outcomes').textContent.includes('Not attempted')");boundary(1,1,0,0);
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_DAILY_REVIEW_PLAN,"#watchlist-daily-plan-heading","Partial plan: exact source order; timeout and unattempted rows separately asserted.");
        String first=page.read(new Script("JSON.stringify("+D+".group.rows[0])"));
        tap("#watchlist-daily-preview");await("earlier supported evidence is retained without a refresh",D+".group.daily.plan.rows.map(r=>r.disposition).join('|')==='retained|retained|missing|missing|unsupported|unsupported'");
        tap("#watchlist-daily-run");eod=3;filings=2;
        await("only remaining supported requests finish serially",D+".group.daily.phase==='settled'&&"+D+".group.daily.outcomes.map(r=>r.status).join('|')==='retained|retained|loaded|loaded|unsupported|unsupported'&&JSON.stringify("+D+".group.rows[0])==="+q(first));boundary(1,1,0,0);
        tap("#watchlist-daily-preview");tap("#watchlist-daily-run");
        await("a retained-only pass reads nothing",D+".group.daily.phase==='settled'&&"+D+".group.daily.outcomes.map(r=>r.status).join('|')==='retained|retained|retained|retained|unsupported|unsupported'");boundary(1,1,0,0);
        assertEquals("GOOGL:price|GOOGL:filings|GOOG:price|GOOG:price|GOOG:filings",page.read(new Script(D+".counts.requests.join('|')")));
    }
    private void inspectResearchAndBack(int index) throws Exception {
        String symbol=index==0?"GOOGL":"GOOG";stage="retained "+symbol+" evidence and authored work";
        page.click(Element.xpath("//ol[@aria-label='Companies in this daily review']/li/button[starts-with(normalize-space(.),"+q(symbol+" ·")+")]"));
        await("current company alone selected and focus committed",D+".group.selected.listing.symbol==="+q(symbol)+"&&document.activeElement===document.querySelector('#watchlist-daily-company-heading')");
        openEvidence("//section[@aria-labelledby='watchlist-daily-company-heading']");
        String price=page.read(new Script("JSON.stringify("+D+".group.rows["+index+"].price.response)")), packet=page.read(new Script("JSON.stringify("+D+".group.rows["+index+"].filings.response)"));
        fullEvidence(index,"document.querySelector('[aria-labelledby=watchlist-daily-company-heading]')");
        tap("#watchlist-daily-inspect");
        String url="https://localhost/?company=invented-review-filings-"+symbol.toLowerCase()+"&section=filings";
        page.await(new Check("owned route admits both complete packets without reads",new Script("location.href==="+q(url)+"&&document.querySelector('#managed-company-heading')?.textContent==="+q("Company research · "+symbol)+"&&JSON.stringify("+D+".price.response)==="+q(price)+"&&JSON.stringify("+D+".filings.response)==="+q(packet)+"&&!document.querySelector('.managed-company-visit > .trial-toolbar button').disabled")).nativeReady());boundary(1,1,index==0?0:1,0);
        tap(".managed-company-sections button:nth-child(1)");await("explicit Price section preserves checked seeds", "location.search.endsWith('section=eod')&&"+D+".view.research.section==='eod'&&JSON.stringify("+D+".price.response)==="+q(price));
        tap(".managed-company-sections button:nth-child(4)");page.await(new Check("return to Filings retains original clocks",new Script("location.href==="+q(url)+"&&JSON.stringify("+D+".filings.response)==="+q(packet)+"&&!document.querySelector('.managed-company-visit > .trial-toolbar button').disabled")).nativeReady());
        if(index==0)authorAssessment();else createDatedQuestion();
        boundary(1,1,1,0);
        page.await(new Check("exact owned route is settled before one native Back",new Script("location.href==="+q(url)+"&&!document.querySelector('.managed-company-visit > .trial-toolbar button').disabled")).nativeReady());
        pressBack();page.await(new Check("native Back keeps selected company, group and source bytes without reload",new Script("location.href==='https://localhost/'&&"+D+".view.view==='watchlist'&&"+D+".group.selected.listing.symbol==="+q(symbol)+"&&JSON.stringify("+D+".group.rows["+index+"].price.response)==="+q(price)+"&&JSON.stringify("+D+".group.rows["+index+"].filings.response)==="+q(packet)+"&&document.activeElement===document.querySelector('#watchlist-daily-inspect')")).nativeReady());
        boundary(1,1,1,0);assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
    }
    private void authorAssessment() throws Exception {
        tap("#managed-company-research-checks > summary");
        await("Follow-ups remains independently unloaded",D+".followups.draft===null&&document.querySelector('#managed-company-context-followups').textContent.includes('has not been loaded')");
        tap("#managed-company-context-load-followups");await("explicit resource Load selects no check",D+".followups.baseVersion===7&&document.querySelector('#managed-company-check-choice').value===''&&document.querySelector('#managed-company-check-attach').disabled");
        String id="40000000-0000-4000-8000-000000000002";
        await("only the exact GOOGL check is offered","[...document.querySelector('#managed-company-check-choice').options].map(o=>o.value).join('|')==="+q("|"+id));
        choose("#managed-company-check-choice","GOOGL · due "+read(".day")+" · open",id);tap("#managed-company-check-attach");
        await("explicit attachment commits and focuses its heading","document.activeElement===document.querySelector('#managed-company-check-attached-heading')");
        tap("#managed-research-followup-assessment > summary");replaceAssessment(read(".raw"));
        tap("#filings-assessment-toggle");await("evidence selection begins empty","document.querySelector('#filings-assessment-filing').value===''&&document.querySelector('#filings-assessment-preview').disabled");
        choose("#filings-assessment-filing","Form 10-Q · 0000000002-26-000003 · Filed 2026-09-19 · Report 2026-06-30","0000000002-26-000003");
        tap("#filings-assessment-preview");await("whole independent citation preview keeps original clocks","document.querySelector('#filings-assessment-result').value==="+D+".result&&document.activeElement===document.querySelector('#filings-assessment-preview-heading')");tap("#filings-assessment-apply");
        await("Apply changes only full authored result, never status or Save",D+".followups.draft.entries[1].result==="+D+".result&&"+D+".followups.draft.entries[1].status==='open'&&"+F+".save===0");
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_DAILY_REVIEW_RESEARCH,"#managed-research-followup-heading","Research: exact GOOGL attached check; full Unicode assessment, citation and paired source packets asserted separately.");
    }
    private void createDatedQuestion() throws Exception {
        String prefix="#managed-filings-followup-0000000002-26-000001";
        page.click(Element.xpath("//details[contains(@class,'managed-filings-followup')][.//textarea[@id='managed-filings-followup-0000000002-26-000001-question']]/summary"));
        await("existing GOOG check is absent and creation starts without side effects",D+".followups.draft.entries.length===7&&document.querySelector("+q(prefix+"-prepare")+")!==null");
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput(prefix+"-question","complete GOOG dated question",read(".question")));
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput(prefix+"-due","explicit UTC due date",read(".dueOn")));
        tap(prefix+"-prepare");await("whole cited question preview preserves exact listing and original filing", "document.querySelector("+q(prefix+"-preview")+").value==="+D+".questionCheck&&"+D+".followups.draft.entries.length===7&&document.querySelector('.managed-filings-followup-preview').textContent.includes('invented-review-filings-goog')");
        tap(prefix+"-create");await("Create adds exactly one open dated check without Save or source reads",D+".followups.draft.entries.length===8&&"+D+".followups.draft.entries[7].check==="+D+".questionCheck&&"+D+".followups.draft.entries[7].status==='open'&&"+D+".followups.draft.entries[7].completedOn===null&&"+D+".canonical==="+D+".expectedCanonical&&"+F+".save===0");
    }
    private void finishAndSave() throws Exception {
        stage="passive Finish and separate Follow-ups Save";tap("#watchlist-daily-finish");
        await("Finish preserves whole chosen order and current full authored checks",D+".group.daily.phase==='finished'&&"+D+".group.selected.listing.symbol==='GOOG'&&"+D+".group.chosen.map(r=>r.listing.symbol).join('|')==='GOOGL|GOOG|NVDA'&&"+D+".canonical==="+D+".expectedCanonical&&document.activeElement===document.querySelector('#watchlist-daily-finished-heading')");
        await("finished reading has no live request or creation actions","document.querySelectorAll('#watchlist-daily-run,#watchlist-daily-inspect,#watchlist-daily-finish').length===0&&document.querySelector('ol[aria-label=\"All chosen daily review companies\"]').children.length===3&&document.querySelector('[aria-label=\"Checks for chosen companies\"]').textContent.includes("+D+".result)&&document.querySelector('[aria-label=\"Checks for chosen companies\"]').textContent.includes("+D+".questionCheck)&&!document.querySelector('.managed-watchlist-daily-review script')");
        for(int index=0;index<2;index++){String root="//ol[@aria-label='All chosen daily review companies']/li["+(index+1)+"]";openEvidence(root);fullEvidence(index,"document.querySelector('ol[aria-label=\"All chosen daily review companies\"]').children["+index+"]");}
        await("unsupported NVDA stays visible, not empty or successful","document.querySelector('ol[aria-label=\"All chosen daily review companies\"]').children[2].textContent.includes('Price source not supported')&&document.querySelector('ol[aria-label=\"All chosen daily review companies\"]').children[2].textContent.includes('Filings source not supported')");boundary(1,1,1,0);
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_DAILY_REVIEW_FINISH,"#watchlist-daily-finished-heading","Finished reading: chosen order and first heading; full source packets, unsupported NVDA and authored results asserted separately.");
        String canonical=read(".canonical");navigate("Follow-ups");tap("#managed-followups-save");await("one explicit Save commits the entire expected resource",F+".save===1&&"+F+".commits===1&&"+D+".followups.baseVersion===8&&!"+D+".followups.dirty&&"+D+".canonical==="+q(canonical));boundary(1,1,1,1);
        tap("#fixture-followups-fresh-session");await("fresh session clears both drafts and transient evidence",D+".counts.status===2&&"+D+".watchlist.draft===null&&"+D+".followups.draft===null&&"+D+".group.daily===null&&"+D+".price.response===null&&"+D+".filings.response===null");
        navigate("Follow-ups");tap("#managed-followups-load");await("fresh explicit Load restores exact complete saved content",D+".followups.baseVersion===8&&"+D+".canonical==="+q(canonical)+"&&!"+D+".followups.dirty");
        navigate("My Watchlist");page.click(Element.xpath("//button[normalize-space(.)='Load saved watchlist']"));await("independent Watchlist survives unchanged",D+".watchlistCanonical==="+q(watchlist)+"&&"+D+".group.daily===null");boundary(2,2,2,1);
    }
    private void sourceChoice(String name)throws Exception {page.click(Element.xpath("//fieldset[legend[normalize-space(.)='Sources for this daily review']]/label[normalize-space(.)="+q(name)+"]/input"));}
    private void openEvidence(String root)throws Exception {for(String title:new String[]{"Complete retained price history","Complete retained filing packet"}){String path=root+"//details[summary[normalize-space(.)="+q(title)+"]]",element="document.evaluate("+q(path)+",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue";if(!"true".equals(page.read(new Script("String("+element+"?.open===true)"))))page.click(Element.xpath(path+"/summary"));await("complete raw source disclosure is open and visible",element+"?.open===true&&"+element+".querySelector(\"pre\").checkVisibility({checkOpacity:true,checkVisibilityCSS:true})");}}
    private void fullEvidence(int index,String root)throws Exception {await("complete raw histories, identity, SEC metadata and independent clocks are rendered","(()=>{const e="+root+",r="+D+".group.rows["+index+"],raw=[...e.querySelectorAll('pre')].map(p=>JSON.stringify(JSON.parse(p.textContent)));return [...e.querySelectorAll('pre')].every(p=>p.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))&&raw.includes(JSON.stringify(r.price.response))&&raw.includes(JSON.stringify(r.filings.response))&&r.filings.response.issuer.filings.every(f=>e.textContent.includes(f.accessionNumber)&&e.textContent.includes(f.filingDate))&&r.filings.response.issuer.olderHistoryAvailable===true&&r.price.response.security.shareClassId===r.member.listing.shareClassId&&r.filings.response.security.shareClassId===r.member.listing.shareClassId;})()");}
    private void navigate(String name)throws Exception {page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]"));await("requested top-level route settled",D+".view.view==="+q(name.equals("Follow-ups")?"followups":"watchlist"));}
    private void choose(String selector,String label,String value)throws Exception {tap(selector);AtomicReference<View> dialog=new AtomicReference<>();onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());assertNotNull(dialog.get());page.await(new Check("native option chooses exact value",new Script("document.querySelector("+q(selector)+").value==="+q(value)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));keyboard.closeSoftKeyboard();}
    private void boundary(int sessions,int loads,int followupLoads,int saves)throws Exception {await("exact source, CSP, sequential source counts and independent save boundary","location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]')?.content==='watchlist-daily-review'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+q(CSP)+"&&"+D+".counts.status==="+sessions+"&&"+D+".counts.load==="+loads+"&&"+D+".counts.eod==="+eod+"&&"+D+".counts.filings==="+filings+"&&"+D+".counts.active===0&&"+D+".counts.maxActive<2&&"+D+".counts.rejected===0&&Object.keys("+D+".counts.unexpected).length===0&&"+D+".samePackets&&"+F+".load==="+followupLoads+"&&"+F+".save==="+saves+"&&"+F+".commits==="+saves+"&&"+F+".replays===0&&"+F+".failures===0&&"+F+".held===0&&"+C+".marketsResolve===0&&"+C+".token===0&&"+C+".signOut===0&&"+C+".annual===0&&"+C+".search===0&&"+C+".calendar===0&&"+C+".fed===0&&"+C+".save===0&&"+C+".resolve===0"+(loads>0?"&&"+D+".watchlistCanonical==="+q(watchlist):""));}
    private void diagnose(){try{Log.e("WatchlistDailyReview","stage="+stage+", "+page.raw(new Script("JSON.stringify({url:location.href,active:document.activeElement?.id,data:"+D+",followups:"+F+"})")));}catch(Exception|AssertionError failure){Log.e("WatchlistDailyReview","Bounded diagnostic unavailable",failure);}}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private String read(String suffix)throws Exception{return page.read(new Script(D+suffix));}
    private static String q(String value){return JSONObject.quote(value);}
    @After public void closeInventedDailyReview()throws Exception {try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();}}
    private void frame(FollowupsReportFrameCapture.Frame name,String heading,String scope)throws Exception{
        page.read(new Script("(()=>{document.querySelector("+q(heading)+").scrollIntoView({block:'start',behavior:'instant'});return 'scrolled';})()"));committedFrame();page.await(new Check("scoped committed heading visible without horizontal overflow",new Script("(()=>{const e=document.querySelector("+q(heading)+"),r=e.getBoundingClientRect();return e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());Log.i("WatchlistDailyFrameScope",scope);new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,name)).retain();
    }

    private void tap(String selector)throws Exception {
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("Watchlist daily-review native control "+selector,geometry);
    }
    private void committedFrame()throws Exception {
        long deadline=SystemClock.uptimeMillis()+10000;CompletableFuture<Void> committed=new CompletableFuture<>();Handler main=new Handler(Looper.getMainLooper());AtomicReference<ViewTreeObserver> observer=new AtomicReference<>();AtomicReference<Runnable> callback=new AtomicReference<>();
        try{scenario.onActivity(a->{WebView web=a.getBridge().getWebView();assertTrue(web.isAttachedToWindow()&&web.isShown()&&web.isHardwareAccelerated());web.postVisualStateCallback(0,new WebView.VisualStateCallback(){@Override public void onComplete(long id){if(committed.isDone()||SystemClock.uptimeMillis()>=deadline)return;Runnable frame=()->main.post(()->{if(SystemClock.uptimeMillis()<deadline)committed.complete(null);});ViewTreeObserver current=web.getViewTreeObserver();observer.set(current);callback.set(frame);current.registerFrameCommitCallback(frame);web.invalidate();}});});long remaining=deadline-SystemClock.uptimeMillis();assertTrue(remaining>0);committed.get(remaining,TimeUnit.MILLISECONDS);}finally{committed.cancel(false);main.post(()->{ViewTreeObserver current=observer.get();Runnable frame=callback.get();if(current!=null&&current.isAlive()&&frame!=null)current.unregisterFrameCommitCallback(frame);});}
    }
    private void replaceAssessment(String value)throws Exception {tap("#managed-research-followup-result");page.await(new Check("exact assessment owns native focus before IME",new Script("document.activeElement===document.querySelector('#managed-research-followup-result')")).nativeReady());onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));await("native selection covers the whole original assessment","document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){public Matcher<View> getConstraints(){return isDisplayed();}public String getDescription(){return "replace exact invented Watchlist check assessment through native IME";}public void perform(UiController ui,View view){InputConnection input=view.onCreateInputConnection(new EditorInfo());assertNotNull(input);assertTrue(input.commitText(value,1));ui.loopMainThreadUntilIdle();}});await("full Unicode assessment reaches the real controlled input","document.querySelector('#managed-research-followup-result').value==="+q(value));keyboard.closeSoftKeyboard();}
}
