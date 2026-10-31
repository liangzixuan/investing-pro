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

/** Invented mixed source pass, two company choices and an owned return without replay. */
@RunWith(AndroidJUnit4.class)
public class ManagedMarketsBriefingTest {
    private static final String E="JSON.parse(document.querySelector('#fixture-markets-briefing-evidence').textContent)";
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String R="JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String DUE="2026-12-31";
    private static final String QUESTION="Will this change my ZERO research? Café 東京 📈";
    private static final String SCHEDULED_QUESTION="Could this release change Class C plans?";
    private static final String CHECK="Question: Will this change my ZERO research? Café 東京 📈 | U.S. Bureau of Labor Statistics CPI headline: Invented CPI headline: prices and household plans. Feed published: 2026-10-01T07:15:22.123456-04:00; feed updated: 2026-10-02T09:45:10.1200+05:30. https://www.bls.gov/news.release/archives/cpi_10012026.htm";
    private static final String SCHEDULED_CHECK="Question: Could this release change Class C plans? | BLS schedule: Invented October release; scheduled 2026-10-30T12:30:00.000Z; https://www.bls.gov/schedule/";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private String complete;
    private String rawCpi;
    private String rawBls;
    private String rawBoard;

    @Before public void launchInventedBriefing() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha);assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.MARKETS_BRIEFING);
        assets.prepare();scenario=ActivityScenario.launch(MainActivity.class);
        page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(activity->{
            assertEquals("local.investment.personal",activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App"));assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity);activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        await("startup has admitted catalog and exact initial Watchlist but no financial source or Follow-ups read",
            "document.querySelector('#fixture-markets-briefing-evidence')!==null&&"+C+".load===1&&"+C+".status===1&&"+C+".marketsResolve===1&&"+R+".entries===null&&"+E+".board.rows.length===3");
        scenario.onActivity(activity->activity.getBridge().getWebView().clearHistory());
        boundary(0,0,0,0,0,1);
    }
    @Test public void mixedPassKeepsCompleteEvidenceThroughTwoChecksResearchReturnAndSeparateSave() throws Exception {
        String document=page.read(new Script("String(performance.timeOrigin)"));
        runMixedPass();createScheduledCheck();createCpiCheck();researchBackAndReturn();saveAndFreshLoad();
        assertEquals("one native document owns the complete journey",document,page.read(new Script("String(performance.timeOrigin)")));
        boundary(1,1,1,1,2,2);
    }
    private void runMixedPass() throws Exception {
        page.click(Element.css("#managed-markets-source-review > summary"));
        for(String id:new String[]{"price-1","price-2","bea","fed"})page.click(Element.css("#markets-source-review-choice-"+id));
        page.click(Element.css("#markets-source-review-preview"));
        await("Preview has exactly three selected fixed operations and performs no source read",
            E+".pass.plan.map(r=>r.id).join('|')==='price-0|bls|cpi'&&"+E+".pass.canStart===true");
        boundary(0,0,0,0,0,1);
        page.click(Element.css("#markets-source-review-start"));
        await("the explicit mixed pass completes once in fixed order and retains seven outcomes",
            E+".pass.phase==='complete'&&"+E+".pass.rows.length===7&&"+E+".pass.rows.filter(r=>r.outcome==='checked').map(r=>r.id).join('|')==='price-0|bls|cpi'&&"+E+".bls.calendar.events.length===2&&"+E+".cpi.headlines.items.length===2");
        boundary(1,1,1,0,0,1);
        rawCpi=page.read(new Script("JSON.stringify("+E+".cpi.headlines)"));
        rawBls=page.read(new Script("JSON.stringify("+E+".bls.calendar)"));
        rawBoard=page.read(new Script("JSON.stringify("+E+".board.rows[0].response)"));
        await("CPI offset and fractional clocks stay distinct from scheduled BLS and retrieval clocks",
            E+".cpi.headlines.fetchedAt==='2026-10-28T19:00:00.000Z'&&"+E+".cpi.headlines.feedUpdatedAt==='2026-10-03T06:45:09.000000001+02:00'&&"+E+".cpi.headlines.items[0].publishedAt==='2026-10-01T07:15:22.123456-04:00'&&"+E+".cpi.headlines.items[0].updatedAt==='2026-10-02T09:45:10.1200+05:30'&&"+E+".cpi.headlines.items[1].publishedAt===null&&"+E+".bls.calendar.events[0].scheduledAt==='2026-10-30T12:30:00.000Z'&&"+E+".bls.calendar.fetchedAt==='2026-10-20T18:00:00.000Z'");
    }
    private void createScheduledCheck() throws Exception {
        page.click(Element.xpath("//li[@data-day-source='bls'][a[normalize-space(.)='Invented October release']]/button[normalize-space(.)='Keep a dated check']"));
        chooseCompany("calendar","BETB · Beta Company · Class C · XNAS","listing-beta-c");
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#calendar-followup-question","authored scheduled question",SCHEDULED_QUESTION));
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#calendar-followup-due","authored date independent of schedule",DUE));
        page.click(Element.css("#calendar-followup-load"));
        await("one explicit initial resource Load preserves the independently selected company and authored fields",F+".load===1&&"+R+".entries.length===2&&document.querySelector('#calendar-followup-company')?.value==='listing-beta-c'");
        page.click(Element.css("#calendar-followup-preview"));
        await("scheduled preview preserves its full original schedule citation", "document.querySelector('#calendar-followup-check')?.value==="+JSONObject.quote(SCHEDULED_CHECK));
        page.click(Element.css("#calendar-followup-create"));
        await("one scheduled draft preserves both originals and selects exact Class C",R+".entries.length===3&&"+R+".entries[2].listing.listingId==='listing-beta-c'&&"+R+".entries[2].check==="+JSONObject.quote(SCHEDULED_CHECK)+"&&"+R+".entries[2].dueOn==="+JSONObject.quote(DUE)+"&&"+F+".save===0");
    }
    private void createCpiCheck() throws Exception {
        page.click(Element.xpath("//section[contains(@class,'managed-cpi-headlines')]//li[h3[normalize-space(.)='Invented CPI headline: prices and household plans']]//button[normalize-space(.)='Keep a dated check']"));
        chooseCompany("cpi","ZERO · Zero Company · Class A · XNAS","listing-zero");
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#cpi-followup-question","authored CPI question",QUESTION));
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#cpi-followup-due","independent authored CPI date",DUE));
        page.click(Element.css("#cpi-followup-preview"));
        await("complete CPI citation retains both original feed item clocks without a second resource Load", "document.querySelector('#cpi-followup-check')?.value==="+JSONObject.quote(CHECK)+"&&"+F+".load===1");
        page.click(Element.css("#cpi-followup-create"));
        await("two new exact company checks coexist with every original entry and result", R+".entries.length===4&&"+R+".entries[3].listing.listingId==='listing-zero'&&"+E+".encodedFollowups==="+E+".expectedEncodedFollowups&&"+F+".save===0");
        complete=page.read(new Script(E+".expectedEncodedFollowups"));
    }
    private void researchBackAndReturn() throws Exception {
        page.click(Element.css("#cpi-followup-review"));
        await("Review retains the original complete briefing beside the exact selected check",R+".selectedId==="+R+".entries[3].id&&document.querySelector('#markets-briefing-return')!==null&&"+E+".retainedCpiReference===true&&"+E+".retainedBlsReference===true");
        String id=page.read(new Script(R+".entries[3].id"));
        page.click(Element.css("#managed-followup-research-"+id));
        page.await(new Check("explicit Research resolves only ZERO and displays its complete question",new Script("location.href==='https://localhost/?company=listing-zero&section=price'&&document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'&&document.querySelector('.managed-company-visit')?.textContent.includes("+JSONObject.quote(CHECK)+")")).nativeReady());
        keyboard.closeSoftKeyboard();pressBack();
        page.await(new Check("one Back restores the owned check and the available briefing return",new Script("location.href==='https://localhost/'&&document.querySelector('.managed-company-visit')===null&&"+R+".selectedId==="+JSONObject.quote(id)+"&&document.querySelector('#markets-briefing-return')?.disabled===false")).nativeReady());
        page.click(Element.css("#markets-briefing-return"));
        await("owned return focuses the passive reading and retains every original packet without source replay",
            "document.activeElement?.id==='managed-markets-briefing-heading'&&document.querySelector('#markets-briefing-new')!==null&&"+E+".encodedFollowups==="+JSONObject.quote(complete)+"&&"+E+".retainedCpiReference===true&&"+E+".retainedBlsReference===true&&JSON.stringify("+E+".reading.cpi.headlines)==="+JSONObject.quote(rawCpi)+"&&JSON.stringify("+E+".reading.bls.calendar)==="+JSONObject.quote(rawBls)+"&&JSON.stringify("+E+".reading.board.rows[0].response)==="+JSONObject.quote(rawBoard));
        boundary(1,1,1,1,1,1);
        await("passive reading contains whole clocks, both source rows and unknown values without live controls", "(()=>{const s=document.querySelector('.managed-markets-briefing-reading');return ['2026-10-03T06:45:09.000000001+02:00','2026-10-01T07:15:22.123456-04:00','2026-10-02T09:45:10.1200+05:30','2026-10-30T12:30:00.000Z','Invented November release','Invented CPI headline with unknown feed clocks'].every(t=>s.textContent.includes(t))&&s.querySelectorAll('button,input,select,textarea').length===0&&s.querySelectorAll('[data-briefing-source]').length===10;})()");
        retainHeadingFrame();
    }
    private void retainHeadingFrame() throws Exception {
        page.read(new Script("(()=>{document.querySelector('#managed-markets-briefing-heading').scrollIntoView({block:'center',behavior:'instant'});return 'positioned';})()"));
        String visible="(()=>{const h=document.querySelector('#managed-markets-briefing-heading'),r=h?.getBoundingClientRect(),v=visualViewport;return h?.textContent==='Retained Markets briefing'&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height&&h.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;})()";
        page.await(new Check("only the retained reading heading is claimed visible in this frame",new Script(visible)).nativeReady());
        android.util.Log.i("MarketsBriefingFrameScope","retained-reading-heading-only; complete evidence asserted functionally, not all visible in one frame");
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.MARKETS_BRIEFING)).retain();
        await("heading ownership remains unchanged after PixelCopy",visible);
    }
    private void saveAndFreshLoad() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.click(Element.css("#managed-followups-save"));
        await("separate explicit Save commits the full four-entry resource exactly once",F+".save===1&&"+F+".commits===1&&"+R+".baseVersion===2&&"+R+".dirty===false&&"+E+".encodedFollowups==="+JSONObject.quote(complete));
        page.click(Element.css("#fixture-followups-fresh-session"));
        await("fresh session has no retained source packets or automatically loaded Follow-ups",C+".load===2&&"+F+".session===2&&"+R+".entries===null&&"+E+".cpi.headlines===null&&"+E+".reading===null");
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.click(Element.css("#managed-followups-load"));
        await("fresh explicit Load restores all complete original and authored values",F+".load===2&&"+R+".entries.length===4&&"+R+".baseVersion===2&&"+E+".encodedFollowups==="+JSONObject.quote(complete)+"&&"+E+".encodedFollowups==="+E+".expectedEncodedFollowups");
    }
    private void await(String reason,String condition) throws Exception {page.await(new Check(reason,new Script(condition)));}
    private void boundary(int eod,int bls,int cpi,int resolve,int loads,int sessions) throws Exception {
        await("same fixed local origin, CSP, source identity and exact independent budgets", "location.origin==='https://localhost'&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+"&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+"&&"+C+".load==="+sessions+"&&"+C+".status==="+sessions+"&&"+C+".marketsResolve==="+sessions+"&&"+C+".eod==="+eod+"&&"+C+".bls==="+bls+"&&"+C+".cpi==="+cpi+"&&"+C+".resolve==="+resolve+"&&"+F+".load==="+loads+"&&"+C+".annual===0&&"+C+".interimReport===0&&"+C+".filings===0&&"+C+".calendar===0&&"+C+".fed===0&&"+C+".save===0&&"+C+".search===0&&"+C+".portfolioLoad===0&&"+C+".portfolioSave===0&&"+C+".valuationLoad===0&&"+C+".valuationSave===0&&"+C+".token===0&&"+C+".signOut===0&&"+F+".replays===0");
    }
    @After public void closeInventedBriefing(){try{if(scenario!=null){scenario.close();scenario=null;}}finally{if(assets!=null)assets.close();}}
    private void chooseCompany(String prefix,String label,String listingId) throws Exception {
        String selector="#"+prefix+"-followup-company";
        page.read(new Script("(()=>{const s=document.querySelector('"+selector+"');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("enabled native destination starts blank and retains distinct Class A and Class C choices",new Script(
            "(()=>{const s=document.querySelector('"+selector+"');return document.activeElement===s&&!s.disabled&&s.value===''&&[...s.options].map(o=>o.value).join('|')==='|listing-zero|listing-beta-a|listing-beta-c';})()")).nativeReady());
        onView(isAssignableFrom(WebView.class)).check((view,missing)->{if(missing!=null)throw missing;assertTrue(view.hasFocus()&&view.hasWindowFocus());}).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog=new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("native company choice selects the exact independent listing",new Script("document.querySelector("+JSONObject.quote(selector)+")?.value==="+JSONObject.quote(listingId)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));
        keyboard.closeSoftKeyboard();
    }

}
