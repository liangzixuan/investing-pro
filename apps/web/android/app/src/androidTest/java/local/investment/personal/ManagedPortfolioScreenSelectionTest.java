package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
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
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** Invented five-holding ledger; the real cohort, explicit class choice, paced run and return. */
@RunWith(AndroidJUnit4.class)
public class ManagedPortfolioScreenSelectionTest {
    private static final String OBS = "JSON.parse(document.querySelector('#fixture-portfolio-screen-selection').textContent)";
    private static final String CHOICE = "#managed-portfolio-screen-choice-0";
    private static final String THRESHOLD = ".managed-screen-clause input[type=text]";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String stage = "startup";

    @Before public void launchInventedHoldings() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        String sha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sha); assertTrue(sha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_SCREEN_SELECTION);
        assets.prepare(); scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario); touch = new ReportRevisitTouch(page); keyboard = new ReportRevisitKeyboard(page, touch);
        scenario.onActivity(activity -> {
            assertNotNull(activity.getBridge().getPlugin("App")); assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity); activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("Portfolio starts with catalog only, all personal records unloaded and no Annual", new Script(
            "document.querySelector('#fixture-portfolio-screen-selection')!==null&&" + OBS + ".counts.status===1&&" + OBS + ".counts.portfolioLoad===0&&" + OBS + ".counts.resolve===0&&" + OBS + ".counts.annual===0&&" + OBS + ".counts.rejected===0&&" + OBS + ".portfolio.ledger==null&&document.querySelector('#managed-portfolio-load')!==null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
    }

    @Test public void portfolioDraftSelectsExactShareClassScreenAndRetainsEvidenceAcrossResearchBack() throws Exception {
        try { completeJourney(); } catch (Exception | AssertionError failure) { diagnose(); throw failure; }
    }
    private void completeJourney() throws Exception {
        stage = "explicit Portfolio load and current identity review";
        click("#managed-portfolio-load");
        page.await(new Check("whole five-holding ledger loads at independent base three", new Script(OBS + ".portfolio.baseVersion===3&&" + OBS + ".portfolio.dirty===false&&" + OBS + ".portfolio.ledger.opening.holdings.length===5&&" + OBS + ".counts.portfolioLoad===1")));
        click("#managed-portfolio-review-identities"); button("Apply reviewed identities");
        click("#fixture-portfolio-screen-author");
        page.await(new Check("current reviewed Portfolio has the complete independent unsaved cash change", new Script(OBS + ".authored&&" + OBS + ".portfolio.dirty&&" + OBS + ".canonical===" + OBS + ".expectedCanonical&&" + OBS + ".portfolio.ledger.opening.cashUsd==='1500.00'&&" + OBS + ".counts.resolve===1")));
        nav("Discover"); button("Load screening cohort");
        page.await(new Check("all eighteen exact cohort listings load without Annual and include uncovered UHAL", new Script(OBS + ".screen.memberships.length===18&&" + OBS + ".counts.resolve===2&&" + OBS + ".counts.annual===0&&document.querySelectorAll('.managed-screen-cohort input').length===18")));
        click("#managed-portfolio-screen-open");
        page.await(new Check("all five projected holdings and full identity fields are available before an empty explicit class choice", new Script(holdingReadout(false) + "&&document.querySelector('" + CHOICE + "')?.value===''&&document.querySelector('#managed-portfolio-screen-prepare')?.disabled===true")));
        stage = "real native held share-class choice"; chooseGoogl();
        stage = "raw invalid criteria stays staged until an explicit valid Apply";
        button("Add criterion"); replaceThreshold("invalid raw threshold");
        page.await(new Check("invalid raw text disables Portfolio preview without reading Annual", new Script("document.querySelector('" + THRESHOLD + "')?.value==='invalid raw threshold'&&document.querySelector('#managed-portfolio-screen-prepare')?.disabled===true&&" + OBS + ".counts.annual===0")));
        replaceThreshold("0.00"); button("Apply criteria");
        click("#fixture-portfolio-screen-capture");
        page.await(new Check("valid exact raw criteria and sort are explicitly applied without a source read", new Script(OBS + ".captured&&" + OBS + ".screen.criteria.clauses[0].field==='operatingCashFlow'&&" + OBS + ".screen.criteria.clauses[0].value==='0.00'&&" + OBS + ".screen.criteria.sort.field==='symbol'&&" + OBS + ".screen.criteria.sort.direction==='asc'&&" + OBS + ".counts.annual===0")));
        stage = "whole ordered preview and exclusions"; click("#managed-portfolio-screen-prepare");
        page.await(new Check("full preview focuses its heading and includes both selected identities and every exclusion", new Script(
            "document.activeElement?.id==='managed-portfolio-screen-preview'&&" + holdingReadout(true) + "&&(()=>{const d=" + OBS + ",s=[...document.querySelectorAll('#managed-portfolio-screen-selected li')];return s.length===2&&s.every((e,i)=>e.textContent.includes(d.expectedPackets[i].security.listingId))&&document.querySelector('#managed-portfolio-screen-selected').textContent.includes('AAPL')&&document.querySelector('#managed-portfolio-screen-selected').textContent.includes('GOOGL');})()")));
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, FollowupsReportFrameCapture.Frame.PORTFOLIO_SCREEN_SELECTION)).retain();
        click("#managed-portfolio-screen-apply");
        page.await(new Check("Apply atomically changes only the ordered selection and returns focus, with no source or Save", new Script(
            "document.activeElement?.id==='managed-portfolio-screen-heading'&&" + OBS + ".screen.selected.join('|')===" + OBS + ".expectedPackets.map(p=>p.security.listingId).join('|')&&" + OBS + ".screen.run===null&&" + OBS + ".screen.shortlist===0&&!" + OBS + ".screen.comparison.left&&!" + OBS + ".screen.comparison.right&&" + retained() + "&&" + OBS + ".counts.annual===0&&document.querySelector('" + THRESHOLD + "')?.value==='0.00'")));
        stage = "separate explicit paced run"; button("Run screen (2 companies)");
        page.await(new Check("only first exact selected request starts before the unchanged pace interval", new Script(OBS + ".counts.annual===1&&" + OBS + ".counts.annualRequests[0].symbol==='AAPL'&&" + OBS + ".screen.run.status==='running'")));
        page.awaitStartup(new Check("both exact canonical sources finish with independent clocks and no failure", new Script(
            "(()=>{const d=" + OBS + ",r=d.screen.run;return d.counts.annual===2&&r?.status==='completed'&&r.rows.length===2&&r.rows.every((row,i)=>row.failure===null&&JSON.stringify(row.response)===JSON.stringify(d.expectedPackets[i]))&&d.counts.annualRequests.map(r=>r.symbol).join('|')==='AAPL|GOOGL'&&d.counts.annualRequests[1].at-d.counts.annualRequests[0].at>=20000&&r.rows[0].response.evidence.generation.cutoffAt==='2026-10-29T12:34:56.000Z'&&r.rows[1].response.evidence.generation.cutoffAt==='2026-10-30T01:02:03.000Z';})()")));
        click("#fixture-portfolio-screen-capture-run");
        stage = "inspect original evidence, Research and Back"; button("Inspect GOOGL evidence");
        page.await(new Check("the complete source evidence retains its original cutoff, completion and generation hash", new Script(
            "(()=>{const d=" + OBS + ",e=[...document.querySelectorAll('.managed-screen-evidence')].find(e=>e.querySelector('summary').textContent==='Inspect GOOGL evidence'),g=d.expectedPackets[1].evidence.generation;return e?.open&&[g.cutoffAt,g.completedAt,g.sha256,'0000000002'].every(s=>e.textContent.includes(s));})()")));
        button("Research GOOGL");
        page.await(new Check("exact screening-origin research revalidates the complete original GOOGL source packet without another Annual", new Script(
            OBS + ".research?.selection.origin==='screening'&&" + OBS + ".research.selection.listing.symbol==='GOOGL'&&" + OBS + ".annual.responseOrigin==='financial-screen'&&" + OBS + ".annual.sameSeedContent&&" + OBS + ".counts.resolve===2&&" + OBS + ".counts.annual===2")));
        pressBack();
        page.await(new Check("native Back restores the original completed run and packets without repeating reads", new Script(
            OBS + ".research===null&&" + OBS + ".sameRun&&" + OBS + ".sameResponses&&" + OBS + ".counts.annual===2&&" + OBS + ".counts.resolve===2&&" + retained() + "&&document.querySelector('" + THRESHOLD + "')?.value==='0.00'")));
        nav("Portfolio");
        page.await(new Check("whole independent Portfolio draft, saved base and dirty state survive the complete round trip with no personal Save", new Script(retained() + "&&" + OBS + ".portfolio.baseVersion===3&&" + OBS + ".portfolio.dirty&&" + OBS + ".canonical===" + OBS + ".expectedCanonical&&" + OBS + ".portfolio.ledger.opening.holdings.length===5&&" + OBS + ".counts.portfolioLoad===1&&" + OBS + ".counts.annual===2&&" + OBS + ".counts.resolve===2&&document.querySelector('[aria-label=\"Current authored holdings\"]')!==null")));
    }
    private static String retained() { return OBS + ".sameDraft&&" + OBS + ".sameSaved&&" + OBS + ".sameBase&&" + OBS + ".sameDirty&&" + OBS + ".sameCriteria&&" + OBS + ".counts.rejected===0&&Object.keys(" + OBS + ".counts.unexpected).length===0"; }
    private static String holdingReadout(boolean preview) {
        String root = preview ? "document.querySelector('#managed-portfolio-screen-preview')?.parentElement" : "document.querySelector('#managed-portfolio-screen-heading')?.parentElement";
        return "(()=>{const root=" + root + ",d=" + OBS + ",rows=[...(root?.querySelectorAll(':scope > .managed-portfolio-screen-rows > li')??[])],holdings=d.portfolio.projection.portfolio.holdings;return rows.length===5&&rows.every((row,i)=>{const h=holdings[i],values=[...row.querySelectorAll('dl dd')].map(e=>e.textContent);return row.dataset.listingId===h.identity.listingId&&row.querySelector('[data-holding-shares]').textContent===h.shares&&row.textContent.includes('2026-10-03')&&Object.values(h.identity).every(v=>values.includes(v))&&row.querySelector('[data-holding-outcome]').textContent.length>0;})&&root.textContent.includes('AEM')&&root.textContent.includes('UHAL');})()";
    }
    private void chooseGoogl() throws Exception {
        String visible = "(()=>{const e=document.querySelector('" + CHOICE + "'),d=document.querySelector('#managed-portfolio-screen');return !!e&&d.open&&!e.disabled&&e.value===''&&e.options.length===3&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&e.getClientRects().length>0;})()";
        page.await(new Check("visible enabled native selector retains empty default and both held alternatives", new Script(visible)).nativeReady());
        String value = page.read(new Script(OBS + ".expectedPackets[1].security.listingId"));
        String label = page.read(new Script("[...document.querySelector('" + CHOICE + "').options].find(o=>o.value===" + q(value) + ").textContent"));
        assertTrue(label.startsWith("GOOGL · Invented GOOGL Class A · Class A · XNAS · "));
        page.read(new Script("(()=>{const e=document.querySelector('" + CHOICE + "');e.scrollIntoView({block:'center',behavior:'instant'});e.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("fresh empty native selector owns focus before the real choice dialog", new Script("(" + visible + ")&&document.activeElement===document.querySelector('" + CHOICE + "')")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4)); AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); }).perform(androidx.test.espresso.action.ViewActions.click()); assertNotNull(dialog.get());
        page.await(new Check("native dialog selects only the explicitly chosen held class", new Script("document.querySelector('" + CHOICE + "')?.value===" + q(value)), ReportRevisitPage.Readiness.NATIVE, dialog.get())); keyboard.closeSoftKeyboard();
    }
    private void replaceThreshold(String value) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(THRESHOLD,"raw criterion threshold"));
        page.await(new Check("raw criterion input owns native focus",new Script("document.activeElement===document.querySelector('" + THRESHOLD + "')")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("complete previous threshold selected",new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public org.hamcrest.Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "commit exact raw criterion through native IME"; }
            public void perform(UiController controller,View view) { InputConnection c=view.onCreateInputConnection(new EditorInfo()); assertNotNull(c); assertTrue(c.commitText(value,1)); controller.loopMainThreadUntilIdle(); }
        });
        page.await(new Check("controlled raw criterion receives complete native input",new Script("document.querySelector('" + THRESHOLD + "')?.value==="+q(value)))); keyboard.closeSoftKeyboard();
    }
    private void click(String selector) throws Exception { page.await(new Check("enabled exact target before native touch: " + selector,new Script("(()=>{const e=document.querySelector("+q(selector)+");return !!e&&!e.disabled&&!e.closest('[hidden],[inert]');})()"))); touch.input(new ReportRevisitTouch.ControlledField(selector,"Portfolio screen action")); }
    private void button(String label) throws Exception { page.await(new Check("enabled exact visible action: "+label,new Script("[...document.querySelectorAll('button,summary')].some(e=>e.textContent.trim()==="+q(label)+"&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))"))); page.click(Element.xpath("//*[self::button or self::summary][normalize-space(.)="+xpath(label)+"]")); }
    private void nav(String label) throws Exception { page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)="+xpath(label)+"]")); }
    private static String q(String s) { return JSONObject.quote(s); }
    private static String xpath(String s) { assertFalse(s.contains("'")); return "'"+s+"'"; }
    private void diagnose() { try { String s=page.read(new Script("JSON.stringify((()=>{const d="+OBS+",e=document.querySelector('"+CHOICE+"');return {stage:"+q(stage)+",counts:d.counts,portfolio:{phase:d.portfolio.phase,base:d.portfolio.baseVersion,dirty:d.portfolio.dirty,pending:d.portfolio.pendingEditor},screen:{selected:d.screen.selected,criteria:d.screen.criteria,pending:d.screen.pending,run:d.screen.run?.status},selector:{value:e?.value,disabled:e?.disabled,open:document.querySelector('#managed-portfolio-screen')?.open},activeId:document.activeElement?.id,research:d.research?.selection.listing.symbol};})())")); android.util.Log.e("PortfolioScreenJourney",s.length()<8192?s:"diagnosticTooLarge"); } catch(Exception | AssertionError ignored) { android.util.Log.e("PortfolioScreenJourney","bounded diagnostic unavailable at "+stage); } }
    @After public void closeInventedFixture() throws Exception { if(scenario!=null)scenario.close(); if(assets!=null)assets.close(); }
}
