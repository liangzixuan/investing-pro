# Selected-company SEC quarterly evidence

Partial Cycle 3h-a5 adds **Load SEC quarterly evidence** beside a selected
company's financials. It requests Company Facts and current Submissions for the
issuer's exact admitted catalog CIK. The source view is separate from Tiingo's
fiscal-quarter tables. Loading, refreshing and cancelling are explicit actions.

## What the view establishes

The view preserves exact dated USD observations for `us-gaap:NetIncomeLoss` and
three revenue concepts: `RevenueFromContractWithCustomerExcludingAssessedTax`,
`Revenues`, and `SalesRevenueNet`. Revenue aliases stay distinct. Values are
parsed losslessly into bounded decimal strings in base USD, including zero and
negative values. They are not rescaled using a filing's display caption.

Each observation retains its period start/end, inclusive duration when present,
concept, accession, reported form and filed date, and a Company Facts JSON
pointer. Identical source observations are deduplicated; different durations,
values, accessions and filing metadata remain separate. Output keeps the latest
100 observations for each metric and explicitly reports omissions and truncation.

Joining an accession to this issuer's current Submissions establishes membership
in that response. A matching form and filed date are labelled matched; conflicting
metadata remains visible. Only a joined accession receives a constructed SEC
filing-index link. An accession absent from current Submissions remains unresolved;
the application does not fetch older-history files automatically. Acceptance
timestamps describe acceptance, not proof of first public availability.

The SEC describes Company Facts as standard-taxonomy facts applying to the entire
filing entity, separated by units. Current Submissions is a bounded recent filing
history. See the [SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).

## Compare observations for the same period

Partial Cycle 3h-a6 adds **Compare same period** to a selected loaded observation.
The comparison uses the full retained response, including observations outside
the visible table page. It matches the exact metric, taxonomy, concept, USD unit
and start/end dates within that issuer response. A missing start date cannot
establish the same period. Different revenue concepts and same-end-date periods
with different starts remain separate.

The result distinguishes a single retained observation, agreement on the same
value, and different reported values. Values are compared as canonical decimal
strings without floating-point conversion. Counts distinguish observations from
unique accessions and unique values. Multiple values within one accession are
flagged separately; metadata variants are preserved. Rows show their filed dates,
forms, accessions and filing-match status. Only matched metadata receives a filing
link. Filed-date ordering does not establish a preferred revision or an order
within the same date.

Comparison, pagination and dismissal make no requests. Changing the metric clears
the selected comparison; refresh, cancellation and changes to the selected
company, catalog or owner session clear it with the loaded evidence. Truncation,
excluded source rows, unavailable filing metadata and older-history limits remain
visible. A single observation means no other matching observation was retained,
not that the amount was never revised. Agreement is limited to the loaded rows;
different values do not establish a restatement or a usable revision operand.

## What remains unresolved

Actual dates and duration do not classify a fact as a standalone fiscal quarter.
Company Facts `fy` and `fp` are displayed as filing-focus metadata, never assigned
to an observation's fiscal slot. Calendar `frame` labels do not prove the issuer's
fiscal calendar, including week-based or transition years. Annual and year-to-date
observations may therefore appear alongside shorter periods with the same end date.

No revision is selected as an operand, no revenue aliases are stitched together,
and no common revision-set identifier is invented. The existing
[quarterly compatibility assessment](./PERSONAL_QUARTERLY_COMPATIBILITY.md) is
unchanged. TTM stays unavailable until period, calendar and revision admission is
implemented and validated against filing evidence. This view makes source
observations inspectable; it does not provide point-in-time history or an aggregate.

## Setup and limits

Use the existing `PERSONAL_SEC_USER_AGENT` startup setting with an application
name and the owner's real contact email. No API key is required. A missing or
invalid contact yields a configuration message on an explicit load; it is not
replaced with a fabricated contact. Tiingo configuration is independent.

The server makes at most two fixed-host GETs per load, rejects redirects, and
limits each response to 8 MiB and 10 seconds after obtaining a shared request
permit. The three SEC features share a process-wide scheduler with at least
220 ms between dispatches and a bounded queue. Existing annual-screen and
watchlist-specific spacing remains in place. Source operations require the active
local owner session and an exact catalog digest/listing/symbol match.

At most 20,000 requested USD candidate rows and 10,000 current Submissions rows
are admitted. Exceeding a candidate cap produces an explicit source limit status
instead of displaying a partial input prefix. Source failures are reported
separately, allowing Company Facts observations to remain useful when Submissions
is unavailable. There are no automatic retries, history pagination or server
cache for this view. Refresh performs a new bounded load.

Results remain in active session memory. Selection/catalog/session changes,
cancel and unmount abort the request and invalidate late responses. Responses and
errors carry no contact value. Shutdown closes the provider and stops pending work.
See the [SEC developer access guidance](https://www.sec.gov/about/webmaster-frequently-asked-questions).

## Acceptance

Synthetic transport, route, browser-client and component tests cover exact decimal
values, comparative filing focus, concepts, durations, accession membership,
conflicts, missing USD, bounded responses, cancellation and stale context. They do
not establish live coverage. Live validation still requires configured owner
sources and comparisons against independent filings, including comparative
periods, amendments, missing units and week-based calendars. No live-source or
20-issuer validation claim is made by this slice.

Comparison tests additionally cover exact large/negative/zero values, aliases,
distinct periods, missing starts, metadata variants, same-accession conflicts,
stable ordering, full-response grouping and lifecycle cleanup. This local
comparison does not fetch or parse a filing document. Source fact/context
correspondence remains the next independent source-evidence outcome.
