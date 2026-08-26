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
independent artifact review are complete for their bounded scope. The B13
technical source contract covers the
privacy/retention decision, empty-only keyed-identifier plan, and V13 evidence
branches. Its pinned live V13 execution and independent
artifact review are complete for their bounded synthetic scope, while
production privacy/legal admission remains blocked. The B14 populated-cutover
source and V14 evidence contract are implemented for one bounded synthetic
pre-`0005` transition. PostgreSQL run `32343225599` at commit
`d688aa21e969feef6611f6efcd1aeaaed6e31df9` and its independent V14 artifact
review are complete for that bounded scope; production admission remains
blocked.

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

**Cycle 1b-b13 complete for its bounded synthetic scope:**
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

PostgreSQL run `32305478242` passed the exact bounded synthetic path at commit
`a959cba`; its retained V13 record returned `offline_consistent`. See the
[B13 evidence note](./POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md). That reviewed
live result does not establish production admission, which remains blocked
pending external product/privacy/legal approval and the operating controls
listed in ADR 0025. B13 itself does not establish populated-database backfill
or online cutover; the separate bounded item 18 result follows without
retroactively widening V13.

**Cycle 1b-b14 bounded live exit complete:**
populated-cutover plan v1 binds the exact v2 `0001`-`0004` plus `0006` base, explicitly excludes
unsafe `0005`, and targets the exact B13 keyed lifecycle. Its two phases create
an audited capture/work registry and bounded authenticated token backfill, then
validate the exact capture epoch and contract under a short final
write-conflicting barrier. The deterministic synthetic gate includes a
post-capture insert and delete, but its test-seed and migrator-to-owner actors
do not model a production application writer. V14 preserves every exact V1
through V13 branch, appends two checks and three top-level source hashes, and
commit-binds the manifest-named platform and two application bodies. See
[the B14 evidence note](./POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](./CYCLE_1BB14_EXIT_MATRIX.md).

B14's reviewed live result is not a general production cutover. It proves only
the exact bounded synthetic sequence in one disposable database and normalized
semantic, not physical, equivalence to the B13 target. It does not prove
uninterrupted writes, application allocation/dual-write gap handling,
production duration/SLO/lock budgets, crash/restart/failover or downgrade
behavior, prepared-transaction/replication concurrency, recovery of identifiers
deleted before capture, external key custody, real-data safety, or production
admission.

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
source are implemented, and its bounded live V13 result and independent review
are complete. Production admission remains blocked.
The B14 populated-cutover plan and V14 evidence source are implemented, and
their bounded live run, retained artifact, and independent review are complete
at commit `d688aa21e969feef6611f6efcd1aeaaed6e31df9`. Production admission
remains blocked.
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
The reviewed B13 result likewise remains disconnected, synthetic-only, and
empty-data-only. It cannot be used as production privacy/legal approval, DSAR
or legal-hold evidence, KMS/HSM custody, operating offboarding/retention
scheduling, backup or third-party deletion, populated cutover, global erasure
proof, or permission for real data.
The reviewed B14 result remains disconnected and synthetic-only. It is live
evidence only for its exact bounded scope and cannot authorize a production
writer, promise continuous zero downtime, cover crash/failover/restart or
production lock budgets, recover pre-capture deletions, establish physical
catalog equivalence, or admit real data.

## Cycle 1c — demo identity and API contract proof

Cycle 1c source now adds exactly two update-only seeded in-memory routes:
`PUT /v1/theses/{thesisId}` and `PUT /v1/alerts/{alertId}`. Both require one
public, non-secret synthetic persona selector, one strong `If-Match`, and one
operation-scoped `Idempotency-Key` over an exact loopback peer boundary.
Organization and principal come only from the fixed resolver, never from a URL,
body, query, or caller authority header. Operation scope includes resource type
and ID, so only same-path key reuse with a changed body or `If-Match` is the
bounded fingerprint-conflict claim. Authorization is re-evaluated before
replay, and a replay after the recorded version is superseded also returns
`409`; another path/resource is a separate scope. The same resolved principal
and organization may therefore use one identical key independently on the
thesis and alert paths, and both valid operations can succeed.

