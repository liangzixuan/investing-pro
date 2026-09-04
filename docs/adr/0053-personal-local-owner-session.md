# ADR 0053: personal local owner session

Status: **Accepted and promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Private evidence is limited to
the permitted coarse outcome below.**

## Context

Cycle 2z can expose one startup-fixed personal selected-fact response through
an exact loopback, Host, and Origin boundary. Those request properties constrain
where a request came from, but they do not prove that the requesting browser
possesses owner authority. A local client able to reproduce them can otherwise
reach the personal route.

The next boundary must add request-time possession without widening the data
scope, persisting a credential, introducing remote identity, or changing the
synthetic default. This remains the `personal_single_user_local` profile: one
owner, one local API process, one local browser session, no customers, no
redistribution, and no shared service.

## Decision

Every explicit personal API mode requires an operator-supplied
`RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`. Its only valid representation is
exactly 64 lowercase hexadecimal characters. Missing, empty, uppercase,
malformed, partial, or extra bootstrap configuration fails before listen. This
shape check does not establish entropy: the operator must generate 32 fresh
bytes with a CSPRNG for every API process and encode them as lowercase
hexadecimal. Supplying personal configuration while the default synthetic mode
is selected also fails closed; synthetic startup remains unchanged when no
personal configuration is present.

The API entry point captures the bootstrap secret with the other pre-listen
configuration and deletes `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET` from the API
process environment before composition and before listen. Session construction
derives the bootstrap digest. After construction, the authority retains only
the digest, never the original secret. Application logging remains disabled,
and startup failure remains generic and value-free.

The bootstrap is single-use within one authority/process. One accepted
presentation destroys that authority's retained bootstrap digest and creates
exactly one active process-memory session. An invalid presentation does not
create a session, and a used bootstrap cannot be replayed within that authority
to replace or recover one. A process restart requires the operator to configure
a fresh secret, but the implementation has no cross-process consumption registry
and cannot detect reuse of the same valid-shaped secret. For restart or expiry
recovery, bootstrap accepts either no owner cookie or one syntactically valid
stale owner cookie. Success replaces that stale cookie. Malformed or duplicated
cookies still fail, and recovery never bypasses the requirements that the new
process hold an unconsumed bootstrap digest and no active session.

## Browser bootstrap and CSRF decision

The personal owner controls are rendered only when the web process has the
exact opt-in `RESEARCH_COCKPIT_WEB_MODE=personal_single_user_local`. Synthetic
web mode remains the default and does not render the password field or owner
session controls.

The owner pastes the secret into a password field. On submission, the component
clears the field state and sends the secret only in the
`X-Research-Cockpit-Bootstrap` header on a bodyless POST to
`/v1/personal-filing/session/bootstrap`. Cycle 3a code places the secret in no
URL, query, request body, response body, cookie, Web Storage, IndexedDB,
application persistence, console, or application log, and writes or stores it
in no application service worker. The bootstrap response is bodyless.
Controlling or uninspectable service-worker state is denied before personal
fetch as described below; bypass by hostile browser state remains a nonclaim.

Every state-changing session request also requires one exact
`X-Research-Cockpit-Intent` value matching the route: `bootstrap`, `rotate`,
`logout`, or `revoke`. This non-simple header, credentialed CORS restricted to
one exact browser origin, the exact Origin and Host checks, and rejection of
forwarded identity provide the local CSRF boundary. Duplicate, malformed, or
unexpected authority, intent, bootstrap, negotiation, body-framing, or proxy
headers fail closed.

The API bind host determines the only accepted browser origin:

- `127.0.0.1` requires `http://127.0.0.1:3000`; and
- `::1` requires `http://[::1]:3000`.

The browser and API must use the same literal loopback family. In particular,
`localhost` must not be mixed with an API bound to `127.0.0.1`. Proxy trust
remains disabled, and the request Host must match the configured API authority.
The personal client rejects every request before fetch unless its API base is an
exact literal-loopback HTTP origin with an explicit port from 1 through 65535
and no userinfo, path, query, or fragment. It likewise rejects before fetch when
the page has a controlling service worker or its controller state cannot be
read. Cycle 3a registers no application service worker and stores no authority
in application service-worker state. This is a narrow guard, not a general
resistance claim for hostile browser state.

## Session decision

The successful bootstrap returns only `204 No Content` plus a host-only
`research_cockpit_owner_session` cookie. The active cookie has no `Domain`,
`Expires`, or `Max-Age`; it is therefore nonpersistent and is scoped to
`Path=/v1/personal-filing` with `HttpOnly` and `SameSite=Strict`. The application
never exposes the cookie value to JavaScript. Logout and revocation clear the
same cookie path with `Max-Age=0`.

The cookie contains a fresh 32-byte random bearer token. The server retains
only a keyed digest and the exact Host/Origin binding. There is at most one
active session per API process. Its monotonic lifetime has:

- a 10-minute idle deadline, refreshed only by successful authorization; and
- a 60-minute absolute deadline fixed at bootstrap and never extended.

Expiry uses half-open boundaries. Reaching either deadline invalidates the
active digest. A nonfinite, failing, or backward-moving clock also invalidates
the session. Missing, malformed, duplicated, expired, wrong-binding, rotated,
logged-out, revoked, or closed authority is rejected before a protected
personal response is obtained.

The session route supports a bodyless authenticated status check, rotation,
logout, and explicit revocation. Rotation replaces the token and digest without
extending the absolute deadline; the old token fails immediately. Logout and
revocation invalidate server authority and clear the cookie. Closing the API
invalidates the bootstrap and active-session digests and destroys the digest
key.

