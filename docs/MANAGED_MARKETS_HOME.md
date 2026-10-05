# Managed Markets home

Markets is a company board for three admitted listings:
AAPL, GOOG and GOOGL, representing two issuers. It connects dated raw closes,
one-month history, Annual research and the existing watchlist. It uses the compact
navigation, board and chart pattern of a market portal with our own branding and
permitted inputs. Delivery is recorded separately in [Current work](CURRENT_WORK.md).

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
GOOG and GOOGL stay distinct. The page has no live quote, adjusted return, mover
ranking, index, breadth, news or calendar data. Those need their own inputs and
acceptance under the [roadmap](PRODUCT_ROADMAP.md).

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
board work and preserves completed board snapshots. The separate Annual and price
panels start unloaded and retain their existing close/switch rules. Back returns
focus to the original opener; Android Back uses that same action. Switching to
Discover or My Watchlist clears board prices. Returning to Markets starts unloaded.
The mounted workspace continues to own unsaved watchlist notes, order and saves.

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
