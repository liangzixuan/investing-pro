# Connected company research

The selected October slice connects the existing Annual report and EOD close
history panels for one listing. A person reading prices can open that listing's
report, then return to the same watchlist draft without searching again. This is
a small step toward the coherent company workflow in the
[product roadmap](PRODUCT_ROADMAP.md).

Implementation and synthetic verification do not establish website promotion or
a signed Android update. [Current work](CURRENT_WORK.md) records delivery.

## Source and screen contract

| View              | Existing source and identity                                                                                     | Dates and limits                                                                                                                                 | Action                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Annual report     | Bounded SEC evidence for the captured catalog digest and full listing identity; preserve the known discovery CIK | Observed annual revenue, net income and net margin, with the report's source and observation dates; unavailable inputs stay unavailable          | Open from close history, then explicitly select Load annual report           |
| EOD close history | Existing Tiingo EOD operation; preserve the same listing and share class                                         | One calendar month of raw USD closes with actual trading dates and request completion; production admits the exact AAPL, GOOG and GOOGL listings | Open from Annual report, then explicitly select Load one-month close history |
| Workspace         | Existing admitted catalog and mounted watchlist coordinator                                                      | Three production listings for two issuers; notes and order remain in the current draft                                                           | Back restores the original Discover or watchlist control                     |

Each panel's action row includes the other research view, alongside its existing
load controls. The toolbar retains Back to workspace. The new panel heading
receives focus. These are ordinary buttons, so the same actions
work on desktop and narrow screens without a new tab or routing system. Existing
chart, table and report components keep their source disclosures and error states.

Switching views sends no provider request, lookup or save. It closes the old read
model, cancels its pending local work and clears its response before opening the
other view. A late success or error cannot restore the closed view. A source
request already admitted by the managed service may finish there.

The captured catalog digest, full listing identity, origin and known discovery
CIK follow the switch. A watchlist selection retains its unknown CIK; no ticker
search fills it in. Editing a discovery query does not change the identity of an
already open research panel. Catalog-change refusal, session retirement or a
changed watchlist identity prevents reopening research for an obsolete selection.
Per-feature cooldowns survive closing and switching views. The selected
[Markets home](MANAGED_MARKETS_HOME.md) uses the same EOD cooldown and keeps its
board snapshots separate. Research opened from that board still starts unloaded.

Back uses the existing shared screen action, including Android Back. Switching
does not replace the original opener with a button in the temporary panel. If
that opener disappears, Back focuses the current view's navigation control or
the visible Discover heading. Notes,
ordering and the saved version remain owned by the mounted workspace.

## Acceptance

Model tests cover both directions and both selection origins, captured identity
and CIK, clearing loaded results, cancellation and late completion, catalog and
session refusal, cooldowns, and preservation of drafts. Screen tests cover the
controls and the shared Back/focus action. A separate invented Android journey
covers switching during a pending read, displaying the existing dated close
history, returning to an unloaded report, and Android Back to the original opener.

These checks use invented records. Existing browser delivery, emulator evidence
and physical-device acceptance remain separate. The panel-switching slice adds no adjusted returns, quotes, new feed or
persistent price cache. The separately selected Markets-home contract defines
the board and its visit lifetime.
