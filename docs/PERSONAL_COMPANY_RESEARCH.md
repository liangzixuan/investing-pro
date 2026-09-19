# Company research workspace

Open a company from security search, catalog or financial-screen results,
My Watchlist, recent watchlist filings or holdings. The company research heading
keeps its symbol, issuer name, exchange and security name visible. A comparison
column's **Research** action opens that exact selected listing, including a
company retained from another result page.

Five sections organize the existing panels:

| Section      | Existing capabilities                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Price        | Quote, price history and market analytics                               |
| Financials   | Annual trends and statements, quarterly statements, quality checks      |
| Valuation    | Valuation history, historical multiples, DCF and reverse DCF            |
| Peers        | Manual peer selection, metrics, annual quality checks and a saved group |
| SEC evidence | Dated quarterly observations and primary-filing context                 |

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

## Inspect annual business trends

After **Load annual financials**, **Annual business trends** shows one metric at a
time: Revenue, Net income, Operating cash flow or Provider-reported free cash flow.
The signed bar chart uses ten fiscal-year slots from oldest to newest, a zero
baseline and nominal USD amounts. It does not calculate returns or annualized or
per-share values. Provider-reported free cash flow is distinct from the cash flow
derived by the DCF model.

Open **Inspect exact annual trend values** for all four original decimal values
and each returned year's own provider statement/release date. A **Missing year**
has no returned statement; **Unknown** means the year was returned without that
field. Both leave chart gaps and neither becomes zero. A known zero remains `0`
in the exact table. Dates are not invented period ends or filing timestamps.

Axis positions are approximate; the exact table is authoritative. If any known
value in the selected metric exceeds the safe plotting range, its entire chart
is withheld while all exact values and other metric choices remain available.
The table also remains available when the chart cannot initialize. A history
withheld by the existing annual checks, mismatched company identity or malformed
trend inputs has no trend view; the existing reported statements remain below.

Changing the metric makes no request or saved-data change and keeps keyboard
focus on the selector. Equal-content renders retain the current metric and open
exact table. Changed source content closes the table; refresh or a different
company resets the view under the existing annual-data lifetime rules. The full
statement tables and latest-year analytics remain unchanged. All values retain
Tiingo's most-recent corrected-history and active-session retention limits.

## Inspect a peer metric's inputs

Each metric cell in the Peers comparison has an **Inspect inputs** disclosure
identified by its company and metric. Open it to see the existing formula and
expression, exact result or unavailable reason, company identity, source
coordinate and retained operands. This uses the same comparison result already
on screen and makes no request or calculation.

Known operands retain their exact signed decimal strings and units; unknown
operands remain **Unknown**. Each annual operand shows its own fiscal year and
provider statement date, so revenue growth exposes both years. Valuation operands
show their own valuation dates. The response timestamp belongs to the cell's
coordinate when available; it is not a separate timestamp for every operand.
If the engine retained no operand references, the disclosure says so.

Provider-supplied multiples expose the supplied field without inventing underlying
earnings, book value or filing links. These are inputs from loaded provider
responses, not independent filing verification or point-in-time history. Existing
fiscal-year-label, most-recent-provider and differing statement-date limits apply.

The disclosure uses normal keyboard controls and stays within the comparison's
horizontal scroll area on narrow screens. Changing its displayed inputs, result,
formula or company identity closes it. Equal-content rerenders preserve an open
disclosure while it stays mounted. Removing the cell, withholding a quarantined
comparison or resetting the company destroys that open state; returning later
does not reopen it. No peer roster, draft, saved group or source data is changed
by opening or closing a disclosure.

## Compare annual quality checks

Below the metric comparison, **Annual quality checks** places the same twelve
existing financial checks beside the selected company and one to three peers.
Each result is **Met**, **Not met** or **Unavailable**. These are individual tests,
with no combined grade, ranking or preferred company.

This uses only annual statements already loaded for the current exact companies.
The existing peer comparison admits the complete source packets first. A withheld
peer group has no quality output; a missing or invalid annual source leaves its
own column unavailable. Valuation data is not required. With no peers, the panel
keeps its existing add-first-peer guidance.

Each company's latest annual fiscal year must equal the selected company's annual
anchor. An older matching period is not substituted, even when that period is
usable in the separate metric table. The unchanged quality engine receives the
whole annual history and uses the latest period and, where required, its immediately
preceding consecutive fiscal year. Missing facts and unusable denominators retain
the existing check-specific reasons. Different statement dates within the same
fiscal-year label remain visible.

Open a check to inspect its expression, formula version, current and prior
observations, units, fiscal years, statement dates and source references. Values
retain their exact decimal strings. A reference identifies an input used by the
engine; it does not supply an otherwise absent raw operand or filing link. Each
company keeps its own response timestamp. Disclosures follow full company identity
and displayed content: equal-content mounted renders preserve them, while changed
content or removal clears them.

