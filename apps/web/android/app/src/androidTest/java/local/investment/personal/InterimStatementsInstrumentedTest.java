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
import local.investment.personal.ReportRevisitPage.Script;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.InterimStatementsEvidence.Cell;
import local.investment.personal.InterimStatementsEvidence.Stage;
import local.investment.personal.InterimStatementsEvidence.DraftCapture;

/** Invented CompanyFacts only; complete notes and passive files use the real native controls. */
@RunWith(AndroidJUnit4.class)
public class InterimStatementsInstrumentedTest {
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private static final String DRAFT = InterimStatementsEvidence.DRAFT;
    private String expectedSourceSha;
    @Before public void launchInterimFixture() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        expectedSourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(expectedSourceSha);
        assertTrue(expectedSourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.INTERIM_STATEMENTS);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        keyboard = new ReportRevisitKeyboard(page, new ReportRevisitTouch(page));
        scenario.onActivity(activity -> {
            keyboard.observe(activity);
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentCompanyReport"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentCompanyReportHtml"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("source-bound interim fixture and editable original note ready", new Script("document.querySelector('#fixture-interim-report-metadata')!==null&&document.querySelector('#managed-note-0')?.disabled===false&&" + InterimStatementsEvidence.counts(Stage.STARTUP).expression())).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(context());
        assertBoundary();
    }
    @Test public void interimReportedPeriodsKeepDistinctWindowsThroughNotesReportsBackAndSave() throws Exception {
        DraftCapture draft = authorAndLoad();
        inspectAndSelectViews();
        previewCancelAndAppend(draft);
        new InterimStatementsReportEvidence(new InterimStatementsReportEvidence.Request(context(), page, draft)).captureWriteAndReopen();
        returnReviewSaveAndReload(draft);
    }
    private DraftCapture authorAndLoad() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        page.await(new Check("the exact first member has a blank editable note", new Script("document.querySelector('#managed-note-0')?.value===''&&" + DRAFT + ".memberships[0].listingId==='listing-zero'")));
        keyboard.enter(new ReportRevisitKeyboard.FieldInput(ReportRevisitTouch.Field.COMPANY_NOTE, InterimStatementsEvidence.PREFIX));
        DraftCapture draft = InterimStatementsEvidence.capture(page);
        page.click(Element.css("button[aria-label='Annual report for saved ZERO']"));
        page.click(Element.css(".managed-company-sections button[aria-label='Interim section for ZERO']"));
        page.await(new Check("opening Interim keeps prefix and requires an explicit source load", new Script("document.querySelector('#interim-report-load')?.disabled===false&&document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(InterimStatementsEvidence.PREFIX) + "&&" + InterimStatementsEvidence.counts(Stage.STARTUP).expression())));
        page.click(Element.css("#interim-report-load"));
        page.await(new Check("one canonical interim load preserves both same-end revenue windows", InterimStatementsEvidence.income()));
        page.await(new Check("original report, filed and separate source clocks stay visible", InterimStatementsEvidence.originalClocks()));
        page.await(new Check("exact one interim request and no other source/save request", InterimStatementsEvidence.counts(Stage.LOADED)));
        return draft;
    }
    private void inspectAndSelectViews() throws Exception {
        new InterimStatementsFrameEvidence(new InterimStatementsFrameEvidence.Request(page, scenario, InterimStatementsFrameEvidence.View.INCOME)).retain();
        choose(Cell.REVENUE_QUARTER);
        page.click(Element.css("#interim-view-cash"));
        page.await(new Check("reported cash retains its six-month window without quarter inference", InterimStatementsEvidence.cell(Cell.OPERATING_CASH)));
        new InterimStatementsFrameEvidence(new InterimStatementsFrameEvidence.Request(page, scenario, InterimStatementsFrameEvidence.View.CASH)).retain();
        choose(Cell.OPERATING_CASH);
        page.click(Element.css("#interim-view-balance"));
        page.await(new Check("Assets remains an instant, not a duration", InterimStatementsEvidence.cell(Cell.ASSETS)));
        new InterimStatementsFrameEvidence(new InterimStatementsFrameEvidence.Request(page, scenario, InterimStatementsFrameEvidence.View.BALANCE)).retain();
        choose(Cell.ASSETS);
        page.await(new Check("three exact selections remain separate from Save", new Script("document.querySelector('.managed-interim-note > summary')?.textContent==='Review selected interim cells (3)'&&" + InterimStatementsEvidence.counts(Stage.LOADED).expression())));
    }
    private void choose(Cell cell) throws Exception {
        page.click(Element.css(cell.selector() + " input[type=checkbox]"));
        page.await(new Check("selected exact concept and full period key " + cell.name(), new Script("document.querySelector(" + JSONObject.quote(cell.selector() + " input[type=checkbox]") + ")?.checked===true")));
    }
    private void previewCancelAndAppend(DraftCapture draft) throws Exception {
        page.click(Element.css(".managed-interim-note > summary"));
        page.click(Element.css("#interim-note-preview"));
        page.await(new Check("complete raw Unicode preview contains all three cited cells", InterimStatementsEvidence.completePreview(draft)));
        page.click(Element.css("#interim-note-cancel"));
        page.await(new Check("Cancel permanently removes the proposal and retains every original membership", new Script("document.querySelector('#managed-interim-note-preview')===null&&document.querySelector('#interim-note-append')===null&&JSON.stringify(" + DRAFT + ".memberships)===" + JSONObject.quote(draft.memberships()))));
        page.click(Element.css("#interim-note-preview"));
        page.await(new Check("a fresh explicit full preview is required after Cancel", InterimStatementsEvidence.completePreview(draft)));
        page.click(Element.css("#interim-note-append"));
        page.await(new Check("single Append changes only the complete selected note and retires preview", new Script(InterimStatementsEvidence.exactDraft(draft, Stage.LOADED).expression() + "&&document.querySelector('#managed-interim-note-preview')===null&&document.querySelector('#interim-note-append')===null")));
        page.click(Element.css("#interim-note-preview"));
        page.await(new Check("duplicate selection refuses another append without altering the raw note", new Script("document.querySelector('#managed-interim-note-preview')===null&&document.querySelector('.managed-interim-note')?.textContent.includes('These exact reported cells are already at the end of the note draft.')&&" + InterimStatementsEvidence.exactDraft(draft, Stage.LOADED).expression())));
        page.await(new Check("preview, cancel and append perform no additional request", InterimStatementsEvidence.counts(Stage.LOADED)));
    }
    private void returnReviewSaveAndReload(DraftCapture draft) throws Exception {
        page.await(InterimStatementsEvidence.readyBack());
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        page.await(new Check("one hardware Back restores the visible Watchlist and exact unsaved note", new Script("document.querySelector('.managed-company-visit')===null&&document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='My Watchlist'&&" + InterimStatementsEvidence.exactDraft(draft, Stage.LOADED).expression())).nativeReady());
        page.click(Element.css("#managed-unsaved-review > summary"));
        page.await(new Check("separate Review exposes the complete proposed note with no Save", new Script("document.querySelector('#managed-unsaved-review')?.open===true&&document.querySelector('#managed-unsaved-review')?.textContent.includes(" + JSONObject.quote(draft.completeNote()) + ")&&" + InterimStatementsEvidence.counts(Stage.LOADED).expression())));
        page.click(Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']"));
        page.await(new Check("explicit Save acknowledges the entire independent Watchlist version two", new Script(InterimStatementsEvidence.counts(Stage.SAVED).expression() + "&&" + InterimStatementsEvidence.exactDraft(draft, Stage.SAVED).expression())));
        page.click(Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']"));
        page.await(new Check("fresh saved read retains all exact memberships, note and untouched resources", new Script(InterimStatementsEvidence.counts(Stage.RELOADED).expression() + "&&" + InterimStatementsEvidence.exactDraft(draft, Stage.RELOADED).expression())));
        assertBoundary();
        assertEquals("Same mounted document survives source review, files, Back and Save", draft.origin(), page.read(new Script("String(performance.timeOrigin)")));
    }
    private void assertBoundary() throws Exception {
        page.await(new Check("invented fixture retains the exact build, local origin and disconnected CSP",new Script(
            "location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'"+
            "&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(expectedSourceSha)+
            "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'"+
            "&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\"")));
    }
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    @After public void closeInterimFixture() throws Exception {
        try { if (scenario != null) { scenario.close(); scenario = null; } }
        finally { WatchlistTestDocuments.clear(context()); if (assets != null) assets.close(); }
    }
}
