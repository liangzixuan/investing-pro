# Managed EOD history

The managed workspace opens EOD close history from an admitted Discover result or
watchlist listing. Load is explicit. The first slice requests one calendar month
of daily raw USD closes and shows the last observed trading-date close, chart,
exact decimal table, requested dates, completion time and Tiingo attribution.
It does not calculate adjusted returns or claim that the last close is a live quote.

The company visit renders either Annual or Price. Validated price rows stay in
that visit's memory when switching sections. An explicit refresh keeps the last validated history
visible while it runs, after Cancel, during a checked cooldown, and after a typed
timeout, temporary unavailability or provider rate limit. The previous-history
notice shows the original completion time; the rows, requested window and source
timestamps remain unchanged. A valid successful response replaces the whole
history and removes that notice. Initial-load failures have no previous history.

Back, selection changes, catalog changes and session retirement clear prices. Authentication loss, unsupported or unconfigured listings, malformed
responses or cooldowns, identity mismatches and unknown errors also clear them.
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

## Source and identity

Authenticated `POST /v1/managed/eod-history` accepts at most 4 KiB and returns at
most 64 KiB. The caller supplies the current catalog digest, exact listing ID and
fixed `1m` range. The server resolves the full admitted identity before budget or
provider work. Fixed candidates keep AAPL, GOOG and GOOGL distinct, including
their security and share-class IDs. A catalog identity alone does not establish
Tiingo coverage or currency; each enabled mapping needs separate acceptance.

The service reuses the existing Tiingo history adapter with quote loading
disabled and a 32 KiB source-body cap. An available response must contain 1–32
strictly increasing, unique, in-window trading dates and positive canonical
decimal closes. The client also checks the complete selected identity, requested
window and response chronology before showing it. Decimal strings are preserved
in the table; the chart converts them only for plotting.

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
no request and receive no automatic retry, read-back recovery or refund. A sixth
transport slot is reserved for rollback before a commit starts. Malformed,
future or overfull reservation data closes admission.

The app budgets 1 MiB per attempt conservatively while capping each source body
at 32 KiB. This is an application allowance, not a measurement of account-wide
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
and checked cooldown. Its visit-scoped board snapshots are separate from the
single price panel; opening that panel still starts unloaded.

Synthetic tests use invented rows and no provider connection. They establish no
live coverage, production deployment, signed APK update or physical-device pass.
