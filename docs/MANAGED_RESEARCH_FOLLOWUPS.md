# Saved research follow-ups

Status: in development. Source checks cover the contract, repository, transport,
authoring model, screen and workspace lifetimes. Invented-data Chrome checks
verify the workflow, save recovery and rendered layout at desktop and narrow
mobile widths. The current form-guidance candidate has no new hosted native run;
live-storage qualification and production publication remain incomplete.

## Keep the next research check

Follow-ups keeps an authored question, due date and result for an exact listing.
It is a separate private resource from My Watchlist. Saving either resource does
not save the other. It does not infer a holding, interpret note text, schedule a
notification or monitor a company.

1. Open Follow-ups and explicitly load the saved version.
2. Choose an actual company from the current watchlist draft, including an unsaved
   addition. Enter a due date and add a check.
3. Write the research question. Save follow-ups explicitly.
4. In a later session, load follow-ups to reopen the saved check.
5. Choose Research company. The app resolves that exact listing against the
   current catalog. Price, Annual and Filings still require their own explicit
   source actions.
6. Return to Follow-ups. Write your result and explicitly mark the check complete.
   Save follow-ups to persist that change.

The form keeps required/optional states, field limits and assessment provenance
visible beside the fields. **Your assessment** is authored text, not a verified
source fact. The initially closed **How follow-ups work** disclosure below the
editor actions explains draft, save and source rules. Validation, identity and
save-recovery messages remain visible outside it. Opening the guidance does not
change either draft or request data.

Focused local checks and invented-data Chrome checks cover the guidance at 1440,
390 and 320 CSS pixels, with no page overflow and at least 44px control targets.
Keyboard disclosure/focus, exact Unicode and invalid draft retention, explicit
Save/reload, research return focus and conflict recovery pass within that scope.
These checks do not establish a physical mobile keyboard or live persistence.

Back preserves the list filter, selected row and both local drafts. It restores
the row's Research button when that row still exists. A direct company URL in a
new session has no private follow-up return context. The URL contains no check,
result, entry ID or due date.

Due groups use a captured UTC calendar day. Reassessing the due day does not load
financial data. A due date is a planning date, not a source freshness claim. An
invalid raw date remains visible for correction and cannot be saved or treated
as overdue. Completion records the author's explicit action; it is not an
immutable audit history or an automatic investment verdict.

## Keep identity changes explicit

Each saved entry retains its catalog digest and full listing identity. A removed
watchlist member does not remove its separately saved check. Old and unavailable
listings remain readable, and their authored fields can be edited and saved.

Review identities performs one bounded catalog resolve for up to 20 entries.
Apply updates only eligible names, symbol and catalog metadata in the draft.
The listing, issuer, security and share-class IDs, country, exchange MIC and
instrument type must remain the same. Missing or rebound identities retain their
old metadata. Applying a review does not save or transfer a check by ticker.
Research is unavailable until the listing has a current exact identity.

## Save and session boundaries

The resource has its own version, dirty state, conflict, captured save command and
receipt recovery. A conflict requires an explicit latest-version read before
Use saved or Keep draft. An uncertain save freezes that resource's edits while
Reconcile resubmits the exact original key, version and payload. A replay confirms
the original command; it does not prove that no later version exists.

The other resource keeps its independent draft and save state. There is no Save
all, automatic merge or implicit retry. Sign-out and browser-leave review cover
both drafts, including conflict and pending receipt decisions. Confirmed sign-out
clears both local drafts before awaiting the account SDK. Expiry and session
replacement retire both resources and all source operations. Late results cannot
revive them. A failed sign-out permits an explicit retry without restoring data.

## Contract and storage

`GET` and `POST /v1/managed/research-followups` accept no query parameters. The
command uses the existing expected-version and idempotency-key protocol. A
missing row reads as version 0 with an empty schema-1 payload and creates no row.
Receipts bind the exact canonical command payload and next version.

The payload holds at most 20 entries, with unique lower-case UUIDv4 entry IDs and
unique listing IDs across open and completed entries. Each entry has a required
check of 1–500 code points, a result of 0–2,000 code points, a strict Gregorian
date from year 0001 through 9999, status and matching completion date. Existing
text normalization applies without clipping. Canonical payload and envelope caps
remain 262,144 and 266,240 UTF-8 bytes. Parsers own and freeze admitted values and
reject extra fields, invalid Unicode, accessors and array holes.

The server rejects new or changed completion dates after its captured UTC day.
Unchanged retained dates remain readable. Exact receipt replay precedes current
clock, catalog and version checks. Clock rollback can refuse a new write while
leaving saved data and the draft intact; no timestamp is synthesized.

The trusted function uses a separate fixed database and namespaced current and
receipt row IDs. The shared bounded transaction engine retains the watchlist's
CAS and receipt protocol. Owner principals come only from verified server auth.
Rows have no client permissions. The existing watchlist payload, notes, exports
and accepted storage values remain unchanged.

Live provisioning must separately confirm actual schema limits, row security and
execution-key scope. Source tests and invented in-memory fixtures do not establish
live storage, production publication, real provider or physical-device use.
