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

Status: first clean-only b1 run complete; bounded b2 runtime-authentication
source implemented with live execution pending; pool/concurrency and restore
gates also remain pending.

**Cycle 1b-b1 source status:** the clean-only acceptance renderer, immutable
PostgreSQL 17.11 service declaration, synthetic two-tenant fixture, and
impersonated capability/RLS probes are implemented. A success-only run-record
contract binds a green run to its exact commit, reviewed inputs, observed tool
versions, and explicit limitations. The first clean-only workflow passed at
`611c93d`, and its retained artifact produced `offline_consistent` against
independently supplied run/repository/hash anchors and the exact committed
source blobs. See the [evidence note](./POSTGRESQL_ACCEPTANCE_EVIDENCE.md). The
current role bootstrap still runs as the ephemeral container superuser and does
not satisfy the distinct migrator or authenticated runtime/backup requirements.

**Cycle 1b-b2 target status:** source implemented; live execution and evidence
review are pending.
This bounded increment adds one ephemeral PostgreSQL runtime service-account
login after the existing clean bootstrap. It must authenticate with a run-local
SCRAM password over loopback TCP inside the unexposed service container, have no
direct application privilege, explicitly assume only the existing `NOLOGIN`
runtime capability, and run bounded identity, pre-role/cross-role denial,
missing-context, one-tenant isolation, sequential-cleanup, and write-denial
probes. The comprehensive b1 query-shape, rights, and prepared-read suite is not
rerun through authentication in b2. It does not add a driver or pool and does
not prove an end-user identity, external TLS, production secrets,
migrator/test-loader/backup authentication, restore, or deployment readiness.
See
[ADR 0014](./adr/0014-container-local-runtime-authentication.md) and the
[Cycle 1b-b2 exit matrix](./CYCLE_1BB2_EXIT_MATRIX.md).

1. **Cycle 1b-b1 clean bootstrap complete:** seven migrations executed from an
   empty database through the explicitly limited ephemeral superuser, and the
   declared `NOLOGIN` capabilities were exercised through impersonation. The
   immediate bounded b2 target is one authenticated runtime service-account
   session only. Distinct migrator, test-loader, and backup identities remain
   separate later gates.
2. **Cycle 1b-a complete:** the database-to-core contract is operation-scoped, validates returned scope/cutoffs, resolves exact policy versions in core, exposes no denied IDs/count attestation, and forces incomplete/unknown RLS views to `hasOmissions: true`, `count: null`. History, timeline, and instrument/evidence bindings are snapshot-owned, with adversarial SYN2 isolation coverage. See the Cycle 1b-a exit matrix and ADR 0009.
3. **Cycle 1b-a2 complete:** a pure database-package normalizer rejects malformed or partial synthetic financial-fact join batches before core. It freezes listing/security identity direction, lossless timestamp/fixed-decimal handling, exact operation grants, unknown RLS completeness, and the currently representable dimensionless unit subset. It contains no query, driver, pool, or app wiring; see ADR 0011 and the Cycle 1b-a2 exit matrix.
4. Add a read-only PostgreSQL adapter first and keep it out of the default demo composition root. Its query must perform the reviewed listing/share-class/security join, supply an explicit semantic unit mapping, and enter core only through the a2 normalizer and operation-scoped port. The current runtime capability remains read-only. Before implementing any mutation method, add a separate, narrowly scoped `NOLOGIN` writer capability and write policies in a reviewed migration; never widen the runtime role in place.
5. **Bounded isolation probes complete:** b1 covers direct-ID/list/join/count/
   subquery access, missing/malformed context, deactivation fixtures, and
   alternating prepared reads. At least 1,000 concurrent reads remain pending.
   If a writer capability is added, also test viewer writes, composite-FK
   attacks, idempotency races, and rollback before enabling it elsewhere.
6. **Sequential cleanup complete:** b1 proves transaction-local context clears
   after commit, rollback, and a handled error on one backend. Cancellation,
   timeout, simultaneous backends, and real pooled-connection reuse remain.
7. **Clean migration/replay/rollback complete:** b1 proves clean bootstrap,
   ledger state, replay refusal, and injected final rollback. A live
   checksum-drift case, logical dump/restore, and post-restore authorization
   behavior remain pending.

Exit gate: all live-database authorization and restore tests pass from a clean checkout. This is a harness restore target, not a production RPO/RTO.

The separate Ubuntu-only acceptance job now exists and its first reviewed run
passed. Its PostgreSQL server and `psql`/dump/restore clients come from one exact
major/minor/distro image reference and index digest. The b2 live rows remain
Pending and the b1 run cannot satisfy them. Remaining Cycle
1b-b work after b2 is migrator/test-loader/backup authentication, restore,
concurrency/cancellation, and the real pool boundary. The row-normalization
contract is frozen, but a client driver remains gated on the reviewed
query/unit mapping and those session/pool controls.

The first green-run milestone is complete. The immediate next database
milestone is the bounded b2 container-local SCRAM runtime service-account
probe. The distinct migrator is still blocked by the current migration `0001`
design: on PostgreSQL 17 a non-superuser `CREATEROLE` migrator receives an
administrative membership edge on a role it creates, while `0001` rejects every
pre-existing capability-role membership. That bootstrap must be split or
redesigned in a separate reviewed increment; b2 must not weaken it. Only after
authenticated backup design should the harness add a bounded dump/restore
probe. Application-pool cancellation/concurrency belongs with a real adapter
and pool. Do not treat either the clean-only impersonated-capability result or a
future container-local service-account result as permission to wire the
database into the app or accept real data.

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
