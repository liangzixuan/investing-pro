package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
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
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** One authored invented review keeps status changes, Continue, Save and file delivery explicit. */
@RunWith(AndroidJUnit4.class)
public class ManagedReviewCheckCompletionTest {
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F="JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String R="JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String D="JSON.parse(document.querySelector('#fixture-review-check-completion').textContent)";
    private static final String FILE="JSON.parse(document.querySelector('#fixture-followups-report').textContent)";
    private static final String PANEL=".managed-followups-review > section";
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final String NOTE="Independent unsaved review note Café 東京 📈";
    private static final String RESULT="My ONE assessment: <script>invented</script> & Café 東京 📈 The full authored text stays raw.";
    private static final String UNCHOSEN="Independent unchosen BETA assessment Café 東京 📈";
    private static final String[] QUESTIONS={"Does ZERO retain its original thesis? Keep the complete Class A identity.","Which ONE evidence changes this assessment? Café 東京 📈","Does ALFA still meet the independently authored research question?","Keep this unchosen BETA question and its independent result in the whole draft."};
    private static final String[] LISTINGS={"listing-zero","listing-one","listing-alfa","listing-beta-a"};
    private static final String[] LABELS={"ZERO · Zero Company · Class A · XNAS","ONE · One Company · Class A · XNAS","ALFA · Alfa Company · Common Stock · XNAS","BETA · Beta Company · Class A · XNAS"};
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha,savedWatchlist,unsavedWatchlist,original,day,headingId;
    private final String[] ids=new String[4];
    private boolean resultWritten;

