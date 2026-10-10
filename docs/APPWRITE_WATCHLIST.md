# Appwrite watchlist storage

Appwrite stores the managed website and Android app's shared private watchlist.
The adapter uses the official `node-appwrite` 29.0.0 server SDK and the existing
identity and payload rules. Clerk provides managed authentication; the separate
[development trial](./CLERK_TRIAL.md) preserves the earlier synthetic integration.
The production managed client is connected. The disconnected debug profile and
local encrypted research vault remain separate. See [Current work](./CURRENT_WORK.md)
for the accepted release and device limits.

## Data and authority

The caller supplies a server-verified principal and a trusted admitted catalog.
Neither identity comes from the saved payload. Database and table identifiers
are fixed server configuration. The payload retains the complete listing
identity, catalog snapshot, notes and membership order. SDK row metadata stays
outside the shared contract.

The initial adapter limits an encoded watchlist to 256 KiB. This is a cloud
storage bound in addition to the shared membership and note limits. The cloud
table schema must support the declared bound before the persistence proof.

The managed route uses `GET` and `POST /v1/managed/watchlist`. A save contains
`expectedVersion`, `idempotencyKey` and the canonical full payload. The wire
envelope permits 266,240 bytes while the encoded payload remains limited to
262,144 bytes. Shared parsers copy validated values; a receipt must match the
captured payload and its next version. Stored historical identities remain
readable even when the current catalog changes.

The separate managed namespace is `investment_managed_watchlist_v1`, with
private `watchlists` and `receipts` tables. The managed API and proof functions
do not reuse the accepted demo's database. Source constants describe the selected
target; the workspace handoff records whether its schema, deployments and
isolated transaction proof have actually been accepted.

Use separate current-watchlist and command-receipt tables. Enable row security;
grant no client table or row writes. The server adapter is the only version
writer. Receipt rows remain server-only. Broad table permissions would override
the intended private-row boundary and must not be added. The trial route verifies
Clerk authentication and the configured owner allowlist before calling this adapter.

This is a managed cloud storage profile. It does not claim the local vault's
application-layer encryption. Keep the accepted vault and its recovery material
unchanged. Only invented records are allowed in the initial cloud proof; owner
migration follows a reviewed privacy, credential and recovery design.

## Conflicts and retries

Each save carries the version the user edited and a stable command key. A first
save creates the unique current row at version 1. An update checks the current
version, then stages a bounded numeric increment, the new payload without a
version assignment, and its command receipt in one short transaction. A writer
must never reset or decrement the version.

The increment's maximum is the submitted version plus one. This protects the
gap between the initial read and transaction staging; the transaction protects
the payload and receipt from partial application. A plain read followed by an
unconditional update is insufficient.

An identical command returns its original receipt. Reusing its key with different
content conflicts. A lost commit response has an uncertain outcome: preserve the
same key and resolve against its receipt before claiming success or submitting a
new edit. There are no automatic mutation retries. The trial UI retains a stale
edit's draft for review and keeps an uncertain save's original command key for
explicit reconciliation.

The full watchlist and demo adapters share one save coordinator. The full
watchlist blocks further edits after a replay until the latest saved version
is loaded and the user chooses the saved version or retained draft. Catalog
review has a separate lifetime and cannot clear a pending command. Sign-out,
session replacement and denied authentication abort active work, clear screen
data and fence late completions.

### Review an intentional sign-out

The shared managed screen reviews an intentional sign-out when there are unsaved
changes, an active save or an uncertain save result. **Keep editing** retains the
exact draft without a request. The separate confirmation clears local screen data
through the existing session operation; it does not delete the saved watchlist.

For an active or uncertain save, the review explains that the server may already
have committed it. **Stay and check save** preserves the original command for
explicit reconciliation. Signing out clears those local command details; a later
sign-in and saved-version read is needed to check the outcome. A save settling
while the review is open updates its explanation without refocusing the action.

Clean sign-out and a failed sign-out retry remain direct. Authentication rejection,
expiry and session replacement still retire the workspace immediately, hiding the
review and fencing stale confirmations and late responses. The review keeps no
durable draft, adds no provider request and changes no authentication rule.
PR 61 and signed Android 1.18 deliver this review. Twenty invented-data emulator
cases cover draft cancellation, save settlement, uncertain-save retirement and
late-response fences. Current work records source, website, signed-package and
separate browser and physical acceptance limits.

### Leaving the managed browser with unconfirmed work

PR67 on the managed website requests the browser's standard leave confirmation before
a reload, tab close or navigation outside the document when the mounted watchlist
has an unsaved draft, an active save/reconciliation or an uncertain save result.
Raw invalid notes also count as unsaved work. The listener reads the current
coordinator state and sends no save, reconciliation or provider request.

Clean sessions have no listener. Confirmed saves and an explicit choice to use the
saved version remove it; session retirement and component cleanup remove it
synchronously. A retired or disposed session cannot warn for a replacement
session. Intentional sign-out keeps its separate review, and authentication
rejection and expiry still clear local data immediately.

