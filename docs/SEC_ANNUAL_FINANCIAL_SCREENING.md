# SEC financial screening: annual flows and Q4 balances

This is the first partial Cycle 3k-a2 product slice. It adds a usable numerical
screen to Discover without expanding company-by-company provider calls.

## Use and source setup

In the API process, set `PERSONAL_SEC_USER_AGENT` to a declared application
name and the owner's real contact email (for example, a value shaped like
`ResearchCockpit owner@example.com`). The address must be real for the
configured deployment. Keep the actual contact out of Git. This optional setting
does not affect catalog discovery or Tiingo company views. If it is missing or
invalid, the screen gives an actionable configuration error.

Open Discover, start the owner session, and use **Financial screen**.
The configured temporary local-access mode opens the workspace without sign-in.
Choose a completed calendar year, add numerical thresholds, and explicitly run
the screen. Choose a **Revenue basis** when you want one reported concept to
drive revenue and the five revenue-based ratio denominators. Amount thresholds use USD;
percentage thresholds use percent points; current-ratio thresholds use multiples
(1 means 1.00×). The selected year also fixes the balance-sheet selection to its
Q4 instant Frame. Operating cash flow / net income (%)
is independent of Revenue basis and requires positive reported net income.
Open or watchlist a result using its exact catalog listing identity. Save a
named financial view to reuse criteria and chosen columns, then explicitly rerun
it when loaded. See [Saved financial views](./PERSONAL_FINANCIAL_VIEWS.md) for
legacy definitions, replacement and conflict behavior.
**Selected revenue YoY change (%)** compares the selected revenue measure with
the prior year. Find it in All metrics or Choose columns; the other presets
keep their existing columns. Its source inspector shows both annual operands.
Refresh requests a new source read. Page navigation remains bound to both
catalog and financial content digests; changed content requires a rerun.

### Screen companies from My Watchlist

The **Financial screen scope** control switches between the admitted catalog and
**My Watchlist**. In watchlist scope, choose one to twenty saved listings before
running. Search and selection paging help with larger lists; selection does not
request data. An empty or unavailable watchlist cannot run a scoped query.
Use discovery to save companies first. Filters, sorting, source details and
comparison then operate on the selected cohort. Coverage counts describe
identity matches within that cohort, not the entire catalog or saved watchlist.

The request's optional `scope` contains `kind: "watchlist"`, `watchlistVersion`
and exact unique `listingIds`. The response echoes it and adds
`totalWatchlistListings`. Catalog requests and responses omit scope. The API
checks saved membership, full catalog identity and watchlist version before
loading the existing financial snapshot, then checks the version again after
the load. Changes during a request return a conflict. Scope cannot authorize
an arbitrary catalog listing that is not saved.

The active selection is temporary. Scope, selection, membership or watchlist
version changes invalidate dependent requests, results, source inspection and
comparison; a stale response cannot restore them. Catalog results remain
independent of ordinary watchlist edits. Saved views contain no scope or
membership; loading keeps the current scope and selection and still requires an
explicit Run. Legacy version1 definitions retain criteria only; version2 also
stores the display columns. No new formula or SEC concept is added.

### Read and inspect results

The default **Overview** shows revenue, net income, operating cash flow, net
margin and current ratio. **Financial column view** also offers Profitability,
Cash flow, Q4 balances and All metrics. Open **Choose columns** to make a custom
selection; at least one financial field stays visible. Company identity remains
visible as the table scrolls sideways. The table region is keyboard focusable
for horizontal scrolling.

These choices change only the displayed columns. All filters and the selected
sort still apply, including fields outside the chosen view; their applied summary
remains visible above the results. Column choices survive paging and reruns.
Loading a version2 financial view restores its saved columns; loading a legacy
criteria-only view leaves current columns unchanged. An explicit Save stores
criteria and columns together. Unsaved columns return to Overview when the
owner/catalog context changes. Changing columns does not request or refresh SEC data.

Activate a value or **Unknown** to open its source inspector above the table.
The inspector identifies the company and metric, preserves the exact value or
unknown reason, and shows the calculation and every retained source reference
with its actual period or balance date. Opening focuses the inspector heading;
**Close details** or Escape within the inspector removes the panel before
returning focus to the value, so scrolling uses the final table position.
The inspector is nonmodal, so filing links and the rest of the screen remain
keyboard accessible. Changing columns, criteria or results closes old inspection;
owner/session loss clears private results. Display preferences do not count as
owner-session activity or modify provider cache expiry.

### Compare a shortlist

Use **Research SYMBOL** in a comparison column to open that exact company in
the [company research workspace](./PERSONAL_COMPANY_RESEARCH.md), including a
selection retained from another result page. Navigation preserves the current
criteria, selected listings, results and comparison. **Back to financial results**
returns focus to the originating control or the screen heading if it is gone.
Opening research makes no additional financial request or saved-data write.

Select up to three distinct issuers from results, then compare two or three
companies side by side. Selections can span pages of the same query and financial
snapshot. A second share class of a selected issuer cannot duplicate that
issuer's financials. Remove an individual company or clear the shortlist to
choose another set.

The comparison uses the existing display columns and groups, including All
metrics. Each company's exact listing identity remains visible. Values retain
their actual annual periods or balance dates and open the same source inspector
as the results table, including unknown reasons and every retained filing
reference. The shared calendar selection is not a claim of identical periods,
accounting, business scope or peer relevance.

