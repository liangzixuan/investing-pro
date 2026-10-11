# Current work

[Product roadmap](PRODUCT_ROADMAP.md) owns delivery order;
[architecture](ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts stay outside Git. The [previous status](history/CURRENT_WORK-2026-10-11-before-pr73.md)
preserves PR69 delivery, earlier live and physical acceptance, and original failures.

## Accepted release

The BEA release is delivered at main
`18d2ae497ba0a86bd33fe20d910e5c3068466c8d`. API deployment
`6acb3949c735fea153f5` was independently observed active on October 11 at
07:29:20.767 UTC, preserving prior deployment `6ac93c888eb42e76a4e5`.
Website deployment `6acb3f823bff0d315466` was verified active at 07:49:53.441 UTC,
preserving previous deployment `6acb05c91d08729f1b03`.
Signed Android 1.22.0/code 23 passed build, complete APK and final delivery review.
Prior APKs, native assets, signing custody and rollback identities are preserved.

Each release surface has its own accepted evidence:

| Item                                               | Accepted identity and result                                                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR73 actual main and tree                          | `18d2ae497ba0a86bd33fe20d910e5c3068466c8d`, `4fb75351156fe29430641e6c1925a3cfb0d5fbe8`                                                                                                               |
| Required actual-main workflows and source proof    | Accepted: five required workflows, six jobs and exact source proof; CI run `38119087172`, attempt 1                                                                                                  |
| API package and deployment                         | Package SHA-256 `562e934576dcffb15b7fc0df9319fb87c31dbe5724697449d2c62a888166fea4`; deployment `6acb3949c735fea153f5` active, settings unchanged                                                     |
| Website source, archive and same-archive promotion | Run `38121968192`, attempt 1; 834,439 bytes, SHA-256 `0378065d75b704d334c9c4b02b7f0d1437edc15dc980d9c01b65071e00dd4b7c`; staging `6acb3cc1e4f66772cefa`, production `6acb3f823bff0d315466`; accepted |
| Signed Android 1.22.0/code 23                      | Build, signer, complete APK and delivery accepted: 6,662,428 bytes, SHA-256 `1dc915f1ac667ddf89afc746972dfa98de7e06d7f4ddf0ac85393d019ae8b889`                                                       |
| Finite production observations                     | October 11: API active pointer at 07:29:20.767 UTC; website activation at 07:49:53.441 UTC                                                                                                           |

The Android package is `app.investingpro.android` with the existing production
signer. Its verified delivery file is
`delivery/android-1.22.0/Investment-1.22.0-release.apk` outside this repository.
All eight copied files and the ninth receipt were verified, and the previous
1.21 delivery's nine files were unchanged. No installation or physical-device
acceptance was performed.

The website promoted the tested staging archive without rebuilding. BrowserStack
covered its exact-build inert shell at desktop and narrow widths. Separately, one
anonymous production calendar request returned the expected safe 401 response
and headers at 07:48:26.441 UTC. These finite checks establish no new authenticated
journey, live provider result or continuing availability claim.

## Verified BEA source and behavior

[PR72](https://github.com/liangzixuan/investing-pro/pull/72) merged as
`93e28084facf0e134daef77e6414a5d8d9ff3b82` after six PR workflows and seven jobs
passed. Five composed tests exercise controlled expiry and two-session conflicts
through the real client, workspace, handler and repository with invented records
and an atomic memory database port. They cover lost acknowledgement, exact
version/receipt replay, failed recovery reads and late completion after retirement.
They do not establish live SDK, real-account or hosted database recovery.
CodeScene's advisory complexity findings were reviewed without a correctness
blocker or check suppression. Its actual-main acceptance separately passed six
workflows and seven jobs; the initial incomplete observation remains retained.

The BEA candidate is `bbe7850eb44416cee030ded574c593d9b40ad234`, tree
`4fb75351156fe29430641e6c1925a3cfb0d5fbe8`. Affected unit suites passed 8,625 tests:
2,648 API, 5,268 web and 709 contracts. The invented Android fixture passed
49 local tests. Required local types, lint, format and source boundaries passed.

The compiled candidate API passed 27 anonymous admission cases with zero fetch
or socket attempts, live authentication calls, provider calls or owner-record
writes. These check browser/native origin handling, missing authentication,
method, body/query and preflight boundaries. They do not accept an authenticated
account or production deployment. Its accepted executable is 1,519,126 bytes,
SHA-256 `3bf16b691149c3419af12da8c0abe0b256fb21bc85c4374c89397742430482eb`;
the accepted actual-main API delivery binds that package to the identical source
tree. Separately, one bounded public BEA adapter
read accepted three events without retaining the response body. It was not a
managed authenticated journey.

[Android run 38116337217](https://github.com/liangzixuan/investing-pro/actions/runs/38116337217),
attempt 1, passed all 22 required cases: three disconnected and nineteen managed,
with no failures, errors or skips. The actual checkout was PR merge
`0bdb5c90b281b645ed21c1ff04336ca82a855ab1`; its tree equals the candidate tree above.
All nineteen managed source markers match that checkout. The actual-main native
workflow also passed its 22-case gate. The downloaded and reviewed report above
belongs to the equivalent PR merge tree; it was not downloaded again from main.

The two BEA native journeys assert exact release/retrieval dates, simultaneous
series and EDT/EST labels, unchanged dirty notes/order/base version, retained
results through failed refresh, Cancel and navigation, and late-response fencing.
Catalog authentication expiry during a held calendar request retires the
workspace, aborts the request and prevents the late packet from restoring data.
Both final frames were inspected, but neither frames the calendar: one shows
upper Markets and the other fixture diagnostics. Calendar layout is not accepted
from those frames; the stated behavior is supported by the executed Java
assertions and checkpoints.

Invented-data Brave checks covered desktop and a measured 390-pixel viewport:
explicit load, dates and DST labels, previous-result notice, Cancel focus,
navigation/draft retention and concurrent expiry with late completion. Scoped
screenshots show the shared agenda layout without horizontal overflow, including
the managed panel spacing and green controls. No signed-in account was used.

Original failures remain retained: fixture setup/count assertions, the first
unconfigured boundary command, API build/admission preparation failures, local
Android compile failures and the timed-out clipped Brave capture. The first
website approval read failed before any POST; fresh reconciliation preceded one
ordinary approval, and its originals remain retained. The native-user
offline Android diagnostic cleared the earlier cached-JAR access error, then
stopped at unavailable cached test dependencies. This does not establish the
first failure's exact cause or a completed local compile. Hosted native evidence
is separate. No tool installation, cache permission change or device action was
needed for that diagnostic. Local builds used existing Node 24.18.0 within the
declared engines; hosted Node 24.19.0 remains the pinned source-gate environment.

## Product scope

The [BEA agenda](MANAGED_MARKETS_HOME.md#bea-release-agenda) adds an explicit
30-elapsed-day release schedule under Markets. Load and Refresh each request the
fixed official feed once. There is no automatic load, timer, retry or navigation
refresh. Dates, Eastern timezone labels, retrieval time and the official source
remain visible. Simultaneous series remain distinct. Forecasts, reported values,
importance scores, company earnings and non-BEA calendars are outside this slice.

Refresh, failure, an invalid replacement and Cancel retain the previous validated
packet with its original dates and a previous-result notice. Invalid or late
packets cannot replace it. Leaving Markets cancels pending work while retaining
accepted data in the session. Retirement clears and fences the agenda. Calendar
actions are independent of catalog/listing admission and watchlist drafts/saves.

The body-free/query-free managed GET is authenticated and bounded to ten seconds
from function entry, including authentication and serialization. Source input is
capped at 256 KiB, 128 series and 4,096 dates; output allows 512 events and 512 KiB.
The fixed public request uses no provider credential, redirect, retry or storage.
These are invocation limits; aggregate upstream allowance is not established.

Existing [Markets prices](MANAGED_MARKETS_HOME.md),
[Annual evidence](MANAGED_SEC_ANNUAL.md), [EOD history](MANAGED_EOD_HISTORY.md)
and [company navigation](MANAGED_RESEARCH_NAVIGATION.md) retain their contracts.
The price cohort is AAPL, GOOG and GOOGL for two issuers, with explicit reads and
dated raw USD evidence. Shared notes, ordering and saves retain conflict recovery;
unsaved drafts remain owned by the mounted session. The BEA slice advances M3
without completing M1, M2 or M3.

## Next acceptance and open limits

The managed design increment is applied on `codex/managed-workspace-design` and
awaits source verification, PR and release acceptance. It consolidates managed
styles, improves mobile spacing and numeric alignment, and gives the native test
fixture the production frame. The [design guide](../DESIGN.md) records typography,
spacing, profile boundaries and accessible states. Brave review of the actual
repository components passed at desktop and 390-pixel widths, including exact
numeric alignment, 44-pixel controls, visible keyboard focus, retained agenda
after failure and Cancel, late-response fencing and a dirty note across research
navigation. The preview used invented data without an account or provider.
This change is not part of the delivered BEA revision above. The local Market
Atlas theme and existing data, draft and session behavior retain their boundaries.

The October 10 owner report remains limited to the requested Android 1.19 and
Brave checklist on Pixel 10 Pro XL/Android 17, without per-step device logs or
browser measurements. Physical 1.20, 1.21 and 1.22 use, controlled live
authenticated recovery, the browser leave dialog, screen-reader and backup/restore
acceptance remain open. This increment adds no new physical-device or live-auth
claim. Earlier live reads retain their original dates and limits in the archive.

Mounted-session retention does not establish offline editing, process-death
restoration or a managed data-recovery design. Managed storage is separate from
the local encrypted vault; no owner migration is accepted. Broader company
fields, sources and cohorts need their own availability, rights, cost and quota
review. Full local feature coverage, native iOS, store distribution, broad
accessibility/performance and sustained daily reliability remain separate work.
Repomix PR27 remains held under resolved Option A. CodeScene remains advisory.

Read [AGENTS.md](../AGENTS.md), this status and the relevant guide before the next
bounded increment. Preserve original failures, prior deployments and owner data.
Follow [website delivery](APPWRITE_DELIVERY.md) and [Android delivery](ANDROID_CLIENT.md)
for their distinct source, configuration, artifact and activation gates.
