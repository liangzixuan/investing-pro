# Native backup operator boundaries

These internal modules prepare the request and receipt boundaries for an isolated
native Appwrite backup drill. They do not create a runnable controller, obtain
account authority, provision resources or qualify a cloud restore.

The [Watchlist proof](MANAGED_WATCHLIST_RESTORE_PROOF.md) checks application data
and command receipts. An operator must separately bind its reviewed resource
plan, immutable artifact, allowance, retention and one-use decision before any
request. Keep owner and production resources outside the invented-data drill.

## SDK request lifetime

Use the dedicated restore operator transport for the operator's SDK calls. The
application's existing short-lived JSON transport remains unchanged. Each
operator step admits one SDK request to its declared method and exact path. The
transport owns its dispatcher and closes the attempt after an uncertain or
rejected step. Late work cannot renew a consumed step.

The transport limits the attempt to 89 dispatches and 20 minutes, each request
to 20 seconds, JSON responses to 1 MiB and the deployment archive to 2 MiB.
The request limit counts client dispatches. It does not bound Appwrite's internal
build, archive or restore work, or show that a timed-out mutation did not commit.
The controller still needs its finite phase order and durable original results.
Always close the owned transport in `finally`. Cleanup has its own finite limit;
a cleanup error leaves the attempt sealed and must not trigger another dispatch.

Use a copied in-memory archive whose bytes and hash match the accepted packaging
receipt. The installed SDK's small-file path makes one multipart request. Let the
SDK and Undici generate the multipart boundary; do not restore the bare
`multipart/form-data` header after SDK preparation. Do not use a path-backed
upload, resume header or chunk continuation.

The declared method, route and project must still belong to the reviewed plan.
A transport object is not a capability to create arbitrary resources. It must
not become a public request route or receive resource selection from a client.
The trusted callback can admit a typed database/function absence from its exact
GET route. An uncaught absence or any other request failure seals the attempt.

## Native receipt evidence

Decode archive and restoration responses as bounded, typed evidence. Match the
source resource, service and captured archive/restoration identities. A
restoration must name the accepted completed archive. Preserve waiting and
terminal failure states so the controller can stop or use its remaining finite
observation budget without replaying a create request.

SDK 29 declares `resources` as strings and `restoration.options` as text. It does
not define their internal encoding. Preserve bounded opaque evidence and its
digest. Do not parse a guessed options object or claim that its text confirms the
destination.

Bind the destination to the captured `createRestoration` request, which must
include an explicit ID different from the source. Then independently establish:

- The exact destination database was absent immediately before the request.
- The resulting database has the intended identity, schema, access settings and
  complete invented row inventory, including original command receipts.
- The application proof can replay an old receipt, save the next version at the
  destination and verify that the source remains unchanged.

These checks establish the requested destination and observed result. They do
not establish a decoded provider destination echo, concurrent-write snapshot,
whole-account recovery or an atomic backup across separate databases.

## Validation and operation

Local tests use invented responses and isolated SDK dispatchers. They qualify the
specified transport and receipt behavior. They do not establish account
allowance, pricing, retention, a completed archive or a successful cloud restore.
Keep operation approval and actual tool review separate from source acceptance.
