# ADR 0051: bounded personal quality-readiness composition

Status: Accepted and verified; **Pass only for exact source revision
`a3ab46aa09f1b63a86fdb8c1f98976b26ba30e3f`**.

## Context

Cycle 2x closes the bounded owner-reviewed personal-quality gate and permits
one coarse repository-visible statement that the private threshold was met. It
does not compose the private result into the running application. The current
application is synthetic by default, and its dossier, evidence, persistence,
and browser-local state contracts must not be repurposed for personal filing
values merely because the quality gate passed.

The first application boundary should prove only that an exact private quality
result can be admitted before startup and reduced to a value-free readiness
state. It must not load personal facts, expose a personal dossier, place owner-local paths in API
or browser configuration or logs, or make the browser a carrier for the
private aggregate.

## Decision

Add a closed startup mode named `personal_readiness`. Synthetic startup remains
the default. The personal mode must be selected explicitly; unknown, empty,
misspelled, inferred, or ambiguous modes fail closed and cannot fall through to
personal admission.

Before the application listens, one dedicated loader validates the exact
source-pinned and hash-pinned resource-corrected Cycle 2x aggregate. The loader
reads that aggregate at most once, admits only the closed terminal state that
means the personal quality gate is ready, and reduces it to an empty, immutable
capability that can enable only this exact DTO:

```json
{
  "schemaVersion": "1.0.0",
  "profile": "personal_single_user_local",
  "status": "quality_gate_ready",
  "dataPlane": "disabled"
}
```

The loader returns no aggregate field or binding. It does not copy the private
reference, quality plan, approval, seal, receipt, hash, path, count, metric,
label, value, or validation detail into the application. The private carrier
is released after validation. Requests cannot invoke the loader, cause a
reread, select another aggregate, or change readiness after listen.

The pre-listen owner supplies only an absolute path and its exact lowercase
SHA-256 through `PERSONAL_FILING_QUALITY_RESULT_PATH` and
`PERSONAL_FILING_QUALITY_RESULT_SHA256`. Both are required together and are
accepted only with explicit `RESEARCH_COCKPIT_MODE=personal_readiness`. The
server captures and removes those two variables before composition; neither
remains in the listening process environment or becomes request-visible
configuration. Same-user substitution of both the file and owner-provided pin
remains outside this personal-profile claim.

## API decision

Expose one GET-only local readiness route. It accepts no path parameter, query
parameter, request body, identifier, readiness assertion, or private input.
Success returns only the exact DTO above. The endpoint never returns a personal
fact, metric, source binding, private hash, path, or evidence detail.

The server binds only to an exact loopback literal with proxy trust disabled.
The readiness route additionally requires one exact allowlisted local Host and
one exact allowlisted local browser Origin. Missing, duplicated, malformed,
forwarded, or non-allowlisted authority input is rejected before readiness is
returned. This is a local request guard, not owner authentication.

Every GET success, denial, and unavailable response carries
`Cache-Control: private, no-store` and `Pragma: no-cache`. The route emits no
private ETag, last-modified value, data-as-of header, cookie, bearer token,
input-derived trace identifier, or cache validator. Failure responses are
stable and value-free and do not disclose why private admission failed.

## Browser decision

The browser integration is optional. If present, it may render only a coarse
quality-ready chip from the exact DTO. It may not fetch or display personal
facts, values, labels, metrics, source identifiers, evidence, history, or a
personal dossier. It must not persist readiness in local storage, session storage,
IndexedDB, a service worker, application state storage, analytics, telemetry,
or error reporting.

The `dataPlane: "disabled"` literal is mandatory in contract, API, and browser
handling. Cycle 2y contains no alternate response variant that enables facts.

## Failure and confidentiality decision

Missing, unreadable, malformed, noncanonical, source-mismatched, hash-
mismatched, quarantined, not-met, unexpected, or replaced private evidence
cannot become ready. Explicit personal startup either holds the complete opaque
readiness capability or fails before listen. Under default synthetic startup,
an allowed GET receives only the fixed unavailable response at the route;
boundary-denied requests receive the same fixed denial used in either mode.
Neither path exposes partial personal state or readiness success after failed
admission.

