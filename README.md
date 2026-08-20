# Research Cockpit

An evidence-first investment research workspace being built from the audited product plan. `Research Cockpit` is an internal working name and is not trademark-cleared.

## Current slice

Sprint 0 is a zero-infrastructure demo that proves:

- a synthetic company dossier with “as known on” fact supersession and
  separately named public-knowledge/database-recorded intervals (the current
  demo still uses one cutoff for both axes);
- server-side rights filtering and explicit omissions;
- an evidence passport for every displayed number;
- deterministic valuation scenarios;
- browser-local, non-sensitive thesis and alert state; and
- an original responsive interface with semantic chart alternatives.

It uses **only deterministic synthetic data**. It does not call market-data providers, SEC, Investing.com, news sites, LLMs, brokers, payment services, or external notification providers.

Cycle 1a also includes a disconnected synthetic tenant/authorization module and
a statically checked PostgreSQL migration contract. They are development proof
artifacts only: at that cycle's exit the running API remained GET-only, browser
state remained local, and no database or identity provider was connected.

Cycle 1c source now composes only two seeded in-memory update operations:
`PUT /v1/theses/{thesisId}` and `PUT /v1/alerts/{alertId}`. They require a
public, non-secret synthetic persona selector, a strong `If-Match`, and an
operation-scoped `Idempotency-Key`, and they accept only an exact loopback
peer. Browser thesis/alert state remains local; no PostgreSQL adapter or
identity provider is connected. **Implemented and verified only for the bounded
synthetic loopback source/test contract; not remote/live-engine or production
evidence.** The full frozen-byte local release gate and two-OS CI run
`32401541724` passed on exact commit
`84f6b92163e93fa8c5c079a786e49f8134b81f56`. The separate PostgreSQL run
`32401541467` is unchanged V14 regression health only; it is not Cycle 1c
engine evidence, B15/V15, or a replacement for the canonical B14 result at
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`. Production admission remains
blocked. See
[ADR 0027](./docs/adr/0027-loopback-synthetic-persona-research-state-api.md)
and the [Cycle 1c exit matrix](./docs/CYCLE_1C_EXIT_MATRIX.md).

Cycle 1b-a moves history, timeline, and evidence membership into
instrument-scoped snapshots and freezes a separate operation-scoped port for an
RLS reader. That port cannot claim complete coverage or disclose hidden row
counts. B9 now has a separately live-reviewed database-package implementation,
but the running app remains disconnected and continues to use only the closed
SYN1 fixture.

Cycle 1b-a2 adds a pure, fail-closed normalizer for the narrow synthetic,
dimensionless financial-fact row shape the later B9 adapter now supplies to the
normalizer.
It separates listing and security identity, preserves decimals and timestamps
without rounding or precision loss, and rejects an entire ambiguous batch. It
does not add the query, driver, pool, or app wiring.

Cycle 1b-b1 adds an executable, clean-database PostgreSQL acceptance harness
for a separate Ubuntu CI job. It atomically renders the seven reviewed
migrations and ledger records, loads only source-controlled synthetic fixtures,
and probes impersonated capability-role/RLS semantics against one exact
PostgreSQL 17.11 image digest. A green run writes and uploads a
success-only, exact-schema record bound to the commit, GitHub run, reviewed
inputs, observed versions, completed checks, and explicit limitations. The
first reviewed run passed at commit `611c93d`; its retained run record is linked
in [the Cycle 1b-b1 evidence note](./docs/POSTGRESQL_ACCEPTANCE_EVIDENCE.md).
The harness remains disconnected from the app and is not deployed persistence.

The final local Cycle 1b-b1 review gate verifies a downloaded run record against
independently supplied repository/run/hash anchors and fixed source blobs read
from its exact Git commit. Its only success verdict is `offline_consistent`;
it cannot authenticate GitHub, inspect logs, or independently prove PostgreSQL
executed. The first retained artifact produced that verdict after the linked run
and logs were reviewed separately.

Cycle 1b-b2 proves one additional, bounded PostgreSQL contract. At commit
`3479e164`, an ephemeral runtime service account authenticated with SCRAM over
loopback TCP inside the isolated service container, then explicitly assumed
only the existing read-only runtime capability. The reviewed run and retained
version 2 record are linked in the
[Cycle 1b-b2 evidence note](./docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). This did
not add an application driver or pool, expose a database port, authenticate an
end user, or prove external TLS, production secrets,
migrator/test-loader/backup authentication, restore, or deployment readiness.
At B2 the distinct-migrator boundary remained separate because PostgreSQL 17
role creation conflicts with migration `0001`'s zero-membership bootstrap
invariant; B7 addresses only the bounded redesign recorded below.

Cycle 1b-b3 now has a reviewed live result at commit `664c0e5b`. While the same
ephemeral b2 login was active, the acceptance harness reran the reviewed alpha/
beta tenant visibility, inactive and non-current membership, direct/join/
subquery isolation, operation-rights, and alternating prepared-read assertions
through the SCRAM-authenticated session with transaction-local runtime role
selection. Run `31991498652` produced a version 3 success record that returned
`offline_consistent` against separately supplied anchors. B3 changes no
migration, capability role, application dependency, network exposure, driver,
pool, or composition root, and it does not promote b1's additional
null/malformed/unsupported-context cases. See the
[Cycle 1b-b3 evidence note](./docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[exit matrix](./docs/CYCLE_1BB3_EXIT_MATRIX.md), and
[ADR 0015](./docs/adr/0015-authenticated-runtime-authorization-matrix.md).

Cycle 1b-b4 is complete for its bounded recorded scope. It adds one
parameterized, operation-specific listing-to-financial-fact PostgreSQL query, a
closed semantic unit mapping, a 100-row fail-closed result bound, and
integration with the existing row normalizer through the authenticated
container-local `psql` path.
It is deliberately driverless: no pool, API/web import, app composition, write
path, migration, or real data is included. It also adds no external
runtime/development dependency, database-driver dependency, package-manifest
dependency change, or lockfile change. The pinned PostgreSQL run passed and its
version 4 artifact returned `offline_consistent`; see the
[B4 evidence note](./docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[ADR 0016](./docs/adr/0016-driverless-projection-query-and-semantic-unit-mapping.md)
and the [Cycle 1b-b4 exit matrix](./docs/CYCLE_1BB4_EXIT_MATRIX.md).

Cycle 1b-b5 is complete for its bounded recorded scope at commit `04e5c1b`.
The unchanged reviewed fixture was loaded through one ephemeral,
acceptance-only SCRAM login with one exact non-inheriting, non-admin, set-only
edge to the existing test-seed capability. The pinned PostgreSQL run and
version 5 record passed independent review and returned `offline_consistent`.
B5 adds no production or external authentication, TLS, managed secret system,
driver, pool, concurrent loader, migrator, backup/restore, real data, or app
integration. See the
[B5 evidence note](./docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./docs/adr/0017-authenticated-test-loader-fixture-load.md), and the
[Cycle 1b-b5 exit matrix](./docs/CYCLE_1BB5_EXIT_MATRIX.md).

Cycle 1b-b6 is complete for its bounded recorded scope at commit `7aac502`.
One ephemeral, acceptance-only SCRAM login received one exact non-inheriting,
non-admin, set-only edge to the existing owner capability. The reviewed run
proved pre-role denial, rejected the reviewed forbidden role and
session-authorization transitions, and exercised transaction-local owner
selection, rollback and committed-create behavior for one fixed DDL object,
authenticated removal, ledger immutability, role reset, and zero residue.
PostgreSQL run `32058853521` produced a retained version 6 record that returned
`offline_consistent`. B6 did not execute a migration or close
`authenticated_migrator_sessions`; that versioned platform/application gap was
reserved for B7 and is closed only for the bounded result below.
See the [B6 evidence note](./docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./docs/adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./docs/CYCLE_1BB6_EXIT_MATRIX.md).

Cycle 1b-b7 is complete for its bounded recorded scope at commit `41d13dd`.
PostgreSQL run `32068159652` produced a retained version 7 record that returned
`offline_consistent` against separately supplied anchors. The reviewed path
keeps the historical b1 through b6 plan as regression-only input, then resets
the exact disposable database and four capability roles before a new, closed
v2 platform/application plan. The container-superuser platform phase creates
the roles, owner-owned schemas, database/schema/public ACL lockdown, and
hardened `btree_gist` installation. A distinct ephemeral non-superuser then
authenticates with SCRAM, selects only the owner capability, and applies the
complete role-neutral application plan with login-attributed ledger rows,
rollback/replay checks, and mandatory zero-residue cleanup. This does not prove
a production or incremental migrator, external/TLS identity, managed secrets,
cross-phase atomicity, backup/restore, concurrency, a driver or pool, real data,
or deployment readiness. See the
[B7 evidence note](./docs/POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](./docs/adr/0019-versioned-authenticated-migration-phase.md), and the
[Cycle 1b-b7 exit matrix](./docs/CYCLE_1BB7_EXIT_MATRIX.md).

Cycle 1b-b8 is complete for its bounded recorded scope at commit `49d3a96`.
PostgreSQL run `32076642878` produced a retained version 8 record that returned
`offline_consistent` against separately supplied anchors. One ephemeral SCRAM
login selected only the existing `NOBYPASSRLS` backup capability to create a
custom, policy-scoped, column-insert, data-only archive of the 21 reviewed
synthetic application data tables; the migration ledger was excluded. A
different ephemeral SCRAM login selected only the test-seed capability to
restore that archive in one transaction into a same-cluster database created
from `template0` and independently provisioned with the reviewed platform and
exact v2 application plan. The run covered transactional failure rollback,
successful restore, replay denial, fingerprint/catalog/authorization
equivalence, source isolation, and mandatory zero-residue cleanup. It does not
cover full-schema/global or cross-cluster/version restore,
production/incremental/continuous backup, storage encryption/retention,
disaster recovery, or RPO/RTO. See the
[B8 evidence note](./docs/POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./docs/adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md),
and the [Cycle 1b-b8 exit matrix](./docs/CYCLE_1BB8_EXIT_MATRIX.md).

Cycle 1b-b9 is complete for its bounded recorded scope at commit `8e470e9`. It
adds one non-owning,
exclusively leased single-client, read-only `pg` implementation of
`OperationScopedProjectionSource<FinancialFact>`. A trusted synthetic actor is
injected outside the query; every load first resets transaction state, then
uses transaction-local runtime role and request context; and the adapter reuses
the reviewed B4 query and fail-closed normalizer. PostgreSQL run `32083732063`
used one real SCRAM-authenticated client through a random loopback-only workflow
mapping, proved a pre-existing read-write transaction was rolled back rather
than committed, then closed and drained the client before writing version 9
evidence. The retained record returned `offline_consistent` against separately
supplied anchors. B9 adds no pool, app/API import, identity resolver, production
secret handling, external/TLS path, concurrency, cancellation, or timeout
claim. See the
[B9 evidence note](./docs/POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./docs/adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](./docs/CYCLE_1BB9_EXIT_MATRIX.md).

Cycle 1b-b10 is complete for its bounded recorded scope. Its accepted source,
`PooledPostgresFinancialFactProjectionSource`, owns one explicitly transferred,
real `pg.Pool` bounded to two clients and reimplements the exact B9
read-only role/context/B4-query transaction for each checkout. The design
snapshots the query and trusted synthetic actor before checkout, bounds pool
acquisition and PostgreSQL `statement_timeout`, and recycles a client only after
successful preflight, transaction, and postflight cleanup. Active abort marks
cancellation, waits for the in-flight operation to settle under the fixed
server timeout, then destroys the checkout; ambiguous or timed-out checkouts are
also never reused. The source closes the owned pool idempotently after registered
work settles. Source and local verification are complete: all 12 database test
files and 485 tests, database typechecking, migration and PostgreSQL static
guardrails, focused ESLint/Prettier, and the diff check pass; independent
integrated review reports GO with no P0/P1 finding. The bounded live path passed
in PostgreSQL run `32161137775` at commit `2dcb259`; its retained version 10
record returned `offline_consistent`. See the
[B10 evidence note](./docs/POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./docs/adr/0022-bounded-postgresql-projection-pool-lifecycle.md), and
the [Cycle 1b-b10 exit matrix](./docs/CYCLE_1BB10_EXIT_MATRIX.md).

Cycle 1b-b11 source, integrated local verification, and bounded live V11 review
are complete. `PostgresMigrationDeployer` snapshots the exact closed v2 plan
before I/O and runs one pending suffix through an exclusively leased,
authenticated client. One read-write transaction applies finite statement and
lock timeouts, the reviewed advisory lock, transaction-local owner selection,
an exact ledger-table lock, identity/ledger-shape checks, exact ordered-prefix
validation, pending reviewed bodies, and matching ledger rows. Checksum, file,
order, shape, or extra-row drift fails through a stable value-free boundary.
Injected failure rolls the pending body and ledger row back; a current ledger
is a no-op; ambiguous cleanup poisons the deployer. The reviewed live gate
reconstructed only the exact `v2-0005` prefix and used two loopback clients to
prove one applied `v2-0006` while the other observed current state. PostgreSQL
run `32183709701` passed at commit `5df9d07`; its retained version 11 record
returned `offline_consistent`. See the
[B11 evidence note](./docs/POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md),
[ADR 0023](./docs/adr/0023-locked-postgresql-migration-ledger-deployment.md),
and the [Cycle 1b-b11 exit matrix](./docs/CYCLE_1BB11_EXIT_MATRIX.md).

Cycle 1b-b12 is complete for one deterministic RLS query-plan and bounded
2,000-read load gate. The fixed source module and fixture cover the existing B4
fact-as-known shape plus one tenant thesis read. Authenticated forced-RLS plans
used `financial_facts_as_known` and `theses_by_instrument` without disabling
sequential scans or creating an acceptance-only index. Exactly 1,000 fact and
1,000 tenant promises were submitted before one barrier release through a pool
and login both bounded to eight connections. The first eight runtime workload
backends were observed together; a separately connected out-of-band
administrator observed them but executed none of the 2,000 workload reads. The
submissions were not 2,000 connections. PostgreSQL run `32230667908` passed at
commit `59c4e58`; its retained V12 record returned `offline_consistent`. See the
[B12 evidence note](./docs/POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./docs/adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./docs/CYCLE_1BB12_EXIT_MATRIX.md).

Cycle 1b-b13 now freezes an accepted technical privacy/retention model and a
separate empty-only, synthetic keyed-resource-identifier lifecycle. Deleted
registry allocations clear raw tenant/resource UUIDs while retaining a
pseudonymous domain/type/token tombstone; a fixed authenticated capability
performs that single-resource transition, offboarding blocks new allocations,
and fixed procedures bound online tenant purge and expired audit/idempotency
cleanup. Token MAC keys remain behind an external provider, and PostgreSQL does
not verify HMAC authenticity. The source and V13 evidence contract do not
constitute production privacy/legal approval. Production admission remains
blocked. PostgreSQL run `32305478242` passed the exact bounded synthetic path
at commit `a959cba`; its retained V13 record returned `offline_consistent`. See
the [B13 evidence note](./docs/POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./docs/adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](./docs/CYCLE_1BB13_EXIT_MATRIX.md).

Cycle 1b-b14 now adds the source contract for one bounded synthetic populated
cutover from the exact v2 pre-`0005` branch to the B13 keyed lifecycle. A
temporary audited work registry captures post-boundary thesis/alert inserts
and deletes while authenticated bounded backfill is open; an exact capture
epoch and short final write-conflicting barrier gate target validation and
contract. The acceptance actors are test-only and the design neither recovers
identifiers deleted before capture nor proves a production writer/dual-write
protocol, uninterrupted writes, crash/failover recovery, production scale, or
real-data safety. PostgreSQL run `32343225599` passed the exact bounded
synthetic path at commit `d688aa21e969feef6611f6efcd1aeaaed6e31df9`;
its retained V14 record returned `offline_consistent`. The final catalog check
is semantic rather than physical equivalence to B13. See the
[B14 evidence note](./docs/POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./docs/adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](./docs/CYCLE_1BB14_EXIT_MATRIX.md).

Pool transfer is exclusive: after construction the caller may not call
`connect()`, query or release a client, call `end()`, or otherwise inspect or use
the pool while the source owns it. Only read-only counters may be inspected
after `source.close()` completes. The reviewed live reset proof therefore uses
only an out-of-band administrative observer for same-PID idle/application/user/
advisory-lock state, followed by a source-owned actor-isolated load and the
timeout/application-name probes. Custom-GUC and prepared-statement cleanup are
source, unit, and static `DISCARD ALL` evidence, not direct live inspection.

## Requirements

- Node.js 24.19.x
- pnpm 11.19.0

## Run

```powershell
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open `http://localhost:3000/research/SYN1`. The API listens on `http://localhost:3100`.

