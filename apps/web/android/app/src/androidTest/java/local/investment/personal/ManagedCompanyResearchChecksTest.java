package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static local.investment.personal.FilingCheckAssessmentExpectations.*;
import static org.junit.Assert.*;

import android.view.KeyEvent;
import android.view.View;
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
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;

/** One direct company visit explicitly owns an existing check without replacing its loaded evidence. */
@RunWith(AndroidJUnit4.class)
public class ManagedCompanyResearchChecksTest {
    private static final String OBS = "JSON.parse(document.querySelector('#fixture-company-research-checks').textContent)";
    private static final String URL = "https://localhost/?company=listing-zero&section=filings";
    private static final String COMPANY_NOTE = "Full unsaved company note · Café 東京 📈 <script>literal</script>\n" +
        "Keep the complete authored capacity assumptions and uncertainty. ".repeat(12);
    private static final String INDEPENDENT = "Independent unsaved ONE assessment · Café 東京 📈";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha, original, watchlist, portfolio, editor, response;
    private String stage = "startup";

    @Before public void launchInventedDirectCompany() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha); assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.COMPANY_RESEARCH_CHECKS);
        assets.prepare(); scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario); touch = new ReportRevisitTouch(page); keyboard = new ReportRevisitKeyboard(page, touch);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App")); assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity); activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("settled direct company route starts without automatic personal or source loads", new Script(
            "location.href===" + q(URL) + "&&" + OBS + ".selection?.origin==='route'&&" + OBS + ".selection.cik===null&&" + OBS + ".selection.listing.listingId==='listing-zero'&&" + OBS + ".watchlist.draft===null&&" + OBS + ".portfolio.draft===null&&" + OBS + ".followups.draft===null&&" + OBS + ".counts.resolve===1&&document.querySelector('#managed-company-research-checks')!==null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        boundary(0, 0, 0, 0, 0, 1);
    }

    @Test public void loadedCompanyCheckKeepsVisitSourcesAndIndependentDraftsThroughCitationReviewSaveFreshLoad() throws Exception {
        try {
            loadAndAuthorIndependentDrafts(); loadFilingsAndAttach(); assessAndCiteOnce(); reviewCompleteSaveFreshLoad();
        } catch (AssertionError failure) {
            logFailure(failure); throw failure;
        }
    }

    private void loadAndAuthorIndependentDrafts() throws Exception {
        stage = "explicit independent loads";
        click("#managed-company-research-checks > summary");
        page.await(new Check("all unloaded resources are visibly distinct and choice starts empty", new Script(
            "['watchlist','portfolio','followups'].every(k=>document.querySelector('#managed-company-context-'+k)?.textContent.includes('has not been loaded'))&&document.querySelector('#managed-company-check-choice')?.value===''&&document.querySelector('#managed-company-check-attach')?.disabled===true")));
        for (String key : new String[]{"watchlist", "portfolio", "followups"}) click("#managed-company-context-load-" + key);
        page.await(new Check("only explicit Loads establish independent current bases", new Script(OBS + ".watchlist.baseVersion===7&&" + OBS + ".portfolio.baseVersion===3&&" + OBS + ".followups.baseVersion===1&&" + OBS + ".followups.draft.entries.length===2")));
        boundary(1, 1, 1, 0, 0, 1);
        click("#fixture-company-checks-author");
        page.await(new Check("full raw note, projected authored holding and unsaved independent work render without source reads", new Script(
            "document.querySelector('#managed-company-context-note')?.textContent===" + q(COMPANY_NOTE) + "&&document.querySelector('#managed-company-context-note script')===null&&[...document.querySelectorAll('#managed-company-context-holding dd')].map(e=>e.textContent).join('|')==='2|80.00|2026-10-02'&&document.querySelector('#managed-company-context-check')?.textContent.includes(" + q(QUESTION) + ")&&" + OBS + ".watchlist.dirty&&" + OBS + ".portfolio.dirty&&" + OBS + ".followups.dirty&&" + OBS + ".portfolio.draft.ledger.opening.cashUsd==='1500.00'&&" + OBS + ".followups.draft.entries[1].result===" + q(INDEPENDENT) + "&&" + OBS + ".editor.calculation!==null&&['watchlist','portfolio','followups'].every(k=>document.querySelector('#managed-company-context-'+k)?.textContent.includes('Unsaved changes.'))")));
        original = read(".canonical"); watchlist = readJson(".watchlist.draft"); portfolio = readJson(".portfolio.draft"); editor = page.read(new Script(editorFields()));
        boundary(1, 1, 1, 0, 0, 1);
    }

    private void loadFilingsAndAttach() throws Exception {
        stage = "load filings and explicit attachment";
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-filings-heading']//button[normalize-space(.)='Load filings']"));
        page.await(new Check("one explicit filing read retains its complete original packet and source clocks", new Script(
            OBS + ".filings.response?.issuer.filings.length===2&&" + OBS + ".filings.response.issuer.matchingFilings===2&&" + OBS + ".filings.response.issuer.truncated===false&&" + OBS + ".filings.responseOrigin==='request'&&" + OBS + ".filings.showingPrevious===false&&" + OBS + ".filings.response.issuer.fetchedAt==='2026-09-20T00:00:01.000Z'")));
        response = readJson(".filings.response");
        click("#fixture-company-checks-capture");
        page.await(new Check("exact single match still requires an explicit empty-to-chosen native selection", new Script(
            "document.querySelector('#managed-company-check-choice')?.value===''&&[...document.querySelector('#managed-company-check-choice').options].map(o=>o.value).join('|')===" + q("|" + ID) + "&&document.querySelector('#managed-company-check-attach')?.disabled===true")));
        choose("#managed-company-check-choice", "ZERO · due 2000-01-01 · open", ID);
        click("#managed-company-check-attach");
        page.await(new Check("committed attachment focuses its heading and preserves original route, CIK and exact response/draft/editor objects", new Script(
            "document.activeElement===document.querySelector('#managed-company-check-attached-heading')&&" + OBS + ".attached===" + q(ID) + "&&" + OBS + ".sameSelection&&" + OBS + ".sameSection&&" + OBS + ".sameResponse&&" + OBS + ".sameWatchlist&&" + OBS + ".samePortfolio&&" + OBS + ".sameEditor")).nativeReady());
        unchangedVisit(); wholeResult("", "open", null); boundary(1, 1, 1, 0, 1, 1);
        page.await(new Check("attached heading is visible within the native viewport without horizontal overflow", new Script(
            "(()=>{const h=document.querySelector('#managed-company-check-attached-heading'),r=h?.getBoundingClientRect(),v=visualViewport;return h?.checkVisibility()&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;})()")).nativeReady());
        android.util.Log.i("CompanyResearchCheckScope", "Attached check heading/focus viewport only. Complete note, holding, check, packet and independent drafts are asserted separately; lower content extends beyond this frame.");
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, FollowupsReportFrameCapture.Frame.COMPANY_RESEARCH_CHECK_ATTACHED)).retain();
    }

    private void assessAndCiteOnce() throws Exception {
        stage = "native assessment and one-use citation";
        click("#managed-research-followup-assessment > summary"); replaceAssessment(RAW);
        wholeResult(RAW, "open", null); unchangedVisit();
        click("#filings-assessment-toggle");
        page.await(new Check("citation selection starts empty without another source read", new Script("document.querySelector('#filings-assessment-filing')?.value===''&&document.querySelector('#filings-assessment-preview')?.disabled===true")));
        choose("#filings-assessment-filing", "Form 10-Q · 0000000001-26-000001 · Filed 2026-09-19 · Report 2026-06-30", "0000000001-26-000001");
        click("#filings-assessment-preview"); page.await(new Check("full raw assessment, literal citation, original identity and dated coverage are in the real preview", completePreview()));
        wholeResult(RAW, "open", null); unchangedVisit(); boundary(1, 1, 1, 0, 1, 1);
        click("#filings-assessment-apply");
        page.await(new Check("single use updates only this assessment and removes its Apply action", new Script("document.querySelector('#filings-assessment-apply')===null&&document.querySelector('#managed-research-followup-result')?.value===" + q(RESULT))));
        wholeResult(RESULT, "open", null); unchangedVisit();
        click("#filings-assessment-preview");
        page.await(new Check("a second explicit preview refuses the duplicate full citation without another mutation", new Script("document.querySelector('#filings-assessment-apply')===null&&document.querySelector('#filings-assessment-result')===null&&document.querySelector('#filings-assessment-status')?.textContent==='This exact filing reference is already in the assessment draft.'")));
        wholeResult(RESULT, "open", null); unchangedVisit(); boundary(1, 1, 1, 0, 1, 1);
    }

    private void reviewCompleteSaveFreshLoad() throws Exception {
        stage = "explicit exact-entry Review and Complete";
        click("#managed-research-followup-review");
        page.await(new Check("Review hands off to precisely the attached open entry in the whole two-entry draft", new Script(
            "location.href==='https://localhost/'&&" + OBS + ".view==='followups'&&" + R + ".selectedId===" + q(ID) + "&&document.querySelector('#managed-followup-result')?.value===" + q(RESULT) + "&&document.querySelector('#managed-followup-check')?.value===" + q(QUESTION) + "&&" + OBS + ".followups.draft.entries.length===2")));
        wholeResult(RESULT, "open", null); independentDrafts(); boundary(1, 1, 1, 0, 1, 1);
        long before = System.currentTimeMillis(); click("#managed-followup-complete");
        page.await(new Check("explicit completion changes status and UTC date without saving", new Script(OBS + ".followups.draft.entries[0].status==='completed'&&document.querySelector('#managed-followup-reopen')!==null")));
        String date = read(".followups.draft.entries[0].completedOn"); long after = System.currentTimeMillis();
        assertTrue(date.equals(utc(before)) || date.equals(utc(after)));
        wholeResult(RESULT, "completed", date); independentDrafts(); boundary(1, 1, 1, 0, 1, 1);
        String canonical = read(".canonical");
        page.await(new Check("whole independently expected Follow-ups payload matches before Save", new Script(OBS + ".canonical===" + OBS + ".expectedCanonical")));
        stage = "separate Save and fresh-session Load";
        click("#managed-followups-save");
        page.await(new Check("separate Save commits the entire resource once at base two", new Script(F + ".save===1&&" + F + ".commits===1&&" + OBS + ".followups.baseVersion===2&&" + OBS + ".followups.dirty===false&&" + OBS + ".canonical===" + q(canonical))));
        independentDrafts(); boundary(1, 1, 1, 1, 1, 1);
        click("#fixture-followups-fresh-session");
        page.await(new Check("fresh session clears all local personal drafts before explicit Load", new Script(F + ".session===2&&" + OBS + ".followups.draft===null&&" + OBS + ".watchlist.draft===null&&" + OBS + ".portfolio.draft===null&&" + OBS + ".selection===null&&location.href==='https://localhost/'")));
        boundary(1, 1, 1, 1, 1, 2);
        page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']")); click("#managed-followups-load");
        page.await(new Check("fresh Load recovers complete order, identities, raw Unicode result/citation, status/date and independent ONE entry", new Script(
            F + ".load===2&&" + OBS + ".followups.baseVersion===2&&" + OBS + ".followups.dirty===false&&" + OBS + ".canonical===" + q(canonical) + "&&" + OBS + ".canonical===" + OBS + ".expectedCanonical")));
        wholeResult(RESULT, "completed", date); boundary(1, 1, 2, 1, 1, 2);
    }

    private void unchangedVisit() throws Exception {
        page.await(new Check("attachment and own assessment edits preserve exact settled visit, source objects/clocks and independent drafts", new Script(
            "location.href===" + q(URL) + "&&" + OBS + ".selection.origin==='route'&&" + OBS + ".selection.cik===null&&" + OBS + ".route.section==='filings'&&" + OBS + ".sameSelection&&" + OBS + ".sameSection&&" + OBS + ".sameResponse&&" + OBS + ".sameWatchlist&&" + OBS + ".samePortfolio&&" + OBS + ".sameEditor&&JSON.stringify(" + OBS + ".filings.response)===" + q(response))));
        independentDrafts();
    }
    private void independentDrafts() throws Exception {
        page.await(new Check("complete independent unsaved note, Portfolio and retained authored valuation fields remain unchanged", new Script(
            "JSON.stringify(" + OBS + ".watchlist.draft)===" + q(watchlist) + "&&JSON.stringify(" + OBS + ".portfolio.draft)===" + q(portfolio) + "&&" + OBS + ".watchlist.baseVersion===7&&" + OBS + ".watchlist.dirty&&" + OBS + ".portfolio.baseVersion===3&&" + OBS + ".portfolio.dirty&&" + editorFields() + "===" + q(editor))));
    }
    private void wholeResult(String result, String status, String day) throws Exception {
        page.await(new Check("only the exact selected entry result/status/date change; full original resource and independent entry are retained", new Script(
            "(()=>{const e=JSON.parse(" + q(original) + ");e.entries[0].result=" + q(result) + ";e.entries[0].status=" + q(status) + ";e.entries[0].completedOn=" + (day == null ? "null" : q(day)) + ";return " + OBS + ".canonical===JSON.stringify(e);})()")));
    }
    private void boundary(int loads, int portfolioLoads, int followupLoads, int followupSaves, int filings, int sessions) throws Exception {
        page.await(new Check("exact source revision, disconnected CSP, independent request and write budgets remain current", new Script(
            "location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content===" + q(sourceSha) + "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[name=investment-android-test-scenario]')?.content==='company-research-checks'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===" + q(CSP) +
            "&&" + OBS + ".counts.load===" + loads + "&&" + OBS + ".counts.portfolioLoad===" + portfolioLoads + "&&" + OBS + ".counts.resolve===1&&" + OBS + ".counts.filings===" + filings + "&&['save','portfolioSave','eod','annual','interim','calendar','fed','cpi','search','valuationLoad','valuationSave','rejected'].every(k=>" + OBS + ".counts[k]===0)&&" + F + ".load===" + followupLoads + "&&" + F + ".save===" + followupSaves + "&&" + F + ".commits===" + F + ".save&&" + F + ".session===" + sessions + "&&['replays','failures','held','aborted','token','signOut'].every(k=>" + F + "[k]===0)&&" + C + ".token===0&&" + C + ".signOut===0&&" + C + ".marketsResolve===" + sessions + "&&['save','eod','annual','filings','interimReport','marketsEod','calendar','fed','search','interimPortfolioLoad','interimPortfolioSave','interimFollowupsLoad','interimFollowupsSave'].every(k=>" + C + "[k]===0)")));
    }
    private void click(String selector) throws Exception {
        page.await(new Check("enabled target before one native touch: " + selector, new Script("(()=>{const e=document.querySelector(" + q(selector) + ");return !!e&&!e.disabled&&!e.closest('[hidden],[inert]');})()")));
        touch.input(new ReportRevisitTouch.ControlledField(selector, "company check action"));
    }
    private void choose(String selector, String label, String value) throws Exception {
        page.read(new Script("(()=>{const e=document.querySelector(" + q(selector) + ");e.scrollIntoView({block:'center',behavior:'instant'});e.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("empty enabled selector owns native focus before choice", new Script("document.activeElement===document.querySelector(" + q(selector) + ")&&document.activeElement.value===''")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4)); AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); }).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("native choice selects only the requested identity after dialog dismissal", new Script("document.querySelector(" + q(selector) + ")?.value===" + q(value)), ReportRevisitPage.Readiness.NATIVE, dialog.get())); keyboard.closeSoftKeyboard();
    }
    private void replaceAssessment(String value) throws Exception {
        touch.input(ReportRevisitTouch.Field.FOLLOWUP_RESULT);
        page.await(new Check("controlled assessment owns native focus before full replacement", new Script("document.activeElement===document.querySelector('#managed-research-followup-result')")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection covers the complete previous field", new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "replace complete invented company assessment through native IME"; }
            public void perform(UiController controller, View view) { InputConnection c = view.onCreateInputConnection(new EditorInfo()); assertNotNull(c); assertTrue(c.commitText(value, 1)); controller.loopMainThreadUntilIdle(); }
        });
        page.await(new Check("raw Unicode and literal markup reach the real controlled editor", new Script("document.querySelector('#managed-research-followup-result')?.value===" + q(value)))); keyboard.closeSoftKeyboard();
    }
    private static String editorFields() { return "JSON.stringify((()=>{const {owner,dirty,dcfDraft,exitDraft,inputIssue,retired}=" + OBS + ".editor;return {owner,dirty,dcfDraft,exitDraft,inputIssue,retired};})())"; }
    private String read(String suffix) throws Exception { return page.read(new Script(OBS + suffix)); }
    private String readJson(String suffix) throws Exception { return page.read(new Script("JSON.stringify(" + OBS + suffix + ")")); }
    private static String q(String text) { return JSONObject.quote(text); }
    private static String utc(long time) { return Instant.ofEpochMilli(time).atZone(ZoneOffset.UTC).toLocalDate().toString(); }
    private void logFailure(AssertionError originalFailure) {
        try {
            String observed = page.read(new Script("JSON.stringify((()=>{const d=" + OBS + ";return {stage:" + q(stage) + ",activeId:document.activeElement?.id,route:d.route,origin:d.selection?.origin,attached:d.attached,captured:d.captured,sameSelection:d.sameSelection,sameSection:d.sameSection,sameResponse:d.sameResponse,sameWatchlist:d.sameWatchlist,samePortfolio:d.samePortfolio,sameEditor:d.sameEditor,counts:d.counts,followups:" + F + "};})())"));
            android.util.Log.e("CompanyResearchCheckJourney", observed.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 8192 ? observed : "{\"diagnosticTooLarge\":true}");
        } catch (Exception | AssertionError diagnostic) { originalFailure.addSuppressed(diagnostic); }
    }
    @After public void closeInventedCompany() { try { if (scenario != null) scenario.close(); } finally { if (assets != null) assets.close(); } }
}
