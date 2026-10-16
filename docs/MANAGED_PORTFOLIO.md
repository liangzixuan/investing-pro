# Managed Portfolio

This candidate adds one authored USD portfolio to the managed workspace. It is
under development. Production storage, deployment, rendered layout and packaged
Android acceptance remain separate. The local encrypted My Portfolio record is
a separate product profile and is not imported or changed by this workflow.

## Record holdings and activity

1. Open **Portfolio** and choose **Load portfolio**. A successful first load can
   show that no portfolio has been saved. Enter the opening date from your own
   records and known opening cash, or leave cash blank when it is unknown.
   Choose **Start portfolio draft**. Starting does not save it.
2. Search the admitted catalog and register the complete listing identity. Check
   company, share class and venue. Registration does not buy shares or create a
   Watchlist entry. Register listings before entering their holdings or activity.
3. Apply opening holdings, buys, sells, deposits, withdrawals, cash dividends,
   fees and manual splits. The opening balances represent the end of the opening
   date. Activities must be later. Same-day order is part of the saved ledger.
4. Inspect holdings, cash and the known or unknown realized-gain amounts. Use
   **Review portfolio**, then **Save Portfolio** to save the complete draft.
   Portfolio, My Watchlist and Follow-ups each have their own Load and Save.
5. Reopen Portfolio with an explicit load in a fresh session. **Research** opens
   the exact registered listing without starting a financial source request.
   Return to the same portfolio draft when the research visit ends.

Apply or reset a pending form before Load, Review, Save, catalog search or
navigation. Typed form values stay in the form until that choice. A displayed
history filter does not reorder saved activity. Explicit row moves must leave
the entire ledger valid, including every intermediate holding and cash balance.

The shared editor also supports the reviewed financial CSV profile in
[transactions and CSV import](PERSONAL_PORTFOLIO_LEDGER.md#csv-profile). Preview
and apply are separate from Save. CSV rows can use only identities already
registered in this ledger; they do not cause source requests. Split entries use
the explicit manual split controls described in
[split reconciliation](PERSONAL_PORTFOLIO_CORPORATE_ACTIONS.md).

## Exact amounts and unknown values

The managed boundary accepts the existing schema-3 ledger. It reuses the exact
decimal validator, opening-pool FIFO calculation and manual split rules. It does
not maintain a second calculation engine or upgrade older schemas.

One portfolio can contain at most 20 registered listings and 250 activities.
Closed positions remain in that registry. The canonical payload limit is
256 KiB. Shares have at most six fractional digits; USD amounts have at most two.
Buys and sells keep gross amounts and fees separate. Known negative cash,
oversells and invalid intermediate balances are refused before Save.

Unknown opening cash remains unknown after later cash movements. A sale that
consumes unknown opening basis has unknown realized gain. The known-gain subtotal
stays separate from the total. Opening holdings are an aggregate pool, so this
FIFO estimate does not reconstruct original acquisition lots or establish tax
liability.

For example, known opening cash of USD 1,000, a buy of two shares for USD 200
plus a USD 1 fee, and a sale of one share for USD 150 less a USD 1 fee leave
USD 948 cash, one share, USD 100.50 basis and USD 48.50 known realized gain.
These are authored amounts. No provider quote is inserted into the ledger.

## Identity review and coverage

Catalog discovery is limited to admitted listings. The screen shows the current
catalog count. This does not establish broad investment-universe coverage.
Price, Annual and Filings each retain their own source eligibility; registering
an identity does not extend those feeds.

An older saved ledger remains readable after a catalog change. Review every
registered identity before a fresh Save against the new catalog. Apply can update
reviewed display metadata only when the complete stable identity still matches.
A missing listing or changed stable identity blocks that update. The app does
not delete activity, choose another class or retarget a holding by ticker.

## Save recovery and sessions

A failed load retains the draft. A version conflict requires an explicit load
and choice between the latest saved portfolio and the retained complete draft.
An uncertain Save keeps its original command. **Reconcile original portfolio
save** reuses that exact command and idempotency key before any new catalog or
date checks; it does not create a second transaction. A confirmed replay still
requires loading the latest version before the next edit decision.

Sign-out and session retirement cover Watchlist, Follow-ups and Portfolio,
including unapplied portfolio forms. Ordinary leave review does not save any
resource. Explicit sign-out can discard the drafts. This source implementation
does not establish offline editing or restoration after process death.

## Server configuration and acceptance

The closed managed route is `/v1/managed/portfolio`. It uses the existing owner
session and separate current/receipt storage. Portfolio is disabled unless the
server-only `MANAGED_PORTFOLIO_STORAGE_ENABLED` value is exactly `true`.
The fixed target is database `investment_managed_portfolio_v1`, with `portfolios`
and `receipts` tables in the configured Appwrite project. Clients cannot choose
another database, table, account or endpoint. An unavailable Portfolio target
does not enable fallback writes to Watchlist or Follow-ups.

No target was provisioned or enabled by the source work. Configuration, schema
provisioning, isolated persistence/recovery checks and matching API, web and
Android delivery must be reviewed before live use. Historical source evidence,
synthetic tests and successful compilation do not replace those checks.

The internal [storage qualification guide](MANAGED_PORTFOLIO_STORAGE_PROOF.md)
defines the fixed invented-data recovery phases and their operational limits.
