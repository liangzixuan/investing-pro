# Implementation Plan: Markets home and company entry

**Date:** 2026-09-24 | **Status:** Source/design decisions made; integrated implementation and verification in progress
**Spec:** [spec.md](./spec.md) | **Checkout:** Isolated `markets-home` at accepted a77

## Summary

Add a bounded Markets view and direct company route to the current application.
Separate source availability from presentation and share workspace lifetime across
local routes. Keep the accepted runtime available throughout implementation.

## Technical Context

TypeScript; existing Next 16.3.1/React 19.2.8, Fastify 5.12.1, ECharts 6.1.0 and
decimal.js through current analytics. Windows local app; one owner; six board
listings maximum. Existing vault/catalog storage and Vitest conventions apply.
Inspect installed types/documentation before adding custom behavior; no new package
or Python service is planned.

## Constitution Check

Use [AGENTS.md](../../../AGENTS.md) and [PRODUCT_ROADMAP.md](../../docs/PRODUCT_ROADMAP.md).
Deliver a working layer; keep source, calculations and views modular; use maintained
dependencies and established market-table/chart navigation. Update current callers
in one change, removing obsolete interfaces without compatibility adapters. Preserve
owner data and existing required release checks. Recheck these decisions after M0.

## Project Structure and Decisions

- **Data owner:** `apps/api/src/personal-market-data-provider.ts`,
  `workspace-market-data-routes.ts`, `packages/contracts/src/index.ts`, and affected
  `apps/web/src/lib/personal-workspace-api.ts` callers/tests. Schema 2.0.0 now gives history and optional quote independent
  available/unavailable results. Every caller states `includeQuote`; the board
  requests EOD only. No old-contract adapter remains.
- **Analytics owner:** add a small board projection in
  `packages/personal-market-analytics/src/personal-market-board.ts` and its tests;
  reuse decimal calculations and validated bars. UI never performs financial math.
- **Web owner:** use the existing `apps/web/app/layout.tsx` as the persistent
  parent in personal workspace mode for Markets, Discover and `company/[listingId]`.
  Route leaves are separate; a workspace bridge parses Next navigation and mounts
  the existing controller, which owns local workspace/session/catalog lifetime and
  the draft store. Route views receive that
  state; they do not create competing sessions or fetch around existing guards.
  Refactor `SecurityDiscoveryWorkspace.tsx` along these boundaries as required.
- Add `apps/web/src/features/markets/MarketsHome.tsx` and a focused data hook/module;
  reuse the chart components, research panels and global search. The exact listing
  ID in the URL resolves against the current admitted catalog; display its symbol.
  The existing `research/[symbol]` route redirects in workspace mode and is not a
  functioning local-company deep link. Do not retain that behavior as a second API.

### Source Research and Interface Decisions

First resolve up to six public seed candidates through supported catalog routes;
record the admitted listing/security/symbol identities. Use a small supported local
market-route probe to establish existing access without private configuration reads.
Record operation, status, eligible bar dates and coverage, with no secrets. If the
coupled route refuses, retain the refusal and verify EOD independently after FR-002;
do not infer EOD denial from a failed combined response. No owner-list writes.

History and quote need independent success/error results with the same exact
identity/lifetime validation. Default board/chart range is the existing one-month
range. Each snapshot requests each admitted listing once, sequentially, with one EOD provider request per
resolved listing and no quote request. Entry/Refresh is bounded; selection
reuses snapshot bars. Back reuses a dated snapshot; refresh explicitly replaces it.
Optional quotes cannot alter the adjusted-close change or determine board readiness.
Confirm and test actual underlying HTTP request totals during the source step.

#### Initial source probe, September 24

The configured local API resolved AAPL, MSFT and WMT to one admitted U.S.
common-stock listing each. JPM, XOM and JNJ returned no catalog matches. These
are catalog admission gaps; no provider requests were made for those three
symbols, so their provider coverage remains untested. The first attempt stopped
at the missing JPM identity before acquiring any provider data. A separate
resolution pass established the three-listing cohort before acquisition.

Three sequential one-month overview requests then returned HTTP 200 and
`available`, with 22 history bars and an IEX-derived reference for each admitted
listing. The last two bar dates were ordered and the date pair matched across all
three responses. Each response matched the resolved listing, symbol and range.
This establishes a usable initial cohort, not whole-market coverage or a future
availability guarantee. The implementation must display its declared cohort.

