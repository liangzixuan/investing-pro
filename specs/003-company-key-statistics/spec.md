# Feature Specification: Annual company key statistics

**Created:** 2026-09-25 | **Status:** Implementation underway; acceptance pending
**Base:** Accepted connected overview `b25a05e` in `markets-home`.
**Input:** [Roadmap M2](../../docs/PRODUCT_ROADMAP.md), workspace CURRENT.md and
the [bounded handoff](../../../tmp/company-overview/next-outcome.md).

## User Scenarios & Testing

### US1: Read recent business performance (P1)

The owner loads the existing company overview and reads six annual statistics
without another request. **Independent test:** compare the section with the
existing Financials calculations for the same exact company and fiscal year.

1. Given loaded annual statements, show operating margin, net margin, operating
   cash-flow margin, net debt, debt/assets and revenue year-over-year growth.
2. Given missing latest-year inputs, show the existing unavailable reason. Do not
   use an older known value. Growth needs the actual consecutive prior fiscal year.
3. Given unloaded annual data, explain the missing source and link to the existing
   load surface. Entry, rendering and source links must acquire no data.

### US2: Inspect how a statistic was derived (P1)

The owner opens a calculation disclosure or its Financials source without losing
company context. **Independent test:** use zero, negative, missing, nonconsecutive
and quarantined fixtures, then follow the source link with the keyboard.

1. Show fiscal/statement dates, provider attribution and local request time separately.
   Identify the current and prior years used by growth, with existing input refs.
2. Show usable statistics out of six separately from returned annual years out of
   ten; six known statistics do not imply complete annual history.
3. Preserve formulas, units, output strings and reasons; do not infer TTM, SEC
   verification, valuation or broader source coverage from these annual results.

### US3: Read financial-quality ratios without long decimal strings (P1)

The owner sees a short ratio label and can reveal the full calculation value.
**Independent test:** repeating decimals, negative/tiny values, exact zero and
large magnitudes in both Financial quality and manual peer-quality tables.

1. Round only display labels; a rounded label must never change Met/Not met,
   comparison results, source strings, formula versions or missing-value states.
2. Keep small nonzero values distinct from zero, mark approximations and expose
   full calculation strings in a keyboard-accessible disclosure that wraps.

### Edge Cases

Latest-year missing cells; zero denominators; negative net debt or margins;
nonpositive prior revenue; missing/nonconsecutive years; rejected identity or
quarantined periods; equal display labels with different exact comparisons;
loading/failed refresh with retained data; large ratios at narrow width.

## Requirements

- **FR-001:** Derive exactly six statistics from the existing annual analytics and
  strict exact-identity projection. Reuse loaded annual data; add no acquisition.
- **FR-002:** Use the latest returned fiscal year without older-value fallback.
  Preserve zero, signed values, units, unavailable reasons and quarantine outcomes.
- **FR-003:** Reuse existing revenue-growth semantics, including consecutive years,
  positive prior revenue and actual current/prior period/source references.
- **FR-004:** Separate six-metric availability from ten-year returned coverage.
  Show source, fiscal/statement dates and local request time with their actual meanings.
- **FR-005:** Make formulas, versions, input refs and full calculated output strings
  inspectable. Source links use existing guarded tab/focus handling; no new loader.
- **FR-006:** Use one pure Decimal display formatter for both existing quality
  tables: four fractional places, half-up; scientific notation at magnitudes of
  at least 1e9; approximation indication and signed nonzero interval when rounding
  would show zero. Preserve the original value and ratio unit in accessible details.
- **FR-007:** Preserve existing engine statuses/comparisons and annual rounding.
  Display formatting must not mutate data, global Decimal settings or formulas.
- **FR-008:** Keep desktop and 390px layouts readable, with keyboard disclosures,
  source focus and no document-wide overflow. Preserve drafts and Back behavior.
- **FR-009:** Keep the current hook, valuation behavior, API/schema, dependencies,
  request/vault/origin boundaries and persistence unchanged. No provider retry,
  owner-record QA write or daily valuation summary belongs to this slice.

### Key Entities

Exact admitted company; validated annual result; six-statistic projection; existing
metric/growth outputs and coverage; pure ratio display label plus original value.

## Success Criteria

- **SC-001:** Focused tests demonstrate exact projection, missing/zero/signed cases,
  actual growth periods, coverage counts, quarantine and zero new acquisition.
- **SC-002:** Tests and keyboard/narrow checks demonstrate short ratio labels,
  full-value disclosure and unchanged exact comparison outcomes in both tables.
- **SC-003:** Source-bound synthetic and permitted limited live Brave show the
  connected annual-statistics journey; all applicable existing release gates pass.

## Assumptions and Scope

This extends the accepted first M2 slice; it does not complete M2. One daily
valuation probe returned HTTP 502 / `provider_unavailable`; this establishes
neither access nor denied entitlement. Its receipt is retained in the
[plan](./plan.md#actual-source-prerequisite). Market cap/P/E/P/B, valuation-owner
migration, new screening metrics, peers, quarterly data and new feeds are deferred.
