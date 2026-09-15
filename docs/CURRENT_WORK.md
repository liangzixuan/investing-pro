# Current work

Updated 2026-09-15 following the handover from **Investing Pro+** to
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

## Immediate delivery: temporary local access

The owner requested disabling login to remove repeated browser sign-in blockers.
Add an explicit, reversible local-access mode to the combined workspace: the
API verifies existing loopback and request boundaries without requiring a
session, and the web page probes that mode before loading private views. Keep
account mode unchanged, the saved account intact and the existing vault encrypted.
The configured launcher selects this mode across restarts and can restore normal
account login. See [local owner login](./LOCAL_OWNER_LOGIN.md).

Starter-screen release `a6990c3` passed its native and applicable hosted gates and
is serving. Its desktop/mobile browser acceptance remains pending; complete that
acceptance after activating local access. Local-access implementation and release
verification are in progress; the workspace checkpoint records actual outcomes.

## Current position

| User job                  | Implemented capability                                                                                                                      | Important remaining gap                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                                                                            | Catalog refresh and broader discovery data                            |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications                                                | Wider reconciliation and benchmark-relative analysis                  |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                                                                 | Verified TTM and the shared 30-core-metric screening registry         |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                                                                     | Direct normalized FCFF inputs and further justified models            |
| Compare businesses        | Twelve financial checks and up to three manual peers                                                                                        | Compatible multi-company coverage and automatic peer metadata         |
| Screen for ideas          | Sixteen SEC financial fields, source inspection, three editable starter screens, explicit revenue basis, stable pages and saved definitions | Validate starter-screen interaction; broader verified metric coverage |
| Keep up with changes      | On-demand recent SEC filings for selected watchlist listings                                                                                | Broader live samples, upcoming events, alerts and exports             |
| Track holdings            | Encrypted ledger, splits, daily values, endpoint/Dietz/linked returns and FIFO                                                              | Further corporate actions, benchmarks and live coverage               |

These are bounded implemented features, not complete Investing.com Pro+ parity.
The selected-company provider payloads remain in session memory. A catalog
entry does not establish financial-data coverage or a source entitlement.

## Verified baseline and configured runtime

Accepted baseline `37ad3d7` includes selected revenue YoY and correct mobile
focus restoration after closing source details. Native acceptance passed 5,385
checks with nine existing skips and 24 builds. Four applicable hosted workflows/
five distinct jobs passed, with one unchanged Windows retry after two vault-route
timeouts; the original failure remains recorded. Configured desktop/mobile
Chrome QA is complete. Financial sources inherit `41d9994`'s thirteen-Frame
coverage and primary-filing evidence with their original dates and limits.
Future browser work uses external Brave, as selected by the owner.

The configured catalog contains **3,227 listings**. Normal account login is
accepted, and the serving app runs from an isolated release checkout while
implementation and full-gate verification use separate checkouts. Preserve that
serving runtime through new-source verification. The workspace `CURRENT.md`
and local release handoff own the exact active release, process identities,
selection/rollback details, source observations and retained failure evidence.
Historical release counts and earlier samples remain in their guides/handoffs.

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

## Active delivery: three editable financial starter screens

The next partial Cycle 3k-c delivery turns existing fields into three sparse,
illustrative starting points. Applying a starter replaces numeric filters, sort
and visible financial columns, while preserving the selected calendar year,
revenue basis and company identity filter. The user edits ordinary criteria and
explicitly chooses Run; applying a starter performs no fetch, save or owner
activity refresh. It clears old results/source inspection and invalidates any
older in-flight screen response.

- **Growth with cash after PP&E:** selected revenue YoY change at least 5%, and
  operating cash flow less PP&E purchases at least USD 0. Sort growth descending;
  show revenue, operating cash flow, PP&E purchases, their cash difference and
  revenue change. Each metric retains its own admitted actual periods; the
  conjunction does not prove a common period across both metrics.
- **Cash flow relative to income:** operating cash flow / net income at least
  100%, using the existing positive-income and same-period/filing requirements.
  Sort that ratio descending and show both operands and the ratio.
