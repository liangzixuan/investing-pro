# Feature Specification: Light Market Atlas layout

**Created:** 2026-09-25 | **Status:** Implemented; synthetic QA passed; release acceptance pending
**Base:** Accepted a80 `481522e` in `markets-home`.
**Input:** [Roadmap](../../docs/PRODUCT_ROADMAP.md), [CURRENT.md](../../../CURRENT.md),
[Market Atlas](../../../design/platform-directions-20260925/01-market-atlas.png) and
[selected combined research view](../../../design/platform-directions-20260925/06-selected-combined-research.png).

## User Scenarios & Testing

### US1: Move through one light workspace (P1)

The owner uses the same compact header, search and navigation on Markets and
company research. **Independent test:** navigate between the existing workspace
destinations with keyboard and pointer at desktop and 390px widths.

1. The app opens on the existing Markets route; search and current navigation
   actions remain available in a consistent light visual system.
2. Current location, focus, local readiness and actionable errors remain legible.
   Narrow navigation remains reachable without document-wide overflow.

### US2: Scan the market board and open a company (P1)

The owner compares the existing declared board and inspects its selected chart.
**Independent test:** use available, partial, missing and mixed-date snapshots.

1. A compact table and selected-company chart follow the Atlas reference, using
   only the current admitted board and existing EOD observations.
2. Selection and Research remain distinct actions. Source, observation dates,
   adjusted-change periods and refresh feedback remain visible and accurate.
3. Selecting a row or returning from research reuses the retained snapshot.

### US3: Research without losing company context (P1)

The owner keeps the current company, research sections and saved-company context
in view. **Independent test:** follow source links, edit a synthetic note draft,
change sections, return to the origin and reopen the same company.

1. Reuse the current Watchlist rail and its guarded selection/paging. The combined
   image's market-board rail maps to this existing Watchlist context.
2. Keep company identity, Back and research sections clear on desktop. At 390px,
   use the existing company-context disclosure and a readable content column.
3. Notes, full-value/formula disclosures and explicit data controls remain usable.
   An empty Watchlist context must not obscure the selected company's content.
4. Put the active research panel before the retained overview and annual key
   statistics. The compact Price view keeps its chart, controls, source date and
   errors visible; native disclosures retain metadata, analytics and help.

### Edge Cases

Unready local access; unloaded or retained stale data; partial source failures;
mixed observation dates; empty Watchlist; long names and decimal values; changing
company/catalog/session during a request; hidden source targets; unsaved notes;
direct company entry with no origin list; narrow navigation and zoomed content.

## Requirements

- **FR-001:** Use one light shell across current workspace views, with shared
  typography, spacing, surfaces, focus and active-state styling. Keep supported
  navigation/search/readiness controls functional; add no placeholder controls.
- **FR-002:** Recompose the existing Markets board/chart toward reference 01.
  Preserve its declared cohort, exact identities, existing actions and data model.
- **FR-003:** Preserve source labels, actual EOD dates, adjusted-change periods,
  ranking eligibility, missing/error states and retained-refresh feedback.
- **FR-004:** Apply reference 06 to the current company composition and Watchlist
  rail. Add no market-cohort handoff, multi-company tabs or second selection owner.
  Keep tabs and the active panel before annual summary content in DOM order.
  Compact Price disclosures preserve mounted content and current callbacks.
  Use this single presentation; do not retain an unused full-layout mode.
- **FR-005:** Preserve persistent workspace mounts, hidden views/panels and current
  company keys. Keep existing draft, catalog, session and request-lifetime guards.
- **FR-006:** Preserve Back/origin focus, exact company URLs, guarded source-link
  tab changes, keyboard section navigation and current company-switch semantics.
- **FR-007:** Preserve explicit company acquisition, board entry/refresh behavior
  and their current budgets. Layout, context expansion and tab selection add no IO.
- **FR-008:** Support desktop and 390px layouts with visible keyboard focus, usable
  44px narrow controls and no document-wide overflow. Preserve exact-value details.
- **FR-009:** Add no feed, coverage, route, loader, API/schema, stored format,
  dependency or authentication change. Preserve owner records and parked work.

### Key Entities

Existing workspace view; declared market snapshot and selection; exact company;
Watchlist context; retained draft; active research section; source/loading state.

## Success Criteria

- **SC-001:** Source-bound screenshots demonstrate the approved shared light shell,
  compact Markets layout and retained company context at desktop and 390px.
- **SC-002:** Focused behavior and synthetic Brave checks demonstrate retained
  drafts/data, Back/source focus, keyboard use and unchanged request behavior.
- **SC-003:** Independent source review and every applicable existing release gate,
  guarded activation and permitted limited live QA pass at the exact candidate.

## Assumptions and Scope

The images contain invented data and unimplemented controls. They guide hierarchy
and styling, not data coverage or functional acceptance. Use current Watchlist
context instead of the illustrated market-cohort rail; no multiple-company loaded
state is promised. News, asset categories, ticker strips, valuation access and
new research features remain outside this single layout slice.

## Implementation evidence

Eight production files and two affected test files now implement the layout.
The [earlier source review](../../../tmp/market-atlas-layout/source-review-final.json)
and [source-focus CSS addendum](../../../tmp/market-atlas-layout/source-focus-css-review.json)
are retained alongside the [single-presentation cleanup](../../../tmp/market-atlas-layout/single-price-presentation/handoff.json).
The cleanup removes the unused mode and restores the page composition file to
its accepted baseline. Desktop Brave iterations
reduced Markets rows from roughly 142px to 77.5–78px and brought Price ahead of
the annual summary. The build4 source-focus recheck used the 132px desktop offset.
The [design verification](../../design-qa.md) records desktop, 390px and 1000px
checks, retained data/drafts, source focus, exact-value disclosures and partial/
empty states. Synthetic QA passed with no remaining actionable P0–P2 finding in
those states. The [final build5 check](../../../tmp/market-atlas-layout/synthetic-brave-qa-final-delta.json)
confirms the same chosen presentation on desktop and at 390px after the unused
mode was removed. Native/hosted gates, activation and limited live acceptance
remain pending.
