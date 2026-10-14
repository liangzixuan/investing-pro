# Investment workspace design

## Direction and purpose

The owner selected **Option 1, Precision Desk**: a dark investment research
workspace inspired by Linear's application hierarchy. Make it easy to scan
companies, inspect dated evidence and keep research notes. Use Investment's
own identity, product language and financial models.

This guide describes the selected direction and implementation. [Current work](docs/CURRENT_WORK.md)
records source, visual and release acceptance with their limits. The design
reference alone establishes no accessibility or release acceptance.

## Profiles and ownership

The managed browser and Android workspace share the Precision Desk presentation.
The local Market Atlas profile retains its charcoal masthead, orange actions and
separate owner/session model. The disconnected development trial remains
distinct. Shared components may share semantics and calculations; each profile
owns its theme.

Keep managed tokens and shell rules in `managed-workspace.css`, scoped under
`.managed-frame`. Watchlist presentation belongs in `managed-watchlist.css` with
the same profile boundary. Do not restyle the local profile through global body,
heading or button overrides.

The existing verified-session branch supplies `TrialFrame`'s managed compact
presentation. The active shell has one accessible app-level h1 and a visible
Investment wordmark. Loading, mismatched and signed-out branches retain their
introduction. Presentation must not infer authentication or alter session keys.

Before the workspace opens, use a shared managed entry section for session checks,
sign-in and native recovery. Keep a readable content width, the same page
introduction and one h1. A checking state retains its status text; a busy action
stays disabled. Unavailable and unconfirmed sign-out states show their complete
explanation with a distinct warning treatment. Retained session warnings stay
visible above the active workspace.

The browser form remains Clerk's sign-in component with its existing settings
and styles. Keep redirects and authentication behavior with the existing adapter.
Our entry fixture does not establish the SDK widget's rendered result. Any future
SDK theme change needs its own rendered review in a controlled, signed-out Brave
context at the canonical origin; the inert staging page does not mount Clerk.

The company header includes a labelled **Company in My Watchlist** native
selector and an explicit **Open company** action. Keep the selected company's
full identity in wrapping text below the control, so narrow screens do not rely
on a clipped option label. Use the existing managed field, 44px controls and
focus tokens. At narrow widths, stack the field and action. A staged choice
does not change the open company until the action is selected.

Thesis review uses an initially closed native disclosure below the full-note
reader. Label each authored field, show the required fields and retain a readable
preview before the explicit draft append. Use the existing 44px field and focus
tokens. The field grid wraps to one column at narrow widths; the complete preview
wraps long links. Keep the owner's assessment distinct from verified source facts.
Reading stays available while note editing is paused.

## Color and surfaces

Use these semantic managed tokens:

| Role             | Token                      | Value     |
| ---------------- | -------------------------- | --------- |
| Canvas           | `--managed-canvas`         | `#101113` |
| Surface          | `--managed-surface`        | `#191b1f` |
| Raised surface   | `--managed-surface-raised` | `#22252b` |
| Primary text     | `--managed-ink`            | `#f2f3f5` |
| Supporting text  | `--managed-muted`          | `#aeb4c0` |
| Separator        | `--managed-line`           | `#2c2f36` |
| Form border      | `--managed-field-border`   | `#697384` |
| Action           | `--managed-action`         | `#8796ff` |
| Selected surface | `--managed-selected`       | `#252b42` |
| Positive change  | `--managed-positive`       | `#65d99a` |
| Negative change  | `--managed-negative`       | `#ff9096` |

Use thin separators and surface changes to organize the workspace. Routine
content sits directly on the canvas without oversized enclosing cards or
decorative shadows. Controls use 7–8px corners. Warning and previous-result
notices retain a distinct amber treatment and their full explanation. Native
session status and sign-out review must remain legible in the dark theme.

Primary actions use the periwinkle accent with dark text. Secondary actions use
quiet surfaces and clear labels. Selected navigation has a surface change and
an accent indicator; selected research sections retain a visible border and fill
through hover. Keep the 3px focus outline distinct from resting borders.

Keep one compact software-license footer aligned with the active workspace
content, outside its main landmark. Use a single separator and the existing
44px disclosure button. Place session scope beside the existing sign-out review;
retain its unsaved-change and pending-save warnings. Avoid a second bottom
warning strip or a decorative sidebar slogan.

