# Tasks: Connected company overview

**Status:** T001–T005 implemented/checked locally; T006/T007 partly verified.
Guardrails, permitted live-page QA and release acceptance remain open.
**Input:** [spec](./spec.md), [plan](./plan.md). Format: `[ID] [P?] [Story]`.
Parallel tasks require distinct file ownership; parent coordinates shared interfaces.

## Phase 1: Source and coordination decisions

- [x] T001 [US1/US2] Root: one bounded AAPL annual probe returned FY2023–2025,
      90 known cells, zero unknown returned cells and seven missing years; all three
      latest summary fields known. Three local calls, one annual application call.
      [Evidence](./plan.md#actual-source-probe); no repeated acquisition. FR-009.
      Integrated real-summary acceptance under SC-001 remains T007.
- [x] T002 [US1/US3] Data/root: agree the shared coordination and pacing contract:
      15-minute same-input spacing, four sequences/hour/company authority, cached
      snapshot admission free, explicit Refresh and separate activity/current guards.
      The plan records this decision; T003 implements it and T006 tracks validation.

## Phase 2: US1, one connected load

- [x] T003 [US1] Data owner: move market/annual ownership into
      `apps/web/src/features/research/useCompanyOverviewData.ts`; implement missing
      domain loading, shared pacing/deduplication and explicit Refresh. Test fresh
      entry (zero automatic calls), cached entry and source-derived request bounds.
      FR-001–005; preserve existing affected caller behavior.
- [x] T004 [P] [US1/US2] UI owner: build the small overview presentation and extract
      the existing annual analytics projection. Test exact latest-year reported
      fields, missing/zero/invalid cells, distinct dates and responsive states.
      No new formulas or independent annual acquisition. FR-006/008.

## Phase 3: US2/US3, partial results and research continuity

- [x] T005 [US1/US2/US3] Root: integrate company composition and hook into
      `SecurityDiscoveryWorkspace.tsx`; remove moved state/loaders and share one
      annual object with Financials/quality/current valuation inputs. Keep advanced
      loading explicit and retain navigation/drafts. FR-004/007.
- [ ] T006 [US2/US3] Data/UI/root: test independent failures, retained refresh data,
      panel budget bypass attempts, rapid repeated actions, synchronous route/
      identity/catalog/session retirement, late responses and Back/draft behavior.
      Focused behavior and web types/scoped lint passed; existing guardrails
      remain open. Evidence below. SC-002.

## Phase 4: Demonstration and acceptance

- [ ] T007 [US1/US2/US3] Root: use source-bound synthetic complete/partial fixtures
      and desktop/narrow Brave to demonstrate the journey, keyboard actions and
      draft retention. Add permitted live annual evidence if access succeeds;
      report field coverage separately from company-page completeness. Build 2
      passed the synthetic journey; build 3 passed final presentation checks.
      Permitted real-page QA remains open. SC-001/003.
- [ ] T008 [US1/US2/US3] Root: independently review explicit files, follow existing
      feature/closure and isolated native/exact-revision hosted checks, then activate
      only an accepted candidate. Preserve failed attempts and real acceptance in
      CURRENT.md and the outside-Git handoff. Do not repeat unchanged passing checks.

## Dependencies and Incremental Delivery

T001 can run beside T002 and independent presentation work. T003 needs T002;
T004 shares only a reviewed interface. T005 integrates both; T006 exercises the
result before T007/T008. A source denial does not erase usable prices, but it must
remain an explicit real-data acceptance gap. Keep the accepted M1 app available.
Quarterly/valuation/peer expansion and connected screen coverage are later M2 work.

## Evidence

The [data handoff](../../../tmp/company-overview/data-handoff.json) records 54 hook
passes plus web types/scoped lint. The [UI handoff](../../../tmp/company-overview/ui-handoff.json)
records 73 distinct passes across the initial run and two focused repairs. Root
integration records 339 distinct cases: [attempt 5](../../../tmp/company-overview/integration-attempt5.log)
passed 336 with three failures; [attempt 6](../../../tmp/company-overview/integration-attempt6.log)
passed those three corrected cases. [Web types](../../../tmp/company-overview/root-typecheck-attempt3.log) passed.

The groups overlap, including 14 Annual cases within root coverage; do not sum
them. A subsequent [four-case repair](../../../tmp/company-overview/conflict-feedback-tests.log)
verifies that price or annual catalog conflicts clear retained data and display
a specific reload message. Failed attempts and repair details remain in the
handoffs. The AAPL probe establishes narrow source access only.

[Build 2 Brave observations](../../../tmp/company-overview/app-qa/brave-build2-observations.json)
cover bounded loading, exact/missing figures, source-tab focus, independent failure,
cached entry, narrow layout and retained data/unsaved notes through Back and failed
Refresh. The held-response case also involved session revalidation, so it does not
isolate route-only cancellation. [Build 3](../../../tmp/company-overview/app-qa/brave-build3-observations.json)
passed final busy-copy/disabled-style checks and the settled 636px layout.
Guardrails, permitted real-page QA and release checks remain open. The accepted
M1 runtime stays unchanged.

The first native candidate stopped at a stale component-owner boundary check;
native typechecks, tests and builds did not run. [Recovery evidence and scope](./plan.md#native-gate-recovery)
retain that failure. T006/T008 require the corrected guard and a fresh accepted
candidate, including the now-applicable normalization hosted workflow.