**Cycle 1c bounded source/test status:** Implemented and verified only for the
bounded synthetic loopback source/test contract; not remote/live-engine or
production evidence. The full frozen-byte local release gate and two-OS CI run
`32401541724` passed on exact commit
`84f6b92163e93fa8c5c079a786e49f8134b81f56`. The separate PostgreSQL run
`32401541467` is unchanged V14 regression health only, not Cycle 1c engine
evidence, B15/V15, or a replacement for the canonical B14 result at
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`. The browser-local profile remains
unchanged, the adapter is in memory, and no PostgreSQL or production identity
boundary is connected. The sole bounded claim is
`bounded_loopback_synthetic_persona_thesis_alert_write_contract`; its exact
nonclaims and exact completed verification gates are in
[ADR 0027](./adr/0027-loopback-synthetic-persona-research-state-api.md) and the
[Cycle 1c exit matrix](./CYCLE_1C_EXIT_MATRIX.md). Cycle 1c is not B15 or V15
and does not change B1 through B14 evidence or history. Production OIDC,
external exposure, durable persistence, general API BOLA, production writer
authorization, browser migration, operational load, privacy/legal controls,
and real data remain separate gated work.

## Cycle 2a — bounded synthetic filing-parser isolation gate

Status: the exact frozen-byte local `pnpm verify` gate, dedicated Linux live
acceptance, retained artifact, and independent offline review remain historical
green facts. The prior bounded owned-byte security conclusion is Superseded;
Cycle 2h restores its bounded owned-byte premise only on exact hardened
successor commit `61701307ded7fa77a555e27925ae86670f6b4dc0`. Broader Cycle 2
and production admission remain blocked.

Cycle 2a implements only the parser threat-model precondition: one nonempty,
host-size-eligible bounded synthetic ZIP containing an exact manifest and XML
document enters one new non-root, network-none, read-only, resource-limited
container. Empty and host-oversize inputs quarantine without a worker. A closed worker
returns either an accepted two-sentinel candidate or an atomic value-free
quarantine. The host validates canonical output, signs the exact result and
built image ID with an outside-worker ephemeral Ed25519 key, tests exact-byte
replay/tamper rejection, and requires zero container/staging residue.

The digest-pinned Python 3.12.13 slim-bookworm worker installs no packages and
has no parser plugin seam. A separate success-only filing-parser evidence v1,
dedicated Linux workflow, source/fixture/image hash chain, and offline verifier
do not append PostgreSQL V1 through V14. No upload/API/web/database/queue or
external fetch is added, no real filing is used, and this work is not B15/V15.

The sole reviewed bounded claim is
`bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding`.
Its exact fixed checks, nonclaims, and completed exit rule are recorded in
[ADR 0028](./adr/0028-bounded-synthetic-filing-parser-isolation.md) and the
[Cycle 2a exit matrix](./CYCLE_2A_EXIT_MATRIX.md). The retained run, artifact,
source-chain, and custody anchors are in the
[Cycle 2a evidence note](./FILING_PARSER_ISOLATION_EVIDENCE.md). This bounded
result is not general or production isolation evidence, and production
admission remains blocked.

## Cycle 2b — fixed public-filing candidate-manifest admission

Status: **Phase-A verifier protocol implemented; local and CI jobs remain
historical green facts, but the prior bounded owned-byte security conclusion is
Superseded on those bytes. Cycle 2h restores the bounded owned-byte premise only
on exact hardened successor commit `61701307ded7fa77a555e27925ae86670f6b4dc0`;
Cycle 2b remains Blocked.** There is no real configuration, external filing metadata,
rights/steward approval, key-authority review, Cycle 2b workflow, run, evidence
schema, artifact, or evidence note.

The exact frozen-byte local `pnpm verify` gate passes format, lint, every
guardrail including 86 production-license checks, all project typechecks, all
builds, and 34 test files with 810 tests: DB 18/582, API 4/49, research-state
1/48, contracts 1/5, research-core 2/62, web 2/3, and filing-parser 6/61.
[CI run 32447542432](https://github.com/liangzixuan/investing-pro/actions/runs/32447542432)
passed that gate on Ubuntu and Windows for exact commit
`b9a9edf680b4c3a7373cd6d96210a24544ba0bbe`. The successful concurrent
[Cycle 2a parser run 32447542455](https://github.com/liangzixuan/investing-pro/actions/runs/32447542455)
is regression health only. Neither result supplies the missing external
authority or Cycle 2b evidence.

The side-effect-free `verifyFilingCorpusAdmission` protocol accepts exact bytes
for a future authority-key set, candidate manifest, selection plan,
adjudication protocol, rights approval, steward approval, and binding manifest.
It performs no file, network, parser, database, API, web, queue, or key-service
I/O. A successful future input must contain exactly 100 unique accessions with
content digests and closed filing metadata, freeze selection and adjudication
before results, and carry distinct Ed25519 `rights_authority` and
`data_steward` signatures for purpose
`offline_parser_quality_evaluation_only`. Success exposes only a closed record
of schema/claim/corpus/version/evaluation identifiers, aggregate input hashes,
count, and validity; failure is atomic and value-free.

Each signed approval binds the exact `authorityKeysSha256` for the supplied
validity/revocation registry. A future admitted result proves only internal
schema/signature consistency under those supplied bytes. Human/host review must
compare the registry digest with the reviewed out-of-band anchor; admission is
not itself an authority, counsel, or steward identity decision. The verifier
checks signed timestamp/hash ordering only. Whether parser or adjudication
results existed earlier is externally attested chronology, not machine-proven.

The target claim is
`fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission`.
Phase A does not establish it. The exact external 100-entry inventory,
rights/steward signatures, and human key-authority review are blocking inputs.
After those exist, the full frozen-byte local gate and a separately authorized
success-only live/offline evidence path must still pass before any bounded
promotion. Exact checks, nonclaims, and status are recorded in
[ADR 0029](./adr/0029-fixed-public-filing-candidate-manifest-admission.md) and
the [Cycle 2b exit matrix](./CYCLE_2B_EXIT_MATRIX.md).

Cycle 2b sees no raw filing bytes and cannot validate declared content digests
against payloads. It does not establish counsel identity/legal validity,
revocation freshness, SEC authenticity, representativeness outside the exact
future approved plan, ten-fact normalization, ground truth, 2,000 assertions,
quality, dual-parser independence, fetch security, retention, lineage,
composition, B15/V15, real-data admission, or production readiness.

## Cycle 2c — bounded synthetic filing-payload custody

Status: **the exact-commit local, CI, live, artifact, and review anchors remain
historical green facts at `ef22c7bc10596840b8ff686b9190730956fab0c4`, but the
prior bounded owned-byte security conclusion is Superseded. Cycle 2h's
gates passed only for exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, restoring the bounded owned-byte
premise only on those bytes; Cycle 2b and production admission remain
Blocked.** The final successor-compatible local `pnpm verify` gate
passed format, lint, every guardrail including 86 production-license checks,
all project typechecks and builds, and 39 test files with 848 passed tests plus
2 POSIX-only Windows skips (850 total cases). Two-OS CI run `32463955370`,
dedicated Linux custody run `32463955421`, exact-commit offline review, and
independent retained artifact/log review passed on
`ef22c7bc10596840b8ff686b9190730956fab0c4`. The later local compatibility
result does not replace or widen that canonical live evidence. No real filing
bytes, external configuration, approval, fetch surface, or Cycle 2b
workflow/evidence is added.

Cycle 2c isolates one actionable technical risk without bypassing Cycle 2b. A
zero-dependency package accepts exactly one generated 4,096-byte synthetic
fixture under a 1 MiB protocol limit, takes an owned snapshot, recomputes the
fixed SHA-256, requests a fresh AES-256-GCM key and nonce from an injected
entropy provider, and separates the injected key store from ciphertext and the
closed audit-file domain. The provider is an out-of-band trusted CSPRNG TCB;
source validates only returned byte shape and exact requested length, not
randomness or uniqueness. The dedicated Linux record is limited to
observed Node `crypto.randomBytes` use and distinct DEK-fingerprint and
nonce-hash samples in that run; it cannot establish OS entropy quality. Only
public aggregate audit/error/evidence/log surfaces are value-free. A trusted
host clock applies the fixed 24-hour half-open retention boundary. Expiry
forgets the key, retains the available/terminal audit history, then removes
ciphertext; retry cleanup and repeated expiry remain idempotent. The terminal
state is only `logical_key_unavailability`, never cryptographic erasure.

The sole bounded target claim is
`bounded_synthetic_filing_payload_integrity_custody_and_logical_key_unavailability`.
It passed only for the exact frozen local source, Ubuntu/Windows CI, one
success-only Ubuntu 24.04 lifecycle, canonical source/fixture-bound record,
exact-commit offline review, and retained artifact/log custody. The workflow
retains no candidate artifact on failure.
Exact checks, nonclaims, and status are in
[ADR 0030](./adr/0030-bounded-synthetic-filing-payload-custody.md) and the
[Cycle 2c exit matrix](./CYCLE_2C_EXIT_MATRIX.md); exact run, source, and
custody anchors are in the
[Cycle 2c evidence note](./FILING_PAYLOAD_CUSTODY_EVIDENCE.md).

Cycle 2c has no network, parser, corpus-admission, database, API, web, queue,
production KMS, backup, real-data, or B15/V15 composition. It does not prove
Cycle 2b approval, SEC/source authenticity, real payload presence, physical or
cryptographic erasure, the 100-filing corpus, parser correctness, adjudicated
quality, 2,000 assertions, or production readiness.

## Cycle 2d — bounded synthetic ten-fact normalization and lineage

Status: **local and two-OS CI jobs remain historical green facts for exact
source commit `f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`, but the prior bounded
owned-byte security conclusion is Superseded on those bytes. Cycle 2h restores
the bounded owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`; Cycle 2b and production admission
remain Blocked.**

