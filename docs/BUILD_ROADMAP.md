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

Status: first clean-only b1 run complete; bounded b2 runtime-authentication run
complete and reviewed; b3 authenticated authorization matrix run complete and
reviewed; b4 driverless projection-query and semantic-unit-mapping run complete
and reviewed; b5 authenticated test-loader source implemented and locally
verified with pinned live version 5 evidence pending. Pool/concurrency and
restore gates remain later work.

**Cycle 1b-b1 source status:** the clean-only acceptance renderer, immutable
PostgreSQL 17.11 service declaration, synthetic two-tenant fixture, and
impersonated capability/RLS probes are implemented. A success-only run-record
contract binds a green run to its exact commit, reviewed inputs, observed tool
versions, and explicit limitations. The first clean-only workflow passed at
`611c93d`, and its retained artifact produced `offline_consistent` against
independently supplied run/repository/hash anchors and the exact committed
source blobs. See the [evidence note](./POSTGRESQL_ACCEPTANCE_EVIDENCE.md). The
current role bootstrap still runs as the ephemeral container superuser and does
not satisfy a distinct migrator or authenticated backup requirement. B5 keeps
that bootstrap unchanged and adds a separate post-bootstrap authenticated
test-loader lifecycle; its pinned live evidence is still pending. The bounded
b2 runtime login is created separately after bootstrap.

**Cycle 1b-b2 status:** the bounded source and live execution were reviewed at
commit `3479e164`; see the
[Cycle 1b-b2 evidence note](./POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md).
This increment adds one ephemeral PostgreSQL runtime service-account login
after the existing clean bootstrap. It authenticates with a run-local
SCRAM password over loopback TCP inside the unexposed service container, has no
direct application privilege, explicitly assumes only the existing `NOLOGIN`
runtime capability, and runs bounded identity, pre-role/cross-role denial,
missing-context, one-tenant isolation, sequential-cleanup, and write-denial
probes. The comprehensive b1 query-shape, rights, and prepared-read suite is not
rerun through authentication in b2. It does not add a driver or pool and does
not prove an end-user identity, external TLS, production secrets,
migrator/test-loader/backup authentication, restore, or deployment readiness.
See
[ADR 0014](./adr/0014-container-local-runtime-authentication.md) and the
[Cycle 1b-b2 exit matrix](./CYCLE_1BB2_EXIT_MATRIX.md).

