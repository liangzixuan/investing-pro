# Recent SEC filings for My Watchlist

This first partial Cycle 3l-a slice adds an explicit recent-filings view to
Discover. Select up to 20 saved listings and load filings dated within the last
7, 30, or 90 days. Multiple selected share classes of one SEC registrant use one
request and appear together on each filing. Filing dates, forms, reporting dates,
source links, and source coverage make the result reviewable.

## Source and setup

The view uses the SEC's public [submissions API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces):
`https://data.sec.gov/submissions/CIK##########.json`. It needs no subscription or
API key. Set the existing server-only `PERSONAL_SEC_USER_AGENT` to an application
name and real contact email, as in the [workspace startup example](../README.md).
The same setting enables annual financial screening. Neither feature loads SEC
data on application startup.

The SEC requires an identifying User-Agent and limits aggregate traffic to 10
requests per second. See its [developer guidance](https://www.sec.gov/about/developer-resources)
and [FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions).
The filings adapter spaces sequential requests by at least 300 ms; the annual
frames adapter uses 220 ms. Each permits one active source operation, keeping the
combined traffic from one workspace process below that ceiling. Other applications
or additional workspace processes using the same connection are outside this
local bound.

## User workflow

1. Save companies in My Watchlist, then choose the listings to check. Small
   watchlists initially select all entries. Larger watchlists require an explicit
   selection; no hidden request traverses the entire list.
2. Choose a date window and select **Load recent filings**. This sends only saved
   listing identifiers to the local API. The server resolves their admitted CIKs.
3. Inspect the filing list and coverage. Open the SEC filing index or the saved
   company's research view. Pagination uses the same loaded response.
4. Load again to check for changes. Changing the selection, date window, catalog,
   watchlist version, or owner-session availability invalidates the old view.

## Meaning and limits

- These are already-filed SEC records. A filing date is a calendar date, not an
  upcoming earnings date or an exact publication timestamp. Observation times
  are shown separately in UTC. Lookback windows use UTC calendar dates, including
  today; seven days includes today and the preceding six dates.
- The SEC current submissions object supplies at least one year or 1,000 recent
  filings, whichever is greater. Older continuation files are not followed.
  Their presence is visible. Only the current object is inspected.
- The adapter validates returned CIK, aligned arrays, real dates, accession
  format, and bounded form text. Identical duplicate accessions collapse;
  conflicting duplicates make that issuer unavailable. Amendments keep their
  own accession. No form is interpreted as proof of earnings or a material event.
- Failed, rate-limited, uncovered, and invalid issuer responses remain visible.
  A successfully checked issuer with no matching filings differs from a failure.
  Selected and unrequested listing counts are explicit.
- An operation selects at most 20 listings and therefore at most 20 registrants.
  Each response has a 10-second deadline, a 4 MiB streaming byte limit, and a
  10,000-row parsing limit. At most 1,000 matching filings per issuer and 1,000
  combined filings are returned, newest date first. Matching counts and
  truncation flags disclose retained-result limits.
- Source requests use fixed SEC URLs, declared contact headers, omitted
  credentials, no cache/referrer, and rejected redirects. There are no retries,
  background polling, older-file traversal, document downloads, or news feeds.
  Source links are reconstructed using the SEC's documented filing-index URL
  convention; upstream document filenames or arbitrary URLs are never followed.
- Filing metadata stays in the active operation and browser view. No raw SEC
  response or filing document is written to the vault. Saved watchlist entries
  retain the existing encrypted persistence behavior.

## Acceptance and remaining work

Engineering acceptance covers source normalization and transport bounds, owner
authentication, saved-identity resolution, version changes during a source load,
partial/empty coverage, strict browser response validation, stale-result
invalidation, selection bounds, and pagination. The release also requires a
clean-source local gate and applicable hosted checks; actual results belong in
the release handoff.

No live SEC request or owner-catalog coverage measurement is recorded at the
start of this slice. Contact/startup configuration is needed for live validation.
Synthetic tests prove behavior for their fixtures, not real-market coverage.

Cycle 3l remains partial. Upcoming earnings, dividends, permitted news,
estimates, ownership events, transcripts, and persistent alerts still need
their respective sources and implementation. Holdings and portfolio analysis
remain a separate next milestone.
