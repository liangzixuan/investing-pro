# Build roadmap after Sprint 0

Active filing-corpus profile: `personal_single_user_local`. The current project
has one owner, runs locally, has no tenants or customers, is noncommercial,
does not redistribute filing payloads, and is not a production service.
Enterprise approvals, multi-user controls, B15/V15, and production readiness
are Out of scope for this profile. They return as gates if the profile widens.

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

Status: **Pass only for exact source commit
`2e3a7e33a76d19b993375958aff671707a81ef05`, the exact single-parent corrective
child of failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f`
from baseline `b9b7dd19996f0c5bb1e073ab5522c42e06dee397`.**

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
archive tamper, and original/amendment role swap. Dedicated run/job
`33011584084` / `98318943081` failed at `evidence_validation_transition` before
artifact retention on failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f`.
Custody run/job `33011584059` / `98318941993` and parser-isolation run/job
`33011584060` / `98318941736` failed at `commit_boundary`; both are regression
non-evidence. All three failed runs retained zero artifacts. The promoted exact
source completes the required two-commit and two-first-parent chain, with 23
cumulative transition paths and 14 paths in the corrective commit. Full local
`pnpm verify` passed, including 51 acceptance tests. Source CI run `33013464811`
passed Ubuntu job `98325467206` and Windows job `98325467249`. Dedicated run/job
`33013464847` / `98325467722` retained artifact `9623531283`, named
`filing-parser-cross-engine-execution-evidence-v2-2e3a7e33a76d19b993375958aff671707a81ef05-1`,
size 7,581 bytes, with ZIP digest
`sha256:bfd3eb2fabdba8b533cbbcd488fe9decd19f47cd4d73c408ac824a87717aaed8`
and canonical evidence digest
`sha256:c1d4d7c6c77bd5aa0a9a0af5de08fbbf3b823744b9cba47e3a59283dfd41f6d8`.
The artifact binds 66 source hashes, 23 transition paths, 16 ordered checks, 16
ordered nonclaims, and six outcomes (one agreed and five quarantined); the
independent review returned `offline_consistent` for all 66 source hashes.
Injected boundary and receipt authenticity and fresh engine execution remain
nonclaims. Independent real quality, representative real filings, Cycle 2b
authority, B15/V15, full Cycle 2 exit, real-data admission, and production
remain Blocked; quality composition is deferred. Exact gates and nonclaims are in
[ADR 0039](./adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md)
and the [Cycle 2l exit matrix](./CYCLE_2L_EXIT_MATRIX.md).

## Cycle 2m — source-owned direct-Docker lifecycle-bound agreement

Status: **Pass only for exact source commit
`5d61868e6075865b32640ddaceb845ac9dbc69f3`, the exact single-parent child of
baseline `1cb7d3ce024cbd29665af7ec4e010da0c380b726`.**

Cycle 2m closes only the next repository-controlled execution-lifecycle gap.
Its sole target claim is
`bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding`.
Public configuration exposes only sealed engine descriptors. The package owns
the audited direct-Docker runners and an internal ephemeral Ed25519 signer.
Each invocation performs exactly four fresh create/start/attach/remove
lifecycles, verify removal and zero container residue, and bind the lifecycle
receipts with the Cycle 2l agreement, normalization record, and key context into
one distinct invocation binding. Repeating the same inputs must produce
byte-identical normalization while yielding eight unique container-ID digests
and distinct lifecycle and invocation hashes. Any failure returns one atomic,
empty, value-free quarantine.

Full local verification passed, including 27 core Vitest tests, 10 worker tests,
and 50 of 50 acceptance tests. Exact-source CI run `33022797756` passed Ubuntu
job `98356972324` and Windows job `98356973090`. Dedicated run/job
`33022797708` / `98356972412` retained artifact `9627207288`, named
`filing-parser-cross-engine-execution-evidence-v3-5d61868e6075865b32640ddaceb845ac9dbc69f3-1`,
size 8,858 bytes. Its ZIP digest is
`sha256:dfd56f1564a55f1c37fc6f0fdab33e390f5530662b96107c47602e03008ecd9b`;
the 32,961-byte canonical evidence digest is
`sha256:25dfd0dd5c36d24656de9eda85a34940a40f50e11cd02535bae1fb8f24c05c6e`.
The version 3, schema `3.0.0` evidence has status `passed` and binds 71 source
hashes, 24 transition paths, 16 ordered checks, 16 ordered nonclaims, and six
outcomes: one agreed and five quarantined. The repeated agreed case preserves
byte-identical normalization while producing distinct lifecycle and invocation
bindings, eight receipts, eight unique container-ID digests, eight unique
lifecycle-binding hashes, and the exact Python-original, Python-amendment,
Node-original, Node-amendment role partition twice. Independent review returned
`offline_consistent`.

Source-triggered parser-isolation run `33022798055` and custody run
`33022797729` failed only at their legacy commit-boundary routing and retained
zero artifacts, so they remain non-evidence. Exact five-file maintenance child
`1860bb367afdb6d725e41880ebb121dda4a04f39` restored that historical routing
without replacing or reminting the v3 evidence. Custody run/job `33024664186` /
`98363073966`, parser-isolation run/job `33024664197` / `98363074166`, and CI run
`33024664292` with Ubuntu job `98363074101` and Windows job `98363074221` all
passed. Dedicated bridge run/job `33024664259` / `98363074109` passed while
retaining zero artifacts, as required. Cycle 2l v2 and Cycle 2k v1 evidence
remain immutable historical facts.

Docker daemon, host, kernel, and container-ID authenticity; worker-image supply
chain or attestation; semantic proof that workers contain no nonce or cache;
external signer identity, KMS, or HSM custody; real parser quality; Cycle 2b
authority; 100 representative real filings or 2,000 adjudicated assertions;
B15/V15; real-data admission; and production remain nonclaims or Blocked.
Quality composition remains deferred because lifecycle freshness and
source-owned execution must be established before synthetic metrics consume
the execution result. Cycle 2b cannot be manufactured from repository-owned
synthetic manifests, authority keys, approvals, clocks, or human-review claims.
Exact checks and nonclaims are in
[ADR 0040](./adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md)
and the [Cycle 2m exit matrix](./CYCLE_2M_EXIT_MATRIX.md).

## Cycle 2n — source-owned execution to fixed-population quality composition

Status: **Promoted only for exact source commit
`1d7dee56c66c1ad0f5d612603567adf2589e0930`, the direct single-parent child of
frozen baseline `09e76235b5683427f2dd3201aefa740bb5adb16e`.** Full local
verification, every exact-source workflow, canonical version 4 evidence,
artifact inspection, and independent offline review passed.

Cycle 2n closes the next repository-controlled composition gap without widening
the population or quality claim. A new package-owned protocol accepts only
sealed Cycle 2m engine descriptors, the frozen Cycle 2f plan, a predeclared
reference digest, and the exact original/amendment archives. It owns Cycle 2m
execution, reserves one-shot state before its first `await`, and provides no
public boundary, runner, signer, execution-result, candidate, measurement,
callback, or options injection surface.

The complete ten original facts map exactly once to
`synthetic-filing-0001`; the complete ten amendment facts map exactly once to
`synthetic-filing-0002`. Each coordinate is separately bound to the actual
source archive, source document, role, lifecycle, and observation; the outer
composition binds the complete source invocation. Coordinates 0003 through
0100 remain missing. Internally derived candidate
bytes pass through unchanged Cycle 2g precommit/reveal and unchanged Cycle 2f
fixed-denominator measurement.

The expected honest result is protocol status `evaluated` and threshold outcome
`not_met`: 2 succeeded and 98 missing documents; 20 emitted/true-positive and
980 missing/false-negative facts; zero false positives or mismatches; and 1,960
silent failures. Precision `20/20` and quarantine rate `0/100` pass, while
document success `2/100`, recall `20/1000`, and maximum silent failures fail.
Any invalid path returns one atomic empty value-free quarantine.

Full local verification passed with 1,232 passed tests and 4 intentional skips.
Exact-source CI run/job anchors were `33036093870` / Ubuntu `98398983676` /
Windows `98398983801`; parser-isolation `33036093898` / `98398983760`, custody
`33036093896` / `98398983789`, normalization `33036093852` / `98398983588`,
PostgreSQL `33036093864` / `98398983520`, dedicated v4 `33036093863` /
`98398989554`, and Dependabot dynamic scan `33036162143` / `98399193694` all
reached terminal green. The dedicated run retained
10,765-byte artifact `9632073116`, named
`filing-parser-cross-engine-execution-evidence-v4-1d7dee56c66c1ad0f5d612603567adf2589e0930-1`.
Its ZIP digest is
`sha256:12c5d5aeca103d693b5c0b761eb16a5ed5af24cc55402f4a6d7c976b994a3522`;
the 38,827-byte canonical version `4` / schema `4.0.0` evidence digest is
`sha256:4fdbb860468413929968c56cf72037a0f72b65669b3ae9c46844476bddf12c5c`.
The record binds `sourceCount: 95`, `transitionPathCount: 34`, all 16 ordered
checks, all 16 ordered nonclaims, and six outcomes: one `evaluated_not_met` and
five `quarantined`. Runtime counts are four composition commits, three quality
evaluations, 16 successful lifecycle receipts, four two-document observation
pairs, and zero residue. Independent review returned `offline_consistent`.
Versions 1 through 3 remain immutable history. This result does not establish
representative real filings, independently adjudicated truth, real quality,
Cycle 2b authority, B15/V15, real-data admission, full Cycle 2 exit, or
production. Exact gates are in
[ADR 0041](./adr/0041-bounded-synthetic-source-owned-quality-composition.md)
and the [Cycle 2n exit matrix](./CYCLE_2N_EXIT_MATRIX.md).

