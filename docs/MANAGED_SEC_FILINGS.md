# Recent company filings

The company visit includes a **Filings** section for the captured listing. Opening
it makes no SEC request. **Load filings** reads metadata from the issuer's
current SEC Submissions object for the last 90 UTC calendar dates, including the
original request date. **Refresh filings** starts another explicit request.

The initial managed cohort is AAPL, GOOG, GOOGL and MSFT. GOOG and GOOGL retain
their separate listing identities while sharing Alphabet's CIK. Catalog identity
determines the issuer; a ticker alone cannot select another issuer or expand
coverage. [Current work](CURRENT_WORK.md) records verification and release status.

## Read the result

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
The filter belongs to the mounted results view: switching sections or closing
the visit clears it. Filing-note actions still use the original observed rows,
and filtering never changes or saves the complete note draft.

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
