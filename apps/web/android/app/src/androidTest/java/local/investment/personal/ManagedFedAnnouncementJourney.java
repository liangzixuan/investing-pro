package local.investment.personal;

import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.junit.Assert.assertEquals;
import static local.investment.personal.ManagedWorkspaceInstrumentedTest.CATALOG_REFRESH;
import static local.investment.personal.ManagedWorkspaceInstrumentedTest.DRAFT;
import static local.investment.personal.ManagedWorkspaceInstrumentedTest.DIAGNOSTICS;
import static local.investment.personal.ManagedWorkspaceInstrumentedTest.NOTE;

import androidx.test.espresso.web.webdriver.Locator;
import org.json.JSONObject;

/** One fixture-owned Fed workflow; shared native primitives stay with the test owner. */
final class ManagedFedAnnouncementJourney {
    private final ManagedWorkspaceInstrumentedTest fixture;

    ManagedFedAnnouncementJourney(ManagedWorkspaceInstrumentedTest fixture) {
        this.fixture = fixture;
    }

    void run() throws Exception {
        double documentTimeOrigin = fixture.readDocumentTimeOrigin();
        loadBaselineWithDraft();
        retainUnconfirmedReads();
        replaceWithEmptyFeed();
        cancelOnNavigationAndReplaceFeed();
        appendAndSaveFedReference();
        retireDuringHeldRead();
        assertEquals("Announcements preserve the document", documentTimeOrigin, fixture.readDocumentTimeOrigin(), 0.0);
        fixture.assertFixtureBoundary(0, 1);
    }

    private void loadBaselineWithDraft() throws Exception {
        fixture.awaitPage("Federal Reserve feed is unloaded until explicitly requested",
            "document.querySelector('.fed-announcements') !== null && document.querySelector('.fed-announcements time') === null" +
            " && document.querySelector('.fed-announcements-actions > button')?.textContent === 'Load announcements'" +
            " && document.querySelector('.fed-announcements-actions > button')?.getBoundingClientRect().height >= 44");
        assertFedCounts(0, 0, 0, 0, 1);
        fixture.selectWorkspaceView("My Watchlist");
        fixture.click("button[aria-label='Move ZERO down']");
        fixture.awaitPage("announcements test reorders the draft before editing",
            "document.querySelector('.managed-watchlist-choices li > button > strong')?.textContent === 'ONE'");
        fixture.typeIntoInput("managed-note-1", NOTE);
        fixture.selectWorkspaceView("Markets");
        assertFedDraft();
        clickFedAction("Load announcements");
        assertFedPacket("2026-10-20T18:00:00.000Z");
        fixture.awaitPage("first admitted feed establishes only a baseline",
            "document.querySelector('.managed-fed-refresh-comparison') === null" +
            " && document.querySelectorAll('.fed-announcements-new').length === 0" +
            " && document.querySelector('#managed-fed-updates-view')?.value === 'all'" +
            " && document.querySelector('#managed-fed-updates-view option[value=new]')?.disabled === true" +
            " && document.querySelector('#managed-fed-updates-view')?.getBoundingClientRect().height >= 44");
        assertFedCounts(1, 0, 0, 0, 1);
        fixture.awaitPage("loaded Fed note tools start closed with original sources and titles outside",
            "document.querySelector('#managed-fed-note-disclosure')?.open === false" +
            " && document.querySelector('#managed-fed-note-disclosure-toggle')?.textContent === 'Add an announcement to a note'" +
            " && document.querySelector('#managed-fed-note-disclosure-toggle')?.getBoundingClientRect().height >= 44" +
            " && document.querySelector('#managed-fed-note-disclosure #managed-fed-note-announcement') !== null" +
            " && document.querySelector('.fed-announcements-source')?.closest('details') === null" +
            " && document.querySelector('.fed-announcements-list')?.closest('details') === null");
        fixture.typeIntoInput("managed-fed-title-search", "no matching invented title");
        fixture.awaitPage("title search shares an empty view with the note picker without a read",
            "document.querySelector('#managed-fed-title-count')?.textContent.includes('0 of 2 loaded announcements.')" +
            " && document.querySelector('.fed-announcements-list') === null" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 1" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('No loaded announcements match this title search.')" +
            " && document.querySelector('#managed-fed-title-search')?.getBoundingClientRect().height >= 44");
        clickFedAction("Clear title search");
        assertFedPacket("2026-10-20T18:00:00.000Z");
        fixture.typeIntoInput("managed-fed-title-search", "  INVENTED  ");
        assertFedCounts(1, 0, 0, 0, 1);
    }

