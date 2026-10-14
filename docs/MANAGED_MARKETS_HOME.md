# Managed Markets home

Markets is a company board for three admitted listings:
AAPL, GOOG and GOOGL, representing two issuers. It connects dated raw closes,
one-month history, Annual research and the existing watchlist. Precision Desk pairs
a company list with selected detail and a chart, using a desktop navigation rail
and narrow bottom navigation. It retains our branding and permitted inputs.
[DESIGN.md](../DESIGN.md) records the presentation; delivery is recorded separately
in [Current work](CURRENT_WORK.md).

## Move between Markets sections

**On Markets** offers **Company board**, **Economic calendar** and **Fed
announcements** below the Markets toolbar. Each link moves focus to that
section's heading and scrolls it into view. All sections stay on the same page.
The links wrap on narrow screens and have a minimum target height of 44 pixels.

A jump uses the current visible Markets view. It does not load or refresh data,
change the URL or create a history entry. Loaded responses keep their original
dates, source context and pending or previous-result notices. The selected
company, chart choices, BEA release date and watchlist draft keep their existing
state. Load, Refresh and Cancel remain separate controls.

The app checks the heading and view again after focus moves. It stops if the
view changes or the target is hidden, detached or no longer belongs to Markets.
Loading a response does not trigger a jump. Browser and native verification,
and delivery status, remain in [Current work](CURRENT_WORK.md).

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
ranking, index, breadth or combined market/company news feed. Those need their own inputs and
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
Load, Refresh, Cancel and date selection do not save, reconcile, reorder or edit
the watchlist. The separate note action below changes only an explicitly chosen
note draft.

**Search loaded releases** matches a phrase in the full series name. Matching
ignores case and extra spaces; it preserves the displayed source text. Combine
it with **Release date** to show matching releases on one Eastern date. **Clear
search** clears the phrase and retains the date. Each date option keeps its count
from the full packet, and **All loaded dates** removes the date restriction.

The visible count is stated against all loaded BEA releases. The agenda and
Release picker show the same matches, with every admitted event available.
Series sharing the same instant stay separate and retain their original order.
The original loaded window, retrieval time, source link and previous-result
notice remain visible. No matches has a different explanation from a verified
empty schedule.

The filters make no request and change no saved data. They remain usable while
note editing is paused. Both remain during a pending Refresh, failure or Cancel
while the same accepted response remains. A successful replacement, including
equal content, clears the search, resets to All loaded dates and announces the
change. An empty response retains the verified-empty message.
Company visits preserve the mounted choice; leaving Markets for another top-level
view resets it on return. Session retirement clears the agenda and its choice.
Filtering does not programmatically move focus or scroll the page. Delivery and rendered
acceptance are recorded separately in Current work.

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

### Compare consecutive loaded agendas

After a second successful **Refresh agenda**, the managed calendar shows how
many current scheduled entries were absent from the preceding loaded agenda.
Each entry uses its exact series name and UTC scheduled time. Different series
at the same time stay separate; a changed name or time is a different entry.
Marked rows retain their original source text, dates and note metadata.

**Compared loaded agendas** opens both original retrieval times, window bounds
and full event counts. The windows move with each load. A current-only entry
can result from that movement or a schedule change; this does not establish
publication, rescheduling or complete history. It does not match old and new
entries into reschedule pairs or infer removed releases.

The count describes the complete current agenda while series and date filters
narrow only its visible rows and note choices. A successful empty replacement
keeps a comparison and the separate verified-empty message. First load has no
comparison. Pending, failed, invalid and cancelled attempts retain the accepted
pair. Returning to Markets keeps it without another read; retirement clears it
and rejects late responses. Each successful replacement compares only with the
preceding accepted response. No comparison is saved and no extra read is made.
Source, Chrome and native acceptance remain separate in Current work.

## Add a scheduled release to a note

After loading the BEA agenda, open **Add a release to a note**, then choose a
**Release** and an **Add to note** destination. The form starts closed so the
release list is easier to reach. Closing and reopening it keeps current choices
and feedback; it makes no request or draft change. Source dates, timezone,
warnings and release rows remain visible outside the form.

Both choices start empty. The release picker keeps all admitted
events, grouped by Eastern date. Search and **Release date** narrow both the visible
agenda and the picker; simultaneous series remain separate. Full selected release text
and the destination's listing, share class and exchange wrap below the controls.

**Add release to note draft** appends the complete series name, scheduled Eastern
time and exact UTC instant, original retrieval time, loaded window and official
source link to that member's latest note. A retained agenda is identified in the
reference. It describes a schedule that may change; it does not confirm a release,
report a value or forecast, or establish company relevance. Adding makes no request.

