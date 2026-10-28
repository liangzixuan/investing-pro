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
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
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

/** One authored scenario becomes a dated draft, with independent review, research and persistence. */
@RunWith(AndroidJUnit4.class)
public class ManagedValuationScenarioFollowupTest {
    private static final String QUESTION="Will this authored case hold? Café 東京 📈";
    private static final String DUE="2026-12-31";
    private static final String CHECK="Question: Will this authored case hold? Café 東京 📈 | Authored estimate: Exit multiple authored-exit-multiple-v1; Base scenario; USD/share 19.00. Summary only; inputs and source evidence not included.";
    private static final String NOTE="Independent unsaved Watchlist note Café 東京 📈";
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String R="JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String W="JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String V="JSON.parse(document.querySelector('#fixture-valuation-draft').textContent)";
    private static final String CANONICAL_FOLLOWUPS="document.querySelector('#fixture-valuation-followup-canonical').textContent";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final String EXIT_SHARES=".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-exit-dilutedShares']";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private ReportRevisitTouch touch;
    private String sourceSha;
    private String watchlist;
    private String followups;
    private String canonicalFollowups;

    @Before public void launchInventedValuationQuestion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha); assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.VALUATION_SCENARIO_FOLLOWUP);
        assets.prepare(); scenario=ActivityScenario.launch(MainActivity.class);
        page=new ReportRevisitPage(scenario); touch=new ReportRevisitTouch(page); keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(activity->{
            assertEquals("local.investment.personal",activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity); activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("fixed synthetic startup has no implicit source, calculation or Follow-ups read",new Script(C+".load===1&&"+C+".status===1&&"+C+".marketsResolve===1&&"+R+".entries===null&&document.querySelector('#fixture-valuation-draft')!==null")).nativeReady());
        scenario.onActivity(activity->activity.getBridge().getWebView().clearHistory());
        boundary(1,0,0,0);
    }
    @Test public void authoredScenarioKeepsExactDatedCheckThroughGlobalReviewResearchBackAndSeparateSave() throws Exception {
        String origin=page.read(new Script("String(performance.timeOrigin)"));
        openAndAuthor(); inspectBothModelsAndLoad(); rejectOverflowAndStale(); createOnce(); globalReviewResearchAndBack(); saveAndFreshLoad();
        assertEquals("same mounted native document owns the complete journey",origin,page.read(new Script("String(performance.timeOrigin)")));
        boundary(2,1,2,1);
    }
    private void openAndAuthor() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        replace("#managed-note-0",NOTE);
        watchlist=page.read(new Script("JSON.stringify("+W+")"));
        page.click(Element.css("button[aria-label='Annual report for saved ZERO']"));
        page.click(Element.css(".managed-valuation-workbench:not(.managed-valuation-assumptions) > summary"));
        page.await(new Check("valuation question tools begin closed with independent empty choices and no calculation",new Script(
            "document.querySelector('.managed-valuation-followup')?.open===false&&document.querySelector('#valuation-followup-model')?.value===''&&document.querySelector('#valuation-followup-scenario')?.value===''&&"+V+".calculation===null&&"+V+".editable===true")));
        page.click(Element.css(".managed-valuation-followup > summary"));
        for(String[] field:AnnualRevenueModelBasisExpectations.FIELDS) {
            String selector=".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-"+field[0]+"']";
            page.await(new Check("each initial authored operand is blank and labelled: "+field[0],new Script("(()=>{const e=document.querySelector("+JSONObject.quote(selector)+");return e?.value===''&&!e.disabled&&[...document.querySelectorAll('label')].some(l=>l.htmlFor===e.id);})()")));
            keyboard.enter(new ReportRevisitKeyboard.ControlledInput(selector,field[0],field[1]));
        }
        choose("#valuation-followup-model","dcf","Cash flow DCF");
        choose("#valuation-followup-scenario","base","Base");
        page.await(new Check("choosing both fields does not calculate or load",new Script(V+".calculation===null&&document.querySelector('#valuation-followup-preview')?.disabled===true&&document.querySelector('#valuation-followup-load')?.disabled===true")));
        calculate();
        page.await(new Check("only explicit Calculate creates both exact model results without choosing an alternative",new Script(V+".calculation?.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&"+V+".calculation?.exitResult.scenarios.base.valuePerShare==='19.00'&&document.querySelector('#valuation-followup-estimate')?.textContent==='Authored estimate: DCF authored-cash-flow-dcf-v1; Base scenario; USD/share 140.00. Summary only; inputs and source evidence not included.'&&"+F+".load===0")));
        boundary(1,0,0,0);
    }
    private void inspectBothModelsAndLoad() throws Exception {
        choose("#valuation-followup-model","exit","Exit EBITDA multiple");
        page.await(new Check("explicit Exit choice retains exact Base scenario and its own 19.00 estimate",new Script("document.querySelector('#valuation-followup-model')?.value==='exit'&&document.querySelector('#valuation-followup-scenario')?.value==='base'&&document.querySelector('#valuation-followup-estimate')?.textContent==='Authored estimate: Exit multiple authored-exit-multiple-v1; Base scenario; USD/share 19.00. Summary only; inputs and source evidence not included.'")));
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#valuation-followup-question","complete oversized question","x".repeat(500)));
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#valuation-followup-due","authored UTC due date",DUE));
        page.click(Element.css("#valuation-followup-load"));
        page.await(new Check("explicit initial Follow-ups Load retains all raw form choices and the complete earlier resource",new Script(F+".load===1&&"+R+".entries.length===2&&"+R+".baseVersion===1&&"+R+".dirty===false&&document.querySelector('#valuation-followup-question')?.value==='x'.repeat(500)&&document.querySelector('#valuation-followup-due')?.value==="+JSONObject.quote(DUE)+"&&document.querySelector('#valuation-followup-model')?.value==='exit'&&document.querySelector('#valuation-followup-scenario')?.value==='base'&&document.querySelector('#valuation-followup-load')===null")));
        followups=page.read(new Script("JSON.stringify("+R+".entries)"));
    }
    private void rejectOverflowAndStale() throws Exception {
        page.click(Element.css("#valuation-followup-preview"));
        page.await(new Check("complete combined check overflow refuses without clipping or a draft change",new Script("document.querySelector('#valuation-followup-create')===null&&document.querySelector('#valuation-followup-status')?.textContent.includes('500 characters')&&document.querySelector('#valuation-followup-question')?.value==='x'.repeat(500)&&JSON.stringify("+R+".entries)==="+JSONObject.quote(followups))));
        replace("#valuation-followup-question",QUESTION); preview();
        replace(EXIT_SHARES,"0");
        page.await(new Check("an authored input edit permanently retires the preview before recalculation",new Script("document.querySelector('#valuation-followup-create')===null&&"+V+".calculation===null&&JSON.stringify("+R+".entries)==="+JSONObject.quote(followups))));
        calculate();
        page.await(new Check("unavailable selected Exit result blocks Preview without autochoosing available DCF",new Script("document.querySelector('#valuation-followup-preview')?.disabled===true&&document.querySelector('#valuation-followup-model')?.value==='exit'&&"+V+".calculation?.exitResult.status!=='available'&&"+V+".calculation?.dcfResult.status==='available'")));
        replace(EXIT_SHARES,"100.00");
        replace(".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-dcf-startingUnleveredCashFlowUsd']","0");
        replace(".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-dcf-enterpriseToEquityBridgeUsd']","0");
        calculate(); choose("#valuation-followup-model","dcf","Cash flow DCF");
        page.await(new Check("literal zero cash flow remains unavailable under the authored DCF contract",new Script(V+".calculation?.dcfResult.status==='unavailable'&&"+V+".calculation.dcfResult.reason==='starting_cash_flow_nonpositive'&&document.querySelector('#valuation-followup-model')?.value==='dcf'&&document.querySelector('#valuation-followup-preview')?.disabled===true&&document.querySelector('#valuation-followup-create')===null")));
        replace(".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-dcf-startingUnleveredCashFlowUsd']","0.000000000001");
        replace(".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-dcf-dilutedShares']","1000000000000");
        calculate();
        page.await(new Check("tiny positive authored cash flow and large shares produce an available rounded zero without changing Exit inputs",new Script(V+".dcfDraft.startingUnleveredCashFlowUsd==='0.000000000001'&&"+V+".dcfDraft.dilutedShares==='1000000000000'&&"+V+".calculation?.dcfResult.status==='available'&&"+V+".calculation.dcfResult.scenarios.base.status==='available'&&"+V+".calculation.dcfResult.scenarios.base.valuePerShareUsd==='0.00'&&"+V+".calculation.exitResult.scenarios.base.valuePerShare==='19.00'")));
        page.click(Element.css("#valuation-followup-preview"));
        page.await(new Check("an available scenario rounded to exact zero remains a valid authored summary",new Script("document.querySelector('#valuation-followup-check')?.value==='Question: Will this authored case hold? Café 東京 📈 | Authored estimate: DCF authored-cash-flow-dcf-v1; Base scenario; USD/share 0.00. Summary only; inputs and source evidence not included.'&&document.querySelector('#valuation-followup-create')?.disabled===false&&"+V+".calculation?.dcfResult.status==='available'&&"+V+".calculation.dcfResult.scenarios.base.status==='available'")));
        choose("#valuation-followup-model","exit","Exit EBITDA multiple");
        page.await(new Check("switching model retires the complete zero preview before its distinct Exit preview",new Script("document.querySelector('#valuation-followup-create')===null")));
        preview();
        replace("#valuation-followup-due","2026-12-30"); replace("#valuation-followup-due",DUE);
        page.await(new Check("restoring an old due date does not revive its consumed preview",new Script("document.querySelector('#valuation-followup-create')===null&&JSON.stringify("+R+".entries)==="+JSONObject.quote(followups))));
        preview(); page.click(Element.css("#valuation-followup-cancel"));
        page.await(new Check("Cancel leaves exact authored question and draft unchanged",new Script("document.querySelector('#valuation-followup-check')===null&&document.querySelector('#valuation-followup-question')?.value==="+JSONObject.quote(QUESTION)+"&&JSON.stringify("+R+".entries)==="+JSONObject.quote(followups))));
        boundary(1,0,1,0);
    }
    private void preview() throws Exception {
        page.click(Element.css("#valuation-followup-preview"));
        page.await(new Check("complete current preview retains exact model/version/scenario/value, UTC date, catalog and full listing identity",new Script("(()=>{const p=document.querySelector('[aria-label=\"Valuation follow-up preview\"]'),t=document.querySelector('#valuation-followup-check'),catalog=p?.querySelector('#valuation-followup-catalog');return t?.readOnly&&t.value==="+JSONObject.quote(CHECK)+"&&p.textContent.includes('Due date (UTC): "+DUE+"')&&p.textContent.includes('ZERO')&&p.textContent.includes('Class A')&&catalog?.textContent==='sha256:'+'a'.repeat(64)&&catalog.previousElementSibling?.textContent==='Catalog snapshot'&&['listing-zero','security-zero','class-zero','issuer-zero','XNAS'].every(v=>[...p.querySelectorAll('dd')].some(e=>e.textContent===v))&&p.textContent.includes('Create changes only the Follow-ups draft.')&&p.querySelector('button')?.getBoundingClientRect().height>=44&&document.activeElement===p.querySelector('h4');})()")));
    }
    /** The native viewport shows the check control/date/listing/actions. Expanded identity and any internal text scroll have separate limits. */
    private void retainCompletePreviewFrame() throws Exception {
        page.click(Element.css("[aria-label='Valuation follow-up preview'] > details > summary"));
        page.await(new Check("expanded complete identity keeps its exact catalog and stable listing/share-class fields",new Script("(()=>{const p=document.querySelector('[aria-label=\"Valuation follow-up preview\"]'),d=p?.querySelector('details'),catalog=p?.querySelector('#valuation-followup-catalog');return d?.open&&catalog?.textContent==='sha256:'+'a'.repeat(64)&&catalog.previousElementSibling?.textContent==='Catalog snapshot'&&['listing-zero','security-zero','class-zero','issuer-zero','XNAS'].every(v=>[...d.querySelectorAll('dd')].some(e=>e.textContent===v));})()")));
        page.click(Element.css("[aria-label='Valuation follow-up preview'] > details > summary"));
        String targets="#valuation-followup-check,:scope > p:first-of-type,:scope > p:nth-of-type(2),:scope > p:nth-of-type(3),#valuation-followup-create";
        page.read(new Script("(()=>{const p=document.querySelector('[aria-label=\"Valuation follow-up preview\"]'),v=visualViewport,n=document.querySelector('.managed-navigation');"+
            "const targets=p?[...p.querySelectorAll("+JSONObject.quote(targets)+")]:[];if(!v||targets.length!==5)return 'unavailable';"+
            "const rects=targets.map(e=>e.getBoundingClientRect()),top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));"+
            "const nav=n?.getBoundingClientRect(),lower=nav&&getComputedStyle(n).position==='fixed'?Math.min(v.offsetTop+v.height,nav.top):v.offsetTop+v.height;"+
            "window.scrollBy({top:(top+bottom-v.offsetTop-lower)/2,behavior:'instant'});return 'positioned';})()"));
        String visible="(()=>{const p=document.querySelector('[aria-label=\"Valuation follow-up preview\"]'),v=visualViewport,t=p?.querySelector('#valuation-followup-check');"+
            "const targets=p?[...p.querySelectorAll("+JSONObject.quote(targets)+")]:[];return v&&p?.querySelector('details')?.open===false&&t?.readOnly&&t.value==="+JSONObject.quote(CHECK)+
            "&&t.scrollWidth<=t.clientWidth+1&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&targets.length===5&&targets.every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);"+
            "return e.checkVisibility()&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height&&e.contains(hit);});})()";
        page.await(new Check("exact saved check control, UTC date, current listing, summary guidance and Create are unobscured before PixelCopy",new Script(visible)).nativeReady());
        android.util.Log.i("ManagedValuationPreviewScope",page.read(new Script("JSON.stringify((()=>{const t=document.querySelector('#valuation-followup-check'),v=visualViewport;return {scope:'check-control-utc-date-inline-listing-guidance-create',expandedStableIdentity:'checked-functionally-before-capture-then-collapsed',textareaInternalVerticalScroll:t.scrollHeight>t.clientHeight+1,textareaClientHeight:t.clientHeight,textareaScrollHeight:t.scrollHeight,viewportWidth:v.width,viewportHeight:v.height};})())")));
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.VALUATION_SCENARIO_PREVIEW)).retain();
        page.await(new Check("the same exact preview viewport remains current after its committed PixelCopy frame",new Script(visible)));
    }
    private void createOnce() throws Exception {
        preview(); retainCompletePreviewFrame(); String inputs=page.read(new Script("JSON.stringify("+V+")"));
        page.click(Element.css("#valuation-followup-create"));
        page.await(new Check("Create adds one exact open entry after both preserved share-class assessments and changes only Follow-ups draft",new Script(R+".entries.length===3&&"+R+".dirty===true&&"+R+".baseVersion===1&&document.querySelector('#valuation-followup-create')===null&&JSON.stringify("+R+".entries.slice(0,2))==="+JSONObject.quote(followups)+"&&JSON.stringify("+V+")==="+JSONObject.quote(inputs)+"&&"+R+".entries[2].check==="+JSONObject.quote(CHECK)+"&&"+R+".entries[2].dueOn==="+JSONObject.quote(DUE)+"&&"+R+".entries[2].listing.listingId==='listing-zero'&&"+R+".entries[2].result===''&&"+R+".entries[2].status==='open'&&"+R+".entries[2].completedOn===null")));
        followups=page.read(new Script("JSON.stringify("+R+".entries)"));
        canonicalFollowups=page.read(new Script(CANONICAL_FOLLOWUPS));
        page.click(Element.css("#valuation-followup-preview"));
        page.await(new Check("an explicit duplicate attempt refuses before create or overwrite",new Script("document.querySelector('#valuation-followup-create')===null&&document.querySelector('#valuation-followup-status')?.textContent.includes('already has a follow-up')&&JSON.stringify("+R+".entries)==="+JSONObject.quote(followups))));
        assertDrafts(); boundary(1,0,1,0);
    }
    private void globalReviewResearchAndBack() throws Exception {
        pressBack();
        page.await(new Check("hardware Back leaves the original company visit without source or persistence effects",new Script("document.querySelector('.managed-company-visit')===null")));
        openFollowups();
        String id=page.read(new Script(R+".entries[2].id"));
        assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        page.click(Element.css("#managed-followup-select-"+id));
        page.await(new Check("global selected draft review shows the full exact check and UTC date before Save",new Script("document.querySelector('#managed-followup-check')?.value==="+JSONObject.quote(CHECK)+"&&document.querySelector('#managed-followup-due')?.value==="+JSONObject.quote(DUE)+"&&document.querySelector('#managed-followup-editor-heading')?.textContent.includes('ZERO')&&document.querySelector('#managed-followups-save')?.disabled===false&&"+F+".save===0")));
        page.click(Element.css("#managed-followup-research-"+id));
        page.await(new Check("only explicit Research resolves the exact ZERO listing without loading its sources",new Script("document.querySelector('.managed-company-visit')?.textContent.includes('ZERO')&&document.querySelector('.managed-company-visit .trial-toolbar > button')?.textContent==='Back to workspace'&&"+C+".resolve===1&&location.href==='https://localhost/?company=listing-zero&section=price'&&document.querySelector('.managed-company-visit .trial-toolbar > button')?.disabled===false")).nativeReady());
        pressBack();
        page.await(new Check("hardware Back returns to the selected global Follow-ups check",new Script("document.querySelector('.managed-company-visit')===null&&document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&"+R+".selectedId==="+JSONObject.quote(id)+"&&document.querySelector('#managed-followup-check')?.value==="+JSONObject.quote(CHECK))));
        assertDrafts(); boundary(1,1,1,0);
    }
    private void saveAndFreshLoad() throws Exception {
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("separate explicit Save acknowledges one whole-resource commit",new Script(R+".baseVersion===2&&"+R+".dirty===false&&"+F+".save===1&&"+F+".commits===1")));
        assertDrafts(); boundary(1,1,1,1);
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh session discards local drafts and performs no automatic Follow-ups load",new Script(F+".session===2&&"+R+".entries===null&&"+C+".load===2&&"+W+".memberships[0].note!=="+JSONObject.quote(NOTE)+"&&"+F+".load===1")));
        openFollowups(); page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit fresh Load restores the complete exact independently saved resource",new Script(R+".baseVersion===2&&"+R+".dirty===false&&"+CANONICAL_FOLLOWUPS+"==="+JSONObject.quote(canonicalFollowups)+"&&"+F+".load===2")));
    }
    private void assertDrafts() throws Exception {
        page.await(new Check("independent Watchlist stays unsaved and complete Follow-ups content is exact",new Script("JSON.stringify("+W+")==="+JSONObject.quote(watchlist)+"&&"+CANONICAL_FOLLOWUPS+"==="+JSONObject.quote(canonicalFollowups))));
    }
    private void openFollowups() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.await(new Check("global Follow-ups workspace is visible",new Script("document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&document.querySelector('#managed-followups-heading')?.checkVisibility()===true")));
    }
    private void calculate() { page.click(Element.xpath("//details[contains(@class,'managed-valuation-workbench')]/button[normalize-space(.)='Calculate authored scenarios']")); }
    private void choose(String selector,String value,String label) throws Exception {
        page.read(new Script("(()=>{const s=document.querySelector("+JSONObject.quote(selector)+");s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("exact enabled native choice has focus",new Script("(()=>{const s=document.querySelector("+JSONObject.quote(selector)+");return s instanceof HTMLSelectElement&&!s.disabled&&document.activeElement===s&&[...s.options].some(o=>o.value==="+JSONObject.quote(value)+"&&!o.disabled);})()")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog=new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("native choice applies exact requested value and dismisses its own dialog",new Script("document.querySelector("+JSONObject.quote(selector)+")?.value==="+JSONObject.quote(value)),ReportRevisitPage.Readiness.NATIVE,dialog.get()));
        keyboard.closeSoftKeyboard();
    }
    private void replace(String selector,String text) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(selector,"replace authored field"));
        page.await(new Check("actual controlled editor has focus before native replacement",new Script("document.activeElement===document.querySelector("+JSONObject.quote(selector)+")")));
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection covers the complete current field",new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){
            public Matcher<View> getConstraints(){return isDisplayed();}
            public String getDescription(){return "replace invented authored text through native IME";}
            public void perform(UiController controller,View view){
                assertTrue(view.hasFocus()&&view.hasWindowFocus());
                android.view.inputmethod.InputConnection input=((WebView)view).onCreateInputConnection(new android.view.inputmethod.EditorInfo());
                assertNotNull(input);assertTrue(input.commitText(text,1));controller.loopMainThreadUntilIdle();
            }
        });
        page.await(new Check("complete replacement reaches the controlled product editor",new Script("document.querySelector("+JSONObject.quote(selector)+")?.value==="+JSONObject.quote(text))));
        keyboard.closeSoftKeyboard();
    }
    private void boundary(int sessions,int resolves,int loads,int saves) throws Exception {
        page.await(new Check("fixed origin/source/CSP and every independent source and persistence counter stay exact",new Script(
            "location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+"&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            "&&"+C+".load==="+sessions+"&&"+C+".status==="+sessions+"&&"+C+".marketsResolve==="+sessions+"&&"+C+".resolve==="+resolves+
            "&&"+C+".save===0&&"+C+".eod===0&&"+C+".annual===0&&"+C+".interimReport===0&&"+C+".filings===0&&"+C+".marketsEod===0&&"+C+".calendar===0&&"+C+".bls===0&&"+C+".fed===0&&"+C+".search===0&&"+C+".portfolioLoad===0&&"+C+".portfolioSave===0&&"+C+".valuationLoad===0&&"+C+".valuationSave===0&&"+C+".token===0&&"+C+".signOut===0&&"+F+".load==="+loads+"&&"+F+".save==="+saves+"&&"+F+".commits==="+saves+"&&"+F+".replays===0&&"+F+".token===0&&"+F+".signOut===0")));
    }
    @After public void closeInventedValuationQuestion(){try{if(scenario!=null){scenario.close();scenario=null;}}finally{if(assets!=null)assets.close();}}
}
