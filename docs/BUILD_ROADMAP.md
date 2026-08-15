# Build roadmap after Sprint 0

## Completed foundation

Sprint 0 proves the clean vertical path with one fictional common stock:
as-known fact supersession, ten metrics, formula/evidence passports,
server-side rights denial, transparent valuation, browser-local thesis, local
rule evaluation, responsive UI, REST/OpenAPI contracts, tests, production
builds, and automated governance gates. Public-knowledge and database-recorded
time are named separately, but the demo wrapper does not yet query them with
independent cutoffs.

## Cycle 1a — isolated authorization and storage contract

Status: implemented and locally verified, still synthetic only.

1. A context-bound research-state port and atomic in-memory adapter cover membership roles, tenant scoping, optimistic versions, 24-hour idempotency, payload hard delete with same-type non-reusable IDs, export, and payload-free audit metadata.
2. Adversarial tests cover identical cross-tenant IDs, forged tenant context, viewer denial, stale and concurrent writers, replay conflicts, rollback, and payload leakage.
3. Ordered raw PostgreSQL migrations and an immutable checksum manifest define synthetic-only shared/private schemas, exact rights versions, fixed-point values, half-open public-known/system time, transaction-local context, and forced RLS.
4. Static clean-room and SQL checks cover migrations and future container/config surfaces. No database adapter, identity provider, API write route, or UI persistence was added.

The existing GET-only API and browser-local demo remain unchanged. This slice is not production persistence or authentication.

## Cycle 1b — real PostgreSQL proof

Target: 1–2 weeks after a pinned PostgreSQL CI service is approved.

1. Execute migrations from an empty database using distinct bootstrap/migrator, non-owner runtime, synthetic test-loader, and backup roles.
2. Freeze the database-to-core projection contract before writing an adapter. Move the current code-constant history and timeline records into the instrument snapshot and prove a second synthetic symbol cannot inherit SYN1 events. SQL currently evaluates one transaction purpose/channel while dossier projection needs display, derive, and local-alert decisions. Define operation-aware loading/evaluation, keep RLS as defense in depth, and return an explicit completeness state. If RLS makes omissions unknowable, emit `hasOmissions: true` with `count: null` rather than a false zero.
3. Add a read-only PostgreSQL adapter first and keep it out of the default demo composition root. The current runtime capability remains read-only. Before implementing any mutation method, add a separate, narrowly scoped `NOLOGIN` writer capability and write policies in a reviewed migration; never widen the runtime role in place.
4. Run cross-tenant direct-ID/list/join/count/subquery probes, missing/malformed context, membership and principal deactivation, and at least 1,000 alternating/concurrent reads. If the separate writer capability is added in this cycle, also test viewer writes, composite-FK attacks, idempotency races, and rollback before enabling it anywhere outside the isolated acceptance harness.
5. Prove transaction-local context clears on commit, rollback, cancellation, timeout, and pooled-connection reuse.
6. Prove clean migration, checksum drift failure, injected mid-migration rollback, logical dump/restore, and post-restore authorization behavior against an exact PostgreSQL image digest.

Exit gate: all live-database authorization and restore tests pass from a clean checkout. This is a harness restore target, not a production RPO/RTO.

## Cycle 1c — demo identity and API contract proof

Only after Cycle 1b, add loopback-only opaque synthetic personas and minimal
thesis/alert API writes with `If-Match` and `Idempotency-Key`. The organization
must come from resolved context, never a URL or body. Preserve the browser-local
profile until the full API authorization suite passes. Production OIDC remains
separate gated work.

## Cycle 2 — filing ingestion proof

Target: 3–4 weeks after the parser threat-model gate is implemented.

1. Build a sandboxed Python 3.12 worker boundary and a fixed, counsel-approved public-filing corpus.
2. Preserve raw payload and audit metadata in separate retention domains; support payload deletion/crypto-erasure.
3. Normalize ten launch facts with source accession, accepted/available time, parser version, taxonomy, unit, dimensions, and supersession lineage.
4. Compare two independent parsers/validators, quarantine conflicts, and forbid silent repair.
5. Measure document success, fact precision/recall, unit/date tolerance, silent-failure rate, and quarantine rate against independently adjudicated ground truth.

Exit gate: at least 100 representative filings and 2,000 critical assertions meet the frozen quality thresholds with zero silent critical failures.

## Cycle 3 — product breadth

Only after executed display/derived/alert/export rights and 10K/100K-user cost models exist:

- expand from 10 to 30 versioned common-stock metrics;
- add a typed screener/query engine and saved views;
- persist thesis/watchlist data behind tenant authorization;
- add one production alert channel with delivery receipts and duplicate monitoring; and
- run paid-beta accessibility, performance, restore, incident-correction, and operational-readiness gates.

ETF accounting, portfolio performance, broad calendars, generative AI, broker connections, and multi-channel alerts remain deferred.
