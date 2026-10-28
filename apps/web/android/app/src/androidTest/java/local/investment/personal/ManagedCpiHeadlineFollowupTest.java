package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static org.junit.Assert.*;

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
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** Invented CPI metadata becomes one independently chosen exact company check. */
@RunWith(AndroidJUnit4.class)
public class ManagedCpiHeadlineFollowupTest {
    private static final String QUESTION="Will this change my ZERO research? Café 東京 📈";
    private static final String DUE="2026-12-31";
    private static final String TITLE="Invented CPI headline: prices and household plans";
    private static final String URL="https://www.bls.gov/news.release/archives/cpi_10012026.htm";
    private static final String PUBLISHED="2026-10-01T07:15:22.123456-04:00";
    private static final String UPDATED="2026-10-02T09:45:10.1200+05:30";
    private static final String FEED_UPDATED="2026-10-03T06:45:09.000000001+02:00";
    private static final String FETCHED="2026-10-28T19:00:00.000Z";
    private static final String CHECK="Question: Will this change my ZERO research? Café 東京 📈 | U.S. Bureau of Labor Statistics CPI headline: Invented CPI headline: prices and household plans. Feed published: 2026-10-01T07:15:22.123456-04:00; feed updated: 2026-10-02T09:45:10.1200+05:30. https://www.bls.gov/news.release/archives/cpi_10012026.htm";
    private static final String NOTE="CPI source keeps this independent unsaved note. Café 東京 📈";
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String R="JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String W="JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String E="JSON.parse(document.querySelector('#fixture-cpi-followup-evidence').textContent)";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private record Reads(String phase,int sessions,int marketsResolves,int cpi,int resolves,int followups,int saves) {}
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private String watchlist;
    private String followups;

