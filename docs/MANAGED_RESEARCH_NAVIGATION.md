# Company research visit

A company visit connects Price, Annual and Filings for one exact listing.
Load a section, inspect another, then return to the loaded result
without sending another request. Back returns to the original Markets, Discover
or watchlist control and preserves the mounted workspace draft. A direct link
falls back to Markets.

Each section has its own coverage. The Price section checks the complete captured
listing against the three declared price identities before showing Load or
accepting a retained history. An unsupported identity shows a plain unavailable
explanation, keeps its focusable heading and makes no Price request. Annual and
the shared note remain usable. A matching ticker alone cannot enable coverage.
Changing to an unsupported identity clears prior prices and cancels pending work;
late completion cannot replace its unavailable state.

This is a bounded step toward the company workflow in the
[product roadmap](PRODUCT_ROADMAP.md). It adds no key statistics, valuation or
peers. Bookmarkable visits are delivered through PR 38 on the website and in
signed Android 1.7. [Current work](CURRENT_WORK.md) records the accepted source
and artifacts, with physical-device acceptance kept separate.

## Bookmarkable visits

The URL shape is `/?company=<listing-id>&section=price` or
`/?company=<listing-id>&section=annual`, or
`/?company=<listing-id>&section=filings`, with the listing ID canonically encoded.
This keeps the page at the document root and leaves the fragment available for
Clerk sign-in. A company link identifies a listing, not a ticker or issuer:
GOOG and GOOGL remain separate. The URL carries no note, source response, saved
version, catalog digest or session information.

Opening a bookmark resolves that listing against the current managed catalog.
Its Price, Annual and Filings sections start unloaded. The existing explicit Load and
Refresh actions retain their request and error policy. A malformed or unavailable
listing cannot select another company. The cold visit has no discovery CIK;
ordinary in-app discovery keeps its captured CIK.

The same session workspace owns navigation and the unsaved watchlist draft.
Opening an in-app company creates one history entry; changing sections replaces
that entry and preserves the visit's validated results. Back returns to its
opener. A direct link has no in-app opener and returns to Markets. Forward or
reopening a company URL creates a fresh unloaded visit. Review in My Watchlist closes research
and uses the existing full-list save workflow.

Pending catalog resolution is cancelled on leaving, catalog invalidation or
session retirement. A late response cannot restore an abandoned visit. Local
model, navigation and screen checks and the original PR 38 main emulator report
cover these lifetimes. The native journey includes a direct company link that
resolves metadata, stays unloaded and returns to Markets through Android Back.
External Android app links and process-death restoration are not implemented.
Physical installation and use of signed Android 1.7 remain unperformed.

## Choose another watchlist company

**Company in My Watchlist** lists the full current draft in its current order,
including unsaved additions and separate share classes. Choose a listing, check
its company, share class and exchange, then select **Open company**. Choosing an
option alone changes no company, source response or note. A new visit selects
the current company when it is in the draft; otherwise the control starts at
**Choose company**. Adding that company later keeps the existing choice.
An unavailable draft or catalog has an explicit explanation.

Open keeps the current Price, Annual or Filings section. A different company
closes the previous visit and starts unloaded; source reads remain explicit.
Opening the same company preserves its loaded evidence. A replaced or removed
member, old visit or retired session cannot be opened through a stale action.
Navigation remains available for a readable draft with invalid notes or readonly
note controls; it does not repair, save or discard those notes.

The existing URL entry is replaced for each company change. Back returns once
to the original workspace destination and control. A visit that began from a
direct link keeps its Markets fallback. Notes and order remain in the shared
draft through all company changes. Use **Review in My Watchlist** and the
existing whole-draft **Save watchlist** action when ready.

## Source and screen contract

| Section | Source and identity                                                                     | Content and limits                                                                                                           | Loading                  |
| ------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Price   | Existing Tiingo EOD operation for the captured full listing identity and catalog digest | One calendar month of raw USD closes with actual trading dates and request completion; exact AAPL, GOOG and GOOGL listings   | Explicit Load or Refresh |
| Annual  | Existing bounded SEC evidence for the same identity; retain the known discovery CIK     | Observed annual revenue, net income and net margin, with source and observation dates; unavailable inputs remain unavailable | Explicit Load or Refresh |
| Filings | Existing SEC Submissions metadata for the full listing and resolved issuer              | Forms, filed/report dates and original index links within 90 UTC dates; current object only, with coverage limits            | Explicit Load or Refresh |

[Recent company filings](MANAGED_SEC_FILINGS.md) defines its source, paging and
retained-result contract. It adds no note action or automatic request.

The company header keeps the symbol, issuer, share class and exchange visible.
Price, Annual and Filings are ordinary section buttons with a selected state. Only the
active section is rendered, and its heading receives focus. Existing charts,
tables and report components retain their disclosures and error states.

Opening a visit sends no source request. Switching sections cancels pending local
work before showing the other section. Already validated results stay in memory
for this visit, including their original dates and any previous-result notice
from a cancelled refresh. Returning to a section does not refresh it. A late
success, error or cooldown from a cancelled operation cannot alter either section.
A request already admitted by the managed service may still finish there.

