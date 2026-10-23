package local.investment.personal;

import static org.junit.Assert.*;

import android.webkit.WebSettings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real system chooser and report-revisit UI, invented test-APK files and RAM stores only. */
@RunWith(AndroidJUnit4.class)
public class CompanyReportRevisitInstrumentedTest {
    private static final String D = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-revisit-file').textContent)";
    private static final String REVISIT = ".managed-report-revisit";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    @Before public void launchInventedReportRevisit() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        assets = new ReportRevisitFixtureAssets();
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        touch = new ReportRevisitTouch(page);
        keyboard = new ReportRevisitKeyboard(page, touch);
        scenario.onActivity(activity -> {
            keyboard.observe(activity);
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new ReportRevisitPage.Check("source-bound invented fixture with no source reads", new ReportRevisitPage.Script("document.querySelector('#fixture-revisit-file')!==null && " + D + ".load===1 && " + D + ".status===1 && document.querySelector('#managed-note-0')?.disabled===false")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(InstrumentationRegistry.getInstrumentation().getTargetContext());
    }
    @Test public void savedReportRevisitUsesLargeFileChooserAndExplicitWatchlistSave() throws Exception {
        String before = page.read(new ReportRevisitPage.Script("JSON.stringify(" + DRAFT + ")"));
        page.click(ReportRevisitPage.Element.css("#fixture-revisit-save"));
        new WatchlistSystemPicker().saveToInventedRoot();
        page.await(new ReportRevisitPage.Check("invented large current-format report actually written", new ReportRevisitPage.Script(FILE + ".phase==='written' && " + FILE + ".byteLength>266240 && " + FILE + ".byteLength<2850816")));
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(InstrumentationRegistry.getInstrumentation().getTargetContext());
        assertEquals(1, outputs.length);
        String filename = page.read(new ReportRevisitPage.Script(FILE + ".filename"));
        assertEquals(filename, outputs[0].name);
        byte[] bytes = WatchlistTestDocuments.readReport(InstrumentationRegistry.getInstrumentation().getTargetContext(), outputs[0]);
        assertTrue(bytes.length > 266_240 && bytes.length < 2_850_816);
        JSONObject archive = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        assertEquals("5.0.0", archive.getString("schemaVersion"));
        assertEquals(300_000, archive.getJSONObject("sources").getJSONObject("annual").getJSONObject("statements").getString("opaqueInventedPadding").length());
        page.requireUnchanged(new ReportRevisitPage.Draft(before, ReportRevisitPage.AnnualReads.NONE));
        page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(ReportRevisitPage.Element.css("button[aria-label='Annual report for saved ZERO']"));
        page.await(new ReportRevisitPage.Check("the exact current company opens without loading sources", new ReportRevisitPage.Script("document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && " + D + ".resolve===0 && " + D + ".marketsResolve===1 && " + D + ".marketsEod===0")));
        page.click(ReportRevisitPage.Element.css(".managed-company-report > summary"));
        page.click(ReportRevisitPage.Element.css(REVISIT + " > summary"));
        touch.fileChooser();
        new WatchlistSystemPicker().cancel();
        page.await(new ReportRevisitPage.Check("native chooser Cancel keeps report state and complete draft unchanged", new ReportRevisitPage.Script("document.querySelector('#managed-report-revisit-heading')===null && document.querySelector('.managed-report-revisit input[type=file]')?.value===''")));
        page.requireUnchanged(new ReportRevisitPage.Draft(before, ReportRevisitPage.AnnualReads.NONE));
        touch.fileChooser();
        new WatchlistSystemPicker().openInventedReportDocument(filename);
        String archivedNote = archive.getJSONObject("authoredResearch").getString("note");
        String annualTime = archive.getJSONObject("sources").getJSONObject("annual").getJSONObject("response").getJSONObject("evidence").getJSONObject("generation").getString("completedAt");
        page.await(new ReportRevisitPage.Check("full archived note, exact company identity and original report/source times admitted", new ReportRevisitPage.Script("(() => {const section=document.querySelector('[aria-label=\"Archived report\"]');const t=section?.textContent??'';return document.querySelector('#managed-report-revisit-heading')?.textContent==='Reopened report · ZERO' && section?.querySelector('.managed-company-report-note')?.textContent===" + JSONObject.quote(archivedNote) + " && t.includes('2026-10-15T00:00:00.000Z') && t.includes(" + JSONObject.quote(annualTime) + ") && ['US','XNAS','common_stock','issuer-zero','Zero Company','listing-zero','security-zero','Zero Class A','class-zero','Class A','ZERO','0000000001'].every(value=>t.includes(value)) && document.querySelector('[aria-label=\"Current report capture\"]')===null;})()")));
        page.requireUnchanged(new ReportRevisitPage.Draft(before, ReportRevisitPage.AnnualReads.NONE));
        page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-annual-report')]//button[normalize-space(.)='Load annual report']"));
        page.await(new ReportRevisitPage.Check("only explicit current Annual load supplies current evidence", new ReportRevisitPage.Script(D + ".annual===1 && " + D + ".resolve===0 && " + D + ".marketsResolve===1 && " + D + ".marketsEod===0 && document.querySelector('.sec-quarterly-comparison')!==null")));
        page.click(ReportRevisitPage.Element.revisit("Capture current report for comparison"));
        page.await(new ReportRevisitPage.Check("current capture preserves original draft note and canonical source dates", new ReportRevisitPage.Script("document.querySelector('[aria-label=\"Current report capture\"]')?.textContent.includes(" + JSONObject.quote(annualTime) + ")===true && document.querySelector('.managed-report-revisit textarea:not([readonly])')?.value===''")));
        keyboard.enter(new ReportRevisitKeyboard.Edit(ReportRevisitKeyboard.Assessment.SUPERSEDED, ReportRevisitKeyboard.Assessment.EMPTY));
        page.click(ReportRevisitPage.Element.revisit("Preview comparison note"));
        page.await(new ReportRevisitPage.Check("first complete note preview exists without append or Save", new ReportRevisitPage.Script("document.querySelector('[aria-label=\"Complete comparison note preview\"]')?.textContent.includes('Draft assessment superseded')===true")));
        keyboard.enter(new ReportRevisitKeyboard.Edit(ReportRevisitKeyboard.Assessment.FINAL, ReportRevisitKeyboard.Assessment.SUPERSEDED));
        page.await(new ReportRevisitPage.Check("editing assessment invalidates the previous entire append proposal", new ReportRevisitPage.Script("document.querySelector('[aria-label=\"Complete comparison note preview\"]')===null")));
        page.click(ReportRevisitPage.Element.revisit("Preview comparison note"));
        page.await(new ReportRevisitPage.Check("replacement assessment has a new complete preview", new ReportRevisitPage.Script("document.querySelector('[aria-label=\"Complete comparison note preview\"] .managed-company-report-note')?.textContent.includes('Authored assessment: Archived liquidity needs a new review')===true")));
        String preview = page.read(new ReportRevisitPage.Script("document.querySelector('[aria-label=\"Complete comparison note preview\"] .managed-company-report-note').textContent"));
        JSONObject initial = new JSONObject(before);
        String oldNote = initial.getJSONArray("memberships").getJSONObject(0).getString("note");
        assertTrue(preview.startsWith(oldNote + " ZERO XNAS report revisit assessed "));
        assertTrue(preview.contains("archived report prepared 2026-10-15T00:00:00.000Z; current report prepared "));
        assertTrue(preview.contains("Authored assessment: Archived liquidity needs a new review"));
        assertFalse(preview.contains("Draft assessment superseded"));
        assertTrue(preview.codePointCount(0, preview.length()) <= 2000);
        page.requireUnchanged(new ReportRevisitPage.Draft(before, ReportRevisitPage.AnnualReads.ONE));
        page.click(ReportRevisitPage.Element.revisit("Append comparison to note draft"));
        page.await(new ReportRevisitPage.Check("append changes only the selected whole note once, with no online Save", new ReportRevisitPage.Script(DRAFT + ".memberships[0].note===" + JSONObject.quote(preview) + " && " + DRAFT + ".memberships[1].note==='Invented second note' && " + DRAFT + ".memberships.map(x=>x.listingId).join('|')==='listing-zero|listing-one' && " + DRAFT + ".dirty===true && " + D + ".save===0 && document.querySelector('[aria-label=\"Complete comparison note preview\"]')===null && " + DRAFT + ".memberships[0].note.split('report revisit assessed ').length===2")));
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-research-note-heading']//button[normalize-space(.)='Review in My Watchlist']"));
        page.await(new ReportRevisitPage.Check("explicit Watchlist review retains the complete note before independent Save", new ReportRevisitPage.Script("document.querySelector('.managed-company-visit')===null && " + DRAFT + ".memberships[0].note===" + JSONObject.quote(preview) + " && " + D + ".save===0")));
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']"));
        page.await(new ReportRevisitPage.Check("one complete independent Save acknowledges version2", new ReportRevisitPage.Script(D + ".save===1 && " + DRAFT + ".baseVersion===2 && " + DRAFT + ".dirty===false")));
        page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']"));
        page.await(new ReportRevisitPage.Check("fresh explicit saved read retains exact note, identity order and unrelated note", new ReportRevisitPage.Script(D + ".load===2 && " + D + ".save===1 && " + DRAFT + ".memberships[0].note===" + JSONObject.quote(preview) + " && " + DRAFT + ".memberships[1].note==='Invented second note' && " + DRAFT + ".memberships.map(x=>x.listingId).join('|')==='listing-zero|listing-one' && " + DRAFT + ".dirty===false && " + D + ".annual===1 && " + D + ".resolve===0 && " + D + ".marketsResolve===1 && " + D + ".marketsEod===0 && " + D + ".eod===0 && " + D + ".filings===0 && " + D + ".token===0 && " + D + ".signOut===0")));
    }
    @After public void closeInventedReportRevisit() throws Exception {
        if (scenario != null) { scenario.close(); scenario = null; }
        WatchlistTestDocuments.clear(InstrumentationRegistry.getInstrumentation().getTargetContext());
        if (assets != null) assets.close();
    }
}
