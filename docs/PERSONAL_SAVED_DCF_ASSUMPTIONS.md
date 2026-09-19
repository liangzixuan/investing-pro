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
