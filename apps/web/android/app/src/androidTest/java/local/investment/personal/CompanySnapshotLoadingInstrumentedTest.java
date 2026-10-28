package local.investment.personal;

import static androidx.test.espresso.Espresso.pressBack;
import static org.junit.Assert.*;

import android.webkit.WebSettings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.Rule;
import org.junit.rules.TestName;

/** Invented source packets and explicit fixture-authored note; real workspace, source models and Back. */
@RunWith(AndroidJUnit4.class)
public class CompanySnapshotLoadingInstrumentedTest {
    @Rule public TestName testName = new TestName();
    private static final String REVIEWED_JOURNEY = "reviewedCompanySourcesKeepDatedEvidenceThroughInterimCellsReportBackAndSeparateSave";
    private static final String PASS = "JSON.parse(document.querySelector('#fixture-company-pass-evidence').textContent)";
    private static final String COUNTS = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String EVIDENCE = "JSON.parse(document.querySelector('#fixture-company-snapshot-evidence').textContent)";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String LOAD = "section[aria-label='Load company snapshot']";
    private static final String SNAPSHOT = ".managed-company-snapshot";
    private static final String NOTE = "Snapshot research remains an authored draft";
    private record CapturedDraft(String payload, String encodedPayload, String timeOrigin) {}
    private record LoadedSources(String price, String annual) {}
    private enum Action {
        LOAD("Load missing company sources"), CANCEL("Cancel company source load");
        final ReportRevisitPage.Element target;
        Action(String label) { target = ReportRevisitPage.Element.xpath("//section[@aria-label='Load company snapshot']//button[normalize-space(.)='" + label + "']"); }
    }
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;