- **Q4 liquidity cover:** current assets / current liabilities at least 1.00×,
  with the existing nonnegative-asset, positive-liability, same-date/filing and
  Q4 date rules. Sort that ratio descending and show both balances and the ratio.

These are editable examples, not recommendations or universal industry tests.
Label them sparse: per-field coverage and three-valued query counts do not
establish joint input eligibility or the roadmap's full coverage threshold.
Selecting a starter detaches any selected saved view and clears the draft name;
an existing record remains unchanged. Saving uses ordinary criteria payload v1
after an explicit Run, without a template ID or persisted column preference.

Acceptance covers each example's literal clauses/sort/columns; preserved context;
editable thresholds; no fetch/write on Apply; stale result/inspection/request
invalidation; saved-view isolation and a saved-v1 round trip; and keyboard/mobile
interaction. Financial engine, provider, decoder, contracts and formula versions
stay unchanged. Keep prior source observations attributed to their original
release rather than rerunning acquisition for this presentation change. The
workspace checkpoint owns actual release verification and configured Brave QA.

## Completed delivery: selected revenue YoY change

Implemented **Selected revenue YoY change (%)** as the sixteenth metric, with signed
filters, sorting, saved criteria and exact current/prior source inspection.
Resolve the same selected revenue basis independently in two adjacent supported
annual periods. Require unchanged concept sets, positive prior revenue and one
filing within each year; the two years may have different accessions. Preserve
unknown reasons and every retained source, and leave existing fifteen metrics
unchanged when prior revenue is missing or fails.

Transport v7/formula-set1.5 adds three prior-revenue Frames to the existing ten,
with one bounded snapshot/cache. Saved definitions remain version1. Selected
2009 still works: missing derived2008 revenue affects growth only. Existing
Overview/Profitability/Cash flow/Q4 presets retain their memberships; choose
the new field individually or through All metrics.

Release `41d9994` passed the isolated native gate (5,381 checks, nine existing
skips, 24 builds) and all five applicable hosted workflows/six jobs. Its dated
thirteen-Frame production coverage found 2,009 eligible agreement listings /
1,997 issuers from 3,227 listings/3,209 issuers. Three primary filings corroborated
eight exact annual operands, including WMT's conflicting revenue definitions.
These observations do not establish unchanged business or accounting scope.

Configured Chrome confirmed live sources, signed thresholds, both sort
directions, cache/paging, preserved column choices and unknown explanations.
The 390px check found that closing the tall source inspector could focus a value
above the viewport: focus ran before React removed the panel. The follow-up
commits panel removal before returning focus and rechecks the target afterward.
Automatic result, criteria and session invalidation still clears inspection
without restoring stale focus. The correction passed its native/hosted gates and
all four configured 390px Close/Escape cases at `37ad3d7`. Financial semantics
and source receipts are inherited unchanged; the workspace checkpoint retains
actual observations, the Windows retry and source/runtime pins.

## Completed delivery: readable financial screen results

The accepted screen provides Overview, Profitability, Cash flow, Q4 balances
and All metrics views with individual column selection. Company identity stays
visible during horizontal scrolling. Value buttons open one wide, named source inspector outside the table,
with exact values, actual periods or balance dates, unknown explanations and all
retained filing references. Keyboard opening, closing and focus restoration are
verified in configured desktop/mobile Chrome.

Column choices affect presentation only. Every numeric criterion still applies;
show the applied filters and sort even when their fields are hidden. Keep column
choices through reruns and paging, but clear them at owner/catalog boundaries.
Clear source inspection whenever its result or view changes. Do not add provider
reads, change formulas, alter cached snapshots or extend saved criteria v1.

Focused checks, generated closure, isolated native/applicable hosted gates and
configured Chrome QA passed at `9405f38`. Financial source code is inherited
from `30c788b`; this presentation change makes no fresh full-catalog data claim.

## Completed delivery: Q4 current balances and current ratio

