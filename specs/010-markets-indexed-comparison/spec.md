# Indexed comparison for a loaded Markets board

This outcome is in progress and unreleased. Accepted a88 release
`bf5113cdd0e0a3708051620bfc5a590f5c2ad83a` is the baseline. Workspace
[CURRENT.md](../../../CURRENT.md) records scope, ownership and actual release
evidence. The [plan](./plan.md) and [tasks](./tasks.md) track this change.

Show how every company in a loaded Markets board moved over the same observed
dates. Place an indexed chart in **Compare this board**, alongside the existing
adjusted-price change and drawdown table. The chart starts each company at
`100.0000` on the first shared date. It reuses the exact comparison result and
does not load prices or change the selected company's chart or Research action.

## Data and scope

Admit the complete matching two-to-six-company snapshot through the existing
comparison adapter. Preserve its original cohort order, shared dates and exact
adjusted-close/index strings. Never omit a failed member, fill a missing date or
derive a separate calculation from chart coordinates. A single member, incomplete
or invalid snapshot, or fewer than two shared dates keeps its existing explicit
state without a numeric plot.

The index uses provider-adjusted USD EOD history already loaded for the board's
1M request. The shared window may be shorter than a month. Dates are spaced by
observation; connecting lines only guide the eye and missing dates can hide
declines. This is not invested wealth, a benchmark or an independently
reconstructed total return.

## Presentation and retained state

Reuse the existing ECharts comparison chart in Research and Markets. Give each
of six possible series a distinct labeled color, line and marker combination.
Use the actual listing ID, symbol and venue for labels, retaining duplicate-label
disambiguation. The heading level must fit both callers.

Keep the accessible numeric summary and exact-data disclosure. Page exact values
in groups of 25 observations and allow the wide table to scroll inside its
labeled, focusable region. All series remain represented. If a tooltip would
exceed its existing bounds, direct the user to the exact table without silently
dropping companies. Unsafe plotting values, rounded-to-zero indices or a chart
failure retain the exact table and comparison metrics.

One stable comparison result belongs to the matching accepted snapshot.
Unrelated renders, inspection, row ordering or chart selection do not reset its
open disclosure or page. A replaced snapshot resets inspection and releases old
references. A callback from an obsolete result cannot revive it. Preserve the
existing full-identity, draft, catalog, session and view retirement rules,
same-cohort failed-refresh retention and whole partial-result replacement.

No new API, schema, dependency, acquisition, price cache or calculation engine is
introduced. The board's explicit load/refresh remains the acquisition owner,
with its fifteen-minute cadence and four starts per rolling hour. BEA, Fed and
filing workflows remain independent.

## Acceptance

- Two, three and six series keep original order, exact shared dates and strings,
  with every first index equal to `100.0000`.
- Single, partial, invalid, zero-shared-date and one-shared-date inputs retain
  their honest nonnumeric states. No subset is plotted.
- Unrelated rendering preserves exact-data inspection; replaced or retired
  snapshots clear it. Stale callbacks cannot restore old data under new labels.
- Duplicate labels, unsafe magnitude, rounded-zero, tooltip bounds, chart
  failure, reduced motion, resize and disposal preserve existing behavior.
- Keyboard disclosure and paging work. Desktop and 390px layouts keep all
  labels readable and table overflow local. Chart inspection makes no requests.
- Existing Research comparison behavior passes regression checks. Source-bound
  synthetic QA covers populated and adverse cases before a bounded live check.
- Separate feature/generated closure, unchanged native verification, all
  applicable exact-revision hosted jobs and guarded activation must pass before
  release acceptance. Missing live coverage remains an explicit limitation.
