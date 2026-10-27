package local.investment.personal;

import static androidx.test.espresso.Espresso.pressBack;
import static org.junit.Assert.*;
import android.content.Context;
import android.webkit.WebSettings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
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
    private PortfolioCompositionReportEvidence reportEvidence;
    private String sourceSha;
    private record ReadCounts(int sessions,int prices,int loads,int saves) {}
    private enum CompositionSurface {
        LIVE("portfolio-close-composition"), CAPTURED("portfolio-report-composition");
        final String id;
        CompositionSurface(String id) { this.id=id; }
    }
    private enum WorkspaceView {
        PORTFOLIO("Portfolio","managed-portfolio-heading"), FOLLOWUPS("Follow-ups","managed-followups-heading");
        final String label, heading;
        WorkspaceView(String label,String heading) { this.label=label;this.heading=heading; }
    }
    private enum ReportAction {
        CAPTURE("Capture holdings report"), SAVE("Save report (HTML)"), CLOSE("Close captured report");
        final String label;
        ReportAction(String label) { this.label=label; }
    }


    @Before public void launchInventedComposition() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sourceSha);assertTrue(sourceSha.matches("[a-f0-9]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_COMPOSITION_REVIEW);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);keyboard=new ReportRevisitKeyboard(page,new ReportRevisitTouch(page));
        reportEvidence=new PortfolioCompositionReportEvidence(new PortfolioCompositionReportEvidence.Request(context(),page));
        scenario.onActivity(activity -> {
            keyboard.observe(activity);
            assertHostIdentity(activity);
            assertHostPlugins(activity);
            assertWebviewPolicy(activity);
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("composition startup never implicitly loads independent resources",new Script(D+".status===1 && "+D+".marketsResolve===1 && "+W+".memberships===null && "+F+".entries===null && document.querySelector('#fixture-portfolio-report')!==null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());WatchlistTestDocuments.clear(context());
    }
    private void assertHostIdentity(MainActivity activity) { assertEquals("local.investment.personal",activity.getPackageName()); }
    private void assertHostPlugins(MainActivity activity) {
        assertNull(activity.getBridge().getPlugin("InvestmentAuth"));assertNotNull(activity.getBridge().getPlugin("InvestmentPortfolioReviewReport"));
    }
    private void assertWebviewPolicy(MainActivity activity) {
        assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
        assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
    }
    @Test public void completeDatedCompositionKeepsClassCCheckAndExactWrittenReportThroughBackAndSeparateSave() throws Exception {
        loadAndApprove();
        loadDatedComposition();
        PortfolioCompositionReportEvidence.CapturedReport archive=captureAndWriteCompleteReport();
        JSONObject expected=researchAndCreateClassCCheck();
        backToIndependentPortfolio();
        saveAndFreshLoad(expected);
        reportEvidence.assertWritten(archive);
    }
    private void loadAndApprove() throws Exception {
        view(WorkspaceView.PORTFOLIO);page.click(Element.css("#managed-portfolio-load"));
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
        assertComposition(CompositionSurface.LIVE);
        page.await(new Check("source dates and independent classes remain labelled",new Script("document.querySelector('#portfolio-close-composition')?.textContent.includes('Confirmed 2026-10-02') && document.querySelector('#portfolio-close-composition')?.textContent.includes('Confirmed 2026-10-03')")));
        retainCompositionFrame();boundary(new ReadCounts(1,2,0,0));assertLedger();
    }
    private void assertComposition(CompositionSurface surface) throws Exception {
        String id=surface.id;String selector="#"+id;
        page.await(new Check("complete cash denominator preserves two separate 25percent share classes and50percent authored cash",new Script(
            "(()=>{const s=document.querySelector("+JSONObject.quote(selector)+");if(!s)return false;const value=id=>s.querySelector('[data-listing-id=\"'+id+'\"] [data-composition-value]')?.textContent,share=id=>s.querySelector('[data-listing-id=\"'+id+'\"] [data-composition-share]')?.textContent;return "+
            "s.querySelector('h3')?.textContent==='Composition at this close' && s.querySelectorAll('tr[data-listing-id]').length===2 && value('listing-zero')==='USD 50.00' && share('listing-zero')==='25.00%' && value('listing-zero-c')==='USD 50.00' && share('listing-zero-c')==='25.00%'"+
            " && s.querySelector('[data-composition-cash] [data-composition-value]')?.textContent==='USD 100.00' && s.querySelector('[data-composition-cash] [data-composition-share]')?.textContent==='50.00%' && document.getElementById("+JSONObject.quote(id+"-total")+")?.textContent==='USD 200.00';})()")));
    }
    private void retainCompositionFrame() throws Exception {
        new PortfolioCompositionFrameEvidence(new PortfolioCompositionFrameEvidence.Request(scenario,page)).retain();
    }
    private PortfolioCompositionReportEvidence.CapturedReport captureAndWriteCompleteReport() throws Exception {
        report(ReportAction.CAPTURE);assertComposition(CompositionSurface.CAPTURED);
        PortfolioCompositionReportEvidence.CapturedReport archive=new PortfolioCompositionReportEvidence.CapturedReport(page.read(new Script("document.querySelector("+JSONObject.quote(CAPTURE+" pre")+").textContent")));
        reportEvidence.assertCaptured(archive);report(ReportAction.SAVE);new WatchlistSystemPicker().saveToInventedRoot();
        page.await(new Check("one real chosen HTML write is complete without online resource Save",new Script(FILE+".choices===1 && "+FILE+".writes===1 && document.querySelector("+JSONObject.quote(REPORT+" [role=status]")+")?.textContent==='Portfolio report written to the chosen document.'")));
        reportEvidence.assertWritten(archive);assertLedger();boundary(new ReadCounts(1,2,0,0));report(ReportAction.CLOSE);return archive;
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
        view(WorkspaceView.FOLLOWUPS);assertFollowups(expected,false);page.click(Element.css("#managed-followups-save"));
        page.await(new Check("explicit independent Follow-ups Save alone commits version two",new Script(FS+".save===1 && "+FS+".commits===1 && "+F+".baseVersion===2 && "+F+".dirty===false")));
        assertFollowups(expected,true);assertLedger();boundary(new ReadCounts(1,2,1,1));
        page.click(Element.css("#fixture-holding-followup-fresh-session"));
        page.await(new Check("fresh session starts with no implicit independent Load",new Script(D+".status===2 && "+D+".marketsResolve===2 && "+F+".entries===null && "+W+".memberships===null")));
        view(WorkspaceView.FOLLOWUPS);page.click(Element.css("#managed-followups-load"));
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
    private void view(WorkspaceView destination) throws Exception {String label=destination.label,heading=destination.heading;page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='"+label+"']"));page.await(new Check("visible exact workspace view "+label,new Script("document.querySelector('.managed-navigation [aria-current=page]')?.textContent==="+JSONObject.quote(label)+" && document.getElementById("+JSONObject.quote(heading)+")?.checkVisibility()===true")));}
    private void report(ReportAction action) {String label=action.label;page.click(Element.xpath("//section[contains(@class,'managed-portfolio-review-report')]//button[normalize-space(.)='"+label+"']"));}
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @After public void closeInventedComposition() throws Exception {try{if(scenario!=null){scenario.close();scenario=null;}}finally{WatchlistTestDocuments.clear(context());if(assets!=null)assets.close();}}
}
