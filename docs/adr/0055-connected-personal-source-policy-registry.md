# ADR 0055: connected-personal source-policy control plane

Status: **Provider-neutral prepared public source only. Cycle 3c has not been privately
activated, accepted, or promoted. It includes no actual provider/source
credential, provider secret adapter, external request, entitlement or legal
determination, provider billing ceiling, SEC refresh, or market-data adapter.**

## Context

The preserved `personal_single_user_local` profile is intentionally offline.
Cycle 3b prepares one authenticated dossier from an exact frozen filing
snapshot, but it neither selects nor contacts a network source. Adding ambient
provider configuration to an offline mode would erase that boundary and make
network authority difficult to review, disable, budget, or revoke.

Cycle 3c therefore prepares only a separate connected-personal control plane.
It must make the intended source, operation, terms, lifecycle, retention, and
application budget reviewable before a later execution gateway can perform
work. A policy record is an application constraint, not proof that the owner
has an entitlement or that a use is legally permitted.

## Decision

Add the exact API mode `personal_single_user_local_connected`. Synthetic mode
remains the default. Every existing offline personal mode retains its prior
behavior and rejects connected-only configuration rather than silently
inheriting it.

Connected mode has its own non-splitting `connected-server` build and start
entry. The ordinary server refuses this mode. The connected entry's exact
first-party static graph is frozen to its minimal app and composition root,
policy loader and status/kill routes, owner-session boundary, listen options,
and server. It does not load the demo app, personal filing corpus,
dossier/fact loaders, research state, or command-execution modules.

The connected mode composes one startup-fixed, immutable source-policy
registry. Each admitted source policy has one stable source identifier and
binds:

- an exact provider product or tier and opaque entitlement identifier;
- an exact terms or license URI and version plus effective, review, and expiry
  times;
- permitted purpose, geography, device, display, derivation, cache, history,
  export, retention, deletion, and termination rules;
- exact outbound host and operation pairs with no wildcard or implicit
  fallback;
- attribution requirements;
- owner-set request-count, request-byte, response-byte, stored-byte, and
  estimated-spend budgets; and
- one designated `owner-local-ref:v1:<store>:<entry>` owner-local secret
  locator when a future operation requires a credential.

Registry admission is all-or-nothing. API startup takes exact
`CONNECTED_SOURCE_POLICY_BUNDLE_PATH`,
`CONNECTED_SOURCE_POLICY_BUNDLE_SHA256`, and
`CONNECTED_SOURCE_POLICY_SECRET_REFERENCE` inputs. The canonical bundle wrapper
contains exactly `config`, `policy`, and `schemaVersion`. Missing, partial, extra, duplicate,
noncanonical, cross-mode, internally inconsistent, or unsupported policy state
fails before listen. An exact expired, revoked, or incompatible policy may
compose only so its terminal status remains available through the authenticated
owner inspection and kill boundary; it is never eligible for execution or a
dependent refresh. Configuration cannot declare a policy eligible merely by
omitting a restrictive field. No request may select or mutate a host,
operation, policy, entitlement, terms version, budget, or secret reference.

The loader requires one stable regular `connected-source-policy.bundle.json`,
verifies its exact SHA-256 and canonical JSON, takes owned bytes, and wipes the
owned byte carrier after composition. The API deletes the three connected
startup entries from its captured environment before listen. JavaScript string
storage is not claimed to be cryptographically erased. The bundle path must use
one canonical local absolute form: drive-qualified on Windows or single-rooted
on POSIX. UNC, device-namespace, double-root, and root-relative Windows forms
are rejected before filesystem access. This lexical check cannot prove that a
drive is not mapped or a POSIX path is not backed by a network mount; locally
backed storage remains an operator precondition.

Cycle 3c startup has no separate plaintext provider-credential field. Its
locator grammar does not prove that the operator-supplied store and entry
identifiers are non-secret; keeping them non-secret is an operator precondition.
The status-visible source and policy identifiers have the same metadata
precondition. Startup performs no credential-readiness probe and resolves no
secret reference. The core
package prepares an uncomposed execution seam that may ask an injected
`OwnerLocalSecretAdapter` to resolve one reference just in time, but only after
the exact policy and budget decision admits that operation. The core wipes the
credential copies it owns after the bounded call, but the injected secret and
transport adapters are a future confidentiality trust boundary: a hostile
adapter can retain, echo, transform, or exfiltrate credential bytes, and the
generic core cannot detect every encoding. Any concrete adapter must therefore
prove with adapter-specific leak tests that it keeps the credential outside
Git, fixtures, browser storage, URLs, unrelated requests, responses, logs, and
public CI. The API composes neither that execution seam nor any secret or
transport adapter, so Cycle 3c performs no actual credential resolution or
external request.