The exact frozen-byte local gate passed format, lint, every guardrail, all
project typechecks and builds, 86 production-license checks, and 41 test files
with 876 passed plus 2 POSIX-only Windows skips (878 total cases: parser 65;
custody 36 passed plus 2 skipped; normalization 26; DB 582; API 49; state 48;
contracts 5; core 62; web 3). This is local source/test verification only;
CI run `32511008752` passed in Windows job `96861883906` and Ubuntu job
`96861884146`. Parser run/job `32511008497` / `96861883641`, custody run/job
`32511008447` / `96861883543`, and PostgreSQL run/job `32511008417` /
`96861882949` are unchanged regression health on the exact source commit, not
Cycle 2d evidence.

Cycle 2d isolates the next actionable deterministic risk without using a real
filing or bypassing Cycle 2b. The caller gives a separate zero-dependency
package exactly two bounded canonical JSON byte documents matching the closed
synthetic 10-K/10-K/A schema; the boundary immediately takes fresh owned
snapshots before validation. Tests generate the canonical pair, but the
boundary does not authenticate its generator or provenance. Each document carries exactly
the frozen keys `assets`, `cash`, `debt`, `diluted_shares`,
`free_cash_flow`, `gross_profit`, `net_income`, `operating_cash_flow`,
`operating_income`, and `revenue` once.

The closed source contract validates strict decimal strings and key-specific
unit, instant/duration period, and dimension forms; binds accession, form,
entity, source hash, parser, and taxonomy metadata; and derives one acyclic
single-predecessor lineage. Original versions use a half-open known window that
ends at amendment availability; amendment versions begin at that instant.
Changed and unchanged facts remain distinct source versions. The complete pair
normalizes atomically or yields only an empty, value-free quarantine result.

