# Cycle 3a exit matrix

Scope: add one short-lived, process-memory owner session in front of the
existing personal readiness and selected-fact routes without widening their
data scope or changing the synthetic default. The decision is recorded in
[ADR 0053](./adr/0053-personal-local-owner-session.md).

Implementation status: **Pass only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`.**

Public verification status: **Pass at that exact source revision.**

Private evidence status: **Limited to the permitted coarse outcome recorded
below.**

| Gate                         | Required result                                                                                                                                                            | Current status                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Synthetic default            | With no personal configuration, API and web retain their existing synthetic defaults                                                                                       | Pass at exact source revision |
| Explicit API configuration   | Both personal modes require one exact `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`; synthetic mode rejects personal configuration                                             | Pass at exact source revision |
| Secret shape                 | API accepts only exactly 64 lowercase hexadecimal characters; this proves representation, not entropy                                                                      | Pass at exact source revision |
| Secret generation            | Operator generates and lowercase-hex encodes 32 fresh CSPRNG bytes for every API process                                                                                   | Operator precondition         |
| Environment removal          | The API captures then deletes the bootstrap variable from its process environment before composition and listen                                                            | Pass at exact source revision |
| Digest-only authority        | After session construction, the server retains bootstrap and session digests rather than plaintext authority                                                               | Pass at exact source revision |
| Web opt-in                   | Owner controls render only for exact `RESEARCH_COCKPIT_WEB_MODE=personal_single_user_local`                                                                                | Pass at exact source revision |
| Bootstrap transport          | Password-field input is cleared and sent only through `X-Research-Cockpit-Bootstrap` on a bodyless POST                                                                    | Pass at exact source revision |
| Bootstrap replay             | Within one authority/process, exactly one valid bootstrap may create the sole active session; reuse cannot replace or recover it                                           | Pass at exact source revision |
| Cross-process secret reuse   | Detecting or denying operator reuse of the same valid-shaped secret in a separate process                                                                                  | Explicit nonclaim             |
| Stale-cookie recovery        | A fresh process may bootstrap with no owner cookie or one syntactically valid stale owner cookie; success replaces it, while malformed or duplicate cookies fail           | Pass at exact source revision |
| Cookie boundary              | The host-only nonpersistent cookie is `HttpOnly`, `SameSite=Strict`, scoped to `/v1/personal-filing`, and has no active `Domain`, `Expires`, or `Max-Age`                  | Pass at exact source revision |
| Binding                      | Session authorization matches the exact literal-loopback Origin and configured API Host retained at bootstrap                                                              | Pass at exact source revision |
| CSRF                         | Every state-changing request requires its exact fixed intent header under exact-origin credentialed CORS                                                                   | Pass at exact source revision |
| Input closure                | Duplicate or malformed authority/intent/bootstrap, forbidden proxy or negotiation inputs, queries, bodies, and ambiguous framing fail closed                               | Pass at exact source revision |
| Idle expiry                  | Ten minutes without successful authorization invalidates the active session at the half-open boundary                                                                      | Pass at exact source revision |
| Absolute expiry              | Sixty minutes from bootstrap invalidates the session and cannot be extended by use or rotation                                                                             | Pass at exact source revision |
| Clock failure                | Nonfinite, failing, or backward-moving monotonic time invalidates authority                                                                                                | Pass at exact source revision |
| Reuse                        | A valid unexpired session supports normal repeated protected requests and refreshes only idle time                                                                         | Pass at exact source revision |
| Browser lifecycle lease      | Local observations are captured before corresponding request dispatch and never later than server authorization; reads/rotation reset only local idle                      | Pass at exact source revision |
| Unknown browser absolute     | A tab finding an active cookie without its original absolute timestamp uses a conservative local lease bounded by idle TTL and claims no exact synchronization             | Pass at exact source revision |
| Hide and restore             | `pagehide`/hidden clear local private presentation while preserving known deadlines; focus/`pageshow`/visible clear first and revalidate                                   | Pass at exact source revision |
| Coordination failure         | `BroadcastChannel` construction failure disables personal access; publish failure locks and clears the initiating tab                                                      | Pass at exact source revision |
| Cross-tab invalidation       | Immediate sibling invalidation or clear-then-revalidate is claimed only for operational delivery; missed-signal fallback is focus/visible/`pageshow` or conservative lease | Pass at exact source revision |
| Browser-storage exclusion    | Lifecycle signals and timestamps enter no Web Storage, IndexedDB, or durable cookie                                                                                        | Pass at exact source revision |
| Rotation                     | Rotation replaces the cookie and digest, preserves the absolute deadline, and rejects the old token                                                                        | Pass at exact source revision |
| Logout                       | Logout invalidates server state and clears the exact cookie path                                                                                                           | Pass at exact source revision |
| Revocation                   | Explicit revocation invalidates server state and clears the exact cookie path                                                                                              | Pass at exact source revision |
| Process close                | Closing the API invalidates bootstrap/session state and destroys the digest key                                                                                            | Pass at exact source revision |
| Private-work ordering        | Missing, malformed, expired, rotated, logged-out, revoked, or wrong-binding authority is denied before a personal capability is read                                       | Pass at exact source revision |
| Confidentiality              | Cycle 3a code places authority in no URL, body, durable cookie, application browser storage, fixture, console, application log, or detailed error                          | Pass at exact source revision |
| Cache denial                 | Session and protected-personal outcomes remain private and noncacheable                                                                                                    | Pass at exact source revision |
| Personal API base            | Before fetch, browser calls require exact literal-loopback HTTP origin, explicit port 1–65535, and no userinfo, path, query, or fragment                                   | Pass at exact source revision |
| Personal UI origin           | IPv4 uses `http://127.0.0.1:3000`; IPv6 uses `http://[::1]:3000`; `localhost` is never mixed with `127.0.0.1`                                                              | Pass at exact source revision |
| Service-worker guard         | A controlling service worker or unreadable controller state denies personal calls before fetch; Cycle 3a registers no application worker and stores no authority there     | Pass at exact source revision |
| Hostile browser state        | Resistance beyond the narrow controlling-service-worker guard                                                                                                              | Explicit nonclaim             |
| Protected composition code   | Tests apply the owner-session boundary to both personal compositions                                                                                                       | Pass at exact source revision |
| Cycle 3a fact authorization  | Fresh owner-reviewed release and fresh single-use authorization bound to the exact Cycle 3a source                                                                         | See permitted coarse outcome  |
| Preserved Cycle 2z artifact  | Remains bound to `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`, historically unchanged, and intentionally incompatible with a new source                                      | Preserved historical evidence |
| Dossier separation           | Personal facts remain separate from the synthetic dossier; no Cycle 3b consumer is introduced                                                                              | Pass at exact source revision |
| Human identity               | Verified human identity                                                                                                                                                    | Explicit nonclaim             |
| Same-user/browser adversary  | Hostile same-user processes, extensions, developer tools, screenshots, clipboard readers, and memory inspection                                                            | Explicit nonclaim             |
| Remote/shared authentication | Remote, multi-user, tenant, shared-service, service-account, and production authentication                                                                                 | Out of scope                  |
| Persistence                  | Durable login, persistent session survival across restart, credentialless restart recovery, cross-process sharing, and credential storage                                  | Out of scope                  |
| Cycle 3b                     | Not part of the exact Cycle 3a source; a later public source is prepared but not authorized, verified, accepted, or promoted                                               | Prepared later source         |

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

