# SEC annual financial screening

This is the first partial Cycle 3k-a2 product slice. It adds a usable numerical
screen to Discover without expanding company-by-company provider calls.

## Use and source setup

In the API process, set `PERSONAL_SEC_USER_AGENT` to a declared application
name and the owner's real contact email (for example, a value shaped like
`ResearchCockpit owner@example.com`). The address must be real for the
configured deployment. Keep the actual contact out of Git. This optional setting
does not affect catalog discovery or Tiingo company views. If it is missing or
invalid, the screen gives an actionable configuration error.

Open Discover, start the owner session, and use **Annual financial screen**.
Choose a completed calendar year, add numerical thresholds, and explicitly run
the screen. Choose a **Revenue basis** when you want one reported concept to
drive revenue and all three margin denominators. Amount thresholds use USD;
margin thresholds use percent points.
Open or watchlist a result using its exact catalog listing identity. Save a
named definition to reuse criteria, then explicitly rerun it when loaded.
Refresh requests a new source read. Page navigation remains bound to both
catalog and financial content digests; changed content requires a rerun.

The seven public endpoint templates are
`https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/USD/CY{year}.json`.
Concept and unit are fixed in code; the only selection is a completed year
from 2009 onward. No API key or commercial subscription is needed for these
public SEC APIs. SEC documents cross-company Frames, calendar alignment,
differing reporting dates and nightly bulk alternatives in its
[EDGAR API guide](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).
The SEC's [webmaster guidance](https://www.sec.gov/about/webmaster-frequently-asked-questions)
explains declared automated access and reuse of public filing information;
[developer resources](https://www.sec.gov/about/developer-resources)
set an aggregate ceiling of 10 requests per second. Reviewed 2026-09-09.

## Metrics and comparability

| Metric                     | Input or formula                                                                | Unit    |
| -------------------------- | ------------------------------------------------------------------------------- | ------- |
| Revenue                    | Selected revenue basis; the default requires agreement among available concepts | USD     |
| Gross profit               | `GrossProfit`, as reported; no calculation from revenue and costs               | USD     |
| Net income                 | `NetIncomeLoss`                                                                 | USD     |
| Operating income           | `OperatingIncomeLoss`                                                           | USD     |
| Operating cash flow        | `NetCashProvidedByUsedInOperatingActivities`                                    | USD     |
| Net margin                 | Net income / revenue × 100                                                      | percent |
| Operating margin           | Operating income / revenue × 100                                                | percent |
| Operating cash flow margin | Operating cash flow / revenue × 100                                             | percent |

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
only that field, and a failed revenue source does not hide a valid gross-profit
amount. Exact source dates and filing accession remain visible.

No gross-margin ratio is added. Matching dates alone would not establish that
gross profit uses the selected revenue definition. This amount can be filtered
and sorted like other USD fields; it is not a comparable sector-neutral score.

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
and operating cash flow margin. Their arithmetic is unchanged. Equal reported
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
not rewritten. Choosing a revenue basis adds no source reads to the seven-frame
load.

### Screening and saved-definition compatibility

Financial-screen requests and responses use `schemaVersion: "2.0.0"` at the
existing route. The response contains exactly eight metric and coverage keys and
seven distinct source concepts. Deploy the API and browser together: old browser
requests are rejected before SEC acquisition, and the new browser rejects old or
partially expanded responses. Reload an older open browser after deployment.

Encrypted saved-definition payloads retain numeric `schemaVersion: 1`. Their
record ID, existing view IDs, names, creation digests and version/conflict behavior
are unchanged. Existing criteria load with their original meanings and make a
fresh v2 request only when explicitly run. The seven-clause limit is unchanged;
Gross profit is an additional field/sort choice. Older application versions cannot
execute newly saved GrossProfit criteria and reject them rather than drop a filter.
Formula version stays 1.0.0 because the existing ratios are unchanged and gross
profit is a reported amount.

A selected CY label denotes the SEC's calendar-aligned annual frame, not a
common fiscal year across issuers. Annual durations are checked within the
SEC's documented approximate annual window. Historical frame years may
include subsequently filed or restated values. This is current extracted
annual evidence, not point-in-time data, TTM, valuation or growth screening.
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
- One operation fetches seven fixed cross-company frames sequentially, at
  fewer than five requests per second. Each request has a 10-second deadline,
  an 8 MiB response cap and 50,000-row bound. Redirects and arbitrary URLs
  are rejected. Same-year concurrent requests share an operation; another
  year returns busy until it completes.
- One normalized public snapshot is cached in API memory for 30 minutes.
  Explicit refresh bypasses it. Cache data is cleared when the API closes.
  Browser results are discarded on owner-session loss. There is no raw SEC
  source file, browser storage, vault retention, export or logging of rows.
  Saved definitions use the existing encrypted vault's version/idempotency
  behavior in a separate `financial-screener-saved-views` settings record.
- Per-source errors remain visible as coverage failures, including partial
  and all-source failures. This source does not use or promote the historical
  selected-filing release/acceptance pipeline.

## Acceptance and remaining work

Engineering tests cover precision, concept conflicts, date alignment, missing
values, thresholds, coverage arithmetic, ordering, snapshot-bound pages,
bounded transport, cancellation, authentication, and saved-definition
conflicts. UI tests cover explicit run/refresh, filters, paging, save/load,
open/watchlist actions and session cleanup.

GrossProfit acceptance also covers exact reported precision and negative values,
unknown reasons, independence from revenue basis, source-failure isolation,
filter/count/page consistency, seven-source cache reuse and strict transport
versioning while preserving historical saved criteria. Source coverage for the
new field must be measured on a fresh seven-frame snapshot; the older six-frame
results below do not establish it. Actual observations and independently checked
filing samples belong in the local release handoff.

The original agreement mode was measured on 2026-09-11 against an admitted
3,227-listing catalog and verified through authenticated Chrome. Known coverage
ranged from 1,887 listings for operating margin to 2,847 for operating cash flow.
The live source set had five available concepts and SalesRevenueNet not covered.
These observations describe that snapshot and the original basis only; they do
not establish coverage for every explicit basis or a later source observation.
Actual release and live acceptance results belong in the local handoff. Synthetic
fixtures establish behavior, not real-market completeness. Full Cycle 3k-a2
remains open until the roadmap's 30-core-metric, 500-security, coverage,
independent validation and performance requirements are met. Growth, price,
valuation, ranked presets and historical replay remain later work.
