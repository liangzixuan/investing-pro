# Managed EOD history

The managed workspace opens EOD close history from an admitted Markets row,
Discover result or watchlist listing. Load is explicit. A loaded Markets row can
carry its validated history into Price without another request, including when
Annual opens first. The panel identifies this origin and retains the row's
previous-history status and original timestamps. Company Refresh replaces that
copy independently of the board. Direct links and other entry points start
unloaded. Company Price can request one calendar month or one calendar year
of daily raw USD closes and shows the last observed trading-date close, chart,
exact decimal table, requested dates, completion time and Tiingo attribution.
It does not calculate adjusted returns or claim that the last close is a live quote.

## Choose the company history range

**History range** starts at **One month**. Choose **One year**, then select
**Load one-year close history** to request it. Changing the selector makes no
request, write or automatic retry. The selector stays disabled during a read.
Markets, watchlist summaries and their comparisons keep their one-month requests.
A one-month handoff from either surface starts as one month in company Price.

The loaded range label, reported-close count, first and last observed dates,
requested window and request times all come from the admitted packet. Staging a
new range does not relabel the history already shown. Loading, Cancel and typed
transient failures retain that packet with its original dates. A successful read
replaces it as a whole. The source may return fewer dates than the requested
window; this is not a complete-year or adjusted-return claim.

Notes, snapshot and report documents keep that actual packet and window. A staged
range change invalidates an existing prepared report through its current source
state guard, even before a read. Preparing again can include the still-loaded
packet, labelled with its actual range. This makes no source request or saved change.

## Read the observed close range

The development source also connects [raw close research studies](MANAGED_PRICE_STUDIES.md)
to selected-result note preview, the existing Save/recovery flow and captured
reports. It uses the same admitted packet without another source request.

Company Price, the loaded snapshot and a prepared report show **Highest reported
close · USD** and **Lowest reported close · USD**. Each value keeps its exact
reported decimal and date. The calculation uses every row in the loaded packet,
including rows before the latest 252 observations. It adds no source request.

The summary names the actual loaded request range, the number of reported closes
and the first and last observed dates. Equal closes use the earliest date and
state how many dates share that value. With one observation, both values refer
to that same row. Missing trading dates may change the extremes. These raw
closes are unadjusted for splits or dividends and are not intraday highs or lows.

Staging another range, a pending refresh, Cancel and recoverable failures keep
the original summary with its packet. Replacement or removal of the packet
updates or removes the summary. The report document keeps its existing format
and complete exact source rows, so the same calculation can reproduce the range.
It does not store separate derived extrema.

## Retain or clear loaded history

The company visit renders either Annual or Price. Validated price rows stay in
that visit's memory when switching sections. An explicit refresh keeps the last validated history
visible while it runs, after Cancel, during a checked cooldown, and after a typed
timeout, temporary unavailability or provider rate limit. The previous-history
notice shows the original completion time; the rows, requested window and source
timestamps remain unchanged. A valid successful response replaces the whole
history and removes that notice. Initial-load failures have no previous history.

Back, company selection changes, catalog changes and session retirement clear prices. Authentication loss, unsupported or unconfigured listings, malformed
responses or cooldown packets, identity mismatches and unknown errors also clear them.
Late responses cannot restore cleared rows or overwrite history after Cancel.
The mounted workspace retains its unsaved notes and order. Android Back closes
the panel through the same action and restores focus to its opening control.
There is no automatic load, retry, prefetch or refresh on resume.

Cancel stops the local read and returns focus to Load or Refresh. A request already
admitted by the service may still finish and consume its existing budget. A checked
cooldown prevents another request until its stated time; passing that time does
not start one. Provider rate limits never receive an invented reset time.

The Annual section uses the same captured listing. Switching cancels any pending
EOD read and retains its validated prices; returning to Price sends no request.
Annual loading remains explicit. The original workspace opener and draft are
preserved, as is the EOD cooldown. See the [navigation contract](MANAGED_RESEARCH_NAVIGATION.md)
and [current delivery status](CURRENT_WORK.md).

## Inspect a dated close

The shared chart uses the existing ECharts axis pointer to inspect an observed
trading date with a mouse or touch. Its readout shows the exact raw
USD decimal from that loaded row; floating-point values are used only to draw the
line. No value between observed dates is presented as a closing price.

The shared chart serves Markets and company Price. Its complete table remains
the keyboard and screen-reader path to every exact value. The readout belongs to
the rendered history: retained previous rows keep their original dates, and
replacing or retiring that chart clears its readout. Inspection makes no request
and changes no saved state.

