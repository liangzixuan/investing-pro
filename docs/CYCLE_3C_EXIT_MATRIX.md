# Cycle 3c exit matrix

Scope: prepare the provider-neutral explicit
`personal_single_user_local_connected` control
plane and one startup-fixed source-policy registry without connecting to a
provider or widening any offline personal mode. The decision is recorded in
[ADR 0055](./adr/0055-connected-personal-source-policy-registry.md).

Implementation status: **Provider-neutral prepared public source only; exact source not yet
declared.**

Terminal verification status: **Pending.**

Private activation status: **Not performed or authorized.**

Acceptance/promotion status: **Not accepted or promoted.**

## Gate matrix

| Gate                         | Required result                                                                                                                                                                                                                          | Current status                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Synthetic default            | Missing mode remains `synthetic_demo`; connected configuration is rejected rather than inferred                                                                                                                                          | Prepared; terminal evidence pending |
| Offline isolation            | `personal_readiness`, `personal_fact_release`, and `personal_dossier` keep their exact contracts and reject connected-only inputs                                                                                                        | Prepared; terminal evidence pending |
| Explicit connected mode      | Only exact `personal_single_user_local_connected` selects the control plane; case variants, aliases, and partial configuration fail before listen                                                                                        | Prepared; terminal evidence pending |
| Static entry isolation       | A separate non-splitting connected server owns this mode; the ordinary server refuses it, and its exact static graph excludes demo, corpus, dossier/fact, research-state, and command-execution modules                                  | Prepared; terminal evidence pending |
| Canonical registry           | One bounded, immutable, startup-fixed registry admits exact schemas and rejects unknown fields, duplicates, ambiguity, noncanonical encoding, and mutable or inherited inputs                                                            | Prepared; terminal evidence pending |
| Source identity              | Every policy binds a stable source identifier, exact provider product/tier, opaque entitlement identifier, and exact terms/license URI and version                                                                                       | Prepared; terminal evidence pending |
| Policy lifecycle             | Effective, review, expiry, revocation, termination, and compatibility state are explicit; unavailable, malformed, or throwing clock input denies eligibility                                                                             | Prepared; terminal evidence pending |
| Clock rollback nonclaim      | Valid-shaped backward clock movement is not detected or claimed as safe                                                                                                                                                                  | Explicit nonclaim                   |
| Terms coverage               | Purpose, geography, device, attribution, display, derivation, cache, history, export, retention, deletion, and termination decisions are explicit; unknown never means permitted                                                         | Prepared; terminal evidence pending |
| Host/operation closure       | Only exact admitted host/operation pairs exist; no wildcard, caller URL, userinfo, redirect, alternate-port inference, or implicit provider fallback is representable                                                                    | Prepared; terminal evidence pending |
| Application budgets          | Exact request, response-byte, stored-byte, and estimated-spend units fail closed before excess work; request/response limits hard-cap at 1 MiB and request count at 10,000                                                               | Prepared; terminal evidence pending |
| Billing nonclaim             | Application budgets are never described as provider billing ceilings, invoices, quotes, or total-cost guarantees                                                                                                                         | Explicit nonclaim                   |
| Opaque secret references     | Policy may contain only `owner-local-ref:v1:<store>:<entry>` with no separate provider-credential field; locator identifiers must be non-secret operator metadata                                                                        | Prepared; terminal evidence pending |
| No startup credential probe  | Startup neither resolves nor validates a credential and makes no secret-store, entitlement, or credential-readiness claim                                                                                                                | Prepared; terminal evidence pending |
| Startup-input cleanup        | Owned bundle bytes are wiped and captured path, digest, and opaque-reference entries are deleted before listen; cryptographic JavaScript-string erasure is not claimed                                                                   | Prepared; terminal evidence pending |
| Bundle path locality         | Windows paths must be drive-qualified and POSIX paths single-rooted; UNC, device, double-root, and root-relative Windows forms fail before file access; mapped/network-mounted backing remains an operator precondition                  | Prepared; terminal evidence pending |
| Future just-in-time boundary | The abstract execution gateway may resolve a reference only after exact policy and budget admission; it is not composed by the running API, and Cycle 3c performs no credential use                                                      | Explicit nonclaim                   |
| Authenticated status         | The parameter-free status operation requires the Cycle 3a owner session and returns only a canonical, credential/reference-free, private/noncacheable view; its source/policy identifiers must be non-secret metadata                    | Prepared; terminal evidence pending |
| Authenticated kill           | A bodyless, parameter-free kill operation requires the owner session and exact `connected-source-policy-kill` intent; it disables eligibility before future dependent work                                                               | Prepared; terminal evidence pending |
| Kill semantics               | Repeated authenticated kill is idempotent with `204` and preserves killed state; malformed requests and attempts to restore eligibility fail closed; restart is not claimed as durable revocation                                        | Prepared; terminal evidence pending |
| Generic control failure      | Runnable status, kill, denial, and failure reveal no credential, private value, provider payload, local path, hash, policy internals, authorization detail, or operation detail                                                          | Prepared; terminal evidence pending |
| Adapter confidentiality      | A future concrete secret/transport adapter is a trust boundary and needs adapter-specific leak tests; generic core cannot stop a hostile adapter from echoing or transforming credentials                                                | Explicit nonclaim                   |
| No composed transport        | API mode receives no secret adapter or transport capability and can execute no outbound DNS, provider socket, TLS/HTTP client, provider SDK, redirect, retry, fetch, queue, scheduler, or background work; its loopback listener remains | Prepared; terminal evidence pending |
| Abstract gateway seams       | Core `authorizeOperation`, `reserveBudget`, and `execute` seams remain uncomposed; injected interface coverage is not a provider or external-request result                                                                              | Prepared; terminal evidence pending |
| No provider                  | No actual provider, account, subscription, tier, entitlement, provider/source credential, provider secret adapter, external request, or response is included                                                                             | Explicit nonclaim                   |
| No source adapter            | No SEC refresh, EDGAR fetch, market-data, quote, price-history, corporate-action, news, fundamentals, chart, or security-master adapter is included                                                                                      | Explicit nonclaim                   |
| Legal nonclaim               | A configured record does not prove rights, entitlement, legal validity, terms compliance, or organizational approval                                                                                                                     | Explicit nonclaim                   |
| Preserved evidence           | Cycle 2z, Cycle 3a, and Cycle 3b contracts, approvals, source bindings, and evidence remain unchanged                                                                                                                                    | Prepared; terminal evidence pending |
| Remote/shared profile        | Multi-user, tenant, shared-service, commercial, production, organizational stewardship, and provider billing operations remain outside the personal scope                                                                                | Out of scope                        |
| Public verification          | Focused hostile tests, full local verification, Windows/Linux CI, and independent review pass at one exact source                                                                                                                        | Pending                             |
| Private activation           | Any later required private activation is separately authorized and publishes no policy, identifier, secret reference, credential, or provider detail                                                                                     | Not performed or authorized         |
| Promotion topology           | Exact merge-free source and documentation-promotion transitions are pinned and verified                                                                                                                                                  | Pending                             |

