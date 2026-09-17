# Current work

Updated 2026-09-17 following the handover from **Investing Pro+** to
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

## Immediate delivery: compare adjusted prices over shared dates

Extend the explicit financial-comparison price load with one-month, three-month
and one-year history choices. Changing the range clears and cancels the previous
result; it never fetches automatically. Use the observed-date intersection of
all two or three selected companies and require at least two common dates. Show
the actual shared window, adjusted-price percentage change, start/end adjusted
closes and per-company coverage. Missing history must remain visible rather than
silently shortening the selected group or comparing different endpoints.

Reuse the existing selected-window decimal analytics and overview requests.
Keep only the needed close/date projection in active-session memory, preserve
all listing and lifecycle checks, and exclude provider and derived values from
saved views. Provider-adjusted price change is not an independently reconstructed
total return or valuation ranking. See [Comparison prices](./PERSONAL_COMPARISON_PRICES.md)
for semantics and the workspace checkpoint for actual verification and release.

## Delivered: prices beside a financial comparison

Add an explicit **Load prices** action for the existing two-or-three-company
shortlist. Reuse the admitted Tiingo overview with sequential 1m requests and
independent company states. Show the reference or EOD price, provider, dated
source basis and freshness as of loading. For EOD, label the assumed regular
session close and the unmodeled early-close limitation. Opening comparison,
changing columns, running the financial screen and saving a view never load prices.

Keep only the small price projection in active component memory. Cancel and
clear it when the shortlist, financial/catalog snapshot, owner session or
comparison changes. Reject late responses and mismatched full listing identities.
Stop the batch for credential, entitlement, configuration, session and rate-limit
failures; represent ordinary company coverage failures separately. The existing
28 SEC metrics, formulas, presets, saved payloads and transport stay unchanged.
No valuation ratios, price filters, exports or saved prices are added.

The configured source was verified on 2026-09-17 with two exact catalog listings:
AAPL and MSFT returned reference quotes and price history. This is sampled
operation access, not a broad coverage or independent accuracy claim. Use
synthetic values for persisted browser QA and regression fixtures. See
[Comparison prices](./PERSONAL_COMPARISON_PRICES.md) and the workspace checkpoint
for actual release and runtime verification.

## Delivered: interest and income-tax cash payments

Add **Reported interest paid excluding capitalized interest (USD)** and
**Reported income taxes paid net of refunds (USD)** using only `InterestPaidNet`
and `IncomeTaxesPaidNet`. Interest is cash classified as operating activity,
excluding capitalized cash interest; it is not net of interest receipts. Income
taxes are cash paid to foreign, federal, state and local jurisdictions after
refunds. Preserve reported signs, zero and each exact annual period and filing.
Expense, broader payment and component concepts never replace missing facts.

Expand twenty-six fields to twenty-eight and twenty-one Frames to twenty-three.
Use explicit columns, filters, sorting, comparison, source inspection and saved
views. All existing presets, starters and literal saved layouts stay unchanged;
no new preset is needed. Coordinate transport v14 without changing formula-set1.7
or saved payload versions. Verify production coverage and bounded primary
evidence, including tax refunds, zero payments and 52/53-week periods. Do not
subtract these amounts from operating cash flow or derive interest coverage,
effective tax rates or cash available to shareholders. The thirty-metric breadth
target and broad joint eligibility remain open.

## Delivered: common-stock payments

Add **Reported common dividends paid (USD)** and **Reported common stock
repurchase payments (USD)** using only `PaymentsOfDividendsCommonStock` and
`PaymentsForRepurchaseOfCommonStock`. The dividend concept covers ordinary cash
dividends to common shareholders of the parent. Broader, preferred and
noncontrolling-interest distributions do not substitute for either field.
Preserve reported signs, zero and each amount's own annual dates and filing.
A positive payment amount means cash paid, not cash received. Missing is unknown.

