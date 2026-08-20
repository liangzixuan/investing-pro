# ADR 0013: Offline PostgreSQL run-record verification

Status: accepted; retained versions through 12 reviewed successfully

ADR 0012 defines a success-only PostgreSQL acceptance run record. Its schema
parser can reject malformed fields, but parsing alone cannot establish that a
downloaded file matches a separately identified GitHub run or the source blobs
at its recorded commit. Cycle 1b-b1 therefore ends its disconnected hardening
with one offline consistency verifier.

The verifier requires independent trust anchors for the evidence-file SHA-256,
repository name and numeric ID, commit SHA, run ID, and run attempt. None of
those expected values may be inferred from the record being checked. The
evidence file must be a regular non-symlink file no larger than 32 KiB. Its
original bytes must be valid UTF-8 and exactly equal the canonical
serialization for their declared supported version. The verifier retains exact
historical v1 through v11 support and accepts the current v12 schema without
mixing any version's closed check, limitation, source-hash, or tool-version
lists. The retained artifacts described below through version 11 have been
reviewed.
Canonical comparison rejects byte-order marks, CRLF or alternate whitespace,
trailing content, reordered members, and duplicate JSON member names.

Source validation uses only fixed paths read as raw Git blobs from the explicit
40-character commit. It does not read source from the mutable worktree and does
not consult or trust a Git remote. The commit must exist locally as a commit
object. The local Git database and PATH-resolved Git executable must be
operator-controlled; this tool is not an untrusted-repository sandbox. The
verifier compares the workflow, synthetic fixture, migration manifest,
acceptance runner, and version-specific projection-query and normalizer hashes
recorded in the artifact; validates the reviewed PostgreSQL target against the
commit's image declaration; and checks the exact ordered migration inventory
and every migration-body hash.

For versions 7 through 12, the reviewer also requires the fixed v2 platform plan,
application manifest, authenticated renderer, and the exact manifest-listed
application bodies from the anchored commit. Versions 8 through 12 additionally
require the fixed restore-platform asset and authenticated backup/restore
renderer. Versions 9 through 12 also require the adapter, core
operation-projection contract, database package manifest, and lockfile, and
check the exact node-postgres tool version. Versions 10 through 12 additionally
require the pool source and exact pg-pool version. Versions 11 and 12 require
the migration-deployer source. Version 12 alone requires the fixed query-plan/
load module and deterministic B12 fixture. The reviewer rejects missing, extra,
non-regular, or mixed-version tree entries and validates each body against the
closed manifest. Versions 1 through 6 retain their historical source shapes and
do not acquire these inputs retroactively.

The CLI performs no fetch, network request, archive extraction, glob expansion,
source write, or database operation. It emits a fixed-schema
`offline_consistent` result on stdout. All failures are value-free and
fail-closed. The producer also logs the exact evidence JSON byte hash after the
file has been created, allowing an operator to supply that value separately
when reviewing a downloaded artifact.

`offline_consistent` is deliberately narrower than “database verified.” The
verifier cannot establish GitHub run or artifact authenticity, inspect workflow
logs, prove PostgreSQL execution, validate commit signatures or branch
reachability, or prove the provenance of the operator-supplied anchors. A hash
copied from the same compromised run is not an independent trust source. Review
the GitHub run, event, actor, logs, commit, and artifact together before changing
any engine-dependent exit row.

The retained artifact from run `31961988213`, attempt 1, at commit `611c93d`
returned `offline_consistent` against independently supplied metadata and the
producer-log byte hash. The [evidence note](../POSTGRESQL_ACCEPTANCE_EVIDENCE.md)
records the exact anchors and limitations. This completes the first remote-run
consistency milestone.

The version 2 artifact from run `31988811000`, attempt 1, at commit `3479e164`
also returned `offline_consistent`; see the
[Cycle 1b-b2 evidence note](../POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). That run
adds one bounded, container-local authenticated runtime service account only.