Opening comparison or source details moves keyboard focus to its heading.
Closing details returns focus to the exact value; closing comparison returns it
to Compare companies. Removing or clearing selections focuses the shortlist
heading. These focus changes keep the destination visible after the panel has
opened or closed, with clearance for the sticky header and focus outline,
including within a horizontally scrolled mobile comparison.
While the financial screen has keyboard focus, page scrolling is immediate,
including Tab navigation to filing links. Closing details with Escape therefore
does not leave a prior focus scroll moving the restored value out of view.

The shortlist lives only in component memory. It is bound to the applied criteria,
catalog and financial digests, selected/prior years, revenue basis and formula
version. Successful paging within that context preserves selection. Changing
criteria, applying a starter or saved definition, running or refreshing, a failed
request, changed snapshot, or session/workspace loss clears it. Display-only
column changes retain the shortlist. Comparison actions are unavailable while a
page is loading, and stale actions cannot restore a superseded selection.

Selecting, removing, comparing and inspecting use already decoded rows without
requests or writes. The shortlist is not saved in definitions, browser storage,
the vault, a URL or an export. Ordinary pagination still makes its existing
snapshot-bound request. The separate selected-company peer workspace is unchanged.

### Start from editable examples

**Editable starter screens** offers three sparse starting points using the
existing metrics. Apply one to replace numeric filters, sort and visible columns.
Your selected calendar year, revenue basis and company filter stay in place.
Review or edit the ordinary criteria, then choose **Run financial screen**.
Applying an example neither requests SEC data nor saves anything; it clears old
results and source inspection, and cancels any older screen request.

| Starter                      | Initial criteria                                                                  | Initial sort                   | Displayed financial fields                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Growth with cash after PP&E  | Selected revenue YoY change ≥ 5%; operating cash flow less PP&E purchases ≥ USD 0 | Revenue change, descending     | Revenue, operating cash flow, PP&E purchases, operating cash flow less PP&E purchases, revenue change |
| Cash flow relative to income | Operating cash flow / net income ≥ 100%                                           | Cash flow / income, descending | Net income, operating cash flow, cash flow / income                                                   |
| Q4 liquidity cover           | Current assets / current liabilities ≥ 1.00×                                      | Current ratio, descending      | Current assets, current liabilities, current ratio                                                    |

These literal thresholds are illustrative and editable, not recommendations,
grades or universal industry tests. Cash flow / income needs positive income
and compatible annual sources; current ratio needs nonnegative assets, positive
liabilities and compatible balances inside the selected year's Q4 date window.
Revenue change keeps the selected revenue basis and its adjacent-period rules.
The growth-and-cash conjunction does not require both metrics to share a common
annual period; inspect each value's actual sources before comparing them.

The examples are labelled sparse because broad joint eligibility has not been
established. Existing per-field known/unknown coverage and query counts retain
their meanings. A failing criterion excludes a listing even when another input
is unknown, so neither zero query-unknown results nor marginal coverage proves
all required fields are known throughout the cohort.

Applying a starter selects **New financial view** and clears the draft name,
preserving any existing saved record. Applying is unavailable while saved-view
I/O is pending. After running, name and save its criteria and chosen columns
through the existing saved-definition flow. New saves use payload v2 with no
starter identifier; legacy v1 definitions remain readable and contain no column
preference. The financial source set and formulas are unchanged.

