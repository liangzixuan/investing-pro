# Appwrite watchlist storage

Appwrite is the selected hosting candidate for personal phone and desktop use.
The first deployed proof was a private, fixed-response Node 24 function. The
storage adapter is the next layer: it uses the official `node-appwrite` 29.0.0
server SDK and the existing watchlist identity and payload rules. It is not yet
connected to a route, sign-in screen or Android bundle.

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
the intended private-row boundary and must not be added. Authentication and the
owner allowlist must be verified before a future route calls this adapter.

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
new edit. There are no automatic mutation retries. An ordinary stale edit leaves
the user's draft intact for review in the later UI integration.

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
body callbacks. Upstream warning text never reaches the SDK logger, and errors
retain only a finite status and the exact `row_not_found` absence classification.
There is no global fetch, dispatcher or logging patch.

Create one transport per server operation or reviewed proof phase, configure its
SDK client with the server-owned project credential, share it across that phase's
repository instances, and await `close()` in `finally`. Do not create a new budget
for each row call. The transport's dispatch counter does not measure upstream
server execution. Cancelling a client request cannot undo an already dispatched
commit; `commit_unknown` and receipt reconciliation remain necessary. Actual
Appwrite response encoding, permissions and cloud transactions still need the
isolated proof. The composition is not yet connected to an application route.

## Acceptance stages

1. Local tests must model competing creates, pre-stage and interleaved updates,
   atomic rollback, replay, conflicting keys, malformed data and uncertain commit
   responses. Check the actual installed SDK types and affected local routes.
2. Repeat the concurrency and rollback scenarios against isolated Appwrite
   tables with invented identities. Observe committed state through a fresh
   repository instance. A fake transaction store is not cloud durability proof.
3. Add two managed application sessions for the same allowed owner and a denied
   principal. Console membership is not an application session. Verify shared
   reads, stale edits, independent sign-out and session loss retirement.
4. Connect the shared React interface through a distinct exact-origin HTTPS
   adapter. Startup also needs catalog and provider status; a watchlist-only
   substitution cannot activate the existing workspace. Use an explicitly
   synthetic catalog and unavailable providers for this composed proof.
5. Verify the installed Pixel app's sign-in, background/resume, force-stop,
   relaunch and upgrade. Browser sessions do not establish native persistence.

The working browser-session design uses a per-request server SDK client and
Secure, HttpOnly cookies. It must not expose session secrets to React or
localStorage. Android cookie lifetime remains a device acceptance question.
The disconnected APK's empty API origin and restrictive CSP remain intact until
that path is verified. The data-free BrowserStack website copy is only for
startup, layout, routing and notices; it cannot prove connected workflows.

Actual checks, artifact hashes and cloud observations belong in workspace
`CURRENT.md` and `tmp/appwrite-evaluation`. Expected outcomes are not passes.

## References

- [TablesDB transactions](https://appwrite.io/docs/products/databases/tablesdb/transactions)
- [Atomic numeric operations](https://appwrite.io/docs/products/databases/tablesdb/atomic-numeric-operations)
- [Table and row permissions](https://appwrite.io/docs/products/databases/tablesdb/permissions)
- [Server-side authentication](https://appwrite.io/docs/products/auth/server-side-rendering)
