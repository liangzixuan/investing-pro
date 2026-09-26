# Market Atlas design verification

The approved hybrid is implemented with no remaining actionable P0, P1 or P2
findings in the reviewed states. This passes visual and synthetic interaction
verification; native, hosted and live-release acceptance remain separate gates.

## Comparison evidence

- Source visual truth: `../design/platform-directions-20260925/01-market-atlas.png`
  and `../design/platform-directions-20260925/06-selected-combined-research.png`.
  Both are 1487 × 1058 pixels, an unframed desktop design concept.
- Implementation: `http://127.0.0.1:4201/markets` and
  `http://127.0.0.1:4201/company/lst-synthetic-001`, using actual app components
  and styles in a reviewed, source-bound RAM fixture. Final build receipt:
  `../tmp/market-atlas-layout/app-qa/build-attempt5/build-receipt.json`.
- Implementation screenshot path: no filesystem path is exposed by the supported
  browser screenshot API. Captures are retained inline in this task, including
  “Compare final single-layout build with the selected design” and the final
  Markets comparison. Each comparison input contains both the source image and
  the rendered screenshot; the conclusion is based on those images.
- Desktop CSS viewport and screenshot: 1487 × 1058, device pixel ratio 1.
  The scrollbar leaves 1472 pixels of content width. The fixture adds a 32-pixel
  identification banner; the live app does not. No density rescaling was used.
- Additional rendered captures: 390 × 844 and 1000 × 900 CSS pixels, ratio 1.
  Document widths were 375 and 985 pixels, respectively. The normal browser
  viewport was restored after testing.
- State: light theme, local access Ready, invented company data loaded explicitly,
  Price selected, Watchlist visible on desktop, research note open with an unsaved
  synthetic draft. These invented identities and four price observations differ
  from the concept; no real account or provider data is used by the fixture.

The full-size comparison makes navigation, typography, controls, notes and chart
labels readable. Additional narrow captures and DOM measurements cover the dense
areas; a separate cropped comparison was unnecessary.

## Findings and fixes

1. **P1, company reading order, fixed.** The first capture placed research tabs
   at 1312 pixels and the chart at 1976 pixels. The reference puts primary analysis
   in the first screen. The overview now follows the stable keyed research panels
   in DOM order. Compact Price retains the price, source date, errors and controls
   while placing metadata, analytics and help in native disclosures. Final tabs
   begin at 241 pixels and the chart appears in the first desktop screen.
2. **P2, Markets density, fixed.** Initial desktop rows were about 142 pixels tall.
   The revised identity/action layout produces 77.5–78-pixel rows, preserving
   exact dates, source labels, adjusted-change basis and company actions.
3. **P2, typography and action colors, fixed.** Annual values inherited a serif
   face and the company toggle retained the former green control style. Shared
   sans-serif typography and the orange action palette now match the chosen
   direction. Financial gains and losses retain their semantic colors.
4. **P2, source-link focus, fixed.** Iteration two put the focused Price section
   beneath the sticky header. The three existing source-focus targets now use
   the responsive workspace scroll margin. Final Price and Financials targets
   land at 132 pixels, below the 113-pixel desktop header.

Iteration one remained blocked and is preserved in
`../tmp/market-atlas-layout/design-qa-iteration1.md`. Build three verified the
density and composition fixes, then exposed the focus issue. Build four changes
only that scroll-margin rule and verified the focus correction. Build five then removes an unused alternate Price presentation, keeping the selected layout unconditional. The final desktop comparison, narrow capture and source-focus check confirm the same rendered result; all CSS and request owners remain unchanged.

## Required fidelity surfaces

- **Fonts and typography:** the existing sans-serif stack, darker issuer heading,
  bold price and smaller source labels establish the intended hierarchy. The
  generated source has no dependable font specification. The app retains its
  installed stack rather than claiming an exact typeface match. Long synthetic
  company names wrap without covering controls at 390 and 1000 pixels. Browser
  text remains sharp at ratio 1; tab and button labels are readable.
- **Spacing and layout rhythm:** a charcoal masthead, white navigation, flat
  content surfaces, compact Markets table/chart and retained research context
  follow the reference. Desktop uses a 210-pixel Watchlist and optional 280-pixel
  note rail. Notes move inline at narrower sizes; empty context hides the rail.
  The chart has room for existing volume and action annotations. Thin dividers
  replace the former heavier card treatment.