The version 3 artifact from run `31991498652`, attempt 1, at commit `664c0e5b`
also returned `offline_consistent`; see the
[Cycle 1b-b3 evidence note](../POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md).
That reviewed run adds the exact shared synthetic tenant-isolation,
operation-rights, and one-backend prepared matrix through the service account.
External/production and end-user authentication,
migrator/test-loader/backup sessions, restore, pool/concurrency, and adapter
work remain separate gated work. `offline_consistent` still does not prove the
database execution without separate review of the run and logs.

The version 4 artifact from run `32007521395`, attempt 1, at commit `55c61ec`
also returned `offline_consistent`; see the
[Cycle 1b-b4 evidence note](../POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md). That
reviewed run adds the exact authenticated driverless financial-fact
query-to-normalizer path. It does not prove an application driver or pool,
complete or dimensioned projections, external/end-user identity, concurrency,
restore, or real data. `offline_consistent` remains a source/record consistency
result, not database-execution proof without the separately reviewed run and
logs.

The version 5 artifact from run `32012508025`, attempt 1, at commit `04e5c1b`
also returned `offline_consistent`; see the
[Cycle 1b-b5 evidence note](../POSTGRESQL_TEST_LOADER_EVIDENCE.md). That
reviewed run adds the exact authenticated non-owner synthetic fixture-load
path, including its negative, rollback, cleanup, and zero-residue probes. It
does not prove production/external authentication, end-user binding, TLS or
secret operations, an authenticated migrator or backup, a driver/pool or
concurrency, restore, real data, application integration, or production
readiness. `offline_consistent` remains a source/record consistency result, not
database-execution proof without the separately reviewed run and logs.

The version 6 artifact from run `32058853521`, attempt 1, at commit `7aac502`
also returned `offline_consistent`; see the
[Cycle 1b-b6 evidence note](../POSTGRESQL_OWNER_DDL_EVIDENCE.md). The verifier
accepted the same six-source bundle as versions 4 and 5 and required the exact
appended `authenticated_owner_ddl_canary` check with every version 5 limitation
unchanged. It does not infer that the canary is a migration and cannot remove
`authenticated_migrator_sessions`. Historical version 5 bytes and semantics
remain frozen. The later documentation commit does not retest or expand the
recorded run, and `offline_consistent` retains every verifier limitation above.

The version 7 artifact from run `32068159652`, attempt 1, at commit `41d13dd`
returned `offline_consistent`; see the
[Cycle 1b-b7 evidence note](../POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md).
The reviewer accepted the exact nine-source bundle, including the V2 platform
bootstrap, application manifest and bodies, and authenticated renderer. It
required the exact appended
`authenticated_clean_application_migrations_after_platform_bootstrap` check and
the ordered V7 limitation replacement while preserving every other version 6
limitation. Historical v1 through v6 bytes and meanings remain frozen. The
later documentation commit does not retest or expand the recorded run.

That `offline_consistent` result proves only record/source consistency; it
cannot authenticate GitHub or independently establish that the platform and
authenticated application phases executed. See
[ADR 0019](./0019-versioned-authenticated-migration-phase.md) for the bounded
claim and explicit nonclaims.

The Cycle 1b-b8 source includes a separate V8 verifier branch. That branch
preserves exact v1-v7 parsing; requires the appended
`authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore`
check and the exact three narrower nonclaims; and reads
`restore-platform.sql` plus `authenticated-backup-restore-plan.ts` from the
anchored commit under the exact `restorePlatformV1Sha256` and
`authenticatedBackupRestorePlanV1Sha256` keys. Missing, extra, reordered, or
mixed-version checks, limitations, source keys, or source files fail closed.
Its parser, verifier, and reviewer paths are included in the 409 passing tests
across the 10 database test files; database typechecking, the migration and
static PostgreSQL guardrails, ESLint, Prettier, and the diff check also pass
locally. Those checks alone did not substitute for a retained live artifact.