No private carrier, error object, rejected value, header, request body,
owner-local path, validation stage, binding, or result detail is written to
stdout, stderr, request logs, application logs, browser logs, telemetry,
storage, or Git. The API and browser learn no private state beyond the coarse
readiness state.

## Applicability and exact nonclaims

This decision applies only to one owner performing local, offline,
noncommercial, nonredistributed research. Enterprise approval, tenancy,
multi-user controls, B15/V15, commercial redistribution, shared-service
operation, and production remain Out of scope.

Cycle 2y does not establish:

1. personal fact, value, label, metric, evidence, history, timeline, valuation,
   or dossier composition;
2. atomic release of selected facts from the same immutable snapshot whose
   quality result was admitted;
3. persistence, export, caching, alerting, thesis storage, or database
   ingestion for personal filing data;
4. authenticated owner identity, an authenticated browser session, CSRF
   protection beyond the exact local Origin guard, or authorization for facts;
5. protection against hostile processes under the same operating-system user,
   browser extensions, developer tools, screenshots, or memory inspection;
6. remote, multi-user, tenant, shared-service, commercial, redistributed, or
   production safety;
7. any expansion of the Cycle 2x claims about chronology, adjudication,
   reference correctness, representativeness, authenticity, accounting truth,
   parser coverage, amendment discovery, or currentness; or
8. permission to change `dataPlane` from `disabled`.

## Evidence and promotion

- Exact source revision:
  `a3ab46aa09f1b63a86fdb8c1f98976b26ba30e3f`.
- Exact predecessor and topology: direct child of promoted Cycle 2x
  documentation baseline `2e88db749ead46828235f7c58e128f92e4ccff44`; the
  source transition contains 30 paths, 12 added and 18 modified, with 2,713
  insertions and 51 deletions.
- Local contract, API, browser, privacy, and boundary verification:
  `corepack pnpm verify` passed with 1,526 tests, 8 intentional skips, all
  guardrails and type checks, and all production builds. Focused API, web, and
  contracts totals were 76/76, 11/11, and 6/6.
- Public CI: exact-source run `33334380969` passed on its first attempt with
  Ubuntu job `99318536228` and Windows job `99318536323`.
- Independent review: three parallel read-only implementation, contract, and
  adversarial review tracks completed; final closure checks reported no
  remaining actionable P0/P1/P2 finding after corrections. This is source
  review rather than an external audit.

No private aggregate, hash, path, binding, or private result detail is part of
the promotion evidence.

## Consequences and next blocker

Cycle 2y closes only coarse quality-readiness composition from startup through
the local API to an optional browser chip. It leaves the personal data plane
disabled and preserves the existing synthetic dossier and storage boundaries.

The next separate blocker is an owner-authorized, all-or-nothing selected-fact
release from the same immutable candidate snapshot bound to the admitted
quality result. That future boundary requires its own minimal DTO, lifecycle,
browser disclosure, nonpersistence, and failure controls. Browser
authentication and same-user hostile-process resistance remain later still.

Cycle 2z records the accepted design for that owner-authorized selected-fact
release, but its implementation, exact source, public verification,
independent review, and private owner outcome remain Pending. It does not widen
the Cycle 2y decision. Request-time authenticated owner-browser composition is
the next separate blocker after Cycle 2z; same-user hostile-process resistance
remains later.

## References

- [Cycle 2y exit matrix](../CYCLE_2Y_EXIT_MATRIX.md)
- [Cycle 2z exit matrix](../CYCLE_2Z_EXIT_MATRIX.md)
- [ADR 0052](./0052-bounded-personal-owner-authorized-selected-fact-release.md)
- [Cycle 2x exit matrix](../CYCLE_2X_EXIT_MATRIX.md)
- [ADR 0050](./0050-bounded-personal-owner-reviewed-filing-quality-measurement.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
