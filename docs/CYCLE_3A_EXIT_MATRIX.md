# Cycle 3a exit matrix

Scope: add one short-lived, process-memory owner session in front of the
existing personal readiness and selected-fact routes without widening their
data scope or changing the synthetic default. The decision is recorded in
[ADR 0053](./adr/0053-personal-local-owner-session.md).

Implementation status: **Prepared.**

Source status: **No promoted source revision is recorded.**

Verification status: **Source verification, terminal CI, and fresh Cycle 3a
fact-release owner authorization are pending.**

| Gate                         | Required result                                                                                                                                                            | Current status                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Synthetic default            | With no personal configuration, API and web retain their existing synthetic defaults                                                                                       | Prepared; terminal CI pending |
| Explicit API configuration   | Both personal modes require one exact `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`; synthetic mode rejects personal configuration                                             | Prepared; terminal CI pending |
| Secret shape                 | API accepts only exactly 64 lowercase hexadecimal characters; this proves representation, not entropy                                                                      | Prepared; terminal CI pending |
| Secret generation            | Operator generates and lowercase-hex encodes 32 fresh CSPRNG bytes for every API process                                                                                   | Operator precondition         |
| Environment removal          | The API captures then deletes the bootstrap variable from its process environment before composition and listen                                                            | Prepared; terminal CI pending |
| Digest-only authority        | After session construction, the server retains bootstrap and session digests rather than plaintext authority                                                               | Prepared; terminal CI pending |
| Web opt-in                   | Owner controls render only for exact `RESEARCH_COCKPIT_WEB_MODE=personal_single_user_local`                                                                                | Prepared; terminal CI pending |
| Bootstrap transport          | Password-field input is cleared and sent only through `X-Research-Cockpit-Bootstrap` on a bodyless POST                                                                    | Prepared; terminal CI pending |
| Bootstrap replay             | Within one authority/process, exactly one valid bootstrap may create the sole active session; reuse cannot replace or recover it                                           | Prepared; terminal CI pending |
| Cross-process secret reuse   | Detecting or denying operator reuse of the same valid-shaped secret in a separate process                                                                                  | Explicit nonclaim             |
| Stale-cookie recovery        | A fresh process may bootstrap with no owner cookie or one syntactically valid stale owner cookie; success replaces it, while malformed or duplicate cookies fail           | Prepared; terminal CI pending |
| Cookie boundary              | The host-only nonpersistent cookie is `HttpOnly`, `SameSite=Strict`, scoped to `/v1/personal-filing`, and has no active `Domain`, `Expires`, or `Max-Age`                  | Prepared; terminal CI pending |
| Binding                      | Session authorization matches the exact literal-loopback Origin and configured API Host retained at bootstrap                                                              | Prepared; terminal CI pending |
| CSRF                         | Every state-changing request requires its exact fixed intent header under exact-origin credentialed CORS                                                                   | Prepared; terminal CI pending |
| Input closure                | Duplicate or malformed authority/intent/bootstrap, forbidden proxy or negotiation inputs, queries, bodies, and ambiguous framing fail closed                               | Prepared; terminal CI pending |
| Idle expiry                  | Ten minutes without successful authorization invalidates the active session at the half-open boundary                                                                      | Prepared; terminal CI pending |
| Absolute expiry              | Sixty minutes from bootstrap invalidates the session and cannot be extended by use or rotation                                                                             | Prepared; terminal CI pending |
| Clock failure                | Nonfinite, failing, or backward-moving monotonic time invalidates authority                                                                                                | Prepared; terminal CI pending |
| Reuse                        | A valid unexpired session supports normal repeated protected requests and refreshes only idle time                                                                         | Prepared; terminal CI pending |
| Browser lifecycle lease      | Local observations are captured before corresponding request dispatch and never later than server authorization; reads/rotation reset only local idle                      | Prepared; terminal CI pending |
| Unknown browser absolute     | A tab finding an active cookie without its original absolute timestamp uses a conservative local lease bounded by idle TTL and claims no exact synchronization             | Prepared; terminal CI pending |
| Hide and restore             | `pagehide`/hidden clear local private presentation while preserving known deadlines; focus/`pageshow`/visible clear first and revalidate                                   | Prepared; terminal CI pending |
| Coordination failure         | `BroadcastChannel` construction failure disables personal access; publish failure locks and clears the initiating tab                                                      | Prepared; terminal CI pending |
| Cross-tab invalidation       | Immediate sibling invalidation or clear-then-revalidate is claimed only for operational delivery; missed-signal fallback is focus/visible/`pageshow` or conservative lease | Prepared; terminal CI pending |
| Browser-storage exclusion    | Lifecycle signals and timestamps enter no Web Storage, IndexedDB, or durable cookie                                                                                        | Prepared; terminal CI pending |
| Rotation                     | Rotation replaces the cookie and digest, preserves the absolute deadline, and rejects the old token                                                                        | Prepared; terminal CI pending |
| Logout                       | Logout invalidates server state and clears the exact cookie path                                                                                                           | Prepared; terminal CI pending |
| Revocation                   | Explicit revocation invalidates server state and clears the exact cookie path                                                                                              | Prepared; terminal CI pending |
| Process close                | Closing the API invalidates bootstrap/session state and destroys the digest key                                                                                            | Prepared; terminal CI pending |
| Private-work ordering        | Missing, malformed, expired, rotated, logged-out, revoked, or wrong-binding authority is denied before a personal capability is read                                       | Prepared; terminal CI pending |
| Confidentiality              | Cycle 3a code places authority in no URL, body, durable cookie, application browser storage, fixture, console, application log, or detailed error                          | Prepared; terminal CI pending |
| Cache denial                 | Session and protected-personal outcomes remain private and noncacheable                                                                                                    | Prepared; terminal CI pending |
| Personal API base            | Before fetch, browser calls require exact literal-loopback HTTP origin, explicit port 1–65535, and no userinfo, path, query, or fragment                                   | Prepared; terminal CI pending |
| Personal UI origin           | IPv4 uses `http://127.0.0.1:3000`; IPv6 uses `http://[::1]:3000`; `localhost` is never mixed with `127.0.0.1`                                                              | Prepared; terminal CI pending |
| Service-worker guard         | A controlling service worker or unreadable controller state denies personal calls before fetch; Cycle 3a registers no application worker and stores no authority there     | Prepared; terminal CI pending |
| Hostile browser state        | Resistance beyond the narrow controlling-service-worker guard                                                                                                              | Explicit nonclaim             |
| Protected composition code   | Tests apply the owner-session boundary to both personal compositions                                                                                                       | Prepared; terminal CI pending |
| Cycle 3a fact authorization  | Fresh owner-reviewed release bundle and fresh single-use approval bound to the eventual Cycle 3a source                                                                    | Pending owner authorization   |
| Preserved Cycle 2z artifact  | Remains bound to `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`, historically unchanged, and intentionally incompatible with a new source                                      | Preserved historical evidence |
| Dossier separation           | Personal facts remain separate from the synthetic dossier; no Cycle 3b consumer is introduced                                                                              | Prepared; terminal CI pending |
| Human identity               | Verified human identity                                                                                                                                                    | Explicit nonclaim             |
| Same-user/browser adversary  | Hostile same-user processes, extensions, developer tools, screenshots, clipboard readers, and memory inspection                                                            | Explicit nonclaim             |
| Remote/shared authentication | Remote, multi-user, tenant, shared-service, service-account, and production authentication                                                                                 | Out of scope                  |
| Persistence                  | Durable login, persistent session survival across restart, credentialless restart recovery, cross-process sharing, and credential storage                                  | Out of scope                  |
| Cycle 3b                     | Authenticated coherent personal dossier composition                                                                                                                        | Later milestone               |

