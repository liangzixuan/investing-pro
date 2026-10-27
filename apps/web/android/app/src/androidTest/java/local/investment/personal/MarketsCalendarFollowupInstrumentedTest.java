package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static org.junit.Assert.*;

import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
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

/** One exact loaded macro item becomes an independently chosen Class C research check. */
@RunWith(AndroidJUnit4.class)
public class MarketsCalendarFollowupInstrumentedTest {
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final String ROOT="#managed-markets-calendar-followup";
    private static final String QUESTION="Will policy change Class C funding? Café 東京 📈";
    private static final String DUE="2026-12-31";
    private static final String TITLE="Invented announcement without a publication time";
    private static final String URL="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm";
    private static final String CHECK="Question: Will policy change Class C funding? Café 東京 📈 | Fed announcement: Invented announcement without a publication time; published unknown; https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm";
    private static final String NOTE="Calendar question keeps this independent Watchlist note. Café 東京 📈";
    private static final String COUNTS="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FOLLOWUPS="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String RESOURCE="JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String WATCHLIST="JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String EVIDENCE="JSON.parse(document.querySelector('#fixture-calendar-followup-evidence').textContent)";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;

    @Before public void launchInventedCalendarQuestion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha);assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.MARKETS_CALENDAR_FOLLOWUP);
        assets.prepare();scenario=ActivityScenario.launch(MainActivity.class);
        page=new ReportRevisitPage(scenario);keyboard=new ReportRevisitKeyboard(page,new ReportRevisitTouch(page));
        scenario.onActivity(activity -> {
            keyboard.observe(activity);
            assertEquals("local.investment.personal",activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App"));assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("invented startup has current saved Watchlist but no implicit feed or Follow-ups read",new Script(
            "document.querySelector('#fixture-calendar-followup-evidence')!==null && "+COUNTS+".load===1 && "+COUNTS+".status===1"+
            " && "+COUNTS+".marketsResolve===1 && "+RESOURCE+".entries===null && "+WATCHLIST+".memberships?.length===3")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        boundary(1,0,0,0,0);
    }
    @Test public void loadedUnknownTimeAnnouncementCreatesExactClassCQuestionThroughBackAndSeparateSave() throws Exception {
        String originalWatchlist=authorIndependentNote();
        loadAndChooseAnnouncement();
        chooseClassC();
        authorAndLoad();
        preview();
        page.click(Element.css("#calendar-followup-cancel"));
        page.await(new Check("Cancel retires the preview without changing either resource",new Script(
            "document.querySelector('#calendar-followup-check')===null && document.querySelector('#calendar-followup-create')===null"+
            " && "+EVIDENCE+".encodedFollowups==="+EVIDENCE+".originalEncodedFollowups && "+RESOURCE+".dirty===false")));
        reopenAfterCancel();preview();retainCompletePreviewFrame();
        String expected=createExactlyOnce(originalWatchlist);
        reviewResearchAndBack(expected,originalWatchlist);
        saveAndFreshLoad(expected,originalWatchlist);
    }
    private String authorIndependentNote() throws Exception {
        page.click(Element.css("#fixture-calendar-followup-author-note"));
        page.await(new Check("independent original Watchlist order/notes stay dirty before any source action",new Script(
            WATCHLIST+".dirty===true && "+EVIDENCE+".watchlist.memberships.map(m=>m.listingId).join('|')==='listing-zero|listing-beta-a|listing-beta-c'"+
            " && "+EVIDENCE+".watchlist.memberships[0].note==="+JSONObject.quote(NOTE)+
            " && "+EVIDENCE+".watchlist.memberships[1].shareClassName==='Class A' && "+EVIDENCE+".watchlist.memberships[2].shareClassName==='Class C'")));
        boundary(1,0,0,0,0);
        return page.read(new Script(EVIDENCE+".encodedWatchlist"));
    }
    private void loadAndChooseAnnouncement() throws Exception {
        page.await(new Check("calendar tool starts closed and cannot select a company automatically",new Script(
            "document.querySelector("+JSONObject.quote(ROOT+" > details")+")?.open===false && document.querySelector('#calendar-followup-company')===null")));
        page.click(Element.xpath("//button[normalize-space(.)='Load announcements']"));
        page.await(new Check("one explicit feed read keeps its unknown publication time and original retrieval clock",new Script(
            COUNTS+".fed===1 && "+EVIDENCE+".feed.items[1].publishedAt===null && "+EVIDENCE+".feed.fetchedAt==='2026-10-23T18:00:00.000Z'"+
            " && document.querySelector('[data-calendar-entry-key=\"fed:"+URL+"\"]')?.textContent==='Keep a dated check'")));
        page.click(Element.css("[data-calendar-entry-key='fed:"+URL+"']"));
        page.await(new Check("only the exact selected unknown-time source opens the question form",new Script(
            "document.querySelector("+JSONObject.quote(ROOT+" > details")+")?.open===true && document.querySelector("+JSONObject.quote(ROOT+" > details > summary")+")?.textContent==='Keep a dated research check'"+
            " && document.querySelector('#calendar-followup-company')?.value===''")));
        assertSourceEvidence();boundary(1,1,0,0,0);
    }
    private void chooseClassC() throws Exception {
        page.read(new Script("(()=>{const s=document.querySelector('#calendar-followup-company');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("the exact enabled blank company picker contains distinct Class A and Class C",new Script(
            "(()=>{const s=document.querySelector('#calendar-followup-company');return document.activeElement===s&&!s.disabled&&s.value===''"+
            " && [...s.options].map(o=>o.value).join('|')==='|listing-zero|listing-beta-a|listing-beta-c';})()")).nativeReady());
        onView(isAssignableFrom(WebView.class)).check((view,missing)->{if(missing!=null)throw missing;assertTrue(view.hasFocus());assertTrue(view.hasWindowFocus());}).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog=new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText("BETB · Beta Company · Class C · XNAS"))
            .inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());})
            .perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("native company choice applies Class C and dismisses its exact picker",new Script(
            "document.querySelector('#calendar-followup-company')?.value==='listing-beta-c'"),ReportRevisitPage.Readiness.NATIVE,dialog.get()));
        keyboard.closeSoftKeyboard();
    }
    private void authorAndLoad() throws Exception {
        keyboard.enter(new ReportRevisitKeyboard.FieldInput(ReportRevisitTouch.Field.CALENDAR_QUESTION,QUESTION));
        keyboard.enter(new ReportRevisitKeyboard.FieldInput(ReportRevisitTouch.Field.CALENDAR_DUE,DUE));
        page.await(new Check("unloaded Follow-ups offers only the owned explicit initial Load",new Script(
            "document.querySelector('#calendar-followup-load')?.textContent==='Load follow-ups for this question'"+
            " && document.querySelector('#calendar-followup-load')?.disabled===false && "+FOLLOWUPS+".load===0")));
        page.click(Element.css("#calendar-followup-load"));
        page.await(new Check("explicit initial Load retains raw question/date/company and the whole earlier resource",new Script(
            "document.querySelector('#calendar-followup-question')?.value==="+JSONObject.quote(QUESTION)+
            " && document.querySelector('#calendar-followup-due')?.value==="+JSONObject.quote(DUE)+
            " && document.querySelector('#calendar-followup-company')?.value==='listing-beta-c' && "+FOLLOWUPS+".load===1"+
            " && "+RESOURCE+".baseVersion===1 && "+EVIDENCE+".encodedFollowups==="+EVIDENCE+".originalEncodedFollowups")));
        assertSourceEvidence();boundary(1,1,1,0,0);
    }
    private void assertSourceEvidence() throws Exception {
        page.await(new Check("full selected source keeps unknown publication and retrieved UTC separate from authored due date",new Script(
            "(()=>{const s=document.querySelector('[aria-label=\"Selected calendar source\"]');return s?.querySelector('h4')?.textContent==="+JSONObject.quote(TITLE)+
            " && [...s.querySelectorAll('dl > div')].some(d=>d.querySelector('dt')?.textContent==='Publication time (UTC)'&&d.querySelector('dd')?.textContent==='Unknown')"+
            " && [...s.querySelectorAll('dl > div')].some(d=>d.querySelector('dt')?.textContent==='Retrieved (UTC)'&&d.querySelector('dd')?.textContent==='2026-10-23T18:00:00.000Z')"+
            " && s.querySelector('a')?.getAttribute('href')==="+JSONObject.quote(URL)+" && s.textContent.includes('does not establish relevance');})()")));
    }
    private void reopenAfterCancel() throws Exception {
        page.await(new Check("Cancel closes only the question preview disclosure",new Script(
            "document.querySelector("+JSONObject.quote(ROOT+" > details")+")?.open===false")));
        page.click(Element.css(ROOT+" > details > summary"));
        page.await(new Check("explicit reopen preserves the authored fields and independent exact company",new Script(
            "document.querySelector('#calendar-followup-question')?.value==="+JSONObject.quote(QUESTION)+
            " && document.querySelector('#calendar-followup-due')?.value==="+JSONObject.quote(DUE)+
            " && document.querySelector('#calendar-followup-company')?.value==='listing-beta-c'")));
    }
    private void preview() throws Exception {
        page.click(Element.css("#calendar-followup-preview"));
        page.await(new Check("complete current preview shows exact cited question, independent UTC date and full Class C identity",new Script(
            "(()=>{const p=document.querySelector('[aria-label=\"Calendar next check preview\"]'),t=document.querySelector('#calendar-followup-check');return t?.readOnly===true&&t.value==="+JSONObject.quote(CHECK)+
            " && p.textContent.includes('Due date (UTC): "+DUE+"') && p.textContent.includes('BETB · Beta CompanyClass C · XNAS · Common stock')"+
            " && [...p.querySelectorAll('dd')].map(e=>e.textContent).includes('listing-beta-c')"+
            " && [...p.querySelectorAll('dd')].map(e=>e.textContent).includes('class-beta-c')"+
            " && document.querySelector('#calendar-followup-create')?.textContent==='Create follow-up draft';})()")));
        assertSourceEvidence();
    }
    private void retainCompletePreviewFrame() throws Exception {
        page.read(new Script("(()=>{document.querySelector('[aria-label=\"Calendar next check preview\"]').scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});return 'positioned';})()"));
        String visible="(()=>{const p=document.querySelector('[aria-label=\"Calendar next check preview\"]'),v=visualViewport,t=p?.querySelector('#calendar-followup-check');"+
            "const targets=p?[...p.querySelectorAll(':scope > h4,:scope > label,#calendar-followup-check,:scope > p:first-of-type,:scope > p:nth-of-type(2),:scope > p:nth-of-type(3)')]:[];"+
            "return v&&t?.value==="+JSONObject.quote(CHECK)+"&&t.readOnly&&t.scrollHeight<=t.clientHeight+1&&targets.length===6&&targets.every(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height;});})()";
        page.await(new Check("entire exact question/current identity/UTC date preview is visible before PixelCopy",new Script(visible)).nativeReady());
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.MARKETS_CALENDAR_PREVIEW)).retain();
        page.await(new Check("the same complete preview remains current after its committed frame",new Script(visible)));
    }
    private String createExactlyOnce(String watchlist) throws Exception {
        page.click(Element.css("#calendar-followup-create"));
        page.await(new Check("Create is consumed once and appends only Class C after both original entries",new Script(
            RESOURCE+".entries?.length===3 && "+RESOURCE+".dirty===true && document.querySelector('#calendar-followup-create')===null"+
            " && "+EVIDENCE+".encodedFollowups==="+EVIDENCE+".expectedEncodedFollowups && "+RESOURCE+".entries[1].listing.listingId==='listing-beta-a'"+
            " && "+RESOURCE+".entries[2].listing.listingId==='listing-beta-c' && "+RESOURCE+".entries[2].check==="+JSONObject.quote(CHECK))));
        String id=page.read(new Script(RESOURCE+".entries[2].id"));
        assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        page.click(Element.css("#calendar-followup-preview"));
        page.await(new Check("a new explicit preview refuses an existing listing without duplicate or overwrite",new Script(
            "document.querySelector('#calendar-followup-create')===null && document.querySelector('#calendar-followup-check')===null"+
            " && document.querySelector('#calendar-followup-status')?.textContent.includes('already has a follow-up')"+
            " && document.querySelector('#calendar-followup-review')?.textContent==='Review follow-up'")));
        assertWatchlist(watchlist);boundary(1,1,1,0,0);
        return page.read(new Script(EVIDENCE+".expectedEncodedFollowups"));
    }
    private void assertWatchlist(String encoded) throws Exception {
        page.await(new Check("whole independent dirty Watchlist remains byte-canonical and unsaved",new Script(
            EVIDENCE+".encodedWatchlist==="+JSONObject.quote(encoded)+" && "+WATCHLIST+".dirty===true && "+COUNTS+".save===0")));
    }
    private void assertPayload(String expected) throws Exception {
        page.await(new Check("complete canonical encoded Follow-ups payload including both original entries equals its independent oracle",new Script(
            EVIDENCE+".encodedFollowups==="+JSONObject.quote(expected)+" && "+RESOURCE+".entries?.length===3"+
            " && "+RESOURCE+".entries[2].dueOn==="+JSONObject.quote(DUE)+" && "+RESOURCE+".entries[2].result==='' && "+RESOURCE+".entries[2].status==='open'")));
    }
    private void reviewResearchAndBack(String expected,String watchlist) throws Exception {
        page.click(Element.css("#calendar-followup-review"));
        page.await(new Check("existing router bridge opens and selects only the newly created exact entry",new Script(
            "location.href==='https://localhost/' && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'"+
            " && "+RESOURCE+".selectedId==="+RESOURCE+".entries[2].id && "+RESOURCE+".filter==='open' && document.querySelector('#managed-followup-check')?.value==="+JSONObject.quote(CHECK))));
        String id=page.read(new Script(RESOURCE+".entries[2].id"));
        page.click(Element.css("#managed-followup-research-"+id));
        page.await(new Check("exact Class C company research retains its complete question with no financial source read",new Script(
            "location.href==='https://localhost/?company=listing-beta-c&section=price' && document.querySelector('#managed-company-heading')?.textContent==='Company research · BETB'"+
            " && document.querySelector('#managed-research-followup-heading')!==null && document.querySelector('.managed-company-visit')?.textContent.includes("+JSONObject.quote(CHECK)+")")));
        keyboard.closeSoftKeyboard();
        page.await(new Check("current exact company route has its visible enabled Back for one hardware action",new Script(
            "(()=>{const b=document.querySelector('.managed-company-visit .trial-toolbar > button'),r=b?.getBoundingClientRect();return b?.textContent==='Back to workspace'&&!b.disabled&&b.checkVisibility()&&r.width>0&&r.height>0;})()")).nativeReady());
        pressBack();
        page.await(new Check("one hardware Back retains the selected Follow-ups entry and original source packet",new Script(
            "location.href==='https://localhost/' && document.querySelector('.managed-company-visit')===null && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'"+
            " && "+RESOURCE+".selectedId==="+RESOURCE+".entries[2].id && "+EVIDENCE+".feed.fetchedAt==='2026-10-23T18:00:00.000Z'")));
        assertPayload(expected);assertWatchlist(watchlist);boundary(1,1,1,0,1);
    }
    private void saveAndFreshLoad(String expected,String watchlist) throws Exception {
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("only explicit separate Follow-ups Save commits the whole canonical resource once",new Script(
            RESOURCE+".baseVersion===2 && "+RESOURCE+".dirty===false && "+FOLLOWUPS+".save===1 && "+FOLLOWUPS+".commits===1")));
        assertPayload(expected);assertWatchlist(watchlist);boundary(1,1,1,1,1);
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh session has no implicit Follow-ups or source read and no saved Watchlist edit",new Script(
            FOLLOWUPS+".session===2 && "+RESOURCE+".entries===null && "+COUNTS+".status===2 && "+COUNTS+".marketsResolve===2"+
            " && "+COUNTS+".load===2 && "+WATCHLIST+".memberships?.[0].note==='Original independent note' && "+EVIDENCE+".feed===null")));
        openFollowups();page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit fresh Load restores only the independently saved complete Follow-ups resource",new Script(
            FOLLOWUPS+".load===2 && "+RESOURCE+".baseVersion===2 && "+RESOURCE+".dirty===false")));
        assertPayload(expected);boundary(2,1,2,1,1);
    }
    private void openFollowups() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.await(new Check("visible Follow-ups workspace before explicit reload",new Script(
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups' && document.querySelector('#managed-followups-heading')?.checkVisibility()===true")));
    }
    private void boundary(int sessions,int feeds,int loads,int saves,int resolves) throws Exception {
        page.await(new Check("fixed source/origin/CSP and all independent read/write counters remain exact",new Script(
            "location.origin==='https://localhost' && location.hash==='' && window.Capacitor?.getPlatform()==='android'"+
            " && document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+
            " && document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'"+
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            " && "+COUNTS+".load==="+sessions+" && "+COUNTS+".status==="+sessions+" && "+COUNTS+".marketsResolve==="+sessions+
            " && "+COUNTS+".resolve==="+resolves+" && "+COUNTS+".fed==="+feeds+" && "+COUNTS+".save===0 && "+COUNTS+".eod===0 && "+COUNTS+".annual===0 && "+COUNTS+".filings===0"+
            " && "+COUNTS+".marketsEod===0 && "+COUNTS+".calendar===0 && "+COUNTS+".bls===0 && "+COUNTS+".search===0 && "+COUNTS+".token===0 && "+COUNTS+".signOut===0"+
            " && "+COUNTS+".portfolioLoad===0 && "+COUNTS+".portfolioSave===0 && "+COUNTS+".valuationLoad===0 && "+COUNTS+".valuationSave===0"+
            " && "+FOLLOWUPS+".load==="+loads+" && "+FOLLOWUPS+".save==="+saves+" && "+FOLLOWUPS+".commits==="+saves+" && "+FOLLOWUPS+".replays===0 && "+FOLLOWUPS+".token===0 && "+FOLLOWUPS+".signOut===0")));
    }
    @After public void closeInventedCalendarQuestion() {
        try { if(scenario!=null){scenario.close();scenario=null;} }
        finally { if(assets!=null)assets.close(); }
    }
}
