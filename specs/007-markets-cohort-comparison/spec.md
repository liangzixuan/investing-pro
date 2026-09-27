# Compare the loaded Markets board

## Outcome

After loading a Markets board, compare every selected company over dates observed
for all of them. Show adjusted-price change and maximum drawdown without another
data request. This extends the personal market homepage using its existing price
histories; it does not establish whole-market or InvestingPro coverage.

## User flow

1. Choose Default suggestions or a My Watchlist selection and load the board.
2. For two through six complete histories, see a comparison table in the original
   cohort order, with the actual shared start/end dates and observation count.
3. Open the coverage disclosure to inspect requested bounds, observed first/last
   dates, omitted observations, exact first/last adjusted closes and drawdown
   peak/trough dates for each company.
4. Open company research and return to the same accepted board and comparison.

The table shows the listing and venue, adjusted-price change and maximum
drawdown. Keep the established four-place decimal results, including the
explanation for a positive decline rounded to zero. State that these are shared
observations within the loaded 1M histories, rather than a guaranteed full month.
Provider-adjusted price change is not independently reconstructed total return.
Missing observations can hide declines.

## Admission and calculation

- Use the same matching accepted snapshot as the price board. Require the entire
  expected cohort and its original order; never silently remove a failed member.
- Validate exact default rows or all eleven saved-watchlist identity fields,
  cohort/catalog identity, unique listings and matching overview/history identity
  and windows before calling the existing pure comparison engine.
- Extend that engine's maximum from three to six series. Preserve its existing
  formulas, exact decimal arithmetic, 4,096-bar bound, complete-series validation
  before date intersection, and immutable output.
- An unloaded snapshot produces no table. One member explains that comparison
  needs at least two. Missing, failed or mismatched members produce an explicit
  unavailable state. Fewer than two shared dates shows insufficient history and
  coverage without numeric performance results.

## Lifetime and acquisition

Derive the comparison; do not add a selection, cache or acquisition coordinator.
Draft changes hide a mismatched snapshot. Session, catalog and selected-member
retirement follow the existing board lifecycle. Notes and unrelated membership
edits retain an unchanged cohort. Back retains accepted data.

A wholly failed same-cohort refresh may continue displaying the prior snapshot
with its original dates. A usable partial result replaces the snapshot as a
whole and makes the complete-cohort comparison unavailable. Do not merge old
successful rows into a newly accepted partial result.

The feature adds zero API or provider requests. Existing explicit loads, the
fifteen-minute interval, four-start rolling-hour budget and maximum six EOD
requests per board load remain unchanged. Company handoff reuses the loaded
history. BEA agenda state stays independent. No new API, schema, dependency,
storage, comparison chart or source entitlement is needed.

## Acceptance and limits

Focused checks cover two through six inputs, rejection of seven, shifted dates,
invalid excluded bars, exact complete-cohort admission, partial and retained
states, draft/identity invalidation, and no incremental acquisition. Verify
semantic headers, keyboard disclosure, readable dates and desktop/390px layouts.
Mutation and adverse scenarios use synthetic records. One bounded live default
board load may establish the populated three-company table; failure or partial
coverage remains a stated limit, without another load or retry.

The unchanged native and applicable hosted release gates, guarded activation,
limited Brave QA and independent final review remain required. CURRENT and saved
handoffs record actual execution; specification checkmarks alone are not release
acceptance.
