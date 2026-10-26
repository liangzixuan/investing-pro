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
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** The exact source pass retains dated evidence and an independently saved invented draft. */
@RunWith(AndroidJUnit4.class)
public class MarketsSourceReviewInstrumentedTest {
    private static final String ROOT = "#managed-markets-source-review";
    private static final String COUNTS = "JSON.parse(document.querySelector('#fixture-source-review-counts').textContent)";
    private static final String EVIDENCE = "JSON.parse(document.querySelector('#fixture-source-review-evidence').textContent)";
    private static final String BASE = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String NOTE = "Source review keeps this independent authored note. Café 東京 📈";
    private static final String ORDER = "price-0|price-1|price-2|bls|bea|fed";
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private String sourceSha;
    private record Retained(String draft, String sources, String origin) {}

    @Before public void launchInventedSourceReview() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha);
        assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.MARKETS_SOURCE_REVIEW);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("fixed source scenario starts with no implicit source or resource read beyond Watchlist/catalog", new Script(
            "document.querySelector('#fixture-source-review-counts')!==null && "+BASE+".load===1 && "+BASE+".status===1 && "+BASE+".marketsResolve===1 && "+COUNTS+".order.length===0")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        boundary(0);
    }
    @Test public void selectedSourcePassKeepsExactOrderClocksCancelBackAndSeparateSave() throws Exception {
        page.click(Element.css("#fixture-source-review-author-note"));
        page.await(new Check("the fixture authors only the complete independent Watchlist note", new Script(
            EVIDENCE+".draft.memberships[0].note==="+JSONObject.quote(NOTE)+" && "+DRAFT+".dirty===true && "+COUNTS+".order.length===0")));
        String draft = page.read(new Script("JSON.stringify("+EVIDENCE+".draft)"));
        openMarkets();
        String plan = previewCompletePlan();
        loadAllSix(plan);
        Retained retained = new Retained(draft, page.read(new Script(sources())), page.read(new Script("String(performance.timeOrigin)")));
        cancelRefreshAndSettle(retained);
        researchAndReturn(retained);
        saveIndependently(retained);
    }
    private void openMarkets() throws Exception {
        page.click(Element.xpath("//nav[contains(@class,'managed-navigation')]//button[normalize-space(.)='Markets']"));
        page.await(new Check("Markets retains the dirty Watchlist and exposes its initially closed source disclosure", new Script(
            "document.querySelector("+JSONObject.quote(ROOT)+")?.open===false && "+EVIDENCE+".selectedListingId==='listing-alfa' && "+DRAFT+".dirty===true")));
        page.click(Element.css(ROOT+" > summary"));
    }
    private String previewCompletePlan() throws Exception {
        page.click(Element.css("#markets-source-review-preview"));
        page.await(new Check("Preview lists all six exact Load actions without fetching", new Script(
            COUNTS+".order.length===0 && "+EVIDENCE+".review.phase==='preview' && "+EVIDENCE+".review.plan.map(r=>r.id).join('|')==="+JSONObject.quote(ORDER)+
            " && "+EVIDENCE+".review.plan.every(r=>r.mode==='load') && document.querySelector('#markets-source-review-start')?.disabled===false"+
            " && [...document.querySelectorAll('#markets-source-review-plan h4')].map(e=>e.textContent).join('|')==='Load ALFA price history|Load BETA price history|Load BETB price history|Load BLS release calendar|Load BEA release agenda|Load Federal Reserve announcements'"+
            " && "+EVIDENCE+".review.plan[1].identity.listingId==='listing-beta-a' && "+EVIDENCE+".review.plan[1].identity.shareClassId==='class-beta-a'"+
            " && "+EVIDENCE+".review.plan[2].identity.listingId==='listing-beta-c' && "+EVIDENCE+".review.plan[2].identity.shareClassId==='class-beta-c'")));
        return page.read(new Script("JSON.stringify("+EVIDENCE+".review.plan)"));
    }
    private void loadAllSix(String plan) throws Exception {
        page.click(Element.css("#markets-source-review-start"));
        page.await(new Check("six actual ordered source reads complete with checked-empty BLS and no selector retarget", new Script(
            COUNTS+".order.join('|')==="+JSONObject.quote(ORDER)+" && "+COUNTS+".prices===3 && "+COUNTS+".bls===1 && "+COUNTS+".bea===1 && "+COUNTS+".fed===1"+
            " && "+EVIDENCE+".review.phase==='complete' && "+EVIDENCE+".review.rows.map(r=>r.outcome).join('|')==='checked|checked|checked|checked_empty|checked|checked'"+
            " && "+EVIDENCE+".selectedListingId==='listing-alfa' && JSON.stringify("+EVIDENCE+".review.plan)==="+JSONObject.quote(plan))));
        page.await(new Check("every original source clock and unavailable publication time remains distinct", new Script(
            EVIDENCE+".markets.every(r=>r.response.requestStartedAt==='2026-09-20T00:00:00.000Z' && r.response.completedAt==='2026-09-20T00:00:01.000Z' && r.response.rows.at(-1).date==='2026-09-19')"+
            " && "+EVIDENCE+".bls.fetchedAt==='2026-10-20T18:00:00.000Z' && "+EVIDENCE+".bls.events.length===0"+
            " && "+EVIDENCE+".bea.fetchedAt==='2026-10-21T19:00:00.000Z' && "+EVIDENCE+".fed.fetchedAt==='2026-10-22T20:00:00.000Z' && "+EVIDENCE+".fed.items[1].publishedAt===null"+
            " && document.querySelector("+JSONObject.quote(ROOT)+")?.textContent.includes('Checked empty')")));
        boundary(0);
    }
    private void cancelRefreshAndSettle(Retained retained) throws Exception {
        for (String source : new String[]{"bls", "bea", "fed"}) page.click(Element.css("#markets-source-review-choice-"+source));
        page.click(Element.css("#markets-source-review-preview"));
        page.await(new Check("only explicit selected Refresh actions enter the second plan", new Script(
            EVIDENCE+".review.plan.map(r=>r.id).join('|')==='bls|bea|fed' && "+EVIDENCE+".review.plan.every(r=>r.mode==='refresh') && "+COUNTS+".order.join('|')==="+JSONObject.quote(ORDER))));
        page.click(Element.css("#markets-source-review-start"));
        page.await(new Check("one BLS refresh is held before any new BEA/Fed read", new Script(
            COUNTS+".bls===2 && "+COUNTS+".bea===1 && "+COUNTS+".fed===1 && "+EVIDENCE+".review.phase==='running'")));
        page.click(Element.css("#markets-source-review-cancel"));
        page.await(new Check("Cancel aborts only owned BLS, retains prior evidence and leaves later refreshes unattempted", new Script(
            COUNTS+".aborted===1 && "+EVIDENCE+".review.phase==='cancelled' && "+EVIDENCE+".review.rows.find(r=>r.id==='bls').outcome==='cancelled'"+
            " && "+EVIDENCE+".review.rows.find(r=>r.id==='bea').outcome==='retained' && "+EVIDENCE+".review.message.includes('remaining reads were not attempted')")));
        page.click(Element.css("#fixture-source-review-release-late"));
        page.await(new Check("the deliberate late BLS response cannot replace its original packet or start another read", new Script(
            COUNTS+".late===1 && "+COUNTS+".order.join('|')==="+JSONObject.quote(ORDER+"|bls-refresh")+" && "+EVIDENCE+".bls.fetchedAt==='2026-10-20T18:00:00.000Z'")));
        retain(retained);
    }
    private void researchAndReturn(Retained retained) throws Exception {
        page.click(Element.css("button[aria-label='Select BETA on company board']"));
        page.await(new Check("explicit BETA selection is current before its existing research action", new Script(
            EVIDENCE+".selectedListingId==='listing-beta-a' && document.querySelector(\"button[aria-label='Board price history for BETA']\")?.disabled===false")));
        page.click(Element.css("button[aria-label='Board price history for BETA']"));
        page.await(new Check("exact BETA research uses the board packet with no new source read", new Script(
            "location.href==='https://localhost/?company=listing-beta-a&section=price' && document.querySelector('#managed-company-heading')?.textContent==='Company research · BETA'"+
            " && JSON.stringify("+EVIDENCE+".price)===JSON.stringify("+EVIDENCE+".markets[1].response)")));
        retain(retained);
        page.await(new Check("current visible enabled Back is ready before one hardware action", new Script(
            "(()=>{const b=document.querySelector('.managed-company-visit .trial-toolbar > button');return b?.textContent==='Back to workspace' && b.disabled===false && b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && b.getClientRects().length===1;})()")).nativeReady());
        pressBack();
        page.await(new Check("Back restores Markets and retains all qualified packets and the independent draft", new Script(
            "location.href==='https://localhost/' && document.querySelector('.managed-company-visit')===null && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Markets'")));
        retain(retained);
    }
    private void saveIndependently(Retained retained) throws Exception {
        page.click(Element.xpath("//nav[contains(@class,'managed-navigation')]//button[normalize-space(.)='My Watchlist']"));
        page.await(new Check("Watchlist keeps the complete original authored draft before any Save", new Script(
            "document.querySelector('#managed-note-0')?.value==="+JSONObject.quote(NOTE)+" && JSON.stringify("+EVIDENCE+".draft)==="+JSONObject.quote(retained.draft)+" && "+COUNTS+".save===0")));
        page.click(Element.css("#managed-note-0-reading-toggle"));
        page.await(new Check("whole-note reading is independent of source review", new Script(
            "document.querySelector('#managed-note-0-reading-text')?.textContent==="+JSONObject.quote(NOTE))));
        page.click(Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']"));
        page.await(new Check("only explicit Save persists the full unchanged list as version2", new Script(
            DRAFT+".baseVersion===2 && "+DRAFT+".dirty===false && "+COUNTS+".save===1 && JSON.stringify("+EVIDENCE+".draft)==="+JSONObject.quote(retained.draft))));
        boundary(1);
        assertEquals(retained.origin, page.read(new Script("String(performance.timeOrigin)")));
    }
    private String sources() { return "JSON.stringify({markets:"+EVIDENCE+".markets.map(r=>r.response),bls:"+EVIDENCE+".bls,bea:"+EVIDENCE+".bea,fed:"+EVIDENCE+".fed})"; }
    private void retain(Retained retained) throws Exception {
        page.await(new Check("complete source packets and independent authored draft retain original bytes", new Script(
            sources()+"==="+JSONObject.quote(retained.sources)+" && JSON.stringify("+EVIDENCE+".draft)==="+JSONObject.quote(retained.draft)+" && "+DRAFT+".dirty===true && "+COUNTS+".save===0")));
        boundary(0);
    }
    private void boundary(int saves) throws Exception {
        page.await(new Check("fixed source/origin/CSP and unrelated read/save boundaries remain intact", new Script(
            "location.origin==='https://localhost' && document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            " && "+BASE+".token===0 && "+BASE+".signOut===0 && "+BASE+".annual===0 && "+BASE+".filings===0 && "+BASE+".eod===0 && "+BASE+".save==="+saves)));
    }
    @After public void closeInventedSourceReview() {
        try { if (scenario != null) {scenario.close();scenario=null;} }
        finally { if (assets != null) assets.close(); }
    }
}
