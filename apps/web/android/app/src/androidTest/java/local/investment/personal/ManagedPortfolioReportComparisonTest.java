package local.investment.personal;

import static androidx.test.espresso.Espresso.*;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.junit.Assert.*;
import android.content.Context;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Chosen HTML write/read and exact current holding navigation with invented data. */
@RunWith(AndroidJUnit4.class)
public class ManagedPortfolioReportComparisonTest {
    private static final String OBS="JSON.parse(document.querySelector('#fixture-portfolio-report-comparison').textContent)";
    private static final String GLOBAL="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String CLOSE="section[aria-label='Dated Portfolio holdings review']";
    private static final String CURRENT="document.querySelector('#portfolio-report-current-heading')?.nextElementSibling";
    private static final String COMPARISON="document.querySelector('#portfolio-report-comparison-heading')?.parentElement";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private String stage="startup",baselineJson,currentJson,portfolioJson,watchlistJson,observedDate,origin;
    private WatchlistSystemPicker.CapturedReport file;

    @Before public void launchInventedPortfolioComparison() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        String sha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sha);assertTrue(sha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_REPORT_COMPARISON);
        assets.prepare();scenario=ActivityScenario.launch(MainActivity.class);
        page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);
        scenario.onActivity(activity->{
            assertEquals("local.investment.personal",activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentPortfolioReviewReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new ReportRevisitPage.Check("Portfolio starts without implicit prices or Save",new ReportRevisitPage.Script(
            OBS+".view==='portfolio'&&"+OBS+".counts.status===1&&"+OBS+".counts.load===1&&"+OBS+".counts.eod===0&&document.querySelector('#managed-portfolio-load')?.disabled===false")).nativeReady());
        scenario.onActivity(a->a.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(context());observedDate=read(".observedDate");
        origin=page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)"));boundary(0,0,0);
    }

    @Test public void savedPortfolioHtmlComparesCompleteIdentityUnionAndReturnsFromCurrentResearch() throws Exception {
        try { saveBaseline();changeCurrent();chooseAndRead();compareCurrent();researchAndReturn(); }
        catch(AssertionError failure){logFailure(failure);throw failure;}
    }
    private void saveBaseline() throws Exception {
        stage="explicit baseline ledger, identities, closes and chosen HTML save";
        click("#managed-portfolio-load");
        await("complete baseline loads at independent version",OBS+".portfolio.baseVersion===3&&"+OBS+".portfolio.ledger.opening.holdings.length===3&&!"+OBS+".portfolio.dirty");
        click("#fixture-portfolio-comparison-author");
        await("independent raw note stays unsaved",OBS+".watchlist.dirty&&"+OBS+".watchlist.draft.memberships.some(r=>r.listingId==='listing-zero'&&r.note==='Independent unsaved Portfolio comparison note · Café 東京 📈 <script>literal</script>')");
        reviewIdentities(1);openCloses();loadCloses(3);selectObservedDate();click("#portfolio-report-capture");
        await("complete current capture is visible",CURRENT+"?.querySelector('pre')?.textContent.includes('2.000000')");
        baselineJson=page.read(new ReportRevisitPage.Script("("+CURRENT+").querySelector('pre').textContent"));
        JSONObject baseline=new JSONObject(baselineJson),review=baseline.getJSONObject("review");
        assertEquals("100.00",review.getString("cashUsd"));assertEquals("120.50",review.getString("holdingsValueUsd"));assertEquals("220.50",review.getString("totalValueUsd"));
        assertEquals("2.000000",baseline.getJSONObject("ledger").getJSONObject("opening").getJSONArray("holdings").getJSONObject(0).getString("shares"));
        assertEquals(observedDate,baseline.getString("selectedDate"));Instant.parse(baseline.getString("preparedAt"));
        page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-portfolio-review-report')]//button[normalize-space(.)='Save report (HTML)']"));
        WatchlistSystemPicker picker=new WatchlistSystemPicker();picker.awaitOpen(30_000);picker.saveToInventedRoot();
        await("one native writer completes the whole HTML document",OBS+".file.choices===1&&"+OBS+".file.writes===1&&"+OBS+".file.byteLength>0");
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(1,outputs.length);
        WatchlistTestDocuments.Output output=outputs[0];assertEquals(read(".file.filename"),output.name);
        assertEquals("text/html",context().getContentResolver().getType(output.uri));
        byte[] bytes;
        try(InputStream input=context().getContentResolver().openInputStream(output.uri)){assertNotNull(input);bytes=input.readNBytes(InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES+1);}
        assertTrue(bytes.length>0&&bytes.length<=InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES);
        assertEquals(output.size,bytes.length);assertEquals(Integer.parseInt(page.read(new ReportRevisitPage.Script("String("+OBS+".file.byteLength)"))),bytes.length);
        String html=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        assertTrue(PortfolioReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name,html));assertFalse(html.contains("<script>"));
        assertTrue("Every ledger value, source packet and original clock survives native delivery",html.contains(escape(baselineJson)));
        assertTrue(html.contains("Invented Zero &lt;script&gt;literal&lt;/script&gt; &amp; Café 東京"));
        assertTrue(html.contains("investment.portfolio-review-html"));assertTrue(html.contains("script-src 'none'"));
        file=new WatchlistSystemPicker.CapturedReport(context(),output.name,bytes);boundary(1,1,3);
    }
    private void changeCurrent() throws Exception {
        stage="author changed current ledger before choosing the saved file";
        click("#fixture-portfolio-comparison-change");
        await("zero cash and raw amounts remain at the loaded Save base",OBS+".counts.current&&"+OBS+".portfolio.baseVersion===3&&"+OBS+".portfolio.dirty&&"+OBS+".portfolio.ledger.opening.cashUsd==='0.00'&&"+OBS+".portfolio.ledger.opening.holdings[0].shares==='3.500000'&&document.querySelector('#portfolio-report-saved-heading')===null");
        reviewIdentities(2);openCloses();portfolioJson=readJson(".portfolio.ledger");watchlistJson=readJson(".watchlist.draft");boundary(1,2,3);
    }
    private void chooseAndRead() throws Exception {
        stage="normal HTML chooser and separate local Read";
        fileChooser();new WatchlistSystemPicker().openCapturedInventedPortfolioReportDocument(file);
        await("choosing stores only the file before explicit Read", "document.querySelector('#portfolio-report-read')?.disabled===false&&document.querySelector('#portfolio-report-saved-heading')===null&&document.querySelector('#portfolio-report-compare')?.disabled===true");
        boundary(1,2,3);unchangedDrafts();click("#portfolio-report-read");
        await("Read focuses a complete unverified private record", "document.activeElement===document.querySelector('#portfolio-report-saved-heading')&&document.querySelector('#portfolio-report-saved-heading')?.parentElement.textContent.includes('unverified')&&document.querySelector('#portfolio-report-saved-heading').parentElement.querySelector('script')===null");
        String admitted=page.read(new ReportRevisitPage.Script("document.querySelector('#portfolio-report-saved-heading').parentElement.querySelector('pre').textContent"));
        PortfolioReportComparisonExpectations.assertWholeJson(new JSONObject(baselineJson),new JSONObject(admitted));boundary(1,2,3);unchangedDrafts();
    }
    private void compareCurrent() throws Exception {
        stage="separate current source load, capture and complete comparison";
        loadCloses(5);selectObservedDate();click("#portfolio-report-capture");
        await("saved and current reports coexist before Compare",CURRENT+"!==null&&document.querySelector('#portfolio-report-saved-heading')!==null&&document.querySelector('#portfolio-report-compare')?.disabled===false");
        currentJson=page.read(new ReportRevisitPage.Script("("+CURRENT+").querySelector('pre').textContent"));
        JSONObject current=new JSONObject(currentJson),review=current.getJSONObject("review");
        assertEquals("0.00",review.getString("cashUsd"));assertTrue(review.isNull("totalValueUsd"));assertEquals("151.75",review.getString("pricedHoldingsSubtotalUsd"));
        PortfolioReportComparisonExpectations.assertWholeJson(new JSONObject(portfolioJson),current.getJSONObject("ledger"));
        click("#portfolio-report-compare");
        await("comparison owns focus and the whole exact identity union", "document.activeElement===document.querySelector('#portfolio-report-comparison-heading')&&[...document.querySelectorAll('[data-portfolio-comparison-row]')].map(e=>e.dataset.portfolioComparisonRow+'|'+e.dataset.comparisonStatus).join(';')==='listing-zero|both;listing-zero-c|both;listing-past|saved-only;listing-new|current-only'");
        wholeComparison();click("#fixture-portfolio-comparison-observe");
        page.await(new ReportRevisitPage.Check("narrow comparison wraps identities and retains usable controls",new ReportRevisitPage.Script(
            "(()=>{const h=document.querySelector('#portfolio-report-comparison-heading'),a=h.parentElement,w=document.documentElement.clientWidth;h.scrollIntoView({block:'start',behavior:'instant'});return w===412&&document.documentElement.scrollWidth<=w+1&&a.querySelector('script')===null&&[...a.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44)&&a.textContent.includes('do not measure investment returns');})()")).nativeReady());
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.PORTFOLIO_REPORT_COMPARISON)).retain();boundary(1,2,5);unchangedDrafts();
    }
    private void wholeComparison() throws Exception {
        await("full raw amounts, dates, classes, absent sides and missing total remain distinct", "(()=>{const a="+COMPARISON+",rs=[...a.querySelectorAll('[data-portfolio-comparison-row]')];return ['100.00 / 220.50','0.00 / Unavailable','45.35%'].every(t=>a.textContent.includes(t))&&['20.25','25.5','89.25','2026-10-02','2026-10-05'].every(t=>rs[0].textContent.includes(t))&&['Class C','1.25','62.50'].every(t=>rs[1].textContent.includes(t))&&rs[2].textContent.includes('Current holding: absent from this report.')&&rs[3].textContent.includes('Saved holding: absent from this report.')&&rs[3].textContent.includes('Unavailable')&&document.querySelector('#portfolio-report-research-listing-past')===null&&['listing-zero','listing-zero-c','listing-new'].every(id=>document.querySelector('#portfolio-report-research-'+id)?.disabled===false);})()");
        JSONObject saved=new JSONObject(baselineJson),current=new JSONObject(currentJson);
        for(String id:new String[]{"listing-zero","listing-zero-c","listing-past","listing-new"})for(String side:new String[]{"Saved","Current"}){
            JSONObject report=side.equals("Saved")?saved:current,source=PortfolioReportComparisonExpectations.sourceRow(report,id);
            if(source==null)continue;
            String selector="[data-portfolio-comparison-row=\""+id+"\"] section[aria-label=\""+side+" holding\"]";
            JSONObject actual=new JSONObject(page.read(new ReportRevisitPage.Script("document.querySelector("+q(selector)+").querySelector('pre').textContent")));
            PortfolioReportComparisonExpectations.assertWholeJson(source,actual.getJSONObject("source"));
            PortfolioReportComparisonExpectations.assertWholeJson(PortfolioReportComparisonExpectations.compositionRow(report,id),actual.getJSONObject("composition"));
            JSONObject identity=source.getJSONObject("holding").getJSONObject("identity");
            await("every complete "+side+" identity value remains readable for "+id,"Object.values("+identity+").every(v=>document.querySelector("+q(selector)+").textContent.includes(v))");
        }
    }
    private void researchAndReturn() throws Exception {
        stage="exact current Research and settled native Back";click("#portfolio-report-research-listing-zero");
        page.await(new ReportRevisitPage.Check("exact current holding has a settled price route and enabled Back",new ReportRevisitPage.Script(
            "(()=>{const b=document.querySelector('.managed-company-visit > .trial-toolbar button'),u=new URL(location.href);return u.searchParams.get('company')==='listing-zero'&&u.searchParams.get('section')==='price'&&"+OBS+".research?.selection.origin==='portfolio'&&"+OBS+".research.selection.listing.listingId==='listing-zero'&&"+OBS+".research.selection.listing.shareClassId==='class-zero'&&b?.disabled===false&&b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&"+OBS+".eod.running===false;})()")).nativeReady());
        unchangedDrafts();boundary(1,2,5);closeSoftKeyboard();InstrumentationRegistry.getInstrumentation().waitForIdleSync();pressBack();
        page.await(new ReportRevisitPage.Check("one Back returns Portfolio, withdrawing route-bound captures",new ReportRevisitPage.Script(
            "document.querySelector('.managed-company-visit')===null&&"+OBS+".view==='portfolio'&&document.querySelector('.managed-portfolio-close-review')?.open===false&&document.querySelector('#portfolio-report-comparison-heading')===null&&"+OBS+".sameDraft&&"+OBS+".sameSaved&&"+OBS+".sameBase&&"+OBS+".sameWatchlist")).nativeReady());
        unchangedDrafts();boundary(1,2,5);assertEquals(origin,page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)")));
    }
    private void reviewIdentities(int expected) throws Exception {
        click("#managed-portfolio-review-identities");await("exact identity review is ready without Save",OBS+".counts.resolve==="+expected+"&&[...document.querySelectorAll('.managed-portfolio button')].some(b=>b.textContent==='Apply reviewed identities'&&!b.disabled)");
        page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-portfolio')]//button[normalize-space(.)='Apply reviewed identities']"));
        await("identity approval settles the real current ledger","document.querySelector('.managed-portfolio [role=status]')?.textContent.includes('Portfolio identities reviewed')");
    }
    private void openCloses() throws Exception {
        if(!"true".equals(page.read(new ReportRevisitPage.Script("String(document.querySelector('.managed-portfolio-close-review')?.open===true)"))))click(".managed-portfolio-close-review > summary");
        await("actual disclosure has an enabled source action","document.querySelector('.managed-portfolio-close-review')?.open===true&&document.querySelector("+q(CLOSE+" .ledger-actions button:first-child")+")?.disabled===false");
    }
    private void loadCloses(int expected) throws Exception {
        click(CLOSE+" .ledger-actions button:first-child");await("explicit close queue completes exactly",OBS+".counts.eod==="+expected+"&&document.querySelector('#managed-portfolio-close-date')?.disabled===false&&[...document.querySelector('#managed-portfolio-close-date').options].some(o=>o.value==="+q(observedDate)+")");
    }
    private void selectObservedDate() throws Exception {
        scenario.onActivity(a->assertTrue(a.getBridge().getWebView().requestFocus()));
        assertEquals("managed-portfolio-close-date",page.read(new ReportRevisitPage.Script("(()=>{const s=document.querySelector('#managed-portfolio-close-date');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return s.id;})()")));
        page.await(new ReportRevisitPage.Check("native choice owns the enabled visible observed-date select",new ReportRevisitPage.Script("document.activeElement===document.querySelector('#managed-portfolio-close-date')&&!document.activeElement.disabled&&document.activeElement.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4));AtomicReference<View> dialog=new AtomicReference<>();
        onView(withText(observedDate)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((v,e)->{if(e!=null)throw e;dialog.set(v.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());page.await(new ReportRevisitPage.Check("native observed-date dialog selection commits",new ReportRevisitPage.Script("document.querySelector('#managed-portfolio-close-date').value==="+q(observedDate)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));
    }
    private void fileChooser() throws Exception {
        page.await(new ReportRevisitPage.Check("normal HTML input and its exact label are enabled and visible",new ReportRevisitPage.Script("(()=>{const i=document.querySelector('#portfolio-report-file');return i&&i.type==='file'&&!i.disabled&&i.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&i.labels.length===1&&i.accept==='text/html,.html';})()")).nativeReady());
        String geometry=page.raw(new ReportRevisitPage.Script("(()=>{const i=document.querySelector('#portfolio-report-file'),l=i.closest('label');l.scrollIntoView({block:'center',behavior:'instant'});const t=[...l.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()==='Choose a saved Portfolio report (HTML)');if(!t)return null;const range=document.createRange();range.selectNodeContents(t);const r=range.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:l.contains(document.elementFromPoint(x,y))};})()"));
        touch.observedGeometry("exact saved Portfolio HTML file label",geometry);
    }
    private void click(String selector) throws Exception {
        page.await(new ReportRevisitPage.Check("current enabled visible control "+selector,new ReportRevisitPage.Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        touch.input(new ReportRevisitTouch.ControlledField(selector,"Portfolio comparison control"));
    }
    private void boundary(int loaded,int resolves,int eod) throws Exception {
        await("strict source and personal-write budget",OBS+".counts.portfolioLoad==="+loaded+"&&"+OBS+".counts.resolve==="+resolves+"&&"+OBS+".counts.eod==="+eod+"&&"+OBS+".counts.rejected===0&&Object.keys("+OBS+".counts.unexpected).length===0&&"+GLOBAL+".save===0&&"+GLOBAL+".annual===0&&"+GLOBAL+".filings===0&&"+GLOBAL+".token===0&&"+GLOBAL+".signOut===0");
    }
    private void unchangedDrafts() throws Exception {
        PortfolioReportComparisonExpectations.assertWholeJson(new JSONObject(portfolioJson),new JSONObject(readJson(".portfolio.ledger")));
        PortfolioReportComparisonExpectations.assertWholeJson(new JSONObject(watchlistJson),new JSONObject(readJson(".watchlist.draft")));
        await("raw draft and loaded Save base remain separate",OBS+".portfolio.baseVersion===3&&"+OBS+".portfolio.dirty&&"+OBS+".watchlist.dirty&&"+OBS+".file.choices===1&&"+OBS+".file.writes===1");
    }
    private void logFailure(AssertionError failure) {
        try { Log.e("ManagedPortfolioComparison","stage="+stage+", observation="+page.raw(new ReportRevisitPage.Script("JSON.stringify({url:location.href,active:document.activeElement?.id,back:(()=>{const bs=[...document.querySelectorAll('.managed-company-visit > .trial-toolbar button')],b=bs[0];return {count:bs.length,disabled:b?.disabled,visible:b?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),label:b?.textContent};})(),research:"+OBS+".research,eodRunning:"+OBS+".eod.running,counts:(()=>{const {requests,...counts}="+OBS+".counts;return counts;})(),view:"+OBS+".view,base:"+OBS+".portfolio.baseVersion,dirty:"+OBS+".portfolio.dirty,rows:document.querySelectorAll('[data-portfolio-comparison-row]').length,closeOpen:document.querySelector('.managed-portfolio-close-review')?.open,readDisabled:document.querySelector('#portfolio-report-read')?.disabled,compareDisabled:document.querySelector('#portfolio-report-compare')?.disabled,sameDraft:"+OBS+".sameDraft,sameSaved:"+OBS+".sameSaved,sameWatchlist:"+OBS+".sameWatchlist})"))); }
        catch(Exception|AssertionError diagnostic){Log.e("ManagedPortfolioComparison","stage="+stage+", diagnostic unavailable",diagnostic);}
        Log.e("ManagedPortfolioComparison","Original journey assertion",failure);
    }
    private void await(String description,String expression) throws Exception {page.await(new ReportRevisitPage.Check(description,new ReportRevisitPage.Script(expression)));}
    private String read(String suffix) throws Exception {return page.read(new ReportRevisitPage.Script(OBS+suffix));}
    private String readJson(String suffix) throws Exception {return page.read(new ReportRevisitPage.Script("JSON.stringify("+OBS+suffix+")"));}
    private static String q(String s){return JSONObject.quote(s);}
    private static String escape(String s){return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");}
    private static Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @After public void closeInventedPortfolioComparison() throws Exception {try{if(scenario!=null)scenario.close();}finally{WatchlistTestDocuments.clear(context());if(assets!=null)assets.close();}}
}
