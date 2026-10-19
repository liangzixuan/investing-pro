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

The editor is held in memory. Reload, session retirement or sign-out clears it.
The source candidate adds a separate saved-input resource described below.
The published client still has session-only inputs. Saving a Watchlist note or
capturing a report does not save an editable workbench.

## Save and reopen editable inputs

The source candidate adds an initially closed **Saved valuation inputs** panel
below the workbench. Its storage is disabled by default. Source tests do not
establish provisioned storage, real-account persistence or a published release.

1. Select **Load saved inputs**. This reads the independent saved resource and
   preserves the current editor. It makes no Price, Annual or Filings request.
2. Select **Review current inputs for staging**. Inspect both complete raw input
   maps, model versions and full company/catalog identity against the previous
   draft entry. The explicit catalog identity read does not load financial data.
3. Select **Stage reviewed inputs**. This replaces only that listing's entry in
   the valuation draft. It does not save, calculate or change a note.
4. Select **Review valuation draft**, inspect all complete entries, then select
   **Save valuation inputs**. This saves independently of Watchlist, Follow-ups
   and Portfolio. A later editor change cannot be acknowledged by an older save.
5. In a fresh session, load saved inputs explicitly. Open the matching company,
   select **Review saved inputs for SYMBOL**, and compare the complete current
   editor and confirmed saved entry. Select **Use reviewed saved inputs** to
   replace the editor. Calculated results are cleared; select **Calculate authored
   scenarios** separately.

One entry stores both current model versions for an exact listing, with at most
20 unique listings. Each input retains its exact accepted text, including empty
or invalid numeric text, up to 512 Unicode code points. A rejected oversized
paste blocks staging until corrected or discarded. Numeric calculator limits
remain separate. The payload limit is 256 KiB; overflow refuses the whole change.
Source evidence, prices, calculated outputs and preview actions are excluded.
Unsupported model versions and extra fields are refused without conversion.

The draft-entry disclosure supports complete inspection and explicit removal.
Removal needs its own Review and Save. A changed catalog requires complete
identity review and an explicit apply, followed by Save before the updated saved
entry can be used. Stable listing/share-class changes and conflicting issuer
claims are refused. An unspecified CIK does not grant source-read eligibility.

A conflict retains both complete versions for comparison. Load latest, then use
the saved version or keep the valuation draft; keeping the draft still needs
Review and Save. An uncertain save exposes **Reconcile original valuation save**,
which reuses the original command. It does not issue a replacement command.
Stale actions after navigation, cancellation, catalog change or session
retirement cannot apply an earlier proposal. Back preserves the editor.

Both the valuation draft and unsaved editor join leave and sign-out review.
Sign-out clears all local resource copies and results before the SDK call.
Confirmed saved inputs remain in the saved resource; this is not automatic
draft storage or a backup service.

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
automatic financial conversion or historical multiples. Saved-input storage
provisioning and real persistence qualification remain separate from this source
workflow.
