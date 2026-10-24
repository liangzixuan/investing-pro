package local.investment.personal;

import org.json.JSONObject;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** Exact predicates and authored content for the additive invented daily review journey. */
final class FollowupsReviewSessionExpectations {
    private static final String DRAFT =
        "JSON.parse(document.getElementById('fixture-workspace-draft').textContent)";
    private static final String DIAGNOSTICS =
        "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    private static final String FOLLOWUPS =
        "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    private static final String FOLLOWUP_DRAFT =
        "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";

    private FollowupsReviewSessionExpectations() {}

    enum Check {
        ZERO, ONE, ALFA;
        String listingId() {
            return switch (this) {
                case ZERO -> "listing-zero";
                case ONE -> "listing-one";
                case ALFA -> "listing-alfa";
            };
        }
        String label() {
            return switch (this) {
                case ZERO -> "ZERO · Zero Company · Class A · XNAS";
                case ONE -> "ONE · One Company · Class A · XNAS";
                case ALFA -> "ALFA · Alfa Company · Common Stock · XNAS";
            };
        }
    }
    record EntryId(UUID value) {
        EntryId {
            Objects.requireNonNull(value);
            if (value.version() != 4) throw new IllegalArgumentException("Expected a generated v4 entry identity");
            if (value.variant() != 2) throw new IllegalArgumentException("Expected a standard entry identity");
        }
        @Override public String toString() { return value.toString(); }
    }
    record WatchlistSnapshot(String serialized) {
        WatchlistSnapshot { Objects.requireNonNull(serialized); }
    }
    record SavedEntriesSnapshot(String serialized) {
        SavedEntriesSnapshot { Objects.requireNonNull(serialized); }
    }
    record ChosenChecks(EntryId first, EntryId second, EntryId unchosen) {}
    record ReviewDraft(ChosenChecks chosen, WatchlistSnapshot watchlist) {}
    record CompanyReview(Check check, EntryId entry, WatchlistSnapshot watchlist) {
        CompanyReview {
            Objects.requireNonNull(check);
            Objects.requireNonNull(entry);
            Objects.requireNonNull(watchlist);
            if (check == Check.ALFA) throw new IllegalArgumentException("The unchosen check has no company review position");
        }
    }
    record RequestCounts(int sessions, int resolves) {
        RequestCounts {
            if (sessions < 1) throw new IllegalArgumentException("Expected a positive session count");
            if (resolves < 0) throw new IllegalArgumentException("Expected a nonnegative explicit resolution count");
        }
    }

    static String sessionReviewQuestion(Check check) {
        return new String[] {
            "Does ZERO still support the authored research question? Keep the exact Class A listing and original evidence dates.",
            "Which ONE evidence would change this assessment? Read the complete question before writing a result.",
            "Keep this unchosen ALFA check and its existing independent assessment in the full saved draft."
        }[check.ordinal()];
    }

    static String sessionReviewResult(Check check) {
        return new String[] {
            "ZERO assessment authored in company research; no source was requested.",
            "ONE assessment authored separately after explicit Continue; no source was requested.",
            "Unchosen assessment stays in the independent full draft."
        }[check.ordinal()];
    }

    static String emptyResource() {
        return FOLLOWUPS + ".load === 1 && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUP_DRAFT + ".entries?.length === 0";
    }

    static String threeChoices() {
        return "document.querySelectorAll('.managed-followups-review-choices > li').length === 3" +
            " && document.querySelector('#managed-followups-review-start')?.disabled === true" +
            " && " + DIAGNOSTICS + ".resolve === 0 && " + DIAGNOSTICS + ".marketsResolve === 1";
    }

    static String chosenOrder(ChosenChecks checks) {
        String first = checks.first().toString(), second = checks.second().toString(), unchosen = checks.unchosen().toString();
        return "document.querySelector('#managed-followups-review-choose-" + first + "')?.textContent === 'Chosen 1: remove this check'" +
            " && document.querySelector('#managed-followups-review-choose-" + second + "')?.textContent === 'Chosen 2: remove this check'" +
            " && document.querySelector('#managed-followups-review-choose-" + unchosen + "')?.getAttribute('aria-pressed') === 'false'";
    }

    static String lastChosen() {
        return "document.querySelector('#managed-followups-review-next')?.disabled === true";
    }

    static String completed(LocalDate observedDay) {
        String day = observedDay.toString();
        return FOLLOWUP_DRAFT + ".entries[0].status === 'completed' && " + FOLLOWUP_DRAFT + ".entries[0].completedOn === " + JSONObject.quote(day) +
            " && " + FOLLOWUPS + ".save === 0 && " + FOLLOWUP_DRAFT + ".dirty === true";
    }