Expand twenty-four fields to twenty-six and nineteen Frames to twenty-one.
A separate **Common stock payments** column preset contains the two amounts;
the eight-column Cash flow preset, Overview, Q4 balances, starters and literal
saved layouts remain unchanged. Coordinate transport v13 without changing
formula-set1.7 or saved payload versions. Measure actual coverage and reconcile
bounded primary filings, including zero and non-calendar periods. These amounts
do not establish dividend yield, payout ratios or net buybacks. The thirty-metric
breadth target and broad joint coverage remain open.

Release `4426fcaf` passed 6,371 native checks, 24 builds, all six hosted jobs on
attempt1 and configured Brave checks. Production evaluation covered 3,227
listings; common dividends were known for 583 and common-stock repurchases for
1,377. Five primary filings were inspected. The release checkpoint retains
issuer counts, source limits and dated acceptance evidence.

## Delivered: reported investing and financing cash flows

Add **Reported investing cash flow (USD)** and **Reported financing cash flow
(USD)** using only the exact annual SEC
`NetCashProvidedByUsedInInvestingActivities` and
`NetCashProvidedByUsedInFinancingActivities` concepts. Preserve reported
inflows, outflows and zero, with each field's actual period and filing.
Continuing-operation variants do not fill a missing total. These amounts do not
reconstruct changes in cash, PP&E spending, borrowing or shareholder returns.

Expand twenty-two fields to twenty-four and seventeen Frames to nineteen.
Cash flow columns can include both new amounts; Overview, Q4 balances, starter
criteria and literal saved layouts keep their existing meanings. Coordinate
transport v12 without changing formula-set1.7 or saved payload versions.
Measure actual coverage and reconcile positive, negative, zero and non-calendar
annual filing samples. The thirty-metric breadth target remains open.

Release `bd564855` passed 6,241 native checks, 24 builds, all six hosted jobs on
attempt1 and configured Brave checks. Production evaluation covered 3,227
listings; investing cash flow was known for 2,760 and financing cash flow for
2,854. Six primary filings were reconciled. The release checkpoint retains
issuer counts, missing/conflicting values and dated source evidence.

## Delivered: reported cash and stockholders' equity

Add **Reported cash and cash equivalents (USD)** and **Reported stockholders'
equity (USD)** using only the exact SEC `CashAndCashEquivalentsAtCarryingValue`
and `StockholdersEquity` concepts. Equity belongs to the parent and excludes
temporary equity and noncontrolling interests. Preserve negative equity deficits;
do not substitute broader restricted-cash or consolidated-equity measures.

Expand twenty fields to twenty-two and fifteen Frames to seventeen. Retain each
amount's own actual Q4 date and accession, the October–December window, all old
calculations and literal saved layouts. Transport v11 coordinates strict API and
browser admission; formula-set1.7 and saved payload versions remain unchanged.
Measure actual coverage and reconcile varied primary filings. This is another
bounded step toward the thirty-metric target, not completion of that gate.

Release `c18d3abf` passed 6,141 native checks, 24 builds, all six hosted jobs on
attempt1 and configured Brave checks. Production evaluation covered 3,227
listings; cash was known for 2,375 and parent equity for 2,622. The release
checkpoint retains missing/date-excluded counts and primary-filing evidence.

## Delivered: reported balance totals

Add **Reported total assets (USD)** and **Reported total liabilities (USD)** to
the financial screen, filters, sorting, comparison and source inspection. Use
only the exact SEC `Assets` and `Liabilities` concepts from USD Q4 instant Frames.
Each amount stands alone; total liabilities is not a financial-debt measure.
Retain the actual balance date, filing and existing October–December date window.
Missing direct concepts remain unknown rather than being reconstructed.

This expands eighteen fields to twenty and thirteen source requests to fifteen.
Preserve all previous calculations, Overview columns, starter screens and exact
saved layouts. Existing v1/v2 records remain readable; only an explicit edit and
save adds the new columns. Transport v10 coordinates the expanded strict response;
formula-set1.7 is unchanged. Measure actual catalog coverage and inspect bounded
primary filings; this increment does not close the thirty-metric breadth target.
See [SEC financial screening](./SEC_ANNUAL_FINANCIAL_SCREENING.md).