## Verify

```powershell
pnpm verify
```

The release gate checks formatting, lint, clean-room/database boundaries,
fixture and migration hashes, the acceptance-harness declaration, production
licenses, strict types, tests, and both production builds. CI runs the same gate
on Windows and Linux. The digest-pinned Ubuntu PostgreSQL workflow and both CI
platforms passed for the b1 commit `611c93d` and the bounded b2 commit
`3479e164`. B1 remains clean-only impersonated-capability evidence. B2
additionally proves only one container-local SCRAM runtime service account; it
does not substitute for end-user or production identity, concurrent pool
behavior, dump/restore, or deployment readiness. B3's broader authenticated
tenant/rights/prepared-read matrix passed in PostgreSQL run `31991498652` at
commit `664c0e5b`; its retained version 3 record returned `offline_consistent`.
B4's driverless query-to-normalizer path passed in run `32007521395`. B5's
authenticated fixture-load path passed in run `32012508025` at commit
`04e5c1b`; its retained version 5 record returned `offline_consistent`. B6's
bounded owner-DDL canary passed in run `32058853521` at commit `7aac502`; its
retained version 6 record also returned `offline_consistent`. B7's bounded
authenticated application-migration path passed in run `32068159652` at
commit `41d13dd`; its retained version 7 record returned
`offline_consistent`. B8's bounded authenticated policy-scoped dump and clean
restore passed in run `32076642878` at commit `49d3a96`; its retained version 8
record returned `offline_consistent`. B9's single-client adapter passed in run
`32083732063` at commit `8e470e9`; its retained version 9 record also returned
`offline_consistent`. B10's bounded two-client pool lifecycle passed in run
`32161137775` at commit `2dcb259`; its retained version 10 record returned
`offline_consistent`. B11's locked migration-ledger deployment passed in run
`32183709701` at commit `5df9d07`; its retained version 11 record returned
`offline_consistent`. B12's bounded query-plan/load path passed in run
`32230667908` at commit `59c4e58`; its retained version 12 record returned
`offline_consistent`. These remain bounded, synthetic acceptance results. The
offline verifier checks record/source consistency after download but cannot
authenticate the GitHub run or independently prove PostgreSQL execution.
B13's synthetic privacy/retention lifecycle passed separately in PostgreSQL run
`32305478242` at commit `a959cba`; its retained version 13 record returned
`offline_consistent`. B14's bounded synthetic populated cutover passed in
PostgreSQL run `32343225599` at commit
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`; its retained version 14 record
also returned `offline_consistent`. Production privacy/legal admission remains
blocked.

## Safety boundary

- Synthetic records declare provenance and a rights policy.
- Restricted facts are removed before API serialization.
- Financial values cross domain/API boundaries as decimal strings.
- Browser-local state is for demonstration only and must not contain real holdings or personal information.
- Production data, identity, billing, persistence, SEC ingestion, external alerts, and AI remain gated work.
- Synthetic tests and a clean-only acceptance run are not production authentication or deployed-persistence evidence.
- The proved container-local database service-account boundary does not
  establish end-user identity, external/TLS transport, managed
  secrets, pool safety, or production authorization.
- The reviewed b3 authenticated matrix does not establish a trusted end-user or
  tenant binding, an external/TLS path, production secrets, pool safety,
  concurrent behavior, restore viability, or deployed persistence.
- The reviewed B5 run is limited to one ephemeral acceptance-only synthetic
  loader; it does not establish production/external authentication, TLS, secret
  operations, concurrent loading, an authenticated migrator or backup, restore,
  real-data ingestion, or application integration.
- The reviewed B6 result is only an authenticated owner-DDL canary. It applies
  no migration, does not redesign role bootstrap, and does not authorize a
  production owner or migrator login.
- The reviewed B7 result separates a local container-superuser platform phase
  from an acceptance-only authenticated application migration phase. It cannot
  authorize production/incremental migration or make the two phases globally
  atomic.
- The reviewed B8 result covers only RLS-visible synthetic application data
  restored inside the same ephemeral cluster. It is not a full backup,
  production schedule, encrypted/retained archive, disaster-recovery plan, or
  RPO/RTO result.
- The reviewed B9 result establishes only a sequential, non-owning read adapter
  over one exclusively leased client and its fail-closed transaction-reset
  contract. It does not establish end-user identity, pool safety,
  application composition, external/TLS transport, managed secrets,
  concurrency, cancellation, timeouts, or production readiness.
- The reviewed B10 result is limited to a runner-local, two-client pool with
  bounded acquisition, settlement-before-discard active abort, server-timeout
  recovery, destructive failure discard, idempotent close, and zero observed
  residue. It does not prove
  graceful PostgreSQL cancellation, prompt cancellation while queued, reuse of
  a canceled backend, production pool tuning, load capacity, retry/failover,
  identity, application composition, or production readiness.
- B11 passed only one exact v2 suffix through two container-local authenticated
  deployers. It does not prove external/production migrator credentials,
  arbitrary or multi-release upgrades, application compatibility under live
  writes, crash recovery, cancellation, distributed coordination, global
  platform/application atomicity, or production readiness.
- B12 passed only its exact synthetic two-plan, 2,000-submission gate. It
  uses at most eight runtime workload backends plus a separate administrator
  observer and does not prove 1,000 or 2,000 simultaneous connections,
  production capacity/SLOs or pool tuning/failover,
  plan stability across other data/statistics/hardware/versions, real data,
  application composition, or production readiness.
- B13 passed only its exact synthetic-only, empty-data-only keyed-identifier
  lifecycle. It does not provide
  production privacy/legal approval, verified-subject DSAR or legal-hold
  handling, an operating offboarding scheduler, KMS/HSM custody or token
  verification, deletion across online/backup/third-party planes, populated
  migration/cutover, cryptographic erasure, global deletion proof, or
  real-customer-data admission.
- B14 passed only its exact bounded synthetic populated-cutover sequence in
  one disposable database. It does not establish production
  application-writer integration or authorization, a dual-write/allocation-gap
  protocol, continuous zero downtime, production duration/SLO/lock budgets,
  crash/restart/failover/downgrade behavior, recovery of identifiers deleted
  before capture, physical catalog equivalence, or permission for real tenant
  or personal data.
- Cycle 1c adds only two update-only seeded in-memory routes on an exact
  loopback boundary. Its public persona selectors are not credentials; it does
  not establish end-user authentication, general BOLA protection, external
  network safety, PostgreSQL/RLS or durable persistence, production writer
  integration, browser-state migration, load/operational readiness,
  privacy/legal controls, or permission for real data.

See [the sanitized product brief](./docs/SANITIZED_PRODUCT_BRIEF.md),
[threat model](./docs/THREAT_MODEL.md), [next build cycles](./docs/BUILD_ROADMAP.md),
[canonical model](./docs/CANONICAL_MODEL.md),
[Cycle 1b-a exit matrix](./docs/CYCLE_1BA_EXIT_MATRIX.md),
[Cycle 1b-a2 exit matrix](./docs/CYCLE_1BA2_EXIT_MATRIX.md),
[Cycle 1b-b1 exit matrix](./docs/CYCLE_1BB1_EXIT_MATRIX.md),
[Cycle 1b-b2 exit matrix](./docs/CYCLE_1BB2_EXIT_MATRIX.md),
[Cycle 1b-b2 evidence note](./docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md),
[Cycle 1b-b3 exit matrix](./docs/CYCLE_1BB3_EXIT_MATRIX.md),
[Cycle 1b-b3 evidence note](./docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[Cycle 1b-b4 exit matrix](./docs/CYCLE_1BB4_EXIT_MATRIX.md),
[Cycle 1b-b4 evidence note](./docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[Cycle 1b-b5 exit matrix](./docs/CYCLE_1BB5_EXIT_MATRIX.md),
[Cycle 1b-b5 evidence note](./docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[Cycle 1b-b6 exit matrix](./docs/CYCLE_1BB6_EXIT_MATRIX.md),
[Cycle 1b-b6 evidence note](./docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[Cycle 1b-b7 exit matrix](./docs/CYCLE_1BB7_EXIT_MATRIX.md),
[Cycle 1b-b7 evidence note](./docs/POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[Cycle 1b-b8 exit matrix](./docs/CYCLE_1BB8_EXIT_MATRIX.md),
[Cycle 1b-b8 evidence note](./docs/POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./docs/adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md),
[Cycle 1b-b9 exit matrix](./docs/CYCLE_1BB9_EXIT_MATRIX.md),
[Cycle 1b-b9 evidence note](./docs/POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./docs/adr/0021-single-client-read-only-postgresql-projection-adapter.md),
[Cycle 1b-b10 exit matrix](./docs/CYCLE_1BB10_EXIT_MATRIX.md),
[Cycle 1b-b10 evidence note](./docs/POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./docs/adr/0022-bounded-postgresql-projection-pool-lifecycle.md),
[Cycle 1b-b11 exit matrix](./docs/CYCLE_1BB11_EXIT_MATRIX.md),
[Cycle 1b-b11 evidence note](./docs/POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md),
[ADR 0023](./docs/adr/0023-locked-postgresql-migration-ledger-deployment.md),
[Cycle 1b-b12 exit matrix](./docs/CYCLE_1BB12_EXIT_MATRIX.md),
[Cycle 1b-b12 evidence note](./docs/POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./docs/adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md),
[Cycle 1b-b13 exit matrix](./docs/CYCLE_1BB13_EXIT_MATRIX.md),
[Cycle 1b-b13 evidence note](./docs/POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./docs/adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md),
[Cycle 1b-b14 exit matrix](./docs/CYCLE_1BB14_EXIT_MATRIX.md),
[Cycle 1b-b14 evidence note](./docs/POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./docs/adr/0026-bounded-populated-resource-identifier-online-cutover.md),
[Cycle 1c exit matrix](./docs/CYCLE_1C_EXIT_MATRIX.md),
[ADR 0027](./docs/adr/0027-loopback-synthetic-persona-research-state-api.md),
and [architecture decisions](./docs/adr/).
