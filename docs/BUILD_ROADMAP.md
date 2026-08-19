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
4. Static clean-room and SQL checks cover migrations and future container/config surfaces. This Cycle 1a slice added no database adapter, identity provider, API write route, or UI persistence; the separate B9 adapter and B10 pool sources do not retroactively widen it.

The existing GET-only API and browser-local demo remain unchanged. This slice is not production persistence or authentication.

## Cycle 1b — real PostgreSQL proof

Status: first clean-only b1 run complete; bounded b2 runtime-authentication run
complete and reviewed; b3 authenticated authorization matrix run complete and
reviewed; b4 driverless projection-query and semantic-unit-mapping run complete
and reviewed; b5 authenticated test-loader run complete and reviewed; b6
authenticated owner-DDL canary run complete and reviewed; and b7 authenticated
clean application-migration run complete and reviewed. The b8 authenticated
policy-scoped data-backup and bounded clean-restore run and independent version
8 artifact review are also complete. The b9 single-client read-only adapter,
pinned live version 9 execution, and independent artifact review are complete
for their bounded scope. The b10 bounded pool lifecycle design and source are
implemented, locally verified, and live-reviewed; the pinned V10 execution and
independent artifact review are complete for their bounded scope. The B11
locked migration-ledger deployer, V11 evidence contract, integrated local
verification, pinned live execution, and independent artifact review are also
complete for their bounded scope. The B12 deterministic RLS query-plan and
bounded 2,000-read source/evidence contract, pinned V12 execution, and
independent artifact review are complete for their bounded scope. The next
package-roadmap prerequisite now has a B13 technical source contract: the
privacy/retention decision, empty-only keyed-identifier plan, and V13 evidence
branches are implemented. Pinned live V13 execution and review remain pending,
and production privacy/legal admission remains blocked.

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
test-loader lifecycle whose bounded live result is now reviewed. The bounded b2
runtime login is created separately after bootstrap. B6 also leaves bootstrap
unchanged and adds only a temporary post-bootstrap owner-DDL canary; it is not a
migration path.

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
implementation, the clean pinned run, and independent version 5 review are
complete at commit `04e5c1b`. The exact new completed-check ID is
`authenticated_test_loader_fixture_load`; the two remaining operational-session
nonclaims are `authenticated_migrator_sessions` and
`authenticated_backup_sessions`. See
[the B5 evidence note](./POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./adr/0017-authenticated-test-loader-fixture-load.md) and the
[Cycle 1b-b5 exit matrix](./CYCLE_1BB5_EXIT_MATRIX.md).

**Cycle 1b-b6 status:** the accepted preparatory design creates one ephemeral,
acceptance-only SCRAM login with one exact set-only edge to the existing owner
capability. It proves wrong-password and pre-role denial, forbidden
role/session escalation, transaction-local owner selection, injected DDL
rollback, a committed canary with exact owner and ACL, authenticated removal,
ledger immutability, role reset, and zero authentication/object residue before
catalog checks and evidence. Source implementation, the clean pinned run, and
independent version 6 review are complete at commit `7aac502`. PostgreSQL run
`32058853521` produced an offline-consistent retained record. The exact new
completed-check ID is `authenticated_owner_ddl_canary`; version 6 retains the
same six source-hash keys and every version 5 nonclaim, including
`authenticated_migrator_sessions`. See the
[B6 evidence note](./POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./CYCLE_1BB6_EXIT_MATRIX.md).

**Cycle 1b-b7 status:** source implementation, the clean pinned run, and
independent version 7 review are complete at commit `41d13dd`. PostgreSQL run
`32068159652` produced an offline-consistent retained record. The v2 plan is the
sole B7 migration authority, while the historical manifest/bodies remain
inherited b1 through b6 regressions only. After those regressions the harness
closed ephemeral sessions, connected only to maintenance database `postgres`,
proved zero target sessions/backends, dropped the exact disposable target
without `FORCE`, dropped the four dependency-free capability roles, recreated
the target, and proved pristine. A container-superuser platform transaction
created the fixed roles, owner-owned schemas, public/database ACL lockdown and
hardened `btree_gist`; then one ephemeral non-superuser SCRAM login selected
only the owner capability to apply the complete role-neutral application plan.
V7 appends only
`authenticated_clean_application_migrations_after_platform_bootstrap`, binds
the platform plan, application manifest and authenticated renderer through new
source hashes, and replaces only `authenticated_migrator_sessions` with the
external/production/incremental and global-atomicity nonclaims. See the
[B7 evidence note](./POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](./adr/0019-versioned-authenticated-migration-phase.md), and the
[Cycle 1b-b7 exit matrix](./CYCLE_1BB7_EXIT_MATRIX.md).

