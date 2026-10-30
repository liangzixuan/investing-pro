package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;

/** Saved file and current source captures assess one explicitly attached check; no owner services. */
@RunWith(AndroidJUnit4.class)
public class ManagedReportComparisonCheckTest {
    private static final String OBS = "JSON.parse(document.querySelector('#fixture-report-comparison-check').textContent)";
    private static final String F = "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String C = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-revisit-file').textContent)";
    private static final String URL = "https://localhost/?company=listing-zero&section=annual";
    private static final String ID = "00000000-0000-4000-8000-000000000001";
    private static final String QUESTION = "What changed since the archived capacity report? Café 東京 📈";
    private static final String PRIOR = "Prior assessed capacity remains unresolved · Café 東京 📈";
    private static final String ASSESSMENT = "Archived assumptions need a capacity recheck. <script>literal</script> & Café 東京 📈";
    private static final String NOTE = "Full unsaved company note · Café 東京 📈 <script>literal</script>\n" +
        "Keep the complete authored capacity assumptions and uncertainty. ".repeat(12);
    private static final String INDEPENDENT = "Independent unsaved ONE assessment · Café 東京 📈";
    private static final String ARCHIVE_TIME = "2026-10-15T00:00:00.000Z";
    private static final String CSP = FilingCheckAssessmentExpectations.CSP;
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha, original, watchlist, portfolio, editor, response, result, currentTime;
    private JSONObject archiveGeneration;
    private String stage = "startup";

