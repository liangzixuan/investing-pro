package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static org.junit.Assert.*;

import android.content.Context;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.espresso.action.EspressoKey;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.hamcrest.Matcher;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** Complete invented comparison through real HTML formatting, bridge, chooser and URI readback. */
@RunWith(AndroidJUnit4.class)
public class ManagedScreenComparisonReportTest {
    private static final String REPORT = "#managed-screen-comparison-report";
    private static final String CAPTURED = "#managed-screen-comparison-report-captured";
    private static final String COUNTS = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-screen-comparison-report').textContent)";
    private static final String PACKETS = "JSON.parse(document.querySelector('#fixture-screen-comparison-report-packets').textContent)";
    private static final String NOTE = "Unsaved comparison note · Café 東京 📈 <script>private draft</script>";
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private record Original(String watchlist, String origin) {}
    private record CapturedReport(String text) {
        JSONObject json() throws Exception { return new JSONObject(text); }
    }
    private record ReportContext(Original original, CapturedReport capture) {}
    private record SavedReport(String html, CapturedReport capture) {}
    private record ObservedCompany(JSONObject value) {}
    private enum ExpectedCompany {
        ZERO, ONE;
        String id() { return this == ZERO ? "zero" : "one"; }
        String symbol() { return this == ZERO ? "ZERO" : "ONE"; }
        String reportDate() { return this == ZERO ? "2025-12-31" : "2025-06-30"; }
        String cutoff() { return this == ZERO ? "2026-09-20T00:00:00.000Z" : "2026-09-21T03:04:05.000Z"; }
    }
    private enum ReadPhase {
        INITIAL, PAIRED;
        int resolves() { return this == INITIAL ? 0 : 1; }
        int annual() { return this == INITIAL ? 0 : 2; }
    }
    private enum ScreenAction {
        LOAD_COHORT("Load screening cohort"),
        ADD_CRITERION("Add criterion"),
        APPLY_CRITERIA("Apply criteria"),
        RUN("Run screen (2 companies)"),
        LEFT_ZERO("Compare left ZERO"),
        RIGHT_ONE("Compare right ONE"),
        CLEAR_RIGHT("Clear right company"),
        RESEARCH_ONE("Research ONE from comparison");
        private final String label;
        ScreenAction(String label) { this.label = label; }
        String label() { return label; }
    }
    private enum ReportAction {
        CAPTURE, SAVE, CLOSE;
        String label() {
            return switch (this) {
                case CAPTURE -> "Capture comparison report";
                case SAVE -> "Save comparison report (HTML)";
                case CLOSE -> "Close comparison report";
            };
        }
    }