    private void retainUnconfirmedReads() throws Exception {
        clickFedAction("Refresh announcements");
        fixture.awaitPage("failed refresh qualifies the retained original feed",
            "document.querySelector('.fed-announcements [role=alert]')?.textContent.includes('previously loaded announcements')" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Previous announcements. This attempt has not confirmed a newer feed.')");
        assertFedPacket("2026-10-20T18:00:00.000Z");
        assertFedCounts(2, 0, 0, 0, 1);
        clickFedAction("Refresh announcements");
        fixture.awaitPage("third announcements read is held", DIAGNOSTICS + ".fed === 3" +
            " && document.querySelector('.fed-announcements [aria-busy=true]') !== null");
        clickFedAction("Cancel announcements");
        assertFedCounts(3, 1, 0, 0, 1);
        fixture.click("#settle-cancelled-announcements");
        assertFedCounts(3, 1, 1, 0, 1);
        assertFedPacket("2026-10-20T18:00:00.000Z");
        fixture.awaitPage("failure, held read, Cancel and late settlement preserve the title query",
            "document.querySelector('#managed-fed-title-search')?.value === '  INVENTED  '" +
            " && document.querySelector('#managed-fed-title-count')?.textContent.includes('2 of 2 loaded announcements.')");
        fixture.awaitPage("Cancel preserves the original fetchedAt and qualifies retained content",
            "document.querySelector('.fed-announcements [role=status]')?.textContent === 'Announcements refresh cancelled. Refresh again when ready.'" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Previous announcements.')");
        assertFedDraft();
    }

    private void replaceWithEmptyFeed() throws Exception {
        clickFedAction("Refresh announcements");
        assertFedEmpty();
        assertFedComparison("2026-10-20T18:00:00.000Z", "2026-10-21T18:00:00.000Z", 0, 0);
        fixture.awaitPage("accepted empty replacement clears the query with an explicit reset notice",
            "document.querySelector('#managed-fed-title-search')?.value === ''" +
            " && document.querySelector('#managed-fed-title-count')?.textContent.includes('Feed response changed; showing all loaded announcements.')");
        fixture.click(".managed-fed-refresh-comparison summary");
        fixture.awaitPage("comparison disclosure opens with an accessible native target",
            "document.querySelector('.managed-fed-refresh-comparison details')?.open === true" +
            " && document.querySelector('.managed-fed-refresh-comparison summary')?.getBoundingClientRect().height >= 44");
        assertFedCounts(4, 1, 1, 0, 1);
        fixture.awaitPage("valid empty replacement clears old failures and retained qualification",
            "document.querySelector('.fed-announcements [role=alert]') === null" +
            " && !document.querySelector('.fed-announcements').textContent.includes('Previous announcements.')");
        fixture.chooseNativeSelectOption("#managed-fed-updates-view", "new", "Newly observed links");
        fixture.awaitPage("empty comparison remains an available zero-result updates view",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelector('#managed-fed-updates-view option[value=new]')?.disabled === false" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('No announcements were listed in this loaded feed.')");
    }

    private void cancelOnNavigationAndReplaceFeed() throws Exception {
        clickFedAction("Refresh announcements");
        fixture.awaitPage("fifth announcements read is pending before navigation", DIAGNOSTICS + ".fed === 5" +
            " && document.querySelector('.fed-announcements [aria-busy=true]') !== null" +
            " && document.querySelector('#managed-fed-updates-view')?.value === 'new'");
        fixture.selectWorkspaceView("My Watchlist");
        assertFedCounts(5, 2, 1, 0, 1);
        fixture.selectWatchlistNote(0);
        fixture.chooseNativeSelectOption("#managed-watchlist-search-scope", "notes", "Research notes");
        fixture.typeIntoInput("managed-watchlist-search", "Invented second");
        fixture.awaitPage("Fed review will target a different note outside the retained notes search",
            "document.querySelector('#managed-note-0')?.dataset.managedNoteListingId === 'listing-one'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && document.querySelector('.managed-watchlist-choice[aria-pressed=true]')?.dataset.watchlistSelection === 'listing-one'");
        fixture.click("#settle-cancelled-announcements");
        assertFedCounts(5, 2, 2, 0, 1);
        assertFedDraft();
        fixture.selectWorkspaceView("Markets");
        assertFedEmpty();
        assertFedComparison("2026-10-20T18:00:00.000Z", "2026-10-21T18:00:00.000Z", 0, 0);
        fixture.awaitPage("navigation remount resets the reading view without another feed request",
            "document.querySelector('#managed-fed-updates-view')?.value === 'all'" +
            " && document.querySelector('#managed-fed-title-search')?.value === ''");
        assertFedCounts(5, 2, 2, 0, 1);
        clickFedAction("Refresh announcements");
        assertFedPacket("2026-10-23T18:00:00.000Z");
        assertFedComparison("2026-10-21T18:00:00.000Z", "2026-10-23T18:00:00.000Z", 2, 2);
        fixture.awaitPage("newly observed markers preserve both current links and note choices",
            "Array.from(document.querySelectorAll('.fed-announcements-new')).every(label => label.textContent === 'Newly observed in this refresh')" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 2" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 3");
        assertFedCounts(6, 2, 2, 0, 1);
        assertFedDraft();
        fixture.chooseNativeSelectOption("#managed-fed-updates-view", "new", "Newly observed links");
        fixture.typeIntoInput("managed-fed-title-search", "WITHOUT A PUBLICATION");
        fixture.awaitPage("updates and title search share one current reference while full comparison remains visible",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelector('#managed-fed-title-count')?.textContent.includes('1 of 2 loaded announcements.')" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 1" +
            " && document.querySelector('.fed-announcements-list li > a')?.href === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 2" +
            " && document.querySelector('.managed-fed-refresh-count')?.textContent === 'Newly observed in this refresh: 2 of 2 links in the loaded feed.'" +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === false");
        clickFedAction("Clear title search");
        fixture.awaitPage("clearing the title search retains the explicitly selected updates view",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 2");
        fixture.chooseNativeSelectOption("#managed-fed-updates-view", "all", "All loaded announcements");
        assertFedCounts(6, 2, 2, 0, 1);
    }

    private void retireDuringHeldRead() throws Exception {
        clickFedAction("Refresh announcements");
        fixture.awaitPage("seventh announcements read is held before session expiry", DIAGNOSTICS + ".fed === 7" +
            " && document.querySelector('.fed-announcements [aria-busy=true]') !== null");
        fixture.chooseNativeSelectOption("#managed-fed-updates-view", "new", "Newly observed links");
        fixture.awaitPage("the retained comparison remains readable during a pending feed request",
            "document.querySelector('#managed-fed-updates-view')?.value === 'new'" +
            " && document.querySelector('#managed-fed-updates-view')?.disabled === false");
        fixture.click(CATALOG_REFRESH);
        fixture.awaitPage("expired session removes the loaded feed and unsaved draft",
            DIAGNOSTICS + ".status === 2 && document.querySelector('.managed-navigation') === null" +
            " && document.querySelector('.fed-announcements') === null" +
            " && " + DRAFT + ".phase === 'retired' && " + DRAFT + ".memberships === null" +
            " && " + DRAFT + ".baseVersion === null && " + DRAFT + ".dirty === false");
        fixture.click("#settle-cancelled-announcements");
        assertFedCounts(7, 3, 3, 1, 2);
        fixture.awaitPage("late announcements cannot remount a retired session",
            "document.querySelector('.fed-announcements') === null && document.querySelector('.managed-navigation') === null" +
            " && !document.body.textContent.includes('Invented monetary policy announcement')" +
            " && !document.body.textContent.includes(" + JSONObject.quote(NOTE) + ")");
    }

    private void clickFedAction(String label) {
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[contains(@class,'fed-announcements')]//button[normalize-space(.)='" + label + "']")).perform(webClick());
    }

    private void assertFedPacket(String fetchedAt) throws Exception {
        fixture.awaitPage("Fed packet preserves source identities, exact dates and absent publication time",
            "document.querySelector('.fed-announcements-note time')?.dateTime === " + JSONObject.quote(fetchedAt) +
            " && Array.from(document.querySelectorAll('.fed-announcements-list li > a')).map(e => e.textContent).join('|') === 'Invented monetary policy announcement|Invented announcement without a publication time'" +
            " && document.querySelector('.fed-announcements-list li:first-child time')?.dateTime === '2026-10-19T18:00:00.000Z'" +
            " && document.querySelector('.fed-announcements-list li:last-child p')?.textContent === 'Unknown publication time'" +
            " && document.querySelector('.fed-announcements-list li:first-child a')?.href === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019a.htm'" +
            " && document.querySelector('.fed-announcements-source a')?.href === 'https://www.federalreserve.gov/feeds/feeds.htm'" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Loaded 2 of 2 announcements from this feed.')");
    }

    private void assertFedComparison(String previousAt, String currentAt, int newlyObserved, int currentCount) throws Exception {
        fixture.awaitPage("compared feeds retain both original clocks and the complete current-list count",
            "document.querySelector('.managed-fed-refresh-count')?.textContent === " +
            JSONObject.quote("Newly observed in this refresh: " + newlyObserved + " of " + currentCount + " links in the loaded feed.") +
            " && Array.from(document.querySelectorAll('.managed-fed-refresh-comparison time')).map(time => time.dateTime).join('|') === " +
            JSONObject.quote(previousAt + "|" + currentAt) +
            " && document.querySelector('.managed-fed-refresh-comparison summary')?.textContent === 'Compared loaded feeds'" +
            " && document.querySelectorAll('.fed-announcements-new').length === " + newlyObserved);
    }

    private void assertFedEmpty() throws Exception {
        fixture.awaitPage("valid empty feed replaces prior items with its own exact fetchedAt",
            "document.querySelector('.fed-announcements-note time')?.dateTime === '2026-10-21T18:00:00.000Z'" +
            " && document.querySelector('.fed-announcements-list') === null" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('Loaded 0 of 0 announcements from this feed.')" +
            " && document.querySelector('.fed-announcements')?.textContent.includes('No announcements were listed in this loaded feed.')");
    }

    private void assertFedDraft() throws Exception {
        fixture.awaitPage("announcements preserve complete unsaved watchlist order, notes and version",
            DRAFT + ".memberships?.[1]?.note === " + JSONObject.quote(NOTE) +
            " && " + DRAFT + ".memberships?.[0]?.note === 'Invented second note'" +
            " && " + DRAFT + ".memberships?.map(member => member.symbol).join(',') === 'ONE,ZERO'" +
            " && " + DRAFT + ".baseVersion === 1 && " + DRAFT + ".dirty === true");
    }

    private void appendAndSaveFedReference() throws Exception {
        String complete = "Draft survives native Back Observed Federal Reserve announcement: Invented announcement without a publication time. Announcement URL: https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm. Source publication time: unknown. Source: Board of Governors of the Federal Reserve System; monetary-policy feed https://www.federalreserve.gov/feeds/press_monetary.xml. Original feed retrieved at: 2026-10-23T18:00:00.000Z (UTC). Only feed metadata was loaded; article contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
        String originalDraft = fixture.readFixtureString("JSON.stringify(" + DRAFT + ")");
        fixture.awaitPage("Fed reference starts with two explicit empty choices",
            "document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === ''" +
            " && document.querySelector('.managed-fed-note-action button')?.getAttribute('aria-disabled') === 'true'");
        fixture.click("#managed-fed-note-disclosure-toggle");
        fixture.awaitPage("Fed note tools open explicitly before a reference choice",
            "document.querySelector('#managed-fed-note-disclosure')?.open === true");
        fixture.chooseNativeSelectOption("#managed-fed-note-announcement",
            "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm",
            "Invented announcement without a publication time");
        fixture.chooseNativeSelectOption("#managed-fed-note-destination", "listing-zero", "ZERO · Zero Company · Class A · XNAS");
        fixture.typeIntoInput("managed-fed-title-search", " MONETARY   POLICY ");
        fixture.awaitPage("excluding the chosen announcement clears it while preserving its exact destination and whole-feed count",
            "document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && document.querySelectorAll('.fed-announcements-list li').length === 1" +
            " && document.querySelector('.managed-fed-note-action')?.textContent.includes('The chosen announcement is outside the current announcement view.')" +
            " && document.querySelector('.managed-fed-refresh-count')?.textContent.includes('2 of 2 links in the loaded feed.')");
        clickFedAction("Clear title search");
        fixture.awaitPage("Clear requires a fresh announcement choice without a fallback",
            "document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && document.querySelectorAll('#managed-fed-note-announcement option').length === 3");
        fixture.typeIntoInput("managed-fed-title-search", " WITHOUT A   PUBLICATION ");
        fixture.chooseNativeSelectOption("#managed-fed-note-announcement",
            "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm",
            "Invented announcement without a publication time");
        assertFedDraft();
        assertFedCounts(6, 2, 2, 0, 1);
        clickFedAction("Add announcement to note draft");
        String exact = "(() => { const expected = JSON.parse(" + JSONObject.quote(originalDraft) + ");" +
            " expected.memberships[1].note = " + JSONObject.quote(complete) + ";" +
            " return JSON.stringify(" + DRAFT + ") === JSON.stringify(expected); })()";
        fixture.awaitPage("Fed reference appends only the chosen note and retains all original metadata", exact +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'Announcement reference added to the ZERO (Class A, XNAS) note draft. Review and save all changes in My Watchlist.'" +
            " && document.activeElement === document.querySelector('.managed-fed-note-action button')");
        clickFedAction("Add announcement to note draft");
        fixture.awaitPage("an identical Fed reference cannot append twice", exact +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'This exact announcement reference is already in the note draft.'");
        assertFedCounts(6, 2, 2, 0, 1);
        fixture.touchInput("managed-fed-title-search");
        fixture.replaceFocusedInput("managed-fed-title-search", " WITHOUT A   PUBLICATION ", " WITHOUT ");
        fixture.awaitPage("a matching query keeps the selected announcement and duplicate feedback for Review", exact +
            " && document.querySelector('#managed-fed-note-announcement')?.value === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'This exact announcement reference is already in the note draft.'");
        fixture.click("#managed-fed-note-disclosure-toggle");
        fixture.awaitPage("closing Fed tools preserves exact choices feedback and the whole draft", exact +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === false" +
            " && document.activeElement === document.querySelector('#managed-fed-note-disclosure-toggle')" +
            " && document.querySelector('#managed-fed-note-announcement')?.value === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && document.querySelector('.managed-fed-note-status')?.textContent === 'This exact announcement reference is already in the note draft.'");
        fixture.click("#managed-fed-note-disclosure-toggle");
        fixture.awaitPage("reopening Fed tools keeps the chosen reference and Review", exact +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === true" +
            " && document.querySelector('#managed-fed-note-announcement')?.value === 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm'" +
            " && document.querySelector('#managed-fed-note-destination')?.value === 'listing-zero'" +
            " && Array.from(document.querySelectorAll('.managed-fed-note-action button')).some(button => button.textContent === 'Review in My Watchlist')");
        clickFedAction("Review in My Watchlist");
        fixture.awaitPage("Fed Review opens and focuses its exact destination while preserving the complete draft and search", exact +
            " && document.querySelector('.managed-navigation [aria-current=page]')?.textContent === 'My Watchlist'" +
            " && document.querySelector('#managed-note-1')?.dataset.managedNoteListingId === 'listing-zero'" +
            " && document.activeElement === document.querySelector('#managed-note-1-reading-toggle')" +
            " && document.querySelector('#managed-watchlist-search')?.value === 'Invented second'" +
            " && document.querySelector('#managed-watchlist-search-scope')?.value === 'notes'" +
            " && document.querySelector('#managed-watchlist-search-count')?.textContent === '1 of 2 listings'" +
            " && document.querySelector('.managed-watchlist-detail')?.textContent.includes('Selected ZERO is outside this search.')");
        fixture.assertFullNoteReading("managed-note-1", complete, true);
        assertFedCounts(6, 2, 2, 0, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Save watchlist']")).perform(webClick());
        String saved = "(() => { const expected = JSON.parse(" + JSONObject.quote(originalDraft) + ");" +
            " expected.memberships[1].note = " + JSONObject.quote(complete) + "; expected.baseVersion = 2; expected.dirty = false;" +
            " return JSON.stringify(" + DRAFT + ") === JSON.stringify(expected); })()";
        fixture.awaitPage("explicit Save acknowledges the exact Fed note and full reordered payload", saved +
            " && document.body.textContent.includes('Version 2 · Saved')");
        assertFedCounts(6, 2, 2, 1, 1);
        onWebView().withElement(findElement(Locator.XPATH,
            "//section[@aria-labelledby='managed-watchlist-heading']//button[normalize-space(.)='Load saved watchlist']")).perform(webClick());
        fixture.awaitPage("reload preserves the full saved Fed reference and other note", saved +
            " && document.querySelector('#managed-note-1')?.value === " + JSONObject.quote(complete) +
            " && document.querySelector('#managed-note-1')?.disabled === false");
        assertFedCounts(6, 2, 2, 1, 2);
        fixture.assertFullNoteReading("managed-note-1", complete, true);
        fixture.selectWorkspaceView("Markets");
        assertFedPacket("2026-10-23T18:00:00.000Z");
        assertFedComparison("2026-10-21T18:00:00.000Z", "2026-10-23T18:00:00.000Z", 2, 2);
        fixture.awaitPage("returning to Markets requires fresh choices without another feed read", saved +
            " && document.querySelector('#managed-fed-note-announcement')?.value === ''" +
            " && document.querySelector('#managed-fed-note-destination')?.value === ''" +
            " && document.querySelector('#managed-fed-note-disclosure')?.open === false");
        assertFedCounts(6, 2, 2, 1, 2);
    }

    private void assertFedCounts(int reads, int aborted, int late, int saves, int loads) throws Exception {
        fixture.awaitPage("bounded Fed reads and explicit watchlist operations without another source request",
            DIAGNOSTICS + ".fed === " + reads + " && " + DIAGNOSTICS + ".fedAborted === " + aborted +
            " && " + DIAGNOSTICS + ".fedLateResolved === " + late + " && " + DIAGNOSTICS + ".save === " + saves +
            " && " + DIAGNOSTICS + ".load === " + loads + " && " + DIAGNOSTICS + ".calendar === 0" +
            " && " + DIAGNOSTICS + ".annual === 0 && " + DIAGNOSTICS + ".filings === 0" +
            " && " + DIAGNOSTICS + ".eod === 0 && " + DIAGNOSTICS + ".marketsEod === 0");
    }
}
