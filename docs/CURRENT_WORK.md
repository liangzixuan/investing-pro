# Current work

Updated October 13, 2026. The [product roadmap](PRODUCT_ROADMAP.md) owns delivery
order; [architecture](ARCHITECTURE.md) defines runtime boundaries. The
[preceding status](https://github.com/liangzixuan/investing-pro/blob/997685543b701e30a9e6a3f4c894428746025aa9/docs/CURRENT_WORK.md)
retains earlier increments, original failures and dated acceptance. Operational
receipts remain outside this public repository.

## Accepted release

Release `5b2715e` is published on the managed website and API. Android 1.26.0
(code 27) is delivered with the existing production signer. Previous website,
API and Android 1.25 releases remain preserved. Physical installation of 1.26
was not performed.

The release includes watchlist note search, an explicit comparison-to-note
action and the compact workspace footer. Software licenses follow the main
content; session scope appears with the sign-out review. Private fixture controls
are excluded from production. Source, exact-build staging and Android package
checks passed before the approved release.

A separate Chrome check confirmed the signed-in Markets layout and compact footer.
An initial catalog failure recovered after one explicit refresh. The three board
listings then rendered with prices unloaded. No provider read, note inspection or
owner write was performed, and the initial failure's cause is unknown.

### Delivery status

| Surface         | Accepted status                                         | Limits                                                                                     |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Website and API | Release `5b2715e` active; previous deployments retained | Inert staging and bounded live checks do not establish sustained authenticated reliability |
| Android         | Signed 1.26.0, code 27, delivered                       | No physical installation or upgrade acceptance for this version                            |
| Main source     | PR99 merged as `b59c92a`; actual-main checks pass       | Published release stays unchanged                                                          |
| Chart candidate | PR99 source and original hosted checks accepted         | Live chart delivery and physical Android use remain unaccepted                             |

## Current task and next acceptance

[PR99](https://github.com/liangzixuan/investing-pro/pull/99) adds an optional
indexed raw-price path to the existing two-listing watchlist comparison. It uses
only currently loaded shared observations and the chosen interval. Each series
starts at 100; exact source closes, rounded indices, complete listing identities
and original provenance remain available in a semantic table. The chart adds no
request, saved state or broader coverage. See the
[watchlist guide](APPWRITE_WATCHLIST.md#inspect-raw-price-paths).

A short guide stays above the chart. Its complete calculation explanation is in
the initially closed **Chart method and limits** disclosure, after the plot and
before exact data. The explanation remains available when data is unavailable.
This presentation change preserves the renderer, calculations and data lifetime.

Focused model and component checks, web types, lint, formatting, source boundaries
and independent source review pass. Chrome checks at 1440, 390 and 320 CSS pixels
accept the chart, readable endpoint labels, full method, keyboard controls and
contained table scrolling. Missing data, retained responses, cancellation, late
completion, navigation and session retirement retain their tested contracts.
The latest native fixture build remains within the unchanged asset limit.

The original PR99 hosted attempt passed five Actions jobs. Android passed 24 of
25 cases: the export test rejected one accessibility click on its invented root
in the system file picker, after earlier Save and exact-byte checks passed.
Screenshot cleanup then failed while the picker covered the app. A separate
actual-main attempt had failed a root click earlier in the same export journey.
Neither attempt establishes a production export defect or the rejection's cause.
Original failures remain retained; CodeScene's failed advisory was reviewed
without an actionable correctness finding.

The test-only repair replaces that root interaction with one checked native
touch through AndroidX UI Automator, using a freshly resolved and bounded target.
The existing readiness deadline, actual system Save, provider output, exact bytes,
permissions, cancellation and recreation assertions remain required. Updated
head `e39b54d` passed all six required Actions jobs across five original workflows.
Android passed all 25 cases and its APK isolation gate, including five successful
guarded picker touches and the existing saved-byte assertions. CodeScene retains
its reviewed advisory failure. After owner approval, PR99 merged into main as
`b59c92a`. The separate actual-main run also passed all six Actions jobs,
including the 25 Android cases and APK isolation gate.
Live delivery of the chart is not accepted.

### Federal Reserve announcements candidate

The next increment adds an explicit official monetary-policy feed read below the
BEA agenda. It reuses the existing provider and metadata contract. The managed
API and client preserve source links, publication times, the original retrieval
time, retained responses and session retirement. Company and pending navigation
cancel active requests. [Markets scope](MANAGED_MARKETS_HOME.md#federal-reserve-announcements)
describes the limits; broader news remains roadmap work.

Affected API, client, navigation and fixture checks and independent source review
pass. Chrome accepts explicit loading, retained original dates after failure or
cancellation, empty replacement, navigation with an unsaved note, invalid-link
recovery and session retirement. Final layouts pass at 1440, 390 and 320 CSS
pixels, with keyboard controls and no horizontal overflow. The preview uses
invented data; live authentication and provider acceptance remain separate.

A prerequisite compresses the unchanged complete software-license text into a
lazy module. Source, round-trip, decoding, lifetime and Chrome checks pass,
including full displayed text equality and recovery after decoder failure. The
integrated native fixture build uses 2,198,001 bytes at its largest loader payload,
below the unchanged 4 MiB limit. Its new announcements journey and extended
license assertions still require execution in the original hosted Android run.

The first hosted Android attempt stopped before native execution: the strict
Gradle configuration map had not been updated for the declared WebView minimum.
The map now includes that exact setting. The original Gradle validation task
accepts it and rejects missing, altered or extra settings in an isolated check;
a cross-file regression passes. Whole-app build and native execution still need
the updated revision's hosted checks. The original failure remains retained.

The updated run executed all 26 Android cases. One failed at an added license
check because its boundary assertion expected zero saves after the test's
intentional save; the assertion now expects that one save. The other 25 cases
passed, including announcements and export. APK isolation was skipped after the
failure. Ubuntu also timed out while comparing the complete decompressed license
Buffer. That test now uses native exact-byte equality and keeps the same timeout
and remaining assertions. Both original failures remain recorded. The repaired
revision passes five of six required Actions jobs, including Ubuntu and all 26
Android cases, APK isolation and complete license-byte checks. Windows instead
times out in an unchanged native-socket deadline test. A focused local run and
phase trace pass; they do not reproduce or explain the hosted timeout. A diagnostic
test update records bounded failure phases while preserving the request deadline,
test timeout and native-close assertions. Its original hosted checks remain pending.

### Watchlist Annual comparison in development

The next increment compares two different companies from the full watchlist
draft. Both choices start empty, and each report loads explicitly through the
existing SEC access boundary. Each column keeps its own fiscal period, revenue
basis, exact USD amounts, available annual revenue change and complete evidence.
There is no cross-company calculation, new source or saved-payload change. See
the [Annual comparison guide](MANAGED_SEC_ANNUAL.md#watchlist-annual-comparison).

Affected model, projection, UI and workspace checks, web types, scoped lint and
independent source review pass. Regressions cover basis resets after changing
companies or clearing a choice; refreshes and unchanged membership edits retain
the selected basis. Chrome checks at 1440, 390 and 320 CSS pixels accept explicit
reads, separate filing periods, exact amounts, full-draft Save and recovery,
cancellation, late replies, navigation and session retirement. Controls retain
44px targets, and the results table scrolls by keyboard without page overflow.
The checks use invented RAM data and do not establish live SEC access.

The integrated native fixture's largest static loader payload is 2,234,308 bytes,
below the unchanged 4 MiB cap. Source and bundle checks pass; the new Annual
journey still requires its original hosted Android execution.

## Product scope

The managed website and Android client share the Precision Desk presentation,
Discover, a private watchlist with notes and ordering, company research and a
small Markets board. [Price history](MANAGED_EOD_HISTORY.md) covers AAPL, GOOG and
GOOGL, three listings for two issuers, with explicit reads and dated raw USD
closes. It supplies no adjusted returns or whole-market ranking.

[Annual research](MANAGED_SEC_ANNUAL.md) shows admitted same-filing evidence and
available adjacent annual comparisons. [Recent filings](MANAGED_SEC_FILINGS.md)
provides explicit metadata reads, original links, local paging and exact form
filtering. Both connect eligible evidence to the current research-note draft.
The [BEA agenda](MANAGED_MARKETS_HOME.md#bea-release-agenda) supplies an explicitly
loaded 30-day official release schedule, with source and Eastern timezone labels.
Forecasts, reported values and non-BEA events remain outside that schedule.

[Watchlist](APPWRITE_WATCHLIST.md) changes use explicit whole-draft Save and conflict
recovery. Ordinary navigation preserves the mounted draft; session retirement
clears it. The local research profile and encrypted vault remain separate from
managed storage. These increments advance the roadmap without completing M1,
M2 or M3.

## Next acceptance and open limits

Resolve the announcements revision's Windows check and complete
the Annual comparison's applicable hosted checks, including its new Android
journey. Local Annual source, Chrome and native bundle acceptance are complete;
hosted runtime and live delivery remain separate. Continue with the next complete
product outcome from the roadmap and relevant feature guide, using existing
subscriptions and permitted free sources. Broader fields and cohorts need
verified source rights, cost, quotas and identity handling.

Controlled real-account expiry and two-session conflict acceptance, authenticated
browser coverage, screen-reader review, physical upgrades and an isolated managed
backup/restore exercise remain separate work. The owner's October 10 report
covers the requested Android 1.19 and Brave checklist on Pixel 10 Pro XL/Android
17; it does not establish later physical acceptance or per-step measurements.
Mounted-session retention does not establish offline editing, process-death
restoration or cloud-data recovery.

The existing synthetic recovery suites, inert BrowserStack checks and native
journeys retain their individual scopes. Broader company fields, valuation,
peers, news, asset classes and daily reliability remain roadmap work. Native iOS,
store distribution and owner-data migration are not accepted. Repomix PR27 stays
held under Option A; CodeScene remains advisory.

Read [AGENTS.md](../AGENTS.md) and the relevant guide before each bounded increment.
[Website delivery](APPWRITE_DELIVERY.md) and [Android delivery](ANDROID_CLIENT.md)
keep source, configuration, artifacts, activation and physical use separate.
