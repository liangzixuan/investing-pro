# Observed annual SEC report

In company research, open **SEC evidence** and choose **Load observed annual
report**. This explicitly requests current SEC Submissions and CompanyFacts for
the exact selected catalog issuer. Changing sections does not load or refresh
sources. Quarterly evidence and primary-filing context retain their separate
actions and meanings.

## What the result means

The observed target is selected from current Submissions metadata before reading
the financial values. Only unamended annual reports, forms 10-K and 20-F, qualify.
The greatest admissible report date wins, followed by filing date. Ties and
unresolved acceptance cutoffs remain unavailable; a convenient older report is
never substituted because its numbers happen to be present.

The view considers three revenue concepts separately: Revenue from contracts with
customers excluding assessed tax, Revenues, and Sales revenue net. Each uses the
same signed NetIncomeLoss concept. It does not combine revenue bases or substitute
ProfitLoss for a missing net-income concept.

Each base exposes its status, exact observations, period and source references.
An admitted pair requires one consistent annual duration, 335 through 395 days,
ending on the selected report date, with FY context, matching filing and valid
USD operands. Net margin is net income divided by positive revenue, times 100.
Negative income remains negative. Missing, conflicting or ineligible inputs
withhold the number and retain the reason; unavailable never means zero.

Selected evidence completeness, annual pair validity and current utility are
separate decisions. The complete selected set includes comparative and other-end
rows from the same accession before period filtering. A valid historical pair
can still fail the 485-day current-utility window. Inspect exact values and dates
before interpreting a displayed result.

## Bounds and source limits

One load uses at most two fixed SEC requests with the configured contact header.
The existing 8 MiB response, ten-second request, 20,000 requested-fact and 10,000
Submissions-row limits remain in force. The selected set allows at most 100
revenue and 100 income observations. Invalid requested rows, source failure, raw
source overflow or selected overflow withhold annual numeric results.

The load fixes its cutoff before source requests. Capture and completion clocks,
filing acceptance, catalog identity and source generation must remain consistent.
This is an observation of current Submissions and CompanyFacts, not a complete
historical filing inventory, point-in-time reconstruction or independent primary
document verification. Later corrections can change a future explicit load.

The API owns the greatest-target decision over the full bounded Submissions scan.
The browser validates the returned identity, target, joins, clocks, counts and
references and independently recomputes pair decisions. A selected-only response
cannot prove to the browser that Submissions contained no higher target. Source
hashes and generation identify the load; they are not cryptographic certificates
of completeness.

## Refresh and cancellation

**Refresh annual report** retires the previous result and its open disclosures
before requesting new evidence. **Cancel annual report** aborts the operation.
Changing company or catalog, disabling research, losing the session or unmounting
the panel also retires its request and data. A late response cannot restore an
obsolete result. Hidden research sections retain admitted active-session data.

There is no automatic refresh, saved report, raw-source cache, historical picker
or changed quarterly contract. Loading this panel does not change watchlists,
saved assumptions or notes. The separate screening and provider financial views
are unchanged.

## Coverage is a separate goal

The preceding frozen twenty-issuer convenience-cohort study found complete
selected sets for all twenty reports and 22 primary-confirmed eligible revenue
pairs across nineteen issuers. AVGO lacked NetIncomeLoss and remained unavailable.
That offline proof justified this bounded product path; it does not establish
representative universe coverage, all thirty shared-core metrics, standalone
quarters, TTM or the canonical 90% annual coverage target. See the
[capability status](./CAPABILITY_STATUS.md) for the remaining goals. Actual release
and runtime verification belongs to the workspace checkpoint and release handoff.
