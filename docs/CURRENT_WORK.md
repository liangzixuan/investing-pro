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
| Main source     | PR100 then PR101 merged; main is `9cc3423`              | All six actual-main Actions passed; published release stays unchanged                      |
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
test timeout and native-close assertions. The resulting PR100 revision passes all
six required Actions jobs, including Windows and 26 Android cases with package
isolation. Its artifacts were independently accepted. CodeScene retains reviewed
complexity advisories. The earlier Windows failure remains unexplained.

### Watchlist Annual comparison candidate

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
below the unchanged 4 MiB cap. PR101 passes all six required Actions jobs. Its
original Android run passes 27 cases, including the new Annual journey and
package isolation; the artifact was independently accepted. CodeScene retains
reviewed complexity advisories. Source merges and live delivery remain separate.

### Annual cash generation candidate

The company Annual view now includes independently reported operating cash flow
and PP&E purchases, plus their exact same-period difference labelled as an app
calculation. Each measure retains its own availability, annual period and
current-use status. Income and cash scans are independent. The strict Annual
payload version is 2.0.0; the same two SEC requests, source limits, admission,
deadlines and saved watchlist schema remain in place. See the
[cash generation guide](MANAGED_SEC_ANNUAL.md#cash-generation).

Affected contract, calculation, API, decoder and presentation checks pass.
Independent source reviews and a replay of retained public SEC responses accept
the exact amounts, original acquisition times and strict client decoding. The
replay makes no network request and does not establish current live availability.
Chrome accepts the rendered cash values, independent unavailable states, source
details and exact long amounts at 1440, 390 and 320 CSS pixels. A first desktop
check found misaligned values beneath a wrapped label; the corrected layout
aligns them. Pending and failed refreshes retain original evidence, malformed
responses clear values, and cancellation, navigation, explicit draft Save and
session retirement preserve their existing contracts. These checks use invented
RAM data. The integrated native fixture builds with a largest loader payload of
2,252,458 bytes, below the unchanged 4 MiB cap; all complete license bytes are
preserved. The original hosted Android run passes all 27 cases and package
isolation. The original Ubuntu and Windows jobs find two stale test expectations:
the Annual request still uses version 1.0.0, and the static module inventory omits
the extracted Annual fact normalizer. The corrected tests retain every existing
assertion. Updated head `4e09479` passes all seven required Actions jobs, including
27 native cases and package isolation. Original failures and reviewed CodeScene
advisories remain recorded. Source merge and live delivery remain separate.

### Annual readability candidate

Managed revenue bases now use distinct readable labels, and genuinely missing
bases appear as compact rows. Rejected or withheld evidence keeps its explanation;
exact concept identifiers and statuses stay in the existing source details. The
local evidence view, financial values, requests and note format stay unchanged.

The 127 affected tests, web types, lint and independent source review pass.
Chrome checks at 1440, 390 and 320 CSS pixels accept the headings, compact rows,
exact source keys, rejected and historical states, and keyboard disclosure.
Keyboard focus stays on the same financial-results region through delayed
replacement in both directions between populated and missing bases. Failure,
Cancel, late replies, exact note evidence, whole-draft Save and session retirement
retain their existing contracts. Checks use invented RAM data. The integrated
native fixture builds with a largest loader payload of 2,254,725 bytes, below the
unchanged 4 MiB cap. PR103 passes all six applicable Actions jobs and CodeScene.
Its original Android run passes all 27 cases and package isolation; the artifact
has been independently accepted. Source merge and live delivery remain separate.

### Cash generation to note candidate

An explicit company Annual action adds available cash generation to the latest
watchlist-note draft. It retains both reported USD amounts, the exact app
calculation, filing and period, raw concepts and original evidence dates.
Historical and retained reports are qualified; missing or incompatible cash
inputs remain unavailable. Income evidence does not gate valid cash evidence.

Whole-note validation, exact-duplicate refusal and existing identity, response,
visit and save-coordinator guards preserve edits. Appending makes no source or
save request. Review and explicitly save the whole draft. Focused model,
component and integration checks and independent web source reviews pass.
Chrome checks at 1440, 390 and 320 CSS pixels accept keyboard use, wrapping,
latest-note admission, full-draft Save/reload and preservation of other entries.
Missing and incompatible cash inputs refuse the action; negative cash flow,
zero purchases and exact long decimals copy without rounding. Income-unavailable,
historical and retained reports keep the correct qualifications and dates.
Refresh, Cancel, late replies, malformed responses and retirement preserve their
existing boundaries. All browser writes use invented RAM data.

The Android Annual-note journey adds exact cash-text, duplicate and capacity
assertions while preserving its original income-note Save/reload assertions.
The integrated native bundle builds below the unchanged 4 MiB cap, with a largest
loader payload of 2,259,108 bytes. PR104 passes all six applicable Actions jobs.
Its original hosted Android run passes all 27 cases and package isolation; the
artifact has been independently accepted. CodeScene retains two reviewed guard
complexity advisories without an actionable correctness finding. Deployment
remains separate.

### Consistent Annual basis labels candidate

Annual trend and watchlist comparison controls now share the overview's distinct
readable revenue names. A wrapping selected-basis line exposes the complete name
at narrow widths and describes each native selector. Comparison results use
the same names; exact concepts remain in source details and raw control values.
An unavailable chosen basis stays unavailable. This changes presentation only;
selection lifetime, calculations, notes and explicit source requests are unchanged.

The 71 affected tests, web types, lint, boundaries and independent source review
pass. Chrome checks at 1440, 390 and 320 CSS pixels accept wrapping full names,
44px targets, exact source keys, separate values and keyboard focus through
response replacement. Missing evidence preserves the chosen basis; changing or
clearing a company resets it. Choice changes leave source counts and notes
unchanged, and Cancel, late responses and retirement retain their boundaries.
These checks use invented RAM data. Chrome's native popup geometry was not
captured; its option text and selection behavior were verified separately.

The integrated native fixture builds with a largest loader payload of 2,260,259
bytes, below the unchanged 4 MiB cap. PR105 passes all six applicable Actions
jobs and CodeScene. Its original hosted Android run passes all 27 cases, including
four native friendly-label selections with the original raw-value assertions.
The artifact, package isolation and complete notices have been independently
accepted. Popup geometry, source merge and delivery remain separate.

### Cash generation comparison candidate

The next increment adds operating cash flow, PP&E purchases and their admitted
same-period difference to the two-company Annual comparison. Each cell retains
its exact USD amount, own period and availability independently of income and
revenue-basis choice. The existing source disclosures include the cash inputs.
This reuses the loaded reports and existing company presentation; it adds no
source request, financial formula, saved state or note action.

The 174 affected tests, strict fixture validation, fresh web types, lint,
boundaries and independent source review pass. Chrome checks at 1440, 390 and
320 CSS pixels accept exact amounts, per-cell periods and qualifications, cash
independence from income, full source details and contained table scrolling.
Selector and results focus survive response replacement. Failed refresh,
Cancel, late responses and selection changes preserve the existing draft.
Session retirement clears the draft and reports and fences late responses.
These checks use invented RAM data.

The Android comparison journey now checks these cash values and source inputs
at its existing basis, retained-response and cancellation checkpoints. Source
syntax checks pass. The integrated native fixture builds with a largest loader
payload of 2,262,962 bytes, below the unchanged 4 MiB cap; complete notices and
source continuity have been independently verified. PR106's original Android
run passes all 27 cases and package isolation. Five of six required Actions
pass; Windows times out in an unchanged custody test. One local reproduction
passes in 175 ms, so the hosted cause remains unresolved. The original failure
is retained, with no speculative fix or rerun. CodeScene's test-nesting advisory
was reviewed without an actionable correctness finding. Source merge and delivery
remain separate.

### Annual comparison to note candidate

An explicit action adds income or cash evidence from the loaded two-company
Annual comparison to one selected listing's latest note draft. It preserves
exact values, separate periods and filing links, original evidence dates and
historical or retained-report qualifications. Both companies need the selected
group's evidence. Income and cash availability remain independent.

Pair, response and route checks fence stale actions. Duplicate references and
invalid or oversized complete notes leave the draft unchanged. Appending makes
no source or save request; review and explicitly save the complete watchlist.

The 589 affected formatter, UI, workspace/Screen and native-fixture tests pass,
along with fresh web types, scoped lint, formatting, source boundaries and
independent source reviews. The Android comparison journey now includes append,
duplicate refusal, full-note review and explicit Save/reload. Its source syntax
passes, and the independently reviewed native bundle has a maximum loader payload
of 2,276,554 bytes under the unchanged 4 MiB cap. The original hosted Android run
passed all 27 cases and package isolation, with independent artifact acceptance.
Four of five original Actions jobs passed. Windows timed out in an unchanged
database evidence test containing thirteen serial validation variants. A separate
test-only repair registers those same cases individually, preserving every
mutation, refusal assertion and the default timeout. Its 67 affected tests and
fresh database types pass locally; original hosted checks remain pending.

Chrome checks and independent review pass for 44 invented-data observations at
1440, 390 and 320 CSS pixels. They cover complete income and cash Save/reload,
original evidence dates, note validation, conflict recovery, focus and session
retirement. Source merge and website, API and Android delivery remain separate.

### Annual comparison report handoff candidate

Either loaded comparison column now opens in the full company
Annual view without another SEC request. It preserves original source dates and
qualifications, identifies reused comparison evidence, and returns to the same
pair, bases, note destination and shared draft. An explicit refresh changes only
the company visit. See the
[handoff contract](MANAGED_SEC_ANNUAL.md#open-the-full-report-from-a-comparison).

Focused implementation checks and fresh web types pass. Independent review found synchronous
opening callbacks that could publish stale evidence or overwrite a replacement
visit; regression tests reproduced them, and ownership checks now fence those
paths. UI callbacks now update on commit, and the comparison-origin label remains
visible after a retained refresh. Source reviews pass.

Chrome checks cover both zero-request openings, Back focus and preserved comparison
choices, an unloaded Forward visit, independent company refresh, complete note
Save/reload, retained and unavailable evidence, removal and session retirement.
Layouts at 1440, 390 and 320 CSS pixels have no page overflow; narrow comparison
results scroll locally. Independent review accepts the saved browser evidence.
The independently reviewed native fixture bundle has a maximum loader payload of
2,281,581 bytes under the unchanged 4 MiB cap. Its original hosted Android run
passed all 27 cases and the APK isolation gate, including the extended report
journey; independent artifact review accepts the original output. All five required
Actions jobs from its original workflows pass. CodeScene retains its reviewed
advisory failure.
No source merge or delivery follows from these checks.

The prerequisite [test repair](https://github.com/liangzixuan/investing-pro/pull/108)
separates the existing database rejection variants into named tests. Its original
desktop and PostgreSQL checks pass. Android failed during setup while the Activity
was stopped, before the selected-price journey began. The reviewed follow-up
requires native foreground readiness within the existing ten-second setup wait;
history, Back and screenshot assertions remain required. The original failure is
retained; why the Activity stopped is unknown. The updated original Android run
passed all 27 cases and the APK isolation gate, with independent artifact review
accepted. All six required Actions jobs from the updated original workflows pass.
CodeScene retains its reviewed advisory failure.
The handoff includes this repair; its application files are unchanged from the
accepted local build and Chrome checks.

### Filings after an Annual report candidate

The next increment adds **Filed after Annual report** to the existing company
Filings filters. It uses the current checked Annual filing date and loaded
Filings packet for the same listing, catalog and CIK. Same-day filings stay under
All loaded filings; financial availability does not control this metadata view.
Original clocks, coverage limits, references and the full note Save remain intact.
See the [Filings guide](MANAGED_SEC_FILINGS.md#review-filings-after-an-annual-report).

Focused pure rules, component/composition and native fixture checks pass, along
with web types, scoped lint, formatting and source boundaries. Independent source
reviews pass. Chrome checks at 1440, 390 and 320 CSS pixels confirm combined
filters and paging, original source dates, filtered-reference Save and reload,
comparison navigation, retained refreshes, focus recovery and session clearing.
Controls retain 44px targets with no page overflow. An admitted Annual filing date
remains usable when its report is historical or financial amounts are unavailable;
missing baselines are explained. Independent review accepts the saved browser
evidence and exact full-draft Save/reload payload.

The independently reviewed native fixture bundle has a maximum loader payload of
2,288,059 bytes under the unchanged 4 MiB cap. The existing filing journey now
checks the date and form controls, source dates, request counts and unchanged
saved note. Its original hosted execution remains pending. These invented-data
checks do not establish live SEC access. This candidate is not merged or delivered.

### Annual liquidity candidate

The current increment adds reported current assets and liabilities, working
capital and current ratio to company Annual. It uses exact instant balances from
the selected filing and keeps missing or rejected values independent of income
and cash. The existing explicit read, saved drafts and report lifetime remain
unchanged. The required Annual version-3 contract needs coordinated API, browser
and Android delivery. See the [Annual guide](MANAGED_SEC_ANNUAL.md#liquidity-at-fiscal-year-end).

Focused contract, arithmetic, resolver, API and decoder checks pass, including
independent scan failures, instant dates, exact long decimals and old-version
rejection. Managed component and native fixture checks pass. Fresh API/web types,
scoped lint, formatting and source boundaries pass. Independent source reviews
cover the financial rules, transport, presentation and affected fixtures.

Chrome checks at 1440, 390 and 320 CSS pixels cover exact balances, long values,
keyboard source inspection, unavailable and historical values, retained refreshes,
cancellation, late results, comparison handoff and session retirement. Unsaved
notes survive the company visit. The original preview and native fixture bundles
match the reviewed source and complete notices; the native bundle remains below
the unchanged 4 MiB cap.

The existing Android refresh journey checks retained instant balances and
recovery with zero liabilities. All 27 cases passed in the original hosted run.
Its Ubuntu and Windows jobs found two older tests that incorrectly included the
independent liquidity table in income-only assertions. A reviewed test correction
scopes those assertions to income and explicitly retains the liquidity table.
The corrected head passes all six applicable Actions jobs, including the full
Ubuntu and Windows checks and all 27 Android cases. Independent native artifact
review accepts the original corrected run. Original failures are retained. This
candidate has not been merged or delivered.

### Liquidity-to-note candidate

The next increment adds **Add liquidity to note draft** to company Annual. It
appends the exact reported balances, checked calculations and original provenance
to the existing member's latest note. Zero liabilities retain an explicit
unavailable-ratio sentence; negative working capital remains valid. Missing or
rejected inputs block the action. Historical and retained reports keep their
qualifiers. See the [note workflow](MANAGED_RESEARCH_NAVIGATION.md#add-liquidity-to-a-note-draft).

Implementation preserves current-report and draft guards, exact duplicate refusal,
the complete 2,000-character policy and explicit whole-watchlist Save. Focused
model, component and composition checks, fresh web types, source boundaries and
scoped lint/format pass. Independent source reviews pass. Chrome at 1440, 390 and
320 CSS pixels verifies complete appended and saved notes, focus, refusal recovery
and response/session boundaries. A duplicate refusal keeps one visible explanation
and a persistent polite announcement. The preview and native bundles retain full
notices and the unchanged asset limit. The extended native refresh journey checks
exact initial, retained and zero-liability paragraphs. Its original hosted run
passes all 27 Android cases and independent artifact review. All six applicable
Actions jobs pass. This candidate is not merged or delivered.

### Liquidity comparison candidate

The next increment adds four liquidity rows to the existing two-company Annual
comparison. Each balance and calculation keeps its own date, original source
details and current-use qualification. Missing inputs and refused calculations
remain independent of income, cash and revenue-basis selection. The table reuses
the company liquidity presenters without another request, state owner or
calculation. See the [comparison guide](MANAGED_SEC_ANNUAL.md#compare-liquidity-between-companies).

Focused comparison and shared-presenter checks, web types, source boundaries and
scoped checks pass. Independent source and static-bundle reviews pass. Chrome at
1440, 390 and 320 CSS pixels verifies exact balances, separate dates, long values,
keyboard scrolling, source disclosures and independent unavailable states.
Retained refreshes, cancellation, late completion, navigation with an unsaved note
and session retirement preserve the existing response boundaries. The native
fixture retains complete notices and stays below its unchanged asset limit.
The original hosted Android run passes all 27 cases and independent artifact
review. All six applicable Actions and CodeScene pass. This candidate is not
merged or delivered.

### Liquidity comparison to note candidate

The next increment adds **Liquidity** to the existing comparison Evidence
selector. It reuses each company's checked liquidity excerpt, retains complete
listing identity and separate balance dates, and appends both companies' evidence
to one chosen member's latest note. The existing whole-note limit, duplicate and
freshness guards and explicit Save remain in place. No source, calculation or
persistence change is introduced.

Focused formatter, workspace, UI and navigation checks, full web types, scoped
lint/format and source boundaries pass. Independent source and static-bundle
reviews pass. Chrome at 1440, 390 and 320 CSS pixels verifies the complete note,
explicit Save/reload, unchanged other notes and order, whole-note and duplicate
refusals, zero liabilities, independent evidence groups, historical and retained
dates, cancelled and late reads, and session retirement. The integrated native
fixture retains complete notices and fits the unchanged asset limit. The original
hosted Android run passes all 27 cases and independent artifact review, including
the bounded liquidity append/refusal assertions. Native liquidity Save is outside
those assertions. All five applicable original Actions and CodeScene pass; this
candidate is not merged or delivered.

### Annual report navigation candidate

The next increment adds **On this report** links to income, cash, liquidity and
report source details in the loaded managed Annual view. Explicit activation
moves focus to the existing section and opens the source disclosure when chosen.
All evidence, warnings and unavailable explanations remain in place. Navigation
makes no data request, changes no note and adds no browser-history entry.

Focused component and composed checks, web types, scoped lint/format and source
boundaries pass. Independent source and bundle reviews pass. Chrome at 1440, 390
and 320 CSS pixels verifies all destinations, keyboard continuation, visible
focus, unavailable income with independent cash/liquidity, retained and replaced
reports, cancellation, late completion, note append and session retirement. The
focused link survives replacement; the viewport can shift as content changes.
Full notices and the native loader limit are preserved. All six applicable
original Actions pass, including 27 Android cases and independent artifact
review of the four report-navigation assertions. CodeScene retains a reviewed
advisory failure without an actionable correctness finding.

An adjacent Chrome finding showed that entering company research at desktop width
and returning after narrowing the window focuses the original watchlist button
below the visible area. Fresh phone-width visits return to a visible button.
The responsive return fix preserves the existing draft and focus ownership.
It adds a bounded follow-up check of the
still-focused return control. Already visible controls and focus moved elsewhere
are left alone; stale visit/session work is cancelled.

All 131 focused screen cases, web and preview types, scoped lint/format and source
boundaries pass. Independent source and bundle reviews pass. Chrome verifies
desktop-to-phone Back at 320 and 390 CSS pixels, including a loaded comparison
handoff, with the original opener visible above mobile navigation. Desktop and
phone controls remain visible without a follow-up position change. Full drafts,
comparison choices, original evidence dates and request counts are preserved.
The initial 320-pixel keyboard attempt did not navigate; a subsequent click did.
The focused tests cover missing openers, moved focus and stale lifetime guards;
those timing cases are not claimed as browser observations. Complete notices and
the native asset limit pass. All five applicable original Actions passed,
including the independently reviewed Android artifact and its unchanged 27-case
suite. CodeScene's failed complexity advisory was reviewed without an actionable
correctness finding. Production remains unchanged.

### Selected watchlist filings candidate

The next increment adds an explicit Recent filings check for the selected
watchlist listing. Its compact summary retains the newest observed row, loaded
count, source dates and coverage limits. View filings opens a separately checked
copy in the existing company Filings view without another read. Back preserves
the selected packet and draft; company Refresh changes only its visit. The
existing reference-to-note action and whole-draft Save complete the workflow.

One temporary packet belongs to the selected listing. Changing that identity,
leaving the watchlist, catalog invalidation and session retirement clear it.
Pending and late responses retain their existing cancellation rules. This uses
the existing source and shared SEC budget, without monitoring, expanded coverage
or persistent storage. Focused model, component and workspace checks, web types,
scoped lint, source boundaries and independent source review pass. Chrome at
1440, 390 and 320 CSS pixels accepts explicit loading, source dates, keyboard
handoff and visible Back focus, full-note Save/reload, cancellation and late
completion, retained failures, invalid/empty/truncated results and session cleanup.
The exact native fixture build remains below the unchanged asset limit with
complete notices. Its journey now covers selected Load, View and Back before the
existing note Save; execution remains required in the original hosted run.

### Matching note passages candidate

Research notes search now shows a short original passage around the first match
in each result. Ellipses indicate omitted text. The bounded passage keeps combined
Unicode characters intact and appears in the result's accessible description;
the button name retains its exact listing identity. Blank and identity searches
keep their existing rows. Matching, order, selected editor and complete-note Save
remain unchanged, with no new request or stored state.

Focused helper and component checks, eight composed research/Back/Save cases and
two recovery cases pass. Web and preview types, scoped lint/format and source
boundaries pass, with independent source and exact-bundle review. Chrome at
1440, 390 and 320 CSS pixels verifies original passages, keyboard selection,
editing outside results, research return, complete-note Save/reload and saved
version replacement. Narrow results scroll within their existing strip without
page overflow; long words wrap, and all observed product controls retain 44px
targets. Session retirement clears the notes and passages.

The browser fixture used invented data. Its original Save expectation omitted
the existing outer-trim normalization; the corrected comparison preserves the
complete payload and records that failure. Exceptional Unicode cases and Keep
my draft are established by focused tests, without a screen-reader claim.
The exact native fixture build retains complete notices and fits the unchanged
asset limit. The existing native note journey now checks the passage and
accessible description; execution remains required in the original hosted run.

### Loaded agenda date candidate

The next Markets increment adds a labelled **Release date** selector over the
accepted BEA agenda. All loaded dates remains the default. A selected Eastern
date shows its releases and the visible count against the complete loaded
packet, while preserving original source and retrieval details. Pending,
failed and cancelled refreshes retain the choice; an accepted replacement resets
it. Company visits retain the mounted choice, top-level navigation resets the
local view, and session retirement clears the data. The selector makes no request
and changes no watchlist state. See the
[agenda guide](MANAGED_MARKETS_HOME.md#bea-release-agenda).

Focused component and composed-workspace checks, web types, scoped lint, source
boundaries and independent source review pass. Chrome accepts keyboard filtering,
Eastern midnight and daylight-saving dates, retained responses, replacement
resets, navigation, complete draft Save and session retirement. Desktop and
390/320-pixel layouts retain 44px controls, visible focus and full text without
page overflow. These checks use invented RAM data.

The exact native fixture build preserves complete notices and fits the unchanged
4 MiB loader limit. The existing Android agenda journey now checks date selection
through failure, cancellation and navigation. PR120 passed its applicable desktop,
parser and dependency checks. Its first Android attempt failed during SDK setup,
before application execution. One targeted repeat at the same source passed all
27 cases and the package gate. The original full log and artifact establish those
results; the saved child-step status list remains incomplete. The first failure
is retained. No live delivery is claimed.

[PR119](https://github.com/liangzixuan/investing-pro/pull/119) separately integrates
the candidates through PR118 against accepted main. Its normal local merge keeps
the exact PR118 tree and adds no conflict-resolution edits. The combined diff
requires eight Actions checks. Original PR106's Windows custody timeout remains
unresolved; PR107's database-verifier timeout is retained alongside PR108's
bounded test partition repair. PR117's five original Actions and native review
passed. PR118's five original Actions and native review also passed. Aggregate
acceptance passed all eight Actions jobs, including 27 Android cases and package
isolation. Independent source and artifact review passed. CodeScene retains
reviewed complexity advisories. The merge request awaits owner approval.
Annual schema 3.0.0
requires a separate coordinated API, website and Android delivery decision.

### Company Filings refresh comparison candidate

Company Filings now compares each successful refresh with the previous available
loaded list. Current accessions absent from that list receive a quiet **Newly
observed in this refresh** marker. The full-response count stays visible while
filters or paging hide rows. **Compared loaded lists** preserves both original
windows, source dates and incomplete-coverage limits. A first load or watchlist
handoff establishes the baseline. Pending, cancelled and transient failed reads
retain the pair; closing the visit clears it. The selected watchlist retains its
own single packet. See the [comparison guide](MANAGED_SEC_FILINGS.md#compare-consecutive-loaded-lists).

Affected model, helper, component and composed-workspace checks, web types and
scoped lint pass. The composed check covers watchlist handoff, a current-row note
reference, unchanged other notes and explicit whole-draft Save. The first common
type check found a direct test fixture missing the new state field; the fixture
now supplies its null baseline. No production change was needed.

Chrome checks accept consecutive, equal and empty replacements, filtering,
original source dates, retained failures, cancellation and late responses. They
also cover section navigation, the unchanged watchlist packet on Back, complete
note append and reordered whole-draft Save/reload, and session retirement.
Desktop and 390/320-pixel layouts preserve visible keyboard focus, 44px controls
and wrapping without page overflow. These checks use invented RAM records.
Initial incomplete screenshots were retained and excluded; a fresh desktop
capture after resetting the temporary viewport passed.

The exact native fixture build preserves complete notices and fits the unchanged
4 MiB loader limit. Added assertions in the existing Filings journey still need
the original hosted Android run. Hosted and live acceptance remain separate.

### Company selection within research candidate

The next increment adds **Company in My Watchlist** and **Open company** to the
company header. It uses the complete current draft in its current order. Opening
another listing keeps the research section, starts that visit unloaded and
preserves every note. The original workspace destination and Back control remain
after several company changes. A staged choice makes no request or write, and
opening the current company preserves its loaded results. See the
[navigation guide](MANAGED_RESEARCH_NAVIGATION.md#choose-another-watchlist-company).

Affected model, component, screen and route checks pass, along with web types,
lint, formatting and source boundaries. Independent source review passes. The
first Chrome check found that transient route preparation left the current
company unselected. The corrected model keeps valid choices visible while its
pending reason still blocks opening. A regression fails before that correction
and passes afterward; the first build and failed browser evidence remain saved.

Chrome accepts the corrected commit `6bb2d205` at 1440, 390 and 320 CSS pixels.
The selector keeps separate share classes and full wrapping identities. Explicit
switches preserve the section and notes, start unloaded, and reject late work
from the previous visit. One Back action restores the original watchlist opener.
Reordering, saving and reloading preserves all three full identities and notes
at version 8. Direct-link fallback, invalid links and retirement also pass.
The preview uses invented RAM data; it makes no live provider or account claim.

The exact native fixture bundle preserves complete software notices. Its largest
loader payload is 2,348,539 bytes, below the unchanged 4 MiB limit. All five
original hosted Actions pass, including both desktop suites and all 27 Android
cases with the APK isolation gate. CodeScene retains three reviewed maintenance
advisories without an actionable finding. Stale step metadata is qualified by
the original job outcomes, full logs and reports. Production is unchanged.

### Newly observed Filings filter candidate

The next increment adds **Refresh view** to company Filings. After an explicit
refresh supplies a comparison, it can show only newly observed accessions and
combine them with Form and Filing date. Original row order, source records and
reference-to-note actions remain available. Filtering makes no request or Save.
See the [Filings guide](MANAGED_SEC_FILINGS.md#filter-newly-observed-filings).

Affected model, component and Screen checks pass, along with web types, scoped
lint, formatting, source boundaries and independent source review. Chrome checks
confirm that filtering precedes paging, combines with Form and Filing date, and
preserves the complete loaded-list comparison and its original source dates.
An older newly observed filing adds its exact reference to the latest Unicode
note. Reordering, whole-draft Save and reload preserve every identity and note.
Cancellation and transient failure keep the selected filters; a new response,
including equal content, resets them. Empty results retain their coverage limits.
Invalid data clears the company results, and late work cannot restore a retired
session. These checks use invented RAM data.

The first desktop check found a clipped option label. A copy-only correction
uses **Newly observed**, with the full explanation below. The corrected commit
`ad3b9e42` passes Chrome at 1440, 390 and 320 CSS pixels, with 44-pixel controls,
keyboard focus and no horizontal page overflow. Earlier behavior evidence
applies to the unchanged logic. Complete software notices remain in the exact
native bundle, whose largest loader payload is 2,351,050 bytes under the unchanged
4 MiB cap. The first hosted Android attempt failed during emulator image setup,
before app work. A targeted repeat ran all 27 cases; 26 passed. The Filings case
failed while requiring its three-filter header and entire filtered row to fit in
one screenshot. The saved image shows the row below the viewport; the selected
form and request counters remained correct. Later assertions in that case were
not reached, and APK isolation was skipped. Both original failures remain recorded.
Production is unchanged.

### Compact company Filings source header candidate

The next presentation increment groups routine source details in an initially
closed **Filings source and coverage** disclosure. The original date window,
CIK, source link, Retrieved or Checked time and key coverage warnings remain
visible. Filters, comparison evidence and note actions keep their behavior.
The default header is about 34 CSS pixels shorter at a 1440-pixel viewport and
78 pixels shorter at 390 and 320 pixels, measured against the preceding layout
with the same loaded response. Chrome accepts keyboard opening and closing,
44-pixel targets, wrapping and visible warnings. Native open state persists
through filtering, paging, retained requests and response replacement. Replacement
updates the original metadata; failure and cancellation retain the previous dates.
Empty and unavailable responses keep their distinct coverage wording.

Affected component tests, full web types, lint, formatting, source boundaries and
independent source and bundle review pass. Initial test typing errors and stale
native test selectors were corrected without changing their expected dates.
Two early screenshots captured stale frames; settled replacements support visual
acceptance. The exact native fixture bundle preserves complete software notices
and remains within its unchanged 4 MiB limit. The existing native journey now
checks the disclosure; original hosted execution is still required. Production
is unchanged.

The candidate also corrects the inherited Filings screenshot-span assumption.
One bounded frame checks the Form label and control; a second checks the count
and complete filtered row. Their combined targets are unchanged. Both use the
same full-bounds checks before and after capture, with the same deadline and all
semantic assertions retained. The suite keeps 27 cases and adds one named capture.
This test-only correction needs execution on the updated source; it does not
turn either original failure into a pass.

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

Finish the Filings filter and source header's original hosted checks and the
source integration steps when permission arrives. Preserve explicit source requests,
same-company identity and the existing research-note workflow. PR100 and PR101
merged in order after owner approval and verification of both bases and applicable
checks. The final merged source has the reviewed PR101 tree; its original
actual-main checks all passed. PR100's actual-main runs were cancelled when
PR101 advanced main; those cancellations remain recorded. Later candidates and
live delivery remain separate actions.
Continue meaningful roadmap
work with existing subscriptions and permitted free sources; broader fields and
cohorts need verified source rights, cost, quotas and identity handling.

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
