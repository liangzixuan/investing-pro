# Current work

Updated September 28, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The workspace [launch plan](../../LAUNCH_ROADMAP.md) owns October delivery
order; the [product roadmap](./PRODUCT_ROADMAP.md) retains longer-term scope.
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Approved delivery integration

The owner approved GitHub checks -> Appwrite staging -> BrowserStack on the exact
build -> production promotion. The [delivery guide](./APPWRITE_DELIVERY.md)
describes the prepared static-site pipeline, source-check proof, artifact and
credential setup. Its first target is the disconnected client; the cloud storage
proof below remains the prerequisite for a connected product. Local checks and
source review do not establish a cloud deployment. Main integration, environment
keys, a separate production site and the first observed run remain pending.
The existing preview smoke keeps its qualified status until replacement passes.

## BrowserStack browser CI

The owner selected BrowserStack Automate/Playwright for browser tests only.
Installed app tests will use the owner's Pixel phones, starting with the confirmed
Pixel 10 Pro XL / Android 17. The earlier App Automate upload handoff is cancelled;
do not run native cloud tests. See [BrowserStack testing](./BROWSERSTACK_TESTING.md)
for commands, triggers and evidence limits. The separate deployed-preview workflow
is published on `codex/android-launch`, and both repository secret names were
verified without inspecting their values. GitHub run `36499410858`, attempt 2 at
`50add08`, succeeded in 1 minute 11 seconds. Job `109191600638` succeeded in
1 minute 6 seconds; its 31-second test step reported that the BrowserStack website
runner completed successfully.

BrowserStack listed `disconnected-web-smoke #CI 36499410858`, but its detail route
and then the project list redirected to `request_access`. The new session,
platform/result and terminal BrowserStack build state remain independently
unverified. The earlier 13-second Windows 11 / Chrome 154 session is separate
evidence. Merging the workflow into `main` and default-branch manual dispatch
remain pending. Setup is one-time; each command or eligible push starts a new
test. The manually deployed preview remains distinct from the test-code revision.
The Appwrite storage work remains the next product outcome.

## Active outcome: Appwrite shared watchlist storage

The owner approved working toward a personal computer/Android launch before
November, with Android first and a signed native container sharing the React UI.
The owner selected the existing Appwrite Education project as the hosting
candidate, superseding the PC/Tailscale plan. A private, data-free Node function
has executed successfully; this does not establish application persistence,
authentication or phone access.
The [Android guide](./ANDROID_CLIENT.md) and
[specification](../specs/012-android-client/spec.md) define this first outcome.
The client foundation is committed at `f4674a8f` and has produced a debug APK.
It remains disconnected. Shared watchlist validation and the server-only
Appwrite repository are implemented at `e71c9021`, with atomic version updates
and durable command receipts. A separate server transport now bounds SDK
requests, cancels expired I/O and prevents response warnings or error bodies
from reaching logs. It preserves the official SDK's serialization and integer
decoding through a private Undici dispatcher. This remains unwired to application
routes. Isolated cloud race/rollback tests, managed sessions and shared UI
integration follow local validation. See [Appwrite storage](./APPWRITE_WATCHLIST.md).

Development uses `android-launch` on `codex/android-launch`, based on accepted
a89 `65cb08c94dd8767d1a59b01dd1b7a355d5c5667e`. Its accepted build is
`59fqkV8AwtuNStJkwXwuW`; exact runtime/rollback evidence stays in workspace CURRENT.
A90 Previous/Next is parked intact in `markets-home` at `dc63dfa1`, with its
feature/candidate refs and interrupted native evidence preserved. It is not an
accepted release. This launch work does not resume the expired heartbeat window.

Root owns dependency/lockfile, integration, notices and guides. The contract agent
owns pure validation and the unchanged local route; the storage agent owns the
Appwrite repository and transaction tests. Review remains independent. A separate
data-free copy of the existing mobile assets is prepared for BrowserStack website
testing. Native App Live attempts established no device coverage. Preserve the
accepted desktop runtime, disconnected APK and unrelated parked source. No owner
data migration or provider requests are included.

## A89 implementation context (released)

This is the historical pre-acceptance checkpoint. Workspace CURRENT and the
accepted a89 review supersede its pending-release statements.

