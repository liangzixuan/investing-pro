# Managed Markets home

Markets is a company board for three admitted listings:
AAPL, GOOG and GOOGL, representing two issuers. It connects dated raw closes,
one-month history, Annual research and the existing watchlist. Precision Desk pairs
a company list with selected detail and a chart, using a desktop navigation rail
and narrow bottom navigation. It retains our branding and permitted inputs.
[DESIGN.md](../DESIGN.md) records the presentation; delivery is recorded separately
in [Current work](CURRENT_WORK.md).

## Inputs and scope

The browser declares the three exact listing identities and resolves them against
the current catalog digest through the existing bounded catalog endpoint. The
whole cohort must match before any price request. A failed resolution offers an
explicit retry. Catalog membership alone does not establish price coverage;
configured service admission and typed provider refusals remain authoritative.

The three Tiingo EOD mappings have separate private-use acceptance. Each history
response supplies 1 to 32 raw USD closes, trading dates, a one-calendar-month window
and request start/completion times. The [EOD contract](MANAGED_EOD_HISTORY.md)
continues to validate full listing and share-class identity, decimals and dates.
GOOG and GOOGL stay distinct. The page has no live quote, adjusted return, market-wide mover
ranking, index, breadth or news data. Those need their own inputs and
acceptance under the [roadmap](PRODUCT_ROADMAP.md).

## BEA release agenda

The BEA agenda appears below the company board.
Deployment status remains in [Current work](CURRENT_WORK.md). Load agenda makes
one explicit read of the official BEA schedule for the next 30 elapsed days.
Series names and release times appear in Eastern time with daylight-saving
offsets, the original retrieval time, loaded window and official schedule link.
Different series at the same time stay separate. This covers BEA releases;
forecasts, reported values, importance scores and company earnings are unavailable.

The authenticated, body-free and query-free
`GET /v1/managed/economic-calendar` reuses the existing BEA adapter. It fetches
one fixed public JSON URL without credentials, redirects or retries. The adapter
admits at most 256 KiB of source data, 128 series and 4,096 input dates. The
normalized response allows 512 events and 512 KiB. Ten seconds from function
entry includes authentication and serialization. This bounds one invocation;
it does not establish an aggregate upstream request allowance. No table, catalog
lookup, price entitlement or provider token is required.

Refresh preserves the previous validated window with its dates and a clear
previous-result notice. Failure, an invalid replacement and Cancel leave that
window visible. Late responses cannot replace it. Cancel restores focus to Load
or Refresh. Leaving Markets cancels pending work and retains accepted results
within the session; returning, background/resume and opening company research
make no calendar request. Session retirement clears the agenda immediately.
Calendar actions do not save, reconcile, reorder or edit the watchlist.

The shared parser owns and freezes accepted response data. The local research
profile retains its separate transport and owner-activity lifetime. See the
[source specification](../specs/005-bea-release-agenda/spec.md) for normalization
and source-rights evidence. Synthetic API, client and native journeys exercise
failure and lifetime boundaries. The accepted candidate native report contains
22 cases on a PR merge with the same source tree. Its two BEA final frames do not
show the calendar; exact dates and recovery behavior are verified by executed
Java assertions. Invented-data Brave desktop and 390-pixel checks cover the shared
agenda layout. Actual-main checks include a separately accepted 22-case native
gate. API, website and signed Android delivery are accepted.
No new live authenticated managed read or physical use is established.

## Dated raw-close change

Each loaded row compares the final two observations within its own validated
history. It shows both dates and an exact USD difference, calculated as latest
close minus previous close. The percentage divides that difference by the
previous close and multiplies by 100, rounded to four decimal places with half-up
rounding. The existing market-analytics package uses an isolated decimal context;
values do not pass through JavaScript floating-point arithmetic.

Direction comes from the exact difference. A nonzero percentage that rounds to
zero is described as less than 0.0001% higher or lower. An exactly unchanged close
shows zero. A history with only one row keeps its close and chart and says the
change is unavailable. Each listing retains its own observation dates; gaps do
not establish adjacent exchange sessions or a change for today.