Federal Reserve announcements follow the BEA agenda in Markets. Keep the feed
scope, source and original loaded time visible. Separate each title and publication
time with a thin rule; source links and Load, Refresh and Cancel controls retain
44px targets. The previous-response notice stays visible during an unconfirmed
refresh. Titles wrap at narrow widths, and unknown publication times stay explicit.

After an accepted Fed refresh, place a quiet count above the complete list and
**Newly observed in this refresh** below the dates of matching rows. Use the
existing text hierarchy and thin rules. Keep the two original retrieval times,
shown and available counts, and source inside **Compared loaded feeds**, a native
disclosure with a 44px summary and visible focus. The previous-feed warning still
qualifies a later unconfirmed attempt. Preserve every row and note choice;
comparison must not move focus or change the local profile. Its count describes
the complete loaded feed even when the owner searches titles.

Place **Announcement view** after source metadata and refresh comparison, before
title search. Use the existing managed native selector, 44px target and focus
outline. Offer All loaded announcements and Newly observed links; disable the
latter before a comparison tied to the current feed exists. Explain the loaded
list scope beside the control. Keep full-feed counts outside these reading filters.
Title search and this view share their result with note choices. Switching to All
keeps the current phrase and requires a fresh choice for an excluded announcement.

Place **Search announcement titles** after source metadata and refresh comparison,
before the list. Use the existing managed field, 44px search and Clear controls,
focus outline and muted match count. Wrap the controls at narrow widths. Keep
full titles and dates; show a separate no-match message. The same title view
drives note choices. An excluded choice requires a fresh selection and retains
its valid destination. Reading search remains available while editing pauses.

Keep the optional Fed note form after the list inside **Add an announcement to a
note**, an initially closed native disclosure. Its summary uses the standard
44px target, native marker and focus outline. Keep the form mounted so toggling
preserves choices and feedback; retain the existing response and session rules.
Source metadata, search, comparison and rows stay outside the disclosure.

After the loaded Fed list, provide two native choices: **Announcement** and
**Add to note**. Start both empty. Show the complete chosen title and destination
identity in wrapping text below them. Use secondary 44px controls for adding the
reference and reviewing it in My Watchlist. Keep refusal text beside the action
and announce its result without moving focus. An added reference uses the existing
note editor and whole-watchlist Save; do not add another editor or card. Response
replacement and leaving Markets clear the staged announcement choice.

Company and successful Fed **Review in My Watchlist** actions lead to the exact
current destination's existing full-note reader. Select the member, open its
native disclosure and focus the 44px summary near the top of the viewport so the
note text is visible immediately. Preserve search query and scope;
keep the outside-search explanation when needed. Show the complete raw note,
including invalid text, and allow company review while editing is paused. Do not
add a second reader or editor. Cancel pending focus when the destination, view or
session becomes stale, or when the user moves focus or selects another listing.

Place BEA **Search loaded releases** and **Release date** between the original
loaded-window description and the dated releases. Keep visible labels, a persistent
**Clear search** action, an All loaded dates option and readable Eastern dates
with full-packet counts. Show the shared intersection count against the full
loaded packet. Preserve the original source, dates and previous-result warning.
Use the existing managed field tokens, 44px height and focus outline. Stack the
controls and wrap help and status text at narrow widths. Keep search and Clear
mounted when the count changes, without moving focus or scrolling. Announce a
successful replacement's reset. The local profile keeps its full agenda.

Add a native **Release view** choice for All loaded releases or
Not in previous agenda above the existing date and series controls. Keep every
date option and the full comparison visible; one final result must drive both
rows and note choices. Explain unavailable and zero-match states. Use the existing
44px select, field, help and focus tokens, with wrapping at narrow widths. New
accepted data resets all local filters; retained attempts keep them. Default
local agendas omit the managed selector.

Place the managed BEA comparison between its loaded-window description and
filters. Show a compact full-agenda count and a native **Compared loaded agendas**
disclosure. Its two source records retain exact UTC retrieval times, half-open
windows and counts. Use the existing ink, line and focus tokens, a 44px summary
and wrapping two-column metadata that stacks on narrow screens. Mark each exact
current-only scheduled entry in plain text under its full series name. Explain
moving-window scope without suggesting publication or a confirmed reschedule.
Filters must keep the full comparison visible. Default local agendas omit it.