## Browser lifecycle decision

The browser keeps owner-session lifecycle state only in memory. For bootstrap,
revalidation, rotation, and protected reads, it captures the corresponding local
deadline or observation before request dispatch; the browser timestamp is never
later than server authorization. Successful authorized private reads reset only
the local idle deadline. Rotation also resets only local idle and preserves the
locally known absolute deadline. These observations cannot extend either server
deadline.

A tab that discovers an already-active cookie but does not know the original
absolute timestamp uses a conservative local lease bounded by the idle TTL. It
does not infer or claim exact synchronization with the server deadline.
`pagehide` and a hidden visibility transition clear and deactivate local private
presentation while preserving any known local deadline, without broadcasting or ending the server session. Window focus,
`pageshow`, and a visible transition clear first and trigger a bodyless server
status revalidation; there is no polling loop.

Local expiry, logout, revocation, or failed revalidation immediately clears
every rendered private value in the initiating tab. The nonpersistent
`BroadcastChannel` is required for personal access: construction failure
disables access, and publish failure locks and clears the initiating tab. A
credential-free invalidation clears sibling tabs immediately only when delivery
is operational. Bootstrap and rotation use the same channel for a clear-then-
revalidate request. An already-active sibling that misses a message falls back
to focus/visible/`pageshow` revalidation or its conservative local lease. The channel
carries no bootstrap secret or session bearer, establishes no authority, and is
not stored for a later browser process. Lifecycle signals and timestamps enter
no Web Storage, IndexedDB, or durable cookie. The API session remains
authoritative: local state cannot turn a server denial into success.

## Protected personal routes

Both explicit personal modes require the owner-session configuration. Their
readiness and selected-fact routes require a valid session cookie in addition
to the existing exact request boundary. Authorization runs before the
selected-fact capability is read, so a denial cannot begin private response
work. Every success and denial remains private and noncacheable with generic,
value-free failure bodies.

Cycle 3a does not merge personal facts into the synthetic dossier. The
synthetic dossier remains available under its historical demo behavior and is
not evidence of owner authentication.

The code protects both personal compositions. The preserved Cycle 2z release
evidence remains bound to exact source
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66` and remains historical. Cycle 3a's
source binding is distinct, and no private sub-result enters public evidence. A
later source still requires fresh owner review and fresh single-use
authorization. This is a personal-profile boundary, not an enterprise
requirement.

## Exact nonclaims

Cycle 3a does not establish:

1. verified human identity; possession of the bootstrap and session bearer is
   the only owner claim;
2. proof of bootstrap entropy or cross-process uniqueness; single-use and replay
   denial apply to one authority/process, and same-secret reuse in a separate
   process is not detected;
3. resistance to hostile processes under the same operating-system user,
   browser extensions, developer tools, screenshots, clipboard readers, or
   process/browser-memory inspection;
4. resistance to hostile browser state beyond the narrow controlling-service-
   worker prefetch guard;
5. remote, multi-user, tenant, shared-service, service-account, OIDC, WebAuthn,
   commercial, redistributed, or production authentication;
6. durable login, persistent sessions, cross-process session sharing, session
   survival or credentialless recovery across restart, password recovery, or a
   credential store; or
7. Cycle 3b personal dossier composition, evidence/history integration,
   valuation, thesis, alerts, export, persistence, fetching, or background
   work.

The loopback HTTP cookie is not a remote transport-security claim. Any future
network exposure requires a separately designed TLS and `Secure`-cookie
boundary.

## Evidence and promotion status

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

Public source evidence proves only the bounded capability. It does not expose
or independently prove any private sub-result. Cycle 3a is promoted only for
the exact source revision and declared personal scope above.

## Consequences and next boundary

The promoted design closes Host/Origin-only access by requiring possession of an
operator-configured local bootstrap and a short-lived session. Fresh CSPRNG
generation per process remains an operator precondition. The design deliberately
favors fail-closed restart and rebootstrap over persistence.

Cycle 3b remains separate from the exact promoted Cycle 3a source. It is
accepted and promoted only for its later exact source revision
`3fe17a21330b6a8ee438298628a832f274fc7216`, with private evidence limited to
the permitted coarse outcome recorded in the Cycle 3b exit matrix. Its exact approval action is
`APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE`; the Cycle 3a approval cannot be
reused. This later promotion does not alter the exact Cycle 3a source or scope.
Dynamic selection, refresh, promoted personal persistence, and
background work remain later outcomes. Cycle 3c is promoted only for exact
provider-neutral, no-transport public source revision
`4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`, with no private activation or
provider result. Cycle 3d is promoted only for its exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`, with no actual personal vault, key,
backup, restore, or private activation. It does not make this owner session
durable. Cycle 3e-a owner-local security-master snapshot admission and search is
now recorded as a public engineering Pass only for its exact engine/API chain.
It is not accepted or promoted
and has no real breadth claim until a later exact owner-approved,
rights-compatible source snapshot is admitted and measured.

## References

- [Cycle 3a exit matrix](../CYCLE_3A_EXIT_MATRIX.md)
- [Cycle 3b exit matrix](../CYCLE_3B_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](../CYCLE_3D_EXIT_MATRIX.md)
- [ADR 0052](./0052-bounded-personal-owner-authorized-selected-fact-release.md)
- [ADR 0054](./0054-authenticated-personal-dossier-composition.md)
- [ADR 0057](./0057-owner-local-security-master-snapshot-and-search.md)
- [Cycle 3e-a exit matrix](../CYCLE_3E_A_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