## Cycle 2o — exact parser-archive custody to quality composition

Status: **Pass only for exact promoted revision
`472cc10b8df90bee01925b2efd4fbcb614d7590c`, the exact corrective child of
source precursor `46408ec875755ef531c124846143e9b619c1961f` from frozen
baseline `711fe866594d5e20a657a24c0a0c72fd78ab90be`.** The result remains
`evaluated/not_met`; Cycle 2b authority, real quality, B15/V15, real-data
admission, full Cycle 2 exit, and production remain Blocked.

Cycle 2o closes the bounded repository-controlled disconnect between the exact
parser archives and Cycle 2n. A package-owned outer protocol stages the fixed
2,306-byte original and 2,330-byte amendment synthetic archives as separate
role-bound AES-256-GCM records with fresh keys and nonces, atomically publishes
their ciphertext and closed audit records, authenticates exact readback, and
passes only owned readback snapshots into a fresh unchanged Cycle 2n
protocol. It must reserve one-shot state before validation or I/O and expose no
public injection seam for custody/execution boundaries, clocks, entropy, keys,
nonces, paths, digests, receipts, readbacks, results, callbacks, or options.
Its sole claim is
`bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding`.

The outer commitment/evaluation must bind both custody receipts and their pair
binding, the internally derived source context, and the complete Cycle 2n
commitment/evaluation. Tamper, role swap, key loss, audit/ciphertext drift,
partial publication, concurrency, replay, or cleanup failure must return one
atomic empty value-free quarantine with no accepted residue. Same inputs keep
archive, normalization, candidate, and measurement identities stable while
fresh custody material, Docker lifecycles, and outer bindings remain distinct.

Cycle 2o is not allowed to change the quality population or outcome. The exact
successful accounting remains `evaluated/not_met`: 2 succeeded and 98 missing
documents; 20 emitted/true-positive and 980 missing/false-negative facts; and
1,960 silent critical failures. All exact Cycle 2n nonclaims remain frozen.
They remain the ordered prefix and six custody-specific limitations are
appended. This temporary encrypted round trip is not real filing custody, durable
retention, scheduled expiry, physical or cryptographic erasure, backup
deletion, crash recovery, trusted host entropy, external authority,
representativeness, or real quality.

Full local verification passed 1,295 tests with 4 intentional skips. All five
triggered workflows reached terminal green: CI run `33060480830` passed Ubuntu
job `98477727410` and Windows job `98477727517`; parser isolation run/job
`33060480816` / `98477727240`, payload custody `33060480845` / `98477727017`,
normalization execution `33060480837` / `98477728031`, and dedicated version 5
`33060480847` / `98477728062` passed. No separate PostgreSQL workflow was
triggered by the exact 14-path corrective transition.

The dedicated run retained 12,449-byte artifact `9641519947`, named
`filing-parser-cross-engine-execution-evidence-v5-472cc10b8df90bee01925b2efd4fbcb614d7590c-1`,
with ZIP digest
`sha256:82916aa3b53112b8cc29b0e3bc5e575213757ca70a7d623a87d0167c89ecf419`.
The 45,312-byte canonical version `5` / schema `5.0.0` record has digest
`sha256:1f53136f1811b19de0ba63ae1c1ec6d70cf2d5f86f578214e884069d137e5581`,
binds 105 source hashes and the exact cumulative 39-path transition, and
returned `offline_consistent` under independently anchored review. Versions 1
through 4 and failed-run history remain immutable.

The separate P1 validity correction is now promoted only through Cycle 2p. It
is not Cycle 2o evidence and does not change Cycle 2o's claim, version 5
artifact, or historical anchors. Exact gates and nonclaims are in
[ADR 0042](./adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md)
and the [Cycle 2o exit matrix](./CYCLE_2O_EXIT_MATRIX.md).

## Cycle 2p — Phase-A admission-validity corrective-chain promotion

Status: **Pass only for exact promoted revision
`d642e534b8911b58a32d50f8dfb976ae2900cadc`, the exact corrective child of
source `bc4b371784711102462ad28a9c9eb7cb567f1072` from frozen documentation
baseline `e21408acf70a28909136cc3eb0c10bbbd48b8266`. Cycle 2b remains
Blocked.**

Cycle 2p closes only repository-controlled validity semantics and exact
evidence routing for the Phase-A corpus-admission verifier. The immutable
implementation blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`, introduced on
the exact historical `7243f16` → `96b0426` → `711fe86` chain, caps each
approval at any earlier supplied scheduled revocation and publishes the
earliest effective end across the rights and steward roles as `validUntil`.
Evaluation at or after that cutoff fails closed.

Both independent evidence verifiers and the cross-engine workflow now classify
Cycle 2p before Cycle 2o. They admit only the exact six-path source or one exact
eight-path corrective child; the cumulative transition has nine paths. Any
other intersection with those paths or the immutable corpus-admission source
fails closed. The baseline-to-source, source-to-corrective, and cumulative NUL
records contain 12, 16, and 18 fields with respective digests
`sha256:50f2ea0f8c6050a7e126955f959eb1249a535861280c6002b5b4c84323d5d2dd`,
`sha256:79ab5ad85d90a1f130a497a1c3d7c58ecb0ff4e39f82c492373b5c29b69c64c9`,
and
`sha256:7b7887c43ff5df6c969f45842d34a6e04783d9bfcedd276daaed3477544ff4e6`.

The source revision's focused workflows passed, but its Windows CI job exposed
lossy numeric `dev`/`ino` comparison for 64-bit NTFS identities. The promoted
corrective uses bigint metadata throughout custody workspace and bounded-file
identity checks and adds a deterministic above-`2^53` alias regression. Full
local verification passed 1,306 tests with 4 intentional skips. CI run
`33118610052` passed Ubuntu/Windows jobs `98679559915` / `98679560385`;
parser isolation, custody, normalization, and cross-engine runs `33118609943`,
`33118610058`, `33118609968`, and `33118610020` also passed.

Cycle 2p creates no new evidence schema, evidence version, or canonical
artifact. Cross-engine acceptance emitted no artifact by design. The parser,
custody, and normalization artifacts are regression anchors only and have no
claimed independent offline review. Cycle 2o version 5 remains historical only
at `472cc10b8df90bee01925b2efd4fbcb614d7590c`.

For the historical Cycle 2b/2p enterprise-admission track, no exact external
100-filing inventory, independent rights/steward approval, authenticated
authority identity, trusted clock, human review, real filing bytes, independent
adjudication, or real quality exists. Cycle 2b, B15/V15, real-data admission,
full Cycle 2 exit, and production remain Blocked. Exact gates and nonclaims are in
[ADR 0043](./adr/0043-admission-validity-corrective-chain-promotion.md) and the
[Cycle 2p exit matrix](./CYCLE_2P_EXIT_MATRIX.md).

## Cycle 2q — personal single-user local corpus-manifest verification

Status: **Pass only for exact source revision
`398bb280593b6de125c5561ac9dd1b1c0fe254bd`, the direct child of baseline
`2f0534d2a5b4206221cc66ece5e03cf529e5d373`.**

Cycle 2q creates the closed `personal_single_user_local` profile and the
zero-production-dependency `@research-cockpit/personal-filing-corpus` package.
The declaration fixes local-only personal offline research, one user, no
commercial use, no redistribution, bounded retention, and user-managed local
deletion. It binds the exact canonical manifest digest and corpus identity.

The manifest contains 1–100 accession-sorted unique entries with closed
CIK/form/time/media/taxonomy/SEC-locator/declared-digest/amendment metadata,
digest syntax and uniqueness, and bounded declared sizes. The verifier owns
caller bytes before parsing, rejects
noncanonical or open inputs, fails atomically, and returns only an immutable
aggregate `verified_for_personal_use` record. It never returns `admitted`.

The exact 13-path direct-child transition routes before inherited Cycle 2p and
Cycle 2o evidence. The protected surface also includes unchanged enterprise
`corpus-admission.ts`; any non-exact intersection fails closed. Both offline
boundaries accept the exact committed source. No evidence schema, version, or
artifact is created, and Cycle 2o version 5 stays anchored at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`.

For the personal profile, organizational rights/steward/key-authority approval,
tenant identity and multi-user isolation, B15/V15, and production operations
are Out of scope rather than active blockers. Historical Cycle 2b and Cycle 2p
remain unchanged and become applicable if use expands beyond the declared
profile.

Cycle 2q does not read a filing payload. At its exit, raw payload presence,
byte length, and equality with each declared SHA-256 were the highest-priority
blocker. Cycle 2r closes that later source-capability boundary without changing
the manifest-only Cycle 2q claim. See
[ADR 0044](./adr/0044-personal-single-user-local-filing-corpus-manifest-verification.md)
and the [Cycle 2q exit matrix](./CYCLE_2Q_EXIT_MATRIX.md).