The screen's **Current assets**, **Current liabilities**, and
**Current assets / current liabilities (×)** are accepted at `30c788b`. They use
two typed instant inputs beside the unchanged twelve annual metrics. The selected completed year fixes
the two new sources to its Q4 instant Frame; only actual balance dates from
October 1–December 31 inclusive qualify. This is an app date rule, not a
published SEC tolerance or an exact common fiscal year-end. Keep out-of-window
source references inspectable and distinguish these balances from annual flows
and other views' latest-fiscal-year selections.

Use nonnegative assets, positive liabilities, and an exact shared balance date
and accession across every retained reference. Preserve raw signed balances,
unknown reasons, exact two-decimal multiples, all revenue bases and saved payload
version 1. Coordinated transport v6/formula-set 1.4 adds fifteen metric keys and
ten source concepts. Ten fixed initial/refresh reads reuse one cached snapshot;
paging and basis changes add none.

Fresh production coverage found 2,319 eligible listings / 2,303 issuers out of
3,227 listings, with 908 unknown ratios: 706 missing, 198 outside the app date
window and four filing mismatches. Seventy-two scenarios and 633 decoder pages
preserved all twelve annual metrics across all four revenue bases. Two primary
filings corroborated Apple's 0.97× and Walmart's retained out-of-window balances;
Walmart's ratio remains unknown. These are snapshot-specific observations, not
guarantees for subsequent source reads. The local checkpoint owns exact source/runtime state;
the [screening guide](./SEC_ANNUAL_FINANCIAL_SCREENING.md) owns metric semantics.

## Completed delivery: Operating cash flow / net income (%)

The twelfth annual metric and its targeted ACL integration fixes are accepted at
`beb991c`: 5,086 Vitest plus 10 Node worker passes, nine existing skips, 24 builds
and 184 healthy samples. Hosted acceptance, unchanged-source Windows retry,
coordinated activation and configured Chrome acceptance are complete. Live
eight-Frame and two-filing evidence remains attributed to the unchanged financial
source at `163abc3`; failure evidence and scope limits remain in the local handoff.
Do not reopen the completed ACL mitigation without a new concrete failure.

The twelfth annual metric uses the existing eight annual SEC inputs.
Filter, sort, inspect and save operating cash flow relative to positive reported
net income. Every operand reference must share actual supported annual dates and
one filing accession. Preserve signed operating cash flow and both reported
inputs; zero or negative net income leaves the ratio unknown. Revenue-basis
selection does not change this calculation. The explicit label identifies an
app calculation, not a company-reported cash-conversion measure or quality score.

Its acceptance covered exact decimal arithmetic and browser verification, source
and reason integrity, unchanged old metrics/saved definitions, and eight reads
with cache reuse across basis choices on its original coordinated v5 release.
Actual release and runtime results remain in the local checkpoint; see
[annual financial screening](./SEC_ANNUAL_FINANCIAL_SCREENING.md) for semantics.

Gross profit / selected revenue (%) is accepted at `12ef061`: 4,938 native tests,
nine existing skips, 24 builds and all four applicable hosted workflows/five jobs
passed. Fresh eight-frame coverage and bounded filing comparisons passed, followed
by configured Chrome acceptance and coordinated activation. The ratio was known
for 1,188 of 3,227 listings under the default agreement policy. These historical
results do not establish coverage or validation of the new net-income ratio;
the local release handoff retains the exact source, basis and observation limits.

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

| Priority         | Deliverable                                                                                      | Dependency or reason                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Now              | Deliver three editable starter screens using existing financial fields                           | Reuse verified metrics, explicit Run and saved-v1 semantics; label sparse coverage |
| Next independent | Add further financial metrics as verified sources and compatible periods allow                   | Build on measured coverage and retain explicit source gaps                         |
| Next             | Validate filing coverage, calendars, flow basis and revision selection before trailing periods   | Source observations alone do not prove four compatible standalone quarters         |
| As sources allow | Upcoming earnings, dividends, and news metadata                                                  | Need separately verified source coverage and entitlement                           |
| As inputs allow  | Alerts and exports for delivered workflows                                                       | Depend on reliable events, delivery choices, and source permissions                |
| Later            | Historical screening, automated filing breadth, many more filters/models, AI, strategy backtests | Require data and validation absent from the current product                        |

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
