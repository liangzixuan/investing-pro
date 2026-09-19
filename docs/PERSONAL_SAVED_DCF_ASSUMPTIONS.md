# Saved company DCF assumptions

Keep one assumption set per researched My Watchlist company, for up to twenty
companies. Open company research and its Valuation section to use these controls.

1. Choose **Load saved assumptions** to read the encrypted local collection.
   Loading does not alter the current draft.
2. Edit the seven DCF inputs, then **Save assumptions**. The exact company must
   be in the current, reconciled My Watchlist. Valid inputs can be saved before
   financials or prices are loaded.
3. In a later view or session, load the saved collection and choose **Restore
   assumptions**. Restore replaces all seven editor inputs after checking the
   complete company identity and current catalog, watchlist and saved-record
   versions. Load financials and prices separately to calculate with current data.
4. **Clear** removes only the chosen saved set. **Reset illustrative assumptions**
   changes only the current draft. Neither action substitutes for the other.

Changing company or session resets the ordinary editor draft. Changing sections,
using Back or adding the same researched company to My Watchlist preserves it.
Watchlist/catalog context changes invalidate loaded saved metadata and pending
requests without resetting the draft. Reload saved assumptions explicitly.

## Inputs and storage

After explicit Load, the current company's supported saved set appears beside
all seven current inputs. The table shows the raw editor text, the canonical
loaded saved values and units. This input table compares assumptions. The loaded
set reflects the last successful explicit request; existing version checks still
apply when saving or restoring.

For a valid complete draft, the comparison counts differing values using the same
exact normalization as Save. Decimal spellings such as 12.3 and 12.3000 match, as do
admitted negative and positive zero. Incomplete inputs, excess precision, invalid
bounds or scenario order make the whole numeric comparison unavailable while
keeping the current and saved text visible. No value is rounded or rewritten.

Pending work keeps a valid loaded comparison visible while action buttons are
disabled. A Save acknowledgment updates only its saved side; newer draft edits
remain. Restore and Reset update the current side, while Clear removes the saved
set without changing the draft. Context invalidation, conflicts or uncertain
responses hide the comparison until an explicit successful reload. Missing,
unsupported or different-identity sets are never presented as a current match.
Rendering and updating the table introduces no settings or provider request.

## Compare scenario values

The **DCF outcome comparison** shows Conservative, Base and Expansion implied
USD prices and their percentages versus the reference raw close for both current
and loaded saved assumptions. Both columns recalculate from the same currently
loaded financials, price history and valuation history. This lets you inspect the
saved hypothesis while keeping your working draft. The saved record still contains
only assumptions; these values reflect the data loaded now rather than the data
available when those assumptions were saved.

The comparison uses the existing model, rounding, raw-close bridge and scenario
order. Whole invalid current drafts have no current numeric values, including when
sources are missing. A valid saved side remains inspectable. Missing sources,
identity or date mismatches and unavailable inputs retain their own reasons. A
scenario without positive residual equity has no implied price; other available
scenarios remain visible. No previous valid value or zero replaces a missing value.

An available side supplies the common reference raw-close date, annual fiscal year
and statement date, annual and valuation response times, formula version and five
exact source operands. When both sides are unavailable, the view supplies no joined
reference. Tax-shield assumptions can change the derived starting FCF proxy even
though both sides use the same reported operands. Existing small WACC/terminal-rate
gap and terminal-value concentration warnings remain visible for each relevant side.
The mechanical FCF proxy and provider-most-recent history limits still apply.

Pending actions preserve a valid loaded comparison. Save updates its saved side
without replacing newer edits; Restore and Reset affect the current side. Clearing
this company's saved set, conflicts, uncertain responses or invalidated
company/session/watchlist context remove its saved comparison under the existing
explicit-reload rules. Loading or
replacing a research source updates both columns from the same new inputs. The
comparison performs no source request or persistence, and equal displayed prices
do not imply that the seven underlying assumptions are equal.

## Input bounds and saved record

The seven inputs are forecast years, tax shield, WACC, terminal growth and the
conservative, base and expansion annual FCF-proxy growth rates. Forecast years
must be an ordinary whole-number input from 5 to 10. Rates use ordinary decimal
notation with at most four fractional places: tax 0–50%, WACC 1–30%, terminal
growth −2–5%, and each scenario −50–50%. Scenarios must be ordered from
conservative through expansion, and WACC must exceed terminal growth.

Saved decimals have four fractional places and positive zero. Normalization does
not round, clamp, reorder or rewrite the active raw draft. Existing calculator
formulas, source availability checks and rounding remain unchanged.

The encrypted settings record `personal-dcf-assumptions` has payload schema1.
Each entry contains the full eleven-field watchlist identity, catalog-digest
provenance, model version1.0.0 and canonical assumptions. It stores no price,
financial input, valuation result, note, document or provider payload. Existing
vault and watchlist schemas are unchanged. Clearing the final entry keeps an
empty versioned record, allowing a later Save.

The original catalog digest records where the set was saved; an unchanged exact
identity may be restored against a newer reconciled catalog. An unsupported
well-formed model version remains visible and clearable but cannot be restored
or replaced until explicitly cleared. Removed or changed company entries can
also be cleared without current watchlist admission. Unknown payload schemas or
malformed storage fail closed; the UI does not erase or migrate them.

## Requests and conflicts

Load, Save, Restore and Clear use only local settings/catalog/watchlist requests.
They never acquire SEC or Tiingo data. Opening research performs no saved-set
request. The collection allows one entry per listing and twenty entries total;
replacing an existing supported set at capacity is allowed, with no eviction.

Save captures the latest valid draft; a delayed acknowledgment updates saved
metadata without replacing edits made after submission. Restore applies only
if the draft has not been edited or reset while its identity check was pending.
Clear leaves the draft unchanged. Session/company/context changes retire old
callbacks and responses, including transitions back to a previous company.

Writes use existing strong ETags, owner/request intent, idempotency and optimistic
version checks. A conflict or uncertain response requires an explicit reload
before retrying. No automatic merge, write retry or provider fetch is performed.
Each write changes one targeted entry while preserving every other entry/order.
The saved-record and watchlist checks do not claim a cross-record transaction.

## Verification

Use synthetic fixtures for numeric-boundary/model parity, encrypted reopen,
targeted preservation, optimistic conflicts, idempotency replay, all identity
fields, unsupported/orphan entries and capacity. Exercise retained/duplicate
callbacks, pending edits and Reset, session/company/context transitions and
no implicit requests. Check keyboard operation and desktop/narrow external Brave
layouts without writing the owner's real watchlist or settings.

The outside-Git workspace checkpoint records actual release acceptance and the
exact tested source. This guide alone does not establish a completed release.