A retained version 8 record from run `32076642878`, attempt 1, at commit
`49d3a96` returned `offline_consistent` against the independently supplied
anchors. The
[Cycle 1b-b8 evidence note](../POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md)
records the exact artifact, evidence, source, and offline-output digests. That
verdict proves only that the retained record, supplied anchors, and fixed source
blobs agree. It cannot
prove that `pg_dump` authenticated as designed, that RLS limited the archive,
that `pg_restore` rolled back or restored the 21 data tables, or that cleanup
completed without separate review of the pinned run and logs. The temporary
data archive is not an evidence artifact and is not examined by the offline
verifier. See
[ADR 0020](./0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
and the [Cycle 1b-b8 exit matrix](../CYCLE_1BB8_EXIT_MATRIX.md).

The Cycle 1b-b9 source adds one explicit V9 verifier branch while preserving the
exact V1 through V8 branches. It requires the appended
`authenticated_single_client_read_only_financial_fact_projection_adapter`
check, the single narrower application-pool/composition nonclaim, the four new
source hashes, and exact `nodePostgres: "8.23.0"`. Missing, extra, reordered,
historical-version, or mixed-version fields and source blobs fail closed. The
parser, verifier, reviewer, and complete database suite pass locally.

A retained version 9 record from run `32083732063`, attempt 1, at commit
`8e470e9` returned `offline_consistent` against the independently supplied
anchors. The
[B9 evidence note](../POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md)
records the exact artifact, evidence, source, and offline-output digests. That
verdict proves only that the retained record, supplied anchors, and fixed source
blobs agree. It cannot prove the SCRAM login, real-client transaction flow,
authorization results, rollback/reuse behavior, or cleanup without separate
review of the pinned run and logs. See
[ADR 0021](./0021-single-client-read-only-postgresql-projection-adapter.md) and
the [Cycle 1b-b9 exit matrix](../CYCLE_1BB9_EXIT_MATRIX.md).

The accepted Cycle 1b-b10 evidence design adds one explicit V10 verifier and
reviewer branch while preserving the exact V1 through V9 branches. V10 requires
the appended
`authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery`
check, the exact transformed pool/load/cancellation/application limitations,
exact `nodePostgresPool: "3.14.0"`, and exact
`postgresProjectionPoolSha256` bytes read from
`packages/db/src/postgres-projection-pool.ts` at the independently anchored
commit. Missing, extra, reordered, historical-version, or mixed-version checks,
limitations, tool fields, source keys, and source blobs fail closed.

The V10 parser, verifier, reviewer, and complete database suite pass locally as
part of 12 database test files and 485 tests; database typechecking, migration
and PostgreSQL static guardrails, focused ESLint/Prettier, and the diff check
also pass. The retained V10 record from run `32161137775`, attempt 1, at commit
`2dcb259` returned `offline_consistent` against the independently supplied
anchors. The
[B10 evidence note](../POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md) records
the exact artifact, source, and offline-output digests. That verdict proves only
agreement among the retained record, independently supplied anchors, and fixed
commit blobs. It cannot by itself prove real pool checkout/reset, simultaneous
tenant isolation, cancellation settlement, server-timeout recovery,
failed-backend destruction, close/drain, or zero residue without separate
review of the pinned workflow and exact logs. See
[ADR 0022](./0022-bounded-postgresql-projection-pool-lifecycle.md) and the
[Cycle 1b-b10 exit matrix](../CYCLE_1BB10_EXIT_MATRIX.md).

The accepted Cycle 1b-b11 evidence design adds one explicit V11 verifier and
reviewer branch while preserving exact V1 through V10 behavior. V11 requires
the appended
`authenticated_locked_migration_ledger_checksum_drift_refusal_one_time_replay_rollback_and_concurrent_deployment`
check, the exact four-item migration nonclaim transformation, unchanged V10
tool fields, and exact `postgresMigrationDeployerSha256` bytes read from
`packages/db/src/postgres-migration-deployer.ts` at the independently anchored
commit. Missing, extra, reordered, historical-version, or mixed-version checks,
limitations, tools, source keys, and source blobs fail closed. A V10 record and
commit remain reviewable without the deployer path or hash.

Focused V1 through V11 parser, verifier, and reviewer compatibility coverage
passes 158 tests. The retained V11 record from run `32183709701`, attempt 1, at
commit `5df9d07` returned `offline_consistent` against independently supplied
anchors. That verdict proves only agreement among the retained record, anchors,
and fixed commit blobs. It cannot by itself prove that the deployer locked the
live ledger, refused live drift, rolled a suffix back, applied it once,
serialized two clients, or cleaned up; those claims also depend on the reviewed
workflow and exact logs. The
[B11 evidence note](../POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md) records
the exact artifact, evidence, source, and offline-output digests. See
[ADR 0023](./0023-locked-postgresql-migration-ledger-deployment.md) and the
[Cycle 1b-b11 exit matrix](../CYCLE_1BB11_EXIT_MATRIX.md).

The accepted Cycle 1b-b12 evidence design adds one explicit V12 verifier and
reviewer branch while preserving exact V1 through V11 behavior. V12 requires
the appended
`authenticated_rls_indexed_query_plans_and_bounded_2000_read_load` check,
unchanged V11 tool fields and limitations except for the single ordered
`thousand_simultaneous_database_backends_or_connections` insertion, and exact
`postgresQueryPlanLoadSha256` plus `queryPlanLoadFixtureSha256` bytes read from
`packages/db/src/postgres-query-plan-load.ts` and
`packages/db/acceptance/query-plan-load-fixture.sql` at the independently
anchored commit. Missing, extra, reordered, historical-version, or mixed-version
checks, limitations, tools, source keys, and source blobs fail closed. A V11
record and commit remain reviewable without either B12 path or hash.

V1 through V12 parser, verifier, reviewer, focused plan/load, and integrated
local compatibility gates pass. The retained V12 record from run `32230667908`,
attempt 1, at commit `59c4e58` returned `offline_consistent` against
independently supplied anchors. That verdict proves only agreement among the
record, anchors, and fixed commit blobs. It cannot by itself prove the runtime
plans, named-index use, 2,000 submitted reads through eight runtime workload
backends, Alpha/Beta isolation, finite execution, or cleanup; those claims also
depend on the reviewed workflow and exact logs. The
[B12 evidence note](../POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md) records the exact
artifact, evidence, source, and offline-output digests. See
[ADR 0024](./0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md) and
the [Cycle 1b-b12 exit matrix](../CYCLE_1BB12_EXIT_MATRIX.md).

The accepted B13 source design adds one explicit V13 verifier/reviewer branch
while preserving exact V1 through V12 behavior, including review of a V12
commit with no B13 paths or hashes. V13 requires the exact six new recorded
hashes and source blobs. The reviewer also reads the manifest-named platform
bootstrap and application body from the anchored commit, rejects an inexact
privacy-plan tree, and validates both body hashes against the canonical
manifest. The image config independently binds the B13 fixture; missing, extra,
or mixed bundles fail closed. This source compatibility is not a live result:
the retained V13 record from PostgreSQL run `32305478242`, attempt 1, at commit
`a959cba` separately returned `offline_consistent` against independent anchors.
That verdict does not by itself prove the live lifecycle; the claim also
depends on the reviewed workflow and exact logs. See the
[B13 evidence note](../POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](../CYCLE_1BB13_EXIT_MATRIX.md).

The accepted B14 source design adds one explicit V14 verifier/reviewer branch
while preserving exact V1 through V13 behavior, including review of a V13
commit with no B14 paths, hashes, or image-config field. V14 appends the exact
populated-cutover manifest, source, and fixture hashes. The reviewer also
requires the exact plan tree and validates the manifest-bound platform and two
application bodies, the selected pre-`0005` base, the explicit `0005`
exclusion, and the B13 target bindings at the anchored commit. The image config
independently binds the B14 fixture. This source compatibility is not a live
result; a retained V14 artifact and independently anchored review remain
required. See
[ADR 0026](./0026-bounded-populated-resource-identifier-online-cutover.md) and
the [Cycle 1b-b14 exit matrix](../CYCLE_1BB14_EXIT_MATRIX.md).
