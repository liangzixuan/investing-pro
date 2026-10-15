# Company research sources and loaded snapshot

## Load and inspect sources

The always-visible **Research sources** area shows Price, Annual and Filings for
the current company visit. **Load** or **Refresh** selects that source's section
and starts one explicit request through its existing model. **Cancel** stops
that source's pending local work. **Inspect** opens the section without a
request. Opening the company or this overview does not load sources.

Each source keeps its own unloaded, loading, loaded, retained or failed state
and original completion time. A loaded Annual response can still contain refused
financial values; a loaded Filings response can be empty or unavailable. The
detail section retains those reasons and coverage limits. Unsupported Price has
an explanation and no Load action; the other sources remain independent.

Price names the requested month or year separately from the loaded range.
Change the selection in Price, then load it explicitly. A staged choice does not
change the retained response or its dates. Annual and Filings share the existing
SEC admission budget across devices. A returned cooldown requires a later
explicit retry; there is no Load-all action, countdown or automatic retry.

Actions belong to the current visit and exact selection, including on a settled
company URL. Leaving or replacing that visit, catalog invalidation and session
retirement fence stale actions and late responses. Section changes retain
validated evidence and cancel pending work through normal navigation. The note
draft, explicit whole-watchlist Save and report preparation keep their existing
rules.

## Read the loaded snapshot

Company research has a **Loaded research snapshot** disclosure below company
navigation and the source actions. It combines evidence already loaded in this
company visit. Opening it makes no request, calculation or saved change. **Open Price section** and
**Open Annual section** and **Open Filings section** use normal section navigation;
loading remains explicit.

Price shows the last admitted raw close, trading date, original requested window
and request times. Tiingo raw closes are unadjusted for splits and dividends and
are not live quotes. An unloaded Price section stays unavailable even when
Annual is loaded. A refresh in progress or retained previous response remains
labelled; opening the snapshot does not confirm newer data.

Annual retains the observed filing coordinates and index link, cutoff,
completion and both original source capture times. Each revenue basis remains
separate, with exact unscaled USD amounts and its own selected-report period.
Missing, rejected and withheld bases remain unavailable. No basis is selected
silently, and an unavailable income value is not replaced with cash flow.
Current-use and historical qualifications use the existing admitted resolution.

Operating cash flow, operating cash flow less PP&E purchases, working capital and
current ratio reuse the existing value displays. Each keeps its independent
availability, period or balance date and current-use qualification. Liquidity
balances and annual flows are not combined into a new financial measure.
The full Annual section retains source inputs, filing references and validation
details. The snapshot adds no health score, valuation, investment verdict or AI.

The Annual 5.0.0 candidate also shows reported total assets, total liabilities
and parent equity in a separate balance-sheet section. Each amount keeps its
own balance date, availability and original current-use qualification. Parent
equity excludes noncontrolling interests. Annual retains the exact concepts,
observations and source references; missing totals are not derived from other
balances. The prepared report captures these same admitted values and dates.
Current work records the candidate's verification and delivery status.

Filings shows the newest observed entry and the loaded count, with the original
90-date request window and independent request and source times. An unavailable
source remains distinct from an available empty list. A pending or failed refresh
keeps its previous-response warning; an invalid replacement clears it. Source
details retain truncation, older-continuation and incomplete-window qualifications.
Only the current recent-filings object is checked; filing bodies are not loaded.

Evidence must belong to the exact visit's catalog, listing, share class, issuer,
origin and CIK selection. It stays available across section changes. Closing or
changing company clears the old models; a new visit starts with the disclosure
closed and no restored evidence. Session retirement clears the same model state.
The watchlist note and whole-draft Save remain independent of this view.

The browser and Android share this component. Local checks and current producing
CI acceptance are recorded in [Current work](CURRENT_WORK.md). Synthetic
verification does not establish production account or physical-phone acceptance.

The separate [research report preview](MANAGED_COMPANY_REPORT.md) captures the
loaded source summaries alongside a labelled authored draft after explicit
preparation. Its preparation time does not renew these source dates. Source
actions stay outside the captured report; the preview and complete document
remain read-only. Loading another source invalidates the prepared report rather
than adding evidence to it silently.
