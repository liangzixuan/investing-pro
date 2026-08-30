# ADR 0052: bounded personal owner-authorized selected-fact release

Status: Accepted design; **implementation, exact source revision, public
verification, independent review, and owner-authorized private release are
Pending. No personal selected-fact release Pass is claimed.**

## Context

Cycle 2y admits only the coarse personal quality-ready state and keeps the
personal data plane disabled. It does not authorize a fact response. The next
boundary must release only an owner-reviewed selection from the same immutable
candidate snapshot whose quality result was admitted, without turning the
private quality material into application state.

This remains the `personal_single_user_local` profile: one owner, local and
offline, noncommercial, and nonredistributed. Enterprise and shared-service
requirements remain Out of scope.

## Decision

Add one exact, explicit personal selected-fact startup mode. Synthetic startup
remains the default, and readiness-only startup remains separate. Missing,
unknown, partial, inferred, or misspelled configuration cannot activate a fact
release.

Before listen, one dedicated release boundary snapshots the exact bounded
inputs and rederives the candidate through the production normalization and raw
agreement path. It admits only an already evaluated and met quality result and
requires the rederived input set and candidate to match that result's existing
commitments. A separately supplied normalized record cannot satisfy this
same-snapshot check.

The owner reviews a canonical release plan and the exact proposed closed
response before startup. Fresh single-use authorization binds the exact source,
quality result, rederived snapshot, plan, and response. Validation and response
derivation finish before authorization is consumed. Consumption is atomic;
missing, revoked, replaced, raced, replayed, or already consumed authorization
fails closed. A failed startup never falls back to readiness or synthetic
success under the requested release mode.

All source bindings, commitments, authorization material, and preparation
material remain owner-local. The running application receives only an opaque,
instance-bound capability carrying one complete immutable response.

## Response and API decision

The response is one exact closed personal selected-facts DTO. Its outer fields
are only schema version, personal profile, release status, and facts. Each fact
contains only its fixed public fact key, canonical decimal value, canonical
unit, nullable period start, and period end. The selection is a bounded,
nonempty subset of the existing fixed personal fact vocabulary in canonical
order.

The response contains no document coordinate, accession, fact or source
identifier, source concept, taxonomy, lineage, derivation operands, quality
metric, quality binding, approval detail, validation detail, or storage
locator.

Expose one GET-only local selected-facts route. It accepts no path parameter,
query parameter, request body, caller-selected key, identifier, readiness
assertion, or release assertion. Exact loopback, Host, and browser Origin checks
apply with proxy trust disabled. Every GET outcome is private and noncacheable.
Denial and unavailability are stable and value-free. A request cannot read
private inputs, rederive the candidate, change the selection, or retry startup.

## Browser and storage decision

The browser integration is optional and may render only the exact authorized
response. It does not merge personal facts into the synthetic dossier or feed
valuation, thesis, alert, evidence, history, export, analytics, telemetry, or
error-reporting flows. The response is not persisted in local storage, session
storage, IndexedDB, a service worker, application persistence, a database, or a
cache.

Rendering makes the selected values visible to the local browser. Cycle 2z
does not claim secrecy after rendering.

## Failure and confidentiality decision

Explicit selected-fact startup either holds the complete immutable authorized
response before listen or fails before listen. There is no partial response,
partial selection, late admission, alternate input, fallback response, or
request-triggered recovery.

Errors and logs disclose no personal fact, selected key set, period, unit,
source metadata, quality detail, commitment, authorization material, private
location, or operation detail. Public source evidence may describe only the
bounded capability and a coarse private outcome after the owner approves a
successful release.

## Exact nonclaims

Cycle 2z does not establish:

1. correctness, accounting truth, source authenticity, independent
   adjudication, chronology, representativeness, parser generalization,
   amendment discovery, or currentness beyond Cycle 2x;
2. release outside the exact startup-fixed owner-authorized subset or dynamic
   request-selected facts;
3. a personal dossier, multi-document history, timeline, evidence passport,
   lineage, derivation display, quality-metric display, valuation, thesis,
   alert, export, persistence, queue, fetcher, or background ingestion;
4. authenticated owner identity, an authenticated browser session, or
   authorization for another startup or later release;
5. client authentication from loopback, Host, or Origin checks;
6. secrecy from browser extensions, developer tools, screenshots, memory
   inspection, or hostile processes under the same operating-system user;
7. remote, multi-user, tenant, shared-service, commercial, redistributed, or
   production safety; or
8. permission to widen the fixed response, selection, route, or nonpersistence
   boundary.

## Evidence and promotion

- Exact source revision: **Pending**.
- Exact predecessor and transition topology: **Pending**.
- Local contract, candidate-binding, API, browser, privacy, and boundary
  verification: **Pending**.
- Public CI runs and jobs: **Pending**.
- Independent implementation, contract, adversarial, and privacy review:
  **Pending**.
- Coarse owner-approved private selected-fact release outcome: **Pending**.

Pending public source evidence does not prove that a private release occurred.
Pending private evidence cannot be replaced by synthetic tests. Promotion
requires both exact-source public verification and the owner's coarse private
Pass.

Repository evidence must never contain released keys, values, units, periods,
selection details, response content, private bindings, authorization material,
commitments, locations, or operation detail. The only permitted private
repository-visible statement after success is a coarse owner-approved Pass for
the exact frozen personal scope.

## Consequences and next blocker

Cycle 2z can close only bounded, same-snapshot, owner-authorized selected-fact
release from startup through the local API and optional browser view. It does
not create a dossier or persistent data plane.

The next separate blocker is request-time authenticated owner-browser
composition: a short-lived, session-bound owner capability with CSRF, replay,
and lifetime controls so private values are not available merely to a local
client that can reproduce Host and Origin. That boundary still does not prove
resistance to hostile same-user processes. Broader selection, history, dossier,
persistence, export, valuation, thesis, and alerts remain later. Enterprise and
shared-service controls remain Out of scope for the personal profile.

## References

- [Cycle 2z exit matrix](../CYCLE_2Z_EXIT_MATRIX.md)
- [Cycle 2y exit matrix](../CYCLE_2Y_EXIT_MATRIX.md)
- [ADR 0051](./0051-bounded-personal-quality-readiness-composition.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
