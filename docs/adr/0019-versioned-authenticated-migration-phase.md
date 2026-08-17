# ADR 0019: Versioned authenticated migration phase

Status: accepted for Cycle 1b-b7; bounded live version 7 evidence reviewed

## Context

The historical clean-bootstrap plan cannot simply be executed by a
non-superuser migrator. Migration `0001` creates the four capability roles and
then requires their membership graph to be empty. On PostgreSQL 17, a
non-superuser that creates a role receives an administrative membership edge,
and changing that historical file would reinterpret the reviewed b1 through b6
evidence. The existing clean-bootstrap renderer also deliberately rejects
embedded role switching and assumes one administrator-owned transaction.

Cycle 1b-b6 reduced only the role-transition and transactional-DDL risk. Its
ephemeral login selected the already-created owner capability for one fixed
canary after bootstrap. It did not create the capability roles, install an
extension, execute the migration plan, populate the migration ledger, or close
`authenticated_migrator_sessions`.

## Decision

Cycle 1b-b7 introduces a separately versioned two-phase plan without changing
the historical migration manifest, the seven historical migration bodies, or
their b1 through b6 meanings.

The v2 platform/application plan is the sole current authority for the B7
migration proof. The legacy manifest and bodies execute only as inherited b1
through b6 regressions before the disposable database is reset; they are not a
fallback or alternate B7 migration plan.

1. An administrator-controlled platform phase creates and validates the fixed
   capability roles; creates the application schemas with their exact owners
   and public-ACL lockdown; installs `btree_gist` and revokes public execution
   from its routines; and revokes public database `CREATE` and `TEMPORARY`.
2. After that platform transaction commits and its exact fingerprint and replay
   rejection pass, the harness creates one ephemeral acceptance-only migrator
   login and grants one exact set-only owner edge.
3. The migrator authenticates with a run-local SCRAM password over loopback TCP
   inside the unexposed pinned container. In one separately bounded migration
   transaction it selects only the owner capability and executes the complete
   role-neutral application migration plan and exact ledger records.

The platform and application plans are new, closed source artifacts. They may
reuse reviewed SQL semantics, but they do not replace or mutate historical
inputs. The authenticated phase records the login as `session_user`, uses the
owner only as transaction-local `current_user`, and records the login identity
in every new migration-ledger row.

The acceptance harness must first keep every b1 through b6 prerequisite. It
then closes every ephemeral session and login, connects only to the maintenance
database `postgres`, drains and proves zero target-database sessions/backends,
drops the exact disposable target without `FORCE`, drops exactly the four now
dependency-free capability roles, recreates the exact target, and proves the
v2 namespace pristine. It next proves rollback of the platform phase, applies
and fingerprints that platform phase, rejects its replay, and exercises the
authenticated migration boundary. Required probes include:

- wrong-password rejection and exact SCRAM/session/current/system identities;
- denial before owner selection, denial of forbidden role and session
  transitions, and denial of unreviewed privilege paths;
- an injected pre-commit failure that rolls back every application object and
  ledger row from the role-neutral plan while leaving only the reviewed
  platform schemas, extension, role, and privilege artifacts;
- one complete authenticated migration phase with exact object ownership,
  ledger hashes/order and `applied_by` identity;
- authenticated replay rejection without catalog or ledger drift; and
- mandatory removal of passfiles and client backends, then dropping the login
  without `DROP OWNED` or `REASSIGN OWNED` and thereby removing its temporary
  membership, followed by proof of zero temporary authentication, file, or
  login-owned-object residue before catalog fingerprinting or success-only
  evidence.

The platform and authenticated phases cannot be claimed as one globally atomic
bootstrap because the authenticated connection must observe committed roles,
database privileges, and membership. Each phase therefore has its own rollback
proof and explicit committed boundary.

## Evidence contract

Source implementation and local tests are not live evidence. The B7 live claim
requires a distinct version 7 success-only record. The record must preserve the
exact parsing and meaning of versions 1 through 6, append only
`authenticated_clean_application_migrations_after_platform_bootstrap` after
every B7 probe and cleanup succeeds, and bind every new platform/application
plan input through a closed version 7 source-hash bundle.
The offline reviewer must read those exact blobs from the anchored commit,
validate the new manifest and every body it names, and reject missing, extra,
or cross-version source bundles.

Version 7 replaces only `authenticated_migrator_sessions`, at the same ordered
position, with
`external_production_or_incremental_authenticated_migrations` and
`globally_atomic_platform_and_application_bootstrap`; every other version 6
limitation remains unchanged and ordered. Its record and artifact use
version-specific fixed names so a B7 run cannot overwrite or reinterpret a
historical record. A B7 live row may become
`Pass` only after the dedicated workflow succeeds from a clean checkout against
the pinned PostgreSQL 17 image, its exact artifact and logs are retained,
repository and artifact hashes match, and independent offline review returns
`offline_consistent`.

That rule was satisfied for tested commit
[`41d13dde55148c05342d782c76fc80e9b76f4e95`](https://github.com/liangzixuan/investing-pro/commit/41d13dde55148c05342d782c76fc80e9b76f4e95)
by successful PostgreSQL [run `32068159652`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32068159652).
The downloaded version 7 record returned `offline_consistent`; its exact
anchors, reviewed scope, and nonclaims are recorded in the
[B7 evidence note](../POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md). The
later documentation commit does not retest or expand that recorded run.

## Explicit exclusions

B7 proves only the authenticated application migration phase after a separately
committed container-superuser platform bootstrap in one disposable,
container-local acceptance environment. It does not prove that platform role,
schema, or extension creation was authenticated as a non-superuser, that the
two phases are globally atomic, or any independent provenance for trusted
extension contents.

It does not authorize a production migrator or owner login and does not prove
external authentication, TLS, managed secret storage or rotation, secure
passfile erasure, incremental upgrades, concurrent migrations, cancellation or
timeout recovery, cluster-wide or multi-database migration safety,
authenticated backup, dump/restore or disaster recovery, real data, an
application driver or pool, application integration, deployed persistence, or
production readiness.

## Consequences

B7 closes the narrow historical `authenticated_migrator_sessions` gap only for
the exact container-local migration phase recorded by a reviewed version 7
run. External or production migrator operation remains a distinct nonclaim.
The later reviewed B8 result separately covers one bounded authenticated
policy-scoped data dump and clean same-cluster restore; it does not widen B7.
A single-client application adapter and the pool/concurrency boundary remain
later milestones.

Historical b1 through b6 records retain their exact source shapes, completed
checks, limitations, and interpretation. This decision does not retroactively
widen any of them.

## Related decisions

- [ADR 0012: Success-only PostgreSQL acceptance run record](./0012-success-only-postgresql-run-record.md)
- [ADR 0013: Offline PostgreSQL run-record verification](./0013-offline-postgresql-run-record-verification.md)
- [ADR 0018: Authenticated owner-DDL canary](./0018-authenticated-owner-ddl-canary.md)
- [Cycle 1b-b7 exit matrix](../CYCLE_1BB7_EXIT_MATRIX.md)
- [Cycle 1b-b7 evidence note](../POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md)
- [Cycle 1b-b8 evidence note](../POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md)
- [PostgreSQL 17 `GRANT`](https://www.postgresql.org/docs/17/sql-grant.html)
- [PostgreSQL 17 `SET ROLE`](https://www.postgresql.org/docs/17/sql-set-role.html)
- [PostgreSQL 17 extension packaging](https://www.postgresql.org/docs/17/extend-extensions.html)
