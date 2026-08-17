# PostgreSQL security contract and acceptance harness

> **B1 CLEAN-ONLY LIVE ACCEPTANCE PASSED; B2 BOUNDED RUNTIME-AUTH LIVE ACCEPTANCE PASSED; B3 AUTHENTICATED MATRIX SOURCE IMPLEMENTED, LIVE PENDING — NOT DEPLOYED PERSISTENCE**

This package contains forward SQL, static security checks, and a clean-only
synthetic acceptance harness for the future PostgreSQL persistence boundary.
The seven migrations and implemented probes passed in the first reviewed run against the pinned
PostgreSQL 17.11 service at commit `611c93d`; see the
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

Cycle 1b-b3 is also implemented in the acceptance source, but has no reviewed
live result yet. It preserves the b1 impersonated-capability regression path
and repeats the reviewed alpha/beta tenant visibility, inactive and non-current
membership, direct/join/subquery isolation, operation-rights, and alternating
prepared-read assertions through the b2 SCRAM login with transaction-local
runtime role selection. A source-only implementation is not engine evidence;
see [ADR 0015](../../docs/adr/0015-authenticated-runtime-authorization-matrix.md)
and the [Cycle 1b-b3 exit matrix](../../docs/CYCLE_1BB3_EXIT_MATRIX.md).

There is deliberately no database driver, production or incremental migration
runner, live credential, or application adapter in this package. The
acceptance-only renderer validates the immutable manifest and emits all seven
migration bodies plus their ledger entries inside one locked transaction for a
fresh, fixed-name CI database. The insert-only fixture is deterministic and
synthetic.

The package also contains a disconnected, pure normalizer for the exact flat
financial-fact join rows a future read-only adapter must emit. It accepts only
the current synthetic, dimensionless core subset; separates listing and
security identity; normalizes fixed decimal and lossless zoned timestamp text;
and rejects a whole malformed batch with one value-free error. It performs no
SQL and cannot accept source completeness or counts. The current schema and
acceptance fixture do not yet establish the semantic unit mapping or reviewed
listing/share-class/security query required to call it.

The separate Ubuntu workflow pins PostgreSQL 17.11 Bookworm by OCI image-index
digest, publishes no host port, and runs every client command inside that
service container. It configures `initdb` host rules and the image's appended
host rule as SCRAM so the more-specific loopback entries cannot retain
`initdb`'s insecure installation default. Current migrations must bootstrap as
the ephemeral container superuser: on PostgreSQL 17, a non-superuser
`CREATEROLE` migrator would receive automatic membership in newly created roles
and immediately violate migration `0001`'s zero-membership invariant. Runtime,
seed, and backup checks use superuser `SET SESSION AUTHORIZATION` to impersonate the declared
`NOLOGIN` capabilities. This can prove engine grant/RLS semantics, but it is not
authenticated least-privilege or production identity evidence.

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
authenticated backend. B3 does not rerun the b1 null/malformed-context failure
set through authentication; b2's bounded missing-context and write-denial
probes remain separate prerequisites. The first b3 remote execution and its
new success-only record must be reviewed before any broader authenticated
matrix claim is made.

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
not a compliance archive or independent proof. The first reviewed record is
identified in the retained evidence note.

After downloading an artifact, review it from a local clone that already
contains the recorded commit. Every expected anchor is mandatory and must be
copied from independently reviewed run information; do not copy expected values
from the JSON being checked. Use an operator-controlled clone and a trusted
PATH-resolved Git executable; do not point the command at untrusted Git
metadata:

```powershell
pnpm --filter @research-cockpit/db review:postgres-evidence -- `
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

The authenticated bootstrap/migrator account is external to this contract. It
must have the platform-managed privileges needed to create roles, install
`btree_gist`, create objects in schemas owned by the owner capability, and
transfer object ownership. These migrations do not create a migrator login and
do not grant any capability role to any other role. Deployment automation must
not add role chaining without a new reviewed migration and live authorization
tests.

ADR 0014 defines one acceptance-only exception after the existing bootstrap:
an ephemeral runtime login may receive one catalog-verified membership in the
runtime capability with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`. That
source and its bounded live probes passed in reviewed run `31988811000`; the
historical b1 run retains the zero-edge catalog it recorded. The boundary does
not authorize an owner, test-seed, or backup membership and does not redesign
deployment roles.

ADR 0015 reuses exactly that temporary login for the b3 source matrix. It adds
no membership edge or role attribute and authorizes no second service account.
The b3 live status is recorded only in its exit matrix and any future retained
evidence note, never inferred from source presence.

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
the workflow-provided hexadecimal container ID and the fixed
`research_cockpit_acceptance_test` database; it has no local reset, host/port,
or connection-string mode.

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
   alternating prepared-read matrix, but its first remote run is pending. Null
   and malformed context failures outside the bounded b2 case remain
   impersonated-capability evidence until separately rerun through the login.
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
12. Design an authenticatable backup path, then perform a logical backup and
    isolated restore; compare schema, row counts, hashes, RLS, grants, and
    ownership within the declared RPO/RTO. The current backup capability is
    `NOLOGIN` and has no permitted membership edge.
13. Prove migration ledger locking, checksum mismatch refusal, one-time replay,
    failure rollback, and concurrent deploy behavior.
14. Run query plans and load tests for fact-as-known and tenant reads, including
    RLS overhead and index use.
15. Approve the production privacy and retention model for permanent resource
    identifiers, including DSAR/erasure, tenant offboarding, backup expiry, and
    any required pseudonymization or keyed-token replacement. Do not admit real
    tenant identifiers until that decision is documented and tested.
16. If upgrading a populated database, validate an audited registry backfill
    and cutover under concurrent-write controls before adding the live-state
    foreign keys; this static `0005` migration assumes empty live tables.

Until every gate passes, this package is not deployed persistence. Current live
evidence is limited to the exact b1 and bounded b2 checks in their retained run
records. B3's broader authenticated matrix is source-implemented and live
pending. The b2 result covers only one container-local runtime service account;
external/TLS authentication, end-user identity binding, production secret
handling, pooling, distinct migrator/test-loader/backup credentials, logical
restore, and disaster recovery remain unproven.