## Configuration and bootstrap boundary

The API remains synthetic by default. An explicit personal mode cannot listen
without one exact valid-shaped bootstrap secret, and an invalid personal
composition cannot fall back to synthetic success. The API checks only for 64
lowercase hexadecimal characters; the operator must generate and encode 32
fresh CSPRNG bytes for every process. The entry point deletes the secret from the
API process environment before composition. Session construction reduces it to
a digest, and the accepted bootstrap destroys that digest within the authority.

The web interface independently remains synthetic unless exact personal web
mode is selected. The owner pastes the same secret into a transient password
field. The field is cleared on submission; the bodyless request carries the
secret only in the dedicated bootstrap header. Success returns no body and
places only the fresh session bearer in an HttpOnly cookie.

A browser retaining one syntactically valid stale owner cookie after process
restart or expiry may present it with the fresh bootstrap. The new process must
still have its unused bootstrap digest and no active session; success replaces
the stale cookie. Missing cookies are also accepted, while malformed or
duplicated cookies fail closed.

Bootstrap consumption and replay denial are process-local. There is no shared
registry that detects an operator configuring the same valid-shaped secret in a
different process; cross-process same-secret reuse is outside the claim.

## Request and lifetime boundary

Before any personal browser fetch, the client requires the API base to be an
exact literal-loopback HTTP origin with an explicit port from 1 through 65535
and no userinfo, path, query, or fragment. It also denies the request before
fetch if the page has a controlling service worker or the controller state
cannot be read. Cycle 3a registers no application service worker and places no
authority in application service-worker state. This is a narrow guard, not a
claim against hostile browser state.

