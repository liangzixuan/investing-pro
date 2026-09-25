# Tasks: Markets home and company entry

**Status:** T001–T010 accepted at release `9c2aa4f` on 2026-09-25.
**Input:** [spec](./spec.md), [plan](./plan.md). Actual acceptance is recorded in
[the final review](../../../tmp/markets-home/final-acceptance-independent-review.json)
and [requirement matrix](../../../tmp/markets-home/m1-final-acceptance-matrix.json);
[workspace CURRENT.md](../../../CURRENT.md) owns later progress and runtime status.
Format: `[ID] [P?] [Story] Description`; `[P]` permits parallel work only when
files and dependencies are independent. Parent assigns actual agents before edits.
Tests below verify behavior and are required by the specification.

## Phase 1: Source and Design Decisions

- [x] T001 [US1] Data owner: resolve at most six exact identities through current
      catalog routes; probe permitted local data operations and record real outcomes,
      delays/periods and request budget in `plan.md`. Denied combined access is not
      proof of independent EOD failure. No owner-list changes or private-config reads.
      Progress: AAPL/MSFT/WMT resolved and each returned 22 bars through three
      successful one-month overview calls. JPM/XOM/JNJ were absent from the catalog.
      The [plan](./plan.md#initial-source-probe-september-24) records evidence and
      final date labels, board refresh budget and independent-failure test evidence. Do not
      repeat the unchanged successful acquisition.
- [x] T002 [P] [US1] Web owner: save desktop/narrow designs outside Git and link
      them from `plan.md`; show the whole Markets-to-company journey and failure states.
      Completed prototype QA: Brave 1440/390, selected-company Back, draft retention,
      and quote failure with usable EOD. Actual React integration passed T009.

## Phase 2: US1, Populated Markets Board

- [x] T003 [US1] Data owner: separate quote/history availability in
      `apps/api/src/personal-market-data-provider.ts`, `apps/api/src/workspace-market-data-routes.ts`,
      `packages/contracts/src/index.ts` and `apps/web/src/lib/personal-workspace-api.ts`
      with all affected callers; add partial/denial tests.
      Recheck real EOD access when T001 could not distinguish the two feeds. FR-002/009.
- [x] T004 [P] [US1] Analytics owner: implement
      `packages/personal-market-analytics/src/personal-market-board.ts` projection
      and tests for adjusted-close changes between declared dates, missing bars, splits and mixed
      sessions using current decimal analytics. FR-003/004/008.
      Completed: 36 focused analytics tests, package types and scoped lint passed.
- [x] T005 [US1] Web owner: implement `apps/web/src/features/markets/MarketsHome.tsx` and its data module using
      T003/T004; test source dates, independent errors, exact cohort and request bounds,
      cache/refresh/abort behavior and selection/chart reuse. FR-001/003/005/007/009.

## Phase 3: US2, Direct Company Route and Return

- [x] T006 [US2] Web owner: use shared `apps/web/app/layout.tsx` in workspace mode
      and add `apps/web/app/company/[listingId]/page.tsx`
      route; refactor existing workspace ownership without duplicating sessions.
      Update company entry/search together. FR-006/009.
- [x] T007 [US2] Web owner: test direct URL resolution, invalid identities, Back,
      selected chart, preserved drafts and delayed responses after identity/session
      changes; keep all existing research views reachable. FR-005/006/009.

## Phase 4: US3, Board Change Ranking

- [x] T008 [US3] Web/analytics owners: add board-scoped sorting using T004 eligible
      results; test shared-date ranking and explicitly unranked/missing rows.
      Name the cohort and period in `apps/web/src/features/markets/MarketsHome.tsx`. FR-004/008.

## Phase 5: Demonstration and Release

- [x] T009 [US1/US2/US3] Root: verify all FR/SC acceptance against actual behavior,
      inspect desktop/narrow Brave with a real permitted cohort and synthetic failure/
      draft scenarios. Record source/build, coverage and limits; preserve owner records.
- [x] T010 [US1/US2/US3] Root: review explicit files and complete unchanged feature/
      generated closure, isolated native and applicable exact-revision hosted checks.
      Activate only the accepted candidate; record real verification and runtime in
      CURRENT.md/handoff and update these tasks from evidence. SC-001/002/003.

## Dependencies and Incremental Delivery

T001/T002 can run together; T003/T004 can run in parallel after source decisions.
T005 needs their settled contracts. T006/T007 share web ownership with T005 and
must not edit the same files concurrently. T008 uses T004; T009 requires all
stories. T010 follows acceptance. Keep the healthy app running until the candidate
passes. Do not start news, multi-asset admission or SEC parser work as a prerequisite.

## Current focused evidence

T003 API/provider/client/OpenAPI initial checks: 170 tests passed. Updated existing
UI consumers: 618 distinct cases passed. Exact catalog lookup: 159 focused cases
passed across engine, route, client and OpenAPI files (overlaps the earlier suites).
Markets hook and loader: 34 plus 27 tests passed, including context retirement,
StrictMode replay and a pre-effect navigation race. Markets presentation: 20 cases
passed after review fixes. These counts are overlapping scoped suites, not a full
repository total or release acceptance. Outside-Git receipts live in
`tmp/markets-home/` and `tmp/engineering-audit-20260924/` at the workspace root.

Shared workspace and route checks passed 365 distinct focused cases. Synthetic Brave
checks covered the populated board, adjusted-close sorting, cached company entry
and Back, direct URL resolution, retained note drafts, delayed/aborted responses,
partial EOD results and quote refusal with usable EOD. The fixture makes no real
provider calls or owner-record writes. Exact source receipts and limits are in
workspace `tmp/markets-home/app-qa/`; T009 subsequently accepted actual Next routing
and the permitted live cohort. The chart spacing and reconnect-state fixes have
focused regression coverage and passed their final visual recheck.

T009/T010 acceptance: three real EOD rows; eight limited live Brave groups including
fresh direct entry; 9,084 native passes with nine existing skips; all six required
hosted jobs across five workflows. One unchanged-source Windows retry passed after
an initial failure, with both attempts retained. These counts support the linked
acceptance matrix; they are not a platform-completion percentage.