Release `2fc90bee` passed 6,007 native checks, 24 builds and all six hosted jobs
on attempt1, plus synthetic and configured Brave checks. Production evaluation
covered 3,227 listings and retained all eighteen prior fields. Total assets were
known for 2,724 listings; total liabilities for 2,407. Five primary filings were
reconciled; the checkpoint retains date exclusions, issuer counts and limits.

## Delivered: reusable financial views

Save a financial view's chosen columns with its criteria, then restore both
when loading it. The results and comparison use the restored columns. Loading
keeps the current Catalog/My Watchlist scope and selected listings, clears old
results, and requires an explicit Run. It makes no SEC request or automatic write.

Retain strict reads of existing version1 definitions. Loading a criteria-only
view leaves current columns unchanged and explains this legacy behavior. An
explicit Save or Save as stores version2 with the current columns; unrelated
legacy views retain their identities, criteria and provenance with a null display.
Deletion preserves the existing payload version. Keep the twenty-view limit,
name rules, optimistic conflicts and source-digest provenance. No new metric,
provider, formula or account behavior is part of this slice. See
[Saved financial views](./PERSONAL_FINANCIAL_VIEWS.md).

Release `3e49f96` passed 5,871 native checks, 24 builds, all six hosted jobs,
and synthetic/configured Brave checks. It includes a narrow Windows CI startup
preflight and explicit filesystem-integration test deadlines after the original
release's two distinct hosted timeouts. Production ACL behavior is unchanged;
the checkpoint retains both failures and final acceptance evidence.

## Delivered: company research workspace

Group the existing company panels into Price, Financials, Valuation, Peers and
SEC evidence. Keep the selected identity visible and provide a direct return
to the originating results, watchlist, filings or holdings. Section changes and
return navigation preserve loaded company data, editable DCF assumptions and
the original screening criteria/results/comparison without additional requests.
Inactive sections remain mounted but are excluded from keyboard navigation.

Opening another admitted identity or clearing the company retains existing
request cancellation and data-reset behavior. Old callbacks and delayed source
focus cannot attach to a different company or workspace. Existing DCF source
links reveal the corresponding section before focusing its heading. Research
actions in comparison headers support retained companies from other pages.

Use existing inputs and explicit Load actions; no new provider, API, storage,
calculation or authentication change is needed. See
[Company research](./PERSONAL_COMPANY_RESEARCH.md) for behavior and acceptance.

Release `53d1315` passed 5,818 native checks, 24 builds and all five hosted jobs
on attempt1, plus synthetic and configured Brave desktop/mobile checks. Draft
retention, identity changes, exact return focus and source links were verified.
The workspace checkpoint retains actual activation and verification evidence.

## Delivered: financials for My Watchlist

Let the owner choose **My Watchlist** in Financial screen, select up to twenty
saved listings, and explicitly run the existing eighteen metrics for that cohort.
Reuse the filters, source inspector and two/three-issuer comparison. Display
counts and coverage for selected listings, with the full saved-list count shown
separately. An empty watchlist explains how to add companies through discovery.

Resolve every selected listing against the current saved watchlist and catalog
before a provider load, and recheck the watchlist version afterward. Reject
changed, removed or substituted identities. Scope, selection or watchlist changes
clear dependent results and comparison; ordinary catalog screening remains
independent of watchlist edits. Requests, late responses and callbacks remain
bound to the active scope, identities, watchlist version and source snapshots.

The optional watchlist scope extends transport v9 outside criteria. Saved-v1
definitions still contain filters only; loading them does not load membership
or make a request. Formula-set1.7, all eighteen calculations and the thirteen
Frames are unchanged. Selection itself performs no fetch or persistence.

Release `cf1add8` passed 5,771 native checks, 24 builds and all six hosted jobs on
attempt1, plus isolated populated-watchlist and live Brave desktop/mobile checks.
Selected-cohort counts, unchanged metrics, membership/version conflicts, limits,
source-cache reuse and scope isolation were verified. The owner's list remains
unchanged. The workspace checkpoint owns actual release activation and evidence.

