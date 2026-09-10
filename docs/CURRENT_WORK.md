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

## Verified baseline and configured runtime

Release `e7e1ab6` delivered four filing-declared DEI fields beside selected-fact
dates. Its clean native gate passed 4,180 tests and all 24 builds; four applicable
hosted workflows passed. That synthetic acceptance did not establish live coverage.

The owner has now configured SEC contact and an admitted local catalog, initialized
an empty encrypted vault, and signed in. The first real sample made 21 successful
SEC GETs but all five inspections across three documents returned `invalid_document`.
A bounded follow-up pinned the original NVDA bytes and identified the first cause:
an XML declaration specifying ASCII, with an entirely ASCII document. The existing
worker accepted only UTF-8 declarations. Catalog exact-match gaps, including AAPL
and MSFT, remain separate from SEC coverage. Tiingo is still not configured.

## Active delivery: ASCII filing declarations and packaged startup

Partial Cycle 3h-a9 accepts the observed ASCII declaration only when the document
bytes satisfy that encoding. The same bounded worker retains existing source,
namespace, context, numeric and reporting-metadata checks. Unsupported encodings,
malformed declarations and conflicting byte declarations must remain explicit.
The change does not infer fiscal calendars, standalone quarters, revisions or TTM.

The fixed-worker check preserved all five frozen selections and original document
digests. Three NVDA selections and GOOGL now reach analysis, exposing three DEI
labels while dimensional numeric ambiguity and the report-end date transform
remain unsupported. AVGO still fails globally and remains a separate diagnostic
case. All 21 verification GETs returned HTTP 200; no amendment was available in
the retained sample. Preserve these limitations when describing live coverage.

The API build also preserves Node's `node:` import prefix. A bundler default had
rewritten `node:sqlite` into an unresolved package import. Fresh workspace and vault
artifacts now run an isolated startup smoke after bundling and resource copying;
missing configuration must produce the application's controlled failure. No vault,
contact, bootstrap or source request is needed for that check.

Acceptance includes a minimal ASCII declaration reproducer, encoding-conflict and
malformed-declaration controls, the original real-document digest, focused worker
and startup tests, the complete clean-source gate and applicable hosted workflows.
Report exact numeric/metadata outcomes and any later limits separately from the
header fix. A passing first declaration alone does not establish parsing coverage.
Actual release hashes and live outcomes are recorded in the local release handoff;
this page does not predict the final gate result.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Now              | Repair observed ASCII filing parsing and packaged API startup                                    | Unblock verified source inspection and ordinary packaged local startup     |
| Configured next  | Validate live SEC screening coverage and watchlist filing loads                                  | SEC contact and local workspace are ready; retain explicit coverage gaps   |
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
   pnpm --filter @research-cockpit/api exec vitest run src/personal-sec-filing-context-parser.test.ts src/personal-sec-filing-context-provider.test.ts src/workspace-sec-filing-context-routes.test.ts
   pnpm --filter @research-cockpit/web exec vitest run src/lib/personal-sec-filing-context-api.test.ts src/features/research/PersonalSecFilingContext.test.tsx src/features/research/PersonalSecQuarterlyEvidence.test.tsx
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
