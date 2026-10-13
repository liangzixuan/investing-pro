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

Implementation and acceptance are recorded in [Current work](CURRENT_WORK.md).

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
This increment adds no cash history, chart, watchlist comparison column or
Annual-to-note field.

The Annual request/response schema and generation definition are `2.0.0`. The
route and four request keys are unchanged. Version-1 Annual requests are rejected
before provider or budget work; version-2 clients reject old responses. A later
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