## Prepared interface boundary

The exact startup selector is
`RESEARCH_COCKPIT_MODE=personal_single_user_local_connected`. Exact connected
startup keys are `CONNECTED_SOURCE_POLICY_BUNDLE_PATH`,
`CONNECTED_SOURCE_POLICY_BUNDLE_SHA256`, and
`CONNECTED_SOURCE_POLICY_SECRET_REFERENCE`. The canonical wrapper contains
exactly `config`, `policy`, and `schemaVersion`. The registry is a control-plane
input only. Existing synthetic and offline personal startup paths must reject
any connected-only policy configuration. Bundle paths reject Windows UNC,
device-namespace, and root-relative forms plus POSIX double-root forms before
filesystem access. A mapped drive or network-mounted POSIX path cannot be
identified generically and remains an explicit operator-locality precondition.

Connected mode is started through the distinct `connected-server` build/start
entry with bundler splitting disabled. The ordinary server rejects the mode.
The frozen first-party static graph contains only the connected server,
minimal app and composition root, policy loader and routes, owner-session
boundary, and listen options; it does not load demo, personal-corpus,
dossier/fact, research-state, or command-execution modules.

Within the connected-source-policy business/control surface, the API exposes
only owner-session-authenticated
`GET /v1/personal-filing/connected-source-policy/status` and bodyless
`POST /v1/personal-filing/connected-source-policy/kill`. The mutation requires
exact intent `connected-source-policy-kill`. The dedicated connected app also
exposes health and the five inherited owner-session lifecycle routes; none
provide provider transport.

Neither operation accepts a caller-selected source, host, operation, policy,
budget, entitlement, secret reference, or URL. All success and failure
responses are private and noncacheable. No response contains the secret
reference, a provider/source credential, provider payload, personal filing
value, or synthetic fallback. Status-visible `sourceId`, `policyId`, and
`policyVersion` must be configured as non-secret metadata.

## Secret and transport boundary

Cycle 3c policy stores only the designated
`owner-local-ref:v1:<store>:<entry>` locator to owner-local secret material and
has no separate provider-credential field. Its grammar cannot prove that the
operator-supplied store and entry identifiers are non-secret. The API does not
inspect the referenced store, test credential readiness, or perform a provider request.
The core package prepares injected `OwnerLocalSecretAdapter` and
`ConnectedSourceTransportAdapter` interfaces plus controller
`authorizeOperation`, `reserveBudget`, and `execute` seams. The API composes
none of them. A later execution gateway must first obtain an allow decision for
the exact source, host, operation, lifecycle, and budgets, then resolve the
reference just in time. Those uncomposed seams are not an actual provider,
secret, adapter, or external request.

## Exit and next blocker

Cycle 3c cannot be marked Pass until its exact-source focused tests, full public
gates, CI, independent review, source topology, and any separately required
private activation are terminal. Prepared source and synthetic fixtures are not
provider, entitlement, legal, billing, freshness, or adapter evidence.

Cycle 3d durable local research vault is the next functional implementation
blocker. It remains separate and cannot silently make this process-memory
policy or kill state durable.

## References

- [ADR 0055](./adr/0055-connected-personal-source-policy-registry.md)
- [Cycle 3b exit matrix](./CYCLE_3B_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
