# My Portfolio: transactions and CSV import

## User outcome

Record buys, sells, deposits, withdrawals, cash dividends and fees in the same
encrypted My Portfolio record. Opening balances and the ordered ledger derive
current holdings, remaining basis, cash, realized estimates and cash-flow totals.
This second partial Cycle 3m-a delivery does not complete historical performance.

## Workflow

1. Load the saved snapshot. Enter its opening date and choose **Start transaction
   ledger**. Balances represent the end of that date; all transactions must be
   later. Conversion preserves shares, confirmation dates and unknown money.
2. Choose a listing in company search or My Watchlist and register its admitted
   identity. Record transactions against that registry. Transactions use gross
   USD amounts; buys and sells have a separate fee field.
3. Review the derived holdings and cash, FIFO lots, realized estimates and cash
   movements. Edit or remove an erroneous transaction explicitly. Same-day order
   is the displayed array order and can be changed when the result remains valid.
4. For imports, use the exact CSV header below. Preview the whole batch, review
   resulting balances and possible economic duplicates, then apply to the draft.
   Save My Portfolio explicitly to persist either manual or imported changes.
5. Refresh prices explicitly to value open holdings. Each ledger holding must
   match all eleven fields of a currently admitted catalog identity before a
   provider request. Unmatched historical identities remain recorded and unpriced.

Opening corrections are explicit staged edits. The snapshot cannot be written
over a saved ledger. An unsaved conversion can be discarded and reloaded.

## Input rules and bounds

- One USD portfolio, at most 20 registered identities including closed positions,
  250 transactions, and a 256 KiB canonical encrypted payload.
- Shares are positive, at most one billion, with six fractional digits. Money
  has at most two fractional digits and a maximum of one trillion USD.
- Gross transaction amounts are positive. Buy/sell fees are nonnegative and
  sell fees cannot exceed proceeds. Standalone fees use type `fee` and put their
  amount in `grossUsd`; non-trade rows require `feeUsd` equal to zero.
- Buy/sell rows require listing and shares. Dividends require listing and no
  shares. Deposit, withdrawal and fee rows have neither listing nor shares.
- Dates are real UTC calendar dates no later than today. Opening confirmation
  dates cannot exceed the opening date. Transaction dates must be later than
  opening and nondecreasing. Imports preserve file order and never silently sort.
- Every intermediate state must satisfy share, basis and known cash limits.
  Oversells and negative known cash are rejected before storage. Unknown opening
  cash stays unknown after cash movements; net cash change remains calculable.

## FIFO estimate

Each opening holding is one aggregate pool, followed by individual buy lots.
Buy basis equals gross purchase amount plus fee. Sell proceeds equal gross
proceeds less fee. The oldest remaining shares are consumed first.

For each lot, cumulative disposed basis in cents is:

`round_half_up(original_basis_cents × cumulative_disposed_share_units / original_share_units)`

The basis allocated to a disposal is the difference from its previous cumulative
allocation. Shares use integer millionths and money uses integer cents. This
conserves every known lot's basis when completely sold, including many partial
sales; no floating-point arithmetic is used.

A sale consuming any unknown opening basis has unknown realized gain. Known
sales have a separately labeled subtotal; the overall total remains unknown
when any sale is unknown. Once unknown opening shares are exhausted, later
known buy lots can have known remaining basis and realized estimates.

The IRS discusses acquisition costs and FIFO when shares are not adequately
identified in its [stock basis FAQ](https://www.irs.gov/faqs/capital-gains-losses-and-sale-of-home/stocks-options-splits-traders/stocks-options-splits-traders-1)
and [Publication 550](https://www.irs.gov/publications/p550). This application
does not reconstruct actual acquisition lots from an aggregate opening balance.
Its FIFO estimate is **not tax accounting**: specific-lot identification, wash
sales, corporate actions, reinvestment, FX and tax adjustments are unsupported.
Deposits and withdrawals are cash flows, not investment returns. Income totals
are recorded cash dividends only; no yield, TWR, XIRR or benchmark claim is made.

## CSV profile

```csv
id,date,type,listingId,symbol,shares,grossUsd,feeUsd
deposit-001,2026-01-02,deposit,,,,1000.00,0.00
```

Files must be UTF-8, no larger than 64 KiB, with at most 100 data rows per
preview. A leading UTF-8 BOM is accepted. LF and CRLF line endings and quoted
fields with doubled quotes follow the supported subset of
[RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html). The header, field count,
case and order are exact. Whitespace-padded cells, control/format characters,
formula-leading cells and malformed quoting are rejected.

Each trade/dividend must match both the listing ID and symbol of an identity
already registered in the ledger. Register listings before importing; CSV
content never triggers catalog or provider requests. IDs must be unique across
both saved and imported transactions. Different IDs with the same normalized
date, type, listing, shares, gross and fee require explicit duplicate review;
they are never silently dropped. Import is all-or-nothing into the draft.

The file picker checks declared and actual byte length and rejects invalid
UTF-8. Text entry receives the same parser validation. Raw CSV, filenames and
preview state are not saved. Changes to the ledger or catalog, session loss,
disabled state and unmount invalidate pending file reads and previews. Apply
revalidates the batch against the current ledger.

## Storage and historical identities

Schema 1 remains readable and unchanged. Explicit conversion creates schema 2
with `basisMethod: fifo_with_opening_pool`, an identity registry, opening
balances and transactions. Only that source ledger is saved; projected holdings,
lots, prices and calculations are transient. The existing portfolio/main route,
owner authorization, version preconditions, idempotency and encrypted vault
backup/restore/delete behavior apply.

New identities must match the current catalog exactly. An exact identity already
saved in this portfolio may remain after delisting or catalog changes. Explicit
reconciliation only refreshes an identity whose listing, issuer, security and
share-class IDs remain the same. Unmatched history is preserved and reviewable,
and cannot receive a quote merely through ticker reuse. Current catalog digest
is required for writes. Stale-version retries still reach the vault's existing
authenticated idempotency check; they cannot overwrite a later version.

## Acceptance and limits

Focused checks cover exact decimals, FIFO conservation, unknown basis recovery,
cash-flow arithmetic, prefix validation, schema bounds, conversion and durable
reopen, historical admission, conflicts/replays, CSV parsing and duplicates,
UI editing, staged opening corrections, cancellation and private-state clearing.
Responsive browser inspection uses synthetic fixtures. Full clean-source and
hosted verification results belong in the release handoff after they complete.

Live owner data validation still needs the configured local catalog and Tiingo
access. Corporate-action reconciliation and historical pricing must precede
reliable historical performance. Multiple portfolios, broker synchronization,
order execution and actual tax reporting remain outside this slice.
