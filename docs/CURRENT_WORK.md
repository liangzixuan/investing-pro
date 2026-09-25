# Current work

Updated September 25, 2026. Build a personal Investing.com-style platform, then
Pro-style research and personal improvements, using existing subscriptions/free
sources. The [product roadmap](./PRODUCT_ROADMAP.md) owns scope and delivery order;
workspace [CURRENT.md](../../CURRENT.md) owns live source/runtime checkpoints.

## Active outcome: light Market Atlas layout

Use the manual Spec Kit [specification](../specs/004-market-atlas-layout/spec.md),
[plan](../specs/004-market-atlas-layout/plan.md) and
[tasks](../specs/004-market-atlas-layout/tasks.md). Work in `markets-home/` from
accepted a80 `481522e`. Implementation, focused checks and synthetic browser QA
are complete; release acceptance remains pending.

The owner selected [Market Atlas's home/navigation](../../design/platform-directions-20260925/01-market-atlas.png)
with [Terminal-style retained company context](../../design/platform-directions-20260925/06-selected-combined-research.png)
in one light theme. Recompose the current shared shell, compact market table/chart
and company workspace. The combined image's market-board rail maps to the existing
Watchlist rail. No market-cohort handoff or multi-company loaded state is promised.
The images contain invented data and do not establish functional acceptance.

Markets owns `MarketsHome.tsx`/`markets.css`; shell owns
`SecurityDiscoveryWorkspace.tsx`/`workspace.css`; root owns shared global CSS,
company composition and integration. Spec owns the current feature documents.
The final layout spans eight production files and two affected tests. Tabs and
the stable keyed panel map now precede overview/key statistics in DOM order.
The existing Price component has a compact presentation: chart, controls, source
date and errors stay visible, with metadata, analytics and help retained in native
disclosures. This is the component's single layout; no unused full-mode API is
retained. `CompanyResearchPage.tsx` returns to its accepted baseline composition.
Preserve persistent mounts, hidden views/panels, exact company/catalog/session
guards, drafts, Back/source focus and existing explicit acquisition budgets.
No new route, loader, data coverage, dependency, authentication or owner-record
change belongs to this layout slice.

Acceptance requires source-bound desktop/390px screenshots, keyboard navigation,
readable exact-value details, retained notes/data and no additional acquisition
from presentation actions. Independently review source and pass every applicable
existing release gate before activation. Keep actual evidence outside Git and
report observed behavior separately from the visual target.

The [initial focused checks](../../tmp/market-atlas-layout/focused-checks.json)
passed 415 cases, web types and the unchanged boundary guard. Later Markets and
compact Price checks passed 20 and 18 cases respectively; these overlap the
earlier suites and should not be summed. The [single-presentation cleanup](../../tmp/market-atlas-layout/single-price-presentation/handoff.json)
also passed 15 page-mode cases and web types. Earlier production review and its
[source-focus correction](../../tmp/market-atlas-layout/source-focus-css-review.json)
pass. Desktop Brave iterations produced 77.5–78px Markets rows, reordered company
content and a verified 132px source-focus offset. The [build4 binding review](../../tmp/market-atlas-layout/app-qa/fixture-build4-independent-review.json)
records the pre-cleanup source binding. [Design verification](../design-qa.md) passes
desktop, 390px and 1000px views, keyboard/source focus, retained notes/data and
partial/empty states. Narrow document widths are 375px and 985px; final fixture
quote/write/blocked-request/storage counters are zero. These are synthetic RAM
observations, not live provider evidence. The [final build5 check](../../tmp/market-atlas-layout/synthetic-brave-qa-final-delta.json)
confirms desktop, 390px and source focus with the single layout. Final inventory
review, native/hosted gates, activation and limited live QA remain pending.

## Accepted runtime and parked work

Annual company key statistics release `481522e55f746db1cb2ab4ba3951b979fd112c39`
is accepted, normally pushed and running; feature `3b005035`, build
`uVl5Lt9ew16Q8y-ooe5ps`. The [final independent review](../../tmp/company-key-statistics-v2/final-acceptance-independent-review.json)
binds actual native/hosted, source preservation, activation and browser evidence.
It supersedes pending-final-review wording retained in earlier pinned handoffs.
Preserve that history rather than changing previous specifications for release status.

The accepted product includes Markets, connected company overview, six annual
statistics and readable company/peer quality ratios. Live AAPL demonstrated
FY2023-2025, three of ten years, and six FY2025 metrics. This is bounded coverage,
not complete M2 or universal data availability. Native acceptance recorded 9,249
passes and nine existing skips; all five applicable hosted jobs, twelve synthetic
and six limited live Brave groups passed. CURRENT.md owns later runtime changes.

The [single daily valuation probe](../../tmp/company-key-statistics/valuation-source-probe.json)
returned 502 / `provider_unavailable`; access remains unresolved. The approved
layout takes priority over that diagnostic. Do not retry consumed probes or infer
denied entitlement. The original `research-cockpit/` checkout's unreleased SEC
quarter work stays parked. Preserve rollback, failed-candidate refs and existing
owner records; historical process IDs and consumed helpers are not action authority.

## Working loop

1. Read applicable AGENTS.md, CURRENT.md, this guide and the active spec. Assign
   file ownership and a bounded acceptance demonstration before source edits.
2. Reuse current dependencies and modules; coordinate shared interfaces without
   moving session, draft or acquisition ownership into presentation components.
3. Verify meaningful behavior, types/lint/format and existing component-owner/style
   setup early. [Recorded lessons](../../tmp/company-overview/verification-order-lessons-v3.md)
   explain prior boundary/mocked-CSS failures without weakening any gate.
4. Review explicit files and follow the separate feature/generated closure and
   unchanged isolated native gate. Preserve failed attempts and accepted runtime.
5. Push normally; accept actual required hosted-job success at the exact revision.
   Never replay terminal observers or unchanged passed gates.
6. Complete guarded activation/smoke and permitted Brave QA; record exact evidence,
   limitations, rollback and the next bounded outcome outside Git and in CURRENT.md.

[Release classification](./RELEASE_CLASSIFICATION.md) governs releases. The
[engineering audit](./ENGINEERING_AUDIT.md) and [Spec Kit adaptation](../specs/README.md)
do not replace it. Use configured local access and external Brave, preserve owner
records/tabs, and keep credentials/private payloads out of source and handoffs.
