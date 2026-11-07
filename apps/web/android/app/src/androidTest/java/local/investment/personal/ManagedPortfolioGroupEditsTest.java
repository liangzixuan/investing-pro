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
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;

/** Native authored edits against the existing invented, independent RAM Portfolio resource. */
@RunWith(AndroidJUnit4.class)
public class ManagedPortfolioGroupEditsTest {
    private static final String COUNTS = "JSON.parse(document.querySelector('#fixture-portfolio-state').textContent)";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-portfolio-draft').textContent)";
    private static final String SHARED = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String GROUP = "#managed-portfolio-group";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String stage = "startup";

    @Before public void launchInventedPortfolio() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        String sha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sha); assertTrue(sha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_LEDGER);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        touch = new ReportRevisitTouch(page);
        keyboard = new ReportRevisitKeyboard(page, touch);
        scenario.onActivity(activity -> {
            assertNotNull(activity.getBridge().getPlugin("App"));
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity);
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("invented Portfolio remains unloaded at startup", new Script(
            "document.querySelector('#fixture-portfolio-state')!==null&&" + COUNTS + ".load===0&&" + COUNTS + ".save===0&&" + DRAFT + ".ledger===null&&" + SHARED + ".load===1&&" + SHARED + ".status===1&&document.querySelector('.managed-navigation [aria-current=page]')!==null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
    }

    @Test public void groupedEditsPreviewCancelApplyOnceAndSeparateSaveFreshLoad() throws Exception {
        try { completeJourney(); }
        catch (Exception | AssertionError failure) { diagnose(); throw failure; }
    }

    private void completeJourney() throws Exception {
        stage = "author baseline through Portfolio controls";
        button(".managed-navigation", "Portfolio");
        click("#managed-portfolio-load");
        await("explicit empty Portfolio load", COUNTS + ".load===1&&" + DRAFT + ".baseVersion===0");
        input("#managed-portfolio-opening-date", "2026-10-01");
        input("#managed-portfolio-opening-cash", "1000.00");
        click("#managed-portfolio-start");
        input("#managed-portfolio-search", "ZERO");
        button(".managed-portfolio", "Search catalog");
        button(".managed-portfolio", "Register ZERO");
        await("exact listing registered", DRAFT + ".ledger.identities.length===1&&" + DRAFT + ".ledger.identities[0].listingId==='listing-zero'");
        trade(".managed-portfolio", "buy", "Buy", "2.000000", "200.00");
        await("first authored buy committed only to draft", DRAFT + ".ledger.transactions.length===1&&!" + DRAFT + ".pendingEditor");
        trade(".managed-portfolio", "sell", "Sell", "1.000000", "150.00");
        await("baseline exact FIFO projection", projection("948.00", 1, "48.50") + "&&!" + DRAFT + ".pendingEditor");
        click("#managed-portfolio-review-identities");
        button(".managed-portfolio", "Apply reviewed identities");
        await("reviewed baseline permits an edit group", "!document.querySelector('#managed-portfolio-group-start').disabled&&!" + DRAFT + ".pendingEditor");
        String original = page.read(new Script(snapshot()));
        String baseline = page.read(new Script("JSON.stringify(" + DRAFT + ".ledger)"));
        String otherDraft = page.read(new Script("document.querySelector('#fixture-workspace-draft').textContent"));

        stage = "isolated proposal and complete preview";
        proposeAndPreview(original, true);
        frame(FollowupsReportFrameCapture.Frame.PORTFOLIO_GROUP_EDITS_PREVIEW,
            GROUP + " .portfolio-group-comparison > .portfolio-group-pair");

        stage = "cancel leaves original unchanged";
        click("#managed-portfolio-group-cancel");
        await("cancel preserves complete baseline, saved base and dirty state", snapshot() + "===" + q(original) + "&&!" + DRAFT + ".pendingEditor&&document.querySelector('" + GROUP + "').dataset.phase==='idle'&&" + COUNTS + ".save===0");

        stage = "reopen, review and apply exactly once";
        proposeAndPreview(original, false);
        click("#managed-portfolio-group-apply");
        await("single apply installs four authored activities without saving", projection("1122.00", 0, "97.00") + "&&" + DRAFT + ".ledger.transactions.length===4&&" + DRAFT + ".dirty&&" + DRAFT + ".baseVersion===0&&!" + DRAFT + ".pendingEditor&&" + COUNTS + ".save===0&&" + COUNTS + ".commits===0&&document.querySelector('" + GROUP + "').dataset.phase==='applied'&&document.querySelector('#managed-portfolio-group-apply')===null");
        String applied = page.read(new Script("JSON.stringify(" + DRAFT + ".ledger)"));
        JSONObject before = new JSONObject(baseline), after = new JSONObject(applied);
        assertEquals(before.get("opening").toString(), after.get("opening").toString());
        assertEquals(before.get("identities").toString(), after.get("identities").toString());
        for (int i = 0; i < 2; i++) assertEquals(before.getJSONArray("transactions").get(i).toString(), after.getJSONArray("transactions").get(i).toString());
        assertEquals("deposit", after.getJSONArray("transactions").getJSONObject(2).getString("type"));
        assertEquals("sell", after.getJSONArray("transactions").getJSONObject(3).getString("type"));
        assertNotEquals(after.getJSONArray("transactions").getJSONObject(2).getString("id"), after.getJSONArray("transactions").getJSONObject(3).getString("id"));
        assertEquals(otherDraft, page.read(new Script("document.querySelector('#fixture-workspace-draft').textContent")));

        stage = "separate whole Portfolio Review and Save";
        click("#managed-portfolio-review");
        await("review enables the separate Save", "document.querySelector('.managed-portfolio-review')!==null&&!document.querySelector('#managed-portfolio-save').disabled&&" + COUNTS + ".save===0");
        click("#managed-portfolio-save");
        await("one distinct Save acknowledges the exact complete ledger", COUNTS + ".save===1&&" + COUNTS + ".commits===1&&" + COUNTS + ".replays===0&&" + DRAFT + ".baseVersion===1&&!" + DRAFT + ".dirty&&JSON.stringify(" + DRAFT + ".ledger)===" + q(applied));

        stage = "retire session and explicitly load saved ledger";
        click("#managed-signout-open");
        // The acknowledged Save leaves no unconfirmed changes, so sign-out is direct.
        await("clean sign-out retires the local draft without a confirmation", DRAFT + ".owner==='retired'&&" + DRAFT + ".ledger===null&&" + COUNTS + ".signOut===1&&document.querySelector('#managed-signout-confirm')===null");
        click("#fixture-portfolio-fresh-session");
        await("fresh session has not loaded Portfolio", COUNTS + ".session===2&&" + COUNTS + ".load===1&&" + DRAFT + ".ledger===null&&" + DRAFT + ".owner==='active'");
        button(".managed-navigation", "Portfolio");
        click("#managed-portfolio-load");
        await("fresh explicit Load restores exact ledger once", COUNTS + ".load===2&&" + COUNTS + ".save===1&&" + COUNTS + ".commits===1&&" + COUNTS + ".replays===0&&" + COUNTS + ".token===0&&" + DRAFT + ".baseVersion===1&&!" + DRAFT + ".dirty&&JSON.stringify(" + DRAFT + ".ledger)===" + q(applied) + "&&" + projection("1122.00", 0, "97.00"));
        await("all financial sources and other personal saves remain untouched", SHARED + ".save===0&&" + SHARED + ".eod===0&&" + SHARED + ".annual===0&&" + SHARED + ".filings===0&&" + SHARED + ".marketsEod===0&&" + SHARED + ".calendar===0&&" + SHARED + ".fed===0&&JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent).save===0");
        frame(FollowupsReportFrameCapture.Frame.PORTFOLIO_GROUP_EDITS_RETURN,
            ".managed-portfolio [aria-label='Current authored holdings']");
    }

    private void proposeAndPreview(String original, boolean captureHistory) throws Exception {
        click("#managed-portfolio-group-start");
        await("group owns the pending lock without changing the draft", "document.querySelector('" + GROUP + "').dataset.phase==='editing'&&" + DRAFT + ".pendingEditor&&" + snapshot() + "===" + q(original) + "&&document.querySelector('#managed-portfolio-save').disabled&&document.querySelector('#managed-portfolio-load').disabled");
        choose(GROUP + " [aria-label='Transaction type']", "deposit", "Deposit");
        input(GROUP + " [aria-label='Transaction amount']", "25.00");
        await("raw proposal input requires explicit add before review", "document.querySelector('#managed-portfolio-group-review').disabled&&" + snapshot() + "===" + q(original));
        button(GROUP, "Add transaction to group");
        await("proposal deposit settles only inside the group", "!document.querySelector('#managed-portfolio-group-review').disabled&&" + snapshot() + "===" + q(original));
        trade(GROUP, "sell", "Sell", "1.000000", "150.00");
        await("both valid edits leave the original unchanged", "!document.querySelector('#managed-portfolio-group-review').disabled&&" + snapshot() + "===" + q(original) + "&&" + COUNTS + ".save===0");
        correctSettledEdits(original, captureHistory);
        click("#managed-portfolio-group-review");
        await("whole before and after projections expose closed holding and exact amounts",
            "document.querySelector('" + GROUP + "').dataset.phase==='preview'&&document.activeElement?.id==='managed-portfolio-group-heading'&&" +
            "[...document.querySelectorAll('[aria-label=\"Before this group\"] dd')].map(e=>e.textContent).join('|')==='USD 948.00|USD 48.50|USD 48.50|0 of 1'&&" +
            "[...document.querySelectorAll('[aria-label=\"After this group\"] dd')].map(e=>e.textContent).join('|')==='USD 1122.00|USD 97.00|USD 97.00|0 of 2'&&" +
            "(()=>{const h=document.querySelector('[aria-label=\"Holding comparison ZERO\"]');return !!h&&h.textContent.includes('listing-zero')&&h.textContent.includes('1 shares; basis USD 100.50')&&h.textContent.includes('Not held');})()&&" +
            snapshot() + "===" + q(original) + "&&" + COUNTS + ".save===0");
        button(GROUP, "Complete before and after ledgers");
        await("every original and proposed activity appears in authored order", completeLedgers());
    }

    private void correctSettledEdits(String original, boolean captureHistory) throws Exception {
        String rows = "JSON.stringify([...document.querySelectorAll('" + GROUP + " .ledger-transaction')].map(e=>e.textContent))";
        String complete = page.read(new Script(rows));
        await("two edits can be undone without a redo branch", historyCounts(2, 0));
        input(GROUP + " [aria-label='Transaction amount']", "7.00");
        await("unfinished form blocks history and review without discarding settled work", "document.querySelector('#managed-portfolio-group-undo').disabled&&document.querySelector('#managed-portfolio-group-redo').disabled&&document.querySelector('#managed-portfolio-group-review').disabled&&" + rows + "===" + q(complete));
        button(GROUP, "Reset transaction form");
        await("reset restores settled history controls", "!document.querySelector('#managed-portfolio-group-undo').disabled&&" + historyCounts(2, 0));
        click("#managed-portfolio-group-undo");
        await("Undo removes the last complete sale only", historyCounts(1, 1) + "&&document.querySelectorAll('" + GROUP + " .ledger-transaction').length===3&&document.activeElement?.id==='managed-portfolio-group-heading'&&" + snapshot() + "===" + q(original));
        if (captureHistory) frame(FollowupsReportFrameCapture.Frame.PORTFOLIO_GROUP_EDITS_HISTORY,
            GROUP + " [aria-label='Group edit history']");
        click("#managed-portfolio-group-undo");
        await("Undo returns to baseline and keeps the group lock", historyCounts(0, 2) + "&&document.querySelectorAll('" + GROUP + " .ledger-transaction').length===2&&document.querySelector('#managed-portfolio-group-undo').disabled&&" + DRAFT + ".pendingEditor&&" + snapshot() + "===" + q(original));
        click("#managed-portfolio-group-redo");
        await("Redo restores only the deposit", historyCounts(1, 1) + "&&document.querySelectorAll('" + GROUP + " .ledger-transaction').length===3");
        click("#managed-portfolio-group-redo");
        await("Redo restores every exact authored row without saving", historyCounts(2, 0) + "&&" + rows + "===" + q(complete) + "&&document.querySelector('#managed-portfolio-group-redo').disabled&&" + snapshot() + "===" + q(original) + "&&" + COUNTS + ".save===0");
    }

    private static String historyCounts(int undo, int redo) {
        return "document.querySelector('#managed-portfolio-group-history-counts').textContent==='Edits to undo: " + undo + ". Edits to redo: " + redo + ".'";
    }

    private static String completeLedgers() {
        return "(()=>{const b=document.querySelector('[aria-label=\"Original authored ledger\"]'),a=document.querySelector('[aria-label=\"Proposed authored ledger\"]');if(!b||!a||!b.closest('details').open)return false;const rows=r=>[...r.querySelectorAll(':scope > ol > li')];const br=rows(b),ar=rows(a);return br.length===2&&ar.length===4&&br.every((e,i)=>e.textContent===ar[i].textContent)&&ar.every((e,i)=>e.value===i+1)&&ar[2].textContent.includes('deposit')&&ar[2].textContent.includes('gross USD 25.00')&&ar[3].textContent.includes('sell')&&ar[3].textContent.includes('gross USD 150.00')&&ar[3].textContent.includes('fee USD 1.00');})()";
    }
    private static String snapshot() { return "JSON.stringify((()=>{const d=" + DRAFT + ";return {ledger:d.ledger,saved:d.saved,baseVersion:d.baseVersion,dirty:d.dirty};})())"; }
    private static String projection(String cash, int holdings, String gain) { return "(()=>{const p=" + DRAFT + ".projection;return p?.status==='valid'&&p.portfolio.cashUsd===" + q(cash) + "&&p.portfolio.holdings.length===" + holdings + "&&p.realized.totalGainUsd===" + q(gain) + (holdings == 1 ? "&&p.portfolio.holdings[0].shares==='1'&&p.portfolio.holdings[0].totalCostBasisUsd==='100.50'" : "") + ";})()"; }
    private void trade(String scope, String value, String label, String shares, String gross) throws Exception {
        choose(scope + " [aria-label='Transaction type']", value, label);
        await("only registered ZERO owns the trade", "document.querySelector(" + q(scope + " [aria-label='Transaction listing']") + ").value==='listing-zero'");
        input(scope + " [aria-label='Transaction shares']", shares);
        input(scope + " [aria-label='Transaction amount']", gross);
        input(scope + " [aria-label='Transaction fee']", "1.00");
        button(scope, scope.equals(GROUP) ? "Add transaction to group" : "Add transaction to draft");
    }
    private void input(String selector, String value) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(selector, "Portfolio authored field"));
        await("native input owns focus", "document.activeElement===document.querySelector(" + q(selector) + ")");
        keyboard.awaitVisibleEditor(selector);
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        await("complete previous text selected", "document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public org.hamcrest.Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "commit authored Portfolio value through native IME"; }
            public void perform(UiController controller, View view) {
                InputConnection input = view.onCreateInputConnection(new EditorInfo());
                assertNotNull(input); assertTrue(input.commitText(value, 1)); controller.loopMainThreadUntilIdle();
            }
        });
        await("controlled field receives exact native text", "document.querySelector(" + q(selector) + ").value===" + q(value));
        keyboard.closeSoftKeyboard();
    }
    private void choose(String selector, String value, String label) throws Exception {
        await("enabled native select and exact option", "(()=>{const e=document.querySelector(" + q(selector) + ");return !!e&&!e.disabled&&[...e.options].some(o=>o.value===" + q(value) + "&&o.textContent===" + q(label) + ");})()");
        page.read(new Script("(()=>{const e=document.querySelector(" + q(selector) + ");e.scrollIntoView({block:'center',behavior:'instant'});e.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("select owns focus before native dialog", new Script("document.activeElement===document.querySelector(" + q(selector) + ")")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); }).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("native option applied", new Script("document.querySelector(" + q(selector) + ").value===" + q(value)), ReportRevisitPage.Readiness.NATIVE, dialog.get()));
        keyboard.closeSoftKeyboard();
    }
    private void button(String scope, String label) throws Exception {
        String locate = "(()=>{const es=[...document.querySelectorAll(" + q(scope + " button," + scope + " summary") + ")].filter(e=>e.textContent.trim()===" + q(label) + "&&!e.disabled&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));if(es.length!==1)return null;let e=es[0],p=[];while(e&&e!==document.documentElement){p.unshift(e.tagName.toLowerCase()+':nth-child('+([...e.parentElement.children].indexOf(e)+1)+')');e=e.parentElement;}return 'html>'+p.join('>');})()";
        await("one enabled visible action: " + label, locate + "!==null");
        click(page.read(new Script(locate)));
    }
    private void click(String selector) throws Exception {
        await("enabled target for native touch", "(()=>{const e=document.querySelector(" + q(selector) + ");return !!e&&!e.disabled&&!e.closest('[hidden],[inert]');})()");
        touch.input(new ReportRevisitTouch.ControlledField(selector, "grouped Portfolio action"));
    }
    private void frame(FollowupsReportFrameCapture.Frame frame, String selector) throws Exception {
        page.read(new Script("document.querySelector(" + q(selector) + ").scrollIntoView({block:'start',behavior:'instant'});'scrolled'"));
        page.await(new Check("committed Portfolio amounts fit the document", new Script("document.querySelector(" + q(selector) + ")?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1")).nativeReady());
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, frame)).retain();
    }
    private void await(String description, String expression) throws Exception { page.await(new Check(description, new Script(expression))); }
    private static String q(String value) { return JSONObject.quote(value); }
    private void diagnose() {
        try {
            String observed = page.read(new Script("JSON.stringify({stage:" + q(stage) + ",counts:" + COUNTS + ",draft:" + DRAFT + ",group:document.querySelector('" + GROUP + "')?.dataset.phase,active:document.activeElement?.outerHTML?.slice(0,500)})"));
            android.util.Log.e("PortfolioGroupEdits", observed.length() < 12000 ? observed : "bounded diagnostic exceeded at " + stage);
        } catch (Exception | AssertionError ignored) { android.util.Log.e("PortfolioGroupEdits", "diagnostic unavailable at " + stage); }
    }
    @After public void closeInventedFixture() throws Exception { if (scenario != null) scenario.close(); if (assets != null) assets.close(); }
}
