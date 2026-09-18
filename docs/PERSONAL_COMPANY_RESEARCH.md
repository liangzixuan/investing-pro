# Company research workspace

Open a company from security search, catalog or financial-screen results,
My Watchlist, recent watchlist filings or holdings. The company research heading
keeps its symbol, issuer name, exchange and security name visible. A comparison
column's **Research** action opens that exact selected listing, including a
company retained from another result page.

Five sections organize the existing panels:

| Section      | Existing capabilities                                        |
| ------------ | ------------------------------------------------------------ |
| Price        | Quote, price history and market analytics                    |
| Financials   | Annual and quarterly statements, financial quality checks    |
| Valuation    | Valuation history, historical multiples, DCF and reverse DCF |
| Peers        | Manual peer selection and comparison                         |
| SEC evidence | Dated quarterly observations and primary-filing context      |

The sections retain their existing data availability and explicit Load actions.
Moving between sections does not request data or save anything. Loaded data and
DCF draft assumptions remain in active-session memory while sections are hidden.
The DCF model has stricter input limits than the watchlist. If an exact company
identity or loaded input falls outside those limits, that panel explains why
cash-flow valuation is unavailable while company research remains usable.
Names are not shortened or substituted to produce a valuation.
Hidden panels stay mounted, but their controls are absent from keyboard and
accessibility navigation. Tabs support Left/Right arrows, Home and End.
DCF links to missing price or annual inputs reveal the target section before
moving focus to its heading.

**Back to…** returns to the originating control without clearing the company or
the original screen. If that control has disappeared, focus returns to its
section heading. Reopening the same admitted identity preserves loaded data and
drafts. **Clear company**, a different admitted identity, catalog invalidation or
workspace/session loss clears the company state under the existing rules.
Pending responses and old callbacks cannot revive data from another identity.

Financial screening criteria, selected watchlist listings, display columns,
results and comparison remain separate from company navigation. The comparison
Research action verifies the current query, scope, snapshots and retained row
before opening it; it does not perform a provider request or saved-data write.

This view does not add financial metrics, provider coverage, a new company URL,
browser storage or a saved layout. Local access and account behavior remain
unchanged. Explicit source requests retain their existing freshness and
availability limits; navigation is not a refresh.

## Find a saved company

The workspace header's **My Watchlist** link moves to the primary saved list.
Filter by ticker or company name to search only its already-loaded entries.
Matching ignores case, surrounding whitespace and canonically equivalent
Unicode spelling. It does not search notes or request the security catalog.
The filter is limited to 128 characters and stays in current-session memory.

Entries retain their saved order in pages of 50. Matching and total counts
distinguish a filter with no matches from an empty or unavailable watchlist.
Changing the filter starts at page1; removals or reloads clamp an out-of-range
page. Paging and filtering do not discard unsaved note drafts.

Use a row's **Research** action, then **Back to My Watchlist**, to return to
that control when it still represents the same visible identity. Otherwise
focus returns to the watchlist heading; the filter and page do not change to
search for a disappeared row. A newly selected company opens Price. Reopening
the same full identity preserves its current research section and loaded state.

Displayed positions and move arrows refer to the complete saved list, including
across page boundaries. Clear the filter before reordering so hidden neighbors
are not moved unexpectedly. Save note, Remove and reorder retain their existing
explicit versioned operations. Screening, filing checks and peer candidates
continue using the full admitted list, independently of its visible page.

Jump navigation, filtering, paging, Research and Back make no additional data
request or saved-data write. Session/workspace loss clears the browsing state
under the existing lifecycle rules. Multiple lists, tags, sorting, imports,
exports and saved layouts remain outside this feature.

## Move through saved-company research

Opening a saved row's **Research** action captures all current filter matches in
saved order, across watchlist pages. **Previous company** and **Next company**
move within those matches, with a position such as **Company 3 of 14 My Watchlist
matches**. The endpoints are disabled; navigation does not wrap or change the list
page. A single match has both controls disabled. Opening research from another
origin does not create a watchlist sequence.

Changing company clears loaded research and valuation assumptions and opens Price.
The controls disclose this reset. Note drafts remain shared with their current
saved identities and return when you revisit a company. There is no automatic
source request or save, and a separately chosen portfolio holding stays unchanged.
Section changes, Back and reopening the same exact company retain their existing
loaded state.

**Back to My Watchlist** keeps the original row destination throughout the
sequence. It returns focus there when the row still has the same visible identity,
otherwise to the list heading. It does not search another page for the current
company. Each Previous/Next transition focuses the new company heading.

