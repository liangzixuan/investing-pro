# PostgreSQL keyed resource-identifier privacy and retention evidence

Reviewed: 2026-08-19 (America/Chicago)

This note records the successful Cycle 1b-b13 execution of one exact,
synthetic, empty-data-only keyed resource-identifier privacy/retention
lifecycle in a disposable PostgreSQL 17.11 database, plus the separate offline
consistency review of its downloaded version 13 success record. It is not
privacy or legal approval, a production retention or deletion system, a
populated migration, real-data evidence, cryptographic-erasure evidence, or
production-readiness evidence.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`a959cba7340433d84d0c443b9801da38807af464`](https://github.com/liangzixuan/investing-pro/commit/a959cba7340433d84d0c443b9801da38807af464)
- PostgreSQL workflow: successful [run `32305478242`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32305478242)
- PostgreSQL job: successful [Ubuntu 24.04 job `96237186104`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478242/job/96237186104)
- Cross-platform release gate: successful [CI run `32305478282`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32305478282), with [Ubuntu job `96237186331`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478282/job/96237186331) and [Windows job `96237186012`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478282/job/96237186012) successful

The PostgreSQL run was created and started at `2026-08-19T21:45:13Z`; its job
ran from `2026-08-19T21:45:15Z` through `2026-08-19T21:48:03Z`, and the run was
updated at `2026-08-19T21:48:04Z`. The acceptance step ran from
`2026-08-19T21:45:55Z` through `2026-08-19T21:48:00Z`; artifact upload ran from
`2026-08-19T21:48:00Z` through `2026-08-19T21:48:01Z`.

The CI run was updated at `2026-08-19T21:49:56Z`. Its Ubuntu job ran from
`2026-08-19T21:45:15Z` through `2026-08-19T21:46:37Z`, with the gate running
from `2026-08-19T21:45:30Z` through `2026-08-19T21:46:33Z`. Its Windows job ran
from `2026-08-19T21:45:15Z` through `2026-08-19T21:49:55Z`, with the gate
running from `2026-08-19T21:46:02Z` through `2026-08-19T21:49:51Z`.

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the anchors above. Any workflow execution
triggered by that documentation commit is a separate repository health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v13-a959cba7340433d84d0c443b9801da38807af464-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478242/artifacts/9384603022)
- Artifact ID: `9384603022`
- Artifact created/updated: `2026-08-19T21:48:01Z`
- GitHub artifact expiry: `2026-09-18T21:48:00Z`
- GitHub/local artifact ZIP byte length: `3181`
- GitHub/local artifact ZIP SHA-256: `b369da337dec940dc03961b6a6e3060b1bba59a0451f5b2aa3a7c695abc8df6c`
- Sole regular non-symlink ZIP entry: `research-cockpit-postgres-acceptance-v13.json`
- Evidence JSON byte length: `6823`
- Producer-log and downloaded-file SHA-256: `61f0178d7cd07298a7fc1c7241f3cc50b1388b902e9387e406c486a94f90a79f`
- Recorded completion time: `2026-08-19T21:48:00.148Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `3872`
- Retained offline-verification JSON SHA-256: `f3a9d5664aea4cc781044bb98f2f76da3c7526c68a310ef184fe32a76aedeb8b`
- Reviewed authenticated log ZIP byte length: `170588`
- Reviewed authenticated log ZIP SHA-256: `6978e9e696b0bcfc8f066b86c5e190e820b82da00654af46c04a75e7c07cb1c8`
- Reviewed aggregate job-log byte length: `521186`
- Reviewed aggregate job-log SHA-256: `d46065bf6ce0634de31e6ae6dbaf9d59e8b56f945a982b2fccae322066502eea`

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
- `workflowSha256`: `c67ac50f09fd31d0901d6421a2a434c050a319d170866fee70e5a59cd0911966`
- `fixtureSha256`: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- `migrationManifestSha256`: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- `acceptanceRunnerSha256`: `442e9b6db7c5d096d221bf87fe96d15c28764bcffc3f44e322feacc8c5a8edc2`
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
- Manifest-named privacy platform body SHA-256: `9451c594f06aeae596e66cc22a4416285b5432b74fcff65664429a1472814376`
- Manifest-named privacy application body SHA-256: `87df05b88653621b1999343786de0c3a60d0f5e7468348dc24269d6ae493af62`

The version 13 record contains exactly 25 ordered source-hash fields. The
commit-bound reviewer also read the two manifest-named SQL bodies at the tested
commit and matched their hashes to the canonical plan manifest.

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- [`B12 PostgreSQL plan metrics: fact.runtime_rls planning_ms=11.644 execution_ms=37.517 shared_hit_blocks=1576 shared_read_blocks=0; tenant.runtime_rls planning_ms=0.17 execution_ms=0.321 shared_hit_blocks=15 shared_read_blocks=0; fact.superuser_bypass planning_ms=4.396 execution_ms=0.469 shared_hit_blocks=77 shared_read_blocks=0; tenant.superuser_bypass planning_ms=0.196 execution_ms=0.051 shared_hit_blocks=9 shared_read_blocks=0`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478242/job/96237186104#step:7:12)
- [`PostgreSQL acceptance evidence SHA-256: 61f0178d7cd07298a7fc1c7241f3cc50b1388b902e9387e406c486a94f90a79f`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478242/job/96237186104#step:7:13)
- [`PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, locked migration-ledger checksum-drift refusal, one-time suffix replay, injected rollback, concurrent deployment serialization, bounded PostgreSQL RLS query-plan and 2,000-read load, authenticated synthetic keyed resource-identifier privacy lifecycle with database-time retention boundaries and tenant-isolated offboarding, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, single-client read-only financial-fact projection adapter, and bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery acceptance passed; the version 13 success-only run record was written.`](https://github.com/liangzixuan/investing-pro/actions/runs/32305478242/job/96237186104#step:7:14)

The upload step separately recorded one input file, `3181` uploaded bytes, the
exact ZIP digest, artifact name and ID, and final byte length. Neither the
acceptance step nor the upload step contained an error marker. The inherited
B12 planning/execution durations and shared-buffer counts are observations from
this one synthetic run and are not a new B13 performance claim.

## Recorded checks and exact B13 scope

The version 13 record contains these exact ordered `checksPassed` values:

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

Version 13 preserves every version 1 through version 12 check and appends only
the two final B13 checks. Historical parser branches, records, checks,
limitations, source shapes, tool shapes, and meanings remain frozen for their
versions.

After the exact B12 target and inherited checks passed, the runner created the
fixed `research_cockpit_b13_privacy_retention_test` database from `template0`.
It proved injected rollback and pristine-target replay refusal, loaded the
exact v2 application plan through a fresh authenticated migrator, proved an
injected privacy-suffix rollback, and preserved a canary while refusing a
populated suffix. A separate two-session race proved the write-conflicting
empty-only barrier rejects a concurrent population attempt before the final
suffix was installed. The final plan replay also failed closed.

The fresh privacy login authenticated over the bounded container-local path,
held only the fixed `SET ROLE` capability edge, and had no direct table ACLs.
The probe checked the exact catalog, ownership, forced-RLS policy, trigger,
function, grant, and migration-ledger inventory; fixture state and tenant
isolation; wrong-password and direct-use denials; and the fixed capability
surface.

The authenticated lifecycle purged exactly three expired idempotency rows and
three expired audit rows while preserving the boundary/future and other-tenant
rows. The future rows retained the exact 24-hour and 90-day technical
durations. A single-resource hard delete removed the live thesis, preserved its
allocation, cleared both raw UUIDs, retained the 32-byte pseudonymous token,
and rejected same-token reuse with SQLSTATE `23505`.

The offboarding transition serialized against a concurrent allocation,
blocked that allocation after the domain left `active`, purged the exact
synthetic tenant graph and token rows, preserved the other tenant, and rejected
a second purge. Mandatory cleanup rolled back and closed clients, drained B13
backends, dropped the database without `FORCE`, removed ephemeral logins,
memberships, settings, and SCRAM verifiers, rechecked the source fingerprint and
catalog, and proved zero B13 residue before the V13 record was written.

## Offline review boundary

The downloaded version 13 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. Its exact
ordered `verificationChecks` values were:

- `canonical_record_bytes`
- `external_record_sha256`
- `metadata_anchor_match`
- `reviewed_target_at_commit`
- `recorded_source_hashes_at_commit`
- `migration_manifest_at_commit`

The verifier established canonical record bytes, anchor equality, the reviewed
target at the tested commit, all 25 recorded source hashes, the exact historical
migration manifest and bodies, every closed V2/B8/B9/B10/B11/B12/B13 source
tree, both manifest-named B13 SQL-body hashes, and exact
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
signature. The live B13 behavior above also depends on the separately reviewed
workflow and exact logs, not on `offline_consistent` alone.

## Explicitly not proven

The version 13 record contains these exact ordered `notProven` values:

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
- `populated_database_privacy_migration_backfill_or_online_cutover`
- `globally_complete_or_independently_audited_deletion_proof`
- `real_customer_tenant_or_personal_data`

B13 proves only the exact fixed-policy, manifest-bound, authenticated synthetic
lifecycle above in one pristine disposable PostgreSQL 17.11 database. The
retained token is pseudonymous, not anonymous; PostgreSQL verifies its shape,
uniqueness, lifecycle, and tenant relationships, not its external HMAC
authenticity. The accepted time targets are technical decision values, not
proof that production schedulers, legal holds, DSAR identity, deletion planes,
backup expiry, restore suppression, or KMS/HSM operations exist.

Production admission remains blocked. Item 18 of the package roadmap still
owns populated-database registry backfill and online cutover under concurrent
writes. This result does not establish that cutover, global deletion,
cryptographic erasure, real-customer-data admission, application composition,
deployment, or production readiness.