Keep the managed BEA note form in an initially closed native disclosure after
the filters and count, before the release rows. Use **Add a release to a note**
as its 44px summary, with the native marker and visible keyboard focus. Keep the
form mounted when closed so toggling preserves current choices and feedback.
Original source dates, timezone, warnings and release rows stay outside it.
Use the existing spacing and tokens without another enclosing card.

Place the selected watchlist's Recent filings check after dated price. Keep the
newest observed filing, date and loaded-row count compact, with source times and
coverage limits in one disclosure. Load, Refresh, Cancel and View filings retain
44px targets. Wrap long forms and accessions without widening the page. Preserve
the selected note and the return control's focus; selecting a listing sends no
request. Empty and unavailable evidence keep distinct explanations.

The Annual cash section follows income results. Show the two reported amounts and
one labelled app calculation with exact USD values and a period for each available
amount. Use a simple three-column definition list on wide screens and stacked
rows below 640px. Keep thin separators, tabular figures and wrapped long values.
Missing values and current-use restrictions stay readable beside their measure.
Place observation IDs, scan counts and source pointers in the initially closed
cash-source disclosure with a 44px summary target. Keep cash availability
independent of the income overview warning.

Place Annual liquidity after cash in a two-column Measure/Value table. Show the
two reported balances and two labelled app calculations with their exact balance
dates, USD or multiple units and current-use qualifications. Keep thin row rules,
tabular right-aligned numbers, a focusable results region and wrapping long
decimals at narrow widths. Original instant source fields and calculation inputs
belong in an initially closed disclosure with 44px summary and link targets.
Explain missing and rejected values independently of income and cash.

Place **Add liquidity to note draft** after the calculation explanation and before
source details. Reuse the secondary 44px action, associated reason and live status
from cash-to-note. Keep an unavailable action focusable so its reason can be read.
Appending leaves focus on the action; the existing shared editor and explicit
whole-watchlist Save own the note. Do not add another card or editor.

In the managed Annual overview, name revenue bases in plain language while
keeping them distinct. Present genuinely missing bases as compact labelled rows
below the financial tables. Rejected or withheld evidence keeps its explanation;
it must not look like an absent source concept. Preserve every exact concept and
its status in the existing source details. Keep the financial results region
mounted and the local evidence presentation unchanged.

Use those same labels in the Annual trend and company comparison selectors and
summaries. Keep the full selected basis in a wrapping line below each selector,
associated with that control for assistive technology. Native selectors may
clip long names on narrow screens. Preserve exact concept identifiers in source
details and raw option values; a missing selected basis remains unavailable.

## Typography and financial evidence

Place a compact **On this report** navigator after the loaded Annual summary.
Use quiet links with 44px targets for Revenue and net income, Cash generation,
Liquidity and Report source details. Wrap them into two columns on narrow
screens. Keep every section and unavailable explanation in the document.
An explicit jump moves focus to its section and scrolls immediately; show the
focus outline at the destination. Source details opens the existing disclosure.
Keep this navigator in the document flow, with no new sticky layer or automatic
scrolling when data changes. It leaves company routes, history and notes intact.

Keep the company Filings source header compact. Show the original window, CIK,
SEC source link and Retrieved or Checked time above the filters. Keep a short
incomplete-coverage statement and all truncation, unavailable and retained-result
warnings visible. Put request start/completion and full routine source detail in
an initially closed **Filings source and coverage** native disclosure. Use a
44px summary with the existing focus outline and wrapping metadata; do not add
an enclosing card. Keep native open state while the results remain mounted.

For a company Filings refresh, put the full-response newly observed count above
the local filters. Use quiet row text to mark accessions absent from the previous
loaded list. Keep the incomplete-coverage explanation visible. One initially
closed **Compared loaded lists** disclosure contains the two source records in
columns on wide screens and stacked at narrow widths. Preserve the current
source dates and any retained-result warning. The marker conveys observation,
not investment importance.

In company Filings, place Form, Filing date and Refresh view in compact columns,
stacked on narrow screens. Keep the native selects mounted with 44px targets.
Refresh view starts with all loaded filings and offers newly observed accessions
only for the current comparison. Keep its qualified empty result and the full
comparison count visible. Filtering leaves focus on the selected control. Show the
Annual filing date and same-day exclusion beside the date control; preserve a
retained-baseline warning in view. Keep the original Annual identity, source
clocks and date-window explanation in **Annual baseline and date limits**.
Result counts describe only loaded rows. A baseline reset preserves Form and
Refresh view. It explains the return to all filing dates without moving focus
from a control.

