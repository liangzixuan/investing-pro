# My Portfolio: holdings and valuation

## User outcome

Keep one encrypted local holdings snapshot and inspect an on-demand USD value,
allocation, and unrealized change against entered cost basis. This is the first
partial Cycle 3m-a delivery. It uses the admitted US stock/ADR catalog, the
existing local vault, and the existing Tiingo market-data connection.

The optional [transaction ledger](./PERSONAL_PORTFOLIO_LEDGER.md) now extends
this snapshot through explicit opening conversion. This page describes the
original manual mode and the shared valuation rules.

## Workflow

1. Open Discover after validating the owner session. Load **My Portfolio**.
2. Choose a holding from search or My Watchlist, or open a company from either
   screener. Add the selected holding, then enter shares, optional total cost
   basis in USD, and the date on which the current quantity was confirmed.
3. Enter optional cash in USD. Blank cash or basis means unknown; enter `0`
   only when zero is known. Save the portfolio explicitly.
4. Refresh portfolio prices explicitly. The view shows priced, stale and
   unavailable coverage, source times, quote type, and valuation estimates.
   Cancel stops the current batch. Editing holdings invalidates prior valuation.

The initial limit is 20 unique listings. Shares must be positive, at most one
billion, with up to six fractional digits. Cash and each holding's total cost
basis must be nonnegative, at most one trillion USD, with up to two fractional
digits. Dates must be real calendar dates no later than today's UTC date.
Commas, signs and exponent notation are rejected. Manual quantities must be
updated after trades, splits and other corporate actions.

## Valuation and missing data

Each explicit refresh requests the existing market overview with its one-month
range, one holding at a time. That adapter fetches a derived Tiingo IEX reference
quote and daily history; history provides the existing end-of-day fallback.
Only the normalized quote and its identity are retained by the portfolio panel.
There is no background provider refresh, retry loop, or persisted price cache.
The configured token remains in the server's existing private startup context.

Both supported quote kinds may be used, with source kind and time visible. A
quote older than 36 hours is excluded from valuation, including a cached quote
that crosses that threshold after loading. The same rule applies over weekends;
this slice does not infer a trading calendar. A prior-close comparison value is
never substituted for an unavailable price.

Calculations use bounded decimal arithmetic and round only for output:

- Holding value = current shares × usable price.
- Holding unrealized change = value − entered total cost basis.
- Unrealized percentage = unrealized change ÷ positive entered basis × 100.
- Priced subtotal aggregates usable holdings only. Its basis and unrealized
  change refer to the same priced holdings and remain unknown if any of their
  bases are unknown.
- Complete holdings value requires a usable quote for every holding. Complete
  portfolio value adds known cash; blank cash keeps that total unknown.
- Allocation requires complete portfolio value and a positive denominator.
  Unknown or zero basis leaves percentage change unavailable.

Aggregates sum unrounded values before rounding to cents. Consequently, rounded
row values can differ from their displayed total by a cent. Shares and money
are stored as decimal strings. The estimate is unrealized change from manually
entered basis, not transaction-ledger performance or tax accounting. Fees,
dividends, realized gains, lots, deposits, withdrawals, FX, time-weighted return,
XIRR and benchmarks are outside manual snapshot mode. The optional ledger
adds recorded cash flows and FIFO estimates; historical performance remains open.

## Storage and reconciliation

The portfolio is record kind `portfolio`, id `main`, in the existing encrypted
vault. Its closed payload contains only schema version, fixed name and currency,
catalog snapshot digest, optional cash, and holding identity/shares/basis/date.
The canonical payload is bounded to 256 KiB. No provider response or calculated
portfolio value is saved. Existing vault backup, restore and deletion semantics
apply to this record kind; no storage migration is needed.

`GET` and `POST /v1/personal-filing/workspace/portfolio/main` use existing owner
authorization, explicit mutation intent, idempotency keys and strong version
preconditions. Conflicts preserve the owner's draft for recovery. Session loss
clears the panel and pending requests.

An older catalog snapshot remains readable. Valuation is paused until explicit
reconciliation and save. A match must preserve listing, issuer, security and
share-class identifiers. Identity refresh preserves shares, basis and the
quantity-confirmation date. Unmatched positions remain visible and require an
owner decision; ticker equality alone never transfers a holding to a new asset.

## Acceptance

- Closed schema, numeric/date/size bounds, duplicate rejection and catalog
  identity admission at the storage boundary.
- Owner authorization, create/update preconditions, retries, conflicts and
  readable stale snapshots using the existing encrypted record kind.
- Independently checked fractional arithmetic, aggregate rounding, partial
  coverage, unknown/zero basis and cash, identity mismatch, stale/future quotes.
- UI editing, explicit save/load/pricing, cancellation, stale-result suppression,
  reconciliation and session clearing; responsive visual inspection.
- Focused tests, lint, types, boundary guards, complete clean-source local gate,
  and applicable hosted checks on the pushed revision.

Record actual test and hosted results in the task handoff. Synthetic engineering
fixtures establish implementation behavior; live owner holdings and Tiingo
validation require the owner's configured runtime and are not claimed here.