## Prepared source interfaces

The zero-production-dependency package is
`@research-cockpit/connected-source-policy`. Its public schema and profile
anchors are `CONNECTED_SOURCE_POLICY_SCHEMA_VERSION` and
`CONNECTED_SOURCE_POLICY_PROFILE`; its exact operation and status vocabularies
are `CONNECTED_SOURCE_POLICY_OPERATIONS` and
`CONNECTED_SOURCE_POLICY_STATUSES`.

`parseConnectedSourcePolicyConfig` parses the closed enabled or disabled
configuration. `createConnectedSourcePolicy` creates one process-memory
`ConnectedSourcePolicy` controller with exact `status`, `kill`,
`admitSourcePolicy`, `authorizeOperation`, `reserveBudget`, and `execute`
seams. Authorization and reservation return no caller-forgeable authority;
execution requires the branded single-use reservation. Response bytes remain
behind `ConnectedSourceResponseCapability` and can be obtained only through
`readConnectedSourceResponse`.

`OwnerLocalSecretAdapter`, `ConnectedSourceTransportAdapter`, and
`createConnectedSourceTransportCapability` are injected future-gateway seams,
not concrete source adapters. The Cycle 3c connected-source-policy route
registrar receives only the policy controller required for `status` and `kill`;
it is never given either adapter or a transport capability and never calls `authorizeOperation`,
`reserveBudget`, or `execute`.

## Runtime control decision

Within the connected-source-policy business/control surface, the prepared mode
exposes only two owner-session-protected operations:

1. authenticated `GET /v1/personal-filing/connected-source-policy/status`; and
2. bodyless authenticated
   `POST /v1/personal-filing/connected-source-policy/kill` with the exact owner intent
   `connected-source-policy-kill`.

The dedicated connected app also exposes its health endpoint and the five
inherited owner-session lifecycle routes. Those routes provide no provider
transport or connected-source execution authority.

Both retain the Cycle 3a literal-loopback Host/Origin, credentialed CORS,
cookie, negotiation, framing, and generic-denial server boundaries. Cycle 3c
ships no connected browser client, so it claims no service-worker prefetch
guard; any future connected client must establish that client-side boundary
separately.
The kill operation is bodyless and admits no query or request-selected source.
It makes the startup-fixed source unavailable for the rest of the process
before any future dependent work could begin. Repeated authenticated kill is
idempotent, returns `204`, preserves killed state, and cannot restore
eligibility. Restart does not claim durable revocation; a later
durable vault must supply that property.

The status response omits the secret reference and provider/source credential,
is private and noncacheable, and is bounded to exact
`ConnectedSourcePolicyStatus` fields: `schemaVersion`, `profile`, `status`,
`reasonCode`, `sourceId`, `policyId`, `policyVersion`, and `budget`. It does not
serialize the policy document, allowlist, or secret reference and must not
contain a plaintext credential, secret-derived value, private filing value,
provider payload, or synthetic fallback. The three status-visible identifiers
must be non-secret operator metadata. Kill returns no body.

Application budget admission uses explicit integer units and rejects work
before a configured request, byte, storage, or estimated-spend limit would be
exceeded. To bound owned allocation and replay state, configuration also
rejects request-byte or response-byte limits above 1 MiB and request-count
limits above 10,000; storage and estimated-spend values remain nonallocating
safe-integer counters. Cycle 3c does not execute work or consume a budget. These
limits govern only work the application may later start; concurrent
provider-side usage, taxes, credits, rounding, price changes, minimum charges,
delayed metering, and provider enforcement remain unknown. The budgets are not
a provider billing ceiling.

## Prepared implementation and security checklist

Cycle 3c source is complete only when all of these public properties are
implemented and verified:

1. **Mode closure:** exact connected mode is opt-in; missing or near-match mode
   values fail; every default and offline mode rejects connected inputs.
2. **Canonical registry:** schema, key ordering, bounded counts and text,
   duplicate rejection, exact policy identity, and immutable owned snapshots
   are enforced before listen.
3. **Operation closure:** only exact host/operation pairs are representable;
   wildcard, userinfo, caller-supplied URL, redirect, alternate port, and
   implicit provider fallback are absent from this control plane.
4. **Lifecycle closure:** effective, review, expiry, revocation, and
   compatibility state is evaluated fail closed; unavailable, malformed, or
   throwing clock input terminates eligibility. Detecting a valid-shaped clock
   rollback is not claimed.
5. **Terms coverage:** every purpose, geography, device, attribution, display,
   derivation, cache, history, export, retention, deletion, and termination
   decision is explicit; unknown is not treated as permitted.
