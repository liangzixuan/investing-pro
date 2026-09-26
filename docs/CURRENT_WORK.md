# Current work

Updated September 25, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: company-entry heading alignment

Correct the small desktop issuer-name overlap found in the accepted Market Atlas
layout. Work in `markets-home/` from accepted a81
`80b68b270364121ab806c9c98fb1f8a69ac2e8cd`. The
[assessment](../../tmp/market-atlas-layout/heading-alignment-assessment.json)
records the live observation and source cause: company entry scrolls the ticker
h2, while the issuer name is visually positioned above it.

Keep keyboard focus on the ticker with `preventScroll:true`, but align the
existing containing company region using its responsive scroll margin. Apply
this only to the two company-entry paths, including watchlist cohort movement.
Preserve Back/origin targets, source links, session/catalog/company guards,
delayed callbacks, loaded data and note drafts. No fixed extra pixel offset,
new request, dependency, API, schema or authentication change is needed.

Performance owns the affected workspace component and its existing navigation
tests. Root owns integration, this guide and release execution. Spec independently
reviews the fix and prepares synthetic verification; Finance prepares fresh,
disabled release helpers outside Git. Record actual evidence in
`tmp/company-entry-alignment/` and CURRENT.md.

Acceptance requires the complete issuer-name block to clear the sticky header
on desktop and intermediate widths, including long wrapped names. Verify 390px
behavior, ticker focus, Back and source links with actual app components in a
synthetic RAM fixture. Preserve owner records and provider budgets. Review the
source, complete the applicable release gates, then activate and perform bounded
live Brave navigation checks without new data acquisition.

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
heading overlap is this active follow-up. Earlier
[layout specification](../specs/004-market-atlas-layout/spec.md) and
[design verification](../design-qa.md) describe the delivered composition;
their pre-release checkpoint wording is superseded by final acceptance.

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
