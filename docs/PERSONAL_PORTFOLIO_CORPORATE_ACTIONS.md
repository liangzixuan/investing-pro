# My Portfolio: split reconciliation and history review

This third partial Cycle 3m-a slice records owner-verified stock splits and
reverse splits, and reviews the existing Tiingo EOD history on demand. It is a
prerequisite for historical portfolio performance; it does not calculate it.

## Owner workflow

1. Load a transaction ledger and choose **Enable split records**. Review and
   save to retain the explicit schema 3 upgrade. Existing schema 1 snapshots
   and schema 2 financial ledgers remain readable.
2. Enter a split date, registered listing and whole-number **new:old** share
   ratio from broker or issuer records. Choose its insertion position, including
   its order relative to any same-day trades. Opening balances are end-of-day,
   so activities must occur after their date.
3. Preview the complete ledger projection, including adjusted shares, remaining
   basis and later sales. Apply to the draft, then save explicitly. Existing
   split records can be edited, removed or reordered when the resulting ledger
   remains valid. Equivalent same-listing/date ratios are blocked in the editor
   to prevent accidental double entry; the source ledger still permits distinct
   same-day actions with unique IDs.
4. Choose a history window and select **Review history**. The review reads each
   registered identity sequentially, including closed positions. It verifies
   the current catalog digest and all eleven identity fields before requesting
   history. Unmatched historical identities remain saved and unchecked.
5. Review observed dates and corporate actions against your records. There is
   no provider-to-ledger copy, prefill or automatic application. Staged edits
   must be applied or reset before saving the portfolio.

## Exact split accounting

Schema 3 adds `{id,date,type:"split",listingId,ratioNumerator,ratioDenominator}`
to the existing ordered activity array. Each ratio operand is an integer string
from 1 through 1,000,000; equal operands are rejected. Schema 2 rejects split
rows. All activities share the existing 250-row limit, 20-identity registry and
256 KiB encrypted-payload ceiling. The financial CSV format remains unchanged;
imports into schema 3 preserve split rows and cannot import a split themselves.

A split adjusts each active lot's remaining shares. Cash, total remaining basis,
prior realized amounts and FIFO lot order remain unchanged. New buys after the
split start new lots. Every lot must produce exact shares at six-decimal
precision, and intermediate positions must remain within the existing bounds.
Otherwise the entire projection is rejected. This slice does not round away
fractions or invent cash-in-lieu payments.

The basis engine keeps original acquisition cost and a rational, split-adjusted
original share quantity. For adjusted original units `N / D` and remaining
microshares `R`, cumulative disposed basis is:

`round_half_up(original_cost_cents * (N - R * D) / N)`

A sale receives the change from the prior cumulative allocation. A split
multiplies both original and remaining quantities by the same exact ratio,
preserving previously rounded cents across partial sales and successive splits.
Unknown opening basis remains unknown. Acquisition share labels describe the
original purchase; remaining shares use the current split-adjusted units.

## What the history review establishes

The existing normalized EOD response supplies at most 4,096 observations per
listing, over a supported window from one month through ten years. This feature
adds no provider endpoint, entitlement claim, background fetch or scheduled job.
It shows actual first/last observed dates and counts, whether the exact opening
date is present, and how many distinct activity dates have exact observations.
Requested start/end bounds do not establish daily coverage. Missing dates are
never filled; weekends, exchange holidays and genuine gaps are not distinguished.

The review compares recorded same-date split ratios with the provider factor.
Multiple recorded ratios on one date are multiplied exactly. Provider factors
may be rounded, so a difference calls for review rather than proving which record
is wrong. An unrecorded provider split is flagged when the ledger shows shares
held at the end of the prior day; a purchase on the ex-date does not by itself
require another split. Actions through the opening date are already part of the
opening balance and are not reapplied. Manual splits outside the requested
window, or without an exact observed date, remain explicitly unchecked.

Known split discrepancies exclude that listing's quotes from complete current
valuation totals. A later review clears a prior dated warning only if that date
is observed again without the discrepancy; a shorter window or a failed request
cannot clear an older warning. Saving or editing the ledger preserves known
dated warnings until a new review resolves them; session loss clears all private
state. This is bounded session evidence, not proof that all
corporate actions have been reconciled.

Dividend observations describe provider ex-date amounts per share. They do not
establish eligibility, payment date or actual cash received and never create a
cash transaction. Adjusted history is not a point-in-time record of portfolio
holdings or returns. Detailed provider observations and assessments remain in
active session memory and are invalidated on context changes. Dated warnings
remain in session memory until reviewed or the session ends. None are saved,
exported or logged. Cancellation, owner-session loss and late responses are
guarded; configuration, entitlement, catalog and rate-limit failures stop the
remaining batch.

## Source semantics and remaining scope

Tiingo documents `splitFactor = splitTo / splitFrom` and identifies the EOD
non-unit factor date as the split ex-date in its
[split documentation](https://www.tiingo.com/documentation/corporate-actions/splits).
The SEC's [stock split glossary](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-split)
explains the corresponding increase in shares without a change in shareholder
equity. Source descriptions were checked on 2026-09-09. This implementation uses
the existing EOD fields, not Tiingo's separate corporate-action endpoint.

Mergers, spinoffs, rights, return of capital, cash-in-lieu, tax adjustments,
wash sales and actual broker lot reconciliation remain unsupported. Aggregate
opening pools and FIFO results remain estimates, not tax accounting. Historical
portfolio valuation, TWR, XIRR, benchmarks and a verified trading-day coverage
model are still separate work. Live owner catalog/Tiingo validation requires
the configured local runtime; synthetic engineering checks do not establish
live coverage.
