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
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
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

/** One invented current pair becomes one independently saved dated check. */
@RunWith(AndroidJUnit4.class)
public class ManagedScreenComparisonFollowupTest {
    private static final String QUESTION = "Does this comparison change my ONE research? Café 東京 📈";
    private static final String DUE = "2026-12-31";
    private static final String NOTE = "Independent comparison Watchlist draft Café 東京 📈";
    private static final String PREFIX = "#screen-comparison-followup-";
    private static final String CONTEXT = PREFIX + "context";
    private static final String PREVIEW = "[aria-label='Screen comparison follow-up preview']";
    private static final String C = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String F = "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String R = "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private static final String D = "JSON.parse(document.querySelector('#fixture-screen-comparison-followup').textContent)";
    private static final String PACKETS = "JSON.parse(document.querySelector('#fixture-screen-comparison-followup-packets').textContent)";
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitTouch touch;
    private ReportRevisitKeyboard keyboard;
    private String sourceSha;
    private CaptureWindow captureWindow;
    private record Original(String watchlist, String origin) {}
    private record CaptureWindow(long before, long after) {}
    private record Preview(String preparedAt, String check, String report) {}
    private record Created(String id, String canonical) {}
    private record SourceReads(int sessions, int resolves, int annual) {}
    private record ResourceReads(int loads, int saves) {}
    private enum ReadPhase {
        INITIAL(new SourceReads(1, 0, 0), new ResourceReads(0, 0)),
        PAIRED(new SourceReads(1, 1, 2), new ResourceReads(0, 0)),
        LOADED(new SourceReads(1, 1, 2), new ResourceReads(1, 0)),
        RESEARCHED(new SourceReads(1, 2, 2), new ResourceReads(1, 0)),
        SAVED(new SourceReads(1, 2, 2), new ResourceReads(1, 1)),
        FRESH(new SourceReads(2, 2, 2), new ResourceReads(1, 1)),
        RELOADED(new SourceReads(2, 2, 2), new ResourceReads(2, 1));
        final SourceReads source;
        final ResourceReads resource;
        ReadPhase(SourceReads source, ResourceReads resource) { this.source = source; this.resource = resource; }
    }
    private record CompanyIdentity(String id, String date, String cutoff) {}
    private enum ExpectedCompany {
        ZERO(new CompanyIdentity("zero", "2025-12-31", "2026-09-20T00:00:00.000Z")),
        ONE(new CompanyIdentity("one", "2025-06-30", "2026-09-21T03:04:05.000Z"));
        final CompanyIdentity identity;
        ExpectedCompany(CompanyIdentity identity) { this.identity = identity; }
    }
    private enum ScreenAction {
        LOAD("Load screening cohort"), ADD("Add criterion"), APPLY("Apply criteria"),
        RUN("Run screen (2 companies)"), LEFT("Compare left ZERO"), RIGHT("Compare right ONE");
        final String label;
        ScreenAction(String label) { this.label = label; }
    }

