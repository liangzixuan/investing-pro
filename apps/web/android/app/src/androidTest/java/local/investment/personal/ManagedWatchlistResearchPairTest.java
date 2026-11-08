package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static org.junit.Assert.*;
import android.os.Handler;
import android.content.Context;
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

/** Direct Watchlist pair; explicit sources, native input and independent RAM saves. */
@RunWith(AndroidJUnit4.class)
public class ManagedWatchlistResearchPairTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-watchlist-research-pair').textContent)";
    private static final String SAME_JSON = "(function sameJsonValue(a,b){if(Object.is(a,b))return true;if(a===null||b===null||typeof a!==\"object\"||typeof b!==\"object\")return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameJsonValue(v,b[i]));const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameJsonValue(a[k],b[k]));})";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ServedEditorSession imeSession;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sha,origin,stage="startup",paired,leftReading,editingSelector,nativeEditingState;
    private String firstReportHtml,firstReportFilename;
    @Before public void launchInventedDecision()throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sha);assertTrue(sha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.WATCHLIST_RESEARCH_PAIR);assets.prepare();
        imeSession=ServedEditorSession.open();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(a->{assertEquals("local.investment.personal",a.getPackageName());assertNotNull(a.getBridge().getPlugin("App"));assertNull(a.getBridge().getPlugin("InvestmentAuth"));assertFalse(a.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(a.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.getBridge().getWebView().getSettings().getMixedContentMode());keyboard.observe(a);a.getBridge().setServerBasePath(assets.directory().getAbsolutePath());});
        page.awaitStartup(new Check("three independently unloaded resources",new Script("location.href==='https://localhost/'&&"+D+".counts.status===1&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".followups.draft===null&&"+D+".view.view==='watchlist'")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());origin=page.read(new Script("String(performance.timeOrigin)"));
    }
    @Test public void watchlistPairKeepsBothReadingsThroughOwnedBackAndIndependentFreshLoads()throws Exception {
        try {loadAndStartPair();valueAndCapture("left",0,"ZERO");valueAndCapture("right",1,"ONE");inspectPair();saveWatchlistReport(0);authorDecisionAndSave();freshLoad();}catch(Exception|AssertionError failure){diagnose();throw failure;}
    }
    private void loadAndStartPair()throws Exception {
        stage="independent Loads and direct Watchlist pair";
        click("//button[normalize-space(.)='Load saved watchlist']");await("two exact Watchlist members",D+".watchlist.baseVersion===7&&"+D+".watchlist.draft.memberships.map(x=>x.symbol).join('|')==='ZERO|ONE'");
        navigate("Follow-ups");tap("#managed-followups-load");await("unrelated dated check loaded",D+".followups.baseVersion===3&&"+F+".load===1");
        navigate("My Watchlist");tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap("button[aria-label='Annual report for saved ZERO']");open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("three original valuation entries loaded without source requests",D+".valuations.baseVersion===5&&"+D+".valuations.saved.payload.entries.length===3&&"+D+".counts.annual===0&&"+D+".calculationPublications===0");
        pressBack();await("Watchlist return before starting pair",D+".view.view==='watchlist'");
        tap("#managed-watchlist-pair-select-0");tap("#managed-watchlist-pair-select-1");tap("#managed-watchlist-pair-preview");
        await("explicit preview preserves both full identities",D+".review.preview.map(m=>m.listing.listingId).join('|')==='listing-zero|listing-one'&&"+D+".review.reading===null&&"+D+".counts.annual===0");
        tap("#managed-watchlist-pair-start");
        await("start installs only two passive empty sides",D+".review.reading.kind==='watchlist_research_reading'&&"+D+".review.reading.left===null&&"+D+".review.reading.right===null&&"+D+".counts.annual===0&&"+D+".counts.eod===0&&"+D+".counts.filings===0&&"+D+".counts.save===0&&"+D+".counts.resolve===0");
    }
    private void valueAndCapture(String side,int index,String symbol)throws Exception {
        stage="explicit "+symbol+" reading and valuation";
        tap("#managed-watchlist-pair-open-"+side);
        page.await(new Check("exact owned Watchlist visit with no implicit source",new Script("location.search==='?company="+(index==0?"listing-zero":"listing-one")+"&section=annual'&&"+D+".review.activeSide==="+q(side)+"&&"+D+".annual.response===null&&"+D+".counts.annual==="+index)).nativeReady());
        if(index==0){click("//button[normalize-space(.)='Load annual report']");await("one explicit complete Annual response",D+".counts.annual===1&&JSON.stringify("+D+".annual.response)===JSON.stringify("+D+".packets[0])");}
        if(index==1){tap("button[aria-label='Price section for ONE']");await("unsupported Price section makes no provider request",D+".view.research.section==='eod'&&"+D+".counts.eod===0");}
        open(".managed-valuation-workbench:not(.managed-valuation-assumptions)");
        if(index==1){await("saved first editor remains protected until explicit switch",D+".workbench.editable===false&&"+D+".workbench.owner.listing.listingId==='listing-zero'&&JSON.stringify("+D+".review.reading.left)==="+q(leftReading));click("//button[normalize-space(.)='Discard inputs and use ONE']");}
        open(".managed-valuation-assumptions");click("//section[@data-valuation-listing-id='"+(index==0?"listing-zero":"listing-one")+"']/button[normalize-space(.)='Review saved inputs for "+symbol+"']");tap("#managed-valuation-use-inputs");
        replace("input[id$='-exit-baseRevenue']",index==0?"1000.125":"2000.000");
        await("typing alone leaves calculations and saved maps unchanged",D+".workbench.calculation===null&&"+D+".calculationPublications==="+index+"&&"+D+".counts.valuationSave==="+index);
        click("//button[normalize-space(.)='Calculate authored scenarios']");
        await("both complete authored models calculated explicitly",D+".workbench.calculation.dcfResult.scenarios.base.valuePerShareUsd!==undefined&&"+D+".workbench.calculation.exitResult.scenarios.base.valuePerShare!==undefined&&"+D+".calculationPublications==="+(index+1));
        String calculated=page.read(new Script("JSON.stringify("+D+".workbench.calculation)"));
        tap("#managed-watchlist-pair-capture");
        await("passive capture retains exact calculation and available evidence", "(()=>{const c="+D+".review.reading["+q(side)+"],expected="+(index==0?D+".packets[0]":"null")+";return c&&JSON.stringify(c.valuation)==="+q(calculated)+"&&JSON.stringify(c.evidence.annual?.response??null)===JSON.stringify(expected)&&c.evaluatedAt!==null&&(c.evidence.price?.response??null)===null&&JSON.stringify(JSON.parse(c.document.text).sources.annual?.response??null)===JSON.stringify(expected)&&document.activeElement===document.querySelector('#managed-watchlist-pair-capture-heading');})()");
        if(index==0)leftReading=page.read(new Script("JSON.stringify("+D+".review.reading.left)"));
        if(index==1)await("uncovered Price and absent Annual remain explicit",D+".review.reading.right.evidence.price.available===false&&("+D+".review.reading.right.evidence.annual?.response??null)===null");
        boundary(index,index+1,0,0);
        open(".managed-valuation-assumptions");tap("#managed-valuation-stage-review");tap("#managed-valuation-stage");tap("#managed-valuation-review");tap("#managed-valuation-save");
        await("independent valuation Save preserves complete other entries",D+".counts.valuationSave==="+(index+1)+"&&"+D+".valuations.baseVersion==="+(6+index)+"&&!"+D+".valuations.dirty&&JSON.stringify("+D+".saved.valuations.payload.entries[2])===JSON.stringify("+D+".data.entries[2])");
        pressBack();await("owned Back retains reading without source requests",D+".view.view==='watchlist'&&"+D+".review.activeSide===null&&"+D+".review.reading["+q(side)+"]!==null&&"+D+".annual.response===null");
        boundary(index+1,index+1,0,0);
        if(index==0)frame(FollowupsReportFrameCapture.Frame.WATCHLIST_RESEARCH_RETURN,"#managed-watchlist-pair-heading","Watchlist pair heading after owned native Back; complete left reading and untouched right side asserted separately.");
    }
    private void inspectPair()throws Exception {
        stage="complete retained pair with one Annual and one uncovered company";paired=page.read(new Script("JSON.stringify("+D+".review.reading)"));
        for(String side:new String[]{"left","right"}) {
            String section="//article[@data-research-reading-side="+q(side)+"]";
            for(String summary:new String[]{"DCF projections and terminal value","DCF sensitivity: 25 base-scenario combinations","Exit multiple calculations and formulas","Exit multiple sensitivity: 25 base-scenario combinations","Complete authored inputs and model methods"})click(section+"//details[summary[normalize-space(.)="+q(summary)+"]]/summary");
            fullResults(side);
            fullPriceContext(side, "left".equals(side) ? "price_not_loaded" : "price_invalid", "left".equals(side) ? "Load raw closing prices explicitly in the Price section to compare this scenario." : "The loaded history does not provide an admitted latest raw USD close for this comparison.");
            click(section+"//details[summary[normalize-space(.)='Complete retained report document (JSON)']]/summary");
            await("whole retained document is readable without clipping", "document.querySelector('#managed-screen-research-document-"+side+"').value==="+D+".review.reading["+q(side)+"].document.text");
        }
        await("original first reading and missing second Annual stay visible", "JSON.stringify("+D+".review.reading.left)==="+q(leftReading)+"&&document.querySelector('[data-research-reading-side=left]').textContent.includes('2025-12-31')&&document.querySelector('[data-research-reading-side=right]').textContent.includes('No Annual response was retained.')&&['left','right'].every((s,i)=>{const c="+D+".review.reading[s],e=document.querySelector('[data-research-reading-side='+s+']');return e.textContent.includes(c.evaluatedAt)&&e.textContent.includes(c.capturedAt)&&e.textContent.includes("+D+".data.watchlist.memberships[i].note);})");
        frame(FollowupsReportFrameCapture.Frame.WATCHLIST_RESEARCH_PAIR,"#managed-watchlist-pair-heading","Two-company Watchlist heading; both full model tables, methods, source availability and complete documents asserted separately.");boundary(2,2,0,0);
    }
    private void authorDecisionAndSave()throws Exception {
        stage="chosen ONE thesis and authored dated check";tap("#managed-watchlist-pair-open-right");
        page.await(new Check("chosen current ONE visit makes no implicit request or Calculate",new Script(D+".review.activeSide==='right'&&!"+D+".annual.checkingSeed&&JSON.stringify("+D+".review.reading)==="+q(paired))).nativeReady());
        replace("#managed-research-note",read(".thesis"));
        click("//details[summary[normalize-space(.)='Write a thesis review for ONE']]/summary");
        replace("#managed-research-note-review-next",read(".question"));
        open(".managed-thesis-followup");replace("#managed-research-note-followup-date",read(".dueOn"));tap("#managed-research-note-followup-create");
        await("exact chosen-company check and thesis remain separately unsaved",D+".watchlistCanonical==="+D+".expectedWatchlistCanonical&&"+D+".followupsCanonical==="+D+".expectedFollowupsCanonical&&"+D+".watchlist.dirty&&"+D+".followups.dirty&&JSON.stringify("+D+".review.reading)==="+q(paired));
        pressBack();await("owned Back retains original readings after authored decision",D+".view.view==='watchlist'&&JSON.stringify("+D+".review.reading)==="+q(paired));boundary(2,2,0,0);
        recaptureChosenReadingAndReport();
        navigate("My Watchlist");open("#managed-unsaved-review");click("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']");
        await("Watchlist alone committed full chosen thesis and unchanged ZERO",D+".watchlist.baseVersion===8&&!"+D+".watchlist.dirty&&"+D+".followups.dirty");boundary(2,2,1,0);
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");replace("#managed-note-0",read(".unsaved"));
        navigate("Follow-ups");tap("#managed-followups-save");await("independent Follow-ups save keeps unrelated check",D+".followups.baseVersion===4&&!"+D+".followups.dirty&&"+D+".watchlist.dirty");boundary(2,2,1,1);
    }
    private void saveWatchlistReport(int previousWrites)throws Exception {
        stage="complete Watchlist report chosen-document save "+(previousWrites+1);
        if(previousWrites==0)WatchlistTestDocuments.clear(context());
        String retained=page.read(new Script("JSON.stringify("+D+".review.reading)"));
        String transport="JSON.parse(document.querySelector('#fixture-watchlist-research-report').textContent)";
        tap("#managed-watchlist-research-report-prepare");
        await("complete explicit Watchlist report captured", "document.querySelector('[data-watchlist-research-payload]')!==null");
        String captured=page.read(new Script("document.querySelector('[data-watchlist-research-payload]').textContent"));
        await("preview preserves both complete readings and exact ordered identities", "(()=>{const p=JSON.parse(document.querySelector('[data-watchlist-research-payload]').textContent),r="+D+".review.reading,same="+SAME_JSON+";return p.kind==='watchlist_company_research'&&p.reading.kind==='watchlist_research_reading'&&same(p.reading.listings,r.members.map(m=>m.listing))&&same(p.reading.left,r.left)&&same(p.reading.right,r.right)&&Object.keys(p.reading).sort().join('|')==='kind|left|listings|right'&&new Date(p.preparedAt).toISOString()===p.preparedAt&&document.activeElement===document.querySelector('#managed-watchlist-research-report-heading');})()");
        click("//details[summary[normalize-space(.)='Preview complete Watchlist research report']]/summary");
        await("preview includes full identities and both capture/evaluation clocks", "(()=>{const report=document.querySelector('[aria-label=\"Complete Watchlist company research report\"]'),p=JSON.parse(report.querySelector('[data-watchlist-research-payload]').textContent);return report.querySelectorAll('[data-research-reading-side]').length===2&&['left','right'].every((s,i)=>{const c=p.reading[s],a=report.querySelector('[data-research-reading-side='+s+']');return a.textContent.includes(c.capturedAt)&&a.textContent.includes(c.evaluatedAt)&&Object.values(p.reading.listings[i]).every(v=>report.textContent.includes(v))&&a.querySelector('textarea').value===c.document.text;})&&report.querySelectorAll('script,img,iframe,form,button,input,select,canvas,object').length===0;})()");
        boundary(2,2,0,0);
        tap("#managed-watchlist-research-report-save");
        WatchlistSystemPicker picker=new WatchlistSystemPicker();picker.awaitOpen(30_000);picker.cancel();
        await("cancelled picker keeps the entire preview and performs no write",transport+".choices==="+(previousWrites*2+1)+"&&"+transport+".writeRequests==="+previousWrites+"&&"+transport+".writes==="+previousWrites+"&&document.querySelector('[data-watchlist-research-payload]').textContent==="+q(captured));
        assertEquals(previousWrites,WatchlistTestDocuments.outputs(context()).length);
        tap("#managed-watchlist-research-report-save");picker.awaitOpen(30_000);picker.saveToInventedRoot();
        await("one additional exact Watchlist report write confirmed",transport+".choices==="+(previousWrites*2+2)+"&&"+transport+".writeRequests==="+(previousWrites+1)+"&&"+transport+".writes==="+(previousWrites+1));
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(previousWrites+1,outputs.length);
        String filename=page.read(new Script(transport+".filename"));
        WatchlistTestDocuments.Output output=null;
        for(WatchlistTestDocuments.Output candidate:outputs)if(candidate.name.equals(filename)){assertNull(output);output=candidate;}
        assertNotNull(output);assertTrue(filename.matches("Investment-watchlist-research-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals("Investment-watchlist-research-"+new JSONObject(captured).getString("preparedAt").replaceAll("[-:.]","")+".html",filename);
        assertEquals("text/html",context().getContentResolver().getType(output.uri));
        byte[] bytes;try(InputStream stream=context().getContentResolver().openInputStream(output.uri)){assertNotNull(stream);bytes=stream.readNBytes(8388609);}
        assertTrue(bytes.length>0&&bytes.length<=8388608);assertEquals(output.size,bytes.length);
        assertEquals(Integer.parseInt(page.read(new Script("String("+transport+".byteLength)"))),bytes.length);
        String html=new String(bytes,StandardCharsets.UTF_8);assertArrayEquals(bytes,html.getBytes(StandardCharsets.UTF_8));
        assertTrue(WatchlistResearchReportHtmlDocumentPolicy.INSTANCE.acceptsText(filename,html));
        String readback=page.read(new Script("JSON.stringify((()=>{const d=new DOMParser().parseFromString("+q(html)+",'text/html');return {payload:d.querySelector('[data-watchlist-research-payload]').textContent,title:d.title,active:d.querySelectorAll('script,img,iframe,form,button,input,select,canvas,object').length,models:d.querySelectorAll('[aria-label=\"Authored valuation results\"]').length,documents:[...d.querySelectorAll('[data-research-reading-side]')].map(a=>a.querySelector('textarea').value),text:d.body.textContent};})())"));
        JSONObject observed=new JSONObject(readback);assertEquals(captured,observed.getString("payload"));assertEquals("Watchlist company research",observed.getString("title"));assertEquals(0,observed.getInt("active"));assertEquals(2,observed.getInt("models"));
        JSONObject reading=new JSONObject(captured).getJSONObject("reading");
        for(int i=0;i<2;i++){
            JSONObject side=reading.getJSONObject(i==0?"left":"right");
            assertEquals(side.getJSONObject("document").getString("text"),observed.getJSONArray("documents").getString(i));
            assertTrue(observed.getString("text").contains(side.getString("capturedAt")));assertTrue(observed.getString("text").contains(side.getString("evaluatedAt")));
        }
        assertTrue(observed.getString("text").contains("No Annual response was retained."));
        assertEquals(previousWrites==0?"price_invalid":"price_not_loaded",reading.getJSONObject("right").getJSONObject("valuationPrice").getString("reason"));
        assertTrue(observed.getString("text").contains(previousWrites==0?"The loaded history does not provide an admitted latest raw USD close for this comparison.":"Load raw closing prices explicitly in the Price section to compare this scenario."));
        if(previousWrites==0){firstReportHtml=html;firstReportFilename=filename;}
        else{
            assertNotEquals(firstReportFilename,filename);assertNotEquals(firstReportHtml,html);
            assertEquals(read(".thesis"),reading.getJSONObject("right").getString("note"));
            boolean preserved=false;for(WatchlistTestDocuments.Output candidate:outputs)if(candidate.name.equals(firstReportFilename)){
                try(InputStream stream=context().getContentResolver().openInputStream(candidate.uri)){assertNotNull(stream);assertArrayEquals(firstReportHtml.getBytes(StandardCharsets.UTF_8),stream.readNBytes(8388609));}preserved=true;
            }assertTrue("The first saved report remains unchanged",preserved);
        }
        await("report actions preserve current retained readings", "JSON.stringify("+D+".review.reading)==="+q(retained));boundary(2,2,0,0);
    }
    private void recaptureChosenReadingAndReport()throws Exception {
        stage="explicit chosen-side recapture before preparing a new report";
        tap("#managed-watchlist-pair-open-right");
        page.await(new Check("chosen return opens without a new request or calculation",new Script(D+".review.activeSide==='right'&&!"+D+".annual.checkingSeed&&JSON.stringify("+D+".review.reading)==="+q(paired))).nativeReady());
        reviewUpdatedReading();
        tap("#managed-watchlist-pair-keep-previous");
        await("Keep previous discards only the proposal and retains both complete readings", D+".review.replacement===null&&JSON.stringify("+D+".review.reading)==="+q(paired)+"&&document.querySelector('#managed-watchlist-pair-replacement')===null&&document.activeElement===document.querySelector('#managed-watchlist-pair-capture-heading')");
        boundary(2,2,0,0);
        reviewUpdatedReading();
        pressBack();
        await("owned Back discards the unaccepted proposal without replacing either side", D+".view.view==='watchlist'&&"+D+".review.replacement===null&&JSON.stringify("+D+".review.reading)==="+q(paired));
        tap("#managed-watchlist-pair-open-right");
        page.await(new Check("reopened company keeps the previous pair without new source work",new Script(D+".review.activeSide==='right'&&!"+D+".annual.checkingSeed&&JSON.stringify("+D+".review.reading)==="+q(paired))).nativeReady());
        reviewUpdatedReading();
        String updated=page.read(new Script("JSON.stringify("+D+".review.replacement.updated)"));
        tap("#managed-watchlist-pair-use-updated");
        await("Use updated installs exactly the reviewed ONE reading and preserves ZERO", D+".review.replacement===null&&JSON.stringify("+D+".review.reading.left)==="+q(leftReading)+"&&JSON.stringify("+D+".review.reading.right)==="+q(updated)+"&&"+D+".review.reading.right.note==="+D+".thesis&&JSON.stringify("+D+".review.reading)!=="+q(paired)+"&&document.activeElement===document.querySelector('#managed-watchlist-pair-capture-heading')");
        pressBack();await("owned Back retains the recaptured chosen reading",D+".view.view==='watchlist'&&"+D+".review.activeSide===null&&"+D+".review.reading.right.note==="+D+".thesis");
        saveWatchlistReport(1);boundary(2,2,0,0);
    }
    private void reviewUpdatedReading()throws Exception {
        tap("#managed-watchlist-pair-capture");
        await("replacement preview preserves both readings and exposes the complete previous and updated ONE capture", "(()=>{const p="+D+".review.replacement,r="+D+".review.reading,same="+SAME_JSON+";return p&&p.side==='right'&&JSON.stringify(r)==="+q(paired)+"&&same(p.previous,r.right)&&p.updated.note==="+D+".thesis&&same(p.updated.selection,p.previous.selection)&&same(p.updated.valuation,p.previous.valuation)&&p.updated.evaluatedAt===p.previous.evaluatedAt&&p.updated.valuationPrice.reason==='price_not_loaded'&&p.previous.valuationPrice.reason==='price_invalid'&&document.activeElement===document.querySelector('#managed-watchlist-pair-capture-heading')&&!document.querySelector('#managed-watchlist-research-report-prepare');})()");
        for(String version:new String[]{"previous","updated"}) {
            String section="//*[@data-watchlist-reading-version="+q(version)+"]";
            click(section+"//details[summary[normalize-space(.)='Complete retained report document (JSON)']]/summary");
            await("full "+version+" document, identity, thesis and independent clocks remain readable", "(()=>{const p="+D+".review.replacement,c=p["+q(version)+"],e=document.querySelector('[data-watchlist-reading-version="+version+"]'),l=c.selection.listing,doc=document.querySelector('#managed-watchlist-pair-"+version+"-document');return doc.value===c.document.text&&[l.symbol,l.securityName,l.shareClassName,l.exchangeMic,c.note,c.capturedAt,c.evaluatedAt].every(v=>e.textContent.includes(v))&&e.textContent.includes('No Annual response was retained.');})()");
        }
        boundary(2,2,0,0);
    }
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    private void freshLoad()throws Exception {
        stage="fresh session exact full saved payloads";tap("#fixture-followups-fresh-session");
        await("fresh session clears captures, live sources and calculations",D+".counts.status===2&&"+D+".watchlist.draft===null&&"+D+".valuations.draft===null&&"+D+".followups.draft===null&&"+D+".review.reading===null&&"+D+".workbench.calculation===null&&"+D+".annual.response===null");
        click("//button[normalize-space(.)='Load saved watchlist']");await("complete Watchlist restored with unsaved alternative edit absent",D+".watchlistCanonical==="+D+".expectedWatchlistCanonical&&!"+D+".watchlist.dirty");
        tap(".managed-watchlist-choices li:first-child .managed-watchlist-choice");tap("button[aria-label='Annual report for saved ZERO']");open(".managed-valuation-assumptions");tap("#managed-valuation-load");
        await("both revised complete input maps and untouched third entry restored",D+".valuations.baseVersion===7&&JSON.stringify("+D+".valuations.saved.payload.entries)===JSON.stringify("+D+".expectedValuations)&&"+D+".workbench.calculation===null");
        pressBack();navigate("Follow-ups");tap("#managed-followups-load");await("complete created check and original unrelated assessment restored",D+".followups.baseVersion===4&&"+D+".followupsCanonical==="+D+".expectedFollowupsCanonical&&!"+D+".followups.dirty");
        boundary(2,0,1,1);await("exact two Loads of each independent resource",D+".counts.load===2&&"+D+".counts.valuationLoad===2&&"+F+".load===2");assertEquals(origin,page.read(new Script("String(performance.timeOrigin)")));
    }
    private void boundary(int valuationSaves,int calculations,int watchSaves,int followSaves)throws Exception {
        await("exact disconnected source, calculation and separate persistence counts", "location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]').content==="+q(sha)+"&&document.querySelector('meta[name=investment-android-test-scenario]').content==='watchlist-research-pair'&&document.querySelector('meta[http-equiv=Content-Security-Policy]').content==="+q(CSP)+"&&"+D+".counts.annual===1&&"+D+".counts.requests.join('|')==='listing-zero'&&"+D+".counts.eod===0&&"+D+".counts.filings===0&&"+D+".counts.rejected===0&&Object.keys("+D+".counts.unexpected).length===0&&"+D+".counts.valuationSave==="+valuationSaves+"&&"+D+".calculationPublications==="+calculations+"&&"+D+".counts.save==="+watchSaves+"&&"+F+".save==="+followSaves+"&&"+F+".commits==="+followSaves+"&&"+F+".failures===0&&"+F+".replays===0");
    }
    private void navigate(String name)throws Exception {click("//nav[@aria-label='Workspace']/button[normalize-space(.)="+q(name)+"]");await("requested route settled",D+".view.view==="+q(name.equals("Follow-ups")?"followups":name.equals("Discover")?"discover":"watchlist"));}
    private void open(String selector)throws Exception {if(!"true".equals(page.read(new Script("String(document.querySelector("+q(selector)+")?.open===true)"))))tap(selector+" > summary");}
    private void click(String xpath)throws Exception {page.click(Element.xpath(xpath));}
    private void await(String why,String expression)throws Exception {page.await(new Check(why,new Script(expression)));}
    private String read(String suffix)throws Exception{return page.read(new Script(D+suffix));}
    private static String q(String value){return JSONObject.quote(value);}
    private void diagnose(){try{Log.e("TwoCompanyResearchReview","stage="+stage+", "+page.read(new Script("JSON.stringify({counts:"+D+".counts,view:"+D+".view.view,side:"+D+".review.activeSide,calculations:"+D+".calculationPublications,active:document.activeElement?.id})")));}catch(Exception|AssertionError failure){Log.e("TwoCompanyResearchReview","Diagnostic unavailable",failure);}}
    @After public void closeInventedDecision()throws Exception {
        Throwable failure=null;
        try{if(imeSession!=null)imeSession.close();}catch(Throwable cleanup){failure=cleanup;}
        try{if(scenario!=null)scenario.close();}catch(Throwable cleanup){if(failure==null)failure=cleanup;else failure.addSuppressed(cleanup);}
        try{if(assets!=null)assets.close();}catch(Throwable cleanup){if(failure==null)failure=cleanup;else failure.addSuppressed(cleanup);}
        if(failure instanceof Error error)throw error;
        if(failure instanceof Exception exception)throw exception;
        if(failure!=null)throw new IllegalStateException("Fixture cleanup failed",failure);
    }
    private void fullResults(String side)throws Exception {
        String root="document.querySelector("+q("[data-research-reading-side='"+side+"'] [aria-label='Captured valuation'] [aria-label='Authored valuation results']")+")";
        await("every scenario, projection, sensitivity and formula value is rendered in order", "(()=>{const e="+root+",c="+D+".review.reading["+q(side)+"].valuation,keys=['conservative','base','expansion'],labels=['Conservative','Base','Expansion'];const rows=label=>[...e.querySelectorAll('table')].find(t=>t.caption.textContent===label);const cells=label=>[...rows(label).tBodies[0].rows].map(r=>[...r.cells].map(x=>x.textContent));const exact=(label,value)=>JSON.stringify(cells(label))===JSON.stringify(value);return exact('Cash flow DCF scenarios',keys.map((n,i)=>{const v=c.dcfResult.scenarios[n];return [labels[i],v.annualCashFlowGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd,v.terminalValuePercentOfEnterpriseValue]}))&&exact('Exit multiple scenarios',keys.map((n,i)=>{const v=c.exitResult.scenarios[n];return [labels[i],v.yearNRevenue,v.yearNEbitda,v.presentEnterpriseValue,v.equityValue,v.valuePerShare]}))&&keys.every((n,i)=>exact(labels[i]+' cash flow projection',c.dcfResult.scenarios[n].projection.map(v=>[String(v.year),v.cashFlowUsd,v.presentValueUsd])))&&exact('DCF sensitivity — value per share in USD/share',c.dcfResult.sensitivity.cells.map(v=>[v.waccPercent,v.terminalGrowthPercent,v.enterpriseValueUsd,v.equityValueUsd,v.valuePerShareUsd]))&&exact('Exit multiple sensitivity — value per share in USD/share',c.exitResult.sensitivity.cells.map(v=>[v.discountRatePercent,v.exitMultiple,v.result.presentEnterpriseValue,v.result.equityValue,v.result.valuePerShare]))&&keys.every(n=>c.exitResult.scenarios[n].formulaTrace.every(v=>e.textContent.includes(v)));})()");

        await("full raw inputs, all scenario/projection rows, complete methods and both25-cell sensitivity grids", "(()=>{const e=document.querySelector("+q("[data-research-reading-side='"+side+"'] [aria-label='Captured valuation'] [aria-label='Authored valuation results']")+"),c="+D+".review.reading["+q(side)+"].valuation,raw=[...e.querySelectorAll('pre')].map(p=>p.textContent);return e.querySelectorAll('table').length===7&&[...e.querySelectorAll('table')].map(t=>t.tBodies[0].rows.length).join('|')==='3|5|5|5|25|3|25'&&[c.dcfDraft,c.exitDraft,c.dcfResult.methodology,c.exitResult.methodology].every(x=>raw.some(v=>{try{return JSON.stringify(JSON.parse(v))===JSON.stringify(x)}catch{return false}}))&&['conservative','base','expansion'].every(n=>e.textContent.includes(c.dcfResult.scenarios[n].valuePerShareUsd)&&e.textContent.includes(c.exitResult.scenarios[n].valuePerShare))&&e.querySelectorAll('details:not([open])').length===0;})()");
    }
    private void fullPriceContext(String side,String expectedReason,String expectedReasonText)throws Exception {
        String root="document.querySelector("+q("[data-research-reading-side='"+side+"'] [aria-label='Dated valuation price comparison']")+")";
        await("all six captured price comparisons preserve current model values and the missing-price reason", "(()=>{const e="+root+",capture="+D+".review.reading["+q(side)+"],p=capture.valuationPrice,c=capture.valuation,same="+SAME_JSON+",labels={conservative:'Conservative',base:'Base',expansion:'Expansion'},reason="+q(expectedReasonText)+",keys=['dcf|conservative','dcf|base','dcf|expansion','exit|conservative','exit|base','exit|expansion'];if(!e||!p||p.reference!==null||p.reason!=="+q(expectedReason)+"||p.rows.length!==6)return false;const tables=e.querySelectorAll('table'),t=tables[0];return tables.length===1&&e.parentElement.querySelectorAll('table').length===8&&t.caption.textContent==='Six authored scenarios and their difference from the dated raw close'&&JSON.stringify([...t.tHead.rows[0].cells].map(x=>x.textContent))===JSON.stringify(['Model','Scenario','Authored value (USD/share)','Difference from dated raw close (%)'])&&JSON.stringify(p.rows.map(r=>r.model+'|'+r.scenario))===JSON.stringify(keys)&&p.rows.every(r=>r.result.status==='unavailable'&&r.result.reason==="+q(expectedReason)+"&&r.modelValuePerShareUsd===(r.model==='dcf'?c.dcfResult.scenarios[r.scenario].valuePerShareUsd:c.exitResult.scenarios[r.scenario].valuePerShare))&&JSON.stringify([...t.tBodies[0].rows].map(r=>[...r.cells].map(x=>x.textContent)))===JSON.stringify(p.rows.map(r=>[r.model==='dcf'?'Cash flow DCF':'Exit multiple',labels[r.scenario],r.modelValuePerShareUsd,'Unavailable. '+reason]))&&e.querySelector('[role=status]').textContent==='Comparison unavailable. '+reason&&same(p.selection,capture.selection)&&same(p.calculation,c);})()");
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