## Delivered: compare cash after PP&E relative to revenue

The accepted slice adds **Operating cash flow less PP&E purchases / selected revenue (%)** as the
eighteenth SEC-screen metric. It uses the three existing annual operands and
thirteen-Frame snapshot. Subtract exactly, divide by positive selected revenue,
and round once half-up to two percentage decimals. Preserve signed and zero
results; require nonnegative PP&E purchases and matching actual annual dates
and filing accession across every retained reference. Unresolved inputs remain
unknown with their evidence, rather than becoming zero.

The percentage is available in Cash flow, All metrics and individual column choices,
ordinary signed filters and sorting, saved-v1 criteria, coverage and shortlist
comparison. Source details show all three original operands and their exact
dates and filings. Keep starter thresholds and their existing columns unchanged.
Transport v9/formula-set1.7 coordinates client and API validation; the browser
independently recomputes the ratio using integer arithmetic. This narrow app
calculation is not a reported subtotal or a generic free-cash-flow measure.

Release `769b3fa` passed 5,664 native checks, 24 builds, all five hosted jobs on
attempt1 and focused Brave desktop/mobile checks. The actual agreement snapshot
reported 1,562 known and 1,665 unknown listings out of 3,227. Exact arithmetic,
one-time rounding, unknown precedence, source multiplicity, prior-metric
stability, saved definitions and provider request counts were checked.
Retained filing operands support dated
offline replay only with their original acquisition dates and scope; they do
not establish fresh source coverage. The workspace checkpoint owns actual
release verification and activation.

## Delivered: compare a financial-screen shortlist

Select two or three distinct issuers from SEC financial-screen results and
compare their decoded metrics side by side, including selections
from different pages of the same query and snapshot. Reuse the source inspector
for exact values, unknown reasons, actual periods and filing references. The
existing display groups control the comparison's metrics. A shared calendar year
does not establish identical fiscal periods or comparable businesses.

Keep at most three selected rows in component memory. Bind them to applied
criteria, catalog and financial digests, years, revenue basis and formula version.
Preserve selection only through successful pages of that exact context; clear it
on changed criteria, a starter or saved-view application, new Run/Refresh, failed
requests, changed snapshots and session/workspace loss. Display-only column
changes may retain selection. Reject duplicate share classes of a selected
issuer and prevent stale callbacks or responses from reviving prior selections.

Selection, comparison and source inspection use already decoded results and make
no data request or write. Existing explicit pagination remains unchanged. The
accepted comparison release `1b445e7` passed 5,543 native checks, 24 builds,
Brave desktop/390px QA and all five hosted jobs, with one unchanged Windows retry
after a historical custody test timed out. The original failure remains recorded;
the passing retry does not identify its cause. The workspace checkpoint owns
the active runtime and full evidence.

## Accepted predecessor and historical verification

Release `fb8ec7d` adds **Current assets less current liabilities (USD)** as the
seventeenth field. Its native gate passed 5,506 checks with nine existing skips
and 24 builds; all five applicable hosted jobs passed on attempt 1. Independent
receipt audits and Brave desktop/390px QA passed. Exact subtraction accepts
negative differences and zero liabilities but requires nonnegative operands,
matching actual Q4 dates and filings. Transport v8/formula-set 1.6 and the
thirteen-Frame source set remain the comparison baseline.

Local access was implemented at `7c4fdf1`: the app opens
without login while retaining its loopback/request boundaries, encrypted vault
and saved account. Native verification and Brave desktop/mobile acceptance passed,
including all three editable financial starters. See [local owner login](./LOCAL_OWNER_LOGIN.md).
The workspace checkpoint owns current runtime and restoration details.