The visible label is Raw close change, with a disclosure that prices are not
adjusted for splits or dividends. This follows the usual
[previous-close comparison](https://www.tradingview.com/support/solutions/43000635852-how-are-the-most-popular-filters-connected-with-change-calculated/)
while preserving Tiingo's distinction between
[raw and adjusted prices](https://www.tiingo.com/documentation/end-of-day).
It is not a total return or a mover ranking.

The comparison derives directly from the response already displayed. Refresh
replaces both dates and values together; it never compares the latest closes of
two refreshes. Previous-history notices apply to the comparison too. Clearing
the response clears the comparison. This feature adds no provider request,
persistent price storage or new response state.

## Compare the three listings

The comparison shows raw price changes across all three loaded histories,
initially in board order. It uses the earliest and latest dates observed in every history,
with at least two shared observations. The table shows those common dates, their
observation count, each listing's original USD endpoint closes and a four-place
percentage calculated by the existing exact-decimal module. A nonzero change
that rounds to zero retains its higher/lower description. GOOG and GOOGL remain
separate share classes of the same issuer.

All three histories are required; a missing response never silently reduces the
cohort. Fewer than two shared dates produces an explanation without numeric
comparison. Dates are not filled or interpolated, and the shared span is not
necessarily a complete month. Prices remain unadjusted for splits or dividends;
the table supplies neither total return nor a market-wide performance ranking.

**Comparison order** offers Board order, Highest raw change and Lowest raw change.
Ordering compares exact shared endpoint ratios before percentage rounding, so
different changes can appear in a precise order even when both display as zero.
Exact ties use symbol, exchange MIC and listing ID in that order, in either
direction. Highest and lowest include positive, unchanged and negative changes;
they do not select only gainers or losers. Table rows and their source details
use the same order, without changing the board or selected chart.

The selector stays available when histories are missing or have fewer than two
shared dates. Its choice applies when a complete comparison becomes available;
unavailable data never becomes zero or a partial ranking. The choice stays in
memory while the comparison is mounted, including refresh and a company visit,
and resets when Markets unmounts. It sends no request and changes no watchlist,
draft, history or saved state.

The comparison derives from the currently displayed responses and adds no
request, cache, selection or saved state. Each row retains its requested window,
original completion time and previous-history notice. Independently refreshed
rows can have different request times even though the comparison dates match.
A validated replacement recomputes the shared dates and values; a cleared
response withholds the comparison. Existing navigation, catalog and session
retirement clear the source responses and their derived comparison together.
The table scrolls within its own labelled region on narrow screens; keyboard
users can focus that region and use the arrow keys. The results region and
coverage disclosure and order selector remain mounted when a refresh leaves the comparison
unavailable, preserving focus while replacing values with an explanation.
Delivery and verification remain in [Current work](CURRENT_WORK.md).

## Requests and lifetime

Markets is the initial managed view. Entry resolves catalog metadata only; price
loading is explicit. Load board prices requests the three rows sequentially,
admitting each only when its turn begins. It can consume up to three attempts
from the existing shared budget. There is no automatic retry, prefetch or resume
refresh. Selecting a row reuses its current board snapshot.

The selected chart also offers Load or Refresh for its named listing. This
requests one exact admitted row and preserves the other rows, including their
dates and error states. Changing the displayed selection while it runs does not
retarget the request or start another one. Completion and recovery messages name
the requested listing. A selected request uses the same validation and shared
budget as the board action; it cannot expand the admitted cohort.

Partial failures belong to their rows. A checked shared cooldown, provider rate
limit or workspace admission failure stops the remaining queue. Board and price
panel use the same checked EOD cooldown. The app never invents a provider reset
time. Passing a cooldown time does not start a request.

Cancel aborts the local pending read and retires the queue. Completed rows and
previous validated histories remain, with their original dates. A request already
admitted by the service may still finish there. Late results cannot restore
cancelled work. Explicit refresh retains each previous history through Cancel
and supported transient failures, labels it as previous, and replaces it only
with a validated whole response. Fatal identity, malformed and unknown failures
clear the affected row. Authentication or catalog retirement clears the board.
Cancel returns focus to the load control that started the request.

Prices live only in the current Markets visit. Opening research cancels pending
board work and preserves completed board snapshots. Company Price receives an
owned, validated copy of the selected row's loaded response, including its original
dates and previous-history status. The copy is captured after cancellation settles.
Opening Annual first also prepares that Price history, while Annual stays unloaded.
The Price panel identifies history carried from Markets and offers explicit Refresh.
A row without a response starts Price unloaded. Neither opening nor switching
sections requests prices. Company Refresh replaces only the company response;
Back retains the board's original snapshot and chart choice. The visit's existing
close/switch rules still apply. Back returns
focus to the original opener; Android Back uses that same action. Switching to
Discover or My Watchlist clears board prices. Returning to Markets starts unloaded.
The mounted workspace continues to own unsaved watchlist notes, order and saves.

The handoff follows the established pattern of opening a selected watchlist
instrument in a connected chart, described by
[TradingView](https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/).
Here it reuses only an already admitted response for the exact catalog and listing.
It adds no persistent cache, source coverage or request allowance. Direct links,
reloads, browser Forward and Discover/watchlist entry start unloaded.

## Screen and verification

Desktop places listing rows beside the selected chart; narrow screens put the
rows above it. Every loaded close shows its trading date and USD denomination.
The chart has an exact decimal table, and expandable source details retain the
requested window and request timestamps. Completion time is not a market tick.
Search, research and watchlist navigation use the existing controls and models.

Focused invented-data checks cover ordered admission, partial failure, shared
cooldown, cancellation and late completion, exact identity, catalog/session
retirement, draft retention and panel navigation. Native fixture coverage and
desktop/narrow visual checks are separate from live provider reads, website
promotion, signed Android packaging and physical-phone acceptance. Do not use
owner records as test fixtures or infer whole-market coverage from this board.

## Selected-price acceptance

PR 42 delivers the selected-price action on the website and in signed Android
1.9. The invented native journey checks zero price reads on selection, one
explicit selected load, unchanged untargeted rows, cancelled refresh with prior
history retained, and a late reply that cannot replace it. Research, Back and the watchlist draft retain their existing behavior.
Two original selected-price/draft frames received scoped visual review.

The same staged archive passed the configured inert BrowserStack gate and normal
production approval. These checks do not establish a live selected-price provider
journey or physical-phone acceptance. The signed package passed artifact and
delivery review; installation and physical use remain separate. See
[Current work](CURRENT_WORK.md#accepted-release) for release identities and
current limits.