    @Before public void launchInventedReviewCompletion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(sourceSha);assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.REVIEW_CHECK_COMPLETION);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(activity->{
            assertEquals("local.investment.personal",activity.getPackageName());assertNotNull(activity.getBridge().getPlugin("App"));assertNull(activity.getBridge().getPlugin("InvestmentAuth"));assertNotNull(activity.getBridge().getPlugin("InvestmentFollowupsReviewReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity);activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("source-bound startup leaves Follow-ups unloaded and four exact Watchlist members",new Script(C+".load===1&&"+C+".status===1&&"+C+".marketsResolve===1&&"+R+".entries===null&&"+D+".watchlist.canonical!==null&&document.querySelector('#managed-note-0')?.disabled===false")).nativeReady());
        scenario.onActivity(activity->activity.getBridge().getWebView().clearHistory());WatchlistTestDocuments.clear(context());boundary(1,0,0,0);
    }
    @Test public void currentReviewCompletionReopenContinueSaveLoadAndReport() throws Exception {
        authorWholeDraft();chooseThreeInExplicitOrder();researchAndReturn();
        statusAction("complete",0,"completed",true);retainCompletionFocusFrame();
        statusAction("reopen",0,"open",true);statusAction("complete",0,"completed",true);
        continueTo(1);statusAction("complete",1,"completed",true); // Existing completion contract permits an empty assessment.
        continueTo(2);finishSaveAndFreshLoad();writeAndReadHtml();
    }
    private void authorWholeDraft() throws Exception {
        savedWatchlist=page.read(new Script(D+".watchlist.canonical"));
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        page.await(new Check("explicit My Watchlist selection exposes exact ZERO note before native input",new Script("(()=>{const e=document.querySelector('#managed-note-0'),r=e?.getBoundingClientRect();return location.href==='https://localhost/'&&e?.dataset.managedNoteListingId==='listing-zero'&&!e.disabled&&!e.readOnly&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0;})()")).nativeReady());
        replace("#managed-note-0",NOTE);unsavedWatchlist=page.read(new Script(D+".watchlist.canonical"));assertNotEquals(savedWatchlist,unsavedWatchlist);
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit Load starts an empty independent Follow-ups resource",new Script(F+".load===1&&"+R+".entries?.length===0&&"+R+".baseVersion===0")));
        replace("#managed-followups-new-due","2000-01-01");
        for(int index=0;index<4;index++) {
            chooseListing(index);enabled("#managed-followups-add");page.click(Element.css("#managed-followups-add"));
            page.await(new Check("Add authors one exact listing without a source read or Save",new Script(R+".entries?.length==="+(index+1)+"&&"+R+".entries["+index+"].listing.listingId==="+JSONObject.quote(LISTINGS[index])+"&&"+R+".entries["+index+"].check===''&&"+R+".entries["+index+"].dueOn==='2000-01-01'&&"+F+".save===0")));
            ids[index]=page.read(new Script(R+".selectedId"));assertTrue(ids[index].matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));replace("#managed-followup-check",QUESTIONS[index]);
        }
        replace("#managed-followup-result",UNCHOSEN);original=page.read(new Script(D+".followups.canonical"));assertWhole("open","open");boundary(1,0,1,0);
    }
    private void chooseThreeInExplicitOrder() throws Exception {
        page.click(Element.css(".managed-followups-review > summary"));enabled("#managed-followups-review-enter");page.click(Element.css("#managed-followups-review-enter"));
        page.await(new Check("all four authored due checks are eligible and none is selected automatically",new Script("document.querySelectorAll('.managed-followups-review-choices > li').length===4&&document.querySelector('#managed-followups-review-start')?.disabled===true")));
        for(int index:new int[]{1,0,2})page.click(Element.css("#managed-followups-review-choose-"+ids[index]));
        page.await(new Check("selection order differs from resource order and leaves BETA unchosen",new Script("document.querySelector('#managed-followups-review-choose-"+ids[1]+"')?.textContent==='Chosen 1: remove this check'&&document.querySelector('#managed-followups-review-choose-"+ids[0]+"')?.textContent==='Chosen 2: remove this check'&&document.querySelector('#managed-followups-review-choose-"+ids[2]+"')?.textContent==='Chosen 3: remove this check'&&document.querySelector('#managed-followups-review-choose-"+ids[3]+"')?.getAttribute('aria-pressed')==='false'")));
        enabled("#managed-followups-review-start");page.click(Element.css("#managed-followups-review-start"));
        headingId=page.read(new Script("document.querySelector('"+PANEL+"').getAttribute('aria-labelledby')"));assertFalse(headingId.isBlank());
        day=page.read(new Script("document.querySelector('#managed-followups-assessed-day').dateTime"));assertTrue(day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"));position(0);assertWhole("open","open");
    }
    private void researchAndReturn() throws Exception {
        enabled("#managed-followups-review-research");page.click(Element.css("#managed-followups-review-research"));
        page.await(new Check("exact first chosen ONE Research opens while sources remain unloaded",new Script("location.href==='https://localhost/?company=listing-one&section=price'&&document.querySelector('#managed-company-heading')?.textContent==='Company research · ONE'&&document.querySelector('.managed-research-followup-check')?.textContent==="+JSONObject.quote(QUESTIONS[1])+"&&document.querySelectorAll('.managed-company-evidence-actions time').length===0")).nativeReady());boundary(1,1,1,0);
        page.click(Element.css("#managed-research-followup-assessment > summary"));replace("#managed-research-followup-result",RESULT);resultWritten=true;
        page.await(new Check("complete Unicode assessment remains raw and open without Save",new Script(R+".entries[1].result==="+JSONObject.quote(RESULT)+"&&"+R+".entries[1].status==='open'&&"+F+".save===0")));
        enabled(".managed-company-visit .trial-toolbar > button");pressBack();
        page.await(new Check("one native Back returns to the same chosen position and result",new Script("location.href==='https://localhost/'&&document.querySelector('.managed-company-visit')===null&&document.activeElement===document.querySelector('#managed-followups-review-research')")));
        position(0);assertWhole("open","open");boundary(1,1,1,0);
    }
    private void statusAction(String action,int position,String status,boolean expectFocus) throws Exception {
        String selector="#managed-followups-review-"+action;enabled(selector);
        page.await(new Check("status action retains its exact label before explicit native activation",new Script("document.querySelector("+JSONObject.quote(selector)+")?.textContent==="+JSONObject.quote(action.equals("complete")?"Complete this check":"Reopen this check"))));
        touch.input(new ReportRevisitTouch.ControlledField(selector,"current review status action"));
        page.await(new Check("only the exact current entry changes status for the displayed captured UTC day and removed action returns heading focus",new Script("document.querySelector("+JSONObject.quote(selector)+")===null&&document.querySelector('#managed-followups-review-"+(action.equals("complete")?"reopen":"complete")+"')?.disabled===false&&"+R+".entries["+(position==0?1:0)+"].status==="+JSONObject.quote(status)+"&&"+R+".entries["+(position==0?1:0)+"].completedOn==="+(status.equals("completed")?JSONObject.quote(day):"null")+(expectFocus?"&&document.activeElement===document.getElementById("+JSONObject.quote(headingId)+")":""))));
        position(position);assertWhole(position==1?"completed":"open",position==0?status:"completed");boundary(1,1,1,0);
    }
    private void retainCompletionFocusFrame() throws Exception {
        page.read(new Script("(()=>{document.getElementById("+JSONObject.quote(headingId)+").scrollIntoView({block:'start',behavior:'instant'});return 'positioned';})()"));
        page.await(new Check("scoped native frame retains focused current heading, dated completed check and wrapping within width",new Script("(()=>{const h=document.getElementById("+JSONObject.quote(headingId)+"),r=h?.getBoundingClientRect(),v=visualViewport,p=document.querySelector('"+PANEL+"');return document.activeElement===h&&h?.textContent==='Follow-ups review session'&&h.checkVisibility()&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height&&p.textContent.includes("+JSONObject.quote("Completed ")+"+"+JSONObject.quote(day)+"+' UTC.')&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());
        android.util.Log.i("ReviewCheckCompletionScope","Focused review heading and start of the completed check only. Full order, raw result and identities are separately asserted; lower content can extend below this viewport.");
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.REVIEW_CHECK_COMPLETION_FOCUS)).retain();
    }
    private void continueTo(int position) throws Exception {
        enabled("#managed-followups-review-next");page.click(Element.css("#managed-followups-review-next"));position(position);assertWhole(position==1?"open":"completed","completed");boundary(1,1,1,0);
        if(position==2)page.await(new Check("Continue stops at the final chosen check without silently completing it",new Script("document.querySelector('#managed-followups-review-next')?.disabled===true&&"+R+".entries[2].status==='open'&&"+R+".entries[2].result===''")));
    }
    private void position(int position) throws Exception {
        int index=new int[]{1,0,2}[position];
        page.await(new Check("current position and original chosen order stay intact",new Script("(()=>{const p=document.querySelector('"+PANEL+"'),rows=[...p.querySelectorAll(':scope > details:last-of-type > ol > li')];return document.querySelector('#managed-followups-review-position')?.textContent==='Check "+(position+1)+" of 3. Assessed on "+day+" UTC.'&&p.querySelector(':scope > .managed-followups-authored')?.textContent==="+JSONObject.quote(QUESTIONS[index])+"&&rows.length===3&&[1,0,2].every((i,n)=>rows[n].querySelector('.managed-followups-authored')?.textContent==="+R+".entries[i].check)&&document.getElementById("+JSONObject.quote(headingId)+")?.textContent==='Follow-ups review session';})()")));
    }
    private void assertWhole(String zeroStatus,String oneStatus) throws Exception {
        String result=original==null?"":original;
        page.await(new Check("all full fields and independent unsaved Watchlist retain exact original values",new Script("(()=>{const expected=JSON.parse("+JSONObject.quote(result)+");expected.entries[1].result="+(!resultWritten?"expected.entries[1].result":JSONObject.quote(RESULT))+";expected.entries[0].status="+JSONObject.quote(zeroStatus)+";expected.entries[0].completedOn="+(zeroStatus.equals("completed")?JSONObject.quote(day):"null")+";expected.entries[1].status="+JSONObject.quote(oneStatus)+";expected.entries[1].completedOn="+(oneStatus.equals("completed")?JSONObject.quote(day):"null")+";return "+D+".followups.canonical===JSON.stringify(expected)&&"+D+".watchlist.canonical==="+JSONObject.quote(unsavedWatchlist)+"&&"+D+".watchlist.dirty===true;})()")));
    }
    private void finishSaveAndFreshLoad() throws Exception {
        enabled("#managed-followups-review-finish");page.click(Element.css("#managed-followups-review-finish"));
        page.await(new Check("Finish shows complete draft including both completed checks, empty results and unchosen BETA",new Script("(()=>{const rows=[...document.querySelectorAll('"+PANEL+" > ol > li')],entries="+R+".entries;return rows.length===4&&entries.every((e,i)=>rows[i].textContent.includes(e.check)&&rows[i].textContent.includes(e.result)&&[...rows[i].querySelectorAll('dd')].map(n=>n.textContent).join('|')===Object.values(e.listing).join('|'))&&document.querySelector('#managed-followups-review-position')===null&&document.querySelector('#managed-followups-review-again')?.disabled===false&&"+F+".save===0;})()")));
        assertWhole("completed","completed");boundary(1,1,1,0);String canonical=page.read(new Script(D+".followups.canonical"));
        enabled("#managed-followups-save");page.click(Element.css("#managed-followups-save"));
        page.await(new Check("one separate Save commits the whole resource and preserves independent Watchlist draft",new Script(F+".save===1&&"+F+".commits===1&&"+R+".baseVersion===1&&"+R+".dirty===false&&"+D+".followups.canonical==="+JSONObject.quote(canonical)+"&&"+D+".watchlist.canonical==="+JSONObject.quote(unsavedWatchlist))));boundary(1,1,1,1);
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh session clears temporary choices and leaves Follow-ups unloaded with original saved Watchlist",new Script(C+".load===2&&"+C+".status===2&&"+R+".entries===null&&"+D+".watchlist.dirty===false&&"+D+".watchlist.canonical==="+JSONObject.quote(savedWatchlist))));boundary(2,1,1,1);
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));enabled("#managed-followups-load");page.click(Element.css("#managed-followups-load"));
        page.await(new Check("explicit fresh Load restores every exact question/result/status/day/identity and no temporary review",new Script(F+".load===2&&"+R+".baseVersion===1&&"+R+".dirty===false&&"+D+".followups.canonical==="+JSONObject.quote(canonical)+"&&document.querySelector('#managed-followups-review-position')===null&&document.querySelector('#managed-followups-review-enter')!==null")));boundary(2,1,2,1);
    }
    private void writeAndReadHtml() throws Exception {
        String canonical=page.read(new Script(D+".followups.canonical"));page.click(Element.css("#managed-followups-review-report > summary"));enabled("#managed-followups-report-capture");page.click(Element.css("#managed-followups-report-capture"));
        page.await(new Check("passive report includes entire loaded resource despite the open filter",new Script("(()=>{const t=document.querySelector('#managed-followups-report-json');if(!t?.readOnly)return false;const r=JSON.parse(t.value);return r.kind==='followups_review'&&r.baseVersion===1&&r.dirty===false&&JSON.stringify(r.draft)==="+JSONObject.quote(canonical)+"&&r.draft.entries.length===4;})()")));
        String capture=page.read(new Script("document.querySelector('#managed-followups-report-json').value"));enabled("#managed-followups-report-save");page.click(Element.css("#managed-followups-report-save"));WatchlistSystemPicker picker=new WatchlistSystemPicker();picker.awaitOpen(30_000);picker.saveToInventedRoot();
        page.await(new Check("existing native writer writes one explicit chosen HTML file",new Script(FILE+".choices===1&&"+FILE+".writes===1&&document.querySelector('#managed-followups-review-report [role=status]')?.textContent==='Follow-ups report written to the chosen document.'")));
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(1,outputs.length);WatchlistTestDocuments.Output output=outputs[0];assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY,output.uri.getAuthority());assertTrue(output.name.matches("Investment-followups-review-[0-9]{8}T[0-9]{9}Z\\.html"));assertEquals(page.read(new Script(FILE+".filename")),output.name);
        byte[] bytes;try(InputStream input=context().getContentResolver().openInputStream(output.uri)){assertNotNull(input);bytes=input.readNBytes(InvestmentFollowupsReviewReportPlugin.MAX_REPORT_BYTES+1);}
        assertTrue(bytes.length>0&&bytes.length<=InvestmentFollowupsReviewReportPlugin.MAX_REPORT_BYTES);assertEquals(output.size,bytes.length);assertEquals(Integer.parseInt(page.read(new Script("String("+FILE+".byteLength)"))),bytes.length);
        String html=new String(bytes,StandardCharsets.UTF_8);assertArrayEquals(bytes,html.getBytes(StandardCharsets.UTF_8));assertTrue(FollowupsReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name,html));assertTrue(html.contains("&lt;script&gt;invented&lt;/script&gt; &amp; Café 東京 📈"));assertFalse(html.contains("<script>"));
        JSONObject observed=new JSONObject(page.read(new Script("JSON.stringify((()=>{const d=new DOMParser().parseFromString("+JSONObject.quote(html)+",'text/html');return {title:d.title,appendix:d.querySelector('pre')?.textContent,active:d.querySelectorAll('script,form,a,img,iframe,object').length,entries:[...d.querySelectorAll('section.fact')].map(s=>({values:[...s.querySelectorAll('dd')].map(e=>e.textContent),text:[...s.querySelectorAll('p.note')].map(e=>e.textContent)}))};})())")));
        assertEquals("Follow-ups review report",observed.getString("title"));assertEquals(0,observed.getInt("active"));assertEquals(capture,observed.getString("appendix"));assertEquals(canonical,page.read(new Script("JSON.stringify(JSON.parse("+JSONObject.quote(capture)+").draft)")));
        JSONArray entries=new JSONObject(canonical).getJSONArray("entries"),reading=observed.getJSONArray("entries");assertEquals(4,reading.length());
        for(int index=0;index<4;index++){
            JSONObject entry=entries.getJSONObject(index),listing=entry.getJSONObject("listing"),row=reading.getJSONObject(index);JSONArray values=new JSONArray().put(entry.getString("id")).put(entry.getString("catalogSnapshotSha256"));
            for(String key:new String[]{"country","exchangeMic","instrumentType","issuerId","issuerName","listingId","securityId","securityName","shareClassId","shareClassName","symbol"})values.put(listing.getString(key));values.put(entry.getString("status")).put(entry.getString("dueOn")).put(entry.isNull("completedOn")?"Not completed":entry.getString("completedOn"));
            assertEquals(values.toString(),row.getJSONArray("values").toString());assertEquals(new JSONArray().put(entry.getString("check")).put(entry.getString("result").isEmpty()?"No authored assessment.":entry.getString("result")).toString(),row.getJSONArray("text").toString());
        }
        boundary(2,1,2,1);
    }
    private void boundary(int sessions,int resolves,int loads,int saves) throws Exception {
        page.await(new Check("source identity, disconnected CSP, zero unexpected operations and exact independent budgets remain current",new Script("location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+"&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+"&&"+C+".load==="+sessions+"&&"+C+".status==="+sessions+"&&"+C+".marketsResolve==="+sessions+"&&"+C+".resolve==="+resolves+"&&"+C+".save===0&&"+C+".search===0&&"+C+".eod===0&&"+C+".annual===0&&"+C+".filings===0&&"+C+".interimReport===0&&"+C+".marketsEod===0&&"+C+".calendar===0&&"+C+".fed===0&&"+C+".token===0&&"+C+".signOut===0&&"+D+".rejected===0&&"+F+".load==="+loads+"&&"+F+".save==="+saves+"&&"+F+".commits==="+saves+"&&"+F+".replays===0&&"+F+".held===0&&"+F+".failures===0&&"+F+".token===0&&"+F+".signOut===0")));
    }
    private void enabled(String selector) throws Exception {
        page.await(new Check("target button is enabled before its explicit activation",new Script("(()=>{const b=document.querySelector("+JSONObject.quote(selector)+");return b instanceof HTMLButtonElement&&!b.disabled&&b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});})()")).nativeReady());
    }
    private void chooseListing(int index) throws Exception {
        page.read(new Script("(()=>{const s=document.querySelector('#managed-followups-member');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("empty listing selector owns focus before the native choice",new Script("document.activeElement===document.querySelector('#managed-followups-member')&&document.activeElement.value===''")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4));AtomicReference<View> dialog=new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(LABELS[index])).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).check((view,missing)->{if(missing!=null)throw missing;dialog.set(view.getRootView());}).perform(androidx.test.espresso.action.ViewActions.click());assertNotNull(dialog.get());
        page.await(new Check("native choice selects only the exact listing after dialog dismissal",new Script("document.querySelector('#managed-followups-member')?.value==="+JSONObject.quote(LISTINGS[index])),ReportRevisitPage.Readiness.NATIVE,dialog.get()));keyboard.closeSoftKeyboard();
    }
    private void replace(String selector,String text) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(selector,"invented review field"));page.await(new Check("controlled field owns focus before full native replacement",new Script("document.activeElement===document.querySelector("+JSONObject.quote(selector)+")")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));page.await(new Check("native selection covers whole prior field",new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){public Matcher<View> getConstraints(){return isDisplayed();}public String getDescription(){return "replace complete invented field through native IME";}public void perform(UiController controller,View view){InputConnection connection=view.onCreateInputConnection(new EditorInfo());assertNotNull(connection);assertTrue(connection.commitText(text,1));controller.loopMainThreadUntilIdle();}});
        page.await(new Check("complete raw field reaches real controlled editor",new Script("document.querySelector("+JSONObject.quote(selector)+")?.value==="+JSONObject.quote(text))));keyboard.closeSoftKeyboard();
    }
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @After public void closeInventedReviewCompletion(){try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();WatchlistTestDocuments.clear(context());}}
}