## Cycle 2r — personal local filing-payload identity verification

Status: **Pass only for exact source revision
`e15ddd8aa923a43fdca730e233abfbe684101e78`, the direct child of promoted
Cycle 2q documentation baseline
`436f7fed6af9efaec21a26e5709b90073610384e`.**

Cycle 2r extends `@research-cockpit/personal-filing-corpus` with the bounded
`verifyPersonalFilingCorpusPayloadIdentity` capability. It first re-verifies
owned declaration and manifest snapshots. It then maps every accession to the
fixed direct-root `<accession>.payload` child, requires the exact bounded root
inventory before and after reading, and streams each expected regular,
single-link, same-device file through one descriptor in positional chunks of
at most 65,536 bytes plus an EOF probe. Declared length and SHA-256 must match,
and bigint root, path, and descriptor identities must agree at the verifier's
pre/open/post observations.

Success is aggregate-only and immutable. Its status is
`payload_identity_verified_for_personal_use`, and its exact claim is
`bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use`.
The result exposes no root path, accession, per-file digest, or payload bytes.
All failures are atomic and value-free.

The platform claim is explicit. Supported non-Windows runtimes with
`O_NOFOLLOW` report
`kernel_final_component_nofollow_plus_observed_snapshots`; Windows reports
`observed_snapshots_only`. The latter rejects Node-visible symlinks/junctions
and observed multi-link files and compares bigint identities, but it does not
claim universal Windows reparse/cloud-placeholder/filter-driver rejection,
adversarial namespace ABA elimination, race freedom, or absence of transient
out-of-root reads against an active same-machine attacker.

