# Implementation Plan: Annual company key statistics

**Date:** 2026-09-25 | **Status:** Scope frozen; implementation/verification underway
**Spec:** [spec.md](./spec.md) | **Base:** accepted `b25a05e`, `markets-home`

## Summary

Add a compact annual Key statistics section using the already-loaded statements.
Repair the demonstrated long-ratio presentation in existing quality tables.
Preserve the accepted working page and release it only after actual acceptance.

## Technical Context

Use existing TypeScript/React/Next components, shared annual analytics, Decimal
and Vitest. No endpoint, wire schema, data hook, stored format or dependency change.
The new section is a pure projection and presentation; existing controls own IO.
This follows the [manual Spec Kit adaptation](../README.md).

## Constitution Check

[AGENTS.md](../../../AGENTS.md) and the [roadmap](../../docs/PRODUCT_ROADMAP.md)
remain authoritative. Build on the working overview, reuse existing formulas and
installed Decimal types, and separate projection from display. No compatibility
adapter, second request owner or replacement release process is needed.

## Project Structure and Decisions

- Data: `personal-company-key-statistics.ts` and its test beside existing research
  projections. Export `projectPersonalCompanyKeyStatistics({ selection, financials })`.
- UI: `PersonalCompanyKeyStatistics.tsx` and its test in that directory.
  Own Financial quality and manual peer-quality component/test display changes.
- UI: `packages/personal-financial-analytics/src/financial-ratio-display.ts`, its
  test and package `index.ts` export. Use the declared Decimal dependency there;
  do not add an undeclared transitive import in web code.
- Root: company-page composition, scoped CSS and integration tests.
- Spec: these documents and the current-work guide. Coordinate shared interfaces
  before editing another owner's files.

### Annual projection

Reuse `buildPersonalAnnualFinancialAnalytics` after existing strict annual/identity
validation. Select `operatingMargin`, `netMargin`, `operatingCashFlowMargin`,
`netDebt`, `debtToAssets` and `analytics.growth.revenue` as `revenueGrowth`.
Keep their existing value/unit, formula ID/version/expression, input refs,
unavailable reasons and fiscal fields. Preserve quarantine rather than dropping
the latest invalid period or searching backward for a value.

The ready model carries latest fiscal year, statement date, `asOf` and attribution.
`asOf` is the adapter's local request time, recorded before the provider fetch;
label it "Requested at" separately from the statement date.
`availableMetricCount` out of six is separate from returned years, ten requested
years and missing years. Revenue growth refers to its actual current/prior years;
the existing engine determines missing, nonconsecutive and nonpositive-prior cases.
Retained results keep their original dates through the existing refresh lifecycle.

### Ratio presentation

Use Decimal with explicit half-up rounding for four fractional places; use
scientific notation with four fractional places when absolute magnitude is at
least 1e9. Mark a label as approximate when display rounding changes the value.
If a nonzero value rounds to zero, show a signed interval instead of exact zero.
Keep full finite-precision calculation strings, ratio units, periods and formulas
inside native keyboard-accessible details; wrap long values there.

The analytics engine still owns check statuses and exact comparisons. Test two
values that share a rounded label but produce different comparison outcomes.
Do not change engine normalization, annual output rounding or global Decimal
configuration. The [source-backed follow-up](../../../tmp/company-overview/financial-quality-formatting-followup.md)
records the pre-existing renderer and five unchanged M1/M2 source blobs.

### Actual source prerequisite

At 2026-09-25 17:23:41 UTC, one AAPL 1M daily valuation application call returned
HTTP 502 / `provider_unavailable`, following local-access 204 and exact search 200.
The [receipt](../../../tmp/company-key-statistics/valuation-source-probe.json)
records three local requests, one valuation call, no saved provider values and no
credential/owner-record read. At most two upstream GETs is a source-derived bound;
traffic was not measured. Preserve the consumed probe; do not retry it.

The [preparation health sample](../../../tmp/company-key-statistics/preparation-health.json)
confirmed the accepted web build before that probe. The failure does not establish
denied entitlement. Root froze annual-only scope at 17:26 UTC; no new daily
valuation UI or coordination is planned. Existing valuation behavior remains.

## Verification and Acceptance

Test actual formula/period/coverage behavior, display rounding and unchanged
statuses, missing/quarantined cases, no mutation/IO and source focus. Existing
identity/lifetime behavior stays with the shared workspace. Run focused component
and integration checks, types/lint and applicable existing boundary guards before
freezing source; use the [recorded verification lessons](../../../tmp/company-overview/verification-order-lessons-v3.md)
to check actual component owners and stylesheet test setup early.

Demonstrate synthetic partial/precision cases and desktop/390px keyboard layouts.
For limited live QA, reuse loaded annual data when available; root chooses any
necessary existing explicit load. No owner records are changed for testing.
Record visible field coverage separately from complete company-page coverage.
Follow the existing [release procedure](../../docs/RELEASE_CLASSIFICATION.md),
including separate feature/closure commits, unchanged isolated native gate,
exact-revision hosted checks, guarded activation and actual smoke/live acceptance.

## Complexity Tracking

No principle exception. Two small web modules and one shared display formatter
serve the current outcome; all provider work and valuation migration are deferred.
