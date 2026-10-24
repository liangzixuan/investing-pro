package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static org.junit.Assert.*;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real formatter, adapter, system chooser and chosen output; all ledger/source data is invented. */
@RunWith(AndroidJUnit4.class)
public class PortfolioReviewReportInstrumentedTest {
    private static final long PAGE_TIMEOUT_MS = 10_000;
    private static final String D = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String WATCHLIST = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String PORTFOLIO = "JSON.parse(document.querySelector('#fixture-portfolio-state').textContent)";
    private static final String LEDGER = "JSON.parse(document.querySelector('#fixture-portfolio-draft').textContent)";
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-portfolio-report').textContent)";
    private static final String CLOSE = "section[aria-label='Dated Portfolio holdings review']";
    private static final String REPORT = ".managed-portfolio-review-report";
    private static final String CAPTURE = "article[aria-label='Captured Portfolio holdings review']";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;

    @Before public void launchInventedPortfolioReport() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.PORTFOLIO_REVIEW_REPORT);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertNotNull(activity.getBridge().getPlugin("InvestmentPortfolioReviewReport"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new ReportRevisitPage.Check("source-bound report fixture starts with no implicit reads", new ReportRevisitPage.Script("document.querySelector('#fixture-portfolio-report')!==null && " + D + ".load===1 && " + D + ".status===1 && " + D + ".eod===0 && document.querySelector('#managed-note-0')?.disabled===false")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        WatchlistTestDocuments.clear(context());
    }

    @Test public void portfolioReportSystemPickerKeepsExactValuesSourcesAndSeparateSaveThroughBack() throws Exception {
        String origin = read("String(performance.timeOrigin)");
        String watchlist = read("JSON.stringify(" + WATCHLIST + ")");
        String ledger = loadAndAuthorLedger();
        openClosesAndCapture();
        String currentDate = read("document.querySelector('#managed-portfolio-close-date').value");
        String previousDate = read("document.querySelector('#managed-portfolio-close-date').options[1].value");
        String archive = read("document.querySelector(\"" + CAPTURE + " pre\").textContent");
        assertCaptureLedger(archive, ledger);
        reportButton("Save report (HTML)");
        WatchlistSystemPicker picker = new WatchlistSystemPicker();
        picker.awaitOpen(30_000);
        picker.cancel();
        await("system Cancel retains capture and both complete drafts", FILE + ".choices===1 && " + FILE + ".writes===0 && document.querySelector(\"" + REPORT + " [role=status]\")?.textContent.includes('cancelled') && document.querySelector(\"" + CAPTURE + "\")!==null");
        assertEquals(0, WatchlistTestDocuments.outputs(context()).length);
        assertUnchanged(ledger, watchlist);
        reportButton("Save report (HTML)");
        new WatchlistSystemPicker().saveToInventedRoot();
        await("real native writer confirms one complete HTML write", FILE + ".choices===2 && " + FILE + ".writes===1 && document.querySelector(\"" + REPORT + " [role=status]\")?.textContent==='Portfolio report written to the chosen document.'");
        inspectWrittenReport(archive);
        assertUnchanged(ledger, watchlist);
        invalidateAndReturnFromResearch(currentDate, previousDate, ledger, watchlist);
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-review"));
        await("Portfolio still requires separate complete review before Save", "document.querySelector('.managed-portfolio-review')!==null && " + PORTFOLIO + ".save===0");
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-save"));
        await("only explicit Portfolio Save commits the authored ledger", PORTFOLIO + ".save===1 && " + PORTFOLIO + ".commits===1 && " + LEDGER + ".dirty===false && " + D + ".save===0 && " + D + ".eod===1 && JSON.stringify(" + WATCHLIST + ")===" + JSONObject.quote(watchlist));
        assertEquals("Report capture, file save and native Back retain the mounted document", origin, read("String(performance.timeOrigin)"));
    }

    private String loadAndAuthorLedger() throws Exception {
        page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Portfolio']"));
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-load"));
        await("explicit Portfolio Load admits the empty real model", PORTFOLIO + ".load===1 && " + LEDGER + ".baseVersion===0 && " + LEDGER + ".ledger===null");
        page.click(ReportRevisitPage.Element.css("#fixture-portfolio-report-author"));
        await("explicit invented setup admits opening holding, buy and sell without Save or sources", LEDGER + ".ledger?.opening.holdings.length===1 && " + LEDGER + ".ledger.transactions.map(x=>x.type).join('|')==='buy|sell' && " + LEDGER + ".dirty===true && " + PORTFOLIO + ".save===0 && " + D + ".eod===0");
        page.click(ReportRevisitPage.Element.css("#managed-portfolio-review-identities"));
        await("the complete current identity resolves only on explicit review", D + ".resolve===1 && [...document.querySelectorAll('.managed-portfolio button')].some(e=>e.textContent==='Apply reviewed identities' && !e.disabled)");
        page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-portfolio')]//button[normalize-space(.)='Apply reviewed identities']"));
        await("catalog approval retains the complete local ledger", "document.querySelector('.managed-portfolio [role=status]')?.textContent.includes('Portfolio identities reviewed') && " + PORTFOLIO + ".save===0");
        return read("JSON.stringify(" + LEDGER + ".ledger)");
    }

    private void openClosesAndCapture() throws Exception {
        page.click(ReportRevisitPage.Element.css(".managed-portfolio-close-review > summary"));
        await("disclosure opening makes no source read", D + ".eod===0 && document.querySelector(\"" + CLOSE + " .ledger-actions button\")?.disabled===false");
        page.click(ReportRevisitPage.Element.css(CLOSE + " .ledger-actions button:first-child"));
        await("one explicit raw-close request prices exactly two shares plus authored cash", D + ".eod===1 && document.querySelector(\"" + CLOSE + "\").textContent.includes('USD 220.50') && document.querySelector(\"" + CLOSE + "\").textContent.includes('USD 1168.50')");
        reportButton("Capture holdings report");
        await("complete capture shows values, opening pool and ordered buy/sell", "(() => {const a=document.querySelector(\"" + CAPTURE + "\");return a && ['USD 220.50','USD 948.00','USD 1168.50','1000.00','50.00','201.00','invented-report-buy','invented-report-sell','Tiingo','raw_close','Request started','Completed','Complete authored ledger','Complete report document and source packets'].every(x=>a.textContent.includes(x));})()");
        assertNarrowReport();
        retainScreenshot("portfolioReviewReportCaptured");
    }

    private void assertCaptureLedger(String archive, String ledger) throws Exception {
        JSONObject report = new JSONObject(archive);
        assertEquals(new JSONObject(ledger).toString(), report.getJSONObject("ledger").toString());
        assertEquals("220.50", report.getJSONObject("review").getString("holdingsValueUsd"));
        assertEquals("948.00", report.getJSONObject("review").getString("cashUsd"));
        assertEquals("1168.50", report.getJSONObject("review").getString("totalValueUsd"));
        JSONObject response = report.getJSONArray("sourceRows").getJSONObject(0).getJSONObject("response");
        assertEquals("Tiingo", response.getString("provider"));
        assertEquals("raw_close", response.getString("priceBasis"));
        assertEquals("USD", response.getString("currency"));
        assertNotEquals(report.getString("preparedAt"), response.getString("requestStartedAt"));
        assertTrue(response.getString("completedAt").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z"));
        assertEquals(2, response.getJSONArray("rows").length());
    }

    private void inspectWrittenReport(String archive) throws Exception {
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context());
        assertEquals(1, outputs.length);
        WatchlistTestDocuments.Output output = outputs[0];
        assertTrue(output.name.matches("Investment-portfolio-review-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals(read(FILE + ".filename"), output.name);
        assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY, output.uri.getAuthority());
        byte[] bytes;
        try (InputStream input = context().getContentResolver().openInputStream(output.uri)) {
            assertNotNull("Actual chosen URI grant remains readable", input);
            bytes = input.readNBytes(InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES + 1);
        }
        assertTrue(bytes.length > 0 && bytes.length <= InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES);
        assertEquals(output.size, bytes.length);
        assertEquals(Integer.parseInt(read("String(" + FILE + ".byteLength)")), bytes.length);
        String html = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(PortfolioReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name, html));
        assertTrue(html.contains("Zero &lt;script&gt;alert(1)&lt;/script&gt; &amp; Company"));
        assertFalse(html.contains("<script>"));
        assertTrue(html.contains("USD 220.50") && html.contains("USD 948.00") && html.contains("USD 1168.50"));
        assertTrue(html.contains("Complete authored ledger") && html.contains("Complete report document and source packets"));
        // The formatter's detached DOM serializes text nodes with these exact HTML escapes.
        assertTrue("Every captured ledger, raw packet and original clock survives the actual written appendix", html.contains(archive.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")));
    }

    private void invalidateAndReturnFromResearch(String current, String previous, String ledger, String watchlist) throws Exception {
        reportButton("Close captured report");
        await("explicit close removes private preview", "document.querySelector(\"" + CAPTURE + "\")===null && " + FILE + ".writes===1");
        reportButton("Capture holdings report");
        selectDate(previous);
        await("changing selected observed date withdraws the previous capture and save control", "document.querySelector(\"" + CAPTURE + "\")===null && ![...document.querySelectorAll(\"" + REPORT + " button\")].some(e=>e.textContent==='Save report (HTML)') && " + FILE + ".choices===2");
        selectDate(current);
        reportButton("Capture holdings report");
        await("fresh capture after a date change needs no additional source request", "document.querySelector(\"" + CAPTURE + "\")!==null && " + D + ".eod===1");
        page.click(ReportRevisitPage.Element.css(CLOSE + " tbody button"));
        await("exact Research route opens the registered listing without reading sources", "document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO' && new URL(location.href).searchParams.get('company')==='listing-zero' && new URL(location.href).searchParams.get('section')==='price' && " + D + ".eod===1 && " + D + ".annual===0 && " + D + ".filings===0");
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        page.await(new ReportRevisitPage.Check("native Back restores Portfolio with private captures closed", new ReportRevisitPage.Script("document.querySelector('.managed-company-visit')===null && document.querySelector('.managed-portfolio-close-review')?.open===false && document.querySelector(\"" + CAPTURE + "\")===null")).nativeReady());
        assertUnchanged(ledger, watchlist);
    }

    private void assertUnchanged(String ledger, String watchlist) throws Exception {
        await("whole ledgers and independent Watchlist remain unchanged without implicit requests or saves", "JSON.stringify(" + LEDGER + ".ledger)===" + JSONObject.quote(ledger) + " && JSON.stringify(" + WATCHLIST + ")===" + JSONObject.quote(watchlist) + " && " + PORTFOLIO + ".save===0 && " + D + ".save===0 && " + D + ".eod===1 && " + D + ".annual===0 && " + D + ".filings===0 && " + D + ".token===0 && " + D + ".signOut===0 && " + FILE + ".choices<=2");
    }
    private void assertNarrowReport() throws Exception {
        await("report values and labelled controls fit the 412 CSS pixel native frame", "(() => {const a=document.querySelector(\"" + CAPTURE + "\"),s=document.querySelector('#managed-portfolio-close-date'),w=document.documentElement.clientWidth;return w===412 && document.documentElement.scrollWidth<=w+1 && s.labels.length===1 && [s,...document.querySelectorAll(\"" + REPORT + " button\")].every(e=>{const r=e.getBoundingClientRect();return r.height>=44 && r.left>=0 && r.right<=w+1;}) && a.querySelector('script')===null && a.textContent.includes('Zero <script>alert(1)</script> & Company');})()");
    }
    private void reportButton(String label) { page.click(ReportRevisitPage.Element.xpath("//section[contains(@class,'managed-portfolio-review-report')]//button[normalize-space(.)='" + label + "']")); }
    private void await(String message, String predicate) throws Exception { page.await(new ReportRevisitPage.Check(message, new ReportRevisitPage.Script(predicate))); }
    private String read(String expression) throws Exception { return page.read(new ReportRevisitPage.Script(expression)); }
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }

    private void selectDate(String date) throws Exception {
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            assertTrue("Date select WebView accepts native focus", webView.requestFocus());
        });
        assertEquals("managed-portfolio-close-date", read("(() => {const s=document.querySelector('#managed-portfolio-close-date');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return s.id;})()"));
        page.await(new ReportRevisitPage.Check("exact enabled observed-date select retains focus", new ReportRevisitPage.Script("document.activeElement===document.querySelector('#managed-portfolio-close-date') && document.activeElement.disabled===false && [...document.activeElement.options].some(o=>o.value===" + JSONObject.quote(date) + " && !o.disabled)")).nativeReady());
        onView(isAssignableFrom(WebView.class)).check((view, missing) -> {
            if (missing != null) throw missing;
            assertTrue(view.hasFocus() && view.hasWindowFocus());
        }).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(date)).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); })
            .perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull("Observed native date dialog", dialog.get());
        page.await(new ReportRevisitPage.Check("native selected date applies and exact dialog disappears", new ReportRevisitPage.Script("document.querySelector('#managed-portfolio-close-date').value===" + JSONObject.quote(date)), ReportRevisitPage.Readiness.NATIVE, dialog.get()));
    }

    private void retainScreenshot(String name) throws Exception {
        String configured = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
        File output = configured == null
            ? new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalCacheDir(), "instrumentation-screenshots")
            : new File(configured);
        assertTrue(output.isDirectory() || output.mkdirs());
        Bitmap screenshot = captureCommittedWindow(name);
        try (FileOutputStream stream = new FileOutputStream(new File(output, name + ".png"))) {
            assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, stream));
        } finally {
            screenshot.recycle();
        }
    }

    /** DOM readiness, a submitted hardware frame, then one copy of that window's latest buffer. */
    private Bitmap captureCommittedWindow(String name) throws Exception {
        long deadline = SystemClock.uptimeMillis() + PAGE_TIMEOUT_MS;
        Handler main = new Handler(Looper.getMainLooper());
        CompletableFuture<Bitmap> captured = new CompletableFuture<>();
        AtomicReference<String> phase = new AtomicReference<>("visual-state");
        AtomicReference<ViewTreeObserver> observer = new AtomicReference<>();
        AtomicReference<Runnable> frameCallback = new AtomicReference<>();
        try {
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                Window window = activity.getWindow();
                assertTrue("Screenshot needs an attached visible hardware WebView",
                    webView.isAttachedToWindow() && webView.isShown() && webView.isHardwareAccelerated());
                webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) {
                        if (captured.isDone() || SystemClock.uptimeMillis() >= deadline) return;
                        phase.set("frame-commit");
                        Runnable committed = () -> main.post(() -> {
                            if (captured.isDone() || SystemClock.uptimeMillis() >= deadline) return;
                            phase.set("pixel-copy");
                            View decor = window.peekDecorView();
                            int width = decor == null ? 0 : decor.getWidth();
                            int height = decor == null ? 0 : decor.getHeight();
                            if (width <= 0 || height <= 0 || (long) width * height > 16_777_216) {
                                captured.completeExceptionally(new IOException("Invalid screenshot window dimensions"));
                                return;
                            }
                            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                            try {
                                PixelCopy.request(window, bitmap, result -> {
                                    if (result != PixelCopy.SUCCESS) {
                                        bitmap.recycle();
                                        captured.completeExceptionally(new IOException("PixelCopy result=" + result));
                                    } else {
                                        // A timed-out caller never owns a still-running copy's bitmap.
                                        if (captured.complete(bitmap))
                                            android.util.Log.i("ManagedScreenshot", "name=" + name + ", visualReady=true, frameCommitted=true, pixelCopy=SUCCESS, width=" + width + ", height=" + height);
                                        else bitmap.recycle();
                                    }
                                }, main);
                            } catch (RuntimeException error) {
                                bitmap.recycle();
                                captured.completeExceptionally(error);
                            }
                        });
                        ViewTreeObserver current = webView.getViewTreeObserver();
                        observer.set(current);
                        frameCallback.set(committed);
                        current.registerFrameCommitCallback(committed);
                        // The next draw after visual completion includes the already-asserted DOM.
                        webView.invalidate();
                    }
                });
            });
            long remaining = deadline - SystemClock.uptimeMillis();
            if (remaining <= 0) throw new IOException("Screenshot deadline expired before waiting");
            return captured.get(remaining, TimeUnit.MILLISECONDS);
        } catch (Exception error) {
            if (!captured.cancel(false) && !captured.isCompletedExceptionally()) {
                Bitmap completed = captured.getNow(null);
                if (completed != null) completed.recycle();
            }
            throw new IOException("Screenshot did not complete: " + name + ", phase=" + phase.get(), error);
        } finally {
            main.post(() -> {
                ViewTreeObserver current = observer.get();
                Runnable callback = frameCallback.get();
                if (current != null && current.isAlive() && callback != null)
                    current.unregisterFrameCommitCallback(callback);
            });
        }
    }

    @After public void closeInventedPortfolioReport() throws Exception {
        try {
            if (scenario != null) { scenario.close(); scenario = null; }
        } finally {
            WatchlistTestDocuments.clear(context());
            if (assets != null) assets.close();
        }
    }
}
