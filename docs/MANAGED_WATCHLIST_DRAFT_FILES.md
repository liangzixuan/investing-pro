# Watchlist draft files

This source workflow lets a signed-in managed user keep unconfirmed Watchlist
edits in a JSON file, then review and restore that file into a later local draft.
Publication and physical Android file-picker acceptance are separate.

## Save and restore

1. Load My Watchlist, make edits, then open **Draft files** and select
   **Save draft file**. Choose a private destination. The file contains notes in
   plain text, including notes that still need correction before online Save.
2. After reopening, sign in to the same account and backend and load the saved
   Watchlist. Finish any conflict, uncertain save or catalog review first.
3. Select the file. Review every listing, note and its order. The current draft
   remains intact until **Restore file to current draft** is selected.
4. Restore the local draft, then use **Review catalog changes**. This checks
   imported listing identities against the admitted current catalog. Review
   and Save watchlist remain explicit, separate actions.

**Keep current draft** cancels file review. Reading, cancelling and restoring a
file do not save online or change the loaded saved version. Another device can
still save a newer version; the existing conflict checks apply at Save.

## Boundaries

The account scope is a SHA-256 digest of the configured API origin and verified
user ID. It prevents accidental account/backend mix-ups. It does not authenticate
a file or establish that its capture time, base version or catalog claim is true.
Every restored file requires independent catalog review, even when it claims the
current catalog digest. Review can replace changed identities or remove listings
that are no longer available; notes and order remain visible for review.

The reader checks the declared and actual byte counts before parsing, rejects
invalid UTF-8, duplicate keys, unknown fields, malformed identities and duplicate
listing IDs, and caps a file at 266,240 bytes. Raw editable notes are preserved;
normal Watchlist validation still controls online Save. A file's older base
version never replaces the current loaded save base.

Draft, catalog, route, saved-version or session changes withdraw an active file
review. Cancelled and late file reads or deliveries cannot restore a draft into
a changed or retired session. Browser delivery requests a download; Android uses
the existing chosen-document writer and its bounded transaction. A request to
download is not proof that a file reached durable storage.

This workflow covers Watchlist draft files only. It provides no automatic local
storage, automatic process-death restoration, cloud backup, confirmed-record
recovery, or transfer of Follow-ups, Portfolio or valuation models. Keep draft
files private and remove unwanted copies through the device's normal file tools.
