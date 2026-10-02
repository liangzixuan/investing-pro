# Managed EOD history

The managed workspace opens Price history from an admitted Discover result or
watchlist listing. Load is explicit. The first slice requests one calendar month
of daily raw USD closes and shows the last observed trading-date close, chart,
exact decimal table, requested dates, completion time and Tiingo attribution.
It does not calculate adjusted returns or claim that the last close is a live quote.

Only one Annual report or Price history panel is open at a time. Price rows stay
in that panel's memory. Refresh, Cancel, Back, selection changes, catalog changes
and session retirement clear them. Late responses cannot restore cleared rows.
The mounted workspace retains its unsaved notes and order. Android Back closes
the panel through the same action and restores focus to its opening control.
There is no automatic load, retry, prefetch or refresh on resume.

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

The owner confirmed private Tiingo Individual Starter display on desktop and
phone. AAPL is the first intended live acceptance target. Production mappings
remain closed until private provisioning, exact provider mapping, shared hosted
admission and bounded live acceptance are recorded in workspace CURRENT.
Synthetic tests use invented rows and no provider connection. They establish no
live coverage, production deployment, signed APK update or physical-device pass.