Inspecting checks makes no request or saved-data change. Results use the provider's
most-recent annual statements and fiscal-year labels, not point-in-time or
sector-adjusted comparisons. A met check is not a recommendation or universal
assessment of a company's financial health.

## Reorder the current peers

Use **Move earlier** or **Move later** on a peer card to swap it with its neighbor.
The selected company stays first; the one to three peers follow your chosen order
in their cards, both comparison tables and the current-group preview. This changes
presentation order, not a ranking or the companies' results.

Reordering keeps the same loaded sources, errors and any in-flight peer request.
A response settles into that company's new position. Open input and quality-check
disclosures stay with their company when their displayed content is unchanged.
The move controls remain focusable at an endpoint, where the unavailable direction
does nothing. A single peer has no available move.

Moves make no provider request or saved-data write, and work without saved-group
eligibility. They preserve primary research, the price range, DCF draft, notes,
holding and Back destination. Explicit Save captures the latest order; a Save
already in progress may show its earlier captured order as saved while preserving
the newer current order. Moving and then undoing still cancels a pending Restore.
A new explicit Restore retains the replacement and unloaded-source rules below.

## Reuse a manual peer group

The Peers section can keep one saved group containing its primary company and
one to three ordered peers. **Load saved peer group** reads its metadata without
changing the current comparison. **Save this peer group** replaces that saved slot
with the current exact identities and catalog provenance. Every company must be
in the current, reconciled My Watchlist; loaded provider inputs are not required.

**Restore saved peer group** works only for the same exact primary. It checks the
saved version, current catalog and every complete watchlist identity, then replaces
all current peers together in saved order. Peer sources become unloaded and pending
peer requests are retired. Primary research, price range, DCF inputs, notes, holding,
research section and Back destination stay unchanged. Load each peer's sources
explicitly when ready. Missing or changed members prevent the entire restoration;
the app never substitutes by ticker or restores a subset.

**Clear saved peer group** clears only the saved slot. Current peers and their
loaded data stay in place. Valid saved metadata remains visible during pending
actions. A delayed Save keeps newer peer edits; a delayed Restore is canceled if
the peer roster was edited, even if that edit was then undone. Conflicts and
unverified responses require an explicit Load before retrying.

The encrypted settings record contains no prices, financials, results or notes.
An orphan group remains inspectable and clearable. Malformed or unknown versions
fail closed without migration or erasure. There are no automatic settings reads,
writes or provider requests on navigation, roster changes or metadata display.

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
Companies outside My Watchlist show an explicit Add action or guidance instead
of an editor, as described below.

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

## Save the researched company

When an unsaved company was opened from current search, catalog-screen or
financial-screen results, **Add to My Watchlist** is available beside research.
This also applies to an admitted company retained on another comparison page.
The explicit action appends the complete company identity with an empty saved
note and preserves the existing list order and other saved notes. It does not
save a note, add a portfolio holding or load provider data automatically.

After success the shared research-note editor appears. The same company,
selected section, loaded research, valuation assumptions and Back destination
remain open; an independently chosen holding is unchanged. If the Add action
still owns focus, focus moves to the note editor. Completion cannot take focus
or display another company's feedback after intervening navigation.

A company opened only from a holding or historical filing needs to be opened
from current search or screening results before it can be added here. A listing
already saved under a different complete identity requires reconciliation; it
is never silently replaced. Unavailable or outdated watchlists and the existing
10,000-company limit block Add. Saving or reconciling pauses the action.

If another tab changed the list, the latest version is loaded without retrying
the write. A company already added there shows its current saved note; otherwise
review the list and explicitly retry. If that reload fails, reload the workspace
before adding. Reopening the same company cannot bypass the failed-reload block.
Other unavailable responses retain the last loaded list and report that the save
could not be confirmed; reload the workspace to check the latest saved list.

The action uses the existing watchlist version boundary. Changes may invalidate
watchlist-scoped financial results or comparisons under their existing rules.
Search/catalog criteria and the company research view retain their normal
lifecycle; this does not add a saved research layout or a new sequence.

## Acceptance

The Valuation section also provides explicit per-company saved DCF inputs. See
[Saved DCF assumptions](./PERSONAL_SAVED_DCF_ASSUMPTIONS.md) for Save, Restore,
Clear, model-version handling and draft/request lifetime rules. These settings
actions do not load research sources or persist calculated results.

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
- Verify explicit Add from each admitted origin copies all eleven saved identity
  fields with an empty note, preserves other members and the active research key,
  and reveals the note editor only after saved membership exists. Keep section,
  loaded data, valuation assumptions, holding and original Back focus unchanged.
- Reject duplicate, retained and same-company origin callbacks; cover conflicts,
  concurrent additions, failed reloads, full/stale/unavailable lists and identity
  mismatches. Late completion can update the global list but cannot revive an
  old company, feedback or focus. Check keyboard handoff and narrow layouts with
  synthetic writes only; live owner-data QA remains read-only.

The workspace checkpoint records the actual accepted revision and validation;
this guide describes behavior and does not itself establish release acceptance.
