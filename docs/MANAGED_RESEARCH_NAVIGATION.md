# Company research visit

A company visit connects the existing Price and Annual sections for one exact
listing. Load either section, inspect the other, then return to the loaded result
without sending another request. Back returns to the original Markets, Discover
or watchlist control and preserves the mounted workspace draft.

This is a bounded step toward the company workflow in the
[product roadmap](PRODUCT_ROADMAP.md). It adds no bookmarkable route, key
statistics, valuation or peers. [Current work](CURRENT_WORK.md) distinguishes
implementation and synthetic verification from website and signed Android delivery.

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

## Acceptance

The selected checks cover loaded returns in both directions without extra reads,
exact identity and provenance, cancellation during initial load and refresh,
late completions, invalidation of both sections, shared cooldowns and unchanged
drafts. Screen checks cover the stable header, selected section, rendering and
Back/focus action. The invented Android journey checks returning to retained
close history, request counts and native Back to the original opener.

Synthetic checks use invented records. Current work records the results actually
obtained; live browser, exact-build website, emulator, signed-artifact and
physical-device acceptance remain separate.