    @Before public void launchInventedComparisonVisit() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha); assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.REPORT_COMPARISON_CHECK);
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
        page.awaitStartup(new Check("direct company visit settles with no implicit personal/source loads", new Script(
            "location.href===" + q(URL) + "&&" + OBS + ".selection?.origin==='route'&&" + OBS + ".selection.cik===null&&" + OBS + ".watchlist.draft===null&&" + OBS + ".portfolio.draft===null&&" + OBS + ".followups.draft===null&&" + OBS + ".counts.resolve===1")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(InstrumentationRegistry.getInstrumentation().getTargetContext());
        boundary(0, 0, 0, 0, 0, 1);
    }

    @Test public void savedReportComparisonAppliesToExactCheckThroughReviewCompletionSaveFreshLoad() throws Exception {
        try { loadAndAuthor(); saveAndReadArchive(); loadCurrentAndAttach(); previewAndApplyOnce(); reviewCompleteSaveFreshLoad(); }
        catch (AssertionError failure) { logFailure(failure); throw failure; }
    }
    private void loadAndAuthor() throws Exception {
        stage = "explicit independent personal loads"; click("#managed-company-research-checks > summary");
        page.await(new Check("unloaded resource and empty explicit check choice are distinct", new Script(
            "['watchlist','portfolio','followups'].every(k=>document.querySelector('#managed-company-context-'+k)?.textContent.includes('has not been loaded'))&&document.querySelector('#managed-company-check-choice')?.value===''&&document.querySelector('#managed-company-check-attach')?.disabled===true")));
        for (String key : new String[]{"watchlist", "portfolio", "followups"}) click("#managed-company-context-load-" + key);
        page.await(new Check("each explicit Load establishes its independent current base", new Script(OBS + ".watchlist.baseVersion===7&&" + OBS + ".portfolio.baseVersion===3&&" + OBS + ".followups.baseVersion===1")));
        click("#fixture-report-check-author");
        page.await(new Check("full raw independent note, holding, result and editor remain authored drafts", new Script(
            "document.querySelector('#managed-company-context-note')?.textContent===" + q(NOTE) + "&&document.querySelector('#managed-company-context-note script')===null&&[...document.querySelectorAll('#managed-company-context-holding dd')].map(e=>e.textContent).join('|')==='2|80.00|2026-10-02'&&" + OBS + ".portfolio.draft.ledger.opening.cashUsd==='1500.00'&&" + OBS + ".followups.draft.entries[0].result===" + q(PRIOR) + "&&" + OBS + ".followups.draft.entries[1].result===" + q(INDEPENDENT) + "&&" + OBS + ".editor.calculation!==null&&['watchlist','portfolio','followups'].every(k=>" + OBS + "[k].dirty)")));
        original = read(".canonical"); watchlist = readJson(".watchlist.draft"); portfolio = readJson(".portfolio.draft"); editor = page.read(new Script(editorFields()));
        boundary(1, 1, 1, 0, 0, 1);
    }
    private void saveAndReadArchive() throws Exception {
        stage = "native chosen-document archived report write and read"; click("#fixture-revisit-save");
        WatchlistSystemPicker picker = new WatchlistSystemPicker(); picker.awaitOpen(30_000); picker.saveToInventedRoot();
        page.await(new Check("the native writer acknowledges one whole invented large report", new Script(FILE + ".phase==='written'&&" + FILE + ".byteLength>266240&&" + FILE + ".byteLength<2850816")));
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(InstrumentationRegistry.getInstrumentation().getTargetContext()); assertEquals(1, outputs.length);
        String filename = page.read(new Script(FILE + ".filename")); assertEquals(filename, outputs[0].name);
        byte[] bytes = WatchlistTestDocuments.readReport(InstrumentationRegistry.getInstrumentation().getTargetContext(), outputs[0]);
        JSONObject archive = new JSONObject(new String(bytes, StandardCharsets.UTF_8)); assertTrue(bytes.length > 266_240 && bytes.length < 2_850_816); assertEquals("6.0.0", archive.getString("schemaVersion"));
        assertEquals(300_000, archive.getJSONObject("sources").getJSONObject("annual").getJSONObject("statements").getString("opaqueInventedPadding").length());
        archiveGeneration = archive.getJSONObject("sources").getJSONObject("annual").getJSONObject("response").getJSONObject("evidence").getJSONObject("generation");
        click(".managed-company-report > summary"); click(".managed-report-revisit > summary"); touch.fileChooser(); new WatchlistSystemPicker().openInventedReportDocument(filename);
        String archivedNote = archive.getJSONObject("authoredResearch").getString("note");
        page.await(new Check("real file admission shows complete unverified note/appendix, exact identity and original clocks without source reads", new Script(
            "(()=>{const s=document.querySelector('[aria-label=\"Archived report\"]'),t=s?.textContent??'';return document.querySelector('#managed-report-revisit-heading')?.textContent==='Reopened report · ZERO'&&s?.querySelector('.managed-company-report-note')?.textContent===" + q(archivedNote) + "&&t.includes(" + q(ARCHIVE_TIME) + ")&&t.includes(" + q(archiveGeneration.getString("completedAt")) + ")&&['issuer-zero','listing-zero','security-zero','class-zero','Class A','XNAS','US','0000000001'].every(v=>t.includes(v))&&document.querySelector('.managed-report-revisit .managed-report-document textarea')?.value.includes('x'.repeat(300000))&&document.querySelector('[aria-label=\"Current report capture\"]')===null;})()")));
        wholeResult(PRIOR, "open", null); independentDrafts(); boundary(1, 1, 1, 0, 0, 1);
    }
    private void loadCurrentAndAttach() throws Exception {
        stage = "explicit current Annual load, capture and exact existing-check attachment";
        page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-annual-report')]//button[normalize-space(.)='Load annual report']"));
        page.await(new Check("one explicit current Annual read retains its full response and original source dates", new Script(OBS + ".annual.response!==null&&" + OBS + ".annual.responseOrigin==='request'&&" + OBS + ".annual.showingPrevious===false")));
        response = readJson(".annual.response"); click("#fixture-report-check-capture");
        page.click(ReportRevisitPage.Element.revisit("Capture current report for comparison"));
        page.await(new Check("both captures are complete and the generic visit has no silently selected check", new Script(
            "document.querySelector('[aria-label=\"Current report capture\"] .managed-company-report-note')?.textContent===" + q(NOTE) + "&&document.querySelector('#managed-report-revisit-assessment')?.value===''&&document.querySelector('#managed-company-check-choice')?.value===''&&document.querySelector('#managed-report-comparison-check-prepare')===null")));
        currentTime = page.read(new Script("document.querySelector('[aria-label=\"Current report capture\"] dd').textContent")); assertTrue(currentTime.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z")); Instant.parse(currentTime);
        choose("#managed-company-check-choice", "ZERO · due 2000-01-01 · open", ID); click("#managed-company-check-attach");
        page.await(new Check("committed generic attachment focuses only its check and enables exact comparison destination", new Script(
            "document.activeElement?.id==='managed-company-check-attached-heading'&&" + OBS + ".attached===" + q(ID) + "&&document.querySelector('#managed-report-comparison-check-question')?.textContent===" + q(QUESTION) + "&&document.querySelector('#managed-report-comparison-check-current-result')?.textContent===" + q(PRIOR) + "&&document.querySelector('#managed-report-comparison-check-prepare')?.disabled===false")));
        unchangedVisit(); boundary(1, 1, 1, 0, 1, 1);
    }
    private void previewAndApplyOnce() throws Exception {
        stage = "whole raw comparison assessment preview and one explicit Apply"; replaceAssessment(ASSESSMENT); click("#managed-report-comparison-check-prepare");
        page.await(new Check("exact comparison preview owns focus and preserves complete authored text without executing markup", new Script(
            "document.activeElement?.id==='managed-report-comparison-check-preview'&&document.querySelector('#managed-report-comparison-check-result')?.value.startsWith(" + q(PRIOR + " ZERO XNAS report revisit assessed ") + ")&&document.querySelector('#managed-report-comparison-check-result script')===null")));
        result = page.read(new Script("document.querySelector('#managed-report-comparison-check-result').value"));
        Matcher times = Pattern.compile("report revisit assessed (\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z):").matcher(result); assertTrue(times.find());
        String assessedAt = times.group(1); Instant.parse(assessedAt); assertEquals(expectedResult(assessedAt), result); assertTrue(result.codePointCount(0, result.length()) <= 2000);
        wholeResult(PRIOR, "open", null); unchangedVisit(); boundary(1, 1, 1, 0, 1, 1);
        page.read(new Script("(()=>{document.querySelector('#managed-report-comparison-check-preview').scrollIntoView({block:'start',behavior:'instant'});return 'scoped current preview';})()"));
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, FollowupsReportFrameCapture.Frame.REPORT_COMPARISON_CHECK_PREVIEW)).retain();
        click("#managed-report-comparison-check-apply");
        page.await(new Check("one explicit Apply changes only this existing assessment and consumes its proposal", new Script(
            OBS + ".followups.draft.entries[0].result===" + q(result) + "&&document.querySelector('#managed-report-comparison-check-apply')===null&&document.querySelector('#managed-report-comparison-check-result')===null")));
        wholeResult(result, "open", null); unchangedVisit(); boundary(1, 1, 1, 0, 1, 1);
        click("#managed-report-comparison-check-prepare");
        page.await(new Check("same full comparison cannot be appended twice even with a new preview time", new Script("document.querySelector('#managed-report-comparison-check-result')===null&&document.querySelector('#managed-report-comparison-check-apply')===null&&document.querySelector('#managed-report-comparison-check-status')?.textContent==='This comparison is already in the current Follow-ups assessment.'")));
        wholeResult(result, "open", null); unchangedVisit(); boundary(1, 1, 1, 0, 1, 1);
    }
    private void reviewCompleteSaveFreshLoad() throws Exception {
        stage = "exact entry Review, separate Complete, Save and fresh-session Load"; click("#managed-research-followup-review");
        page.await(new Check("Review preserves the exact entry and entire two-entry Follow-ups draft", new Script(
            "location.href==='https://localhost/'&&" + OBS + ".view==='followups'&&" + OBS + ".followupsLocal.selectedId===" + q(ID) + "&&document.querySelector('#managed-followup-result')?.value===" + q(result) + "&&document.querySelector('#managed-followup-check')?.value===" + q(QUESTION))));
        wholeResult(result, "open", null); independentDrafts(); boundary(1, 1, 1, 0, 1, 1);
        long before = System.currentTimeMillis(); click("#managed-followup-complete");
        page.await(new Check("explicit completion changes only status and UTC day, never implicit Save", new Script(OBS + ".followups.draft.entries[0].status==='completed'&&document.querySelector('#managed-followup-reopen')!==null")));
        String day = read(".followups.draft.entries[0].completedOn"); long after = System.currentTimeMillis(); assertTrue(day.equals(utc(before)) || day.equals(utc(after)));
        wholeResult(result, "completed", day); independentDrafts(); boundary(1, 1, 1, 0, 1, 1);
        String canonical = read(".canonical"); page.await(new Check("whole final payload matches the independent fixture expectation", new Script(OBS + ".canonical===" + OBS + ".expectedCanonical")));
        click("#managed-followups-save"); page.await(new Check("separate Save commits exactly the whole current resource at base two", new Script(F + ".save===1&&" + F + ".commits===1&&" + OBS + ".followups.baseVersion===2&&" + OBS + ".followups.dirty===false&&" + OBS + ".canonical===" + q(canonical))));
        independentDrafts(); boundary(1, 1, 1, 1, 1, 1); click("#fixture-followups-fresh-session");
        page.await(new Check("fresh session clears local drafts, source visit and selection before an explicit saved read", new Script(F + ".session===2&&" + OBS + ".followups.draft===null&&" + OBS + ".watchlist.draft===null&&" + OBS + ".portfolio.draft===null&&" + OBS + ".selection===null&&location.href==='https://localhost/'")));
        boundary(1, 1, 1, 1, 1, 2); page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']")); click("#managed-followups-load");
        page.await(new Check("fresh Load recovers exact whole raw assessment/citation, identities, order, status/date and independent entry", new Script(F + ".load===2&&" + OBS + ".followups.baseVersion===2&&" + OBS + ".followups.dirty===false&&" + OBS + ".canonical===" + q(canonical) + "&&" + OBS + ".canonical===" + OBS + ".expectedCanonical")));
        wholeResult(result, "completed", day); boundary(1, 1, 2, 1, 1, 2);
    }
    private String expectedResult(String assessedAt) throws Exception {
        String dates = "price not loaded; annual completed " + archiveGeneration.getString("completedAt") + "; interim not loaded; filings not loaded";
        JSONObject sources = archiveGeneration.getJSONObject("sources"); String refs = sources.getJSONObject("companyFacts").getString("sourceUrl") + "; " + sources.getJSONObject("submissions").getString("sourceUrl");
        return PRIOR + " ZERO XNAS report revisit assessed " + assessedAt + ": archived report prepared " + ARCHIVE_TIME + "; current report prepared " + currentTime + ". Archived source dates: " + dates + ". Current source dates: " + dates + ". Authored assessment: " + ASSESSMENT + " Archived source references (unverified file claims): " + refs + ". Current source references: " + refs + ". The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.";
    }
    private void unchangedVisit() throws Exception {
        page.await(new Check("comparison keeps exact route/origin/CIK, source object/clocks and independent draft/editor identities", new Script(
            "location.href===" + q(URL) + "&&" + OBS + ".selection.origin==='route'&&" + OBS + ".selection.cik===null&&" + OBS + ".route.section==='annual'&&" + OBS + ".sameSelection&&" + OBS + ".sameSection&&" + OBS + ".sameResponse&&" + OBS + ".sameWatchlist&&" + OBS + ".samePortfolio&&" + OBS + ".sameEditor&&JSON.stringify(" + OBS + ".annual.response)===" + q(response)))); independentDrafts();
    }
    private void independentDrafts() throws Exception { page.await(new Check("full independent unsaved resources and authored editor remain unchanged", new Script("JSON.stringify(" + OBS + ".watchlist.draft)===" + q(watchlist) + "&&JSON.stringify(" + OBS + ".portfolio.draft)===" + q(portfolio) + "&&" + OBS + ".watchlist.baseVersion===7&&" + OBS + ".watchlist.dirty&&" + OBS + ".portfolio.baseVersion===3&&" + OBS + ".portfolio.dirty&&" + editorFields() + "===" + q(editor)))); }
    private void wholeResult(String value, String status, String day) throws Exception { page.await(new Check("full original ordered resource changes only the exact entry result/status/day", new Script("(()=>{const e=JSON.parse(" + q(original) + ");e.entries[0].result=" + q(value) + ";e.entries[0].status=" + q(status) + ";e.entries[0].completedOn=" + (day == null ? "null" : q(day)) + ";return " + OBS + ".canonical===JSON.stringify(e);})()"))); }
    private void boundary(int loads, int portfolioLoads, int followupLoads, int followupSaves, int annual, int sessions) throws Exception {
        page.await(new Check("source revision/disconnected CSP and exact explicit read/write budgets", new Script(
            "location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content===" + q(sourceSha) + "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[name=investment-android-test-scenario]')?.content==='report-comparison-check'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===" + q(CSP) + "&&" + OBS + ".counts.load===" + loads + "&&" + OBS + ".counts.portfolioLoad===" + portfolioLoads + "&&" + OBS + ".counts.resolve===1&&" + OBS + ".counts.annual===" + annual + "&&['save','portfolioSave','eod','filings','interim','calendar','fed','cpi','search','valuationLoad','valuationSave','rejected'].every(k=>" + OBS + ".counts[k]===0)&&" + F + ".load===" + followupLoads + "&&" + F + ".save===" + followupSaves + "&&" + F + ".commits===" + F + ".save&&" + F + ".session===" + sessions + "&&['replays','failures','held','aborted','token','signOut'].every(k=>" + F + "[k]===0)&&" + C + ".token===0&&" + C + ".signOut===0&&" + C + ".annual===" + annual + "&&" + C + ".marketsResolve===" + sessions + "&&['save','eod','filings','interimReport','marketsEod','calendar','fed','search','interimPortfolioLoad','interimPortfolioSave','interimFollowupsLoad','interimFollowupsSave'].every(k=>" + C + "[k]===0)")));
    }
    private void click(String selector) throws Exception { page.await(new Check("enabled target before one native touch: " + selector, new Script("(()=>{const e=document.querySelector(" + q(selector) + ");return !!e&&!e.disabled&&!e.closest('[hidden],[inert]');})()"))); touch.input(new ReportRevisitTouch.ControlledField(selector, "report check action")); }
    private void choose(String selector, String label, String value) throws Exception {
        page.read(new Script("(()=>{const e=document.querySelector(" + q(selector) + ");e.scrollIntoView({block:'center',behavior:'instant'});e.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("empty enabled selector owns native focus", new Script("document.activeElement===document.querySelector(" + q(selector) + ")&&document.activeElement.value===''")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4)); AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); }).perform(androidx.test.espresso.action.ViewActions.click()); assertNotNull(dialog.get());
        page.await(new Check("native choice selects exact identity after dialog dismissal", new Script("document.querySelector(" + q(selector) + ")?.value===" + q(value)), ReportRevisitPage.Readiness.NATIVE, dialog.get())); keyboard.closeSoftKeyboard();
    }
    private void replaceAssessment(String value) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField("#managed-report-revisit-assessment", "comparison assessment"));
        page.await(new Check("real comparison input owns native focus", new Script("document.activeElement===document.querySelector('#managed-report-revisit-assessment')")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection covers the complete previous input", new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public org.hamcrest.Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "enter complete invented comparison assessment with native IME"; }
            public void perform(UiController controller, View view) { InputConnection c = view.onCreateInputConnection(new EditorInfo()); assertNotNull(c); assertTrue(c.commitText(value, 1)); controller.loopMainThreadUntilIdle(); }
        });
        page.await(new Check("raw Unicode and literal markup remain exact in the controlled textarea", new Script("document.querySelector('#managed-report-revisit-assessment')?.value===" + q(value)))); keyboard.closeSoftKeyboard();
    }
    private static String editorFields() { return "JSON.stringify((()=>{const {owner,dirty,dcfDraft,exitDraft,inputIssue,retired}=" + OBS + ".editor;return {owner,dirty,dcfDraft,exitDraft,inputIssue,retired};})())"; }
    private String read(String suffix) throws Exception { return page.read(new Script(OBS + suffix)); }
    private String readJson(String suffix) throws Exception { return page.read(new Script("JSON.stringify(" + OBS + suffix + ")")); }
    private static String q(String value) { return JSONObject.quote(value); }
    private static String utc(long time) { return Instant.ofEpochMilli(time).atZone(ZoneOffset.UTC).toLocalDate().toString(); }
    private void logFailure(AssertionError failure) {
        try { String observed = page.read(new Script("JSON.stringify((()=>{const d=" + OBS + ";return {stage:" + q(stage) + ",activeId:document.activeElement?.id,route:d.route,origin:d.selection?.origin,attached:d.attached,captured:d.captured,counts:d.counts,sameSelection:d.sameSelection,sameResponse:d.sameResponse,sameWatchlist:d.sameWatchlist,samePortfolio:d.samePortfolio,sameEditor:d.sameEditor,followups:" + F + ",comparisonStatus:document.querySelector('#managed-report-comparison-check-status')?.textContent};})())")); android.util.Log.e("ReportComparisonCheckJourney", observed.getBytes(StandardCharsets.UTF_8).length <= 8192 ? observed : "{\"diagnosticTooLarge\":true}"); }
        catch (Exception | AssertionError diagnostic) { failure.addSuppressed(diagnostic); }
    }
    @After public void closeInventedComparison() throws Exception { try { if (scenario != null) scenario.close(); } finally { WatchlistTestDocuments.clear(InstrumentationRegistry.getInstrumentation().getTargetContext()); if (assets != null) assets.close(); } }
}
