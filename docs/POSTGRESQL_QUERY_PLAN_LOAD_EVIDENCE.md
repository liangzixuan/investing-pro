# PostgreSQL RLS query-plan and bounded load evidence

Reviewed: 2026-08-19 (America/Chicago)

This note records a successful Cycle 1b-b12 execution of two exact
authenticated PostgreSQL query-plan shapes and exactly 2,000 submitted
synthetic reads through at most eight runtime workload backends, plus the
separate offline consistency review of its downloaded version 12 success
record. It is not a production benchmark, a planner guarantee beyond the exact
reviewed target, a 1,000- or 2,000-connection result, an application-composition
result, or production-readiness evidence.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`59c4e5828da24d45ba80ad6162a361ebac37e953`](https://github.com/liangzixuan/investing-pro/commit/59c4e5828da24d45ba80ad6162a361ebac37e953)
- PostgreSQL workflow: successful [run `32230667908`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32230667908)
- PostgreSQL job: successful [Ubuntu 24.04 job `95999564558`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667908/job/95999564558)
- Cross-platform release gate: successful [CI run `32230667866`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32230667866), with [Windows job `95999564520`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667866/job/95999564520) and [Ubuntu job `95999564646`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667866/job/95999564646) successful

The PostgreSQL run was created at `2026-08-19T08:02:30Z`; its job ran from
`2026-08-19T08:02:33Z` through `2026-08-19T08:05:29Z`, and the run was updated
at `2026-08-19T08:05:30Z`. The later documentation commit that links this note
is a different commit. It does not replace, retest, or expand the anchors above.
Any workflow execution triggered by that documentation commit is a separate
repository health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v12-59c4e5828da24d45ba80ad6162a361ebac37e953-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667908/artifacts/9357178782)
- Artifact ID: `9357178782`
- Artifact created: `2026-08-19T08:05:25Z`
- GitHub artifact expiry: `2026-09-18T08:05:24Z`
- GitHub/local artifact ZIP byte length: `2546`
- GitHub/local artifact ZIP SHA-256: `e273323eac80260ced47850edf7861f8783cce657d917da47508c7e24a39261d`
- Sole regular non-symlink ZIP entry: `research-cockpit-postgres-acceptance-v12.json`
- Evidence JSON byte length: `5255`
- Producer-log and downloaded-file SHA-256: `2946708d1bbd9a7480f13ec6f7d6d691f0386bdd9d3e85bc3ad90cf4beec453f`
- Recorded completion time: `2026-08-19T08:05:23.942Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `2958`
- Retained offline-verification JSON SHA-256: `d6f5d620ab4b0c0c7c7ee5a55eb5bdb5deb1149f51a35e418a958fa1fa90c589`
- Reviewed authenticated log ZIP byte length: `67029`
- Reviewed authenticated log ZIP SHA-256: `63e952207958e5b07e12354ed9f622b719257f3ca7e0c10581ceb57502d6a07d`

The ZIP contained exactly one regular, non-symlink JSON entry. Its SHA-256
matched the reported artifact digest, and the downloaded JSON SHA-256 matched
the reviewed producer-log value. Artifact retention remains finite; any
separately retained operator copy has its own custody boundary.

## Reviewed target, tools, and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- PostgreSQL tool version: `postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `psql` tool version: `psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `pg_dump` tool version: `pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `pg_restore` tool version: `pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- node-postgres version: `8.23.0`
- pg-pool version: `3.14.0`
- Workflow SHA-256: `43f4be1ce223e30db25ec052859599deb3c16733829db6f59c2aa5c1d5a70543`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Historical migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `d1fe08924389b17e671adbad42a962c2b9b9dfcc218334aee9b75fdb327529b1`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `6e31fc64a360bbde19c888a0a9d9bba73586526700aaff3da7fbf80d537f7afe`
- V2 platform-bootstrap SHA-256: `21da4c90175b5b22f0e87a21fcd37ce2d6be651ed1c276d30fd01565c9eb41f1`
- V2 application-manifest SHA-256: `633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35`
- Authenticated migration-renderer SHA-256: `195510475d2eb6dcfe9dca4f781f335c00a1b4e40de672ef07091a17c717eb7e`
- Restore-platform V1 SHA-256: `78b566cc1321956f4660619b628ce586fabfa4f22a85c0dfb1c5df7e1456e5ae`
- Authenticated backup/restore-plan V1 SHA-256: `cf9907c04f8a94256a2e342cbd2dbc87eb587f49f32fd4683d5856835ceda7f7`
- PostgreSQL projection-adapter SHA-256: `230cc911ea8c87e4c4713e5f9b018bd904fbf5bc665b921c2b48e162e7039dda`
- Core operation-projection contract SHA-256: `9ac7c0fca7ed1d37cea1f03dccd743d2a4120108eca096ec39dd49265ef7cb08`
- Database package-manifest SHA-256: `440de7d976e32e4e4bcbff97cbeb40586d69d29e47f3958f0c00fc25249497ea`
- Workspace lockfile SHA-256: `7177d4376117e4c93a985cd0c895cc90acae18041ecd0c1ae28fffda06843dc4`
- PostgreSQL projection-pool SHA-256: `257e2ab0a0a245c6385f8eddf6d44973dbddbb9cd6fc6a4b089cb0867aefa5e8`
- PostgreSQL migration-deployer SHA-256: `50e5829deaa5465935c2fc4669f9bd27622f6e8f59048ace6e028de4a0613374`
- PostgreSQL query-plan/load SHA-256: `34c86b8f40bd5486eb7d16ea282665ee7703e4a93605d00fd37b0ff931cd7429`
- Query-plan/load fixture SHA-256: `e344c31adeb4cef3d7de2fad65bd4837a0c51c57f3b359a634eb42da9d0642ad`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- [`B12 PostgreSQL plan metrics: fact.runtime_rls planning_ms=13.524 execution_ms=45.078 shared_hit_blocks=1576 shared_read_blocks=0; tenant.runtime_rls planning_ms=0.179 execution_ms=0.369 shared_hit_blocks=15 shared_read_blocks=0; fact.superuser_bypass planning_ms=5.261 execution_ms=0.542 shared_hit_blocks=77 shared_read_blocks=0; tenant.superuser_bypass planning_ms=0.174 execution_ms=0.063 shared_hit_blocks=9 shared_read_blocks=0`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667908/job/95999564558#step:7:12)
- [`PostgreSQL acceptance evidence SHA-256: 2946708d1bbd9a7480f13ec6f7d6d691f0386bdd9d3e85bc3ad90cf4beec453f`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667908/job/95999564558#step:7:13)
- [`PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, locked migration-ledger checksum-drift refusal, one-time suffix replay, injected rollback, concurrent deployment serialization, bounded PostgreSQL RLS query-plan and 2,000-read load, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, single-client read-only financial-fact projection adapter, and bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery acceptance passed; the version 12 success-only run record was written.`](https://github.com/liangzixuan/investing-pro/actions/runs/32230667908/job/95999564558#step:7:14)

The upload step separately recorded one input file, `2546` uploaded bytes, the
exact ZIP digest, artifact name and ID, and final byte length. Neither the
acceptance step nor the upload step contained an error marker.

The four planning/execution durations and shared-buffer counts are observations
from this one synthetic run. No threshold, comparison ratio, throughput claim,
or production service-level objective is inferred from them.

## Recorded checks and exact B12 scope

The version 12 record contains these exact ordered `checksPassed` values:

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

Version 12 preserves every version 1 through version 11 check and appends only
the final B12 check. Historical parser branches, records, checks, limitations,
source shapes, and meanings remain frozen for their versions.

After the exact B11 target and inherited checks passed, and before the separate
B10 pool and B8 backup/restore probes, the runner created the isolated
`research_cockpit_b12_query_load_test` clone only after proving that the source
database had zero sessions. A separate authenticated seed login loaded the
closed fixture into the clone and `ANALYZE` completed before the seed login was
removed.

The fixture contained 2,048 securities, 2,048 share classes, 2,048 listings,
16,384 financial facts, 4,096 tenant resource-registry rows, and 4,096 thesis
rows. The exact B4 fact-as-known and tenant-thesis plans ran both through the authenticated
`NOBYPASSRLS` runtime path and a separate privileged synthetic reference. The
runtime plans executed the reviewed `financial_facts_as_known` and
`theses_by_instrument` indexes with no sequential scan on either large fixture
relation. The runner neither disabled sequential scans nor added a replacement
index.

The fresh runtime login had `CONNECTION LIMIT 8`, and the runner-owned pool had
`max: 8`. Exactly 1,000 fact and 1,000 tenant promises were submitted before
barrier release. A separate administrator observed exactly eight blocked
workload backends—four fact and four tenant—while performing none of the 2,000
reads. All submissions then settled with the exact Alpha/Beta result and
tenant-isolation contract.

Mandatory cleanup settled pending work, closed the pool and clients, drained
the B12 backends, dropped the clone without `FORCE`, removed the ephemeral
runtime and seed logins plus their memberships and SCRAM verifiers, and proved
zero clone, role, backend, application-name, or barrier residue. The source
fingerprint, catalog, migration ledger, and request context matched the
reviewed target before the V12 record was written.

## Offline review boundary

The downloaded version 12 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. Its exact
ordered `verificationChecks` values were:

- `canonical_record_bytes`
- `external_record_sha256`
- `metadata_anchor_match`
- `reviewed_target_at_commit`
- `recorded_source_hashes_at_commit`
- `migration_manifest_at_commit`

The verifier established canonical record bytes, anchor equality, the reviewed
target at the tested commit, all nineteen recorded source hashes, the exact
historical migration manifest and bodies, the closed V2, B8, B9, B10, B11, and
B12 source trees, and exact `nodePostgres: "8.23.0"` and
`nodePostgresPool: "3.14.0"` values at that commit.

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
signature. The live plan/load behavior above also depends on the separately
reviewed workflow and log markers, not on `offline_consistent` alone.

## Explicitly not proven

The version 12 record contains these exact ordered `notProven` values:

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

B12 proves only the exact two-plan, fixed-fixture, bounded eight-workload-backend
path above in one disposable PostgreSQL 17.11 service. It does not prove 1,000
or 2,000 simultaneous database backends or connections, production load
capacity, throughput or latency SLOs, pool sizing/tuning/failover, resource
saturation, or plan stability across other data distributions, statistics,
hardware, versions, extensions, settings, or schemas.

The result also excludes end-user identity binding, external/TLS transport,
managed secrets, real or licensed data, complete dossiers, application/API
composition, writes, deployment, and production readiness. The next existing
package-roadmap prerequisite now has a separate B13 technical source contract;
see
[ADR 0025](./adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [B13 exit matrix](./CYCLE_1BB13_EXIT_MATRIX.md). That later source does
not widen this evidence note or its retained V12 record. No live V13 result is
yet claimed, and production privacy/legal admission remains blocked.
