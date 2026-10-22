# Annual financial screening

Discover connects an explicit annual financial screen to source inspection,
a session shortlist and company research. It uses a named cohort of 18 listings
for 17 issuers. It does not establish whole-market coverage or InvestingPro parity.
The [source eligibility candidate](MANAGED_RESEARCH_ELIGIBILITY.md) carries a
result into company research with independent Annual, Filings and Price scope;
it retains this screen's explicit reads and captured Annual handoff.

## Choose companies and criteria

Select **Load screening cohort** to resolve the current catalog identities.
This reads catalog metadata; it does not load financial reports. The first
listing for each issuer is selected. Choose one Alphabet share class per run;
GOOG and GOOGL do not share a relabelled report packet.

Add up to seven criteria. Each compares one field with an exact signed decimal
threshold, using **At least** or **At most**. Apply the criteria before running.
Partly entered or invalid thresholds remain visible and block Run. Editing and
restoring the same text does not revive an old result action.

The six fields reuse the existing Annual financial calculations:

| Field                                   | Basis                                                           |
| --------------------------------------- | --------------------------------------------------------------- |
| Reported operating income               | Exact signed USD amount                                         |
| Reported operating cash flow            | Exact signed USD amount                                         |
| Operating cash flow less PP&E purchases | Existing subtraction of the two exact annual amounts            |
| Working capital                         | Existing subtraction of current liabilities from current assets |
| Reported parent equity                  | Exact signed USD amount                                         |
| Current assets / current liabilities    | Existing current-ratio result and rounding policy               |

Flow amounts retain their actual start and end dates. Balances and the current
ratio retain their actual balance dates. These periods can differ between
companies. There are no invented calendar-year, Q4 or TTM labels, reconstructed
missing values, valuation scores or automatic recommendations.

## Run and inspect

**Run screen** reads only the selected finite cohort. Reads are sequential, with
at least 20 seconds between dispatches and the existing shared SEC admission
deadline. Seventeen companies need at least five minutes and twenty seconds
between the first and last start, plus request time. A checked cooldown can
extend the wait. A failed read is recorded without an automatic retry.

**Cancel screen** aborts a pending read or wait. Completed reports keep their
original source clocks; queued companies remain **Not loaded**. A service
request already admitted there can finish without changing a cancelled run.
Catalog, access or source-configuration loss stops the affected operation.

Every selected criterion must pass. If a required value is unavailable or not
eligible for current use, its result is **unknown**, unless another known
criterion already fails. A known failed criterion produces a **nonmatch**.
Missing values are never zero. Historical values remain inspectable but cannot
pass current-use filters. Available values sort before unknown values in either
direction; equal values use stable symbol and listing ties. With no numerical
criteria, admitted companies are included and source failures remain separate.

Each result shows all six fields, their independent refusals and actual periods.
**Inspect evidence** retains the original target filing, two source URLs,
capture dates, hashes, sizes and exact observation references. It reuses the
statement explorer's source inspector. Opening it makes no source request.
Partial or cancelled runs state which companies were never read.

## Continue research

Choose two loaded results for [Annual statement comparison](MANAGED_SCREEN_COMPARISON.md)
before continuing either company's research. The pair uses the already loaded
reports and retains each company's independent dates and source context.

Shortlist a result or choose **Research** after the run finishes or Cancel
settles. The exact report is validated for that company visit and identified as
coming from financial screening. This handoff makes no additional Annual read.
Refresh remains explicit. Company note actions, complete-note Preview,
single-use Append, Review, Save and recovery retain their existing controls.
Captured company JSON and HTML reports retain the financial-screen origin and
the complete admitted Annual graph.

Back returns to the original criteria, dates, results and session shortlist.
Opening another view cancels pending screen reads and retains completed results.
Watchlist, Follow-ups and Portfolio drafts remain independent. Selecting a
shortlist alone does not change or save these records. Retiring the session clears this temporary
screen. Stale, replaced and foreign result handles cannot open research.

## Keep the shortlist in My Watchlist

After a run finishes or Cancel settles, shortlist the loaded companies you want
to keep. **Review shortlist for My Watchlist** prepares a complete listing
review without changing a draft or reading a source. The review shows each
listing's full identity, whether it will be added or already exists, and the
original run times. A shortlist can contain matches, nonmatches or unknowns;
your selection does not establish an investment verdict.

**Add listings to Watchlist draft** appends only missing listings, in shortlist
order, with empty notes. Existing entries retain their exact notes and order,
including unsaved or invalid raw note text. A changed identity or insufficient
room refuses the whole operation. It never replaces an existing company by
ticker or makes a partial addition. **Keep Watchlist unchanged** cancels the
review. Financial values and criteria are not copied into notes automatically.

Choose **Review and save in My Watchlist** to inspect the full draft and use its
existing explicit Save. Returning to Discover retains the screen. Research still
opens the exact loaded Annual report, and Back retains the original results.
Follow-ups and Portfolio stay independent.

A loaded, editable Watchlist with a current catalog is required. Pending saves,
conflicts, uncertain receipts and imported identities needing review must be
resolved through My Watchlist first. Changing the shortlist, run, criteria,
catalog, draft, save state, visit or session invalidates the old review. Prepare
a new review after the change. Applying a review consumes it before draft
listeners run, so a captured action cannot apply twice.

This candidate reuses the existing shortlist, catalog identities and Watchlist
save coordinator. It adds no resource, provider, dependency or automatic read.
Source, rendered layout, native execution, publication and phone acceptance
remain separate in Current work.

The interaction follows the established pattern of selecting screener results
before explicitly adding them to a watchlist, described in the
[TradingView help guide](https://www.tradingview.com/support/solutions/43000473930-how-to-add-the-screener-search-results-to-the-watchlist/).
This implementation keeps Investment's full identity review and separate Save.

## Source scope and acceptance

Annual eligibility is separate from Filings and Price eligibility. The initial
Annual cohort adds BKTI, AMD, MATX, ALCO, LNG, SWKS, HWM, UHAL, AXP, AFL, AIG,
UNM, AVD and AP to the existing Apple, Alphabet and Microsoft issuer scope.
Filings retains its prior three-issuer scope. AEM is excluded: its current
annual filing is a 40-F; an observed 2012 20-F is not current coverage.

An October 17 qualification made one bounded capture of the two fixed SEC JSON
resources for each additional issuer. The 28 requests had no retries or
redirects. Original bodies, hashes and clocks were retained privately. All
fourteen pairs passed the existing exact-number parser, 32 independent concept
scans, canonical version 6 builder and unchanged 2 MiB encoder. Company Facts
bodies were 2,408,693–6,911,912 bytes; canonical responses were
38,315–61,255 bytes. Absent concepts remain unavailable. This local evidence
does not establish deployed authentication, admission latency, future source
health or an operational service-level objective.

The [SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
describes the public resources and their taxonomy limits. The
[SEC dissemination policy](https://www.sec.gov/about/privacy-information) is the
source-use reference. Existing attribution, declared automated contact, two
fixed requests, 8 MiB source cap, source deadlines, row limits and managed
admission remain. No cloud resource, provider subscription or storage service
is added. Source checks, packaged native execution, visual acceptance,
integration and publication are separate in [Current work](CURRENT_WORK.md).