The API accepts one browser origin derived from its literal loopback bind host
and requires the exact configured Host. State-changing routes additionally
require the exact `X-Research-Cockpit-Intent` value. CORS is credentialed only
for the explicit personal composition and only for that exact origin. Proxy
trust remains disabled.

The active session is memory-only and single-process. A successful protected
request advances the idle observation; it never moves the absolute deadline.
Rotation changes the bearer without extending that deadline. Logout,
revocation, either expiry, clock failure, or process close invalidates server
authority. Denied personal requests cannot obtain the readiness or selected-
fact capability.

The browser lifecycle is also memory-only. Each local deadline or observation is
captured before dispatching its corresponding bootstrap, revalidation, rotation,
or protected-read request, so it is never later than server authorization.
Successful authorized private reads and rotation reset only the local idle
deadline, and rotation preserves the known absolute deadline. A tab that
discovers an active cookie without the original absolute timestamp uses a
conservative local lease bounded by the idle TTL; it does not claim exact
synchronization with the server deadline.

`pagehide` and hidden visibility clear and deactivate local private presentation
while preserving any known local deadline, without broadcasting or ending the server session. Focus, `pageshow`, and
visible transitions clear first and trigger server revalidation without polling.
Local expiry, logout, revocation, or failed revalidation clears rendered private
state immediately. The nonpersistent `BroadcastChannel` is fail-closed: construction
failure disables personal access, and publish failure locks and clears the
initiating tab. Immediate sibling invalidation, or bootstrap/rotation clear-
then-revalidate, is claimed only when a credential-free message is delivered
operationally. An already-active sibling that misses it falls back to
focus/visible/`pageshow` revalidation or its conservative lease. The channel, its
signals, and lifecycle timestamps are absent from Web Storage, IndexedDB, and
durable cookies. Browser state cannot extend a server deadline or turn a server
denial into success.

## Confidentiality and exact nonclaims

Cycle 3a proves only possession of the accepted bootstrap and current session
bearer at the accepted local Host and Origin. It does not prove bootstrap
entropy, cross-process uniqueness, or a person. The secret and bearer may still
be observed by software already controlling the same operating-system user or
browser; browser extensions, developer tools, screenshots, clipboard readers,
and memory inspection remain outside the claim.

There is no remote or shared authentication, durable login, session survival
across restart, credentialless restart recovery, service identity, or TLS
claim. A new process can establish a new session only with an operator-configured
valid-shaped bootstrap; freshness is the operator's precondition. Personal facts
still do not enter a coherent dossier, evidence/history model, valuation,
thesis, alerts, export, persistence, fetcher, or background workflow. Those
remain Cycle 3b or later.

## Private fact-release authorization boundary

The prepared code protects both personal compositions in tests. That is not an
acceptance result for an actual Cycle 3a `personal_fact_release`. The preserved
Cycle 2z release bundle and consumed approval are source-bound to
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`, while the new runtime embeds its own
source revision and the loader requires equality. Those historical artifacts
are intentionally not runtime-compatible with a new source and remain unchanged.

After the eventual Cycle 3a source exists, actual fact-release composition
requires a fresh owner-reviewed release bundle and fresh single-use approval
bound to that exact source. This pending gate belongs to the personal profile; it is not
an enterprise/shared-service requirement.

## Evidence and exit rule

This matrix records prepared implementation only. It intentionally contains no
Cycle 3a commit hash, CI run, test count, private fact-release acceptance, or
Pass claim. Promotion requires an exact committed source, complete local
verification, terminal green required CI, a fresh owner-reviewed fact-release
bundle and fresh single-use approval bound to that source, and final review. The
status and evidence fields must be updated only after those results exist.
