package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
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
import java.nio.charset.StandardCharsets;
import org.hamcrest.Matcher;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Script;

/** Complete invented collection IO stays separate from the editor, online Save and source reads. */
@RunWith(AndroidJUnit4.class)
public class ManagedValuationCollectionRecoveryTest {
    private static final String D="JSON.parse(document.querySelector('#fixture-valuation-collection').textContent)";
    private static final String C="JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String P="JSON.parse(document.querySelector('#fixture-valuation-collection-file-protocol').textContent)";
    private static final String ROOT="#managed-valuation-collection-files";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String isolated;
    @Before public void launchInventedCollectionRecovery() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        String source=InstrumentationRegistry.getArguments().getString("expectedSourceSha");assertNotNull(source);assertTrue(source.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.VALUATION_COLLECTION_RECOVERY);assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);page=new ReportRevisitPage(scenario);touch=new ReportRevisitTouch(page);keyboard=new ReportRevisitKeyboard(page,touch);
        scenario.onActivity(activity->{
            assertNotNull(activity.getBridge().getPlugin("App"));assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            InvestmentValuationCollectionDraftFilePlugin plugin=(InvestmentValuationCollectionDraftFilePlugin)activity.getBridge().getPlugin("InvestmentValuationCollectionDraftFile").getInstance();assertNull(plugin.saveInstanceState());
            assertNotNull(activity.getBridge().getPlugin("InvestmentValuationDraftFile"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity);activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("invented source-bound startup leaves collection unloaded",new Script(C+".load===1&&"+C+".status===1&&"+C+".marketsResolve===1&&"+D+".resource.draft===null&&"+D+".counts.rejected===0")).nativeReady());
        WatchlistTestDocuments.clear(context());scenario.onActivity(activity->activity.getBridge().getWebView().clearHistory());
    }
    @Test public void completeCollectionNativeFileFreshSessionRestoreReviewSaveAndLoad() throws Exception {
        openCompanyAndLoad(0,3);click("#fixture-collection-stage");
        await("both complete entries staged with the old catalog in authored order",D+".resource.dirty&&JSON.stringify("+D+".resource.draft)===JSON.stringify("+D+".captured)");
        rememberIsolation();page.click(Element.css(ROOT+" > summary"));nativeCollectionAction("#managed-valuation-collection-capture");
        await("capture requires inspection before choosing any destination",P+".choices===0&&"+P+".writes===0&&document.activeElement?.id==='managed-valuation-collection-review-heading'&&document.querySelector('#managed-valuation-collection-review-heading')?.textContent==='Inspect the captured valuation collection'");
        completeReadout("Captured staged valuation collection",D+".captured");unchanged(1,0,0);
        click("#managed-valuation-collection-save-file");new WatchlistSystemPicker().saveToInventedRoot();
        await("real native chosen-document writer finishes exactly one full collection",P+".choices===1&&"+P+".writes===1&&document.querySelector('#managed-valuation-collection-review-heading')===null");
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(1,outputs.length);
        String text=page.read(new Script(P+".text"));byte[] document=text.getBytes(StandardCharsets.UTF_8);
        assertTrue(document.length<=262347);assertArrayEquals(document,WatchlistTestDocuments.read(context(),outputs[0]));
        JSONObject file=new JSONObject(text);assertEquals(5,file.length());assertEquals("investment-valuation-collection-draft",file.getString("format"));assertEquals(1,file.getInt("version"));assertTrue(file.getString("accountScope").matches("sha256:[0-9a-f]{64}"));assertEquals("Investment-valuation-collection-draft-"+file.getString("capturedAt").replace(':','-').replace('.','-')+".json",outputs[0].name);
        await("file payload equals every raw staged input and excludes editor and results","JSON.stringify(JSON.parse("+P+".text).payload)===JSON.stringify("+D+".captured)&&!Object.hasOwn(JSON.parse("+P+".text),'entry')");unchanged(1,0,0);
        click("#fixture-collection-fresh-session");fresh(1);openCompanyAndLoad(1,7);rememberIsolation();
        await("new online saved base is independently loaded without imported data","JSON.stringify("+D+".resource.draft)===JSON.stringify("+D+".newer)&&!"+D+".resource.dirty&&"+D+".resource.saved.version===7");
        page.click(Element.css(ROOT+" > summary"));select(outputs[0]);review();
        nativeCollectionAction("#managed-valuation-collection-cancel");await("cancel retains current complete draft and returns focus to the reset file input","document.querySelector('#managed-valuation-collection-review-heading')===null&&document.activeElement?.id==='managed-valuation-collection-file'&&JSON.stringify("+D+".resource.draft)===JSON.stringify("+D+".newer)");unchanged(2,0,0);
        select(outputs[0]);review();retainReviewFrame();
        nativeCollectionAction("#managed-valuation-collection-restore");
        await("explicit restore replaces only the whole valuation draft and consumes the file review",D+".resource.dirty&&"+D+".resource.baseVersion===7&&"+D+".resource.saved.version===7&&JSON.stringify("+D+".resource.saved.payload)===JSON.stringify("+D+".newer)&&JSON.stringify("+D+".resource.draft)===JSON.stringify("+D+".captured)&&document.querySelector('#managed-valuation-collection-review-heading')===null&&document.activeElement?.id==='managed-valuation-collection-file'");unchanged(2,0,0);
        page.click(Element.xpath("//summary[normalize-space(.)='Valuation draft entries and catalog review']"));click("#managed-valuation-catalog-review");
        await("catalog review admits both exact listing identities without changing raw maps",D+".counts.review===1&&"+D+".local.catalogReview?.entries.length===2&&"+D+".local.catalogReview.entries.every(row=>row.status==='update')");
        click("#managed-valuation-apply-catalog");await("catalog application changes metadata while retaining all raw operands and order","JSON.stringify("+D+".resource.draft)===JSON.stringify("+D+".reviewed)&&"+D+".local.catalogReview===null");unchanged(2,0,1);
        click("#managed-valuation-review");completeReadout("Complete valuation draft for Save",D+".reviewed");unchanged(2,0,1);
        click("#managed-valuation-save");await("separate online Save uses loaded version seven and keeps the independent dirty calculated editor",D+".counts.save===1&&"+D+".resource.saved.version===8&&"+D+".resource.baseVersion===8&&!"+D+".resource.dirty&&JSON.stringify("+D+".resource.saved.payload)===JSON.stringify("+D+".reviewed)");unchanged(2,1,1);
        click("#fixture-collection-fresh-session");fresh(2);openCompanyAndLoad(2,8);
        await("fresh session Load reads back the exact entire saved collection",D+".counts.load===3&&JSON.stringify("+D+".resource.saved.payload)===JSON.stringify("+D+".reviewed)&&JSON.stringify("+D+".resource.draft)===JSON.stringify("+D+".reviewed)&&!"+D+".resource.dirty");
        boundary(3,1,1);assertArrayEquals(document,WatchlistTestDocuments.read(context(),outputs[0]));assertEquals(1,WatchlistTestDocuments.outputs(context()).length);
    }
    private void openCompanyAndLoad(int session,int version) throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        page.await(new Check("exact visible ZERO note is selected before native editing",new Script("(()=>{const e=document.querySelector('#managed-note-0'),r=e?.getBoundingClientRect();return e?.dataset.managedNoteListingId==='listing-zero'&&!e.disabled&&!e.readOnly&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0;})()")).nativeReady());
        replace("#managed-note-0","Independent collection note Café 東京 📈 session "+session);
        click("button[aria-label='Annual report for saved ZERO']");
        page.await(new Check("exact ZERO opens without any financial source read",new Script("document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'&&"+D+".editor.context?.listing.listingId==='listing-zero'&&"+D+".counts.company===0")).nativeReady());
        page.click(Element.xpath("//summary[normalize-space(.)='Saved valuation inputs']"));click("#managed-valuation-load");
        await("explicit Load establishes the current complete online save base",D+".resource.baseVersion==="+version+"&&"+D+".resource.saved.version==="+version+"&&"+D+".counts.load==="+(session+1));
        click("#fixture-collection-independent-editor");await("independent workbench remains dirty with both calculated model results",D+".editor.dirty&&"+D+".editor.calculation?.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&"+D+".editor.calculation?.exitResult.scenarios.base.valuePerShare==='19.00'");
    }
    private String isolation() {return "JSON.stringify((()=>{const d="+D+";return {editor:d.editor,watchlist:d.watchlist,followups:d.followups,portfolio:d.portfolio};})())";}
    private void rememberIsolation() throws Exception {isolated=page.read(new Script(isolation()));}
    private void unchanged(int load,int save,int review) throws Exception {await("collection operation retains exact editor/results and all unrelated resource snapshots",isolation()+"==="+JSONObject.quote(isolated));boundary(load,save,review);}
    private void boundary(int load,int save,int review) throws Exception {
        await("no implicit source read, Save, extra file write or unrelated operation",D+".counts.load==="+load+"&&"+D+".counts.save==="+save+"&&"+D+".counts.review==="+review+"&&"+D+".counts.rejected===0&&"+C+".load==="+load+"&&"+C+".status==="+load+"&&"+C+".marketsResolve==="+load+"&&"+D+".counts.company===0&&"+C+".save===0&&"+C+".annual===0&&"+C+".eod===0&&"+C+".filings===0&&"+C+".marketsEod===0&&"+C+".calendar===0&&"+C+".fed===0&&"+C+".search===0&&"+C+".token===0");
    }
    private void fresh(int session) throws Exception {page.awaitStartup(new Check("fresh mounted session has no old local valuation draft",new Script(D+".counts.session==="+session+"&&"+D+".resource.draft===null&&"+C+".load==="+(session+1)+"&&"+C+".status==="+(session+1))).nativeReady());}
    private void review() throws Exception {
        await("real selected file reaches complete comparison before draft replacement","document.querySelector('#managed-valuation-collection-review-heading')?.textContent==='Review the complete collection file'&&document.querySelector('#managed-valuation-collection-file')?.value===''&&document.querySelector('#managed-valuation-collection-review-heading')?.parentElement.textContent.includes('Current online save base: 7.')");
        completeReadout("Complete file collection",D+".captured");completeReadout("Complete current draft that will be replaced",D+".newer");unchanged(2,0,0);
    }
    private void completeReadout(String label,String expected) throws Exception {
        String raw="e=>[...['startingUnleveredCashFlowUsd','enterpriseToEquityBridgeUsd','dilutedShares','forecastYears','waccPercent','terminalGrowthPercent'].map(k=>e.dcf.inputs[k]),...['conservative','base','expansion'].map(k=>e.dcf.inputs.scenarios[k].annualCashFlowGrowthPercent),...['baseRevenue','cash','debt','dilutedShares','horizonYears','discountRatePercent'].map(k=>e.exit.inputs[k]),...['conservative','base','expansion'].flatMap(s=>['annualRevenueGrowthPercent','targetEbitdaMarginPercent','exitMultiple'].map(k=>e.exit.inputs.scenarios[s][k]))]";
        await("full "+label+" shows every input, identity, model and blank in collection order","(()=>{const root=document.querySelector('section[aria-label="+JSONObject.quote(label)+"]'),expected="+expected+",groups=root?.querySelectorAll('section[aria-label^=\"Complete assumptions for \"]'),raw="+raw+";return groups?.length===expected.entries.length&&[...groups].every((g,i)=>{const e=expected.entries[i];return g.getAttribute('aria-label')==='Complete assumptions for '+e.listing.symbol&&JSON.stringify([...g.querySelectorAll('.managed-valuation-raw')].map(n=>n.textContent))===JSON.stringify(raw(e).map(v=>v===''?'Empty':v))&&Object.values(e.listing).every(value=>g.textContent.includes(value))&&g.textContent.includes(e.catalogSnapshotSha256)&&g.textContent.includes(e.dcf.modelVersion)&&g.textContent.includes(e.exit.modelVersion)&&g.textContent.includes(e.cik??'Not specified');});})()");
    }
    private void retainReviewFrame() throws Exception {
        page.read(new Script("(()=>{document.querySelector('#managed-valuation-collection-review-heading').scrollIntoView({block:'start',behavior:'instant'});return 'positioned';})()"));
        page.await(new Check("scoped imported collection heading and first identity wrap within native width",new Script("(()=>{const h=document.querySelector('#managed-valuation-collection-review-heading'),r=h?.getBoundingClientRect(),v=visualViewport;return h?.textContent==='Review the complete collection file'&&h.checkVisibility()&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()")).nativeReady());
        android.util.Log.i("ValuationCollectionFrameScope","Imported collection review heading and beginning only; complete multi-listing readouts are asserted separately and extend below the viewport.");
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario,FollowupsReportFrameCapture.Frame.VALUATION_COLLECTION_REVIEW)).retain();
    }
    private void select(WatchlistTestDocuments.Output output) throws Exception {
        scenario.onActivity(activity->{WebView web=activity.getBridge().getWebView();assertTrue(web.hasWindowFocus());web.clearFocus();});
        ValuationCollectionChooserGeometry.PreparedTouch prepared=ValuationCollectionChooserGeometry.await(scenario,10000);
        try {scenario.onActivity(activity->ValuationChooserTouchAdmission.require(activity.getWindow(),activity.getBridge().getWebView()));touch.observedGeometry("Valuation collection file chooser label",prepared.geometry);new WatchlistSystemPicker().openInventedDocument(output.name,"valuation-collection-draft");}
        finally {prepared.logTrace();}
    }
    private void click(String selector) throws Exception {await("exact action is enabled before activation: "+selector,"document.querySelector("+JSONObject.quote(selector)+")?.disabled===false");page.click(Element.css(selector));}
    private void nativeCollectionAction(String selector) throws Exception {
        String label=switch(selector) {
            case "#managed-valuation-collection-capture" -> "Capture valuation collection";
            case "#managed-valuation-collection-cancel" -> "Keep current draft / Cancel file operation";
            case "#managed-valuation-collection-restore" -> "Restore collection to valuation draft";
            default -> throw new IllegalArgumentException("Unsupported collection focus action");
        };
        page.await(new Check("exact collection focus action is enabled before native touch: "+label,new Script("(()=>{const button=document.querySelector("+JSONObject.quote(selector)+");return button instanceof HTMLButtonElement&&!button.disabled&&button.textContent.trim()==="+JSONObject.quote(label)+";})()")).nativeReady());
        touch.input(new ReportRevisitTouch.ControlledField(selector,label));
    }
    private void await(String description,String condition) throws Exception {
        try {page.await(new Check(description,new Script(condition)));}
        catch(AssertionError failure) {
            try {android.util.Log.e("ValuationCollectionObservation",collectionObservation());}
            catch(Exception | AssertionError observationFailure) {android.util.Log.e("ValuationCollectionObservation","Scoped collection observation unavailable",observationFailure);}
            throw failure;
        }
    }
    private String collectionObservation() throws Exception {
        return page.read(new Script("JSON.stringify((()=>{"+
            "if(location.origin!=='https://localhost'||document.querySelector('meta[name=investment-android-test-scenario]')?.content!=='valuation-collection-recovery')return {scopeAdmitted:false};"+
            "const capture=document.querySelector('#managed-valuation-collection-capture'),heading=document.querySelector('#managed-valuation-collection-review-heading'),input=document.querySelector('#managed-valuation-collection-file'),cancel=document.querySelector('#managed-valuation-collection-cancel'),restore=document.querySelector('#managed-valuation-collection-restore'),active=document.activeElement;"+
            "return {scopeAdmitted:true,collectionOpen:document.querySelector('#managed-valuation-collection-files')?.open===true,headingPresent:!!heading,captureHeading:heading?.textContent==='Inspect the captured valuation collection',reviewHeading:heading?.textContent==='Review the complete collection file',active:active===document.body?'body':active===capture?'capture':active===heading?'heading':active===input?'file':active===cancel?'cancel':active===restore?'restore':'other',capturePresent:!!capture,captureConnected:capture?.isConnected===true,captureDisabled:capture?.disabled===true,inputPresent:!!input,inputDisabled:input?.disabled===true,inputValueEmpty:input?.value==='',cancelPresent:!!cancel,restorePresent:!!restore};})())"));
    }
    private void replace(String selector,String text) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(selector,"invented independent note"));page.await(new Check("exact editor focused before complete native replacement",new Script("document.activeElement===document.querySelector("+JSONObject.quote(selector)+")")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));await("native selection covers the complete previous note","document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length");
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction(){public Matcher<View> getConstraints(){return isDisplayed();}public String getDescription(){return "replace complete invented note through native IME";}public void perform(UiController controller,View view){InputConnection connection=view.onCreateInputConnection(new EditorInfo());assertNotNull(connection);assertTrue(connection.commitText(text,1));controller.loopMainThreadUntilIdle();}});
        await("raw note reaches the real controlled field","document.querySelector("+JSONObject.quote(selector)+")?.value==="+JSONObject.quote(text));keyboard.closeSoftKeyboard();
    }
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    @After public void closeInventedCollectionRecovery(){try{if(scenario!=null)scenario.close();}finally{if(assets!=null)assets.close();WatchlistTestDocuments.clear(context());}}
}