The exact ten-path transition has 20 NUL fields, 693 bytes, digest
`sha256:46e497134b8cae95acc6211503a636b559064fdcf0dc95924d793f2d5dbaf4fb`,
and a 16-path protected surface. Both independent offline boundaries accept
the committed source. The route emits no Cycle 2r artifact and preserves Cycle
2q, Cycle 2p, and Cycle 2o history, including Cycle 2o version 5 at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`.

Full local verification passed 1,364 tests with 4 intentional skips. The
focused personal-package suite passed 45 tests with one capability-based
Windows skip. Exact-source CI run `33207340001` passed Ubuntu/Windows jobs
`98971624813` / `98971625033`; cross-engine, parser-isolation, normalization,
and payload-custody runs/jobs were `33207340045` / `98971625271`,
`33207340114` / `98971625367`, `33207340070` / `98971625207`, and
`33207340021` / `98971625062`.

This promotion proves verifier behavior with generated temporary fixtures. It
adds no owner-selected corpus, manifest, filing payload, payload-root
configuration, or successful owner-corpus operation record. Therefore no
specific personal corpus is yet verified by this source promotion. At the
Cycle 2r exit, the next highest-priority blocker was bounded local custody,
audit metadata, retention-target metadata, and owner-triggered deletion with an aggregate
receipt. Cycle 2s later closes that disconnected source-capability boundary.
Enterprise approvals, multi-user controls, B15/V15, and production operations
remain Out of scope for `personal_single_user_local` unless the profile widens.
See
[ADR 0045](./adr/0045-personal-local-filing-payload-identity-verification.md)
and the [Cycle 2r exit matrix](./CYCLE_2R_EXIT_MATRIX.md).

## Cycle 2s — personal local payload custody and owner deletion

Status: **Pass only for exact source revision
`78b3880632ff7e54ac493e9c208ee1d93a275aa1`, the direct child of promoted
Cycle 2r documentation baseline
`a13b51d2cd6862029aa598829e40209ce178c7be`.**

Cycle 2s extends the isolated personal package with bounded custody recording
and owner-triggered selected-live-payload deletion. Custody reverifies the
owned declaration and manifest, invokes Cycle 2r identity internally, requires
separate existing canonical non-root/nonnested payload and audit roots, and
establishes or returns exactly one synchronized canonical aggregate record.
An empty audit root publishes through the pending path; an existing final is
revalidated/replayed, and valid pending bytes may be promoted. The record binds
the exact manifest, runtime identity result, platform-valued link assurance,
and an unkeyed location digest over canonical paths plus observed identities.
Plaintext paths are not returned, but digest secrecy, unlinkability, and
resistance to offline guessing are not claimed. The retention target is
recorded policy arithmetic only; there is no scheduler, deadline enforcement,
legal hold, or minimum hold.

Deletion requires a fixed confirmation and expected custody digest. It
publishes append-only intent before unlink, considers only manifest-derived
direct children, rehashes and identity-observes each present file before
unlink, never removes recursively, and never deletes the payload root. A
terminal receipt is possible only after every selected name is absent and the
exact live root is empty. The empty root and aggregate custody, intent, and
receipt files remain.

The bounded result does not prove deletion from backups, cloud or replicas,
snapshots, caches, temp/log/swap/history, third parties, memory, or physical
media and is not cryptographic erasure. It also does not prove automated
retention, transactional/crash/cross-process/exactly-once recovery, active
attacker race safety, universal Windows reparse behavior, signed/tamper-proof
audit, caller authentication, running-app composition, or a specific owner
corpus.

The exact 11-path direct-child transition has 22 NUL fields, 778 bytes, digest
`sha256:f8feb8c71409711439761778e738872c3ff91974ce1a2a047dbf410f276805e6`,
and a 19-path protected surface. Both offline boundaries accept the committed
source. No Cycle 2s evidence version or cross-engine/CI evidence artifact is
created; Cycle 2r/2q/2p/2o history is preserved. This does not refer to the
local audit files created by an explicit custody operation.

Full local verification passed 1,405 tests with 8 intentional capability
skips; the focused personal-package suite passed 80 with 4 skips. Exact-source
CI run `33221451567` passed Ubuntu/Windows jobs `99016146240` /
`99016146391`; cross-engine, parser-isolation, normalization, and
payload-custody runs/jobs were `33221451518` / `99016145897`, `33221451525` /
`99016146058`, `33221451528` / `99016145920`, and `33221451601` /
`99016146192`.

This promotion proves generated-fixture capability behavior only. Cycle 2t
later closed the operational activation blocker. Its complete
repository-visible status is **owner-approved private operation Pass for one
owner-selected corpus**; the selection and every private operation input and
output remain outside Git and logs. Cycle 2u then adds bounded personal
ten-fact normalization and manifest-scoped lineage.
See
[ADR 0046](./adr/0046-personal-local-filing-payload-custody-and-owner-deletion.md)
and the [Cycle 2s exit matrix](./CYCLE_2S_EXIT_MATRIX.md).

## Cycle 2t — owner-selected private corpus activation

Status: **Owner-approved private operation Pass for one owner-selected
corpus.**

Cycle 2t is an owner operation, not a source promotion or public evidence
artifact. The repository stores no corpus selection or private operation input
or output. The coarse status is not an independent review and does not prove
SEC authenticity, raw parsing, fact truth, or quality.

Enterprise approval, multi-user controls, B15/V15, and production remain Out
of scope for `personal_single_user_local`. Cycle 2t closes only the bounded
private activation prerequisite for the next personal engineering boundary.

## Cycle 2u — bounded personal ten-fact normalization and lineage

Status: **Pass only for exact source revision
`4df5549087660b5b5d473c478b03b17576fd4784`, the direct child of promoted
Cycle 2s documentation baseline
`39f0ce974f84e278ec9d12193b284876c928110e`.**

Cycle 2u adds `normalizePersonalFilingFacts` to the disconnected personal
package. It owns bounded declaration, manifest, canonical private plan, and
parser-result snapshots; invokes the Cycle 2q manifest verifier; and requires
exact binding across the corpus, plan, manifest entries, and source documents.
The accepted source set is either one root 10-K or that root plus one
manifest-linked 10-K/A.

Every source document contains the exact ten keys once and in fixed order,
with plan-bound source mapping, unique direct source QNames, unit,
instant/duration contract, empty dimensions, and bounded canonical decimals.
The free-cash-flow subtrahend cannot collide with a direct mapping; its minuend
matching the mapped `operating_cash_flow` is the only deliberate coordinate
reuse. Free cash flow is accepted only as the fixed
operating-cash-flow-minus-capital-expenditures subtraction with both operands
and exact decimal recomputation. The boundary performs no raw XBRL/iXBRL
parse, source fetch, implicit conversion, or silent repair.

Root mode produces ten versions and zero lineage edges with every predecessor
and successor null. Its open end is qualified to the exact frozen manifest and
does not claim absence of an external amendment. Optional linked-pair mode
produces twenty versions and ten one-to-one supersession edges with half-open
known windows. Any whole-input failure returns one immutable value-free
quarantine with zero facts and zero lineage.

The exact private plan, parser-result documents, normalized material, and
operation record remain outside Git and logs. The complete private-operation
status is **owner-approved private operation Pass for one owner-selected
corpus**. Raw parser/extraction correctness, SEC authenticity,
accounting/fact truth, taxonomy authority, amendment discovery, global
currentness, independent comparison, owner-reviewed quality, database/API/web
composition, and production remain unproven. Cycle 2v independent
parser/validator comparison and conflict quarantine is next. See
[ADR 0047](./adr/0047-bounded-personal-ten-fact-normalization-and-root-lineage.md)
and the [Cycle 2u exit matrix](./CYCLE_2U_EXIT_MATRIX.md).

## Cycle 2v — bounded TypeScript/Python normalization-record agreement

Status: **Pass only for exact source revision
`76bd8a1319d6b5feb05da412ca30fe6507c5bdbb`, the direct child of promoted
Cycle 2u documentation baseline
`90c20e6eeb6c387015af81f74ba4b8e7aebc444b`.**

Cycle 2v supplies one owned declaration/manifest/plan/parser-result snapshot to
two repository-pinned paths. TypeScript invokes the local Cycle 2u normalizer.
After checking the canonical-LF Python source digest, the comparator launches a
distinct zero-dependency Python validator with only the same snapshot over
standard input. Python independently applies the complete Cycle 2u record
contract. The comparator accepts only byte identity of the full
canonical records, including every binding, fact identity and value, fixed
free-cash-flow operand, lineage edge, scope, and status. Root mode remains
10 versions/0 edges; the optional linked pair remains 20/10.

Any invalid input, normalization quarantine, Python source or execution
failure, malformed secondary record, or byte difference becomes one immutable
value-free conflict quarantine. Neither
side is preferred, no detailed diff is disclosed, and no mismatch is tolerated
or silently repaired. The private operation is recorded only as
**owner-approved private TypeScript/Python validator comparison Pass for one
owner-selected corpus**.

The independence claim ends at distinct TypeScript and Python normalization
record reconstruction. Both paths share the same parser-result bytes and
written specification, so Cycle 2v does not prove independent parsing or
extraction, shared-input/spec correctness, accounting truth,
operator/host/key/failure-domain independence, common-error or collusion
resistance, runtime attestation, SEC authenticity, amendment discovery, global
currentness, owner-reviewed quality, application composition, or production.
Cycle 2w narrows the next step to a separate raw extraction path for the
primary-selected dimensionless coordinates. Enterprise/shared-service gates
remain Out of scope. See
[ADR 0048](./adr/0048-bounded-personal-typescript-python-normalization-record-agreement.md)
and the [Cycle 2v exit matrix](./CYCLE_2V_EXIT_MATRIX.md).

## Cycle 2w — bounded personal raw selected-fact extraction agreement

Status: **Pass only for exact source revision
`1f7ff096c9187386cad9ae60e1e44861e6e5f842`, the direct child of promoted
Cycle 2v documentation baseline
`ad5e3003d3670c84021dabe47c4fb3976274bb23`.**

Cycle 2w requires the exact owned snapshot to pass Cycle 2v before comparing
raw extraction. It rebinds each raw filing document to the manifest's exact
count, order, byte length, and SHA-256 value, then derives ten primary-selected
dimensionless raw coordinates per source document from the agreed normalized
record. The repository-pinned zero-dependency Python structural HTML/iXBRL
worker receives only raw filing bytes and sorted target QNames over standard
input. It receives no normalization plan, parser-result document, normalized
record, expected value, or digest.

The worker independently reconstructs contexts, periods, empty/nonempty
dimension classification, bounded simple USD/shares units, and allowlisted
transform, sign, scale, and canonical decimal values. Exact values must agree
at every selected coordinate without tolerance. The projection includes both
free-cash-flow operands while reusing the operating-cash-flow coordinate.
Equivalent duplicates collapse; conflicting duplicates quarantine. Additional
distinct raw coordinates are allowed outside the selected projection, and the
unit, transform, and value semantics of excluded dimensional target facts are
not adjudicated.

Success returns only an immutable metadata receipt; every input, prerequisite,
raw-scope, worker, output, extraction, or comparison failure becomes one
value-free aggregate quarantine with no preferred side, diff, fallback, merge,
repair, or partial success. The private operation is recorded only as
**owner-approved private raw-extraction comparison Pass for one owner-selected
corpus**; the selected mode, corpus characteristics, private inputs, facts,
values, mappings, digests, timestamps, and receipt remain outside Git and logs.

The supported claim is exact value agreement for the ten primary-selected
dimensionless raw coordinates per document, with no primary parser-result or
normalized material crossing the secondary worker boundary. It does not prove
the shared QName mapping or primary selection, completeness among additional
coordinates, excluded dimensional semantics, primary parser implementation
identity or source lineage, general XBRL/iXBRL coverage, SEC authenticity,
accounting truth, amendment discovery, host/runtime independence, or quality.
Cycle 2x closes the next bounded owner-reviewed quality step without changing
Cycle 2w's historical claim. Enterprise/shared-service gates remain Out of
scope. See
[ADR 0049](./adr/0049-bounded-personal-raw-filing-selected-fact-extraction-agreement.md)
and the [Cycle 2w exit matrix](./CYCLE_2W_EXIT_MATRIX.md).

## Cycle 2x — bounded owner-reviewed personal filing quality measurement

Status: **Pass only for exact promoted corrective-chain tip
`39ce73760afe0e5d22063b02a60efe64e83f3747`.**

The capability source `c0138a3121361fc06f210e42febe6af4c6fa3e13` is the
direct child of promoted Cycle 2w documentation baseline
`716a3f6b7ad5a43c48a6a61d18b59c2cd5645018`. Validator subprocess isolation
was corrected at `7f7163d4673360645e332d0b7d28467c15656f8a`; the promoted
tip is its exact routing-closure child. The admission boundary preserves the
12-path source transition, four-path isolation correction, six-path routing
closure, and 15-path cumulative transition diff set.

Cycle 2x owns bounded disjoint declaration, manifest, normalization-plan,
quality-plan, parser-result, and raw-filing snapshots. The canonical quality
plan binds the exact owner-reviewed reference digest, document selection, and
fixed zero-tolerance threshold policy before candidate execution. Candidate
observations are derived internally through Cycle 2w raw-extraction agreement
and the Cycle 2u normalized projection, then committed before reference content
is revealed. The commit receives only the reference digest. Reveal requires an
empty, frozen, identity-bound, instance-local, single-use capability; every
first attempt consumes it.

The reference schema requires the exact ordered launch labels for every
admitted document, including direct concept/unit/period/value fields and the
fixed free-cash-flow operand contract. The evaluator alone derives document
success, fact precision and recall, exact unit/date agreement, silent critical
failures, and quarantine rate. Counts, metrics, thresholds, weights,
exclusions, and outcomes are not caller inputs. Integer ratio evaluation is
fail-closed and every fixed threshold must pass, including zero quarantine and
zero silent critical failures. A valid disagreement or upstream quarantine is
an evaluated `not_met`; invalid protocol or reference material becomes one
atomic value-free quarantine. Terminal results are immutable aggregate-only
records.

The private operation is recorded only as **owner-approved private bounded
quality-measurement Pass for one owner-selected corpus**. This means only that
the protocol completed `quality_evaluated_for_personal_use` and met its
predeclared personal threshold outcome. No selected-corpus characteristic,
private reference or quality plan, input or output, fact, label, value,
coordinate, mapping, count, metric, measured numerator, denominator, or per-
metric outcome, digest, timestamp, token, approval, seal, receipt, runner
artifact, execution mode, or execution detail is repository-visible.

The exact tip passed source-bound CI run `33290262191`'s full hosted release
gate on Ubuntu and Windows. Cross-engine, parser-isolation,
normalization, and payload-custody runs `33290262193`, `33290262185`,
`33290262180`, and `33290262184` passed at the same revision. No Cycle 2x
canonical evidence artifact was emitted; those runs prove source and routing
health, not the private measurement.

Cycle 2x closes the currently declared personal filing-ingestion exit gate for
the one owner-selected corpus. It does not establish external chronology or
actual reference secrecy, owner identity, independent adjudication or label
correctness, representativeness or generalization, source authenticity,
accounting truth, broad parser coverage, runtime independence, amendment
discovery, global currentness, running-application composition, shared-service
safety, or production readiness. Any changed source, corpus, reference, plan,
or thresholds requires fresh review and measurement. Cycle 2y and Cycle 2z
separately close bounded readiness and selected-fact composition without
widening Cycle 2x. Enterprise/shared-service gates remain Out of scope. See
[ADR 0050](./adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md)
and the [Cycle 2x exit matrix](./CYCLE_2X_EXIT_MATRIX.md).

## Cycle 2y — bounded personal quality-readiness composition

Status: **Pass only for exact source revision
`a3ab46aa09f1b63a86fdb8c1f98976b26ba30e3f`, the direct child of promoted
Cycle 2x documentation baseline
`2e88db749ead46828235f7c58e128f92e4ccff44`.**

Cycle 2y keeps synthetic startup as the default. Only the exact explicit
`personal_readiness` mode may invoke a pre-listen loader. That loader reads the
exact source-pinned and hash-pinned resource-corrected Cycle 2x aggregate once,
admits only the quality-ready terminal predicate, discards the private carrier,
and gives the running application only an opaque capability that can enable the
fixed DTO `{schemaVersion, profile, status, dataPlane: "disabled"}`.

The readiness endpoint is GET-only, accepts no request state, remains on exact
loopback, and adds exact Host and Origin guards. Every GET outcome is private,
noncacheable, and value-free beyond the fixed success DTO. The paired
pre-listen path and owner-provided digest inputs are removed from the process
environment before listen. An optional browser chip may render only that DTO
and cannot persist it. No personal fact, label, value, metric, hash, path,
reference, quality plan, approval, aggregate, binding, or execution detail
enters the response, browser, log, or storage.

This closes only coarse startup-to-API-to-browser readiness composition.
Personal facts and personal dossier fields remain disconnected and the
personal data plane remains disabled in Cycle 2y. Cycle 2z separately closes
the exact owner-authorized release boundary without widening Cycle 2y.
Authenticated browser sessions and protection from hostile same-user processes
remain later. Enterprise/shared-service gates remain Out of scope. See
[ADR 0051](./adr/0051-bounded-personal-quality-readiness-composition.md) and the
[Cycle 2y exit matrix](./CYCLE_2Y_EXIT_MATRIX.md).

The 30-path source transition added 12 paths and modified 18, with 2,713
insertions and 51 deletions. `corepack pnpm verify` passed 1,526 tests with 8
intentional skips, every guardrail and type check, and all production builds.
Exact-source public CI run `33334380969` passed on first attempt through Ubuntu
job `99318536228` and Windows job `99318536323`. Three parallel read-only
implementation, contract, and adversarial review tracks completed; final
closure checks reported no remaining actionable P0/P1/P2 finding after
corrections. None of this evidence contains private aggregate or owner-local
material.

## Cycle 2z — bounded personal owner-authorized selected-fact release

Status: **Promoted only for exact frozen source revision
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`. Private evidence is limited to
the permitted coarse outcome below.**