Cycle 2d uses the existing frozen-byte local release suite and Ubuntu/Windows
CI only. It adds no dedicated workflow, evidence schema, artifact, retained
evidence log, offline evidence review, or evidence note. Exact checks,
nonclaims, status, and the history-preservation rule are in
[ADR 0031](./adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
and the [Cycle 2d exit matrix](./CYCLE_2D_EXIT_MATRIX.md).

This contract has no network, raw payload, XML/XBRL parser, custody,
corpus-admission, database, API, web, queue, or B15/V15 composition. It does not
prove Cycle 2b approval, real filing identity or SEC authenticity, general
taxonomy/unit/dimension/fiscal coverage, independent dual validation,
adjudicated quality, 2,000 assertions, full Cycle 2 exit, or production use.

## Cycle 2e — bounded synthetic two-declared-validator fact comparison

Status: **local and two-OS CI jobs remain historical green facts for exact
source commit `60b92aa527435904776144f5e2d5a1a3ab61e67e`, but the prior bounded
owned-byte security conclusion is Superseded on those bytes. Cycle 2h restores
the bounded owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`; Cycle 2b and production admission
remain Blocked.**

The exact frozen bytes pass `corepack pnpm verify`: all format, lint, guardrail,
typecheck, test, and build stages are green with 43 test files, 911 passed plus
2 skipped (913 total), all 11 workspace project checks, and 10 builds.

CI run `32518970387` passed in Ubuntu job `96886795980` and Windows job
`96886796247`. Parser run/job `32518970423` / `96886796118`, custody run/job
`32518970453` / `96886796256`, and PostgreSQL run/job `32518970454` /
`96886796382` passed as unchanged regression health only; they are not Cycle 2e
evidence.

Cycle 2e isolates the next repository-controlled conflict-quarantine risk
without pretending that two modules are two independent parsers. A separate
zero-dependency package accepts exactly two bounded canonical envelopes in
fixed declared-validator A/B argument roles. Each role binds one exact
identifier, version, and implementation digest declaration. Separate strict
modules validate complete same-schema normalized payloads before any comparison
decision.

Each validator independently enforces the exact ten keys, twenty fact versions,
ten one-to-one lineage edges, complete source-preimage fact identities,
metadata, pointer consistency, chronology, and half-open known windows. The
comparison then requires byte-exact equality of the complete canonical
normalized payload. It never substitutes digest or subset equality and never
prefers, merges, reorders, coerces, tolerates, or repairs a report.

Success is an immutable metadata-only agreement receipt. Any invalid upstream
report, quarantine, or byte difference returns empty, value-free aggregate
quarantine with no hashes, validator metadata, mismatch location, values, or
preferred output. Cycle 2e uses only the existing frozen-byte local gate and
Ubuntu/Windows CI; it adds no dedicated workflow, evidence schema, artifact,
offline review, or evidence note.

The two roles are only distinct declarations backed by separate source
implementations in one package/process. Cycle 2e does not prove parser,
implementation, process, host, operator, key, or failure-domain independence;
authenticate identities/digests; validate real filings or accounting truth;
unblock Cycle 2b; satisfy adjudicated quality thresholds; compose B15/V15; or
authorize production use. Exact checks and nonclaims are in
[ADR 0032](./adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
and the [Cycle 2e exit matrix](./CYCLE_2E_EXIT_MATRIX.md).

## Cycle 2f — bounded synthetic declared-reference quality measurement

Status: **the prior bounded source-stage security conclusion for exact source
commit `72e91f502b31f15deeaad761b82d9ed7b6377d39` is Superseded. Historical local
and Ubuntu/Windows jobs were green, but hostile typed-array carriers falsified
the bounded owned-snapshot check. Hardened Cycle 2f bytes were restored under
the Cycle 2g local/two-OS gate at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`, but that restoration is now also
Superseded because a re-prototyped `SharedArrayBuffer` could pass backing
prototype equality without intrinsic `ArrayBuffer` brand validation, and a
re-prototyped alternate typed array could pass carrier prototype equality
without intrinsic `Uint8Array` element-type validation. Cycle 2h
restores the bounded owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, whose local, CI, parser, and custody
gates passed. Cycle 2b, full Cycle 2 quality, and production admission
remain Blocked.**

The historical frozen bytes completed `corepack pnpm verify`: all format, lint,
guardrail, typecheck, test, and build stages were green with 45 test files, 951
passed plus 2 skipped (953 total), all 12 workspace project checks, and 11
builds. The missing hostile-carrier regressions mean those green facts do not
support the bounded security conclusion.

CI run `32681826143` passed in Ubuntu job `97299715600` and Windows job
`97299715638`. Parser run/job `32681826015` / `97299715074`, custody run/job
`32681826030` / `97299715006`, and PostgreSQL run/job `32681826040` /
`97299715107` passed as unchanged regression health only; they are not Cycle 2f
evidence.

On those bytes, shadowable instance `buffer` and `byteLength` properties could
disguise shared or oversized backing, and typed-array `slice` could dispatch a
caller `constructor` / `Symbol.species` hook during snapshot allocation. The
`df1ddff` restoration used intrinsic typed-array backing/length metadata,
backing/carrier prototype equality, direct ordinary `Uint8Array` allocation,
and intrinsic
`set`. The exact local restoration gate and Cycle 2g Ubuntu/Windows CI passed
for `df1ddffdede9900302da34160ce6b9a62b9d1708` as historical green facts; that
restored conclusion remains Superseded as a historical claim. Cycle 2h restores
the bounded owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.

Cycle 2f isolates the next repository-controlled metric-accounting and
threshold-evaluation risk without presenting a declared synthetic reference as
independently adjudicated truth. A separate zero-dependency package accepts
exactly three bounded canonical documents in fixed plan, candidate, and
declared-reference roles and immediately owns their byte snapshots.

The declared reference fixes exactly 100 unique documents and the ten launch
fact coordinates for each document. The evaluator derives semantic
value/presence and exact unit/period assertions for each of the 1,000 fact
targets, accounts for all 2,000 critical assertions, and derives all counts,
denominators, classifications, and metrics. The caller cannot submit metrics,
weights, exclusions, or assertion outcomes.

The candidate contains zero through 100 unique document rows. Its only explicit
row statuses are `succeeded` and `quarantined`; a succeeded row may carry zero
through ten sorted unique known-coordinate facts and is measured incomplete
when facts are omitted, while absence is derived as missing. Each omitted fact
contributes one false negative and two silent assertion failures. Explicit
quarantine is not silent, but it still contributes false negatives, reduces
document success and recall, and increases quarantine rate. A wrong fact
contributes both one false positive and one false negative.

The fixed synthetic-pilot policy requires document success at least `95/100`,
precision and recall at least `99/100`, quarantine rate at most `5/100`, zero
silent critical failures, exact canonical units, and zero-day period tolerance.
Ratios use integer cross-multiplication only. Valid input produces an immutable
aggregate `met` or `not_met` evaluation; malformed input produces only empty,
value-free quarantine. Falling below a threshold is not input quarantine.

The canonical met fixture uses 99 exact succeeded documents and one explicit
quarantine. It records 990 true positives, ten false negatives, zero false
positives, and 1,980 passed assertions while accounting for all 2,000. This is
synthetic arithmetic only. Cycle 2f does not establish adjudicator identity or
independence, blinding, label correctness, real parser quality, approved
production thresholds, Cycle 2b authority, full Cycle 2 exit, B15/V15, or
production use. It creates no dedicated workflow, evidence schema, artifact,
offline review, or evidence note. Exact checks, nonclaims, status, and history
rules are in
[ADR 0033](./adr/0033-bounded-synthetic-declared-reference-quality-measurement.md)
and the [Cycle 2f exit matrix](./CYCLE_2F_EXIT_MATRIX.md).

## Cycle 2g — bounded synthetic declared-reference precommitment

Status: **local integration and two-OS CI at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708` remain historical green facts, but
the Cycle 2g bounded owned-byte security conclusion and the Cycle 2f restoration
are Superseded. A re-prototyped `SharedArrayBuffer` could pass backing prototype
equality, a re-prototyped alternate typed array could pass carrier prototype
equality, and Cycle 2g performed a proxy-sensitive prototype check before
complete intrinsic brand validation. Cycle 2h restores the bounded owned-byte
premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, whose local, CI, parser, and custody
gates passed. Cycle 2b, full Cycle 2 quality, and production admission
remain Blocked.**

Cycle 2g closes only the next repository-controlled prediction-order gap. A
private package with one exact workspace dependency on Cycle 2f creates one
synchronous in-process `commit` / `reveal` protocol instance. Commit owns and
validates the candidate snapshot against the closed 100-document coordinate
space before that instance accepts any declared-reference bytes, preserving
omitted documents and facts for fail-closed evaluation. The candidate
observation binds the exact declared-reference digest commitment but excludes
raw reference bytes/content, caller `producedAt`, metrics, counts, weights,
exclusions, assertion outcomes, and quality results.

The private state machine is `open` to `candidate_committed` to `consumed`.
Every first invalid commit or reveal attempt consumes before validation; a
second commit consumes the pending commitment; and there is no retry,
replacement, reset, or recovery. A successful commit returns aggregate hashes
and counts plus one empty frozen identity-bound same-instance single-use
capability. Serialization does not transfer authority.

Reveal consumes first, recomputes the declared-reference byte digest, requires
the committed digest, derives only the fixed Cycle 2f candidate role and
compatibility time, and delegates to the public Cycle 2f evaluator. It preserves
Cycle 2f's exact population, denominators, classifications, integer ratios, and
fixed synthetic-pilot thresholds. A valid below-threshold result remains
`evaluated` / `not_met`; protocol or delegated-measurement failure is empty
value-free quarantine with zero audit counts and `measurement: null`.

The same exact successor transition closes a hostile typed-array carrier gap in
the public Cycle 2f evaluator as well as the new protocol. Owned snapshots use
intrinsic typed-array backing-buffer and byte-length getters, require an
ordinary `ArrayBuffer`, allocate an ordinary `Uint8Array`, and copy with the
intrinsic typed-array `set`; caller `buffer`, `byteLength`, `constructor`, and
`Symbol.species` properties cannot spoof bounds or receive allocation dispatch.
The original Cycle 2f CI anchors remain historical green gate facts for
`72e91f502b31f15deeaad761b82d9ed7b6377d39` only. They do not attest the
current hardened Cycle 2f bytes. The local restoration gate and Cycle 2g
two-OS CI gate historically passed at
`df1ddffdede9900302da34160ce6b9a62b9d1708`, historically restoring the
hardened claim for those bytes. That restoration and the Cycle 2g conclusion
are now Superseded; the original `72e91f5` conclusion remains Superseded.

The exact final pre-promotion local source gate passed formatting, full ESLint,
all guardrails, the production-license check across 86 versions, every scripted
typecheck/test/build across 12 of 13 workspace projects, and the boundary
verifier. All 47 test files completed with 987 passed plus two skipped (989
total): Cycle 2f had 39 passed, Cycle 2g had 29, database had 582, parser had 70,
and custody had 41 passed plus two skipped. CI run `32690685837` passed in
Ubuntu job `97323672725` and Windows job `97323672813`. Parser run/job
`32690685841` / `97323672800`, custody run/job `32690685846` / `97323672628`,
and PostgreSQL run/job `32690685829` / `97323672631` passed as unchanged
regression health only; they are not Cycle 2g or Cycle 2f restoration evidence.

This can prove only owned candidate bytes, exact reference-digest
non-substitution, one-shot instance ordering, instance-bound capability use,
and exact Cycle 2f delegation. It cannot prove that the caller lacked the
reference through another channel, digest hiding or label secrecy, external or
durable chronology, cross-process enforcement, independent adjudication, real
parser quality, Cycle 2b authority, full Cycle 2 exit, B15/V15, or production
use. It creates no dedicated workflow, evidence schema, artifact, offline
review, or evidence note. Exact checks, nonclaims, status, and history rules are
in
[ADR 0034](./adr/0034-bounded-synthetic-declared-reference-precommitment.md)
and the [Cycle 2g exit matrix](./CYCLE_2G_EXIT_MATRIX.md).

## Cycle 2h — cross-boundary intrinsic byte-snapshot hardening

Status: **Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. Its exact frozen-byte local gate,
Ubuntu/Windows CI, parser live acceptance, and custody live acceptance passed.
The historical Cycle 2a through Cycle 2g bounded owned-byte conclusions on
their original bytes remain Superseded; their bounded owned-byte premises are
restored only on this exact hardened successor. Cycle 2b, full Cycle 2 quality,
and production admission remain Blocked.**

Cycle 2h closes one repeated repository-controlled carrier gap across every
public or injected `Uint8Array` ingress owned by Cycle 2a through Cycle 2g: the
parser archive, injected signer signature output, and create/start/remove/residue
process-runner stdout/stderr; seven admission documents; custody staging
payload, five semantic entropy results, and key-store reads/writes; two normalization documents; two validator
reports; three quality-measurement documents; and three quality-precommitment
documents. Each path first invokes intrinsic typed-array backing-buffer,
byte-length, and `%TypedArray%.prototype[Symbol.toStringTag]` getters, then
requires intrinsic element type `Uint8Array` plus exact
`Uint8Array.prototype`, brand-checks actual `ArrayBuffer` internal slots, and
requires exact `ArrayBuffer.prototype`. The actual
internal length is checked against the role contract—including exact 64-byte
signatures and each process request's stream limits—before owned-snapshot allocation. Accepted input is copied into a directly allocated
ordinary `Uint8Array` by intrinsic `set.call`, without caller `buffer`,
`byteLength`, iterator, constructor, species, accessor, proxy, or instance
method dispatch.

Cycle 2a preserves the existing signed quarantine for an exact oversized
carrier by synchronously hashing it without allocating a second archive-sized
buffer and returning `archive_limit_exceeded` without starting the worker. All
Cycle 2a–2g coarse invalid-input, document/report-invalid, hash-mismatch,
empty-quarantine, and value-free diagnostic mappings remain unchanged. Focused
tests cover metadata shadows, accessors, iterators, constructors, species,
instance methods, shared or oversized backing, re-prototyped alternate typed
arrays, subclasses, detached buffers, proxies, and post-call mutation across
every affected role.

The sole bounded target claim is
`bounded_synthetic_cycle2_public_uint8array_ingress_intrinsic_backing_and_length_validation_owned_copy_and_no_caller_metadata_iterator_or_allocation_dispatch`.
It is Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. CI run `32757171049` passed in
Ubuntu job `97527284364` and Windows job `97527284624`; parser
run/job/artifact `32757171096` / `97527284903` / `9531335028` and custody
run/job/artifact `32757171127` / `97527284597` / `9531290999` passed runtime
acceptance and exact-commit review. Every run was attempt 1. Parser and custody
are regression/historical-boundary acceptance anchors only, not a new Cycle 2h
evidence domain.

The transition is exactly 40 paths (38 modified and two added) from
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`, leaving exactly 82 cumulative
unique Cycle 2c paths because the eight additional Cycle 2f/Cycle 2g paths
already exist in cumulative history. The existing historical custody fixture
manifest is the additional transition path and adds no new union path; it
refreshes only the two changed custody source/test SHA-256 entries, while
fixture cases, schema, order, and payload identity/content remain unchanged.
Cycle 2g's historical transition remains exactly 32 paths (23 modified and nine
added) and 73 cumulative unique paths. The one intervening
`packages/db/tests/postgres-acceptance-evidence-review.test.ts` maintenance
path raises pre-Cycle 2h cumulative history to 74; it is pinned history, not
evidence. Canonical Cycle 2a/Cycle 2c schemas, artifacts, notes, checks,
nonclaims, and source sets remain unchanged. Cycle 2f's original `72e91f5`
conclusion remains Superseded; its restored bounded claim and Cycle 2g's claim
at `df1ddff` remain Superseded historical claims because prototype equality admitted
re-prototyped shared backing and alternate typed-array element types. Their non-carrier schemas,
checks, nonclaims, arithmetic, state, capability, delegation, historical
anchors, and no-evidence status remain unchanged.
Their bounded owned-byte premises are restored only on exact hardened successor
commit `61701307ded7fa77a555e27925ae86670f6b4dc0`.

