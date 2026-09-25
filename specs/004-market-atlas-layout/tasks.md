# Tasks: Light Market Atlas layout

**Status:** Implementation, focused checks and synthetic QA complete; release acceptance pending.
**Input:** [spec](./spec.md), [plan](./plan.md). `[P]` requires separate file ownership.

## Phase 1: Visual and behavior contract

- [x] T001 Root/spec: record owner-approved references 01/06, shared light theme,
      existing Watchlist context and file ownership in CURRENT.md and this spec.
      Preserve accepted a80 and parked changes. FR-001/004/009.

## Phase 2: US1/US2, shell and Markets

- [x] T002 [P] Shell owner: compose the compact shared header/search/navigation
      with current callbacks, readiness, focus and persistent mounts. FR-001/005/006.
- [x] T003 [P] Markets owner: implement the compact board/chart presentation with
      existing data/actions, exact source/date/missing states and no new IO.
      Affected behavior and narrow rendering pass; evidence is under T006.
      FR-002/003/007/008.

## Phase 3: US3, retained company context

- [x] T004 Root/Price owner: align shared tokens and company composition with the light
      hybrid; preserve Watchlist context, hidden panels, drafts, source focus,
      Back and company-switch semantics. Keep an empty rail unobtrusive.
      Put retained overview after the stable keyed panels, and compact Price
      metadata/analytics/help in mounted native details. Keep one Price layout
      without a compatibility mode. FR-004–009.

## Phase 4: Demonstration and release

- [ ] T005 Owners/root: complete focused behavior, types/lint/format and existing
      boundary/page-mode checks; independently review the exact source inventory.
      Record actual results and repair any new failures before feature freeze.
      Focused behavior, types, scoped lint/format and the unchanged boundary pass.
      Final eight-file production and documentation/inventory review remains pending.
- [x] T006 Root: source-bound synthetic desktop/390px Brave demonstrates the
      approved design, keyboard/source focus, retained data/draft and unchanged
      acquisition. Record screenshots, limits and no owner-record QA writes.
      Desktop, 390px, 1000px, partial and empty states pass on fixture build4.
      Final build5 also confirms the chosen layout and source focus after the unused mode was removed.
      See [design verification](../../design-qa.md) for measurements and limits.
- [ ] T007 Root: reviewed feature plus separate generated closure, unchanged
      native gate and all applicable hosted jobs pass at the exact revision.
      Preserve failed attempts and actual source/runtime evidence.
- [ ] T008 Root: guarded activation, smoke and permitted limited live Brave pass;
      record final independent acceptance, rollback and next outcome outside Git
      and in CURRENT.md. SC-001–003.

## Dependencies and Incremental Delivery

T001 fixes scope. T002/T003 can proceed independently; T004 integrates their
shared visual contract. T005/T006 precede final T007/T008 acceptance. Keep one
active release. Checked implementation tasks do not establish release acceptance.
Actual focused and source evidence is linked in the [plan](./plan.md); T007/T008
remain open until their own completed evidence exists.
