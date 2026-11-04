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


/** Invented Portfolio saved-input evaluation, complete passive return and independent resource saves. */
@RunWith(AndroidJUnit4.class)
public class ManagedPortfolioSavedScenarioTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-portfolio-saved-scenario').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ServedEditorSession imeSession;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,stage="startup",paired,price,closeDate,expectedPortfolio,expectedValuations,expectedFollowups,editedInputs;
    private String editingSelector,nativeEditingState;

    @Before public void launchSavedScenarios()throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_SAVED_SCENARIO);assets.prepare();
        imeSession=ServedEditorSession.open();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        page.awaitStartup(new Check("saved scenario fixture starts independently unloaded",new Script(D+".counts.status===1&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".portfolio.draft===null&&"+D+".view.view==='portfolio'")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));
    }
    @Test public void holdingsSavedScenariosKeepChosenClosesThroughResearchBackAndSeparateResourceSaves()throws Exception {
        try { previewAndEvaluate(); investigateAndReturn(); saveSeparately(); freshLoad(); }
        catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void previewAndEvaluate()throws Exception {
        stage="explicit Portfolio, closes and confirmed inputs";
        tap("#managed-portfolio-load");tap("#managed-portfolio-review-identities");
        click("//section[contains(@class,'managed-portfolio')]//button[normalize-space(.)='Apply reviewed identities']");
        open(".managed-portfolio-close-review");click("//button[normalize-space(.)='Load holding closes']");
        await("both supported holdings load once; unsupported holding remains outside Watchlist",D+".counts.eod===2&&"+D+".counts.load===0&&"+D+".original.portfolio.payload.identities.length===3&&"+D+".original.watchlist.payload.memberships.length===2&&document.querySelector('#managed-portfolio-close-date')?.disabled===false");
        closeDate=page.read(new Script(D+".closeDate"));choose("#managed-portfolio-close-date",closeDate,closeDate);
        tap("#portfolio-saved-scenario-load");tap("#portfolio-saved-scenario-preview");
        await("exact ordered holdings, full saved maps and unsupported missing-input reason",D+".review.plan.rows.length===3&&"+D+".review.plan.report.selectedDate==="+q(closeDate)+"&&JSON.stringify("+D+".review.plan.rows.slice(0,2).map(r=>r.entry))===JSON.stringify("+D+".original.valuations.payload.entries)&&"+D+".review.plan.rows[2].reason==='missing_saved_inputs'&&"+D+".review.plan.rows[2].price.reason==='price_unsupported'&&"+D+".calculations===0&&"+D+".evaluations===0");
        tap("#portfolio-saved-scenario-evaluate");
        await("one explicit evaluation keeps all six outcomes and the chosen older close",D+".evaluations===1&&"+D+".calculations===0&&"+D+".review.reading.rows.slice(0,2).every(r=>r.comparison.rows.length===6)&&"+D+".review.reading.rows[0].calculation.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&"+D+".review.reading.rows[0].comparison.reference.rawCloseUsd==='120.5'&&"+D+".review.reading.rows[0].comparison.rows[1].result.differencePercent==='16.18'&&"+D+".review.reading.rows[1].calculation.exitResult.status==='unavailable'&&"+D+".review.reading.rows[2].calculation===null");
        paired=page.read(new Script("JSON.stringify("+D+".review.reading)"));price=page.read(new Script("JSON.stringify("+D+".review.plan.report)"));
        inspectCompleteReading();
        frame(FollowupsReportFrameCapture.Frame.PORTFOLIO_SAVED_SCENARIO_RESULTS,"#portfolio-saved-scenario-heading","Portfolio saved-scenario heading after explicit evaluation. All holding identities, complete input maps, model tables, chosen-date comparisons and source packets are asserted separately, not fully visible in this frame.");boundary();
    }
    private void inspectCompleteReading()throws Exception {
        click("//section[@aria-labelledby='portfolio-saved-scenario-heading']//summary[normalize-space(.)='Complete original Portfolio reading']");
        click("//section[@aria-labelledby='portfolio-saved-scenario-heading']//summary[normalize-space(.)='Complete report document and source packets']");
        await("full original report is accessible and passive","(()=>{const e=document.querySelector('.managed-portfolio-valuation-review article[aria-label=\"Captured Portfolio holdings review\"]');return e&&e.querySelectorAll('button,input,select,textarea').length===0&&[...e.querySelectorAll('pre')].some(p=>JSON.stringify(JSON.parse(p.textContent))==="+q(price)+");})()");
        click("//section[@aria-labelledby='portfolio-saved-scenario-heading']//summary[normalize-space(.)='Complete confirmed saved collection and catalog']");
        await("full confirmed collection and catalog retained","(()=>{const e=[...document.querySelectorAll('.managed-portfolio-valuation-review details')].find(e=>e.querySelector('summary')?.textContent==='Complete confirmed saved collection and catalog');return JSON.stringify(JSON.parse(e.querySelector('pre').textContent))===JSON.stringify("+D+".review.plan.collection);})()");
        for(int i=0;i<3;i++){
            String row=".managed-portfolio-valuation-review li[data-portfolio-scenario-listing]:nth-child("+(i+1)+")";
            click("(//li[@data-portfolio-scenario-listing])["+(i+1)+"]//summary[normalize-space(.)='Complete original holding and closing-price evidence']");
            await("complete original holding/source packet and independent clocks","(()=>{const e=document.querySelector("+q(row)+"),r="+D+".review.plan.rows["+i+"],p=[...e.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Complete original holding and closing-price evidence');return JSON.stringify(JSON.parse(p.querySelector('pre').textContent))===JSON.stringify(r.source)&&e.textContent.includes(r.source.holding.shares+' shares, confirmed '+r.source.holding.confirmedOn)&&(!r.price.reference||(r.price.reference.date==="+q(closeDate)+"&&r.price.reference.response.rows.at(-1).date!=="+q(closeDate)+"&&e.textContent.includes(r.price.reference.response.requestStartedAt)&&e.textContent.includes(r.price.reference.response.completedAt)));})()");
            if(i<2)fullResults(row,i);
        }
    }
    private void fullResults(String selector,int index)throws Exception {
        await("every raw authored input and all six exact price outcomes are present","(()=>{const e=document.querySelector("+q(selector)+"),r="+D+".review.reading.rows["+index+"],labels={conservative:'Conservative',base:'Base',expansion:'Expansion'},raw=[...e.querySelectorAll('.managed-valuation-raw')].map(x=>x.textContent),values=o=>Object.values(o).flatMap(v=>typeof v==='object'?values(v):[v===''?'Empty':v]),p=e.querySelector('[aria-label=\"Portfolio scenario price comparison\"] table'),invalid='Complete every input with a valid decimal and keep each value within the model limits.';return JSON.stringify(raw)===JSON.stringify([...values(r.row.entry.dcf.inputs),...values(r.row.entry.exit.inputs)])&&p.tBodies[0].rows.length===6&&JSON.stringify([...p.tBodies[0].rows].map(tr=>[...tr.cells].map(x=>x.textContent)))===JSON.stringify(r.comparison.rows.map(x=>[x.model==='dcf'?'Cash flow DCF':'Exit multiple',labels[x.scenario],x.modelValuePerShareUsd??'Unavailable',x.result.status==='available'?x.result.differencePercent+'%':'Unavailable. '+(x.result.reason==='invalid_input'?invalid:x.result.reason)]));})()");
        await("complete authored model tables and raw maps are retained","(()=>{const e=document.querySelector("+q(selector)+").querySelector('[aria-label=\"Authored valuation results\"]'),c="+D+".review.reading.rows["+index+"].calculation,keys=['conservative','base','expansion'],labels=['Conservative','Base','Expansion'],table=label=>[...e.querySelectorAll('table')].find(t=>t.caption.textContent===label),exact=(label,v)=>JSON.stringify([...table(label).tBodies[0].rows].map(r=>[...r.cells].map(x=>x.textContent)))===JSON.stringify(v),raw=[...e.querySelectorAll('pre')].map(p=>{try{return JSON.parse(p.textContent)}catch{return null}}),has=v=>raw.some(x=>JSON.stringify(x)===JSON.stringify(v));return e.querySelectorAll('table').length===(c.exitResult.status==='available'?7:5)&&has(c.dcfDraft)&&has(c.exitDraft)&&has(c.dcfResult.methodology)&&exact('Cash flow DCF scenarios',keys.map((n,i)=>{const v=c.dcfResult.scenarios[n];return [labels[i],v.annualCashFlowGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd,v.terminalValuePercentOfEnterpriseValue]}))&&keys.every((n,i)=>exact(labels[i]+' cash flow projection',c.dcfResult.scenarios[n].projection.map(v=>[String(v.year),v.cashFlowUsd,v.presentValueUsd])))&&exact('DCF sensitivity — value per share in USD/share',c.dcfResult.sensitivity.cells.map(v=>[v.waccPercent,v.terminalGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd]))&&(c.exitResult.status==='unavailable'?e.textContent.includes('Exit multiple unavailable.'):has(c.exitResult.methodology)&&exact('Exit multiple scenarios',keys.map((n,i)=>{const v=c.exitResult.scenarios[n];return [labels[i],v.yearNRevenue,v.yearNEbitda,v.presentEnterpriseValue,v.equityValue,v.valuePerShare]}))&&exact('Exit multiple sensitivity — value per share in USD/share',c.exitResult.sensitivity.cells.map(v=>[v.discountRatePercent,v.exitMultiple,v.result.presentEnterpriseValue,v.result.equityValue,v.result.valuePerShare]))&&keys.every(n=>c.exitResult.scenarios[n].formulaTrace.every(v=>e.textContent.includes(v))));})()");
    }
    private void investigateAndReturn()throws Exception {
        stage="exact holding Research and authored current check";
        tap("#portfolio-saved-scenario-research-0");
        await("Research preserves exact held listing and CIK without fetching",D+".view.research.selection.listing.symbol==='GOOGL'&&"+D+".view.research.selection.origin==='portfolio'&&"+D+".view.research.selection.cik==='0000000001'&&"+D+".counts.eod===2");
        open(".managed-valuation-assumptions");click("//section[@data-valuation-listing-id='invented-review-filings-googl']/button[normalize-space(.)='Review saved inputs for GOOGL']");tap("#managed-valuation-use-inputs");
        open(".managed-valuation-workbench:not(.managed-valuation-assumptions)");replace("input[id$='-dcf-startingUnleveredCashFlowUsd']","110.00");click("//button[normalize-space(.)='Calculate authored scenarios']");
        await("current calculation only is revised; passive original is byte retained",D+".calculations===1&&"+D+".workbench.calculation.dcfResult.scenarios.base.valuePerShareUsd==='155.00'&&JSON.stringify("+D+".review.reading)==="+q(paired));
        editedInputs=page.read(new Script("JSON.stringify(["+D+".workbench.dcfDraft,"+D+".workbench.exitDraft])"));
        open("#managed-holding-followup > details");tap("#holding-followup-load");replace("#holding-followup-question","Review the Class A assumptions against the chosen Portfolio close. Café 東京 📈");replace("#holding-followup-due","2026-12-31");tap("#holding-followup-preview");tap("#holding-followup-create");
        await("one holding question is authored without saving other resources",D+".followups.draft.entries.length===2&&"+F+".save===0&&"+D+".counts.portfolioSave===0&&"+D+".counts.valuationSave===0");
        pressBack();await("owned Back restores exact reading without new closes or evaluation",D+".view.research===null&&"+D+".view.view==='portfolio'&&"+D+".review.active&&JSON.stringify("+D+".review.reading)==="+q(paired)+"&&"+D+".evaluations===1&&"+D+".counts.eod===2");assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
        assertEquals(editedInputs,page.read(new Script("JSON.stringify(["+D+".workbench.dcfDraft,"+D+".workbench.exitDraft])")));
        frame(FollowupsReportFrameCapture.Frame.PORTFOLIO_SAVED_SCENARIO_RETURN,"#portfolio-saved-scenario-heading","Returned Portfolio scenario heading with retained original reading after authored current Research check; full payload and source/evaluation counts separately asserted.");
    }
    private void saveSeparately()throws Exception {
        stage="three independent reviewed resource Saves";
        tap("#portfolio-saved-scenario-research-0");open(".managed-valuation-assumptions");tap("#managed-valuation-stage-review");
        await("stage preview retains original passive reading","JSON.stringify("+D+".review.reading)==="+q(paired));
        tap("#managed-valuation-stage");await("stage application remains unsaved and retains original reading","JSON.stringify("+D+".review.reading)==="+q(paired)+"&&"+D+".counts.valuationSave===0");
        tap("#managed-valuation-review");tap("#managed-valuation-save");
        await("valuation Save alone keeps the second complete entry unchanged",D+".counts.valuationSave===1&&"+D+".counts.portfolioSave===0&&"+F+".save===0&&"+D+".saved.valuations.payload.entries[0].dcf.inputs.startingUnleveredCashFlowUsd==='110.00'&&JSON.stringify("+D+".saved.valuations.payload.entries[1])===JSON.stringify("+D+".original.valuations.payload.entries[1])");
        await("confirmed collection Save retires passive baseline but preserves complete current raw drafts",D+".review.reading===null&&JSON.stringify(["+D+".workbench.dcfDraft,"+D+".workbench.exitDraft])==="+q(editedInputs));
        expectedValuations=page.read(new Script("JSON.stringify("+D+".saved.valuations.payload)"));pressBack();
        click("//summary[normalize-space(.)='Edit opening balances']");replace("input[aria-label='Ledger opening cash']","25.00");click("//button[normalize-space(.)='Apply opening changes']");tap("#managed-portfolio-review");tap("#managed-portfolio-save");
        await("Portfolio Save alone changes only authored cash",D+".counts.portfolioSave===1&&"+F+".save===0&&"+D+".saved.portfolio.payload.opening.cashUsd==='25.00'&&JSON.stringify("+D+".saved.portfolio.payload.identities)===JSON.stringify("+D+".original.portfolio.payload.identities)&&JSON.stringify("+D+".saved.portfolio.payload.opening.holdings)===JSON.stringify("+D+".original.portfolio.payload.opening.holdings)");
        expectedPortfolio=page.read(new Script("JSON.stringify("+D+".saved.portfolio.payload)"));navigate("Follow-ups");tap("#managed-followups-save");
        await("third resource Save retains original check and does not save Watchlist",F+".commits===1&&"+D+".saved.followups.payload.entries.length===2&&JSON.stringify("+D+".saved.followups.payload.entries[0])===JSON.stringify("+D+".original.followups.payload.entries[0])&&"+D+".counts.save===0");
        expectedFollowups=page.read(new Script("JSON.stringify("+D+".saved.followups.payload)"));boundary();
    }
    private void freshLoad()throws Exception {
        stage="fresh session, three complete resource Loads";tap("#fixture-followups-fresh-session");
        await("new session clears transient readings and drafts",D+".counts.status===2&&"+D+".review.reading===null&&"+D+".portfolio.draft===null&&"+D+".valuations.draft===null&&"+D+".workbench.calculation===null");
        navigate("Portfolio");tap("#managed-portfolio-load");
        await("complete authored ledger reloads", "JSON.stringify("+D+".portfolio.saved.payload.ledger)==="+q(expectedPortfolio));
        tap("#managed-portfolio-review-identities");click("//section[contains(@class,'managed-portfolio')]//button[normalize-space(.)='Apply reviewed identities']");open(".managed-portfolio-close-review");tap("#portfolio-saved-scenario-load");
        await("complete valuation collection reloads without evaluation or close reads","JSON.stringify("+D+".valuations.saved.payload)==="+q(expectedValuations)+"&&"+D+".review.plan===null&&"+D+".workbench.calculation===null&&"+D+".counts.eod===2");
        navigate("Follow-ups");tap("#managed-followups-load");await("complete Follow-ups payload reloads unchanged","JSON.stringify("+D+".followups.saved.payload)==="+q(expectedFollowups));boundary();
    }
    private void boundary()throws Exception {await("disconnected source and independent resource boundary","location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]').content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]').content==='portfolio-saved-scenario'&&document.querySelector('meta[http-equiv=Content-Security-Policy]').content==="+q(CSP)+"&&"+D+".counts.eod===2&&"+D+".counts.load===0&&"+D+".counts.save===0&&"+D+".counts.unexpected===0");}
    private void open(String selector)throws Exception {if(!"true".equals(page.read(new Script("String(document.querySelector("+q(selector)+")?.open===true)"))))tap(selector+" > summary");}
    private void choose(String selector,String label,String value)throws Exception {tap(selector);AtomicReference<View> dialog=new AtomicReference<>();onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());assertNotNull(dialog.get());page.await(new Check("native option chooses exact value",new Script("document.querySelector("+q(selector)+").value==="+q(value)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));keyboard.closeSoftKeyboard();}
    private void click(String xpath)throws Exception {page.click(Element.xpath(xpath));}
    private void navigate(String name)throws Exception {click("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]");await("requested route settled",D+".view.view==="+q(name.equals("Follow-ups")?"followups":"portfolio"));}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private static String q(String value){return JSONObject.quote(value);}
    private void diagnose(){try{diagnoseEditing("failure");Log.e("PortfolioSavedScenario","stage="+stage+", "+page.raw(new Script("JSON.stringify({url:location.href,active:document.activeElement?.id,data:"+D+"})")));}catch(Exception|AssertionError failure){Log.e("PortfolioSavedScenario","Diagnostic unavailable",failure);}}
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
        page.read(new Script("(()=>{document.querySelector("+q(heading)+").scrollIntoView({block:'start',behavior:'instant'});return 'scrolled';})()"));committedFrame();page.await(new Check("scoped committed heading visible without horizontal overflow",new Script("(()=>{const e=document.querySelector("+q(heading)+"),r=e.getBoundingClientRect();return e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());Log.i("PortfolioSavedScenarioFrameScope",scope);new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,name)).retain();
    }

    private void tap(String selector)throws Exception {
        page.await(new Check("requested native control is present enabled and visible before scrolling",new Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        page.read(new Script("(()=>{const e=document.querySelector("+q(selector)+");if(!e||e.disabled||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))throw new Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});return 'scrolled';})()"));committedFrame();
        page.await(new Check("one exact enabled visible self-hit target after committed scroll",new Script("(()=>{const e=document.querySelector("+q(selector)+"),r=e?.getBoundingClientRect(),v=visualViewport;return e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        String geometry=page.read(new Script("JSON.stringify((()=>{const e=document.querySelector("+q(selector)+"),r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(x,y))};})())"));touch.observedGeometry("Portfolio saved-scenario review native control "+selector,geometry);
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
        Log.i("PortfolioSavedScenarioEditing", "phase="+phase+", "+observed+", nativeBeforeSelection="+nativeEditingState+", nativeNow="+nativeNow.get());
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
