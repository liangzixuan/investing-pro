# Current work

Updated September 26, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: a84 BEA release agenda

Add an explicit 30-day economic-release agenda to Markets using BEA's public
schedule. This is a bounded M3 slice that works independently of company valuation
access. The [specification](../specs/005-bea-release-agenda/spec.md),
[plan](../specs/005-bea-release-agenda/plan.md) and
[tasks](../specs/005-bea-release-agenda/tasks.md) define implementation and acceptance.
Release verification is pending; implementation is not delivery.

The fixed BEA adapter makes one credential-free request per explicit load, with
a ten-second deadline and 256 KiB upstream body limit. It validates timestamps,
deduplicates identical series/instant pairs and returns a dated, bounded window.
The API authenticates through existing local-access/request controls. The web
agenda shows Eastern times, attribution and the loaded window, preserves accepted
results after a failed refresh and on Research/Back, and rejects retired requests.
There is no new dependency or persistence. Forecasts, actual values, earnings,
non-BEA events and individual release links are outside the source's coverage.

The retained public source contains 30 series plus one update-metadata field.
Offline admission produces six events in the September 26–October 26 window;
this is evidence for that retrieval, not a guarantee of future feed availability.
`tmp/bea-release-agenda/` preserves source bytes, failed attempts, focused checks
and independent reviews. Root owns contracts/specs/guard/release coordination;
Spec owns the provider/route; Finance owns presentation/lifecycle; Performance
reviews independently. Concrete file ownership is recorded in workspace CURRENT.

The prior valuation diagnosis is closed without usable daily fundamentals.
Its admitted provider request returned HTTP 400 before body parsing. Official
documentation comparison found no demonstrated request-shape defect. This does
not establish denied entitlement or the cause of the earlier 502. The operation
budget is consumed: do not replay either helper or repeat unchanged probing.
Evidence and limits are in `tmp/valuation-diagnosis-20260926/`.

## Accepted runtime and parked work

Release `d0ad5d3537d012f2d96af1355dc05f015a76c7e8`, feature
`a180581b3b8a5680b95b9309aa3af539e4446a73`, is accepted, pushed and running with
build `ctwpL7Jmcwdx9J_OSztkI`. Its
[final independent review](../../tmp/ubuntu-ci-budget/final-acceptance-independent-review.json)
records 9,254 native passes, nine existing skips, 25 typechecks, 24 builds,
370 healthy observations, six successful required hosted jobs, six carried
synthetic Brave groups and five limited live groups.

The light Market Atlas layout and company-entry correction preserve ticker focus,
Back/source navigation, drafts and loaded data. The Ubuntu job's outer budget is
30 minutes, matching Windows; all gate commands and operation deadlines remain
unchanged. Both failed a82 Ubuntu attempts remain preserved. All a83 and older
hosted observers are terminal and must not run again.

Use `markets-home/` for the active feature. Preserve the original dirty
`research-cockpit/` checkout, the accepted a81 rollback checkout and the actual
rollback manifest in CURRENT. Saved process IDs and used stop/reservation helpers
are historical evidence, never authority for a new action.

The price board still covers three companies. The retained AAPL annual example
has FY2023–2025 and six selected metrics, rather than ten complete years. M2 and
M3 remain incomplete; a BEA agenda does not establish a complete economic/news
service or InvestingPro parity.

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
