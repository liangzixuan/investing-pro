package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.supportsInputMethods;
import static org.junit.Assert.*;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.espresso.action.GeneralClickAction;
import androidx.test.espresso.action.Press;
import androidx.test.espresso.action.Tap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
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

/** Invented outside-Watchlist position becomes one independently saved dated check. */
@RunWith(AndroidJUnit4.class)
public class HoldingResearchFollowupInstrumentedTest {
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final String QUESTION = "Will authored capacity support this holding? Café 東京 📈";
    private static final String DUE = "2026-12-31";
    private static final String TOOL = "#managed-holding-followup";
    private static final String COUNTS = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FOLLOWUPS = "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String RESOURCE = "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String PORTFOLIO = "JSON.parse(document.querySelector('#fixture-portfolio-draft').textContent)";
    private static final String LEDGER = "JSON.parse(document.querySelector('#fixture-portfolio-state').textContent)";
    private static final String WATCHLIST = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String EXACT = "function same(a,b){if(a===b)return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;" +
        "if(Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a),bk=Object.keys(b);" +
        "return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private enum Input {
        QUESTION("#holding-followup-question", HoldingResearchFollowupInstrumentedTest.QUESTION), DATE("#holding-followup-due", DUE);
        final String selector, text;
        Input(String selector, String text) { this.selector=selector; this.text=text; }
    }
    private enum Phase {
        STARTUP, POSITION, LOADED, CREATED, SAVED, FRESH, RELOADED;
        int portfolioLoads() { return this==STARTUP ? 0 : 1; }
        int sessions() { return this==FRESH || this==RELOADED ? 2 : 1; }
        int loads() { return switch(this) {case STARTUP,POSITION -> 0; case RELOADED -> 2; default -> 1;}; }
        int saves() { return this==SAVED || this==FRESH || this==RELOADED ? 1 : 0; }
    }

    @Before public void launchInventedHoldingQuestion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha=InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha);
        assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets=new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.HOLDING_FOLLOWUP);
        assets.prepare();
        scenario=ActivityScenario.launch(MainActivity.class);
        page=new ReportRevisitPage(scenario);
        keyboard=new ReportRevisitKeyboard(page,new ReportRevisitTouch(page));
        scenario.onActivity(activity -> {
            keyboard.observe(activity);
            assertEquals("local.investment.personal",activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App"));
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("invented startup has no implicit Watchlist or Follow-ups read",new Script(
            "document.querySelector('#fixture-diagnostics')!==null && "+COUNTS+".status===1 && "+COUNTS+".marketsResolve===1"+
            " && "+WATCHLIST+".memberships===null && "+RESOURCE+".entries===null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        assertBoundary(Phase.STARTUP);
    }

    @Test public void outsideWatchlistHoldingKeepsExactPositionAndDatedCheckThroughBackAndSeparateSave() throws Exception {
        JSONObject original=loadAndApprovePortfolio();
        inspectKnownPosition(original);
        openHolding("ONE");
        assertPosition("3","Unavailable","2026-10-03");
        retainFrame(HoldingFollowupFrameCapture.Frame.POSITION,"#holding-followup-shares,#holding-followup-basis,#holding-followup-confirmed");
        authorLoadAndCancel(original);
        JSONObject expected=createOneCheck(original);
        returnToPortfolio(original,Phase.CREATED);
        saveAndFreshLoad(expected);
    }

    private JSONObject loadAndApprovePortfolio() throws Exception {
        openView("Portfolio","managed-portfolio-heading");
        page.click(Element.css("#managed-portfolio-load"));
        page.await(new Check("authored saved ledger loads independently with known and null basis",new Script(
            LEDGER+".load===1 && "+PORTFOLIO+".baseVersion===1 && "+PORTFOLIO+".projection?.status==='valid'"+
            " && "+PORTFOLIO+".ledger.opening.asOfDate==='2026-10-04'"+
            " && "+PORTFOLIO+".ledger.opening.holdings[0].shares==='2.000000'"+
            " && "+PORTFOLIO+".ledger.opening.holdings[0].totalCostBasisUsd==='80.00'"+
            " && "+PORTFOLIO+".ledger.opening.holdings[1].shares==='3.000000'"+
            " && "+PORTFOLIO+".ledger.opening.holdings[1].totalCostBasisUsd===null")));
        page.click(Element.css("#managed-portfolio-review-identities"));
        page.await(new Check("both resolved identities are ready for explicit approval",new Script(
            "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Apply reviewed identities' && !b.disabled)")));
        page.click(Element.xpath("//button[normalize-space(.)='Apply reviewed identities']"));
        page.await(new Check("explicit catalog approval retains both current authored holdings",new Script(
            COUNTS+".resolve===1 && "+PORTFOLIO+".pendingEditor===false && "+PORTFOLIO+".projection.portfolio.holdings.length===2")));
        return new JSONObject(page.read(new Script("JSON.stringify("+PORTFOLIO+".ledger)")));
    }
    private void inspectKnownPosition(JSONObject original) throws Exception {
        openHolding("ZERO");
        assertPosition("2","80.00","2026-10-02");
        page.await(new Check("position is visible before the question disclosure opens",new Script(
            "document.querySelector('#holding-followup-question')?.closest('details')?.open===false && "+RESOURCE+".entries===null")));
        returnToPortfolio(original,Phase.POSITION);
    }
    private void openHolding(String symbol) throws Exception {
        page.click(Element.xpath("//button[normalize-space(.)='Research "+symbol+"']"));
        String listing=symbol.equals("ONE")?"listing-one":"listing-zero";
        page.await(new Check("exact holding identity opens company research with no source request",new Script(
            "location.href==="+JSONObject.quote("https://localhost/?company="+listing+"&section=price")+
            " && document.querySelector('#managed-company-heading')?.textContent==="+JSONObject.quote("Company research · "+symbol)+
            " && document.querySelector("+JSONObject.quote(TOOL)+")!==null")));
        assertBoundary(Phase.POSITION);
    }
    private void assertPosition(String shares,String basis,String confirmed) throws Exception {
        page.await(new Check("projected authored position preserves shares, null basis and original date separately",new Script(
            "document.querySelector('#holding-followup-shares')?.textContent==="+JSONObject.quote(shares)+
            " && document.querySelector('#holding-followup-basis')?.textContent==="+JSONObject.quote(basis)+
            " && document.querySelector('#holding-followup-confirmed')?.textContent==="+JSONObject.quote(confirmed)+
            " && document.querySelector("+JSONObject.quote(TOOL)+")?.textContent.includes('Authored Portfolio draft position')")));
    }
    private void authorLoadAndCancel(JSONObject original) throws Exception {
        page.click(Element.css(TOOL+" > details > summary"));
        page.await(new Check("holding tool offers explicit creation without a Watchlist load",new Script(
            "document.querySelector("+JSONObject.quote(TOOL+" > details > summary")+")?.textContent==='Review holding and keep a next check'"+
            " && document.querySelector('#holding-followup-load')?.textContent==='Load follow-ups for this question'")));
        enter(Input.QUESTION);
        enter(Input.DATE);
        page.click(Element.css("#holding-followup-load"));
        page.await(new Check("explicit initial Follow-ups Load preserves full question and date",new Script(
            "document.querySelector('#holding-followup-question')?.value==="+JSONObject.quote(QUESTION)+
            " && document.querySelector('#holding-followup-due')?.value==="+JSONObject.quote(DUE)+
            " && "+RESOURCE+".entries?.length===1 && "+FOLLOWUPS+".load===1 && document.querySelector('#holding-followup-preview')?.disabled===false")));
        preview();
        page.click(Element.css("#holding-followup-cancel"));
        page.await(new Check("Cancel consumes the preview without creating or saving",new Script(
            "document.querySelector('#holding-followup-create')===null && document.querySelector('#holding-followup-check')===null"+
            " && "+RESOURCE+".entries.length===1 && "+RESOURCE+".dirty===false")));
        assertOriginalPortfolio(original);
        assertBoundary(Phase.LOADED);
    }
    private void preview() throws Exception {
        page.click(Element.css("#holding-followup-preview"));
        page.await(new Check("complete preview contains only the exact question to persist and its UTC due date",new Script(
            "document.querySelector('#holding-followup-check')?.readOnly===true"+
            " && document.querySelector('#holding-followup-check')?.value==="+JSONObject.quote(QUESTION)+
            " && document.querySelector('#holding-followup-due')?.value==="+JSONObject.quote(DUE)+
            " && document.querySelector('#holding-followup-preview-shares')?.textContent==='3'"+
            " && document.querySelector('#holding-followup-preview-basis')?.textContent==='Unavailable'"+
            " && document.querySelector('#holding-followup-preview-confirmed')?.textContent==='2026-10-03'"+
            " && document.querySelector('.managed-holding-followup-preview .managed-holding-followup-position > p')?.textContent==='ONE · One CompanyClass A · XNAS · Common stock'"+
            " && document.querySelector('#holding-followup-create')?.textContent==='Create follow-up draft'"+
            " && document.querySelector("+JSONObject.quote(TOOL)+")?.textContent.includes('not saved with')")));
        assertPosition("3","Unavailable","2026-10-03");
    }
    private JSONObject createOneCheck(JSONObject original) throws Exception {
        preview();
        retainFrame(HoldingFollowupFrameCapture.Frame.PREVIEW,".managed-holding-followup-preview > h4,.managed-holding-followup-preview > label,#holding-followup-check,.managed-holding-followup-preview > p:first-of-type");
        page.click(Element.css("#holding-followup-create"));
        page.await(new Check("Create consumes once and appends after the original completed check",new Script(
            RESOURCE+".entries?.length===2 && "+RESOURCE+".dirty===true && document.querySelector('#holding-followup-create')===null")));
        String id=page.read(new Script(RESOURCE+".entries[1].id"));
        assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        JSONObject expected=expectedPayload(id);
        assertPayload(expected,false);
        page.await(new Check("existing listing is offered for review without replacement or another Create",new Script(
            "document.querySelector('#holding-followup-create')===null && document.querySelector('#holding-followup-preview')?.disabled===true && document.querySelector('#holding-followup-review')?.textContent==='Review existing follow-up'")));
        assertPayload(expected,false);
        assertOriginalPortfolio(original);
        assertBoundary(Phase.CREATED);
        return expected;
    }
    private JSONObject listing(String name) throws Exception {
        String capital=name.toUpperCase(java.util.Locale.ROOT);
        boolean alfa=name.equals("alfa");
        return new JSONObject().put("country","US").put("exchangeMic","XNAS").put("instrumentType","common_stock")
            .put("issuerId","issuer-"+name).put("issuerName",alfa?"Alfa Company":name.equals("one")?"One Company":"Zero Company")
            .put("listingId","listing-"+name).put("securityId","security-"+name)
            .put("securityName",alfa?"Alfa Common Stock":name.equals("one")?"One Class A":"Zero Class A")
            .put("shareClassId","class-"+name).put("shareClassName",alfa?"Common Stock":"Class A").put("symbol",capital);
    }
    private JSONObject expectedPayload(String id) throws Exception {
        String digest="sha256:"+"a".repeat(64);
        JSONObject retained=new JSONObject().put("id","10000000-0000-4000-8000-000000000001").put("listing",listing("alfa"))
            .put("catalogSnapshotSha256",digest).put("check","Keep this earlier ALFA assessment in original resource order.")
            .put("dueOn","2026-10-01").put("status","completed").put("completedOn","2026-10-04")
            .put("result","Original invented assessment Café 東京 remains complete.");
        JSONObject created=new JSONObject().put("id",id).put("listing",listing("one")).put("catalogSnapshotSha256",digest)
            .put("check",QUESTION).put("dueOn",DUE).put("status","open").put("completedOn",JSONObject.NULL).put("result","");
        return new JSONObject().put("schemaVersion",1).put("entries",new org.json.JSONArray().put(retained).put(created));
    }
    private void assertPayload(JSONObject expected,boolean saved) throws Exception {
        String savedCheck=saved?" && same(r.saved,{version:2,payload:expected})":" && r.baseVersion===1";
        page.await(new Check("entire ordered resource exactly matches independent handwritten fields with no position metadata",new Script(
            "(()=>{"+EXACT+"const r="+RESOURCE+",expected="+expected+";return same({schemaVersion:1,entries:r.entries},expected)"+savedCheck+";})()")));
    }
    private void assertOriginalPortfolio(JSONObject original) throws Exception {
        page.await(new Check("complete original Portfolio ledger is retained and no Watchlist was loaded",new Script(
            "(()=>{"+EXACT+"return same("+PORTFOLIO+".ledger,"+original+") && "+WATCHLIST+".memberships===null && "+COUNTS+".load===0;})()")));
    }
    private void returnToPortfolio(JSONObject original,Phase phase) throws Exception {
        keyboard.closeSoftKeyboard();
        page.await(new Check("exact company route and visible enabled Back are ready for one hardware action",new Script(
            "(()=>{const b=document.querySelector('.managed-company-visit .trial-toolbar > button'),r=b?.getBoundingClientRect();return " +
            "document.querySelector("+JSONObject.quote(TOOL)+")!==null && b?.textContent==='Back to workspace' && b.disabled===false"+
            " && b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && r.width>0 && r.height>0;})()")).nativeReady());
        pressBack();
        page.await(new Check("one hardware Back retains Portfolio and exact original position order",new Script(
            "location.href==='https://localhost/' && document.querySelector('.managed-company-visit')===null"+
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Portfolio'"+
            " && [...document.querySelectorAll('table tbody tr')].some(row=>row.textContent.includes('ONE'))")));
        assertOriginalPortfolio(original);
        assertBoundary(phase);
    }
    private void saveAndFreshLoad(JSONObject expected) throws Exception {
        openView("Follow-ups","managed-followups-heading");
        assertPayload(expected,false);
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("only explicit Follow-ups Save commits the whole independent resource",new Script(
            RESOURCE+".baseVersion===2 && "+RESOURCE+".dirty===false && "+FOLLOWUPS+".save===1 && "+FOLLOWUPS+".commits===1")));
        assertPayload(expected,true);
        assertBoundary(Phase.SAVED);
        page.click(Element.css("#fixture-holding-followup-fresh-session"));
        page.await(new Check("fresh session performs no implicit resource Load",new Script(
            COUNTS+".status===2 && "+COUNTS+".marketsResolve===2 && "+RESOURCE+".entries===null && "+WATCHLIST+".memberships===null")));
        assertBoundary(Phase.FRESH);
        openView("Follow-ups","managed-followups-heading");
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("fresh explicit Follow-ups Load restores version two without Portfolio or Watchlist Save",new Script(
            FOLLOWUPS+".load===2 && "+RESOURCE+".baseVersion===2 && "+RESOURCE+".dirty===false")));
        assertPayload(expected,true);
        assertBoundary(Phase.RELOADED);
    }
    private void assertBoundary(Phase phase) throws Exception {
        page.await(new Check("fixed origin, source, CSP, independent resources and zero provider/write budgets remain intact",new Script(
            "location.origin==='https://localhost' && location.hash==='' && window.Capacitor?.getPlatform()==='android'"+
            " && document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(sourceSha)+
            " && document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'"+
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            " && "+COUNTS+".status==="+phase.sessions()+" && "+COUNTS+".marketsResolve==="+phase.sessions()+
            " && "+COUNTS+".resolve==="+phase.portfolioLoads()+" && "+COUNTS+".portfolioLoad==="+phase.portfolioLoads()+
            " && "+COUNTS+".load===0 && "+COUNTS+".save===0 && "+COUNTS+".eod===0 && "+COUNTS+".annual===0 && "+COUNTS+".filings===0"+
            " && "+COUNTS+".marketsEod===0 && "+COUNTS+".calendar===0 && "+COUNTS+".fed===0 && "+COUNTS+".search===0 && "+COUNTS+".token===0 && "+COUNTS+".signOut===0"+
            " && "+COUNTS+".portfolioSave===0 && "+LEDGER+".load==="+phase.portfolioLoads()+" && "+LEDGER+".save===0 && "+LEDGER+".commits===0 && "+FOLLOWUPS+".load==="+phase.loads()+
            " && "+FOLLOWUPS+".save==="+phase.saves()+" && "+FOLLOWUPS+".commits==="+phase.saves()+
            " && "+FOLLOWUPS+".replays===0 && "+FOLLOWUPS+".token===0 && "+FOLLOWUPS+".signOut===0")));
    }
    private void openView(String label,String heading) throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='"+label+"']"));
        page.await(new Check("visible product view: "+label,new Script(
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent==="+JSONObject.quote(label)+
            " && document.getElementById("+JSONObject.quote(heading)+")?.checkVisibility()===true")));
    }
    private void enter(Input input) throws Exception {
        JSONObject point = new JSONObject(page.read(new Script("JSON.stringify((()=>{const e=document.querySelector(" + JSONObject.quote(input.selector) + ");" +
            "e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=e.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;" +
            "return {x,y,ox:v.offsetLeft,oy:v.offsetTop,width:v.width,height:v.height,scale:v.scale*devicePixelRatio," +
            "visible:e.checkVisibility()&&!e.disabled&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height," +
            "hit:e.contains(document.elementFromPoint(x,y))};})())")));
        assertTrue(point.getBoolean("visible"));
        assertTrue(point.getBoolean("hit"));
        onView(isAssignableFrom(WebView.class)).perform(new GeneralClickAction(Tap.SINGLE, view -> nativePoint(view, point), Press.FINGER));
        page.await(new Check("exact author field has focus before native input", new Script("document.activeElement===document.querySelector(" + JSONObject.quote(input.selector) + ")")));
        commitInput(input);
        page.await(new Check("complete native text reaches its controlled author field", new Script("document.querySelector(" + JSONObject.quote(input.selector) + ")?.value===" + JSONObject.quote(input.text))));
        keyboard.closeSoftKeyboard();
    }
    private static final class AuthorGeometry {
        private final JSONObject value;
        private final double scale;
        AuthorGeometry(JSONObject value) throws Exception {
            this.value=value;
            scale=value.getDouble("scale");
            assertTrue(Double.isFinite(scale));
            assertTrue(scale>0);
        }
        private void requireWindow(View view) {
            assertTrue(view.isShown());
            assertTrue(view.hasWindowFocus());
        }
        private void requireViewport(View view) throws Exception {
            assertTrue(Math.abs(value.getDouble("width")*scale-view.getWidth())<=scale+1);
            assertTrue(value.getDouble("height")*scale<=view.getHeight()+scale+1);
        }
        private void requirePoint(View view, android.graphics.PointF point) {
            assertTrue(Float.isFinite(point.x)&&Float.isFinite(point.y));
            assertTrue(point.x>0&&point.y>0);
            assertTrue(point.x<view.getWidth()&&point.y<view.getHeight());
        }
        float[] screenPoint(View view) throws Exception {
            requireWindow(view);
            requireViewport(view);
            var point=new android.graphics.PointF((float)((value.getDouble("x")-value.getDouble("ox"))*scale),
                (float)((value.getDouble("y")-value.getDouble("oy"))*scale));
            requirePoint(view,point);
            int[] location=new int[2];view.getLocationOnScreen(location);
            return new float[]{location[0]+point.x,location[1]+point.y};
        }
    }
    private float[] nativePoint(View view, JSONObject point) {
        try { return new AuthorGeometry(point).screenPoint(view); }
        catch(Exception error) { throw new AssertionError("Invalid observed author-field geometry",error); }
    }
    private boolean editorReady(View view) {
        if (!view.hasFocus()) return false;
        if (!view.hasWindowFocus()) return false;
        return supportsInputMethods().matches(view);
    }
    private void commitInput(Input input) {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "commit complete invented holding question through native IME"; }
            @Override public void perform(UiController controller, View view) {
                long deadline=SystemClock.uptimeMillis()+10_000;
                while (!editorReady(view)) {
                    long remaining=deadline-SystemClock.uptimeMillis();
                    assertTrue("Author editor retains its original native readiness deadline",remaining>0);
                    controller.loopMainThreadForAtLeast(Math.min(50,remaining));
                }
                var connection=((WebView)view).onCreateInputConnection(new android.view.inputmethod.EditorInfo());
                assertNotNull(connection);
                assertTrue(connection.commitText(input.text,1));
                controller.loopMainThreadUntilIdle();
            }
        });
    }

    private void retainFrame(HoldingFollowupFrameCapture.Frame frame,String targets) throws Exception {
        page.read(new Script("(()=>{document.querySelector("+JSONObject.quote(targets.split(",")[0])+").scrollIntoView({block:'center',inline:'center',behavior:'instant'});return 'positioned';})()"));
        String visible="(()=>{const list=[...document.querySelectorAll("+JSONObject.quote(targets)+")],v=visualViewport;return list.length>0&&v&&list.every(e=>{const r=e.getBoundingClientRect();"+
            "return e.checkVisibility()&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height;});})()";
        page.await(new Check("complete requested region is visible for the captured frame",new Script(visible)).nativeReady());
        new HoldingFollowupFrameCapture(new HoldingFollowupFrameCapture.Request(scenario,frame)).retain();
        page.await(new Check("requested region remains in the captured frame",new Script(visible)));
    }
    @After public void closeInventedHoldingQuestion() {
        try {if(scenario!=null){scenario.close();scenario=null;}}
        finally {if(assets!=null)assets.close();}
    }
}

