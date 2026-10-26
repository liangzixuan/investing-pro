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

/** Real capture, fixed bridge, system chooser, complete readback, hardware Back and independent Save/Load. */
@RunWith(AndroidJUnit4.class)
public class FollowupsReviewReportInstrumentedTest {
    private static final String D = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String WATCHLIST = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String FOLLOWUPS = "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-followups-report').textContent)";
    private static final String REPORT = "#managed-followups-review-report";
    private static final String FIRST_ID = "00000000-0000-4000-8000-000000000001";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private record Original(String resource, String watchlist, String origin) {}

    @Before public void launchInventedFollowupsReport() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.FOLLOWUPS_REVIEW_REPORT);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App"));
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentFollowupsReviewReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("source-bound invented report fixture starts with no implicit Follow-ups read", new Script(
            "document.querySelector('#fixture-followups-report')!==null && " + D + ".load===1 && " + D + ".status===1 && " + FOLLOWUPS + ".load===0 && document.querySelector('#managed-note-0')?.disabled===false")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(context());
    }

    @Test public void followupsReportSystemPickerKeepsCompleteDraftThroughBackAndSeparateSaveAndFreshLoad() throws Exception {
        Original original = authorAndChooseOneCheck();
        String capture = captureCompleteDraft(original);
        saveThroughRealChooser(original, capture);
        openResearchAndReturn(original);
        independentlySaveAndFreshlyLoad(original);
    }

    private Original authorAndChooseOneCheck() throws Exception {
        Original original = new Original(
            page.read(new Script("document.querySelector('#fixture-followups-report-original').textContent")),
            page.read(new Script("JSON.stringify(" + WATCHLIST + ")")),
            page.read(new Script("String(performance.timeOrigin)")));
        openFollowups();
        page.await(new Check("report disclosure begins closed and opening the view does not load", new Script(
            "document.querySelector('" + REPORT + "')?.open===false && " + FOLLOWUPS + ".load===0")));
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit independent Load admits the empty base", new Script(
            FOLLOWUPS + ".load===1 && " + DRAFT + ".baseVersion===0 && " + DRAFT + ".entries?.length===0")));
        page.click(Element.css("#fixture-followups-report-author"));
        page.await(new Check("explicit invented setup changes only the full local resource", new Script(
            "JSON.stringify({schemaVersion:1,entries:" + DRAFT + ".entries})===" + JSONObject.quote(original.resource) +
            " && " + DRAFT + ".dirty===true && " + DRAFT + ".filter==='open' && document.querySelectorAll('.managed-followup-choice').length===2 && " + FOLLOWUPS + ".save===0")));
        page.click(Element.css(".managed-followups-review > summary"));
        page.click(Element.css("#managed-followups-review-enter"));
        page.click(Element.css("#managed-followups-review-choose-" + FIRST_ID));
        page.click(Element.css("#managed-followups-review-start"));
        page.await(new Check("only the first due check is in the chosen daily set", new Script(
            "document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check 1 of 1.') && " + DRAFT + ".entries.length===3")));
        return original;
    }
    private String captureCompleteDraft(Original original) throws Exception {
        page.click(Element.css(REPORT + " > summary"));
        page.await(new Check("opening report disclosure leaves every source and save untouched", new Script(
            FOLLOWUPS + ".load===1 && " + FOLLOWUPS + ".save===0 && " + FILE + ".choices===0 && document.querySelector('#managed-followups-report-capture')?.disabled===false")));
        page.click(Element.css("#managed-followups-report-capture"));
        page.await(new Check("report captures all three entries despite open filter and single chosen check", new Script(
            "(() => {const t=document.querySelector('#managed-followups-report-json'),a=document.querySelector('#managed-followups-report-preview');" +
            "if(!t||!a)return false;const r=JSON.parse(t.value);return t.readOnly && r.kind==='followups_review' && r.baseVersion===0 && r.dirty===true && " +
            "r.currentCatalogSnapshotSha256==='sha256:'+'a'.repeat(64) && JSON.stringify(r.draft)===" + JSONObject.quote(original.resource) +
            " && a.querySelectorAll('section.fact').length===3 && a.querySelector('pre').textContent===t.value && a.querySelector('script,img,form,a')===null;})()")));
        assertNarrowControls();
        page.read(new Script("(()=>{document.querySelector('#managed-followups-report-preview').scrollIntoView({block:'start',inline:'center',behavior:'instant'});return 'preview positioned';})()"));
        page.await(new Check("complete preview heading is inside the native screenshot frame", new Script(
            "(()=>{const e=document.querySelector('#managed-followups-report-preview h2'),r=e?.getBoundingClientRect(),v=visualViewport;return e?.checkVisibility() && r.width>0 && r.height>0 && [r.left,r.top,r.right,r.bottom,v.width,v.height].every(Number.isFinite) && r.left>=v.offsetLeft && r.right<=v.offsetLeft+v.width && r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height;})()")).nativeReady());
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, FollowupsReportFrameCapture.Frame.CAPTURED)).retain();
        assertUnchanged(original, 0);
        return page.read(new Script("document.querySelector('#managed-followups-report-json').value"));
    }
    private void saveThroughRealChooser(Original original, String capture) throws Exception {
        page.click(Element.css("#managed-followups-report-save"));
        WatchlistSystemPicker picker = new WatchlistSystemPicker();
        picker.awaitOpen(30_000);
        picker.cancel();
        page.await(new Check("system Cancel keeps the complete captured report and does not write", new Script(
            FILE + ".choices===1 && " + FILE + ".writes===0 && document.querySelector('" + REPORT + " [role=status]')?.textContent.includes('cancelled') && document.querySelector('#managed-followups-report-json')?.value===" + JSONObject.quote(capture))));
        assertEquals(0, WatchlistTestDocuments.outputs(context()).length);
        assertUnchanged(original, 0);
        page.click(Element.css("#managed-followups-report-save"));
        new WatchlistSystemPicker().saveToInventedRoot();
        page.await(new Check("real writer confirms exactly one complete HTML file", new Script(
            FILE + ".choices===2 && " + FILE + ".writes===1 && document.querySelector('" + REPORT + " [role=status]')?.textContent==='Follow-ups report written to the chosen document.'")));
        new FollowupsReviewReportWrittenEvidence(new FollowupsReviewReportWrittenEvidence.Request(context(), page, original.resource, capture)).inspect();
        assertUnchanged(original, 0);
    }
    private void openResearchAndReturn(Original original) throws Exception {
        page.click(Element.css("#managed-followups-review-research"));
        page.await(new Check("exact company visit and visible Back are ready without source requests", new Script(
            "(()=>{const b=document.querySelector('.managed-company-visit .trial-toolbar > button'),r=b?.getBoundingClientRect();return " +
            "location.pathname==='/' && location.search==='?company=listing-zero&section=price' && location.hash==='' && " +
            "document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && b?.disabled===false && " +
            "b.textContent==='Back to workspace' && b.checkVisibility() && r.width>0 && r.height>0 && [r.left,r.top,r.width,r.height].every(Number.isFinite);})()")).nativeReady());
        assertUnchanged(original, 1);
        pressBack();
        page.await(new Check("one hardware Back keeps the chosen review and retires its report capture", new Script(
            "document.querySelector('.managed-company-visit')===null && location.search==='' && document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check 1 of 1.') && " +
            "document.querySelector('#managed-followups-report-preview')===null && document.querySelector('#managed-followups-report-save')===null && " + FILE + ".writes===1")).nativeReady());
        assertUnchanged(original, 1);
    }
    private void independentlySaveAndFreshlyLoad(Original original) throws Exception {
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("only explicit online Save commits the complete authored resource", new Script(
            FOLLOWUPS + ".save===1 && " + FOLLOWUPS + ".commits===1 && " + DRAFT + ".dirty===false && " + DRAFT + ".baseVersion===1 && " +
            "JSON.stringify(" + DRAFT + ".saved.payload)===" + JSONObject.quote(original.resource) + " && " + D + ".save===0 && " + FILE + ".writes===1")));
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh local session starts with no loaded Follow-ups draft", new Script(
            FOLLOWUPS + ".session===2 && " + D + ".load===2 && " + D + ".status===2 && " + DRAFT + ".entries===null")));
        openFollowups();
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("independent fresh Load returns the entire exact saved resource", new Script(
            FOLLOWUPS + ".load===2 && " + FOLLOWUPS + ".save===1 && " + FOLLOWUPS + ".commits===1 && " + DRAFT + ".baseVersion===1 && " + DRAFT + ".dirty===false && " +
            "JSON.stringify({schemaVersion:1,entries:" + DRAFT + ".entries})===" + JSONObject.quote(original.resource) +
            " && JSON.stringify(" + DRAFT + ".saved.payload)===" + JSONObject.quote(original.resource) +
            " && JSON.stringify(" + WATCHLIST + ")===" + JSONObject.quote(original.watchlist) + " && " + D + ".save===0 && " + D + ".eod===0 && " + D + ".annual===0 && " + D + ".filings===0")));
        assertEquals(1, WatchlistTestDocuments.outputs(context()).length);
        assertEquals("Capture, native file delivery, Back and fresh session keep the same mounted document", original.origin, page.read(new Script("String(performance.timeOrigin)")));
    }
    private void openFollowups() { page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']")); }
    private void assertUnchanged(Original original, int resolves) throws Exception {
        page.await(new Check("complete original resource and Watchlist persist without automatic source reads or saves", new Script(
            "JSON.stringify({schemaVersion:1,entries:" + DRAFT + ".entries})===" + JSONObject.quote(original.resource) +
            " && JSON.stringify(" + WATCHLIST + ")===" + JSONObject.quote(original.watchlist) + " && " + DRAFT + ".dirty===true && " +
            FOLLOWUPS + ".load===1 && " + FOLLOWUPS + ".save===0 && " + FOLLOWUPS + ".commits===0 && " + D + ".save===0 && " + D + ".eod===0 && " +
            D + ".annual===0 && " + D + ".filings===0 && " + D + ".resolve===" + resolves + " && " + D + ".token===0 && " + D + ".signOut===0")));
    }
    private void assertNarrowControls() throws Exception {
        page.await(new Check("all labelled report controls fit the native 412 CSS pixel frame", new Script(
            "(()=>{const w=document.documentElement.clientWidth,t=document.querySelector('#managed-followups-report-json');return w===412 && document.documentElement.scrollWidth<=w+1 && t.labels.length===1 && " +
            "[...document.querySelectorAll('" + REPORT + " button')].every(e=>{const r=e.getBoundingClientRect();return e.textContent.trim().length>0 && [r.left,r.right,r.width,r.height].every(Number.isFinite) && r.height>=44 && r.left>=0 && r.right<=w+1;});})()")));
    }
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    @After public void closeInventedFollowupsReport() throws Exception {
        try { if (scenario != null) { scenario.close(); scenario = null; } }
        finally { try { WatchlistTestDocuments.clear(context()); } finally { if (assets != null) assets.close(); } }
    }
}