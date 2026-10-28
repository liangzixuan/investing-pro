package local.investment.personal;

import static androidx.test.espresso.Espresso.*;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.*;
import static org.junit.Assert.*;

import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** One explicit source-to-authored-model journey with separate raw-input and Watchlist saves. */
@RunWith(AndroidJUnit4.class)
public class AnnualRevenueModelBasisInstrumentedTest {
    private static final String EXPECTED = AnnualRevenueModelBasisExpectations.NOTE;
    private static final String ANNUAL = "button[aria-label='Annual report for saved ZERO']";
    private static final String DRAFT = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    private static final String DIAGNOSTICS = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final long PAGE_TIMEOUT_MS = 10_000;
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private String expectedSourceSha;

    @Before public void launchRevenueBasisFixture() throws Exception {
        assertFalse("Test assets must run in the disconnected profile", BuildConfig.CLERK_AUTH_ENABLED);
        expectedSourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull("Pass the actual bundled source SHA", expectedSourceSha);
        assertTrue(expectedSourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.ANNUAL_REVENUE_MODEL_BASIS);
        assets.prepare();
        scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario);
        keyboard = new ReportRevisitKeyboard(page, new ReportRevisitTouch(page));
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull("No native authentication in this fixture", activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity);
            activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new ReportRevisitPage.Check("source-bound fixture starts without source reads or writes", new ReportRevisitPage.Script(DIAGNOSTICS+".load===1&&"+DIAGNOSTICS+".status===1&&"+DIAGNOSTICS+".annual===0&&"+DIAGNOSTICS+".save===0&&document.querySelector('#fixture-saved-valuation-store')!==null")).nativeReady());
        assertFixtureBoundary(0);
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
    }
    @Test public void annualRevenueBasisKeepsAuthoredInputsCitationReportBackAndSeparateSaves() throws Exception {
        double origin = readDocumentTimeOrigin();
        String before = openAndAuthor();
        loadAndPreview(before);
        applyAndCalculate(before);
        appendCitedNote();
        captureAnnualRevenueModelReport(EXPECTED);
        saveAnnualRevenueModelInputs();
        returnAndSaveWatchlist();
        freshReadInputs();
        assertEquals("one mounted native document owns the whole source/model/note/save journey", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(1);
    }
    private String openAndAuthor() throws Exception {
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", AnnualRevenueModelBasisExpectations.PREFIX);
        click(ANNUAL);
        awaitPage("exact company opens without a source, calculation or saved-input read", savedValuationEditor() + ".editable===true && " + DIAGNOSTICS + ".annual===0 && " + savedValuationStore() + ".counts.load===0");
        click(".managed-valuation-workbench:not(.managed-valuation-assumptions) > summary");
        click(".managed-valuation-revenue-basis > summary");
        awaitPage("reported revenue remains a manual named choice with no default or inferred DCF", "(()=>{const s=document.querySelector('.managed-valuation-revenue-basis select');return s?.value===''&&s.disabled===false&&s.options.length===4&&s.options[0].value===''&&s.options[1].value==='Revenues'&&s.options[2].value==='RevenueFromContractWithCustomerExcludingAssessedTax'&&s.options[3].value==='SalesRevenueNet'&&document.querySelector('.managed-valuation-revenue-basis > button')?.disabled===true&&" + savedValuationEditor() + ".dcfDraft.startingUnleveredCashFlowUsd===''&&" + savedValuationEditor() + ".calculation===null&&" + DIAGNOSTICS + ".annual===0;})()");
        authorAnnualRevenueModelInputs();
        String before = readFixtureString("JSON.stringify(" + savedValuationEditor() + ")");
        return before;
    }

    private void loadAndPreview(String before) throws Exception {
        click(".managed-annual-report .trial-actions button:first-child");
        awaitPage("one explicit Annual read keeps its original completion clock without changing authored maps", "document.querySelector('.managed-annual-report')?.textContent.includes('2026-09-20T00:00:02.000Z')&&" + DIAGNOSTICS + ".annual===1&&JSON.stringify(" + savedValuationEditor() + ")===" + JSONObject.quote(before));
        chooseNativeSelectOption(".managed-valuation-revenue-basis select", "Revenues", "Revenue");
        awaitPage("selected source exposes exact USD, fiscal dates, filing identity and independent original clocks", AnnualRevenueModelBasisExpectations.sourceExact() + "&&JSON.stringify(" + savedValuationEditor() + ")===" + JSONObject.quote(before));
        retainAnnualNoteFrame("annualRevenueModelSelectedSource", "[aria-label='Selected reported revenue source'] > p:nth-child(2)", "[aria-label='Selected reported revenue source'] > p:nth-child(2)", 1);
        click(".managed-valuation-revenue-basis > button");
        awaitPage("full current and proposed raw maps precede the single-field application", "(()=>{const p=document.querySelector('[aria-label=\"Complete starting revenue change preview\"]');return p?.textContent.includes(" + JSONObject.quote(AnnualRevenueModelBasisExpectations.CITATION) + ")&&p.querySelector('[aria-label=\"Current complete valuation inputs\"]')?.textContent.includes('1000.00')&&p.querySelector('[aria-label=\"Proposed complete valuation inputs\"]')?.textContent.includes('1000')&&p.querySelectorAll('[aria-label=\"Current complete valuation inputs\"] .managed-valuation-raw').length===p.querySelectorAll('[aria-label=\"Proposed complete valuation inputs\"] .managed-valuation-raw').length&&p.querySelector('button')?.disabled===false&&JSON.stringify(" + savedValuationEditor() + ")===" + JSONObject.quote(before) + "&&" + DIAGNOSTICS + ".annual===1&&" + DIAGNOSTICS + ".save===0&&" + savedValuationStore() + ".counts.save===0;})()");
        awaitPage("both complete preview columns retain every exact raw operand and full company identity", AnnualRevenueModelBasisExpectations.previewMapsExact(before, savedValuationStore()));
        retainAnnualNoteFrame("annualRevenueModelCompleteChangeHeading", "[aria-label='Complete starting revenue change preview'] > h4", "[aria-label='Complete starting revenue change preview'] > h4", 1);
    }

    private void applyAndCalculate(String before) throws Exception {
        click("[aria-label='Complete starting revenue change preview'] > button");
        awaitPage("Apply changes only starting revenue and leaves both authored calculations unrun", AnnualRevenueModelBasisExpectations.onlyRevenueChanged(before, savedValuationEditor()) + "&&document.querySelector('[aria-label=\"Applied Annual revenue reference\"]')?.textContent.includes(" + JSONObject.quote(AnnualRevenueModelBasisExpectations.CITATION) + ")&&document.querySelector('[aria-label=\"Complete starting revenue change preview\"]')===null&&" + DIAGNOSTICS + ".annual===1&&" + DIAGNOSTICS + ".save===0&&" + savedValuationStore() + ".counts.load===0");
        onWebView().withElement(findElement(Locator.XPATH, "//details[contains(@class,'managed-valuation-workbench')]/button[normalize-space(.)='Calculate authored scenarios']")).perform(webClick());
        awaitPage("only explicit Calculate creates both authored model results", savedValuationEditor() + ".calculation?.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&" + savedValuationEditor() + ".calculation?.exitResult.scenarios.base.valuePerShare==='19.00'");
    }

    private void appendCitedNote() throws Exception {
        click(".managed-valuation-note > summary");
        chooseNativeSelectOption(".managed-valuation-note select[id$='-note-model']", "exit", "Exit multiple");
        awaitPage("dated Price remains an unselected independent unavailable option", "document.querySelector('.managed-valuation-price-opt-in input')?.checked===false&&document.querySelector('.managed-valuation-price-opt-in input')?.disabled===true&&" + DIAGNOSTICS + ".eod===0");
        click(".managed-valuation-note > button");
        awaitPage("complete Exit note includes every authored operand, exact result and qualified original Annual citation", "document.querySelector('.managed-valuation-note > .managed-valuation-note-preview .trial-saved-note')?.textContent===" + JSONObject.quote(EXPECTED) + "&&document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(AnnualRevenueModelBasisExpectations.PREFIX) + "&&" + DIAGNOSTICS + ".save===0");
        click(".managed-valuation-note > .managed-valuation-note-preview > button");
        awaitPage("Append changes the complete unsaved note only", "document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(EXPECTED) + "&&" + DRAFT + ".dirty===true&&" + DIAGNOSTICS + ".save===0&&" + savedValuationStore() + ".counts.save===0");
    }

    private void returnAndSaveWatchlist() throws Exception {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        awaitPage("hardware Back retains the whole cited draft and independently saved raw model inputs", "document.querySelector('.managed-company-visit')===null&&" + DRAFT + ".memberships[0].note===" + JSONObject.quote(EXPECTED) + "&&" + DRAFT + ".memberships[1].note==='Invented second note'&&" + DRAFT + ".dirty===true&&" + savedValuationResource() + ".saved.version===1&&" + DIAGNOSTICS + ".save===0");
        click("#managed-unsaved-review > summary");
        awaitPage("whole Watchlist Review exposes the complete cited note before its independent Save", "document.querySelector('#managed-unsaved-review')?.textContent.includes(" + JSONObject.quote(EXPECTED) + ")&&" + DIAGNOSTICS + ".save===0");
        clickWatchlistAction("Save watchlist");
        awaitPage("only explicit Watchlist Save acknowledges the second version", DRAFT + ".baseVersion===2&&" + DRAFT + ".dirty===false&&" + DIAGNOSTICS + ".save===1&&" + savedValuationStore() + ".counts.save===1");
        clickWatchlistAction("Load saved watchlist");
        awaitPage("fresh Watchlist read preserves every exact membership and full citation", DRAFT + ".memberships[0].note===" + JSONObject.quote(EXPECTED) + "&&" + DRAFT + ".memberships[1].note==='Invented second note'&&" + DRAFT + ".memberships.length===2&&" + DIAGNOSTICS + ".load===2");
    }

    private void freshReadInputs() throws Exception {
        selectWatchlistNote(0);
        click(ANNUAL);
        click(".managed-valuation-workbench:not(.managed-valuation-assumptions) > summary");
        click(".managed-valuation-assumptions > summary");
        click("#managed-valuation-load");
        awaitPage("fresh saved-input read contains only the entire original authored maps with the chosen raw revenue", AnnualRevenueModelBasisExpectations.savedRawOnly(savedValuationStore(), savedValuationResource()) + "&&" + savedValuationStore() + ".counts.load===2&&" + savedValuationStore() + ".counts.save===1&&" + DIAGNOSTICS + ".annual===1&&" + DIAGNOSTICS + ".eod===0&&" + DIAGNOSTICS + ".filings===0&&" + DIAGNOSTICS + ".search===0&&" + DIAGNOSTICS + ".token===0&&" + DIAGNOSTICS + ".signOut===0");
    }

    private void authorAnnualRevenueModelInputs() throws Exception {
        String[][] fields = AnnualRevenueModelBasisExpectations.FIELDS;
        for (String[] field : fields) {
            String selector = ".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-" + field[0] + "']";
            awaitPage("exact blank labelled authored revenue model operand: " + field[0], "(()=>{const e=document.querySelector(" + JSONObject.quote(selector) + ");return e?.value===''&&!e.disabled&&[...document.querySelectorAll('label')].some(l=>l.htmlFor===e.id);})()");
            typeIntoInput(readFixtureString("document.querySelector(" + JSONObject.quote(selector) + ").id"), field[1]);
        }
        awaitPage("all initial authored raw operands remain exact before any source or calculation", "(()=>{const e=" + savedValuationEditor() + ",s=" + savedValuationStore() + ";return JSON.stringify(e.dcfDraft)===JSON.stringify(s.expected.dcf.inputs)&&JSON.stringify(e.exitDraft)===JSON.stringify({...s.expected.exit.inputs,baseRevenue:'1000.00'})&&e.calculation===null&&s.counts.load===0&&s.counts.save===0;})()");
    }

    private void captureAnnualRevenueModelReport(String expected) throws Exception {
        click(".managed-company-report > summary");
        prepareNativeCompanyReport(expected);
        click(".managed-report-document > summary");
        awaitPage("read-only schema6 report retains complete cited note, both raw maps and original Annual clocks", "(()=>{const f=document.querySelector('#managed-report-document');if(!f?.readOnly)return false;const d=JSON.parse(f.value),e=" + savedValuationEditor() + ";return d.schemaVersion==='6.0.0'&&d.authoredResearch.note===" + JSONObject.quote(expected) + "&&JSON.stringify(d.valuation.dcfDraft)===JSON.stringify(e.dcfDraft)&&JSON.stringify(d.valuation.exitDraft)===JSON.stringify(e.exitDraft)&&d.sources.annual.response.evidence.generation.completedAt==='2026-09-20T00:00:02.000Z'&&d.sources.price.status==='not_loaded'&&d.sources.filings.status==='not_loaded';})()");
        String document = readFixtureString("document.querySelector('#managed-report-document').value");
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(context);
        try {
            click(".managed-report-delivery button");
            WatchlistSystemPicker picker = new WatchlistSystemPicker();
            picker.awaitOpen(); picker.saveToInventedRoot();
            awaitPage("one actual chosen JSON report write settles without any resource Save", "JSON.parse(document.querySelector('#fixture-report-protocol').textContent).writesSettled===1&&" + DIAGNOSTICS + ".save===0&&" + savedValuationStore() + ".counts.save===0");
            WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
            assertEquals("one invented report destination", 1, outputs.length);
            assertEquals("application/json", context.getContentResolver().getType(outputs[0].uri));
            assertArrayEquals("chosen report bytes equal the complete captured document", document.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.readReport(context, outputs[0]));
        } finally { WatchlistTestDocuments.clear(context); }
    }

    private void saveAnnualRevenueModelInputs() throws Exception {
        click(".managed-valuation-assumptions > summary");
        click("#managed-valuation-load");
        awaitPage("saved inputs Load leaves the complete cited Watchlist note unsaved", savedValuationStore() + ".counts.load===1&&" + savedValuationResource() + ".baseVersion===0&&" + DIAGNOSTICS + ".save===0");
        click("#managed-valuation-stage-review");
        awaitPage("complete current raw-input staging review precedes Stage", "document.querySelector('[aria-label=\"Valuation staging review\"]')?.textContent.includes('authored-exit-multiple-v1')&&document.querySelector('#managed-valuation-stage')?.disabled===false&&" + savedValuationStore() + ".counts.save===0");
        click("#managed-valuation-stage");
        awaitPage("staging cannot save before the independent whole-resource Review", savedValuationResource() + ".draft.entries.length===1&&document.querySelector('#managed-valuation-save')?.disabled===true");
        click("#managed-valuation-review");
        awaitPage("whole saved-resource Review contains only raw authored maps", "document.querySelector('[aria-label=\"Complete valuation draft for Save\"]')?.textContent.includes('100.00')&&document.querySelector('#managed-valuation-save')?.disabled===false&&" + DIAGNOSTICS + ".save===0");
        click("#managed-valuation-save");
        awaitPage("only explicit model Save confirms raw maps without copying source payload or saving the Watchlist", AnnualRevenueModelBasisExpectations.savedRawOnly(savedValuationStore(), savedValuationResource()) + "&&" + savedValuationStore() + ".counts.save===1&&" + DIAGNOSTICS + ".save===0&&" + DRAFT + ".dirty===true");
    }


    private void prepareNativeCompanyReport(String note) throws Exception {
        click(".managed-company-report .trial-actions button:first-child");
        awaitPage("explicit preparation enables a full-size native Save control for the exact current note",
            "document.querySelector('#managed-prepared-report-heading')?.textContent === 'Research report · ZERO' && " +
            "document.querySelector('.managed-company-report-note')?.textContent === " + JSONObject.quote(note) + " && " +
            "document.querySelector('.managed-report-delivery button')?.textContent === 'Save report (JSON)' && " +
            "document.querySelector('.managed-report-delivery button')?.disabled === false && " +
            "document.querySelector('.managed-report-delivery button')?.getBoundingClientRect().height >= 44");
    }

    private void chooseNativeSelectOption(String selector, String optionValue, String label) throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> id = new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            assertTrue("Select WebView must accept focus", webView.requestFocus());
            webView.evaluateJavascript(
                "(() => { const select = document.querySelector(" + JSONObject.quote(selector) + ");" +
                " if (!(select instanceof HTMLSelectElement) || select.disabled || !select.id) return null;" +
                " select.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});" +
                " select.focus({preventScroll:true}); return select.id; })()",
                value -> { id.set(value); returned.countDown(); });
        });
        assertTrue("Native select id was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        assertNotNull(id.get());
        String actualId = new org.json.JSONArray("[" + id.get() + "]").getString(0);
        assertFalse("Native select must have its real labelled id", actualId.isEmpty());
        awaitPage("exact enabled native select has DOM focus",
            "(() => { const select = document.getElementById(" + JSONObject.quote(actualId) + ");" +
            " return select instanceof HTMLSelectElement && !select.disabled && document.activeElement === select" +
            " && select === document.querySelector(" + JSONObject.quote(selector) + ")" +
            " && [...select.options].some(option => option.value === " + JSONObject.quote(optionValue) + " && !option.disabled); })()");
        // F4 opens Chromium's picker on keydown without a printable key passing through the IME.
        onView(isAssignableFrom(WebView.class)).check((view, noViewFoundException) -> {
            if (noViewFoundException != null) throw noViewFoundException;
            assertTrue("Select WebView must have focus", view.hasFocus());
            assertTrue("Select window must have focus", view.hasWindowFocus());
        }).perform(pressKey(KeyEvent.KEYCODE_F4));
        // Wait for WebView's native dialog instead of searching the Activity root.
        AtomicReference<View> dialogDecor = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText(label))
            .inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view, noViewFoundException) -> {
                if (noViewFoundException != null) throw noViewFoundException;
                dialogDecor.set(view.getRootView());
            })
            .perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull("The selected native dialog decor must be observed", dialogDecor.get());
        awaitPage("native option selected and exact dialog dismissed",
            "document.getElementById(" + JSONObject.quote(actualId) + ")?.value === " + JSONObject.quote(optionValue),
            true, dialogDecor.get());
        closeSoftKeyboard();
    }

    private void retainAnnualNoteFrame(String name, String scrollSelector, String selectors, int count) throws Exception {
        CountDownLatch scrolled = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "document.querySelector(" + JSONObject.quote(scrollSelector) + ").scrollIntoView({block:'start',behavior:'instant'})",
            ignored -> scrolled.countDown()));
        assertTrue("Annual note frame did not scroll", scrolled.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        String visible = "(() => { const targets = Array.from(document.querySelectorAll(" + JSONObject.quote(selectors) + "));" +
            " const v = visualViewport; return v && targets.length === " + count + " && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        awaitPage("Annual note frame targets visible: " + name, visible);
        PortfolioReportFrameCapture.Frame frame = switch (name) {
            case "annualRevenueModelSelectedSource" -> PortfolioReportFrameCapture.Frame.ANNUAL_REVENUE_SOURCE;
            case "annualRevenueModelCompleteChangeHeading" -> PortfolioReportFrameCapture.Frame.ANNUAL_REVENUE_PREVIEW;
            default -> throw new IllegalArgumentException("Only the two declared revenue frames may be captured");
        };
        page.await(new ReportRevisitPage.Check("declared revenue frame has committed native focus", new ReportRevisitPage.Script(visible)).nativeReady());
        new PortfolioReportFrameCapture(new PortfolioReportFrameCapture.Request(scenario, frame)).retain();
        awaitPage("Annual note frame targets remained visible: " + name, visible);
    }

    private void awaitPage(String label, String expression) throws Exception { page.await(new ReportRevisitPage.Check(label, new ReportRevisitPage.Script(expression))); }
    private void awaitPage(String label, String expression, boolean nativeReady, View dialog) throws Exception {
        page.await(new ReportRevisitPage.Check(label, new ReportRevisitPage.Script(expression), nativeReady ? ReportRevisitPage.Readiness.NATIVE : ReportRevisitPage.Readiness.DOM, dialog));
    }
    private void click(String selector) { page.click(ReportRevisitPage.Element.css(selector)); }
    private String readFixtureString(String expression) throws Exception { return page.read(new ReportRevisitPage.Script(expression)); }
    private double readDocumentTimeOrigin() throws Exception { return Double.parseDouble(readFixtureString("String(performance.timeOrigin)")); }
    private void selectWorkspaceView(String label) { page.click(ReportRevisitPage.Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='"+label+"']")); }
    private void selectWatchlistNote(int index) throws Exception {
        assertEquals("Only the chosen ZERO note belongs to this journey", 0, index);
        click(".managed-watchlist-choices li:first-child .managed-watchlist-choice");
        awaitPage("exact ZERO note is the selected controlled editor", "document.querySelector('.managed-watchlist-choice[aria-pressed=true]')?.dataset.watchlistSelection==='listing-zero'");
    }
    private void typeIntoInput(String id, String text) throws Exception {
        if (id.equals("managed-note-0")) selectWatchlistNote(0);
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("[id="+JSONObject.quote(id)+"]", id, text));
    }
    private void closeSoftKeyboard() { keyboard.closeSoftKeyboard(); }
    private String savedValuationEditor() { return "JSON.parse(document.querySelector('#fixture-valuation-draft').textContent)"; }
    private String savedValuationStore() { return "JSON.parse(document.querySelector('#fixture-saved-valuation-store').textContent)"; }
    private String savedValuationResource() { return "JSON.parse(document.querySelector('#fixture-saved-valuation-resource').textContent)"; }
    private void clickWatchlistAction(String label) { page.click(ReportRevisitPage.Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='"+label+"']")); }
    private void assertFixtureBoundary(int expectedSaves) throws Exception {
        awaitPage("test-only source, origin and disconnected boundaries",
            "location.origin==='https://localhost'&&location.hash===''&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(expectedSourceSha)+
            "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            "&&window.Capacitor?.getPlatform()==='android'&&"+DIAGNOSTICS+".token===0&&"+DIAGNOSTICS+".signOut===0&&"+DIAGNOSTICS+".resolve===0&&"+DIAGNOSTICS+".save==="+expectedSaves);
    }
    @After public void closeRevenueBasisFixture() {
        try { if (scenario!=null) { scenario.close(); scenario=null; } }
        finally { if (assets!=null) assets.close(); }
    }
}