The eight annual concepts use the public endpoint template
`https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/USD/CY{year}.json`.
Two balance-sheet concepts use
`https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/USD/CY{year}Q4I.json`.
Concept, unit and Q4 are fixed in code; the only period selection is a completed year
from 2009 onward. Three additional annual Frames use the prior year and the
same three fixed revenue concepts. For selected 2009, the comparison uses 2008;
missing history makes revenue change unknown without rejecting old saved criteria.
No API key or commercial subscription is needed for these
public SEC APIs. SEC documents cross-company Frames, calendar alignment,
differing reporting dates and nightly bulk alternatives in its
[EDGAR API guide](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).
The SEC's [webmaster guidance](https://www.sec.gov/about/webmaster-frequently-asked-questions)
explains declared automated access and reuse of public filing information;
[developer resources](https://www.sec.gov/about/developer-resources)
set an aggregate ceiling of 10 requests per second. Reviewed 2026-09-09.

## Metrics and comparability

| Metric                                                         | Input or formula                                                                   | Unit     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| Revenue                                                        | Selected revenue basis; the default requires agreement among available concepts    | USD      |
| Gross profit                                                   | `GrossProfit`, as reported; no calculation from revenue and costs                  | USD      |
| Net income                                                     | `NetIncomeLoss`                                                                    | USD      |
| Operating income                                               | `OperatingIncomeLoss`                                                              | USD      |
| Operating cash flow                                            | `NetCashProvidedByUsedInOperatingActivities`                                       | USD      |
| Reported investing cash flow                                   | `NetCashProvidedByUsedInInvestingActivities`, as reported                          | USD      |
| Reported financing cash flow                                   | `NetCashProvidedByUsedInFinancingActivities`, as reported                          | USD      |
| Net margin                                                     | Net income / revenue × 100                                                         | percent  |
| Operating margin                                               | Operating income / revenue × 100                                                   | percent  |
| Operating cash flow margin                                     | Operating cash flow / revenue × 100                                                | percent  |
| PP&E purchases                                                 | `PaymentsToAcquirePropertyPlantAndEquipment`, as reported                          | USD      |
| Operating cash flow less PP&E purchases                        | Operating cash flow − PP&E purchases                                               | USD      |
| Gross profit / selected revenue (%)                            | Reported gross profit / selected revenue × 100                                     | percent  |
| Operating cash flow / net income (%)                           | Reported operating cash flow / positive reported net income × 100                  | percent  |
| Operating cash flow less PP&E purchases / selected revenue (%) | (Operating cash flow − PP&E purchases) / positive selected revenue × 100           | percent  |
| Current assets                                                 | `AssetsCurrent`, actual instant balance date                                       | USD      |
| Current liabilities                                            | `LiabilitiesCurrent`, actual instant balance date                                  | USD      |
| Current assets / current liabilities (×)                       | Current assets / positive current liabilities                                      | multiple |
| Selected revenue YoY change (%)                                | (Current selected revenue − prior selected revenue) / positive prior revenue × 100 | percent  |
| Current assets less current liabilities                        | Current assets − current liabilities, on the same actual Q4 date and filing        | USD      |
| Reported total assets                                          | `Assets`, actual instant balance date                                              | USD      |
| Reported total liabilities                                     | `Liabilities`, actual instant balance date                                         | USD      |
| Reported cash and cash equivalents                             | `CashAndCashEquivalentsAtCarryingValue`, actual instant balance date               | USD      |
| Reported stockholders' equity                                  | `StockholdersEquity`, attributable to parent, actual instant balance date          | USD      |

### Reported investing and financing cash flows

**Reported investing cash flow (USD)** uses only
`us-gaap:NetCashProvidedByUsedInInvestingActivities`. It covers reported cash
from investing activities, including discontinued operations: for example,
loans, investments and acquiring or disposing of productive assets.
**Reported financing cash flow (USD)** uses only
`us-gaap:NetCashProvidedByUsedInFinancingActivities`. It covers reported cash
from financing activities, including discontinued operations, such as owner
funding and returns, borrowing, repayments and long-term creditor financing.
These scopes follow the [FASB 2026 definitions](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-doc-2026.xml).

Both are directly reported USD annual duration concepts. Positive amounts are
net inflows and negative amounts are net outflows; neither sign is inherently
favorable. Reported zero remains zero. Each field retains its actual start/end
dates and accession independently of the other flows and the revenue basis.
The existing 335–395 inclusive-day annual source-admission window and end-year
sanity bound apply. Calendar-aligned Frames can include 52/53-week periods and
annual periods ending outside December.

The separate `ContinuingOperations` variants, custom tags and individual
components never replace a missing exact total. Investing cash flow is distinct
from PP&E purchases, and financing cash flow is distinct from debt issuance,
dividends or changes in equity. The app does not infer that operating, investing
and financing cash flows sum to the change in cash: exchange effects, scope and
source-period differences require separate treatment. Failed, invalid,
conflicting or missing sources leave the affected field unknown.

Both fields support Cash flow/All/individual columns, filters, sorting, source
inspection, comparison and explicit saved views. Old twenty-two calculations,
Overview, Q4 balances, starters and literal saved column lists are unchanged.
Loading an old view adds no field, request or write. Transport v12 coordinates
the expanded response; these reported amounts add no formula or saved-payload
version. Twenty-four fields leave the thirty-metric breadth target open.

### Reported cash and stockholders' equity

**Reported cash and cash equivalents (USD)** uses only
`us-gaap:CashAndCashEquivalentsAtCarryingValue`. The [FASB 2026 documentation](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-doc-2026.xml)
describes cash, demand deposits and qualifying short-term liquid investments.
The app does not substitute the broader cash-plus-restricted-cash concept,
discontinued-operation variants, investments or a cash-flow ending total. It is
not net cash or a claim that every dollar is freely available.

**Reported stockholders' equity (USD)** uses only `us-gaap:StockholdersEquity`:
equity or deficit attributable to the parent, excluding temporary equity and
equity attributable to noncontrolling interests. The broader
`StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest` concept
is distinct and never substituted. A negative deficit is a valid signed amount.
This field is not common equity, tangible equity or market capitalization, and
the app never reconstructs it from assets minus liabilities.

Both concepts are monetary instant items in the [FASB schema](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-2026.xsd).
Use the exact USD Q4 Frame with each amount's own actual balance date and filing.
The existing October 1–December 31 rule applies; zero and negative values retain
their signs. Source filings may differ even within one issuer and date. Missing,
failed, conflicting or out-of-window data stays unknown independently for each
field. No implied cash/equity ratio or cross-field identity is introduced.

The fields appear in Q4 balances, All metrics, individual columns, filtering,
sorting, source inspection, comparison and explicit saved views. Q4 balances now
contains eight fields. Overview and starter definitions stay unchanged. Existing
literal saved column lists retain their exact contents; loading never appends a
new field. An explicit edit and save is required. Twenty-two fields leave the
thirty-metric breadth target open. Dated production coverage and primary-filing
checks, including variants and negative equity, belong in the release handoff.

### Reported total assets and total liabilities

These are separate directly reported amounts from `us-gaap:Assets` and
`us-gaap:Liabilities`, in USD. The [FASB taxonomy](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-2026.xsd)
declares both monetary instant concepts. Assets has a natural debit balance and
liabilities a credit balance; that metadata does not change a reported sign.
Total liabilities includes obligations beyond financial debt. Neither amount is
calculated from current balances, equity or another concept.

Both use the selected year's `CY{year}Q4I` Frame and the existing inclusive
October 1–December 31 actual-date rule. The [SEC Frames documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
describes calendar alignment and warns that reporting dates differ. A Q4 Frame
is not an exact December 31 snapshot or a common fiscal year-end. Inspect the
actual date and accession beside each amount. Missing, failed, conflicting or
out-of-window facts stay unknown, with available source references retained.

Each total is resolved independently. A missing liability amount does not hide
valid assets, and differing dates or filings between the totals do not create
an implicit ratio or paired measure. Existing current-ratio and current-balance
subtraction still use only `AssetsCurrent` and `LiabilitiesCurrent`.

Use either total in filters, sorting, Q4 balances, All metrics, individual
columns, source inspection and company comparison. Overview and starter
thresholds remain unchanged. Existing saved v1 criteria and v2 column lists
retain their meanings and exact columns; an explicit edit and save is required
to add totals. Catalog and My Watchlist share the same definitions.

Fresh coverage and bounded primary-filing reconciliation are recorded in the
release handoff. Listing and unique-issuer counts are separate, and evaluated
securities are not automatically known values. Missing direct liabilities are
not reconstructed to increase coverage. Twenty fields leave the thirty-metric
roadmap and its broader coverage requirements open.

### Current assets less current liabilities

**Current assets less current liabilities (USD)** shows the exact dollar
surplus or shortfall using the existing Q4 balance inputs. It appears in
Q4 balances, All metrics and individual column choices. Other column presets
and all three starter screens keep their existing memberships and criteria.
Signed inclusive filters, ascending/descending sorting, coverage and saved
criteria are available through the ordinary screen controls.

Both operands must be available and nonnegative, with every retained reference
sharing the same admitted actual balance date and filing accession. The existing
October 1–December 31 rule applies. Zero liabilities are valid for subtraction
even though the current ratio is unknown; negative differences are valid.
Subtract exact decimal values without rounding, and preserve both operands and
all references in source details. Revenue basis does not affect this field.

Unknown precedence is unavailable assets, unavailable liabilities,
`balance_date_mismatch`, `filing_mismatch`, then `unsupported_sign` for either
negative operand. Missing, conflicting and failed balances never become zero.
The browser independently verifies the exact subtraction, source multiplicity
and unknown reason. No extra SEC source or cache read is introduced.

This is an app calculation from reported balances, not cash available to spend
or a uniform liquidity test across industries. Dated filing examples retain
their original acquisition dates; reuse does not establish fresh market coverage.

### Selected revenue year-over-year change

Each year resolves the same selected revenue basis independently. Missing or
failed facts never become zero or trigger substitution of another concept.
Current and prior operands retain exact reported values, reasons, actual dates,
concepts and filing accessions. Every source is labeled with its current/prior
role and calendar selection, including sources retained for an unknown result.

The new metric requires all references within each year to agree on the exact
value and supported annual dates (335–395 inclusive days), identical retained
concept sets across years, and current start exactly one day after prior end.
Adjacent 52/53-week years qualify; equal durations are not required. Prior revenue
must be positive. Each year must have one filing accession; the accessions across
the two years may differ. These conservative app rules leave all existing fifteen
metrics unchanged, including their treatment of agreeing revenue references.

Unknown precedence is prior unresolved, current unresolved, unsupported/inconsistent
annual periods, changed concept set, nonadjacent periods, nonpositive prior revenue,
then mixed filings within a year. An unresolved operand retains its own missing,
conflicting or failed-source reason. Failed prior sources affect this growth
metric without hiding current-year metrics.

Compute `(current - prior) / prior * 100` using exact decimal inputs, rounding
once half-up to two decimals. Current zero gives `-100.00`; negative current
revenue can give less than `-100.00`. Rounded negative zero becomes `0.00`.
Inclusive signed filters compare that displayed rounded percentage. The browser
independently checks integer arithmetic, role/year source multisets, each operand
and the complete unknown precedence; percentage results remain strings.

This is reported change from currently extracted filings. Matching concepts,
adjacent dates and filing coherence do not establish organic growth, unchanged
business/accounting scope, restatement comparability or point-in-time history.
Historical source feasibility is not production acceptance of this feature.

### Q4 current balances and current ratio

The new reported operands use only `us-gaap:AssetsCurrent` and
`us-gaap:LiabilitiesCurrent` in USD. The [FASB 2026 taxonomy](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-2026.xsd)
defines both as monetary instant items, with debit and credit balance metadata
respectively. The [FASB taxonomy guide, Example 1a](https://xbrl.fasb.org/impdocs/CNE_TIG/Consolidatedandnonconsolidatedentities.htm)
illustrates their single-date contexts and positive reported liability balances.
The app preserves actual numeric signs; credit metadata does not reverse a sign.
It never substitutes total assets/liabilities, custom concepts or missing zeros.

For selected year `yyyy`, the two inputs come from `CYyyyyQ4I`. The screen uses
only **actual balance dates October 1–December 31 of that year, inclusive**.
This conservative app rule is not a published SEC instant-date tolerance. SEC
Frames select facts best aligned with calendar periods; actual dates differ,
and the documentation does not specify a numerical instant tolerance.
[SEC Frames documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).
The provider retains valid dates within a broad year±1 sanity bound; the engine
marks otherwise valid out-of-window amounts `unsupported_balance_date` and
retains their source values, actual dates and filing accessions for inspection.
Conflicting reported values or dates take precedence over that window check.

The Q4 label does not mean an exact December 31 snapshot, a company's fiscal
year-end, or alignment with an annual flow period. Selected-company and peer
views can use their latest fiscal year; their period selection is separate.
The UI identifies the fixed Q4 Frame and each actual balance date. Instant
references use `asOfDate`; existing annual `startDate`/`endDate` references are
unchanged. Sources may be amended after the requested calendar period.

**Current assets / current liabilities (×)** is an app calculation requiring
nonnegative assets, positive liabilities, and one exact actual balance date and
filing accession across every retained operand reference for the same issuer.
Negative reported balances remain visible; zero assets give `0.00`. Unknown
precedence is unavailable liabilities, unavailable assets, `balance_date_mismatch`,
`filing_mismatch`, `nonpositive_current_liabilities`, then negative assets
(`unsupported_sign`). Both operand reference sets remain visible when the ratio
is unavailable. No older filing is substituted to repair incompatibility.

The ratio is rounded half up to two decimals, without multiplying by 100.
Inclusive filters compare the displayed rounded multiple: `0.995` displays
`1.00` and qualifies for `≥ 1.00`. The browser independently verifies exact
integer arithmetic, every source reference including multiplicity, and unknown
precedence; it preserves the supported 129-character extreme result as a string.
All four balance-sheet fields are independent of revenue basis, and a failed
instant source leaves the thirteen annual metrics unchanged. Current classifications
and industry differences affect comparability.

### PP&E purchases and cash generation

PP&E purchases use only valid `us-gaap:PaymentsToAcquirePropertyPlantAndEquipment`
observations. The [FASB 2026 taxonomy](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-2026.xsd)
defines a monetary duration item; its [documentation](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-doc-2026.xml)
describes cash spent acquiring physical operating assets, including self-construction.
The USD frame is the app's currency boundary. A different or custom expenditure
concept, balance-sheet PP&E change, or missing fact is not a substitute.

**Operating cash flow less PP&E purchases** subtracts the exact reported purchase
amount from operating cash flow. Both inputs must be available for the same issuer,
have the same actual start and end dates within the supported 335–395-day inclusive
annual window, and share one filing accession across every retained reference.
The source details show both inputs even when the subtraction is unavailable.
The selected CY label alone does not establish compatible dates or filing vintage.

Reported signs are preserved. Zero purchases and negative operating cash flow or
negative results are valid. A negative reported PP&E value remains visible but
makes the subtraction unknown (`unsupported_sign`); the app never takes an
absolute value or reverses the input sign. Different periods produce
`period_mismatch`, and different filings produce `filing_mismatch`. An unavailable
operating-cash-flow input takes precedence over an unavailable PP&E input, followed
by period, filing and sign checks. Missing or failed inputs never become zero.

Both fields are independent of revenue basis. A PP&E source failure preserves
metrics that do not use PP&E; an operating-cash-flow failure preserves reported PP&E.
Use **Operating cash flow less PP&E purchases ≥ 0** to find nonnegative results;
negative thresholds are also supported. Coverage and unknown counts describe
listing rows, so multiple listings of one issuer count separately.

The derived amount is an app calculation with its exact inputs displayed. It is
not a reported subtotal or a uniform company-defined free-cash-flow measure.
Other cash commitments and companies' alternative definitions are outside this
calculation. [SEC staff guidance, Question 102.07](https://www.sec.gov/rules-regulations/staff-guidance/corporation-finance-interpretations/non-gaap-financial-measures)
explains why free-cash-flow labels can describe different calculations.

### Operating cash flow less PP&E purchases / selected revenue (%)

This percentage relates the existing exact cash difference to selected reported
revenue. It appears in Cash flow, All metrics and individual column choices,
with signed inclusive filters, sorting, coverage, saved criteria and shortlist
comparison. The three editable starters and other presets keep their existing
memberships and thresholds. Selecting a revenue basis changes this denominator;
it does not change the separate dollar subtraction.

Resolve selected revenue, operating cash flow and PP&E purchases for the same
issuer. Every retained reference across all three operands must share one actual
annual start/end pair within the inclusive 335–395-day window and one filing
accession. This includes every agreeing revenue reference. The shared calendar
Frame alone does not establish compatible periods or filing vintage.

Compute `(operating cash flow - PP&E purchases) / selected revenue * 100` using
the exact original decimals; do not round the intermediate difference or reuse
a rounded percentage. Round once half-up to two decimals and canonicalize
rounded negative zero to `0.00`. PP&E purchases must be nonnegative, and revenue
strictly positive. Zero or negative operating cash flow and negative results
remain valid. Thresholds compare the displayed rounded percentage.

Unknown precedence is unresolved selected revenue, unresolved operating cash
flow, unresolved PP&E purchases, `period_mismatch`, `filing_mismatch`,
`unsupported_sign` for negative PP&E, then `nonpositive_revenue`. Preserve an
unresolved operand's reason and every retained source. Source details identify
all three operands in operating-cash-flow, purchase, revenue order, with actual
dates and filings. The browser independently recomputes exact integer arithmetic,
the source multiset and the complete unknown reason.

This is an app-defined historical cash measure. Other investing flows and cash
commitments are excluded; it is not a uniform free-cash-flow margin, cash
available to shareholders, or an investment-quality score. No new concept,
Frame or per-company provider request is introduced. Older dated filing samples
remain dated evidence rather than a fresh acquisition or broad coverage claim.

### Reported gross profit

Gross profit uses only valid `us-gaap:GrossProfit` observations retained in the
selected annual frame that agree on amount and actual dates. FASB's [2026 taxonomy schema](https://xbrl.fasb.org/us-gaap/2026/elts/us-gaap-2026.xsd)
defines it as a monetary duration item. Its [revenue presentation guide, Example 6](https://xbrl.fasb.org/impdocs/Rev2_TIG/Revenue.htm)
illustrates the concept as the difference between revenue and cost of revenue.
These taxonomy references establish the concept; they do not establish a
company's coverage or make the guide authoritative accounting guidance.

The screen preserves the reported amount, including a negative amount. A missing,
invalid, conflicting or failed-source fact remains unknown. It does not calculate
a replacement from revenue minus costs or substitute another concept. Changing
Revenue basis does not change gross profit. A failed GrossProfit source affects
that field and its ratio, and a failed revenue source does not hide a valid gross-profit
amount. Exact source dates and filing accession remain visible.

This amount can be filtered and sorted like other USD fields.

### Gross profit / selected revenue (%)

This ratio divides the reported gross-profit amount by the selected revenue
amount and multiplies by 100. It is an app calculation, not a company's reported
gross-margin measure or a comparable sector-neutral score. Matching dates and
filing accession establish period and filing vintage; they do not establish that
the company defines gross profit using the chosen revenue concept. The source
details identify the selected denominator and retain both reported operands.

Every retained reference from both operands must share the same actual annual
start/end dates within the inclusive 335–395-day window, and one filing accession.
The operands are resolved for the same issuer. One agreeing revenue concept from
a different filing makes the ratio unknown even when the reported amounts agree.
Unavailable revenue takes precedence over unavailable gross profit, followed by
`period_mismatch`, `filing_mismatch`, then `nonpositive_revenue`. Unknown results
retain available operand references; missing or failed facts never become zero.

Revenue must be positive. Zero or negative gross profit is valid, and negative
ratios or ratios above 100 are preserved. Decimal arithmetic divides before
multiplying, rounds half-up to two decimal places, and normalizes rounded negative
zero to `0.00`. Filters use percent points and compare that displayed rounded
value. The strict browser independently checks the arithmetic, rounding, source
reference multiset and unknown reason using integer arithmetic. This adds no
source concept or provider request to the eight annual inputs.

### Operating cash flow / net income (%)

This app calculation divides reported `NetCashProvidedByUsedInOperatingActivities`
by positive reported `NetIncomeLoss` and multiplies by 100. It compares operating
cash generation with reported net income. It is not a company-reported cash-conversion
measure, a quality score or an industry-adjusted comparison. Working-capital timing
and noncash items can affect the relationship. The source details identify both
operand roles, exact amounts, actual dates and filing accession.

The inputs must belong to the same issuer. Every retained operand reference must
share identical actual start/end dates within the inclusive 335–395-day annual
window and one filing accession. Unavailable net income takes precedence over
unavailable operating cash flow, then `period_mismatch`, `filing_mismatch` and
`nonpositive_net_income`. All available operand references remain inspectable
when the ratio is unknown. No missing value becomes zero and no other earnings
or cash-flow concept is substituted.

Net income must be positive. Zero and negative reported net income remain visible
but cannot serve as this ratio's denominator. Operating cash flow may be zero or
negative; negative ratios and ratios above 100% are retained. Decimal arithmetic
divides before multiplying and rounds half-up to two decimal places, normalizing
rounded negative zero to `0.00`. Inclusive filters compare the displayed rounded
percentage. The browser independently verifies the result, complete source
reference multiset and unknown reason using integer arithmetic.

Revenue-basis changes leave this metric and its reported inputs unchanged. A
revenue or PP&E source failure does not hide it. A failed net-income or operating-
cash-flow source leaves it unknown and preserves the other available reported
operand. No new source concept or request is added to the eight annual inputs.

### Revenue basis

The three source concepts describe different scopes. The selector applies one
rule consistently to every listing in the screen:

| Choice                                   | Rule                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Require agreement                        | Preserve the original rule: all available observations across the three revenue concepts must agree on amount and actual dates. |
| Revenues (broad concept)                 | Use only `Revenues`, which can include earning activities beyond customer contracts.                                            |
| Customer-contract revenue, excluding tax | Use only `RevenueFromContractWithCustomerExcludingAssessedTax`.                                                                 |
| Net sales and services (legacy)          | Use only `SalesRevenueNet`, a legacy concept that can lack current-year coverage.                                               |

An explicit choice never falls back to a different concept for another company.
An absent selected concept remains missing; a failed selected source remains
unavailable. Conflicting observations within the chosen concept stay unknown.
Failures in other concepts remain visible in source coverage but do not replace
the selected definition. Changing the basis clears results and resets pagination;
the next explicit run can reuse the same cached SEC snapshot.

The chosen basis also supplies the denominator of net margin, operating margin
and operating cash flow margin, plus Gross profit / selected revenue (%).
The original three margins' arithmetic and eligibility are unchanged. Equal reported
amounts do not establish equivalent business definitions, and choosing the same
concept does not establish sector or fiscal comparability.

Walmart demonstrates why the choice matters: its fiscal 2026 statement reports
$706.413 billion of net sales and $713.163 billion of total revenue, including
$6.750 billion of membership and other income. Both amounts can be valid for the
same period. [Walmart consolidated statement](https://www.sec.gov/Archives/edgar/data/104169/000010416926000055/R3.htm).
FASB's taxonomy implementation guide likewise illustrates broader revenue
combining customer-contract revenue with other revenue sources; the guide is
taxonomy guidance, not authoritative accounting guidance.
[FASB guide, Examples 10–12](https://xbrl.fasb.org/impguidance/Rev2_TIG/revenue_2.pdf).

For default agreement screens, an absent concept is not zero. Present concepts
must agree on amount and actual dates, and a failed source prevents a claim of
agreement. In every basis, revenue must be positive and numerator/denominator
periods must match exactly for a margin. Ratios reuse shared formula version
1.0.0, Decimal arithmetic and two-decimal half-up rounding. Raw reported
amounts retain normalized decimal precision. Source references expose concept,
filing accession and actual dates for each cell.

Existing four-field saved criteria remain valid and retain the agreement rule.
The optional `revenueBasis` stores an explicit choice. Omitted-basis requests omit
the corresponding response property; explicit requests echo the basis, which the
strict browser client checks against the request. Unedited saved definitions are
not rewritten. Choosing a revenue basis adds no source reads to the thirteen-Frame
load.

### Screening and saved-definition compatibility

Financial-screen requests and responses use `schemaVersion: "12.0.0"` at the
existing route. The response requires `instantQuarter: 4`, exactly twenty-four metric
and coverage keys, sixteen current sources, and three separately typed
`priorRevenueSources` with `priorCalendarYear = calendarYear - 1`. Growth cells
retain typed current/prior operands and source roles without changing old cell
reference shapes. Deploy the API and browser together: old browser
requests are rejected before SEC acquisition, and the new browser rejects old or
partially expanded responses. Reload an older open browser after deployment.

Encrypted saved-definition payloads admit numeric `schemaVersion: 1` for legacy
criteria-only records and `schemaVersion: 2` for reusable column selections.
An explicit new save writes v2; existing v1 records do not change on read. Their
record ID, existing view IDs, names, creation digests and version/conflict behavior
are preserved. Existing criteria load with their original meanings and make a
fresh v12 request only when explicitly run. Fixed Q4 and derived prior year add no criteria property or
saved default; the original four/five-field criteria grammar is unchanged.
The seven-clause limit is unchanged; the cash-difference percentage is an
additional filter/sort choice. Older application versions
cannot execute newly saved criteria containing these fields and reject them rather
than drop a filter. The directly reported activity cash flows, balance totals, cash and equity introduce no new
formula; screen formula-set version 1.7.0 remains unchanged. It includes
`operating_cash_flow_less_ppe_purchases_to_revenue_percent` version 1.0.0 with
expression `(operating_cash_flow - ppe_purchases) / selected_revenue * 100`.
Current-balance subtraction retains version 1.0.0 and its exact expression
`current_assets - current_liabilities`. The revenue comparison policy and
`(current - prior) / prior * 100` calculation are unchanged. Current ratio retains
`current_assets_to_current_liabilities` version 1.0.0 and expression
`current_assets / current_liabilities`. Operating cash flow / net income and
the four older revenue-based margin formulas retain
version 1.0.0 and their rounding; PP&E subtraction retains version 1.1.0 and exact
decimal precision. Other selected-company analytics versions are unchanged.

A selected CY label denotes the SEC's calendar-aligned annual frame, not a
common fiscal year across issuers. Annual durations are checked within the
SEC's documented approximate annual window. Historical frame years may
include subsequently filed or restated values. This is current extracted
annual evidence alongside separately dated instant balances, not point-in-time
data, TTM, valuation or forecast growth.
USD and US-GAAP coverage excludes facts reported only in other currencies,
IFRS concepts or unsupported custom extensions.

## Query and operational behavior

- At most 10,000 admitted common-stock/ADR listings, joined to SEC issuer CIK.
  Multiple listings of one issuer share financial facts and count as separate
  listing rows; denominators are labeled securities, not unique companies.
- Seven optional AND clauses with inclusive numerical bounds; stable sorting,
  250-row API pages, up to 20 saved named definitions. A false clause makes
  the row a non-match; otherwise an unknown clause leaves it unknown.
  With no numerical clause, identity matches remain visible with unknown cells.
- Coverage is measured over the identity-filtered cohort. Match, non-match
  and unknown counts reconcile to that cohort. Missing, conflicting,
  incompatible and failed-source values never become zero.
- One operation fetches nineteen fixed cross-company Frames sequentially: ten
  annual requests followed by six Q4 instant requests and three prior
  revenue requests, at
  fewer than five requests per second. Each request has a 10-second deadline,
  an 8 MiB response cap and 50,000-row bound. Redirects and arbitrary URLs
  are rejected. Same-year concurrent requests share an operation; another
  year returns busy until it completes.
- One normalized public snapshot is cached in API memory for 30 minutes.
  Its digest binds both years, fixed quarter, separate current annual/instant and prior revenue frame
  contents and source statuses. Cached paging and revenue-basis choices add no reads.
  Explicit refresh bypasses it. Cache data is cleared when the API closes.
  Browser results are discarded on owner-session loss. There is no raw SEC
  source file, browser storage, vault retention, export or logging of rows.
  Saved definitions use the existing encrypted vault's version/idempotency
  behavior in a separate `financial-screener-saved-views` settings record.
- Per-source errors remain visible as coverage failures, including partial
  and all-source failures. This source does not use or promote the historical
  selected-filing release/acceptance pipeline.

## Acceptance and remaining work

### Session activity while screening

A successful Run, Refresh or page request refreshes the browser's idle activity
without clearing the screen. Its activity time is captured before the request;
a delayed reply does not earn extra time for its delay. The response must pass
validation and still belong to the current screen and owner session. Missing
source data in an otherwise valid response does not prevent activity credit.
Failed, cancelled, superseded or malformed requests and local criteria edits do
not count. Saving or loading definitions and other private-data flows are outside
this activity integration.

The ten-minute idle limit and sixty-minute absolute limit remain unchanged.
A browser that discovers an existing session cookie still has its conservative
ten-minute maximum local lease, because it cannot know that cookie's creation
time. Activity cannot extend that ceiling or revive an expired session. Hidden
tabs, session replacement and session loss continue to clear private results.
No polling, automatic source refresh, extra request or credential storage is added.

### Financial acceptance

Cash-difference percentage acceptance covers all three original operands,
fractional inputs, signed and zero results, half-up ties, negative zero and the
maximum bounded result. It checks all retained dates and filing references,
unknown precedence, source multiplicity, signed filters and stable sorting,
saved-v1 round trips, and preservation of the previous seventeen cells and
coverage across revenue bases. The independent browser rejects forged amounts,
operands, references and reasons. Dated same-accession Apple and Walmart samples
can be combined offline only while retaining each receipt's acquisition time;
this assembled replay is not a complete historical snapshot or fresh acquisition.

Current-balance subtraction acceptance covers exact positive, zero, negative,
fractional and extreme differences, including zero liabilities; every-reference
date/filing checks; unavailable-input and sign precedence; signed filters,
ordering, saved-v1 round trips and unchanged prior sixteen metrics across revenue
bases. The decoder rejects forged values, reasons and reference multisets. Reuse
the dated corroborated AAPL operands to verify a USD -4,263,000,000 difference;
WMT's retained out-of-window balances must remain unknown. Actual verification
and configured browser observations belong in the local release handoff.

Current-balance acceptance additionally covers the inclusive October/December
boundaries and excluded September/January dates with retained references,
conflict/window precedence, later-reference mismatches, nonpositive liabilities,
negative assets, zero and half-up ties, the maximum exact multiple, wrong units,
period shapes and reconstructed Q4 URLs. Combined snapshot tests must preserve
all thirteen annual cells under instant-source failure and verify saved-v1 round
trips and source-free cached paging. Production ten-Frame coverage, exact
listing/issuer denominators, bounded primary-filing checks and configured browser
acceptance remain release-specific evidence in the local handoff. Preliminary
two-Frame feasibility is not production acceptance.

Engineering tests cover precision, concept conflicts, date alignment, missing
values, thresholds, coverage arithmetic, ordering, snapshot-bound pages,
bounded transport, cancellation, authentication, and saved-definition
conflicts. UI tests cover explicit run/refresh, filters, paging, save/load,
open/watchlist actions and session cleanup.

PP&E acceptance covers exact subtraction, reported signs, zero and negative
results, all-reference period/filing compatibility, unavailable-input precedence,
source-failure isolation, signed filters, coverage and stable pages. The strict
browser decoder checks the result and its exact source references against both
reported operands. Existing saved definitions remain intact through the original
conflict/version behavior. Measure final production coverage on a fresh production
snapshot; preliminary two-frame feasibility and historical results below do not
establish release acceptance. Actual observations and independently checked filing
samples belong in the local release handoff.

Gross-profit ratio acceptance covers all four revenue policies, all-reference
period/filing eligibility, deterministic unknown reasons, signed and extreme
decimal inputs, half-up boundaries, rounded thresholds, source-failure isolation,
stable pages and saved-definition compatibility. Browser cases reject forged
values, references and reasons, including maximum-length results. Cache tests
verify nineteen initial reads, no additional reads when changing revenue basis, and
nineteen reads on explicit refresh. Actual live ratio coverage and bounded primary
filing comparisons belong in the local release handoff; synthetic cases and the
historical observations below do not establish coverage of this new ratio.

Operating-cash-flow-to-net-income acceptance additionally checks positive-income
eligibility, unavailable-input precedence, independence from all revenue choices,
signed ratios and the exact maximum-length result. Saved-v1 definitions, source
caps and request counts are unchanged. Measure fresh joint eligible coverage,
including unknown reasons and nonpositive-income exclusions, and inspect bounded
primary filing samples for both operands. Existing individual net-income and
operating-cash-flow coverage counts do not establish joint eligibility. Actual
release and configured-browser acceptance belong in the local handoff.

The original agreement mode was measured on 2026-09-11 against an admitted
3,227-listing catalog and verified through authenticated Chrome. Known coverage
ranged from 1,887 listings for operating margin to 2,847 for operating cash flow.
The live source set had five available concepts and SalesRevenueNet not covered.
These observations describe that snapshot and the original basis only; they do
not establish coverage for every explicit basis or a later source observation.
Actual release and live acceptance results belong in the local handoff. Synthetic
fixtures establish behavior, not real-market completeness. Full Cycle 3k-a2
remains open until the roadmap's 30-core-metric, 500-security, coverage,
independent validation and performance requirements are met. Further growth,
price, valuation, ranked presets and historical replay remain later work.
