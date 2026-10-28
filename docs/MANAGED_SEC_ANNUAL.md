# Managed annual reports

The managed client opens an Annual report panel from a current Discover result
or watchlist listing. Loading is explicit. The workspace stays mounted so its
watchlist draft survives opening and closing the report. Selection, catalog and
session changes retire the old request and evidence; editing a note does not
invalidate an unchanged listing. Workspace CURRENT records actual delivery.
The [source eligibility candidate](MANAGED_RESEARCH_ELIGIBILITY.md) keeps Annual
admission independent from Filings and Price. The named Annual cohort remains
18 listings for 17 issuers, including exact-identity Watchlist and screen handoffs
whose selection has no CIK. Unsupported selections remain inspectable without
enabling a source read.

An explicit refresh keeps the last validated report for that selection readable.
The panel labels it as the previous report while the refresh is pending, after a
timeout or unavailable response, during shared cooldown, or when that refresh
is cancelled. Its original source and observation dates remain unchanged. A
new valid response replaces it, including a response whose evidence is
unavailable. Initial-load failures still have no report to show.

Malformed or mismatched responses, a service that is not configured and unknown
failures clear the previous report. Account denial, catalog or selection changes,
Back and session retirement also clear it. Retention is limited to the current
company visit in memory; it adds no persistence, automatic retry or source request.

The Price section uses the same captured listing. Switching cancels a pending
Annual read and retains its validated report, including the previous report from
a cancelled refresh. Returning to Annual sends no request. The company visit
preserves the original workspace opener and draft, keeps the Annual cooldown and
requires an explicit first load in each section. See the
[navigation contract](MANAGED_RESEARCH_NAVIGATION.md) and
[current delivery status](CURRENT_WORK.md).