Paging alone preserves the sequence. Editing the filter, or changing any saved
membership, identity or order, invalidates it and shows a restart instruction.
Returning the filter to its old text or removing and re-adding a company does not
revive the old sequence: explicitly open a row's Research action again. A note
save or same-identity conflict reload may retain the sequence only when the entire
ordered saved-list identities and catalog binding are unchanged. Old version-bound
callbacks remain inert. Navigation pauses during list saves or reconciliation and
is unavailable with stale or unavailable list data.

Clear company, research from another origin and workspace/session loss clear the
sequence. If an explicit search discovers a changed catalog snapshot, the sequence
is cleared and cannot be recaptured until the workspace is revalidated. It remains
a transient navigation aid, with no saved cohort, per-company valuation cache or
general browsing history.

## Capture a research note

When the selected company exactly matches a current My Watchlist membership,
**My Watchlist research note** appears above the five research sections. It is
the same note and draft as the saved-list row, even when that row is filtered or
paged away. Choosing a different holding does not change the research note.
Companies outside My Watchlist show guidance instead of an editor.

Typing in either editor updates their shared draft. Section changes, Back,
Clear company and ordinary company navigation preserve these watchlist drafts.
Only **Save research note** or the row's **Save note** performs the existing
versioned save and note normalization. Notes keep their 2,000-character limit
and existing control-character validation. No note is loaded or saved by
navigation, and editing does not automatically add a company to My Watchlist.

Both editors pause during a watchlist save or reconciliation. A version conflict
retains the draft when the full saved identity still matches; review the latest
list before explicitly retrying. Removed or replaced identities discard their
old drafts with a visible notice, including replacements with the same listing
ID. Workspace/session loss clears drafts. An unavailable list or stale catalog
blocks editing under the existing list rules. Note feedback remains specific to
its company; completing an earlier save does not clear another company's draft.

Saving a note retains existing downstream watchlist-version invalidation. This
feature does not promise to preserve comparisons bound to the previous version,
and introduces no persistence schema, browser storage or separate note service.

## Acceptance

- Keep all five panels mounted with only the selected panel exposed. Verify
  tab relationships, keyboard wrapping and untouched ordinary/modified links.
- Preserve loaded results and model drafts across sections, Back and reopening
  the same full admitted identity; clear them on changed identity or workspace.
- Ignore stale row, comparison, company-action and delayed-focus callbacks.
  Cover identity changes during pending requests and missing return controls.
- Verify exact research identities from all six origins and off-page comparison
  rows. Confirm navigation performs no provider request or persistence.
- Check desktop and 390px Brave layout, focus after navigation and return,
  long names, source links and hidden-panel keyboard accessibility. Use isolated
  synthetic data for populated scenarios and preserve the owner's real data.
- Verify 50/50/20 paging, bounded rendering at the existing maximum admitted
  watchlist size, canonical-text filtering, no matches and page correction.
  Preserve note drafts across filtering and paging; use absolute reorder
  indices and reject stale row actions after list, version or identity changes.
- Keep Research/Back focus bound to the current visible full identity, including
  same-listing-ID replacements. Preserve the full inputs for downstream panels
  and make no implicit request or write during list navigation.
- Verify both note editors share raw text and explicit normalization, including
  edit then Save before a rerender and duplicate retained Save callbacks. Keep
  all unaffected memberships in the one versioned write.
- Cover all eleven identity fields, an independently chosen holding, off-page
  membership, conflict reload/retry and failure, removal/replacement without
  draft revival, session loss, and late completion after changing companies.
- Check distinct labels and IDs, keyboard/Back behavior and long-note wrapping
  at narrow widths with synthetic data and no writes to the owner's watchlist.
- Verify filtered sequential order across the 50-row boundary, endpoint and
  single-match controls, unchanged original Back target, heading fallback and an
  independently chosen holding. A-to-B-to-A restores only current note drafts;
  changed-company research and DCF assumptions reset as disclosed.
- Preserve the sequence on paging and identical full-list note-version reloads,
  while rejecting old callbacks. Invalidate after filter changes, off-filter
  membership changes, reordering, every full identity-field change or session loss.
  Check repeated retained actions and delayed focus, including A-to-B-to-A.
- Verify sequential navigation, tabs and Back add no fetch or write; a pending
  explicit source load cannot populate the later company. Use synthetic desktop,
  keyboard and 375px layout checks without mutating the owner's saved data.

The workspace checkpoint records the actual accepted revision and validation;
this guide describes behavior and does not itself establish release acceptance.
