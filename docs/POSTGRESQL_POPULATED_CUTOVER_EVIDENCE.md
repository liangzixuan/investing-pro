# PostgreSQL bounded populated resource-identifier cutover evidence

Reviewed: 2026-08-20 (America/Chicago)

This note records the successful Cycle 1b-b14 execution of one exact,
authenticated, bounded synthetic populated resource-identifier cutover from
the v2 pre-`0005` branch to the B13 keyed lifecycle in a disposable PostgreSQL
17.11 database. It also records the separate offline consistency review of the
downloaded version 14 success record. It is not a general populated migration,
a production application-writer or dual-write protocol, a continuous
zero-downtime result, recovery of identifiers deleted before capture,
real-data evidence, privacy/legal approval, or production-readiness evidence.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`d688aa21e969feef6611f6efcd1aeaaed6e31df9`](https://github.com/liangzixuan/investing-pro/commit/d688aa21e969feef6611f6efcd1aeaaed6e31df9)
- PostgreSQL workflow: successful [run `32343225599`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32343225599)
- PostgreSQL job: successful [Ubuntu 24.04 job `96346376434`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225599/job/96346376434)
- Cross-platform release gate: successful [CI run `32343225420`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225420), with [Ubuntu job `96346375855`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225420/job/96346375855) and [Windows job `96346375722`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225420/job/96346375722) successful

The success record reports completion at `2026-08-20T07:20:01.999Z`. The
reviewed job log records the acceptance evidence digest at
`2026-08-20T07:20:02.0021106Z`, the terminal version 14 pass marker at
`2026-08-20T07:20:02.0031649Z`, and final artifact upload at
`2026-08-20T07:20:03.2460079Z`.

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the anchors above. Any workflow execution
triggered by that documentation commit is a separate repository health check.

## Retained artifact and logs

- Artifact: [`postgres-acceptance-evidence-v14-d688aa21e969feef6611f6efcd1aeaaed6e31df9-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225599/artifacts/9397159387)
- Artifact ID: `9397159387`
- Artifact created: `2026-08-20T07:20:03Z`
- GitHub artifact expiry: `2026-09-19T07:20:02Z`
- GitHub/local artifact ZIP byte length: `3512`
- GitHub/local artifact ZIP SHA-256: `e674d6b34fd44616e0d81a500baea080a2d103e05829f442e1389de3642952c1`
- Sole regular non-symlink ZIP entry: `research-cockpit-postgres-acceptance-v14.json`
- Evidence JSON byte length: `7835`
- Producer-log and downloaded-file SHA-256: `d7d11b23a8f4fd84337383d3b78c7a7a05e0eb5dbb5a60b3d6b9c0efc0e05ada`
- Recorded completion time: `2026-08-20T07:20:01.999Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `4556`
- Retained offline-verification JSON SHA-256: `a3c67cebdf402d16953693057797e4471e17b563d9fd35f74b3c2568c1d94420`
- Reviewed authenticated log ZIP byte length: `356215`
- Reviewed authenticated log ZIP SHA-256: `4638a61f35bce424d358b134c987f131888c6bd116b0a5438d75f3246a7d7192`
- Reviewed aggregate job-log byte length: `1137361`
- Reviewed aggregate job-log SHA-256: `b2a9bc1481666eabf8f8c3bd5a6794ad896f296802ad70185f28e831593e7fb1`

The artifact ZIP contained exactly one regular, non-symlink JSON entry. Its
SHA-256 matched the upload-step digest, and the downloaded JSON SHA-256 matched
the reviewed producer-log value. Artifact retention remains finite; the
separately retained operator copy has its own custody boundary.

## Reviewed target, tools, and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- `postgres`: `postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `psql`: `psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `pgDump`: `pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `pgRestore`: `pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `nodePostgres`: `8.23.0`
- `nodePostgresPool`: `3.14.0`
- `workflowSha256`: `5f8ab0336cfb9fc35363f5b69d5db4564eaa79c7dd7fc16eecb266aa902e844f`
- `fixtureSha256`: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- `migrationManifestSha256`: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- `acceptanceRunnerSha256`: `345229a32d301680eb41705548e2141d956cdb962eb8ea00e9f549eea9d8a48e`
- `projectionQuerySha256`: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- `projectionNormalizerSha256`: `6e31fc64a360bbde19c888a0a9d9bba73586526700aaff3da7fbf80d537f7afe`
- `platformBootstrapV2Sha256`: `21da4c90175b5b22f0e87a21fcd37ce2d6be651ed1c276d30fd01565c9eb41f1`
- `applicationMigrationManifestV2Sha256`: `633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35`
- `authenticatedMigrationRendererV2Sha256`: `195510475d2eb6dcfe9dca4f781f335c00a1b4e40de672ef07091a17c717eb7e`
- `restorePlatformV1Sha256`: `78b566cc1321956f4660619b628ce586fabfa4f22a85c0dfb1c5df7e1456e5ae`
- `authenticatedBackupRestorePlanV1Sha256`: `cf9907c04f8a94256a2e342cbd2dbc87eb587f49f32fd4683d5856835ceda7f7`
- `postgresProjectionAdapterSha256`: `230cc911ea8c87e4c4713e5f9b018bd904fbf5bc665b921c2b48e162e7039dda`
- `operationProjectionContractSha256`: `9ac7c0fca7ed1d37cea1f03dccd743d2a4120108eca096ec39dd49265ef7cb08`
- `databasePackageManifestSha256`: `440de7d976e32e4e4bcbff97cbeb40586d69d29e47f3958f0c00fc25249497ea`
- `pnpmLockfileSha256`: `7177d4376117e4c93a985cd0c895cc90acae18041ecd0c1ae28fffda06843dc4`
- `postgresProjectionPoolSha256`: `257e2ab0a0a245c6385f8eddf6d44973dbddbb9cd6fc6a4b089cb0867aefa5e8`
- `postgresMigrationDeployerSha256`: `50e5829deaa5465935c2fc4669f9bd27622f6e8f59048ace6e028de4a0613374`
- `postgresQueryPlanLoadSha256`: `34c86b8f40bd5486eb7d16ea282665ee7703e4a93605d00fd37b0ff931cd7429`
- `queryPlanLoadFixtureSha256`: `e344c31adeb4cef3d7de2fad65bd4837a0c51c57f3b359a634eb42da9d0642ad`
- `privacyRetentionPolicyV1Sha256`: `6bc14df7cd812a5e41107f7db4ad099d634cd24ac71eea36e528289bd5990b32`
- `privacyRetentionPlanManifestV1Sha256`: `28f0b9f0a3fb5981fc5c96cf9f5544e189fdc63a5e9c72c20fda1e01f8f702d7`
- `privacyRetentionPolicySourceV1Sha256`: `9d9e9844640517a5fd81f2964bf44f794a648b3f9c85f3a5c1824f569ea353be`
- `privacyRetentionPlanSourceV1Sha256`: `a34b71adcde24efe7bfbdd2ebad9e001d93a7fe6bff39aeb1a4f369bdfcab06a`
- `resourceIdentifierTokenV1Sha256`: `04b7ef5ec0160062e24218999edaec5f84301ec4a3755faf3d44d004bac73548`
- `privacyRetentionFixtureV1Sha256`: `9be0682dffbb981350bde888b2880b99e2bfa587da96acdfae281c41be67a6c7`
- `populatedCutoverPlanManifestV1Sha256`: `7aa43475461ab2c0b27dc2cbada9290ee1959495ee08d4137e2e8cfe81677dec`
- `populatedCutoverPlanSourceV1Sha256`: `dac9c42c92705725c3b035fd572b12d8f6181259c938e73c4fc1a31f29c985a9`
- `populatedCutoverFixtureV1Sha256`: `f30651fd5b847a6d1b365830c32335c98ff8106f49200dc40b4f33494a583198`

The version 14 record contains exactly 28 ordered source-hash fields and the
same exact six-tool shape as V13. It preserves all 25 V13 source hashes and
appends only the populated-cutover manifest, renderer source, and fixture
hashes.

## Populated-cutover manifest chain

The commit-bound reviewer matched all 13 manifest-chain bindings:

1. `platform-bootstrap.sql`:
   `63524caa33c8c05e4ea653fbfcbf23e29f43028af34f8d3b297abdb1048dfc0c`.
2. Base v2 application manifest:
   `633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35`.
3. Selected `v2-0001` / `0001_request_context_and_ledger.sql`:
   `37d69e26b370e6a0c9f191e6f46a8d59579612f67c16f918e2ed78a5eb399e2f`.
4. Selected `v2-0002` / `0002_canonical_entities.sql`:
   `272dce4b0d91e96f58442896621b2d570e8e027fbfc843f83de5f36c005154f6`.
5. Selected `v2-0003` / `0003_temporal_constraints_and_indexes.sql`:
   `d7a1a3d1991cb0a531a1643111fb8192dfad546efa4aa4913d0d8f8f34fed4d2`.
6. Selected `v2-0004` / `0004_row_security_and_runtime_grants.sql`:
   `ecaf289311eea9a58d8c4e4f342e9f7e40f86f0b05fdebc9d50975aa672930eb`.
7. Selected `v2-0006` / `0006_null_safe_request_context.sql`:
   `b3da4be6401accbd0140f0fe9a85d04d4093a06448eab129aa1c9c78be363f91`.
8. Excluded `v2-0005` / `0005_non_reusable_resource_ids.sql`:
   `703205835c4689350ec0d49d4377adaa08dc2abdcc63bf669dda8dee7049d61d`,
   with reason `replaced_by_audited_populated_cutover`.
9. B13 target manifest:
   `28f0b9f0a3fb5981fc5c96cf9f5544e189fdc63a5e9c72c20fda1e01f8f702d7`.
10. B13 target policy:
    `6bc14df7cd812a5e41107f7db4ad099d634cd24ac71eea36e528289bd5990b32`.
11. B13 target application body:
    `87df05b88653621b1999343786de0c3a60d0f5e7468348dc24269d6ae493af62`.
12. `application/0001_expand_capture_and_backfill.sql`:
    `c7d876614be5bcfe4a7339e75cf14046c63a4bb4ea5d4d109a1ab582f3c70431`.
13. `application/0002_validate_and_contract.sql`:
    `60b38c8f2c91363408e2c3544b68181234d19bccf4a72de5d54023ba42ba7f64`.

The top-level populated-cutover manifest hash is
`7aa43475461ab2c0b27dc2cbada9290ee1959495ee08d4137e2e8cfe81677dec`.
The reviewer required the exact plan tree, regular-file shapes, ordering,
filenames, base selection, explicit exclusion, target bindings, and body
hashes. Missing, extra, reordered, mixed-version, noncanonical, or non-regular
inputs failed closed. V1 through V13 review branches remained exact, including
review of a historical V13 commit with no B14 paths, hashes, or fixture field.

## Reviewed log markers

The successful job log contained these exact terminal markers:

- [`PostgreSQL acceptance evidence SHA-256: d7d11b23a8f4fd84337383d3b78c7a7a05e0eb5dbb5a60b3d6b9c0efc0e05ada`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225599/job/96346376434#step:7:13)
- [`PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, locked migration-ledger checksum-drift refusal, one-time suffix replay, injected rollback, concurrent deployment serialization, bounded PostgreSQL RLS query-plan and 2,000-read load, authenticated synthetic keyed resource-identifier privacy lifecycle with database-time retention boundaries and tenant-isolated offboarding, authenticated bounded synthetic populated resource-registry backfill and online cutover with capture-epoch retry, concurrent-write serialization, raw-cleared tombstones, and B13 catalog equivalence, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, single-client read-only financial-fact projection adapter, and bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery acceptance passed; the version 14 success-only run record was written.`](https://github.com/liangzixuan/investing-pro/actions/runs/32343225599/job/96346376434#step:7:14)

The upload step separately recorded one input file, `3512` uploaded bytes, ZIP
digest `e674d6b34fd44616e0d81a500baea080a2d103e05829f442e1389de3642952c1`,
artifact ID `9397159387`, final size `3512`, and the retained artifact URL. The
reviewed log contained zero `##[error]`, `PostgreSQL acceptance failed`,
`B14 populated-cutover diagnostic`, or failed-process terminal markers. The
inherited B12 planning/execution durations and shared-buffer counts are
observations from this one synthetic run and are not a B14 performance claim.

## Recorded checks and exact B14 scope

The version 14 record contains these exact ordered `checksPassed` values:

- `pristine_target`
- `atomic_bootstrap_rollback`
- `clean_bootstrap`
- `migration_ledger`
- `replay_rejection`
- `synthetic_fixture_load`
- `catalog_contract`
- `backup_capability_catalog`
- `request_context_cleanup`
- `tenant_isolation`
- `operation_rights`
- `write_denials`
- `bounded_container_local_scram_runtime_probe`
- `authenticated_runtime_authorization_matrix`
- `authenticated_financial_fact_projection_query`
- `authenticated_test_loader_fixture_load`
- `authenticated_owner_ddl_canary`
- `authenticated_clean_application_migrations_after_platform_bootstrap`
- `authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore`
- `authenticated_single_client_read_only_financial_fact_projection_adapter`
- `authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery`
- `authenticated_locked_migration_ledger_checksum_drift_refusal_one_time_replay_rollback_and_concurrent_deployment`
- `authenticated_rls_indexed_query_plans_and_bounded_2000_read_load`
- `versioned_privacy_retention_decision_contract`
- `authenticated_bounded_synthetic_resource_identifier_privacy_retention_lifecycle`
- `versioned_populated_resource_identifier_cutover_contract`
- `authenticated_bounded_synthetic_populated_resource_identifier_online_cutover`

Version 14 preserves every version 1 through version 13 check and appends only
the two final B14 checks. Historical parser branches, records, checks,
limitations, source shapes, tool shapes, and meanings remain frozen for their
versions.

The runner built the fixed `research_cockpit_b14_populated_cutover_test`
database from `template0`, applied only v2 `0001` through `0004` plus `0006`,
and loaded the reviewed populated synthetic fixture without applying the
excluded raw-registry migration. Expand established the temporary audited work
registry, capture triggers, B13-shaped target tables, and not-yet-validated
live foreign keys. The authenticated owner-visible population assertion ran
only after its temporary FORCE-RLS policies existed.

The exact acceptance sequence exercised current populated rows, a
post-capture acceptance-only test-seed insert, and an authenticated
migrator-to-owner delete while bounded backfill was open. External code derived
the 32-byte tokens outside final relation locks; PostgreSQL received no key and
did not authenticate HMAC provenance. A stale capture epoch forced rollback,
reinspection, external derivation, and retry. An injected contract failure left
the exact expanded catalog, ledger, and source state unchanged.

Finalization held the exclusive advisory gate and deterministic relation
barrier, rechecked the epoch and zero pending work, serialized a second
deployer, visibly blocked a pre-derived acceptance writer, validated complete
source/work/registry correspondence, restored the exact inherited identity
triggers, removed all transition objects and grants, committed, and let the
writer resume against the final keyed path. Replay failed closed. Final state
preserved live allocations, carried the exercised post-capture deletion into a
raw-cleared keyed tombstone, rejected token reuse, and matched the normalized
semantic B13 application catalog. That comparator does not establish physical
layout, OID, page, heap, index-storage, or byte-for-byte database equivalence.

Mandatory cleanup rolled back and closed clients, drained B14 backends, dropped
the disposable database without `FORCE`, removed ephemeral roles, settings,
memberships, and credentials, rechecked the source database fingerprint and
catalog, and proved aggregate-only zero B14 residue before the V14 record was
written.

The insert and final writer used acceptance-only test identities; the delete
used the authenticated migrator selecting the owner role for one synthetic
fixture action. These identities do not define or authorize a production
application writer. There is no authoritative pre-B14 registry from which to
recover identifiers deleted before the capture boundary.

## Offline review boundary

The downloaded version 14 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. Its exact
ordered `verificationChecks` values were:

- `canonical_record_bytes`
- `external_record_sha256`
- `metadata_anchor_match`
- `reviewed_target_at_commit`
- `recorded_source_hashes_at_commit`
- `migration_manifest_at_commit`

The verifier established canonical record bytes, anchor equality, the reviewed
target at the tested commit, all 28 recorded source hashes, the exact historical
migration manifest and bodies, every closed V2/B8/B9/B10/B11/B12/B13/B14
source tree, all 13 populated-cutover manifest-chain bindings, and exact
`nodePostgres: "8.23.0"` and `nodePostgresPool: "3.14.0"` values at that commit.

The offline record contains these exact ordered verifier `notProven` values:

- `github_run_or_artifact_authenticity`
- `workflow_logs_or_database_execution`
- `commit_signature_or_branch_reachability`
- `trust_anchor_provenance`

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature. The live B14 behavior above also depends on the separately reviewed
workflow and exact logs, not on `offline_consistent` alone.

## Explicitly not proven

The version 14 record contains these exact ordered `notProven` values:

- `resolved_platform_image_manifest`
- `external_or_production_authenticated_database_sessions`
- `external_or_production_incremental_migrator_credentials`
- `arbitrary_manifest_multi_release_or_general_incremental_migrations`
- `globally_atomic_platform_and_application_bootstrap`
- `production_migration_orchestration_crash_recovery_cancellation_or_failover`
- `external_production_incremental_or_continuous_authenticated_backups`
- `end_user_identity_or_tenant_binding`
- `production_identity_tls_secrets_or_load_ready_pooling`
- `production_load_capacity_pool_tuning_or_failover`
- `thousand_simultaneous_database_backends_or_connections`
- `prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend`
- `full_schema_global_object_cross_cluster_or_cross_version_restore`
- `disaster_recovery_storage_encryption_retention_rpo_or_rto`
- `real_or_licensed_market_data`
- `application_composition_root`
- `complete_dossier_history_timeline_or_dimensioned_projection`
- `production_privacy_legal_approval_lawful_basis_notices_or_legal_holds`
- `verified_data_subject_identity_or_production_dsar_fulfillment`
- `production_tenant_offboarding_retention_scheduler_or_monitoring`
- `external_kms_hsm_key_custody_rotation_destruction_or_recovery`
- `database_verification_of_externally_keyed_resource_tokens`
- `cryptographic_erasure_of_plaintext_database_or_backup_data`
- `production_primary_replica_cache_log_search_analytics_or_third_party_deletion`
- `production_backup_archive_expiry_deletion_restore_suppression_or_media_sanitization`
- `external_or_production_populated_database_privacy_migration_or_cutover`
- `zero_downtime_uninterrupted_writes_or_application_dual_write_deployment`
- `production_application_writer_integration_authorization_or_dual_write_protocol`
- `production_cutover_volume_duration_slo_or_lock_budget`
- `migration_process_or_cluster_crash_recovery_resume_or_post_commit_downgrade`
- `long_running_prepared_transaction_ddl_replication_or_failover_concurrency`
- `real_customer_tenant_personal_or_non_synthetic_cutover`
- `recovery_of_resource_identifiers_deleted_before_b14_capture_boundary`
- `globally_complete_or_independently_audited_deletion_proof`
- `real_customer_tenant_or_personal_data`

V14 removes only V13's broad
`populated_database_privacy_migration_backfill_or_online_cutover` nonclaim and
inserts the eight narrower populated-cutover limitations above. All other V13
limitations retain their exact order and meaning.

B14 proves only the exact manifest-bound, authenticated synthetic transition
above in one disposable PostgreSQL 17.11 database. Production admission
remains blocked. This result does not establish a production writer or
allocation/dual-write protocol, uninterrupted writes, general application
compatibility, arbitrary allocation gaps, production volume/duration/SLO/lock
budgets, crash/restart/resume/failover/replication/prepared-transaction
behavior, downgrade, recovery of pre-capture deletions, external key custody,
global deletion, real-customer-data admission, application composition,
deployment, or production readiness.

## Related records

- [ADR 0026: Bounded populated resource-identifier online cutover](./adr/0026-bounded-populated-resource-identifier-online-cutover.md)
- [Cycle 1b-b14 exit matrix](./CYCLE_1BB14_EXIT_MATRIX.md)
- [Cycle 1b-b13 evidence note](./POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md)