    @Before public void launchInventedComparisonQuestion() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        sourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(sourceSha); assertTrue(sourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.SCREEN_COMPARISON_FOLLOWUP);
        assets.prepare(); scenario = ActivityScenario.launch(MainActivity.class);
        page = new ReportRevisitPage(scenario); touch = new ReportRevisitTouch(page); keyboard = new ReportRevisitKeyboard(page, touch);
        scenario.onActivity(activity -> {
            assertEquals("local.investment.personal", activity.getPackageName());
            assertNull(activity.getBridge().getPlugin("InvestmentAuth"));
            assertFalse(activity.getBridge().getConfig().isWebContentsDebuggingEnabled());
            assertFalse(activity.getBridge().getConfig().isMixedContentAllowed());
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.getBridge().getWebView().getSettings().getMixedContentMode());
            keyboard.observe(activity); activity.getBridge().setServerBasePath(assets.directory().getAbsolutePath());
        });
        page.awaitStartup(new Check("invented comparison starts without implicit financial or Follow-ups reads", new Script(
            C + ".load===1&&" + C + ".status===1&&" + C + ".marketsResolve===1&&" + R + ".entries===null&&document.querySelector('#fixture-screen-comparison-followup')!==null")).nativeReady());
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        boundary(ReadPhase.INITIAL);
    }

    @Test public void completeComparedPairCreatesOneDatedCheckThroughReviewResearchBackAndSeparateSave() throws Exception {
        Original original = authorAndLoadPair();
        captureAndLoad(); rejectOverflowAndRetiredForm();
        Preview preview = inspectCompletePreview(); retainPreviewFrame(preview);
        Created created = createOnce(original, preview);
        reviewResearchAndBack(original, created, preview);
        saveAndFreshLoad(original, created);
        assertEquals("one mounted native document owns the complete workflow", original.origin(), page.read(new Script("String(performance.timeOrigin)")));
        boundary(ReadPhase.RELOADED);
    }
    private Original authorAndLoadPair() throws Exception {
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='My Watchlist']"));
        page.click(Element.css(".managed-watchlist-choices li:first-child .managed-watchlist-choice"));
        replace("#managed-note-0", NOTE);
        page.await(new Check("the complete Watchlist note is a separate unsaved draft", new Script(D + ".watchlist.dirty===true&&JSON.parse(" + D + ".watchlist.canonical).memberships[0].note===" + JSONObject.quote(NOTE))));
        Original original = new Original(page.read(new Script(D + ".watchlist.canonical")), page.read(new Script("String(performance.timeOrigin)")));
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Discover']"));
        page.await(new Check("dated comparison disclosure starts closed with no current pair", new Script("document.querySelector('#screen-comparison-followup')?.open===false&&document.querySelector('" + PREFIX + "capture')?.disabled===true")));
        page.click(Element.css(PREFIX + "toggle"));
        screenAction(ScreenAction.LOAD); screenAction(ScreenAction.ADD); screenAction(ScreenAction.APPLY); screenAction(ScreenAction.RUN);
        page.await(new Check("one explicit Annual request starts the unchanged paced run", new Script(C + ".annual===1")));
        page.awaitStartup(new Check("the second independently dated source settles before pair selection", new Script(C + ".annual===2&&[...document.querySelectorAll('.managed-screen-table button')].find(b=>b.textContent==='Compare left ZERO')?.disabled===false")));
        screenAction(ScreenAction.LEFT); screenAction(ScreenAction.RIGHT);
        page.await(new Check("pair selection makes Capture eligible without choosing a destination or reading Follow-ups", new Script("document.querySelector('" + PREFIX + "capture')?.disabled===false&&document.querySelector('" + PREFIX + "company')?.value===''&&" + F + ".load===0")));
        unchanged(original); boundary(ReadPhase.PAIRED); return original;
    }
    private void captureAndLoad() throws Exception {
        captureSource();
        page.await(new Check("Capture preserves the empty required choice and admits only the exact two compared Watchlist listings", new Script(
            "(()=>{const s=document.querySelector('" + PREFIX + "company');return s?.value===''&&s.options.length===3&&[...s.options].map(o=>o.value).join('|')==='|left|right'&&[...s.options].slice(1).every(o=>!o.disabled)&&document.querySelector('" + PREFIX + "load')?.disabled===true;})()")));
        chooseRight(); replace(PREFIX + "question", QUESTION); replace(PREFIX + "due", DUE);
        page.click(Element.css(PREFIX + "load"));
        awaitInitialLoad(new Check("only explicit initial Load retains the same capture, exact destination and authored fields", new Script(
            F + ".load===1&&" + R + ".entries.length===2&&" + R + ".dirty===false&&" + R + ".baseVersion===1&&document.querySelector('" + PREFIX + "company')?.value==='right'&&document.querySelector('" + PREFIX + "question')?.value===" + JSONObject.quote(QUESTION) + "&&document.querySelector('" + PREFIX + "due')?.value===" + JSONObject.quote(DUE) + "&&document.querySelector('" + PREFIX + "preview')?.disabled===false&&document.querySelector('" + PREFIX + "load')===null")));
        boundary(ReadPhase.LOADED);
    }
    private void awaitInitialLoad(Check condition) throws Exception {
        try {
            page.await(condition);
        } catch (AssertionError original) {
            String snapshot;
            try {
                snapshot = page.read(initialLoadSnapshot());
                if (snapshot.length() > 4096)
                    snapshot = "{\"diagnosticTooLarge\":true,\"utf16CodeUnits\":" + snapshot.length() + "}";
            } catch (Exception | AssertionError diagnostic) {
                original.addSuppressed(diagnostic);
                android.util.Log.e("ComparisonInitialLoad", "Diagnostic read failed; original initial Load assertion retained.", diagnostic);
                throw original;
            }
            android.util.Log.e("ComparisonInitialLoad", snapshot);
            AssertionError failure = new AssertionError(original.getMessage() + "\nInitial Load diagnostic: " + snapshot);
            failure.initCause(original);
            throw failure;
        }
    }
    private Script initialLoadSnapshot() {
        return new Script("(()=>{const read=s=>document.querySelector(s),parse=s=>{try{return JSON.parse(read(s)?.textContent??'null');}catch(e){return {parseError:String(e)};}},f=parse('#fixture-followups-diagnostics'),r=parse('#fixture-followups-draft'),d=parse('#fixture-screen-comparison-followup'),root=read('#screen-comparison-followup');" +
            "return JSON.stringify({buildSha:read('meta[name=investment-build-sha]')?.content,open:root?.open,side:read('#screen-comparison-followup-company')?.value,question:read('#screen-comparison-followup-question')?.value,dueOn:read('#screen-comparison-followup-due')?.value," +
            "activeElement:document.activeElement?.id,documentHidden:document.hidden,captureDisabled:read('#screen-comparison-followup-capture')?.disabled,loadPresent:!!read('#screen-comparison-followup-load'),loadDisabled:read('#screen-comparison-followup-load')?.disabled,loadButtonText:read('#screen-comparison-followup-load')?.textContent,previewDisabled:read('#screen-comparison-followup-preview')?.disabled,readiness:read('#screen-comparison-followup-readiness')?.textContent,status:read('#screen-comparison-followup-status')?.textContent,capturedHeadingPresent:[...(root?.querySelectorAll('h5')??[])].some(e=>e.textContent.startsWith('Comparison captured at '))," +
            "statuses:root?[...root.querySelectorAll('[role=status]')].map(e=>e.textContent):[],followups:{session:f?.session,load:f?.load,save:f?.save,commits:f?.commits,held:f?.held,aborted:f?.aborted,failures:f?.failures,owner:r?.owner,phase:r?.phase,baseVersion:r?.baseVersion,dirty:r?.dirty,conflict:r?.conflict,uncertain:r?.uncertain,replayPending:r?.replayPending,entries:r?.entries?.length??null,savedVersion:r?.saved?.version}," +
            "watchlist:{phase:d?.watchlist?.phase,dirty:d?.watchlist?.dirty,baseVersion:d?.watchlist?.baseVersion},rejected:d?.rejected,refusals:d?.refusals,parseErrors:{calls:f?.parseError,draft:r?.parseError,context:d?.parseError}});})()");
    }
    private void rejectOverflowAndRetiredForm() throws Exception {
        String prior = page.read(new Script(D + ".followups.canonical"));
        replace(PREFIX + "question", "x".repeat(500)); page.click(Element.css(PREFIX + "preview"));
        page.await(new Check("whole-check overflow refuses without clipping or draft mutation", new Script("document.querySelector('" + PREFIX + "create')===null&&document.querySelector('" + PREFIX + "status')?.textContent.includes('500')&&document.querySelector('" + PREFIX + "question')?.value==='x'.repeat(500)&&" + D + ".followups.canonical===" + JSONObject.quote(prior))));
        replace(PREFIX + "question", QUESTION); page.click(Element.css(PREFIX + "preview"));
        page.await(new Check("current complete check has an explicit Create action", new Script("document.querySelector('" + PREFIX + "create')?.disabled===false")));
        replace(PREFIX + "due", "2026-12-30"); replace(PREFIX + "due", DUE);
        page.await(new Check("date ABA permanently withdraws its old preview", new Script("document.querySelector('" + PREFIX + "create')===null&&" + D + ".followups.canonical===" + JSONObject.quote(prior))));
        page.click(Element.css(PREFIX + "preview")); page.click(Element.css(PREFIX + "cancel"));
        page.await(new Check("Cancel withdraws the preview while retaining the exact authored form", new Script("document.querySelector('" + PREFIX + "check')===null&&document.querySelector('" + PREFIX + "question')?.value===" + JSONObject.quote(QUESTION) + "&&" + D + ".followups.canonical===" + JSONObject.quote(prior))));
        page.click(Element.css(PREFIX + "toggle")); page.click(Element.css(PREFIX + "toggle"));
        page.await(new Check("closing and reopening does not revive capture or destination, and preserves raw question/date", new Script("document.querySelector('#screen-comparison-followup')?.open===true&&document.querySelector('" + PREFIX + "company')?.value===''&&document.querySelector('" + PREFIX + "preview')?.disabled===true&&document.querySelector('" + PREFIX + "question')?.value===" + JSONObject.quote(QUESTION) + "&&document.querySelector('" + PREFIX + "due')?.value===" + JSONObject.quote(DUE))));
        captureSource(); chooseRight(); boundary(ReadPhase.LOADED);
    }
    private Preview inspectCompletePreview() throws Exception {
        page.click(Element.css(PREFIX + "preview"));
        page.await(new Check("full comparison retains complete source packets and all six statement tables", new Script(
            "(()=>{const a=document.querySelector('" + CONTEXT + " article'),pre=a?.querySelector(':scope > details > pre');if(!pre)return false;const r=JSON.parse(pre.textContent),packets=" + PACKETS + ";return r.kind==='screen_comparison'&&r.catalogSnapshotSha256==='sha256:'+'a'.repeat(64)&&r.run.status==='completed'&&r.run.completedAt!==null&&r.criteria.clauses.length===1&&r.criteria.clauses[0].field==='operatingCashFlow'&&r.criteria.clauses[0].operator==='gte'&&r.criteria.clauses[0].value==='0'&&r.criteria.sort.field==='symbol'&&r.criteria.sort.direction==='asc'&&[r.left,r.right].every((c,i)=>JSON.stringify(c.response)===JSON.stringify(packets[i])&&c.view.statements.statements.map(s=>s.id).join('|')==='income_statement|balance_sheet|cash_flow')&&a.querySelectorAll('section[aria-label=\"left company\"] table').length===3&&a.querySelectorAll('section[aria-label=\"right company\"] table').length===3&&a.textContent.includes('USD -200.125')&&a.textContent.includes('USD 0')&&a.textContent.includes('Unavailable')&&!pre.textContent.includes('Independent comparison Watchlist draft')&&a.querySelector('script,img,form,iframe,object')===null;})()")));
        String raw = page.read(new Script("document.querySelector('" + CONTEXT + " article > details > pre').textContent"));
        JSONObject report = new JSONObject(raw); verifyReport(report);
        String clock = report.getString("preparedAt");
        String check = "Question: " + QUESTION + " | Comparison reference: listing-zero / listing-one; captured " + clock + ". Full criteria, statements and source evidence not included.";
        assertTrue(check.codePointCount(0, check.length()) <= 500);
        page.await(new Check("complete independent saved-check oracle, due date and destination identity are visible before Create", new Script(
            "(()=>{const p=document.querySelector(\"" + PREVIEW + "\"),t=document.querySelector('" + PREFIX + "check');return t?.readOnly&&t.value===" + JSONObject.quote(check) + "&&p.textContent.includes('Due date (UTC): " + DUE + "')&&['listing-one','security-one','class-one','issuer-one','XNAS','sha256:'+'a'.repeat(64)].every(v=>[...p.querySelectorAll('dd')].some(e=>e.textContent===v))&&document.activeElement===p.querySelector('h4')&&document.querySelector('" + PREFIX + "create')?.getBoundingClientRect().height>=44;})()")));
        return new Preview(clock, check, raw);
    }
    private void verifyReport(JSONObject report) throws Exception {
        assertTrue(report.getString("preparedAt").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"));
        long authoredAt = java.time.Instant.parse(report.getString("preparedAt")).toEpochMilli();
        assertTrue("captured UTC instant comes from this explicit native action", authoredAt >= captureWindow.before() && authoredAt <= captureWindow.after());
        verifyCompany(report.getJSONObject("left"), ExpectedCompany.ZERO);
        verifyCompany(report.getJSONObject("right"), ExpectedCompany.ONE);
    }
    private void verifyCompany(JSONObject company, ExpectedCompany expected) throws Exception {
        CompanyIdentity identity = expected.identity;
        JSONObject listing = company.getJSONObject("listing"); assertEquals(11, listing.length());
        assertEquals("listing-" + identity.id(), listing.getString("listingId")); assertEquals("issuer-" + identity.id(), listing.getString("issuerId"));
        assertEquals("security-" + identity.id(), listing.getString("securityId")); assertEquals("class-" + identity.id(), listing.getString("shareClassId"));
        assertEquals(expected.name(), listing.getString("symbol")); assertEquals("Class A", listing.getString("shareClassName")); assertEquals("XNAS", listing.getString("exchangeMic")); assertEquals("US", listing.getString("country"));
        String name = expected == ExpectedCompany.ZERO ? "Zero" : "One";
        assertEquals(name + " Company", listing.getString("issuerName")); assertEquals(name + " Class A", listing.getString("securityName")); assertEquals("common_stock", listing.getString("instrumentType"));
        JSONObject evidence = company.getJSONObject("response").getJSONObject("evidence");
        assertEquals(identity.date(), evidence.getJSONObject("target").getString("reportDate")); assertEquals(identity.cutoff(), evidence.getJSONObject("generation").getString("cutoffAt"));
        assertEquals(3, company.getJSONObject("view").getJSONObject("statements").getJSONArray("statements").length());
    }
    private void retainPreviewFrame(Preview preview) throws Exception {
        String targets = ":scope > h4,:scope > label,#screen-comparison-followup-check,:scope > p:nth-of-type(1),:scope > p:nth-of-type(2),:scope > p:nth-of-type(3)";
        page.read(new Script("(()=>{const p=document.querySelector(\"" + PREVIEW + "\"),r=[...p.querySelectorAll(" + JSONObject.quote(targets) + ")].map(e=>e.getBoundingClientRect()),v=visualViewport,n=document.querySelector('.managed-navigation'),nr=n?.getBoundingClientRect(),bottom=nr&&getComputedStyle(n).position==='fixed'?Math.min(v.offsetTop+v.height,nr.top):v.offsetTop+v.height;window.scrollBy({top:(Math.min(...r.map(x=>x.top))+Math.max(...r.map(x=>x.bottom))-v.offsetTop-bottom)/2,behavior:'instant'});return 'positioned';})()"));
        String visible = "(()=>{const p=document.querySelector(\"" + PREVIEW + "\"),t=document.querySelector('" + PREFIX + "check'),v=visualViewport,n=document.querySelector('.managed-navigation'),nr=n?.getBoundingClientRect(),bottom=nr&&getComputedStyle(n).position==='fixed'?Math.min(v.offsetTop+v.height,nr.top):v.offsetTop+v.height,rows=[...p.querySelectorAll(" + JSONObject.quote(targets) + ")];return t?.readOnly&&t.value===" + JSONObject.quote(preview.check()) + "&&t.scrollWidth<=t.clientWidth+1&&t.scrollHeight<=t.clientHeight+1&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&rows.length===6&&rows.every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.width>0&&r.height>0&&r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width&&r.top>=v.offsetTop&&r.bottom<=bottom&&e.contains(hit);});})()";
        page.await(new Check("scoped preview heading, whole check, Unicode count, destination and UTC date are unobscured", new Script(visible)).nativeReady());
        new FollowupsReportFrameCapture(new FollowupsReportFrameCapture.Request(scenario, FollowupsReportFrameCapture.Frame.SCREEN_COMPARISON_FOLLOWUP_PREVIEW)).retain();
        page.await(new Check("the same scoped complete-check viewport remains current after PixelCopy", new Script(visible)));
    }
    private Created createOnce(Original original, Preview preview) throws Exception {
        String firstTwo = page.read(new Script("JSON.stringify(" + R + ".entries)"));
        page.click(Element.css(PREFIX + "create"));
        page.await(new Check("one Create appends only the exact right-company dated draft and preserves both earlier entries", new Script(
            R + ".entries.length===3&&" + R + ".dirty===true&&" + R + ".baseVersion===1&&JSON.stringify(" + R + ".entries.slice(0,2))===" + JSONObject.quote(firstTwo) + "&&" + R + ".entries[2].listing.listingId==='listing-one'&&" + R + ".entries[2].check===" + JSONObject.quote(preview.check()) + "&&" + R + ".entries[2].dueOn===" + JSONObject.quote(DUE) + "&&" + R + ".entries[2].status==='open'&&" + R + ".entries[2].completedOn===null&&" + R + ".entries[2].result===''&&document.querySelector('" + PREFIX + "create')===null&&" + F + ".save===0")));
        Created created = new Created(page.read(new Script(R + ".entries[2].id")), page.read(new Script(D + ".followups.canonical")));
        assertTrue(created.id().matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        assertFalse("saved reference excludes full source packet structure", created.canonical().contains("observations"));
        page.await(new Check("consumed capture removes Create and disables another preview before any overwrite", new Script("document.querySelector('" + PREFIX + "create')===null&&document.querySelector('" + PREFIX + "preview')?.disabled===true&&" + D + ".followups.canonical===" + JSONObject.quote(created.canonical()))));
        unchanged(original); boundary(ReadPhase.LOADED); return created;
    }
    private void reviewResearchAndBack(Original original, Created created, Preview preview) throws Exception {
        page.click(Element.css(PREFIX + "review"));
        page.await(new Check("Review selects the exact created global entry before Save", new Script("document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&" + R + ".selectedId===" + JSONObject.quote(created.id()) + "&&document.querySelector('#managed-followup-check')?.value===" + JSONObject.quote(preview.check()) + "&&document.querySelector('#managed-followup-due')?.value===" + JSONObject.quote(DUE) + "&&document.querySelector('#managed-followup-editor-heading')?.textContent.includes('ONE')&&" + F + ".save===0")));
        page.click(Element.css("#managed-followup-research-" + created.id()));
        page.await(new Check("only Research resolves exact ONE without any further financial read", new Script("location.href==='https://localhost/?company=listing-one&section=price'&&document.querySelector('.managed-company-visit')?.textContent.includes('ONE')&&" + D + ".researchResolve===1&&" + C + ".resolve===2")).nativeReady());
        pressBack();
        page.await(new Check("hardware Back returns to the same selected draft while retiring source preview", new Script("document.querySelector('.managed-company-visit')===null&&document.querySelector('.managed-navigation [aria-current=page]')?.textContent==='Follow-ups'&&" + R + ".selectedId===" + JSONObject.quote(created.id()) + "&&document.querySelector('#managed-followup-check')?.value===" + JSONObject.quote(preview.check()) + "&&document.querySelector('" + PREFIX + "check')===null&&" + D + ".followups.canonical===" + JSONObject.quote(created.canonical()))));
        unchanged(original); boundary(ReadPhase.RESEARCHED);
    }
    private void saveAndFreshLoad(Original original, Created created) throws Exception {
        page.click(Element.css("#managed-followups-save"));
        page.await(new Check("separate Save makes one complete versioned resource commit", new Script(R + ".baseVersion===2&&" + R + ".dirty===false&&" + F + ".save===1&&" + F + ".commits===1&&" + D + ".followups.canonical===" + JSONObject.quote(created.canonical()))));
        unchanged(original); boundary(ReadPhase.SAVED);
        page.click(Element.css("#fixture-followups-fresh-session"));
        page.await(new Check("fresh session reloads only saved Watchlist and catalog while Follow-ups remains explicitly unloaded", new Script(C + ".load===2&&" + C + ".status===2&&" + C + ".marketsResolve===2&&" + R + ".entries===null&&" + F + ".load===1&&" + D + ".watchlist.dirty===false&&!" + D + ".watchlist.canonical.includes(" + JSONObject.quote(NOTE) + ")")));
        boundary(ReadPhase.FRESH);
        page.click(Element.xpath("//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']"));
        page.click(Element.css("#managed-followups-load"));
        page.await(new Check("only explicit fresh Load restores every byte of the complete saved Follow-ups payload", new Script(R + ".baseVersion===2&&" + R + ".dirty===false&&" + F + ".load===2&&" + D + ".followups.canonical===" + JSONObject.quote(created.canonical()))));
    }
    private void unchanged(Original original) throws Exception {
        page.await(new Check("the independent complete Watchlist stays unsaved and unchanged", new Script(D + ".watchlist.canonical===" + JSONObject.quote(original.watchlist()) + "&&" + D + ".watchlist.dirty===true&&" + C + ".save===0")));
    }
    private void screenAction(ScreenAction action) {
        page.click(Element.xpath("//section[contains(@class,'managed-financial-screen')]//button[normalize-space(.)=" + JSONObject.quote(action.label) + "]"));
    }
    private void captureSource() {
        long before = System.currentTimeMillis();
        page.click(Element.css(PREFIX + "capture"));
        captureWindow = new CaptureWindow(before, System.currentTimeMillis());
    }
    private void chooseRight() throws Exception {
        String selector = PREFIX + "company";
        page.read(new Script("(()=>{const s=document.querySelector('" + selector + "');s.scrollIntoView({block:'center',behavior:'instant'});s.focus({preventScroll:true});return 'focused';})()"));
        page.await(new Check("exact independent right company choice is enabled and focused", new Script("document.activeElement===document.querySelector('" + selector + "')&&[...document.querySelector('" + selector + "').options].some(o=>o.value==='right'&&!o.disabled)")).nativeReady());
        onView(isAssignableFrom(WebView.class)).perform(pressKey(KeyEvent.KEYCODE_F4));
        AtomicReference<View> dialog = new AtomicReference<>();
        onView(androidx.test.espresso.matcher.ViewMatchers.withText("Right: ONE · One Company · Class A · XNAS")).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog())
            .check((view, missing) -> { if (missing != null) throw missing; dialog.set(view.getRootView()); }).perform(androidx.test.espresso.action.ViewActions.click());
        assertNotNull(dialog.get());
        page.await(new Check("native select applies exactly right and dismisses its own dialog", new Script("document.querySelector('" + selector + "')?.value==='right'"), ReportRevisitPage.Readiness.NATIVE, dialog.get()));
        keyboard.closeSoftKeyboard();
    }
    private void replace(String selector, String text) throws Exception {
        touch.input(new ReportRevisitTouch.ControlledField(selector, "replace complete invented question field"));
        page.await(new Check("controlled editor owns native focus", new Script("document.activeElement===document.querySelector(" + JSONObject.quote(selector) + ")")));
        onView(isAssignableFrom(WebView.class)).perform(pressKey(new EspressoKey.Builder().withKeyCode(KeyEvent.KEYCODE_A).withCtrlPressed(true).build()));
        page.await(new Check("native selection spans the whole raw current field", new Script("document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===document.activeElement.value.length")));
        onView(isAssignableFrom(WebView.class)).perform(new ViewAction() {
            public Matcher<View> getConstraints() { return isDisplayed(); }
            public String getDescription() { return "replace invented Unicode field through native IME"; }
            public void perform(UiController controller, View view) {
                assertTrue(view.hasFocus() && view.hasWindowFocus());
                android.view.inputmethod.InputConnection input = ((WebView)view).onCreateInputConnection(new android.view.inputmethod.EditorInfo());
                assertNotNull(input); assertTrue(input.commitText(text, 1)); controller.loopMainThreadUntilIdle();
            }
        });
        page.await(new Check("whole native replacement reaches the product model without clipping", new Script("document.querySelector(" + JSONObject.quote(selector) + ")?.value===" + JSONObject.quote(text))));
        keyboard.closeSoftKeyboard();
    }
    private void boundary(ReadPhase phase) throws Exception {
        page.await(new Check("current native source/platform/CSP and independent source/resource counters stay exact", new Script(
            "location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content===" + JSONObject.quote(sourceSha) + "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===" + JSONObject.quote(CSP) +
            "&&" + C + ".load===" + phase.source.sessions() + "&&" + C + ".status===" + phase.source.sessions() + "&&" + C + ".marketsResolve===" + phase.source.sessions() + "&&" + C + ".resolve===" + phase.source.resolves() + "&&" + C + ".annual===" + phase.source.annual() +
            "&&" + C + ".save===0&&" + C + ".eod===0&&" + C + ".filings===0&&" + C + ".interimReport===0&&" + C + ".marketsEod===0&&" + C + ".calendar===0&&" + C + ".fed===0&&" + C + ".search===0&&" + C + ".interimPortfolioLoad===0&&" + C + ".interimPortfolioSave===0&&" + C + ".interimFollowupsLoad===0&&" + C + ".interimFollowupsSave===0&&" + C + ".token===0&&" + C + ".signOut===0&&" + F + ".load===" + phase.resource.loads() + "&&" + F + ".save===" + phase.resource.saves() + "&&" + F + ".commits===" + phase.resource.saves() + "&&" + F + ".replays===0&&" + F + ".token===0&&" + F + ".signOut===0&&" + D + ".rejected===0&&Object.keys(" + D + ".refusals).sort().join('|')==='bea|bls|cpi|fed|filings|interim|price|resourceLoad|resourceSave|search'&&" + D + ".refusals.bls===0&&" + D + ".refusals.resourceLoad===0&&" + D + ".refusals.resourceSave===0&&Object.values(" + D + ".refusals).every(n=>n===0)")));
    }
    @After public void closeInventedComparisonQuestion() { try { if (scenario != null) { scenario.close(); scenario = null; } } finally { if (assets != null) assets.close(); } }
}
