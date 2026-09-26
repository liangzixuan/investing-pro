# Current work

Updated September 26, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: a85 Markets for My Watchlist

Let the owner choose up to six admitted U.S. common stocks from My Watchlist,
load their dated EOD prices, inspect charts and scoped movers, then open company
research and return to the same cohort. Annual financials are not a prerequisite.
The [specification](../specs/006-markets-watchlist/spec.md),
[plan](../specs/006-markets-watchlist/plan.md) and
[tasks](../specs/006-markets-watchlist/tasks.md) define behavior and acceptance.
Implementation, focused checks and the production web build are complete.
Nine synthetic Brave groups cover selection, loading, failures, navigation,
notes, membership changes, session loss and narrow layouts. Final release gates
and limited live verification are pending; the accepted a84 app remains running.

Both default suggestions and watchlist selections load explicitly. This replaces
M1's automatic entry acquisition. One mode/selection draft retains checkbox
choices across modes; one accepted snapshot carries exact cohort identity and
observation dates. The picker does not save or reorder My Watchlist.

Local catalog admission precedes the single EOD loop. Saved members use the
exact-listing client and all eleven identity fields, with no ticker substitution.
A shared fifteen-minute/four-start rolling-hour budget is charged immediately
before the first EOD request; wholly inadmissible selections consume no slot.
At six companies, this board permits at most 24 EOD GETs per rolling hour. Other
research tools share the provider account. No entitlement claim follows from
that bound. No new API, storage schema, dependency or provider operation is needed.

Keep a same-cohort accepted snapshot after a wholly failed refresh, including
row-level failures. A usable partial result replaces it as a whole. A changed
draft must not display old prices under its new labels. Preserve synchronous
session/view/selected-member guards, note drafts, matching company handoff and
independent BEA agenda state. Notes, saved versions and unrelated membership
edits do not invalidate unchanged selected identities.

Spec owns loader/admission/tests; Performance owns the hook/lifetime/tests;
Finance owns picker/presentation/CSS/tests; root owns the identity-only workspace
bridge, integration, specifications and release coordination. Exact ownership and
later evidence are in CURRENT and `tmp/markets-watchlist/`. Use synthetic records
for mutation QA and one existing admitted cohort for bounded live verification.
Do not create owner records to obtain a populated test result.

## Accepted runtime and preserved work

The BEA agenda release `9c3dee7bacdbb6799925e5b4d04e2675ade6be48`, feature
`7b0a3eefc9ba85aebc34bacae3b20a22838043f6`, is accepted, normally pushed and
running with build `tfssNu3LdvQ1Mr2L76IDz`. Its
[final independent review](../../tmp/bea-release-agenda-v2/final-acceptance-independent-review.json)
records 9,360 native passes, nine existing skips, 25 typechecks, 24 builds,
440 healthy samples, six successful required hosted jobs, seven carried
synthetic Brave groups and six limited live groups.

The live BEA load showed six scheduled events, Eastern times and a dated 30-day
window, with four simultaneous series kept separate. Phone-width focus and
Discover/Back retention passed. Research/Back, adverse refreshes, DST and session
retirement remain synthetic coverage. This is BEA schedule coverage without
forecasts, released values, earnings, news or a complete economic calendar.

The first a84 candidate failed the strict OpenAPI route-list assertion. Its
revision, checkout and evidence remain preserved; the replacement added the
missing literal without relaxing the assertion. All a84 and older observers are
terminal. Used captures, stop helpers and reservations must not run again.

Use `markets-home/` for development. Preserve the parked `research-cockpit/`
changes, healthy a84 runtime and actual a83/a81 rollback manifests and checkouts
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