Cycle 2z closes one exact explicit personal release mode. Before listen, it
snapshots the bounded inputs, rederives the candidate through the production
normalization and raw-agreement path, and matches the exact input set and
candidate commitments already admitted by the quality result. A separate
normalized record or caller assertion cannot satisfy the same-snapshot gate.

The owner reviews the exact canonical plan and proposed closed response before
supplying fresh single-use authorization. All validation and response
derivation finishes before atomic authorization consumption. The running
application receives only an opaque capability for one immutable selected-facts
response. Failure is pre-listen, atomic, and value-free.

The local route is GET-only with no caller selection and retains the loopback,
Host, Origin, and noncacheable response boundaries. An optional browser view is
nonpersistent and remains disconnected from the synthetic dossier, evidence,
valuation, thesis, alerts, history, export, and storage.

The exact merge-free source chain is
`62c01dafe305ddd43c75688e0225163b3abdf6df` ->
`e64924bc091bfc7a3e071e7db746910e082051c4` ->
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`. The implementation transition
contains 43 paths, comprising 13 additions and 30 modifications, with 3,840
insertions and 46 deletions. The corrective transition contains 5 modified
paths, with 1,310 insertions and 9 deletions.

At the exact source revision, `corepack pnpm verify` passed formatting, lint,
guardrails, type checks, peer checks, 1,573 tests with 8 intentional skips, and
all production builds. General CI run `33344500398` passed through Ubuntu job
`99345958471` and Windows job `99345958683`; parser-isolation run
`33344500394`, payload-custody run `33344500364`, and cross-engine run
`33344500412` also passed. Independent read-only implementation, contract,
adversarial, and privacy source review found no remaining actionable P0/P1/P2
issue for the declared personal scope. This is source review, not an external
audit.

Coarse owner-approved private selected-fact release outcome: Pass for the exact
frozen personal scope. Public evidence contains no selected subset, response
content, private binding, authorization material, commitment, location, or
operation detail. See
[ADR 0052](./adr/0052-bounded-personal-owner-authorized-selected-fact-release.md)
and the [Cycle 2z exit matrix](./CYCLE_2Z_EXIT_MATRIX.md).

After Cycle 2z, Cycle 3a is the separately scoped request-time authenticated
owner-browser boundary. It is promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`, with a short-lived
session-bound capability and CSRF, replay, rotation, revocation, and lifetime
controls. Same-user hostile-process resistance remains unproven.
Enterprise/shared-service gates remain Out of scope.

## Cycle 2 — personal local filing ingestion proof

Target: continue incrementally behind the declared personal profile.

1. Cycle 2r defines the fixed direct-root `<accession>.payload` mapping and a bounded streaming verifier capability. A specific corpus becomes verified only after a successful invocation over that corpus.
2. Cycle 2s records bounded aggregate custody metadata in a separate audit root and provides explicit selected-live-root deletion with intent and terminal receipt capabilities.
3. Cycle 2t is recorded only as owner-approved private operation Pass for one owner-selected corpus; no selected-corpus characteristic or private operation material is repository-visible.
4. Cycle 2u normalizes ten launch facts under an exact private plan, binds manifest source metadata, and produces root-only or manifest-linked amendment lineage with atomic value-free quarantine.
5. Cycle 2v compares the exact complete Cycle 2u record reconstructed by the repository-pinned TypeScript normalizer and distinct zero-dependency Python validator, quarantines every conflict, and forbids silent repair.
6. Cycle 2w compares exact values at ten primary-selected dimensionless raw coordinates per document against a repository-pinned Python extractor that receives only raw bytes and target QNames, not primary parser results or normalized material.
7. Cycle 2x freezes an owner-reviewed reference and quality plan before candidate execution, commits internally derived candidate observations before reference reveal, and evaluates document success, fact precision/recall, exact unit/date agreement, silent failures, and quarantine rate against fixed zero-tolerance thresholds.
8. Cycle 2y admits only the exact quality-ready aggregate once before listen and exposes a fixed coarse readiness DTO while the personal data plane remains disabled.
9. Cycle 2z closes an atomic owner-authorized release of one startup-fixed selected-fact response rederived from the exact candidate snapshot admitted by the quality result, only for the exact frozen source and personal scope.

Personal-profile exit gate: **Pass for the one owner-selected corpus.** Every
selected local payload matches its manifest,
all supported documents produce bounded deterministic outcomes, and the frozen
owner-reviewed reference set meets its declared quality thresholds with zero
silent critical failures.

No earlier cycle alone satisfies this exit gate. Historical Cycle 2a, Phase-A
Cycle 2b, historical Cycle 2c, historical
Cycle 2d/Cycle 2e, Superseded Cycle 2f/Cycle 2g, bounded source-stage Cycle 2h
at exact commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, promoted source-stage
Cycle 2i, promoted bounded synthetic Cycle 2j, Superseded Cycle 2k, promoted
bounded synthetic Cycle 2l, promoted bounded synthetic Cycle 2m, nor promoted
bounded synthetic Cycle 2n, promoted bounded synthetic Cycle 2o, promoted
repository-controlled Cycle 2p, personal manifest-only Cycle 2q, Cycle 2r's
disconnected payload-identity verifier capability, Cycle 2s's disconnected
custody/deletion capabilities, coarse Cycle 2t activation, nor Cycle 2u's
bounded normalization/lineage result satisfies this full exit gate.
Cycle 2i does not
establish that a parser
executed or correctly derived its signed documents; Cycle 2j establishes only
the exact reviewed synthetic pair and cannot verify personal filing payloads.
Cycle 2t and Cycle 2u close only bounded private activation and exact-plan
normalization/manifest-scoped lineage. Cycle 2v closes distinct
TypeScript/Python complete-record reconstruction agreement. Cycle 2w closes
only a secondary raw path's exact values at the primary-selected dimensionless
coordinates. Cycle 2x supplies the bounded owner-reviewed quality measurement
needed for the declared personal exit gate and records only its coarse private
Pass. Shared selection and mapping correctness, general XBRL/iXBRL extraction
and taxonomy correctness, amendment discovery, and generalization beyond the
exact frozen scope remain unproven; they are nonclaims rather than blockers for
this closed personal-corpus gate.