**Cycle 1b-b8 status:** source implementation, the clean pinned run, and
independent version 8 review are complete at commit `49d3a96`. PostgreSQL run
`32076642878` produced an offline-consistent retained record. B8 provisions one
ephemeral SCRAM login that may select only the existing
`research_cockpit_backup` capability to create a custom, RLS-enabled,
column-insert, data-only archive of the 21 reviewed synthetic application data
tables. The migration ledger is excluded and established independently. A
second clean database in the same pinned cluster is created from `template0`,
receives the reviewed restore platform and exact v2 application migrations,
then accepts the archive through a different ephemeral SCRAM login that may
select only `research_cockpit_test_seed`. Transactional failure rollback,
successful restore, replay denial, exact table fingerprints, catalog/security
equivalence, source isolation, and zero residue passed before version 8
evidence was written. This is not a full-schema/global,
cross-cluster/version, production, incremental/continuous,
encrypted/retained, disaster-recovery, or RPO/RTO result. See the
[B8 evidence note](./POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md),
and the [Cycle 1b-b8 exit matrix](./CYCLE_1BB8_EXIT_MATRIX.md).

**Cycle 1b-b9 complete for its bounded recorded scope:** one non-owning,
exclusively leased single-client, read-only `pg` adapter now implements
`OperationScopedProjectionSource<FinancialFact>` with a trusted
constructor-injected synthetic actor, the reviewed B4 query, and the existing
all-or-nothing normalizer. Each load snapshots inputs before its first await,
resets transaction state, uses a transaction-local runtime role/context,
normalizes before commit, rolls back on failure, poisons after unsafe reset or
rollback failure, and rejects overlap before SQL.
The dedicated workflow uses an exact random loopback-only port mapping.
PostgreSQL run `32083732063` at commit `8e470e9` exercised one real
SCRAM-authenticated Node client, passed every inherited B1 through B8
regression and the B9 transaction, isolation, failure, and cleanup probes, then
wrote the version 9 success record. The retained record returned
`offline_consistent` against separately supplied anchors. All 450 database
tests, typechecking, static PostgreSQL and migration checks, focused lint/
formatting, and the diff check also passed for the source commit. See the
[B9 evidence note](./POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](./CYCLE_1BB9_EXIT_MATRIX.md).

**Cycle 1b-b10 complete and reviewed for its bounded recorded scope:**
`PooledPostgresFinancialFactProjectionSource` owns one explicitly transferred
real `pg.Pool` bounded to two clients; the caller may not checkout, query,
release, inspect, or otherwise use a client or pool during source ownership.
Only read-only pool counters may be checked after `source.close()` completes.
Every load snapshots its complete query and trusted synthetic actor before
checkout, establishes a clean session,
reimplements the exact B9 read-only role/context/B4-query transaction, and
recycles the checkout only after unambiguous postflight cleanup. Finite pool
acquisition and positive PostgreSQL statement timeouts are required; client
`query_timeout` must be disabled (absent, `0`, or `false`). Active abort marks
cancellation, waits for the
in-flight PostgreSQL operation to settle under the fixed server timeout, and
then destroys the checkout; timeout, failed transaction, and cleanup ambiguity
also prevent reuse. A queued abort remains bounded by acquisition and destroys
any late checkout rather than claiming prompt queue cancellation. `close()`
waits for registered loads and ends the owned pool exactly once. The pinned V10
run passed at commit `2dcb259`, its success-only artifact and log markers were
reviewed, and the downloaded record returned `offline_consistent`. B10 does not
add graceful CancelRequest, reusable canceled-backend, production pool tuning,
load/capacity, retry/failover, application composition, end-user identity,
external TLS, managed secrets, or production-readiness claims. See the
[B10 evidence note](./POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./adr/0022-bounded-postgresql-projection-pool-lifecycle.md), and the
[Cycle 1b-b10 exit matrix](./CYCLE_1BB10_EXIT_MATRIX.md).

