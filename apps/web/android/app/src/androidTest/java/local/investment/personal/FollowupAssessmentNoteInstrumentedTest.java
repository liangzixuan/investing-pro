package local.investment.personal;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.action.ViewActions.pressKey;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.junit.Assert.*;

import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebBackForwardList;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** One authored assessment enters its exact company note; each resource still saves separately. */
@RunWith(AndroidJUnit4.class)
public class FollowupAssessmentNoteInstrumentedTest {
    private static final long PAGE_TIMEOUT_MS = 10_000;
    private static final String CSP =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; " +
        "base-uri 'none'; form-action 'none'";
    private static final String DRAFT =
        "JSON.parse(document.getElementById('fixture-workspace-draft').textContent)";
    private static final String DIAGNOSTICS =
        "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FOLLOWUPS =
        "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String FOLLOWUP_DRAFT =
        "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    private ActivityScenario<MainActivity> scenario;
    private ReportRevisitFixtureAssets assets;
    private ReportRevisitPage page;
    private ReportRevisitKeyboard keyboard;
    private String expectedSourceSha;
    private record Prepared(double origin, String prefix, String entries, String before) {}
    private record Appended(Prepared review, String expected, String predicate) {}

    @Before public void launchInventedAssessmentNote() throws Exception {
        assertFalse(BuildConfig.CLERK_AUTH_ENABLED);
        expectedSourceSha = InstrumentationRegistry.getArguments().getString("expectedSourceSha");
        assertNotNull(expectedSourceSha);
        assertTrue(expectedSourceSha.matches("[0-9a-f]{40}"));
        assets = new ReportRevisitFixtureAssets(ReportRevisitFixtureAssets.Scenario.FOLLOWUP_ASSESSMENT_NOTE);
        assets.prepare();
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
        page.awaitStartup(new ReportRevisitPage.Check("managed fixture ready", new ReportRevisitPage.Script(
            "document.querySelector('#fixture-diagnostics') !== null && " + DIAGNOSTICS + ".load === 1 && " + DIAGNOSTICS + ".status === 1 && document.querySelector('#managed-note-0')?.disabled === false")).nativeReady());
        assertFixtureBoundary(0, 0);
        scenario.onActivity(activity -> activity.getBridge().getWebView().clearHistory());
        assertRootHistory();
    }

    @Test public void followupAssessmentAppendsExactCompanyNoteThroughBackAndSeparateSaves() throws Exception {
        Prepared review = authorChosenReview();
        Appended note = previewAndAppend(review);
        returnToChosenReview(note);
        saveAndReload(note);
    }

    private Prepared authorChosenReview() throws Exception {
        double origin = readDocumentTimeOrigin();
        String prefix = "Independent company note before review";
        selectWorkspaceView("My Watchlist");
        typeIntoInput("managed-note-0", prefix);
        openFollowupsView();
        awaitPage("the new note journey still needs an explicit Follow-ups Load",
            FOLLOWUPS + ".load===0 && " + FOLLOWUP_DRAFT + ".entries===null");
        click("#managed-followups-load");
        awaitPage("one explicit Load starts the independent empty resource",
            FOLLOWUPS + ".load===1 && " + FOLLOWUP_DRAFT + ".baseVersion===0 && " + FOLLOWUP_DRAFT + ".entries?.length===0");
        typeIntoInput("managed-followups-new-due", "2000-01-01");
        FollowupsReviewSessionExpectations.EntryId first = authorSessionFollowup(FollowupsReviewSessionExpectations.Check.ZERO);
        FollowupsReviewSessionExpectations.EntryId second = authorSessionFollowup(FollowupsReviewSessionExpectations.Check.ONE);
        click(".managed-followups-review > summary");
        click("#managed-followups-review-enter");
        awaitPage("two authored questions are available for explicit selection",
            "document.querySelectorAll('.managed-followups-review-choices > li').length===2 && document.querySelector('#managed-followups-review-start')?.disabled===true");
        click("#managed-followups-review-choose-" + first);
        click("#managed-followups-review-choose-" + second);
        awaitPage("explicit choice order is ZERO then ONE",
            "document.querySelector('#managed-followups-review-choose-" + first + "')?.textContent==='Chosen 1: remove this check'" +
            " && document.querySelector('#managed-followups-review-choose-" + second + "')?.textContent==='Chosen 2: remove this check'");
        click("#managed-followups-review-start");
        click("#managed-followups-review-research");
        awaitPage("the first chosen company opens with the original note and no loaded source",
            "document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            " && document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(prefix) +
            " && document.querySelector('.managed-followup-review-note')===null");
        assertCompanyHistory("listing-zero", "price", false);
        assertCompanySourceOverview(false, false, false);
        click("#managed-research-followup-assessment > summary");
        typeIntoInput("managed-research-followup-result", FollowupsReviewSessionExpectations.sessionReviewResult(FollowupsReviewSessionExpectations.Check.ZERO));
        awaitPage("a nonempty authored assessment exposes the initially closed note action",
            "document.querySelector('.managed-followup-review-note')?.open===false" +
            " && document.querySelector('.managed-followup-review-note > summary')?.textContent==='Keep assessment in company note'" +
            " && " + FOLLOWUP_DRAFT + ".entries?.[0]?.result===" + JSONObject.quote(FollowupsReviewSessionExpectations.sessionReviewResult(FollowupsReviewSessionExpectations.Check.ZERO)));
        String entries = readFixtureString("JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)");
        String before = readFixtureString("JSON.stringify(" + DRAFT + ")");
        return new Prepared(origin, prefix, entries, before);

    }

