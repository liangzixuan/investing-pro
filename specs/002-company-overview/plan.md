# Implementation Plan: Connected company overview

**Date:** 2026-09-25 | **Status:** Accepted at `b25a05e`
**Spec:** [spec.md](./spec.md) | **Base:** accepted M1 `9c2aa4f` in `markets-home`

## Summary

Actual acceptance is recorded in the [final matrix](../../../tmp/company-overview/m2-acceptance-matrix-v3.json)
and [independent review](../../../tmp/company-overview/final-acceptance-independent-review-v3.json):
9,183 native passes/nine existing skips, all five hosted workflows/six jobs,
synthetic and limited live Brave, guarded activation and smoke. Both failed native
candidates and repairs remain preserved. The implementation/validation narrative
below records the earlier plan and intermediate evidence, including then-pending
steps; the final records and workspace CURRENT.md own delivered status.

Connect the existing company page through one explicit missing-domain load and a
compact annual summary. Reuse a matching Markets snapshot and one annual result
across current panels. Keep the accepted release serving until this slice passes.

## Technical Context

Existing TypeScript, React 19.2.8, Next 16.3.1, Fastify 5.12.1, ECharts 6.1.0,
decimal.js and Vitest cover this layer. Use the persistent workspace/session and
existing overview/annual routes and DTOs. No dependency, API, schema, persistence
or authentication change is planned. Provider data remains session-memory only.

## Constitution Check

[AGENTS.md](../../../AGENTS.md) and the [roadmap](../../docs/PRODUCT_ROADMAP.md)
remain authoritative; no separate constitution is created. Build on the working
M1 journey, move existing state instead of duplicating it, separate transport and
projection/presentation, and reuse current analytics. Inspect installed types
before custom machinery. Obsolete internal interfaces need no compatibility layer.
Preserve owner data and the established release workflow.

## Project Structure and Decisions

- Data owner: `apps/web/src/features/research/useCompanyOverviewData.ts` and its
  focused tests. Move current market/annual request state here, within the shared
  workspace lifetime. Expose guarded loaded results/actions to all current callers.
- UI owner: the pure summary projection/component and their tests; extract the
  existing annual DTO-to-analytics projection for reuse.
  Preserve existing formulas, exact decimals and unknown/quarantined outcomes.
- Root: `SecurityDiscoveryWorkspace.tsx` integration, `CompanyResearchPage.tsx` wiring
  and scoped CSS; remove moved state, retain navigation/drafts and review shared
  interfaces before edits. Keep existing explicit advanced-data loaders.
- Spec owner: these documents, M1 acceptance status and current-work guide.
  Shared files require agreement with their owner before edits.

### Source and interface decisions

Existing market overview schema 2.0.0 independently returns EOD and optional quote;
annual schema 1.1.0 returns up to ten normalized years, reported cells and coverage.
The overview starts at 1M and requests `includeQuote:false`. Existing explicit
Price range/quote controls retain their purpose. Exact data/context matching is
required before reusing a result; route retirement cannot revive pending work.

The annual summary uses `revenue`, `net_income` and `operating_cash_flow` from the
latest returned fiscal year. Do not substitute another year for a missing latest
cell. Reuse the annual analytics projection for existing consumers; add no new
formula. Provider-most-recent annual data is neither TTM nor independently SEC
verified. Show fiscal year/statement date separately from ingestion/as-of time.

Loading is sequential and missing-domain only; Refresh is explicit once both
domains are loaded. Keep completed domains on partial failure, and retain old
dates/disclosures during refresh. No duplicate requests, polling or automatic
retry. The hook must share pacing across overview and Price/annual panel actions.
The agreed policy spaces repeated exact company/domain inputs by 15 minutes:
history keys include range and includeQuote; annual uses its own key. A first
annual request or new range remains allowed. Limit each exact company authority
to four request sequences per rolling hour, retaining this budget across Back
and company selection. One sequential EOD-then-annual action counts one sequence;
Markets snapshot admission consumes none. Refresh repeats both domains with the
current usable history range and includeQuote:false; 1M is the default when
history is missing. This UI policy is not a verified provider-account quota.

Keep synchronous action/route activity (`isActive`) separate from full data
authority (`isCurrent`). Both must reject retired work before a response or old
callback can change state; an in-memory result is not permission to resume a request.

Fresh overview loading permits at most two local data calls, two normal provider
GETs and one possible annual HTTP403 diagnostic GET. Cached EOD reduces this to
one annual call and at most two upstream GETs. Both valid domains require zero
provider calls for Load. Catalog/session traffic is separately accounted. These
are supported by focused client-call tests and the unchanged provider operation
bounds; actual browser upstream totals have not been measured.

### Open evidence and validation

Root's [bounded source plan](../../../tmp/company-overview/source-probe-plan.md)
used one resolved public AAPL annual call through the configured local API, with
only the adapter's possible 403 diagnostic. Actual results are below. Broader
annual access remains unverified; do not add a substitute feed or claim M2 complete.
FinanceDatabase is irrelevant to this check.

#### Actual source probe