Only the managed browser composition opts in. Native Android and the disconnected
profile omit this warning. The browser supplies generic confirmation text, usually
requires prior user interaction and may suppress the prompt. Mobile termination
can skip the event entirely. This is no durable draft or process-death recovery.
See the [HTML navigation contract](https://html.spec.whatwg.org/multipage/browsing-the-web.html#preventing-navigation)
and [browser event guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).

Focused tests use invented records and cancelable events to cover invalid drafts,
active saves, conflicts, the original uncertain command, explicit reconciliation,
saved-version choice, retirement, late completion and disposal. Composition tests
check the browser opt-in and native exclusion. Required actual-main checks, source
proof, twenty native journeys and same-archive website promotion passed. Actual
browser confirmation remains unaccepted; signed Android 1.20 is unchanged. Exact status is in
[Current work](CURRENT_WORK.md).

### Review the saved version and retained draft

The recovery review compares the latest successfully loaded saved version with
the retained draft before either explicit choice. Changed entries show both notes
and positions, additions and removals, and changed listing identity fields. Entries
are paired by exact listing ID, including separate listings that share a ticker.
The review preserves raw draft text, including invalid notes; saving still applies
the existing note, payload-size and catalog checks.

Choosing **Use saved version** replaces the whole local draft with that saved
payload without a write. **Keep my draft** retains the whole draft and adopts the
loaded version as the base for a later explicit save with a new command key. The
review performs no automatic merge or save. Different catalog snapshots remain
visible and do not bypass the separate catalog review.

A new saved-version read withdraws the previous review and choice eligibility as
soon as it starts. If the read fails, both payloads remain retained, but another
successful read is required before choosing. Pending command reconciliation still
uses its original version, key and payload. Session retirement clears both versions
and fences late completions. PR 57 and signed Android 1.16 deliver this behavior.
The eighteen-case invented-data emulator report includes recovery review, a failed
repeat read and whole-version choice. It establishes no production two-device
editing or owner-record recovery test. Current work records the separate source,
website, signed-package and physical acceptance limits.

The managed Appwrite bridge requires the runtime's `bodyBinary` Buffer, checks
its visible byte length before copying and preserves the supplied encoded query
once. It rejects query characters that URL construction would normalize. The
handler decodes write bytes once with fatal UTF-8 validation. Nonempty GET and
OPTIONS bodies are rejected. Runtime context evidence must distinguish actual
delivered bytes from synthetic malformed-byte fixtures; the platform's supplied
query cannot recover distinctions it already discarded.

The server composition in `apps/api/src/appwrite-transport.ts` retains the SDK's
request serialization and integer decoding. It gives one server operation a
shared twelve-second lifetime, two seconds per request, and at most twenty HTTP
dispatch attempts. It stops starting ordinary mutations after nine seconds and
reserves the final dispatch slot for transaction rollback. Reads and rollback
still obey the total lifetime and budget. These are ceilings, not latency claims
or a guarantee that every failed transaction can be reconciled in that time.

The composition fixes an HTTPS `/v1` endpoint, rejects altered authority and
redirects, and supports the JSON GET/POST/PATCH calls used by this repository.
Its private Undici HTTP/1 agent disables pipelining; the dispatcher rejects 421
before fetch's internal retry. Responses must be JSON with identity encoding;
the byte counter rejects more than 1 MiB before forwarding excess bytes to the
SDK. A per-request AbortSignal cancels rejected responses and ignores subsequent
body callbacks. Upstream warning text never reaches the SDK logger. Errors retain
a finite status and an allowlisted classification, including `row_not_found` for
absence and `attribute_limit_exceeded` for bounded-increment commit reconciliation;
arbitrary upstream error text is discarded.
There is no global fetch, dispatcher or logging patch.

Create one transport per server operation or reviewed proof phase, configure its
SDK client with the server-owned project credential, share it across that phase's
repository instances, and await `close()` in `finally`. Do not create a new budget
for each row call. The transport's dispatch counter does not measure upstream
server execution. Cancelling a client request cannot undo an already dispatched
commit; `commit_unknown` and receipt reconciliation remain necessary. The trial
composition has exercised this transport against the isolated Appwrite tables.

## Cloud evidence and remaining acceptance

The original isolated storage proof used invented data for creation, stale
edits, pre-stage and overlapping updates, rollback, uncertain-result reconciliation
and reopening. Its failed overlap inspection exhausted the ordinary request
budget; a separate receipt-absence query completed that observation without
relaxing the limits. Injected acknowledgement loss occurred after a real commit;
it was not wire-level packet loss. Reopening in a later invocation did not prove
a cold process restart.

The managed API, website and signed Android package have since been delivered.
The production 1.1 upgrade/checklist was owner-reported as passed; physical 1.2
acceptance remains open. Neither report authorizes migration or test writes to
existing owner records. Extended expiry/retirement races, uncertain-save recovery
under real interruptions and long-running daily use remain bounded acceptance
questions, alongside the existing focused tests.

Official Clerk SDKs manage credentials. Short-lived session tokens enter React
request memory only when needed; the app adds no custom refresh-token cache or
Appwrite Account session. BrowserStack checks an inert website copy and cannot
prove these connected workflows. Public status is in [Current work](./CURRENT_WORK.md).
Private operational evidence and account identifiers stay outside the repository.

## References

- [TablesDB transactions](https://appwrite.io/docs/products/databases/tablesdb/transactions)
- [Atomic numeric operations](https://appwrite.io/docs/products/databases/tablesdb/atomic-numeric-operations)
- [Table and row permissions](https://appwrite.io/docs/products/databases/tablesdb/permissions)
- [Server-side authentication](https://appwrite.io/docs/products/auth/server-side-rendering)
