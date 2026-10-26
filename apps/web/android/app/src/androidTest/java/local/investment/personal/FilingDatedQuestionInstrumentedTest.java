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

/** One loaded invented filing becomes one complete independently saved dated question. */
@RunWith(AndroidJUnit4.class)
public class FilingDatedQuestionInstrumentedTest {
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final String QUESTION = "Will the next quarterly filing confirm capacity growth? Café 東京";
    private static final String CHECK = "Question: Will the next quarterly filing confirm capacity growth? Café 東京 | SEC filing metadata: Form 10-Q; accession 0000000001-26-000001; filed 2026-09-19; https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm";
    private static final String DUE = "2026-12-31";
    private static final String PREFIX = "#managed-filings-followup-0000000001-26-000001";
    private static final String TOOL = ".managed-filings-list > li:first-child > .managed-filings-followup";
    private static final String PREVIEW = TOOL + " .managed-filings-followup-preview";
    private static final String COUNTS = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FOLLOWUPS = "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String RESOURCE = "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String WATCHLIST = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String COMPANY_URL = "https://localhost/?company=listing-zero&section=filings";
    private static final String EXACT = "function same(a,b){if(a===b)return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;" +
        "if(Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a),bk=Object.keys(b);" +
        "return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private enum Phase {
        STARTUP, LOADED, CREATED, SAVED, FRESH, RELOADED;
        int sessions() { return this == FRESH || this == RELOADED ? 2 : 1; }
        int filings() { return this == STARTUP ? 0 : 1; }
        int loads() { return switch(this) { case STARTUP, LOADED -> 0; case RELOADED -> 2; default -> 1; }; }
        int saves() { return this == SAVED || this == FRESH || this == RELOADED ? 1 : 0; }
    }
    private enum Input {
        QUESTION("-question", FilingDatedQuestionInstrumentedTest.QUESTION), DATE("-due", DUE);
        final String selector, text;
        Input(String suffix, String text) { this.selector = PREFIX + suffix; this.text = text; }
    }
    private record Draft(String watchlist, String payload) {}

    @Before public void launchInventedFilingQuestion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha);
        assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets();
        assets.prepare();
        selectOnlyNewScenario();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        keyboard = new ReportRevisitKeyboard(page, new ReportRevisitTouch(page));
        scenario.onActivity(activity -> {
            keyboard.observe(activity);
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNotNull(activity.getBridge().getPlugin("App"));
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("invented filing-question fixture has its initial independent resources", new Script(
            "document.querySelector('#fixture-diagnostics')!==null && " + COUNTS + ".load===1 && " + COUNTS + ".status===1 && " + COUNTS + ".marketsResolve===1" +
            " && document.querySelector('#managed-note-0')?.disabled===false && " + RESOURCE + ".entries===null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        assertBoundary(Phase.STARTUP);
    }

    private void selectOnlyNewScenario() throws Exception {
        File index = new File(assets.directory(), "index.html");
        assertEquals(assets.directory().getCanonicalFile(), index.getCanonicalFile().getParentFile());
        String html = Files.readString(index.toPath(), StandardCharsets.UTF_8);
        String before = "<meta name=\"investment-android-test-scenario\" content=\"report-revisit\">";
        assertEquals("Only the fixed test marker is replaced", 1, html.split(java.util.regex.Pattern.quote(before), -1).length - 1);
        String selected = html.replace(before, "<meta name=\"investment-android-test-scenario\" content=\"filing-dated-question\">");
        assertTrue(selected.getBytes(StandardCharsets.UTF_8).length <= 65_536);
        Files.writeString(index.toPath(), selected, StandardCharsets.UTF_8);
        try (var files = Files.walk(assets.directory().toPath())) {
            long total = files.filter(Files::isRegularFile).mapToLong(path -> {
                try { return Files.size(path); } catch (IOException error) { throw new java.io.UncheckedIOException(error); }
            }).sum();
            assertTrue("Copied test assets retain the original byte bound", total <= 4 * 1024 * 1024);
        }
    }

    @Test public void loadedFilingCreatesExactDatedQuestionThroughBackSaveAndFreshLoad() throws Exception {
        String originalWatchlist = loadRetainedFilingGroup();
        authorAndCancelQuestion(originalWatchlist);
        Draft created = createOneQuestion(originalWatchlist);
        returnToRetainedGroup(created);
        saveAndFreshLoad(created);
    }

    private String loadRetainedFilingGroup() throws Exception {
        openView("My Watchlist", "managed-watchlist-heading");
        String original = page.read(new Script("JSON.stringify(" + WATCHLIST + ")"));
        page.click(Element.css(".managed-filings-review > summary"));
        page.click(Element.css(".managed-filings-review-choice:nth-of-type(1)"));
        page.click(Element.css(".managed-filings-review-choice:nth-of-type(2)"));
        groupAction("Start filing review");
        page.await(new Check("two exact chosen companies retain ZERO then ONE before any source read", new Script(groupOrder(false) +
            " && " + COUNTS + ".filings===0 && document.activeElement===document.querySelector('.managed-filings-review h4')")));
        groupAction("Load review filings");
        assertRetainedPacket();
        groupAction("Inspect filings and write note");
        page.await(new Check("Inspect imports the retained ZERO packet into the exact Filings route", new Script(
            "location.href===" + JSONObject.quote(COMPANY_URL) + " && document.activeElement?.id==='managed-filings-heading'" +
            " && document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            " && document.querySelector('.managed-filings-count')?.textContent.includes('26 of 26 loaded filings')" +
            " && document.querySelector(" + JSONObject.quote(TOOL) + ")?.open===false")));
        assertBoundary(Phase.LOADED);
        return original;
    }

    private void authorAndCancelQuestion(String original) throws Exception {
        page.click(Element.css(TOOL + " > summary"));
        page.await(new Check("new standalone tool offers only its explicit labelled draft steps", new Script(
            "document.querySelector(" + JSONObject.quote(TOOL + " > summary") + ")?.textContent==='Keep a dated research question'" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-load") + ")?.textContent==='Load follow-ups for this question'" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-prepare") + ")?.disabled===true" +
            " && document.querySelector(" + JSONObject.quote(TOOL) + ").closest('.managed-filings-note-action')===null")));
        enter(Input.QUESTION);
        enter(Input.DATE);
        page.click(Element.css(PREFIX + "-load"));
        page.await(new Check("explicit Follow-ups Load preserves authored raw question and UTC due date without creating", new Script(
            "document.querySelector(" + JSONObject.quote(PREFIX + "-question") + ")?.value===" + JSONObject.quote(QUESTION) +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-due") + ")?.value===" + JSONObject.quote(DUE) +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-prepare") + ")?.disabled===false" +
            " && " + FOLLOWUPS + ".load===1 && " + RESOURCE + ".entries?.length===0")));
        previewQuestion();
        assertOriginalWatchlist(original);
        page.click(Element.css(PREFIX + "-cancel"));
        page.await(new Check("Cancel removes the complete preview and Create capability without creating or saving", new Script(
            "document.querySelector(" + JSONObject.quote(PREFIX + "-preview") + ")===null && document.querySelector(" + JSONObject.quote(PREFIX + "-create") + ")===null" +
            " && " + RESOURCE + ".entries?.length===0 && " + RESOURCE + ".dirty===false && " + FOLLOWUPS + ".save===0")));
        assertOriginalWatchlist(original);
    }

    private void previewQuestion() throws Exception {
        page.click(Element.css(PREFIX + "-prepare"));
        page.await(new Check("explicit Preview contains the entire handwritten check, UTC due date and exact listing IDs", new Script(
            "(() => {const p=document.querySelector(" + JSONObject.quote(PREVIEW) + ");return p && document.querySelector(" + JSONObject.quote(PREFIX + "-preview") + ")?.readOnly===true" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-preview") + ").value===" + JSONObject.quote(CHECK) +
            " && document.querySelector('label[for=managed-filings-followup-0000000001-26-000001-preview]')?.textContent==='Complete cited check preview'" +
            " && p.querySelector('p')?.textContent==='ZERO · Class A · XNAS'" +
            " && [...p.querySelectorAll(':scope > dl > div')].map(e=>e.textContent).join('|')==='Listinglisting-zero|Securitysecurity-zero|Share classclass-zero|Due date (UTC)2026-12-31'" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-create") + ")?.textContent==='Create follow-up draft'" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-prepare") + ")?.textContent==='Preview dated question'" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-cancel") + ")?.textContent==='Cancel question';})()")));
        assertSourceQualifications();
    }

    private Draft createOneQuestion(String original) throws Exception {
        previewQuestion();
        retainPreviewFrames();
        page.click(Element.css(PREFIX + "-create"));
        page.await(new Check("Create consumes its capability and makes one unsaved Follow-up only", new Script(
            RESOURCE + ".entries?.length===1 && " + RESOURCE + ".dirty===true && " + FOLLOWUPS + ".save===0 && " + FOLLOWUPS + ".commits===0" +
            " && document.querySelector(" + JSONObject.quote(PREFIX + "-create") + ")===null && document.querySelector(" + JSONObject.quote(PREFIX + "-preview") + ")===null")));
        String id = page.read(new Script(RESOURCE + ".entries[0].id"));
        assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        String expected = expectedPayload(id).toString();
        assertPayload(expected, false);
        page.click(Element.css(PREFIX + "-prepare"));
        page.await(new Check("a new explicit Preview refuses an existing exact listing without another Create", new Script(
            "document.querySelector(" + JSONObject.quote(PREFIX + "-create") + ")===null && " + RESOURCE + ".entries?.length===1")));
        assertPayload(expected, false);
        assertOriginalWatchlist(original);
        assertBoundary(Phase.CREATED);
        return new Draft(original, expected);
    }

    private JSONObject expectedPayload(String id) throws Exception {
        JSONObject listing = new JSONObject();
        String[] keys = {"country","exchangeMic","instrumentType","issuerId","issuerName","listingId","securityId","securityName","shareClassId","shareClassName","symbol"};
        String[] values = {"US","XNAS","common_stock","issuer-zero","Zero Company","listing-zero","security-zero","Zero Class A","class-zero","Class A","ZERO"};
        for (int index = 0; index < keys.length; index++) listing.put(keys[index], values[index]);
        JSONObject entry = new JSONObject().put("id", id).put("catalogSnapshotSha256", "sha256:" + "a".repeat(64)).put("listing", listing)
            .put("check", CHECK).put("dueOn", DUE).put("status", "open").put("completedOn", JSONObject.NULL).put("result", "");
        return new JSONObject().put("schemaVersion",1).put("entries",new org.json.JSONArray().put(entry));
    }

    private void assertPayload(String expected, boolean saved) throws Exception {
        String stored = saved ? " && same(resource.saved,{version:1,payload:expected})" : " && resource.baseVersion===0 && same(resource.saved,{version:0,payload:{schemaVersion:1,entries:[]}})";
        page.await(new Check("complete Follow-ups shape and ordered entries equal the independent golden; object key order is immaterial", new Script(
            "(() => {" + EXACT + "const resource=" + RESOURCE + ",expected=" + expected + ";return same({schemaVersion:1,entries:resource.entries},expected)" + stored + ";})()")));
    }

    private void returnToRetainedGroup(Draft created) throws Exception {
        keyboard.closeSoftKeyboard();
        page.await(new Check("exact Filings visit and enabled visible Back are ready for one hardware action", new Script(
            "(() => {const b=document.querySelector('.managed-company-visit .trial-toolbar > button'),r=b?.getBoundingClientRect();return location.href===" + JSONObject.quote(COMPANY_URL) +
            " && document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && b?.textContent==='Back to workspace'" +
            " && b.disabled===false && b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && r.width>0 && r.height>0;})()")).nativeReady());
        pressBack();
        page.await(new Check("one hardware Back restores the same visible chosen group without another read or Save", new Script(
            "location.href==='https://localhost/' && document.querySelector('.managed-company-visit')===null" +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='My Watchlist'" +
            " && document.querySelector('.managed-filings-review')?.open===true && " + groupOrder(true))));
        assertRetainedPacket();
        assertPayload(created.payload(), false);
        assertOriginalWatchlist(created.watchlist());
        assertBoundary(Phase.CREATED);
    }

    private void saveAndFreshLoad(Draft created) throws Exception {
        openView("Follow-ups", "managed-followups-heading");
        assertPayload(created.payload(), false);
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("only explicit Follow-ups Save commits its complete resource once", new Script(
            RESOURCE + ".baseVersion===1 && " + RESOURCE + ".dirty===false && " + FOLLOWUPS + ".save===1 && " + FOLLOWUPS + ".commits===1")));
        assertPayload(created.payload(), true);
        assertOriginalWatchlist(created.watchlist());
        assertBoundary(Phase.SAVED);
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh session reloads the unchanged Watchlist but has no implicit Follow-ups read", new Script(
            COUNTS + ".load===2 && " + COUNTS + ".status===2 && " + COUNTS + ".marketsResolve===2 && " + RESOURCE + ".entries===null")));
        assertBoundary(Phase.FRESH);
        openView("Follow-ups", "managed-followups-heading");
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("fresh explicit Load restores the independent saved check at version one", new Script(
            FOLLOWUPS + ".load===2 && " + RESOURCE + ".baseVersion===1 && " + RESOURCE + ".dirty===false")));
        assertPayload(created.payload(), true);
        assertOriginalWatchlist(created.watchlist());
        assertBoundary(Phase.RELOADED);
    }

    private String groupOrder(boolean loaded) {
        String zero = loaded ? "26 filings in retained response" : "No response loaded";
        return "[...document.querySelectorAll('.managed-filings-review-companies > li > button')].map(b=>b.textContent).join('|')==='ZERO · Class A · XNAS" + zero + "|ONE · Class A · XNASNo response loaded'" +
            " && document.querySelector('.managed-filings-review-companies > li:first-child > button')?.getAttribute('aria-current')==='true'";
    }
    private void assertRetainedPacket() throws Exception {
        page.await(new Check("ZERO retains its original source packet while ONE remains unrequested", new Script(
            "document.querySelector('.managed-filings-review section[aria-label=\"Filing review for ZERO\"]')?.checkVisibility()===true" +
            " && document.querySelector('.managed-filings-review section[aria-label=\"Filing review for ZERO\"]')?.textContent.includes('2026-09-20T00:00:02.000Z')" +
            " && " + groupOrder(true))));
    }
    private void assertOriginalWatchlist(String original) throws Exception {
        page.await(new Check("whole original Watchlist observations, member order and notes remain unchanged", new Script(
            "(() => {" + EXACT + "return same(" + WATCHLIST + "," + original + ");})()")));
    }
    private void assertSourceQualifications() throws Exception {
        page.await(new Check("preview preserves exact source URL, original UTC clocks/window and current-object qualifications", new Script(
            "(() => {const p=document.querySelector(" + JSONObject.quote(PREVIEW) + ");const fields=[...p.querySelectorAll('.managed-filings-source-details dl > div')].map(e=>e.textContent);" +
            "return p.querySelector('.managed-filings-period')?.textContent==='2026-06-23 to 2026-09-20 · 90 days · CIK 0000000001'" +
            " && p.querySelector('.managed-filings-source')?.textContent==='SEC Submissions source · Retrieved 2026-09-20T00:00:01.000Z'" +
            " && p.querySelector('.managed-filings-source a')?.href==='https://data.sec.gov/submissions/CIK0000000001.json'" +
            " && fields.join('|')==='Request started2026-09-20T00:00:00.000Z|Completed2026-09-20T00:00:02.000Z'" +
            " && p.querySelector(':scope > .managed-filings-scope')?.textContent==='Current recent-filings object only; complete 90-day coverage is not established.'" +
            " && p.querySelector('.managed-filings-source-details')?.textContent.includes('Older continuation files were not loaded; this list does not establish complete coverage of the 90-day window.')" +
            " && p.querySelector('.managed-filings-source-details')?.textContent.includes('The source lists older continuation files.')" +
            " && p.querySelector('.managed-filings-warning')===null;})()")));
    }
    private void assertBoundary(Phase phase) throws Exception {
        page.await(new Check("test-only origin, source and exact fixed API budgets remain disconnected", new Script(
            "location.origin==='https://localhost' && location.hash==='' && window.Capacitor?.getPlatform()==='android'" +
            " && document.querySelector('meta[name=investment-build-sha]')?.content===" + JSONObject.quote(sourceSha) +
            " && document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'" +
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===" + JSONObject.quote(CSP) +
            " && " + COUNTS + ".load===" + phase.sessions() + " && " + COUNTS + ".status===" + phase.sessions() + " && " + COUNTS + ".marketsResolve===" + phase.sessions() +
            " && " + COUNTS + ".filings===" + phase.filings() + " && " + COUNTS + ".resolve===0 && " + COUNTS + ".save===0" +
            " && " + COUNTS + ".annual===0 && " + COUNTS + ".eod===0 && " + COUNTS + ".marketsEod===0 && " + COUNTS + ".search===0" +
            " && " + COUNTS + ".calendar===0 && " + COUNTS + ".fed===0 && " + COUNTS + ".token===0 && " + COUNTS + ".signOut===0" +
            " && " + FOLLOWUPS + ".load===" + phase.loads() + " && " + FOLLOWUPS + ".save===" + phase.saves() + " && " + FOLLOWUPS + ".commits===" + phase.saves() +
            " && " + FOLLOWUPS + ".replays===0 && " + FOLLOWUPS + ".token===0 && " + FOLLOWUPS + ".signOut===0")));
    }
    private void openView(String label, String heading) throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='" + label + "']"));
        page.await(new Check("visible product view: " + label, new Script(
            "document.querySelector('.managed-navigation [aria-current=page]')?.textContent===" + JSONObject.quote(label) +
            " && document.getElementById(" + JSONObject.quote(heading) + ")?.checkVisibility()===true")));
    }
    private void groupAction(String label) {
        page.click(Element.xpath("//details[contains(@class,'managed-filings-review')]//button[normalize-space(.)='" + label + "']"));
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
    private float[] nativePoint(View view, JSONObject point) {
        try {
            double scale=point.getDouble("scale");
            assertTrue(Double.isFinite(scale) && scale>0);
            assertTrue(view.isShown() && view.hasWindowFocus());
            assertTrue(Math.abs(point.getDouble("width")*scale-view.getWidth())<=scale+1);
            assertTrue(point.getDouble("height")*scale<=view.getHeight()+scale+1);
            float x=(float)((point.getDouble("x")-point.getDouble("ox"))*scale);
            float y=(float)((point.getDouble("y")-point.getDouble("oy"))*scale);
            assertTrue(Float.isFinite(x)&&Float.isFinite(y)&&x>0&&y>0&&x<view.getWidth()&&y<view.getHeight());
            int[] location=new int[2];view.getLocationOnScreen(location);
            return new float[]{location[0]+x,location[1]+y};
        } catch (Exception error) { throw new AssertionError("Invalid observed author-field geometry",error); }
    }
    private void commitInput(Input input) {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "commit complete invented filing question through native IME"; }
            @Override public void perform(UiController controller, View view) {
                long deadline=SystemClock.uptimeMillis()+10_000;
                while (!(view.hasFocus()&&view.hasWindowFocus()&&supportsInputMethods().matches(view))) {
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

    private void retainPreviewFrames() throws Exception {
        String first=PREVIEW + " > label";
        page.read(new Script("(()=>{document.querySelector(" + JSONObject.quote(first) + ").scrollIntoView({block:'start',inline:'center',behavior:'instant'});return 'preview positioned';})()"));
        String previewTargets=PREFIX + "-preview," + PREVIEW + " > p:first-of-type," + PREVIEW + " > dl";
        retainFrame(previewTargets,FilingQuestionFrameCapture.Frame.PREVIEW);
        page.click(Element.css(PREVIEW + " .managed-filings-source-details > summary"));
        page.read(new Script("(()=>{document.querySelector(" + JSONObject.quote(PREVIEW + " .managed-filings-period") + ").scrollIntoView({block:'start',inline:'center',behavior:'instant'});return 'source positioned';})()"));
        retainFrame(PREVIEW + " .managed-filings-period," + PREVIEW + " .managed-filings-source," + PREVIEW + " > .managed-filings-scope," + PREVIEW + " .managed-filings-source-details",FilingQuestionFrameCapture.Frame.SOURCE);
        assertSourceQualifications();
    }
    private void retainFrame(String targets,FilingQuestionFrameCapture.Frame frame) throws Exception {
        String visible="(()=>{const list=[...document.querySelectorAll(" + JSONObject.quote(targets) + ")],v=visualViewport;return list.length>0&&v&&list.every(e=>{const r=e.getBoundingClientRect();" +
            "return e.checkVisibility()&&r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height;});})()";
        page.await(new Check("complete requested preview frame is visible; text equality is checked separately",new Script(visible)).nativeReady());
        new FilingQuestionFrameCapture(new FilingQuestionFrameCapture.Request(scenario,frame)).retain();
        page.await(new Check("requested preview region remains inside the captured frame",new Script(visible)));
    }
    @After public void closeInventedFilingQuestion() {
        try { if(scenario!=null){scenario.close();scenario=null;} }
        finally { if(assets!=null)assets.close(); }
    }
}

/** One absolute deadline covers visual readiness, a committed frame and PixelCopy ownership. */
final class FilingQuestionFrameCapture {
    enum Frame { PREVIEW, SOURCE }
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
    FilingQuestionFrameCapture(Request request) { this.request = request; }

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
    private String filename() { return switch (request.frame) { case PREVIEW -> "filingDatedQuestionCompletePreview"; case SOURCE -> "filingDatedQuestionOriginalSourceQualifications"; }; }

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
