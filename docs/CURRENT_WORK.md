# Current work

Updated 2026-09-10 following the handover from **Investing Pro+** to
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
| Track holdings            | Encrypted ledger, splits, daily values, endpoint/Dietz/linked returns and FIFO                                 | Further corporate actions, benchmarks and live coverage                |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Last verified release: SEC quarterly evidence

Release `14002d4` closed the selected-company SEC evidence view, following
feature `6e6bef9`. Full local verification passed:
3,760 Vitest tests plus 10 Node-runner tests, with 9 existing skips. All five
hosted workflows, including Windows and Ubuntu CI, passed on attempt 1 for that
exact release. Desktop/mobile external Chrome QA and independent reviews passed.
The source view preserves exact USD observations, dated periods, concepts and
filing joins, with bounded loading and shared SEC request pacing. It leaves
fiscal-quarter classification, revision selection and TTM unresolved. See
[SEC quarterly evidence](./PERSONAL_SEC_QUARTERLY_EVIDENCE.md).

The earlier SEC annual screen and watchlist filings slices remain available.
Their live coverage validation still depends on the owner's configured sources.

## Active delivery: compare SEC observations for the same period

Partial Cycle 3h-a6 adds an explicit comparison for a selected loaded observation.
It groups only exact metric, taxonomy, concept, USD unit and known start/end dates
within one issuer response. It shows retained values and filing references, with
separate counts for observations, accessions and values. Different reported
values within one accession remain visible. All comparison actions use loaded
data; no additional source requests or revision operands are introduced.

Acceptance requires lossless comparisons, separate aliases and durations, an
explicit missing-period state, complete use of retained observations across
table pages, and coverage limits visible with the result. Refresh, cancel and
selection/catalog/session changes clear the comparison. Verify desktop/mobile
layout and keyboard access, then complete local and exact-revision hosted gates.

Filing-context inspection follows as its own parser/acquisition slice. The
existing raw extractor requires a fixed annual ten-fact input and does not
preserve the context/entity evidence needed for quarterly correspondence. Keep
that annual contract stable while adding the narrower quarterly projection.

Live SEC validation still requires the owner's contact and startup configuration.
The last verified release found neither the SEC contact nor the configured
catalog path and digest in its shell. This dependency does not prevent synthetic engineering
validation of the next independently useful feature.

Completion requires reviewed code, focused integration tests, the full local
gate on clean source, and applicable hosted checks on the pushed revision.
Record actual results in the task handoff; this page does not predict a pass.

## Delivery order

| Priority         | Deliverable                                                                                        | Dependency or reason                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Now              | Compare retained SEC observations for exactly the same concept and period                          | Make reported-value differences inspectable without assigning revisions    |
| When configured  | Validate live SEC screening coverage and watchlist filing loads                                    | Requires owner contact and existing startup configuration                  |
| Next             | Inspect selected filing contexts, then validate calendars, revision selection and trailing periods | Source observations alone do not prove four compatible standalone quarters |
| As sources allow | Upcoming earnings, dividends, and news metadata                                                    | Need separately verified source coverage and entitlement                   |
| As inputs allow  | Alerts and exports for delivered workflows                                                         | Depend on reliable events, delivery choices, and source permissions        |
| Later            | Historical screening, automated filing breadth, many more filters/models, AI, strategy backtests   | Require data and validation absent from the current product                |

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
   pnpm --filter @research-cockpit/web exec vitest run src/lib/personal-sec-quarterly-comparison.test.ts src/lib/personal-sec-quarterly-evidence-api.test.ts src/features/research/PersonalSecQuarterlyEvidence.test.tsx src/features/research/SecurityDiscoveryWorkspace.test.tsx
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

The repeated feature-specific CI routing edits are a known maintenance cost.
After this feature closure, a bounded follow-up may replace duplicated
classification with one tested source of truth. Preserve exact historical
evidence checks and explicit non-evidence routes. Do not turn that refactor
into a prerequisite for product delivery unless it blocks its release.

For runtime setup use [the personal workspace instructions](../README.md#personal-discovery-workspace).
No owner secret, provider credential, or private payload belongs in this guide.