- **Colors and tokens:** white surfaces, dark ink and restrained borders match
  the light concept. Orange controls and selected states use a darker accessible
  shade than the generated image. Focus stays blue; gains/losses stay green/red.
  Readiness and provider status retain their existing semantic styling.
- **Image quality and assets:** this layout needs no photographic or decorative
  assets. The existing ECharts chart remains an actual interactive data plot,
  with volume and corporate-action marks. Its green line intentionally differs
  from the concept's illustrative blue area chart. No raster target asset was
  replaced by hand-drawn shapes or fake illustrations. The wordmark remains text.
- **Copy and content:** existing section names, dated source descriptions,
  coverage limits and explicit-load actions remain accurate. Unsupported concept
  controls and invented market categories were not added. The actual Watchlist
  replaces the conceptual market-board rail. “Research” indicates the current
  location; it is not an empty navigation action.

## Interaction and responsive evidence

Keyboard tab changes and Back/reopen navigation retained the unsaved note and
loaded company data. The selected market chart changes without another fetch.
Source links select the intended section and focus the exposed target. At 390
pixels, notes, company toggles, exact price tables, analytics and statistic formula
disclosures are usable without page overflow. Global navigation scrolls within
its own row. The 1000-pixel capture confirms the intermediate layout.

Partial Markets data shows “No EOD coverage” and an unavailable chart instead of
invented values. Empty Watchlist context hides its unused rail/toggle. Denied
annual data leaves the loaded price chart usable and the feed message visible.
These states are absent from the generated source and were checked as product
requirements. Final fixture counters record zero quote requests, owner writes,
blocked requests and storage attempts. RAM client-call counters do not measure
real provider traffic. Console error inspection returned no entries.

One browser action timed out during transition to an unloaded company. The DOM
was inspected, the still-enabled load action was retried after the transition,
and the completed result was then verified. This is retained as tool evidence,
not counted as a successful first attempt.

## Accepted differences and remaining limits

The current product has three U.S. stocks on Markets, not a global market catalog.
The Watchlist rail has no market-price snapshot owner. Annual summaries and key
statistics follow the active analysis rather than duplicating the mock's compact
three-year table. Existing explicit acquisition, mounted panels and request guards
take precedence over unsupported conceptual interactions. Note editing is on
request, and narrow layouts place the editor above analysis while it is open.

This review does not establish live provider coverage, SSR correctness, persistence
or release acceptance. It does not claim comprehensive accessibility certification
or a pixel-identical reproduction of the generated mock. Minor future refinements
may reduce repeated source/help text, but should be scoped separately from layout.

## Implementation checklist

- [x] Compare source and rendered implementation in the same image input.
- [x] Fix and recapture every actionable P1/P2 finding.
- [x] Check all five fidelity surfaces and classify intentional differences.
- [x] Verify desktop, narrow, intermediate, keyboard, draft and partial-data states.
- [x] Restore the normal browser viewport and preserve owner data/tabs.
- [ ] Complete native/hosted gates, guarded activation and limited live verification.

final result: passed

## Company-entry alignment follow-up (a82)

The accepted layout's live review found a small issuer-name overlap on company
entry. The follow-up retains ticker focus and scrolls the containing company
region using its existing responsive margin. Back and source targets are unchanged.

Source-bound synthetic Brave checks passed at 2560, 1000 and 390 pixels. Short
and long wrapped names remain fully visible; the desktop name starts at 144px
below a header ending at 113px. At 1000px the name starts at 198.19px, below the
162.19px header. At 390px the nonsticky header is out of view and the complete
wrapped name appears from 36px to 237.58px. None of these pages overflows
horizontally, and the ticker remains focused.

Watchlist entry, Next/Previous company, Back/origin focus and Price/Financials
source links passed. One invented overview load was retained through Back/reopen,
along with an unsaved synthetic note. The 25 RAM calls stayed unchanged through
reopening and source navigation; final counters show one synthetic EOD load, one
annual load, zero quote calls, writes, blocked requests or storage attempts.
No browser errors were recorded. These counters do not establish live feed behavior.

Two premature browser actions timed out: Previous while its disclosure was closed,
and Research during Back's transition. Fresh DOM inspection established each state;
opening the disclosure and retrying after the transition completed the checks.
Inline screenshots were inspected, but the tool supplied no saved screenshot path.
The normal viewport was restored and existing user tabs were preserved.

Evidence and exact source binding are in
`tmp/company-entry-alignment/synthetic-brave-qa.json` outside Git. Native/hosted
gates, guarded activation and limited live checks remain pending at this source
checkpoint; CURRENT.md and the final acceptance receipt own their eventual status.