The action changes only the selected note. It preserves existing raw text and
membership order. An identical reference is refused, including after saved text
normalization. If the complete note exceeds its limit, nothing is clipped or
appended. **Review in My Watchlist** opens that exact note's full reader, even
outside a retained search. **Save watchlist** remains explicit and saves the
whole draft, including other changes.

Pending reads pause choices, Add and Review. Failure or Cancel keeps the loaded
event choice with the current retained-result qualification. An accepted response,
including equal content, clears the release choice. A filter change clears it only
when the selected event is excluded, explains the change and chooses no fallback.
Clearing a filter does not restore a discarded choice. A still-visible event
remains selected.
The destination remains when it still exists; note edits and ordering use the
current member. Leaving or hiding Markets clears both choices. Stale callbacks,
catalog changes and session retirement cannot append to another draft.

This action adds no reminder, event history or separate save path. Source,
browser, native and delivery acceptance are recorded in [Current work](CURRENT_WORK.md).

## Federal Reserve announcements

The announcements section follows the BEA agenda. **Load announcements** makes
one explicit read of the official Federal Reserve monetary-policy RSS feed.
It shows up to ten titles with original links, publication times in Eastern time,
the number listed in the feed and the time the response was loaded. A missing
publication time stays unknown. Article bodies, forecasts and a combined news
feed are outside this section. Deployment status remains in [Current work](CURRENT_WORK.md).

The authenticated, body-free and query-free
`GET /v1/managed/monetary-policy-announcements` reuses the existing fixed-source
adapter. It fetches one public RSS URL without credentials, redirects or retries.
The adapter bounds source input to 256 KiB and 128 validated items, returning at
most ten unique items. The managed response is capped at 64 KiB. The ten-second
invocation deadline includes authentication and serialization; it does not
interrupt synchronous XML parsing or establish an aggregate request allowance.
No catalog lookup, storage table, price budget or provider token is involved.

Refresh keeps the last verified feed and its original retrieval time visible
with a previous-result notice. Failure, an invalid replacement and Cancel retain
that response. A valid empty feed replaces it. Leaving Markets, opening company
research, or entering a pending or invalid company route cancels the pending
read; returning does not fetch again. Late responses cannot replace current data
or retire a newer session. Current authentication failures retire the shared
session, clearing the feed and draft through the existing coordinator.

Cancel returns focus to Load or Refresh when Cancel had focus and the current
control remains visible. Load, Refresh and Cancel do not edit notes, save, reorder
or reconcile the watchlist. Ordinary source links open separately with their
original validated URLs; the app does not fetch article contents.

### Compare consecutive loaded feeds

After a successful **Refresh announcements**, **Newly observed in this refresh**
marks current links absent from the preceding accepted list. The count covers
all current loaded items. The first accepted feed establishes a baseline without
a comparison. Each later accepted feed, including an equal or empty response,
advances that baseline. A changed title or publication time at the same URL does
not create a newly observed link.

**Compared loaded feeds** retains both original retrieval times, each list's
shown and available counts, and the source. Only these two loaded lists are
compared. Their ten-item limit can omit other feed entries; absence from the
previous list does not establish a new publication, changed article or personal
relevance. A removed link is not described as a retraction.

Pending reads, failure and Cancel keep the last accepted pair and its original
dates. The previous-feed notice still explains that the latest attempt has not
confirmed a newer feed. Ordinary navigation preserves the pair; retirement
clears it. Comparison makes no request and saves no history. It leaves every
current item and note choice available, and adds no comparison label to a saved
reference. See [Current work](CURRENT_WORK.md) for acceptance and delivery status.

### Search loaded announcement titles

**Search announcement titles** matches one phrase in the full titles already
loaded. Matching ignores case, trims the phrase and treats repeated whitespace
as one space. It searches titles only. **Clear title search** removes the phrase
while retaining the selected Announcement view. Items keep their source order.
The match count describes the loaded list; the
source's available count, original retrieval time and full-feed refresh comparison
remain visible. Search does not fetch article text or other feed entries.

### Inspect newly observed links

**Announcement view** offers **All loaded announcements** and **Newly observed
links**. The latter becomes available after a successful refresh compares two
accepted lists. It includes current URLs absent from the previous loaded list.
This observation does not establish a new publication, article change, company
relevance or complete history. The source may expose more entries than are loaded.

Title search narrows the selected view. Rows and announcement note choices use
the same result. Original titles, links, dates and source order stay intact.
The match count describes this result; feed coverage and the complete comparison
remain visible. Zero matching links and an empty loaded feed have separate messages.

An excluded announcement choice clears with its feedback. A valid note destination
stays selected. Returning to All does not restore an excluded choice. Choose another
announcement. A matching choice and its feedback remain available.
The note disclosure keeps its open or closed state through reading filters.