Baseline CI run `32695006904` passed in Ubuntu job `97335364409` and Windows job
`97335364324`; PostgreSQL run/job `32695006890` / `97335364246` also passed.
They are historical baseline health only. Parser run/job `32695006897` /
`97335364268` and custody run/job `32695006869` / `97335364131` passed their
source/test stages but failed exactly at `commit_boundary` on the already-pinned
unrelated database history path. No runtime acceptance occurred, and no
baseline run is Cycle 2h evidence.

Cycle 2h adds no package, dependency, workflow, new evidence schema,
new/dedicated/live evidence artifact, evidence note, external data, or
composition. The refreshed existing local custody manifest is a
fixture-integrity anchor, not new live evidence. Cycle 2h cannot establish primordial
hardening, caller-process isolation, real source authenticity, Cycle 2b
authority, parser/validator independence, adjudicated real quality, durable
precommitment, network safety, production custody/KMS, full Cycle 2 exit,
B15/V15, real-data admission, or production use. Exact checks, nonclaims, and
the promotion rule are in
[ADR 0035](./adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md) and
the [Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md).

## Cycle 2i — bounded synthetic authenticated parser-normalization handoff

Status: **implementation and promotion are Pass only for exact source commit
`5a1589ede57e00d6ff60521e7b53bea2ac849b0a` from exact baseline
`dda2ecafc70aa6c4859a29cb312849bac5dec253`. The transition is exactly 21 paths
(9 added, 12 modified), and the frozen local gate plus Ubuntu/Windows CI run
`32817294734` passed. Cycle 2b, full Cycle 2 quality, real-data admission, and
production remain Blocked.**

