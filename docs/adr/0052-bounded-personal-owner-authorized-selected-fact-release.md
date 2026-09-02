# ADR 0052: bounded personal owner-authorized selected-fact release

Status: **Accepted and promoted only for exact source revision
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`. Private evidence is limited to
the permitted coarse outcome below.**

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

- Exact source revision:
  `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`.
- Exact predecessor and transition topology: merge-free direct-child chain
  `62c01dafe305ddd43c75688e0225163b3abdf6df` ->
  `e64924bc091bfc7a3e071e7db746910e082051c4` ->
  `e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`. The implementation transition
  contains 43 paths, 13 added and 30 modified, with 3,840 insertions and 46
  deletions. The corrective transition contains 5 modified paths, with 1,310
  insertions and 9 deletions.
- Local contract, candidate-binding, API, browser, privacy, and boundary
  verification: `corepack pnpm verify` passed formatting, lint, guardrails,
  type checks, peer checks, 1,573 tests with 8 intentional skips, and all
  production builds at the exact source revision.
- Public CI: exact-source general run `33344500398` passed through Ubuntu job
  `99345958471` and Windows job `99345958683`; parser-isolation run
  `33344500394`, payload-custody run `33344500364`, and cross-engine run
  `33344500412` also passed.
- Independent implementation, contract, adversarial, and privacy source review
  completed with no remaining actionable P0/P1/P2 finding for the declared
  personal scope. This is not an external audit.
- Coarse owner-approved private selected-fact release outcome: Pass for the
  exact frozen personal scope.

Public source evidence does not prove that the private release occurred, and
synthetic tests cannot replace the coarse private outcome. Promotion requires
both exact-source public verification and the permitted coarse private
outcome.

Repository evidence must never contain released keys, values, units, periods,
selection details, response content, private bindings, authorization material,
commitments, locations, or operation detail. The exact coarse sentence above is
the only permitted private repository-visible outcome statement.

## Consequences and next blocker

Cycle 2z closes only bounded, same-snapshot, owner-authorized selected-fact
release from startup through the local API and optional browser view for the
exact frozen source and personal scope. It does not create a dossier or
persistent data plane.

Cycle 3a separately closes request-time authenticated owner-browser composition
only for exact source revision `ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`;
it still does not prove resistance to hostile same-user processes. Cycle 3b
authenticated personal dossier composition has prepared public source but no
fresh owner authorization, terminal exact-source evidence, private activation,
acceptance, or promotion. Its required
`APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE` action is deliberately
incompatible with this ADR's narrower approval. Dynamic selection, refresh,
promoted personal persistence, and background work remain later outcomes.
Cycle 3c is promoted only for exact provider-neutral, no-transport public source
revision `4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`, with no private activation or
provider result. Cycle 3d is promoted only for its exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`, with no actual personal vault, key,
backup, restore, or private activation. Cycle 3e-a owner-local security-master
snapshot admission and search is next, with no real breadth claim without an
exact rights-compatible source. Enterprise and shared-service controls remain
Out of scope for the personal profile.

## References

- [Cycle 2z exit matrix](../CYCLE_2Z_EXIT_MATRIX.md)
- [Cycle 3b exit matrix](../CYCLE_3B_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](../CYCLE_3D_EXIT_MATRIX.md)
- [ADR 0054](./0054-authenticated-personal-dossier-composition.md)
- [Cycle 2y exit matrix](../CYCLE_2Y_EXIT_MATRIX.md)
- [ADR 0051](./0051-bounded-personal-quality-readiness-composition.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