Pending, failed and cancelled requests retain the view and phrase. Each accepted
replacement, including equal or empty content, resets to All with a blank phrase.
Navigation remount, model replacement and session retirement reset the view.
Reading filters remain usable while Save pauses note editing. Selection and search
make no request or saved preference. The local research profile stays unfiltered.

Pending reads, failure and Cancel keep the search. Each accepted replacement,
including an equal or empty feed, clears it and reports the reset. Leaving Markets
starts a fresh search on return. Session retirement clears the feed and search.
Search remains usable while note editing is paused.

The note picker uses the same matching items. If search excludes a chosen
announcement, the choice and its action feedback clear. A valid note destination
stays selected. Clear does not restore the excluded choice; choose it again
explicitly. A still-matching choice and its feedback remain available.

### Add an announcement reference to a note

After loading the feed, open **Add an announcement to a note**, a native disclosure
after the announcement list. It starts closed. Closing and reopening keeps the
current form mounted with its choices, feedback and note draft. Source metadata,
search, refresh comparison, announcements and warnings remain outside it. A new
Markets visit starts with the disclosure closed.

Choose an **Announcement** and a current watchlist entry
under **Add to note**. Both choices start empty. The complete chosen title and
destination identity appear below the controls. **Add announcement to note draft**
appends the reference to that entry's latest note without changing its existing
text, other notes or membership order. The choice is the owner's relevance
judgment; it does not identify company news or infer an investment effect.

The reference includes the complete title and original URL, source publication
time or an explicit unknown value, the fixed Fed source and feed URL, and the
original retrieval time. A retained previous feed is labelled. Only feed metadata
was loaded; the action does not fetch the article or refresh its dates.

An active refresh blocks adding the reference. Cancel or failure retains the
loaded choice with its current previous-feed qualification. A successful
replacement, including equal content, clears the announcement choice. Leaving
Markets for company research or another view clears both choices; returning needs
fresh intent. Current session, catalog, feed and complete destination identity
are checked again on each action. A stale or removed destination is refused.

The complete note must fit the existing 2,000-code-point limit after trim and NFC
normalization and contain no forbidden control characters. Oversized text is
refused without truncation. Exact-reference duplicate comparison also uses NFC so
a saved and reloaded decomposed title cannot be appended twice. Different original
retrieval times or retained-feed qualification remain different dated references.

After a successful append, **Review in My Watchlist** selects the exact current
destination, opens its existing full-note reader and focuses the disclosure
summary. A duplicate refusal keeps Review available for that successful choice;
an active announcements request blocks it. Search query and scope, raw note text,
other notes and order stay unchanged. See
[Review a destination note](APPWRITE_WATCHLIST.md#review-a-destination-note).
Explicit **Save watchlist** saves the complete draft, including its other unsaved
changes. Review does not save or refresh evidence. Delivery and rendered
acceptance remain in [Current work](CURRENT_WORK.md).

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
initially in board order over the full shared span. Start and End offer dates
observed in every history, with Start strictly before End. Choosing a Start at or
after End clears End and withholds the figures until an ending date is chosen.
The table shows the selected dates, each listing's original USD endpoint closes and a four-place
percentage calculated by the existing exact-decimal module. A nonzero change
that rounds to zero retains its higher/lower description. GOOG and GOOGL remain
separate share classes of the same issuer.

The interval's observation count is separate from the full shared-date count.
Coverage reports each original requested window, observed span, loaded count,
omitted count and request times. Omitted observations are dates absent from
another history; dates outside the chosen interval are not omitted. Date choices
do not alter the selected chart, latest quote or single-listing comparison.

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

The order selector stays available when histories are missing or have fewer than two
shared dates. Its choice applies when a complete comparison becomes available;
unavailable data never becomes zero or a partial ranking. The choice stays in
memory while the comparison is mounted, including refresh and a company visit,
and resets when Markets unmounts. It sends no request and changes no watchlist,
draft, history or saved state.

The comparison derives from the currently displayed responses and adds no
request, cache or saved state. Each row retains its requested window,
original completion time and previous-history notice. Independently refreshed
rows can have different request times even though the comparison dates match.
A validated replacement, including equal-valued data, resets the interval to
the full shared span and says “Loaded histories changed; showing the full shared
span.” An explicit date choice clears that notice. Refresh status, Cancel and a
failed refresh retain the interval while the same response objects remain.
A missing or cleared response withholds the comparison; loading a complete
cohort again initializes the full shared span. Existing navigation, catalog and session
retirement clear the source responses and their derived comparison together.
The table scrolls within its own labelled region on narrow screens; keyboard
users can focus that region and use the arrow keys. The results region and
coverage disclosure, Start, End and order selectors remain mounted when a refresh
leaves the comparison unavailable, preserving focus while replacing values with
an explanation. Date selectors then contain an empty unavailable option.
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