The [Annual-to-note workflow](MANAGED_RESEARCH_NAVIGATION.md#add-annual-evidence-to-a-note-draft)
is delivered on the website and in signed Android 1.10. It appends one chosen
eligible pair to an existing watchlist-note draft, retaining the exact values,
named revenue basis, filing link and original dates. Appending does not load
evidence or save the watchlist. **Save watchlist** saves the whole draft,
including other changes. Existing request lifetimes, response validation and
source budgets remain unchanged. [Current work](CURRENT_WORK.md) records the
release and its limits.

The source candidate also supports an [explicit Annual revenue basis for authored
valuation](MANAGED_VALUATION_WORKBENCH.md#apply-a-reported-annual-revenue-basis).
Choose one exact reported concept, preview complete before/after inputs and apply
only exit-model Starting revenue. Original filing identity, periods and clocks
stay attached to the current cited Exit note. Calculate, append, report capture
and the two independent Saves remain explicit. No DCF cash flow is inferred.

Android Back uses the same close action as Back to workspace: it cancels a
pending read, keeps the watchlist draft and restores focus to the opening
control. The native listener belongs to the active workspace and is removed
when it retires. A late response cannot reopen the report. Isolated emulator
tests exercise this interaction with invented data; they do not accept a live
SEC request or a production sign-in.

The server admits the exact listing ID, symbol and current catalog digest before
resolving the issuer. The reviewed cohort maps AAPL to Apple, MSFT to Microsoft
and keeps GOOG and GOOGL as distinct listings for the same Alphabet issuer. The caller cannot send
an arbitrary CIK or source URL. This is limited annual filing and reported-fact
coverage, with source dates and availability shown by the existing renderer.

Annual coverage is separate from Price coverage. Microsoft has no admitted Price
mapping in this workspace. Its Price section explains that history is unavailable
and offers no provider load, chart or Price evidence action. Annual, the shared
note draft and Back remain available. Existing price mappings keep their exact
listing identities. Catalog admission neither enables a price feed nor changes
the three-listing Markets board.

## Review financial facts in the company note

After an explicit Annual load, **Financial review** shows five independent facts:
reported operating income, reported operating cash flow, operating cash flow less
PP&E purchases, working capital and reported parent equity. Values remain exact,
unscaled USD. Positive, zero and negative describe the amount. They are not
financial-health ratings or recommendations. Each fact keeps its own dates,
current-use qualification and unavailable reason. Missing revenue or net income
does not hide valid cash or balance facts.

**Inspect inputs** moves focus to that fact's existing Annual section without a
request. Calculation inputs remain available in the review and full section.
Parent equity excludes noncontrolling interests. Cash after PP&E purchases uses
the existing subtraction without adjustments for leases, acquisitions or other
investing cash flows. Working capital uses the admitted same-date current
assets less current liabilities. Flows and balances are not compared with each
other.

Open **Add financial facts to the note draft**, select facts, then choose
**Preview financial review**. Nothing is selected initially. The preview shows
the complete candidate note, including the exact authored text, selected facts,
calculation operands, observation references, filing link and original source
dates. Unavailable and historical facts keep those qualifications. The complete
proposal must fit the existing single-line, 2,000-character note limit. If it
does not fit, select fewer facts or edit the note. No selected evidence is clipped
or silently omitted.

**Add financial review to note draft** applies only that reviewed proposal.
Changing the note, source state, visit, catalog or save state invalidates it.
Editing and restoring the same note cannot restore an old preview. Failed
refresh and Cancel can keep the previous report readable; prepare a new preview
to include its retained-report warning. Pending source work blocks append.

Use **Review in My Watchlist** and **Save watchlist** to save the full draft
explicitly. Follow-ups keeps its separate draft and Save. Prepare the existing
company report after append to capture the authored note and complete admitted
Annual packet. This workflow adds no provider request, saved review field,
report schema, composite score or generated thesis. [Current work](CURRENT_WORK.md)
records verification and delivery status.

## Reported balance sheet totals

The Annual 5.0.0 candidate adds three independent totals from the selected annual
filing: total assets (`Assets`), total liabilities (`Liabilities`) and equity
attributable to the parent (`StockholdersEquity`). The company snapshot and
captured research report reuse the same admitted values and original dates.
Current work records verification and delivery status.

Each amount is exact, unscaled USD at the selected filing's report-end date.
The observation must establish an instant balance, annual filing focus and
matching filing metadata. Zero and negative reported amounts remain signed.
Missing income does not hide a valid balance. Missing or refused totals retain
their own reason; the app does not subtract totals, fill an accounting equation,
substitute current assets or equity including noncontrolling interests, or use
another filing, taxonomy or currency. These are reported balances, not market
values or a complete financial statement.

**Balance sheet totals** in **On this report** moves focus to this section.
Its source disclosure includes each fixed concept, exact observations, filing
index, source pointer, reference IDs, scan counts and original capture times.
Current-use qualifications apply independently at the original load. Preparing
a report does not refresh them or fetch another source.

The existing Submissions and Company Facts requests, issuer cohort and time and
byte limits remain unchanged. Each new concept has its own 10,000-row scan and
100-observation selected-filing limit. Selected overflow withholds that whole
metric. The complete graph, including all 1,000 possible observations, must fit
the existing 2 MiB response limit and the captured document limit. Annual schema
and definition 5.0.0 require coordinated API, website and Android clients; older
Annual packets are refused. Saved watchlists and follow-ups do not change.

## Read reported balance-sheet history

Open **Reported balance sheet history** below the current totals. The table shows
the selected filing report date and up to two earlier reported dates, newest
first. Total assets, total liabilities and shareholders’ equity attributable to
the parent are checked independently at each date. Exact signed USD values,
including zero and negative equity, are kept without an equation or ratio.

A missing or conflicted cell stays visible beside valid cells. Dates need not be
consecutive year-ends. A refused date is not replaced by an older date to fill the
table. Invalid scans, selected-row overflow or future dates refuse the affected
metric; its dates cannot displace valid sibling dates. The existing current
totals above the history keep their original resolution. Shared source or filing
refusals and current-use expiry make history unavailable without erasing those
totals.

Earlier amounts are historical comparatives reported in the selected filing.
They retain that filing’s original report date, accession and source coordinates;
the comparative row’s end date supplies the table column. No restatement or
accounting adjustment is made, and the table does not establish a complete or
as-originally-filed timeline. Open **History source references** for each cell’s
observation IDs, then inspect the original rows in the existing balance-sheet
source disclosure. Missing cells have no references; refused cells retain their
relevant inputs.

Opening these disclosures adds no request. Annual v5 and its existing bounds are
unchanged. The snapshot retains current totals; a prepared report captures the
complete original Annual packet, including these comparative observations and
clocks. Failed refresh, Cancel, late completion, selection change and session
retirement retain the existing source, report and saved-draft rules.

### Read reported balance sheet change

Inside **Reported balance sheet history**, **Reported balance sheet change**
shows three independent app calculations in USD: current minus prior total assets,
total liabilities and parent equity. The two dates are the first two displayed
history dates. They need not be consecutive year-ends. Exact signed differences
retain zero and negative inputs; they are not growth rates, annualized returns or
a ranking of financial strength.

Each calculation requires its own amount at both dates. Missing or refused cells
retain their current or prior reason; an older available value cannot replace
them. One date leaves the prior amount unavailable. All original amounts,
observation IDs, filing coordinates and source clocks remain in the history and
source disclosures. Existing history eligibility governs the calculation at the
original load; historical prior amounts do not acquire a current-use label.

The shared domain calculation consumes the already resolved history. It uses
isolated Decimal.js precision without rounding or scaling the dollar difference.
Opening history adds no request, note action or save. Current totals, the snapshot
and captured report format are unchanged; the complete captured Annual packet
retains the inputs needed to reproduce the difference. Source, browser, native
and delivery acceptance remain separate in [Current work](CURRENT_WORK.md).

## Watchlist Annual comparison

**Compare annual results** lets the owner choose two different companies from
the complete current watchlist draft. Both selectors start empty. Each report
has its own explicit Load, Refresh and Cancel controls; one comparison read can
run at a time through the existing shared SEC admission boundary. Different
share classes of the same issuer cannot fill both columns. Selecting a company
or revenue basis sends no request and changes no note or saved payload.

The comparison shows each company's exact annual period, named revenue basis,
unscaled USD revenue and net income, net margin and available reported revenue
change. Each column retains its own filing and original load dates. A visible
basis choice keeps concepts separate. A chosen basis that disappears on refresh
becomes unavailable; another concept cannot silently replace it. Current-use
restrictions remain visible, and valid historical amounts do not enable an
ineligible growth comparison. Different fiscal calendars and accounting bases
are shown without adjustment or cross-company ranking.

**Calculation methods and comparison limits** is an initially closed disclosure
after the table and before the note action. It keeps the complete operating-margin,
cash, liquidity and balance-sheet explanations available without a source request.
Each cell's dates, qualifications and refusal stay visible. A short visible
reminder keeps differing periods and the parent-equity scope clear.

Basis choices and the comparison table use the same distinct readable names as
the financial overview. A wrapping line below each native selector shows the
complete selected name even when that basis is unavailable. The control references
that line for assistive technology. Exact source concepts remain in each
column's source details; selecting a readable name still selects that exact
concept.

Invented-data Chrome checks at 1440, 390 and 320 CSS pixels accept these labels,
wrapping selected names, exact source keys and separate amounts. The basis
selector and results region retain keyboard focus through report replacement.
Changing or clearing a company resets its basis; selecting a name adds no
request or note change. Native popup geometry and hosted picker execution are
separate acceptance in current work.

Full source and validation details remain available for each column. Long values
wrap inside a contained table scroll region; keyboard users can focus the region
and use arrow keys. Controls stack at narrow widths with the managed 44px targets.

Note edits, reordering and Save preserve unchanged selections and reports. Leaving
My Watchlist cancels a pending read and retains accepted data for the mounted
session; returning never loads automatically. Removing a selected membership,
changing its identity or invalidating the catalog clears the affected selection.
Session retirement clears both columns. Refresh failure, invalid response and
source eligibility use the existing Annual report rules. This comparison adds
no field, feed, cohort, API schema, persistence or automatic refresh.

### Compare liquidity between companies

Four rows after cash generation show **Current assets**, **Current liabilities**,
**Working capital** and **Current ratio** from each loaded report. Balances and
working capital retain exact, unscaled USD strings. Current ratio is a multiple
rounded to two decimal places, half up. Each value shows its own balance date and
current-use qualification; the companies may have different fiscal year ends.

Working capital subtracts current liabilities from current assets. Current ratio
divides current assets by current liabilities. Both require nonnegative balances
from the same filing and date; the ratio also requires positive liabilities.
Zero liabilities leave working capital available with an explicit ratio refusal.
Negative working capital is a valid result. Missing or rejected values retain
their own explanation, independent of income, cash and the selected revenue basis.

Each company's existing source disclosure includes the original instant
observations, filing links, source captures and calculation references. Refresh,
failure, cancellation, selection and session retirement follow the existing
report owner. Rendering and changing a basis send no extra request. Choose
**Liquidity** in the comparison note action to keep both companies' admitted
balances and calculations with their original provenance.

### Compare operating results between companies

Three rows show **Operating income**, **Operating revenue basis** and
**Operating margin** from each loaded Annual report. Income and selected revenue
retain exact, unscaled USD amounts; the margin reuses the admitted calculation.
Each value shows its own period and current-use status. Negative operating income
is valid. Missing net income does not hide available operating evidence.

Use each company's existing revenue selector to choose its operating denominator.
The selected readable concept appears with that revenue amount. A missing or
unknown basis stays unavailable until another is chosen explicitly. The selector's
income-pair availability label refers to revenue and net income; operating values
have their own eligibility. Changing a basis makes no source request and leaves
the other company's values, cash and liquidity unchanged.

Operating margin requires positive revenue and operating income from the same
filing and exact annual period. The companies keep their separate fiscal calendars
and bases; this table adds no cross-company calculation or ranking. The existing
source disclosure includes complete operating observations, scan counts and
calculation references. Refresh, Cancel, retention and full-report navigation use
the existing report owner. Choose **Operating results** in the note action to
append both companies' complete chosen evidence with original provenance.

### Compare reported balance sheet totals

Three rows after liquidity show **Total assets**, **Total liabilities** and
**Shareholders’ equity · parent** from each loaded Annual report. Each cell keeps
its exact signed, unscaled USD amount, actual balance date and current-use or
historical qualification. The two companies can have different balance dates.
Zero and negative reported amounts remain visible. A missing or refused total
keeps its own reason; valid siblings remain available even when revenue or net
income is unavailable or another revenue basis is selected.

Parent equity excludes noncontrolling interests. Different fiscal calendars and
accounting policies can limit comparison. The app does not infer a balance
equation, cross-company difference, rank or valuation. Each company's existing
initially closed source disclosure includes the complete reported observations,
agreeing references, original filing links and source clocks.

These rows use the existing Annual v5 packets and report owners. Failed refresh
and Cancel retain their original values and dates; a successful refresh replaces
only that company's report. Selection and session retirement fence late replies.
Reading these rows or opening source details makes no request and does not edit
or save a note. The existing note actions retain their current evidence groups.

### Open the full report from a comparison

Each loaded column offers **Open full Annual report** beside its load controls.
The company visit checks a private copy of that column's original report and
shows its full financial overview and evidence. Opening sends no source request.
Historical, unavailable and retained reports keep their original qualifications,
filing references and source dates. The visit identifies reports reused from the
comparison even if a later refresh fails or is cancelled.

An explicit **Refresh annual report** changes only the company visit. **Back to
workspace** and Android Back return to the same comparison, basis choices, note
destination and current draft, then restore focus to the opening button. The
company note uses the existing shared draft and explicit whole-watchlist Save.
A conflicted draft stays read-only while its loaded report can still be viewed.

Opening cancels any pending comparison read. Stale buttons, changed membership,
catalog changes and session retirement cannot reopen old evidence. Cancelling
the local report check leaves the visit unloaded. Cold company links, page
reloads and Forward navigation start unloaded; the handoff adds no saved state,
cache or automatic fallback request. Current work records acceptance separately.

### Keep Annual comparison evidence in a note

Below the comparison, choose **Revenue and net income**, **Cash generation**,
**Liquidity** or **Operating results**,
then choose one of the two listings in **Add Annual comparison to**. The
destination starts empty and identifies the company, share class and exchange.
**Add Annual comparison to note draft** appends both companies' selected evidence
to that listing's latest note. It preserves each company's fiscal period or balance
date, exact USD values, raw concepts, filing link and original source and completion dates.
Historical and retained reports keep their qualifications.

Income copies the selected revenue basis, net income, available net margin and
reported revenue change, or the reason that change is unavailable. Cash copies
both reported inputs and their admitted same-filing, same-period difference.
Liquidity copies current assets, current liabilities, working capital and the
checked current ratio. Zero liabilities keep the explicit ratio refusal; negative
working capital remains valid. Its complete source details and separate balance
dates are retained. Both companies must have the chosen group's evidence; missing
income or cash does not block valid liquidity. No field is substituted, rounded
further or loaded by this action.

Operating results copies each company's operating income, selected revenue and
checked margin, with separate periods, named concepts and original source clocks.
Both companies need the full chosen operating evidence. A refused margin leaves
independent table operands visible but prevents this complete note append. The
shared formula and rounding explanation appears once. The complete note must fit
the same limit; evidence is never truncated to make it fit.

Changing a company or replacing a report clears the note destination. Changing
the revenue basis or evidence group keeps the destination but discards earlier
action feedback. Note edits, ordering and Save preserve it. Refresh must finish
or be cancelled before appending; a retained report uses its original dates.

The action rechecks the current pair, reports, route and editable draft when
clicked. It preserves existing prose, refuses an identical excerpt and validates
the complete resulting note against the existing 2,000-character policy. An
oversized or invalid note stays unchanged, without truncation. Review unsaved
changes and choose **Save watchlist** to save the complete draft. Appending makes
no source or save request. Current work records browser, native and delivery
acceptance separately.

After a successful append, **Review note** opens that exact listing's full note
and focuses its reader. The current search and scope remain, even if the listing
is outside the results. Review can read the unchanged draft while Save or recovery
pauses editing. A pending source read pauses Review; a changed report, company,
basis, evidence group or destination removes the earlier success. Refusing a
duplicate in the same context keeps Review available. Review does not append,
load a report or save.

### Compare cash generation

The same table adds reported operating cash flow, reported PP&E purchases and
**Operating cash flow less PP&E purchases**, labelled as an app calculation.
Each company's cell retains its own exact unscaled USD amount, annual period
and current-use status. Missing or refused values show their reason; unloaded
columns remain unloaded. The existing income period and warnings apply to
revenue and net income only.

Cash uses each currently loaded report's independently validated resolution.
Changing revenue basis cannot change it, and unavailable income cannot hide valid
cash. When the operands cover different periods, each remains readable but their
subtraction is unavailable. Historical cash retains its own qualification.
There is no adjustment for leases, acquisitions or other investing cash flows,
and no cross-company calculation, annualization or ranking.

Each company's existing source disclosure includes both raw cash concepts,
scan status, observation references and original source dates. Refresh failure
and Cancel retain the previous values and dates. Selection and session boundaries
apply to the entire response. This adds no source request, saved state, cash
history or note action. Source, browser and native acceptance are recorded in
[Current work](CURRENT_WORK.md).

### Compare cash generation relative to revenue

The comparison candidate adds three fixed rows after the cash USD amounts, one
for each named reported revenue concept. Each company shows its exact reported
revenue and its own operating cash flow less PP&E purchases divided by that
revenue, expressed as a percentage. The existing cash-margin derivation rounds
once to two decimal places and preserves the calculation's period, filing and
current-use qualification. The income basis selector does not change these rows.

Missing or refused inputs affect only that company's basis. Unloaded columns stay
unloaded. Valid cash margins remain available when operating or net income is
missing. The calculation requires matching periods and filing references within
each company. It does not align the companies' fiscal calendars or accounting
policies, calculate a difference between them or rank them.

Each company's source disclosure includes the same **Cash margin inputs** used
in company Annual: exact OCF, PP&E and revenue operands, observation references,
filing dates and original capture/completion times. Refresh failure and Cancel
retain the previous report's evidence. The existing comparison selection and
session boundaries apply. This adds no source request, saved field or note action;
the existing cash note action retains its three USD amounts. Candidate acceptance
and publication remain separate in [Current work](CURRENT_WORK.md).

## Financial overview

Once a managed Annual report is loaded, **On this report** links to Revenue and
net income, Cash generation, Liquidity and Report source details. Each jump
moves keyboard focus to the existing content. Report source details also opens
its disclosure. All sections remain visible, including their unavailable states.
These links read no sources, change no notes and add no browser-history entries.
Replacing or retaining a report does not automatically move focus or scroll.

The managed Annual view leads with reported financial results. Each eligible
revenue basis has a table of exact USD revenue, net income and available net
margin across up to three admitted periods, newest first. Dated reported changes
follow without repeating the current amounts. Eligible bases lead with readable,
distinct labels: **Revenue**, **Customer contract revenue, excluding assessed
tax**, and **Net sales revenue**. Genuinely missing bases appear as compact rows
below the tables. Rejected or withheld evidence retains its visible explanation.
Exact concept identifiers and statuses remain in **Source and validation
details**; the labels do not combine or replace bases. The local research profile retains
its existing evidence-first presentation and basis order.

Exact filed and completed dates, current-use status and retained previous-report
notices stay visible. Numerical ages and policy limits remain in the source
details. An eligible historical current pair can remain readable when its
comparison and history are unavailable under the
original age policy. No older filing or alternative basis fills a missing value.
The filing link, period inputs and complete **Source and validation details**
disclosure preserve the original evidence and calculation context.

One labelled keyboard-focusable region contains all named bases. Tables fit the
available width; exact amounts and dates wrap within their cells on narrow
screens. The region remains mounted when a refresh reorders, replaces or withholds
figures. Replacement updates values, dates, evidence and action bindings; the
note action resets its response-specific feedback. Explicit appending, whole-note
validation, Save and session retirement retain their existing behavior. This
presentation adds no field, provider request, calculation or persistent state.

Local tests and independent review cover the financial layout, unavailable states,
original evidence, explicit note actions and refresh/retirement behavior. Invented-data
Brave checks passed at 1440, 390 and 320 pixels, including one-to-three-period tables,
long exact values, separate bases, keyboard disclosures, note append and Back,
retained failure/Cancel, late-response rejection and session retirement. Figures
appear in the first desktop view; narrow tables fit without horizontal overflow.

Focus on the results region and after Cancel was observed. Retention of that focus
across asynchronous response replacement is supported by source structure, not a
separately observed browser transition. Live account/provider calls were excluded.
A later invented-data browser check verified Annual note Save and reload while
Price was unavailable. Native execution for the financial layout passed its
exact-head hosted check; release acceptance remains separate in
[Current work](CURRENT_WORK.md).

A later Chrome check accepts the readable basis labels and compact missing rows
at 1440, 390 and 320 CSS pixels. Exact raw concepts and statuses remain available
by keyboard. The same financial-results region keeps focus during delayed
replacement from populated bases to missing ones and back. Rejected, withheld
and historical evidence, explicit note appending and whole-draft Save retain
their behavior. This check uses invented RAM data; it makes no live-source claim.

## Cash generation

The company Annual view shows reported operating cash flow and purchases of
property, plant and equipment (PP&E) independently. It also shows **Operating
cash flow less PP&E purchases**, explicitly labelled as an app calculation.
Amounts remain exact, unscaled USD with their actual annual periods. The
calculation requires both operands from the same filing and period. Negative
operating cash flow and zero purchases are valid; negative reported purchases
remain visible but withhold the subtraction. This is a narrow calculation, with
no adjustment for leases, acquisitions or other investing cash flows.

The source uses only `NetCashProvidedByUsedInOperatingActivities` and
`PaymentsToAcquirePropertyPlantAndEquipment` in SEC Company Facts. It reuses the
existing Submissions target and the same two explicit source requests. Missing,
conflicting or invalid amounts stay unavailable. Another concept, filing or
currency cannot fill a gap. Each amount must establish FY focus, an unamended
annual filing and a 335–395 day period ending at the selected report date.
Cash eligibility does not require a revenue or net-income pair.

Company Facts envelope validity is separate from the income scan and each cash
scan. A malformed or over-limit cash concept preserves valid income and the
other cash metric; a failed income scan preserves valid cash evidence. Each cash
concept allows at most 10,000 USD candidates and 100 unique selected-filing
observations before annual filtering. Exceeding a bound withholds that metric
without clipping. The existing income limits, eight-MiB source cap, two-MiB
response cap, scheduler, admission and deadlines remain unchanged.

Original source times, selected filing, observation pointers and exact calculation
references are available in **Cash sources and calculation inputs**. Historical
amounts retain their dates and current-use status; the existing seven-day source
and 485-day report policies apply independently of income. Refresh, cancellation,
navigation and session retirement use the existing Annual response lifetime.
Cash history and charts remain outside this scope. The watchlist's
[cash comparison](#compare-cash-generation) uses these same loaded amounts.

**Add cash generation to note draft** copies the three available amounts as one
plain-text paragraph into the existing listing's note. It retains exact raw
concept names, the app-calculation label and limits, filing identity and link,
annual period, original source and load dates, and current-use status. Historical
and retained reports carry explicit qualifiers. Cash can be copied when income
evidence is unavailable; missing or incompatible cash inputs block the action.

The action reads the latest note at click time, preserves its prose, refuses an
identical excerpt and checks the whole proposed note against the existing
2,000-character policy. It remains keyboard-focusable when unavailable so its
associated reason can be read. Appending neither refreshes evidence nor saves
changes. Review and explicitly save the whole watchlist draft. See the
[cash-to-note workflow](MANAGED_RESEARCH_NAVIGATION.md#add-cash-generation-to-a-note-draft).

Focused source checks and invented-data Chrome acceptance cover exact note text,
latest-prose and duplicate guards, full-note limits, explicit Save/reload,
unavailable and historical cash, and report/session lifetime. The action fits at
1440, 390 and 320 CSS pixels and remains keyboard-accessible with a 44px target.
The native fixture builds; hosted execution and delivery are recorded separately
in current work.

### Read cash generation relative to revenue

After an explicit Annual load, **Cash generation relative to revenue** shows
operating cash flow less PP&E purchases as a percentage of each reported revenue
basis: revenue, revenue from contracts with customers excluding assessed tax, and
net sales revenue. Each named concept stays separate. Missing operating income or
net income does not hide a valid cash/revenue calculation.

The app subtracts the exact cash amounts, divides by that basis's exact revenue,
multiplies by 100 and rounds once to two decimal places. All three inputs must
cover the same exact period and accession. Revenue must be positive and reported
PP&E purchases nonnegative. Operating cash flow and the resulting percentage can
be zero or negative. Missing, refused or incompatible inputs keep their reason;
another basis, period or filing cannot fill the gap.

The revenue amount, percentage, annual period and original current-use
qualification stay visible. Open the initially closed **Cash margin inputs** for
that basis to read all three original operands, observation references, selected
filing and source capture times. A percentage is an app calculation, not a rating
or a forecast. It uses the same narrow PP&E subtraction described above.

The section reads the current Annual response without another request or save.
Failed refresh and Cancel retain the original result under the existing previous
report warning. A valid replacement updates it; company and session retirement
clear it. This increment adds no percentage to the existing cash-to-note action,
five-fact review or report summary. The report's complete JSON still captures the
underlying Annual response. [Current work](CURRENT_WORK.md) records acceptance
and delivery status.

### Read reported cash history

In the managed Annual view, open **Reported cash history** below cash generation.
The disclosure starts closed. It shows up to three adjacent annual periods from
the already loaded filing, newest first: exact, unscaled USD operating cash flow,
PP&E purchases and their same-period subtraction. The first two rows are reported
amounts; the third is an app calculation. Negative operating cash flow and a
negative subtraction remain valid. Purchases must be nonnegative for subtraction.

Paired history requires the current cash inputs and subtraction to be available
and within current-use limits at that load. The independent current values remain
readable when paired history is unavailable. Income eligibility does not govern
cash history. Earlier comparative periods keep the selected filing's original
metadata; they are historical amounts, without a new current-use claim.

The next period must end exactly one day before the newer period starts, and each
annual period must meet the existing 335–395-day rules. Missing, conflicted or
refused inputs stop the table at that point and leave the newer accepted periods
readable. An older year cannot fill a gap. No alternative concept, currency,
filing or amount is substituted. All agreeing observation references are retained.

**History calculation references** lists the original IDs for each period.
Complete source observations remain in **Cash sources and calculation inputs**.
Opening either disclosure adds no request or saved change and keeps the original
completion time. These are comparative amounts reported in one filing; period
length, accounting changes and restatements are unadjusted. They do not establish
as-originally-filed history, a full cash-flow statement or a forecast.

The table stays inside a labelled, keyboard-focusable scroll region on narrow
screens. Failed refresh and Cancel retain the original packet and dates. A new
accepted packet replaces history; company and session retirement remove it.
Current cash note actions and prepared-report documents keep their existing
scope. Source, browser, native and publication acceptance remain separate in
[Current work](CURRENT_WORK.md).

### Read the cash history chart

Inside **Reported cash history**, **Cash trend metric** selects operating cash
flow, PP&E purchases or operating cash flow less PP&E purchases. The chart uses
the same admitted periods as the exact table, with dates ordered oldest first.
It needs at least two periods. A refused third period leaves the two accepted
periods usable; an older year cannot replace a gap. Income eligibility does not
govern this chart.

Bars use a zero baseline. Operating cash flow and the subtraction can be negative
or zero; PP&E purchases keep their reported positive sign. The subtraction is an
app calculation with the limits above, not comprehensive free cash flow. Numeric
coordinates are approximate. Tooltips keep exact amount strings and dates, with
long values referred to the exact table. An unsafe coordinate withholds that
metric's whole chart while the table and other metric choices remain available.

The disclosure starts closed. Opening it or changing the metric does not load
sources or save a change. The choice remains while the Annual view is mounted,
including when a replacement makes the selected metric unavailable. Closing the
disclosure disposes its chart. Failed refresh and Cancel retain the original
packet, qualification and clocks; accepted replacement updates the chart.
Company and session retirement clear it. Resize, reduced motion and chart
failure use the shared guarded Annual chart renderer.

## Liquidity at fiscal year-end

Company Annual shows independently reported **Current assets** and **Current
liabilities**, followed by two labelled app calculations: **Working capital**
and **Current ratio**. The amounts retain exact, unscaled USD; the ratio is a
multiple rounded to two decimal places, half up. Working capital subtracts
current liabilities from current assets. Current ratio divides the same inputs.

Only `AssetsCurrent` and `LiabilitiesCurrent` USD observations are used. Both
are instant balances: the source must supply no start date or duration, and its
end date must equal the selected annual report date. FY filing focus and the
exact unamended 10-K or 20-F accession must match current Submissions metadata.
The filing-focus year need not equal the balance's calendar year. Annual-flow
duration rules and calendar-quarter tolerances do not apply to these balances.

Each reported amount can remain available without the other. Calculations require
nonnegative operands from the same filing and date; current ratio also requires
positive current liabilities. Negative reported operands remain visible with an
explanation that the calculations are withheld. Working capital itself can be
negative. Missing or conflicting values stay unavailable, with no fallback to a
different concept, currency or filing. Current assets are not all cash.

Liquidity reuses the existing explicit Submissions and Company Facts read. Its
two bounded scans are independent of each other, income and cash. Each allows
10,000 USD source candidates and 100 unique observations from the selected filing,
counted before date filtering. Invalid rows or an exceeded bound withhold that
metric without clipping. Source decimal strings allow 64 characters; exact
working-capital and ratio outputs allow 128 and 129 characters respectively.
The decoder recomputes every result, reference and qualification from the admitted
observations. Existing request, source, response, cancellation and session bounds
remain unchanged.

The initially closed **Liquidity sources and calculation inputs** disclosure
contains the original cutoff, capture and completion times, scan coverage, raw
period fields, filing join, source pointers and calculation references. A rejected
duration observation remains inspectable as supplied. The seven-day source
freshness and 485-day report policies still apply; valid older balances remain
readable with historical labels. The existing whole-response lifetime carries
liquidity through refresh, cancellation, navigation and comparison-to-company
handoff. The [comparison rows](#compare-liquidity-between-companies) reuse these
checked balances and calculations. The following history disclosure has its own
reported-date admission and coverage limits.

### Reported liquidity history

Managed company Annual adds an initially closed **Reported liquidity history**
disclosure. It shows the selected report-date balances and up to two earlier
reported dates from the same filing, newest first. The rows retain exact current
assets, current liabilities, working capital and current ratio, with reported
amounts and app calculations labelled separately.

These are observed balance dates. They need not be consecutive fiscal year-ends,
and a date absent from both source concepts has no marker in the packet. The app
does not subtract calendar years or borrow periods from income or cash flows.
Accounting changes and restatements are unadjusted. The display does not establish
a complete timeline, as-originally-filed history or a forecast.

The selected current pair must be available and within the original load's
current-use limits. Earlier candidates come from the complete union of both
concepts' reported dates. A missing, invalid or conflicting raw pair stops history
at that actual date; accepted newer balances remain readable, and older dates do
not fill the gap. A selected observation after the report date refuses the new
history. Original filing metadata, including its report date, remain unchanged
for every comparative observation.

Negative and zero reported balances remain visible. Working capital and current
ratio keep their existing calculation rules and show their own refusal reasons.
A refused calculation does not remove a valid raw pair or stop inspection of
earlier dates. For example, zero current liabilities can retain working capital
while the ratio is unavailable.

**History calculation references** lists all agreeing input IDs for each date.
Complete observations stay in **Liquidity sources and calculation inputs**.
Original source captures, cutoff and completion remain visible. Opening, closing
or scrolling history makes no request or saved change and grants no renewed
freshness qualification. The labelled table supports keyboard scrolling inside
the available width.

Failed refresh and Cancel retain the accepted packet; discarded late responses
cannot replace it. A successful refresh replaces the whole packet, and leaving
the company or retiring the session clears it. Prepared report JSON keeps the
complete admitted rows and reproduces the captured history after the live packet
changes. Current note actions, snapshot and comparison scope stay unchanged.
No source request, response field or schema version is added. Implementation,
browser, native and publication acceptance remain separate in
[Current work](CURRENT_WORK.md).

### Add liquidity to a note

**Add liquidity to note draft** appends one dated paragraph to the existing
listing's shared note. It includes both exact reported balances, working capital,
the checked current ratio, original filing and source dates, and historical or
retained-report qualifiers. If current liabilities are zero, it records that the
ratio is unavailable while preserving the valid balances and working capital.
The action requires nonnegative reported inputs from the same filing and date;
negative working capital remains valid. Missing or rejected inputs block it.

The action rechecks the current report and latest note when activated, refuses an
identical excerpt, and validates the complete proposed note against the existing
2,000-character policy. It preserves existing prose and other members. Review and
explicitly **Save watchlist** to save the whole draft. Appending requests no data
and adds no saved field. See the
[liquidity-to-note workflow](MANAGED_RESEARCH_NAVIGATION.md#add-liquidity-to-a-note-draft).

## Reported operating results

**Operating results** shows reported operating income from the selected annual
filing, followed by operating margin for each named revenue basis. Use **Operating
results** in **On this report** to move focus to this section. The local evidence
view also shows the same results. Opening the section makes no source request.

The reported amount uses only `us-gaap:OperatingIncomeLoss` in USD. It is checked
independently of revenue, net income, cash generation and liquidity. Negative
operating income is valid. Missing or conflicting operating evidence does not
clear valid measures in the other sections. No older filing or substitute concept
fills a missing value.

Operating margin is an app calculation:

`reported operating income / selected positive revenue * 100`

Each calculation needs the same accession and exact annual start/end dates.
The three existing revenue concepts remain separate. The calculation uses complete
admitted revenue observations and does not require net income. Zero or negative
revenue makes the margin unavailable while valid operating income remains visible.
Decimal.js calculates the percentage with isolated precision and rounds to two
decimal places, half up. The [SEC financial-statement guide](https://www.sec.gov/about/reports-publications/investorpubsbegfinstmtguide)
describes this ratio; [Investing.com's operating-margin guide](https://www.investing.com/academy/analysis/operating-income-margin-definition/)
identifies it in InvestingPro. These references supply the definition, not company
data or implementation code.

Each amount keeps its original period, filing, source captures and current-use
status. **Operating sources and calculation inputs** starts closed and exposes
the scan counts, complete selected observations and calculation references.
The independent scan inspects at most 10,000 candidates and returns at most 100
selected-filing observations before annual filtering. Overflow refuses the metric;
it does not clip. Source decimals retain the existing 64-character bound. The
shared request, source-body, response, deadline and cancellation limits stay fixed.

The loaded company snapshot and prepared research report reuse these admitted
results. The report's existing `1.0.0` document contains the complete Annual packet,
including operating observations and resolutions. Preparation does not renew dates.
Watchlist Annual comparison includes its own operating rows and chosen-basis note
group alongside income, cash and liquidity. Its full-report handoff carries the
complete operating packet without a new read.

**Add operating results to note draft** under a chosen basis appends its exact
operating income, revenue, margin, period, filing link and original source dates
to the latest note. It requires an available margin from the current response and
basis. Pending loads, stale choices, duplicate excerpts and notes above the complete
2,000-character limit are refused. Cancel or a failed refresh can retain the original
evidence with its previous-report qualification. Review the full note and use the
existing explicit whole-watchlist Save. No source request or save occurs on append.

Current operating values and note excerpts cover the selected annual period.
The managed history disclosure below provides bounded same-filing comparatives.
Growth, adjusted earnings, peer ranking and full financial-statement coverage remain open.
Synthetic acceptance does not establish current SEC coverage for the real cohort.

### Read reported operating history

In managed company Annual, open **Reported operating history** below a named
operating revenue basis. Each disclosure starts closed and uses the loaded
filing. It shows up to three adjacent annual periods, newest first: exact,
unscaled USD operating income and revenue, followed by operating margin as a
labelled app calculation. The selected revenue concept stays the same across
the table. Different bases can have different available periods.

History requires an available current operating margin within the existing
current-use limits at that load. Net income is not required. Negative or zero
operating income is valid; each margin requires positive revenue from the same
accession and exact period. A refused shared income scan cannot supply revenue.
Independent current values remain readable when history is unavailable.

The next period must end one day before the newer period starts and meet the
existing 335–395-day annual rules. Missing, invalid or conflicting inputs stop
the sequence and leave accepted newer periods visible. An older year cannot fill
a gap. No other concept, currency or accession is substituted. Earlier periods
retain the selected filing's original report date and metadata; they are
historical comparatives without a new current-use claim. Restatements and
accounting changes are unadjusted, so this is not as-originally-filed history or
a forecast.

**History calculation references** lists all agreeing input identifiers for each
period. Their complete observations remain in **Operating sources and calculation
inputs**. The table keeps the original completion time and uses the same checked
margin formula and rounding as current operating results. Opening disclosures
makes no request or saved change. The narrow layout keeps the table in a labelled,
keyboard-focusable horizontal scroll region.

Failed refresh and Cancel retain the previous packet and its dates. A successful
replacement uses the new packet; closing the company visit or retiring the
session clears it. The complete prepared-report JSON preserves the comparative
observations and original clocks so the same history can be reproduced. Snapshot,
comparison and current note excerpts retain their current-period scope. Annual
schema/definition stay `4.0.0`, and the report document stays `1.0.0`.

### Read reported operating change

Inside each **Reported operating history** disclosure, **Reported operating
change** compares its first two admitted periods. Operating income change is
the exact current-minus-prior amount in USD. Operating margin change subtracts
the two unrounded operating-income-to-revenue ratios, multiplies by 100 and
rounds once to two decimal places, half up. Subtracting the displayed rounded
margins can give a different result. A nonzero change that rounds to zero keeps
its direction as **Less than 0.01 percentage points higher** or **lower**.

Both periods must meet the existing history rules for the same filing and named
positive revenue basis. A missing or refused current or immediately preceding
pair has its own explanation. An unavailable third period does not withhold a
valid first-two comparison, and an older period cannot fill a gap. Independent
current operating income remains readable. Operating-income growth percentages
are not calculated.

Both period ranges, the original filing and completion time accompany the
changes. Complete inputs remain in **History calculation references** and the
existing source disclosure. The captured report JSON retains those inputs and
original clocks for reproduction after later source changes. The comparison
shares the report's refresh, Cancel, navigation and session lifetime. It adds
no source request, schema, saved field or note action.

### Version boundary

The Annual request/response schema and generation definition are `4.0.0`. The
route and four request keys are unchanged. Version-1, version-2 and version-3 requests
are rejected before provider or budget work; version-4 clients reject old or
incomplete responses. A later
release must coordinate the API, website and Android client. During a mismatched
rollout, Annual reads are unavailable until the matching client is installed or
loaded. Saved watchlists and notes require no migration. Current work records
implementation and acceptance; this guide does not establish deployment.

## Optional reported annual trend

The managed overview includes an initially collapsed **Reported annual trend**
disclosure. It plots Revenue or Net income in USD for two or three admitted
periods from one named revenue basis and filing, oldest first. The exact tables
remain visible. Selecting a basis or metric makes no request and changes no note,
board selection or saved state. The local research profile is unchanged.

The basis selector and trend source summary share the overview's readable names.
A wrapping selected-basis line keeps the complete name visible on narrow screens
and describes the native selector. Raw concept values and source identifiers
remain unchanged, including when the chosen basis has no available trend.
Invented-data Chrome checks accept the full name at narrow widths and the same
focused selector through replacement with missing evidence and back.

The summary and both native selectors remain mounted while the loaded Annual view
is present. The initial basis is the first with a trend, otherwise the first with
an admitted current pair, including a pair outside current-use limits, otherwise
the first declared basis. A replacement
retains the chosen basis and metric even when that basis
becomes unavailable; it shows the reason and removes the old chart. Closing the
disclosure disposes its chart. Leaving the Annual view or retiring its response
resets these presentation choices. A valid two-period history remains usable when
the third period is refused. One period and a current-use refusal have no trend.

Bars use a zero baseline and preserve admitted negative and zero amounts. Numeric
coordinates are approximate; tooltips retain exact amount strings and period
dates, with long values referred to the exact tables. An unsafe coordinate or
renderer failure withholds only the chart. Resize and reduced-motion changes use
the same guarded chart lifecycle. Retained-report notices, the original history
explanation and all note actions remain in their existing scope.

## Reported annual comparison

PR 55 delivers comparison for each eligible named annual revenue basis on the
managed website and in signed Android 1.15. [Current work](CURRENT_WORK.md)
records source, delivery and acceptance limits. It uses the selected filing's
existing packet without another provider request or a new API field.

The current pair is recomputed under the existing annual rules. Comparison also
requires current-use eligibility at the original load. The preceding annual
period must end the day before the current period starts and have one agreeing
start date, a 335 to 395 day inclusive duration and an FY filing-focus label.
Both revenue and NetIncomeLoss must have agreeing exact USD observations for
that period and join the same selected accession, form, filed date, report date
and accepted time. Revenue concepts stay separate. A missing, conflicting or
invalid prior period is unavailable; no older filing or different basis fills it.
Comparative rows keep the filing's current report date and remain ineligible as
current-year pairs under the original resolver.

The display retains both period ranges, exact unscaled amounts, current minus
prior USD differences and inspectable operand references. Percentage change is
`(current - prior) / prior * 100`, calculated with exact decimals and rounded half
up to two places. A zero or negative prior amount retains its amount and USD
difference while percentage change is unavailable. A nonzero percentage that
rounds to zero says it is less than 0.01% higher or lower.

Consecutive annual periods can differ in length, including 52 and 53 week years.
These are comparatives reported in one filing. Period length, accounting changes
and restatements are unadjusted; this is not as-originally-filed history or organic
growth. Original source and load dates apply to both periods, including retained
previous reports.

An available comparison is included by **Add annual evidence to note draft**
alongside the existing current-year excerpt and filing provenance. An unavailable
comparison leaves that excerpt unchanged. The existing 2,000-character limit
refuses an oversized complete note without truncation; explicit review and
**Save watchlist** remain required. Comparison does not load, add membership or
save. Refresh, cancellation, section changes and retirement keep their existing
generation and draft boundaries.

## Reported net-margin comparison

PR 59 delivers prior and current net margin and their difference in percentage
points on the website and in signed Android 1.17. It uses the same eligible
observations and named revenue basis as the reported annual comparison.
[Current work](CURRENT_WORK.md#current-capability-and-delivery-status) records source, delivery and
acceptance limits.

Net margin is `NetIncomeLoss / revenue * 100`. Revenue must be positive;
negative or zero net income is valid. A zero or negative prior revenue keeps
the existing revenue and net-income amounts and differences visible, while the
prior margin and its change are unavailable. No alternative revenue basis,
adjusted income or older filing replaces an unavailable operand.

Both margins are rounded half up to two decimal places. The change subtracts
the unrounded ratios and rounds once; it does not subtract the displayed rounded
margins. A nonzero change that rounds to zero says it is less than 0.01 percentage
points higher or lower. The existing input references and period ranges make the
calculation inspectable. Reported NetIncomeLoss includes any unusual items.

An available margin comparison joins the existing Annual note excerpt. An
unavailable comparison explains the prior-revenue limit while retaining the
other reported comparatives. The complete note must still fit within 2,000
characters. Appending preserves the latest draft without truncating or saving;
review and explicit Save watchlist remain required. The comparison adds no source
request, response field, dependency or persistent state. Existing refresh,
cancellation, visit and session lifetimes apply.

## Reported annual history

PR65 and signed Android 1.20 deliver a collapsed **Read reported annual history** view
for each eligible named revenue basis. It lists up to three adjacent periods,
newest first, from the already loaded packet and selected accession. Each period
retains its exact date range, unscaled USD revenue and NetIncomeLoss, net margin
when revenue is positive, and inspectable original observation references.

The current period and each preceding period use the existing admission rules
described above. History stops at the first missing, conflicting or invalid
period. It does not skip a gap, switch revenue concepts or load an older filing.
Periods retain the selected filing metadata and original source/load dates;
52 and 53 week years can differ in length. Accounting changes and restatements
remain unadjusted. Three-period availability depends on the admitted packet and
is not promised for every company or filing.

When a third period is admitted, **Add annual evidence to note draft** includes
its dates, exact amounts and available margin alongside the current pair,
existing comparison and filing provenance. It preserves the existing draft,
2,000-character validation, explicit review and **Save watchlist**. Reading or
appending history makes no source request or save. Current-use policy, refresh,
cancellation and retirement retain their existing boundaries.

The website and signed Android 1.20 history are delivered. Physical use and other
acceptance limits remain separate; [Current work](CURRENT_WORK.md) records them.

### Earlier reported changes

PR69 and signed Android 1.21 deliver **Earlier reported annual comparison** when all three
periods are admitted. It compares the oldest period with the middle period,
retaining both date ranges, exact revenue and NetIncomeLoss amounts, USD changes
and original observation references. The existing newest-versus-prior comparison
remains available above the history.

The existing decimal calculation supplies `(current - prior) / prior * 100`,
rounded half up to two places. A zero or negative prior value keeps the USD change
while withholding its percentage. A positive prior value can be compared with a
zero or negative current value. A nonzero percentage below display precision is
identified as less than 0.01% higher or lower. No earlier margin comparison is
added; each period keeps its existing available or unavailable margin.

The dated earlier comparison joins **Add annual evidence to note draft**. The
whole note must still fit within 2,000 characters, without truncation, automatic
save or source refresh. Missing or conflicting third-period evidence leaves the
existing two-period view and note unchanged. Same-filing, contiguous-period,
source-date and unadjusted-accounting limits apply throughout.

Required actual-main checks, source proof, twenty invented-data native cases,
same-archive website promotion and signed Android 1.21 delivery passed. Physical
use and other acceptance limits remain separate; [Current work](CURRENT_WORK.md)
records them.

## Request lifetime and data

Authenticated `POST /v1/managed/sec-annual-evidence` accepts at most 4 KiB and
returns at most 2 MiB. It retains the current SEC provider, annual resolver and
response validation, including source hashes, identity joins, observation rules
and generation identity. The shared decoder takes its own copy before awaiting
hash work and freezes the validated result. Client parsing remains inside the
request's twenty-second lifetime.

The function starts its ten-second deadline at entry, before bridge and account
checks. Authentication, catalog admission and the storage reservation must finish
within two seconds of entry. The source operation then gets at most 7.5 seconds,
ending no later than 9.5 seconds after entry; serialization must finish before
ten seconds. Synchronous parsing is checked after it returns. These are measured
application bounds, not a guarantee about platform scheduling or cold starts.

Each admitted attempt can request only the issuer's SEC Submissions and Company
Facts resources through the existing bounded adapter. Existing eight-MiB input
caps and filing/fact/observation limits remain. Source bodies are not persisted.
Cancel immediately retires the pending read. During a refresh, the previous
validated report stays visible with a cancellation message. The Appwrite bridge has no proven
client-disconnect signal, so cancellation does not claim to stop remote work;
the server deadline remains responsible for that work.

## Shared admission

One pre-provisioned private row, `observed-annual-v1`, belongs to the admitted
principal in `investment_managed_watchlist_v1/sec_annual_budget`. It contains
`ownerId`, a monotonically increasing `version` and `nextAllowedAt`. Table and row
permissions are empty and row security is enabled. Account and catalog checks
precede access to this row.

The official SDK performs a read, creates a transaction, stages a bounded version
increment, updates only the reservation time, and commits. The increment's maximum
is the read version plus one. Only a timely acknowledged commit grants source
work. An uncertain commit grants no work and is not retried or refunded. A sixth
transport slot is reserved for rollback before a commit has started. A pending
transaction expires after sixty seconds.

The reservation ends twenty seconds after the request entered the function.
Assuming each instance clock is within one second of UTC and admission finishes
within two seconds, consecutive granted source operations are separated by at
least sixteen seconds. This clock assumption is not a measured service guarantee.
Impossible row chronology or a late admission fails closed. The budget applies
to this feature only and does not redefine existing monitor background policy.

The separate synthetic proof uses `investment_sec_annual_proof_v1`, an invented
principal and a private proof function. It must establish one winner from
competing same-version requests, immediate cooldown, loss of an acknowledgement
after a real commit, and later admission from the persisted version. Local source
sentinels are not SEC requests. Provisioning metadata alone does not accept those
scenarios or authorize production schema as complete.

## Server configuration and release

Managed function builds require separate reviewed identity, SEC and EOD configuration
files. The SEC configuration is either `null`, which explicitly closes source admission, or
an object containing one valid `userAgent` contact string. Validation occurs
before output cleanup. The contact stays in the server bundle.

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/clerk-trial/build-function.ts managed <server-config-path> <sec-config-path> <eod-config-path>
```

The separate [EOD configuration](./MANAGED_EOD_HISTORY.md) can be `null`; this leaves
the Annual report service available under its own configuration and budget.

The accepted website, production API, signed APK, synthetic trial and local vault
remain separate release surfaces. A source merge alone does not change them.
Production provisioning, service activation, exact-build website delivery and
Android packaging each need their own recorded outcomes. No owner-record
migration or phone acceptance follows from the isolated proof.
