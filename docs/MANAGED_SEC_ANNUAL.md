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
resolving the issuer. The reviewed cohort maps AAPL to Apple and keeps GOOG and
GOOGL as distinct listings for the same Alphabet issuer. The caller cannot send
an arbitrary CIK or source URL. This is limited annual filing and reported-fact
coverage, with source dates and availability shown by the existing renderer.

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

## Reported annual history candidate

The selected candidate adds a collapsed **Read reported annual history** view
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

This is candidate behavior. Publication, hosted checks, native acceptance and
delivery are pending; [Current work](CURRENT_WORK.md) records the accepted release.

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
