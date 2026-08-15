# PostgreSQL static security contract

> **UNEXECUTED STATIC CONTRACT — NOT DEPLOYED PERSISTENCE**

This package contains forward SQL and static security checks for the future
synthetic-only PostgreSQL persistence boundary. The migrations have not been
executed against PostgreSQL in this workspace. Passing the package tests does
not prove PostgreSQL syntax, row-level security behavior, backup viability, or
production readiness.

There is deliberately no database driver, migration runner, seed payload, live
credential, or application adapter in this package.

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

## Static guarantees

The package checker verifies ordered immutable SHA-256 migration hashes,
transaction wrapping, owner/runtime capability properties, read-only runtime
grants, no capability-role chaining, no public grants, no destructive forward
SQL, shared/private schema separation, forced RLS, explicit policy targeting for
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
with this package's wholly unexecuted state, but it is not a safe in-place
upgrade for a populated database at migration `0004`. Any such deployment needs
a separate, audited allocation/backfill/cutover design before `0005` is applied.

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

## Mandatory live PostgreSQL gates

Before this contract can be described as deployed persistence, a pinned target
PostgreSQL service must prove all of the following:

1. Apply every migration to a clean database and validate all SQL, role,
   extension, generated-column, exclusion-constraint, ownership, grant, and
   policy statements.
2. Query `pg_roles`, `information_schema.role_table_grants`, `pg_policy`, and
   ownership catalogs to confirm declared capabilities exactly; runtime must
   have no write or role-membership path, and every policy must target only its
   declared runtime, test-seed, or backup capability. Pre-create an unsafe
   same-named role in an isolated database—including a role with
   `rolreplication = true`—and prove bootstrap fails atomically. Separately grant
   each same-named role to another role and grant another role to it; both
   `pg_auth_members` directions must make bootstrap fail without attempting
   automatic repair or revocation.
3. Run as a non-owner runtime login and prove missing or malformed request
   context fails closed.
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
12. Perform an authenticated logical backup and isolated restore with the
    backup capability; compare schema, row counts, hashes, RLS, grants, and
    ownership within the declared RPO/RTO.
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

Until every gate passes, this package is design evidence only.