The settled local gate passes all 12 database test files and 485 tests, database
typechecking, migration and PostgreSQL static guardrails, focused
ESLint/Prettier, and the diff check. Independent integrated review reports GO
with no P0/P1 finding. Those local results were prerequisites for, not
substitutes for, the separately reviewed live V10 workflow and artifact.

Live reset evidence is deliberately narrower than the fixed source sequence. An
out-of-band administrator may observe only same-PID idle/application/user/
advisory-lock state, followed by a subsequent actor-isolated source load and the
timeout/application-name probes. Custom-GUC and prepared-statement cleanup are
verified by source, unit, and static `DISCARD ALL` checks, not by reaching back
through the transferred pool.

The bounded queue proof likewise avoids pool inspection during ownership: the
configuration fixes `max: 2`, an out-of-band administrator observes two blocked
backend PIDs, and a third source load returns the stable acquisition-timeout
failure.

**Cycle 1b-b11 complete for its bounded scope:**
`PostgresMigrationDeployer` takes a validated immutable snapshot of the exact
closed v2 plan before I/O. Over one exclusively leased authenticated client it
resets transaction/role state, opens one finite-timeout read-write transaction,
takes the reviewed advisory lock, selects the owner capability locally, locks
the exact ledger table, validates service identity/platform/ledger shape, and
accepts only a non-empty exact manifest prefix before applying pending reviewed
bodies and ledger rows. Stable drift refusal covers checksum, filename,
ID/order, ledger-object/shape, interior gaps, and extra rows; an exact missing
tail is the pending suffix. Injected pre-commit failure must
restore the original prefix; a complete ledger returns `current`; ambiguous
cleanup poisons the deployer. The bounded live run reconstructed only the exact
`v2-0005` prefix and overlapped two loopback clients so one applied `v2-0006`
while the other observed current state. PostgreSQL run `32183709701` passed at
commit `5df9d07`; its retained V11 record returned `offline_consistent`. See the
[B11 evidence note](./POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md),
[ADR 0023](./adr/0023-locked-postgresql-migration-ledger-deployment.md), and the
[Cycle 1b-b11 exit matrix](./CYCLE_1BB11_EXIT_MATRIX.md).

V11 preserves V1-V10, adds the exact deployer source hash, and narrows only the
fixed migration nonclaim split. B11 does not prove external/production
credentials, arbitrary or multi-release upgrades, crash recovery,
cancellation, distributed orchestration, global platform/application
atomicity, or production readiness.

Local verification passed 13 database test files with 515 tests, every other
workspace test project, root and database typechecks, migration and PostgreSQL
static guardrails, lint, formatting, production builds, and diff checks. Docker
was unavailable locally, so those results made no live-engine claim. The local
license inventory alone could not enumerate a pre-existing pnpm-store entry for
`@fastify/cors@11.3.0`; the later clean cross-platform CI install and release
gate passed at the tested commit.

**Cycle 1b-b12 complete for its bounded scope:**
the fixed query-plan/load module and deterministic fixture add no caller-selected
SQL, endpoint, planner setting, connection setting, or benchmark input. In a
disposable fixed-name clone, the reviewed run loaded the synthetic fixture, ran
`ANALYZE`, and required the
authenticated forced-RLS B4 fact-as-known and tenant thesis shapes to use
`financial_facts_as_known` and `theses_by_instrument` without disabling
sequential scans or adding an index. A separate privileged synthetic plan is a
reference only, not an application authorization path.

