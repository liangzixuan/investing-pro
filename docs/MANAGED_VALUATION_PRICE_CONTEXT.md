# Compare authored valuation with a dated price

Company research connects the authored DCF and exit-multiple workbench to the
existing explicit Price load. Each model keeps its assumptions, refusals and
three scenarios. The comparison uses the latest actual observation in the loaded
raw USD close packet. Its observation date can precede the requested window end.
It is scenario context, not a current quote, price target or recommendation.

## Load and compare

Enter assumptions and select **Calculate authored scenarios** in the
[valuation workbench](MANAGED_VALUATION_WORKBENCH.md). Use its Price section link,
then the existing explicit Price load. Opening the workbench, changing inputs,
viewing comparisons and preparing notes or reports make no source request.
Existing Price coverage and admission limits remain.

The six comparison rows show each displayed model value per share and its
percentage difference from the dated raw close. They reuse
`calculateAuthoredPriceComparison`: `100 * (model value / raw close - 1)`, with
256-digit decimal arithmetic and half-up rounding to two decimal places. The
input is the displayed model value per share, which already has the model's
rounding. A refused model or scenario retains its own reason. Missing, malformed,
pending, staged-range or foreign price evidence does not supply a substitute.

The reference retains the exact close text, observed date, requested window,
provider and original request/completion times. A retained previous response
keeps its warning; a failed refresh does not renew its dates. A requested range
change must be loaded before it can supply a new comparison. No quote, older
positive close or adjusted-price series replaces the selected packet.

The model uses authored diluted shares. The raw price is unadjusted for splits
and dividends. The app does not verify that these share bases agree or infer a
corporate-action adjustment. Reported operating cash flow is not converted to
unlevered cash flow. A percentage difference does not establish investment merit.

## Keep a selected comparison

Choose a model and scenario in the existing valuation note tools. Select
**Include dated price comparison** to add the reference and comparison to the
complete valuation excerpt. The default retains the ordinary valuation-only
action. A selected comparison must be available before its preview can proceed.

Preview shows the original note and complete proposed addition. The existing
single-line, 2,000-code-point limit refuses the whole proposal if it cannot fit.
Nothing is clipped. Append consumes the preview once; Review and Save remain
separate. Conflict and uncertain-save recovery use the existing coordinator.

Input edits and restoration, source replacement or pending work, note changes,
Save, navigation and session retirement cannot revive an old append. Back keeps
the existing company-owned assumptions. Watchlist, Follow-ups and Portfolio
drafts retain their independent ownership and Save controls.

## Capture the result

Prepared company reports retain all six rows, independent reasons, the exact
reference and the formula. JSON and passive HTML use the same captured result.
The `valuationPrice` section refers to the existing `valuation` and
`sources.price.response` graphs; it does not copy those graphs again. Their
original identity, source dates and complete values remain in the report.

Company JSON format 5 and the matching Android receiver change together. Earlier
company-report formats are refused by the current file handoff. This does not
change saved watchlists, import old reports or migrate an owner's files. The
existing whole-report limits remain; the valuation and comparison capture must
fit the existing 128 KiB valuation allowance. Oversized JSON or HTML refuses the
whole output.

Source checks, packaged native execution, visual acceptance, source integration
and publication have separate status in [Current work](CURRENT_WORK.md). Browser
work remains stopped. This workflow adds no provider, request route, subscription,
cloud resource, persistent record or broader price coverage.
