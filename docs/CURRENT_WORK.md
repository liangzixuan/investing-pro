# Current work

Updated 2026-09-09 during the handover from **Investing Pro+** to
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

| User job                  | Implemented capability                                                                                         | Important remaining gap                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                                               | Catalog refresh and broader discovery data                             |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications                   | Wider reconciliation and benchmark-relative analysis                   |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                                    | Verified TTM and the shared 30-core-metric screening registry          |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                                        | Direct normalized FCFF inputs and further justified models             |
| Compare businesses        | Twelve financial checks and up to three manual peers                                                           | Compatible multi-company coverage and automatic peer metadata          |
| Screen for ideas          | Catalog filters plus seven SEC annual size/profitability metrics, stable pages and encrypted saved definitions | Live coverage validation, growth/value inputs and wider metric breadth |
| Keep up with changes      | On-demand recent SEC filings for selected watchlist listings                                                   | Live validation, upcoming events, alerts and exports                   |
| Track holdings            | Encrypted snapshot/ledger, splits, daily historical values, allocation and FIFO estimates                      | Percentage returns, further corporate actions and live coverage        |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Last verified release: split reconciliation and history coverage

Release `4381ee3` closed manual splits and historical-price coverage, following
feature `2688fdf`. Full local verification passed (3,241 tests and 9 existing
skips); all four applicable hosted workflows passed on attempt 1 for that exact
release, including Ubuntu and Windows CI. See
[split and history rules](./PERSONAL_PORTFOLIO_CORPORATE_ACTIONS.md).

The earlier SEC annual screen and watchlist filings slices remain available.
Their live coverage validation still depends on the owner's configured sources.

## Active delivery: historical portfolio valuation

The next partial Cycle 3m-a slice reuses EOD history to value recorded daily
holdings and cash. It makes unavailable dates explicit and compares the first
and last complete observations after recorded deposits and withdrawals.
Percentage returns remain separate. See
[historical valuation rules](./PERSONAL_PORTFOLIO_VALUATION_HISTORY.md).

Live SEC validation still requires the owner's contact and startup configuration.
The current shell has neither the SEC contact nor the configured catalog path
and digest. This dependency does not prevent completing synthetic engineering
validation of the next independently useful feature.

Completion requires reviewed code, focused integration tests, the full local
gate on clean source, and applicable hosted checks on the pushed revision.
Record actual results in the task handoff; this page does not predict a pass.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Now              | Deliver and verify historical portfolio valuation                                                | Reuse reconciled activities and exact observations                       |
| When configured  | Validate live SEC screening coverage and watchlist filing loads                                  | Requires owner contact and existing startup configuration                |
| Next             | Endpoint percentage returns for intervals without deposits or withdrawals                        | Require complete endpoints, positive starting value and flow eligibility |
| As sources allow | Upcoming earnings, dividends, and news metadata                                                  | Need separately verified source coverage and entitlement                 |
| As inputs allow  | Alerts and exports for delivered workflows                                                       | Depend on reliable events, delivery choices, and source permissions      |
| Later            | Historical screening, automated filing breadth, many more filters/models, AI, strategy backtests | Require data and validation absent from the current product              |

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
   examples for this feature are:

   ```powershell
   pnpm --filter @research-cockpit/api exec vitest run src/workspace-portfolio-routes.test.ts src/workspace-static-graph.test.ts
   pnpm --filter @research-cockpit/web exec vitest run src/lib/personal-portfolio-api.test.ts src/lib/personal-portfolio-ledger-csv.test.ts src/features/research/PersonalPortfolio.test.tsx src/features/research/PersonalPortfolioLedgerEditor.test.tsx src/features/research/SecurityDiscoveryWorkspace.test.tsx
   pnpm --filter @research-cockpit/contracts exec vitest run src/personal-portfolio-ledger.test.ts
   pnpm --filter @research-cockpit/personal-market-analytics exec vitest run src/personal-portfolio-overview.test.ts
   pnpm --filter @research-cockpit/api --filter @research-cockpit/web typecheck
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

The repeated feature-specific CI routing edits are a known maintenance cost.
After this feature closure, a bounded follow-up may replace duplicated
classification with one tested source of truth. Preserve exact historical
evidence checks and explicit non-evidence routes. Do not turn that refactor
into a prerequisite for product delivery unless it blocks its release.

For runtime setup use [the personal workspace instructions](../README.md#personal-discovery-workspace).
No owner secret, provider credential, or private payload belongs in this guide.
