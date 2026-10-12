# Current work

[Product roadmap](PRODUCT_ROADMAP.md) owns delivery order;
[architecture](ARCHITECTURE.md) explains runtime boundaries. Private operational
receipts stay outside Git. The [previous status](history/CURRENT_WORK-2026-10-11-before-pr73.md)
preserves PR69 delivery, earlier live and physical acceptance, and original failures.

## Accepted release

Release `2b3c252a6aee4d1eb21c3a6967416a7c381d9e2d`, tree
`6f396d33eb3f55858dbae20244c6d9b61697bb42`, is live on the website. It adds
shared-date raw-price comparisons, Precision Desk entry states and keyboard focus
after watchlist recovery. The staging archive was promoted unchanged after owner
approval on October 12. Production deployment `6acc6e06264dd8676f54` was verified
active at 05:20:37.707 UTC; previous deployment `6acc131b1cc9946cee6b` is retained
for rollback. Source checks, the exact-build inert BrowserStack check and Android
package checks passed. The API remains unchanged.

A live Brave check reused the existing session and confirmed the release marker
and initial unloaded workspace at 1440 and 390 pixels without document overflow
or console errors. It made no Price, Annual or agenda request, fresh sign-in or
owner write. Signed Android 1.25.0/code 26 is delivered: 6,722,015 bytes, SHA-256
`2af548c10e7ee65f38553ee9d40c8cc12d96165380f912c4f0dd7457ec0e40ab`.
All nine delivered files and the unchanged prior 1.24 release passed independent
verification. Physical-device installation is not established. Later source
increments below remain outside this release.

## Earlier Precision Desk release

