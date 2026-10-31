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

/** One invented complete current-holdings intake; personal persistence and Research stay explicit. */
@RunWith(AndroidJUnit4.class)
public class ManagedPortfolioHeldDueChecksTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-portfolio-held-due-checks').textContent)";
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String ROOT="#portfolio-held-due-checks";
    private static final String FIRST="30000000-0000-4000-8000-000000000002",SECOND="30000000-0000-4000-8000-000000000001";
    private static final String RESULT="Original GOOGL result Café 東京 📈; current authored assessment <script>invented</script> & full exact Class A retained. No financial source was loaded.";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final String[] QUESTIONS={"Does the complete GOOG Class C holding still support its authored thesis? Café 東京 📈","Which exact GOOGL Class A evidence changes this held-position check? Keep <script>invented</script> & all raw facts.","Keep this later MSFT question and its complete independent result.","Keep this previously completed IBM check and original completion date.","This ALFA check is not a current holding; retain its independent assessment.","Same listing ID with a different security name is not the held identity.","A different catalog snapshot does not match the current held listing."};
    private static final String[] IDENTITY_KEYS={"country","exchangeMic","instrumentType","issuerId","issuerName","listingId","securityId","securityName","shareClassId","shareClassName","symbol"};
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,day,origin,originalLedger,originalChecks,originalCatalog,stage="startup";

    @Before public void launchInventedHeldDueChecks() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_HELD_DUE_CHECKS);assets.prepare();scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        try {
        page.awaitStartup(new Check("current disconnected fixture starts Follow-ups with both personal resources unloaded",new Script("location.href==='https://localhost/'&&"+D+".counts.status===1&&"+D+".portfolio.draft===null&&"+D+".followups.draft===null&&"+D+".view.view==='followups'&&document.querySelector("+q(ROOT)+")!==null")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));day=read(".day");assertTrue(day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"));boundary(1,0,0,0,0);
        } catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    @Test public void currentHeldDueChecksChosenReviewResearchCompleteSaveFreshLoad() throws Exception {
        try {loadAndApprove();inspectWholeIntake();chooseAndStart();researchAssessAndBack();completeBoth();saveAndFreshLoad();}
        catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void loadAndApprove() throws Exception {
        stage="explicit independent loads";tap("#portfolio-held-due-load-portfolio");await("Portfolio alone loads version3 without Follow-ups",D+".portfolio.baseVersion===3&&"+D+".portfolio.draft.ledger.identities.length===7&&"+D+".followups.draft===null");boundary(1,1,0,0,0);
        tap("#portfolio-held-due-load-followups");await("separate Follow-ups Load retains seven exact checks and no selection",D+".followups.baseVersion===7&&"+D+".followups.draft.entries.length===7&&"+D+".review.entered===false");boundary(1,1,0,1,0);
        navigate("Portfolio");tap("#managed-portfolio-review-identities");await("only explicit Portfolio identity review resolves all seven holdings",D+".counts.resolve===1&&[...document.querySelectorAll('.managed-portfolio button')].some(b=>b.textContent==='Apply reviewed identities'&&!b.disabled)");
        page.click(Element.xpath("//section[contains(@class,'managed-portfolio')]//button[normalize-space(.)='Apply reviewed identities']"));await("identity application settles without source requests or a save","document.querySelector('.managed-portfolio [role=status]')?.textContent.includes('Portfolio identities reviewed')");navigate("Follow-ups");
        tap("#fixture-held-due-observe");await("observation action is acknowledged before any navigation or preparation",D+".observed===true&&"+D+".samePortfolio&&"+D+".sameWatchlist&&"+D+".sameValuation");originalLedger=read(".portfolioCanonical");originalChecks=read(".canonical");originalCatalog=page.read(new Script("JSON.stringify("+D+".view.snapshot)"));assertEquals("1000.00",new JSONObject(originalLedger).getJSONObject("opening").getString("cashUsd"));boundary(1,1,1,1,0);
    }
    private void inspectWholeIntake() throws Exception {
        stage="full held and excluded facts";tap("#portfolio-held-due-prepare");await("preparation focuses only its committed preview and chooses nothing", "document.activeElement===document.querySelector('#portfolio-held-due-preview')&&document.querySelector('#portfolio-held-due-start')?.disabled===true&&document.querySelectorAll('[data-held-due-check]').length===7&&document.querySelectorAll('[data-held-due-listing]').length===7");
        JSONArray checks=new JSONObject(originalChecks).getJSONArray("entries");
        for(int i=0;i<checks.length();i++){
            JSONObject entry=checks.getJSONObject(i);assertEquals(QUESTIONS[i],entry.getString("check"));String selector="[data-held-due-check="+q(entry.getString("id"))+"]";tap(selector+" details > summary");await("chosen check full-identity disclosure is actually open","document.querySelector("+q(selector+" details")+").open===true");String text=page.read(new Script("document.querySelector("+q(selector)+").textContent"));
            for(String key:new String[]{"check","result","dueOn","catalogSnapshotSha256"})assertTrue("Complete check "+i+" "+key,text.contains(entry.getString(key)));
            JSONObject identity=entry.getJSONObject("listing");for(String key:IDENTITY_KEYS)assertTrue("Full exact check identity "+key,text.contains(identity.getString(key)));
            boolean eligible=i<2;String button="#portfolio-held-due-choose-"+entry.getString("id");await("only overdue/today exact held listings are selectable", "(()=>{const b=document.querySelector("+q(button)+");return "+(eligible?"b&&!b.disabled&&b.getAttribute('aria-pressed')==='false'":"!b||b.disabled")+";})()");
        }
        JSONObject ledger=new JSONObject(originalLedger);JSONArray holdings=ledger.getJSONObject("opening").getJSONArray("holdings"),identities=ledger.getJSONArray("identities");assertEquals(7,holdings.length());
        for(int i=0;i<holdings.length();i++){
            JSONObject holding=holdings.getJSONObject(i),identity=identities.getJSONObject(i);String selector="[data-held-due-listing="+q(holding.getString("listingId"))+"]";tap(selector+" details > summary");await("held identity disclosure is actually open","document.querySelector("+q(selector+" details")+").open===true");String text=page.read(new Script("document.querySelector("+q(selector)+").textContent"));
            assertTrue(text.contains(new BigDecimal(holding.getString("shares")).stripTrailingZeros().toPlainString()));assertTrue(text.contains(holding.getString("confirmedOn")));if(!holding.isNull("totalCostBasisUsd"))assertTrue(text.contains(holding.getString("totalCostBasisUsd")));
            for(String key:IDENTITY_KEYS)assertTrue("Full held identity "+key,text.contains(identity.getString(key)));
        }
        await("all disposition reasons and the holding without a check remain inspectable", "(()=>{const t=document.querySelector("+q(ROOT)+").textContent;return ['This open check is overdue.','This open check is due today.','This check is due later.','This check is completed.','This listing is not currently held in Portfolio.','Review the complete listing identity and catalog before choosing this check.',"+q(day)+"].every(s=>t.includes(s));})()");unchanged();boundary(1,1,1,1,0);
    }
    private void chooseAndStart() throws Exception {
        stage="two explicit choices and atomic admission";tap("#portfolio-held-due-choose-"+FIRST);await("first choice is only the exact GOOGL Class A check", "document.querySelector('#portfolio-held-due-choose-"+FIRST+"').getAttribute('aria-pressed')==='true'&&document.querySelector('#portfolio-held-due-choose-"+SECOND+"').getAttribute('aria-pressed')==='false'");tap("#portfolio-held-due-choose-"+SECOND);
        await("two explicit positions keep reversed resource order", "document.querySelector('#portfolio-held-due-choose-"+FIRST+"').textContent.includes('1')&&document.querySelector('#portfolio-held-due-choose-"+SECOND+"').textContent.includes('2')");tap("#portfolio-held-due-start");position(0);
        await("Start commits the complete ordered review once with no Save or source read",D+".review.chosen.length===2&&"+D+".review.chosen[0].entry.id==="+q(FIRST)+"&&"+D+".review.chosen[1].entry.id==="+q(SECOND)+"&&"+D+".review.assessedOn==="+q(day)+"&&document.activeElement===document.querySelector('#managed-followups-review-heading')&&document.querySelector('details.managed-followups-review')?.open===true");unchanged();boundary(1,1,1,1,0);
        page.await(new Check("scoped frame has the committed review heading and first full question without horizontal overflow",new Script("(()=>{const h=document.querySelector('#managed-followups-review-heading'),r=h.getBoundingClientRect();return h===document.activeElement&&r.top>=0&&r.bottom<=innerHeight&&document.querySelector('details.managed-followups-review').textContent.includes("+q(QUESTIONS[1])+")&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());
        Log.i("PortfolioHeldDueFrameScope","Current review heading and first chosen check only. All seven held rows/excluded checks and full raw identities are asserted separately; lower content may be outside this frame.");new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.PORTFOLIO_HELD_DUE_CHECKS)).retain();
    }
    private void researchAssessAndBack() throws Exception {
        stage="exact Research assessment and one settled Back";tap("#managed-followups-review-research");
        page.await(new Check("chosen exact GOOGL visit settles its route with enabled Back and unloaded sources",new Script("(()=>{const b=document.querySelector('.managed-company-visit > .trial-toolbar button');return location.href==='https://localhost/?company=invented-held-due-googl&section=price'&&document.querySelector('#managed-company-heading')?.textContent==='Company research · GOOGL'&&b&&!b.disabled&&b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&document.querySelectorAll('.managed-company-evidence-actions time').length===0&&"+D+".sources.eod.running===false&&"+D+".sources.annual.running===false&&"+D+".sources.filings.running===false&&"+D+".sources.interim.running===false&&"+D+".view.research?.selection.listing.listingId==='invented-held-due-googl';})()")).nativeReady());unchanged();boundary(1,1,2,1,0);
        tap("#managed-research-followup-assessment > summary");page.await(new Check("exact assessment disclosure is open with one editable visible textarea",new Script("(()=>{const d=document.querySelector('#managed-research-followup-assessment'),e=document.querySelector('#managed-research-followup-result');return d?.open&&e instanceof HTMLTextAreaElement&&d.contains(e)&&!e.disabled&&!e.readOnly&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());replaceAssessment(RESULT);
        await("authored raw result changes only exact chosen entry without completion or Save",D+".followups.draft.entries[1].result==="+q(RESULT)+"&&"+D+".followups.draft.entries[1].status==='open'&&"+F+".save===0");unchanged();keyboard.closeSoftKeyboard();
        page.await(new Check("Back is still enabled in the exact settled document",new Script("location.href==='https://localhost/?company=invented-held-due-googl&section=price'&&document.querySelector('.managed-company-visit > .trial-toolbar button')?.disabled===false")).nativeReady());pressBack();
        page.await(new Check("one Back retains complete review order, authored result and independent Portfolio",new Script("location.href==='https://localhost/'&&document.querySelector('.managed-company-visit')===null&&"+D+".view.view==='followups'&&"+D+".review.phase==='reviewing'&&"+D+".review.position===0&&"+D+".review.chosen[0].entry.id==="+q(FIRST)+"&&"+D+".review.chosen[1].entry.id==="+q(SECOND)+"&&"+D+".samePortfolio&&"+D+".sameWatchlist&&"+D+".sameValuation&&"+D+".followups.draft.entries[1].result==="+q(RESULT))).nativeReady());position(0);unchanged();boundary(1,1,2,1,0);assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
    }
    private void completeBoth() throws Exception {
        stage="explicit completion and Continue";tap("#managed-followups-review-complete");await("first completion retains assessment and original due day",D+".followups.draft.entries[1].status==='completed'&&"+D+".followups.draft.entries[1].completedOn==="+q(day)+"&&"+D+".followups.draft.entries[1].dueOn==="+q(day)+"&&"+D+".followups.draft.entries[1].result==="+q(RESULT));position(0);
        tap("#managed-followups-review-next");position(1);tap("#managed-followups-review-complete");await("both explicit completions match the entire independent whole-resource oracle",D+".canonical==="+D+".expectedCanonical&&"+F+".save===0");unchanged();boundary(1,1,2,1,0);
    }
    private void saveAndFreshLoad() throws Exception {
        stage="separate whole Save and fresh Load";tap("#managed-followups-review-finish");await("Finish retains all seven checks and does not save",D+".review.phase==='finished'&&"+D+".canonical==="+D+".expectedCanonical&&"+F+".save===0");String expected=read(".expectedCanonical");tap("#managed-followups-save");await("one explicit independent Save commits version8 and all excluded raw checks",F+".save===1&&"+F+".commits===1&&"+D+".followups.baseVersion===8&&!"+D+".followups.dirty&&"+D+".canonical==="+q(expected));unchanged();boundary(1,1,2,1,1);
        tap("#fixture-followups-fresh-session");await("fresh session has no captured review and neither personal draft is loaded",D+".counts.status===2&&"+D+".portfolio.draft===null&&"+D+".followups.draft===null&&"+D+".review.entered===false&&"+D+".observed===false");boundary(2,1,2,1,1);
        tap("#portfolio-held-due-load-followups");await("fresh explicit Load restores exact full saved payload with no temporary chosen review",D+".followups.baseVersion===8&&!"+D+".followups.dirty&&"+D+".canonical==="+q(expected)+"&&"+D+".review.entered===false&&"+D+".portfolio.draft===null");boundary(2,1,2,2,1);
        tap("#portfolio-held-due-load-portfolio");await("independent Portfolio fresh Load confirms original raw holdings and cash byte-for-byte",D+".portfolio.baseVersion===3&&"+D+".portfolioCanonical==="+q(originalLedger)+"&&!"+D+".portfolio.dirty");boundary(2,2,2,2,1);
    }
    private void position(int n)throws Exception {await("complete chosen review position and full raw current question",D+".review.phase==='reviewing'&&"+D+".review.position==="+n+"&&"+D+".review.selected.entry.id==="+q(n==0?FIRST:SECOND)+"&&document.querySelector('#managed-followups-review-position')?.textContent==='Check "+(n+1)+" of 2. Assessed on "+day+" UTC.'&&document.querySelector('details.managed-followups-review').textContent.includes("+q(QUESTIONS[n==0?1:0])+")");}
    private void unchanged()throws Exception {await("exact observed Portfolio base/draft plus independent Watchlist and valuation resource remain unchanged",D+".observed&&"+D+".samePortfolio&&"+D+".sameWatchlist&&"+D+".sameValuation&&"+D+".portfolioCanonical==="+q(originalLedger)+"&&JSON.stringify("+D+".view.snapshot)==="+q(originalCatalog));}
    private void boundary(int sessions,int portfolioLoads,int resolves,int followupLoads,int saves)throws Exception {await("exact disconnected request and independent personal-write budgets","location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+q(CSP)+"&&"+D+".counts.status==="+sessions+"&&"+D+".counts.portfolioLoad==="+portfolioLoads+"&&"+D+".counts.resolve==="+resolves+"&&"+D+".counts.rejected===0&&Object.keys("+D+".counts.unexpected).length===0&&"+C+".load===0&&"+C+".save===0&&"+C+".marketsResolve===0&&"+C+".annual===0&&"+C+".eod===0&&"+C+".filings===0&&"+C+".search===0&&"+C+".calendar===0&&"+C+".fed===0&&"+C+".token===0&&"+C+".signOut===0&&"+F+".load==="+followupLoads+"&&"+F+".save==="+saves+"&&"+F+".commits==="+saves+"&&"+F+".replays===0&&"+F+".failures===0&&"+F+".held===0");}
    private void navigate(String name)throws Exception {page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]"));await("explicit workspace destination is present",name.equals("Portfolio")?"document.querySelector('#managed-portfolio-heading')!==null":"document.querySelector("+q(ROOT)+")!==null");}
    private void tap(String selector)throws Exception {
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("held-due-check native control "+selector,geometry);
    }
    private void committedFrame()throws Exception {
        long deadline=SystemClock.uptimeMillis()+10000;CompletableFuture<Void> committed=new CompletableFuture<>();Handler main=new Handler(Looper.getMainLooper());AtomicReference<ViewTreeObserver> observer=new AtomicReference<>();AtomicReference<Runnable> callback=new AtomicReference<>();
        try{scenario.onActivity(a->{WebView web=a.getBridge().getWebView();assertTrue(web.isAttachedToWindow()&&web.isShown()&&web.isHardwareAccelerated());web.postVisualStateCallback(0,new WebView.VisualStateCallback(){@Override public void onComplete(long id){if(committed.isDone()||SystemClock.uptimeMillis()>=deadline)return;Runnable frame=()->main.post(()->{if(SystemClock.uptimeMillis()<deadline)committed.complete(null);});ViewTreeObserver current=web.getViewTreeObserver();observer.set(current);callback.set(frame);current.registerFrameCommitCallback(frame);web.invalidate();}});});long remaining=deadline-SystemClock.uptimeMillis();assertTrue(remaining>0);committed.get(remaining,TimeUnit.MILLISECONDS);}finally{committed.cancel(false);main.post(()->{ViewTreeObserver current=observer.get();Runnable frame=callback.get();if(current!=null&&current.isAlive()&&frame!=null)current.unregisterFrameCommitCallback(frame);});}
    }
    private void replaceAssessment(String value)throws Exception {tap("#managed-research-followup-result");page.await(new Check("exact assessment owns native focus before IME",new Script("document.activeElement===document.querySelector('#managed-research-followup-result')")).nativeReady());onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));await("native selection covers the whole original assessment","document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){public Matcher<View> getConstraints(){return isDisplayed();}public String getDescription(){return "replace exact invented held check assessment through native IME";}public void perform(UiController ui,View view){InputConnection input=view.onCreateInputConnection(new EditorInfo());assertNotNull(input);assertTrue(input.commitText(value,1));ui.loopMainThreadUntilIdle();}});await("full Unicode assessment reaches the real controlled input","document.querySelector('#managed-research-followup-result').value==="+q(value));keyboard.closeSoftKeyboard();}
    private void diagnose(){try{Log.e("PortfolioHeldDueChecks","stage="+stage+", "+page.raw(new Script("JSON.stringify({url:location.href,active:document.activeElement?.id,startup:{origin:location.origin,hash:location.hash,platform:window.Capacitor?.getPlatform(),sourceMatches:document.querySelector('meta[name=investment-build-sha]')?.content==="+q(sha)+",fixtureMatches:document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace',cspMatches:document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+q(CSP)+",global:"+C+",followups:"+F+"},back:(()=>{const b=document.querySelector('.managed-company-visit > .trial-toolbar button');return{enabled:!!b&&!b.disabled,visible:b?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})};})(),observed:"+D+".observed,samePortfolio:"+D+".samePortfolio,sameWatchlist:"+D+".sameWatchlist,sameValuation:"+D+".sameValuation,counts:"+D+".counts,day:"+D+".day,review:{entered:"+D+".review.entered,phase:"+D+".review.phase,position:"+D+".review.position,chosen:"+D+".review.chosen.map(r=>r.entry.id)},view:"+D+".view.view,selection:"+D+".view.research?.selection,portfolioBase:"+D+".portfolio.baseVersion,followupsBase:"+D+".followups.baseVersion,assessmentOpen:document.querySelector('#managed-research-followup-assessment')?.open})")));}catch(Exception|AssertionError diagnostic){Log.e("PortfolioHeldDueChecks","Bounded diagnostic unavailable",diagnostic);}}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private String read(String suffix)throws Exception{return page.read(new Script(D+suffix));}
    private static String q(String value){return JSONObject.quote(value);}
    @After public void closeInventedHeldDueChecks()throws Exception {try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();}}
}
