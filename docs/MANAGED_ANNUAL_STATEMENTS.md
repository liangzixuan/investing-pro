# Standardized annual statement explorer

Implementation is in progress. This guide defines one complete company research
workflow. It does not establish source, browser, Android or production acceptance.

The active source uses the existing explicit Annual load and its two SEC requests:
current Submissions metadata followed by Company Facts for the selected issuer.
It shows Income, Balance sheet and Cash flow groups of exact reported US-GAAP
concepts. This is a standardized view of those concepts. Company Facts does not
establish their position on the face of an issuer's published statements.

## Read and inspect statements

Each flow cell keeps its actual start date, end date, full USD amount and sign.
Balance cells keep their instant date. Up to three displayed dates come from the
selected annual filing, including its report date. Comparative dates do not imply
consecutive fiscal years or an as-originally-filed history.

Revenue retains three separately named concept bases. An absent exact concept
stays unavailable. The view must expose missing units, invalid periods, conflicting
facts, unmatched filing metadata and scan limits independently for each cell.
Missing income cannot hide valid balance or cash flow evidence. Older accessions
cannot fill a gap. Different period starts must remain visible.

Labels must describe the exact concept. Parent equity excludes noncontrolling
interests. Net PP&E is a balance; PP&E purchase payments are a reported flow and
do not cover every form of capital expenditure. Current and noncurrent long-term
debt are separate reported amounts. The view must not infer comprehensive debt,
EBITDA, FCFF, statement totals or accounting equations from these lines.

## Continue into the note and report

The owner selects specific cells, then previews the complete current watchlist
note before a single-use Append action. The existing Review, Save, conflict and
uncertain-save recovery controls retain ownership of persistence. A complete note
over the existing 2,000-character limit is refused without clipping.

Refresh, edited selection, changed note, company/catalog change, navigation and
session retirement must invalidate old prepared actions. A failed refresh must
keep the last admitted report and its original source dates under the existing
recovery rules. No automatic refresh, source request or Save is added.

Captured JSON and HTML reports must preserve the complete admitted observation
graph, scan coverage, exact cells and refusals. Report preparation does not renew
source dates. A report must serialize canonical evidence explicitly; sharing
object references in memory does not prevent duplicate JSON output.

## Contract and capacity

Annual version 6 carries one bounded canonical graph with per-concept scan
metadata. Shared analytics derive the statement cells and current financial
views from that graph. The client must validate closed shapes, exact values,
generation hashes and recomputed results. There is no version 5 wire fallback.
Captured reports use schema 3 and keep the canonical graph once, with separate
statement and financial results that reference its observation identifiers.
Server, website and Android releases must agree on this contract.

The existing source byte limits, two-request operation, scheduling and deadlines
remain. A per-concept overflow withholds that concept. A whole output over the
transport byte limit must be refused as a whole, with no clipped evidence. Capacity
acceptance needs actual serialized version 6 packets, including escaped fields,
and the matching report and native limits. A proposed shape or the earlier
1,000-observation proof does not establish that acceptance.

Acceptance must cover signed exact values through API, all three views, note and
report; differing flow/balance dates; missing and conflicted cells; unsupported
taxonomy or units; candidate and output limits; cancellation and late completion;
draft retention and retirement. Custom taxonomy, IFRS, quarterly statements,
arbitrary issuer coverage and retrieval of older filing archives remain separate.