The bounded load source submitted exactly 1,000 fact and 1,000 tenant promises
before one barrier release through a pool fixed at eight clients and a fresh
SCRAM runtime login with connection limit eight. A separately connected
out-of-band administrator observed exactly the first eight runtime workload
backends blocked, then the gate proved every Alpha/Beta result, configured
bounds on pending checkout and workload/plan/seed/`ANALYZE` statements,
source-clone isolation, complete settlement and pool closure, and zero
client/login/backend/clone residue. Cleanup calls are not each independently
cancellable; the workflow's 15-minute job timeout is the outer fail-closed
bound. This is 2,000 queued submissions, not 2,000 connections or 1,000
simultaneous database sessions. See
[the B12 evidence note](./POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./CYCLE_1BB12_EXIT_MATRIX.md).

V12 preserves V1-V11, appends only
`authenticated_rls_indexed_query_plans_and_bounded_2000_read_load`, adds only
`postgresQueryPlanLoadSha256` and `queryPlanLoadFixtureSha256`, retains the V11
tool shape and limitations, and inserts only
`thousand_simultaneous_database_backends_or_connections` at the frozen load
nonclaim position. PostgreSQL run `32230667908` passed at commit `59c4e58`; its
retained V12 record returned `offline_consistent`.

**Cycle 1b-b13 source implemented; live V13 pending:**
policy v1 freezes a synthetic-only technical retention decision with production
admission false. A separate manifest-bound plan creates the exact privacy
capability in `research_cockpit_b13_privacy_retention_test` and applies one
empty-data suffix over the unchanged v2 plan. The suffix introduces tenant
privacy domains, a write-conflicting empty-only deployment barrier, 32-byte
externally derived resource tokens, raw UUID clearing
through a fixed authenticated hard-delete capability, active-to-offboarding
admission closure, bounded online synthetic tenant purge, and bounded expired
audit/idempotency purge.
PostgreSQL cannot verify the external HMAC or operate its key.

V13 preserves V1-V12, retains the exact V12 tools and sources, appends the two
fixed decision/lifecycle checks and six fixed policy/plan/source/fixture hashes,
and requires the commit-bound reviewer to validate every SQL body named by the
privacy manifest. The full V12 limitation list remains, followed by explicit
production legal/DSAR/offboarding/KMS/token-verification/online-and-backup
deletion/populated-cutover/global-proof/real-data nonclaims. See
[ADR 0025](./adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](./CYCLE_1BB13_EXIT_MATRIX.md).

This source milestone is not a live-engine result. No V13 run, artifact hash,
or independent `offline_consistent` review is recorded yet. Even after a
bounded synthetic live pass, production admission will remain blocked pending
external product/privacy/legal approval and the operating controls listed in
ADR 0025. Populated-database backfill and online cutover remain a separate
package-roadmap item.

1. **Cycle 1b-b1 clean bootstrap complete:** seven migrations executed from an
   empty database through the explicitly limited ephemeral superuser, and the
   declared `NOLOGIN` capabilities were exercised through impersonation. The
   bounded b2 target of one authenticated runtime service-account session is
   complete for its reviewed run. At that milestone, distinct migrator,
   test-loader, and backup identities remained separate later gates. B5 now
   closes only the bounded authenticated test-loader gate for its reviewed run.
   B6 adds only a preparatory owner-DDL canary and does not close the migrator
   gate. The reviewed B7 result closes only the bounded container-local clean
   application-migration boundary and does not prove production or incremental
   migration.
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
   evidence. The reviewed B9 result adds one real sequential client, not
   concurrent reads. B10 is limited to two simultaneous synthetic reads. B12
   separately passed 2,000 concurrently submitted reads through at most eight
   runtime workload backends; it does not claim 1,000 simultaneous database
   sessions. If a writer
   capability is added, also test viewer writes, composite-FK attacks,
   idempotency races, and rollback before enabling it elsewhere.
6. **Sequential cleanup complete:** b1 proves transaction-local context clears
   after commit, rollback, and a handled error on one backend. The reviewed B10
   result separately proves bounded acquisition, settlement-before-discard
   active abort, server-timeout recovery, two simultaneous tenant-isolated
   backends, real pooled-connection reuse, idempotent close, and zero observed
   residue for one runner-local pool.
