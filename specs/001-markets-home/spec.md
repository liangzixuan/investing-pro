# Feature Specification: Markets home and company entry

**Created:** 2026-09-24 | **Status:** Accepted 2026-09-25; release `9c2aa4f`
**Checkout:** `markets-home`; original SEC work remains parked separately.
**Acceptance:** [final independent review](../../../tmp/markets-home/final-acceptance-independent-review.json)
and [15-requirement matrix](../../../tmp/markets-home/m1-final-acceptance-matrix.json).
[Workspace CURRENT.md](../../../CURRENT.md) owns subsequent runtime/progress status.
**Input:** Personal Investing.com-style platform, existing subscriptions/free sources;
first useful market board and connected company research. [Roadmap](../../docs/PRODUCT_ROADMAP.md)

## User Scenarios & Testing

### US1: Read the market board (P1)

The owner opens Markets and sees a dated snapshot for a declared board of at most
six admitted U.S. common-stock listings. This makes the first page useful.
**Independent test:** load permitted data and identify the source, date and change
period of each available row without entering provider configuration.

1. Given resolved board identities, entering Markets loads one bounded snapshot;
   each row shows symbol/name, latest available EOD close and its date/source.
2. Given two valid dated daily observations, the row shows their adjusted-close
   percentage change and both source dates. With insufficient bars, change is unavailable.
3. Given quote denial with usable EOD history, EOD remains visible. One row's
   failure does not blank successful rows; missing values never become zero.

### US2: Open research and return (P1)

The owner selects a row, inspects its price history, opens its direct local company
URL and returns to the same board/selection. Existing research remains reachable.
**Independent test:** visit the direct URL, then exercise board-to-company Back
navigation with a synthetic unsaved note draft.

1. Given an admitted listing, its chart uses the same valid price bars/convention
   as the board. Its direct URL resolves that exact current catalog identity.
2. Given client navigation, Back restores board/selection and unsaved drafts.
   A fresh browser load resolves the URL without promising unsaved-draft recovery.
3. Given a stale/invalid listing, fail clearly before provider acquisition.
   Delayed responses from a prior identity/session never render in the new view.

### US3: Compare board changes (P2)

The owner sorts eligible dated changes to find this board's gainers/losers.
**Independent test:** compare order against fixture arithmetic and the declared cohort.
Rows with different comparison date pairs remain separately dated and unranked; the UI
never calls this a whole-market movers list.

### Edge Cases

Missing/denied feeds, partial failures, stale cache, weekends, insufficient bars,
splits, duplicate or unresolved seeds, mixed session dates, aborted requests,
rapid navigation, local-session revalidation and direct URL refresh.

## Requirements

- **FR-001:** Resolve at most six unique current common-stock identities from the
  existing catalog. Seeds are suggestions until admitted; never edit owner lists.
- **FR-002:** Expose EOD history independently of optional quote availability;
  update affected contracts/callers together without an old-API compatibility layer.
- **FR-003:** Show currency, source, source bar date, missing/failure state and cached status
  per row. An EOD close is not a live quote. Keep optional quotes separate.
- **FR-004:** Calculate change between the last two usable adjusted
  closes using existing decimal analytics and show both dates. Do not claim a one-session period without evidence of session completeness. Do not mix quote/EOD or raw split prices.
- **FR-005:** Use bounded, cancellable loading on explicit route entry and Refresh;
  deduplicate active work, reuse dated snapshots and do not poll in the background.
- **FR-006:** Provide chart, direct company route, global search and return
  navigation while shared workspace lifetime preserves drafts and identity guards.
- **FR-007:** Support readable desktop/narrow layouts, labelled keyboard controls
  and useful loading/empty/error states. Operator details belong in Data sources.
- **FR-008:** Rank only eligible rows with the same comparison dates. Disclose
  board membership and incomplete coverage; FinanceDatabase does not admit listings.
- **FR-009:** Preserve owner data, local-access/vault/origin boundaries and request
  limits. No provider secrets, authentication changes, paid feeds or new packages.

### Key Entities

Board definition and resolved catalog identities; independent sourced EOD/quote
results; dated snapshot; selected listing/view state. Reuse current contracts where
they satisfy these requirements; dataset metadata does not prove feed entitlement.

## Success Criteria

- **SC-001:** A small real permitted cohort completes US1/US2; every shown value
  has its actual source/date. Fixture-only rendering does not satisfy this outcome.
- **SC-002:** Behavior tests cover all FRs, including denied quote/usable EOD,
  split arithmetic, mixed sessions, request budgets and stale navigation responses.
- **SC-003:** Desktop and narrow Brave QA demonstrates the complete journey;
  all applicable existing release checks pass at the candidate revision.

## Assumptions and Scope

Actual AAPL/MSFT/WMT EOD data, desktop/narrow Brave navigation and fresh direct
company entry passed. Synthetic cases cover partial feeds, drafts and retirement;
actual browser network totals and 200% zoom were not measured. Native and all six
required hosted jobs passed, with the original Windows failure and sole successful
retry preserved in the linked acceptance evidence. These are bounded M1 outcomes,
not whole-market or complete-company coverage. Annual entitlement, broader assets,
news/calendars and AI remain separate work; configuration proves no new feed access.
SEC structural parsing and FinanceDatabase admission do not block this release.
