# Feature Specification: Connected company overview

**Created:** 2026-09-25 | **Status:** Implemented locally; focused and synthetic Brave checks recorded; acceptance pending
**Checkout:** `markets-home`, based on accepted M1 release `9c2aa4f`.
**Input:** [Product roadmap M2](../../docs/PRODUCT_ROADMAP.md); the first connected
company-page slice, not completion of M2 or InvestingPro parity.

## User Scenarios & Testing

### US1: Load one useful company overview (P1)

The owner opens a company and chooses **Load company overview** once to see its
price history and latest annual revenue, net income and operating cash flow.
**Independent test:** compare fresh direct entry with a Markets-to-company entry
whose matching 1M EOD snapshot is already available.

1. Given fresh direct entry, resolve its exact current listing and remain idle
   until the explicit action. Request missing 1M EOD and annual data only.
2. Given matching Markets history, retain its chart and load only missing annual
   data. If both domains are available, reuse them without a provider request.
3. Given complete loaded domains, explicit Refresh reloads them within the shared
   budget. Loading/retry targets missing domains; duplicate actions are deduplicated.

### US2: Keep useful data when a source fails (P1)

The owner can inspect available prices or business figures even when the other
domain is unavailable. **Independent test:** separate EOD failure, annual denial
and successful annual data with unknown cells.

1. Given a domain failure, retain the other domain and show a specific unavailable
   state. Do not manufacture numeric values or automatically try another feed.
2. Given annual data, show its fiscal year, statement date and source separately
   from retrieval time and EOD observation date. A known zero remains a known zero.
3. Given refresh, retained data keeps its original dates and is labelled as the
   previous result. A failed refresh does not imply a newer observation.

### US3: Continue research without repeating setup (P1)

The owner moves among Overview, Financials and existing analysis, then returns to
Markets with drafts intact. **Independent test:** use invented drafts and delayed
responses while changing company, route, catalog and workspace/session lifetime.

1. Given loaded annual data, Financials, quality and current valuation inputs use
   the same result without another annual request. Price controls share the same
   request owner; changing panels cannot bypass pacing or revive retired work.
2. Given Back and same-company return, preserve the promised in-memory snapshots
   and notes. A fresh browser load does not promise recovery of unsaved drafts.
3. Given any identity/lifetime retirement, cancel pending actions and reject late
   successes, errors and callbacks. Never bind one company's data to another.

### Edge Cases

Annual access refusal; missing fiscal years/cells; malformed or quarantined values;
partial price failure; repeated clicks; explicit range changes; refresh with old
data; route changes before effects; catalog/session replacement; StrictMode replay.

## Requirements

- **FR-001:** Use the existing exact company URL and full admitted identity,
  catalog snapshot and session authority. Entry alone acquires no provider data.
- **FR-002:** One explicit action requests only missing EOD (`includeQuote:false`)
  and annual data, sequentially. Fresh entry defaults to 1M; explicit Price range
  and quote actions remain available without silently triggering other domains.
- **FR-003:** Bound a fresh overview load to two local data calls, two normal
  upstream GETs and at most one existing annual-403 diagnostic GET. With reusable
  EOD, allow only the annual call and its possible diagnostic. No automatic retry.
- **FR-004:** Move market/annual coordination into one persistent owner and share
  loaded results and pacing across overview/panel entrypoints. Remove duplicated
  state; keep quarterly, long valuation history, peers and SEC explicitly loaded.
- **FR-005:** Deduplicate work, retain successful sibling data and stop remaining
  requests on global access/rate/lifetime failure. Explicit Refresh and retry obey
  15-minute spacing per repeated company/domain input and four request sequences
  per rolling hour per exact company authority. History keys include range/quote
  choice; annual has its own key. First other-domain/range loads remain allowed.
  Retain the budget across Back/selection; admitting a Markets snapshot costs zero.
- **FR-006:** Present latest-year reported revenue, net income and operating cash
  flow using the existing annual projection/decimal semantics. Missing/invalid
  cells are unknown, with fiscal/source dates and provider-most-recent disclosure.
- **FR-007:** Preserve drafts, Back/focus behavior, stale-response rejection and
  local-access/vault/origin boundaries. Provider results stay in session memory.
- **FR-008:** Keep chart and summary readable on desktop and narrow screens, with
  labelled keyboard actions and distinct idle/loading/partial/refresh states.
- **FR-009:** Verify actual annual access separately. No new API/schema, package,
  paid feed, authentication change, owner-record QA writes or SEC/TTM claim.

### Key Entities

Exact company/context key; independent EOD and annual results; shared request
lifetime and budget; annual summary projection. Reuse the existing DTOs and
analytics. Catalog admission and EOD success do not establish annual entitlement.

## Success Criteria

- **SC-001:** A bounded real annual probe records actual access and known-field
  coverage. A populated summary is demonstrated if access permits; a refusal is
  recorded as unmet populated-summary acceptance, not full M2 completion.
- **SC-002:** Focused behavior tests prove FR-001–009, including cached entry,
  independent failures, exact request bounds, shared pacing and synchronous retirement.
- **SC-003:** Desktop/narrow Brave demonstrates the connected journey; all
  applicable existing native/hosted release gates pass at the candidate revision.

## Assumptions and Scope

M1 is accepted. This slice is implemented locally, with focused checks recorded in
the [tasks](./tasks.md#evidence). Synthetic Brave covered the main journey and
final presentation. Permitted real-page QA and release acceptance remain open.
The [plan](./plan.md#actual-source-probe) records one successful AAPL annual probe
with partial ten-year coverage. Broader entitlement and the real integrated
company page remain unverified. Focused tests cover the shared pacing contract.
Daily market cap/multiples, longer valuation history, quarterly data, automatic peers,
broader screening and complete company-page coverage remain later M2 work.
