# BEA release agenda

Created September 26, 2026. Implementation and release verification are pending.
Base: accepted a83 `d0ad5d3537d012f2d96af1355dc05f015a76c7e8` in `markets-home`.
This is a bounded part of [roadmap M3](../../docs/PRODUCT_ROADMAP.md).

## User outcome

On Markets, the owner can load the next 30 days of scheduled BEA series releases
and see when to expect GDP, income, trade and other covered releases. The agenda
works independently of the three-company price board and company valuation access.

1. Load once from the official source. Show the series name, release date/time,
   explicit Eastern timezone, local fetched time and the loaded 30-day window.
2. Link to BEA's official schedule. The source does not supply individual article
   links, forecasts, actual values, importance scores or company earnings dates.
3. Refresh explicitly. Keep the previous successful schedule while refreshing
   and after a failed refresh, with a clear explanation and original timestamps.
4. Returning from Research reuses the loaded schedule. Rendering, navigation,
   tab visibility and component effect replay must not acquire data automatically.

## Source contract

[BEA's calendar page](https://www.bea.gov/news/schedule/icalendar) links the
[public JSON schedule](https://apps.bea.gov/API/signup/release_dates.json).
The [BEA reuse policy](https://www.bea.gov/help/faq/147) permits public-domain
material unless otherwise stated and requests source credit. Use our own layout.

The source maps series names to arrays of offset-bearing release instants. Its
optional `file_last_updated` field is validated as local calendar text without
assigning a timezone, and is excluded from series counts and the response. The feed
contains duplicate entries and different series sharing an instant. Deduplicate
only identical series/canonical-instant pairs. Do not merge simultaneous series,
invent a reference period, or infer full economic-calendar coverage.

An authenticated body-free GET to `/v1/personal-filing/economic-calendar` makes
one credential-free request to the fixed source. No caller-controlled URL,
query, redirects, retries or persistence. The provider has a 10-second deadline,
256 KiB body cap, at most 128 series and 4,096 input dates. Malformed or oversized
input fails the load; it cannot silently become a partial schedule.

Return at most 512 events in `[fetchedAt, fetchedAt + 30 elapsed days)`, sorted by
canonical UTC instant and series text. The shared response validator enforces the
fixed source, window, bounds, unique ordering and timestamp semantics. `fetchedAt`
is our retrieval time, not BEA's publication or last-revision time. An empty
supported window is valid; absent dates and missing future coverage are not proof
that no economic events exist. Always identify the displayed scope as BEA.

## Lifecycle and presentation

Keep the agenda under the persistent Markets shell. It shares the existing owner
activity protocol but has no Tiingo or catalog dependency. Session changes,
disabled access and invalidated lifetimes clear data. Hiding Markets cancels an
unfinished request while preserving already accepted data. Reject stale responses,
stale event handlers and late session failures.

Use the current Market Atlas visual style: compact date groups, readable series
labels, a clear Load/Refresh action and source/time text. Use `Intl` with
`America/New_York` for DST-aware display. At 390px, labels wrap and controls remain
usable without document-wide overflow. No calendar-grid framework is needed.

## Acceptance

- Source tests cover real offset normalization, invalid dates, duplicate and
  simultaneous series, both window edges, feed limits, cancellation and close.
- Route/client tests prove request boundaries, exact DTO admission and no source
  request before authorization; no data leaks into error details.
- UI tests prove explicit acquisition, retained snapshots, session/lifetime and
  stale-response guards, empty/error states, DST labels and navigation retention.
- The exact BEA adapter is added to fetch ownership with adverse boundary checks;
  native-module/process ownership and existing Tiingo/SEC invariants stay intact.
- Independent review, focused checks, source-bound Brave QA and the applicable
  existing release gates pass before guarded activation. Use synthetic fixtures
  for destructive/error scenarios, with no owner-record writes.

News, non-BEA calendars, economic values/consensus and company events remain future
work. A released agenda will establish this slice, not completion of M3 or M2.
