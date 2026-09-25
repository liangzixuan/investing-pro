# Implementation Plan: Light Market Atlas layout

**Date:** 2026-09-25 | **Status:** Implemented; synthetic QA passed; release acceptance pending
**Spec:** [spec.md](./spec.md) | **Base:** accepted `481522e`, `markets-home`

## Summary

Apply Atlas's market-first layout and Terminal's retained company context in one
light theme. Recompose the existing working surfaces in one bounded release.
The [design comparison](../../../design/platform-directions-20260925/README.md)
and references 01/06 define direction; the spec defines supported behavior.

## Technical Context

Use existing Next 16.3.1, React 19.2.8, ECharts 6.1.0, CSS, analytics and Vitest.
No new runtime package or data owner. `app/layout.tsx` already retains
`PersonalWorkspaceRoutes`; `/` already redirects to `/markets`. The shared
`SecurityDiscoveryWorkspace` owns session/catalog lifetime, navigation and drafts.
Markets and company panels retain their present data and selection boundaries.

## Constitution Check

[AGENTS.md](../../../AGENTS.md) and the [roadmap](../../docs/PRODUCT_ROADMAP.md)
remain authoritative. Build on the accepted product, separate presentation from
IO/calculation and reuse maintained dependencies. Adapt established market-table,
chart and research navigation patterns. No compatibility layer or new state store
is needed; the existing guards and release procedure remain required.

## Project Structure and Decisions

- Markets owner: `apps/web/src/features/markets/MarketsHome.tsx`, `markets.css`
  and necessary focused component tests. Keep the current hook/loader unchanged.
- Shell owner: `apps/web/src/features/research/SecurityDiscoveryWorkspace.tsx`,
  `apps/web/src/features/workspace/workspace.css` and affected integration tests.
  Update header/navigation presentation while retaining current callbacks and
  owner-access mounts. Do not move session/draft ownership into a visual wrapper.
- Root: `apps/web/app/globals.css`, existing company composition/styles and
  affected tests. `PersonalCompanyResearchWorkspace.tsx` places overview after
  its unchanged keyed panel map. `CompanyResearchPage.tsx` retains its accepted
  composition and consumes the single Price presentation without a mode prop.
- Price owner: `PersonalMarketOverview.tsx` and its existing test file. Compact
  presentation is the only layout in the existing component. Native details
  retain reference metadata, analytics and
  identity/help without adding request or state ownership.
- Spec owner: this spec/plan/tasks, `specs/README.md` and `docs/CURRENT_WORK.md`.
  Root owns workspace CURRENT.md and the outside-Git release checkpoint.

### Presentation and lifetime

Use shared light tokens for surfaces, text, spacing and action states. Keep gain/
loss meaning separate from the navigation accent. Change the existing personal
workspace styles without redesigning the separate synthetic demo.

Markets keeps its actual admitted cohort, selected chart, guarded Research links
and dates. Do not fill a visual sidebar with invented or automatically acquired
annual data. Company research reuses Watchlist context and its empty state;
there is no market-snapshot handoff or loaded multi-company tab model.

Keep hidden views and research panels mounted, exact company keys and current
focus handoffs. Preserve note drafts across supported Back/reopen actions;
switching company still follows the existing data/assumption reset policy.
At narrow widths, use current context disclosure behavior and readable stacked
content. Any sticky desktop header must not obscure focused headings or controls.
The source-target scroll margin uses the existing responsive header-offset token.
The actual DOM order puts tabs and active research before the retained overview
and key statistics; CSS does not create a different keyboard order.

## Verification and Acceptance

Run focused Markets, workspace/integration and company-section behavior checks,
web types/lint/format and existing boundary guards. Check page-mode/style mocks
early if imports or component owners change; prior [verification lessons](../../../tmp/company-overview/verification-order-lessons-v3.md)
remain relevant. Add tests for changed behavior, not static styling assertions.

Use source-bound synthetic Brave for available/partial/unloaded states, a retained
invented note, Back/reopen, source focus, context collapse and keyboard navigation.
Compare actual screenshots with 01/06 at desktop and 390px. Keep exact decimals
readable, measure overflow/targets and verify no additional request on presentation
actions. Limited live QA preserves owner records and uses current permitted data.

Follow [release classification](../../docs/RELEASE_CLASSIFICATION.md): reviewed
feature, separate nine-output closure, unchanged isolated native gate, normal push,
actual exact-revision hosted success, guarded activation and smoke/live evidence.
For a81 the predecessor is accepted a80 and counts are 263/264. Derive hosted
applicability from the final inventory; do not reuse terminal a80 observers or
consumed process helpers. Preserve the accepted runtime and rollback throughout.

### Current verification

The [initial focused checks](../../../tmp/market-atlas-layout/focused-checks.json)
record 415 passing cases, web types and the unchanged boundary guard. Subsequent
iterations retain [20 Markets cases](../../../tmp/market-atlas/markets-density-handoff.json)
and [18 Price cases](../../../tmp/market-atlas-layout/single-price-presentation/handoff.json),
with scoped lint/format passing. These overlap earlier suites and are not additive.
The single-presentation cleanup also passed all 15 page-mode cases and web types;
it removes only the added full-mode test, leaving five new Price cases overall.
Root's current workspace/page-mode and type checks accompany the final source
review. The [build4 binding review](../../../tmp/market-atlas-layout/app-qa/fixture-build4-independent-review.json)
rehashes 128 local inputs; its only change from build3 is source-focus CSS.
The [design verification](../../design-qa.md) passes desktop, 390px and 1000px
rendering, source focus, retained notes/data and partial/empty states. Document
widths of 375px and 985px fit the respective narrow viewports. Final fixture
quote/write/blocked-request/storage counters are zero; its RAM calls do not
measure actual provider traffic. The [final build5 check](../../../tmp/market-atlas-layout/synthetic-brave-qa-final-delta.json)
confirms desktop, 390px and source-focus behavior after removing the unused mode.
The chosen DOM and CSS are preserved. Final inventory review and release gates
remain pending.

## Complexity Tracking

No principle exception. This changes presentation and composition within existing
modules. Broader markets, valuation diagnosis, new persistence and acquisition
coordination remain separate outcomes.