Use the bundled normal-style Inter Latin variable font for the managed profile,
with system sans-serif fallbacks for characters outside its coverage. Its local
WOFF2 file stabilizes metrics without a runtime font CDN request. Keep the local
profile's font selection separate. Base managed text is 15px with roughly 1.5
line height. Markets uses a
36px desktop heading and 28px narrow heading, 16px company symbols and 13px
supporting identity. Selected quotes use 28–40px type. Status and provenance text
can use 12–14px with sufficient contrast and wrapping.

Use tabular figures and right-aligned numeric table headings and values. Preserve
exact decimal strings, currency, date, share class, exchange and calculation
basis. Long values must wrap or use the existing contained table scroll without
creating page-wide overflow. A chart's exact-value table remains available.

Raw close changes retain their signs, comparison dates and unadjusted-price
explanation. Color supplements that text. “Not loaded”, unavailable and a retained
previous result are separate states. No value is invented to fill an empty view.

The single-listing comparison uses labelled Start and End date selectors beside
the loaded chart. Keep the two controls compact on wide screens and stacked on
narrow screens. Offer observed dates only, preserve keyboard focus when a choice
changes, and identify the selected ending close separately from the latest quote.
Both exact endpoint values remain visible with the signed change.

The three-listing comparison places shared Start, End and order controls together.
Use the full shared span initially, then label the chosen interval and its count
separately from full-history overlap. Keep all controls, the results region and
coverage summary mounted through unavailable states and response replacement.
Explain resets to the full shared span; retain the interval through a failed or
canceled refresh that keeps the same histories. Stack the controls on narrow
screens, with the existing 44px target heights and contained table scrolling.

The implemented price range remains one month. Omit the generated concept's
unsupported 3M, 1Y and all-time controls. Its sample companies, prices and chart
coordinates are visual examples only.

The watchlist comparison begins with two empty, labelled listing selectors.
Choices describe the full draft even when the listing search is active. Keep
unavailable and unloaded states explicit, then show shared Start/End selectors
and both exact endpoints in the stable results region. Span the watchlist columns
on desktop and stack controls on narrow screens. Retain full identities and
original source dates beside the results. Comparison controls use the same 44px
targets and focus treatment as other research controls.

Keep each exact request-completion timestamp on one line in the watchlist
comparison's listing cell. Let that table size its columns from their content
inside the existing horizontal scroll region. Retain the complete source
disclosure and wrapping for long exact numeric values.

Annual comparison follows the watchlist's editing and Save controls. Begin with
two empty company choices and separate explicit load actions. Keep each fiscal
period and revenue basis beside its values, with a per-company basis selector
and original source dates. Use one semantic comparison table in a contained,
keyboard-focusable scroll region. Stack controls and source disclosures on narrow
screens; preserve exact amounts and 44px targets. Previous reports and historical
use restrictions retain their visible warning treatment.

Follow the income rows with three cash-generation rows in the same comparison
table. Each cash cell shows its exact USD amount, its own period and current-use
status, or its specific unavailable reason. Label the subtraction as an app
calculation and show its limits once below the table. Keep income periods and
warnings explicitly scoped to revenue and net income. Cash availability does
not depend on the selected revenue basis. Put the complete cash inputs inside
each company's existing source disclosure, preserving the original dates.

Follow cash with four liquidity rows in that same table. Each balance and
calculation keeps its own balance date and current-use warning. Distinguish exact
USD balances from the rounded current-ratio multiple; label both calculated rows.
Keep liquidity independent of revenue-basis selection and income/cash warnings.
Place instant observations and calculation references inside each company's
existing source disclosure. Use the same shared value and source presentation as
company Annual, with comparison-sized type and contained long-value wrapping.

Place the Annual comparison note action outside the horizontal table scroll.
Use compact labelled selectors for evidence group and the destination listing,
followed by one explicit append button. The destination begins empty; keep full
company, share-class and exchange labels in its options. Stack the controls on
narrow screens, preserve 44px targets and associate unavailable reasons with the
controls. Keep focus on the chosen control after appending or refusal; the
selected note editor stays unchanged. Saving remains in the existing watchlist
workflow.