/** One absolute deadline covers visual readiness, a committed frame and PixelCopy ownership. */
final class HoldingFollowupFrameCapture {
    enum Frame { POSITION, PREVIEW }
    record Request(ActivityScenario<MainActivity> scenario, Frame frame) {}
    private record WindowFrame(WebView webView, Window window) {}
    private record PixelResult(Bitmap bitmap, int result) {}
    private static final class Pending {
        final long deadline = SystemClock.uptimeMillis() + 10_000;
        final Handler main = new Handler(Looper.getMainLooper());
        final CompletableFuture<Bitmap> captured = new CompletableFuture<>();
        final AtomicReference<String> phase = new AtomicReference<>("visual-state");
        final AtomicReference<ViewTreeObserver> observer = new AtomicReference<>();
        final AtomicReference<Runnable> frameCallback = new AtomicReference<>();
        boolean expired() {
            if (captured.isDone()) return true;
            return SystemClock.uptimeMillis() >= deadline;
        }
    }
    private final Request request;
    HoldingFollowupFrameCapture(Request request) { this.request = request; }

    void retain() throws Exception {
        String configured = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
        File output = configured == null
            ? new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalCacheDir(), "instrumentation-screenshots")
            : new File(configured);
        assertTrue(output.isDirectory() || output.mkdirs());
        Bitmap screenshot = capture();
        try (FileOutputStream stream = new FileOutputStream(new File(output, filename() + ".png"))) {
            assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, stream));
        } finally { screenshot.recycle(); }
    }
    private String filename() { return switch (request.frame) { case POSITION -> "holdingResearchPositionContext"; case PREVIEW -> "holdingResearchCompleteCheckPreview"; }; }

    private Bitmap capture() throws Exception {
        Pending pending = new Pending();
        try {
            request.scenario.onActivity(activity -> prepareVisual(pending, new WindowFrame(activity.getBridge().getWebView(), activity.getWindow())));
            long remaining = pending.deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) throw new IOException("Screenshot deadline expired before waiting");
            return pending.captured.get(remaining, TimeUnit.MILLISECONDS);
        } catch (Exception error) {
            cancelResult(pending);
            throw new IOException("Screenshot did not complete: " + filename() + ", phase=" + pending.phase.get(), error);
        } finally { unregisterFrameCallback(pending); }
    }
    private void prepareVisual(Pending pending, WindowFrame frame) {
        assertTrue("Screenshot needs an attached visible hardware WebView",
            frame.webView.isAttachedToWindow() && frame.webView.isShown() && frame.webView.isHardwareAccelerated());
        frame.webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
            @Override public void onComplete(long requestId) { prepareFrame(pending, frame); }
        });
    }
    private void prepareFrame(Pending pending, WindowFrame frame) {
        if (pending.expired()) return;
        pending.phase.set("frame-commit");
        Runnable committed = () -> pending.main.post(() -> copyCommittedPixels(pending, frame));
        ViewTreeObserver current = frame.webView.getViewTreeObserver();
        pending.observer.set(current);
        pending.frameCallback.set(committed);
        current.registerFrameCommitCallback(committed);
        frame.webView.invalidate();
    }
    private boolean invalidDimensions(View decor) {
        if (decor == null) return true;
        if (decor.getWidth() <= 0) return true;
        if (decor.getHeight() <= 0) return true;
        return (long) decor.getWidth() * decor.getHeight() > 16_777_216;
    }
    private void copyCommittedPixels(Pending pending, WindowFrame frame) {
        if (pending.expired()) return;
        pending.phase.set("pixel-copy");
        View decor = frame.window.peekDecorView();
        if (invalidDimensions(decor)) {
            pending.captured.completeExceptionally(new IOException("Invalid screenshot window dimensions"));
            return;
        }
        Bitmap bitmap = Bitmap.createBitmap(decor.getWidth(), decor.getHeight(), Bitmap.Config.ARGB_8888);
        try {
            PixelCopy.request(frame.window, bitmap, result -> acceptPixels(pending, new PixelResult(bitmap, result)), pending.main);
        } catch (RuntimeException error) {
            bitmap.recycle();
            pending.captured.completeExceptionally(error);
        }
    }
    private void acceptPixels(Pending pending, PixelResult pixels) {
        if (pixels.result != PixelCopy.SUCCESS) {
            pixels.bitmap.recycle();
            pending.captured.completeExceptionally(new IOException("PixelCopy result=" + pixels.result));
            return;
        }
        // A timed-out caller never owns a still-running copy's bitmap.
        if (pending.captured.complete(pixels.bitmap))
            Log.i("ManagedScreenshot", "name=" + filename() + ", visualReady=true, frameCommitted=true, pixelCopy=SUCCESS, width=" + pixels.bitmap.getWidth() + ", height=" + pixels.bitmap.getHeight());
        else pixels.bitmap.recycle();
    }
    private void cancelResult(Pending pending) {
        if (pending.captured.cancel(false)) return;
        if (pending.captured.isCompletedExceptionally()) return;
        Bitmap completed = pending.captured.getNow(null);
        if (completed != null) completed.recycle();
    }
    private void unregisterFrameCallback(Pending pending) {
        pending.main.post(() -> {
            ViewTreeObserver current = pending.observer.get();
            if (current == null) return;
            if (!current.isAlive()) return;
            Runnable callback = pending.frameCallback.get();
            if (callback != null) current.unregisterFrameCommitCallback(callback);
        });
    }
}
