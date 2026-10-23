package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.supportsInputMethods;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.junit.Assert.*;

import android.content.res.AssetManager;
import android.graphics.Rect;
import android.os.SystemClock;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsAnimation;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.PerformException;
import androidx.test.espresso.UiController;
import androidx.test.espresso.ViewAction;
import androidx.test.espresso.action.CoordinatesProvider;
import androidx.test.espresso.action.EspressoKey;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.hamcrest.Matcher;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real system chooser and report-revisit UI, invented test-APK files and RAM stores only. */
@RunWith(AndroidJUnit4.class)
public class CompanyReportRevisitInstrumentedTest {
    private static final String FIXTURE = "managed-workspace";
    private static final long PAGE_TIMEOUT_MS = 10_000;
    private static final long FIXTURE_STARTUP_TIMEOUT_MS = 30_000;
    private static final long MAX_ASSET_BYTES = 4 * 1024 * 1024;
    private static final String D = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-revisit-file').textContent)";
    private static final String REVISIT = ".managed-report-revisit";
    private ActivityScenario<MainActivity> scenario;
    private View observedImeDecor;
    private Lifecycle observedImeLifecycle;
    private final java.util.Set<WindowInsetsAnimation> imeAnimations = new java.util.HashSet<>();
    private final List<File> createdFixturePaths = new ArrayList<>();
    private int copiedFiles;
    private long copiedBytes;

    @Before public void launchInventedReportRevisit() throws Exception {
        String sha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull("Pass the actual bundled source SHA", sha);
        assertTrue(sha.matches("[0-9a-f]{40}"));
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        File directory = File.createTempFile("report-revisit-instrumentation-", "", InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir());
        createdFixturePaths.add(directory);
        assertTrue(directory.delete() && directory.mkdir());
        copyFixture(InstrumentationRegistry.getInstrumentation().getContext().getAssets(), FIXTURE, directory, 0);
        File index = new File(directory, "index.html");
        byte[] original = Files.readAllBytes(index.toPath());
        assertTrue(original.length > 0 && original.length <= 65_536);
        String html = new String(original, StandardCharsets.UTF_8);
        assertTrue(html.contains(sha));
        assertEquals(html.indexOf("</head>"), html.lastIndexOf("</head>"));
        assertTrue(html.contains("</head>"));
        assertFalse(html.contains("investment-android-test-scenario"));
        Files.writeString(index.toPath(), html.replace("</head>", "<meta name=\"investment-android-test-scenario\" content=\"report-revisit\"></head>"), StandardCharsets.UTF_8);
        assertTrue(copiedFiles > 0 && copiedFiles <= 64 && copiedBytes <= MAX_ASSET_BYTES);
        scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(activity -> {
            observeImeAnimations(activity);
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(directory.getAbsolutePath());
        });
        awaitPage("source-bound invented fixture with no source reads", "document.querySelector('#fixture-revisit-file')!==null && " + D + ".load===1 && " + D + ".status===1 && document.querySelector('#managed-note-0')?.disabled===false", true, null, FIXTURE_STARTUP_TIMEOUT_MS);
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(InstrumentationRegistry.getInstrumentation().getTargetContext());
    }