Plot every company in the complete loaded two-to-six-member board on the same
observed dates, starting each line at 100. Reuse the Research comparison chart,
existing exact result and installed ECharts; keep the numeric summary and exact
table. Inspection survives unrelated rendering and resets when the snapshot is
replaced. No acquisition, API, schema, dependency or calculation change is added.
The [specification](../specs/010-markets-indexed-comparison/spec.md),
[plan](../specs/010-markets-indexed-comparison/plan.md) and
[tasks](../specs/010-markets-indexed-comparison/tasks.md) define acceptance.
Implementation is complete and unreleased. Actual verification includes 98
distinct chart/Markets/Research cases, 15 page-mode cases, affected web types,
scoped lint/format, the full boundary check and configured production preflight
`HkxL2ge1us4FFKVBgAHmS`. The registration delta is 15. Eight synthetic Brave
groups cover complete cohorts, retained and replaced snapshots, unavailable
states, exact-data fallback, response retirement, Research/Back and desktop/390px
layouts. All fixture acquisition terminated in RAM, with no owner writes.
Some first Research clicks had no effect before a fresh click succeeded. The
unchanged navigation guards were traced; no cause or a89 regression was proven.
The fixture's History shim does not establish production Next navigation. The
full native/hosted gates, guarded activation and limited live QA remain pending.

Spec owns the shared chart/tests, minimal Research interface and heading CSS.
Finance owns Markets composition/tests/scoped styles. Performance owns the
outside-Git composed fixture and independent review; root owns guides,
integration and release. Preserve complete-cohort admission and all existing
identity, draft, session, budget and response-lifetime rules.

A88 is accepted, normally pushed and running at
`bf5113cdd0e0a3708051620bfc5a590f5c2ad83a`, build `_4tKol895B21oz_tsVsGN`.
Its [final review](../../tmp/filing-inbox-research/final-acceptance-independent-review.json)
records 391 focused cases, 9,720 native passes, nine existing skips, 25 package
typechecks plus root, 24 builds, 462 healthy samples, five hosted jobs, six
synthetic and five limited live Brave groups. The live monitor was paused/off
with no retained events; populated Research/Back remains synthetic/focused
coverage. The [handoff](../../tmp/filing-inbox-research/release-handoff.md) records
the exact runtime and rollback. All used a88 and older helpers are terminal.

## A88 implementation context (released)

This section preserves the pre-acceptance checkpoint. Its pending statements are
historical; the accepted a88 status and evidence above supersede them.

Open an exact current listing from a retained Daily SEC filing monitor entry in
the existing company SEC section. In-app and browser Back retain the inbox page,
settings draft, order and read status. Multiple listings remain separate choices;
obsolete bindings cannot authorize Research. The
[specification](../specs/009-filing-inbox-research/spec.md),
[plan](../specs/009-filing-inbox-research/plan.md) and
[tasks](../specs/009-filing-inbox-research/tasks.md) define the acceptance contract.
Implementation is in progress and unreleased.

The two focused suites establish 391 distinct passing cases and a registration
increase of 30. Affected web types, scoped lint/format and the complete boundary
check passed. The configured personal-workspace/local production web preflight
passed with build `WnzkJPpWuLV16Irxeha7n`; the
[preflight receipt](../../tmp/filing-inbox-research/production-web-preflight.json)
reconciles its six input pins before and after compilation. Independent source
review and six composed synthetic Brave groups passed. The browser checks cover
exact listing choices, page and draft retention, in-app/browser Back, same-company
SEC selection, obsolete bindings, delayed response retirement and phone layout.
Navigation added no requests or saved-record writes in the RAM fixture. Its
History shim does not establish production Next hydration or live API behavior;
loaded company-data retention remains focused-test coverage. All release gates
and limited live QA remain pending. Raw failed
lint and label-assertion attempts are retained in the implementation handoffs;
filtered cases are not counted as additional passes or product skips.

Finance owns the monitor and its tests; Performance owns workspace composition
and its tests; root owns integration, guides and release. Spec prepares the
outside-Git composed fixture and independent review. Keep visibility separate
from the monitor's enabled lifetime and distinguish new-click authority from
durable handoff/return authority. Reuse existing routes and state. No API, schema,
dependency, acquisition or saved-record write is added by navigation.

