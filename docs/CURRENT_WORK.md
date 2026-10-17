# Current work

Updated October 17, 2026. The [product roadmap](PRODUCT_ROADMAP.md) owns the full
InvestingPro feature goal. [Architecture](ARCHITECTURE.md) defines the runtime
boundaries. Source checks, integration, publication and physical-device use have
separate acceptance.

## Accepted release

Product `c270131` is published on the managed website and API. Its production
promotion controller is merged at `ac6f180`. Signed Android 1.27.0, code 28, is
delivered; physical installation was not performed. Prior website, API and Android
releases remain preserved. Original source/main, staging, BrowserStack and package
checks passed within their reviewed scope. Reviewed CodeScene maintenance
advisories remain recorded as failures accepted by the owner.

Annual version 5 requires matching API, website and Android clients. Save wanted
watchlist and Follow-ups drafts before reloading or updating. Stale website tabs
and Android 1.26 cannot load Annual against the new API until reloaded/upgraded.
New 1.27 cannot use the old Annual API. Before installation, restoring the prior
API and website together restores 1.26 compatibility. After 1.27 installation, an
old-API-only rollback leaves Annual incompatible. The old APK is not an automatic
in-place downgrade; do not uninstall or clear saved data.

The release includes:

- [Markets day view](MANAGED_MARKETS_HOME.md#read-the-markets-day-view), combining
  explicitly loaded BEA schedules and Fed metadata by Eastern date while keeping
  scheduled and published events, unknown times and independent clocks distinct.
- [Research checks due](MANAGED_MARKETS_HOME.md#review-research-checks-due), using
  the existing independent Follow-ups draft, explicit load, exact-listing research
  visit, authored result and explicit completion and Save.
- [Annual financial evidence](MANAGED_SEC_ANNUAL.md), including operating results
  and history, cash generation and history, liquidity and history, parent balance
  sheet totals/history/change, and independent two-company comparisons.
- [Company sources and snapshot](MANAGED_COMPANY_SNAPSHOT.md), explicit Price,
  Annual and Filings controls, exact original source dates, note editing and
  [captured research reports](MANAGED_COMPANY_REPORT.md) with browser/native file
  delivery. The report retains the complete loaded graph and authored note.
- Watchlist note search, review of unsaved changes, thesis review, explicit
  evidence-to-note actions, conflict/uncertain-save recovery and session retirement.

Private fixture controls are excluded from production. Original invented-data
Chrome checks at 1440, 390 and 320 CSS pixels and the original 42-case native
archive retain their actual scope; the 117 expected native images were structurally
checked, with representative pixel review. Static public build-marker acceptance
does not establish authenticated production journeys, provider health or physical
Android use. The earlier fixed Follow-ups storage proof failed in its recorded
scope; full live-storage qualification and backup/restore acceptance remain open.

## Valuation and dated price comparison in progress

The next M4 outcome connects [authored valuation to dated raw closes](MANAGED_VALUATION_PRICE_CONTEXT.md):
explicit Price loading, six scenario comparisons with independent refusals,
original source inspection, optional complete-note Preview and single-use Append,
existing Review/Save/recovery and reproducible JSON/HTML reports. It reuses the
existing decimal comparison engine and adds no source request or resource.
Company report format 5 and the Android receiver change together. Source,
packaged native, visual, integration and publication acceptance remain separate.
The local web suite passes 8,818 tests, including the composed note Save,
fresh-read, comparison capture and passive HTML cases. Types, scoped lint,
formatting and source boundaries pass. A new 50th native journey is prepared;
its packaged execution and new image review are pending.

## Annual financial screen integrated in source

The integrated M2 outcome is an [annual financial screening workflow](MANAGED_FINANCIAL_SCREEN.md):
choose exact listings and criteria, run paced explicit reads, inspect dated
values and independent unknowns, create a session shortlist, then visit company
research and return to the retained screen. It uses the existing canonical
Annual calculations and shared numeric screening kernel. The named cohort has
18 listings for 17 issuers; it is not a whole-market screen. Annual and Filings
eligibility are separate. Fourteen additional issuers passed bounded public
source capture and exact canonical replay, within existing source and response
limits. Missing concepts remain explicit. AEM's current 40-F is excluded.
The complete local web suite passes 8,761 tests, including the screen, source
inspection, explicit watchlist addition, three-draft preservation, note Save and
fresh-read, report provenance and Research/Back cases. The affected API suites,
types, lint, formatting and source boundaries pass. The packaged Android suite
passes all 49 journeys. PR186 is merged at `32952665`; final-main checks
are in progress. Three distinct mobile frames show the exact cash-flow value and
period, original source amount and retained criteria after Back. Full-table and
desktop geometry, physical use and publication remain open.

## Raw close research workflow integrated in source

The integrated M2/M4 workflow connects explicitly loaded Company Price history to
[seven descriptive studies](MANAGED_PRICE_STUDIES.md), selected-result whole-note
Preview and single-use Append, existing Review/Save/recovery and schema-4 JSON/HTML
reports. It reuses the existing decimal engine and source packet. Exact samples,
raw-price qualifications and independent insufficiency remain visible. Source
tests cover the actual Save/fresh-read flow, conflict and uncertain-save recovery,
stale callbacks and all seven captured results. PR185 is merged at `dec041a9`;
all seven final-main workflows and eight jobs pass, including 48 native tests.
Retained native image review has its recorded bounded scope. Publication,
desktop geometry and physical installation remain separate pending steps.

## Annual statement explorer integrated in source

The next complete M2 outcome is the [standardized annual statement explorer](MANAGED_ANNUAL_STATEMENTS.md):
Income, Balance sheet and Cash flow, selected-filing comparative dates, exact
source inspection, selected-cell note actions and captured JSON/HTML reports.
The canonical version 6 provider, routes, clients and paired response/view models
are integrated in the active source. All three statement views retain exact
reported amounts, dates, independent refusals and source references. The statement
explorer appears before the existing financial summaries. The actual workspace
flow from explicit load through selected-cell Preview, single-use Append, Review,
Save and fresh read passes, including conflict and uncertain-save recovery.

The integrated schema 3 JSON preserves the canonical graph once, with separate statement
cells and financial results that refer to its observation identifiers. Complete
passive HTML keeps all three statements. Actual escaped capacity cases fit the
unchanged wire and report limits; a document over the HTML limit is refused whole.
The reviewed source passed the full platform gates and all 46 native cases,
including the statement note, Save, fresh-read and file-capture journey. It is
merged into main with the owner's acceptance of reviewed CodeScene maintenance
advisories. Final-main checks pass; publication remains separate.
The reader layout refinement keeps compact scope, filing dates, original load and
source states above the table, with full context in a native disclosure. Its
source and native layout checks pass within their retained screenshot scope. No new provider,
automatic load or larger financial response limit is introduced.

## Authored valuation in progress

The next independent M4 outcome is the [authored valuation workbench](MANAGED_VALUATION_WORKBENCH.md):
editable cash flow DCF and exit-multiple assumptions, three scenarios, projections
and sensitivity results, company-owned temporary inputs, guarded complete-note
Preview/Append through existing Save and recovery, and complete JSON/HTML report
capture. It reuses exact decimal calculators without new source requests or
invented financial operands. The composed Calculate/Preview/Append/Save/fresh-read
and report cases pass, including uncertainty recovery, independent source
refusals, draft retention and retirement. The complete web suite and workspace
types pass. The prior native archive passed 45 tests, but screenshot review found
mobile navigation covering the sign-out actions. The reviewed layout fix moves
navigation into page flow while the review is open. Stronger hit checks and
affected source tests pass. Current native CI passes all 45 cases; direct review
of its sign-out and results screenshots confirms visible actions and whole
scenario headings. All six current workflows and seven jobs pass. CodeScene
maintenance advisories remain recorded as failures accepted by the owner; source
integration is complete. Final-main checks remain separate from publication.
Desktop browser geometry, publication and physical installation are not accepted.
The Portfolio storage and source integration decisions remain separate.

## Managed portfolio in progress

The selected M5 outcome is an [authored managed portfolio](MANAGED_PORTFOLIO.md):
opening balances, ordered transactions and manual splits, exact holdings and
cash, independent Review and Save, conflict/uncertain-save recovery, and company
Research/Back with the same draft. It reuses the existing schema-3 ledger and
FIFO calculation. A first load represents an uninitialized record explicitly;
the owner supplies the opening date. Portfolio joins Watchlist and Follow-ups
as a third independent session resource, including unapplied form protection.

The contract, backend, transport and client-model checks pass within their
recorded source scope. UI, shared-editor and navigation checks also pass. The
composed Start/register/Apply/Review/Save/reopen case retains USD 948 cash, one
share, USD 100.50 basis and USD 48.50 realized gain from the documented example.
Other cases retain all three drafts through research return, protect unapplied
forms and refuse a stale Save callback after the base version changes.
Broader identity review is separate from feed eligibility and does not establish
Price, Annual or Filings coverage. Storage is disabled by default; provisioning,
rendered geometry, current packaged execution and publication are not accepted.
This is a capability candidate. Adding an individual ticker is a coverage fix.

## Company Financial review source integration

The [Company Financial review](MANAGED_SEC_ANNUAL.md#review-financial-facts-in-the-company-note)
connects five independent Annual facts to an authored note. It reuses admitted
operating income, operating cash flow, cash after PP&E purchases, working capital
and parent equity. Each exact USD value or refusal retains its own dates,
references and original qualification. Signs are descriptive, without a company
rating or recommendation.

Explicit fact selection and complete-note preview precede guarded append.
The original authored text remains exact in the draft. The existing single-line,
2,000-character limit refuses the whole proposal when it cannot fit; no selected
provenance is clipped. Source, note, visit, catalog, navigation and save changes
invalidate old previews. Existing Review, whole-watchlist Save and report capture
finish the workflow. No provider, schema, saved field or automatic request is added.

Focused domain, formatter, composed workspace and component tests pass, along
with scoped lint and source boundaries. A settled Company-route refusal found
in source review has failing-before/passing-after regression evidence. Invented
Chrome checks at 1440, 390 and 320 CSS pixels cover exact note preview/append,
whole-note refusal, historical and missing values, refresh failure, Cancel,
late replies, independent dirty drafts, explicit Save, report capture and session
retirement. An original API 36 run passed all 43 native cases; all 119 expected
images and source markers were checked, with representative pixel review.

That revision passed Ubuntu CI, but Windows exceeded the unchanged five-second
deadline in an existing parser corpus test. The ZIP fixture builder now uses
Node's CRC32 implementation. All 103 archive hashes and expected outcomes remain
unchanged; the manifest records the reviewed builder's new source hash. Local
parser checks pass, including mutation isolation. The original failure remains
recorded. The next original Windows attempt passed that parser case, but two
unchanged web interaction tests exceeded their existing five-second deadlines.
Android, Ubuntu and the other source workflows passed. The web tests now keep
unchanged source fixtures stable during controlled edits and inspect each real
before/after comparison tree once. All 119 cases in both files pass locally.
No deadline, assertion or test configuration has changed. The next original
attempt passed all five source workflows, including Windows. The reviewed source
is merged at `1bacbe0` after the owner approved by email, including the reviewed
CodeScene maintenance advisories. All five main workflows and six jobs also
passed, including Windows and Ubuntu source-proof capture and retention.
Publication is pending; the accepted production release above is unchanged.

## Browser-readable report in progress

The next M4 candidate adds an explicit HTML download beside JSON in a current
prepared browser report. The file contains the exact authored draft, five
independent Annual facts, original dates and source qualifications, plus the
complete captured JSON appendix. Both formats share delivery and currentness
ownership. Android retains its JSON system save.

Focused formatter and delivery tests, web types, scoped lint and source boundaries
pass. Independent source reviews found no actionable defect. Invented Chrome
checks cover the actual received file bytes, note/source invalidation, session
retirement and application controls at measured 1440, 390 and 320 CSS pixels.
The real DOM formatter refuses a complete oversized HTML output while JSON still
fits, and rejects unowned documents without reading their fields. These checks
do not establish automated offline visual acceptance: the browser tool blocks
local file URLs. The owner confirmed by email that the downloaded file opens and
reads correctly. Appendix expansion was not separately reported. Local browser
and managed Android builds pass with no server renderer or Node module in either output graph. The
browser package is within its existing size bounds. Those local builds use a
provisional base marker; current-head CI and release qualification are separate.
Draft PR175 contains this candidate. Its first CodeScene check found structural
issues in three new files. A focused refactor splits the passive report sections,
simplifies the refusal condition and extracts calculation-reference assertions.
The 19 original formatter cases and 19 private copies pass, including 15 rendered
fixtures with identical before/after markup. Web types and scoped lint pass.
The original candidate passed Ubuntu and Windows CI but failed one packaged
Android test at its existing saved-report screenshot visibility check. The failure
was caused by a selector that still expected the JSON button as a direct child.
The selector now follows its action container; all three visibility targets and
the original deadline and save assertions remain. The original failure is
retained; current-head checks remain separate.
The repaired revision passed all four original workflows and five jobs, including
Android, Ubuntu and Windows. CodeScene passes with no maintenance warnings. The
reviewed source was merged at `6c6679c` after the owner approved by email.
All three applicable main workflows and four jobs passed, including Ubuntu
source-proof capture and retention. Publication has separate acceptance.
This surface is not released.

## Annual cash margin in progress

The next M2 candidate adds cash generation relative to each of the three named
reported revenue bases. It uses the current Annual response and the exact
operating cash flow, PP&E purchases and revenue operands. Matching periods and
accessions, signed amounts, explicit refusals, original eligibility and complete
input references remain visible. Missing operating or net income does not gate
the calculation. The percentage rounds once to two decimal places. No provider,
wire contract, saved field, note action, request or save is added.

The 132 focused domain checks and 53 UI/composed cases pass, with web types,
scoped lint and boundaries. Independent domain review is clear. Invented Chrome
checks at measured 1440, 390 and 320 CSS pixels cover the dated percentages,
keyboard inputs, long-value wrapping, failed/Cancel refresh retention, late replies,
historical and missing-revenue replacements, and session retirement. Six explicit
Annual reads made no price/filings/calendar/Fed request or save. The composed test
separately covers both dirty drafts and company replacement. The additive native
journey extension passed the original packaged run: all 43 cases, with 120 image
structures checked and the new percentage frame inspected. A later test-only
refactor preserves the domain cases, composed actions and native assertions and
deadlines; its current-head checks remain separate from the original run.
This branch is stacked on the unreleased
readable-report candidate; its acceptance and publication are separate.

## Reported cash chart in progress

The next M2 candidate adds a metric selector and bar chart inside Reported cash
history. It uses only the two or three adjacent periods already admitted from the
loaded filing. Operating cash flow, PP&E purchases and their subtraction keep
exact table values, original dates and references. Cash eligibility remains
independent of income. A shared guarded Annual chart renderer keeps numeric plot
coordinates separate from exact amounts. All 82 focused cases, the composed
workspace journey, scoped lint, formatting and boundaries pass. Independent
source review found no actionable defect. The original income chart outputs and
cash table are preserved. An initial invented Chrome check at 1152 CSS pixels
showed the default signed chart, closed/open behavior and a 44px picker with
keyboard focus. Full responsive, tooltip and browser lifetime checks remain
unverified. The additive native test retains all prior assertions and adds one
image. The original Android run passed; Windows stopped at the unchanged vault
restart test's five-second deadline. That failure is retained. A reviewed guard
refactor preserves the plot's numeric acceptance, refusals and freezing; its
51 affected tests, types and lint pass. Current-head CI is separate. This candidate is stacked on the unreleased
cash-margin source. Source integration and publication remain separate.

## Annual cash margin comparison in progress

The next M2/M4 candidate adds three fixed revenue-basis rows to the existing
two-company Annual comparison. Each company's exact revenue, cash-generation
percentage, period, refusal and original source qualification remain independent.
It reuses the existing cash-margin derivation and input disclosures without
requiring operating or net income or using the comparison's income selector.

The 81 affected component cases, real-model journey, web types, scoped lint and
source boundaries pass. Differential checks retain the prior company markup,
comparison rows and note outputs. The native test extension preserves all 43
cases and 121 capture names; Java and constructed-predicate syntax checks pass.
Packaged execution is pending. Browser/CDP checks are stopped under the owner's
current direction; no new responsive or browser-lifetime acceptance is claimed.
Source integration, packaged native execution and publication remain separate.
Existing production and the earlier comparison note action are unchanged.

## Remaining milestones and acceptance limits

The [easy-stock review](EASY_STOCK_REVIEW.md) guides the useful research workflow
ideas adopted alongside the original InvestingPro goal. No upstream code, assets,
prompts or dependencies were copied.

Price history covers AAPL, GOOG and GOOGL with dated raw USD closes. Discover and
Annual also cover MSFT through the fixed admitted catalog. Broader universe and
statement coverage, valuation, screening, peers, portfolio tools, AI research and
asset classes remain roadmap work with separate source/data eligibility.

Controlled real-account expiry/conflict, screen-reader review, physical upgrades
and an isolated managed backup/restore exercise remain open. Synthetic checks do
not establish sustained production reliability, offline editing, process-death
restoration or cloud-data recovery. Reuse unchanged passing evidence within its
scope and verify each affected increment before integration or live delivery.
