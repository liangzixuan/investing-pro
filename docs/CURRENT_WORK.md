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

Release `4309cf0` repairs AVGO's canonical Inline XBRL linking attributes, following
the ASCII declaration and packaged-startup fixes. Its clean native gate passed
4,249 tests and all 24 builds. Four hosted workflows and both platforms passed on
the first attempt. External Chrome desktop, mobile and keyboard checks passed.

The owner has configured SEC contact, an admitted catalog and an encrypted vault.
The source workspace was restored through its existing launcher; post-restart
sign-in is separate from source parsing acceptance. The final live check made 21
successful SEC GETs for the original five selections and three document digests.
NVDA/GOOGL summaries stayed unchanged; AVGO now reaches analysis and exposes its
filing type and fiscal labels. All five numeric selections remain unsupported
because of dimensions. All three documents use the same unsupported report-end
transform. Catalog gaps, including AAPL and MSFT, remain separate. Tiingo is not
configured. Actual runtime/session details are in the local checkpoint.

## Active delivery: filing-declared report-end dates

Partial Cycle 3h-a11 supports the observed `date-monthname-day-year-en` transform
from the exact 2020 registry namespace for `DocumentPeriodEndDate`. This lets the
existing inspector show the filing's canonical report end and its independent
comparison with Submissions. Actual dates of short, long and comparative financial
observations remain unchanged.

The Python worker and a shared Node/browser normalizer implement the specified
month spellings, separators, year expansion, first-month selection and calendar
validity within the existing resource/date bounds. The original text, format,
entity, context and reference remain inspectable. Unknown formats and invalid
inputs remain explicit. Eligible values and proven wrong-issuer exclusions require
independent output recomputation; unresolved or conflicting siblings prevent a
preferred field value. The response shape and acquisition requests do not change.

Acceptance includes real-worker lexical/calendar cases, Node and browser forged-
output controls, mixed scope/uncertainty, reference display and comparison states,
unchanged numeric results and selected periods, and desktop/mobile/keyboard QA.
Freeze the reviewed source before the complete native gate and applicable hosted
checks. A freshly declared live comparison must retain the original selections
and document digests, with earlier results preserved. Record actual outcomes in
the release handoff; this guide does not predict successful live coverage.

Dimensional numeric admission needs separate evidence. This date label does not
establish consolidated scope, a standalone quarter, fiscal calendars, revisions
or TTM. Keep catalog refresh and broader metric coverage independent.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Now              | Decode the observed filing report-end date transform                                             | Show the declared date and compare it independently with Submissions       |
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
