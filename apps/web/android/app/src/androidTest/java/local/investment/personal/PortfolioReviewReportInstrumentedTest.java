package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static org.junit.Assert.*;

import android.content.Context;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real formatter, adapter, system chooser and chosen output; all ledger/source data is invented. */
@RunWith(AndroidJUnit4.class)
public class PortfolioReviewReportInstrumentedTest {
    private static final String D = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String WATCHLIST = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String PORTFOLIO = "JSON.parse(document.querySelector('#fixture-portfolio-state').textContent)";
    private static final String LEDGER = "JSON.parse(document.querySelector('#fixture-portfolio-draft').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-portfolio-report').textContent)";
    private static final String CLOSE = "section[aria-label='Dated Portfolio holdings review']";
    private static final String REPORT = ".managed-portfolio-review-report";
    private static final String CAPTURE = "article[aria-label='Captured Portfolio holdings review']";
    private record LedgerEvidence(String ledger, String watchlist) {}
    private record CaptureEvidence(String archive, LedgerEvidence drafts) {}
    private record ObservedDate(String value) {}
    private record ReportReturn(ObservedDate current, ObservedDate previous, LedgerEvidence drafts) {}
    private record CapturedSource(String preparedAt, JSONObject response) {}
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;

    @Before public void launchInventedPortfolioReport() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_REVIEW_REPORT);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        scenario.onActivity(activity -> {
            assertDisconnectedIdentity(activity);
            assertWebViewGuards(activity);
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new ReportRevisitPage.Check("source-bound report fixture starts with no implicit reads", new ReportRevisitPage.Script("document.querySelector('#fixture-portfolio-report')!==null && " + D + ".load===1 && " + D + ".status===1 && " + D + ".eod===0 && document.querySelector('#managed-note-0')?.disabled===false")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(context());
    }

    private void assertDisconnectedIdentity(MainActivity activity) {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentPortfolioReviewReport"));
    }
    private void assertWebViewGuards(MainActivity activity) {
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
    }

    @Test public void portfolioReportSystemPickerKeepsExactValuesSourcesAndSeparateSaveThroughBack() throws Exception {
        String origin = page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)"));
        String watchlist = page.read(new ReportRevisitPage.Script("JSON.stringify(" + WATCHLIST + ")"));
        LedgerEvidence drafts = new LedgerEvidence(loadAndAuthorLedger(), watchlist);
        openClosesAndCapture();
        ObservedDate currentDate = new ObservedDate(page.read(new ReportRevisitPage.Script("document.querySelector('#managed-portfolio-close-date').value")));
        ObservedDate previousDate = new ObservedDate(page.read(new ReportRevisitPage.Script("document.querySelector('#managed-portfolio-close-date').options[1].value")));
        String archive = page.read(new ReportRevisitPage.Script("document.querySelector(\"" + CAPTURE + " pre\").textContent"));
        CaptureEvidence capture = new CaptureEvidence(archive, drafts);
        assertCaptureLedger(capture);
        reportButton(ReportAction.SAVE);
        WatchlistSystemPicker picker = new WatchlistSystemPicker();
        picker.awaitOpen(30_000);
        picker.cancel();
        page.await(new ReportRevisitPage.Check("system Cancel retains capture and both complete drafts", new ReportRevisitPage.Script( FILE + ".choices===1 && " + FILE + ".writes===0 && document.querySelector(\"" + REPORT + " [role=status]\")?.textContent.includes('cancelled') && document.querySelector(\"" + CAPTURE + "\")!==null")));
        assertEquals(0, WatchlistTestDocuments.outputs(context()).length);
        assertUnchanged(drafts);
        reportButton(ReportAction.SAVE);
        new WatchlistSystemPicker().saveToInventedRoot();
        page.await(new ReportRevisitPage.Check("real native writer confirms one complete HTML write", new ReportRevisitPage.Script( FILE + ".choices===2 && " + FILE + ".writes===1 && document.querySelector(\"" + REPORT + " [role=status]\")?.textContent==='Portfolio report written to the chosen document.'")));
        new PortfolioReviewReportWrittenEvidence(new PortfolioReviewReportWrittenEvidence.Request(context(), page, capture.archive)).inspect();
        assertUnchanged(drafts);
        invalidateAndReturnFromResearch(new ReportReturn(currentDate, previousDate, drafts));
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-review"));
        page.await(new ReportRevisitPage.Check("Portfolio still requires separate complete review before Save", new ReportRevisitPage.Script( "document.querySelector('.managed-portfolio-review')!==null && " + PORTFOLIO + ".save===0")));
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-save"));
        page.await(new ReportRevisitPage.Check("only explicit Portfolio Save commits the authored ledger", new ReportRevisitPage.Script( PORTFOLIO + ".save===1 && " + PORTFOLIO + ".commits===1 && " + LEDGER + ".dirty===false && " + D + ".save===0 && " + D + ".eod===1 && JSON.stringify(" + WATCHLIST + ")===" + JSONObject.quote(watchlist))));
        assertEquals("Report capture, file save and native Back retain the mounted document", origin, page.read(new ReportRevisitPage.Script("String(performance.timeOrigin)")));
    }

    private String loadAndAuthorLedger() throws Exception {
        page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Portfolio']"));
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-load"));
        page.await(new ReportRevisitPage.Check("explicit Portfolio Load admits the empty real model", new ReportRevisitPage.Script( PORTFOLIO + ".load===1 && " + LEDGER + ".baseVersion===0 && " + LEDGER + ".ledger===null")));
        page.click(ReportRevisitPage.Element.css("#fixture-portfolio-report-author"));
        page.await(new ReportRevisitPage.Check("explicit invented setup admits opening holding, buy and sell without Save or sources", new ReportRevisitPage.Script( LEDGER + ".ledger?.opening.holdings.length===1 && " + LEDGER + ".ledger.transactions.map(x=>x.type).join('|')==='buy|sell' && " + LEDGER + ".dirty===true && " + PORTFOLIO + ".save===0 && " + D + ".eod===0")));
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-review-identities"));
        page.await(new ReportRevisitPage.Check("the complete current identity resolves only on explicit review", new ReportRevisitPage.Script( D + ".resolve===1 && [...document.querySelectorAll('.managed-portfolio button')].some(e=>e.textContent==='Apply reviewed identities' && !e.disabled)")));
        page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-portfolio')]//button[normalize-space(.)='Apply reviewed identities']"));
        page.await(new ReportRevisitPage.Check("catalog approval retains the complete local ledger", new ReportRevisitPage.Script( "document.querySelector('.managed-portfolio [role=status]')?.textContent.includes('Portfolio identities reviewed') && " + PORTFOLIO + ".save===0")));
        return page.read(new ReportRevisitPage.Script("JSON.stringify(" + LEDGER + ".ledger)"));
    }

    private void openClosesAndCapture() throws Exception {
        page.click(ReportRevisitPage.Element.css(".managed-portfolio-close-review > summary"));
        page.await(new ReportRevisitPage.Check("disclosure opening makes no source read", new ReportRevisitPage.Script( D + ".eod===0 && document.querySelector(\"" + CLOSE + " .ledger-actions button\")?.disabled===false")));
        page.click(ReportRevisitPage.Element.css(CLOSE + " .ledger-actions button:first-child"));
        page.await(new ReportRevisitPage.Check("one explicit raw-close request prices exactly two shares plus authored cash", new ReportRevisitPage.Script( D + ".eod===1 && document.querySelector(\"" + CLOSE + "\").textContent.includes('USD 220.50') && document.querySelector(\"" + CLOSE + "\").textContent.includes('USD 1168.50')")));
        reportButton(ReportAction.CAPTURE);
        page.await(new ReportRevisitPage.Check("complete capture shows values, opening pool and ordered buy/sell", new ReportRevisitPage.Script( "(() => {const a=document.querySelector(\"" + CAPTURE + "\");return a && ['USD 220.50','USD 948.00','USD 1168.50','1000.00','50.00','201.00','invented-report-buy','invented-report-sell','Tiingo','raw_close','Request started','Completed','Complete authored ledger','Complete report document and source packets'].every(x=>a.textContent.includes(x));})()")));
        assertNarrowReport();
        new PortfolioReportFrameCapture(new PortfolioReportFrameCapture.Request(scenario, PortfolioReportFrameCapture.Frame.CAPTURED)).retain();
    }

    private void assertCaptureLedger(CaptureEvidence capture) throws Exception {
        JSONObject report = new JSONObject(capture.archive);
        assertEquals(new JSONObject(capture.drafts.ledger).toString(), report.getJSONObject("ledger").toString());
        assertCapturedValues(report.getJSONObject("review"));
        JSONObject response = report.getJSONArray("sourceRows").getJSONObject(0).getJSONObject("response");
        assertCapturedSourceIdentity(response);
        assertCapturedSourceClocks(new CapturedSource(report.getString("preparedAt"), response));
    }
    private void assertCapturedValues(JSONObject review) throws Exception {
        assertEquals("220.50", review.getString("holdingsValueUsd"));
        assertEquals("948.00", review.getString("cashUsd"));
        assertEquals("1168.50", review.getString("totalValueUsd"));
    }
    private void assertCapturedSourceIdentity(JSONObject response) throws Exception {
        assertEquals("Tiingo", response.getString("provider"));
        assertEquals("raw_close", response.getString("priceBasis"));
        assertEquals("USD", response.getString("currency"));
    }
    private void assertCapturedSourceClocks(CapturedSource source) throws Exception {
        assertNotEquals(source.preparedAt, source.response.getString("requestStartedAt"));
        assertTrue(source.response.getString("completedAt").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z"));
        assertEquals(2, source.response.getJSONArray("rows").length());
    }

    private void invalidateAndReturnFromResearch(ReportReturn evidence) throws Exception {
        reportButton(ReportAction.CLOSE);
        page.await(new ReportRevisitPage.Check("explicit close removes private preview", new ReportRevisitPage.Script( "document.querySelector(\"" + CAPTURE + "\")===null && " + FILE + ".writes===1")));
        reportButton(ReportAction.CAPTURE);
        selectDate(evidence.previous);
        page.await(new ReportRevisitPage.Check("changing selected observed date withdraws the previous capture and save control", new ReportRevisitPage.Script( "document.querySelector(\"" + CAPTURE + "\")===null && ![...document.querySelectorAll(\"" + REPORT + " button\")].some(e=>e.textContent==='Save report (HTML)') && " + FILE + ".choices===2")));
        selectDate(evidence.current);
        reportButton(ReportAction.CAPTURE);
        page.await(new ReportRevisitPage.Check("fresh capture after a date change needs no additional source request", new ReportRevisitPage.Script( "document.querySelector(\"" + CAPTURE + "\")!==null && " + D + ".eod===1")));
        page.click(ReportRevisitPage.Element.css(CLOSE + " tbody button"));
        page.await(new ReportRevisitPage.Check("exact Research route and visible enabled Back settle without reading sources", new ReportRevisitPage.Script(
            "(() => { const back=document.querySelector('.managed-company-visit .trial-toolbar > button'), rect=back?.getBoundingClientRect(); return " +
            "document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && new URL(location.href).searchParams.get('company')==='listing-zero' && new URL(location.href).searchParams.get('section')==='price' && " + D + ".eod===1 && " + D + ".annual===0 && " + D + ".filings===0" +
            " && back?.disabled===false && back.textContent==='Back to workspace' && rect.width>0 && rect.height>0 && getComputedStyle(back).visibility==='visible'; })()"
        )).nativeReady());
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        page.await(new ReportRevisitPage.Check("native Back restores Portfolio with private captures closed", new ReportRevisitPage.Script("document.querySelector('.managed-company-visit')===null && document.querySelector('.managed-portfolio-close-review')?.open===false && document.querySelector(\"" + CAPTURE + "\")===null")).nativeReady());
        assertUnchanged(evidence.drafts);
    }

    private void assertUnchanged(LedgerEvidence evidence) throws Exception {
        page.await(new ReportRevisitPage.Check("whole ledgers and independent Watchlist remain unchanged without implicit requests or saves", new ReportRevisitPage.Script( "JSON.stringify(" + LEDGER + ".ledger)===" + JSONObject.quote(evidence.ledger) + " && JSON.stringify(" + WATCHLIST + ")===" + JSONObject.quote(evidence.watchlist) + " && " + PORTFOLIO + ".save===0 && " + D + ".save===0 && " + D + ".eod===1 && " + D + ".annual===0 && " + D + ".filings===0 && " + D + ".token===0 && " + D + ".signOut===0 && " + FILE + ".choices<=2")));
    }
    private void assertNarrowReport() throws Exception {
        page.await(new ReportRevisitPage.Check("report values and labelled controls fit the 412 CSS pixel native frame", new ReportRevisitPage.Script( "(() => {const a=document.querySelector(\"" + CAPTURE + "\"),s=document.querySelector('#managed-portfolio-close-date'),w=document.documentElement.clientWidth;return w===412 && document.documentElement.scrollWidth<=w+1 && s.labels.length===1 && [s,...document.querySelectorAll(\"" + REPORT + " button\")].every(e=>{const r=e.getBoundingClientRect();return r.height>=44 && r.left>=0 && r.right<=w+1;}) && a.querySelector('script')===null && a.textContent.includes('Zero <script>alert(1)</script> & Company');})()")));
    }
    private enum ReportAction {
        CAPTURE("Capture holdings report"), SAVE("Save report (HTML)"), CLOSE("Close captured report");
        final ReportRevisitPage.Element target;
        ReportAction(String label) { target = ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-portfolio-review-report')]//button[normalize-space(.)='" + label + "']"); }
    }
    private void reportButton(ReportAction action) { page.click(action.target); }
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }

    private void selectDate(ObservedDate date) throws Exception {
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            assertTrue("Date select WebView accepts native focus", webView.requestFocus());
        });
        assertEquals("managed-portfolio-close-date", page.read(new ReportRevisitPage.Script("(() => {const s=document.querySelector('#managed-portfolio-close-date');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return s.id;})()")));
        page.await(new ReportRevisitPage.Check("exact enabled observed-date select retains focus", new ReportRevisitPage.Script("document.activeElement===document.querySelector('#managed-portfolio-close-date') && document.activeElement.disabled===false && [...document.activeElement.options].some(o=>o.value===" + JSONObject.quote(date.value) + " && !o.disabled)")).nativeReady());
        onView(isAssignableFrom(WebView.class)).check((view, missing) -> {
            if (missing != null) throw missing;
            assertTrue(view.hasFocus() && view.hasWindowFocus());
        }).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(date.value)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); })
            .perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull("Observed native date dialog", dialog.get());
        page.await(new ReportRevisitPage.Check("native selected date applies and exact dialog disappears", new ReportRevisitPage.Script("document.querySelector('#managed-portfolio-close-date').value===" + JSONObject.quote(date.value)), ReportRevisitPage.Readiness.NATIVE, dialog.get()));
    }

    @After public void closeInventedPortfolioReport() throws Exception {
        try {
            if (scenario != null) { scenario.close(); scenario = null; }
        } finally {
            WatchlistTestDocuments.clear(context());
            if (assets != null) assets.close();
        }
    }
}
