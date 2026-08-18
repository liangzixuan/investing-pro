# ADR 0012: Success-only PostgreSQL acceptance run record

Status: accepted; version 9 live record retained and reviewed

Cycle 1b-b1 defines a digest-pinned PostgreSQL acceptance workflow, but a
terminal success message is not a durable, machine-readable link between the
tested checkout and the workflow run. A future successful run therefore emits
one small JSON run record only after every implemented acceptance probe has
completed successfully.

The record has an exact versioned schema. It binds the successful outcome to
the repository identity, checked-out commit, GitHub run and attempt, reviewed
PostgreSQL image-index reference, observed server and client versions, and
SHA-256 hashes of the reviewed workflow, synthetic fixture, migration manifest,
and acceptance runner. Its ordered check list is closed over the probes the
runner actually performs. A separate ordered limitations list records the
important properties the workflow does not prove.

The runner derives its output path from `RUNNER_TEMP` and uses a filename tied
to the schema version. The first retained record is
`research-cockpit-postgres-acceptance-v1.json`; version 2 adds the bounded
container-local SCRAM runtime probe; version 3 adds the authenticated runtime
authorization matrix; and version 4 adds the authenticated financial-fact
projection-query check plus the query and normalizer source hashes. Version 4
was retained and live-reviewed for its recorded B4 scope. Version 5 adds only
the authenticated test-loader fixture-load check and splits the remaining
migrator and backup session limitations; its first record is retained and
live-reviewed. Version 6 appends only the authenticated owner-DDL canary while
retaining the exact version 5 limitations and six-source-hash shape; its first
record is retained and live-reviewed. Version 7 preserves exact v1 through v6
parsing, appends only the clean authenticated application-migration check, and
binds three additional v2 plan inputs. Its pinned live run and review are
retained below. Version 8 preserves exact v1 through v7 parsing, appends only
the policy-scoped data dump and bounded clean restore check, and binds the two
additional B8 plan inputs. Its pinned live run and review are also retained
below. The current source producer writes
`research-cockpit-postgres-acceptance-v9.json`. Version 9 preserves exact v1
through v8 parsing, appends only the single-client read-only projection-adapter
check, binds four additional B9 sources, and records the exact node-postgres
version. Its pinned live run and independent review are retained below; source
presence alone is not evidence.

The writer creates the current file with
exclusive-create semantics and restrictive local permissions, so an old or
pre-created record cannot be overwritten. The entry point validates that the
clean checked-out Git commit equals `GITHUB_SHA`, awaits the complete
acceptance suite, revalidates that boundary, and only then builds and writes a
`passed` record. Callers cannot supply an outcome, check list, limitation list,
or arbitrary output path.

The isolated workflow uploads exactly that file only when the preceding step
succeeds. The upload action is pinned to an immutable commit, missing files are
errors, wildcard paths and failure-path uploads are forbidden, and retention is
finite. The JSON allowlists GitHub run metadata; it must never contain the
container ID, environment dump, credentials, tokens, SQL, logs, tenant or row
identifiers, query results, or data counts.

This run record is audit metadata, not a signed attestation or independent
proof. The recorded OCI digest is the reviewed multi-platform image-index
digest, not a claim about the resolved platform child manifest. GitHub artifact
retention is not a compliance archive, and an artifact from an untrusted pull
request is not automatically trusted. A record is useful only when reviewed
with its linked GitHub run and immutable commit.

The first record was produced by successful run `31961988213`, attempt 1, at
commit `611c93d` and retained outside the repository. ADR 0013's offline review
returned `offline_consistent`; exact links and hashes are in the
[evidence note](../POSTGRESQL_ACCEPTANCE_EVIDENCE.md). This remains unsigned
run metadata and does not promote any limitation recorded in the artifact.

The first version 2 record was produced by successful run `31988811000`,
attempt 1, at commit `3479e164` after the bounded container-local SCRAM runtime
probe passed. Its downloaded bytes also returned `offline_consistent`; the
[Cycle 1b-b2 evidence note](../POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md) records its
exact anchors and narrower authentication claim. Version 2 remains unsigned
run metadata and explicitly preserves the unproven production, end-user,
full-authorization, pool, restore, and real-data boundaries.