After a successful price or Annual comparison append, show a secondary **Review
note** button beside the action. Reuse the existing full-note disclosure and focus
treatment. Select the exact destination and preserve search; do not move the
editor until Review is chosen. Keep this read action available while editing is
paused if its source and destination remain current. Use the existing 44px target
and narrow-screen stacking rules.

Keep **Compare raw-price paths** closed by default. Use the selected shared
interval and a clearly labelled Start = 100 axis with a scale fitted to the
observed values. Distinguish both raw-price lines by marker and line style as well
as color, and name the symbol, share class and exchange throughout. Use the managed
surface/ink tokens for a confined tooltip. Keep the exact-data table and its
focusable horizontal region available when plotting fails; numeric tokens remain
whole while identity labels may wrap. Closing or hiding the view disposes the
chart without changing draft, source or comparison state.

Lead the chart with a short reading guide that keeps unadjusted prices,
approximate coordinates, observation spacing and hidden declines visible. Put the
full formula and limits in an initially closed native **Chart method and limits**
disclosure after the plot and before the exact table. Reuse the 44px summary and
focus treatment without adding a card. Keep the method available through missing
or unsafe data, with its open state retained for the mounted view.

Place the labelled **Add comparison to** native selector and quiet **Add
comparison to note draft** action outside the results' horizontal scroll. Start
with an empty destination and name both available listings by symbol, company,
share class and exchange. Retain 44px targets and visible focus at narrow widths.
Explain refusal beside the action and announce completion without moving focus
or selecting a different note editor. Appending changes one draft note; review
and Save remain explicit.

## Composition and navigation

On desktop, place Markets, Discover and My Watchlist in a left rail, with global
search, catalog refresh and session controls above the main content. The rail is
224px wide, reducing to 192px below 1150px. Main content uses flexible columns and
24–32px spacing; avoid a fixed maximum-width card around the whole app.

Markets pairs a compact company list with a larger selected-company detail and
chart. My Watchlist pairs ordered listing selection with one note editor and its
research, move and remove actions. Selection is presentation state; the shared
watchlist draft owns every note and membership.

Keep the labelled Search in native selector beside Search My Watchlist, with
Listing identity as the default and Research notes as the alternative. Both
controls search the current draft. Stack them naturally at narrow widths and
retain the 44px height and visible focus treatment. Filtering never replaces the
selected editor; if its note stops matching, keep the editor and explain that the
selection is outside the results. Clear removes the query and retains the scope.

For a nonempty Research notes query, put one muted note passage beneath each
result's identity. Keep the text inside the existing selection button, with
normal whitespace flow and wrapping long words. Bound the passage to 180 Unicode
code points without splitting combined characters, and show ellipses at omitted
edges. Retain the button's identity name and add the passage to its description.
Identity and blank searches keep the compact rows without a passage.

The managed Annual report leads with compact financial tables for each named
revenue basis. Show exact periods, USD amounts, margins and dated reported changes
before technical validation details. Keep unavailable and current-use restrictions
beside the figures, and the filing link and source dates easy to find. Collapse
scan counts and observation records in an accessible disclosure. Use muted text
for routine methodology and amber for actual restrictions or previous results.
Tables fit the available width within a stable, labelled keyboard region; wrap
long exact values and dates within cells, keeping labels and note text readable.
Eligible bases lead inside that one region so refreshing their order cannot move
the focused region. Keep the Annual
heading and load action compact enough for figures to appear in the first desktop
view. The local Annual layout stays separate.

Scoped invented-data Brave checks verified the Annual hierarchy at 1440 pixels
and fitted tables at 390 and 320 pixels, including long exact amounts and basis
names. [Current work](docs/CURRENT_WORK.md) records behavioral limits and pending
native and release acceptance.

Company research shows Price, Annual or Filings beside the watchlist note on wide
screens. Below 1150px the note follows that content in reading order. Opening
research hides the origin view while preserving its mounted state. Returning
restores focus after the origin is visible; route and Android Back behavior stay
with their existing owners. If the layout changes during research, keep the
focused return control fully visible above mobile navigation. Leave its scroll
position alone when it already fits, and never move focus back after the user
has chosen another control. Filings uses a compact dated list with original SEC
links, local page controls and a stable results region. Keep source coverage and
previous-result notices beside the data; use the same 44px section controls.
Each filing has a quiet 44px action that adds its dated reference to the existing
note draft. Explain draft-only scope once above the list and show refusal or
confirmation beside the row. Keep unavailable actions focusable with a visible
outline. A removed focused row may return focus to the stable results region;
never pull focus from the note editor or another control.
Keep a labelled native Form select above the local filing count and rows. Use a
44px control that wraps within narrow layouts. State filtered counts against the
loaded packet; keep original source coverage and truncation beside their data.
An empty packet keeps the selector visible with All forms, avoiding a disappearing
keyboard target. Use the native picker rather than a custom menu.