    static String saved(WatchlistSnapshot snapshot) {
        String watchlist = snapshot.serialized();
        return FOLLOWUPS + ".save === 1 && " + FOLLOWUPS + ".commits === 1 && " + FOLLOWUPS + ".version === 1" +
            " && " + FOLLOWUP_DRAFT + ".baseVersion === 1 && " + FOLLOWUP_DRAFT + ".dirty === false" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlist);
    }

    static String dueDate() {
        return "document.querySelector('#managed-followups-new-due')?.value === '2000-01-01'";
    }

    static String added(Check check) {
        int index = check.ordinal();
        String listing = check.listingId();
        return FOLLOWUP_DRAFT + ".entries?.length === " + (index + 1) + " && " + FOLLOWUP_DRAFT + ".entries[" + index + "].listing.listingId === " + JSONObject.quote(listing) +
            " && " + FOLLOWUP_DRAFT + ".entries[" + index + "].check === '' && " + FOLLOWUPS + ".save === 0";
    }

    static String position(CompanyReview review) {
        int index = review.check().ordinal();
        String id = review.entry().toString();
        return "(() => { const panel=document.querySelector('.managed-followups-review > section'), entry=" + FOLLOWUP_DRAFT + ".entries[" + index + "], details=panel?.querySelector(':scope > details'), values=[...details.querySelectorAll('dd')].map(n=>n.textContent);" +
            " return document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check " + (index + 1) + " of 2.')" +
            " && panel.querySelector(':scope > .managed-followups-authored')?.textContent === " + JSONObject.quote(sessionReviewQuestion(review.check())) +
            " && entry.id === " + JSONObject.quote(id) + " && Object.keys(entry.listing).length === 11 && details.open === true" +
            " && values.length === 11 && Object.values(entry.listing).every((value,i)=>values[i]===value)" +
            " && document.querySelector('#managed-followups-review-research')?.disabled === false" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth; })()";
    }

    static String company(CompanyReview review) {
        int index = review.check().ordinal();
        String id = review.entry().toString();
        String symbol = index == 0 ? "ZERO" : "ONE";
        return "document.querySelector('#managed-company-heading')?.textContent === " + JSONObject.quote("Company research · " + symbol) +
            " && document.querySelector('#managed-research-followup-heading')?.textContent === " + JSONObject.quote("Research check for " + symbol) +
            " && document.querySelector('.managed-research-followup-check')?.textContent === " + JSONObject.quote(sessionReviewQuestion(review.check())) +
            " && " + FOLLOWUP_DRAFT + ".entries[" + index + "].id === " + JSONObject.quote(id) + " && " + DIAGNOSTICS + ".resolve === " + (index + 1);
    }

    static String assessment(CompanyReview review) {
        int index = review.check().ordinal();
        String watchlist = review.watchlist().serialized();
        return FOLLOWUP_DRAFT + ".entries[" + index + "].result === " + JSONObject.quote(sessionReviewResult(review.check())) +
            " && " + FOLLOWUP_DRAFT + ".entries[" + index + "].status === 'open' && " + FOLLOWUPS + ".save === 0" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlist);
    }

    static String returned(CompanyReview review) {
        int index = review.check().ordinal();
        String watchlist = review.watchlist().serialized();
        return "document.querySelector('.managed-company-visit') === null" +
            " && document.querySelector('#managed-followups-review-position')?.textContent.startsWith('Check " + (index + 1) + " of 2.')" +
            " && document.querySelector('.managed-followups-review')?.textContent.includes(" + JSONObject.quote(sessionReviewResult(review.check())) + ")" +
            " && document.querySelector('#managed-followups-review-research')?.disabled === false" +
            " && JSON.stringify(" + DRAFT + ") === " + JSONObject.quote(watchlist);
    }

    static String finished(ReviewDraft draft) {
        String first = draft.chosen().first().toString(), second = draft.chosen().second().toString(), unchosen = draft.chosen().unchosen().toString();
        String watchlist = draft.watchlist().serialized();
        return "(() => { const panel=document.querySelector('.managed-followups-review'), entries=" + FOLLOWUP_DRAFT + ".entries, rows=[...panel.querySelectorAll(':scope > section > ol > li')];" +
            " return rows.length===3 && entries.map(e=>e.id).join('|')===" + JSONObject.quote(first + "|" + second + "|" + unchosen) +
            " && entries.every((e,i)=>rows[i].textContent.includes(e.check)&&rows[i].textContent.includes(e.result)&&e.status==='open'&&e.completedOn===null)" +
            " && rows.every((row,i)=>[...row.querySelectorAll('dd')].map(n=>n.textContent).join('|')===Object.values(entries[i].listing).join('|'))" +
            " && document.documentElement.scrollWidth <= document.documentElement.clientWidth" +
            " && entries[2].result===" + JSONObject.quote(sessionReviewResult(Check.ALFA)) +
            " && panel.querySelector('#managed-followups-review-again')?.disabled===false && panel.querySelector('#managed-followups-review-position')===null" +
            " && " + FOLLOWUPS + ".save===0 && " + FOLLOWUPS + ".commits===0 && JSON.stringify(" + DRAFT + ")===" + JSONObject.quote(watchlist) + "; })()";
    }

    static String freshSession() {
        return FOLLOWUPS + ".session===2 && " + FOLLOWUPS + ".load===1 && " + FOLLOWUP_DRAFT + ".entries===null" +
            " && " + DRAFT + ".memberships?.length===3 && " + DRAFT + ".dirty===false && " + DRAFT + ".memberships[0].note===''";
    }

    static String reloaded(SavedEntriesSnapshot snapshot) {
        String complete = snapshot.serialized();
        return FOLLOWUPS + ".load===2 && " + FOLLOWUPS + ".save===1 && " + FOLLOWUPS + ".commits===1" +
            " && " + FOLLOWUP_DRAFT + ".baseVersion===1 && " + FOLLOWUP_DRAFT + ".dirty===false" +
            " && JSON.stringify(" + FOLLOWUP_DRAFT + ".entries)===" + JSONObject.quote(complete) +
            " && document.querySelector('#managed-followups-review-position')===null && document.querySelector('#managed-followups-review-enter')!==null" +
            " && " + DRAFT + ".memberships[1].note==='Invented second note' && " + DRAFT + ".memberships[2].note==='Independent unchosen listing note'";
    }

    static String sources(RequestCounts counts) {
        int sessions = counts.sessions(), resolves = counts.resolves();
        return DIAGNOSTICS + ".load===" + sessions + " && " + DIAGNOSTICS + ".status===" + sessions + " && " + DIAGNOSTICS + ".marketsResolve===" + sessions +
            " && " + DIAGNOSTICS + ".resolve===" + resolves + " && " + DIAGNOSTICS + ".save===0 && " + DIAGNOSTICS + ".search===0" +
            " && " + DIAGNOSTICS + ".eod===0 && " + DIAGNOSTICS + ".annual===0 && " + DIAGNOSTICS + ".filings===0 && " + DIAGNOSTICS + ".marketsEod===0" +
            " && " + DIAGNOSTICS + ".calendar===0 && " + DIAGNOSTICS + ".fed===0 && " + FOLLOWUPS + ".token===0 && " + FOLLOWUPS + ".signOut===0";
    }

    static String unloadedSources(CompanyReview review) {
        boolean priceSupported = review.check() == Check.ZERO;
        return "(() => { const overview=document.querySelector('.managed-company-evidence-actions');" +
            " const expected=[['Price'," + priceSupported + "],['Annual',true],['Filings',true]];" +
            " if(overview?.getAttribute('aria-label')!=='Company research sources'||overview.querySelectorAll('.managed-evidence-action-grid > section').length!==3)return false;" +
            " const valid=expected.every(([title,supported])=>{const card=overview.querySelector('[aria-label=\"'+title+' source\"]'),buttons=[...(card?.querySelectorAll('.trial-actions > button')??[])];" +
            " const labels=supported?['Load '+title+(title==='Price'?' · One month':''),'Inspect '+title]:['Inspect '+title];" +
            " return card?.getAttribute('aria-busy')==='false'&&card.querySelector('.managed-evidence-source-state')?.textContent===(supported?'Not loaded.':'Unsupported listing.')" +
            " && card.querySelectorAll('time').length===0&&!card.textContent.includes('Loaded range:')" +
            " && buttons.length===labels.length&&buttons.every((button,i)=>button.textContent===labels[i]&&!button.disabled&&button.getBoundingClientRect().height>=44&&button.getBoundingClientRect().width>=44);});" +
            " const price=overview.querySelector('[aria-label=\"Price source\"]');" +
            " return valid&&(" + priceSupported + "?price.textContent.includes('Requested range: One month.'):!price.textContent.includes('Requested range:'))" +
            " && document.documentElement.scrollWidth<=document.documentElement.clientWidth;})()";
    }

    static String identityOpen() {
        return "String(document.querySelector('.managed-followups-review > section > details:first-of-type')?.open)";
    }
}
