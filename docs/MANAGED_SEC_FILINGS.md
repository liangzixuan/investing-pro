# Recent company filings

The company visit includes a **Filings** section for the captured listing. Opening
it makes no SEC request. **Load filings** reads metadata from the issuer's
current SEC Submissions object for the last 90 UTC calendar dates, including the
original request date. **Refresh filings** starts another explicit request.

The managed API independently admits Filings for the named 18-listing,
17-issuer [source eligibility cohort](MANAGED_RESEARCH_ELIGIBILITY.md). GOOG and
GOOGL retain their separate listing identities while sharing Alphabet's CIK.
Catalog identity determines the issuer; a ticker alone cannot select another
issuer or expand coverage. Annual and Price keep their own admission rules.
[Current work](CURRENT_WORK.md) records verification and client delivery.

## Review a watchlist group

[Watchlist filing review](MANAGED_FILINGS_REVIEW.md) retains separate packets for
up to five chosen listings. Each company check is explicit. Inspect opens the
checked packet in company research for the existing citation, note and separate
Review/Save workflow; Back retains the group. This source increment does not
change the published client or source coverage. The selected-listing check below
remains independent.

## Check a selected watchlist company

The selected listing in My Watchlist has a **Recent filings** check. Selecting a
listing makes no request. **Load filings**, **Refresh filings** and **Cancel
filings** use the same source, coverage and shared SEC budget as company research.
The summary shows the newest observed row, its exact form, filing date and index
link, and the number of retained rows in the original request window. It does not
claim to show the latest filing overall or assess investment significance.

**Filings source and coverage** keeps the original request and source times,
truncation and unloaded older-history limits. An empty admitted result stays
distinct from an unavailable source. Pending refreshes, Cancel and recoverable
failures retain the earlier packet and its dates; an invalid replacement clears it.

**View filings** opens the existing company Filings view with a separately checked
copy of this packet, without another request. Its filters and reference-to-note
action work as usual. Company Refresh affects that visit's copy. Back preserves
the selected watchlist packet, note and order, and restores the original control.
Viewing retained evidence remains possible during a save conflict; source reads
and note writes keep their existing restrictions.

Only one selected-listing packet is retained in memory. Selecting another listing,
removing or changing that identity, leaving My Watchlist for another workspace
view, catalog invalidation or session retirement clears it. Company visits suspend
pending work while preserving the selected packet for Back. Note edits, ordering
and an explicit Save keep the same identity's packet. No batch read, automatic
refresh, persistent cache or broader issuer coverage is added.

## Read the company result

Filings appear newest first by filed date, with accession order resolving dates
that tie. Each row shows the original form, filed date, available report date and
SEC filing-index link. An absent report date remains unavailable. The page does
not infer a document title, filing contents, materiality or investment meaning.
Previous and next pages move through 25 local rows without another request.

