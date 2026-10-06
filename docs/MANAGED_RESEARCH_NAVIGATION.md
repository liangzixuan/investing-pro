# Company research visit

A company visit connects the existing Price and Annual sections for one exact
listing. Load either section, inspect the other, then return to the loaded result
without sending another request. Back returns to the original Markets, Discover
or watchlist control and preserves the mounted workspace draft. A direct link
falls back to Markets.

This is a bounded step toward the company workflow in the
[product roadmap](PRODUCT_ROADMAP.md). It adds no key statistics, valuation or
peers. Bookmarkable visits are delivered through PR 38 on the website and in
signed Android 1.7. [Current work](CURRENT_WORK.md) records the accepted source
and artifacts, with physical-device acceptance kept separate.

## Bookmarkable visits

The URL shape is `/?company=<listing-id>&section=price` or
`/?company=<listing-id>&section=annual`, with the listing ID canonically encoded.
This keeps the page at the document root and leaves the fragment available for
Clerk sign-in. A company link identifies a listing, not a ticker or issuer:
GOOG and GOOGL remain separate. The URL carries no note, source response, saved
version, catalog digest or session information.

Opening a bookmark resolves that listing against the current managed catalog.
Its Price and Annual sections start unloaded. The existing explicit Load and
Refresh actions retain their request and error policy. A malformed or unavailable
listing cannot select another company. The cold visit has no discovery CIK;
ordinary in-app discovery keeps its captured CIK.

The same session workspace owns navigation and the unsaved watchlist draft.
Opening an in-app company creates one history entry; changing sections replaces
that entry and preserves the visit's validated results. Back returns to its
opener. A direct link has no in-app opener and returns to Markets. Forward or
reopening creates a fresh unloaded visit. Review in My Watchlist closes research
and uses the existing full-list save workflow.

Pending catalog resolution is cancelled on leaving, catalog invalidation or
session retirement. A late response cannot restore an abandoned visit. Local
model, navigation and screen checks and the original PR 38 main emulator report
cover these lifetimes. The native journey includes a direct company link that
resolves metadata, stays unloaded and returns to Markets through Android Back.
External Android app links and process-death restoration are not implemented.
Physical installation and use of signed Android 1.7 remain unperformed.

## Source and screen contract

| Section | Source and identity                                                                     | Content and limits                                                                                                           | Loading                  |
| ------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Price   | Existing Tiingo EOD operation for the captured full listing identity and catalog digest | One calendar month of raw USD closes with actual trading dates and request completion; exact AAPL, GOOG and GOOGL listings   | Explicit Load or Refresh |
| Annual  | Existing bounded SEC evidence for the same identity; retain the known discovery CIK     | Observed annual revenue, net income and net margin, with source and observation dates; unavailable inputs remain unavailable | Explicit Load or Refresh |

The company header keeps the symbol, issuer, share class and exchange visible.
Price and Annual are ordinary section buttons with a selected state. Only the
active section is rendered, and its heading receives focus. Existing charts,
tables and report components retain their disclosures and error states.

Opening a visit sends no source request. Switching sections cancels pending local
work before showing the other section. Already validated results stay in memory
for this visit, including their original dates and any previous-result notice
from a cancelled refresh. Returning to a section does not refresh it. A late
success, error or cooldown from a cancelled operation cannot alter either section.
A request already admitted by the managed service may still finish there.

Back, a different listing, a changed or refused catalog, session retirement, or
an invalidated watchlist identity clears the whole visit. Reopening starts
unloaded. A section-specific unavailable or unsupported result follows that
section's existing error policy and leaves unrelated validated evidence intact.
Account or catalog invalidation applies to both sections.

The captured catalog digest, full listing identity, origin and known discovery
CIK stay fixed for the visit. GOOG and GOOGL are separate selections. A watchlist
or Markets selection keeps its unknown CIK; no ticker lookup fills it in.
Editing a discovery query does not change an open visit's identity. Notes,
ordering and saved version remain owned by the mounted watchlist coordinator.

Per-feature cooldowns survive switching and closing. The
[Markets board](MANAGED_MARKETS_HOME.md) shares the EOD cooldown but keeps its
snapshots separate. Opening company research from a loaded board starts unloaded;
its prices are not copied into the Price section.

