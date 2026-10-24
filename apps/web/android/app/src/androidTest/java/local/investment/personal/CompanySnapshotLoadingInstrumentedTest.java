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

/** Invented source packets and explicit fixture-authored note; real workspace, source models and Back. */
@RunWith(AndroidJUnit4.class)
public class CompanySnapshotLoadingInstrumentedTest {
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
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.COMPANY_SNAPSHOT_LOADING);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        scenario.onActivity(activity -> {
            verifyDisconnectedIdentity(activity);
            verifyWebViewGuards(activity);
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new ReportRevisitPage.Check("source-bound invented scenario starts without source reads", new ReportRevisitPage.Script("document.querySelector('#fixture-company-snapshot-evidence')!==null && " + COUNTS + ".load===1 && " + COUNTS + ".status===1 && document.querySelector('#managed-note-0')?.disabled===false && " + zeroSources())).nativeReady());
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