The first version 3 record was produced by successful run `31991498652`,
attempt 1, at commit `664c0e5b` after the authenticated runtime authorization
matrix passed. Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b3 evidence note](../POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md)
records its exact anchors and bounded claim. Version 3 adds exactly
`authenticated_runtime_authorization_matrix`, removes only the matching version
2 limitation, and remains unsigned run metadata. External/production and
end-user authentication, migrator/test-loader/backup sessions, pool and
concurrency behavior, restore, and real-data boundaries remain unproven.

The first version 4 record was produced by successful run `32007521395`,
attempt 1, at commit `55c61ec` after the driverless financial-fact projection
query and fail-closed normalizer path passed. Its downloaded bytes returned
`offline_consistent`; the
[Cycle 1b-b4 evidence note](../POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md) records
its exact anchors and bounded claim. Version 4 adds exactly
`authenticated_financial_fact_projection_query` and the two new source hashes,
retains every version 3 check and limitation, and adds explicit driver/pool and
complete-projection nonclaims. It remains unsigned run metadata.

The first version 5 record was produced by successful run `32012508025`,
attempt 1, at commit `04e5c1b` after the authenticated non-owner test-loader
fixture-load path passed. Its downloaded bytes returned `offline_consistent`;
the [Cycle 1b-b5 evidence note](../POSTGRESQL_TEST_LOADER_EVIDENCE.md) records
its exact anchors and bounded claim. Version 5 adds exactly
`authenticated_test_loader_fixture_load`, retains the version 4 six-source
shape and checks, and replaces only the combined future-session limitation with
separate authenticated-migrator and authenticated-backup nonclaims. It remains
unsigned run metadata and does not prove production/external authentication,
end-user binding, TLS/secrets, a driver or pool, concurrency, restore, real
data, or application integration.

The first version 6 record was produced by successful run `32058853521`,
attempt 1, at commit `7aac502` after the authenticated owner-DDL canary passed.
Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b6 evidence note](../POSTGRESQL_OWNER_DDL_EVIDENCE.md) records its
exact anchors and bounded claim. Version 6 appends exactly
`authenticated_owner_ddl_canary` and retains every version 5 check, limitation,
and source-hash key. The canary exercises one temporary authenticated owner-role
transition and fixed DDL object after the unchanged bootstrap; it does not
execute a migration or remove `authenticated_migrator_sessions`. Its distinct
filename and artifact name prevent reinterpretation of the retained version 5
record. The later documentation commit does not retest or expand the recorded
run.

The version 7 record from successful run `32068159652`, attempt 1, at commit
`41d13dd` was retained after the bounded authenticated application-migration
phase passed. Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b7 evidence note](../POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md)
records its exact anchors and bounded claim. Version 7 replaces only the
ordered `authenticated_migrator_sessions` limitation with narrower external/
production/incremental-migration and global platform/application atomicity
nonclaims, while retaining every other version 6 limitation. Its expanded
source bundle binds the v2 platform bootstrap, exact application manifest, and
authenticated migration renderer; the manifest in turn binds every exact
application body. The later documentation commit does not retest or expand the
recorded run. See [ADR 0019](./0019-versioned-authenticated-migration-phase.md).

Cycle 1b-b8 has a reviewed version 8 source/evidence contract and live record.
V8 preserves exact v1-v7 parsing and meanings, appends only
`authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore`,
and adds exactly `restorePlatformV1Sha256` and
`authenticatedBackupRestorePlanV1Sha256` to the ordered source-hash bundle. It
replaces only `authenticated_backup_sessions` with
`external_production_incremental_or_continuous_authenticated_backups`, and
replaces only `dump_restore_or_disaster_recovery` with
`full_schema_global_object_cross_cluster_or_cross_version_restore` followed by
`disaster_recovery_storage_encryption_retention_rpo_or_rto`. Every other V7
check, limitation, source key, and historical interpretation remains fixed.
This source contract passed all 409 tests across the 10 database test files,
database typechecking, the migration and static PostgreSQL guardrails, ESLint,
Prettier, and the diff check.

The version 8 record from successful run `32076642878`, attempt 1, at commit
`49d3a96` was retained after the complete B8 path and mandatory cleanup passed.
Its downloaded bytes returned `offline_consistent`; the
[Cycle 1b-b8 evidence note](../POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md)
records the exact anchors and bounded claim. That later result does not alter
the source shape or interpretation of any version 1 through version 7 record.

