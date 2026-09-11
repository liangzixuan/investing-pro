# Current work

Updated 2026-09-11 following the handover from **Investing Pro+** to
**Investing Pro+ II**. Start here for active priorities. The
[breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md) owns capability targets;
the [build history](./BUILD_ROADMAP.md), exit matrices, and ADRs retain their
historical source and evidence claims.

## Product direction

Build a useful personal investment research application. The owner's priority
is visible product capability: discover a company, understand its financials
and valuation, compare alternatives, and follow what changes. Correctness,
credential protection, and privacy are acceptance requirements. Fix issues
that block those outcomes within the feature; keep enterprise governance and
unrelated hardening outside the active personal scope.

## Current position

| User job                  | Implemented capability                                                                                                                 | Important remaining gap                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                                                                       | Catalog refresh and broader discovery data                    |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications                                           | Wider reconciliation and benchmark-relative analysis          |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                                                            | Verified TTM and the shared 30-core-metric screening registry |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                                                                | Direct normalized FCFF inputs and further justified models    |
| Compare businesses        | Twelve financial checks and up to three manual peers                                                                                   | Compatible multi-company coverage and automatic peer metadata |
| Screen for ideas          | Catalog filters plus eight SEC annual size/profitability metrics, explicit revenue basis, stable pages and encrypted saved definitions | Growth/value inputs and wider verified metric breadth         |
| Keep up with changes      | On-demand recent SEC filings for selected watchlist listings                                                                           | Broader live samples, upcoming events, alerts and exports     |
| Track holdings            | Encrypted ledger, splits, daily values, endpoint/Dietz/linked returns and FIFO                                                         | Further corporate actions, benchmarks and live coverage       |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Verified baseline and configured runtime

Release `b9a2d1d` delivers explicit revenue selection and the bounded Windows
verifier-test repair. Its clean native gate passed 4,487 tests and all 24 builds;
four hosted workflows and both platforms passed. Desktop, mobile, keyboard and
live Walmart acceptance are recorded in the release handoff. These are baseline
results, not validation of later changes.

The configured catalog now contains 3,227 listings, including the six repaired
AAPL, MSFT, AMZN, META, WMT and ORCL entries. Live annual coverage, authenticated
searches, screening/filtering/paging and a bounded AAPL watchlist filing load
were verified on 2026-09-11. The user completed owner sign-in. Actual current
runtime status and acceptance limits remain in the local checkpoint.

The final pinned live comparison completed 21 successful SEC GETs across the
original five selections and three documents. Report ends resolve for NVDA,
GOOGL and AVGO and agree with fresh Submissions. NVDA's comparative observation
retains its older actual period. Numeric summaries and other reporting metadata
are unchanged; all five numeric results remain unsupported because of dimensions.
These results describe only that retained sample. Actual acceptance/runtime
details are in the local checkpoint. Catalog gaps and Tiingo setup remain separate.

## Active delivery: screen on reported gross profit

Add reported `us-gaap:GrossProfit` as the eighth screening metric and seventh
fixed annual source concept. Preserve exact amounts, negative values and explicit
unknowns; do not derive a missing fact from revenue and costs. Revenue-basis
selection and the existing seven fields retain their meanings. The
[annual screening guide](./SEC_ANNUAL_FINANCIAL_SCREENING.md) records the source
definition, compatibility decision and limits.

The request/response transport moves to schema 2.0.0 with exactly eight metrics
and seven sources. Saved payload schema 1, existing criteria, creation digests,
record versions, seven-clause cap and formula version remain unchanged. Old
screening requests must fail before source acquisition; older saved definitions
must still load unchanged and run through the new envelope. API and browser
deployment is coordinated.

Acceptance covers reported-fact/source binding, failure isolation, amount/filter/
coverage/page consistency, revenue-basis independence, old saved definitions and
closed transport decoding. Measure new coverage and reconcile a bounded sample
to exact filings. Complete focused tests, the native gate, applicable hosted
checks and dedicated external Chrome acceptance. Record actual source batches,
snapshots and limits. Defer a gross-margin ratio until its revenue basis is
supported; a matching date alone is insufficient.