    @Test public void savedReportRevisitUsesLargeFileChooserAndExplicitWatchlistSave() throws Exception {
        String before = readString("JSON.stringify(" + DRAFT + ")");
        click("#fixture-revisit-save");
        new WatchlistSystemPicker().saveToInventedRoot();
        awaitPage("invented large current-format report actually written", FILE + ".phase==='written' && " + FILE + ".byteLength>266240 && " + FILE + ".byteLength<2850816");
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(InstrumentationRegistry.getInstrumentation().getTargetContext());
        assertEquals(1, outputs.length);
        String filename = readString(FILE + ".filename");
        assertEquals(filename, outputs[0].name);
        byte[] bytes = WatchlistTestDocuments.readReport(InstrumentationRegistry.getInstrumentation().getTargetContext(), outputs[0]);
        assertTrue(bytes.length > 266_240 && bytes.length < 2_850_816);
        JSONObject archive = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        assertEquals("5.0.0", archive.getString("schemaVersion"));
        assertEquals(300_000, archive.getJSONObject("sources").getJSONObject("annual").getJSONObject("statements").getString("opaqueInventedPadding").length());
        assertUnchanged(before, 0);
        action("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']");
        click("button[aria-label='Annual report for saved ZERO']");
        awaitPage("the exact current company opens without loading sources", "document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && " + D + ".resolve===1");
        click(".managed-company-report > summary");
        click(REVISIT + " > summary");
        touchDraftFileChooserLabel(REVISIT, "Select a company report file", "Report revisit input chooser");
        new WatchlistSystemPicker().cancel();
        awaitPage("native chooser Cancel keeps report state and complete draft unchanged", "document.querySelector('#managed-report-revisit-heading')===null && document.querySelector('.managed-report-revisit input[type=file]')?.value===''");
        assertUnchanged(before, 0);
        touchDraftFileChooserLabel(REVISIT, "Select a company report file", "Report revisit input chooser");
        new WatchlistSystemPicker().openInventedReportDocument(filename);
        String archivedNote = archive.getJSONObject("authoredResearch").getString("note");
        String annualTime = archive.getJSONObject("sources").getJSONObject("annual").getJSONObject("response").getJSONObject("evidence").getJSONObject("generation").getString("completedAt");
        awaitPage("full archived note, exact company identity and original report/source times admitted", "(() => {const section=document.querySelector('[aria-label=\"Archived report\"]');const t=section?.textContent??'';return document.querySelector('#managed-report-revisit-heading')?.textContent==='Reopened report · ZERO' && section?.querySelector('.managed-company-report-note')?.textContent===" + JSONObject.quote(archivedNote) + " && t.includes('2026-10-15T00:00:00.000Z') && t.includes(" + JSONObject.quote(annualTime) + ") && ['US','XNAS','common_stock','issuer-zero','Zero Company','listing-zero','security-zero','Zero Class A','class-zero','Class A','ZERO','0000000001'].every(value=>t.includes(value)) && document.querySelector('[aria-label=\"Current report capture\"]')===null;})()");
        assertUnchanged(before, 0);
        action("//section[contains(@class,'managed-annual-report')]//button[normalize-space(.)='Load annual report']");
        awaitPage("only explicit current Annual load supplies current evidence", D + ".annual===1 && document.querySelector('.sec-quarterly-comparison')!==null");
        revisitAction("Capture current report for comparison");
        awaitPage("current capture preserves original draft note and canonical source dates", "document.querySelector('[aria-label=\"Current report capture\"]')?.textContent.includes(" + JSONObject.quote(annualTime) + ")===true && document.querySelector('.managed-report-revisit textarea:not([readonly])')?.value===''");
        enterAssessment("Draft assessment superseded", "");
        revisitAction("Preview comparison note");
        awaitPage("first complete note preview exists without append or Save", "document.querySelector('[aria-label=\"Complete comparison note preview\"]')?.textContent.includes('Draft assessment superseded')===true");
        enterAssessment("Archived liquidity needs a new review", "Draft assessment superseded");
        awaitPage("editing assessment invalidates the previous entire append proposal", "document.querySelector('[aria-label=\"Complete comparison note preview\"]')===null");
        revisitAction("Preview comparison note");
        awaitPage("replacement assessment has a new complete preview", "document.querySelector('[aria-label=\"Complete comparison note preview\"] .managed-company-report-note')?.textContent.includes('Authored assessment: Archived liquidity needs a new review')===true");
        String preview = readString("document.querySelector('[aria-label=\"Complete comparison note preview\"] .managed-company-report-note').textContent");
        JSONObject initial = new JSONObject(before);
        String oldNote = initial.getJSONArray("memberships").getJSONObject(0).getString("note");
        assertTrue(preview.startsWith(oldNote + " ZERO XNAS report revisit assessed "));
        assertTrue(preview.contains("archived report prepared 2026-10-15T00:00:00.000Z; current report prepared "));
        assertTrue(preview.contains("Authored assessment: Archived liquidity needs a new review"));
        assertFalse(preview.contains("Draft assessment superseded"));
        assertTrue(preview.codePointCount(0, preview.length()) <= 2000);
        assertUnchanged(before, 1);
        revisitAction("Append comparison to note draft");
        awaitPage("append changes only the selected whole note once, with no online Save", DRAFT + ".memberships[0].note===" + JSONObject.quote(preview) + " && " + DRAFT + ".memberships[1].note==='Invented second note' && " + DRAFT + ".memberships.map(x=>x.listingId).join('|')==='listing-zero|listing-one' && " + DRAFT + ".dirty===true && " + D + ".save===0 && document.querySelector('[aria-label=\"Complete comparison note preview\"]')===null && " + DRAFT + ".memberships[0].note.split('report revisit assessed ').length===2");
        action("//section[@aria-labelledby='managed-research-note-heading']//button[normalize-space(.)='Review in My Watchlist']");
        awaitPage("explicit Watchlist review retains the complete note before independent Save", "document.querySelector('.managed-company-visit')===null && " + DRAFT + ".memberships[0].note===" + JSONObject.quote(preview) + " && " + D + ".save===0");
        action("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']");
        awaitPage("one complete independent Save acknowledges version2", D + ".save===1 && " + DRAFT + ".baseVersion===2 && " + DRAFT + ".dirty===false");
        action("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']");
        awaitPage("fresh explicit saved read retains exact note, identity order and unrelated note", D + ".load===2 && " + D + ".save===1 && " + DRAFT + ".memberships[0].note===" + JSONObject.quote(preview) + " && " + DRAFT + ".memberships[1].note==='Invented second note' && " + DRAFT + ".memberships.map(x=>x.listingId).join('|')==='listing-zero|listing-one' && " + DRAFT + ".dirty===false && " + D + ".annual===1 && " + D + ".eod===0 && " + D + ".filings===0 && " + D + ".token===0 && " + D + ".signOut===0");
    }

