# Current work

Updated September 27, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: a87 Federal Reserve announcements

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
