# Research Desk design verification

The owner selected option 2, Research Desk. Source:
`../design/bootstrap-studio/research-directions-v2/02-research-desk.png`
(SHA256 `f9436e3c0acc91dd9456fced3b7956fd271cf12d006fe3f129e78f917cb62597`).
This 1514 × 1039 board contains four frames describing intended 1440 × 900
desktop and 390 × 844 phone layouts. It is not a set of same-size screenshots;
no pixel-perfect similarity score is claimed.

## Implementation and comparison

The existing React workspace and scoped stylesheet were served by a separate
loopback fixture with invented companies, annual figures and notes. Its immutable
build-attempt5 receipt binds 99 source inputs (SHA256
`d754c74be337fef62ee88d2bcf2afceac935cced88135bd0a4cb52f6a9a5997f`).
The fixture uses RAM responses, refuses browser storage, and has no real API,
provider or owner-vault access. These are synthetic product checks, not evidence
of live provider coverage.

The source board and implementation captures were opened together for comparison.
Accepted images under `../tmp/research-desk/screenshots/`:

- `final-discover-1440.jpg`: populated search with seven local matches.
- `final-watchlist-1440-aligned.jpg`: eight rows and the single note editor.
- `final-note-editor-390.jpg`: phone editor, Close, Save and draft explanation.
- `final-annual-1440.jpg`: contextual company list, chart and recent exact figures.
- `final-annual-390.jpg`: compact header, company controls, tabs and annual chart.

Captures use a light theme and DPR 1. Viewport targets were 1440 × 900 and
390 × 844. Encoded images measure 1425 × 891 and 375 × 812 respectively;
the capture surface is smaller than the reported viewport. The exact reason for
that difference was not established, so image size is not viewport proof. Earlier wrongly
scaled attempt5 captures and wrong-scroll Watchlist captures are retained as
failed evidence and excluded from acceptance. Screenshot bytes are JPEG, including
some earlier files whose historical names end in `.png`.

## Repairs and result

Initial comparison found three P2 issues: inherited navigation and status spacing
pushed the chart below the desktop fold; the phone masthead consumed too much
space; and the recent figures lacked the board's chart/table arrangement.
Scoped spacing, compact disclosures and a recent-three-year exact-value table
resolved these findings. Fresh desktop and phone comparisons found no remaining
P0, P1 or P2 issue. The final independent annual visual review is recorded in
`../tmp/research-desk/final-annual-visual-review.json`.

Composition, hierarchy, system sans typography, cool light surfaces, teal actions,
modest borders and compact row spacing follow the selected direction. Research
uses a contextual list on desktop and a Show companies control on phones. Task
and research navigation remain reachable without overlapping the content. No
illustration, raster decoration, avatar or replacement icon set was required.

## Behavior checked in Brave

- Closing and reopening a note retains its draft and restores the Edit note focus.
  Switching workspace sections also retains it. A failed explicit Save retains
  the draft; retry commits once to the disposable fixture.
- Company selection resets the previous research identity and loaded view.
  Research/Back restores the initiating Watchlist control, including page 2.
  A 120-member fixture preserved global row 51 and filtered row 119 numbering.
- Discover, Screens, Watchlist, Portfolio and Updates are reachable. Catalog,
  financial and price screen views retain their existing explicit loading controls.
- Phone Show/Hide companies and keyboard End navigation to SEC evidence work.
  Annual failure, retry and the source disclosure remain usable. Exact values and
  dates match the synthetic response; missing years remain missing.
- Empty Watchlist and compact Checking, Paused, Ready and Unavailable states were
  inspected. The lifecycle controls dispatch synthetic events; this does not prove
  an actual hidden-tab transition.
- No page-level horizontal overflow was found at widths 1440, 1024, 636 or 390.
  Long company names wrap. Phone tabs retain 44-pixel height. The note editor and
  its actions fit the phone viewport when brought into view.
- Captured console errors and warnings were empty. Final fixture counters showed
  two note-write attempts, one synthetic commit, zero blocked requests and zero
  storage attempts. All temporary viewport overrides were reset.

Actual 200% browser zoom remains unverified: the supported zoom shortcuts had no
effect (DPR stayed 1 and width stayed 1272). The 636-pixel reflow check is recorded
separately and is not presented as a zoom test. Native browser controls were not
available. Release gates and configured-runtime acceptance are separate checks.

## Intentional product differences

The app retains its Research Cockpit name, RC mark, existing controls and exact
financial strings. The full ten-year chart preserves missing slots instead of
imitating three contiguous illustrative bars. Recent values include actual source
dates and do not use rounded substitutes. Pagination remains 50 rows. Close
preserves a note draft; it is not a destructive Cancel. Additional source details,
full statements and existing research tools remain accessible in disclosures.
No financial formula, authentication rule, API or automatic acquisition was added.

The Bootstrap Studio design resources remain a reference. This implementation
does not claim a new native Studio edit or updated `.bsdesign` export.

final result: passed
