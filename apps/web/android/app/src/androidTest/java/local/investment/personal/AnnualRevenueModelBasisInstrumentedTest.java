package local.investment.personal;

import static androidx.test.espresso.Espresso.*;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.*;
import static org.junit.Assert.*;

import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.ReportRevisitPage.Readiness;
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
    private static final String EDITOR = "JSON.parse(document.querySelector('#fixture-valuation-draft').textContent)";
    private static final String SAVED_INPUTS = "JSON.parse(document.querySelector('#fixture-saved-valuation-store').textContent)";
    private static final String SAVED_RESOURCE = "JSON.parse(document.querySelector('#fixture-saved-valuation-resource').textContent)";
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
        page.awaitStartup(new Check("source-bound fixture starts without source reads or writes", new Script(DIAGNOSTICS+".load===1&&"+DIAGNOSTICS+".status===1&&"+DIAGNOSTICS+".annual===0&&"+DIAGNOSTICS+".save===0&&document.querySelector('#fixture-saved-valuation-store')!==null")).nativeReady());
        assertFixtureBoundary(new Script(DIAGNOSTICS+".save===0"));
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
    }
    @Test public void annualRevenueBasisKeepsAuthoredInputsCitationReportBackAndSeparateSaves() throws Exception {
        double origin = readDocumentTimeOrigin();
        Script before = openAndAuthor();
        loadAndPreview(before);
        applyAndCalculate(before);
        appendCitedNote();
        captureAnnualRevenueModelReport();
        saveAnnualRevenueModelInputs();
        returnAndSaveWatchlist();
        freshReadInputs();
        assertEquals("one mounted native document owns the whole source/model/note/save journey", origin, readDocumentTimeOrigin(), 0.0);
        assertFixtureBoundary(new Script(DIAGNOSTICS+".save===1"));
    }
    private Script openAndAuthor() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        selectZeroNote();
        keyboard.enter(new ReportRevisitKeyboard.ControlledInput("#managed-note-0", "company note", AnnualRevenueModelBasisExpectations.PREFIX));
        page.click(Element.css(ANNUAL));
        page.await(new Check("exact company opens without a source, calculation or saved-input read", new Script(EDITOR + ".editable===true && " + DIAGNOSTICS + ".annual===0 && " + SAVED_INPUTS + ".counts.load===0")));
        page.click(Element.css(".managed-valuation-workbench:not(.managed-valuation-assumptions) > summary"));
        page.click(Element.css(".managed-valuation-revenue-basis > summary"));
        page.await(new Check("reported revenue remains a manual named choice with no default or inferred DCF", new Script("(()=>{const s=document.querySelector('.managed-valuation-revenue-basis select');return s?.value===''&&s.disabled===false&&s.options.length===4&&s.options[0].value===''&&s.options[1].value==='RevenueFromContractWithCustomerExcludingAssessedTax'&&s.options[2].value==='Revenues'&&s.options[3].value==='SalesRevenueNet'&&document.querySelector('.managed-valuation-revenue-basis > button')?.disabled===true&&" + EDITOR + ".dcfDraft.startingUnleveredCashFlowUsd===''&&" + EDITOR + ".calculation===null&&" + DIAGNOSTICS + ".annual===0;})()")));
        authorAnnualRevenueModelInputs();
        Script before = new Script(page.read(new Script("JSON.stringify(" + EDITOR + ")")));
        return before;
    }

    private void loadAndPreview(Script before) throws Exception {
        page.click(Element.css(".managed-annual-report .trial-actions button:first-child"));
        page.await(new Check("one explicit Annual read keeps its original completion clock without changing authored maps", new Script("document.querySelector('.managed-annual-report')?.textContent.includes('2026-09-20T00:00:02.000Z')&&" + DIAGNOSTICS + ".annual===1&&JSON.stringify(" + EDITOR + ")===" + JSONObject.quote(before.expression()))));
        chooseNativeChoice(new NativeChoice(Element.css(".managed-valuation-revenue-basis select"), "Revenues", "Revenue"));
        page.await(new Check("selected source exposes exact USD, fiscal dates, filing identity and independent original clocks", new Script(AnnualRevenueModelBasisExpectations.sourceExact() + "&&JSON.stringify(" + EDITOR + ")===" + JSONObject.quote(before.expression()))));
        retainFrame(new PortfolioReportFrameCapture.Request(scenario, PortfolioReportFrameCapture.Frame.ANNUAL_REVENUE_SOURCE), Element.css("[aria-label='Selected reported revenue source'] > p:nth-child(2)"));
        page.click(Element.css(".managed-valuation-revenue-basis > button"));
        page.await(new Check("full current and proposed raw maps precede the single-field application", new Script("(()=>{const p=document.querySelector('[aria-label=\"Complete starting revenue change preview\"]');return p?.textContent.includes(" + JSONObject.quote(AnnualRevenueModelBasisExpectations.CITATION) + ")&&p.querySelector('[aria-label=\"Current complete valuation inputs\"]')?.textContent.includes('1000.00')&&p.querySelector('[aria-label=\"Proposed complete valuation inputs\"]')?.textContent.includes('1000')&&p.querySelectorAll('[aria-label=\"Current complete valuation inputs\"] .managed-valuation-raw').length===p.querySelectorAll('[aria-label=\"Proposed complete valuation inputs\"] .managed-valuation-raw').length&&p.querySelector('button')?.disabled===false&&JSON.stringify(" + EDITOR + ")===" + JSONObject.quote(before.expression()) + "&&" + DIAGNOSTICS + ".annual===1&&" + DIAGNOSTICS + ".save===0&&" + SAVED_INPUTS + ".counts.save===0;})()")));
        page.await(new Check("both complete preview columns retain every exact raw operand and full company identity", new Script(AnnualRevenueModelBasisExpectations.previewMapsExact(before.expression(), SAVED_INPUTS))));
        retainFrame(new PortfolioReportFrameCapture.Request(scenario, PortfolioReportFrameCapture.Frame.ANNUAL_REVENUE_PREVIEW), Element.css("[aria-label='Complete starting revenue change preview'] > h4"));
    }

    private void applyAndCalculate(Script before) throws Exception {
        page.click(Element.css("[aria-label='Complete starting revenue change preview'] > button"));
        page.await(new Check("Apply changes only starting revenue and leaves both authored calculations unrun", new Script(AnnualRevenueModelBasisExpectations.onlyRevenueChanged(before.expression(), EDITOR) + "&&document.querySelector('[aria-label=\"Applied Annual revenue reference\"]')?.textContent.includes(" + JSONObject.quote(AnnualRevenueModelBasisExpectations.CITATION) + ")&&document.querySelector('[aria-label=\"Complete starting revenue change preview\"]')===null&&" + DIAGNOSTICS + ".annual===1&&" + DIAGNOSTICS + ".save===0&&" + SAVED_INPUTS + ".counts.load===0")));
        onWebView().withElement(findElement(Locator.XPATH, "//details[contains(@class,'managed-valuation-workbench')]/button[normalize-space(.)='Calculate authored scenarios']")).perform(webClick());
        page.await(new Check("only explicit Calculate creates both authored model results", new Script(EDITOR + ".calculation?.dcfResult.scenarios.base.valuePerShareUsd==='140.00'&&" + EDITOR + ".calculation?.exitResult.scenarios.base.valuePerShare==='19.00'")));
    }

    private void appendCitedNote() throws Exception {
        page.click(Element.css(".managed-valuation-note > summary"));
        chooseNativeChoice(new NativeChoice(Element.css(".managed-valuation-note select[id$='-note-model']"), "exit", "Exit multiple"));
        page.await(new Check("dated Price remains an unselected independent unavailable option", new Script("document.querySelector('.managed-valuation-price-opt-in input')?.checked===false&&document.querySelector('.managed-valuation-price-opt-in input')?.disabled===true&&" + DIAGNOSTICS + ".eod===0")));
        page.click(Element.css(".managed-valuation-note > button"));
        page.await(new Check("complete Exit note includes every authored operand, exact result and qualified original Annual citation", new Script("document.querySelector('.managed-valuation-note > .managed-valuation-note-preview .trial-saved-note')?.textContent===" + JSONObject.quote(EXPECTED) + "&&document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(AnnualRevenueModelBasisExpectations.PREFIX) + "&&" + DIAGNOSTICS + ".save===0")));
        page.click(Element.css(".managed-valuation-note > .managed-valuation-note-preview > button"));
        page.await(new Check("Append changes the complete unsaved note only", new Script("document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(EXPECTED) + "&&" + DRAFT + ".dirty===true&&" + DIAGNOSTICS + ".save===0&&" + SAVED_INPUTS + ".counts.save===0")));
    }

    private void returnAndSaveWatchlist() throws Exception {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        pressBack();
        page.await(new Check("hardware Back retains the whole cited draft and independently saved raw model inputs", new Script("document.querySelector('.managed-company-visit')===null&&" + DRAFT + ".memberships[0].note===" + JSONObject.quote(EXPECTED) + "&&" + DRAFT + ".memberships[1].note==='Invented second note'&&" + DRAFT + ".dirty===true&&" + SAVED_RESOURCE + ".saved.version===1&&" + DIAGNOSTICS + ".save===0")));
        page.click(Element.css("#managed-unsaved-review > summary"));
        page.await(new Check("whole Watchlist Review exposes the complete cited note before its independent Save", new Script("document.querySelector('#managed-unsaved-review')?.textContent.includes(" + JSONObject.quote(EXPECTED) + ")&&" + DIAGNOSTICS + ".save===0")));
        page.click(Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']"));
        page.await(new Check("only explicit Watchlist Save acknowledges the second version", new Script(DRAFT + ".baseVersion===2&&" + DRAFT + ".dirty===false&&" + DIAGNOSTICS + ".save===1&&" + SAVED_INPUTS + ".counts.save===1")));
        page.click(Element.xpath("//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']"));
        page.await(new Check("fresh Watchlist read preserves every exact membership and full citation", new Script(DRAFT + ".memberships[0].note===" + JSONObject.quote(EXPECTED) + "&&" + DRAFT + ".memberships[1].note==='Invented second note'&&" + DRAFT + ".memberships.length===2&&" + DIAGNOSTICS + ".load===2")));
    }

    private void freshReadInputs() throws Exception {
        selectZeroNote();
        page.click(Element.css(ANNUAL));
        page.click(Element.css(".managed-valuation-workbench:not(.managed-valuation-assumptions) > summary"));
        page.click(Element.css(".managed-valuation-assumptions > summary"));
        page.click(Element.css("#managed-valuation-load"));
        page.await(new Check("fresh saved-input read contains only the entire original authored maps with the chosen raw revenue", new Script(AnnualRevenueModelBasisExpectations.savedRawOnly(SAVED_INPUTS, SAVED_RESOURCE) + "&&" + SAVED_INPUTS + ".counts.load===2&&" + SAVED_INPUTS + ".counts.save===1&&" + DIAGNOSTICS + ".annual===1&&" + DIAGNOSTICS + ".eod===0&&" + DIAGNOSTICS + ".filings===0&&" + DIAGNOSTICS + ".search===0&&" + DIAGNOSTICS + ".token===0&&" + DIAGNOSTICS + ".signOut===0")));
    }

    private void authorAnnualRevenueModelInputs() throws Exception {
        String[][] fields = AnnualRevenueModelBasisExpectations.FIELDS;
        for (String[] field : fields) {
            String selector = ".managed-valuation-workbench:not(.managed-valuation-assumptions) input[id$='-" + field[0] + "']";
            page.await(new Check("exact blank labelled authored revenue model operand: " + field[0], new Script("(()=>{const e=document.querySelector(" + JSONObject.quote(selector) + ");return e?.value===''&&!e.disabled&&[...document.querySelectorAll('label')].some(l=>l.htmlFor===e.id);})()")));
            keyboard.enter(new ReportRevisitKeyboard.ControlledInput(selector, field[0], field[1]));
        }
        page.await(new Check("all initial authored raw operands remain exact before any source or calculation", new Script("(()=>{const e=" + EDITOR + ",s=" + SAVED_INPUTS + ";return JSON.stringify(e.dcfDraft)===JSON.stringify(s.expected.dcf.inputs)&&JSON.stringify(e.exitDraft)===JSON.stringify({...s.expected.exit.inputs,baseRevenue:'1000.00'})&&e.calculation===null&&s.counts.load===0&&s.counts.save===0;})()")));
    }

    private void captureAnnualRevenueModelReport() throws Exception {
        page.click(Element.css(".managed-company-report > summary"));
        prepareNativeCompanyReport();
        page.click(Element.css(".managed-report-document > summary"));
        page.await(new Check("read-only schema6 report retains complete cited note, both raw maps and original Annual clocks", new Script("(()=>{const f=document.querySelector('#managed-report-document');if(!f?.readOnly)return false;const d=JSON.parse(f.value),e=" + EDITOR + ";return d.schemaVersion==='6.0.0'&&d.authoredResearch.note===" + JSONObject.quote(EXPECTED) + "&&JSON.stringify(d.valuation.dcfDraft)===JSON.stringify(e.dcfDraft)&&JSON.stringify(d.valuation.exitDraft)===JSON.stringify(e.exitDraft)&&d.sources.annual.response.evidence.generation.completedAt==='2026-09-20T00:00:02.000Z'&&d.sources.price.status==='not_loaded'&&d.sources.filings.status==='not_loaded';})()")));
        String document = page.read(new Script("document.querySelector('#managed-report-document').value"));
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WatchlistTestDocuments.clear(context);
        try {
            page.click(Element.css(".managed-report-delivery button"));
            WatchlistSystemPicker picker = new WatchlistSystemPicker();
            picker.awaitOpen(); picker.saveToInventedRoot();
            page.await(new Check("one actual chosen JSON report write settles without any resource Save", new Script("JSON.parse(document.querySelector('#fixture-report-protocol').textContent).writesSettled===1&&" + DIAGNOSTICS + ".save===0&&" + SAVED_INPUTS + ".counts.save===0")));
            WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(context);
            assertEquals("one invented report destination", 1, outputs.length);
            assertEquals("application/json", context.getContentResolver().getType(outputs[0].uri));
            assertArrayEquals("chosen report bytes equal the complete captured document", document.getBytes(StandardCharsets.UTF_8), WatchlistTestDocuments.readReport(context, outputs[0]));
        } finally { WatchlistTestDocuments.clear(context); }
    }

    private void saveAnnualRevenueModelInputs() throws Exception {
        page.click(Element.css(".managed-valuation-assumptions > summary"));
        page.click(Element.css("#managed-valuation-load"));
        page.await(new Check("saved inputs Load leaves the complete cited Watchlist note unsaved", new Script(SAVED_INPUTS + ".counts.load===1&&" + SAVED_RESOURCE + ".baseVersion===0&&" + DIAGNOSTICS + ".save===0")));
        page.click(Element.css("#managed-valuation-stage-review"));
        page.await(new Check("complete current raw-input staging review precedes Stage", new Script("document.querySelector('[aria-label=\"Valuation staging review\"]')?.textContent.includes('authored-exit-multiple-v1')&&document.querySelector('#managed-valuation-stage')?.disabled===false&&" + SAVED_INPUTS + ".counts.save===0")));
        page.click(Element.css("#managed-valuation-stage"));
        page.await(new Check("staging cannot save before the independent whole-resource Review", new Script(SAVED_RESOURCE + ".draft.entries.length===1&&document.querySelector('#managed-valuation-save')?.disabled===true")));
        page.click(Element.css("#managed-valuation-review"));
        page.await(new Check("whole saved-resource Review contains only raw authored maps", new Script("document.querySelector('[aria-label=\"Complete valuation draft for Save\"]')?.textContent.includes('100.00')&&document.querySelector('#managed-valuation-save')?.disabled===false&&" + DIAGNOSTICS + ".save===0")));
        page.click(Element.css("#managed-valuation-save"));
        page.await(new Check("only explicit model Save confirms raw maps without copying source payload or saving the Watchlist", new Script(AnnualRevenueModelBasisExpectations.savedRawOnly(SAVED_INPUTS, SAVED_RESOURCE) + "&&" + SAVED_INPUTS + ".counts.save===1&&" + DIAGNOSTICS + ".save===0&&" + DRAFT + ".dirty===true")));
    }


    private void prepareNativeCompanyReport() throws Exception {
        page.click(Element.css(".managed-company-report .trial-actions button:first-child"));
        page.await(new Check("explicit preparation enables a full-size native Save control for the exact current note", new Script("document.querySelector('#managed-prepared-report-heading')?.textContent === 'Research report · ZERO' && " +
            "document.querySelector('.managed-company-report-note')?.textContent === " + JSONObject.quote(EXPECTED) + " && " +
            "document.querySelector('.managed-report-delivery button')?.textContent === 'Save report (JSON)' && " +
            "document.querySelector('.managed-report-delivery button')?.disabled === false && " +
            "document.querySelector('.managed-report-delivery button')?.getBoundingClientRect().height >= 44")));
    }

    private record NativeChoice(Element select, String value, String label) {}
    private void chooseNativeChoice(NativeChoice choice) throws Exception {
        String selector = choice.select.selector();
        String optionValue = choice.value;
        String label = choice.label;
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
        page.await(new Check("exact enabled native select has DOM focus", new Script("(() => { const select = document.getElementById(" + JSONObject.quote(actualId) + ");" +
            " return select instanceof HTMLSelectElement && !select.disabled && document.activeElement === select" +
            " && select === document.querySelector(" + JSONObject.quote(selector) + ")" +
            " && [...select.options].some(option => option.value === " + JSONObject.quote(optionValue) + " && !option.disabled); })()")));
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
        page.await(new Check("native option selected and exact dialog dismissed", new Script("document.getElementById(" + JSONObject.quote(actualId) + ")?.value === " + JSONObject.quote(optionValue)), Readiness.NATIVE, dialogDecor.get()));
        keyboard.closeSoftKeyboard();
    }

    private void retainFrame(PortfolioReportFrameCapture.Request request, Element target) throws Exception {
        assertSame("Capture belongs to this Activity", scenario, request.scenario());
        assertTrue("Only the two declared revenue frames may be captured", request.frame()==PortfolioReportFrameCapture.Frame.ANNUAL_REVENUE_SOURCE || request.frame()==PortfolioReportFrameCapture.Frame.ANNUAL_REVENUE_PREVIEW);
        assertEquals(Locator.CSS_SELECTOR, target.locator());
        String name = request.frame().name();
        String scrollSelector = target.selector();
        String selectors = target.selector();
        int count = 1;
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
        page.await(new Check("Annual note frame targets visible: " + name, new Script(visible)));
        page.await(new Check("declared revenue frame has committed native focus", new Script(visible)).nativeReady());
        new PortfolioReportFrameCapture(request).retain();
        page.await(new Check("Annual note frame targets remained visible: " + name, new Script(visible)));
    }

    private double readDocumentTimeOrigin() throws Exception { return Double.parseDouble(page.read(new Script("String(performance.timeOrigin)"))); }
    private void selectZeroNote() throws Exception {
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        page.await(new Check("Only the chosen ZERO note belongs to this journey", new Script("document.querySelector('.managed-watchlist-choice[aria-pressed=true]')?.dataset.watchlistSelection==='listing-zero'")));
    }
    private void assertFixtureBoundary(Script saveExpectation) throws Exception {
        page.await(new Check("test-only source, origin and disconnected boundaries", new Script("location.origin==='https://localhost'&&location.hash===''&&document.querySelector('meta[name=investment-build-sha]')?.content==="+JSONObject.quote(expectedSourceSha)+
            "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content==="+JSONObject.quote(CSP)+
            "&&window.Capacitor?.getPlatform()==='android'&&"+DIAGNOSTICS+".token===0&&"+DIAGNOSTICS+".signOut===0&&"+DIAGNOSTICS+".resolve===0&&"+saveExpectation.expression())));
    }
    @After public void closeRevenueBasisFixture() {
        try { if (scenario!=null) { scenario.close(); scenario=null; } }
        finally { if (assets!=null) assets.close(); }
    }
}