Use **Form** to narrow the loaded rows. **All forms** restores the complete loaded
list; exact forms and amendments remain separate choices. The count compares the
filtered rows with all rows in this packet. It does not describe every filing in
the requested window or replace the source's truncation count. This follows the
form-filtering convention in [SEC company search](https://www.sec.gov/edgar/browse/),
adapted here to the already loaded metadata.

Changing the form returns to page one without another request. A pending refresh,
Cancel or failure retaining the same packet also retains the filter and page.
A new response resets both and announces an actual reset. Empty and unavailable
packets leave the Form control enabled with only All forms and an explanation.
The filters belong to the mounted results view: switching sections or closing
the visit clears them. Filing-note actions still use the original observed rows,
and filtering never changes or saves the complete note draft.

The compact header shows the original inclusive window, CIK, SEC link and source
Retrieved or Checked time. A short coverage limit remains visible with the
filtered count, page and any truncation, unavailable or retained-result warning.
Open **Filings source and coverage** for the original request start/completion,
full coverage explanation and unloaded continuation-file detail. It starts closed;
keyboard or pointer interaction expands it without a request or saved change.
Its open state remains while the results are mounted, including local filtering
and retained refreshes. A replacement updates its fields to the admitted packet.

The result retains its original inclusive window, request start, completion and
source retrieval time. A failed source attempt has a checked time rather than a
claimed successful retrieval. A successful response with no matching filings is
different from an unavailable or uncovered issuer.

Only the current Submissions object is inspected. The service does not request
older continuation files or filing bodies. Their presence is disclosed without
claiming complete coverage of the requested window. The source adapter caps its
body at 4 MiB, inspects at most 10,000 recent rows and retains at most 1,000
matching filings. A truncated result reports the matching count and retained
limit. Identical accession duplicates collapse; conflicting duplicates are
refused. Form amendments remain as supplied by SEC.

## Compare consecutive loaded lists

After a successful company **Refresh filings**, **Newly observed in this refresh**
marks current accessions absent from the previous loaded list. The count covers
the full displayed response, regardless of Form, Filing date or page. An entry's
absence from the earlier list does not establish when SEC published it or that
either list is complete. Different windows and source limits can change which
accessions appear.

The first available result, including an empty result or a checked watchlist
handoff, establishes a baseline without a comparison claim. Each later available
result compares against the preceding accepted list. An equal or empty replacement
can therefore show zero newly observed filings. **Compared loaded lists** retains
both original windows, request, retrieval and completion times, source links,
retained counts, truncation and unloaded continuation limits.

Pending refreshes, Cancel, cooldown and transient failure preserve the displayed
pair and its original dates. A retained-result warning still explains that the
latest attempt did not confirm newer filings. Invalid or ineligible evidence,
closing the visit, identity changes and session retirement clear the pair.
Switching company sections preserves it. The selected watchlist keeps its own
single packet for Back; the comparison belongs only to the company visit.

The comparison retains only the previous and current available lists within the
company visit. Existing latest-attempt metadata remains separate. It adds no
monitoring, stored history or source request. A filing's reference-to-note action uses the
current row and its original evidence; the comparison label is not added to the
note. Review and Save remain explicit.

## Filter newly observed filings

**Refresh view** starts at **All loaded filings**. After an available comparison,
choose **Newly observed in this refresh** to show only current accessions absent
from the preceding loaded list. This combines with Form and Filing date before
paging. Rows keep their original order, links and reference-to-note actions.
The comparison count still describes the complete current response.

The first load and a watchlist handoff have no comparison. They cannot select
this view. A valid comparison with no additions can be selected and shows an
empty result; it does not establish that no new SEC filings exist. Different
windows, truncation and unloaded continuation files still limit both lists.

Choosing a view returns to page one without a request, note change or Save.
Pending, cancelled and transient failed refreshes that retain the same response
and comparison also retain the view and page. A replacement Filings response
resets all filters. A changed or lost comparison resets an active newly observed
view and page while preserving Form and Filing date. A notice explains the reset.
Section remount and visit retirement keep their existing behavior.

## Review filings after an Annual report

When this company visit holds a checked Annual report with a resolved filing,
**Filing date** offers **Filed after Annual report** beside **All loaded filings**.
The baseline must match the current company selections, catalog and CIK in both
loaded packets. Opening Filings or choosing a filter never loads either source.
Use the existing explicit Load or Refresh controls when new evidence is needed.

This scope includes only loaded rows whose filed date is strictly later than the
Annual filing date; it also excludes the Annual accession itself. Other filings
on the same date remain under All loaded filings because these rows do not supply
an intraday ordering. Exact forms and amendments remain distinct. Form, Filing
date and Refresh view combine before local paging; changing a filter returns to page one.

The date beside the control identifies the baseline. **Annual baseline and date
limits** retains its exact form, accession, original SEC index link, report end,
cutoff, completion and Submissions capture time. A retained or historical Annual
report can still provide its original filing date. Unavailable financial measures
do not invalidate otherwise admitted filing metadata. This filter does not assess
a filing's contents or investment significance.

Counts describe matching rows in the loaded packet. No matches does not establish
that no subsequent filings exist. The original 90-date window, truncation and
unloaded older continuation files still limit coverage. The disclosure identifies
when the Annual date lies before or after that loaded window.

Retaining the same packets after a pending, cancelled or failed refresh preserves
the filters and page. A new Filings packet resets Form, date scope, Refresh view
and page.
A changed or unavailable Annual baseline resets an active date scope and page,
while retaining Form and Refresh view. A notice explains an actual reset.
Section remount clears
these presentation choices as before; the admitted source packets remain with
their existing visit owners. Removed focused content falls back to the results
region only if focus has not already moved to another control.

Each visible filing keeps the existing reference-to-note action and explicit
whole-draft Review and Save. Filtering neither appends nor saves a note.

## Request and visit lifetime

Annual and Filings share the existing acknowledged SEC admission budget. A checked
server cooldown applies to both sections, including after navigation; the client
does not invent a successful-request deadline or retry automatically. Upstream
rate limiting carries no fabricated retry time.

A pending refresh, Cancel or transient failure keeps the last validated packet
readable with its original dates and a previous-result notice. A valid empty or
not-covered replacement replaces it. An invalid or mismatched packet clears old
content. Switching sections cancels local work; returning retains accepted data.
Back, a different or invalid catalog identity and session retirement close the
visit and reject late responses. The shared watchlist draft retains its existing
owner, validation and explicit Save action.

## Add a reference to a note

Each observed row offers **Add reference to note draft**. It appends the exact
listing, CIK, form, accession, filed date, available report date and index link
to the company's existing note. The paragraph keeps the original request window
and source timestamps, plus incomplete-coverage, truncation and retained-result
qualifications. It does not fetch filing contents or infer their significance.

The action uses the current admitted response and row. It is unavailable during
a request or while the watchlist cannot be edited. A retained result after Cancel
or a transient failure can be added with its original dates and a notice that
newer filings were not confirmed. Changing the response, visit, listing or session
invalidates old row actions. A company must already belong to the current draft.

Existing text, other notes, ordering and the saved version stay intact. The full
candidate must meet the existing 2,000-character note limit; nothing is truncated
or repaired. An identical complete generated paragraph already in the note is
refused. This is an exact-text check, not a general duplicate-filing detector.
Review the draft and use **Save watchlist** to persist it. Adding a reference
performs no source request or save.

Unavailable row actions remain keyboard-focusable and explain the reason. If a
replacement removes the focused row, the existing results region receives focus
only when focus otherwise falls to the document body. Paging, the note editor and
another control that already received focus keep their position.

## Managed boundary

`POST /v1/managed/sec-filings` accepts only schema version, catalog digest, listing
ID and symbol. The authenticated service resolves the full listing and CIK. The
caller supplies no date, source URL, row limit or watchlist version. The request
cap is 4,096 UTF-8 bytes; the validated response cap is 524,288 bytes.

The server fixes the 90-date window at function entry, before authentication. SEC
admission must complete within two seconds; one guarded Submissions request has
at most 7.5 seconds and must finish before the operation's 9.5-second source
deadline. The whole request, including authentication and serialization, has ten
seconds. Redirects, arbitrary URLs, extra source requests and late completion do
not gain authority. Browser and Android use the same validated response contract.

The existing SEC configuration shape and private admission-row identity remain
unchanged. No additional credential, table, subscription or provider is required
for source implementation. Deployment and live-provider acceptance are separate.