6. **Budget closure:** request, response-byte, stored-byte, and estimated-spend
   ceilings use exact nonnegative integer units and pre-admission comparison;
   missing, overflowed, exhausted, or incompatible state denies later work.
7. **Secret-reference closure:** only the designated locator grammar is
   admitted and no separate provider-credential field exists; locator
   identifiers are a non-secret operator precondition, startup probes no
   credential store, and makes no credential-validity claim.
8. **Startup-input cleanup:** bundle bytes are wiped and captured path, digest,
   and secret-reference entries are deleted before listen, without claiming
   cryptographic erasure of JavaScript strings.
9. **Owner control:** status and kill require a valid Cycle 3a owner session;
   the kill action also requires the exact intent and rejects body, query,
   and duplicate headers; repeated authenticated kill preserves killed state
   and cannot restore eligibility.
10. **Confidential control outcomes:** runnable Cycle 3c status, kill, denial,
    unavailable, malformed, and killed responses are private/no-store and
    reveal no credential, secret reference where not explicitly safe, private
    fact, provider payload, local path, hash, or internal failure detail. The
    uncomposed injected transport result has the separate adapter-trust
    nonclaim below.
11. **No composed execution:** dependency and boundary tests prove that the
    connected API mode composes no secret adapter, transport capability,
    outbound DNS lookup, provider socket, TLS/HTTP client, provider SDK,
    redirect, retry, fetch, scheduler, queue, SEC refresh, market-data adapter,
    or background transport path. The loopback API listener remains the sole
    socket boundary. Abstract injected gateway seams are not evidence that any
    such adapter exists.
12. **Preserved history:** Cycle 2z, Cycle 3a, and Cycle 3b contracts and
    evidence remain unchanged; connected policy cannot authorize an offline
    release or reuse its approval.
13. **Exact-source evidence:** focused hostile tests, full repository
    verification, Windows/Linux CI, independent review, exact source topology,
    and any later expressly authorized private activation must finish before
    acceptance or promotion is recorded.

## Exact nonclaims

Cycle 3c does not establish:

1. an actual provider account, product, tier, entitlement, subscription, or
   credential;
2. credential readiness, credential validity, a secret-store connection, or
   plaintext credential handling at startup;
3. semantic proof that locator, source, or policy identifiers are non-secret;
   that remains an operator precondition;
4. cryptographic erasure of captured JavaScript path, digest, or opaque-
   reference strings after their environment entries are deleted;
5. confidentiality or non-exfiltration by an injected secret or transport
   adapter; a hostile adapter may retain, echo, transform, or expose credential
   bytes, so a future concrete adapter requires its own leak tests;
6. any direct outbound/provider DNS lookup, socket or TLS session, HTTP
   request, redirect, retry, rate-limit observation, provider response, or
   external currentness; mapped drives and network-mounted POSIX filesystems
   are not generically detectable;
7. legal advice, terms interpretation, entitlement validation, permission to
   use data, organizational approval, or source-license compliance in fact;
8. a provider-enforced billing ceiling, invoice reconciliation, price quote,
   charge prevention, or total-cost guarantee;
9. SEC filing discovery or refresh, EDGAR access-policy compliance, amendment
   discovery, or filing transport;
10. a market-data, quote, price-history, corporate-action, chart, news, event,
    fundamentals, or security-master adapter;
11. durable policy or kill state, migration, backup, restore, deletion proof,
    scheduling, queueing, crash recovery, or restart-safe budget counters;
12. remote, multi-user, tenant, shared-service, commercial, or production
    security; or
13. competitor feature parity.

Personal use keeps organizational rights/steward/counsel workflows, tenant
controls, commercial redistribution, paid billing, and production operations
out of scope. It does not remove the owner's responsibility to understand and
follow the terms of any source they later configure.

## Evidence and promotion rule

This repository state prepares public source and synthetic verification only.
It records no exact promoted source, private activation, actual policy or
secret, external provider interaction, acceptance, or promotion.

Promotion requires the focused policy, lifecycle, budget, secret-reference,
authorization, no-transport, confidentiality, and historical-mode tests; the
full repository gate; exact-source Windows and Linux CI; independent review;
and an exact source/promotion topology. If a later private activation is
required, it must be separately authorized and may publish only a coarse,
nonsecret outcome. A green public test run cannot be described as an external
provider or legal result.

Cycle 3d durable local research vault is the next functional implementation
blocker. It must not retroactively add persistence to this process-memory
control plane.

## References

- [Cycle 3c exit matrix](../CYCLE_3C_EXIT_MATRIX.md)
- [ADR 0054](./0054-authenticated-personal-dossier-composition.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