Cycle 2i closes the highest-priority provenance-preserving schema-interface
gap between the historical Cycle 2a signed-parser shape and the historical
Cycle 2d normalizer. The private
`@research-cockpit/filing-parser-normalization-handoff` package accepts exactly
two raw synthetic archives and two canonical Ed25519-signed complete ten-fact
parser-result envelopes with distinct original/amendment roles. It owns and
bounds archive, envelope, and supplied public-key bytes; verifies canonical
JSON, domain-separated signatures, supplied key/image expectations, and
recomputed archive SHA-256 bindings; and admits no missing, duplicate,
defaulted, inferred, repaired, or silently remapped fact.
It introduces a parallel complete-result protocol; it does not consume,
translate, or widen Cycle 2a's historical two-fact v1 result, which fails this
contract.

The boundary canonicalizes the embedded documents while parsing the closed
signed envelopes. After carrier, envelope, signature, key/image, and
raw-archive binding checks pass, it delegates those exact original/amendment
bytes unchanged to `normalizeSyntheticFilingFactPair`. Cycle 2d validates the
closed roles, facts, metadata, and pair during delegation; only a downstream
`normalized` result succeeds. Success exposes the immutable normalized record
plus aggregate handoff provenance. Invalid input or provenance, a
partial fact set, substitution, mutation, dependency error, or downstream
Cycle 2d quarantine produces one empty value-free quarantine with no values,
hashes, provenance identifiers, mismatch details, or canary content.