Cycle 2y closes the first local running-application composition boundary, but
only for coarse readiness. Cycle 2z closes the separate atomic same-snapshot
selected-fact release boundary under explicit owner authorization and a
nonpersistent response for the exact frozen source and personal scope. Cycle
3a closes request-time authenticated owner-browser composition only for exact
source revision `ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. A promoted broader
personal dossier, actual personal-vault activation, queueing, fetching, alerts,
and background ingestion remain later outcomes.

The fixed 100-filing representative corpus, 2,000 independently adjudicated
assertions, organizational rights/steward approval, B15/V15, multi-user
controls, and production operations remain separate enterprise-profile work.
They are not current personal-profile blockers.

## Cycle 3 — product breadth

Status: **Cycle 3a is promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Cycle 3b has prepared public
source but no fresh owner authorization, terminal exact-source result, private
activation, acceptance, or promotion. Cycle 3c is accepted and promoted only
for exact provider-neutral, no-transport public source revision
`4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`; it is not privately activated.
Cycle 3d is accepted and promoted only for its exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
`3edb5464a3414313a980ffd9fecce5ca5257084a`; no actual personal vault, key,
backup, restore, or private activation has occurred. Cycle 3e-a has a recorded
public engineering Pass for its exact chain from
`5186103977b906d3c035599b3b2b00793926fca3` through
`fda5148a4251a36861196029bbc6df6b7d1a84d0`, but its real snapshot, real-
universe breadth, and real-hardware latency result remain pending, so it is not
accepted or promoted. Cycle 3e-a1 has a recorded public engineering Pass only
for exact source revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and
routing closure `5e27bed1a11956bb207f523739083131aea254f0`; no real source
or private operation is recorded. Cycle 3e-a2 has a recorded public engineering
Pass only for exact source revision
`8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`; it records no real source,
breadth, latency, or private operation. Cycle 3e-b and Cycles 3f through 3q
remain planned.** No parity claim is made.

Cycle 3 is rebaselined as a sequenced **personal product-breadth program**. The
completed `personal_single_user_local` offline boundary and exact Cycle 2z
result remain unchanged. Request-time authenticated owner-browser composition
is closed by Cycle 3a only for its exact source. Cycle 3b authenticated personal
dossier composition is prepared but not promoted. Cycle 3c's provider-neutral,
no-transport public control plane and Cycle 3d's corrected
public/local-temporary vault boundary are promoted only for their exact source
chains. Cycle 3e-a now records owner-local security-master snapshot admission
and deterministic search as a verified public engineering boundary, but
synthetic scale cannot establish its declared real-catalog result. Cycle 3e-a1
separately records only an offline deterministic handoff from six exact
canonical source-preparation roles into that admission boundary. Any later
real latency evidence must also use the recorded Cycle 3e-a2 package-owned
monotonic clock and explicitly bound timed region. Any later
networked source must still enter through the
separately declared, explicitly enabled
`personal_single_user_local_connected` profile with source-specific terms,
provenance, retention/export rules, local secret handling, and owner-set
request, storage, and estimated-spend budgets. Those application budgets are
not a provider-enforced billing ceiling.

Organizational approvals, tenant controls, billing, paid-beta gates,
10K/100K-user cost models, commercial redistribution, and production
operations remain dormant enterprise-profile work. They do not block the
personal program. Personal durability still requires authentication,
CSRF/replay controls, migration integrity, backup/restore, deletion, scheduler
recovery, accessibility, measured performance, and source-license compliance.

### Cycle 3a — personal local owner session

Status: **Accepted and promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`. Private evidence is limited to
the permitted coarse outcome below.** The exact design and evidence are in
[ADR 0053](./adr/0053-personal-local-owner-session.md) and the
[Cycle 3a exit matrix](./CYCLE_3A_EXIT_MATRIX.md).

The exact merge-free source transition is
`dd7fb5ea0b5c288f4337793dd6ddcb314f8b41f3` ->
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`: 39 paths, comprising 13 additions
and 26 modifications, with 6,543 insertions and 238 deletions. Local
`corepack pnpm verify` passed every format, lint, guardrail, type, peer, test,
and production-build gate. Settled suite totals include 119 API tests, 94 web
tests, and 582 database tests; every remaining package suite passed with only
intentional skips. Exact-source general CI run `33460175145` passed on attempt
1 in Ubuntu job `99708487084` and Windows job `99708487035`; payload-custody
run/job `33460175120` / `99708486913` and cross-engine run/job `33460175088` /
`99708486675` also passed on attempt 1. Independent read-only source review
found no remaining actionable P0/P1/P2 issue for the declared personal scope;
this is not an external audit.

Coarse owner-approved private selected-fact release outcome: Pass for the exact
frozen personal scope.

Both explicit personal API modes require one operator-supplied
`RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET` with exactly 64 lowercase hexadecimal
characters. The API enforces only that representation; generating and encoding
32 fresh CSPRNG bytes for each process is an operator precondition rather than a
programmatically proven property. The API captures and deletes the value from
its process environment before composition and listen, derives a bootstrap
digest, and retains no plaintext secret. A valid presentation is single-use
within that authority/process and creates exactly one active process-memory
session. Synthetic API startup remains the default and rejects personal
configuration rather than inferring a personal mode.

Bootstrap accepts no owner cookie or one syntactically valid stale owner cookie
so a fresh process can recover after restart or expiry. Success replaces the
stale cookie. Malformed or duplicate cookies fail, and recovery still requires
an unused bootstrap digest and no active session in the new process.

The web owner controls are separately disabled unless
`RESEARCH_COCKPIT_WEB_MODE=personal_single_user_local`. The owner pastes the
secret into a transient password field. Submission clears the field and sends
the value only in `X-Research-Cockpit-Bootstrap` on a bodyless POST. Cycle 3a
code places it in no URL, request or response body, durable cookie, Web Storage,
IndexedDB, fixture, console, or application log.

The accepted bootstrap sets one host-only, nonpersistent HttpOnly
`SameSite=Strict` cookie scoped to `/v1/personal-filing`. The server stores only
a keyed session digest and exact Host/Origin binding. Successful authorization
refreshes a 10-minute monotonic idle deadline but never extends the 60-minute
absolute deadline established at bootstrap. Rotation replaces the bearer while
preserving the absolute deadline. Logout, explicit revocation, either expiry,
clock failure or rollback, and process close invalidate the active authority.

The personal browser lifecycle remains nonpersistent. The client captures each
local lifecycle deadline or observation before dispatching its corresponding
bootstrap, revalidation, rotation, or protected-read request, never later than
server authorization. Successful authorized private reads and rotation reset
only idle, while rotation preserves the known absolute deadline. A tab that
discovers an active cookie without the original absolute timestamp uses a
conservative lease bounded by the idle TTL and does not claim exact server-
deadline synchronization. `pagehide` and a hidden visibility transition clear
and deactivate local private presentation while preserving any known local
deadline, without broadcasting or ending the server session. Focus, `pageshow`, and a visible transition clear first and
trigger server revalidation without polling.

Failure to construct the nonpersistent `BroadcastChannel` disables personal
access. Publish failure locks and clears the initiating tab. Local expiry,
logout, revocation, or failed revalidation clears rendered private state
immediately, but immediate sibling invalidation is claimed only when the channel
delivers operationally. An already-active sibling that misses a signal falls
back to focus/visible/`pageshow` revalidation or its conservative lease. Bootstrap and
rotation use the same fail-closed channel to request clear-then-revalidate. The
channel, lifecycle timestamps, and signals are memory-only and never become a
second authority.

The local CSRF boundary combines credentialed CORS restricted to the one
matching literal-loopback browser origin, exact Host and Origin validation, and
one exact `X-Research-Cockpit-Intent` header for every state-changing action.
Before any personal fetch, the browser client requires its API base to be an
exact `http://127.0.0.1:<port>` or `http://[::1]:<port>` origin with an explicit
port from 1 through 65535 and no userinfo, path, query, or fragment; an invalid
base fails locally without a fetch. A controlling service worker, or unreadable
controller state, likewise denies personal calls before fetch. Cycle 3a
registers no application service worker and stores no authority in application
service-worker state. The server remains stricter about the exact configured
authority: an API bound to `127.0.0.1` accepts only
`http://127.0.0.1:3000`; an API bound to `::1` accepts only
`http://[::1]:3000`. `localhost` is never mixed with the literal IPv4 API
address. Missing, malformed, duplicate, expired, wrong-bound, rotated,
logged-out, revoked, or closed authority is denied before a protected personal
capability is read.

