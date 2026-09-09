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
| Keep up with changes      | No daily events or portfolio workflow yet                                                                      | Events, holdings, alerts and source-permitted exports                  |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Current release: annual financial screening

The handover release `2f5bab2` completed Cycle 3k-a1 routing. Full local
verification passed (2,570 tests and 9 skips); all five applicable hosted
workflows passed on that exact commit.

The next feature is the first partial Cycle 3k-a2 slice: an explicit **Annual
financial screen** in Discover. It joins six public SEC US-GAAP annual
cross-company frames to the admitted catalog by CIK and supplies seven metrics:
revenue, net income, operating income, operating cash flow, and their three
revenue margins. It supports numerical thresholds, sorting, bounded pages,
coverage counts, source periods, company opening, watchlisting, and 20 saved
criteria definitions.

Source choice is resolved for this bounded slice. See
[SEC annual financial screening](./SEC_ANNUAL_FINANCIAL_SCREENING.md) for the
exact source, setup, limits, formulas and acceptance checklist. One requested
year is retained in server memory for 30 minutes; no per-company fan-out or
raw-source persistence is required. Calendar-aligned annual frames can carry
different fiscal dates and later restatements. Matching dates are required
for ratios. This is neither TTM nor point-in-time screening.

The implementation is a partial delivery, not completion of Cycle 3k-a2:
the 30-core-metric, 500-security, >=90% per-field coverage and independent
validation/performance targets remain open. No actual SEC request or owner
catalog coverage measurement has been recorded for this release. Missing,
conflicting, malformed or failed-source facts remain unknown. A synthetic
engineering result must not be reported as admitted real-market breadth.

Completion requires reviewed code, focused integration tests, the full local
gate on clean source, and applicable hosted checks on the pushed revision.
Record their actual results in the task handoff; this page does not predict
that a release passed.

## Delivery order

| Priority        | Deliverable                                                                                      | Dependency or reason                                                        |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Now             | Deliver and verify seven-metric SEC annual screening                                             | Complete the first numerical discovery workflow                             |
| Next            | Validate configured SEC coverage, then add watchlist dated events                                | Measure actual screening usefulness and add a daily return workflow         |
| Then            | Watchlist earnings/dividend/event view                                                           | Gives the owner a reason to return each day; needs a permitted dated source |
| Then            | Holdings and portfolio overview                                                                  | Reuse identity, local state, and validated pricing                          |
| As inputs allow | Alerts and exports for delivered workflows                                                       | Depend on reliable events, delivery choices, and source permissions         |
| Later           | Historical screening, automated filing breadth, many more filters/models, AI, strategy backtests | Require data and validation absent from the current product                 |

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
   pnpm --filter @research-cockpit/personal-security-master exec vitest run src/personal-security-master-screener.test.ts src/personal-security-master-screener.security.test.ts
   pnpm --filter @research-cockpit/api exec vitest run src/workspace-screener-routes.test.ts
   pnpm --filter @research-cockpit/web exec vitest run src/features/research/PersonalStockScreener.test.tsx src/features/research/SecurityDiscoveryWorkspace.test.tsx
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
After this interrupted closure, a bounded follow-up may replace duplicated
classification with one tested source of truth. Preserve exact historical
evidence checks and explicit non-evidence routes. Do not turn that refactor
into a prerequisite for financial screening unless it blocks its release.

For runtime setup use [the personal workspace instructions](../README.md#personal-discovery-workspace).
No owner secret, provider credential, or private payload belongs in this guide.
