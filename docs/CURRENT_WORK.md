# Current work

Updated September 27, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: a86 compare the loaded Markets board

Add a compact shared-date comparison beneath the loaded board. Show each
company's adjusted-price change and maximum drawdown over observations present
for every member, with the actual dates/count and a coverage disclosure. The
[specification](../specs/007-markets-cohort-comparison/spec.md),
[plan](../specs/007-markets-cohort-comparison/plan.md) and
[tasks](../specs/007-markets-cohort-comparison/tasks.md) define acceptance.
Implementation and verification are in progress; a85 remains the accepted app.

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

## Accepted runtime and preserved work

Markets watchlist release `3aaa62206dcbc929a15c0c3b16ace5759c977d84`, feature
`2056bd4e3480b1ebc544009c78ed7c4b026dcc61`, is accepted, normally pushed and
running with build `fhvAHY2sO_Gv5b7mr8DF4`. Its
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
changes, healthy a85 runtime and actual a84/a83/a81 rollback manifests and checkouts
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