The pre-change implementation implies an upper bound of six underlying Tiingo
requests for these three local calls; the upstream count was not instrumented.
No raw values, bars, dates or response payloads were retained. Operational results
and public identities are saved outside Git in
`tmp/engineering-audit-20260924/markets-source-probe.json` and
`markets-candidate-resolution.json` at the workspace root. The receipt time is
2026-09-25 00:16:33 UTC (September 24 in America/Chicago).

### Accepted source labels and request budget

The board displays each actual EOD bar date, USD currency and Tiingo attribution.
Its later snapshot load time is separate; no live-price or consecutive-session
claim follows from a pair of observations. Reference quotes remain separate.
Existing valuation consumers may derive an explicitly labelled EOD reference using
the existing 36-hour modeled regular-close policy; Markets does not use that policy
to label an EOD bar as current.

Public Tiingo Starter documentation lists 50 requests/hour, 1,000/day,
500 symbols/month and 1 GB/month. This is a conservative planning reference,
not a verified account entitlement. The source review and official links are in
workspace `tmp/engineering-audit-20260924/markets-source-contract.md`.

The initial board has three admitted seeds (AAPL, MSFT, WMT), with a six-row
implementation bound. One entry load and explicit Refresh use sequential EOD-only
calls. Refresh starts are spaced 15 minutes apart with at most four in a rolling
hour. Selecting a chart or returning from company research reuses the in-memory
snapshot. No automatic polling or retry. The budget governs this board, not other
research tools sharing the provider account. Shared access/rate failures stop
remaining requests and preserve completed rows; per-company failures remain visible.

Synthetic provider tests verify one upstream request for EOD-only calls and two
independent calls when a quote is requested. Quote denial/timeout preserves usable
EOD; owner abort/provider close retires the whole request. The real source probe
already established a usable cohort; it need not be repeated to retest these
synthetic failure boundaries.

### Desktop and narrow design

The selected Research Desk direction uses the existing local Flatly 5.3.8 resources
and ECharts 6.1.0. The outside-Git interactive preview is in
`tmp/markets-home/design/`; its README records template/library provenance.
Root inspected it in external Brave at 1440 x 1050 and 390 x 844, including company
navigation, a retained invented draft, Back to the selected chart, and simulated
quote failure with the EOD chart retained. At the narrow width the document did
not overflow horizontally and observed main controls were 44 px tall.
`browser-observations.json` binds these observations to the prototype source.
This prototype verifies the design; it does not establish application acceptance.

All ranked rows require the same pair of valid observation dates;
otherwise show dated values without ranking. A pair of returned bars does not prove consecutive exchange sessions; label the actual comparison dates. Do not infer live-market status or an observed close time from a modeled timestamp. No new persistence is needed for board
data; keep transient snapshots and drafts in the shared workspace lifetime. A fresh
page load resolves the requested company and does not imply persisted unsaved drafts.

### Design and Validation Guide

The bounded source/cohort contract and desktop/narrow prototype are recorded
above. Integrated application and real-cohort acceptance remain open. Use the
owner's market-portal reference and suitable Bootstrap Studio resources.
Use compact tables, chart, clear source dates and existing research entry points.
FinanceDatabase is a future directory input, never a quote source, automatic
admission rule or reason to rewrite provider symbols without evidence.

Run focused API/contract/analytics/component behavior tests during implementation;
verify denied quote with valid EOD, independent row errors, split/period arithmetic,
deduplication, exact request bounds and identity/draft navigation. Exercise one
real permitted cohort and synthetic edge cases without owner-record mutation.
Capture desktop/narrow Brave evidence. Review the complete diff, then follow the
unchanged [release workflow](../../docs/RELEASE_CLASSIFICATION.md) and applicable
native/hosted checks once per candidate. Record exact outcomes in the current
handoff; a written plan or source classification is not a passed release.

## Complexity Tracking

No principle exception is proposed. Shared route lifetime is necessary for direct
navigation without losing existing drafts/guards. Feed independence fixes a concrete
coupling defect; it does not justify a new provider framework. Source-probe and prototype evidence remain distinct from integrated application
and release acceptance, which are still pending.
