# Current work

Updated October 16, 2026. The [product roadmap](PRODUCT_ROADMAP.md) owns the full
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
journey extension has passed syntax and source review; packaged execution is
pending. It preserves all prior cases and frames, adding one percentage frame.
This branch is stacked on the unreleased
readable-report candidate; its acceptance and publication are separate.

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