    private void assertUnchanged(String before, int annual) throws Exception {
        awaitPage("full original draft/order and explicit source counters retained", "JSON.stringify(" + DRAFT + ")===" + JSONObject.quote(before) + " && " + D + ".annual===" + annual + " && " + D + ".eod===0 && " + D + ".filings===0 && " + D + ".save===0 && " + D + ".token===0 && " + D + ".signOut===0");
    }
    private void click(String css) { onWebView().withElement(findElement(Locator.CSS_SELECTOR, css)).perform(webClick()); }
    private void action(String xpath) { onWebView().withElement(findElement(Locator.XPATH, xpath)).perform(webClick()); }
    private void revisitAction(String label) { action("//details[contains(@class,'managed-report-revisit')]//button[normalize-space(.)='" + label + "']"); }
    private String readString(String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, raw -> { result.set(raw); done.countDown(); }));
        assertTrue("Fixture observation callback", done.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        Object value = new org.json.JSONTokener(result.get()).nextValue(); assertTrue(value instanceof String); return (String)value;
    }
    private void enterAssessment(String text, String before) throws Exception {
        String selector = ".managed-report-revisit textarea:not([readonly])";
        String focused = "document.activeElement===document.querySelector('" + selector + "') && document.activeElement.value===" + JSONObject.quote(before);
        String geometry = readString("JSON.stringify((()=>{const input=document.querySelector('" + selector + "');input.scrollIntoView({block:'center',behavior:'instant'});const r=input.getBoundingClientRect(),v=visualViewport,x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,width:v.width,height:v.height,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio,finite:[x,y,r.width,r.height,v.width,v.height,v.scale,devicePixelRatio].every(Number.isFinite)&&r.width>0&&r.height>0,visible:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height,hit:input.contains(document.elementFromPoint(x,y))};})())");
        touchEditorGeometry("report comparison assessment", geometry);
        awaitPage("exact assessment editor and raw previous value focused", focused);
        awaitNativeEditor("report comparison assessment");
        if (!before.isEmpty()) {
            onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
            awaitPage("native select all covers the complete old assessment", focused + " && document.activeElement.selectionStart===0 && document.activeElement.selectionEnd===" + before.length());
            awaitNativeEditor("report comparison assessment");
        }
        commitNativeText(text);
        awaitPage("native assessment edit reaches the controlled product field", "document.activeElement===document.querySelector('" + selector + "') && document.activeElement.value===" + JSONObject.quote(text));
        closeSoftKeyboard();
    }
    private String pageDiagnostic() { return "report revisit fixture failed before its original deadline"; }
    @After public void closeInventedReportRevisit() throws Exception {
        if (scenario != null) { scenario.close(); scenario = null; }
        WatchlistTestDocuments.clear(InstrumentationRegistry.getInstrumentation().getTargetContext());
        for (int i=createdFixturePaths.size()-1;i>=0;i--) { File file=createdFixturePaths.get(i); assertTrue("Only test-created fixture paths are removed", file.delete()); }
    }
    private void copyFixture(AssetManager assets, String source, File target, int depth) throws IOException {
        if (depth > 3) throw new IOException("Fixture nesting limit exceeded");
        String[] entries = assets.list(source);
        if (entries == null || entries.length == 0 || entries.length > 64)
            throw new IOException("Invalid fixture directory");
        for (String name : entries) {
            if (!name.matches("[A-Za-z0-9_][A-Za-z0-9_.-]*")) throw new IOException("Invalid fixture asset name");
            File destination = new File(target, name);
            String child = source + "/" + name;
            String[] children = assets.list(child);
            if (children != null && children.length > 0) {
                if (!destination.mkdir()) throw new IOException("Cannot create fixture subdirectory");
                createdFixturePaths.add(destination);
                copyFixture(assets, child, destination, depth + 1);
            } else {
                if (++copiedFiles > 64 || !destination.createNewFile()) throw new IOException("Fixture file limit or collision");
                createdFixturePaths.add(destination);
                try (InputStream input = assets.open(child); FileOutputStream output = new FileOutputStream(destination)) {
                    byte[] bytes = new byte[8192];
                    int count;
                    while ((count = input.read(bytes)) != -1) {
                        copiedBytes += count;
                        if (copiedBytes > MAX_ASSET_BYTES) throw new IOException("Fixture byte limit exceeded");
                        output.write(bytes, 0, count);
                    }
                }
            }
        }
    }

    private void touchDraftFileChooserLabel(String root, String labelText, String description) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const input=document.querySelector(" + JSONObject.quote(root + " input[type=file]") + "),label=input?.closest('label');" +
            " if(!input || input.disabled || !label)return null;" +
            " if(label.control!==input || !input.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return null;" +
            " const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim()===" + JSONObject.quote(labelText) + ");" +
            " if(!text)return null; label.scrollIntoView({block:'center',inline:'center',behavior:'instant'});" +
            " const range=document.createRange();range.selectNodeContents(text);const r=range.getBoundingClientRect(),ir=input.getBoundingClientRect(),v=visualViewport;" +
            " const x=r.left+r.width/2,y=r.top+r.height/2;" +
            " return {x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:v.width,height:v.height," +
            " offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,scale:v.scale,ratio:devicePixelRatio," +
            " finite:[x,y,r.left,r.top,r.right,r.bottom,r.width,r.height,ir.left,ir.top,ir.right,ir.bottom,ir.width,ir.height,v.width,v.height,v.offsetLeft,v.offsetTop,v.scale,devicePixelRatio].every(Number.isFinite)" +
            " &&r.width>0&&r.height>0&&ir.width>0&&ir.height>0&&v.width>0&&v.height>0&&v.scale>0&&devicePixelRatio>0," +
            " visible:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height" +
            " &&ir.left>=v.offsetLeft&&ir.top>=v.offsetTop&&ir.right<=v.offsetLeft+v.width&&ir.bottom<=v.offsetTop+v.height," +
            " hit:label.contains(document.elementFromPoint(x,y))}; })()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Draft file chooser label geometry returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        touchEditorGeometry(description, observed.get());
    }

    private void touchEditorGeometry(String id, String rawGeometry) throws Exception {
        CoordinatesProvider provider = observedTouchCoordinates(id, rawGeometry);
        AtomicReference<float[]> coordinates = new AtomicReference<>();
        onView(isAssignableFrom(WebView.class)).check((view, noViewFoundException) -> {
            if (noViewFoundException != null) throw noViewFoundException;
            assertTrue("Editor WebView retains the native click visibility constraint",
                androidx.test.espresso.matcher.ViewMatchers.isDisplayingAtLeast(90).matches(view));
            coordinates.set(provider.calculateCoordinates(view));
        });
        float[] point = coordinates.get();
        assertNotNull("Editor native touch coordinates returned", point);
        long downTime = SystemClock.uptimeMillis();
        long deadline = downTime + PAGE_TIMEOUT_MS;
        MotionEvent down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, point[0], point[1], 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            // Public, app-scoped injection waits for retiring window animations before DOWN.
            // Call on the instrumentation thread; never bypass Android's obscured-touch guard.
            Log.i("ManagedEditorTouch", "DOWN dispatch uptime=" + SystemClock.uptimeMillis() + ", x=" + point[0] + ", y=" + point[1]);
            InstrumentationRegistry.getInstrumentation().sendPointerSync(down);
            Log.i("ManagedEditorTouch", "DOWN returned uptime=" + SystemClock.uptimeMillis());
        } finally {
            down.recycle();
        }
        MotionEvent up = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            Log.i("ManagedEditorTouch", "UP dispatch uptime=" + SystemClock.uptimeMillis());
            InstrumentationRegistry.getInstrumentation().sendPointerSync(up);
            Log.i("ManagedEditorTouch", "UP returned uptime=" + SystemClock.uptimeMillis());
        } finally {
            up.recycle();
        }
        assertTrue("Single editor touch finishes within the page deadline", SystemClock.uptimeMillis() < deadline);
    }

    private CoordinatesProvider observedTouchCoordinates(String id, String rawGeometry) throws Exception {
        assertNotNull("Input geometry was null: " + id, rawGeometry);
        Log.i("ManagedInputGeometry", "id=" + id + ", geometry=" + rawGeometry.substring(0, Math.min(rawGeometry.length(), 2048)));
        JSONObject geometry = new JSONObject(rawGeometry);
        assertTrue("Invalid observed input geometry: " + id, geometry.getBoolean("finite"));
        assertTrue("Input must be fully inside the visual viewport: " + id, geometry.getBoolean("visible"));
        assertTrue("Input center must be unobscured: " + id, geometry.getBoolean("hit"));
        double cssX = geometry.getDouble("x"), cssY = geometry.getDouble("y");
        double cssWidth = geometry.getDouble("width"), cssHeight = geometry.getDouble("height");
        double offsetLeft = geometry.getDouble("offsetLeft"), offsetTop = geometry.getDouble("offsetTop");
        double pixelsPerCssPixel = geometry.getDouble("scale") * geometry.getDouble("ratio");
        assertTrue("Invalid visual-to-native scale", Double.isFinite(pixelsPerCssPixel) && pixelsPerCssPixel > 0);
        // A real touch activates Android's editor connection; a JS click can focus only the DOM.
        // DOM rectangles and hit testing use layout CSS coordinates; native touch uses the visual viewport.
        return view -> {
                int[] location = new int[2];
                view.getLocationOnScreen(location);
                float localX = (float) ((cssX - offsetLeft) * pixelsPerCssPixel);
                float localY = (float) ((cssY - offsetTop) * pixelsPerCssPixel);
                Rect visible = new Rect();
                boolean hasVisibleRect = view.getLocalVisibleRect(visible);
                int scrollX = view.getScrollX(), scrollY = view.getScrollY();
                // getLocalVisibleRect includes the View's own scroll; touch coordinates do not.
                visible.offset(-scrollX, -scrollY);
                String nativeGeometry = "id=" + id + ", width=" + view.getWidth() + ", height=" + view.getHeight() +
                    ", screenX=" + location[0] + ", screenY=" + location[1] + ", visible=" + visible.toShortString() +
                    ", scrollX=" + scrollX + ", scrollY=" + scrollY +
                    ", localX=" + localX + ", localY=" + localY;
                Log.i("ManagedInputGeometry", nativeGeometry);
                // Allow coordinate rounding; an IME may shrink the visual height without resizing the WebView.
                double tolerance = pixelsPerCssPixel + 1;
                if (!(Math.abs(cssWidth * pixelsPerCssPixel - view.getWidth()) <= tolerance
                    && cssHeight * pixelsPerCssPixel > 0 && cssHeight * pixelsPerCssPixel <= view.getHeight() + tolerance))
                    throw new PerformException.Builder().withActionDescription("touch input: " + id)
                        .withViewDescription("Managed fixture WebView: " + nativeGeometry)
                        .withCause(new IllegalStateException("Visual viewport does not match native bounds")).build();
                if (!(Float.isFinite(localX) && Float.isFinite(localY) && hasVisibleRect
                    && visible.contains(Math.round(localX), Math.round(localY))))
                    throw new PerformException.Builder().withActionDescription("touch input: " + id)
                        .withViewDescription("Managed fixture WebView: " + nativeGeometry)
                        .withCause(new IllegalStateException("Input touch is outside the visible WebView")).build();
                return new float[] { location[0] + localX, location[1] + localY };
            };
    }

    private void awaitNativeEditor(String id) {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "wait for native input connection: " + id; }
            @Override public void perform(UiController uiController, View view) {
                long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
                String diagnostic;
                do {
                    boolean inputConnection = supportsInputMethods().matches(view);
                    boolean ready = view.hasFocus() && view.hasWindowFocus() && inputConnection;
                    diagnostic = "id=" + id + ", focus=" + view.hasFocus() + ", windowFocus=" +
                        view.hasWindowFocus() + ", inputConnection=" + inputConnection;
                    if (ready) {
                        Log.i("ManagedInput", diagnostic);
                        return;
                    }
                    long remaining = deadline - SystemClock.uptimeMillis();
                    if (remaining <= 0) break;
                    uiController.loopMainThreadForAtLeast(Math.min(50, remaining));
                } while (SystemClock.uptimeMillis() < deadline);
                throw new PerformException.Builder().withActionDescription(getDescription())
                    .withViewDescription("Managed fixture WebView: " + diagnostic)
                    .withCause(new IllegalStateException("Native editor was not ready"))
                    .build();
            }
        });
    }

    private void commitNativeText(String text) {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "commit invented text through native IME"; }
            @Override public void perform(UiController controller, View view) {
                assertTrue(view.hasFocus() && view.hasWindowFocus());
                android.view.inputmethod.InputConnection input = ((WebView) view).onCreateInputConnection(
                    new android.view.inputmethod.EditorInfo());
                assertNotNull("The actual WebView editor must supply a native connection", input);
                assertTrue("Native IME commit must dispatch", input.commitText(text, 1));
                controller.loopMainThreadUntilIdle();
            }
        });
    }

    private void observeImeAnimations(MainActivity activity) {
        View decor = activity.getWindow().getDecorView();
        observedImeLifecycle = activity.getLifecycle();
        observedImeDecor = decor;
        imeAnimations.clear();
        decor.setWindowInsetsAnimationCallback(new WindowInsetsAnimation.Callback(
                WindowInsetsAnimation.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
            @Override public void onPrepare(WindowInsetsAnimation animation) {
                if (observedImeDecor == decor && (animation.getTypeMask() & WindowInsets.Type.ime()) != 0)
                    imeAnimations.add(animation);
            }
            @Override public WindowInsets onProgress(WindowInsets insets, List<WindowInsetsAnimation> running) {
                return insets;
            }
            @Override public void onEnd(WindowInsetsAnimation animation) {
                if (observedImeDecor == decor) imeAnimations.remove(animation);
            }
        });
    }

    private void closeSoftKeyboard() {
        androidx.test.espresso.Espresso.closeSoftKeyboard();
        awaitHiddenIme();
    }

    private boolean hasHiddenIme(View view) {
        WindowInsets insets = view.getRootWindowInsets();
        return insets != null && !insets.isVisible(WindowInsets.Type.ime());
    }

    private void awaitHiddenIme() {
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            @Override public Matcher<View> getConstraints() { return isDisplayed(); }
            @Override public String getDescription() { return "wait for hidden, settled native IME"; }
            @Override public void perform(UiController uiController, View view) {
                assertSame("IME observer belongs to this Activity window", observedImeDecor, view.getRootView());
                long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
                String diagnostic;
                do {
                    boolean hidden = hasHiddenIme(view);
                    boolean focused = view.hasWindowFocus();
                    boolean resumed = observedImeLifecycle.getCurrentState() == Lifecycle.State.RESUMED;
                    diagnostic = "hidden=" + hidden + ", animations=" + imeAnimations.size() +
                        ", windowFocus=" + focused + ", resumed=" + resumed;
                    boolean imeSettled = hidden && imeAnimations.isEmpty();
                    boolean activityReady = focused && resumed;
                    if (imeSettled && activityReady) {
                        Log.i("ManagedIme", diagnostic);
                        return;
                    }
                    long remaining = deadline - SystemClock.uptimeMillis();
                    if (remaining <= 0) break;
                    uiController.loopMainThreadForAtLeast(Math.min(50, remaining));
                } while (SystemClock.uptimeMillis() < deadline);
                throw new PerformException.Builder().withActionDescription(getDescription())
                    .withViewDescription("Managed fixture IME: " + diagnostic)
                    .withCause(new IllegalStateException("Native IME did not settle")).build();
            }
        });
    }

    private void awaitPage(String description, String predicate) throws Exception {
        awaitPage(description, predicate, false);
    }

    private void awaitPage(String description, String predicate, boolean requireNativeReady) throws Exception {
        awaitPage(description, predicate, requireNativeReady, null);
    }

    private void awaitPage(String description, String predicate, boolean requireNativeReady, View dismissedDialog) throws Exception {
        awaitPage(description, predicate, requireNativeReady, dismissedDialog, PAGE_TIMEOUT_MS);
    }

    private void awaitPage(String description, String predicate, boolean requireNativeReady, View dismissedDialog, long timeoutMs) throws Exception {
        long deadline = SystemClock.uptimeMillis() + timeoutMs;
        int missedCallbacks = 0;
        AtomicReference<String> nativeState = new AtomicReference<>("not checked");
        while (SystemClock.uptimeMillis() < deadline) {
            if (dismissedDialog != null) {
                long remainingIdle = deadline - SystemClock.uptimeMillis();
                if (remainingIdle <= 0) break;
                try {
                    // Observe public accessibility quiescence within this same deadline.
                    // It does not establish that every compositor dim layer has retired.
                    InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(50, remainingIdle);
                } catch (java.util.concurrent.TimeoutException timeout) {
                    nativeState.set("accessibility did not become idle before the page deadline");
                    break;
                }
            }
            CountDownLatch returned = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                if (requireNativeReady && !nativePageReady(activity, webView, nativeState, dismissedDialog)) {
                    returned.countDown();
                    return;
                }
                webView.evaluateJavascript("Boolean(" + predicate + ")", value -> {
                    if (SystemClock.uptimeMillis() < deadline && (!requireNativeReady ||
                        nativePageReady(activity, webView, nativeState, dismissedDialog))) result.set(value);
                    returned.countDown();
                });
            });
            long remaining = deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) break;
            // A loading WebView can miss a callback; keep the same overall page deadline.
            if (!returned.await(Math.min(2_000, remaining), TimeUnit.MILLISECONDS)) {
                missedCallbacks++;
                continue;
            }
            if ("true".equals(result.get()) && SystemClock.uptimeMillis() < deadline) return;
            if (dismissedDialog == null) Thread.sleep(50);
        }
        String diagnostic = "missed callbacks=" + missedCallbacks +
            (requireNativeReady ? "; native=" + nativeState.get() +
                "; activeWindow=" + NativeReadinessFailureObservation.capture() : "") + "; " + pageDiagnostic();
        Log.e("ManagedFixture", "Timed out waiting for " + description + ": " + diagnostic);
        fail("Timed out waiting for " + description + ": " + diagnostic);
    }

    private boolean nativePageReady(MainActivity activity, WebView webView,
            AtomicReference<String> diagnostic, View dismissedDialog) {
        boolean ready = fixtureNativeReady(activity, webView, diagnostic);
        if (dismissedDialog == null) return ready;
        boolean attached = dismissedDialog.isAttachedToWindow();
        boolean shown = dismissedDialog.isShown();
        diagnostic.set(diagnostic.get() + ", selectedDialogAttached=" + attached + ", selectedDialogShown=" + shown);
        return ready && !attached && !shown;
    }

    private boolean fixtureNativeReady(MainActivity activity, WebView webView, AtomicReference<String> diagnostic) {
        Lifecycle.State state = activity.getLifecycle().getCurrentState();
        boolean attached = webView.isAttachedToWindow();
        boolean shown = webView.isShown();
        boolean hardware = webView.isHardwareAccelerated();
        boolean activityFocused = activity.hasWindowFocus();
        boolean webViewFocused = webView.hasWindowFocus();
        boolean focused = activityFocused && webViewFocused;
        boolean callbacks = activity.getOnBackPressedDispatcher().hasEnabledCallbacks();
        diagnostic.set("state=" + state + ", attached=" + attached + ", shown=" + shown +
            ", hardware=" + hardware + ", activityFocused=" + activityFocused +
            ", webViewFocused=" + webViewFocused + ", focused=" + focused + ", callbacks=" + callbacks);
        return state == Lifecycle.State.RESUMED && attached && shown && hardware && focused && callbacks;
    }
}