The code protects both personal compositions. Preserved Cycle 2z evidence
remains bound to exact Cycle 2z source
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66` and historically unchanged. Cycle
3a's source binding is distinct, and no private sub-result enters public
evidence. A later source requires fresh owner review and fresh single-use
authorization. This is a personal owner-authorization gate, not an enterprise
requirement.

This boundary proves bearer possession only. Per-authority/process single-use
and replay denial do not detect an operator reusing the same valid-shaped secret
in a different process; cross-process same-secret reuse is an explicit nonclaim.
The boundary does not verify a human or resist hostile same-user processes,
browser extensions, developer tools, screenshots, clipboard readers, memory
inspection, or hostile browser state beyond the narrow controlling-service-
worker prefetch guard. It adds no remote, multi-user, tenant, service, durable,
or production authentication. At the exact Cycle 3a source, personal facts
remain separate from the synthetic dossier.

### Cycle 3b — authenticated personal dossier composition

Status: **Prepared public source only; not owner-authorized, privately run,
terminally verified, accepted, or promoted.** The exact decision and pending
gates are in [ADR 0054](./adr/0054-authenticated-personal-dossier-composition.md)
and the [Cycle 3b exit matrix](./CYCLE_3B_EXIT_MATRIX.md).

Exact API startup with `RESEARCH_COCKPIT_MODE=personal_dossier` prepares one
read-only, memory-only `PersonalFilingDossierDto` from a plan using
`exact_candidate_document_index.v1`. The plan fixes one document index,
canonical selected fact keys, and canonical chart keys. That index is the
terminal entry of the separately sealed and admitted declaration, manifest, and
quality-plan prefix. Only its matching raw/source document-array prefix is
decoded; an earlier snapshot requires its own prefix-sealed artifact because a
full manifest still cryptographically binds every later manifest entry. Facts
are the sole primary-fact registry. Evidence may retain the exact immutable
derivation operands required to audit a derived fact; in-corpus lineage, the
fixed filing-fact chart, and valuation inputs otherwise reference facts inside
one closed response. Exact
`GET /v1/personal-filing/dossier` requires the Cycle 3a owner session before
private capability access. The matching browser starts only under
`RESEARCH_COCKPIT_WEB_MODE=personal_dossier` and renders at the parameter-free
`/personal` route; `/research/[symbol]` redirects before symbol or `knownAt`
resolution. The browser admits no synthetic fallback and persists no personal
state.

The public contract exposes explicit unsupported chart and valuation variants
for honest failure semantics. Those variants do not close the Cycle 3b end-user
result: terminal promotion requires the later exact owner-approved response to
contain a ready nonempty filing-fact chart and ready same-snapshot valuation
inputs.

The prior Cycle 2z and Cycle 3a approvals are incompatible. Promotion requires
fresh owner review of the exact canonical dossier and one single-use
`APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE` authorization bound to a later
exact source, bundle, quality result, plan, and response, followed by terminal
public and private evidence. This prepared source authorizes no private run.

Dynamic selection or `knownAt`, connected source execution, refresh, promoted
personal persistence, background work, security-master mapping, prices, broad statements, owner
corrections, personal thesis/alerts/exports, hostile same-user resistance, and
remote/shared authentication remain nonclaims. Cycle 3c prepares the separate
connected-personal source-policy control plane below without widening Cycle 3b.

### Cycle 3c — provider-neutral connected-personal source-policy control plane

Status: **Accepted and promoted only for exact provider-neutral public source
revision `4e9f011434382ccaae66f396fd5b163e4c0fc6be` and routing closure
`86e712574a5eee4e9f636c25ebd5d6fb70f20581`; not privately activated.** The
exact decision and terminal public gates are in
[ADR 0055](./adr/0055-connected-personal-source-policy-registry.md) and the
[Cycle 3c exit matrix](./CYCLE_3C_EXIT_MATRIX.md).

The zero-production-dependency
`@research-cockpit/connected-source-policy` package adds exact profile
`personal_single_user_local_connected`, schema constant
`CONNECTED_SOURCE_POLICY_SCHEMA_VERSION`, parser
`parseConnectedSourcePolicyConfig`, and a process-memory controller from
`createConnectedSourcePolicy`. Its exact methods are `status`, `kill`,
`admitSourcePolicy`, `authorizeOperation`, `reserveBudget`, and `execute`.
Source policies close provider identity, product/tier, opaque entitlement,
terms/license versions, effective/review/expiry/revocation chronology, use
scope, attribution, display, derivation, cache, history, export, retention,
deletion, termination, exact host/operation pairs, and request/request-byte/
response-byte/storage-byte/estimated-spend budgets.

API startup is selected only by exact
`RESEARCH_COCKPIT_MODE=personal_single_user_local_connected` with exact
`CONNECTED_SOURCE_POLICY_BUNDLE_PATH`,
`CONNECTED_SOURCE_POLICY_BUNDLE_SHA256`, and
`CONNECTED_SOURCE_POLICY_SECRET_REFERENCE`. The canonical bundle wrapper has
exactly `config`, `policy`, and `schemaVersion`. Default synthetic startup and
all prior offline personal modes reject connected-only configuration. The
loader verifies the stable regular file, fixed filename, digest, and canonical
JSON; wipes its owned byte carrier; and deletes captured connected environment
entries before listen. Cryptographic erasure of JavaScript strings is not
claimed. The path must be drive-qualified on Windows or single-rooted on POSIX;
UNC, device-namespace, double-root, and root-relative Windows forms fail before
file access. Mapped drives and network-mounted POSIX backing cannot be proven
by the application and remain an operator-locality precondition.

Connected startup is a distinct non-splitting `connected-server` build and
start entry. The ordinary server rejects connected mode. Its frozen static
graph includes only the minimal connected app and composition root, policy
loader and status/kill routes, owner-session boundary, listen options, and
connected server; it excludes the demo app, personal filing corpus,
dossier/fact loaders, research state, and command-execution modules.

Within the connected-source-policy business/control surface, the API composes
only owner-session-authenticated
`GET /v1/personal-filing/connected-source-policy/status` and bodyless
`POST /v1/personal-filing/connected-source-policy/kill`; the latter requires
exact intent `connected-source-policy-kill`. The API receives no
`OwnerLocalSecretAdapter`, `ConnectedSourceTransportAdapter`, or transport
capability and never calls the controller's authorize, reserve, or execute
seams. The dedicated connected app also exposes health and the five inherited
owner-session lifecycle routes; none provide provider transport. Startup has
no separate provider-credential field and accepts only a designated
`owner-local-ref:v1:<store>:<entry>` locator. The locator's operator-supplied
identifiers, and the source/policy identifiers returned by status, must be
non-secret metadata; their semantics cannot be proved from grammar alone.
Startup performs no credential-readiness probe and resolves no credential. A
future execution gateway may resolve that reference just in time only after
policy and budget admission.

This promoted public source contains no actual provider/source credential, provider
secret adapter, external request, provider response, entitlement or legal
determination, provider billing ceiling, SEC refresh, EDGAR fetch, or
market-data adapter. Application budgets
constrain only future work the project may start; they do not cap a provider
invoice. Organizational stewardship, tenant controls, commercial use, shared
service operation, and production billing remain personal-profile out-of-scope
enterprise work. Cycle 3d remains separate and does not make this policy,
kill, reservation, replay, or budget state durable.

### Cycle 3d — durable personal local research vault

Status: **Accepted and promoted only for the exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at terminal routing
closure `3edb5464a3414313a980ffd9fecce5ca5257084a`. No actual personal vault,
recovery key, backup, restore, or private activation has been performed.** The
exact decision and terminal public gates are in
[ADR 0056](./adr/0056-durable-personal-local-research-vault.md) and the
[Cycle 3d exit matrix](./CYCLE_3D_EXIT_MATRIX.md).

The zero-production-dependency
`@research-cockpit/local-research-vault` package provides exact profile
`personal_single_user_local_vault` and closed record kinds `thesis`,
`settings`, `watchlist`, `alert_definition`, `job_state`, and `portfolio`.
The promoted adapter's final schema is exact V2. New initialization applies the
reviewed V1 base and V2 unique-ledger-request-binding suffix in one transaction;
opening an exact fully verified V1 applies only that reviewed suffix, and a
failed constraint migration rolls back to retryable V1. Arbitrary or
unreviewed migrations fail closed. V2 identity, both ledger entries, exact
tables/indexes, full `PRAGMA integrity_check(1)`, and foreign keys are verified
before use. Runtime mutations use optimistic concurrency and idempotency,
write tombstones and payload-free audit metadata in the transaction, and
reject missing, unexpected, corrupt, or ambiguous state instead of creating a
blank vault. Child-process crash verification, attachment integrity, and
restart persistence use local-temporary data only.

The vault root is one startup-fixed canonical direct child with fixed file
names. Symlinks, junctions, hardlinks, unknown children, nonregular files, and
identity changes fail closed. POSIX requires exact owner-only modes; Windows
requires a native effective-ACL inspection receipt binding the owner and every
verified path. Native ACL inspection remains a trusted-adapter boundary.

A separate owner-only 32-byte recovery-key file derives domain-separated
record, attachment, and backup keys. Record payloads and attachment bytes use
AES-256-GCM with fresh random nonces. This is not whole-database, filesystem,
memory, or forensic encryption. The current backup derivation uses a fixed
domain-separation salt, not a claimed random per-backup KDF salt. Backup uses a
unique owner-only external snapshot with identity pinned across creation,
normalization, and readback. It publishes the synced encrypted pending file by
creating the same-directory final as a no-replace hard link, then unlinks the
pending name and verifies the final container. Restore is offline, wrong-key/
tamper rejecting, and limited to an absent root. Old backups may retain and
later reintroduce records deleted from the live vault.

The separate non-splitting `vault-server` composes only the owner session and
vault record routes. Status, list, read, conditional create/update, and delete
are private/no-store and require exact owner authorization, intent,
idempotency, and strong version preconditions where applicable. Attachments,
backup, and restore have no HTTP route. The demo thesis/alert form no longer
uses Web Storage, but there is no Cycle 3d browser vault client or actual
browser-data migration.

Cycle 3d explicitly excludes Cycle 3c policy, kill, reservation, replay, and
budget state; those remain process-local across restart. It also adds no source
credential, network request, provider adapter, scheduler execution, delivered
alert, tenant, remote service, or production boundary. The local gate at
terminal routing closure passed 1,906 tests with 9 intentional skips, and CI,
cross-engine, parser isolation, and payload-custody workflows passed there at
`3edb5464a3414313a980ffd9fecce5ca5257084a`. Cycle 3e-a owner-local
security-master snapshot admission and search now has a recorded public
engineering Pass. It cannot claim real breadth without a later exact owner-
approved, rights-compatible source snapshot.

### Cycle 3e-a — owner-local security-master snapshot and search

Status: **Recorded public engineering Pass for the exact merge-free chain from
`5186103977b906d3c035599b3b2b00793926fca3` through
`fda5148a4251a36861196029bbc6df6b7d1a84d0`. No real catalog, source download,
provider credential, network operation, or private activation exists, and
Cycle 3e-a is not accepted or promoted.** See
[ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md) and
the [Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md).

The prepared package admits one exact canonical snapshot with explicit
provenance, source-policy compatibility, source exclusion counts, stable
issuer/security/share-class/listing/mapping identities, exact U.S./operating-
MIC declarations, observation-only ticker chronology, and duplicate active
MIC-symbol rejection. It supports canonical 1:N identity ancestry and
constructs immutable in-memory indexes for a fixed symbol/name normalization,
rank order, and tie break. A separate owner-session-
authenticated API mode provides bounded private/no-store status and search
only; it accepts no HTTP-selected snapshot or policy and composes no provider,
credential, network, vault, filing, scheduler, or browser-search boundary.
Raw queries and searchable names are at most 128 code points; their normalized
name forms are nonempty and at most 512 code points.

The full local gate at `fda5148` passed 2,024 tests with 9 intentional skips.
Exact-commit CI run `33691407884` succeeded for Ubuntu job `100450725750` and
Windows job `100450725932`; parser acceptance run `33691407866`, custody
acceptance run `33691407885`, and cross-engine acceptance run `33691407952`
also succeeded. This records only the public synthetic engine/API boundary.

The selected future free/personal profile is `sec_openfigi_v1`: exact pinned
SEC current ticker/exchange data, SEC submissions and issuer-filed Inline XBRL
cover facts, OpenFIGI v3 mappings, and a pinned ISO 10383 MIC snapshot. Its
ticker history is filing-observed plus prospective diffs keyed by stable
internal `listingId`, with explicit observation-only time-basis labels;
complete exchange-effective history requires a separately licensed corporate-
actions source and is outside this profile unless later added.

The public scale case may contain at least 3,000 synthetic records and the
measurement helper may report synthetic latency, but both remain explicitly
engineering-only. Its exact plan is 100 iterations over 32 distinct normalized
queries at result limit 25, with the ordered raw query set bound by canonical-
JSON-plus-LF SHA-256 in the receipt. The recorded Cycle 3e-a2 public engineering
correction removes the optional caller clock, requires exactly two arguments,
captures the `node:perf_hooks` monotonic clock inside the package, and binds
exact `clock` and `timedRegion` literals into the receipt. Promotion still
requires one exact owner-
approved real snapshot with at least 3,000 eligible active U.S.-listed common
stocks/ADRs,
exact policy binding and explicit exclusions, plus local symbol/name search p95
below 200 ms on declared owner hardware with that exact loaded universe and
measurement plan. These are personal source and quality gates, not enterprise
requirements.

#### Cycle 3e-a1 — offline `sec_openfigi_v1` source preparation

Status: **Recorded public engineering Pass only for exact merge-free source
revision `0cf87021648e05c191eebbeb95aee6742c4c0f09` and routing closure
`5e27bed1a11956bb207f523739083131aea254f0`. No real source, credential,
owner authorization, private operation, or generated real snapshot exists.** See
[ADR 0058](./adr/0058-offline-sec-openfigi-v1-source-preparation.md) and the
[Cycle 3e-a1 exit matrix](./CYCLE_3E_A1_EXIT_MATRIX.md).

At routing tip `5e27bed1a11956bb207f523739083131aea254f0`, the full local
gate passed 2,051 tests with 9 intentional skips. Exact-tip CI run `33806494548`
passed Windows job `100818110497` and Ubuntu job `100818110717`; custody run
`33806494300`, normalization run `33806494295`, cross-engine run `33806494318`,
and parser-isolation run `33806494364` also passed. This evidence records only
the public offline source-preparation engineering boundary.

The public entry `prepareSecOpenFigiV1Source` accepts exact digest maps and
canonical byte maps for six roles: preparation plan, SEC candidates,
normalized SEC cover evidence, aggregated OpenFIGI mappings, ISO MIC registry,
and opaque identity assignments. Every artifact declares profile
`sec_openfigi_v1`, schema `1.0.0`, and its exact role; the plan transitively
binds the other five digests and supplies the exact stale cutoff. Fixed
implementation limits are not plan-selected. The module performs no
acquisition. Row order cannot choose reconciliation/admission ordering and
emitted records are sorted, while exact-byte differences remain bound through
artifact/bundle digests, provenance, and output source revision. The preparer
separates admitted/ineligible/stale/unsupported/quarantined counts and passes
one canonical output through the existing snapshot admission boundary.

A nonempty success exposes a frozen value-minimized receipt, an identity-bound
single-use capability, and synchronous `readSnapshot`. The factory wipes all
six captured input copies before returning; only a derived canonical snapshot
copy remains behind the capability. The first read attempt consumes the
capability, returns a fresh caller-owned snapshot copy on success, and wipes the
retained copy in all outcomes. A result with no admitted candidate has no
capability. Public fixed failures and `exclusionReasonCounts` disclose no source
values, rejected rows, paths, or credentials. Public hostile and at-least-
3,000-row scale tests remain synthetic.

The later private operation requires exact owner review of source versions,
digests, retrieval metadata, terms, attribution, retention/deletion/export
controls, policy compatibility, and all six canonical artifacts plus fresh
single-use authorization. It must keep all private artifacts, source bytes,
credentials, paths, row-level mappings, rejected rows, generated snapshot,
measurement inputs, and runner/retry/cleanup material out of Git and public
logs. Neither Cycle 3e-a1 source nor synthetic evidence accepts or promotes
Cycle 3e-a.

#### Cycle 3e-a2 — package-owned security-master measurement clock

Status: **Recorded public engineering Pass only for exact merge-free source
revision `8c2166fa01f5e1f471887ccdeb9484b132a02bb0` and routing closure
`0374becdf96c1e9891d80e73024c8be0440fd812`. No real source, snapshot,
breadth, declared-hardware latency, private operation, Cycle 3e-a acceptance/
promotion, or parity is recorded.** See
[ADR 0059](./adr/0059-package-owned-security-master-measurement-clock.md) and the
[Cycle 3e-a2 exit matrix](./CYCLE_3E_A2_EXIT_MATRIX.md).

The source revision passed 2,058 local tests with 9 intentional skips. Its
attempt-1 CI run `33816810188` passed Windows job `100850647775` and Ubuntu job
`100850648064`; custody run `33816810200`/job `100850647942`, normalization run
`33816810227`/job `100850647938`, cross-engine run `33816810267`/job
`100850648210`, and parser-isolation run `33816810173`/job `100850647900` also
passed. Its final independent review was clean after the timed-region AST-order
blocker was corrected before commit.

The sole routing child passed 2,060 local tests with 9 intentional skips and
clean independent review. Its attempt-1 CI run `33823588896` passed Windows job
`100871341851` and Ubuntu job `100871342201`; custody run `33823588891`/job
`100871342729`, parser-isolation run `33823588916`/job `100871341920`, and
cross-engine run `33823588901`/job `100871342184` also passed. No routing-tip
normalization run was triggered or required because the exact five-path routing
transition did not match that workflow's path filters.

The correction makes
`measurePersonalSecurityMasterSearchP95(catalog, input)` the exact two-argument
public and runtime API. A third argument fails immediately with
`PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID`; a hostile callback cannot run.
The package privately captures bound `performance.now` from
`node:perf_hooks` as `READ_MONOTONIC_MILLISECONDS` and uses it around only request
normalization plus in-memory catalog search.

Both `PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN` and the immutable measurement
receipt bind
`clock: "module_captured_node_perf_hooks_performance_now_monotonic"` and
`timedRegion: "normalize_request_and_search_in_memory_catalog"`. Focused hostile
tests and `personalSecurityMasterMeasurementBoundaryViolation` statically guard
the clock capture, exact arity, timed region, receipt fields, and absence of an
alternate caller timing seam.

This is a repository-controlled integrity correction, so no real source
operation was needed to verify it. Its recorded public source and synthetic
timing establish no real catalog, breadth, declared-hardware latency, below-200-
ms result, owner authorization, Cycle 3e-a acceptance/promotion, or feature
parity. A later owner-only operation still requires fresh exact authorization.

The delivery waves are:

1. **Usable personal core — Cycles 3a–3g:** authenticated owner session,
   authenticated personal dossier composition, connected-personal source
   policy, durable local vault, security master/search/watchlists, automated
   SEC filing refresh, and one licensed market-data/chart adapter.
2. **Research breadth — Cycles 3h–3k:** ten-year statements and a versioned
   metric registry, transparent multi-model valuation, peers/quality/risk
   scores, and a typed screener with saved views.
3. **Daily operating workflow — Cycles 3l–3o:** earnings/dividends/news/events,
   portfolio analytics, background delivered alerts, and reproducible
   reports/exports/custom views.
4. **Optional intelligence and polish — Cycles 3p–3q:** evidence-grounded AI
   and strategy research, then an installable personal app with accessibility,
   performance, restore, and soak gates.

Every displayed or exported number must retain source, period, unit,
observed/known-at chronology, rights policy, and an evidence passport. Every
derived number must retain its versioned formula and exact inputs. Missing,
stale, conflicting, unsupported, or quarantined data must remain explicit;
there is no silent fallback. Where the source policy permits retention,
network results must be replayable from immutable local snapshots. Otherwise,
the application retains only permitted request/source metadata, digests, and
normalized derived evidence, marks the result non-replayable, and does not
admit a feature whose required audit cannot be achieved. Credentials or
private evidence must never enter Git, fixtures, logs, or public CI.

The planned common-stock gap mapping, dependencies, numerical breadth
objectives, exit criteria, nonclaims, and release order are maintained in the
[personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md).
