# Watchlist price and valuation screen

Select up to twenty listings from My Watchlist, then explicitly load their dated
closing prices and provider P/E and P/B values. Filter or sort those observations
locally and open a company for research. Back returns to the screen without
discarding its loaded rows or filter draft.

## Dates and values

Each row uses the latest date returned by that listing's one-month daily valuation
history. A raw EOD close must exist on that exact date. A missing close withholds
the row's numeric screen values and shows a reason; an older matched pair or a
current quote never substitutes for it. Individual missing provider ratios remain
unknown. Rows can have different observation dates.

The screen shows the observation date, the UTC date at the start of the batch,
and their calendar-day difference. Calendar age is not a market-session count or
a provider freshness guarantee. The quote's existing 36-hour indicator does not
classify daily valuation history. These are dated observations, not current trade
prices or a point-in-time historical universe.

Raw close is in USD. P/E and P/B are the signed provider values, including zero.
The screen does not infer earnings, reconstruct book value or replace negative
ratios. Minimum and maximum filters compare exact decimals literally. Set a
positive minimum if the intended screen excludes zero or negative multiples.

## Filtering and missing data

All active minimum and maximum criteria form an AND expression. A known failed
criterion makes a nonmatch even when another input is unknown. Otherwise a
missing required input makes the result unknown. All selected rows remain
inspectable through the result-status views and their counts. Numeric sorts put
unknown values last in either direction, with deterministic identity tie breaks.
Invalid or reversed bounds must be corrected before applying a screen.
With no active bounds every selected row matches the filter, including rows with
missing values. The separate per-metric known/unknown counts describe data
availability; a filter match alone does not establish complete inputs.

Selection search and paging do not change the saved watchlist or the full list
supplied to other research features. Selection is bounded to twenty listings;
the picker displays at most fifty entries per page. Nothing is selected by
default, and rendering the screen does not acquire provider data.

## Acquisition and lifetime

Load uses the existing one-month market overview and daily valuation endpoints,
one local operation at a time. For twenty successful listings this is at most
forty local acquisition calls and sixty underlying Tiingo requests. Each overview
internally starts quote and EOD requests together, then the daily valuation call
follows. Overview requires both feeds: a quote entitlement failure can prevent
use of otherwise available EOD data.

Cancel stops the current batch; there is no automatic retry or refresh. Session,
configuration, credential, entitlement and rate-limit failures stop the remaining
batch. Company-specific gaps remain visible. Filtering, sorting and Research/Back
make no provider requests.

Results are bound to the complete captured saved identities, catalog snapshot,
watchlist version, provider status and active session lifetime. Context changes
abort pending work and retire stale results and callbacks. The existing routes
resolve catalog identity; they do not validate a remote watchlist version on
every acquisition. The client retires work when it observes a changed context.

Only the narrow screen projection remains in active-session memory. The screen
does not save source histories, results or criteria to the vault or browser
storage, export provider values or change saved records. Tiingo attribution and
the existing source retention boundaries apply.

## Scope and verification

This is a selected-watchlist screen separate from SEC annual financial screening.
It does not supply a whole-universe price/valuation join, broader price/action
validation, standalone-quarter or TTM admission, historical strategy testing or
new financial coverage. Configured Tiingo status does not prove every required
entitlement.

Acceptance covers exact-date gaps, no older fallback, signed and zero ratios,
exact decimal bounds, three-valued filtering, deterministic sort/counts, bounded
selection, interrupted requests, changed identities, stale callbacks and focus,
explicit IO, memory retention, and Research/Back. Synthetic browser checks must
cover keyboard use and a narrow viewport. The normal isolated native and hosted
release gates remain required; see the workspace checkpoint for actual results.