The sole bounded target claim is
`bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff`.
It proves only internal cryptographic consistency under the supplied key/image
expectations, exact archive-digest binding, complete closed synthetic
ten-fact documents, and exact Cycle 2d delegation. It does not prove actual
parser or container execution, extraction/accounting correctness, key or image
authority, signed-document derivation from archive content beyond the digest
assertion, real filing authenticity, Cycle 2b inputs or approvals, independent
validation, adjudicated ground truth, real quality, or production.

Cycle 2i uses the full frozen-byte local release gate and the existing
Ubuntu/Windows CI matrix only. It creates no dedicated workflow, evidence
schema, evidence artifact, offline review, or evidence note. The local gate
passed 49 test files with 1,064 passed and 3 skipped (1,067 total cases). CI run
`32817294734` passed in Ubuntu job `97708048290` and Windows job `97708048027`.
Parser run/job `32817294720` / `97708047987`, custody run/job `32817294732` /
`97708048009`, and PostgreSQL run/job `32817294741` / `97708049006` passed as
regression health only. Historical Cycle 2a and Cycle 2d evidence remains immutable. Exact
checks, nonclaims, and the promotion rule are in
[ADR 0036](./adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
and the [Cycle 2i exit matrix](./CYCLE_2I_EXIT_MATRIX.md).

## Cycle 2j — bounded synthetic ten-fact parser execution to normalization

Status: **Pass only for exact source commit
`b2c7a28c2c5720253eba275b65d3313b114c3bc4` from exact baseline
`f17bacc6adc46851e182d260d59830652f1953bb`. The exact 44-path transition,
1,095-pass local gate, all exact-source workflows, dedicated live execution,
retained artifact, and 51-of-51 `offline_consistent` review passed. Cycle 2b,
full Cycle 2 quality, real-data admission, and production remain Blocked.**

Cycle 2j isolates the next repository-controlled execution gap without widening
Cycle 2a's frozen two-fact v1 protocol. One source-controlled synthetic original
archive and one amendment archive execute in separate fresh, digest-pinned,
network-disabled, bounded Python 3.12 workers. The host validates one exact
complete Cycle 2d ten-fact document from each worker, recomputes each archive
digest, signs the complete envelopes outside the workers, and delegates the
exact archive/envelope bytes without repair or remapping to the unchanged Cycle
2i handoff. Success is one immutable normalized pair with aggregate execution
provenance; every stage failure is one empty value-free quarantine.

The sole bounded target claim is
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`.
The transition contains 31 additions and 13 modifications with no rename or
deletion. CI run `32897837955`, parser run `32898633916`, custody run
`32897838012`, PostgreSQL run `32898674640`, and dedicated run/job
`32897837981` / `97964475815` passed on the exact source commit. Artifact
`9581921300` binds the exact commit, image, 51 source hashes, 3 cases, 16
checks, and 16 nonclaims; the independently anchored canonical evidence digest
returned `offline_consistent`.

Cycle 2j does not establish real SEC bytes or authenticity, counsel/rights/
steward/key authority, general XBRL/iXBRL or accounting correctness, an
independent second engine, adjudicated ground truth, real quality thresholds,
custody or retention operations, application/database/queue composition,
B15/V15, full Cycle 2 exit, real-data admission, or production. Exact checks,
nonclaims, and the exact promotion boundary are in
[ADR 0037](./adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
and the [Cycle 2j exit matrix](./CYCLE_2J_EXIT_MATRIX.md).

## Cycle 2k — bounded synthetic cross-engine parser execution agreement

Status: **Superseded security conclusion.** Exact source commit
`54908db1ded8193ac4ade7a3d6f38505c6b4b8e5` from exact baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, its five-commit 44-path
transition, local and exact-source gates, dedicated live execution, retained
artifact, and 66-of-66 `offline_consistent` review remain immutable historical
facts. They no longer support the bounded Cycle 2k security conclusion or
claim.

Cycle 2k attempted to close one narrow repository-controlled agreement gap. The
existing Cycle 2j Python worker and one distinct zero-install pinned Node worker execute
the same owned synthetic original/amendment pair. Each fixed role must produce
byte-exact equal complete canonical stdout documents, and both complete engine
pairs must produce byte-exact equal Cycle 2d normalization records through the
unchanged normalization path. Any disagreement or failure returns one atomic,
empty, value-free quarantine. The historical sole bounded claim was
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`.
That claim is Superseded because the boundary could accept cached valid child
receipts produced for unrelated archives while outward provenance named the
current invocation's archives. It also accepted identical common-mode lineage
mutations when both engines agreed, without proving per-key reciprocal lineage.

The exact chain ends at `54908db1ded8193ac4ade7a3d6f38505c6b4b8e5` after all
four failed revisions and freezes 44 paths (31 additions, 13 modifications).
CI run `32917019994`, normalization run `32917020011`, custody run
`32917020028`, isolation run `32917019995`, PostgreSQL run `32917043346`, and
dedicated run/job `32917020041` / `98022742591` passed on the exact source.
Retained artifact `9588542275` binds both engines, 66 source hashes, four live
outcomes, 16 checks, and 16 nonclaims; independently anchored review returned
`offline_consistent`. The four earlier failed runs remain historical
non-evidence with zero artifacts. Historical evidence, schemas, checks,
nonclaims, source sets, artifacts, and run anchors remain immutable;
regressions cannot be relabeled as Cycle 2k evidence.

Distinct language, source, image, and process identities do not prove true
organizational, operator, key, host, or failure-domain independence. Cycle 2k
also cannot establish general parser/accounting correctness, real SEC/source
authority, Cycle 2b approval, independently adjudicated real quality, real-data
admission, full Cycle 2 exit, or production. Cycle 2b remains externally
Blocked on the exact 100-entry inventory, rights/steward approvals, chronology,
authority keys, and human review. Exact gates and nonclaims are in
[ADR 0038](./adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
and the [Cycle 2k exit matrix](./CYCLE_2K_EXIT_MATRIX.md).

## Cycle 2l — current-input and reciprocal-lineage cross-engine agreement

Status: **Pending from exact baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. No successor source commit,
workflow run, job, artifact, artifact digest, evidence digest, or offline-review
result is promoted yet.**

Cycle 2l hardens the existing bounded cross-engine boundary before any quality
composition. Its sole target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`.
Agreement requires each child normalization receipt and each fact to bind to the
current invocation's exact original or amendment archive and correct top-level
document role. The host recomputes child pair and execution bindings from those
current inputs, exact normalization document hashes, the configured image, and
the receipt-declared key/public-key context rather than trusting supplied
receipt hashes.

The complete agreed payload must contain the fixed 20-fact partition: ten
original facts followed by ten amendment facts in frozen key order. Each key's
original and amendment versions must form one reciprocal predecessor/successor
edge with matching endpoints and effective time, strict accepted-before-
available chronology, canonical decimal spelling, fixed concept/unit/period
context, duration start strictly before end, one common period end and
duration-fact start across both roles, accession-year and shared ten-digit issuer-segment
consistency, and both changed and unchanged amendment outcomes represented. Any
failure returns one atomic, empty, value-free quarantine.

The v2 live matrix contains six cases: one exact archive-bound agreed pair and
five quarantines for cached child-receipt replay under different archives,
identical common-mode lineage mutation, cross-engine normalization mismatch,
archive tamper, and original/amendment role swap. Promotion additionally
requires one exact single-parent direct child of the baseline, the exact-source
local and workflow gates, a success-only retained v2 artifact, and independently
anchored offline review. Injected boundary and receipt authenticity and fresh
engine execution remain nonclaims. Independent real quality, representative
real filings, Cycle 2b authority, B15/V15, full Cycle 2 exit, real-data admission,
and production remain Blocked; quality
composition is deferred. Exact gates and nonclaims are in
[ADR 0039](./adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md)
and the [Cycle 2l exit matrix](./CYCLE_2L_EXIT_MATRIX.md).

## Cycle 2 — filing ingestion proof

Target: 3–4 weeks after the parser threat-model gate is implemented.

1. Build a sandboxed Python 3.12 worker boundary and a fixed, counsel-approved public-filing corpus.
2. Preserve raw payload and audit metadata in separate retention domains; support payload deletion/crypto-erasure.
3. Normalize ten launch facts with source accession, accepted/available time, parser version, taxonomy, unit, dimensions, and supersession lineage.
4. Compare two independent parsers/validators, quarantine conflicts, and forbid silent repair.
5. Measure document success, fact precision/recall, unit/date tolerance, silent-failure rate, and quarantine rate against independently adjudicated ground truth.

Exit gate: at least 100 representative filings and 2,000 critical assertions meet the frozen quality thresholds with zero silent critical failures.

Neither historical Cycle 2a, Phase-A Cycle 2b, historical Cycle 2c, historical
Cycle 2d/Cycle 2e, Superseded Cycle 2f/Cycle 2g, bounded source-stage Cycle 2h
at exact commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, promoted source-stage
Cycle 2i, promoted bounded synthetic Cycle 2j, Superseded Cycle 2k, nor Pending
Cycle 2l satisfies this exit gate. Cycle 2i does not establish that a parser
executed or correctly derived its signed documents; Cycle 2j establishes only
the exact reviewed synthetic pair and cannot admit real filings. Real payload bytes and digest
validation, approved corpus inputs, real ten-fact coverage, truly independent
validation, independently adjudicated precision/recall, general XBRL/iXBRL and
taxonomy/plugin support, correction lineage, production operations, and
real-data admission remain pending.

## Cycle 3 — product breadth

Only after executed display/derived/alert/export rights and 10K/100K-user cost models exist:

- expand from 10 to 30 versioned common-stock metrics;
- add a typed screener/query engine and saved views;
- persist thesis/watchlist data behind tenant authorization;
- add one production alert channel with delivery receipts and duplicate monitoring; and
- run paid-beta accessibility, performance, restore, incident-correction, and operational-readiness gates.

ETF accounting, portfolio performance, broad calendars, generative AI, broker connections, and multi-channel alerts remain deferred.
