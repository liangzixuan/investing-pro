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

| User job                  | Implemented capability                                                                                                         | Important remaining gap                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                                                               | Catalog refresh and broader discovery data                    |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications                                   | Wider reconciliation and benchmark-relative analysis          |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                                                    | Verified TTM and the shared 30-core-metric screening registry |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                                                        | Direct normalized FCFF inputs and further justified models    |
| Compare businesses        | Twelve financial checks and up to three manual peers                                                                           | Compatible multi-company coverage and automatic peer metadata |
| Screen for ideas          | Catalog filters plus eleven SEC annual financial metrics, explicit revenue basis, stable pages and encrypted saved definitions | Growth/value inputs and wider verified metric breadth         |
| Keep up with changes      | On-demand recent SEC filings for selected watchlist listings                                                                   | Broader live samples, upcoming events, alerts and exports     |
| Track holdings            | Encrypted ledger, splits, daily values, endpoint/Dietz/linked returns and FIFO                                                 | Further corporate actions, benchmarks and live coverage       |

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

## Completed local login and runtime isolation

Normal username/password login is accepted and activated at `9edb8cb`. Account
mode has offline initial setup/reset, a salted password verifier separate from
the vault, a standard browser sign-in form and repeatable login after logout,
expiry or API restart. Existing session lifetimes, request boundaries and
private-data clearing remain in place.

The combined workspace selects `RESEARCH_COCKPIT_OWNER_ACCOUNT_FILE` in the API
and `RESEARCH_COCKPIT_WEB_AUTH=account` in the web process. Legacy bootstrap
profiles remain explicit compatibility paths; normal account login never
requires a new bootstrap. See [local owner login](./LOCAL_OWNER_LOGIN.md) for
setup/reset and [ADR 0058](./adr/0058-reusable-local-owner-login.md) for scope.
The configured account setup and Chrome sign-in are complete. The local handoff
retains the login acceptance details and actual runtime state.

Local verification and serving isolation are also complete on that same source
release. The unchanged isolated native gate passed 4,751 tests with nine existing
skips and 24 builds while the serving app stayed available. Five hosted
workflows/six jobs passed for the accepted source. The isolation acceptance is a
local workflow result, not another source release. Edit the main checkout, keep
the serving clone independent, and use a fresh independent clone for full-gate
verification. The local checkpoint owns launcher, selection and rollback details.

## Completed release-classification automation

The generator is accepted at `84e0c0d`: 4,837 native tests passed with nine
existing skips and 24 builds; four applicable hosted workflows/five jobs passed,
including Windows and Ubuntu, on attempt 1. One reviewed descriptor prepares
eight routing adapters plus a registry entry, preserving exact historical
identities and inventories. The [release-classification guide](./RELEASE_CLASSIFICATION.md)
owns the contract and check/write sequence. Use it for ordinary feature releases;
the local handoff records actual verification and the separately attributed
historical failures.

## Active delivery: Gross profit / selected revenue (%)

Add the eleventh annual metric using the existing eight-frame SEC snapshot.
Filter, sort, inspect and save the ratio against the explicitly chosen revenue
basis; omission retains agreement. Preserve reported gross profit independently.
All operand references must share annual dates and filing accession. The visible
label identifies the app calculation and does not claim a company-reported or
sector-comparable gross margin.

Acceptance covers exact decimal arithmetic and browser verification, source and
reason integrity, unchanged old metrics/saved definitions, and eight reads with
cache reuse across basis choices. Deploy the coordinated v4 API/browser after
native and hosted gates, then verify live coverage and bounded filing samples.
Actual release and runtime results remain in the local checkpoint; see
[annual financial screening](./SEC_ANNUAL_FINANCIAL_SCREENING.md) for semantics.

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

**PP&E purchases (USD)** and **Operating cash flow less PP&E purchases (USD)**
are available in annual filters, sorting and saved definitions. The PP&E input
uses only the standard `PaymentsToAcquirePropertyPlantAndEquipment` source,
bringing the load to eight fixed frames. Accepted full-catalog coverage and
bounded primary-filing checks remain in the local PP&E handoff.

Exact decimal subtraction requires both inputs to be available and their actual
annual dates and filing accession to match. A negative reported PP&E amount
remains inspectable but leaves the derived amount unknown. Negative operating
cash flow and negative results are supported. Missingness, source-failure
isolation, revenue-basis independence and all input references are preserved.

That PP&E release used transport version 3.0.0 and screen formula-set version
1.1.0; the current ratio slice advances the screen transport and formula set as
described above. Existing saved-definition payloads remain
numeric version 1, preserving identities, creation digests and conflict handling.
The [annual screening guide](./SEC_ANNUAL_FINANCIAL_SCREENING.md) owns the final
behavior and limits. Do not repeat the accepted PP&E gates or historical SEC
loads as part of the release-classification work.

Numeric admission, fiscal calendars, standalone quarters, revisions and TTM remain
separate evidence-dependent work. Keep catalog refresh and broader source coverage
independent so these limits do not block unrelated useful product improvements.

## Delivery order

| Priority         | Deliverable                                                                                      | Dependency or reason                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Now              | Screen Gross profit / selected revenue (%) from the existing annual snapshot                     | Add useful ratio breadth with explicit denominator and filing compatibility |
| Next independent | Add further financial metrics as verified sources and compatible periods allow                   | Build on measured coverage and retain explicit source gaps                  |
| Next             | Validate filing coverage, calendars, flow basis and revision selection before trailing periods   | Source observations alone do not prove four compatible standalone quarters  |
| As sources allow | Upcoming earnings, dividends, and news metadata                                                  | Need separately verified source coverage and entitlement                    |
| As inputs allow  | Alerts and exports for delivered workflows                                                       | Depend on reliable events, delivery choices, and source permissions         |
| Later            | Historical screening, automated filing breadth, many more filters/models, AI, strategy backtests | Require data and validation absent from the current product                 |

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
   focused checks for this feature include:

   ```powershell
   pnpm --filter @research-cockpit/personal-financial-analytics test -- personal-financial-screener
   pnpm --filter @research-cockpit/api test -- workspace-financial-screen-routes personal-sec-financial-provider
   pnpm --filter @research-cockpit/web test -- personal-financial-screen-api PersonalFinancialScreener
   ```

   If this Windows shell cannot resolve installed tools, use the installed
   Node entrypoints for focused checks, for example
   `node node_modules/vitest/vitest.mjs run <test-path>`. Prepend the root,
   API and web `node_modules/.bin` directories to the current shell's `Path`
   for the complete gate. After workspace dependencies change, refresh the
   pinned install once with `pnpm install --frozen-lockfile`; avoid concurrent
   package installation while agents run tests.

4. Review the final diff, format touched files, and run applicable guardrails.
   Use the release-classification guide for the separate feature and routing
   closure commits. Freeze the reviewed candidate before the full `pnpm verify`
   in a fresh independent verification clone; the API build deliberately rejects
   a dirty tree. Keep the serving clone running separately. If an earlier gate
   fails, fix it and rerun the affected checks before the final clean-source
   gate. Do not bypass source identity or remove the full gate to save time.
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

The accepted generator reduces release-maintenance duplication. Keep its scope
to the existing classification adapters while delivering visible financial capability.

For runtime setup use [the personal workspace instructions](../README.md#personal-discovery-workspace).
No owner secret, provider credential, or private payload belongs in this guide.
