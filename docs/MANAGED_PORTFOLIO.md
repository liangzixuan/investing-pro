# Managed Portfolio

The published managed website supports one authored USD portfolio. Production
storage is enabled after private persistence and recovery qualification with
invented data. Android 1.30 packages the matching workflow with verified source,
assets and the existing production signer. The owner reported that the overall
1.30 phone checklist passed; it provides no per-feature results or independent
device inspection. Authenticated owner Save was not exercised during release. The local encrypted My Portfolio record is a separate
product profile and is not imported or changed by this workflow.

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

## Keep a current holding in My Watchlist

The current source increment connects one authored current holding to the
existing research list. Open **Keep a holding in My Watchlist**, choose a current
holding, then select **Review holding for My Watchlist**. Review its full listing,
share class and venue, authored shares and confirmation date. Portfolio identities
must have their existing current-catalog review and approval; unapplied forms or
unresolved saves pause this action.

**Add holding to Watchlist draft** appends a missing exact listing with an empty
note. An existing entry keeps its note and position. A changed identity, invalid
or oversized complete draft, closed holding, stale catalog, route, draft or
session refuses the addition. The action does not copy shares, cost basis or
financial values to the Watchlist, and makes no source request or online Save.

Use **Review and save in My Watchlist** to continue through the existing editor,
research and separate Save. Portfolio keeps its ledger and independent Save.
If My Watchlist has not been loaded, open it and load its latest version before
returning to review the holding. Conflicts and uncertain saves use the existing
recovery controls. Navigation and session changes invalidate retained callbacks.

The [IBKR instrument-addition guide](https://www.ibkrguides.com/ibkrdesktop/watchlist-add-instruments.htm)
and [Infront Watchlist guide](https://infront-advisory-solution.helpcenter.infront.co/en/as/latest/add-securities-to-watchlist)
provide established patterns for explicit instrument choice and appending to a
research list. Investment adds its existing complete identity/draft review and
separate Save. No upstream code or assets are copied. Source and additive native
verification are in progress; no browser or phone acceptance is claimed.

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

## Draft files

Android 1.31 provides **Portfolio draft files** for applied, unsaved ledger
edits. The website and Android 1.30 do not include this client feature. It
provides manual file capture and restoration, with no automatic storage or
restoration after process death. The overall 1.31 phone checklist passed by
owner report; conditional file and Save steps were not separately reported.

1. Apply or reset any open form, then choose **Save draft file**. Choose a private
   destination. The JSON file contains holdings, cash, complete listing identities
   and activity in plain text. Unapplied form text is not included.
2. In a later session, sign in to the same account and backend and explicitly load
   Portfolio. Finish conflict, uncertain-save and catalog reviews first.
3. Select the file. Review every opening balance, registered identity and activity
   in its original order. The complete current draft is available for comparison.
   **Keep current draft** cancels without replacing it.
4. Select **Restore file to current draft** to replace the local ledger. This makes
   no source request or online Save and preserves the current loaded save base.
   Use **Review catalog identities**, apply the accepted review, then **Review
   portfolio** and **Save Portfolio** as separate actions.

A file's catalog digest never establishes identity approval, even when it claims
the current catalog. File capture time and base version are unverified claims.
The account scope is a digest of the configured API origin and verified user ID;
it prevents accidental account/backend mix-ups and does not authenticate a file.
Normal identity, date, ledger and conflict checks remain in force before Save.

The reader accepts only the current schema-3 ledger and distinct Portfolio file
format. It rejects unknown fields, duplicate JSON keys, invalid identities or
ledger data, invalid UTF-8, mismatched byte counts and files over 266,240 bytes.
Exact decimal spellings, unknown cash or basis, splits and activity order remain
unchanged. It does not upgrade older files or import the local encrypted profile.

Draft, form, saved-version, catalog, route and session changes withdraw active
file review or delivery. Cancelled and late reads cannot restore a draft.
Browser delivery requests a download; check its destination. Android uses the
existing chosen-document writer. A download request alone does not establish a
durable file. Keep exported files private; no automatic backup, confirmed-record
recovery, cloud request or saved-resource transfer follows from this workflow.

## Server configuration and acceptance

The closed managed route is `/v1/managed/portfolio`. It uses the existing owner
session and separate current/receipt storage. Portfolio is disabled unless the
server-only `MANAGED_PORTFOLIO_STORAGE_ENABLED` value is exactly `true`.
The fixed target is database `investment_managed_portfolio_v1`, with `portfolios`
and `receipts` tables in the configured Appwrite project. Clients cannot choose
another database, table, account or endpoint. An unavailable Portfolio target
does not enable fallback writes to Watchlist or Follow-ups.

The configured production target is provisioned and enabled. Private
invented-data checks passed isolation, competing and stale saves, rollback,
uncertain commits, fresh reopen, capacity and domain guards. The API-only
enablement reused the accepted source archive and confirmed the active API was
ready and live with matching downloaded source. The website already contains the
matching workflow. Default source configuration keeps Portfolio disabled for
other deployments.

Capacity qualification covered 20 registered identities, 250 activities and a
132,270-byte payload; it did not exercise the full 256 KiB ceiling. No owner
records were used. These results do not establish an authenticated owner Save,
physical Android acceptance, market values or portfolio returns.

The internal [storage qualification guide](MANAGED_PORTFOLIO_STORAGE_PROOF.md)
defines the fixed invented-data recovery phases and their operational limits.
