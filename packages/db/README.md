# PostgreSQL security contract and acceptance harness

> **B1-B13 CLEAN-ONLY LIVE ACCEPTANCE PASSED ONLY FOR THEIR RECORDED BOUNDED SYNTHETIC SCOPES; B14 BOUNDED POPULATED-CUTOVER LIVE ACCEPTANCE PASSED ONLY FOR ITS RECORDED SYNTHETIC SCOPE; B13 IS PRISTINE/EMPTY-DATA-ONLY, B14 IS ONE FIXED POPULATED CUTOVER, AND PRODUCTION ADMISSION REMAINS BLOCKED — NOT DEPLOYED PERSISTENCE**

This package contains forward SQL, static security checks, and a synthetic
acceptance harness with clean-bootstrap and bounded cutover branches for the
future PostgreSQL persistence boundary.
The seven migrations and b1 probes passed in the first reviewed run against the
pinned PostgreSQL 17.11 service at commit `611c93d`; see the
[retained evidence note](../../docs/POSTGRESQL_ACCEPTANCE_EVIDENCE.md). That run
is bounded engine evidence for its recorded checks. It does not prove backup
viability, production or end-user authentication, pooling, concurrency,
real-data behavior, or production readiness.

Cycle 1b-b2 is implemented in the acceptance harness. Its verified live status
is recorded only in the linked exit matrix and any retained evidence note; the
source alone makes no live claim. Its scope is one ephemeral runtime service account using
SCRAM over loopback TCP inside the existing unexposed PostgreSQL container. It
does not change the running application or establish production authentication.
The first reviewed b2 run passed at commit `3479e164`; see the
[runtime-authentication evidence note](../../docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md).