Back uses the same action on screen and on Android. Switching sections preserves
the original opener. If that control disappears, Back focuses the current view's
navigation control or the visible Discover heading. There is no persistent cache,
automatic load, prefetch, save or source request on resume.

## Capture a watchlist note

The company visit shows **My Watchlist note** for its exact listing. When that
listing is already in the current watchlist draft, the editor and the watchlist
row share the same text. Typing in either place updates the draft. Price/Annual
switching preserves it together with the visit's loaded research.

For an absent listing, **Add to watchlist draft** appends its complete captured
identity and an empty note. Other notes and their order stay unchanged. A listing
ID already present under a different identity blocks Add and directs the user to
review the list. A changed search query does not alter the captured selection.
Old controls cannot edit a different or reopened visit, even for the same listing.

**Review in My Watchlist** closes research and focuses the watchlist navigation
control. The existing **Save watchlist** action saves the whole draft, including
other changes. Its catalog review, conflicts and uncertain-save reconciliation
remain in that screen. No separate note-save operation is introduced. Notes keep
the existing 2,000-character validation and save-time normalization.

An unavailable watchlist, stale catalog, pending save or reconciliation, conflict,
retired session or full list blocks the applicable action. An exact matching note
can remain visible while editing is paused. Account/session retirement clears the
workspace under its existing rules. Adding, typing and navigation send no save or
provider request. Unsaved drafts remain in the mounted session only.

## Add annual evidence to a note draft

The website and signed Android 1.10 provide an explicit **Add to note draft**
action beside each eligible Annual pair through PR 44. [Current work](CURRENT_WORK.md#accepted-release)
records the release and limits. Choose the named revenue basis to retain its exact
USD revenue, NetIncomeLoss and net-margin percentage with the annual period,
filing link and original observation times. Revenue bases stay separate.

The excerpt uses the report currently shown in that visit. A retained report
keeps its original dates and current-use qualification; adding it to a note does
not refresh the evidence. Missing or refused pairs have no append action.
While a report request is pending, wait for it to finish or use Cancel before
appending the retained report.

The listing must already be in the watchlist draft. The action preserves existing
prose and reads the latest note when clicked. If the full proposed note exceeds
the existing 2,000-character policy or cannot be saved under that policy, the
action explains the problem and leaves the draft unchanged. It never truncates
the note. The excerpt is a plain-text paragraph, matching the existing note
contract.

Changing the visit, replacing the response or retiring the session invalidates
old controls. Catalog, identity, pending-save and conflict checks still apply.
Appending sends no provider or save request and does not add membership. Review
the draft and use **Save watchlist** to save the whole draft, including other changes.

The interaction follows the explicit source-to-note pattern in
[Zotero's note workflow](https://www.zotero.org/support/pdf_reader#adding_annotations_to_notes):
choose evidence and retain its source citation. This implementation uses the
existing plain-text watchlist and SEC response. [Current work](CURRENT_WORK.md)
records implementation and delivery acceptance separately.

## Acceptance

The selected checks cover loaded returns in both directions without extra reads,
exact identity and provenance, cancellation during initial load and refresh,
late completions, invalidation of both sections, shared cooldowns and unchanged
drafts. Screen checks cover the stable header, selected section, rendering and
Back/focus action. The invented Android journey checks returning to retained
close history, request counts and native Back to the original opener.

The note journey covers draft sharing, exact identity, stale controls, guarded
editing, Add without an implicit save, review focus and explicit save/reload
through the existing watchlist. PR 44's accepted actual-main native report also
covers adding an eligible Annual pair to the existing note and saving and
reloading it. Full note equality and ordering rely on native assertions; two
frames received scoped visual review. Mutation checks use invented records and
do not establish live owner-note writes.

The link checks cover validated sign-in return destinations, malformed and
unavailable listings, pending resolution, browser history, repeated Back and
section transitions, and preservation of the in-app opener and draft. A bounded
live browser check observed section URLs, an unloaded direct Annual visit after
reload, and the return to Markets without source-load or save actions. This was
UI evidence, not a captured network-count test or physical-device check.

Synthetic checks use invented records. Current work records the results actually
obtained; live browser, exact-build website, emulator, signed-artifact and
physical-device acceptance remain separate.
