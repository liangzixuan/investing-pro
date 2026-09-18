# Prices in a financial comparison

Select two or three distinct companies in the financial screen and open
**Compare companies**. **Load prices** requests Tiingo price context for those
exact listings. Each company shows its own loading, available or unavailable
state. Opening the comparison or changing its financial columns makes no price
request. Prices are separate from the reported annual financial amounts.

Choose one month, three months or one year of history, then load explicitly.
Changing the range clears the previous results without sending a request.
The comparison uses the existing overview API. Requests run one company at a time; each overview uses the
existing quote and EOD operations. There is no automatic retry or refresh.
Credential, entitlement, configuration, session and rate-limit failures stop
the remaining batch. Ordinary missing company coverage remains visible without
hiding another company's result.

## Read the price context

A **Tiingo reference price** is provider-derived and is not an executable quote.
Its time is the provider's reference refresh timestamp. An **End-of-day close**
uses the latest admitted EOD bar only when the existing adapter permits fallback.
Its date is a trading-session date; the app assumes the regular 16:00 New York
close. Early closes are not modeled and the time is not an observed closing trade.

Freshness describes the quote when loaded, with the existing 36-hour threshold.
Prices do not update in the background. The provider and source date/time remain
visible so an older reference or prior close is not presented as a current trade.
The annual financial periods remain independent. No price-to-earnings, yield,
market-capitalization estimate or valuation ranking is inferred from this view.

## Compare adjusted-price performance

The same load supplies a comparison of adjusted closes. All selected companies
must finish successfully before this table appears; a missing company never
silently reduces the group. The app intersects the observed dates from every
history and requires at least two shared dates. It uses the earliest and latest
of these dates for every company's percentage change. Empty histories, no
overlap or a single shared date produce an explicit unavailable result.

The table shows the actual common start and end, shared observation count,
first and last adjusted closes, and percentage change. Coverage details retain
each requested window, observed first and last date, loaded session count and
the count excluded from the common sample. The common window may be shorter
than the selected range, including when a company has limited or older history.
Missing dates are not filled, and quote freshness does not establish history
freshness; inspect the actual history dates.

Percentage change is `(last adjusted close / first adjusted close - 1) * 100`,
using the existing selected-window analytics with 80 significant decimal digits
and half-up rounding to four decimal places. Raw closes and current quotes do
not determine this result. Provider-adjusted prices can reflect corporate-action
adjustments; the app does not independently reconstruct a total return, model
reinvestment, or infer a valuation or trading recommendation.

## Compare maximum drawdown

The same shared observations also show each company's maximum drawdown: the
largest decline from an earlier running peak adjusted close to a later adjusted
close. The value is a nonnegative percentage magnitude, with the peak and trough
dates returned by the existing analytics. All selected companies must have a
successful load and at least two common dates, just as for price change.

The calculation is `max((running peak - adjusted close) / running peak * 100)`
on the common observed dates. It uses the same 80-digit arithmetic and four-place
half-up rounding. Equal drawdowns before display rounding keep the earliest peak
and then earliest trough. A zero value with the same peak and trough date means no decline was
observed, and no loss episode is displayed. A positive decline can round to
`0.0000%`; differing peak and trough dates retain that distinction and remain
visible with an explanation.

This is maximum drawdown **on shared observations**. Dates absent from any
company are omitted for every company, so intervening peaks or declines can be
hidden. Inspect the common window and omitted counts; this is not a full daily
history risk measure or a forecast. It uses the existing loaded history and
requires no additional price request.

## See the adjusted-price path

The indexed chart starts each selected company at **100 on the first shared
date**, making differently priced shares comparable on one scale. Each point is
`100 * adjusted close / first shared adjusted close`, using an isolated 80-digit
decimal calculation and half-up rounding to four decimal places. The baseline
is always `100.0000`. The index has no currency unit; it is not a dollar holding,
benchmark or independently reconstructed total return.

Only the same validated shared observations used by the metrics are plotted.
Every selected company must load successfully and share at least two dates.
Straight connecting lines are visual guides, not observed or interpolated
missing prices. Dates are spaced by observation, so calendar gaps are not shown
to scale. The shared window, omitted-date counts and sparse-history
warning still apply. Prices that round to the same index can look flat while
the existing drawdown metric retains a tiny positive decline and its dates.

Distinct labeled line styles identify the companies. Expand the exact-data table
to inspect each shared date, original adjusted close and four-decimal index.
Pages of 25 dates keep the table manageable without dropping observations. Plotting
uses approximate numeric coordinates; the table preserves the decimal strings.
If the values cannot safely be plotted, an explicit chart-unavailable message
replaces the plot while the exact table and existing metrics remain available.
The plotting range admits only finite, positive numeric coordinates no greater
than JavaScript's maximum safe integer, `9007199254740991`. A positive index that
rounds to `0.0000` therefore remains in the exact table without being plotted as
an actual zero. This display boundary does not change the underlying metrics.

The chart, table and pagination use the existing response. Opening or inspecting
them makes no request, and they do not change the comparison's membership,
baseline or metric formulas. Existing price/session clearing also removes the
chart and its exact-data state.

## Lifetime and boundaries

Only the quote, provider, EOD bar date, requested history bounds and narrow
date/adjusted-close/raw-close projection are retained in active component memory.
The full OHLCV and corporate-action payload is not kept by the comparison.
Removing or replacing a company, invalidating its financial/catalog context,
changing the history range, losing the owner session or closing the comparison clears the price context and
cancels pending work. Late callbacks cannot repopulate former selections. A
display-only column change retains the comparison context.

Prices, history and derived comparisons are not written to saved financial views, the vault, browser storage,
URLs, exports or logs. Existing financial criteria, columns, presets, metrics
and saved payload versions retain their meaning. Company research still has its
own explicit price-loading action.

## Verification

Cover explicit-only requests, sequential batches, independent failures, batch
stops, complete listing identity, stale callbacks, abort/unmount and session or
snapshot changes. Exercise current/stale reference prices, EOD fallback and an
early-close date with an explicit assumed-time label using synthetic responses.
Cover exact common-date alignment, unequal endpoints, interior gaps, zero or one
common observation, unavailable members, positive and negative changes, decimal
rounding, and range changes with late responses. Validate original histories
before intersecting so invalid excluded observations cannot disappear silently.
Check maximum drawdown on rising, falling and flat histories, repeated peaks,
tied drawdowns, tiny declines rounded to zero and omitted interior observations.
No-decline wording must not rely on the rounded percentage alone.
For indexed paths, verify proportional histories with different starting prices,
the exact 100 baseline, rounding, omitted interior observations, unsafe plotting
values and all exact-data pages. Confirm stale chart disposal, resize and reduced
motion, accessible labels and table controls, and no new request or persistence.
Verify desktop/narrow layouts and keyboard access in external Brave. Any retained
screenshots or fixtures contain only synthetic prices. The workspace checkpoint
records the actual released revision and dated configured-source observations;
this guide does not establish broad coverage or provider entitlement.
