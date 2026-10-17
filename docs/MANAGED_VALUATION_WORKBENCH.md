# Authored company valuation

Company research has an initially closed **Authored valuation workbench** below
the research report. It contains a cash flow DCF and an exit EBITDA multiple
model. Both models use explicit authored assumptions in full USD and actual
diluted share counts. A model value is scenario context, not a provider fair
value, price target or investment recommendation.

## Enter assumptions and calculate

Monetary amounts, shares, rates and scenario assumptions start empty. The year
controls start at five. Enter zero explicitly when an assumption is zero. Plain
decimals preserve the exact typed text, including invalid entries; scientific
notation, commas and currency symbols are refused by the calculators. Numeric
operands admit at most 64 characters, 18 fractional digits and an absolute value
of 10^30. Rates admit at most four fractional digits. The temporary editor can
retain up to 512 characters per field so a longer invalid numeric entry does not
restore an older valid value. An entry beyond that editor bound shows a refusal
and blocks calculation until that field is corrected or the inputs are discarded.

Select **Calculate authored scenarios** to calculate both models. Typing never
calculates or requests a source. Each model has Conservative, Base and Expansion
scenarios. A refusal in one model does not hide the other model's result.

The DCF projects starting unlevered cash flow at the selected annual growth rate
for five to ten years. It discounts each year-end flow and a Gordon-growth
terminal value. WACC is 1–30%; terminal growth is -2–5% and must be below WACC;
scenario growth is -50–50% in Conservative ≤ Base ≤ Expansion order. Equity
value is enterprise value minus the signed bridge: a positive bridge reduces
equity value and a negative bridge adds net cash. Reported operating cash flow
and cash after PP&E purchases are not automatically treated as FCFF.

The exit model projects revenue for one to ten years, applies the authored EBITDA
margin and exit multiple, then discounts terminal enterprise value. It adds cash
and subtracts debt before dividing by diluted shares. It excludes interim cash
distributions. Revenue and shares must be positive, cash and debt nonnegative,
growth -50–100%, margin -20–80%, discount rate 0.1–80%, and the multiple positive.
The scenario names do not establish an ordering of the resulting values.

Inspect the scenario tables, DCF annual projections and terminal contribution,
exact inputs and model methods. A nonpositive equity result retains its signed
enterprise and equity values with an unavailable positive per-share conclusion.
The DCF warns when the rate gap is below one percentage point or a scenario's
terminal contribution exceeds 80%. These warnings do not certify other results.

Each model also calculates 25 Base sensitivity combinations. DCF varies WACC by
-2, -1, 0, 1 and 2 percentage points and terminal growth by -1, -0.5, 0, 0.5 and 1
percentage points. Exit multiple varies discount rate by -2, -1, 0, 1 and 2
percentage points and exit multiple
by -2, -1, 0, 1 and 2 times. Other inputs stay fixed. Each cell keeps its own
result or refusal; a refused cell cannot inherit a neighboring value.

## Keep a result in the research workflow

The workbench also supports a [dated raw-close comparison](MANAGED_VALUATION_PRICE_CONTEXT.md)
for each authored scenario after the existing explicit Price load. The source
date and authored share-basis limits remain visible. Including the comparison in
a note requires an explicit choice before the complete preview.

The inputs belong to one full company/listing identity and catalog. They survive
section changes and Back followed by return to that company. Researching another
company retains the draft with editing paused. **Discard inputs and use SYMBOL**
explicitly replaces its ownership. **Discard valuation inputs** clears the current
company's temporary draft. A changed catalog or share class cannot inherit it.

These inputs are held in memory. Reload, session retirement or sign-out clears
them. They join the existing leave warning and sign-out review, without adding a
fourth saved resource. Saving the watchlist does not save the editable workbench.

To keep one model/scenario, open **Add a valuation result to the note draft**.
Select the model and scenario, then **Preview valuation note**. The complete note
includes its original text and the selected assumptions, results, formulas and
model versions. The existing single-line 2,000-code-point limit refuses the whole
proposal when it cannot fit. Nothing is clipped. **Add valuation to note draft**
consumes that preview once; use the existing Watchlist Review and Save workflow
to persist it. Conflicts and uncertain saves retain the existing recovery rules.

Changing inputs, recalculating, editing or saving the note, changing source state,
navigation, catalog or session invalidates an old append. Returning to an earlier
value or company does not revive that action. Watchlist, Follow-ups and Portfolio
continue to save independently.

## Capture a complete report

After calculating, prepare a [research report](MANAGED_COMPANY_REPORT.md). A current
authored calculation can support a report without loading a provider source.
Unloaded sources stay `not_loaded`. The report captures both models, raw input
text, calculator inputs, model versions/methods, scenario outputs, projections,
sensitivity cells and refusal reasons. It keeps any separately loaded source
packets and their original dates. Authored assumptions are not bound to reported
facts merely because those facts are displayed nearby.

Company JSON format 5 and the browser HTML copy retain this complete capture and
any dated price comparison. The valuation and comparison share the existing
128 KiB allowance; the whole report refuses overflow.
Changing any valuation input removes the current report and blocks stale file
delivery. A batched note edit followed by identical-text restoration also keeps
the old report invalid. Exported copies do not update with later edits.

Source checks, rendered desktop geometry, packaged native execution and release
acceptance are separate. This workflow does not add a provider feed,
automatic financial conversion, historical multiples or a saved
assumption record.