    @Before public void launchInventedSnapshotLoading() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        boolean reviewed = REVIEWED_JOURNEY.equals(testName.getMethodName());
        assets = new ReportRevisitFixtureAssets(reviewed ? ReportRevisitFixtureAssets.Scenario.REVIEWED_COMPANY_SOURCE_PASS : ReportRevisitFixtureAssets.Scenario.COMPANY_SNAPSHOT_LOADING);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        scenario.onActivity(activity -> {
            verifyDisconnectedIdentity(activity);
            verifyWebViewGuards(activity);
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        if (reviewed) page.awaitStartup(new ReportRevisitPage.Check("reviewed company pass starts in the disconnected fixture with no source read", new ReportRevisitPage.Script("document.querySelector('#fixture-company-pass-evidence')!==null&&document.querySelector('#fixture-interim-report-metadata')!==null&&document.querySelector('#managed-note-0')?.disabled===false&&" + COUNTS + ".load===1&&" + COUNTS + ".status===1&&" + zeroSources() + "&&" + COUNTS + ".interimReport===0&&location.origin==='https://localhost'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content.includes(\"connect-src 'none'\")")).nativeReady());
        else page.awaitStartup(new ReportRevisitPage.Check("source-bound invented scenario starts without source reads", new ReportRevisitPage.Script("document.querySelector('#fixture-company-snapshot-evidence')!==null && " + COUNTS + ".load===1 && " + COUNTS + ".status===1 && document.querySelector('#managed-note-0')?.disabled===false && " + zeroSources())).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
    }
    private void verifyDisconnectedIdentity(MainActivity activity) {
        assertEquals("local.investment.personal", activity.getPackageName());
        assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
    }
    private void verifyWebViewGuards(MainActivity activity) {
        assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
        assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
        assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
    }

    @Test public void explicitSnapshotLoadCancelsLateFilingsAndKeepsDraftThroughBackAndSeparateSave() throws Exception {
        CapturedDraft draft = authorFixtureNoteAndOpenExactCompany();
        page.click(Action.LOAD.target);
        awaitPendingFilings();
        page.click(ReportRevisitPage.Element.css(SNAPSHOT + " > summary"));
        verifyLoadedPriceAndAnnual();
        LoadedSources sources = captureLoadedSources();
        cancelAndSettleLateFilings();
        verifyOriginalEvidence(draft, sources);
        page.click(Action.LOAD.target);
        awaitCompleteSources();
        verifyOriginalEvidence(draft, sources);
        // An explicit third action must skip every existing response without refreshing any source.
        page.click(Action.LOAD.target);
        awaitCompleteSources();
        verifyOriginalEvidence(draft, sources);
        retainNativeFrame();
        returnAndSaveIndependently(draft);
    }

    @Test public void reviewedCompanySourcesKeepDatedEvidenceThroughInterimCellsReportBackAndSeparateSave() throws Exception {
        page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(ReportRevisitPage.Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        page.click(ReportRevisitPage.Element.css("#fixture-company-pass-author-note"));
        InterimStatementsEvidence.DraftCapture draft = InterimStatementsEvidence.capture(page);
        page.click(ReportRevisitPage.Element.css("button[aria-label='Annual report for saved ZERO']"));
        page.await(new ReportRevisitPage.Check("default source choices require explicit preview with Interim unselected", new ReportRevisitPage.Script("document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'&&(()=>{const c=[...document.querySelectorAll('.managed-company-source-pass input[type=checkbox]')];return c.length===4&&c.slice(0,3).every(x=>x.checked)&&!c[3].checked;})()&&" + zeroSources() + "&&" + COUNTS + ".interimReport===0" + "&&(()=>{const b=[...document.querySelectorAll('.managed-company-source-pass button')].find(b=>b.textContent==='Preview company source pass');return b!==undefined&&!b.disabled&&location.pathname==='/'&&location.search==='?company=listing-zero&section=annual'&&location.hash==='';})()")).nativeReady());
        passClick("Preview company source pass");
        passAwait("preview captures exact identity, selected missing order and no source effect", PASS + ".pass.phase==='preview'&&JSON.stringify(" + PASS + ".pass.preview.names)==='[\"eod\",\"annual\",\"filings\"]'&&" + PASS + ".pass.preview.selection.listing.listingId==='listing-zero'&&JSON.stringify(" + PASS + ".pass.rows.map(r=>r.disposition))==='[\"missing\",\"missing\",\"missing\",\"not_attempted\"]'&&" + zeroSources() + "&&" + COUNTS + ".interimReport===0&&" + COUNTS + ".save===0");
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-label='Reviewed company source pass']//label[normalize-space(.)='Interim']/input"));
        passAwait("changing the optional choice retires the old review before Run", PASS + ".pass.preview===null&&[...document.querySelectorAll('.managed-company-source-pass button')].find(b=>b.textContent==='Run reviewed company source pass')?.disabled===true&&" + zeroSources());
        passClick("Preview company source pass");
        passAwait("new explicit preview includes optional Interim without requests", "JSON.stringify(" + PASS + ".pass.preview?.names)==='[\"eod\",\"annual\",\"filings\",\"interim\"]'&&" + PASS + ".pass.rows.every(r=>r.selected&&r.disposition==='missing')&&" + zeroSources());
        passClick("Run reviewed company source pass");
        passAwait("one ordered pass loads Price and owns one pending Annual before Filings or Interim", PASS + ".annualRunning===true&&" + PASS + ".price!==null&&" + PASS + ".annual===null&&" + PASS + ".pass.phase==='running'&&JSON.stringify(" + PASS + ".counts.order)==='[\"eod\",\"annual\"]'&&" + COUNTS + ".filings===0&&" + COUNTS + ".interimReport===0");
        String price = page.read(new ReportRevisitPage.Script("JSON.stringify(" + PASS + ".price)"));
        passClick("Cancel reviewed company source pass");
        passAwait("Cancel aborts only pending Annual and stops all remaining reads", PASS + ".counts.aborted===1&&" + PASS + ".pass.phase==='cancelled'&&JSON.stringify(" + PASS + ".pass.rows.map(r=>r.disposition))==='[\"loaded\",\"cancelled\",\"not_attempted\",\"not_attempted\"]'&&" + COUNTS + ".filings===0&&" + COUNTS + ".interimReport===0&&" + COUNTS + ".save===0");
        page.click(ReportRevisitPage.Element.css("#fixture-company-pass-settle-late"));
        passAwait("late cancelled Annual packet cannot publish or resume the pass", PASS + ".counts.late===1&&" + PASS + ".annual===null&&" + PASS + ".annualRunning===false&&" + COUNTS + ".annual===1&&" + COUNTS + ".filings===0&&" + COUNTS + ".interimReport===0");
        passClick("Preview company source pass");
        passAwait("explicit fresh preview retains Price and original completion time", PASS + ".pass.rows[0].disposition==='retained'&&" + PASS + ".pass.rows[0].evidence.completedAt===" + PASS + ".price.completedAt&&" + PASS + ".pass.rows.slice(1).every(r=>r.disposition==='missing')");
        passClick("Run reviewed company source pass");
        passAwait("fresh pass completes Annual, Filings and Interim sequentially with no Price refresh or Save", PASS + ".pass.phase==='finished'&&JSON.stringify(" + PASS + ".counts.order)==='[\"eod\",\"annual\",\"annual\",\"filings\",\"interimReport\"]'&&" + reviewedCounts(0, 1) + "&&JSON.stringify(" + PASS + ".price)===" + JSONObject.quote(price) + "&&" + PASS + ".pass.rows.every(r=>r.evidence.completedAt!==null)");
        String packets = page.read(new ReportRevisitPage.Script("JSON.stringify([" + PASS + ".price," + PASS + ".annual," + PASS + ".filings," + PASS + ".interim])"));
        passClick("Preview company source pass");
        passAwait("complete retained preview declares zero missing reads", PASS + ".pass.rows.every(r=>r.disposition==='retained')&&document.querySelector('.managed-company-source-pass')?.textContent.includes('No missing reads')");
        passClick("Run reviewed company source pass");
        passAwait("all retained packets keep their original bytes and source clocks", PASS + ".pass.phase==='finished'&&JSON.stringify([" + PASS + ".price," + PASS + ".annual," + PASS + ".filings," + PASS + ".interim])===" + JSONObject.quote(packets) + "&&" + reviewedCounts(0, 1));
        inspectReviewedInterimAndAppend(draft);
        captureReviewedCompanyReport(draft, packets);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        page.await(new ReportRevisitPage.Check("hardware Back restores exact unsaved complete note without source requests", new ReportRevisitPage.Script("document.querySelector('.managed-company-visit')===null&&" + InterimStatementsEvidence.exactDraft(draft, InterimStatementsEvidence.Stage.LOADED).expression() + "&&" + reviewedCounts(0, 1))).nativeReady());
        page.click(ReportRevisitPage.Element.css("#managed-unsaved-review > summary"));
        passAwait("separate whole-draft Review shows the full cited note before Save", "document.querySelector('#managed-unsaved-review')?.textContent.includes(" + JSONObject.quote(draft.completeNote()) + ")&&" + reviewedCounts(0, 1));
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']"));
        passAwait("only explicit Watchlist Save acknowledges version two", InterimStatementsEvidence.exactDraft(draft, InterimStatementsEvidence.Stage.SAVED).expression() + "&&" + reviewedCounts(1, 1));
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']"));
        passAwait("fresh saved read retains complete memberships and cited note", InterimStatementsEvidence.exactDraft(draft, InterimStatementsEvidence.Stage.RELOADED).expression() + "&&" + reviewedCounts(1, 2));
        assertEquals("The same native document survives the complete reviewed source journey", draft.origin(), page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)")));
    }
    private void passClick(String label) throws Exception {
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-label='Reviewed company source pass']//button[normalize-space(.)='" + label + "']"));
    }
    private void passAwait(String label, String expression) throws Exception {
        page.await(new ReportRevisitPage.Check(label, new ReportRevisitPage.Script(expression)));
    }
    private String reviewedCounts(int saves, int loads) {
        return "(()=>{const d=" + COUNTS + ";return d.eod===1&&d.annual===2&&d.filings===1&&d.interimReport===1&&d.save===" + saves + "&&d.load===" + loads + "&&d.status===1&&['token','signOut','search','resolve','marketsEod','calendar','fed','interimPortfolioLoad','interimPortfolioSave','interimFollowupsLoad','interimFollowupsSave'].every(k=>d[k]===0);})()";
    }
    private void inspectReviewedInterimAndAppend(InterimStatementsEvidence.DraftCapture draft) throws Exception {
        page.click(ReportRevisitPage.Element.css(".managed-company-snapshot > summary"));
        passAwait("loaded snapshot keeps the original independent Price and Annual clocks", "document.querySelector('[aria-label=\"Snapshot price\"]')?.textContent.includes('101.5')&&document.querySelector('[aria-label=\"Snapshot revenue basis Revenues\"]')?.textContent.includes('1000')&&document.querySelector('.managed-company-snapshot')?.textContent.includes('2026-09-20T00:00:02.000Z')");
        page.click(ReportRevisitPage.Element.css(".managed-company-sections button[aria-label='Interim section for ZERO']"));
        page.await(new ReportRevisitPage.Check("reported income retains both same-end windows", InterimStatementsEvidence.income()));
        page.await(new ReportRevisitPage.Check("Interim retains original report and independent source clocks", InterimStatementsEvidence.originalClocks()));
        page.click(ReportRevisitPage.Element.css(InterimStatementsEvidence.Cell.REVENUE_QUARTER.selector() + " input[type=checkbox]"));
        page.click(ReportRevisitPage.Element.css("#interim-view-cash"));
        page.await(new ReportRevisitPage.Check("cash retains its exact six-month duration", InterimStatementsEvidence.cell(InterimStatementsEvidence.Cell.OPERATING_CASH)));
        page.click(ReportRevisitPage.Element.css(InterimStatementsEvidence.Cell.OPERATING_CASH.selector() + " input[type=checkbox]"));
        page.click(ReportRevisitPage.Element.css("#interim-view-balance"));
        page.await(new ReportRevisitPage.Check("Assets retains its instant balance date", InterimStatementsEvidence.cell(InterimStatementsEvidence.Cell.ASSETS)));
        page.click(ReportRevisitPage.Element.css(InterimStatementsEvidence.Cell.ASSETS.selector() + " input[type=checkbox]"));
        page.click(ReportRevisitPage.Element.css(".managed-interim-note > summary"));
        page.click(ReportRevisitPage.Element.css("#interim-note-preview"));
        page.await(new ReportRevisitPage.Check("complete proposed note contains the three exact cited cells", InterimStatementsEvidence.completePreview(draft)));
        page.click(ReportRevisitPage.Element.css("#interim-note-append"));
        passAwait("explicit Append changes only the chosen note without saving or loading", InterimStatementsEvidence.exactDraft(draft, InterimStatementsEvidence.Stage.LOADED).expression() + "&&" + reviewedCounts(0, 1));
    }
    private void captureReviewedCompanyReport(InterimStatementsEvidence.DraftCapture draft, String packets) throws Exception {
        page.click(ReportRevisitPage.Element.css(".managed-company-report > summary"));
        page.click(ReportRevisitPage.Element.xpath("//details[contains(@class,'managed-company-report')]/div/button[normalize-space(.)='Prepare research report']"));
        passAwait("explicit report preparation captures the complete authored note", "document.querySelector('#managed-prepared-report-heading')?.textContent==='Research report · ZERO'&&document.querySelector('.managed-company-report-note')?.textContent===" + JSONObject.quote(draft.completeNote()));
        page.click(ReportRevisitPage.Element.css(".managed-report-document > summary"));
        passAwait("one read-only schema-six report retains all four exact packets and independent dates", "(()=>{const f=document.querySelector('#managed-report-document');if(!f?.readOnly)return false;const d=JSON.parse(f.value);return d.schemaVersion==='6.0.0'&&d.authoredResearch.note===" + JSONObject.quote(draft.completeNote()) + "&&JSON.stringify([d.sources.price.response,d.sources.annual.response,d.sources.filings.response,d.sources.interim.response])===" + JSONObject.quote(packets) + "&&d.sources.interim.statements.statements.length===3&&f.value.includes('2026-08-01T12:00:03.000Z')&&f.value.includes('2026-09-20T00:00:02.000Z')&&" + reviewedCounts(0, 1) + ";})()");
        page.await(InterimStatementsEvidence.readyBack());
    }


    private CapturedDraft authorFixtureNoteAndOpenExactCompany() throws Exception {
        page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        String before = page.read(new ReportRevisitPage.Script("JSON.stringify(" + EVIDENCE + ".draft)"));
        page.click(ReportRevisitPage.Element.css("#fixture-snapshot-author-note"));
        page.await(new ReportRevisitPage.Check("explicit fixture setup authors only the first note without a source or Save", new ReportRevisitPage.Script(EVIDENCE + ".draft.memberships[0].note===" + JSONObject.quote(NOTE) + " && " + zeroSources() + " && " + COUNTS + ".save===0")));
        String authored = page.read(new ReportRevisitPage.Script("JSON.stringify(" + EVIDENCE + ".draft)"));
        JSONObject expected = new JSONObject(before);
        expected.getJSONArray("memberships").getJSONObject(0).put("note", NOTE);
        assertEquals("Fixture setup retains every identity, other note and member order", expected.toString(), new JSONObject(authored).toString());
        CapturedDraft draft = new CapturedDraft(authored, page.read(new ReportRevisitPage.Script(EVIDENCE + ".encodedDraft")), page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)")));
        page.await(new ReportRevisitPage.Check("real Watchlist navigation exposes the enabled Annual target without loading sources or saving", new ReportRevisitPage.Script("(() => {const p=document.querySelector('section[aria-labelledby=\"managed-watchlist-heading\"]'),b=document.querySelector('button[aria-label=\"Annual report for saved ZERO\"]');return p?.hidden===false && b?.disabled===false && b.getClientRects().length===1 && " + zeroSources() + " && " + COUNTS + ".save===0;})()")).nativeReady());
        page.click(ReportRevisitPage.Element.css("button[aria-label='Annual report for saved ZERO']"));
        page.await(new ReportRevisitPage.Check("exact company opens in Annual without loading sources", new ReportRevisitPage.Script("document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && new URL(location.href).searchParams.get('company')==='listing-zero' && new URL(location.href).searchParams.get('section')==='annual' && document.querySelector(\"" + LOAD + "\")!==null && " + zeroSources() + " && (() => {const sections=document.querySelectorAll(\"section[aria-label='Load company snapshot']\");if(sections.length!==1)return false;const buttons=[...sections[0].querySelectorAll('button')].filter(button=>button.textContent.trim()==='Load missing company sources'),target=buttons[0];if(buttons.length!==1||target.disabled||target.checkVisibility()!==true||target.getClientRects().length!==1)return false;const rect=target.getBoundingClientRect();return rect.width>=44&&rect.height>=44;})()")).nativeReady());
        verifyNarrowControls();
        return draft;
    }
    private String zeroSources() { return COUNTS + ".eod===0 && " + COUNTS + ".annual===0 && " + COUNTS + ".filings===0"; }
    private void awaitPendingFilings() throws Exception {
        page.await(new ReportRevisitPage.Check("one explicit action loads Price and Annual then owns one pending Filings read in the same section", new ReportRevisitPage.Script(COUNTS + ".eod===1 && " + COUNTS + ".annual===1 && " + COUNTS + ".filings===1 && " + COUNTS + ".save===0 && " + EVIDENCE + ".filingsRunning===true && " + EVIDENCE + ".filings===null && document.querySelector(\"" + LOAD + "\")?.getAttribute('aria-busy')==='true' && new URL(location.href).searchParams.get('section')==='annual'")));
        verifyNarrowControls();
    }
    private void verifyLoadedPriceAndAnnual() throws Exception {
        page.await(new ReportRevisitPage.Check("snapshot displays exact observed values, separate original clocks and the missing Filings source", new ReportRevisitPage.Script("(() => {const s=document.querySelector('" + SNAPSHOT + "');return s?.open && document.querySelector('[aria-label=\"Snapshot price\"] dl')?.textContent==='Last raw close · USD101.5Trading date2026-09-19' && [...document.querySelectorAll('[aria-label=\"Snapshot revenue basis Revenues\"] dd')].map(e=>e.textContent).join('|')==='1000|100|10%' && ['2026-08-20 to 2026-09-20','2026-09-20T00:00:01.000Z','2026-09-20T00:00:02.000Z','2025-01-01 to 2025-12-31','unadjusted for splits or dividends','No filing metadata loaded'].every(x=>s.textContent.includes(x));})()")));
    }
    private LoadedSources captureLoadedSources() throws Exception {
        return new LoadedSources(page.read(new ReportRevisitPage.Script("JSON.stringify(" + EVIDENCE + ".price)")), page.read(new ReportRevisitPage.Script("JSON.stringify(" + EVIDENCE + ".annual)")));
    }
    private void cancelAndSettleLateFilings() throws Exception {
        page.click(Action.CANCEL.target);
        page.await(new ReportRevisitPage.Check("Cancel aborts only the owned pending Filings request and sends no Save", new ReportRevisitPage.Script(COUNTS + ".filingsAborted===1 && " + EVIDENCE + ".filingsRunning===false && " + EVIDENCE + ".filings===null && " + COUNTS + ".save===0 && document.querySelector(\"" + LOAD + "\")?.getAttribute('aria-busy')==='false'")));
        page.click(ReportRevisitPage.Element.css("#fixture-snapshot-settle-cancelled"));
        page.await(new ReportRevisitPage.Check("late cancelled packet is observed but cannot replace source evidence or continue loading", new ReportRevisitPage.Script(COUNTS + ".filingsLateResolved===1 && " + COUNTS + ".filings===1 && " + EVIDENCE + ".filings===null && " + EVIDENCE + ".filingsRunning===false")));
    }
    private void awaitCompleteSources() throws Exception {
        page.await(new ReportRevisitPage.Check("later explicit load reads only missing Filings and preserves original source metadata", new ReportRevisitPage.Script(COUNTS + ".eod===1 && " + COUNTS + ".annual===1 && " + COUNTS + ".filings===2 && " + COUNTS + ".filingsAborted===1 && " + COUNTS + ".filingsLateResolved===1 && " + EVIDENCE + ".filings?.issuer.status==='available' && " + EVIDENCE + ".filingsRunning===false && document.querySelector(\"" + LOAD + "\")?.getAttribute('aria-busy')==='false' && new URL(location.href).searchParams.get('section')==='annual' && ['26 loaded filings','2026-06-23 to 2026-09-20','2026-09-20T00:00:01.000Z'].every(x=>document.querySelector('[aria-label=\"Snapshot filings\"]')?.textContent.includes(x))")));
    }
    private void verifyOriginalEvidence(CapturedDraft draft, LoadedSources sources) throws Exception {
        page.await(new ReportRevisitPage.Check("complete authored draft and original Price and Annual packets remain unchanged", new ReportRevisitPage.Script("JSON.stringify(" + EVIDENCE + ".draft)===" + JSONObject.quote(draft.payload) + " && JSON.stringify(" + EVIDENCE + ".price)===" + JSONObject.quote(sources.price) + " && JSON.stringify(" + EVIDENCE + ".annual)===" + JSONObject.quote(sources.annual) + " && " + COUNTS + ".save===0 && " + COUNTS + ".token===0 && " + COUNTS + ".signOut===0")));
    }
    private void verifyNarrowControls() throws Exception {
        page.await(new ReportRevisitPage.Check("labelled loading and Cancel controls fit the 412 CSS pixel native frame with 44 pixel targets", new ReportRevisitPage.Script("(() => {const w=document.documentElement.clientWidth,s=document.querySelector(\"" + LOAD + "\");return w===412 && document.documentElement.scrollWidth<=w+1 && s?.querySelector('h3')?.textContent==='Build the company snapshot' && [...s.querySelectorAll('button')].every(e=>{const r=e.getBoundingClientRect();return r.height>=44 && r.width>=44 && r.left>=0 && r.right<=w+1;});})()")));
    }
    private void retainNativeFrame() throws Exception {
        page.read(new ReportRevisitPage.Script("(() => {document.querySelector(\"" + LOAD + "\").scrollIntoView({block:'start',behavior:'instant'});return 'company snapshot';})()"));
        page.await(new ReportRevisitPage.Check("loaded company controls retain native window focus before committed capture", new ReportRevisitPage.Script("document.querySelector(\"" + LOAD + "\")?.getAttribute('aria-busy')==='false'")).nativeReady());
        new PortfolioReportFrameCapture(new PortfolioReportFrameCapture.Request(scenario, PortfolioReportFrameCapture.Frame.COMPANY_SNAPSHOT_LOADED)).retain();
    }
    private void returnAndSaveIndependently(CapturedDraft draft) throws Exception {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        page.await(new ReportRevisitPage.Check("native Back returns to the complete authored Watchlist draft without source refresh or Save", new ReportRevisitPage.Script("document.querySelector('.managed-company-visit')===null && document.querySelector('#managed-note-0')?.value===" + JSONObject.quote(NOTE) + " && JSON.stringify(" + EVIDENCE + ".draft)===" + JSONObject.quote(draft.payload) + " && " + COUNTS + ".save===0 && " + DRAFT + ".dirty===true")).nativeReady());
        page.click(ReportRevisitPage.Element.css("#managed-note-0-reading-toggle"));
        page.await(new ReportRevisitPage.Check("independent whole-note review shows the exact fixture-authored note before Save", new ReportRevisitPage.Script("document.querySelector('#managed-note-0-reading-text')?.textContent===" + JSONObject.quote(NOTE) + " && " + COUNTS + ".save===0")));
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']"));
        page.await(new ReportRevisitPage.Check("only explicit full-list Save acknowledges version2 with source counts unchanged", new ReportRevisitPage.Script(DRAFT + ".baseVersion===2 && " + DRAFT + ".dirty===false && " + EVIDENCE + ".encodedDraft===" + JSONObject.quote(draft.encodedPayload) + " && " + COUNTS + ".save===1 && " + COUNTS + ".eod===1 && " + COUNTS + ".annual===1 && " + COUNTS + ".filings===2 && " + COUNTS + ".token===0 && " + COUNTS + ".signOut===0")));
        assertEquals("Source coordination and Back retain the mounted native document", draft.timeOrigin, page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)")));
    }
    @After public void closeInventedSnapshotLoading() {
        try { if (scenario != null) { scenario.close(); scenario = null; } }
        finally { if (assets != null) assets.close(); }
    }
}