    private Appended previewAndAppend(Prepared review) throws Exception {
        String prefix=review.prefix(), entries=review.entries(), before=review.before();
        click(".managed-followup-review-note > summary");
        click("#managed-followup-note-preview-action");
        String cancelled = assertFollowupNotePreview(prefix);
        awaitPage("preview keeps both complete drafts and all source budgets unchanged",
            "JSON.stringify(" + DRAFT + ")===" + JSONObject.quote(before) +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries));
        assertFollowupNoteSources(1, 0);
        click("#managed-followup-note-append + button");
        awaitPage("Keep current note removes the preview without editing or saving either resource",
            "document.querySelector('#managed-followup-note-preview')===null && document.querySelector('#managed-followup-note-append')===null" +
            " && JSON.stringify(" + DRAFT + ")===" + JSONObject.quote(before) +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries));
        assertTrue("Cancelled preview is complete", cancelled.contains("Authored text; original source dates remain unchanged."));
        click("#managed-followup-note-preview-action");
        String expected = assertFollowupNotePreview(prefix);
        retainCompletePreviewFrame();
        click("#managed-followup-note-append");
        String appended = "document.querySelector('#managed-research-note')?.value===" + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[0]?.note===" + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships?.[1]?.note==='Invented second note' && " + DRAFT + ".dirty===true" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries) +
            " && " + FOLLOWUP_DRAFT + ".dirty===true && " + FOLLOWUPS + ".save===0 && " + FOLLOWUPS + ".commits===0";
        awaitPage("Append changes only the selected Watchlist note and reports the two separate unsaved resources",
            appended + " && document.querySelector('#managed-followup-note-preview')===null" +
            " && document.querySelector('#managed-followup-note-append')===null && document.querySelector('#managed-followup-note-preview-action')?.disabled===false" +
            " && document.querySelector('.managed-followup-review-note [role=status]')?.textContent==='Assessment added to the company note draft. Review and save My Watchlist and Follow-ups separately.'");
        click("#managed-followup-note-preview-action");
        awaitPage("a new explicit Preview refuses the already appended full assessment without another mutation",
            appended + " && document.querySelector('#managed-followup-note-preview')===null && document.querySelector('#managed-followup-note-append')===null" +
            " && document.querySelector('.managed-followup-review-note [role=status]')?.textContent==='This complete assessment is already in the company note draft.'");
        assertFollowupNoteSources(1, 0);
        return new Appended(review, expected, appended);

    }

    private void returnToChosenReview(Appended note) throws Exception {
        String entries=note.review().entries(), expected=note.expected(), appended=note.predicate();
        closeSoftKeyboard();
        String ready = "(() => { const back=document.querySelector('.managed-company-visit .trial-toolbar > button'); const r=back?.getBoundingClientRect();" +
            " return location.pathname==='/' && location.search==='?company=listing-zero&section=price' && location.hash===''" +
            " && document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            " && back?.disabled===false && back.textContent==='Back to workspace' && back.checkVisibility()===true && r.width>0 && r.height>0; })()";
        awaitPage("the exact company visit and enabled visible Back control are ready for one hardware Back", ready + " && " + appended, true);
        pressBack();
        awaitPage("one native Back retains the first chosen check, assessment and appended note without advancing or saving",
            "document.querySelector('.managed-company-visit')===null && location.search===''" +
            " && document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check 1 of 2.')" +
            " && document.activeElement===document.querySelector('#managed-followups-review-research')" +
            " && document.querySelector('.managed-followups-review')?.textContent.includes(" + JSONObject.quote(FollowupsReviewSessionExpectations.sessionReviewResult(FollowupsReviewSessionExpectations.Check.ZERO)) + ")" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries) +
            " && " + DRAFT + ".memberships?.[0]?.note===" + JSONObject.quote(expected));
        assertReturnedRootHistory("listing-zero", "price");
        click(".managed-followups-review > section > details:last-of-type > summary");
        awaitPage("the same two complete questions retain their chosen order after company Back",
            "[...document.querySelectorAll('.managed-followups-review > section > details:last-of-type > ol > li > .managed-followups-authored')].map(e=>e.textContent).join('|')===" +
            JSONObject.quote(FollowupsReviewSessionExpectations.sessionReviewQuestion(FollowupsReviewSessionExpectations.Check.ZERO) + "|" + FollowupsReviewSessionExpectations.sessionReviewQuestion(FollowupsReviewSessionExpectations.Check.ONE)));
        click("#managed-followups-review-finish");
        awaitPage("Finish preserves the complete two-entry authored draft and performs no Save",
            "document.querySelector('#managed-followups-review-again')?.disabled===false && document.querySelector('#managed-followups-review-position')===null" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries) + " && " + FOLLOWUPS + ".save===0");

    }

    private void saveAndReload(Appended note) throws Exception {
        String entries=note.review().entries(), expected=note.expected();
        double origin=note.review().origin();
        click("#managed-followups-save");
        awaitPage("Save follow-ups commits only its full independent resource",
            FOLLOWUPS + ".save===1 && " + FOLLOWUPS + ".commits===1 && " + FOLLOWUP_DRAFT + ".baseVersion===1 && " + FOLLOWUP_DRAFT + ".dirty===false" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries) +
            " && " + DRAFT + ".dirty===true && " + DRAFT + ".baseVersion===1 && " + DRAFT + ".memberships[0].note===" + JSONObject.quote(expected));
        assertFollowupNoteSources(1, 0);
        selectWorkspaceView("My Watchlist");
        clickWatchlistAction("Save watchlist");
        awaitPage("Save watchlist separately commits the complete exact note and preserves the Follow-ups saved version",
            DRAFT + ".baseVersion===2 && " + DRAFT + ".dirty===false && " + DRAFT + ".memberships[0].note===" + JSONObject.quote(expected) +
            " && " + DRAFT + ".memberships[1].note==='Invented second note' && " + FOLLOWUPS + ".save===1 && " + FOLLOWUP_DRAFT + ".baseVersion===1");
        String members = readFixtureString("JSON.stringify(" + DRAFT + ".memberships)");
        assertFollowupNoteSources(1, 1);
        click("#fixture-followups-fresh-session");
        awaitPage("fresh session loads only the saved Watchlist and does not resume a chosen review",
            FOLLOWUPS + ".session===2 && " + FOLLOWUPS + ".load===1 && " + FOLLOWUP_DRAFT + ".entries===null" +
            " && " + DRAFT + ".baseVersion===2 && " + DRAFT + ".dirty===false && JSON.stringify(" + DRAFT + ".memberships)===" + JSONObject.quote(members));
        openFollowupsView();
        click("#managed-followups-load");
        awaitPage("explicit fresh Load restores both whole saved packets with no repeated append or chosen-session restoration",
            FOLLOWUPS + ".load===2 && " + FOLLOWUPS + ".save===1 && " + FOLLOWUPS + ".commits===1" +
            " && " + FOLLOWUP_DRAFT + ".baseVersion===1 && " + FOLLOWUP_DRAFT + ".dirty===false && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(entries) +
            " && JSON.stringify(" + DRAFT + ".memberships)===" + JSONObject.quote(members) +
            " && document.querySelector('#managed-followups-review-enter')!==null && document.querySelector('#managed-followups-review-position')===null");
        assertFollowupNoteSources(2, 1);
        assertFixtureBoundary(1, 1);
        assertEquals("Separate resource Saves and fresh Load keep the same native document", origin, readDocumentTimeOrigin(), 0.0);
    }

    private String assertFollowupNotePreview(String prefix) throws Exception {
        awaitPage("Preview renders one complete readonly company note with explicit Append and Keep controls",
            "document.querySelector('#managed-followup-note-preview')?.readOnly===true" +
            " && document.querySelector('label[for=managed-followup-note-preview]')?.textContent==='Complete company note preview'" +
            " && document.querySelector('#managed-followup-note-append')?.textContent==='Append assessment to note draft'" +
            " && document.querySelector('#managed-followup-note-append + button')?.textContent==='Keep current note'");
        String stamp = readFixtureString("document.querySelector('#managed-followup-note-preview').value.match(/Authored assessment recorded at \\(UTC\\): ([0-9T:.Z-]+)\\. Authored text;/)?.[1] ?? ''");
        assertTrue("Preview captures one canonical authored UTC timestamp", stamp.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"));
        java.time.Instant.parse(stamp);
        String expected = prefix + " Follow-up assessment for ZERO (Class A, XNAS). Question: " + FollowupsReviewSessionExpectations.sessionReviewQuestion(FollowupsReviewSessionExpectations.Check.ZERO) +
            " | Due date (UTC): 2000-01-01 | State: open | My assessment: " + FollowupsReviewSessionExpectations.sessionReviewResult(FollowupsReviewSessionExpectations.Check.ZERO) +
            " | Authored assessment recorded at (UTC): " + stamp + ". Authored text; original source dates remain unchanged.";
        assertTrue("Whole note stays within the unchanged Unicode limit", expected.codePointCount(0, expected.length()) <= 2000);
        awaitPage("complete preview equals the handwritten note including original prefix, full question, result, due date, open state and captured clock",
            "document.querySelector('#managed-followup-note-preview')?.value===" + JSONObject.quote(expected));
        return expected;
    }

    private void assertFollowupNoteSources(int sessions, int saves) throws Exception {
        awaitPage("assessment note workflow has only startup catalogs, one explicit company resolve and the declared separate Watchlist Save",
            DIAGNOSTICS + ".load===" + sessions + " && " + DIAGNOSTICS + ".status===" + sessions + " && " + DIAGNOSTICS + ".marketsResolve===" + sessions +
            " && " + DIAGNOSTICS + ".resolve===1 && " + DIAGNOSTICS + ".save===" + saves + " && " + DIAGNOSTICS + ".search===0" +
            " && " + DIAGNOSTICS + ".eod===0 && " + DIAGNOSTICS + ".annual===0 && " + DIAGNOSTICS + ".filings===0 && " + DIAGNOSTICS + ".marketsEod===0" +
            " && " + DIAGNOSTICS + ".calendar===0 && " + DIAGNOSTICS + ".fed===0 && " + FOLLOWUPS + ".token===0 && " + FOLLOWUPS + ".signOut===0");
    }

    private FollowupsReviewSessionExpectations.EntryId authorSessionFollowup(FollowupsReviewSessionExpectations.Check check) throws Exception {
        chooseNativeSelectOption("#managed-followups-member", check.listingId(), check.label());
        awaitPage("the displayed UTC due value remains exact between separate additions",
            FollowupsReviewSessionExpectations.dueDate());
        click("#managed-followups-add");
        awaitPage("Add creates only its selected exact listing and blank question",
            FollowupsReviewSessionExpectations.added(check));
        String id = readFixtureString(FOLLOWUP_DRAFT + ".selectedId");
        assertTrue(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        typeIntoInput("managed-followup-check", FollowupsReviewSessionExpectations.sessionReviewQuestion(check));
        return new FollowupsReviewSessionExpectations.EntryId(java.util.UUID.fromString(id));
    }

    private void openFollowupsView() throws Exception {
        onWebView().withElement(findElement(Locator.XPATH,
            "//nav[@aria-label='Workspace']/button[normalize-space(.)='Follow-ups']")).perform(webClick());
        awaitPage("Follow-ups is the actual visible product view",
            "[...document.querySelectorAll('.managed-navigation button')].some(b => b.textContent === 'Follow-ups' && b.getAttribute('aria-current') === 'page')" +
            " && document.querySelector('#managed-followups-heading')?.checkVisibility() === true" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth");
    }

    private void assertCompanySourceOverview(boolean priceLoaded, boolean annualLoaded, boolean filingsLoaded) throws Exception {
        awaitPage("overview keeps exact independent source states, original dates and explicit actions",
            "(() => { const overview = document.querySelector('.managed-company-evidence-actions');" +
            " const expected = [['Price'," + priceLoaded + ",'2026-09-20T00:00:01.000Z'],['Annual'," + annualLoaded + ",'2026-09-20T00:00:02.000Z'],['Filings'," + filingsLoaded + ",'2026-09-20T00:00:02.000Z']];" +
            " return overview?.getAttribute('aria-label') === 'Company research sources' && overview.querySelectorAll('.managed-evidence-action-grid > section').length === 3" +
            " && expected.every(([title,loaded,clock]) => { const card = overview.querySelector('[aria-label=\"' + title + ' source\"]'); const buttons = [...(card?.querySelectorAll('.trial-actions > button') ?? [])]; const times = [...(card?.querySelectorAll('time') ?? [])];" +
            " return card?.getAttribute('aria-busy') === 'false' && card.querySelector('.managed-evidence-source-state')?.textContent === (loaded ? 'Source response loaded.' : 'Not loaded.')" +
            " && times.length === (loaded ? 1 : 0) && (!loaded || (times[0].dateTime === clock && times[0].textContent === clock))" +
            " && buttons.length === 2 && buttons[0].textContent === (loaded ? 'Refresh ' : 'Load ') + title + (title === 'Price' ? ' · One month' : '') && buttons[1].textContent === 'Inspect ' + title" +
            " && buttons.every(button => !button.disabled && button.getBoundingClientRect().height >= 44 && button.getBoundingClientRect().width >= 44); })" +
            " && overview.querySelector('[aria-label=\"Price source\"]')?.textContent.includes('Requested range: One month.')" +
            " && " + (priceLoaded ? "overview.querySelector('[aria-label=\"Price source\"]')?.textContent.includes('Loaded range: One month.')" : "!overview.querySelector('[aria-label=\"Price source\"]')?.textContent.includes('Loaded range:')") +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()");
    }

    private void assertRootHistory() throws Exception {
        assertExactHistory(0, "https://localhost/");
    }

    private void assertReturnedRootHistory(String listing, String section) throws Exception {
        assertExactHistory(0, "https://localhost/", companyUrl(listing, section));
    }

    private void assertCompanyHistory(String listing, String section, boolean direct) throws Exception {
        if (direct) assertExactHistory(0, companyUrl(listing, section));
        else assertExactHistory(1, "https://localhost/", companyUrl(listing, section));
    }

    private String companyUrl(String listing, String section) {
        assertTrue("Only fixed invented company IDs", listing.matches("listing-(zero|one|alfa|beta-a|beta-c)"));
        assertTrue("Only supported public sections", section.equals("price") || section.equals("annual") || section.equals("filings"));
        return "https://localhost/?company=" + listing + "&section=" + section;
    }

    private void assertExactHistory(int expectedIndex, String... expectedUrls) throws Exception {
        awaitPage("exact company URL transition committed",
            "location.href === " + JSONObject.quote(expectedUrls[expectedIndex]));
        scenario.onActivity(activity -> {
            WebView webView = activity.getBridge().getWebView();
            WebBackForwardList history = webView.copyBackForwardList();
            String diagnostic = "index=" + history.getCurrentIndex() + ", size=" + history.getSize() +
                ", canGoBack=" + webView.canGoBack() + ", callbacks=" + activity.getOnBackPressedDispatcher().hasEnabledCallbacks();
            Log.i("ManagedBack", diagnostic);
            assertEquals(diagnostic, expectedIndex, history.getCurrentIndex());
            assertEquals(diagnostic, expectedUrls.length, history.getSize());
            assertEquals(diagnostic, expectedIndex > 0, webView.canGoBack());
            for (int index = 0; index < expectedUrls.length; index++)
                assertEquals(diagnostic, expectedUrls[index], history.getItemAtIndex(index).getUrl());
            assertTrue(diagnostic, activity.getOnBackPressedDispatcher().hasEnabledCallbacks());
            assertEquals(expectedUrls[expectedIndex], webView.getUrl());
        });
    }

    private void selectWorkspaceView(String label) throws Exception {
        onWebView().withElement(findElement(Locator.XPATH,
            "//nav[@aria-label='Workspace']/button[normalize-space(.)='" + label + "']")).perform(webClick());
        String expectedHeading = label.equals("My Watchlist") ? "managed-watchlist-heading" :
            label.equals("Discover") ? "managed-discover-heading" : "managed-markets-heading";
        awaitPage("visible workspace view: " + label,
            "Array.from(document.querySelectorAll('.managed-navigation button')).some(b => b.textContent === " + JSONObject.quote(label) +
            " && b.getAttribute('aria-current') === 'page')" +
            " && document.getElementById(" + JSONObject.quote(expectedHeading) + ")?.closest('section')?.hidden === false");
        if (label.equals("My Watchlist")) assertVisibleWatchlistDraft();
    }

    private void assertVisibleWatchlistDraft() throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "(() => { const choices = Array.from(document.querySelectorAll('.managed-watchlist-choice'));" +
            " return [choices.length, choices.findIndex(choice => choice.getAttribute('aria-pressed') === 'true')]; })()",
            value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Watchlist selection was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        assertNotNull(observed.get());
        org.json.JSONArray selection = new org.json.JSONArray(observed.get());
        int count = selection.getInt(0);
        int selected = selection.getInt(1);
        assertTrue("Only the bounded invented watchlist is inspected", count >= 0 && count <= 3);
        awaitPage("visible listing order matches the current fixture-owned draft",
            "Array.from(document.querySelectorAll('.managed-watchlist-choice')).map(e => e.dataset.watchlistSelection).join('|') === " +
            DRAFT + ".memberships.map(member => member.listingId).join('|')");
        if (count == 0) return;
        assertTrue("Exactly one current listing must be selected", selected >= 0 && selected < count);
        for (int index = 0; index < count; index++) selectWatchlistNote(index);
        selectWatchlistNote(selected);
    }

    private void selectWatchlistNote(int index) throws Exception {
        assertTrue("Only bounded invented note positions are selected", index >= 0 && index < 3);
        awaitPage("watchlist is visible before selecting a note",
            "document.querySelector('[aria-labelledby=managed-watchlist-heading]')?.hidden === false");
        String selector = ".managed-watchlist-choices li:nth-child(" + (index + 1) + ") .managed-watchlist-choice";
        click(selector);
        awaitPage("selected editor retains the exact listing and raw draft at position " + index,
            "(() => { const choice = document.querySelector(" + JSONObject.quote(selector) + ");" +
            " const input = document.getElementById(" + JSONObject.quote("managed-note-" + index) + ");" +
            " const member = " + DRAFT + ".memberships?.[" + index + "];" +
            " return member && choice?.getAttribute('aria-pressed') === 'true'" +
            " && document.querySelectorAll('.managed-watchlist-choice[aria-pressed=true]').length === 1" +
            " && choice.dataset.watchlistSelection === member.listingId" +
            " && input?.dataset.managedNoteListingId === member.listingId" +
            " && input.value === member.note && input.getClientRects().length > 0; })()");
    }

    private void clickWatchlistAction(String label) {
        assertTrue("Only the fixed recovery actions are admitted", label.equals("Save watchlist") ||
            label.equals("Reconcile pending save") || label.equals("Load saved watchlist") || label.equals("Use saved version"));
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='" + label + "']")).perform(webClick());
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

    private double readDocumentTimeOrigin() throws Exception {
        CountDownLatch returned = new CountDownLatch(1);
        AtomicReference<String> observed = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
            "performance.timeOrigin", value -> { observed.set(value); returned.countDown(); }));
        assertTrue("Document time origin was not returned", returned.await(PAGE_TIMEOUT_MS, TimeUnit.MILLISECONDS));
        assertNotNull("Document time origin is absent", observed.get());
        double timeOrigin = Double.parseDouble(observed.get());
        assertTrue("Document time origin must be finite and positive", Double.isFinite(timeOrigin) && timeOrigin > 0);
        return timeOrigin;
    }

    private void assertFixtureBoundary(int expectedResolves, int expectedSaves) throws Exception {
        awaitPage("test-only source, origin and disconnected boundaries",
            "location.origin === 'https://localhost' && location.hash === ''" +
            " && document.querySelector('meta[name=investment-build-sha]')?.content === " + JSONObject.quote(expectedSourceSha) +
            " && document.querySelector('meta[name=investment-android-test]')?.content === 'managed-workspace'" +
            " && document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content === " + JSONObject.quote(CSP) +
            " && window.Capacitor?.getPlatform() === 'android'" +
            " && " + DIAGNOSTICS + ".token === 0 && " + DIAGNOSTICS + ".signOut === 0" +
            " && " + DIAGNOSTICS + ".save === " + expectedSaves + " && " + DIAGNOSTICS + ".resolve === " + expectedResolves);
    }

    private void retainCompletePreviewFrame() throws Exception {
        String selector = "#managed-followup-note-preview";
        page.read(new ReportRevisitPage.Script(
            "(() => { document.querySelector(" + JSONObject.quote(selector) + ").scrollIntoView({block:'center',inline:'center',behavior:'instant'}); return 'preview centered'; })()"));
        String visible = "(() => { const targets = Array.from(document.querySelectorAll(" + JSONObject.quote(selector) + "));" +
            " const v = visualViewport; return v && targets.length === 1 && targets.every(e => {" +
            " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0" +
            " && r.left >= v.offsetLeft && r.right <= v.offsetLeft + v.width" +
            " && r.top >= v.offsetTop && r.bottom <= v.offsetTop + v.height; }); })()";
        Log.i("ManagedFollowupNoteFrame", page.read(new ReportRevisitPage.Script(
            "JSON.stringify((() => { const e=document.querySelector(" + JSONObject.quote(selector) + "),r=e?.getBoundingClientRect(),v=visualViewport;" +
            " return {targetCount:document.querySelectorAll(" + JSONObject.quote(selector) + ").length,rect:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null," +
            " viewport:v?{offsetLeft:v.offsetLeft,offsetTop:v.offsetTop,width:v.width,height:v.height}:null}; })())")));
        page.await(new ReportRevisitPage.Check("complete company note preview fits the native frame", new ReportRevisitPage.Script(visible)).nativeReady());
        new PortfolioReportFrameCapture(new PortfolioReportFrameCapture.Request(scenario, PortfolioReportFrameCapture.Frame.FOLLOWUP_ASSESSMENT_PREVIEW)).retain();
        awaitPage("complete company note preview remains inside the captured frame", visible);
    }

    private void click(String selector) { page.click(ReportRevisitPage.Element.css(selector)); }
    private String readFixtureString(String script) throws Exception { return page.read(new ReportRevisitPage.Script(script)); }
    private void awaitPage(String description, String predicate) throws Exception {
        page.await(new ReportRevisitPage.Check(description, new ReportRevisitPage.Script(predicate)));
    }
    private void awaitPage(String description, String predicate, boolean nativeReady) throws Exception {
        assertTrue(nativeReady);
        page.await(new ReportRevisitPage.Check(description, new ReportRevisitPage.Script(predicate)).nativeReady());
    }
    private void awaitPage(String description, String predicate, boolean nativeReady, View dialog) throws Exception {
        assertTrue(nativeReady);
        page.await(new ReportRevisitPage.Check(description, new ReportRevisitPage.Script(predicate), ReportRevisitPage.Readiness.NATIVE, dialog));
    }
    private void typeIntoInput(String id, String text) throws Exception {
        ReportRevisitTouch.Field field = ReportRevisitTouch.Field.forId(id);
        if (field == ReportRevisitTouch.Field.COMPANY_NOTE) selectWatchlistNote(0);
        keyboard.enter(new ReportRevisitKeyboard.FieldInput(field, text));
    }
    private void closeSoftKeyboard() { keyboard.closeSoftKeyboard(); }
    @After public void closeInventedAssessmentNote() {
        try { if (scenario != null) { scenario.close(); scenario = null; } }
        finally { if (assets != null) assets.close(); }
    }
}
