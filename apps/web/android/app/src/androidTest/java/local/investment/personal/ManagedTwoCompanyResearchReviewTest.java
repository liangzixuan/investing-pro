package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
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
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** One disconnected two-company decision, using native controls and independent RAM saves. */
@RunWith(AndroidJUnit4.class)
public class ManagedTwoCompanyResearchReviewTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-two-company-research-review').textContent)";
    private static final String SAME_JSON = "(function sameJsonValue(a,b){if(Object.is(a,b))return true;if(a===null||b===null||typeof a!==\"object\"||typeof b!==\"object\")return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameJsonValue(v,b[i]));const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameJsonValue(a[k],b[k]));})";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,stage="startup",paired,leftReading,editingSelector,nativeEditingState;
    @Before public void launchInventedDecision()throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.TWO_COMPANY_RESEARCH_REVIEW);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        page.awaitStartup(new Check("three independently unloaded resources",new Script("location.href==='https://localhost/'&&"+D+".counts.status===1&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".followups.draft===null&&"+D+".view.view==='watchlist'")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));
    }
    @Test public void pairedResearchKeepsBothCalculationsThroughOwnedBackAndIndependentFreshLoads()throws Exception {
        try {loadAndScreen();valueAndCapture("left",0,"ZERO");valueAndCapture("right",1,"ONE");inspectPair();authorDecisionAndSave();freshLoad();}catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void loadAndScreen()throws Exception {
        stage="explicit independent loads before screening";
        click("//button[normalize-space(.)='Load saved watchlist']");await("two exact Watchlist members",D+".watchlist.baseVersion===7&&"+D+".watchlist.draft.memberships.map(x=>x.symbol).join('|')==='ZERO|ONE'");
        navigate("Follow-ups");tap("#managed-followups-load");await("original unrelated dated check loaded",D+".followups.baseVersion===3&&"+F+".load===1");
        navigate("My Watchlist");tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap("button[aria-label='Annual report for saved ZERO']");open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("three confirmed full input entries loaded without source or calculation",D+".valuations.baseVersion===5&&"+D+".valuations.saved.payload.entries.length===3&&"+D+".counts.annual===0&&"+D+".calculationPublications===0");
        pressBack();navigate("Discover");
        click("//button[normalize-space(.)='Load screening cohort']");click("//button[normalize-space(.)='Run screen (2 companies)']");
        await("first explicit Annual read",D+".counts.annual===1");
        page.awaitStartup(new Check("paced second source finishes",new Script(D+".counts.annual===2&&!"+D+".screen.pending&&"+D+".screen.run.status==='completed'")).nativeReady());
        click("//button[normalize-space(.)='Compare left ZERO']");click("//button[normalize-space(.)='Compare right ONE']");
        await("original periods remain independent",D+".screen.comparison.left.report.response.evidence.target.reportDate==='2025-12-31'&&"+D+".screen.comparison.right.report.response.evidence.target.reportDate==='2025-06-30'");
        boundary(0,0,0,0);
    }
    private void valueAndCapture(String side,int index,String symbol)throws Exception {
        stage="explicit "+symbol+" valuation and capture";
        if(index==0)click("//div[contains(@class,'managed-screen-table')]//button[normalize-space(.)='Research ZERO']");else tap("#managed-screen-research-open-right");
        page.await(new Check("exact screening visit owns admitted original Annual",new Script("location.search==='?company="+(index==0?"listing-zero":"listing-one")+"&section=annual'&&"+D+".review.activeSide==="+q(side)+"&&!"+D+".annual.checkingSeed&&JSON.stringify("+D+".annual.response)===JSON.stringify("+D+".packets["+index+"])")).nativeReady());
        open(".managed-valuation-workbench:not(.managed-valuation-assumptions)");
        if(index==1){
            await("first editor stays protected until explicit discard",D+".workbench.editable===false&&"+D+".workbench.owner.listing.listingId==='listing-zero'&&JSON.stringify("+D+".saved.valuations.payload.entries[0])===JSON.stringify("+D+".expectedValuations[0])&&JSON.stringify("+D+".review.reading.left)==="+q(leftReading)+"&&[...document.querySelectorAll('button')].find(x=>x.textContent==='Calculate authored scenarios').disabled");
            click("//button[normalize-space(.)='Discard inputs and use ONE']");
        }
        open(".managed-valuation-assumptions");click("//section[@data-valuation-listing-id='"+(index==0?"listing-zero":"listing-one")+"']/button[normalize-space(.)='Review saved inputs for "+symbol+"']");tap("#managed-valuation-use-inputs");
        replace("input[id$='-exit-baseRevenue']",index==0?"1000.125":"2000.000");
        await("typing cannot calculate or change stored maps",D+".workbench.calculation===null&&"+D+".calculationPublications==="+index+"&&"+D+".counts.valuationSave==="+index);
        click("//button[normalize-space(.)='Calculate authored scenarios']");
        await("both full authored models calculated explicitly",D+".workbench.calculation.dcfResult.scenarios.base.valuePerShareUsd!==undefined&&"+D+".workbench.calculation.exitResult.scenarios.base.valuePerShare!==undefined&&"+D+".calculationPublications==="+(index+1));
        String calculated=page.read(new Script("JSON.stringify("+D+".workbench.calculation)"));
        tap("#managed-screen-research-capture");
        await("capture is complete and passive", "(()=>{const c="+D+".review.reading["+q(side)+"];return c&&JSON.stringify(c.valuation)==="+q(calculated)+"&&JSON.stringify(c.evidence.annual.response)===JSON.stringify("+D+".packets["+index+"])&&c.evaluatedAt!==null&&c.capturedAt!==null&&(c.evidence.price?.response??null)===null&&JSON.stringify(JSON.parse(c.document.text).sources.annual.response)===JSON.stringify("+D+".packets["+index+"])&&document.activeElement===document.querySelector('#managed-screen-research-capture-heading');})()");
        if(index==0){leftReading=page.read(new Script("JSON.stringify("+D+".review.reading.left)"));frame(FollowupsReportFrameCapture.Frame.TWO_COMPANY_RESEARCH_CAPTURE,"#managed-screen-research-capture-heading","First explicit company capture heading; complete source and calculation equality asserted separately.");}
        boundary(index,index+1,0,0);
        open(".managed-valuation-assumptions");tap("#managed-valuation-stage-review");tap("#managed-valuation-stage");tap("#managed-valuation-review");tap("#managed-valuation-save");
        await("explicit valuation Save preserves complete other entries",D+".counts.valuationSave==="+(index+1)+"&&"+D+".valuations.baseVersion==="+(6+index)+"&&!"+D+".valuations.dirty&&JSON.stringify("+D+".saved.valuations.payload.entries[2])===JSON.stringify("+D+".data.entries[2])");
        pressBack();await("owned Back retains capture and pair without requests",D+".view.view==='discover'&&"+D+".review.activeSide===null&&"+D+".review.reading["+q(side)+"]!==null&&"+D+".annual.response===null");
        boundary(index+1,index+1,0,0);
    }
    private void inspectPair()throws Exception {
        stage="complete retained pair with different periods";paired=page.read(new Script("JSON.stringify("+D+".review.reading)"));
        for(String side:new String[]{"left","right"}) {
            String section="//article[@data-research-reading-side="+q(side)+"]";
            for(String summary:new String[]{"DCF projections and terminal value","DCF sensitivity: 25 base-scenario combinations","Exit multiple calculations and formulas","Exit multiple sensitivity: 25 base-scenario combinations","Complete authored inputs and model methods"})click(section+"//details[summary[normalize-space(.)="+q(summary)+"]]/summary");
            fullResults(side);
            fullPriceContext(side);
            click(section+"//details[summary[normalize-space(.)='Complete retained report document (JSON)']]/summary");
            await("whole retained document is readable without clipping", "document.querySelector('#managed-screen-research-document-"+side+"').value==="+D+".review.reading["+q(side)+"].document.text");
        }
        await("independent source periods, complete initial notes and original first capture remain", "JSON.stringify("+D+".review.reading.left)==="+q(leftReading)+"&&['left','right'].every((s,i)=>{const c="+D+".review.reading[s],e=document.querySelector('[data-research-reading-side='+s+']');return e.textContent.includes(c.evidence.annual.response.evidence.target.reportDate)&&e.textContent.includes(c.evaluatedAt)&&e.textContent.includes(c.capturedAt)&&e.textContent.includes("+D+".data.watchlist.memberships[i].note);})");
        frame(FollowupsReportFrameCapture.Frame.TWO_COMPANY_RESEARCH_PAIR,"#managed-screen-research-review-heading","Two-company heading and dated reading context; all model tables, methods and complete report documents asserted separately.");boundary(2,2,0,0);
    }
    private void authorDecisionAndSave()throws Exception {
        stage="chosen ONE thesis and authored dated check";tap("#managed-screen-research-open-right");
        page.await(new Check("chosen current ONE visit reuses Annual without Calculate",new Script(D+".review.activeSide==='right'&&!"+D+".annual.checkingSeed&&JSON.stringify("+D+".review.reading)==="+q(paired))).nativeReady());
        replace("#managed-research-note",read(".thesis"));
        click("//details[summary[normalize-space(.)='Write a thesis review for ONE']]/summary");
        replace("#managed-research-note-review-next",read(".question"));
        open(".managed-thesis-followup");replace("#managed-research-note-followup-date",read(".dueOn"));tap("#managed-research-note-followup-create");
        await("exact chosen-company check and thesis remain separately unsaved",D+".watchlistCanonical==="+D+".expectedWatchlistCanonical&&"+D+".followupsCanonical==="+D+".expectedFollowupsCanonical&&"+D+".watchlist.dirty&&"+D+".followups.dirty&&JSON.stringify("+D+".review.reading)==="+q(paired));
        pressBack();await("owned Back retains original readings after authored decision",D+".view.view==='discover'&&JSON.stringify("+D+".review.reading)==="+q(paired));boundary(2,2,0,0);
        navigate("My Watchlist");open("#managed-unsaved-review");click("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']");
        await("Watchlist alone committed full chosen thesis and unchanged ZERO",D+".watchlist.baseVersion===8&&!"+D+".watchlist.dirty&&"+D+".followups.dirty");boundary(2,2,1,0);
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");replace("#managed-note-0",read(".unsaved"));
        navigate("Follow-ups");tap("#managed-followups-save");await("independent Follow-ups save keeps unrelated check",D+".followups.baseVersion===4&&!"+D+".followups.dirty&&"+D+".watchlist.dirty");boundary(2,2,1,1);
    }
    private void freshLoad()throws Exception {
        stage="fresh session exact full saved payloads";tap("#fixture-followups-fresh-session");
        await("fresh session clears captures, live sources and calculations",D+".counts.status===2&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".followups.draft===null&&"+D+".review.reading===null&&"+D+".workbench.calculation===null&&"+D+".annual.response===null");
        click("//button[normalize-space(.)='Load saved watchlist']");await("complete Watchlist restored with unsaved alternative edit absent",D+".watchlistCanonical==="+D+".expectedWatchlistCanonical&&!"+D+".watchlist.dirty");
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap("button[aria-label='Annual report for saved ZERO']");open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("both revised complete input maps and untouched third entry restored",D+".valuations.baseVersion===7&&JSON.stringify("+D+".valuations.saved.payload.entries)===JSON.stringify("+D+".expectedValuations)&&"+D+".workbench.calculation===null");
        pressBack();navigate("Follow-ups");tap("#managed-followups-load");await("complete created check and original unrelated assessment restored",D+".followups.baseVersion===4&&"+D+".followupsCanonical==="+D+".expectedFollowupsCanonical&&!"+D+".followups.dirty");
        frame(FollowupsReportFrameCapture.Frame.TWO_COMPANY_RESEARCH_SAVED,"#managed-followups-heading","Fresh Follow-ups heading; three full separately saved payloads and unsaved-edit exclusion asserted separately.");
        boundary(2,0,1,1);await("exact two Loads of each independent resource",D+".counts.load===2&&"+D+".counts.valuationLoad===2&&"+F+".load===2");assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
    }
    private void boundary(int valuationSaves,int calculations,int watchSaves,int followSaves)throws Exception {
        await("exact disconnected source, calculation and separate persistence counts", "location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]').content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]').content==='two-company-research-review'&&document.querySelector('meta[http-equiv=Content-Security-Policy]').content==="+q(CSP)+"&&"+D+".counts.annual===2&&"+D+".counts.requests.join('|')==='listing-zero|listing-one'&&"+D+".counts.eod===0&&"+D+".counts.filings===0&&"+D+".counts.rejected===0&&Object.keys("+D+".counts.unexpected).length===0&&"+D+".counts.valuationSave==="+valuationSaves+"&&"+D+".calculationPublications==="+calculations+"&&"+D+".counts.save==="+watchSaves+"&&"+F+".save==="+followSaves+"&&"+F+".commits==="+followSaves+"&&"+F+".failures===0&&"+F+".replays===0");
    }
    private void navigate(String name)throws Exception {click("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]");await("requested route settled",D+".view.view==="+q(name.equals("Follow-ups")?"followups":name.equals("Discover")?"discover":"watchlist"));}
    private void open(String selector)throws Exception {if(!"true".equals(page.read(new Script("String(document.querySelector("+q(selector)+")?.open===true)"))))tap(selector+" > summary");}
    private void click(String xpath)throws Exception {page.click(Element.xpath(xpath));}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private String read(String suffix)throws Exception{return page.read(new Script(D+suffix));}
    private static String q(String value){return JSONObject.quote(value);}
    private void diagnose(){try{Log.e("TwoCompanyResearchReview","stage="+stage+", "+page.read(new Script("JSON.stringify({counts:"+D+".counts,view:"+D+".view.view,side:"+D+".review.activeSide,calculations:"+D+".calculationPublications,active:document.activeElement?.id})")));}catch(Exception|AssertionError failure){Log.e("TwoCompanyResearchReview","Diagnostic unavailable",failure);}}
    @After public void closeInventedDecision()throws Exception {try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();}}
    private void fullResults(String side)throws Exception {
        String root="document.querySelector("+q("[data-research-reading-side='"+side+"'] [aria-label='Captured valuation'] [aria-label='Authored valuation results']")+")";
        await("every scenario, projection, sensitivity and formula value is rendered in order", "(()=>{const e="+root+",c="+D+".review.reading["+q(side)+"].valuation,keys=['conservative','base','expansion'],labels=['Conservative','Base','Expansion'];const rows=label=>[...e.querySelectorAll('table')].find(t=>t.caption.textContent===label);const cells=label=>[...rows(label).tBodies[0].rows].map(r=>[...r.cells].map(x=>x.textContent));const exact=(label,value)=>JSON.stringify(cells(label))===JSON.stringify(value);return exact('Cash flow DCF scenarios',keys.map((n,i)=>{const v=c.dcfResult.scenarios[n];return [labels[i],v.annualCashFlowGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd,v.terminalValuePercentOfEnterpriseValue]}))&&exact('Exit multiple scenarios',keys.map((n,i)=>{const v=c.exitResult.scenarios[n];return [labels[i],v.yearNRevenue,v.yearNEbitda,v.presentEnterpriseValue,v.equityValue,v.valuePerShare]}))&&keys.every((n,i)=>exact(labels[i]+' cash flow projection',c.dcfResult.scenarios[n].projection.map(v=>[String(v.year),v.cashFlowUsd,v.presentValueUsd])))&&exact('DCF sensitivity — value per share in USD/share',c.dcfResult.sensitivity.cells.map(v=>[v.waccPercent,v.terminalGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd]))&&exact('Exit multiple sensitivity — value per share in USD/share',c.exitResult.sensitivity.cells.map(v=>[v.discountRatePercent,v.exitMultiple,v.result.presentEnterpriseValue,v.result.equityValue,v.result.valuePerShare]))&&keys.every(n=>c.exitResult.scenarios[n].formulaTrace.every(v=>e.textContent.includes(v)));})()");

        await("full raw inputs, all scenario/projection rows, complete methods and both25-cell sensitivity grids", "(()=>{const e=document.querySelector("+q("[data-research-reading-side='"+side+"'] [aria-label='Captured valuation'] [aria-label='Authored valuation results']")+"),c="+D+".review.reading["+q(side)+"].valuation,raw=[...e.querySelectorAll('pre')].map(p=>p.textContent);return e.querySelectorAll('table').length===7&&[...e.querySelectorAll('table')].map(t=>t.tBodies[0].rows.length).join('|')==='3|5|5|5|25|3|25'&&[c.dcfDraft,c.exitDraft,c.dcfResult.methodology,c.exitResult.methodology].every(x=>raw.some(v=>{try{return JSON.stringify(JSON.parse(v))===JSON.stringify(x)}catch{return false}}))&&['conservative','base','expansion'].every(n=>e.textContent.includes(c.dcfResult.scenarios[n].valuePerShareUsd)&&e.textContent.includes(c.exitResult.scenarios[n].valuePerShare))&&e.querySelectorAll('details:not([open])').length===0;})()");
    }
    private void fullPriceContext(String side)throws Exception {
        String root="document.querySelector("+q("[data-research-reading-side='"+side+"'] [aria-label='Dated valuation price comparison']")+")";
        await("all six captured price comparisons preserve current model values and the missing-price reason", "(()=>{const e="+root+",capture="+D+".review.reading["+q(side)+"],p=capture.valuationPrice,c=capture.valuation,same="+SAME_JSON+",labels={conservative:'Conservative',base:'Base',expansion:'Expansion'},reason='Load raw closing prices explicitly in the Price section to compare this scenario.',keys=['dcf|conservative','dcf|base','dcf|expansion','exit|conservative','exit|base','exit|expansion'];if(!e||!p||p.reference!==null||p.reason!=='price_not_loaded'||p.rows.length!==6)return false;const tables=e.querySelectorAll('table'),t=tables[0];return tables.length===1&&e.parentElement.querySelectorAll('table').length===8&&t.caption.textContent==='Six authored scenarios and their difference from the dated raw close'&&JSON.stringify([...t.tHead.rows[0].cells].map(x=>x.textContent))===JSON.stringify(['Model','Scenario','Authored value (USD/share)','Difference from dated raw close (%)'])&&JSON.stringify(p.rows.map(r=>r.model+'|'+r.scenario))===JSON.stringify(keys)&&p.rows.every(r=>r.result.status==='unavailable'&&r.result.reason==='price_not_loaded'&&r.modelValuePerShareUsd===(r.model==='dcf'?c.dcfResult.scenarios[r.scenario].valuePerShareUsd:c.exitResult.scenarios[r.scenario].valuePerShare))&&JSON.stringify([...t.tBodies[0].rows].map(r=>[...r.cells].map(x=>x.textContent)))===JSON.stringify(p.rows.map(r=>[r.model==='dcf'?'Cash flow DCF':'Exit multiple',labels[r.scenario],r.modelValuePerShareUsd,'Unavailable. '+reason]))&&e.querySelector('[role=status]').textContent==='Comparison unavailable. '+reason&&same(p.selection,capture.selection)&&same(p.calculation,c);})()");
        await("dated-price identity, share-basis limits and complete formula context stay readable", "(()=>{const e="+root+",p="+D+".review.reading["+q(side)+"].valuationPrice,n=s=>s.replace(/\\s+/g,' ').trim(),text=n(e.textContent),l=p.selection.listing;return [l.symbol,l.securityName,l.shareClassName,l.exchangeMic].every(x=>text.includes(x))&&['Model values use your authored diluted share counts, which are not source-verified. The comparison does not reconcile share counts or adjust for splits or dividends. Raw closes are unadjusted historical observations, not current quotes.','Difference = ((displayed authored USD/share ÷ dated raw close USD) − 1) × 100. Each comparison uses the displayed scenario value and the same dated close. These differences are scenario context, not a price target or trading recommendation.'].every(x=>text.includes(n(x)))&&!text.includes('Reference raw close:')&&e.querySelectorAll('details').length===0;})()");
    }
    private void frame(FollowupsReportFrameCapture.Frame name,String heading,String scope)throws Exception{
        committedFrame();
        page.read(new Script("(()=>{document.querySelector("+q(heading)+").scrollIntoView({block:'start',behavior:'instant'});return 'scrolled';})()"));committedFrame();page.await(new Check("scoped committed heading visible without horizontal overflow",new Script("(()=>{const e=document.querySelector("+q(heading)+"),r=e.getBoundingClientRect();return e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());Log.i("TwoCompanyResearchFrameScope",scope);new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,name)).retain();
    }

    private void tap(String selector)throws Exception {
        page.await(new Check("requested native control is present enabled and visible before scrolling",new Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("Two-company research native control "+selector,geometry);
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
        Log.i("TwoCompanyResearchEditing", "phase="+phase+", "+observed+", nativeBeforeSelection="+nativeEditingState+", nativeNow="+nativeNow.get());
    }
    private void replace(String selector,String value)throws Exception {
        editingSelector=selector;nativeEditingState="not yet observed";
        String original=page.read(new Script("document.querySelector("+q(selector)+").value"));
        tap(selector);
        String focused="(()=>{const e=document.querySelector("+q(selector)+");return !!e&&document.activeElement===e&&!e.disabled&&!e.readOnly&&e.value==="+q(original)+";})()";
        page.await(new Check("exact assessment and original value own native focus before IME",new Script(focused)).nativeReady());
        nativeEditingState=keyboard.awaitVisibleEditor(selector);
        page.await(new Check("settled IME retains exact focused field and original value",new Script(focused)).nativeReady());
        // Place the caret after the IME resize using fresh native hit geometry.
        tap(selector);
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
    }
}
