# A holding's next research check

This source candidate connects a current positive Portfolio holding to company
research and an authored Follow-ups check. Source, native and client-delivery
acceptance remain pending. Android 1.46 provides the preceding complete Follow-ups
reading report.

## Research and keep a check

1. Load Portfolio, apply or reset any pending form, and finish its current catalog
   review. A valid applied draft may still have unsaved changes.
2. Open the holding's company research. Inspect its exact listing and share class,
   authored shares, USD cost basis or unavailable value, and original confirmation
   date. Existing source dates remain visible in their own sections.
3. Open **Review holding and keep a next check**. Enter a complete question and a
   UTC due date. If Follow-ups has not been loaded, explicitly load it here; the
   question and date stay in the form.
4. Preview the complete question, due date and exact listing. The position is
   context for this research visit. The check saves the authored question and
   due date; it does not copy the position readout into the saved resource.
5. Explicitly create one entry in the Follow-ups draft. An existing check can be
   opened for review; creation never replaces it.
6. Return to the retained Portfolio view. Open Follow-ups, review its whole draft
   and use its separate Save. A fresh Load reads the saved entry. Portfolio and
   My Watchlist keep their independent drafts and Saves.

A holding can use this workflow outside My Watchlist, including before that
resource has been loaded. It does not add the holding to My Watchlist. General
research for a closed or zero position remains available; the new position/check
action requires a current positive holding.

## Dates, limits and lifetime

The position is authored Portfolio draft context. Its confirmation date is not
a quote date, a performance date or the time of research capture. Unknown cost
basis stays unavailable. The due date is the author's plan, not a source event.
No price, gain or recommendation is inferred.

The existing complete question limit is 500 code points on one line. Invalid
characters, dates or oversized input require correction; no text is clipped.
The whole Follow-ups resource retains its 20-entry limit and one entry per
listing, including entries outside a filter or chosen review.

A changed draft, Save or recovery state, Portfolio form, catalog, company visit,
route or session retires the old creation preview. Portfolio or Follow-ups
local draft-file activity also retires it. Returning to earlier values does not
revive an old preview. Review the current context and preview again.

Creation changes only the Follow-ups draft. It makes no financial source request,
online Save, Watchlist edit or Portfolio edit. This candidate adds no schema,
provider, dependency, fee or deployment. Synthetic tests and local delivery do
not establish authenticated owner-record or physical-device acceptance.
