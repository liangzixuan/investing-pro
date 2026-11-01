package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static org.junit.Assert.*;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;


/** One disconnected, invented saved-input reassessment with three independent resource commits. */
@RunWith(AndroidJUnit4.class)
public class ManagedSavedValuationReassessmentTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-saved-valuation-reassessment').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String A="button[aria-label='Annual report for saved GOOGL']";
    private static final String PAIR="#managed-valuation-reassessment-reading";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,stage="startup",paired,price,annual;
    @Before public void launchInventedReassessment()throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.SAVED_VALUATION_REASSESSMENT);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        page.awaitStartup(new Check("independently unloaded invented resources",new Script("location.href==='https://localhost/'&&"+D+".counts.status===1&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".followups.draft===null&&"+D+".view.view==='watchlist'")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));
    }
    @Test public void confirmedSavedBaselineKeepsRevisedEvidenceThroughBackAndSeparateSaves()throws Exception {
        try {loadAndCapture();loadPartialAndRevise();calculateAndCheck();ownedBackAndSave();freshLoad();}catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void loadAndCapture()throws Exception {
        stage="explicit saved resources and exact share-class baseline";
        click("//button[normalize-space(.)='Load saved watchlist']");
        await("both exact share classes loaded without other resources",D+".watchlist.baseVersion===7&&"+D+".watchlist.draft.memberships.map(x=>x.symbol).join('|')==='GOOGL|GOOG'&&"+D+".valuations.draft===null");
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap(A);
        page.await(new Check("exact Annual route opens without source reads",new Script("location.search==='?company=invented-review-filings-googl&section=annual'&&"+D+".workbench.editable&&"+D+".counts.requests.length===0")).nativeReady());
        open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("both confirmed maps are available; other class baseline refused",D+".valuations.baseVersion===5&&document.querySelector('section[data-valuation-listing-id=\"invented-review-filings-goog\"] button:last-child').disabled&&"+D+".workbench.calculation===null");
        click("//section[@data-valuation-listing-id='invented-review-filings-googl']/button[normalize-space(.)='Review saved inputs for GOOGL']");tap("#managed-valuation-use-inputs");
        String editor=page.read(new Script("JSON.stringify("+D+".workbench)"));
        click("//section[@data-valuation-listing-id='invented-review-filings-googl']/button[normalize-space(.)='Use as reassessment baseline']");
        await("capture preserves editor, complete saved entry and version without Calculate",D+".reassessment.baseline.capture.saved.version===5&&JSON.stringify("+D+".reassessment.baseline.capture.entry)===JSON.stringify("+D+".data.entries[0])&&JSON.stringify("+D+".workbench)==="+q(editor)+"&&"+D+".calculationPublications===0&&document.activeElement===document.querySelector('#managed-valuation-reassessment-heading')");
        frame(FollowupsReportFrameCapture.Frame.SAVED_VALUATION_REASSESSMENT_BASELINE,"#managed-valuation-reassessment-heading","Confirmed Class A baseline heading and original version; complete raw maps asserted separately, not all visible in this frame.");
        counters(0,0,0,0,0);
    }
    private void loadPartialAndRevise()throws Exception {
        stage="explicit source pass and Annual single-field apply";
        await("explicit source selection excludes Interim","[...document.querySelectorAll('.managed-company-source-pass input')].map(x=>x.checked).join('|')==='true|true|true|false'");
        click("//button[normalize-space(.)='Preview company source pass']");
        click("//button[normalize-space(.)='Run reviewed company source pass']");
        await("Price and Annual retained while failed Filings remains distinct",D+".counts.requests.join('|')==='eod|annual|filings'&&"+D+".counts.active===0&&"+D+".price.response!==null&&"+D+".annual.response!==null&&"+D+".filings.response===null&&document.querySelector('.managed-company-source-pass-results').textContent.includes('Failed')");
        price=page.read(new Script("JSON.stringify("+D+".price.response)"));annual=page.read(new Script("JSON.stringify("+D+".annual.response)"));
        await("complete original Annual packet retained", "JSON.stringify("+D+".annual.response)===JSON.stringify("+D+".annualPacket)");
        tap(".managed-company-sections button:nth-child(1)");
        page.await(new Check("Price section reuses the original complete response",new Script("location.search.endsWith('section=price')&&JSON.stringify("+D+".price.response)==="+q(price))).nativeReady());
        open(".managed-eod-exact-values");open(".managed-eod-source");
        await("every raw close and original request window is readable","(()=>{const e=document.querySelector('.managed-eod-history'),r="+D+".price.response,rows=[...e.querySelectorAll('.managed-eod-exact-values tbody tr')].map(t=>[...t.cells].map(c=>c.textContent));return JSON.stringify(rows)===JSON.stringify(r.rows.map(x=>[x.date,x.close]))&&[r.window.startDate,r.window.endDate,r.requestStartedAt,r.completedAt].every(x=>e.textContent.includes(x));})()");
        tap(".managed-company-sections button:nth-child(2)");
        page.await(new Check("Annual section retains complete original response",new Script("location.search.endsWith('section=annual')&&JSON.stringify("+D+".annual.response)==="+q(annual))).nativeReady());
        open(".managed-valuation-workbench:not(.managed-valuation-assumptions)");open(".managed-valuation-revenue-basis");
        choose(".managed-valuation-revenue-basis select","Revenue","Revenues");tap(".managed-valuation-revenue-basis > button");
        await("both complete raw maps precede Apply","document.querySelector('[aria-label=\"Current complete valuation inputs\"]').textContent.includes('800.00')&&document.querySelector('[aria-label=\"Proposed complete valuation inputs\"]').textContent.includes('1000')&&"+D+".workbench.exitDraft.baseRevenue==='800.00'&&"+D+".workbench.calculation===null");
        await("selected Annual source exposes exact issuer, filing, amounts and independent original times","(()=>{const e=document.querySelector('[aria-label=\"Selected reported revenue source\"]');return ['Reported USD 1000','2025-01-01','2025-12-31','0000000001','2026-02-01','0000000001-26-000001','2026-09-20T00:00:00.000Z','2026-09-20T00:00:01.000Z','2026-09-20T00:00:02.000Z'].every(x=>e.textContent.includes(x))&&e.querySelector('a').href==='https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm';})()");
        tap("[aria-label='Complete starting revenue change preview'] > button");
        await("Annual changes only starting revenue","(()=>{const e="+D+".workbench,b="+D+".data.entries[0];return e.exitDraft.baseRevenue==='1000'&&Object.keys(b.exit.inputs).filter(k=>k!=='baseRevenue').every(k=>JSON.stringify(e.exitDraft[k])===JSON.stringify(b.exit.inputs[k]))&&JSON.stringify(e.dcfDraft)===JSON.stringify(b.dcf.inputs)&&e.calculation===null;})()");
        replace("input[id$='-dcf-startingUnleveredCashFlowUsd']","110.00");replace("input[id$='-exit-cash']","200.00");
        await("complete revised inputs remain authored and uncalculated",D+".workbench.calculation===null&&JSON.stringify("+D+".workbench.dcfDraft)===JSON.stringify("+D+".expectedValuations[0].dcf.inputs)&&JSON.stringify("+D+".workbench.exitDraft)===JSON.stringify("+D+".expectedValuations[0].exit.inputs)");
        counters(1,0,0,0,0);
    }
    private void calculateAndCheck()throws Exception {
        stage="one explicit paired Calculate and revised-result dated check";
        click("//button[normalize-space(.)='Calculate saved and revised scenarios']");
        await("both full models evaluated from their independent raw maps",D+".reassessment.reading.savedCalculation.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&"+D+".reassessment.reading.savedCalculation.exitResult.scenarios.base.valuePerShare==='15.00'&&"+D+".reassessment.reading.revisedCalculation.dcfResult.scenarios.base.valuePerShareUsd==='155.00'&&"+D+".reassessment.reading.revisedCalculation.exitResult.scenarios.base.valuePerShare==='20.00'&&"+D+".calculationPublications===1");
        for(String side:new String[]{"Saved inputs evaluated now","Revised authored inputs"}) {
            for(String summary:new String[]{"DCF projections and terminal value","DCF sensitivity: 25 base-scenario combinations","Exit multiple calculations and formulas","Exit multiple sensitivity: 25 base-scenario combinations","Complete authored inputs and model methods"}) {
                String path="//section[@aria-label="+q(side)+"]//details[summary[normalize-space(.)="+q(summary)+"]]";
                click(path+"/summary");
            }
            fullResults(side,side.startsWith("Saved")?"savedCalculation":"revisedCalculation");
        }
        paired=page.read(new Script("JSON.stringify("+D+".reassessment)"));
        frame(FollowupsReportFrameCapture.Frame.SAVED_VALUATION_REASSESSMENT_RESULTS,"#managed-valuation-reassessment-results-heading","Saved and revised evaluation heading; all six scenarios per side, projections, methods and both sensitivity grids asserted separately.");
        open(".managed-valuation-followup");tap("#valuation-followup-load");
        choose("#valuation-followup-model","Exit EBITDA multiple","exit");
        choose("#valuation-followup-scenario","Base","base");
        replace("#valuation-followup-question",read(".question"));replace("#valuation-followup-due",read(".dueOn"));
        tap("#valuation-followup-preview");
        await("preview uses revised20.00, never passive saved15.00","document.querySelector('#valuation-followup-check').value==="+D+".expectedCheck&&"+D+".followups.draft.entries.length===1");
        tap("#valuation-followup-create");await("one complete open Class A check remains unsaved",D+".followupsCanonical==="+D+".expectedFollowupsCanonical&&"+D+".followups.draft.entries.length===2&&"+D+".followups.draft.entries[1].status==='open'");
        replace("#managed-research-note",read(".reason"));counters(1,0,0,1,0);
    }
    private void ownedBackAndSave()throws Exception {
        stage="owned Back and same-company return without refetch or recalculation";
        page.await(new Check("owned company route committed before Back",new Script("location.search.endsWith('section=annual')&&!document.querySelector('.managed-company-visit > .trial-toolbar button').disabled")).nativeReady());
        await("original source packets and clocks remain exact before leaving", "JSON.stringify("+D+".price.response)==="+q(price)+"&&JSON.stringify("+D+".annual.response)==="+q(annual));
        pressBack();await("Back keeps the passive pair and closes live source panels",D+".view.view==='watchlist'&&"+D+".reassessment.reading!==null&&!"+D+".reassessment.active&&"+D+".price.response===null&&"+D+".annual.response===null&&"+D+".calculationPublications===1");tap(A);
        page.await(new Check("same owner resumes the complete pair without inventing source retention",new Script("location.search.endsWith('section=annual')&&JSON.stringify("+D+".reassessment)==="+q(paired)+"&&"+D+".price.response===null&&"+D+".annual.response===null&&"+D+".calculationPublications===1")).nativeReady());
        assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));counters(1,0,0,1,0);
        open(".managed-valuation-assumptions");tap("#managed-valuation-stage-review");tap("#managed-valuation-stage");tap("#managed-valuation-review");
        await("Review Stage leaves both other resources unsaved",D+".valuations.dirty&&JSON.stringify("+D+".valuations.draft.entries)===JSON.stringify("+D+".expectedValuations)&&"+D+".watchlist.dirty&&"+D+".followups.dirty");
        tap("#managed-valuation-save");await("only valuation Save commits complete exact raw inputs",D+".valuations.baseVersion===6&&!"+D+".valuations.dirty&&JSON.stringify("+D+".saved.valuations.payload.entries)===JSON.stringify("+D+".expectedValuations)&&"+D+".reassessment.baseline===null");counters(1,1,0,1,0);
        pressBack();await("Watchlist keeps unsaved reason",D+".view.view==='watchlist'&&"+D+".watchlist.draft.memberships[0].note==="+D+".reason");
        open("#managed-unsaved-review");click("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']");
        await("only Watchlist Save commits its complete notes",D+".watchlist.baseVersion===8&&!"+D+".watchlist.dirty&&"+D+".followups.dirty");counters(1,1,1,1,0);
        tap(".managed-watchlist-choices li:nth-child(2) .managed-watchlist-choice");replace("#managed-note-1",read(".unsaved"));
        await("later Class C draft is explicitly not saved",D+".watchlist.dirty&&"+D+".watchlist.draft.memberships[1].note==="+D+".unsaved&&"+D+".saved.watchlist.payload.memberships[1].note==="+D+".data.watchlist.memberships[1].note");
        navigate("Follow-ups");tap("#managed-followups-save");await("third separate Save commits complete dated checks",D+".followups.baseVersion===4&&!"+D+".followups.dirty&&"+F+".commits===1");counters(1,1,1,1,1);
    }
    private void freshLoad()throws Exception {
        stage="fresh session and three independent Loads";
        tap("#fixture-followups-fresh-session");await("fresh owner clears transient results and unsaved drafts",D+".counts.status===2&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".followups.draft===null&&"+D+".reassessment.baseline===null&&"+D+".workbench.calculation===null&&"+D+".price.response===null&&"+D+".annual.response===null");
        navigate("My Watchlist");click("//button[normalize-space(.)='Load saved watchlist']");
        await("saved A reason restored while unsaved C edit is absent",D+".watchlist.baseVersion===8&&"+D+".watchlist.draft.memberships[0].note==="+D+".reason&&"+D+".watchlist.draft.memberships[1].note==="+D+".data.watchlist.memberships[1].note&&!"+D+".watchlist.dirty");
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap(A);open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("only raw revised inputs restore; no calculation or historical source evidence invented",D+".valuations.baseVersion===6&&JSON.stringify("+D+".valuations.saved.payload.entries)===JSON.stringify("+D+".expectedValuations)&&"+D+".workbench.calculation===null&&"+D+".reassessment.baseline===null&&document.querySelector('#managed-valuation-reassessment-reading')===null");
        pressBack();navigate("Follow-ups");tap("#managed-followups-load");
        await("fresh explicit Follow-ups Load restores exact check and unrelated Class C row",D+".followups.baseVersion===4&&"+D+".followupsCanonical==="+D+".expectedFollowupsCanonical&&JSON.stringify("+D+".followups.draft.entries[0])===JSON.stringify("+D+".data.followups.entries[0])&&!"+D+".followups.dirty");
        frame(FollowupsReportFrameCapture.Frame.SAVED_VALUATION_REASSESSMENT_SAVED,"#managed-followups-heading","Fresh loaded Follow-ups heading; independent valuation and Watchlist saves, exact restored full payloads and discarded later note asserted separately.");
        counters(1,1,1,2,1);await("exact final independent counters",D+".counts.status===2&&"+D+".counts.load===2&&"+D+".counts.valuationLoad===2&&"+D+".calculationPublications===0");
    }
    private void fullResults(String side,String key)throws Exception {
        String root="document.querySelector("+q(PAIR+" > .managed-valuation-comparison > section[aria-label='"+side+"']")+")";
        await("every scenario, projection, sensitivity and formula value is rendered in order", "(()=>{const e="+root+",c="+D+".reassessment.reading["+q(key)+"],keys=['conservative','base','expansion'],labels=['Conservative','Base','Expansion'];const rows=label=>[...e.querySelectorAll('table')].find(t=>t.caption.textContent===label);const cells=label=>[...rows(label).tBodies[0].rows].map(r=>[...r.cells].map(x=>x.textContent));const exact=(label,value)=>JSON.stringify(cells(label))===JSON.stringify(value);return exact('Cash flow DCF scenarios',keys.map((n,i)=>{const v=c.dcfResult.scenarios[n];return [labels[i],v.annualCashFlowGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd,v.terminalValuePercentOfEnterpriseValue]}))&&exact('Exit multiple scenarios',keys.map((n,i)=>{const v=c.exitResult.scenarios[n];return [labels[i],v.yearNRevenue,v.yearNEbitda,v.presentEnterpriseValue,v.equityValue,v.valuePerShare]}))&&keys.every((n,i)=>exact(labels[i]+' cash flow projection',c.dcfResult.scenarios[n].projection.map(v=>[String(v.year),v.cashFlowUsd,v.presentValueUsd])))&&exact('DCF sensitivity — value per share in USD/share',c.dcfResult.sensitivity.cells.map(v=>[v.waccPercent,v.terminalGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd]))&&exact('Exit multiple sensitivity — value per share in USD/share',c.exitResult.sensitivity.cells.map(v=>[v.discountRatePercent,v.exitMultiple,v.result.presentEnterpriseValue,v.result.equityValue,v.result.valuePerShare]))&&keys.every(n=>c.exitResult.scenarios[n].formulaTrace.every(v=>e.textContent.includes(v)));})()");

        await("full raw inputs, all scenario/projection rows, complete methods and both25-cell sensitivity grids", "(()=>{const e=document.querySelector("+q(PAIR+" > .managed-valuation-comparison > section[aria-label='"+side+"']")+"),c="+D+".reassessment.reading["+q(key)+"],raw=[...e.querySelectorAll('pre')].map(p=>p.textContent);return e.querySelectorAll('table').length===7&&[...e.querySelectorAll('table')].map(t=>t.tBodies[0].rows.length).join('|')==='3|5|5|5|25|3|25'&&[c.dcfDraft,c.exitDraft,c.dcfResult.methodology,c.exitResult.methodology].every(x=>raw.some(v=>{try{return JSON.stringify(JSON.parse(v))===JSON.stringify(x)}catch{return false}}))&&['conservative','base','expansion'].every(n=>e.textContent.includes(c.dcfResult.scenarios[n].valuePerShareUsd)&&e.textContent.includes(c.exitResult.scenarios[n].valuePerShare))&&e.querySelectorAll('details:not([open])').length===0;})()");
    }
    private void counters(int source,int valuationSave,int watchSave,int followupLoad,int followupSave)throws Exception {
        await("exact isolated source and persistence boundaries","location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]').content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]').content==='saved-valuation-reassessment'&&document.querySelector('meta[http-equiv=Content-Security-Policy]').content==="+q(CSP)+"&&"+D+".counts.eod==="+source+"&&"+D+".counts.annual==="+source+"&&"+D+".counts.filings==="+source+"&&"+D+".counts.active===0&&"+D+".counts.maxActive<=1&&"+D+".counts.rejected===0&&Object.keys("+D+".counts.unexpected).length===0&&"+D+".counts.valuationSave==="+valuationSave+"&&"+D+".counts.save==="+watchSave+"&&"+F+".load==="+followupLoad+"&&"+F+".save==="+followupSave+"&&"+F+".commits==="+followupSave+"&&"+F+".replays===0&&"+F+".failures===0");
    }
    private void open(String selector)throws Exception {if(!"true".equals(page.read(new Script("String(document.querySelector("+q(selector)+")?.open===true)"))))tap(selector+" > summary");}
    private void click(String xpath)throws Exception {page.click(Element.xpath(xpath));}
    private void navigate(String name)throws Exception {click("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]");await("requested route settled",D+".view.view==="+q(name.equals("Follow-ups")?"followups":"watchlist"));}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private String read(String suffix)throws Exception{return page.read(new Script(D+suffix));}
    private static String q(String value){return JSONObject.quote(value);}
    private void diagnose(){try{Log.e("SavedValuationReassessment","stage="+stage+", "+page.raw(new Script("(()=>{const d="+D+";return JSON.stringify({url:location.href,active:document.activeElement?.id,counts:d.counts,view:d.view.view,visit:d.view.research?.selection.listing.listingId,editorOwner:d.workbench.owner?.listing.listingId,editorContext:d.workbench.context?.listing.listingId,baseline:!!d.reassessment.baseline,reading:!!d.reassessment.reading,reassessmentActive:d.reassessment.active,exactPair:JSON.stringify(d.reassessment)==="+q(paired==null?"":paired)+",pricePresent:!!d.price.response,annualPresent:!!d.annual.response,calculations:d.calculationPublications,valuationVersion:d.valuations.baseVersion,watchlistVersion:d.watchlist.baseVersion,followupsVersion:d.followups.baseVersion,followups:"+F+"});})()")));}catch(Exception|AssertionError failure){Log.e("SavedValuationReassessment","Diagnostic unavailable",failure);}}
    @After public void closeInventedReassessment()throws Exception {try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();}}
    private void choose(String selector,String label,String value)throws Exception {tap(selector);AtomicReference<View> dialog=new AtomicReference<>();onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());assertNotNull(dialog.get());page.await(new Check("native option chooses exact value",new Script("document.querySelector("+q(selector)+").value==="+q(value)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));keyboard.closeSoftKeyboard();}
    private void frame(FollowupsReportFrameCapture.Frame name,String heading,String scope)throws Exception{
        committedFrame();
        page.read(new Script("(()=>{document.querySelector("+q(heading)+").scrollIntoView({block:'start',behavior:'instant'});return 'scrolled';})()"));committedFrame();page.await(new Check("scoped committed heading visible without horizontal overflow",new Script("(()=>{const e=document.querySelector("+q(heading)+"),r=e.getBoundingClientRect();return e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());Log.i("SavedValuationFrameScope",scope);new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,name)).retain();
    }

    private void tap(String selector)throws Exception {
        page.await(new Check("requested native control is present enabled and visible before scrolling",new Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("Saved valuation reassessment native control "+selector,geometry);
    }
    private void committedFrame()throws Exception {
        long deadline=SystemClock.uptimeMillis()+10000;CompletableFuture<Void> committed=new CompletableFuture<>();Handler main=new Handler(Looper.getMainLooper());AtomicReference<ViewTreeObserver> observer=new AtomicReference<>();AtomicReference<Runnable> callback=new AtomicReference<>();
        try{scenario.onActivity(a->{WebView web=a.getBridge().getWebView();assertTrue(web.isAttachedToWindow()&&web.isShown()&&web.isHardwareAccelerated());web.postVisualStateCallback(0,new WebView.VisualStateCallback(){@Override public void onComplete(long id){if(committed.isDone()||SystemClock.uptimeMillis()>=deadline)return;Runnable frame=()->main.post(()->{if(SystemClock.uptimeMillis()<deadline)committed.complete(null);});ViewTreeObserver current=web.getViewTreeObserver();observer.set(current);callback.set(frame);current.registerFrameCommitCallback(frame);web.invalidate();}});});long remaining=deadline-SystemClock.uptimeMillis();assertTrue(remaining>0);committed.get(remaining,TimeUnit.MILLISECONDS);}finally{committed.cancel(false);main.post(()->{ViewTreeObserver current=observer.get();Runnable frame=callback.get();if(current!=null&&current.isAlive()&&frame!=null)current.unregisterFrameCommitCallback(frame);});}
    }
    private void selectAllNative() {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "select the complete focused input through its native editor connection"; }
            public void perform(UiController ui, View view) {
                assertTrue("The native editor must own focus", view.hasFocus() && view.hasWindowFocus());
                InputConnection input = view.onCreateInputConnection(new EditorInfo());
                assertNotNull("The focused WebView must supply its native editor", input);
                assertTrue("Native Select all must dispatch", input.performContextMenuAction(android.R.id.selectAll));
                ui.loopMainThreadUntilIdle();
            }
        });
    }
    private void replace(String selector,String value)throws Exception {tap(selector);page.await(new Check("exact assessment owns native focus before IME",new Script("document.activeElement===document.querySelector("+q(selector)+")")).nativeReady());selectAllNative();await("native selection covers the whole original assessment","document.activeElement===document.querySelector("+q(selector)+")&&document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){public Matcher<View> getConstraints(){return isDisplayed();}public String getDescription(){return "replace exact invented reassessment input through native IME";}public void perform(UiController ui,View view){InputConnection input=view.onCreateInputConnection(new EditorInfo());assertNotNull(input);assertTrue(input.commitText(value,1));ui.loopMainThreadUntilIdle();}});await("full Unicode assessment reaches the real controlled input","document.querySelector("+q(selector)+").value==="+q(value));keyboard.closeSoftKeyboard();}
}