A87 release `4a033698634ab217af21de9f0332c95b07941abc` is accepted, pushed and
running with build `0L2DjUvoK99Djl82vErL0`. Its
[final independent review](../../tmp/fed-announcements-v2/final-acceptance-independent-review.json)
records 634 focused cases, 9,690 native passes and nine existing skips, 25
typechecks, 24 builds, 398 healthy samples, seven successful required hosted
jobs, seven synthetic and six limited live Brave groups. Live displayed ten of
fifteen Fed announcements and checked Discover/Back and desktop/390px layouts.
This establishes monetary-policy announcements, not general company-news
coverage. Preserve that release and the rollback while a88 is unfinished.

The [a87 handoff](../../tmp/fed-announcements-v2/release-handoff.md) and workspace
CURRENT own actual release evidence and preserved failures. All consumed a87
and older operational helpers remain terminal or stale. The sections below
retain earlier implementation context; their pending statements are historical.

## A87 implementation context (released)

Add an independent, explicitly loaded Markets panel with up to ten attributed
monetary-policy announcements. The [specification](../specs/008-fed-announcements/spec.md),
[plan](../specs/008-fed-announcements/plan.md) and
[tasks](../specs/008-fed-announcements/tasks.md) define the source, transport,
lifecycle and acceptance requirements. Implementation is
unreleased. Source, contract/provider/client and UI tests, dependency license
inventory and boundary checks have passed. The configured personal-workspace/local
web build and 16 page-mode cases also passed; see the
[preflight](../../tmp/fed-announcements/production-web-preflight.json) and
[independent review](../../tmp/fed-announcements/production-web-preflight-independent-review.json).
Its build is `0jN1_VQa2fxRAPTekA-_e`, separate from the accepted running app.
Independent product source/integration review and seven source-bound synthetic
Brave groups passed; see the
[integration review](../../tmp/fed-announcements/workspace-integration-independent-review.json)
and [synthetic review](../../tmp/fed-announcements/synthetic-qa-independent-review.json).
The synthetic checks covered explicit loading, busy and failed refresh retention,
empty replacement, hide/Back and session retirement, independent panels, and
desktop/390px layout and keyboard focus. They used invented RAM data; screenshots
were inspected inline only. A disabled-control Return was refused by the browser
tool, so duplicate-callback behavior remains unit-test coverage. The History shim
does not establish production Next hydration or live feed access.
Final feature/closure review, native and hosted gates, activation and limited live
QA remain pending.
The [implementation checkpoint](../../tmp/fed-announcements/implementation-checkpoint.md)
records 631 distinct focused cases, including existing regressions. Its 28 source
pins and accepted HEAD were reconciled before these documentation changes; use the
[renewal reconciliation](../../tmp/fed-announcements/renewal-checkpoint-reconciliation.json)
and subsequent evidence for current file hashes. Preserve the original checkpoint.
Renewed work adds three focused workspace integration cases for actual route
wiring, startup inactivity and shutdown disposal; see the
[integration handoff](../../tmp/fed-announcements/workspace-integration-handoff.json).
Workspace CURRENT.md records the renewed window through September 28, 06:29:44 UTC,
with no new slice after 05:44:44 UTC that day. Scope and behavior are unchanged.

A86 comparison release `dbfaf478722eab4cfde0fbe2b0c896d2fab37398` is the accepted
running baseline, build `nWXiku1-SsHPISrPv44B1`. Its final independent review records
9,495 native passes, nine existing skips, 25 typechecks, 24 builds, five hosted
jobs, eight synthetic Brave groups and six limited live groups. Historical a86
and earlier sections below retain the implementation context; CURRENT.md and the
[final review](../../tmp/markets-cohort-comparison/final-acceptance-independent-review.json)
own actual release status. Preserve the app and rollback while a87 is unfinished.

Root owns dependency/client/composition/boundaries/docs; Spec owns contracts and
OpenAPI; Finance owns provider/routes; Performance owns hook/panel/composition.
The source prerequisite's single GET is consumed. Work offline from its retained
fixture; no linked article requests or owner-record writes are part of QA.

## A86 comparison implementation context

Add a compact shared-date comparison beneath the loaded board. Show each
company's adjusted-price change and maximum drawdown over observations present
for every member, with the actual dates/count and a coverage disclosure. The
[specification](../specs/007-markets-cohort-comparison/spec.md),
[plan](../specs/007-markets-cohort-comparison/plan.md) and
[tasks](../specs/007-markets-cohort-comparison/tasks.md) define acceptance.
A86 completed implementation and release acceptance; its actual final evidence is
linked above. This section retains its product and ownership context.

