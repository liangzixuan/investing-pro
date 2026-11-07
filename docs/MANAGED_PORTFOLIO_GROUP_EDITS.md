# Review a group of Portfolio edits

The grouped-edit workflow provides a separate working copy for several authored Portfolio
changes. It uses the existing registered listings, ledger limits and exact
projection. It makes no price request, trade or online Save.

## Workflow

1. Load the latest Portfolio and finish its current-catalog identity review.
   Register any needed listings before starting the group. Finish pending forms,
   file operations and save recovery first.
2. Choose **Start group of edits**. The current draft is the starting point,
   including its already-applied unsaved changes.
3. Use the existing ledger controls to apply opening-balance, transaction,
   same-day order, CSV or split edits to the group. Each complete candidate must
   keep every intermediate cash and share balance valid. The original Portfolio
   draft stays unchanged.
   **Undo group edit** restores the previous complete edit; **Redo group edit**
   restores an undone edit. Each CSV import, split or other applied editor action
   is one step. Apply or reset unfinished forms and finish any file read first.
4. Choose **Review all changes**. Inspect before and after cash, each registered
   holding, known or unknown basis, realized-gain estimates and the complete
   authored activity order. A position that is no longer held is labelled
   **Not held**. Unknown amounts remain unknown.
5. Choose **Apply all changes** to replace the Portfolio draft once, **Continue
   editing group** to revise it, or **Cancel group** to keep the original draft.
6. Use the existing **Review portfolio** and **Save Portfolio** actions. An
   explicit fresh Load confirms the separately saved version.

An unfinished group form blocks preview. The group holds the existing pending
edit lock throughout editing and review. Ordinary editor cleanup cannot release
that lock. Changing the source draft, save/recovery state, catalog, session,
Portfolio visit or file-operation owner retires the group. Returning to equal
values cannot restore its authority. A UTC day change requires another preview.

## Correct a settled group edit

The source candidate adds history for up to 20 recent edits in the active group.
The controls show how many edits can be undone or redone. At the limit, a new edit
removes the oldest undo step. The complete starting draft remains the baseline
for comparison and Cancel. A new valid edit after Undo replaces the redo branch;
an invalid edit or an unchanged value does not. Unknown amounts, complete
activity order and exact listing identities are preserved.

Review and Continue editing keep this history. Apply, Cancel, session retirement
or leaving the owned Portfolio visit clears it. History is held only in memory;
it is not saved to Portfolio or a draft file. The delivered Android 1.79 grouped
workflow predates these history controls; later delivery is recorded separately
in [Current work](CURRENT_WORK.md).

## Ownership and checks

`managed-portfolio-group-edits.ts` owns the proposal and single-use preview.
`managed-portfolio.ts` owns the edit lease and atomic draft replacement.
`ManagedPortfolioGroupEdits.tsx` hosts the existing editor;
`PortfolioGroupComparison.tsx` renders the complete passive comparison.
The saved schema, API and persistence remain unchanged.

Synthetic checks cover multiple edits, cancel, atomic apply, separate Save and
fresh Load, unknown cash/basis, closed holdings, same-day order, invalid
intermediate balances, pending forms, stale callbacks, ownership changes and
synchronous subscriber replacement. Browser, native-device and release acceptance
remain separate from these source checks.