7. **Clean migration/replay/rollback complete:** b1 proves clean bootstrap,
   ledger state, replay refusal, and injected final rollback. B9 separately
   proves reset, rollback, and reuse on one real client. The reviewed B11 run
   separately proves refusal of one exact live ledger checksum drift. The
   reviewed B8 run also proves the
   narrower policy-scoped data-only dump, independently provisioned same-cluster
   restore, post-restore authorization checks, and mandatory cleanup for its
   exact synthetic scope.

Exit gate: all live-database authorization and restore tests pass from a clean checkout. This is a harness restore target, not a production RPO/RTO.

The separate Ubuntu-only acceptance job now exists. Its PostgreSQL server and
`psql`/dump/restore clients come from one exact major/minor/distro image
reference and index digest. The reviewed b2 run passed its bounded
container-local SCRAM rows; the historical b1 run did not satisfy them.
The reviewed b3 run passed its exact authenticated tenant-isolation,
operation-rights, and one-backend prepared matrix and retained the remaining
version 3 limitations. The reviewed b4 run passed the exact driverless
query-to-normalizer path and retained the version 4 limitations. The reviewed
b5 run passed the exact authenticated non-owner fixture-load path and retained
the version 5 nonclaims. The reviewed b6 run passed the preparatory
authenticated owner-DDL canary and retained
`authenticated_migrator_sessions`. The reviewed b7 run passed the bounded
authenticated clean application-migration phase after its separately committed
platform bootstrap and replaced that limitation with the exact external/
production/incremental and global-atomicity nonclaims. The reviewed B8 result
covers its bounded version 8 scope. The reviewed B9 run passed the separate real
single-client read-only adapter boundary. B10's bounded pool lifecycle source is
implemented and locally verified, and its bounded live V10 result is reviewed.
The B11 locked deployer and bounded live V11 result are reviewed. B12's fixed
fact-as-known/tenant plan and 2,000-submission contract and bounded live V12
result are also reviewed.
The B13 technical policy, empty-only plan, token boundary, and V13 evidence
source are implemented, but live V13 execution and review remain pending and
production admission remains blocked.
The row-normalization contract is already frozen; the B4 query and unit contract
provides a reviewed input to B9 without retroactively proving that adapter.

The b1 green-run, bounded b2 runtime-authentication, b3 authenticated
authorization-matrix, b4 driverless query/normalizer, b5 authenticated
test-loader, b6 owner-DDL canary, and b7 authenticated application-migration
milestones are complete for their recorded scopes. B8's authenticated
policy-scoped data-only dump and bounded clean restore are likewise complete
only for the exact version 8 scope. B7, not B6, contains the reviewed
platform/migrator redesign and bounded authenticated migration result. The
reviewed B9 single-client read adapter remains a separate proof from B4
through B8 and from the B10 pool/concurrency milestone.
The historical manifest remains unsuitable for a distinct migrator: on
PostgreSQL 17 a non-superuser `CREATEROLE` migrator receives an administrative
membership edge on a role it creates, while historical migration `0001`
rejects every pre-existing capability-role membership. B7 addresses that
limitation through the distinct v2 platform/application plan without changing
the historical bootstrap; the B6 canary neither executes a migration nor
weakens the zero-membership bootstrap invariant.
The reviewed B8 result permits only a bounded, policy-scoped, synthetic
data-only dump and same-cluster clean-restore claim. It must not be widened into
full-schema/global recovery or a production/DR claim.
The separate B10 live gate now proves only its bounded runner-local
pool/cancellation/concurrency scope. Do not treat B10, B4, B9, the clean-only
impersonated-capability result, or the reviewed b2/b3 container-local
service-account results, including the separate reviewed B5 test-loader result,
as permission to wire the database into the app or accept real data.
The reviewed B11 result similarly remains disconnected and limited to the exact
v2 suffix. It is not a general or production migration system.
The reviewed B12 result is also disconnected. Eight observed runtime workload
backends and 2,000 queued synthetic reads do not establish production capacity,
SLOs, pool tuning/failover, general plan stability, real-data behavior, or
application composition.
The B13 source likewise remains disconnected and synthetic-only. It cannot be
used as production privacy/legal approval, DSAR or legal-hold evidence, KMS/HSM
custody, operating offboarding/retention scheduling, backup or third-party
deletion, populated cutover, global erasure proof, or permission for real data.

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