Reuse the pure comparison engine with a maximum of six series. Preserve exact
decimal calculations and validation before date intersection. Admit the whole
expected cohort; never silently omit a failed or mismatched member. One company,
incomplete histories and insufficient shared observations have explicit states.
This is a shared window within loaded 1M histories, not a promised full month or
independently reconstructed total return. Missing observations can hide declines.

Derive from the same matching snapshot used by the board. Existing draft,
session/catalog/member guards, Back, total-failure retention and partial-result
replacement continue to govern it. No new selection, cache, acquisition owner,
API, schema, dependency or chart. Both board modes still load explicitly; the
fifteen-minute/four-start rolling-hour budget and independent BEA agenda remain.

Spec owns the engine and tests; Performance owns the pure snapshot adapter and
tests; Finance owns the table, tests and scoped styles; root owns composition,
integration, specifications and release. See CURRENT and
`tmp/markets-cohort-comparison/`. Mutation and adverse cases use synthetic records.
Limited live QA permits one default-board load, at most three existing EOD GETs,
without retries or owner writes. This feature itself adds no requests.

## Accepted history and preserved work

Markets watchlist release `3aaa62206dcbc929a15c0c3b16ace5759c977d84`, feature
`2056bd4e3480b1ebc544009c78ed7c4b026dcc61`, was accepted, normally pushed and
activated with build `fhvAHY2sO_Gv5b7mr8DF4`. A86 later replaced it; a85 is the
preserved rollback release. Its
[final independent review](../../tmp/markets-watchlist/final-acceptance-independent-review.json)
records 9,437 native passes, nine existing skips, 25 typechecks, 24 builds,
414 healthy samples, five successful required hosted jobs, nine synthetic
Brave groups and six limited live groups. Live QA used one existing watchlist
company and one explicit load, then verified chart focus, Research/Back and
desktop/390px layouts. No owner record was changed. Multi-company and adverse
states retain synthetic coverage; the source-derived one-EOD ceiling is not a
measured upstream count.

The preceding live BEA load showed six scheduled events, Eastern times and a dated 30-day
window, with four simultaneous series kept separate. Phone-width focus and
Discover/Back retention passed. Research/Back, adverse refreshes, DST and session
retirement remain synthetic coverage. This is BEA schedule coverage without
forecasts, released values, earnings, news or a complete economic calendar.

The first a84 candidate failed the strict OpenAPI route-list assertion. Its
revision, checkout and evidence remain preserved; the replacement added the
missing literal without relaxing the assertion. All a85 and older observers are
terminal. Used captures, stop helpers and reservations must not run again.

Use `markets-home/` for development. Preserve the parked `research-cockpit/`
changes, accepted a86 runtime and actual a85/a84/a83/a81 rollback manifests and checkouts
recorded in CURRENT. Historical process IDs are never future action authority.
The prior valuation diagnostic returned HTTP 400 before body parsing. No request
defect or entitlement denial was established; its operation budget is consumed.
Do not replay its helpers or repeat unchanged probing.

M2 and M3 remain incomplete. The retained AAPL annual example has FY2023–2025 and
six selected metrics, rather than ten complete years. The personal board and BEA
agenda do not establish whole-market breadth or InvestingPro parity.

## Working loop

1. Read applicable AGENTS.md, CURRENT.md and the feature specification. Assign
   concrete ownership and bounded acceptance before edits.
2. Reuse current modules and dependencies. Preserve session, draft and acquisition
   ownership when changing presentation.
3. Verify meaningful behavior, types/lint/format and existing boundary/page-mode
   checks. [Recorded lessons](../../tmp/company-overview/verification-order-lessons-v3.md)
   require the production web build before generated closure for composition changes.
4. Review explicit files and keep separate feature/generated closure commits with
   the unchanged isolated native gate. Preserve failures and the healthy runtime.
5. Push normally and require actual applicable hosted-job success at the exact
   revision. Do not replay terminal observers or unchanged passing checks.
6. Complete guarded activation, smoke and necessary Brave QA. Record actual
   source/build/runtime evidence, limitations and next work outside Git and in CURRENT.

[Release classification](./RELEASE_CLASSIFICATION.md), the
[engineering audit](./ENGINEERING_AUDIT.md) and
[Spec Kit adaptation](../specs/README.md) govern this workflow. Keep local access,
owner records and browser tabs intact. No credentials/private payloads in outputs.
