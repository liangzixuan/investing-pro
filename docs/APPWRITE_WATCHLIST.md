# Appwrite watchlist storage

Appwrite is the selected hosting candidate for personal phone and desktop use.
The storage adapter uses the official `node-appwrite` 29.0.0 server SDK and the
existing watchlist identity and payload rules. The separate [Clerk trial](./CLERK_TRIAL.md)
connects it to an authenticated route, a synthetic watchlist screen and an Android
bundle. Its isolated cloud storage proof is accepted; signed-in browser and
physical Pixel acceptance remain pending. The ordinary client stays disconnected.

## Data and authority

The caller supplies a server-verified principal and a trusted admitted catalog.
Neither identity comes from the saved payload. Database and table identifiers
are fixed server configuration. The payload retains the complete listing
identity, catalog snapshot, notes and membership order. SDK row metadata stays
outside the shared contract.

The initial adapter limits an encoded watchlist to 256 KiB. This is a cloud
storage bound in addition to the shared membership and note limits. The cloud
table schema must support the declared bound before the persistence proof.

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

The [independent cloud review](../../tmp/clerk-trial/storage-cloud-actual-independent-review.json)
accepts creation, stale edits, pre-stage and overlapping updates, rollback,
uncertain-result reconciliation and reopening with invented data. Six executions
passed directly. The original overlap execution remains failed because its final
inspection reached the ordinary request budget; a separate exact receipt-absence
query completed that observation. Request limits and rollback reservation were
preserved.

The uncertain-result case injected failure after a real committed acknowledgement;
it did not simulate packet loss on the wire. Reopen read the saved payload in a
later function invocation and does not establish a cold process restart. These
results do not establish owner migration or application session behavior.

The API and website are active. The
[public smoke receipt](../../tmp/clerk-trial/public-trial-smoke-attempt1/passed.json)
records four matching deployed assets and four unauthenticated API boundary checks.
The remaining acceptance is:

1. Verify signed-in browser and native sessions for the same allowed account,
   denied or expired sessions, shared reads/writes, stale drafts, independent
   sign-out and retirement of old responses. Console membership is not an
   application session.
2. Verify the installed Pixel app's sign-in, background/resume, force-stop,
   relaunch and upgrade. Browser sessions do not establish native persistence.
3. Before connecting the ordinary workspace, integrate its catalog and provider
   status through the reviewed HTTPS profile. The trial's two invented entries
   do not activate that workspace or authorize owner-data migration.

The owner approved a separate [Clerk trial](./CLERK_TRIAL.md) for authentication,
with Appwrite retaining server-owned storage. This replaces the proposed
Appwrite-cookie design within that trial. Official Clerk SDKs manage credentials;
short-lived session tokens reach React request memory. No custom token cache or
Appwrite Account session is added. Android encrypted persistence and independent
device sessions still require physical-device acceptance. The ordinary
disconnected APK retains its empty API origin and restrictive CSP; the trial has
an explicit separate build profile. The data-free BrowserStack website copy
cannot prove connected workflows.

Actual checks, artifact hashes and cloud observations belong in workspace
`CURRENT.md`, `tmp/appwrite-evaluation` and `tmp/clerk-trial`. Expected outcomes are
not passes.

## References

- [TablesDB transactions](https://appwrite.io/docs/products/databases/tablesdb/transactions)
- [Atomic numeric operations](https://appwrite.io/docs/products/databases/tablesdb/atomic-numeric-operations)
- [Table and row permissions](https://appwrite.io/docs/products/databases/tablesdb/permissions)
- [Server-side authentication](https://appwrite.io/docs/products/auth/server-side-rendering)