Back, a different listing, a changed or refused catalog, session retirement, or
an invalidated watchlist identity clears the whole visit. A new visit starts
unloaded unless it explicitly reuses loaded Price history, an Annual comparison
report or the selected watchlist Filings packet. A section-specific unavailable or unsupported result follows that
section's existing error policy and leaves unrelated validated evidence intact.
Account or catalog invalidation applies to all three sections.

The captured catalog digest, full listing identity, origin and known discovery
CIK stay fixed for the visit. GOOG and GOOGL are separate selections. A watchlist
or Markets selection keeps its unknown CIK; no ticker lookup fills it in.
Editing a discovery query does not change an open visit's identity. Notes,
ordering and saved version remain owned by the mounted watchlist coordinator.

Annual and Filings share a checked SEC cooldown; EOD retains its separate
cooldown. Both survive switching and closing. The
[Markets board](MANAGED_MARKETS_HOME.md) shares the EOD cooldown but keeps its
snapshots separate. Opening research from a loaded Markets row copies its exact
validated history into Price after cancelling pending board work. This includes
Annual-first visits; Annual remains unloaded. The copied history retains its
original dates and previous-result notice, and Price identifies its Markets
origin. Refreshing Price replaces only the company response. Back restores the
unchanged board snapshot and chart choice. Rows without admitted history, direct
links, reloads, Forward and Discover entry start unloaded. A watchlist Price
opener likewise reuses that row's admitted history when available.

