# Current work

[Product roadmap](PRODUCT_ROADMAP.md) owns delivery order;
[architecture](ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts stay outside Git. The [previous status](history/CURRENT_WORK-2026-10-11-before-pr73.md)
preserves PR69 delivery, earlier live and physical acceptance, and original failures.

## Accepted release

The managed workspace design release, [PR74](https://github.com/liangzixuan/investing-pro/pull/74),
is delivered from main `5b3701b25bc2c0e9e3ff8c60940991d9ef65fe71`, tree
`9ae22906cd7d3cfd48d0b30d18d4759b7116e16b`. It consolidates managed styles,
improves mobile spacing and numeric alignment, and gives the native test fixture
the production frame. The local Market Atlas theme, explicit data requests,
drafts and session boundaries are unchanged.

Each release surface has its own evidence:

| Item                                            | Identity and result                                                                                                                                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required actual-main workflows and source proof | Accepted: five required workflows, six jobs and exact source proof; CI run `38126827379`, attempt 1                                                                                                                                            |
| Hosted native report                            | Run `38124428746`, attempt 1; 22 named cases, no failures, errors or skips; producing checkout `d023208d313beb50397037b449bf4edb27904e00` has the release tree above                                                                           |
| Unchanged API                                   | Deployment `6acb3949c735fea153f5`, package SHA-256 `562e934576dcffb15b7fc0df9319fb87c31dbe5724697449d2c62a888166fea4`; active pointer and unchanged settings observed October 11 at 09:36:28.011 UTC                                           |
| Website                                         | Run `38129294428`, attempt 1; 835,005 bytes, SHA-256 `9ec423c53af02bbfe22448f07f8c508563274c9ba8d2fc63d4d0596a8b22c2a9`; staging `6acb5a06ba2ed9f972b7`, production `6acbb81798d244538872`; activation verified October 11 at 16:24:23.230 UTC |
| Signed Android 1.23.0/code 24                   | Build, signer and complete APK accepted: 6,662,968 bytes, SHA-256 `6fcd1824f62394b07ee5dd0b765d1023c7b350daa9f61a81d5a29e0a50508a86`; eight copied files and the ninth receipt verified                                                        |

The API bundle remains the accepted BEA build from candidate
`bbe7850eb44416cee030ded574c593d9b40ad234`, tree
`4fb75351156fe29430641e6c1925a3cfb0d5fbe8`, deployed for main
`18d2ae497ba0a86bd33fe20d910e5c3068466c8d`. Equivalent API/build/configuration
sources and the fresh pointer observation support carrying that delivery forward;
this design release performed no API rebuild, activation or settings change.

The Android package is `app.investingpro.android` with the existing production
signer. Complete artifact review covered all 510 archive members, five client
assets and the full merged manifest. The manifest differs from accepted 1.22
only in version code/name. The verified APK is
`delivery/android-1.23.0/Investment-1.23.0-release.apk` outside this repository.
All eight copied files and the ninth receipt were verified, and all nine files
in the previous 1.22 delivery remain unchanged. No installation or
physical-device acceptance was performed.

The website promoted the tested staging archive without rebuilding, preserving
previous production deployment `6acb3f823bff0d315466`. BrowserStack
covered its exact-build inert shell at desktop and narrow widths. Activation was
verified at the recorded time; these checks establish no new authenticated
journey, live provider result or continuing availability claim.

The downloaded native report belongs to the equivalent PR merge tree; actual-main
native workflow acceptance is separately included in the source checks above.
Sixteen of 66 retained native frames received scoped visual review. Both final
BEA frames exclude the agenda, so calendar dates and request lifetimes are
supported by passed Java assertions rather than those images. Invented-data
Brave checks of the actual repository components passed at desktop and 390-pixel
widths: numeric alignment, 44-pixel controls, visible focus, retained agenda after
failure and Cancel, late-response fencing and dirty-note retention across research
navigation. These checks used no account or provider.

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

The owner selected Precision Desk for a full managed-workspace redesign,
superseding the compact-header proposal. The candidate adds a dark left rail,
periwinkle actions, locally bundled Inter and Tabler icons, a listing/detail
Markets layout and one selected watchlist editor. Company research places notes
beside evidence on wide screens. Narrow screens use bottom navigation. Exact
prices, dates, explicit requests, drafts, recovery and session ownership retain
their existing contracts. The [design guide](../DESIGN.md) records references,
tokens, layout and verification requirements.

Actual-source invented-data Brave review covered loaded and unloaded Markets,
watchlist selection, invalid-note focus, research return focus, dirty sign-out
review and BEA refresh failure/cancellation at desktop, 390 and 320 pixels.
The final narrow views had no document overflow and retained 44-pixel controls.
Fresh captures verified the quote/provenance layout, loaded Annual evidence and
keyboard clearance above bottom navigation. The software-license panel contains
the bundled icon and font notices. An earlier tab timeout and a blocked deep-query
reload remain recorded; a fresh root entry and in-app navigation worked without
changing browser protections. This preview does not accept deep reload or native
recovery. No production account or provider was used.

The first overhaul Android run completed 22 cases with three failures: two
price-row assertions selected the newly added accessibility label, and long
decimal prices caused horizontal overflow. The assertions now select the dated
basis explicitly, preserving exact expected text. Price rows wrap long values;
the detail quote and change wrap onto separate lines when needed. Follow-up
Brave geometry checks at 411 and 320 pixels found no document overflow and kept
the comparison above bottom navigation. The original failed report is retained.
Fresh native run `38167144905`, attempt 1, passed all 22 cases with no failures,
errors or skips. Its producing checkout has the overhaul tree
`4d5bbe7f9d6389876229e7a5465f3ca87f8090fe`; all nineteen source markers match.
Sixteen of 67 retained frames received scoped visual review. Calendar layout
remains outside those final frames.

All 255 focused component, lifecycle and chart tests passed, alongside 98
packaging tests, root/web types and scoped lint/format checks. The font's
WOFF2 signature and declared length are admitted by the existing bounded website
packager; path, hash, link and size checks remain in place. The local dependency
license inventory stopped at a missing pnpm package-index file; the subsequent
hosted inventory passed. PR75 merged as
`91e65a47f5eb46711d68440371d89a84c17d5f0e`; all six applicable main workflows,
seven jobs and the exact source proof passed. Its signed Android 1.24 package
passed full archive, manifest, bundled font/license and existing-signer checks;
final delivery and device acceptance remain separate.

Website staging run `38172917243`, attempt 1, deployed the overhaul but failed its
BrowserStack step. The retained log reports the runner failure without assertion
details. Source review found that the smoke test permits font requests but its
asset rule rejects the newly bundled WOFF2 file. The repair admits hashed
same-origin WOFF2 font requests while preserving the other request restrictions
and the zero unexpected-request assertion. Fresh source checks, successful
staging and release approval are required before publication. PR74 and Android
1.23 remain the delivered release above. Default signed-out/loading and native
recovery states still need their scoped visual checks.

The October 10 owner report remains limited to the requested Android 1.19 and
Brave checklist on Pixel 10 Pro XL/Android 17, without per-step device logs or
browser measurements. Physical 1.20 through 1.23 use, controlled live
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
