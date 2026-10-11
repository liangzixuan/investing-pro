# Investment workspace design

## Purpose

Help the owner scan a declared set of companies, inspect dated evidence and keep
research notes without losing context. Financial facts, provenance and available
actions should be easy to distinguish. Every displayed value must keep its
meaning through loading, refresh, error and navigation.

## Profiles

The managed browser and Android workspace use green actions on light neutral
surfaces. The local Market Atlas profile retains its charcoal masthead, orange
actions and separate owner/session model. The development trial remains distinct.
Shared components may share layout and semantics; each profile owns its theme.
New managed rules belong under `.managed-frame`. Do not use a global body,
`:root`, heading or button change to restyle one profile.

## Typography and numbers

Use the existing Inter/system sans-serif stack. Keep 24 to 28px workspace headings,
20px section headings, 18px key prices and 14px supporting text. Form text remains
16px on narrow screens. Heading emphasis should identify the next task, while
dates and source text remain readable. Long names, notes and messages wrap.

Use tabular figures for prices, changes, dates and times. Right-align numeric
table headings and values and leave descriptive labels readable. Preserve exact decimals,
currency, comparison dates and calculation basis; styling must never round or
rewrite data. “Not loaded”, unavailable and previous data are different states.
Keep explicit signs and words so financial meaning does not depend on color.

## Spacing and surfaces

Use a small 4/8/12/16/24/32px spacing scale. Align toolbars, content and section
headings. The managed frame remains at its existing maximum width; the board and
selected chart keep their established desktop columns and narrow stacking.

Use white panels, dark ink `#172b32`, secondary text `#425d61`, border `#d4e2e0`,
green action `#0f625e` and selected fill `#edf5f3`. Use 12px panel corners and 8px
control corners. Thin rules and surface changes separate content; routine panels
do not need decorative shadows. Preserve distinctive error and previous-result
treatments. Selection must remain apparent independently of hover.

## Navigation and actions

Keep Markets, Discover and My Watchlist visible and in their existing order.
Preserve `aria-current`, current route behavior, Back and focus restoration.
Use a quiet navigation row with an obvious selected state. Search, catalog
refresh, board acquisition and agenda acquisition remain distinct actions.

Primary actions use managed green. Secondary actions use neutral surfaces and
clear labels. Maintain at least 44px interactive control height. Compact spacing
before shrinking targets. Search input and Search may share a narrow row when
they fit; controls can wrap without changing reading or tab order. Never remove
scope or recovery text to make a screen look cleaner.

## State and accessibility

The CSS layer owns no requests, saves, navigation state or session lifetime.
Keep all explicit load/refresh/cancel behavior and previous-result notices.
Retirement clears the workspace and late responses cannot restore it. Notes,
order and save/reconciliation state remain owned by existing models.

Retain visible focus, native labels, semantic headings, alerts/status regions,
disabled states and keyboard access. Do not rely on placeholder text as a label,
hover alone to reveal essential information, or color alone to convey meaning.
Use flexible heights and keep document-wide overflow out of the narrow layout.
Reduced-motion behavior, exact-value chart tables and native controls remain.

## Verification

Use invented data and the real managed frame/components for design fixtures.
Keep fixture banners and diagnostics outside the product frame. Compare the same
states and viewport in fresh Brave captures: unloaded and loaded Markets,
previous-result failure, Cancel, navigation and research with a dirty note.
Review desktop and 390px wrapping, focus and overflow before accepting a pass.
Screenshots establish visible scope; lifecycle assertions establish asynchronous
behavior. Hosted, signed-package and physical-device acceptance remain separate.

## References

This direction adapts a few general patterns from VoltAgent's
[IBM](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/ibm/DESIGN.md),
[Coinbase](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/coinbase/DESIGN.md)
and [Linear](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)
website analyses: consistent alignment, a clear numeric hierarchy and restrained
actions. These are reference analyses, not brand assets or instructions for this
project. The current product and the owner's selected Market Atlas direction
govern composition and behavior. No third-party prompt, brand palette, proprietary
font or component implementation is copied.
