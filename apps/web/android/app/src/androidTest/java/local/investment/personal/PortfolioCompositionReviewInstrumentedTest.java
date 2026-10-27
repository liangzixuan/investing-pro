package local.investment.personal;

import static androidx.test.espresso.Espresso.pressBack;
import static org.junit.Assert.*;
import android.content.Context;
import android.webkit.WebSettings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** Complete exact-class composition, native chosen report and independently saved authored check. */
@RunWith(AndroidJUnit4.class)
public class PortfolioCompositionReviewInstrumentedTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String P="JSON.parse(document.querySelector('#fixture-portfolio-draft').textContent)";
    private static final String PS="JSON.parse(document.querySelector('#fixture-portfolio-state').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String FS="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String W="JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String FILE="JSON.parse(document.querySelector('#fixture-portfolio-report').textContent)";
    private static final String CLOSE="section[aria-label='Dated Portfolio holdings review']";
    private static final String REPORT=".managed-portfolio-review-report";
    private static final String CAPTURE="article[aria-label='Captured Portfolio holdings review']";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private record ReadCounts(int sessions,int prices,int loads,int saves) {}

    @Before public void launchInventedComposition() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sourceSha);assertTrue(sourceSha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_COMPOSITION_REVIEW);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);keyboard=new ReportRevisitKeyboard(page,new ReportRevisitTouch(page));
        scenario.onActivity(activity -> {
            keyboard.observe(activity);assertEquals("local.investment.personal",activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));assertNotNull(activity.getBridge().getPlugin("InvestmentPortfolioReviewReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("composition startup never implicitly loads independent resources",new Script(D+".status===1 && "+D+".marketsResolve===1 && "+W+".memberships===null && "+F+".entries===null && document.querySelector('#fixture-portfolio-report')!==null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());WatchlistTestDocuments.clear(context());
    }
    @Test public void completeDatedCompositionKeepsClassCCheckAndExactWrittenReportThroughBackAndSeparateSave() throws Exception {
        loadAndApprove();
        loadDatedComposition();
        String archive=captureAndWriteCompleteReport();
        JSONObject expected=researchAndCreateClassCCheck();
        backToIndependentPortfolio();
        saveAndFreshLoad(expected);
        assertWrittenReportRemains(archive);
    }
    private void loadAndApprove() throws Exception {
        view("Portfolio","managed-portfolio-heading");page.click(Element.css("#managed-portfolio-load"));
        page.await(new Check("two complete exact-class authored positions load in original order",new Script(P+".baseVersion===1 && "+P+".projection?.status==='valid'")));
        assertLedger();
        page.click(Element.css("#managed-portfolio-review-identities"));
        page.await(new Check("complete original catalog review offers explicit approval",new Script("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Apply reviewed identities'&&!b.disabled)")));
        page.click(Element.xpath("//button[normalize-space(.)='Apply reviewed identities']"));
        page.await(new Check("catalog approval retains both share classes without any Save",new Script(D+".resolve===1 && "+P+".pendingEditor===false && "+P+".projection.portfolio.holdings.length===2")));
        assertLedger();boundary(new ReadCounts(1,0,0,0));
    }
    private void loadDatedComposition() throws Exception {
        page.click(Element.css(".managed-portfolio-close-review > summary"));
        page.await(new Check("opening review invents neither a date nor available weights",new Script(D+".eod===0 && !document.querySelector('#portfolio-close-composition')?.textContent.includes('25.00%') && !document.querySelector('#portfolio-close-composition')?.textContent.includes('50.00%')")));
        page.click(Element.css(CLOSE+" .ledger-actions button:first-child"));
        assertComposition("portfolio-close-composition");
        page.await(new Check("source dates and independent classes remain labelled",new Script("document.querySelector('#portfolio-close-composition')?.textContent.includes('Confirmed 2026-10-02') && document.querySelector('#portfolio-close-composition')?.textContent.includes('Confirmed 2026-10-03')")));
        retainCompositionFrame();boundary(new ReadCounts(1,2,0,0));assertLedger();
    }
    private void assertComposition(String id) throws Exception {
        String selector="#"+id;
        page.await(new Check("complete cash denominator preserves two separate 25percent share classes and50percent authored cash",new Script(
            "(()=>{const s=document.querySelector("+JSONObject.quote(selector)+");if(!s)return false;const value=id=>s.querySelector('[data-listing-id=\"'+id+'\"] [data-composition-value]')?.textContent,share=id=>s.querySelector('[data-listing-id=\"'+id+'\"] [data-composition-share]')?.textContent;return "+
            "s.querySelector('h3')?.textContent==='Composition at this close' && s.querySelectorAll('tr[data-listing-id]').length===2 && value('listing-zero')==='USD 50.00' && share('listing-zero')==='25.00%' && value('listing-zero-c')==='USD 50.00' && share('listing-zero-c')==='25.00%'"+
            " && s.querySelector('[data-composition-cash] [data-composition-value]')?.textContent==='USD 100.00' && s.querySelector('[data-composition-cash] [data-composition-share]')?.textContent==='50.00%' && document.getElementById("+JSONObject.quote(id+"-total")+")?.textContent==='USD 200.00';})()")));
    }
    private void retainCompositionFrame() throws Exception {
        page.read(new Script("(()=>{const s=document.querySelector('#portfolio-close-composition'),a=s.querySelector('h3').getBoundingClientRect(),b=s.querySelector('.portfolio-composition-table').getBoundingClientRect(),v=visualViewport;window.scrollBy({top:a.top-Math.max(0,(v.height-(b.bottom-a.top))/2),behavior:'instant'});return 'positioned';})()"));
        page.await(new Check("complete composition heading, dates, denominator and every value/percentage fit the native frame",new Script(
            "(()=>{const s=document.querySelector('#portfolio-close-composition'),v=visualViewport,r=s.getBoundingClientRect(),a=s.querySelector('h3').getBoundingClientRect(),b=s.querySelector('.portfolio-composition-table').getBoundingClientRect(),w=document.documentElement.clientWidth;return w===412 && document.documentElement.scrollWidth<=w+1 && s.checkVisibility() && [r.left,r.right,r.top,r.bottom,v.width,v.height].every(Number.isFinite) && r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width && a.top>=v.offsetTop && b.bottom<=v.offsetTop+v.height && s.querySelector('[role=region]')?.tabIndex===0 && [...s.querySelectorAll('[data-composition-value],[data-composition-share],th[scope=col]')].every(e=>{const b=e.getBoundingClientRect();return e.checkVisibility() && b.left>=v.offsetLeft && b.right<=v.offsetLeft+v.width;});})()")).nativeReady());
        new PortfolioReportFrameCapture(new PortfolioReportFrameCapture.Request(scenario,PortfolioReportFrameCapture.Frame.COMPOSITION)).retain();
    }
    private String captureAndWriteCompleteReport() throws Exception {
        report("Capture holdings report");assertComposition("portfolio-report-composition");
        String archive=page.read(new Script("document.querySelector("+JSONObject.quote(CAPTURE+" pre")+").textContent"));
        assertArchive(archive);report("Save report (HTML)");new WatchlistSystemPicker().saveToInventedRoot();
        page.await(new Check("one real chosen HTML write is complete without online resource Save",new Script(FILE+".choices===1 && "+FILE+".writes===1 && document.querySelector("+JSONObject.quote(REPORT+" [role=status]")+")?.textContent==='Portfolio report written to the chosen document.'")));
        assertWrittenReportRemains(archive);assertLedger();boundary(new ReadCounts(1,2,0,0));report("Close captured report");return archive;
    }
    private void assertArchive(String archive) throws Exception {
        page.await(new Check("whole captured ledger and composition equal independent handwritten expectations",new Script(
            "(()=>{"+PortfolioCompositionExpectations.EXACT+"const r="+archive+";return same(r.ledger,"+PortfolioCompositionExpectations.ledger()+") && same(r.review.composition,"+PortfolioCompositionExpectations.composition()+") && r.review.balancesOn==='2026-10-04' && r.review.asOfDate===document.querySelector('#managed-portfolio-close-date').value && r.sourceRows.length===2 && r.sourceRows.every((row,i)=>same(row.response.security,r.ledger.identities[i]));})()")));
        JSONObject report=new JSONObject(archive);assertEquals("portfolio_holdings_review",report.getString("kind"));
        for(int index=0;index<2;index++)assertSource(report,index);
    }
    private void assertSource(JSONObject report,int index) throws Exception {
        JSONObject source=report.getJSONArray("sourceRows").getJSONObject(index).getJSONObject("response");
        assertEquals(index==0?"listing-zero":"listing-zero-c",source.getJSONObject("security").getString("listingId"));
        assertEquals(index==0?"class-zero":"class-zero-c",source.getJSONObject("security").getString("shareClassId"));
        assertEquals("Tiingo",source.getString("provider"));assertEquals("raw_close",source.getString("priceBasis"));assertEquals("USD",source.getString("currency"));
        assertEquals(2,source.getJSONArray("rows").length());assertEquals(index==0?"20":"40",source.getJSONArray("rows").getJSONObject(0).getString("close"));
        assertEquals(index==0?"25":"50",source.getJSONArray("rows").getJSONObject(1).getString("close"));
        assertEquals(report.getJSONObject("review").getString("asOfDate"),source.getJSONArray("rows").getJSONObject(1).getString("date"));
        assertNotEquals(report.getString("preparedAt"),source.getString("requestStartedAt"));assertNotEquals(report.getString("preparedAt"),source.getString("completedAt"));
        assertTrue(source.getString("requestStartedAt").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z"));
    }
    private void assertWrittenReportRemains(String archive) throws Exception {
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(1,outputs.length);var output=outputs[0];
        assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY,output.uri.getAuthority());assertEquals(page.read(new Script(FILE+".filename")),output.name);assertTrue(output.name.matches("Investment-portfolio-review-[0-9]{8}T[0-9]{9}Z\\.html"));
        byte[] raw;
        try(InputStream input=context().getContentResolver().openInputStream(output.uri)){assertNotNull(input);raw=input.readNBytes(InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES+1);}
        assertTrue(raw.length>0);assertTrue(raw.length<=InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES);assertEquals(output.size,raw.length);assertEquals(Integer.parseInt(page.read(new Script("String("+FILE+".byteLength)"))),raw.length);
        String html=new String(raw,StandardCharsets.UTF_8);assertTrue(PortfolioReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name,html));
        assertTrue(html.contains("25.00%"));assertTrue(html.contains("50.00%"));assertTrue(html.contains("USD 200.00"));assertFalse(html.contains("<script>"));
        assertTrue("Every original ledger field, complete composition and source clock survives actual readback",html.contains(archive.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")));
    }
    private JSONObject researchAndCreateClassCCheck() throws Exception {
        page.click(Element.xpath("//section[@aria-label='Dated Portfolio holdings review']//button[normalize-space(.)='Research ZERO.C']"));
        page.await(new Check("exact Class C research has current authored position and original confirmation",new Script(
            "location.href==='https://localhost/?company=listing-zero-c&section=price' && document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO.C' && document.querySelector('#holding-followup-shares')?.textContent==='1' && document.querySelector('#holding-followup-basis')?.textContent==='Unavailable' && document.querySelector('#holding-followup-confirmed')?.textContent==='2026-10-03'")));
        page.click(Element.css("#managed-holding-followup > details > summary"));
        keyboard.enter(new ReportRevisitKeyboard.FieldInput(ReportRevisitTouch.Field.HOLDING_QUESTION,PortfolioCompositionExpectations.QUESTION));
        keyboard.enter(new ReportRevisitKeyboard.FieldInput(ReportRevisitTouch.Field.HOLDING_DUE,PortfolioCompositionExpectations.DUE));
        page.click(Element.css("#holding-followup-load"));
        page.await(new Check("explicit initial Follow-ups Load retains whole authored question and due date",new Script(FS+".load===1 && "+F+".entries?.length===1 && document.querySelector('#holding-followup-question')?.value==="+JSONObject.quote(PortfolioCompositionExpectations.QUESTION)+" && document.querySelector('#holding-followup-due')?.value==="+JSONObject.quote(PortfolioCompositionExpectations.DUE))));
        page.click(Element.css("#holding-followup-preview"));
        page.await(new Check("complete preview preserves exact Class C and no persisted composition metadata",new Script("document.querySelector('#holding-followup-check')?.value==="+JSONObject.quote(PortfolioCompositionExpectations.QUESTION)+" && document.querySelector('#holding-followup-check')?.readOnly===true && document.querySelector('#holding-followup-preview-confirmed')?.textContent==='2026-10-03' && document.querySelector('#holding-followup-create')?.disabled===false")));
        page.click(Element.css("#holding-followup-create"));
        page.await(new Check("one Create is consumed before independent draft append",new Script(F+".entries?.length===2 && "+F+".dirty===true && document.querySelector('#holding-followup-create')===null")));
        String id=page.read(new Script(F+".entries[1].id"));assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        JSONObject expected=PortfolioCompositionExpectations.followups(id);assertFollowups(expected,false);assertLedger();boundary(new ReadCounts(1,2,1,0));return expected;
    }
    private void backToIndependentPortfolio() throws Exception {
        keyboard.closeSoftKeyboard();page.await(new Check("one hardware Back has a settled exact-company target",new Script("(()=>{const b=document.querySelector('.managed-company-visit .trial-toolbar > button'),r=b?.getBoundingClientRect();return b?.textContent==='Back to workspace' && b.disabled===false && b.checkVisibility() && r.width>0 && r.height>0;})()")).nativeReady());
        pressBack();page.await(new Check("hardware Back retains original Portfolio with private capture closed",new Script("location.href==='https://localhost/' && document.querySelector('.managed-company-visit')===null && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Portfolio' && document.querySelector("+JSONObject.quote(CAPTURE)+")===null")));
        assertLedger();boundary(new ReadCounts(1,2,1,0));
    }
    private void saveAndFreshLoad(JSONObject expected) throws Exception {
        view("Follow-ups","managed-followups-heading");assertFollowups(expected,false);page.click(Element.css("#managed-followups-save"));
        page.await(new Check("explicit independent Follow-ups Save alone commits version two",new Script(FS+".save===1 && "+FS+".commits===1 && "+F+".baseVersion===2 && "+F+".dirty===false")));
        assertFollowups(expected,true);assertLedger();boundary(new ReadCounts(1,2,1,1));
        page.click(Element.css("#fixture-holding-followup-fresh-session"));
        page.await(new Check("fresh session starts with no implicit independent Load",new Script(D+".status===2 && "+D+".marketsResolve===2 && "+F+".entries===null && "+W+".memberships===null")));
        view("Follow-ups","managed-followups-heading");page.click(Element.css("#managed-followups-load"));
        page.await(new Check("fresh explicit Load restores original order and exact complete check",new Script(FS+".load===2 && "+F+".baseVersion===2 && "+F+".dirty===false")));assertFollowups(expected,true);boundary(new ReadCounts(2,2,2,1));
    }
    private void assertFollowups(JSONObject expected,boolean saved) throws Exception {
        String savedCheck=saved?" && same(r.saved,{version:2,payload:expected})":" && r.baseVersion===1";
        page.await(new Check("entire resource including original assessment and exact Class C identity matches independent expectation",new Script("(()=>{"+PortfolioCompositionExpectations.EXACT+"const r="+F+",expected="+expected+";return same({schemaVersion:1,entries:r.entries},expected)"+savedCheck+";})()")));
    }
    private void assertLedger() throws Exception {
        page.await(new Check("whole independent authored ledger is unchanged with no Watchlist Load or mutation",new Script("(()=>{"+PortfolioCompositionExpectations.EXACT+"return same("+P+".ledger,"+PortfolioCompositionExpectations.ledger()+") && "+W+".memberships===null && "+PS+".save===0 && "+PS+".commits===0;})()")));
    }
    private void boundary(ReadCounts count) throws Exception {
        page.await(new Check("fixed source/origin/CSP and exact source/read/write budgets remain intact",new Script(
            "location.origin==='https://localhost' && location.hash==='' && window.Capacitor?.getPlatform()==='android' && document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            " && "+D+".status==="+count.sessions+" && "+D+".marketsResolve==="+count.sessions+" && "+D+".resolve===1 && "+D+".eod==="+count.prices+
            " && "+D+".load===0 && "+D+".save===0 && "+D+".portfolioSave===0 && "+D+".annual===0 && "+D+".filings===0 && "+D+".search===0 && "+D+".calendar===0 && "+D+".fed===0 && "+D+".marketsEod===0 && "+D+".token===0 && "+D+".signOut===0"+
            " && "+PS+".load===1 && "+PS+".save===0 && "+PS+".commits===0 && "+FS+".load==="+count.loads+" && "+FS+".save==="+count.saves+" && "+FS+".commits==="+count.saves+" && "+FS+".replays===0 && "+FS+".token===0 && "+FS+".signOut===0")));
    }
    private void view(String label,String heading) throws Exception {page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='"+label+"']"));page.await(new Check("visible exact workspace view "+label,new Script("document.querySelector('.managed-navigation [aria-current=page]')?.textContent==="+JSONObject.quote(label)+" && document.getElementById("+JSONObject.quote(heading)+")?.checkVisibility()===true")));}
    private void report(String label) {page.click(Element.xpath("//section[contains(@class,'managed-portfolio-review-report')]//button[normalize-space(.)='"+label+"']"));}
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @After public void closeInventedComposition() throws Exception {try{if(scenario!=null){scenario.close();scenario=null;}}finally{WatchlistTestDocuments.clear(context());if(assets!=null)assets.close();}}
}
