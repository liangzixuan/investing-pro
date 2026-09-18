# Saved comparison companies

Remember one ordered group of two or three companies from a **My Watchlist**
financial comparison. This saves the company selection, so you can repeat the
comparison in a later session with current data.

## Save and restore

1. Choose My Watchlist in Financial screen, select the companies and run the
   screen. Select two or three distinct companies and open **Compare companies**.
2. Select **Save these companies**. This creates or replaces the one saved group.
3. Later, select **Restore saved companies** to validate and select the saved
   listings in My Watchlist. Your filters and columns stay unchanged. Previous
   results, comparison and price context clear.
4. Select **Run financial screen**. When every saved company is admitted in those
   results, **Compare saved companies** opens the comparison in saved order.
   **Load prices** remains a separate explicit action.

If filters exclude a company, the full group cannot be compared. Adjust the
filters and run again, or make a new manual selection. The app never substitutes
a similar ticker, restores an old result, broadens your filters or compares a
partial group. Manual selection and saved financial views keep their existing
behavior; they can invalidate a pending saved comparison action.

**Clear saved companies** clears only this saved group. It works even when its
members are no longer usable. It leaves watchlist membership, notes, financial
views, filters and columns alone. Clearing retains the settings record's version
for the next Save; it does not erase the underlying vault record.

## Changed data and conflicts

Restore resolves every saved full identity, including listing, issuer and CIK,
against the current catalog and current version of My Watchlist. An unrelated
watchlist edit or a reconciled catalog refresh can still resolve when every
identity is unchanged. A removed or changed member makes the selection
unavailable; use the normal watchlist reconciliation flow where required.

The catalog digest recorded at Save describes its origin. It does not permanently
lock the group to that old catalog. Current admission is checked again on
Restore and the existing financial-screen run.

If another session changes the saved group, reload it before saving again.
Version preconditions prevent a stale replacement or clear. Pending operations
are bound to their session, saved record, catalog and watchlist context; late
responses cannot restore a former selection or overwrite newer UI state.

## Stored scope

The encrypted local settings record `financial-comparison-selection` uses a
version1 payload with a nullable selection. A selection contains only its
catalog-digest provenance and the ordered full identities of two or three
distinct issuers. Save and resolve reject duplicate listing IDs, issuer IDs or
CIKs, malformed identities, extra fields and incomplete groups.

The record stores no financial result, price, history, index, drawdown, chart
range, watchlist note, document or source payload. Existing saved financial-view
v1/v2 formats, vault schema and financial-screen transport are unchanged.

Load, Save, Clear and Restore use only local settings/catalog/watchlist operations.
They make no SEC or Tiingo request. Only the existing explicit financial screen
and price load acquire source data. Prices remain in active-session memory.

## Verification

Use synthetic records to verify save/replace/clear across vault reopen, ordered
restore and all-member comparison, unchanged unrelated records, optimistic
conflicts, changed identity fields and duplicate issuers. Check deferred writes,
resolve, screen results and retained UI handlers across session/catalog/watchlist
and selection changes. Missing members and restrictive filters must never yield
a partial comparison. Confirm no provider operation on local group actions and
no result/provider fields in stored payloads. Check keyboard operation and
desktop/narrow layouts in external Brave.

The workspace checkpoint records the exact release and completed verification.
This guide does not establish broad source coverage or a provider entitlement.