The code protects both personal compositions. The preserved Cycle 2z evidence
remains source-bound to `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66` and
historically unchanged. Cycle 3a's source binding is distinct, and no private
sub-result enters public evidence. A later source requires fresh owner review
and fresh single-use authorization. This belongs to the personal profile; it is
not an enterprise/shared-service requirement.

## Evidence and exit rule

- Exact source revision:
  `ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`.
- Exact predecessor and transition topology: merge-free direct-child transition
  `dd7fb5ea0b5c288f4337793dd6ddcb314f8b41f3` ->
  `ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`, containing 39 paths, comprising
  13 additions and 26 modifications, with 6,543 insertions and 238 deletions.
- Local verification: `corepack pnpm verify` passed every format, lint,
  guardrail, type, peer, test, and production-build gate. Settled suite totals
  include 119 API tests, 94 web tests, and 582 database tests; every remaining
  package suite passed with only intentional skips.
- Public CI: exact-source general run `33460175145` passed on attempt 1 in
  Ubuntu job `99708487084` and Windows job `99708487035`; payload-custody
  run/job `33460175120` / `99708486913` and cross-engine run/job `33460175088`
  / `99708486675` also passed on attempt 1.
- Independent read-only source review found no remaining actionable P0/P1/P2
  issue for the declared personal scope. This is not an external audit.
- Coarse owner-approved private selected-fact release outcome: Pass for the
  exact frozen personal scope.

Public source evidence proves only the bounded capability and cannot substitute
for the permitted coarse private outcome. No public promotion text contains a
private sub-result. Cycle 3a is promoted only for the exact source revision and
declared personal scope above.

Cycle 3b authenticated personal dossier composition now has prepared public
source for one coherent admitted snapshot spanning dossier, evidence passport,
in-corpus restatement lineage, a fixed filing-fact chart, and valuation inputs,
with no synthetic/personal mixing. It has no fresh owner authorization,
terminal exact-source evidence, private activation, acceptance, or promotion.
Its required fresh action is
`APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE`; Cycle 2z and Cycle 3a approvals
are incompatible. Dynamic selection, refresh, promoted personal persistence,
and background work remain later outcomes. Cycle 3c is promoted only for exact
provider-neutral, no-transport public source revision
`4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`, with no private activation or
provider result. Cycle 3d is promoted only for its exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`; it has no actual personal vault,
key, backup, restore, or private activation and does not alter the promoted
Cycle 3a boundary. Cycle 3e-a owner-local security-master snapshot admission and
search has a recorded public engineering Pass only for its exact engine/API
chain. It is not accepted or promoted and has no real breadth claim until a
later exact owner-approved,
rights-compatible source snapshot is admitted and measured. See
[ADR 0054](./adr/0054-authenticated-personal-dossier-composition.md) and the
[Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md).
