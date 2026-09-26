# Current work

Updated September 25, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: a83 Ubuntu CI budget recovery

The a82 company-entry correction is implemented but remains undelivered. Its
candidate `0cf524332797fa2ddcc1a00e766850b3c3bded6e` passed native acceptance and
six synthetic navigation groups. The first Ubuntu hosted job exceeded its
15-minute limit. One unchanged Ubuntu-only retry also ended `cancelled` after
901 seconds, despite all 13 applicable steps reporting success. Hosted acceptance
therefore failed; preserve both terminal attempts and do not replay their observers.

Work in `markets-home/` from that clean a82 candidate. The sole a83 change is to
raise the Ubuntu matrix job timeout in `.github/workflows/ci.yml` from 15 to
30 minutes, matching Windows. Keep every release-gate command, test, assertion,
operation deadline, workflow trigger and other matrix setting unchanged. This
guide records the recovery; no application source change is included.

Performance owns these two files and the implementation handoff. Spec reviews
the exact diff; Root owns feature/closure commits and release execution. Record
a83 evidence in `tmp/ubuntu-ci-budget/`. Retain a82 product evidence in
`tmp/company-entry-alignment/`; it does not establish acceptance of a new SHA.
The new candidate still needs its own native and applicable hosted acceptance.

The retained heading fix keeps ticker focus with `preventScroll:true` and scrolls
the existing company region on the two entry paths, including Watchlist cohort
movement. Source links, Back/origin focus, identity/lifetime guards, loaded data
and note drafts remain unchanged. After a83 passes its release gates, complete
guarded activation and the reviewed live AAPL heading, Back and source-link checks
at desktop, 1000px and 390px widths, without new data acquisition. Carry forward
the wrapped-name synthetic proof because the application bytes are unchanged.
Accepted a81 remains serving until then.

## Accepted runtime and parked work

Market Atlas release `80b68b270364121ab806c9c98fb1f8a69ac2e8cd`, feature
`65515b17ef2c6960a7f64ae0084c5b2709516491`, is accepted, normally pushed and
running with build `nqnlDBzaYRSXQIMCexnZ6`. Its
[final independent review](../../tmp/market-atlas-layout/final-acceptance-independent-review.json)
records 9,254 native passes, nine existing skips, all five required hosted jobs,
synthetic design checks and seven limited live groups. One unchanged Windows
retry passed after a timeout; the failed attempt remains preserved.

The approved light Markets navigation and compact company workspace retain
existing Watchlist context, chart data, notes and hidden panels. The small P3
heading overlap remains pending delivery through this recovery. Earlier
[layout specification](../specs/004-market-atlas-layout/spec.md) and
[design verification](../design-qa.md) record the layout and retained a82 synthetic
alignment checks; synthetic verification alone does not establish live delivery.

The product still has a three-company EOD board. Live AAPL annual data returned
FY2023-2025, three of ten requested years, with six selected annual metrics.
These observations do not establish universal provider coverage or complete M2.
The [valuation diagnosis handoff](../../tmp/market-atlas-layout/next-outcome.md)
follows the alignment fix. Its consumed 502/provider_unavailable probe does not
establish denied entitlement and must not be replayed.

The original `research-cockpit/` checkout's unreleased SEC quarter work remains
parked. Preserve its source, owner records and accepted rollback checkout/manifest.
Historical process IDs and consumed observers/stop helpers are not action authority.

## Working loop

1. Read applicable AGENTS.md, CURRENT.md, this guide and the relevant feature
   specification. Assign file ownership and bounded acceptance before edits.
2. Reuse current dependencies and modules. Preserve session, draft and acquisition
   ownership when changing presentation.
3. Verify meaningful behavior, types/lint/format and existing boundary/page-mode
   checks. [Recorded lessons](../../tmp/company-overview/verification-order-lessons-v3.md)
   explain prior setup failures without weakening any gate.
4. Review explicit files and follow separate feature/generated closure with the
   unchanged isolated native gate. Preserve failures and the accepted runtime.
5. Push normally and accept actual required hosted-job success at the exact
   revision. Never replay terminal observers or unchanged passed gates.
6. Complete guarded activation, smoke and permitted Brave QA. Record actual
   evidence, limitations, rollback and next work outside Git and in CURRENT.md.

[Release classification](./RELEASE_CLASSIFICATION.md), the
[engineering audit](./ENGINEERING_AUDIT.md) and
[Spec Kit adaptation](../specs/README.md) govern the workflow. Use configured
local access and external Brave; preserve owner records and tabs, and keep
credentials/private payloads out of source and handoffs.