    @Before public void launchInventedCompleteComparison() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha); assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.SCREEN_COMPARISON_REPORT);
        assets.prepare(); scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario); touch = new ReportRevisitTouch(page); keyboard = new ReportRevisitKeyboard(page, touch);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App")); assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentScreenComparisonReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity); activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("fixed comparison report fixture starts without financial reads or file delivery", new Script(
            "document.querySelector('#fixture-screen-comparison-report')!==null&&" + COUNTS + ".load===1&&" + COUNTS + ".status===1&&" + COUNTS + ".marketsResolve===1&&" + COUNTS + ".annual===0&&" + FILE + ".choices===0")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(context()); boundary(ReadPhase.INITIAL);
    }

    @Test public void completeComparisonReportUsesChosenHtmlAndRetiresAcrossResearchBackWithoutDraftWrites() throws Exception {
        Original original = authorDraftAndLoadPair();
        CapturedReport first = captureAndInspect(original);
        retireAndRestorePair(original);
        CapturedReport complete = captureAndInspect(original);
        retainHeaderFrame();
        assertEquals(first.json().getJSONObject("left").toString(), complete.json().getJSONObject("left").toString());
        cancelRealPicker(new ReportContext(original, complete));
        saveAndInspectWholeDocument(new ReportContext(original, complete));
        researchAndBack(original);
        assertEquals(original.origin, page.read(new Script("String(performance.timeOrigin)")));
        assertEquals(1, WatchlistTestDocuments.outputs(context()).length);
    }

    private Original authorDraftAndLoadPair() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        replaceNote();
        page.await(new Check("the complete authored note is an unsaved independent Watchlist draft", new Script(FILE + ".watchlist.dirty===true&&JSON.parse(" + FILE + ".watchlist.canonical).memberships[0].note===" + JSONObject.quote(NOTE))));
        Original original = new Original(page.read(new Script(FILE + ".watchlist.canonical")), page.read(new Script("String(performance.timeOrigin)")));
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Discover']"));
        page.await(new Check("capture begins disabled without a pair", new Script("[...document.querySelectorAll('" + REPORT + " button')].find(b=>b.textContent==='Capture comparison report')?.disabled===true")));
        screenAction(ScreenAction.LOAD_COHORT);
        page.await(new Check("two exact loaded members are selected with no Annual read", new Script("document.querySelectorAll('.managed-screen-cohort input:checked').length===2&&" + COUNTS + ".resolve===1&&" + COUNTS + ".annual===0")));
        screenAction(ScreenAction.ADD_CRITERION); screenAction(ScreenAction.APPLY_CRITERIA); screenAction(ScreenAction.RUN);
        page.await(new Check("first explicit source read keeps pair actions disabled during paced run", new Script(COUNTS + ".annual===1&&[...document.querySelectorAll('.managed-screen-table button')].filter(b=>b.textContent.startsWith('Compare ')).every(b=>b.disabled)")));
        // Existing startup budget observes the unchanged twenty-second inter-company pace; no sleep or new global timeout.
        page.awaitStartup(new Check("both canonical sources settle before pair selection", new Script(COUNTS + ".annual===2&&[...document.querySelectorAll('.managed-screen-table button')].find(b=>b.textContent==='Compare left ZERO')?.disabled===false")));
        screenAction(ScreenAction.LEFT_ZERO); screenAction(ScreenAction.RIGHT_ONE);
        page.await(new Check("the exact independently dated pair is visible and Capture is explicit", new Script(pairReady() + "&&document.querySelector('" + CAPTURED + "')===null")));
        unchanged(original); return original;
    }

    private CapturedReport captureAndInspect(Original original) throws Exception {
        reportAction(ReportAction.CAPTURE);
        page.await(new Check("whole source packets, all three groups, exact identities and original independent clocks are captured", new Script(
            "(()=>{const a=document.querySelector('" + CAPTURED + " article'),pre=a?.querySelector(':scope > details > pre');if(!pre)return false;const r=JSON.parse(pre.textContent),p=" + PACKETS + ";" +
            "return r.kind==='screen_comparison'&&r.catalogSnapshotSha256==='sha256:'+'a'.repeat(64)&&r.run.status==='completed'&&r.run.completedAt!==null&&" +
            "r.criteria.clauses.length===1&&r.criteria.clauses[0].field==='operatingCashFlow'&&r.criteria.clauses[0].operator==='gte'&&r.criteria.clauses[0].value==='0'&&r.criteria.sort.field==='symbol'&&r.criteria.sort.direction==='asc'&&" +
            "r.left.listing.listingId==='listing-zero'&&r.right.listing.listingId==='listing-one'&&[r.left,r.right].every((c,i)=>JSON.stringify(c.response)===JSON.stringify(p[i])&&c.view.statements.statements.map(s=>s.id).join('|')==='income_statement|balance_sheet|cash_flow')&&" +
            "a.querySelectorAll('section[aria-label=\"left company\"] table').length===3&&a.querySelectorAll('section[aria-label=\"right company\"] table').length===3&&a.textContent.includes('USD -200.125')&&a.textContent.includes('USD 0')&&a.textContent.includes('Unavailable')&&" +
            "a.textContent.includes('2025-01-01 through 2025-12-31')&&a.textContent.includes('2024-07-01 through 2025-06-30')&&!pre.textContent.includes('Unsaved comparison note')&&a.querySelector('script,img,form,iframe,object')===null;})()")));
        String capture = page.read(new Script("document.querySelector('" + CAPTURED + " article > details > pre').textContent"));
        CapturedReport report = new CapturedReport(capture); verifyCapture(report); unchanged(original); return report;
    }

    private void verifyCapture(CapturedReport capture) throws Exception {
        JSONObject report = capture.json();
        assertEquals("screen_comparison", report.getString("kind"));
        String prepared = report.getString("preparedAt"); assertTrue(prepared.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"));
        verifyCompany(new ObservedCompany(report.getJSONObject("left")), ExpectedCompany.ZERO);
        verifyCompany(new ObservedCompany(report.getJSONObject("right")), ExpectedCompany.ONE);
    }
    private void verifyCompany(ObservedCompany observed, ExpectedCompany expected) throws Exception {
        JSONObject company = observed.value();
        JSONObject listing = company.getJSONObject("listing"); assertEquals(11, listing.length());
        assertEquals("listing-" + expected.id(), listing.getString("listingId")); assertEquals("issuer-" + expected.id(), listing.getString("issuerId"));
        assertEquals("security-" + expected.id(), listing.getString("securityId")); assertEquals("class-" + expected.id(), listing.getString("shareClassId"));
        assertEquals(expected.symbol(), listing.getString("symbol")); assertEquals("Class A", listing.getString("shareClassName")); assertEquals("XNAS", listing.getString("exchangeMic")); assertEquals("US", listing.getString("country"));
        JSONObject evidence = company.getJSONObject("response").getJSONObject("evidence");
        assertEquals(expected.reportDate(), evidence.getJSONObject("target").getString("reportDate")); assertEquals(expected.cutoff(), evidence.getJSONObject("generation").getString("cutoffAt"));
        assertEquals(3, company.getJSONObject("view").getJSONObject("statements").getJSONArray("statements").length());
    }
    private void retireAndRestorePair(Original original) throws Exception {
        screenAction(ScreenAction.CLEAR_RIGHT);
        page.await(new Check("clearing one owned side permanently withdraws the previous report", new Script("document.querySelector('" + CAPTURED + "')===null&&[...document.querySelectorAll('" + REPORT + " button')].find(b=>b.textContent==='Capture comparison report')?.disabled===true")));
        screenAction(ScreenAction.RIGHT_ONE);
        page.await(new Check("restoring the exact pair does not revive its old capture or save", new Script(pairReady() + "&&document.querySelector('" + CAPTURED + "')===null&&" + FILE + ".choices===0")));
        unchanged(original);
    }
    private void cancelRealPicker(ReportContext report) throws Exception {
        Original original = report.original(); CapturedReport capture = report.capture();
        reportAction(ReportAction.SAVE);
        WatchlistSystemPicker picker = new WatchlistSystemPicker(); picker.awaitOpen(30_000); picker.cancel();
        page.await(new Check("system chooser cancellation keeps the complete report without a write", new Script(FILE + ".choices===1&&" + FILE + ".writeRequests===0&&" + FILE + ".writes===0&&document.querySelector('" + REPORT + " [role=status]')?.textContent==='Comparison report save cancelled.'&&document.querySelector('" + CAPTURED + " article > details > pre')?.textContent===" + JSONObject.quote(capture.text()))).nativeReady());
        assertEquals(0, WatchlistTestDocuments.outputs(context()).length); unchanged(original);
    }
    private void saveAndInspectWholeDocument(ReportContext report) throws Exception {
        Original original = report.original(); CapturedReport capture = report.capture();
        reportAction(ReportAction.SAVE);
        WatchlistSystemPicker picker = new WatchlistSystemPicker(); picker.awaitOpen(30_000); picker.saveToInventedRoot();
        page.await(new Check("the actual native writer confirms exactly one complete HTML document", new Script(FILE + ".choices===2&&" + FILE + ".writeRequests===1&&" + FILE + ".writes===1&&document.querySelector('" + REPORT + " [role=status]')?.textContent==='Comparison report written to the chosen document.'")).nativeReady());
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context()); assertEquals(1, outputs.length);
        WatchlistTestDocuments.Output output = outputs[0]; assertTrue(output.name.matches("Investment-screen-comparison-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals(page.read(new Script(FILE + ".filename")), output.name); assertEquals("text/html", context().getContentResolver().getType(output.uri));
        byte[] bytes; try(InputStream stream = context().getContentResolver().openInputStream(output.uri)) { assertNotNull(stream); bytes = stream.readNBytes(MAX_BYTES + 1); }
        assertTrue(bytes.length > 0 && bytes.length <= MAX_BYTES); assertEquals(output.size, bytes.length); assertEquals(Integer.parseInt(page.read(new Script("String(" + FILE + ".byteLength)"))), bytes.length);
        String html = new String(bytes, StandardCharsets.UTF_8); assertArrayEquals(bytes, html.getBytes(StandardCharsets.UTF_8));
        assertTrue(ScreenComparisonReportHtmlDocumentPolicy.INSTANCE.acceptsText(output.name, html));
        assertFalse(html.contains(NOTE)); inspectPassiveReadback(new SavedReport(html, capture)); unchanged(original);
    }
    private void inspectPassiveReadback(SavedReport saved) throws Exception {
        String html = saved.html(); CapturedReport capture = saved.capture();
        String result = page.read(new Script("JSON.stringify((()=>{const d=new DOMParser().parseFromString(" + JSONObject.quote(html) + ",'text/html'),a=d.querySelector('article[aria-label=\"Captured screening comparison\"]');return {title:d.title,purpose:d.querySelector('meta[name=investment-report-purpose]')?.content,appendix:a?.querySelector(':scope > details > pre')?.textContent,tables:a?.querySelectorAll('table').length,active:d.querySelectorAll('script,img,form,iframe,object').length,groups:[...a.querySelectorAll(':scope > section[aria-label]')].map(s=>[...s.querySelectorAll(':scope > section > h4')].map(h=>h.textContent))};})())"));
        JSONObject observed = new JSONObject(result); assertEquals("Financial screen comparison", observed.getString("title")); assertEquals("investment.screen-comparison-html", observed.getString("purpose"));
        assertEquals("Every captured source packet, view, identity, period and criterion survives complete native UTF-8 readback", capture.text(), observed.getString("appendix"));
        assertEquals(6, observed.getInt("tables")); assertEquals(0, observed.getInt("active"));
        JSONArray groups = observed.getJSONArray("groups"); assertEquals(2, groups.length());
        for(int i=0;i<2;i++) assertEquals(new JSONArray().put("Income statement").put("Balance sheet").put("Cash flow").toString(), groups.getJSONArray(i).toString());
    }
    private void researchAndBack(Original original) throws Exception {
        screenAction(ScreenAction.RESEARCH_ONE);
        page.await(new Check("exact seeded company Annual route and enabled Back have settled before one hardware Back", new Script("location.href==='https://localhost/?company=listing-one&section=annual'&&document.querySelector('#managed-company-heading')?.textContent==='Company research · ONE'&&document.querySelector('.managed-company-visit .trial-toolbar > button')?.disabled===false&&document.querySelector('.managed-annual-report')?.getAttribute('aria-busy')==='false'&&document.querySelector('.managed-annual-origin')?.textContent==='Showing the report loaded for financial screening. Original source and observation times are unchanged.'")).nativeReady());
        unchanged(original); keyboard.closeSoftKeyboard(); pressBack();
        page.await(new Check("single native Back retains the same screen and pair but permanently retires report capture", new Script("location.href==='https://localhost/'&&document.querySelector('.managed-company-visit')===null&&document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Discover'&&" + pairReady() + "&&document.querySelector('" + CAPTURED + "')===null")).nativeReady());
        unchanged(original); reportAction(ReportAction.CAPTURE);
        page.await(new Check("a fresh explicit capture after Back still has all six tables without another source call", new Script("document.querySelectorAll('" + CAPTURED + " table').length===6&&" + FILE + ".choices===2&&" + FILE + ".writes===1")));
        reportAction(ReportAction.CLOSE); page.await(new Check("explicit Close retires only the report", new Script("document.querySelector('" + CAPTURED + "')===null&&" + pairReady()))); unchanged(original);
    }
    private String pairReady() {
        return "document.querySelectorAll('.managed-screen-comparison-company').length===2&&[...document.querySelectorAll('.managed-screen-comparison-company > h5')].map(h=>h.textContent).join('|')==='Left company: ZERO · Zero Company|Right company: ONE · One Company'&&[...document.querySelectorAll('" + REPORT + " button')].find(b=>b.textContent==='Capture comparison report')?.disabled===false";
    }
    private void boundary(ReadPhase phase) throws Exception {
        page.await(new Check("source producer, disconnected origin and all read/write counters remain exact", new Script("location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content===" + JSONObject.quote(sourceSha) + "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===" + JSONObject.quote(CSP) + "&&" + COUNTS + ".load===1&&" + COUNTS + ".status===1&&" + COUNTS + ".marketsResolve===1&&" + COUNTS + ".resolve===" + phase.resolves() + "&&" + COUNTS + ".annual===" + phase.annual() + "&&" + COUNTS + ".save===0&&" + COUNTS + ".eod===0&&" + COUNTS + ".filings===0&&" + COUNTS + ".search===0&&" + COUNTS + ".calendar===0&&" + COUNTS + ".fed===0&&" + COUNTS + ".token===0&&" + COUNTS + ".signOut===0&&Object.keys(" + FILE + ".refused).length===10&&Object.values(" + FILE + ".refused).every(n=>n===0)")));
    }
    private void unchanged(Original original) throws Exception {
        boundary(ReadPhase.PAIRED); page.await(new Check("complete ordered unsaved Watchlist remains independently owned", new Script(FILE + ".watchlist.canonical===" + JSONObject.quote(original.watchlist) + "&&" + FILE + ".watchlist.dirty===true&&" + FILE + ".watchlist.baseVersion===1")));
    }
    private void retainHeaderFrame() throws Exception {
        page.read(new Script("(()=>{document.querySelector('" + CAPTURED + " > h4').scrollIntoView({block:'start',inline:'center',behavior:'instant'});window.scrollBy(0,-16);return 'captured header positioned';})()"));
        page.await(new Check("captured report and title are visible above fixed navigation for the scoped native frame", new Script("(()=>{const root=document.querySelector('" + CAPTURED + "'),v=visualViewport,n=document.querySelector('.managed-navigation')?.getBoundingClientRect(),lower=Math.min(v.offsetTop+v.height,n?.top??Infinity);return [root.querySelector(':scope > h4'),root.querySelector('article > h2')].every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e.checkVisibility()&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=lower&&(hit===e||e.contains(hit));});})()")).nativeReady());
        Log.i("ManagedScreenComparisonReportScope", "Captured report heading and title only; complete six tables, identities, criteria, source packets and independent dates checked functionally/read back. No whole-page scope.");
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, FollowupsReportFrameCapture.Frame.SCREEN_COMPARISON_PREVIEW)).retain();
    }
    private void screenAction(ScreenAction action) { page.click(Element.xpath("//section[contains(@class,'managed-financial-screen')]//button[normalize-space(.)='" + action.label() + "']")); }
    private void reportAction(ReportAction action) { page.click(Element.xpath("//section[@id='managed-screen-comparison-report']//button[normalize-space(.)='" + action.label() + "']")); }
    private void replaceNote() throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField("#managed-note-0", "independent comparison Watchlist note"));
        page.await(new Check("the real controlled note editor has native focus", new Script("document.activeElement===document.querySelector('#managed-note-0')")));
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection covers the complete prior note", new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "replace invented comparison note through native IME"; }
            public void perform(UiController controller, View view) { assertTrue(view.hasFocus()&&view.hasWindowFocus());android.view.inputmethod.InputConnection input=((WebView)view).onCreateInputConnection(new android.view.inputmethod.EditorInfo());assertNotNull(input);assertTrue(input.commitText(NOTE,1));controller.loopMainThreadUntilIdle(); }
        });
        page.await(new Check("complete Unicode note reaches only the controlled draft", new Script("document.querySelector('#managed-note-0')?.value===" + JSONObject.quote(NOTE)))); keyboard.closeSoftKeyboard();
    }
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    @After public void closeInventedCompleteComparison() throws Exception {
        try { if(scenario!=null) { scenario.close(); scenario=null; } }
        finally { try { WatchlistTestDocuments.clear(context()); } finally { if(assets!=null) assets.close(); } }
    }
}
