# ADR 0020: Authenticated policy-scoped data backup and bounded clean restore

Status: accepted for Cycle 1b-b8; source implementation and local verification complete; live version 8 evidence pending

## Context

Cycle 1b-b7 established the exact current application schema through a
separately committed platform phase and an authenticated application migrator.
The existing `research_cockpit_backup` capability is still `NOLOGIN`,
`NOINHERIT`, and `NOBYPASSRLS`. Historical acceptance checks exercise that
capability only through administrator impersonation and verify two
representative reads plus one write denial. They do not prove an authenticated
backup client or a restorable archive.

The current database contract is synthetic-only. Twenty-one application data
tables are protected by explicit backup `SELECT` policies; the twenty-second
application table, `shared_data.schema_migrations`, is an independently
established deployment ledger rather than restorable application data. B8 must
therefore preserve the backup role's policy boundary instead of granting it
`BYPASSRLS`, and it must not recast a data-only archive as a full database or
disaster-recovery backup.

## Decision

Cycle 1b-b8 is one milestone with separately reviewable backup and restore
phases. Its source and local verification are complete, but neither phase has a
live PostgreSQL result. No version 8 success record may be written unless both
phases and all cleanup checks pass in the same acceptance run.

### Authenticated policy-scoped dump

After every B1 through B7 prerequisite passes against the exact v2 result, the
harness creates one ephemeral, acceptance-only backup login. The login is
non-superuser, non-creator, non-replicating, `NOINHERIT`,
`NOBYPASSRLS`, connection-limited to one, free of direct application ACLs and
role settings, and connected to only one exact set-only membership in
`research_cockpit_backup` with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`.

The login authenticates with a run-local SCRAM password over loopback TCP
inside the unexposed pinned PostgreSQL container. Wrong-password, pre-role,
cross-role, session-authorization, write, persistent-DDL, and temporary-object
attempts must fail before a dump can be accepted. Valid calls must preserve the
ephemeral login as `session_user` and select only
`research_cockpit_backup` as `current_user`.

The pinned container's `pg_dump` creates one archive through that login and
capability with `--format=custom`, `--data-only`, `--enable-row-security`, and
`--column-inserts`. The reviewed argument contract must use a noninteractive
passfile and exclude `shared_data.schema_migrations` table data. It must not
use a superuser, owner, runtime, test-seed, socket-authenticated shortcut,
parallel job, connection string, host-published port, or password in arguments,
environment values, or logs.

This choice is deliberate. PostgreSQL normally asks `pg_dump` to disable row
security and fails when the dump role cannot bypass it. The
`--enable-row-security` option instead restricts the dump to rows visible to the
backup capability, and PostgreSQL recommends `INSERT` output when row security
is enabled because `COPY FROM` does not support row security. B8 uses
`--column-inserts` because the fixture is deliberately small and the restored
column mapping must be explicit.

The archive table-of-contents contract must contain data for exactly the 21
reviewed application data tables and no schema, extension, owner, ACL,
migration-ledger, sequence, large-object, or cluster-global payload. Every
archive and passfile uses a fixed reviewed path under `/tmp` and must be a
regular, non-symlink, mode-`0600` file. The accepted archive is never uploaded
as evidence and is rejected if it is empty, oversized for the fixed synthetic
fixture, unreadable by `pg_restore --list`, or if its SHA-256 changes from
post-dump inspection through either restore attempt. The backup login,
membership, backend, wrong credential, and passfiles are removed and proved
absent before restore begins.

### Bounded clean restore

The restore target is a second, fixed disposable database in the same pinned
PostgreSQL cluster. An administrator connects only through the maintenance
database, proves zero target sessions, creates the target from `template0`, and
applies the reviewed `restore-platform.sql` asset. The exact v2 application
migrations then run through the existing authenticated migrator boundary. This
independently establishes the schemas, hardened `btree_gist`, owners, grants,
RLS policies, constraints, routines, triggers, default privileges, database
envelope, and migration ledger before any archived application row is loaded.

A different ephemeral, acceptance-only restore login has the same locked
login attributes and one exact set-only membership in
`research_cockpit_test_seed`. It authenticates with its own run-local SCRAM
credential, proves wrong-password and pre-role/escalation denial, and invokes
`pg_restore` with `--data-only`, `--enable-row-security`,
`--role=research_cockpit_test_seed`, `--single-transaction`,
`--exit-on-error`, `--no-owner`, and `--no-privileges`. The archive's
column-qualified `INSERT` statements must therefore satisfy the existing
synthetic-only `WITH CHECK` policies and ordinary constraints.

One reviewed injected restore failure must roll back every attempted archived
row without changing the independently established catalog or ledger. A
separate successful restore must load the archive once. A replay into the
already populated target must fail without accepted drift.

Before and after the archive path, the harness computes a closed,
order-independent content fingerprint for each of the 21 application data
tables without writing row identities, row values, counts, or fingerprints to
the success record. Every restored fingerprint must equal its source
fingerprint. The independently built target must also match the source's exact
catalog, ownership, RLS, policy, grant, constraint, trigger, routine,
extension-hardening, default-privilege, database-ACL, and migration-ledger
contracts. These catalog results validate the independently provisioned target;
they are not contents recovered from the data-only archive.

Finally, the harness must remove the restore login, membership, backends,
passfiles, all reviewed archive paths, and restore database; prove the source
database and four capability roles remain unchanged; and prove zero B8 login,
membership, backend, regular-file, dangling-symlink, target-database, or
login-owned-object residue. Any probe or cleanup failure prevents success-only
evidence.

## Evidence contract

The implemented source and local tests are not live evidence. Local verification
passed all 409 tests across the 10 database test files, database typechecking,
the migration and static PostgreSQL guardrails, ESLint, Prettier, and the diff
check. No local Docker or live PostgreSQL execution is claimed. B8 requires a
distinct version 8 record named
`research-cockpit-postgres-acceptance-v8.json` and a commit/attempt-bound
`postgres-acceptance-evidence-v8-${sha}-${attempt}` artifact. Version 8 must
preserve the exact parser behavior, source shapes, checks, limitations, and
meanings of versions 1 through 7 and append only
`authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore`
after every B8 probe and cleanup succeeds.

The version 8 source-hash bundle adds exactly
`restorePlatformV1Sha256` for `restore-platform.sql` and
`authenticatedBackupRestorePlanV1Sha256` for
`authenticated-backup-restore-plan.ts`. The offline verifier must read both
fixed blobs from the anchored commit and reject missing, extra, or mixed-version
source bundles.

Version 8 replaces only the ordered `authenticated_backup_sessions` and
`dump_restore_or_disaster_recovery` limitations. The former becomes
`external_production_incremental_or_continuous_authenticated_backups`; the
latter becomes, in order,
`full_schema_global_object_cross_cluster_or_cross_version_restore` and
`disaster_recovery_storage_encryption_retention_rpo_or_rto`. Every other
version 7 limitation remains unchanged and ordered.

A B8 live row may become `Pass` only after the dedicated workflow succeeds from
a clean checkout against the pinned PostgreSQL 17 image, the exact run, logs,
artifact, and source hashes are independently reviewed, and the downloaded
version 8 record returns `offline_consistent`. The source/local rows now pass;
the live execution and artifact-review rows remain pending.

## Explicit exclusions

B8 is a same-cluster restore of one RLS-scoped, synthetic, data-only archive
into an independently provisioned clean database. It does not back up or
recover the schema, migration ledger, database envelope, extension, roles,
tablespaces, ownership, grants, RLS policies, default privileges, publications,
subscriptions, large objects, or any other database-wide or cluster-global
object.

It does not prove an external, production, scheduled, incremental, or
continuous backup; a production backup or restore identity; external transport
or TLS; managed secret storage or rotation; archive encryption, signing,
authenticity, custody, replication, off-site storage, retention, expiry, or
secure erasure; backup deletion under DSAR or tenant offboarding; an untrusted
archive restore; a physical backup, WAL archive, point-in-time recovery,
failover, high availability, disaster recovery, or any RPO/RTO; cross-cluster,
cross-version, or cross-platform portability; large-data, concurrent-write,
performance, cancellation, timeout, or interrupted-restore behavior; real or
licensed data; an application driver or pool; deployed persistence; or
production readiness.

Because every currently valid application row is constrained to the synthetic
classification, the policy-scoped dump does not establish behavior for a
future classification or a future table. New data classifications, relations,
sequences, large objects, or backup policies require a separately reviewed
contract and live evidence.

## Consequences

The implementation keeps authentication of the reader, independent
provisioning of the restore target, and authorization of the data loader visible
as separate boundaries while withholding the composite live B8 claim until all
three have been exercised together. It closes no current limitation until
reviewed version 8
live evidence exists. A single-client read-only adapter and the later
pool/concurrency/cancellation boundary remain separate milestones.

## Related decisions and primary sources

- [ADR 0010: Digest-pinned live PostgreSQL acceptance harness](./0010-live-postgresql-acceptance-harness.md)
- [ADR 0012: Success-only PostgreSQL acceptance run record](./0012-success-only-postgresql-run-record.md)
- [ADR 0013: Offline PostgreSQL run-record verification](./0013-offline-postgresql-run-record-verification.md)
- [ADR 0019: Versioned authenticated migration phase](./0019-versioned-authenticated-migration-phase.md)
- [Cycle 1b-b8 exit matrix](../CYCLE_1BB8_EXIT_MATRIX.md)
- [PostgreSQL 17 `pg_dump`](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL 17 `pg_restore`](https://www.postgresql.org/docs/17/app-pgrestore.html)
- [PostgreSQL 17 SQL-dump backup and restore](https://www.postgresql.org/docs/17/backup-dump.html)
- [PostgreSQL 17 `CREATE DATABASE`](https://www.postgresql.org/docs/17/sql-createdatabase.html)
