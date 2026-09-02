# ADR 0054: authenticated personal dossier composition

Status: **Prepared public source only. Cycle 3b has not received fresh owner
authorization, has not run against the private filing corpus, has no terminal
exact-source verification result, and is not accepted or promoted.**

## Context

Cycle 3a protects the startup-fixed personal readiness and selected-fact
responses with one short-lived local owner session. The selected facts still
render in a separate panel and cannot feed the dossier, evidence, lineage,
chart, valuation, thesis, alert, export, or persistence surfaces. That
separation is correct for Cycle 3a but leaves the first useful personal
research workflow incomplete.

Cycle 3b must cross only the dossier-composition boundary. It must not widen
the offline corpus, introduce request-time selection, infer data absent from the
frozen corpus, mix personal and synthetic values, or reuse the exact Cycle 2z
or Cycle 3a authorization for a different response.

## Decision

Add the explicit API mode `personal_dossier` and matching exact
`RESEARCH_COCKPIT_WEB_MODE=personal_dossier`. Synthetic mode and the existing
`personal_readiness` and `personal_fact_release` modes remain unchanged. The
new API mode requires the existing quality-result configuration, the existing
owner bootstrap, and exactly these dossier-specific inputs:

- `PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH`;
- `PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256`; and
- `PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH`.

Missing, partial, extra-mode, malformed, source-mismatched, hash-mismatched,
or already-consumed configuration fails before listen. The dossier bundle role
is `personal_dossier_release_bundle`; its plan role is
`personal_dossier_release_plan`.

The plan uses the fixed rule `exact_candidate_document_index.v1`. It fixes the
terminal document index of one separately sealed declaration, manifest, and
quality-plan prefix, a canonical nonempty selected-fact key set, and a canonical
chart-key subset. `preparePersonalFilingDossier` recomputes admitted quality and
returns the exact normalization used for candidate commitment from those sealed
inputs. It decodes only the matching raw/source document-array prefix and never
inspects a later document-array entry. An earlier snapshot requires its own
prefix-sealed artifact: a full manifest would still cryptographically bind
every later manifest entry even if its document-array suffix were ignored. The
resulting snapshot may include current and superseded versions, evidence
passports, and lineage only when those records belong to that exact normalization
and fixed sealed prefix.

The canonical response is a distinct `PersonalFilingDossierDto`. It is not a
variant of the synthetic `DossierDto`. Its outer fields are `schemaVersion`,
`profile`, `dataMode`, `status`, `asOf`, `facts`, `evidence`, `lineage`, `chart`,
`valuationInputs`, and `omissions`; exact release has `dataMode: "personal"` and
`status: "personal_dossier_released"`. Facts are the only primary-fact registry.
Each fact retains `knownFrom` and `knownToExclusive`, and its evidence record
retains source acceptance and availability chronology. Direct evidence has
empty `derivationOperands`; derived evidence retains the formula and exactly
two ordered `minuend`/`subtrahend` operands with concept, value, unit, and
period. Those immutable operands are the sole intentional numeric evidence
outside the primary-fact registry. Lineage, chart, and valuation structures
reference canonical fact identifiers rather than copying or independently
recomputing personal values.
Every reference must resolve exactly once inside the same response. Duplicate
identifiers, dangling or foreign references, inconsistent known intervals,
invalid lineage, synthetic markers, or a chart key outside the approved set
quarantine the whole composition. An approved snapshot without chart facts or
valid required valuation inputs uses its exact unsupported variant. Unsupported
or omitted states remain explicit; there is no synthetic or fabricated
fallback.

The public contract supports honest unsupported chart and valuation variants.
An empty `chartFactKeys` set produces
`NO_OWNER_APPROVED_CHART_FACTS`; absent or out-of-domain valuation inputs
produce their exact unsupported reason. Those variants prove failure semantics,
not the Cycle 3b end-user chart or valuation-input exit. Terminal promotion
therefore requires the later owner-approved canonical response to contain a
ready nonempty chart and ready same-snapshot valuation inputs.

`loadPersonalDossierRelease` validates the exact bundle, quality result,
runtime source binding, canonical response binding, and one fresh approval with
action `APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE`. The prior Cycle 2z and
Cycle 3a approvals are deliberately incompatible. Only after every binding
passes may the loader atomically consume the approval and place the deeply
immutable response behind one branded `PersonalDossierReleaseCapability`.
Private input buffers are wiped after composition, and the capability remains
process-memory-only.

## Authenticated route and browser decision