PR 40 delivers this behavior on the website and Android 1.8, with scoped
isolated browser and native touch checks; unpressed hover, live-provider and
physical-device acceptance remain unperformed, as recorded in
[Current work](CURRENT_WORK.md).

This follows the existing library's [axis tooltip pattern](https://apache.github.io/echarts-handbook/en/concepts/axis/).
Formatter content must remain text under the [ECharts security guidance](https://echarts.apache.org/handbook/en/best-practices/security/).

## Compare an earlier observed close

The shared Markets and company Price chart compares two observed dates from the
loaded history. Choose a starting date and an ending date after it. Both dates and their original
raw USD decimal closes remain visible beside the signed USD change and percentage.
The existing market-analytics module calculates the difference with exact decimals
and rounds percentages to four places. A nonzero change that rounds to zero says
it is less than 0.0001% higher or lower. This is raw price change, unadjusted for
splits or dividends, rather than total return or a live quote.

Start is initially empty and End is initially the latest loaded date. Choosing a
Start after or equal to the selected End clears End and asks for a new ending
date. End offers only dates after Start. Histories with fewer than two observations
explain why comparison is unavailable. Both selectors contain only observed dates;
they do not interpolate prices or assume that the requested window is fully covered.
The date selectors and full exact-value table support keyboard use. The separate
latest-price readout continues to show the last loaded observation when a past
ending date is selected.

Comparison makes no request and changes no saved data. Refreshing, Cancel and
supported failures keep both choices only while the same previous history remains
rendered, with its original provenance notice. A successful replacement resets
both choices even when the new rows have equal values. Selecting another listing
or retiring the chart also resets them. Switching from company Price to Annual
unmounts the chart: returning retains the loaded prices but resets Start and End.

The endpoint/date/change readout follows the established
[date and price range pattern](https://www.tradingview.com/support/solutions/43000516996-date-and-price-range-drawing-tools/),
using accessible date selectors for this bounded history. The original fixed-end
comparison was delivered on the website and in signed Android 1.11, with isolated browser and
sixteen-case native acceptance; [Current work](CURRENT_WORK.md) records the
original native failure, accepted rerun and live/physical limits. The new selectable
ending date has separate source and delivery status there.

On October 6, one explicit live AAPL load supported a bounded earlier-date
comparison check. Selecting another listing reset the choice. Opening company
Price left it unloaded; Back restored the still-mounted Markets chart and its
choice. Returning to My Watchlist preserved its saved state. This read-only
journey made no watchlist changes and did not measure network request counts.

## Add a price comparison to a note draft

**Add comparison to note draft** appears beside a selected comparison in
company Price. It requires that exact listing to be in the
watchlist draft. The excerpt retains both observed dates and original USD close
strings, the exact signed change, rounded percentage, requested window, original
request times and Tiingo attribution. It states that prices are unadjusted for
splits and dividends. Retained previous history is identified as retained;
appending never refreshes the source dates.

The action appends to the latest note text. **Review in My Watchlist** opens the
existing draft, and **Save watchlist** explicitly saves all its changes. Appending
makes no source request, adds no membership and performs no save. A complete
proposal that exceeds the note's 2,000-character limit is refused without
truncation. Other notes and ordering stay in the same draft.

While a price request is pending, wait for it to finish or use Cancel before
appending. The action checks both current date choices, admitted response, company
visit, exact membership and existing draft-edit rules. A callback from an old
choice, replaced history or closed visit cannot append. Both endpoint objects must
belong to that response in increasing order. The excerpt names the selected ending
date; it does not label a past endpoint as the latest loaded price. Markets keeps its
read-only comparison.

PR 48 delivers this flow on the website and in signed Android
1.12. Seventeen synthetic actual-main native cases passed;
the source, draft and replaced-history frames received scoped visual review.
The complete 503-character note and explicit save/reload are native-assertion
evidence; the draft screenshot shows only its visible portion. BrowserStack
covers the inert staged shell. Live owner-note writes and physical-device use
remain unperformed. [Current work](CURRENT_WORK.md) records the exact delivery,
original failures and remaining limits.

This follows the existing Annual evidence-to-draft flow. The placement also uses
the established pattern of explicit [symbol notes from chart context](https://www.tradingview.com/support/solutions/43000667881-how-to-create-a-text-note/)
and [selected evidence added to an existing note with source context](https://www.zotero.org/support/pdf_reader#adding_annotations_to_notes).

## Source and identity

Authenticated `POST /v1/managed/eod-history` accepts at most 4 KiB and returns at
most 64 KiB. The caller supplies the current catalog digest, exact listing ID and
explicit `1m` or `1y` range. The server resolves the full admitted identity before budget or
provider work. Fixed candidates keep AAPL, GOOG and GOOGL distinct, including
their security and share-class IDs. A catalog identity alone does not establish
Tiingo coverage or currency; each enabled mapping needs separate acceptance.

The service reuses the existing Tiingo history adapter with quote loading
disabled. One-month reads admit at most 32 rows and a 32 KiB source body;
one-year reads admit at most 367 inclusive calendar dates and a 256 KiB source
body. The request window subtracts one or twelve UTC calendar months and clamps
the day to the target month. Available rows must be strictly increasing, unique,
in-window trading dates with positive canonical decimal closes. The client also checks the complete selected identity, requested
window and response chronology before showing it. Decimal strings are preserved
in the table; the chart converts them only for plotting.

The response representation remains schema `1.0.0`; the accepted range domain
now includes `1y`. All one-month packet fields and bounds keep their original
meaning. Responses bind to the captured request range and exact derived window.
An older service rejects `1y` before admission or provider work. There is no
fallback month read or version negotiation. Live one-year availability and the
larger source cap need their own provider acceptance; invented tests do not
establish coverage or account entitlement.

The function's ten-second lifetime starts before account and catalog checks.
Admission must finish within two seconds. Source work gets at most 7.5 seconds
and ends no later than 9.5 seconds after entry; the response must finish before
ten seconds. These application limits do not guarantee platform scheduling or
cold-start duration. Client cancellation retires the local read immediately;
the Appwrite bridge has no proven client-disconnect signal, so server deadlines
remain necessary.

## Shared request budget

The feature reserves an attempt in the private row `managed-eod-v1` in
`investment_managed_watchlist_v1/tiingo_eod_budget`. The row contains the admitted
`ownerId`, monotonic `version` and bounded `reservationsJson`. It holds at most 256
ordered timestamps, including duplicates. Price rows are never stored there.

The shared limits are 24 attempts per hour, 128 per day and 256 per 31 days. Each
rolling window includes a four-second clock margin. Only a timely acknowledged
transaction commit allows one provider request. Unknown commit outcomes grant
no request and receive no automatic retry, read-back recovery or refund. The live
API stages the guarded version increment and reservation update together
with Appwrite's `createOperations` method, then checks the transaction ID, pending
status and two-operation count before commit. This removes one network round trip:
four normal calls instead of five. The two-second deadline and six-request ceiling
remain unchanged, including a reserved rollback slot before commit starts.
Malformed,
future or overfull reservation data closes admission.

The app budgets 1 MiB per attempt conservatively while capping each source body
at 32 KiB for a month or 256 KiB for a year. This is an application allowance, not a measurement of account-wide
bandwidth or the Tiingo account balance. Calls from other clients remain unknown.
The Annual report budget is separate and unchanged. A local quota response gives
the calculated next allowed time; an upstream rate-limit response gives no
invented reset time.

## Configuration and delivery

Managed function builds require identity, SEC and EOD configuration paths. The
EOD file is explicitly `null` to close price admission, or an object containing
only `enabledSymbols`, a nonempty distinct subset of the reviewed candidates.
Validation and copying occur before build output cleanup. Public configuration
contains no provider key. The function reads the separate server secret
`MANAGED_EOD_TIINGO_TOKEN` at runtime. Missing key, budget or mapping disables
EOD while the existing workspace and Annual report remain available.

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/clerk-trial/build-function.ts managed <server-config-path> <sec-config-path> <eod-config-path>
```

The selected private desktop/phone use and exact AAPL, GOOG and GOOGL USD mappings
were accepted for the managed deployment. Production enables these three exact
listings. Shared hosted admission and the API/site deliveries passed their
separate checks. On October 3, one explicit browser load returned 21 unique,
increasing dates from September 3 through October 2 for the September 3 to
October 3 requested window. Back restored the opening control without a
watchlist write. On October 4, separate explicit GOOG and GOOGL loads each returned
20 unique increasing dates from September 4 through October 2 for their September
4 to October 4 window. Back preserved the workspace. These observations establish
those requests, not ongoing availability or broader feed coverage. USD remains
the reviewed fixed-mapping currency, rather than an independently supplied
currency field in the history body. [Current work](./CURRENT_WORK.md) records the release.

The selected [Markets home](MANAGED_MARKETS_HOME.md) shares the same EOD admission
and checked cooldown. Its visit-scoped board snapshots remain separate from
company Price. Opening research from a loaded Markets row carries a copy;
other entry paths start unloaded.

Synthetic tests use invented rows and no provider connection. They establish no
live coverage, production deployment, signed APK update or physical-device pass.
