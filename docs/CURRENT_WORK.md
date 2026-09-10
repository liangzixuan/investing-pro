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

Release `fe04a47` repaired ASCII filing declarations and packaged API startup.
Its clean native gate passed 4,221 tests and all 24 builds; four applicable hosted
workflows passed. Windows needed one unchanged retry after an existing database
test timed out. The original failure and retry remain in the release handoff.

The owner has now configured SEC contact and an admitted local catalog, initialized
an empty encrypted vault, and signed in. The first real sample made 21 successful
SEC GETs but all five inspections across three documents returned `invalid_document`.
A pinned-digest declaration repair lets the three NVDA selections and GOOGL reach
analysis, with dimensional values and the report-date transform still unsupported.
AVGO remained globally unavailable. Its next bounded diagnosis reproduced the same
document and found canonical `fromRefs` on an Inline XBRL 2013 `relationship`
element rejected by an incomplete attribute-casing map. Catalog exact-match gaps,
including AAPL and MSFT, remain separate from SEC coverage. Tiingo is not configured.

## Active delivery: canonical Inline XBRL linking attributes

Partial Cycle 3h-a10 recognizes canonical casing for the standard linking/footnote
attributes on their specified Inline XBRL namespace and element. The current
six-name map covers fact references but misses `fromRefs`, `toRefs`, `linkRole`,
`footnoteID`, `footnoteLinkRole` and `footnoteRole`. The observed `fromRefs` failure
occurs before any selected-value analysis, including on otherwise ignored markup.

Scope the additional names to the 2013 `relationship`, 2013 `footnote` and 2008
`footnote` elements. Preserve malformed casing, duplicate attributes, unquoted
semantic attributes and wrong-scope rejection. Traversing these elements does not
resolve their links, consume footnotes as facts, or expand numeric/DEI eligibility.
Dimensions, transforms, continuations, fiscal calendars, flow basis and TTM remain
separate. The ASCII declaration and packaged-startup checks remain in place.

The original five-case live sample and every failed baseline remain preserved.
The first AVGO diagnostic made five successful GETs and identified the exact
failure site; a separately declared five-GET discriminator identified the canonical
attribute using fixed enums. The reviewed candidate, checked on those same bytes
without another acquisition, reaches 72 numeric candidates and three filing labels
(10-Q, FY2026 and Q3). Numeric comparison remains unsupported because of dimensions;
report end remains unresolved. The original failed result is preserved separately.
Record final live and release outcomes in the handoff; this sample does not
establish general filing coverage.

Acceptance includes canonical linking/footnote cases, their wrong-case and
wrong-namespace/element controls, unchanged selected-value and metadata limits,
the original AVGO digest, focused worker checks, the complete clean-source gate
and applicable hosted workflows. Report numeric/metadata outcomes and any later
rejections separately from the corrected first failure.
Actual release hashes and live outcomes are recorded in the local release handoff;
this page does not predict the final gate result.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Now              | Repair the observed canonical Inline XBRL attribute rejection                                    | Let valid linking markup reach the existing bounded analysis               |
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
