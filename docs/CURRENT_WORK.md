# Current work

Updated 2026-09-14 following the handover from **Investing Pro+** to
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

| User job                  | Implemented capability                                                                                                      | Important remaining gap                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                                                            | Catalog refresh and broader discovery data                    |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications                                | Wider reconciliation and benchmark-relative analysis          |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                                                 | Verified TTM and the shared 30-core-metric screening registry |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                                                     | Direct normalized FCFF inputs and further justified models    |
| Compare businesses        | Twelve financial checks and up to three manual peers                                                                        | Compatible multi-company coverage and automatic peer metadata |
| Screen for ideas          | Catalog filters plus ten SEC annual financial metrics, explicit revenue basis, stable pages and encrypted saved definitions | Growth/value inputs and wider verified metric breadth         |
| Keep up with changes      | On-demand recent SEC filings for selected watchlist listings                                                                | Broader live samples, upcoming events, alerts and exports     |
| Track holdings            | Encrypted ledger, splits, daily values, endpoint/Dietz/linked returns and FIFO                                              | Further corporate actions, benchmarks and live coverage       |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Verified baseline and configured runtime

Release `0b271f9` delivers reported gross-profit screening and preserves explicit
revenue selection. Its clean native gate passed 4,557 tests and all 24 builds;
five hosted workflows passed, including Windows on its single unchanged-code
retry. Configured Chrome acceptance covered exact Apple source details, Walmart
missingness, filtering, page return and revenue-basis independence. These are
baseline results, not validation of later changes; detailed receipts and limits
remain in the local release handoff.

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

## Active delivery: normal local owner login

The owner requested replacing the repeated one-time bootstrap with a persistent
username and password. This takes priority over isolated build validation and
release-generator work. Account mode now has offline initial setup/reset, a
salted password verifier separate from the vault, a standard browser sign-in
form and repeatable login after logout, expiry or API restart. Existing session
lifetimes, request boundaries and private-data clearing remain in place.

The combined workspace selects `RESEARCH_COCKPIT_OWNER_ACCOUNT_FILE` in the API
and `RESEARCH_COCKPIT_WEB_AUTH=account` in the web process. Legacy bootstrap
profiles remain explicit compatibility paths; normal account login never
requires a new bootstrap. See [local owner login](./LOCAL_OWNER_LOGIN.md) for
setup/reset and [ADR 0058](./adr/0058-reusable-local-owner-login.md) for scope.
The local handoff records actual acceptance and whether the owner has completed
the one-time account setup; do not claim configured sign-in before that occurs.

Acceptance covers real password hashing and file permissions, malformed login
boundaries, wrong credentials, throttling, concurrent requests, logout/expiry
and restart, preserved existing vault data, masked CLI input, and browser
autofill semantics. Complete focused checks, source review, the clean native
gate and applicable hosted checks. Do not rerun historical SEC loads.

## Latest financial delivery: screen cash generation after PP&E purchases

The PP&E release is accepted at `8810d99`: 4,695 native tests passed with nine
existing skips and 24 builds; five hosted workflows/six jobs passed. Configured
browser and source coverage checks are recorded in the local PP&E handoff.
The following describes that completed product slice, not another pending gate.

Release `08e72eb` completes browser session activity for successful Run, Refresh
and page requests. Its native gate passed 4,592 tests and 24 builds, synthetic
React browser acceptance passed, and all five applicable hosted workflows passed.
The existing idle and absolute deadlines remain unchanged. These are completed
baseline results; do not repeat their release checks for the next feature.

Add **PP&E purchases (USD)** and **Operating cash flow less PP&E purchases (USD)**
to annual filters, sorting and saved definitions. Use only the standard
`PaymentsToAcquirePropertyPlantAndEquipment` source, adding one fixed request to
the existing seven-frame load. Verify current full-catalog coverage and a small
primary-filing sample before accepting the feature.

Subtract exact decimal amounts only when both inputs are available and their
actual annual dates and filing accession match. Keep reported signs: a negative
PP&E amount remains inspectable but leaves the derived amount unknown. Negative
operating cash flow and negative results are supported. Preserve missingness,
source-failure isolation, revenue-basis independence and all input references.

Coordinate the expanded metric/source sets through strict transport version 3.0.0
and screen formula-set version 1.1.0. Existing saved-definition payloads remain
numeric version 1, preserving identities, creation digests and conflict handling.
The [annual screening guide](./SEC_ANNUAL_FINANCIAL_SCREENING.md) owns the final
behavior and limits. Complete focused arithmetic, transport and UI checks,
configured browser acceptance, then native and applicable hosted release gates.

Numeric admission, fiscal calendars, standalone quarters, revisions and TTM remain
separate evidence-dependent work. Keep catalog refresh and broader source coverage
independent so these limits do not block unrelated useful product improvements.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Now              | Add PP&E purchases and operating cash flow less PP&E purchases                                   | Verify exact source coverage, compatible dates and filing provenance       |
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
   pnpm --filter @research-cockpit/api exec vitest run src/personal-sec-financial-provider.test.ts src/personal-sec-request-scheduler.test.ts src/workspace-financial-screen-routes.test.ts
   pnpm --filter @research-cockpit/web exec vitest run src/features/research/PersonalFinancialScreener.test.tsx src/lib/personal-financial-screen-api.test.ts
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
