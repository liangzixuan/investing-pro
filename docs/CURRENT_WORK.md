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

| User job                  | Implemented capability                                                                       | Important remaining gap                                       |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                             | Catalog refresh and broader discovery data                    |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications | Wider reconciliation and benchmark-relative analysis          |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                  | Verified TTM and the shared 30-core-metric screening registry |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                      | Direct normalized FCFF inputs and further justified models    |
| Compare businesses        | Twelve financial checks and up to three manual peers                                         | Compatible multi-company coverage and automatic peer metadata |
| Screen for ideas          | Whole-catalog identity filters, columns, stable pages, encrypted saved definitions           | Numerical financial filters over a permitted bulk snapshot    |
| Keep up with changes      | No daily events or portfolio workflow yet                                                    | Events, holdings, alerts and source-permitted exports         |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Handover and current release

The interrupted task left feature commit `5dd44ac` (Cycle 3k-a1 catalog
screener), directly following `fa63a5d`, plus six partially edited release
routing files. The inherited feature was recorded as locally tested and built
in that task; this handover must verify the finished candidate independently.

This release completes that routing and its regression tests, and adds this
current-work guide and roadmap navigation. The routing is non-evidence:
historical filing acceptance is not promoted onto new product commits.
Completion requires a clean source commit, a successful full local gate,
and successful applicable hosted workflows on the pushed revision. Use the
actual command results and hosted run records to determine status; the
presence of this document does not assert a green release.

## Next deliverable: financial screening

**User outcome:** run a numerical value, quality, or growth screen across a
declared current set of companies, inspect why each company matches, then open
it or add it to My Watchlist.

Deliver the data and the visible filters together as the first useful slice
of Cycle 3k-a2:

1. Confirm an exact source/product that permits bounded multi-company access.
   Record endpoint or export, entitlement, timestamps, attribution, allowed
   retention, request limits, and field definitions. Existing per-company
   access is not proof of bulk access. Do not fan the company routes across
   the catalog. This source choice remains unresolved.
2. Map available inputs to shared, versioned metrics already used by company
   and peer views. Start with a small useful set of value, quality, and growth
   predicates. Thirty reported statement fields are not thirty analytical
   screening metrics. Leave TTM unavailable until quarter-flow semantics are
   verified.
3. Build one bounded current snapshot with exact listing identities, field
   units and periods, source times, and coverage counts. Honor the selected
   source's storage rules. Do not introduce persistence or historical replay
   claims when retention is unavailable.
4. Extend the existing query engine, columns, pagination, and saved-definition
   versioning. Numeric comparisons must distinguish match, non-match, and
   unknown; a missing value must never become zero or pass a threshold.
5. Demonstrate end to end: run filters, explain matching values and unknown
   counts, save/reload criteria, rerun after a snapshot change, and open or
   watchlist a result. Cover stale inputs, partial provider failure, and
   incompatible period/unit cases with focused regression tests.

A smaller declared cohort and metric set may ship as a partial slice. Full
3k-a2 and 3h breadth stay open until the roadmap's 30-core-metric,
500-security, coverage, independent-validation, and performance targets are
actually met. Default starter screens still require their declared coverage;
thin data does not justify presenting an empty preset as a completed feature.

If the bulk source cannot be resolved, record the exact missing capability
and move to an independently deliverable daily event/calendar slice using a
verified permitted source. Do not spend repeated milestones on generic
provider scaffolding while the source question remains unanswered.

## Delivery order

| Priority        | Deliverable                                                                                      | Dependency or reason                                                        |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Now             | Close and verify the existing catalog-screener release                                           | Finish the interrupted user-visible milestone                               |
| Next            | Current financial snapshot plus useful numerical screening                                       | Unlocks idea discovery and later peer coverage                              |
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

   If this Windows shell cannot resolve installed tools such as Prettier,
   prepend the repository's `node_modules/.bin` to the current shell's `Path`
   and use `corepack pnpm`. This fixes the observed command-resolution issue
   without reinstalling dependencies or changing machine-wide settings.

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