Cycle 1b-b3 preserves the b1 impersonated-capability regression path and
repeats the reviewed alpha/beta tenant visibility, inactive and non-current
membership, direct/join/subquery isolation, operation-rights, and alternating
prepared-read assertions through the b2 SCRAM login with transaction-local
runtime role selection. That exact matrix passed in PostgreSQL run
`31991498652` at commit `664c0e5b`; the downloaded version 3 success record
returned `offline_consistent` against separately supplied anchors. See the
[evidence note](../../docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[ADR 0015](../../docs/adr/0015-authenticated-runtime-authorization-matrix.md),
and the [Cycle 1b-b3 exit matrix](../../docs/CYCLE_1BB3_EXIT_MATRIX.md).

Cycle 1b-b4 executes one driverless, operation-specific financial-fact query
through that SCRAM login and passes its untrusted JSON-lines output through the
all-or-nothing normalizer. The exact B4 path passed in PostgreSQL run
`32007521395` at commit `55c61ec`; the downloaded version 4 success record
returned `offline_consistent` against separately supplied anchors. See the
[B4 evidence note](../../docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[ADR 0016](../../docs/adr/0016-driverless-projection-query-and-semantic-unit-mapping.md),
and the [Cycle 1b-b4 exit matrix](../../docs/CYCLE_1BB4_EXIT_MATRIX.md).

Cycle 1b-b5 preserves the historical fixture and migrations byte-for-byte and
adds an isolated authenticated loader lifecycle around the fixture's strictly
validated direct-insert body. One ephemeral acceptance-only SCRAM login may
assume only `research_cockpit_test_seed` through an exact set-only,
non-inheriting, non-admin membership, then must be removed with zero residue.
That exact path passed in PostgreSQL run `32012508025` at commit `04e5c1b`; the
downloaded version 5 record returned `offline_consistent` against separately
supplied anchors. See the
[B5 evidence note](../../docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](../../docs/adr/0017-authenticated-test-loader-fixture-load.md) and
the [Cycle 1b-b5 exit matrix](../../docs/CYCLE_1BB5_EXIT_MATRIX.md).

Cycle 1b-b6 adds a separate preparatory owner-DDL canary after the unchanged
bootstrap and test-loader cleanup. One ephemeral SCRAM login receives only an
exact set-only, non-inheriting, non-admin edge to `research_cockpit_owner`. It
proves wrong-password and pre-role denial, forbidden role/session escalation,
transaction-local owner identity, injected DDL rollback, one committed canary
with exact owner and ACL, authenticated removal, ledger immutability, role
reset, and exhaustive authentication/object cleanup before the existing catalog
and evidence checks. That exact path passed in PostgreSQL run `32058853521` at
commit `7aac502`; the downloaded version 6 record returned
`offline_consistent` against separately supplied anchors. B6 applies no
migration and leaves `authenticated_migrator_sessions` unproven. See the
[B6 evidence note](../../docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](../../docs/adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](../../docs/CYCLE_1BB6_EXIT_MATRIX.md).

Cycle 1b-b7 introduces new versioned migration-plan sources without changing
the historical manifest or seven historical bodies. Those legacy inputs remain
b1 through b6 regressions only. After an exact reset of the disposable database
and capability roles, the B7 platform phase runs locally as the container superuser and
creates the fixed roles, owner-owned schemas, database/schema/public ACL
lockdown, and hardened `btree_gist` installation. A separate ephemeral,
non-superuser SCRAM login may then select only `research_cockpit_owner` and
execute the closed role-neutral application plan. That path passed in
PostgreSQL run `32068159652` at commit `41d13dd`; the downloaded version 7
record returned `offline_consistent` against separately supplied anchors. The
reviewed record binds the platform plan, exact application manifest and bodies,
and authenticated renderer. See the
[B7 evidence note](../../docs/POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](../../docs/adr/0019-versioned-authenticated-migration-phase.md), and
the [Cycle 1b-b7 exit matrix](../../docs/CYCLE_1BB7_EXIT_MATRIX.md).

Cycle 1b-b8 is complete for its bounded recorded scope. Its first phase used an
ephemeral SCRAM login with one exact set-only edge to
`research_cockpit_backup` to create a custom, RLS-enabled, column-insert,
data-only archive of the 21 reviewed synthetic application data tables;
`shared_data.schema_migrations` data was excluded. Its second phase created a
separate database from `template0` in the same pinned cluster, applied the
reviewed restore platform and exact v2 application migrations, and used a
different ephemeral SCRAM login with one exact set-only test-seed edge to
restore the archive in one transaction. PostgreSQL run `32076642878` at commit
`49d3a96` covered transactional failure rollback, successful restore, replay
denial, source/target fingerprints, catalog and authorization equivalence,
source isolation, and zero residue. Its retained version 8 record returned
`offline_consistent` against separately supplied anchors. This does not prove a
full-schema/global, cross-cluster/version, production/incremental/continuous,
encrypted/retained, disaster-recovery, or RPO/RTO backup. See the
[B8 evidence note](../../docs/POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](../../docs/adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md),
and the [Cycle 1b-b8 exit matrix](../../docs/CYCLE_1BB8_EXIT_MATRIX.md).

Cycle 1b-b9 is complete for its bounded recorded scope. PostgreSQL run
`32083732063` at commit `8e470e9` exercised one real `pg@8.23.0` client and its
retained version 9 record returned `offline_consistent` against separately
supplied anchors. The package contains one
non-owning, exclusively leased single-client, read-only `pg` implementation of
the frozen core projection port. It snapshots a trusted synthetic actor outside
the operation query, resets transaction state before each read-only
role/context transaction, bridges the exact one-text-column driver result into
the reviewed B4 normalizer, rolls back on failure, poisons after unsafe reset or
rollback failure, and rejects overlap before SQL. It does not own connection
configuration or lifecycle and is not imported by an app. See the
[B9 evidence note](../../docs/POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](../../docs/adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](../../docs/CYCLE_1BB9_EXIT_MATRIX.md).

Cycle 1b-b10 is complete for its bounded recorded scope. Its accepted source,
`PooledPostgresFinancialFactProjectionSource`, owns one explicitly transferred,
real `pg.Pool` fixed at maximum two clients, with finite checkout
and positive server statement timeouts and no client `query_timeout`. It
snapshots the complete query and trusted synthetic actor before checkout,
establishes a clean session, reimplements the exact B9 read-only
role/context/B4-query transaction, and recycles only an unambiguously successful
checkout after postflight reset. Adapter failure, timeout, failed transaction,
or cleanup ambiguity destroys the checkout. An active abort marks cancellation,
waits for the in-flight PostgreSQL operation to settle under the fixed server
statement timeout, and then destroys rather than recycles the checkout.
`close()` rejects new
work, waits for registered loads, and ends the owned pool exactly once. Source
and local verification are complete: all 12 database test files and 485 tests,
database typechecking, migration and PostgreSQL static guardrails, focused
ESLint/Prettier, and the diff check pass; independent integrated review reports
GO with no P0/P1 finding. PostgreSQL run `32161137775` passed at commit
`2dcb259`; the retained version 10 record returned `offline_consistent`. See the
[B10 evidence note](../../docs/POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](../../docs/adr/0022-bounded-postgresql-projection-pool-lifecycle.md),
and the [Cycle 1b-b10 exit matrix](../../docs/CYCLE_1BB10_EXIT_MATRIX.md).

Cycle 1b-b11 adds `PostgresMigrationDeployer` as a non-owning sequential
boundary over one exclusively leased authenticated client. It snapshots the
closed v2 plan synchronously, then uses one finite-timeout read-write
transaction, the reviewed advisory lock, transaction-local owner role, and a
`SHARE ROW EXCLUSIVE` ledger lock. It validates exact service identity, role
graph, platform state, ledger shape, and a non-empty exact manifest prefix
before applying only pending reviewed bodies and matching ledger rows. Drift is
value-free, injected pre-commit failure rolls back, a current ledger is a
no-op, and ambiguous cleanup poisons the instance. Source, integrated local
verification, and the bounded live V11 gate pass. PostgreSQL run `32183709701`
passed at commit `5df9d07`; the retained record returned
`offline_consistent`. See the
[B11 evidence note](../../docs/POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md),
[ADR 0023](../../docs/adr/0023-locked-postgresql-migration-ledger-deployment.md),
and the [Cycle 1b-b11 exit matrix](../../docs/CYCLE_1BB11_EXIT_MATRIX.md).

Cycle 1b-b12 adds a fixed, acceptance-only query-plan/load source and
deterministic fixture. The exact B4 fact-as-known shape and one tenant thesis
read must use the reviewed `financial_facts_as_known` and
`theses_by_instrument` indexes under authenticated forced RLS without disabling
sequential scans or adding an index. Exactly 2,000 promises—1,000 fact and 1,000
tenant reads—were submitted before barrier release through one pool bounded to
eight clients and one login with connection limit eight. The first eight runtime
workload backends were observed simultaneously by a separately connected
out-of-band administrator that executed none of the 2,000 workload reads; the
remaining promises queued, so this was not 2,000 connections. Source,
integrated local verification, and the bounded live V12 gate pass. PostgreSQL
run `32230667908` passed at commit `59c4e58`; the retained record returned
`offline_consistent`. See the
[B12 evidence note](../../docs/POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](../../docs/adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](../../docs/CYCLE_1BB12_EXIT_MATRIX.md).

Cycle 1b-b13 adds a separate canonical policy and privacy-retention plan without
changing the historical v2/legacy inputs. Its application body is an empty-data
suffix accepted only in the fixed pristine
`research_cockpit_b13_privacy_retention_test` database. It replaces raw UUID
tombstones there with stable allocation IDs and 32-byte externally derived
domain/type/resource tokens; hard deletion clears raw organization/resource
UUIDs. Fixed procedures gate allocation, authenticated single-resource hard
deletion, offboarding, online synthetic tenant purge, and bounded
audit/idempotency expiry. PostgreSQL validates token shape
and lifecycle but not HMAC authenticity. Production admission is false: the
source is not privacy/legal approval, production DSAR/KMS/offboarding/backup
operations, populated cutover, cryptographic erasure, global deletion proof, or
real-data evidence. PostgreSQL run `32305478242` passed the exact bounded path
at commit `a959cba`; its retained V13 record returned `offline_consistent`. See
[the B13 evidence note](../../docs/POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](../../docs/adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](../../docs/CYCLE_1BB13_EXIT_MATRIX.md).

Cycle 1b-b14 adds a separate populated-cutover plan without changing the
historical v2 or privacy v1 inputs. Its exact base selects v2 `0001`-`0004` and
`0006`, explicitly replaces unsafe `0005`, loads a deterministic populated
synthetic fixture, captures post-boundary thesis/alert inserts and deletes in
an audited temporary work registry, performs authenticated bounded token
backfill, and contracts to the exact B13 keyed target behind an exact capture
epoch and short final write barrier. The V14 evidence contract binds the plan
manifest/source/fixture and independently reviews the manifest-named bodies.
PostgreSQL run `32343225599` passed the exact bounded synthetic path at commit
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`; its retained V14 record returned
`offline_consistent`. The target-catalog check proves normalized semantic, not
physical, B13 equivalence. This is not a production writer/dual-write protocol,
continuous zero-downtime
deployment, general cutover, recovery of identifiers deleted before capture,
or real-data admission. See
[the B14 evidence note](../../docs/POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](../../docs/adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](../../docs/CYCLE_1BB14_EXIT_MATRIX.md).

Ownership transfer is exclusive: after construction the caller may not call
`connect()`, query or release a client, call `end()`, or otherwise inspect or use
the pool while the source owns it. Only read-only counters may be checked after
`source.close()` completes. The reviewed live reset probe therefore uses an
out-of-band administrative connection to observe
only same-PID idle state, canonical application name, session user, and absence
of advisory locks, then proves the next actor-isolated source load plus timeout
and application-name behavior. Custom-GUC and prepared-statement cleanup remain
source/unit/static evidence for the fixed `DISCARD ALL` sequence, not a direct
live inspection claim.

There is deliberately no production or general multi-release migration
runner, retained credential, externally configured or production-ready pool,
or application-composed database client in this package. B11 adds only one
exact closed-v2 suffix deployer and an acceptance-only prefix reconstruction;
B10's transferred two-client pool remains a separate synthetic acceptance
boundary. B12 adds only a separate runner-owned eight-client acceptance pool,
closed plan shapes, and synthetic fixture; it does not replace or widen the B10
pool contract. The historical
clean-bootstrap renderer validates its immutable
manifest and emits all seven historical bodies. The authenticated V2
application renderer separately validates its closed manifest and emits all six
role-neutral bodies plus their ledger entries inside one locked transaction for
a fresh, fixed-name CI database. The insert-only fixture is deterministic and
synthetic.

The package also contains a disconnected, pure normalizer for the exact flat
financial-fact join rows the B9 adapter now supplies. It accepts only
the current synthetic, dimensionless core subset; separates listing and
security identity; normalizes fixed decimal and lossless zoned timestamp text;
and rejects a whole malformed batch with one value-free error. It cannot accept
source completeness or counts. Cycle 1b-b4 adds the driverless
listing/share-class/security query, closed semantic unit mapping, bounded raw
result, and authenticated `psql`-to-normalizer probe. Its pinned live run and
reviewed version 4 evidence passed for the exact retained scope, and B4 adds no
client driver, pool, or application import; see
[ADR 0016](../../docs/adr/0016-driverless-projection-query-and-semantic-unit-mapping.md)
and the [Cycle 1b-b4 exit matrix](../../docs/CYCLE_1BB4_EXIT_MATRIX.md).

The separate Ubuntu workflow pins PostgreSQL 17.11 Bookworm by OCI image-index
digest. B1 through B8 client commands remain inside that service container. B9
adds exactly one random host port bound only to `127.0.0.1` so the runner-hosted
Node process can exercise the real client; no database URL or other mapping is
accepted. The service configures `initdb` host rules and the image's appended
host rule as SCRAM so the more-specific loopback entries cannot retain
`initdb`'s insecure installation default. Current migrations must bootstrap as
the ephemeral container superuser: on PostgreSQL 17, a non-superuser
`CREATEROLE` migrator would receive automatic membership in newly created roles
and immediately violate migration `0001`'s zero-membership invariant. The
historical b1 runtime, seed, and backup checks use superuser
`SET SESSION AUTHORIZATION` to impersonate the declared `NOLOGIN` capabilities.
This can prove engine grant/RLS semantics, but it is not authenticated
least-privilege or production identity evidence. B5 leaves those historical
checks and fixture bytes intact while adding a separate post-bootstrap
authenticated test-loader path. The reviewed version 5 run passed that exact
acceptance-only path without widening the historical b1 through b4 results. B6
adds only a post-bootstrap, acceptance-only owner-DDL canary; it neither changes
the bootstrap nor promotes the owner login to a migrator.

B7 does not reinterpret that historical bootstrap. Its v2 plan is the sole B7
migration authority: after inherited b1 through b6 regressions, the harness
connects through maintenance database `postgres`, proves zero target
sessions/backends,
drops the exact disposable target without `FORCE`, drops exactly the four
dependency-free capability roles, recreates the target, and proves pristine.
The separately committed platform phase then creates the platform artifacts;
only the subsequent application phase uses the authenticated non-superuser.

ADR 0020 defines two further acceptance-only memberships in the implemented B8
source: a backup login may select only `research_cockpit_backup`, and a distinct
restore login may select only `research_cockpit_test_seed`. Each edge must use
`ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`, exist only around its bounded
phase, and be removed with its login before success-only evidence. The restore
database is independently provisioned; neither membership authorizes schema,
ledger, role, extension, database-envelope, or production backup operations.

The b2 boundary leaves that superuser migration bootstrap, test-seed
impersonation, and backup impersonation unchanged. Only runtime behavior moves
to a separately authenticated service login, created after `0001` has enforced
its clean zero-membership precondition. That login must have no direct
application privileges and one exact `SET`-only, non-inheriting, non-admin
membership in `research_cockpit_runtime`. It must connect with the pinned
container's `psql` over container-loopback TCP, reject a wrong password, prove
its `session_user`/`current_user` transition, and run bounded pre-role and
cross-role denials, missing-context, one alpha-versus-beta isolation read,
sequential-cleanup, and runtime-write probes. The comprehensive b1 query-shape,
rights, and prepared-read checks remain impersonated-capability evidence and
are not promoted by b2. No b2 live claim is valid without a successful reviewed
remote run and retained evidence. See
[ADR 0014](../../docs/adr/0014-container-local-runtime-authentication.md) and
the [Cycle 1b-b2 exit matrix](../../docs/CYCLE_1BB2_EXIT_MATRIX.md).

The b3 source closes that code-path gap without changing the login or role
graph. It runs the shared tenant-isolation and operation-rights expectations
through an authenticated client, uses `SET LOCAL ROLE research_cockpit_runtime`
inside each transaction, and keeps the alternating prepared sequence on one
authenticated backend. B3 does not rerun b1's additional null, malformed, or
unsupported-context failure cases through authentication; b2's bounded
missing-context and write-denial probes remain separate prerequisites. The
reviewed b3 run completed that exact matrix through the service account; it
does not promote the additional b1 context failures or establish a
pool/concurrency result.

The disposable wrong-password call intentionally omits `PGREQUIREAUTH` rather
than setting it to an empty value: libpq 17 treats those states differently and
an empty configured value can reject the SCRAM request before the password is
submitted. Every valid-password call still requires `scram-sha-256`, and the
identity probe separately verifies the resulting `system_user` authentication
method.

Only after every implemented probe succeeds, the acceptance entry point writes
one fixed-name, exact-schema JSON run record under `RUNNER_TEMP`; the workflow
uploads exactly that file only on success. Exclusive creation rejects stale
files. The record allowlists commit/run metadata, reviewed source hashes,
observed PostgreSQL tool versions, completed check identifiers, and explicit
limitations. It excludes container IDs, environment dumps, credentials, SQL,
logs, tenant/row identifiers, and data counts. This is an unsigned run record,
not a compliance archive or independent proof. Reviewed records are identified
in the linked retained evidence notes.

After downloading an artifact, review it from a local clone that already
contains the recorded commit. Every expected anchor is mandatory and must be
copied from independently reviewed run information; do not copy expected values
from the JSON being checked. Use an operator-controlled clone and a trusted
PATH-resolved Git executable; do not point the command at untrusted Git
metadata:

```powershell
pnpm --filter @research-cockpit/db review:postgres-evidence `
  --evidence <absolute-artifact-path> `
  --repo <absolute-git-root> `
  --expected-evidence-sha256 <sha256-from-reviewed-run-log> `
  --expected-repository <owner/repository> `
  --expected-repository-id <numeric-repository-id> `
  --expected-commit <40-character-commit> `
  --expected-run-id <numeric-run-id> `
  --expected-run-attempt <positive-run-attempt>
```

The evidence file must be a regular non-symlink file of at most 32 KiB. The
command reads only fixed source paths from the explicit local Git commit and
does not fetch or trust a remote. Success emits a machine-readable
`offline_consistent` result. It does not authenticate GitHub, inspect logs,
prove PostgreSQL execution, validate commit signatures/branch reachability, or
establish the provenance of the supplied anchors.

Migration `0006` replaces the request-context procedure with null-safe
validation. It explicitly rejects null purpose/channel values and uses `IS
DISTINCT FROM` for the fixed synthetic territory/classification, avoiding SQL
three-valued-logic acceptance of nulls. Direct custom-GUC mutation remains a
trusted-session boundary rather than an authentication control.

Migration `0007` revokes database-level `CREATE` and `TEMPORARY` from `PUBLIC`
for the deployment database. Together with the existing `public`-schema revoke,
the exact schema inventory, and the capability ACL fingerprint, this prevents a
nominally read-only capability from acquiring an unreviewed persistent or
temporary DDL path through PostgreSQL defaults.

## Capability roles

The SQL declares four group/capability roles. Each is `NOLOGIN`,
`NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOINHERIT`, and
`NOBYPASSRLS`. Bootstrap aborts if any same-named pre-existing role has an unsafe
opposite attribute—including `rolreplication`—or participates in any
`pg_auth_members` edge, whether the capability is the granted role or the
member. It never silently accepts, repairs, or revokes an elevated/chained role;
`NOINHERIT` alone is not treated as protection from `SET ROLE` or an inbound
grant.

Every capability in the table below is subject to that complete attribute set,
including `NOREPLICATION`.

| Role                         | Static capability                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `research_cockpit_owner`     | Owns application schemas, tables, context routines, and policy helpers. It is not an application login.                                                      |
| `research_cockpit_runtime`   | `SELECT` and narrowly scoped routine execution only. This increment grants it no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or role membership. |
| `research_cockpit_test_seed` | Synthetic fresh-database fixture loading only: `SELECT` and `INSERT`, with synthetic-only RLS checks. It cannot change the migration ledger.                 |
| `research_cockpit_backup`    | Synthetic logical-backup reads only, through explicit backup RLS policies. It does not bypass RLS.                                                           |

The authenticated bootstrap/migrator account is external. For the historical
manifest, that administrator must have the platform-managed privileges needed
to create roles, install `btree_gist`, create objects in schemas owned by the
owner capability, and transfer object ownership. Those migrations do not create
a migrator login and do not grant any capability role to any other role. B7
instead keeps platform provisioning in its separately committed administrator
phase and gives the authenticated application migrator only one temporary,
set-only owner edge. Deployment automation must not add role chaining without a
new reviewed migration and live authorization tests.

ADR 0014 defines one acceptance-only exception after the existing bootstrap:
an ephemeral runtime login may receive one catalog-verified membership in the
runtime capability with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`. That
source and its bounded live probes passed in reviewed run `31988811000`; the
historical b1 run retains the zero-edge catalog it recorded. The boundary does
not authorize an owner, test-seed, or backup membership and does not redesign
deployment roles.

ADR 0015 reuses exactly that temporary login for the b3 source matrix. It adds
no membership edge or role attribute and authorizes no second service account.
The first b3 live result is recorded in its retained evidence note and exit
matrix, never inferred from source presence alone.

ADR 0018 defines a third, separate acceptance-only exception after bootstrap:
an ephemeral B6 canary login may receive one exact membership in the owner
capability with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`. The edge exists
only around the fixed DDL canary and is removed before the zero-membership
catalog fingerprint. It authorizes no migration, capability-role provisioning,
extension installation, production owner login, or deployment role graph. A
separate B7 plan now versions the platform/application split, and its bounded
version 7 live result is reviewed. That later result does not widen B6.

## Static guarantees

The package checker verifies ordered immutable SHA-256 migration hashes,
transaction wrapping, owner/runtime capability properties, read-only runtime
grants, no capability-role chaining, no public grants or grant options, no
unreviewed roles/schemas/relation kinds, no destructive forward SQL,
shared/private schema separation, forced RLS, explicit policy targeting for
runtime/test-seed/backup, write-policy `WITH CHECK` guards, exact rights-policy
versions, stable tenant/principal composite foreign keys, fixed numeric facts,
public-known/system temporal separation, bidirectional pre-existing
`pg_auth_members` rejection,
transaction-local request settings, application-aligned idempotency hashes, and
payload-free audit records. Every membership-based authorization helper also
joins the stable principal and requires it to remain active and synthetic, so a
deactivated principal cannot retain RLS access through an unexpired membership.
Direct membership reads additionally require that row's current half-open
active window and an active synthetic principal. Direct organization-principal
association reads require a current membership through the non-recursive policy
path `organization_principals → memberships → principals`. Every other
runtime-readable private table is guarded by active membership; only an active
principal may read its own principal row without membership. Thesis and alert
live tables follow the application's hard-delete contract—there are no
soft-delete columns or predicates on either live table. A separate
tenant-scoped, payload-free
`resource_id_registry` permanently reserves every thesis and alert ID. Generated
constant columns and composite foreign keys require live rows to reference the
registry's exact `live` state. Row triggers make live resource identity
immutable, atomically transition the registry when a live row is hard-deleted,
and reject registry-row deletion, revival, or any transition other than
`live → deleted`. The checker also fixes idempotency keys at 8–128 characters,
audit request IDs at 1–128 characters, and non-empty thesis evidence/risk fields
at a maximum of 8,000 characters.

The intended deletion sequence is one database transaction: the resource ID is
registered before creation; the live row is inserted against that registry row;
and deleting the live row fires its `AFTER DELETE` trigger, which tombstones the
registry row. A failed or unauthorized tombstone update aborts the deletion.
The registry stores only tenant ID, resource kind, resource ID, lifecycle state,
registration/tombstone timestamps, and the synthetic classification—never the
deleted thesis, alert, or request payload. The current grants and forced-RLS
policies intentionally provide neither live-row `DELETE` nor registry `UPDATE`
to runtime, backup, or test-seed, so the invoker-mode delete trigger cannot be
used by those capabilities and no database deletion path is enabled in this
increment. A future writer capability requires a separate reviewed migration,
live-row `DELETE` and registry `UPDATE` grants, the corresponding `SELECT`,
`DELETE`, and `UPDATE` RLS policies for the trigger's invoker, and live
concurrency/authorization tests.

Migration `0005` is a clean-database contract: it adds validated foreign keys
without backfilling IDs for pre-existing thesis or alert rows. That is coherent
with the clean-only acceptance database, but it is not a safe in-place upgrade
for a populated database at migration `0004`. Any such deployment needs a
separate, audited allocation/backfill/cutover design before `0005` is applied.

Even without a payload, a permanent tenant/resource identifier can be
pseudonymous or otherwise regulated metadata. This package is synthetic-only;
before real tenant use, product, privacy, and legal owners must make and record
the production retention, erasure/DSAR, lawful-basis, tenant-offboarding, and
backup-deletion decisions. The non-reuse invariant must not silently override
those obligations.

Run with the workspace toolchain:

```powershell
pnpm --filter @research-cockpit/db check
pnpm --filter @research-cockpit/db test
pnpm --filter @research-cockpit/db typecheck
```

`pnpm --filter @research-cockpit/db acceptance:postgres:ci` is intentionally
restricted to the GitHub Actions service-container boundary. It accepts only
the workflow-provided hexadecimal container ID, exact `127.0.0.1` adapter host,
dynamic target-5432 port, and the fixed `research_cockpit_acceptance_test`
database; it has no local reset, arbitrary host/port, or connection-string mode.

## Mandatory live PostgreSQL gates

Before this contract can be described as deployed persistence, a pinned target
PostgreSQL service must prove all of the following:

1. Apply every migration to a clean database and validate all SQL, role,
   extension, generated-column, exclusion-constraint, ownership, grant, and
   policy statements.
2. Query `pg_roles`, ACL catalogs, `pg_policy`, and ownership catalogs to
   confirm the complete non-system role/schema inventory plus database,
   schema, table, column, and routine privileges exactly; runtime must have no
   write, object-creation, grant-option, or role-membership path, and every
   policy must target only its declared runtime, test-seed, or backup
   capability. Pre-create an unsafe
   same-named role in an isolated database—including a role with
   `rolreplication = true`—and prove bootstrap fails atomically. Separately grant
   each same-named role to another role and grant another role to it; both
   `pg_auth_members` directions must make bootstrap fail without attempting
   automatic repair or revocation.
3. Introduce and run as a separately reviewed non-owner runtime login. B2's
   reviewed run proves its bounded missing-context, identity, isolation,
   cleanup, and write-denial probes. B3 implements authenticated parity for the
   broader reviewed tenant/membership/query-shape, operation-rights, and
   alternating prepared-read matrix; its first reviewed remote run passed that
   exact scope. Null, malformed, and unsupported-context failures outside the
   bounded b2 case remain impersonated-capability evidence until separately
   rerun through the login.
4. Prove `set_request_context` is transaction-local across commit, rollback,
   errors, and pooled-connection reuse.
5. Test cross-tenant `SELECT`, direct-object lookup, and every future write path
   using two organizations and unrelated principals.
6. Attempt cross-tenant creator, updater, membership, entitlement, idempotency,
   and audit references and confirm the composite foreign keys reject them.
   Then issue direct object and enumeration queries against every
   runtime-readable private table: `principals`, `memberships`,
   `organization_principals`, `organizations`, `entitlements`, `theses`,
   `alert_rules`, `idempotency_records`, and `resource_id_registry`. An inactive
   principal must receive zero rows from all nine. An active principal with only
   expired, future, or no membership may still read its own `principals` row but
   must receive zero rows from the other eight, including membership and stable
   association metadata.
7. Exercise every purpose/channel/territory and exact policy-version pair;
   restricted facts and evidence must remain invisible by direct ID and joins.
8. Verify the public-known boundary immediately before, at, and after a
   restatement; assert `available_at <= known_from <= system_from` and exclusion
   behavior under concurrent inserts.
9. Verify the test-seed capability can insert only synthetic fixtures into a
   fresh database and cannot update/delete/truncate records or touch the
   migration ledger.
10. Exercise the future hard-delete path under its separately reviewed write
    capability. Prove the invoker-mode trigger atomically changes exactly one
    registry row from `live` to `deleted`, the live row is gone, and no
    soft-delete field, predicate, or stale record remains.
11. Race create/delete/recreate attempts for the same thesis and alert IDs in
    one tenant and across two tenants. Prove a tombstoned `(organization_id,
resource_type, resource_id)` can never back a live row, while the same UUID
    remains independent in a different tenant or resource type. Attempt direct
    tombstone deletion, revival, identity mutation, trigger disabling, and
    `TRUNCATE`; all non-owner paths must fail closed.
12. Retain the reviewed B8 live contract: authenticate one
    ephemeral login that may select only the `NOBYPASSRLS` backup capability;
    dump exactly the 21 policy-visible synthetic application data tables to a
    custom data-only archive while excluding the migration ledger; independently
    provision a clean `template0` database in the same cluster; and restore once
    through a distinct authenticated test-seed login with transactional failure,
    fingerprint/catalog/authorization, source-isolation, and zero-residue
    checks. This bounded fixture has no declared or implied production RPO/RTO.
13. Retain the reviewed B9 live contract through one exclusively leased real
    `pg` client:
    wrong-password rejection, stable backend identity, rollback of a deliberately
    pre-existing read-write canary, exact read-only role/context transactions,
    operation and tenant alternation, injected rollback, value-free error
    handling, post-transaction cleanup, client closure, backend drain, and
    independently reviewed version 9 evidence. This does not include a pool.
14. Retain the reviewed B10 proof for one real, bounded two-client pool:
    clean checkout/reuse, simultaneous tenant-isolated backends, bounded queue,
    settlement-before-discard active cancellation, server-timeout recovery,
    failed-transaction discard, idempotent close, zero pooled-backend residue,
    and independently reviewed version 10 evidence.
15. **Cycle 1b-b11 complete for its bounded scope:** checksum-mismatch refusal
    against live drift, exact one-time suffix replay, injected-failure rollback,
    two-deployer serialization, mandatory cleanup, retained V11 evidence, and
    independent review passed.
16. **Cycle 1b-b12 complete for its bounded scope:** the exact authenticated
    fact-as-known and tenant plans used their named indexes; exactly 1,000 fact
    plus 1,000 tenant reads settled through at most eight runtime workload
    backends; Alpha/Beta isolation held; and cleanup left zero
    login/client/backend/clone residue. Pending checkout and the
    workload/plan/seed/`ANALYZE` statements were bounded. The V12 evidence and
    independent review are retained. Cleanup calls are not each
    independently cancellable; the 15-minute workflow timeout remains the outer
    fail-closed bound.
17. **Cycle 1b-b13 complete for its bounded synthetic scope:** retain the exact
    technical policy, externally keyed token framing, pristine/empty-only
    privacy plan, raw-identifier clearing, offboarding admission closure, online
    synthetic purge, bounded expired-metadata purge, retained V13 evidence, and
    independent `offline_consistent` review.
    Do not admit real tenant identifiers: production privacy/legal approval,
    verified DSAR/legal holds, operating offboarding scheduling/monitoring,
    KMS/HSM custody and destruction, all online/backup/third-party deletion
    planes, cryptographic erasure, and independent deletion proof remain blocked.
18. **Cycle 1b-b14 bounded synthetic cutover complete and reviewed:** use the
    separate manifest-bound populated-cutover plan only for the exact tested
    pre-`0005` branch. Run `32343225599` establishes capture, bounded backfill,
    retry, and a final contract barrier instead of applying static `0005`.
    Do not use it for a production upgrade until application-writer
    authorization and allocation/dual-write coordination, uninterrupted-write
    and lock/SLO budgets, crash/restart/failover recovery, pre-capture deletion
    handling, and real-data approval all pass.

Until every gate passes, this package is not deployed persistence. Historical
b1-b6 live evidence remains limited to the exact checks in their retained run
records. B7 through B14 passed for their separately recorded version 7 through
version 14 scopes at commits `41d13dd`, `49d3a96`, `8e470e9`, `2dcb259`,
`5df9d07`, `59c4e58`, `a959cba`, and
`d688aa21e969feef6611f6efcd1aeaaed6e31df9` without widening those records. The
b2-b6 results cover only sequential, synthetic, container-local runtime,
test-loader, and owner-DDL canary service accounts plus one narrow dimensionless
financial-fact projection. B6 executes no migration. External/TLS
authentication, end-user identity binding, production secret handling,
load-ready pool tuning/failover, prompt queued or graceful cancellation,
complete dossier projections, external/production/incremental migrator and
backup credentials, global
platform/application atomicity, and production readiness remain unproven. B8
proves only its reviewed policy-scoped data-only dump and same-cluster clean
restore in the disposable acceptance environment.
Full-schema/global/cross-cluster/version restore, continuous backup, disaster
recovery, storage encryption/retention, secure passfile or archive erasure, and
RPO/RTO remain outside B8. The reviewed B9 result proves only one sequential
synthetic client; it does not establish a pool or application composition. The
reviewed B10 result establishes only one runner-local, two-client synthetic pool
with bounded acquisition, settlement-before-discard active abort,
server-timeout recovery, destructive failure discard, idempotent close, and
zero observed residue. It does not include production pool sizing, load
capacity, graceful cancel requests, prompt queued abort, retry/failover, or
application composition. B11's reviewed live V11 result proves only its exact
closed-v2, two-deployer boundary. It does not establish external/production
credentials, arbitrary or multi-release upgrades, application compatibility
under concurrent writes, crash recovery, cancellation, distributed
coordination, global atomicity, or production readiness. B12's reviewed live
V12 result proves only its fixed two-plan, bounded eight-workload-backend,
2,000-submission contract. It does not establish 1,000 or 2,000 simultaneous
database connections, production load capacity/SLOs or pool tuning/failover,
plan stability across other data distributions/statistics/hardware/versions,
real data, application composition, or production readiness.
B13's reviewed live V13 result remains only a synthetic, pristine,
empty-data-only technical lifecycle. It does not satisfy production
privacy/legal, DSAR, scheduler/monitoring, KMS/HSM, token-verification,
cryptographic-erasure, online/backup/third-party deletion, populated-cutover,
global-proof, or real-data gates.
B14's reviewed live V14 result remains only the separate bounded synthetic
populated-cutover sequence. It does not widen B13 or establish production
writer integration, uninterrupted writes, arbitrary allocation gaps,
production scale/SLOs, recovery/failover/downgrade, identifiers deleted before
capture, physical catalog equivalence, real data, or production readiness.