The only dossier data operation is `GET /v1/personal-filing/dossier`. It accepts no
path parameter, query parameter, request body, caller-selected key, `knownAt`,
snapshot identifier, or release assertion, and it exposes no automatic HEAD
route. The exact Cycle 3a loopback Host, Origin, cookie, CORS, service-worker,
header, replay, expiry, rotation, logout, revocation, and browser-lifecycle
boundaries apply unchanged.

Authorization must complete before the route obtains the capability or
serializes private state. Success, denial, unavailability, and all malformed
requests remain private and noncacheable. Denial and failure responses are
generic and disclose no private value, label, key set, count, period, unit,
locator, path, hash, source metadata, authorization material, or operation
detail.

The personal browser exists only under exact
`RESEARCH_COCKPIT_WEB_MODE=personal_dossier` at the parameter-free `/personal`
route and obtains the dossier only after owner-session activation. In this mode,
`/research/[symbol]` redirects before symbol or `knownAt` resolution. The
browser renders dossier facts, evidence inspection, in-corpus restatement
lineage, the fixed filing-fact chart, explicit omissions or unsupported states,
and the valuation inputs from the one response. Personal state is cleared as one unit
on hide, expiry, logout, revocation, failed revalidation, abort, stale response,
or coordination failure. No synthetic dossier value is rendered, retained as a
fallback, or admitted to a personal formula, chart, valuation, thesis
evaluation, or error path. Personal thesis and alert persistence remain
disabled in this milestone.

The response and its derived presentation enter no Web Storage, IndexedDB,
service-worker state, application persistence, database, cache, telemetry,
console, or application log.

## Exact nonclaims

Cycle 3b does not establish:

1. request-time or runtime fact, document, chart, or `knownAt` selection;
2. network access, filing discovery, amendment discovery outside the frozen
   manifest, refresh, fetching, retries, queues, schedules, or background work;
3. persistence, restart recovery, a durable local vault, backup, restore,
   deletion, or export;
4. ticker, exchange, company-name, security-master, search, or watchlist
   mapping;
5. market prices, price history, corporate actions, technical indicators, or a
   market-derived chart;
6. multi-year statements, complete statement coverage, general metric depth,
   peers, scores, screening, portfolio analytics, or multi-model valuation;
7. owner corrections or provenance, currentness, or absence of later
   corrections outside the exact frozen corpus;
8. general SEC authenticity, accounting truth, taxonomy correctness, parser
   generalization, or source completeness beyond the earlier bounded quality
   result;
9. personal thesis, alert, export, report, or AI workflows;
10. verified human identity, hostile same-user or hostile-browser resistance,
    remote or multi-user authentication, a shared service, or production
    security; or
11. enterprise rights/steward approval, commercial redistribution, competitor
    feature parity, or authorization for another source or release.

## Evidence and promotion rule

This repository state prepares the public design and synthetic verification
surface only. It records no source revision, terminal local result, CI result,
independent-review result, private authorization, private execution, or
promotion claim.

Promotion requires all of the following at one later exact source:

1. the full repository verification gate and the focused contract, composition,
   API, browser, lifecycle, no-mixing, and confidentiality tests pass;
2. public CI passes on the declared Windows and Linux jobs;
3. independent review finds no remaining actionable P0/P1/P2 issue for the
   declared personal scope;
4. the owner reviews the exact canonical dossier response and provides a fresh
   single-use `APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE` authorization
   bound to that exact source, bundle, quality result, plan, and response;
5. the exact read-only, memory-only private run succeeds once, consumes the
   approval, revokes the owner session, and closes the server; and
6. public promotion records only a permitted coarse private outcome and the
   exact source/promotion topology. No private sub-result enters Git or public
   CI.

Until those gates pass, Cycle 3b remains prepared and not promoted. Cycle 3c
now has separate prepared public source for a connected-personal source-policy
control plane. It contains no actual provider or external request and must not
be composed into or treated as promotion of this offline milestone. Cycle 3d
now has separate prepared public source and local-temporary verification only,
with no actual personal vault, key, backup, restore, activation, acceptance, or
promotion. It cannot silently persist this dossier. Cycle 3e is the next
planned functional blocker only after the Cycle 3d gates are terminal.

## References

- [Cycle 3b exit matrix](../CYCLE_3B_EXIT_MATRIX.md)
- [Cycle 3c exit matrix](../CYCLE_3C_EXIT_MATRIX.md)
- [Cycle 3d exit matrix](../CYCLE_3D_EXIT_MATRIX.md)
- [ADR 0053](./0053-personal-local-owner-session.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
