# Tasks: Annual company key statistics

**Status:** Source and focused verification complete; browser/release acceptance pending.
**Input:** [spec](./spec.md), [plan](./plan.md). `[P]` requires separate file ownership.

## Phase 1: Source decision

- [x] T001 Root/spec: preserve the one-use valuation probe's 502/
      `provider_unavailable` result and freeze annual-only scope. This is unresolved
      access, not denied entitlement. No retry or substitute multiple. FR-009.

## Phase 2: US1/US2, six inspectable annual statistics

- [x] T002 Data: implement/test the pure `personal-company-key-statistics` projection.
      Use six existing outputs with latest-year missing/zero/signed/quarantined
      cases, actual consecutive growth periods and separate metric/year coverage.
      Preserve units, formulas and source refs without mutation or IO. FR-001–004.
- [x] T003 [P] UI: implement/test `PersonalCompanyKeyStatistics` for idle, available,
      partial and retained-source states; show dates, explanations and accessible
      calculation/source details using existing guarded navigation. FR-004/005/008.
- [x] T004 Root: compose the section into the company page and scoped CSS, passing
      the existing annual result. Verify zero additional acquisition, source-tab
      focus, Back/draft behavior and existing identity/lifetime guards. FR-001/008/009.

## Phase 3: US3, readable existing quality ratios

- [x] T005 [P] UI: add/export/test the pure Decimal display formatter; cover halfway
      rounding, repeating/negative/zero/tiny/large values and approximation labels.
      Apply it to Financial quality and manual peer-quality tables with full-value
      keyboard details. Preserve statuses, comparisons and source strings, including
      two distinct observations with the same display label. FR-006/007; SC-002.

## Phase 4: Demonstration and release

- [x] T006 Data/UI/root: complete meaningful focused behavior, types/lint and
      source/ownership review. Full existing release guards remain in T008. SC-001/002.
- [ ] T007 Root: source-bound synthetic fixtures and permitted limited live Brave
      demonstrate statistics, formula/source focus and both quality displays at
      desktop/390px. Record actual coverage, zero QA writes and remaining limits.
- [ ] T008 Root: follow existing feature/closure, native and exact hosted gates;
      preserve failed attempts and rollback, then activate and record smoke/live
      acceptance in CURRENT.md and outside-Git evidence. SC-003.

## Dependencies and Incremental Delivery

T001 fixes scope. T002 and the separate formatter work in T005 can run together;
T003 uses the agreed projection, then T004 integrates it. T006 precedes final
T007/T008 acceptance. A document or passing isolated test is not a release.
Valuation summary/loading, new metrics and broader M2 capabilities remain later work.

## Evidence

The [source-preservation review](../../../tmp/company-key-statistics/source-before-implementation.json)
records clean accepted `b25a05e`, local ref agreement and all 25 parked source files
unchanged. [Probe review](../../../tmp/company-key-statistics/source-probe-review.json)
and [actual response metadata](../../../tmp/company-key-statistics/valuation-source-probe.json)
record the bounded attempted prerequisite. The [projection review](../../../tmp/company-key-statistics/projection-independent-review.json)
records 16 focused passes; [UI/integration review](../../../tmp/company-key-statistics/ui-integration-independent-review.json)
records 78 distinct formatter/UI passes, 314 workspace integration passes, scoped
lint and web/analytics typechecks. These groups are recorded separately; unchanged
tests were not repeated. Synthetic/live Brave and complete release acceptance
remain pending. Populated daily valuation is unverified and outside this slice.