**Cycle 1b-b3 status:** source and first live execution complete and reviewed at
commit `664c0e5b`. The harness preserves b1's impersonated-capability checks
and, while the b2 ephemeral login is active, repeats the reviewed alpha/beta
tenant visibility, inactive and non-current membership, direct/join/subquery
isolation, operation-rights, and alternating prepared-read assertions through
the SCRAM-authenticated login with transaction-local `SET LOCAL ROLE`.
PostgreSQL run `31991498652` produced a version 3 success record that returned
`offline_consistent` against separately supplied anchors. B3 changes no
migration, capability role, fixture, application dependency, exposed port,
driver, pool, or composition root, and it does not promote b1's additional
null/malformed/unsupported-context cases. See the
[evidence note](./POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[ADR 0015](./adr/0015-authenticated-runtime-authorization-matrix.md), and the
[Cycle 1b-b3 exit matrix](./CYCLE_1BB3_EXIT_MATRIX.md).

**Cycle 1b-b4 status:** one source-controlled, parameterized, read-only
query now covers the exact listing -> share class -> security -> financial fact
-> rights policy/current-operation grant path. A closed semantic mapping from
stored unit/currency pairs to the narrow core units, the exact Cycle 1b-a2 wire
shape, a reviewed result bound, and fail-closed normalization are implemented.
The source executed through the existing container-local authenticated `psql`
acceptance path; the pinned live run and version 4 artifact were reviewed. B4
adds no database driver, pool, application import or composition, migration,
writer capability, API route, or real data. See the
[B4 evidence note](./POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[ADR 0016](./adr/0016-driverless-projection-query-and-semantic-unit-mapping.md)
and the [Cycle 1b-b4 exit matrix](./CYCLE_1BB4_EXIT_MATRIX.md).

**Cycle 1b-b5 status:** the accepted design preserves the seven migrations and
reviewed fixture bytes, strictly extracts the fixture's direct-insert body, and
loads it in one transaction through a distinct ephemeral SCRAM login with one
exact set-only edge to `research_cockpit_test_seed`. It requires wrong-password,
pre-role, cross-role, session-authorization, atomic-rollback, synthetic-policy,
mutation/ledger/DDL-denial, role-reset, and zero-residue probes. Source
implementation and local verification are complete; a clean pinned run and
reviewed version 5 record remain required. The exact new completed-check ID is
`authenticated_test_loader_fixture_load`; the two remaining operational-session
nonclaims are `authenticated_migrator_sessions` and
`authenticated_backup_sessions`. See
[ADR 0017](./adr/0017-authenticated-test-loader-fixture-load.md) and the
[Cycle 1b-b5 exit matrix](./CYCLE_1BB5_EXIT_MATRIX.md).

1. **Cycle 1b-b1 clean bootstrap complete:** seven migrations executed from an
   empty database through the explicitly limited ephemeral superuser, and the
   declared `NOLOGIN` capabilities were exercised through impersonation. The
   bounded b2 target of one authenticated runtime service-account session is
   complete for its reviewed run. At that milestone, distinct migrator,
   test-loader, and backup identities remained separate later gates. B5 now
   addresses only the test-loader source boundary; its live gate remains open.
2. **Cycle 1b-a complete:** the database-to-core contract is operation-scoped, validates returned scope/cutoffs, resolves exact policy versions in core, exposes no denied IDs/count attestation, and forces incomplete/unknown RLS views to `hasOmissions: true`, `count: null`. History, timeline, and instrument/evidence bindings are snapshot-owned, with adversarial SYN2 isolation coverage. See the Cycle 1b-a exit matrix and ADR 0009.
3. **Cycle 1b-a2 complete:** a pure database-package normalizer rejects malformed or partial synthetic financial-fact join batches before core. It freezes listing/security identity direction, lossless timestamp/fixed-decimal handling, exact operation grants, unknown RLS completeness, and the currently representable dimensionless unit subset. It contains no query, driver, pool, or app wiring; see ADR 0011 and the Cycle 1b-a2 exit matrix.
4. **Cycle 1b-b4 complete for its recorded scope:** the exact read-only
   projection query and closed semantic unit mapping run through authenticated
   `psql`, then pass the bounded result through the a2 normalizer. The pinned
   PostgreSQL run and offline-consistent version 4 record are retained. This is
   a query contract and live acceptance slice, not an adapter. A driver, pool,
   application import, composition-root switch, mutation, and real data remain
   outside B4.
5. **Bounded isolation probes complete:** b1 covers direct-ID/list/join/count/
   subquery access, missing/malformed context, deactivation fixtures, and
   alternating prepared reads through capability impersonation. B3 implements
   authenticated parity in source for the reviewed tenant, membership,
   query-shape, operation-rights, and alternating prepared-read cases; the
   reviewed b3 run passed that exact matrix through the service account. The b1
   null/malformed/unsupported-context failures remain impersonated-capability
   evidence. At least 1,000 concurrent reads remain pending. If a writer
   capability is added, also test viewer writes, composite-FK attacks,
   idempotency races, and rollback before enabling it elsewhere.
6. **Sequential cleanup complete:** b1 proves transaction-local context clears
   after commit, rollback, and a handled error on one backend. Cancellation,
   timeout, simultaneous backends, and real pooled-connection reuse remain.
7. **Clean migration/replay/rollback complete:** b1 proves clean bootstrap,
   ledger state, replay refusal, and injected final rollback. A live
   checksum-drift case, logical dump/restore, and post-restore authorization
   behavior remain pending.

Exit gate: all live-database authorization and restore tests pass from a clean checkout. This is a harness restore target, not a production RPO/RTO.

The separate Ubuntu-only acceptance job now exists. Its PostgreSQL server and
`psql`/dump/restore clients come from one exact major/minor/distro image
reference and index digest. The reviewed b2 run passed its bounded
container-local SCRAM rows; the historical b1 run did not satisfy them.
The reviewed b3 run passed its exact authenticated tenant-isolation,
operation-rights, and one-backend prepared matrix and retained the remaining
version 3 limitations. The reviewed b4 run passed the exact driverless
query-to-normalizer path and retained the version 4 limitations. Remaining
Cycle 1b-b work starts with the pinned authenticated test-loader run and review,
then the
platform/migrator split and live migrator proof, authenticated backup and
restore, a single-client read-only adapter, and finally the real
pool/concurrency/cancellation boundary. The row-normalization contract is
already frozen; the B4 query and unit contract now provides a reviewed input to
the later single-client adapter milestone without proving that adapter.

The first b1 green-run, bounded b2 runtime-authentication, b3 authenticated
authorization-matrix, and b4 driverless query/normalizer milestones are
complete for their recorded scopes. B5 is the active authenticated non-owner
test-loader successor. Its source implementation is locally verified, but no
live version 5 claim exists. The next B5 gate is the pinned live run and
independent evidence review. A later single-client read adapter must remain
separate from both B4 and the pool/concurrency milestone.
The distinct migrator is still blocked by the current migration `0001`
design: on PostgreSQL 17 a non-superuser `CREATEROLE` migrator receives an
administrative membership edge on a role it creates, while `0001` rejects every
pre-existing capability-role membership. That bootstrap must be split or
redesigned in a separate reviewed increment; the b2 result does not weaken it.
Only after authenticated backup design should the harness add a bounded
dump/restore probe. Application-pool cancellation/concurrency belongs with a
real adapter and pool. Do not treat B4, the clean-only
impersonated-capability result, or the reviewed b2/b3 container-local
service-account results as permission to wire the database into the app or
accept real data.

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
