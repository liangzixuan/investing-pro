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
owner, validation and explicit Save action. Filings adds no note action or save.

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