Numeric admission, fiscal calendars, standalone quarters, revisions and TTM remain
separate evidence-dependent work. Keep catalog refresh and broader source coverage
independent so these limits do not block unrelated useful product improvements.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Now              | Add reported gross-profit screening while preserving saved-screen meanings                       | Broaden useful screening with one fixed annual source concept              |
| Next independent | Add further financial metrics as verified sources and compatible periods allow                   | Build on measured coverage and retain explicit source gaps                 |
| Next             | Validate filing coverage, calendars, flow basis and revision selection before trailing periods   | Source observations alone do not prove four compatible standalone quarters |
| As sources allow | Upcoming earnings, dividends, and news metadata                                                  | Need separately verified source coverage and entitlement                   |
| As inputs allow  | Alerts and exports for delivered workflows                                                       | Depend on reliable events, delivery choices, and source permissions        |
| Later            | Historical screening, automated filing breadth, many more filters/models, AI, strategy backtests | Require data and validation absent from the current product                |

Preserve the broader roadmap as a backlog. Do not force alphabetic cycle
completion when an independent useful feature can proceed. Refactor only
where the next feature exposes concrete duplication or makes changes risky.

## Working loop

1. Read this page and the relevant feature section. Inspect `git status` and
   the prior task's unfinished work before editing. Write one user outcome,
   the necessary data input, and a short acceptance checklist.
2. Split independent work with explicit file ownership: data/contracts,
   API/UI, and review where useful. Agree on the shared contract first. One
   owner integrates changes and controls the release candidate.
3. During editing, run focused tests and typechecks. From the repository root,
   focused checks for this feature are:

   ```powershell
   pnpm --filter @research-cockpit/personal-financial-analytics exec vitest run src/personal-financial-screener.test.ts
   pnpm --filter @research-cockpit/api exec vitest run src/workspace-financial-screen-routes.test.ts
   pnpm --filter @research-cockpit/web exec vitest run src/lib/personal-financial-screen-api.test.ts src/features/research/PersonalFinancialScreener.test.tsx
   pnpm --filter @research-cockpit/web typecheck
   ```

   If this Windows shell cannot resolve installed tools, use the installed
   Node entrypoints for focused checks, for example
   `node node_modules/vitest/vitest.mjs run <test-path>`. Prepend the root,
   API and web `node_modules/.bin` directories to the current shell's `Path`
   for the complete gate. After workspace dependencies change, refresh the
   pinned install once with `pnpm install --frozen-lockfile`; avoid concurrent
   package installation while agents run tests.

4. Review the final diff, format touched files, and run applicable guardrails.
   Freeze the reviewed source in a clean commit before the full `pnpm verify`:
   the API build deliberately rejects a dirty tree. If any earlier gate fails,
   fix it and rerun the affected checks before the final clean-source gate.
   Do not bypass source identity or remove the full gate to save time.
5. Push only the verified candidate and wait for applicable hosted checks.
   Recheck only changed or failed work during iteration; broaden verification
   when new evidence warrants it. Report actual local and hosted outcomes
   separately. Do not describe a historical passing run as current validation.
6. Keep current status here, capability requirements in the breadth roadmap,
   and detailed acceptance history in its existing records. Finish with a
   short user-perspective TLDR, what was verified, remaining limits, and the
   next product outcome.

The 30 reported-field definitions support selected-company financials; they are
not the shared 30-core screener metric registry or evidence of source coverage.

The repeated feature-specific CI routing edits are a known maintenance cost.
After this feature closure, a bounded follow-up may replace duplicated
classification with one tested source of truth. Preserve exact historical
evidence checks and explicit non-evidence routes. Do not turn that refactor
into a prerequisite for product delivery unless it blocks its release.

For runtime setup use [the personal workspace instructions](../README.md#personal-discovery-workspace).
No owner secret, provider credential, or private payload belongs in this guide.