Hosted acceptance for that historical local-access release remains incomplete. The first Windows run
timed out in an unchanged historical database-review test. Its single unchanged
retry failed in the native vault ACL child process; the backup case took 15.246
seconds, but its cause was omitted from both the displayed log and annotation.
This timing alone does not prove a timeout or identify an ACL defect. Preserve
both failures; do not retry them or weaken their assertions/deadlines.

The subsequent diagnostic release `b5ea94e` passed 5,440 native checks and all
six applicable hosted jobs on its first attempt. A named Error cause now exposes
the sanitized stage, exit code, killed flag, signal and elapsed time in the
pinned reporter. The public vault error, fixed native command, 15-second
deadline and ACL checks are unchanged. This repairs reporting; it does not
retroactively resolve the earlier process failure. Preserve the running app
until the next verified product release is ready to activate.

The accepted balance slice adds **Current assets less current liabilities (USD)**
as the seventeenth field. It reuses existing Q4 balances to screen dollar
surpluses/shortfalls, including negative differences and zero liabilities.
Every retained reference must have the same admitted actual date and filing;
both operands must be nonnegative. Exact subtraction, source inspection, signed
filters, sorting, coverage and saved-v1 criteria retain the existing screen flow.
Q4 balances and All metrics include the field; other presets and all three
starter screens retain their existing criteria and columns.

Transport v8/formula-set1.6 coordinates API and browser validation without adding
SEC inputs or reads to the thirteen-Frame cache. The browser independently checks
values, reasons and source multiplicity. Dated corroborated filing operands can
be replayed without fresh acquisition; keep their original source dates and
coverage limits. The workspace checkpoint owns the release's actual local,
hosted and Brave verification results. This does not complete the shared metric
registry or its coverage gate.

## Current position

| User job                  | Implemented capability                                                                                                                       | Important remaining gap                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Find and follow companies | Admitted local stock/ADR catalog, search, encrypted My Watchlist                                                                             | Catalog refresh and broader discovery data                    |
| Inspect price behavior    | Explicit Tiingo quote/history loads, charts, actions, five analytics and SMA classifications                                                 | Wider reconciliation and benchmark-relative analysis          |
| Understand financials     | Annual/quarterly statements, 30 reported fields, derived metrics and growth                                                                  | Verified TTM and the shared 30-core-metric screening registry |
| Examine valuation         | Historical multiple bands, editable forward/reverse DCF                                                                                      | Direct normalized FCFF inputs and further justified models    |
| Compare businesses        | SEC-screen shortlist of two or three issuers with source inspection; twelve financial checks and up to three manual peers                    | Broader compatible multi-company coverage and automatic peers |
| Screen for ideas          | Eighteen SEC financial fields, source inspection, three editable starter screens, explicit revenue basis, stable pages and saved definitions | Broader verified metric coverage and compatible source inputs |
| Keep up with changes      | On-demand recent SEC filings for selected watchlist listings                                                                                 | Broader live samples, upcoming events, alerts and exports     |
| Track holdings            | Encrypted ledger, splits, daily values, endpoint/Dietz/linked returns and FIFO                                                               | Further corporate actions, benchmarks and live coverage       |

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

## Completed delivery: three editable financial starter screens

This partial Cycle 3k-c delivery turns existing fields into three sparse,
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
Brave desktop and 390px keyboard/layout checks passed with local access at
`7c4fdf1`, including an edited AAPL run and source inspection. The empty real
saved-view list did not exercise detachment interactively; automated tests cover
that path. Local product acceptance remains separate from the hosted failures
described above.

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

| Priority         | Deliverable                                                                                      | Dependency or reason                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Now              | Compare adjusted-price changes over shared dates in a financial comparison                       | Reuse explicit overview loads and admitted selected-window analytics       |
| Next independent | Improve repeatable research workflows and add metrics where verified inputs support a useful job | Prioritize useful outcomes while retaining explicit source gaps            |
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
   focused checks for this feature include:

   ```powershell
   pnpm --filter @research-cockpit/web test -- PersonalComparisonPrices PersonalFinancialScreener SecurityDiscoveryWorkspace personal-workspace-api
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
