# Saved financial views

A financial view remembers your filters, sort and chosen financial columns.
Configure the Financial screen, run it, choose columns, name the view and select
**Save financial view**. Use **Save financial view as new** to keep a separate
definition. The existing encrypted local settings record stores up to twenty
uniquely named views; result rows and source documents are not stored in a view.

Choose a saved view and select **Load financial view** to restore its criteria
and columns together. Results, comparison and source inspection clear because
their criteria may have changed. Run explicitly to evaluate the loaded view
against current sources. Results and company comparison use the same restored
columns. Display-only column changes remain independent of numeric filters.

Catalog/My Watchlist scope and selected saved listings stay temporary. Loading
a view leaves them as they are, so one view can be reused for either cohort.
Loading makes no SEC request and performs no automatic save or migration.
Company research data, portfolio holdings and watchlist membership are unaffected.

## Existing saved screens

Old definitions contain criteria only. Loading one preserves the current
columns and explains that no column selection was saved. After running the
screen, an explicit Save records its columns; Save as keeps the old definition
and creates a new view. Neither opening the app nor loading an old definition
changes the encrypted record. Other views retain their names, IDs, criteria and
source-digest provenance during an explicit save or deletion.

If the record changed elsewhere, reload the saved views, review the current
definitions and save again. Existing optimistic version checks prevent a stale
record from overwriting a newer one. Pending responses and retained callbacks
remain bound to their workspace, catalog, selected view and submitted draft.

## Stored representation

The saved-view payload has its own version, independent of financial-screen
transport v13 and formula-set1.7. Both API and browser continue to admit the exact
version1 payload. Version2 requires every view to have a `display` field:

- `null` retains a legacy criteria-only definition.
- `{ visibleMetrics: [...] }` records one to twenty-six distinct existing metric
  identifiers in canonical `PERSONAL_FINANCIAL_SCREEN_METRICS` order.

Unknown, repeated, empty, oversized or unordered column lists and extra fields
are rejected at both boundaries. No result, scope, selected listing or arbitrary
layout data is admitted. An explicit new save writes version2; any other version1
views become null-display entries without changing their original fields.
Deleting a view preserves the current payload version and other definitions.
The existing vault record ID, mutation intent, version and idempotency protocol
remain unchanged. Saving a view itself adds no provider request or financial calculation.

The reported common-dividend and common-stock repurchase payments,
investing/financing cash flows, total-assets, total-liabilities,
cash and parent-equity fields are available for an
explicit column edit and save. Previously saved column lists keep their exact
contents and relative order; opening or loading an older view does not append
new fields. Old criteria retain their meaning. These fields do not require
another saved-payload version or a migration.

The **Common stock payments** preset selects only the two payment fields.
The existing eight-column **Cash flow** preset stays unchanged. Loading a literal
older twenty-four-column layout retains exactly those columns and their order;
only an explicit column edit and save adds either payment field.

## Acceptance

Verify mixed old/new records, save/replace/save-as/delete/reload, exact column and
criteria restoration after a component restart, and preservation of unrelated
views. Verify old definitions keep current columns and never upgrade on read.
Cover optimistic conflicts, malformed representations, stale saved callbacks,
and a pending save whose caller changes its draft. Confirm scope and saved-listing
selection survive a load, result/comparison columns agree, and loading performs
no SEC request or write. Use isolated synthetic records for Brave desktop/390px
save flows and preserve the owner's existing saved views.

The workspace checkpoint owns actual release acceptance; this guide describes
behavior and does not itself claim live provider coverage or completed validation.