At 2026-09-25 07:18:57 UTC, the accepted M1 runtime returned local statuses
204/200/200 for local access, exact AAPL search and annual financials. The existing
client validated schema, provider policy, identity, periods and coverage. FY2023,
FY2024 and FY2025 were returned: three of ten requested years, 90 known cells,
zero unknown returned cells and seven missing years (FY2016–2022). Latest revenue,
net income and operating cash flow were all known. Missing years still make the
requested history partial; known returned cells do not establish complete history.

The [receipt](../../../tmp/company-overview/annual-source-probe.json) records three
local requests and one annual application call. Two upstream GETs are a source
maximum, not measured traffic. No amounts, statement rows, credentials or owner
records were saved. An initial relative command path failed before helper execution;
the subsequent absolute invocation completed once. The helper is consumed and must
not be invoked again. This result proves narrow observed AAPL access; the new M2
presentation and shared loading have focused and final synthetic Brave coverage.
The real integrated page and broader source coverage remain open.

The reviewed source/UI handoffs are
[data](../../../tmp/markets-home/after-markets-company-page-data.md) and
[presentation](../../../tmp/markets-home/after-markets-company-page-ui.md).
Their source-only review (`b45f06ab`) is planning evidence. It is not a browser
check, account entitlement or acceptance of the forthcoming implementation.

Test missing-domain request counts, sibling retention, shared budgets, latest-year
unknown/zero/invalid cells, exact identities and delayed callbacks after every
lifetime boundary. Verify draft/Back behavior in integrated synthetic fixtures,
then desktop/narrow Brave and permitted actual data without owner-record writes.
Use the unchanged [release workflow](../../docs/RELEASE_CLASSIFICATION.md) for the
reviewed feature/closure, native and exact-revision hosted gates. Record actual
coverage and acceptance in workspace CURRENT.md and `tmp/company-overview/`.

### Local implementation evidence

The [data handoff](../../../tmp/company-overview/data-handoff.json) records 54
focused hook passes, full web types and scoped lint. The [UI handoff](../../../tmp/company-overview/ui-handoff.json)
records 73 distinct passes across the original run and focused repairs. Root
integration has 339 distinct passes across [attempt 5](../../../tmp/company-overview/integration-attempt5.log)
(336 passes, three failures) and [attempt 6](../../../tmp/company-overview/integration-attempt6.log)
(the three repaired cases); [web types](../../../tmp/company-overview/root-typecheck-attempt3.log) passed.
These groups overlap: 14 Annual cases in the UI group also appear within root
coverage. Do not add the group totals or call them a single clean full run.

A subsequent [four-case repair](../../../tmp/company-overview/conflict-feedback-tests.log)
verifies visible catalog-conflict feedback after retained data clears, for both
price and annual domains.

T003–T005 are implemented. T006 retains guardrails; T007 is partly verified below
and T008 retains release acceptance. Preserve failed attempts and repair evidence.
These checks do not establish a delivered M2 release or the wider M2 milestone.

### Native gate recovery

Candidate `db4a9794` failed its first native gate at the boundary check because
five render anchors still pointed to `SecurityDiscoveryWorkspace.tsx` after
their components moved to `CompanyResearchPage.tsx`. The
[retained error](../../../tmp/isolated-db4a9794ad999bb263ec153c36bda7326e095b97/verify.stderr.log)
records the failure. Format, lint and release classification passed; native
typechecks, tests and builds did not run. Move those requirements to their actual
source owner and check the workspace-to-page connection, preserving all other
guards. The revised feature, separate closure and full acceptance remain pending.
Including `scripts/verify-boundaries.ts` also makes the normalization workflow
applicable: five hosted workflows and six required jobs, including real
normalization execution/evidence success. Earlier four-workflow planning does
not apply to the revised candidate.

### Synthetic Brave evidence

[Build 2 observations](../../../tmp/company-overview/app-qa/brave-build2-observations.json)
record explicit idle-to-load behavior, one EOD/annual sequence without quote, exact
negative/zero/unknown values and three-of-ten fiscal-year coverage. Independent
source failures retained the other domain; source links selected the correct tab
and focused its heading. Desktop 1440x1000 and settled narrow 390x844 layouts were
readable, with one column and no horizontal page overflow at the narrow width.

Markets entry reused EOD and loaded annual only. Same-company Back/reopen kept
loaded data and an unsaved invented note without another data request or write.
After a labelled synthetic 16-minute advance, failed annual Refresh kept the old
values, dates and draft. These are RAM client counts, not measured provider calls.
A held late annual response was rejected, but local-access revalidation coincided
with navigation; route-only retirement is established by focused tests, not that
browser observation.

[Build 3 checks](../../../tmp/company-overview/app-qa/brave-build3-observations.json)
passed the final busy copy and disabled appearance: held EOD loading showed no
cooldown message or quote claim, then completed both domains. At 636x844, the
537px single-column layout had no horizontal overflow and the muted disabled
button remained 44px high. Viewport override was reset. These changes preserve
the eight build 2 behavior groups. Permitted live QA and release gates remain
pending. No owner record was changed.

## Complexity Tracking

No principle exception is proposed. Moving existing coordination and a small
composition module closes a concrete repeated-setup problem. Complete M2 remains
broader than this slice; no second data framework or release process is needed.
