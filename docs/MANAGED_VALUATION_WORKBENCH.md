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

## Apply a reported Annual revenue basis

The source candidate adds **Use reported Annual revenue as a model basis** inside
the workbench. Load Annual explicitly, then choose one of its three named revenue
concepts. The choice starts empty. An admitted positive USD revenue value can be
used even when operating income or a related margin is unavailable. Unsupported,
missing, nonpositive or out-of-model-range values keep an explicit refusal.

1. Inspect the exact value and start/end period, filing/accession, original cutoff,
   completion time and separate Company Facts/Submissions capture times. Historical
   and retained previous evidence keep their qualifications.
2. Select **Preview starting revenue change**. Compare the complete current and
   proposed raw inputs for both models, including full company/share-class identity,
   CIK, catalog and model versions. The only proposed change is exit-model Starting
   revenue. Preview makes no request, calculation or saved change.
3. Select **Apply reported revenue to authored inputs** once. This replaces that
   one field with the exact reported decimal text and clears prior calculation.
   Growth, margins, shares, cash, debt and all DCF fields stay authored and unchanged.
4. Calculate separately. A current applied Annual reference joins the complete
   Exit multiple note preview automatically. Inspect the entire note before its
   explicit append. DCF notes do not inherit it. Optional dated Price context keeps
   its existing choice. The whole note must fit the existing 2,000-code-point limit;
   an oversized note is refused in full without truncation.
5. Capture the report and use Back. Save raw model inputs through their independent
   Load, Stage, Review and Save controls; save the cited note through Watchlist Save.
   Neither Save performs the other. Saved inputs and draft files contain raw authored
   maps only, with no Annual packet or source reference. The existing report retains
   the Annual packet, cited authored note and calculated inputs/results.

Any editor, source, choice, company, navigation or session change withdraws a
pending Apply preview. Returning to an earlier value does not revive it. After
Apply, edits to other assumptions and explicit calculation retain its source
reference. Changing Starting revenue, restoring/discarding inputs, leaving the
company, source changes or session retirement permanently retire that reference.
Prepare a new preview and apply again to attach a new one. Reported operating
cash flow or cash after PP&E is never mapped into DCF cash flow automatically.

Source and automated native acceptance remain separate from client delivery,
browser layout and physical-phone acceptance. This increment has not been released.

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
Confirmed saved inputs remain in the separate resource described below. Load and
compare them explicitly before replacing the editor. Saving a Watchlist note or
capturing a report does not save editable workbench inputs.

## Draft files for one valuation editor

The source candidate adds explicit file recovery for the current company's
valuation editor. Open **Valuation inputs files** to capture both complete raw
input maps, model versions, full listing identity, CIK and catalog digest. The
browser requests a download; Android uses the existing chosen-document writer.
The plain-text JSON file contains private authored assumptions. Store it privately.
It excludes prices, source packets and calculated results and is not a backup of
the saved valuation resource.

1. Capture the current editor explicitly. Invalid numeric text, whitespace and
   empty fields stay exact within the existing 512-code-point field limit. A
   rejected oversized input blocks capture until corrected or discarded.
2. Select a file to read it locally. No saved-resource Load is required. The file
   must match the current account/backend scope and the exact current company,
   listing, CIK and catalog. Unsupported format/model versions, duplicate keys,
   malformed UTF-8, extra fields and files over 128 KiB are refused.
3. Review the complete file inputs against the complete current editor, including
   any rejected-field issue. Restore replaces both editor maps only after this
   explicit comparison. It marks the editor dirty and clears calculated results.
4. Calculate separately. To save online, use the existing explicit Load, Stage,
   Review and Save workflow. File restoration changes neither the saved-resource
   draft nor its current online save base.

Changes to the editor, company/catalog, route, session or saved-assumptions
operation withdraw stale file controls. Returning to an earlier value cannot
revive them. A rejected file, cancellation or stale completion leaves newer work
unchanged. The controls reuse the complete raw-input readouts and Precision Desk
44px actions; opening the disclosure starts no request or calculation.

This candidate has no publication, browser-layout, new native chooser or phone
acceptance. The live website, API and Android 1.32 remain unchanged.

## Save and reopen editable inputs

The published website has an initially closed **Saved valuation inputs** panel
below the workbench. Production storage is enabled. The
[private storage proof](MANAGED_VALUATION_STORAGE_PROOF.md) passed its fixed cloud
phases with invented data. Default source configuration keeps storage disabled
for other deployments. Release checks did not exercise an authenticated owner
Save or owner records. Matching Android saved-input delivery remains separate.

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
automatic financial conversion or historical multiples. Saved-input storage is
enabled on the published website/API after private
invented-data qualification. Authenticated owner use and matching Android
physical acceptance remain separate.
