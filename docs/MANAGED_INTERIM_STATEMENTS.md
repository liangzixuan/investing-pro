# Review reported interim financial statements

This M2 workflow has passed affected local source checks. Android 1.50 remains
the last delivered client. Hosted native execution, API activation, client
delivery and physical-device acceptance remain separate events.

## Load a supported interim report

Company research will have a separate explicit **Load interim report** action.
It uses the admitted exact company and the bounded SEC Submissions window,
followed by Company Facts. Opening a view, selecting cells, preparing a note
or capturing a report does not read a source. Existing Price, Annual and Filings
loads keep their own controls and dates.

The selection is the latest observed eligible 10-Q in that loaded window.
Show its report date, filed date, accession, source clocks and scan coverage.
Incomplete or ambiguous metadata and a newer amendment must not silently fall
back to an older unamended filing. A newer annual filing does not make the
interim period current. Unsupported issuers or evidence remain unavailable.

## Inspect actual reported periods

Income, Balance sheet and Cash flow views use the existing exact US-GAAP/USD
concept registry. These are standardized concept views; Company Facts alone
does not establish where a line appears on the published statements.

A flow retains its full start and end dates, signed exact value and observation
references. An instant retains its as-of date. Two flows with the same end and
different starts are separate cells. Quarter/YTD classification remains unknown
without sufficient evidence. The app must not infer that classification from
duration length, fiscal-period labels or a calendar frame. It does not subtract
flows, infer Q4, annualize results or calculate TTM in this increment.

Conflicting values for one exact period stay unavailable. Missing concepts,
wrong units, invalid rows and scan limits remain explicit. Another accession
cannot fill a selected-filing gap. A per-concept overflow withholds the complete
concept. A whole packet over the transport limit is refused without clipping.

## Keep the review

Select exact cells and preview the full existing company note and proposed
addition. It must fit the current single-line, 2,000-code-point limit. Refuse an
oversized proposal as a whole. Cancel changes nothing. Append consumes the
preview once and updates only the Watchlist draft. Review and Save are separate.

Input, source, company/catalog, route, note-revision, Save and session changes
retire prepared actions. Restoring the former values cannot revive a preview.
A retained previous response keeps its original clocks and warning after a
failed refresh. Late completions cannot restore a retired company visit.

Company reports will capture the exact admitted interim graph once and the
resolved references beside the existing sources. JSON, passive HTML and the
saved-report reader must agree on the complete periods, values and refusals.
Reopening a saved report is read-only and starts no source request. Back keeps
the authored draft; report-file Save and online Watchlist Save stay independent.

The report envelope requires schema 6 and matching native admission. Older
envelopes are refused. The JSON ceiling is 5,996,544 bytes. Actual serialization
checks include both near-2-MiB source graphs, 366 dated prices, 200 filings,
both authored valuation models and an escaped Unicode note. A second report
retains all 3,200 distinct interim cells. Stored references are recomputed from
the admitted graph when a report is reopened. Exact-limit and oversized output
checks keep whole-document refusal. The 8 MiB HTML limit, passive content
policy, fixed style/CSP and chosen-document ownership remain.

## Source and delivery boundaries

[SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
describes standard-taxonomy entity-wide facts and the calendar alignment of
Frames. Exact reported dates remain necessary. The
[SEC staff reporting manual](https://www.sec.gov/about/divisions-offices/division-corporation-finance/financial-reporting-manual/frm-topic-1)
describes interim year-to-date presentations; that context does not classify an
individual Company Facts row.

Use existing source admission, scheduling, deadlines and permitted free sources.
This increment adds no paid source, background monitoring or saved resource.
API/site activation and any new fee or usage charge retain their separate
authorization boundaries. The browser stop remains active. Synthetic fixtures
do not establish owner-record, installation or physical-phone acceptance.