The historical version 8 record name is
`research-cockpit-postgres-acceptance-v8.json`, and its artifact name was bound
to the exact commit and attempt as
`postgres-acceptance-evidence-v8-${sha}-${attempt}`. It could be written only
after the authenticated RLS-scoped data-only dump, independently provisioned
same-cluster restore, transactional failure and successful restore, 21-table
fingerprints, source isolation, and complete cleanup all pass. The archive
itself is temporary application data and is not uploaded with the evidence
record. See
[ADR 0020](./0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
and the [Cycle 1b-b8 exit matrix](../CYCLE_1BB8_EXIT_MATRIX.md).

Cycle 1b-b9 has a separate version 9 source/evidence contract. V9 appends only
`authenticated_single_client_read_only_financial_fact_projection_adapter`,
adds exact hashes for the adapter, core operation-projection contract, database
package manifest, and workspace lockfile, and extends only the V9 tool-version
shape with `nodePostgres: "8.23.0"`. It replaces only
`application_driver_pool_or_composition_root` with
`application_pool_or_composition_root`; every other V8 check, limitation,
source key, and historical meaning remains fixed. The current filename is
`research-cockpit-postgres-acceptance-v9.json`, and the artifact is
`postgres-acceptance-evidence-v9-${sha}-${attempt}`.

The V9 writer remains success-only and runs after the real client is closed,
its backend is drained, the runtime login is removed, and all earlier B1 through
B8 cleanup checks pass. Source and local verification passed 450 database tests
plus typechecking and the static quality gates. The version 9 record from
successful run `32083732063`, attempt 1, at commit `8e470e9` was retained after
the complete B9 path and mandatory cleanup passed. Its downloaded bytes returned
`offline_consistent`; the
[B9 evidence note](../POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md)
records the exact anchors and bounded claim. That result does not alter any
version 1 through version 8 record. See
[ADR 0021](./0021-single-client-read-only-postgresql-projection-adapter.md) and
the [Cycle 1b-b9 exit matrix](../CYCLE_1BB9_EXIT_MATRIX.md).

Cycle 1b-b10 has a separate accepted version 10 contract. V10 appends only
`authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery`,
adds exact `postgresProjectionPoolSha256` bytes for
`packages/db/src/postgres-projection-pool.ts`, and extends only the V10
tool-version shape with `nodePostgresPool: "3.14.0"`. It transforms only the
completed pool gaps: `production_identity_tls_secrets_or_pooling` becomes
`production_identity_tls_secrets_or_load_ready_pooling`,
`concurrent_sessions_cancellation_or_timeouts` becomes
`production_load_capacity_pool_tuning_or_failover`, the explicit
`prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend`
nonclaim is inserted, and `application_pool_or_composition_root` becomes
`application_composition_root`. Every other V9 check, limitation, source key,
tool field, and historical meaning remains fixed.

The V10 record name is
`research-cockpit-postgres-acceptance-v10.json`; its artifact name is
`postgres-acceptance-evidence-v10-${sha}-${attempt}`. The writer remains
success-only and may run only after the real bounded pool suite settles, the
pool ends, its backends drain, the ephemeral login and memberships are removed,
and every inherited cleanup gate passes. The V10 source/local contract passes
all 12 database test files and 485 tests, database typechecking, migration and
PostgreSQL static guardrails, focused ESLint/Prettier, and the diff check. The
version 10 record from successful run `32161137775`, attempt 1, at commit
`2dcb259` was retained after the bounded pool path and mandatory cleanup passed.
Its downloaded bytes returned `offline_consistent`; the
[B10 evidence note](../POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md) records
the exact anchors and bounded claim. This successor does not alter any version 1
through version 9 record. See
[ADR 0022](./0022-bounded-postgresql-projection-pool-lifecycle.md) and the
[Cycle 1b-b10 exit matrix](../CYCLE_1BB10_EXIT_MATRIX.md).

## Primary sources

- [GitHub artifact upload action](https://github.com/actions/upload-artifact)
- [GitHub artifact retention documentation](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/downloading-workflow-artifacts)
- [GitHub default environment variables](https://docs.github.com/en/actions/reference/variables-reference)
