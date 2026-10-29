package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static local.investment.personal.FilingCheckAssessmentExpectations.*;
import static org.junit.Assert.*;
import android.content.Context;
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
import java.time.Instant;
import java.time.ZoneOffset;
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

/** One existing due check receives one complete filing citation; completion and Saves stay explicit. */
@RunWith(AndroidJUnit4.class)
public class ManagedFilingCheckAssessmentTest {
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private static final String FILINGS_URL="https://localhost/?company=listing-zero&section=filings";

    @Before public void launchInventedFilingAssessment() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sourceSha);assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.FILING_CHECK_ASSESSMENT);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(activity->{
            assertEquals("local.investment.personal",activity.getPackageName());assertNotNull(activity.getBridge().getPlugin("App"));
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));assertNotNull(activity.getBridge().getPlugin("InvestmentFollowupsReviewReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity);activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("source-bound fixture starts with an unloaded independent Follow-ups resource",new Script(C+".load===1&&"+C+".status===1&&"+C+".marketsResolve===1&&"+R+".entries===null&&document.querySelector('#managed-note-0')?.disabled===false&&document.querySelector('#fixture-filing-check-assessment')!==null")).nativeReady());
        scenario.onActivity(activity->activity.getBridge().getWebView().clearHistory());WatchlistTestDocuments.clear(context());assertBoundary(Phase.INITIAL);
    }
    @Test public void dueCheckFilingAssessmentSurvivesReviewBackCompletionSaveFreshLoadAndHtml() throws Exception {
        Original original=chooseExistingDueCheck();
        openExactResearchAndLoadFilings(original);
        refuseOverflowAndCancel(original);
        prepareCompletePreview(original);retainScopedPreview();applyCitationOnce(original);
        backToChosenReview(original);
        String saved=completeAndSaveSeparately(original);
        freshLoadCompleteResource(original,saved);
        writeAndReadCompleteHtml(saved);
    }
    private Original chooseExistingDueCheck() throws Exception {
        String savedWatchlist=page.read(new Script(D+".watchlist.canonical"));
        replace(ReportRevisitTouch.Field.COMPANY_NOTE,NOTE);
        String unsaved=page.read(new Script(D+".watchlist.canonical"));assertNotEquals(savedWatchlist,unsaved);
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.await(new Check("navigation does not load Follow-ups",new Script(F+".load===0&&"+R+".entries===null")));
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit Load admits the complete original two-entry resource",new Script(F+".load===1&&"+R+".entries?.length===2&&"+R+".entries[0].id==="+JSONObject.quote(ID)+"&&"+R+".entries[0].check==="+JSONObject.quote(QUESTION)+"&&"+R+".entries[0].dueOn==='2000-01-01'&&"+R+".entries[0].result===''&&"+R+".baseVersion===1&&"+R+".dirty===false")));
        Original original=new Original(savedWatchlist,unsaved,page.read(new Script(D+".followups.canonical")));
        page.click(Element.css(".managed-followups-review > summary"));page.click(Element.css("#managed-followups-review-enter"));
        page.await(new Check("only the due check is eligible; the independent future entry is not silently selected",new Script("document.querySelectorAll('.managed-followups-review-choices > li').length===1&&document.querySelector('#managed-followups-review-start')?.disabled===true")));
        page.click(Element.css("#managed-followups-review-choose-"+ID));page.click(Element.css("#managed-followups-review-start"));
        page.await(new Check("explicit choice starts this one original due check",new Script("document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check 1 of 1.')&&document.querySelector('.managed-followups-review')?.textContent.includes("+JSONObject.quote(QUESTION)+")")));
        assertDrafts(original,"",Completion.open());assertBoundary(Phase.LOADED);return original;
    }
    private void openExactResearchAndLoadFilings(Original original) throws Exception {
        page.click(Element.css("#managed-followups-review-research"));
        page.await(new Check("Follow-ups-owned exact ZERO Research opens without a financial request",new Script("location.href==='https://localhost/?company=listing-zero&section=price'&&document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'&&document.querySelector('.managed-research-followup-check')?.textContent==="+JSONObject.quote(QUESTION)+"&&"+D+".filings.response===null")).nativeReady());
        assertBoundary(Phase.RESEARCH);
        page.click(Element.css("button[aria-label='Filings section for ZERO']"));
        page.await(new Check("section navigation preserves the same check and starts no source read",new Script("location.href==="+JSONObject.quote(FILINGS_URL)+"&&document.querySelector('#managed-filings-heading')!==null&&"+C+".filings===0&&document.querySelector('#managed-research-followup-heading')!==null")).nativeReady());
        page.click(Element.xpath("//section[@aria-labelledby='managed-filings-heading']//button[normalize-space(.)='Load filings']"));
        page.await(new Check("one explicit read retains original clocks, coverage and packet before the initially closed citation tool",new Script(C+".filings===1&&"+D+".filings.response?.issuer.filings.length===2&&"+D+".filings.response.issuer.matchingFilings===2&&"+D+".filings.response.issuer.truncated===false&&"+D+".filings.showingPrevious===false&&"+D+".filings.responseOrigin==='request'&&document.querySelector('#filings-assessment')?.open===false")));
        page.click(Element.css("#managed-research-followup-assessment > summary"));
        replace(ReportRevisitTouch.Field.FOLLOWUP_RESULT,RAW);
        page.click(Element.css("#filings-assessment-toggle"));
        page.await(new Check("filing choice starts empty and contains both exact observed accessions without automatic selection",new Script("document.querySelector('#filings-assessment-filing')?.value===''&&document.querySelector('#filings-assessment-preview')?.disabled===true&&[...document.querySelector('#filings-assessment-filing').options].map(o=>o.value).join('|')==='|0000000001-26-000001|0000000001-26-000002'")));
        chooseFirstFiling();assertDrafts(original,RAW,Completion.open());assertBoundary(Phase.FILINGS);
    }
    private void refuseOverflowAndCancel(Original original) throws Exception {
        String overflow="x".repeat(1900);replace(ReportRevisitTouch.Field.FOLLOWUP_RESULT,overflow);
        page.click(Element.css("#filings-assessment-preview"));
        page.await(new Check("whole over-limit result is refused without clipping raw authored text",new Script("document.querySelector('#filings-assessment-result')===null&&document.querySelector('#filings-assessment-apply')===null&&document.querySelector('#filings-assessment-status')?.textContent.includes('2,000')&&document.querySelector('#managed-research-followup-result')?.value==="+JSONObject.quote(overflow))));
        assertDrafts(original,overflow,Completion.open());
        replace(ReportRevisitTouch.Field.FOLLOWUP_RESULT,RAW);prepareCompletePreview(original);
        page.click(Element.css("#filings-assessment-cancel"));
        page.await(new Check("Cancel retires the proposal while preserving raw text, source choice and both drafts",new Script("document.querySelector('#filings-assessment-result')===null&&document.querySelector('#filings-assessment-apply')===null&&document.querySelector('#managed-research-followup-result')?.value==="+JSONObject.quote(RAW)+"&&document.querySelector('#filings-assessment-filing')?.value==='0000000001-26-000001'")));
        assertDrafts(original,RAW,Completion.open());assertBoundary(Phase.FILINGS);
    }
    private void prepareCompletePreview(Original original) throws Exception {
        page.click(Element.css("#filings-assessment-preview"));
        page.await(new Check("actual heading focus, entire raw result/citation and full exact check identity are retained",completePreview()));
        assertDrafts(original,RAW,Completion.open());assertBoundary(Phase.FILINGS);
    }
    private void retainScopedPreview() throws Exception {
        page.read(new Script("(()=>{document.querySelector('#filings-assessment-preview-heading').scrollIntoView({block:'start',behavior:'instant'});return 'positioned';})()"));
        page.await(new Check("scoped preview heading is visible and identities/text wrap within the native width",new Script("(()=>{const h=document.querySelector('#filings-assessment-preview-heading'),t=document.querySelector('#filings-assessment-result'),r=h?.getBoundingClientRect(),v=visualViewport;return h?.checkVisibility()&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height&&t?.value==="+JSONObject.quote(RESULT)+"&&t.scrollWidth<=t.clientWidth+1&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;})()")).nativeReady());
        android.util.Log.i("FilingAssessmentPreviewScope","Heading and start of the complete result only. Full result, identities and source context are separately asserted; lower content extends below this viewport.");
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.FILING_ASSESSMENT_PREVIEW)).retain();
        page.read(new Script("(()=>{document.querySelector('#filings-assessment-apply').scrollIntoView({block:'center',behavior:'instant'});return 'positioned';})()"));
        page.await(new Check("Apply is enabled, unobscured and a 44px target",new Script("(()=>{const b=document.querySelector('#filings-assessment-apply'),r=b?.getBoundingClientRect();return !b?.disabled&&r.width>=44&&r.height>=44&&b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()")).nativeReady());
    }
    private void applyCitationOnce(Original original) throws Exception {
        page.click(Element.css("#filings-assessment-apply"));
        page.await(new Check("one use changes only this existing entry result, without completion or Save",new Script("document.querySelector('#filings-assessment-result')===null&&document.querySelector('#filings-assessment-apply')===null&&document.querySelector('#managed-research-followup-result')?.value==="+JSONObject.quote(RESULT)+"&&document.querySelector('#filings-assessment-status')?.textContent==='Citation applied to this assessment draft. Review, complete and Save follow-ups separately.'")));
        assertDrafts(original,RESULT,Completion.open());
        page.click(Element.css("#filings-assessment-preview"));
        page.await(new Check("new explicit Preview refuses the exact duplicate full citation with no second mutation",new Script("document.querySelector('#filings-assessment-apply')===null&&document.querySelector('#filings-assessment-result')===null&&document.querySelector('#filings-assessment-status')?.textContent==='This exact filing reference is already in the assessment draft.'")));
        assertDrafts(original,RESULT,Completion.open());assertBoundary(Phase.FILINGS);
    }
    private void backToChosenReview(Original original) throws Exception {
        keyboard.closeSoftKeyboard();
        page.await(new Check("exact committed Filings visit has an enabled visible Back before one hardware Back",new Script("(()=>{const b=document.querySelector('.managed-company-visit .trial-toolbar > button');return location.href==="+JSONObject.quote(FILINGS_URL)+"&&b?.textContent==='Back to workspace'&&!b.disabled&&b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
        pressBack();
        page.await(new Check("one Back returns directly to the same chosen due check and whole cited assessment",new Script("location.href==='https://localhost/'&&document.querySelector('.managed-company-visit')===null&&document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check 1 of 1.')&&document.querySelector('.managed-followups-review')?.textContent.includes("+JSONObject.quote(RESULT)+")&&document.activeElement===document.querySelector('#managed-followups-review-research')")));
        assertDrafts(original,RESULT,Completion.open());assertBoundary(Phase.FILINGS);
    }
    private String completeAndSaveSeparately(Original original) throws Exception {
        page.click(Element.css("#managed-followups-review-finish"));page.click(Element.css("#managed-followup-select-"+ID));
        page.await(new Check("full draft Review selects the same still-open result before explicit completion",new Script(R+".selectedId==="+JSONObject.quote(ID)+"&&document.querySelector('#managed-followup-result')?.value==="+JSONObject.quote(RESULT)+"&&document.querySelector('#managed-followup-complete')?.disabled===false")));
        long before=System.currentTimeMillis();page.click(Element.css("#managed-followup-complete"));
        page.await(new Check("completion changes only status and authored UTC completion date",new Script(R+".entries[0].status==='completed'&&document.querySelector('#managed-followup-reopen')!==null")));
        String date=page.read(new Script(R+".entries[0].completedOn"));long after=System.currentTimeMillis();
        assertTrue(date.equals(utcDate(before))||date.equals(utcDate(after)));assertNotEquals("2026-09-19",date);
        assertDrafts(original,RESULT,new Completion("completed",date));assertBoundary(Phase.FILINGS);
        String canonical=page.read(new Script(D+".followups.canonical"));page.click(Element.css("#managed-followups-save"));
        page.await(new Check("only explicit Save commits the complete independent resource once",new Script(F+".save===1&&"+F+".commits===1&&"+R+".baseVersion===2&&"+R+".dirty===false&&"+D+".followups.canonical==="+JSONObject.quote(canonical)+"&&"+unchangedWatchlist(original))));
        assertBoundary(Phase.SAVED);return canonical;
    }
    private void freshLoadCompleteResource(Original original,String canonical) throws Exception {
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh session drops the unsaved Watchlist edit and leaves Follow-ups unloaded",new Script(C+".load===2&&"+C+".status===2&&"+R+".entries===null&&"+D+".watchlist.dirty===false&&"+D+".watchlist.canonical==="+JSONObject.quote(original.savedWatchlist()))));
        assertBoundary(Phase.FRESH);page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit fresh Load restores every entry field, full result and completion state",new Script(F+".load===2&&"+R+".baseVersion===2&&"+R+".dirty===false&&"+D+".followups.canonical==="+JSONObject.quote(canonical))));
        assertBoundary(Phase.RELOADED);
    }
    private void writeAndReadCompleteHtml(String canonical) throws Exception {
        page.click(Element.css("#managed-followups-review-report > summary"));page.click(Element.css("#managed-followups-report-capture"));
        page.await(new Check("passive report contains the complete loaded resource despite the open filter",new Script("(()=>{const t=document.querySelector('#managed-followups-report-json');if(!t?.readOnly)return false;const r=JSON.parse(t.value);return r.kind==='followups_review'&&r.baseVersion===2&&r.dirty===false&&JSON.stringify(r.draft)==="+JSONObject.quote(canonical)+"&&r.draft.entries[0].result==="+JSONObject.quote(RESULT)+"&&r.draft.entries.length===2;})()")));
        String capture=page.read(new Script("document.querySelector('#managed-followups-report-json').value"));
        page.click(Element.css("#managed-followups-report-save"));WatchlistSystemPicker picker=new WatchlistSystemPicker();picker.awaitOpen(30_000);picker.saveToInventedRoot();
        page.await(new Check("existing native writer completes exactly one chosen HTML document",new Script(FILE+".choices===1&&"+FILE+".writes===1&&document.querySelector('#managed-followups-review-report [role=status]')?.textContent==='Follow-ups report written to the chosen document.'")));
        inspectHtml(context(),page,canonical,capture);assertBoundary(Phase.RELOADED);
    }
    private void chooseFirstFiling() throws Exception {
        page.read(new Script("(()=>{const s=document.querySelector('#filings-assessment-filing');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("empty loaded-filing selector is focused before native choice",new Script("document.activeElement===document.querySelector('#filings-assessment-filing')&&document.activeElement.value===''")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4));AtomicReference<View> dialog=new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText("Form 10-Q · 0000000001-26-000001 · Filed 2026-09-19 · Report 2026-06-30")).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());page.await(new Check("only the explicitly chosen original filing is selected and its dialog is dismissed",new Script("document.querySelector('#filings-assessment-filing')?.value==='0000000001-26-000001'"),ReportRevisitPage.Readiness.NATIVE,dialog.get()));keyboard.closeSoftKeyboard();
    }
    private void replace(ReportRevisitTouch.Field field,String text) throws Exception {
        touch.input(field);page.await(new Check("controlled assessment editor owns focus before complete replacement",new Script("document.activeElement===document.querySelector("+JSONObject.quote(field.selector)+")")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection covers the whole previous field",new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){
            public Matcher<View> getConstraints(){return isDisplayed();}
            public String getDescription(){return "replace complete invented assessment through native IME";}
            public void perform(UiController controller,View view){InputConnection connection=view.onCreateInputConnection(new EditorInfo());assertNotNull(connection);assertTrue(connection.commitText(text,1));controller.loopMainThreadUntilIdle();}
        });
        page.await(new Check("the complete raw field value reaches the real controlled editor",new Script("document.querySelector("+JSONObject.quote(field.selector)+")?.value==="+JSONObject.quote(text))));keyboard.closeSoftKeyboard();
    }
    private void assertDrafts(Original original,String result,Completion completion) throws Exception {
        page.await(new Check("all other entry fields and the independent unsaved Watchlist are unchanged",new Script(wholePayload(original,result,completion)+"&&"+unchangedWatchlist(original))));
    }
    private void assertBoundary(Phase phase) throws Exception { page.await(new Check("native source, disconnected CSP and exact independent request/write budgets remain current",boundary(sourceSha,phase))); }
    private static String utcDate(long value){return Instant.ofEpochMilli(value).atZone(ZoneOffset.UTC).toLocalDate().toString();}
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @After public void closeInventedFilingAssessment(){try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();WatchlistTestDocuments.clear(context());}}
}