At 760px and below, use a single-column workspace and three fixed bottom
destinations in the same order. Reserve bottom space including the safe-area
inset so content and focused controls remain reachable. Keep search near the top
and session actions visible. Listing/detail content stacks naturally. Watchlist
choices may scroll within their own horizontal strip; the page must not scroll
horizontally. Preserve DOM reading order and avoid hover-only actions.

## Controls, state and accessibility

The loaded BEA agenda offers native **Release** and **Add to note** selectors.
Group every admitted event by Eastern date, keeping its full series label and
the existing date filter. Start with empty choices. Show full selected date/time,
series and destination identity in wrapping text outside the closed picker.
Use the managed 44px controls, quiet grouping and narrow stacking. If filtering
excludes a choice, explain its removal and select no fallback. Keep Add and Review
focusable with a visible refusal reason when unavailable. A successful append
changes one draft note; exact-note Review and whole-draft Save remain explicit.

Maintain at least 44px interactive control height. Keep visible labels, accessible
names, semantic headings, `aria-current`/`aria-pressed`, status regions, disabled
states and keyboard access. Use native controls and flexible heights. Focus must
remain visible around bottom navigation, scrolling choices and exact-value tables.

Load, refresh, cancel and save remain explicit actions. Search, catalog refresh,
board prices and the BEA agenda are separate operations. Retain full request
scope, dated provenance and previous-result messages. Never remove error or
recovery text merely to reduce height.

The presentation layer owns no request, save or session lifetime. Preserve draft
retention, conflict choices, uncertain-save reconciliation, cancellation and late
response fences. Retirement clears private content. Sign-out confirmation keeps
its complete explanation and actions in document flow.

Navigation uses three unmodified local Tabler outline SVGs, rendered as decorative
images beside text labels. Their MIT notice is available in Software licenses.
Do not add runtime icon requests or copy another product's wordmark.

## Verification

Use invented data with the actual managed frame, components and CSS. Keep fixture
identification outside the product frame. Compare fresh Brave captures against
the selected direction at 1440px, 390px and 320px. Inspect unloaded and loaded
Markets, company research, watchlist editing, invalid notes, recovery and sign-out
confirmation. Check selected and hover states, focus, all control targets, long
values, safe-area spacing and document overflow.

Screenshots establish the visible state only. Focus tests and lifecycle tests
establish their specific behavior. Local previews, hosted native checks, signed
packages and physical-device acceptance remain separate. Record observed results
and limitations before claiming a pass.

## References and adaptations

The primary community reference is VoltAgent's
[Linear analysis](https://github.com/VoltAgent/awesome-design-md/blob/13be5c05c63be24b57581162364167028020f043/design-md/linear.app/DESIGN.md),
from commit `13be5c05c63be24b57581162364167028020f043` of
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md).
The collection is MIT licensed, copyright 2026 VoltAgent. It analyzes a website
surface; it is not an official application specification.

Linear's official
[application redesign article](https://linear.app/now/how-we-redesigned-the-linear-ui)
informs the separation of global navigation from working content, restrained
chrome and consistent hierarchy. Investment adapts those principles to its
existing research tasks, responsive layouts and accessibility requirements.
Its palette, typography scale and components are project decisions. No Linear
brand assets, proprietary fonts or application implementation are copied.

The normal-style Latin variable subset of [Inter](https://rsms.me/inter/) is
bundled unchanged from the Google Fonts distribution under SIL OFL 1.1. Its source
URL, coverage, hash and complete license are retained in
`apps/web/src/clerk-trial/fonts/`; the copyright and license remain available in
Software licenses. Use a distinct managed font-family name so loading this asset
does not change the local or development-trial font selection.

The navigation assets come from
[Tabler Icons](https://github.com/tabler/tabler-icons/tree/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d)
at commit `a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d`; their source and complete MIT
notice are retained in `apps/web/src/clerk-trial/icons/`.
