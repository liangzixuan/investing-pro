# Research source eligibility

This candidate connects the existing annual screen and company research through
independent source eligibility. The named cohort remains 18 listings for
17 issuers. It does not add broader Price coverage or a new research dashboard.
[Current work](CURRENT_WORK.md) records source and delivery acceptance.

## Continue from a screen result

Run the [annual financial screen](MANAGED_FINANCIAL_SCREEN.md), inspect a result
and open its company research. The captured Annual response keeps its original
dates and does not trigger another Annual read. Back retains the screen criteria,
results and session shortlist.

The existing **Research sources** cards show each source independently:

| Source  | Candidate scope                                                       | Read action                                                             |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Annual  | The named 18 listings, representing 17 qualified issuers              | Explicit Load or Refresh; a screen handoff reuses its captured response |
| Filings | The same named listings, independently qualified from SEC Submissions | Explicit Load or Refresh after API admission is delivered               |
| Price   | AAPL, GOOG and GOOGL only                                             | Explicit Load or Refresh for the selected range                         |

An unavailable source keeps its explanation and Inspect action. Inspect opens
the source section without a request. It cannot enable Load or Refresh for an
unsupported selection. A separately validated captured response can remain
inspectable with its original dates even when a new read is unavailable.
Annual, Filings and Price do not infer each other's
eligibility. An admitted source can still return an unavailable result or refuse
particular values; coverage does not promise source availability or complete data.

For example, AMD can continue from a captured Annual result to an explicit Filings
read in the admitted candidate. Price stays unavailable for AMD, with no Price
request. Opening the company or another source never loads it automatically.

## Keep evidence and saved work separate

Filings keeps its original inclusive 90-date window, capture times, exact forms,
accessions and SEC index links. It loads only the current Submissions metadata;
unloaded continuation files and filing bodies remain separate. The captured
qualification corpus does not become a current live response.

Annual note actions preview the complete candidate before Append. A Filings
reference action adds its bounded cited paragraph to the current draft; it does
not add another preview step. Review the complete draft before normal Save.
These actions retain their conflict, uncertain-save and catalog checks.
Back keeps the owning screen or Watchlist state. This adds no automatic Save,
saved research cache, valuation model storage or transfer of unrelated drafts.

## Identity and delivery limits

Eligibility binds the published catalog digest and complete listing/share-class
identity. A Watchlist or screen selection without a CIK can use only the CIK from
that exact known identity. A ticker, claimed CIK, partial identity or old catalog
digest cannot expand coverage. Server catalog lookup and capability admission
remain authoritative. Imported draft files still need independent catalog review.

The Annual and Filings memberships are independent, even when they contain the
same issuers. Price retains its existing exact mappings and provider limits.
Unknown listings stay visible with an unavailable explanation.

The deployed API still has its earlier Filings admission until the reviewed API
change is activated. Client delivery must follow compatible API admission; a
source merge or successful offline replay does not activate it. Captured-source
qualification, synthetic workflow checks, API activation, website publication,
Android delivery and physical acceptance remain separate.