The Precision Desk overhaul in [PR75](https://github.com/liangzixuan/investing-pro/pull/75)
and its staging font-policy repair in [PR76](https://github.com/liangzixuan/investing-pro/pull/76)
have accepted source at main `c13b6e4bff3e1b78c9cc82f0b5ad85884c2cc9bf`, tree
`8e9a26b57bb8ba9571d0623c8b75c96d0854cd49`.
This website release preceded 2b3c252; signed Android 1.24.0/code 25 remains preserved.

The managed workspace now uses a dark left rail, periwinkle actions, locally
bundled Inter and Tabler icons, listing/detail Markets and one selected watchlist
editor. Research notes sit beside evidence on wide screens; narrow screens use
bottom navigation. Exact decimals, dated provenance, explicit requests, drafts,
recovery and session ownership retain their contracts. The local Market Atlas
profile remains separate. [DESIGN.md](../DESIGN.md) records the reference choices
and implementation rules.

| Surface                | Evidence and status                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source                 | Four required PR workflows/five jobs and three actual-main workflows/four jobs passed; CI `38176323214`, attempt 1, and its original source proof accepted                                                                                                                                       |
| Native                 | Run `38174145166`, attempt 1, passed 22 named cases without failures, errors or skips; checkout `429085563064546c06166f1788e4774195133e5b` has the release tree; nineteen managed source markers matched                                                                                         |
| API                    | Deployment `6acb3949c735fea153f5`, package SHA-256 `562e934576dcffb15b7fc0df9319fb87c31dbe5724697449d2c62a888166fea4`; enabled pointer and unchanged settings observed October 11 at 22:40:05.686 UTC                                                                                            |
| Staging                | Run `38181587015`, attempt 1, job `114595113294` passed; original archive and staging accepted at deployment `6acc115c76326ec143b1`                                                                                                                                                              |
| Production             | deployment `6acc131b1cc9946cee6b`, activation verified October 11 at 22:52:41.965 UTC; archive 892,079 bytes, SHA-256 `574fccb382cfc633b0aede210634da8b598a08faff15196a4fa207839184e2ef`; the tested archive was promoted without rebuilding, preserving prior production `6acbb81798d244538872` |
| Android 1.24.0/code 25 | Build and complete artifact accepted: 6,719,623 bytes, SHA-256 `59c8247b51c87d0c3bac1440a996cac11f4ab99435b666e9f1de8c2313a73127`; eight payload files and the ninth receipt verified                                                                                                            |

The API keeps the BEA bundle built from `bbe7850eb44416cee030ded574c593d9b40ad234`,
tree `4fb75351156fe29430641e6c1925a3cfb0d5fbe8`, and deployed for
`18d2ae497ba0a86bd33fe20d910e5c3068466c8d`. The 713 protected inputs, retained bundle,
opaque configuration hashes and fresh pointer support carrying it forward.
No API rebuild, activation or settings change occurred.

The Android artifact retains package `app.investingpro.android` and the production
signer. Review covered all 513 archive members, eight client assets, bundled font
and licenses, and the full merged manifest. The manifest differs from accepted
1.23 only in version code/name. The verified APK is
`delivery/android-1.24.0/Investment-1.24.0-release.apk` outside this repository.
All eight payload files and the ninth receipt were verified, and all nine files
in the previous 1.23 delivery remain unchanged.
Artifact review does not establish installation or physical use.

Actual-source Brave reviews used invented data at desktop, 390 and 320 pixels.
They covered loaded/unloaded Markets, long prices, selected watchlist editing,
invalid-note and return focus, dirty sign-out review, Annual evidence and BEA
refresh failure/Cancel. Narrow views had no document overflow and retained
44-pixel controls. PR76 changed no application source or assets, preserving that
scoped visual evidence. Focused verification passed 255 component/lifecycle/chart
checks and 98 packaging checks; the font-policy regression passed all 32 cases.

The native archive retains 67 images. Sixteen received agent visual review and
two received separate root review. Calendar layout remains outside that image
scope; executed Java assertions support its dates and request-lifetime behavior.
Actual-main native checks passed separately from the downloaded equivalent-tree
PR report. BrowserStack covered the exact-build inert shell.

A separate production Brave check reused the existing session and matched the
release marker. The initial workspace and three catalog listings rendered at
1440 and 390 pixels without document overflow. Prices remained unloaded; no
price, report or agenda action, fresh sign-in or owner write was performed.
This establishes initial rendering, not a full authenticated journey, provider
retrieval or continuing availability.

The original native failures and PR75 staging failure remain retained. The old
staging log reports a runner failure without its hidden assertion. A separate
regression proved that its asset rule rejected the bundled WOFF2 font. PR76
admits hashed same-origin WOFF2 font requests while preserving the other request
restrictions and zero unexpected-request assertion. The earlier signed 1.24
candidate remains preserved and undelivered; the digest above identifies the
fresh build from the accepted PR76 main.

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

The active comparison-ordering increment adds Board order, Highest raw change
and Lowest raw change to the complete three-listing shared-date comparison.
Ordering uses exact endpoint ratios before display rounding. Exact ties retain
symbol, exchange and listing-ID order in both directions. The table and its source
details share the selected order; the board, chart selection and note draft stay
unchanged. Missing history still withholds the complete comparison.

The labelled order selector remains available through missing or insufficient
history, retaining its choice while the view is mounted. Local verification passed
109 analytics tests and 92 comparison/Markets tests, types and scoped lint/format.
Independent arithmetic and UI reviews and source boundaries passed. Brave checks
with invented data at 1440, 390 and 320 pixels confirmed exact tiny-change and tie
ordering, matching source details, retained request dates, selection and draft
preservation, company Back, cancellation, late-response rejection and retirement.
The results region kept keyboard focus through refresh and unavailable states;
the narrow table supports arrow-key scrolling without document overflow.
No console errors were observed. Native picker keyboard selection was not
established by these browser checks. The existing invented Android journey now
exercises all three choices and their request/draft invariants; execution and
hosted acceptance remain pending. See the
[comparison contract](MANAGED_MARKETS_HOME.md#compare-the-three-listings).

The accepted MSFT increment adds a fourth Discover listing and a third Annual
issuer. Its common-stock identity is bound to the reviewed SEC cover, unique
OpenFIGI result and dated MIC relationship. Existing AAPL, GOOG and GOOGL
identities and price mappings remain unchanged. The catalog keeps its source
dates and separate limitations; it does not add MSFT price coverage.

For a listing without price coverage, Price explains that history is unavailable
before starting a request. Annual and the existing note draft remain usable.
The shared coverage check compares the complete listing identity, so a reused
symbol cannot authorize a different security. Leaving research cancels pending
work, and late responses cannot replace a newly selected listing.

Local verification passed 556 affected frontend tests and 393 API tests, types,
scoped lint and formatting. Independent source reviews found no remaining
product defect. Actual-component Brave checks with invented data passed at
1440, 390 and 320 pixels, including unavailable and mismatched Price identities,
Annual note append/Save/reload, navigation cancellation, late-response rejection
and session retirement. No overflow or console errors were observed. The first
boundary run caught a package import in an Annual test. The test now uses the
local catalog API, all 19 Annual tests pass again, and the unchanged dependency
rule passes. Hosted CI then caught a navigation fixture without explicit coverage
for its invented listing. The fixture now declares that coverage, with all 12
navigation tests, types and scoped checks passing; production guards are unchanged.
All eight hosted checks passed for
`d44fc5f0d4b3a8d2785c5a40ceec3e4b8ca3ae69`, including both CI platforms and
Android. [PR83](https://github.com/liangzixuan/investing-pro/pull/83) merged as
`0b4922b78f33c7a1e49c823ff8433a8728efb234` on October 12 at 05:50:21 UTC.
Actual-main and live-delivery acceptance remain separate.
See the [catalog](MANAGED_SECURITY_CATALOG.md),
[Annual](MANAGED_SEC_ANNUAL.md) and
[research navigation](MANAGED_RESEARCH_NAVIGATION.md) guides.

[PR82](https://github.com/liangzixuan/investing-pro/pull/82) merged as
`636cbaf91de922817aad74232e7688a2fae5daf0` on October 12 at 04:10:29 UTC after
all seven hosted checks passed, including both CI platforms and Android.
The Annual overview leads with financial results on the managed company page.
Exact current/prior/history figures and dated changes lead each named revenue
basis, with source and validation details below. Current-use restrictions,
missing values and retained-report notices remain visible. It reuses the existing
admitted evidence and calculations; the local profile keeps its presentation.
Affected tests, web types, scoped lint/format and source boundaries passed.
Independent review and actual-component Brave checks with invented data passed
at 1440, 390 and 320 pixels. Financial metrics appear in the first desktop view;
one-to-three-period tables, long exact values and basis names fit without
horizontal overflow. Keyboard disclosures, explicit note append and Back with
the complete draft, refresh failure/Cancel, late-response rejection and session
retirement passed without console errors. Focus on the results region and after
Cancel was observed; focus retention across asynchronous replacement remains
source-backed, not a separately observed transition. That browser review excluded
Save/reload, live accounts and provider requests. The adapted Android assertions
passed hosted execution. Source acceptance and live delivery remain separate.
See the [financial overview](MANAGED_SEC_ANNUAL.md#financial-overview).

[PR81](https://github.com/liangzixuan/investing-pro/pull/81) merged as
`90092c86eb7b79ef27b1689409f57874dba53a32` on October 12 at 03:15:14 UTC after all
six hosted checks passed. **Search My Watchlist** filters the current draft by a
normalized phrase within symbol, company, share class or exchange. It shows
matching and total counts while retaining the exact selected listing and raw
note, even outside the results. Correction reveals the first invalid note across
the complete draft; filtered saves still include every membership. Reordering
requires clearing the search. Removal preserves keyboard position in the
remaining matches or the stable search/empty target. Research Back retains the
query, and session retirement clears local presentation state. The
[watchlist guide](APPWRITE_WATCHLIST.md#search-the-current-watchlist-draft)
records the matching and focus rules.

All 108 affected editor and workspace checks pass, along with web types, scoped
lint, formatting, unchanged source boundaries and a command-only component
complexity check. Independent native source review covers
the existing company-note journey's added hidden-invalid-note correction and
filtered full-payload Save assertions. Actual-component Brave checks with twelve
invented listings passed at 1440, 390 and 320 pixels. Filtering retained hidden
notes and exact selection; one save preserved the complete twelve-member payload.
Research Back, hidden-invalid-note correction, filtered removal, keyboard Clear,
both recovery choices and session retirement passed. No document overflow or
console error was observed. The PR's hosted Android check passed; actual-main
acceptance and delivery remain separate.
No new provider request, storage contract, live account, screen-reader or
physical-device acceptance is claimed.

A local keyboard-bypass increment adds **Skip to workspace content** before the
managed workspace controls. It focuses the existing content landmark while
preserving company URLs, Clerk fragments, drafts and request behavior. Active,
entry and workspace-creation compositions retain one main landmark and one h1.
Existing research, Back and watchlist-recovery focus remain unchanged. The
[navigation guide](MANAGED_RESEARCH_NAVIGATION.md#keyboard-bypass) describes the
scope. Seventy-eight screen checks and 34 unchanged adapter/session checks pass,
along with web types, scoped lint/format and unchanged source boundaries.
Independent source review resolved a focus-outline cascade issue and found no
remaining defect. Actual-component Brave checks with invented data passed at
1440, 390 and 320 pixels: the first Tab reveals a 44-pixel skip control, Enter
focuses the content, and the next Tab reaches its controls. Empty Discover,
pending, resolved and invalid company views preserve query and fragment without
extra requests. A conflict keeps its draft and request counts; Keep my draft
still focuses the watchlist heading. Retirement clears the draft and removes the
link. No document overflow or browser console error was observed. Runtime
history length was not observed; source and handler tests establish no navigation
calls. Hosted acceptance and delivery remain open. This work adds no
screen-reader, native execution or physical-device acceptance claim.

[PR77](https://github.com/liangzixuan/investing-pro/pull/77), merged October 12,
restores keyboard position after a successful watchlist
recovery choice. Choosing **Use saved version** or **Keep my draft** removes that
review; focus should move once to the visible My Watchlist heading. A stale choice,
inactive view, session retirement or a user moving focus elsewhere must not pull
focus back. Saved payloads, drafts, request behavior and explicit Save retain their
existing contracts. All 66 component tests and 14 coordinator tests pass, along
with web types, scoped lint and formatting. An independent review caught and
resolved a pending-navigation timing edge. Actual-component Brave checks with
invented data passed at 1440 and 390 pixels, covering both choices, replay recovery,
an empty saved result, the next Tab stop and unchanged request counts. No browser
console errors or document overflow were observed. Source review and local browser
checks and all PR checks passed; actual-main checks and delivery remain separate. The accepted
release above remains the deployed baseline.

[PR78](https://github.com/liangzixuan/investing-pro/pull/78) brings the managed entry, loading and native recovery
states into Precision Desk. It uses one shared presentation section and a distinct
retained-session warning while preserving authentication, session ownership,
redirects and complete status messages. The browser form retains Clerk's existing
settings and styles; SDK theme changes are deferred. All 37 affected adapter/session tests,
web types, scoped lint/format and source boundaries pass. Independent source review
found no authentication or session regression. Actual presentation-component Brave
checks covered seven invented states across desktop and narrow widths, with a
final warning/footer check at 1440, 390 and 320 pixels. The observed controls were
44 pixels high, with one page h1, visible keyboard focus, complete messages and no
document overflow or console errors. The browser SDK and real active workspace
were excluded from that entry fixture. The staging page deliberately does not
mount Clerk. A future SDK theme change needs separate review in a controlled,
signed-out Brave context at the canonical origin.

The [product roadmap](PRODUCT_ROADMAP.md) continues to guide later increments.
Physical installation or use of Android 1.24 remains optional and unverified.
The entry work passed all six hosted PR checks and merged October 12. Actual-main
checks and delivery remain open. Actual sign-in widget rendering is not established by these
checks. The presentation overhaul adds no broader market-data
coverage and does not complete M1, M2 or M3.

The next product increment compares the three loaded Markets listings across
their earliest and latest shared observed dates, in board order. It reuses raw
USD closes and the existing exact-decimal calculation, with complete-cohort and
insufficient-history explanations. Each response keeps its original request
dates and retained-history status. This is a derived view with no additional
request, saved state, ranking or adjusted-return claim. Local acceptance includes
35 component/workspace tests, the unchanged 68 model tests, web types, scoped
lint/format and source boundaries. Independent review caught two removable
keyboard targets; both now remain mounted when data becomes unavailable.
Actual-component Brave checks passed shared-date, missing-history, precision,
retained-provenance and keyboard behavior at desktop and narrow widths. Final
React transitions preserved results/disclosure focus without retaining cleared
data or taking focus from another control. The existing Android Markets journey
now asserts shared dates, exact values, retained provenance, late-response
rejection and clearing on navigation using its existing invented responses.
Those assertions passed in hosted Android execution. A separate existing
earlier-date selector test failed when its opening tap became a long press.
The helper now opens the native picker with Space after verifying select and
window focus. Fresh native execution, full hosted acceptance and delivery remain
open. See [the comparison contract](MANAGED_MARKETS_HOME.md#compare-the-three-listings).

The October 10 owner report remains limited to the requested Android 1.19 and
Brave checklist on Pixel 10 Pro XL/Android 17, without per-step device logs or
browser measurements. Physical 1.20 through 1.24 use, controlled live
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