    @Before public void launchInventedCpiQuestion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha);assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.CPI_HEADLINE_FOLLOWUP);
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
        page.awaitStartup(new Check("fixed invented startup has no CPI or Follow-ups read",new Script(
            "document.querySelector('#fixture-cpi-followup-evidence')!==null&&"+C+".load===1&&"+C+".status===1&&"+C+".marketsResolve===1&&"+R+".entries===null&&"+W+".memberships?.length===3")).nativeReady());
        scenario.onActivity(activity->activity.getBridge().getWebView().clearHistory());
        boundary(new Reads("startup",1,1,0,0,0,0));
    }
    @Test public void publishedRawClocksKeepIndependentExactCitedCheckThroughReviewResearchBackAndSeparateSave() throws Exception {
        String document=page.read(new Script("String(performance.timeOrigin)"));
        authorWatchlistAndOpenMarkets();loadAndInspectClocks();chooseIndependentCompany();authorAndLoad();refuseOverflowAndStale();createOnce();reviewResearchAndBack();saveAndFreshLoad();
        assertEquals("same mounted native document owns this complete journey",document,page.read(new Script("String(performance.timeOrigin)")));
        boundary(new Reads("fresh-followups-loaded",2,3,1,1,2,1));
    }
    private void authorWatchlistAndOpenMarkets() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        replace("#managed-note-0",NOTE);
        page.await(new Check("independent exact Watchlist members and complete unsaved note exist before source choice",new Script(
            W+".dirty===true&&"+W+".memberships.map(m=>m.listingId).join('|')==='listing-zero|listing-beta-a|listing-beta-c'&&"+W+".memberships[0].note==="+JSONObject.quote(NOTE))));
        watchlist=page.read(new Script(E+".encodedWatchlist"));
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Markets']"));
        page.await(new Check("settled Markets panel starts unloaded with enabled manual Load and no destination form",new Script(
            "location.href==='https://localhost/'&&document.querySelector('#managed-cpi-heading')?.textContent==='Published CPI headlines'&&document.querySelector('#cpi-headlines-load')?.textContent==='Load CPI headlines'&&document.querySelector('#cpi-headlines-load')?.disabled===false&&document.querySelector('#cpi-followup-company')===null")).nativeReady());
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#cpi-headlines-filter","filter only already loaded CPI headlines","Invented"));
        boundary(new Reads("first-markets-return",1,2,0,0,0,0));
    }
    private void loadAndInspectClocks() throws Exception {
        page.click(Element.css("#cpi-headlines-load"));
        page.await(new Check("one explicit CPI read admits both bounded invented metadata rows",new Script(
            C+".cpi===1&&"+E+".packet.items.length===2&&"+E+".packet.availableItemCount===2&&document.querySelector('#cpi-headlines-load')?.textContent==='Refresh CPI headlines'&&document.querySelector('#cpi-headlines-load')?.disabled===false&&document.querySelectorAll('.managed-cpi-headlines > ul > li').length===2")));
        chooseSource("Invented CPI headline with unknown feed clocks");
        page.await(new Check("null published and updated clocks remain explicitly Unknown beside independent root and retrieval clocks",new Script(
            "(()=>{const s=document.querySelector('[aria-label=\"Selected CPI headline source\"]');const has=(k,v)=>[...s.querySelectorAll('dl > div')].some(d=>d.querySelector('dt')?.textContent===k&&d.querySelector('dd')?.textContent===v);return has('Feed published time','Unknown')&&has('Feed updated time','Unknown')&&has('Feed-level updated time',"+JSONObject.quote(FEED_UPDATED)+")&&has('Retrieved (UTC)',"+JSONObject.quote(FETCHED)+")&&document.querySelector('#cpi-followup-company')?.value==='';})()")));
        boundary(new Reads("unknown-headline-choice",1,2,1,0,0,0));
        chooseSource(TITLE);assertSource();
        page.await(new Check("source choice never infers company relevance or reads a destination resource",new Script(
            "document.querySelector('#cpi-followup-company')?.value===''&&document.querySelector('#managed-cpi-followup')?.textContent.includes('No company is selected automatically.')&&"+R+".entries===null")));
        boundary(new Reads("known-headline-choice",1,2,1,0,0,0));
    }
    private void chooseSource(String title) {
        page.click(Element.xpath("//section[contains(@class,'managed-cpi-headlines')]//li[h3[normalize-space(.)='"+title+"']]//button[normalize-space(.)='Keep a dated check']"));
    }
    private void assertSource() throws Exception {
        page.await(new Check("full selected original title/link/id and both raw offset/fraction clocks retain their exact independent meanings",new Script(
            "(()=>{const s=document.querySelector('[aria-label=\"Selected CPI headline source\"]');const has=(k,v)=>[...s.querySelectorAll('dl > div')].some(d=>d.querySelector('dt')?.textContent===k&&d.querySelector('dd')?.textContent===v);return s?.querySelector('h4')?.textContent==="+JSONObject.quote(TITLE)+
            "&&has('Source','U.S. Bureau of Labor Statistics · Consumer Price Index')&&has('Feed published time',"+JSONObject.quote(PUBLISHED)+")&&has('Feed updated time',"+JSONObject.quote(UPDATED)+")&&has('Feed-level updated time',"+JSONObject.quote(FEED_UPDATED)+")&&has('Retrieved (UTC)',"+JSONObject.quote(FETCHED)+")&&has('Source entry ID','urn:invented:cpi:clock-1')&&s.querySelector('a')?.getAttribute('href')==="+JSONObject.quote(URL)+"&&s.textContent.includes('not independently verified economic-release or embargo times');})()")));
    }
    private void chooseIndependentCompany() throws Exception {
        String selector="#cpi-followup-company";
        page.read(new Script("(()=>{const s=document.querySelector('"+selector+"');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("enabled native destination starts blank and retains distinct Class A and Class C choices",new Script(
            "(()=>{const s=document.querySelector('"+selector+"');return document.activeElement===s&&!s.disabled&&s.value===''&&[...s.options].map(o=>o.value).join('|')==='|listing-zero|listing-beta-a|listing-beta-c';})()")).nativeReady());
        onView(isAssignableFrom(WebView.class)).check((view,missing)->{if(missing!=null)throw missing;assertTrue(view.hasFocus()&&view.hasWindowFocus());}).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog=new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText("ZERO · Zero Company · Class A · XNAS")).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("only native company choice selects exact ZERO/Class A/XNAS",new Script("document.querySelector('#cpi-followup-company')?.value==='listing-zero'"),ReportRevisitPage.Readiness.NATIVE,dialog.get()));
        keyboard.closeSoftKeyboard();boundary(new Reads("independent-company-choice",1,2,1,0,0,0));
    }
    private void authorAndLoad() throws Exception {
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#cpi-followup-question","complete oversized question","x".repeat(500)));
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#cpi-followup-due","authored UTC due date",DUE));
        page.await(new Check("unloaded Follow-ups offers only the explicit initial Load",new Script(
            "document.querySelector('#cpi-followup-load')?.textContent==='Load follow-ups for this question'&&document.querySelector('#cpi-followup-load')?.disabled===false&&"+F+".load===0")));
        page.click(Element.css("#cpi-followup-load"));
        page.await(new Check("explicit initial Load retains full raw question/date/company and both original complete entries",new Script(
            "document.querySelector('#cpi-followup-question')?.value==='x'.repeat(500)&&document.querySelector('#cpi-followup-due')?.value==="+JSONObject.quote(DUE)+"&&document.querySelector('#cpi-followup-company')?.value==='listing-zero'&&"+F+".load===1&&"+R+".baseVersion===1&&"+R+".dirty===false&&"+E+".encodedFollowups==="+E+".originalEncodedFollowups")));
        assertSource();boundary(new Reads("initial-followups-loaded",1,2,1,0,1,0));
    }
    private void refuseOverflowAndStale() throws Exception {
        page.click(Element.css("#cpi-followup-preview"));
        page.await(new Check("oversized combined question/citation is refused without clipping or resource change",new Script(
            "document.querySelector('#cpi-followup-create')===null&&document.querySelector('#cpi-followup-check')===null&&document.querySelector('#cpi-followup-status')?.textContent.includes('500')&&document.querySelector('#cpi-followup-question')?.value==='x'.repeat(500)&&"+E+".encodedFollowups==="+E+".originalEncodedFollowups")));
        replace("#cpi-followup-question",QUESTION);preview();
        replace("#cpi-followup-due","2026-12-30");replace("#cpi-followup-due",DUE);
        page.await(new Check("restoring the old due date cannot revive the retired preview",new Script(
            "document.querySelector('#cpi-followup-create')===null&&"+E+".encodedFollowups==="+E+".originalEncodedFollowups")));
        preview();page.click(Element.css("#cpi-followup-cancel"));
        page.await(new Check("Cancel closes only the question disclosure and retires the preview",new Script(
            "document.querySelector('#managed-cpi-followup > details')?.open===false&&document.querySelector('#cpi-followup-check')===null&&"+E+".encodedFollowups==="+E+".originalEncodedFollowups")));
        page.click(Element.css("#managed-cpi-followup > details > summary"));
        page.await(new Check("explicit reopen retains the complete authored fields without another source read",new Script(
            "document.querySelector('#cpi-followup-question')?.value==="+JSONObject.quote(QUESTION)+"&&document.querySelector('#cpi-followup-due')?.value==="+JSONObject.quote(DUE)+"&&document.querySelector('#cpi-followup-company')?.value==='listing-zero'")));
        boundary(new Reads("authored-form-reopened",1,2,1,0,1,0));
    }
    private void preview() throws Exception {
        page.click(Element.css("#cpi-followup-preview"));
        page.await(new Check("complete current preview shows the literal full citation, authored UTC date and exact independent listing",new Script(
            "(()=>{const p=document.querySelector('[aria-label=\"CPI next check preview\"]'),t=document.querySelector('#cpi-followup-check');return t?.readOnly&&t.value==="+JSONObject.quote(CHECK)+"&&p.textContent.includes('Due date (UTC): "+DUE+"')&&p.textContent.includes('ZERO')&&p.textContent.includes('Class A')&&p.textContent.includes('XNAS')&&p.textContent.includes('Save follow-ups is separate.')&&p.querySelector('#cpi-followup-create')?.textContent==='Create follow-up draft'&&document.activeElement===p.querySelector('h4');})()")));
        assertSource();
    }
    private void retainCompletePreviewFrame() throws Exception {
        page.click(Element.css("[aria-label='CPI next check preview'] > details > summary"));
        page.await(new Check("expanded preview identity contains every exact independent stable identifier",new Script(
            "(()=>{const d=document.querySelector('[aria-label=\"CPI next check preview\"] > details');return d?.open&&['listing-zero','security-zero','class-zero','issuer-zero','XNAS','US'].every(v=>[...d.querySelectorAll('dd')].some(e=>e.textContent===v));})()")));
        page.click(Element.css("[aria-label='CPI next check preview'] > details > summary"));
        String targets=":scope > h4,:scope > label,#cpi-followup-check,:scope > p:first-of-type,:scope > p:nth-of-type(2),:scope > p:nth-of-type(3)";
        page.read(new Script("(()=>{const p=document.querySelector('[aria-label=\"CPI next check preview\"]'),v=visualViewport,n=document.querySelector('.managed-navigation'),targets=p?[...p.querySelectorAll("+JSONObject.quote(targets)+")]:[];if(!v||targets.length!==6)return 'unavailable';const rects=targets.map(e=>e.getBoundingClientRect()),top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom)),nav=n?.getBoundingClientRect(),lower=nav&&getComputedStyle(n).position==='fixed'?Math.min(v.offsetTop+v.height,nav.top):v.offsetTop+v.height;window.scrollBy({top:(top+bottom-v.offsetTop-lower)/2,behavior:'instant'});return 'positioned';})()"));
        String visible="(()=>{const p=document.querySelector('[aria-label=\"CPI next check preview\"]'),v=visualViewport,t=p?.querySelector('#cpi-followup-check'),targets=p?[...p.querySelectorAll("+JSONObject.quote(targets)+")]:[];if(!v)return false;const n=document.querySelector('.managed-navigation'),nav=n?.getBoundingClientRect(),lower=nav&&getComputedStyle(n).position==='fixed'?Math.min(v.offsetTop+v.height,nav.top):v.offsetTop+v.height;return v&&p?.querySelector('details')?.open===false&&t?.readOnly&&t.value==="+JSONObject.quote(CHECK)+"&&t.scrollWidth<=t.clientWidth+1&&t.scrollHeight<=t.clientHeight+1&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&targets.length===6&&targets.every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e.checkVisibility()&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=lower&&e.contains(hit);});})()";
        page.await(new Check("complete unscrolled question, UTC due date and inline exact listing are unobscured above fixed navigation",new Script(visible)).nativeReady());
        android.util.Log.i("ManagedCpiPreviewScope",page.read(new Script("JSON.stringify((()=>{const t=document.querySelector('#cpi-followup-check'),v=visualViewport,b=document.querySelector('#cpi-followup-create'),r=b.getBoundingClientRect();return {scope:'complete-cited-question-utc-date-inline-listing',expandedStableIdentity:'checked-functionally-before-capture-then-collapsed',textareaInternalVerticalScroll:t.scrollHeight>t.clientHeight+1,textareaClientHeight:t.clientHeight,textareaScrollHeight:t.scrollHeight,createInsideViewport:r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,viewportWidth:v.width,viewportHeight:v.height};})())")));
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.CPI_HEADLINE_PREVIEW)).retain();
        page.await(new Check("the same complete preview remains current after committed PixelCopy",new Script(visible)));
    }
    private void createOnce() throws Exception {
        preview();retainCompletePreviewFrame();
        page.read(new Script("(()=>{document.querySelector('#cpi-followup-create').scrollIntoView({block:'center',behavior:'instant'});return 'positioned';})()"));
        page.await(new Check("enabled Create is a visible unobscured 44px action before one effect",new Script(
            "(()=>{const b=document.querySelector('#cpi-followup-create'),r=b?.getBoundingClientRect();return !b?.disabled&&r.height>=44&&r.width>=44&&b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
        page.click(Element.css("#cpi-followup-create"));
        page.await(new Check("Create adds only one complete ZERO check after both untouched assessments",new Script(
            R+".entries?.length===3&&"+R+".dirty===true&&"+R+".baseVersion===1&&document.querySelector('#cpi-followup-create')===null&&"+E+".encodedFollowups==="+E+".expectedEncodedFollowups&&"+R+".entries[2].check==="+JSONObject.quote(CHECK)+"&&"+R+".entries[2].dueOn==="+JSONObject.quote(DUE)+"&&"+R+".entries[2].listing.listingId==='listing-zero'&&"+R+".entries[2].listing.shareClassId==='class-zero'&&"+R+".entries[2].catalogSnapshotSha256==='sha256:'+'a'.repeat(64)&&"+R+".entries[2].status==='open'&&"+R+".entries[2].completedOn===null&&"+R+".entries[2].result===''") ));
        followups=page.read(new Script(E+".expectedEncodedFollowups"));
        page.click(Element.css("#cpi-followup-preview"));
        page.await(new Check("duplicate attempt refuses before Create or overwrite",new Script(
            "document.querySelector('#cpi-followup-create')===null&&document.querySelector('#cpi-followup-check')===null&&document.querySelector('#cpi-followup-status')?.textContent.includes('already has a follow-up')&&document.querySelector('#cpi-followup-review')?.textContent==='Review follow-up'")));
        assertDrafts();boundary(new Reads("draft-created",1,2,1,0,1,0));
    }
    private void reviewResearchAndBack() throws Exception {
        page.click(Element.css("#cpi-followup-review"));
        page.await(new Check("Review selects this exact complete entry in global Follow-ups",new Script(
            "location.href==='https://localhost/'&&document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&"+R+".selectedId==="+R+".entries[2].id&&"+R+".filter==='open'&&document.querySelector('#managed-followup-check')?.value==="+JSONObject.quote(CHECK)+"&&document.querySelector('#managed-followup-due')?.value==="+JSONObject.quote(DUE))));
        String id=page.read(new Script(R+".entries[2].id"));assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        page.click(Element.css("#managed-followup-research-"+id));
        page.await(new Check("explicit Research resolves only exact ZERO and starts no financial or CPI read",new Script(
            "location.href==='https://localhost/?company=listing-zero&section=price'&&document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'&&document.querySelector('.managed-company-visit')?.textContent.includes("+JSONObject.quote(CHECK)+")&&document.querySelector('.managed-company-visit .trial-toolbar > button')?.textContent==='Back to workspace'")).nativeReady());
        keyboard.closeSoftKeyboard();pressBack();
        page.await(new Check("one hardware Back retains the selected global check and original CPI packet",new Script(
            "location.href==='https://localhost/'&&document.querySelector('.managed-company-visit')===null&&document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&"+R+".selectedId==="+JSONObject.quote(id)+"&&document.querySelector('#managed-followup-check')?.value==="+JSONObject.quote(CHECK)+"&&"+E+".packet.fetchedAt==="+JSONObject.quote(FETCHED)+"&&"+E+".packet.items[0].publishedAt==="+JSONObject.quote(PUBLISHED)+"&&"+E+".packet.items[0].updatedAt==="+JSONObject.quote(UPDATED))));
        assertDrafts();boundary(new Reads("research-back",1,2,1,1,1,0));
    }
    private void saveAndFreshLoad() throws Exception {
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("only separate explicit Follow-ups Save commits the full canonical resource once",new Script(
            R+".baseVersion===2&&"+R+".dirty===false&&"+F+".save===1&&"+F+".commits===1")));
        assertDrafts();boundary(new Reads("followups-saved",1,2,1,1,1,1));
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("explicit fresh invented session discards local drafts but neither reloads CPI nor saves the independent note",new Script(
            F+".session===2&&"+R+".entries===null&&"+F+".load===1&&"+C+".load===2&&"+W+".memberships[0].note==='Original independent CPI note'&&"+E+".packet===null")));
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.await(new Check("visible global Follow-ups offers explicit fresh Load",new Script(
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&document.querySelector('#managed-followups-load')?.disabled===false")).nativeReady());
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("fresh explicit Load restores all original entries and the exact complete saved citation/date/identity",new Script(
            F+".load===2&&"+R+".baseVersion===2&&"+R+".dirty===false&&"+E+".encodedFollowups==="+JSONObject.quote(followups)+"&&"+E+".encodedFollowups==="+E+".expectedEncodedFollowups")));
    }
    private void assertDrafts() throws Exception {
        page.await(new Check("complete canonical Follow-ups stays exact while the whole independent Watchlist remains dirty and unsaved",new Script(
            E+".encodedFollowups==="+JSONObject.quote(followups)+"&&"+E+".encodedWatchlist==="+JSONObject.quote(watchlist)+"&&"+W+".dirty===true&&"+C+".save===0")));
    }
    private void replace(String selector,String text) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(selector,"replace invented CPI field"));
        page.await(new Check("current controlled editor has native focus before replacement",new Script("document.activeElement===document.querySelector("+JSONObject.quote(selector)+")")));
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection covers the complete old field",new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){
            public Matcher<View> getConstraints(){return isDisplayed();}
            public String getDescription(){return "replace invented CPI text through native IME";}
            public void perform(UiController controller,View view){assertTrue(view.hasFocus()&&view.hasWindowFocus());android.view.inputmethod.InputConnection input=((WebView)view).onCreateInputConnection(new android.view.inputmethod.EditorInfo());assertNotNull(input);assertTrue(input.commitText(text,1));controller.loopMainThreadUntilIdle();}
        });
        page.await(new Check("the complete native replacement reaches the controlled product field",new Script("document.querySelector("+JSONObject.quote(selector)+")?.value==="+JSONObject.quote(text))));
        keyboard.closeSoftKeyboard();
    }
    private void boundary(Reads reads) throws Exception {
        page.await(new Check("fixed source/origin/CSP and every independent read/write counter remain exact: "+reads.phase(),new Script(
            "location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+"&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            "&&"+C+".load==="+reads.sessions()+"&&"+C+".status==="+reads.sessions()+"&&"+C+".marketsResolve==="+reads.marketsResolves()+"&&"+C+".cpi==="+reads.cpi()+"&&"+C+".resolve==="+reads.resolves()+"&&"+C+".save===0&&"+C+".eod===0&&"+C+".annual===0&&"+C+".interimReport===0&&"+C+".filings===0&&"+C+".marketsEod===0&&"+C+".calendar===0&&"+C+".bls===0&&"+C+".fed===0&&"+C+".search===0&&"+C+".portfolioLoad===0&&"+C+".portfolioSave===0&&"+C+".valuationLoad===0&&"+C+".valuationSave===0&&"+C+".token===0&&"+C+".signOut===0&&"+F+".load==="+reads.followups()+"&&"+F+".save==="+reads.saves()+"&&"+F+".commits==="+reads.saves()+"&&"+F+".replays===0&&"+F+".token===0&&"+F+".signOut===0")));
    }
    @After public void closeInventedCpiQuestion(){try{if(scenario!=null){scenario.close();scenario=null;}}finally{if(assets!=null)assets.close();}}
}
