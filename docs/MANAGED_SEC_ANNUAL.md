# Managed annual reports

The managed client opens an Annual report panel from a current Discover result
or watchlist listing. Loading is explicit. The workspace stays mounted so its
watchlist draft survives opening and closing the report. Selection, catalog and
session changes retire the old request and evidence; editing a note does not
invalidate an unchanged listing. Workspace CURRENT records actual delivery.

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

Below the comparison, choose **Revenue and net income** or **Cash generation**,
then choose one of the two listings in **Add Annual comparison to**. The
destination starts empty and identifies the company, share class and exchange.
**Add Annual comparison to note draft** appends both companies' selected evidence
to that listing's latest note. It preserves each company's fiscal period, exact
USD values, raw concepts, filing link and original source and completion dates.
Historical and retained reports keep their qualifications.

Income copies the selected revenue basis, net income, available net margin and
reported revenue change, or the reason that change is unavailable. Cash copies
both reported inputs and their admitted same-filing, same-period difference.
Both companies must have the chosen group's evidence; missing income does not
block valid cash, and missing cash does not block valid income. No field is
substituted, rounded further or loaded by this action.

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

## Financial overview

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
handoff. Liquidity comparison columns and history remain outside this scope.

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

### Version boundary

The Annual request/response schema and generation definition are `3.0.0`. The
route and four request keys are unchanged. Version-1 and version-2 Annual requests
are rejected before provider or budget work; version-3 clients reject old responses. A later
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
[Current work](CURRENT_WORK.md#accepted-release) records source, delivery and
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