The selected watchlist **View filings** action independently validates and copies
its current packet into the company Filings section without a source request.
The copy retains original dates and any previous-result qualification. Company
Refresh leaves the watchlist packet unchanged; Back restores its selected control
and draft. It does not supply an Annual baseline. See the
[selected filing check](MANAGED_SEC_FILINGS.md#check-a-selected-watchlist-company).

**Open full Annual report** on a loaded watchlist comparison column opens that
exact report in the company visit without another source read. Its original
dates, availability and retained-report status follow it, with a persistent
comparison-origin label. An explicit company refresh changes only the visit.
Back returns to the mounted comparison, selected bases, note destination and
shared draft, then restores focus to the opening button. The handoff checks the
current member, response and route across cancellation and opening; a stale
callback cannot replace a newer visit. See the
[Annual comparison guide](MANAGED_SEC_ANNUAL.md#open-the-full-report-from-a-comparison).

The comparison's **Evidence** selector also offers **Liquidity**. Choose either
compared listing as the note destination, then append both companies' complete
liquidity evidence to that listing's latest draft. Separate balance dates and
original source clocks stay in the text. The existing whole-note limit, duplicate
refusal and explicit Save apply; longer evidence is refused without truncation.

Back uses the same action on screen and on Android. Switching sections preserves
the original opener. If that control disappears, Back focuses the current view's
navigation control or the visible Discover heading. There is no persistent cache,
automatic load, prefetch, save or source request on resume.

After a responsive layout change, the return control must remain visible above
the mobile navigation. A bounded follow-up checks the control that still owns
focus and scrolls it into view only when obscured. An already visible control
keeps its position. A new visit, retired session, removed or hidden target, or
focus moved elsewhere cancels that correction. The existing route and history
behavior remains unchanged; [Current work](CURRENT_WORK.md) records acceptance.

## Keyboard bypass

The managed workspace's first keyboard stop is **Skip to workspace content**.
The link becomes visible on focus and moves focus to the current content after
the shared navigation, search and session controls. The next Tab reaches that
content's controls. Markets, Discover, My Watchlist, research and pending or
invalid company links share the same content landmark, including empty states.

Activation focuses and scrolls the existing landmark without changing the URL,
Clerk fragment, history, selected view, draft or request counts. The link is
absent during sign-out and session retirement; a retained action cannot focus a
missing, detached or hidden target. It adds no automatic focus on view changes.
Company-section, Back and watchlist-recovery focus keep their existing owners.

There is one main landmark. In an active workspace it encloses the working
content, with the repeated controls and retained session warning outside it.
Entry and workspace-creation states retain their own main landmark and one page
h1. The disconnected trial keeps its existing composition.

Focused tests cover landmark composition, empty and pending views, unchanged
drafts and requests, and stale-action guards. Actual-component Brave checks with
invented data cover keyboard entry and continuation, empty and company-route
states, query/fragment preservation, conflict recovery and retirement at desktop
and narrow widths. See [Current work](CURRENT_WORK.md) for validation and delivery
status; these checks do not establish screen-reader or physical-device acceptance.

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

## Read a full note

PR 63 and signed Android 1.19 deliver this reader. [Current work](CURRENT_WORK.md#accepted-release)
records the source, website and signed-package acceptance, with separate visual,
authenticated-browser and physical-device limits.

**Read full note for the selected symbol** opens the current draft as wrapped
plain text in company research and My Watchlist. It shows the complete note,
including edits that are not yet saved. Editing can remain paused during a save
or recovery while the note is still available to read. An empty draft says that
it has no note. Closing the disclosure returns to the compact editor.

Reading does not save, add a listing or request research. The existing field
keeps its raw text and validation feedback; **Save watchlist** remains the
explicit whole-list save. Notes are displayed as text without interpreting HTML
or Markdown. A different listing starts with its disclosure closed, and session
retirement clears it with the workspace. Current work records this outcome's
verification and delivery status.

## Correct an invalid note

PR 50 and PR 51 deliver this workflow on the website and in signed Android 1.13.
The actual-main Android report accepts the invented correction, review and
explicit save/reload journey, along with the date-selector test repair.
[Current work](CURRENT_WORK.md#current-task-and-next-acceptance) records exact
release acceptance and remaining limits.

The company and watchlist editors show feedback beside a note that cannot be
saved under the existing policy. The field identifies its error for assistive
technology and associates the message with that exact editor. The raw text stays
in the draft while the user corrects it; feedback does not trim or replace text.
Price/Annual switching and Review in My Watchlist keep the same shared draft.

In My Watchlist, **Go to first invalid note** focuses the first invalid note in
the current order. Reordering or removing a member updates that target. The action
only focuses a current, visible, editable field whose listing and raw value still
match the draft. Leaving the screen or retiring the session makes an old action
inactive. It changes neither browser history nor saved data.

Notes retain the existing limit of 2,000 characters after trimming and Unicode
normalization. Embedded line breaks, control/format characters and unpaired
surrogates are rejected by the shared contract. Correcting every invalid note
removes the field errors. Save watchlist continues to require the existing
catalog, payload-size and save-state checks; a whole-payload size error does not
mark otherwise valid notes as invalid. Saving is always explicit.

This follows the [W3C form notification guidance](https://www.w3.org/WAI/tutorials/forms/notifications/)
for field-associated feedback and a direct route to correction. Implementation,
synthetic checks and delivery status are recorded in [Current work](CURRENT_WORK.md).
These semantics alone do not establish screen-reader acceptance.

The synthetic journey retains an invalid two-line note across research and My
Watchlist, checks its field/error association and raw value, focuses the current
editor, corrects it through native keyboard input, and uses the existing explicit
save/reload assertions. Other notes, ordering, exact listing identity and request
counts remain checked. Six of thirty-nine main-run frames received visual review; the
full note and saved reload are assertion evidence. The focused research editor
has a minor error-text spacing issue. Live owner-note writes, physical-phone use
and backup/restore remain unperformed for this workflow.

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

## Add liquidity to a note draft

**Add liquidity to note draft** appears after the Annual liquidity calculations.
It uses the current report and exact watchlist member, then appends one plain-text
paragraph to that member's latest note. The paragraph names `AssetsCurrent` and
`LiabilitiesCurrent`, preserves exact USD amounts and the checked app calculations,
and includes the instant balance date, filing link and original source times.
It labels historical evidence and a retained previous report explicitly.

Both nonnegative reported balances and working capital must be available from
the same filing and date. Working capital may be negative. Zero current
liabilities produce an explicit unavailable-ratio sentence; other unavailable
calculations block the action. Income and cash completeness do not control it.

The control stays keyboard-focusable when unavailable and explains the reason.
Activation rechecks the current visit, response, session, membership and editable
draft. A running Annual request, changed identity, conflict or save/recovery state
blocks appending. Invalid or oversized combined text leaves the draft unchanged.
Exact duplicate excerpts are refused; deleting that excerpt allows adding it again.
Raw prose stays intact while the complete proposal is checked against the existing
2,000 normalized Unicode-code-point limit. Save retains its existing normalization.

Use **Review in My Watchlist**, then **Save watchlist**, to save the complete draft.
The action does not add a member, refresh sources or save automatically. A report
opened from the watchlist comparison retains that report's original provenance.
Current work records browser, native and delivery acceptance separately.

## Add cash generation to a note draft

The company Annual view also offers **Add cash generation to note draft** after
the calculation explanation. It copies reported operating cash flow, reported
PP&E purchases and their same-filing, same-period difference together. All three
must be available from the observed report. Negative operating cash flow and
zero purchases remain valid. The excerpt is independent of income evidence.

Exact USD amounts, raw SEC concepts, the app-calculation label and limits, CIK,
listing symbol and exchange, annual period, filing link and original load/source
dates remain in the paragraph. Historical current-use status and a retained
previous report are explicitly qualified. Copying does not refresh those dates.

The latest note is checked when clicked. An exact duplicate, invalid characters
or a complete note over 2,000 normalized Unicode code points leaves the draft
unchanged. The control stays focusable with an associated reason; feedback
belongs to the actual displayed response. Existing membership, identity,
catalog, coordinator, visit and session guards apply. It adds no member and
makes no provider or save request. Review the text and use **Save watchlist** for
the whole draft. Saved-note fields and aggregate save limits are unchanged.

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
