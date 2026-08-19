# PostgreSQL locked migration-ledger deployment evidence

Reviewed: 2026-08-18 (America/Chicago)

This note records a successful Cycle 1b-b11 execution of one exact,
container-local `v2-0005` to `v2-0006` migration suffix through two
authenticated PostgreSQL deployer clients, plus the separate offline
consistency review of its downloaded version 11 success record. It is not a
general migration framework, external or production credential result,
multi-release upgrade, application-compatibility result, distributed
orchestration proof, or production-readiness evidence.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`5df9d07d0eb1125145b1419c37903a74f9607abb`](https://github.com/liangzixuan/investing-pro/commit/5df9d07d0eb1125145b1419c37903a74f9607abb)
- PostgreSQL workflow: successful [run `32183709701`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32183709701)
- PostgreSQL job: successful [Ubuntu 24.04 job `95862430713`](https://github.com/liangzixuan/investing-pro/actions/runs/32183709701/job/95862430713)
- Cross-platform release gate: successful [CI run `32183709844`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32183709844), with [Windows job `95862431164`](https://github.com/liangzixuan/investing-pro/actions/runs/32183709844/job/95862431164) and [Ubuntu job `95862431306`](https://github.com/liangzixuan/investing-pro/actions/runs/32183709844/job/95862431306) successful

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the run anchors above. Any workflow
execution triggered by that documentation commit is a separate repository
health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v11-5df9d07d0eb1125145b1419c37903a74f9607abb-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32183709701/artifacts/9341750093)
- Artifact ID: `9341750093`
- Artifact created: `2026-08-18T20:44:36Z`
- GitHub artifact expiry: `2026-09-17T20:44:36Z`
- GitHub artifact ZIP byte length: `2397`
- GitHub/local artifact ZIP SHA-256: `61e0f1123e928b582326990f8162423821a3c0ac59c06543dcccfb8ed9bc8672`
- Sole regular non-symlink ZIP entry: `research-cockpit-postgres-acceptance-v11.json`
- Evidence JSON byte length: `4916`
- Producer-log and downloaded-file SHA-256: `6c35bc45aa6cf1b514f1c936fb14dca50974b0d1bbb80a826ee9359c35c460a4`
- Recorded completion time: `2026-08-18T20:44:36.050Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `2824`
- Retained offline-verification JSON SHA-256: `3ffe73226a8777d877dfbba59abec7dd17eb798fbda11bf8d29dbb00d8986c8a`

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
- Workflow SHA-256: `73bc100eb27a1e7884d05f6feb642bc00c224d56e7b480899ba901cd9934f24a`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Historical migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `62736f5a71e070a6893cf75fb72dc2079f905e90600d71de65b71cba7fe38c74`
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

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- [`PostgreSQL acceptance evidence SHA-256: 6c35bc45aa6cf1b514f1c936fb14dca50974b0d1bbb80a826ee9359c35c460a4`](https://github.com/liangzixuan/investing-pro/actions/runs/32183709701/job/95862430713#step:7:12)
- [`PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, locked migration-ledger checksum-drift refusal, one-time suffix replay, injected rollback, concurrent deployment serialization, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, single-client read-only financial-fact projection adapter, and bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery acceptance passed; the version 11 success-only run record was written.`](https://github.com/liangzixuan/investing-pro/actions/runs/32183709701/job/95862430713#step:7:13)

The upload step separately recorded the reviewed ZIP digest, artifact ID, and
final size. The version 11 record's closed completed-check list is the
machine-readable source for the additional B11 result.

## Recorded checks and exact B11 scope

The version 11 record contains these exact ordered `checksPassed` values:

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

Version 11 preserves every version 1 through version 10 check and appends only
the final B11 check. Historical parser branches, records, checks, limitations,
source shapes, and meanings remain frozen for their versions.

After the exact B7 target and inherited checks passed, and before the separate
B10 pool and B8 backup/restore probes, the runner provisioned a fresh ephemeral
SCRAM deployer login with connection limit two, no direct application ACLs,
and exactly one set-only owner edge. A real loopback client authenticated under
that login and remained non-owner while idle.

The acceptance-only helper first reconstructed the exact five-row
`v2-0001` through `v2-0005` prefix. An injected failure after the reviewed
`v2-0006` body and ledger insert rolled both effects back to the exact prefix.
A normal deployment then applied only `v2-0006`; the next deployment returned
`current` and left the complete target fingerprint unchanged.

The runner changed one valid live ledger checksum to a different valid SHA-256,
observed the stable value-free drift failure with the complete drifted target
unchanged, and repaired the exact mutation. It then opened a second authenticated
client and proved a third connection was rejected by the two-connection limit.

For the concurrent proof, the runner reconstructed the exact prefix again and
used an administrator-held ledger barrier to make the first deployer hold the
reviewed advisory lock while waiting for its `SHARE ROW EXCLUSIVE` ledger lock.
The second deployer was observed waiting for that exact advisory lock in the
same blocking chain. After barrier release, the two results were exactly one
`applied` for `v2-0006` and one `current`; the target was complete and both
clients returned to the authenticated non-owner idle state.

Mandatory cleanup settled pending work, closed every client, repaired only a
recognized acceptance state if necessary, drained deployer backends, dropped
the ephemeral login and membership/SCRAM verifier, and proved zero deployer or
barrier application residue. The final ledger, catalog, platform, and request
context matched the reviewed current target before the V11 record was written.
No passfile or on-disk password artifact was created; secure erasure of the
in-memory JavaScript password string is not claimed.

## Offline review boundary

The downloaded version 11 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, all seventeen recorded source hashes, the exact historical
migration manifest and bodies, the closed V2, B8, B9, B10, and B11 source trees,
and exact `nodePostgres: "8.23.0"` and `nodePostgresPool: "3.14.0"` values at
that commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature. The live migration behavior above also depends on the separately
reviewed workflow and log markers, not on `offline_consistent` alone.

## Explicitly not proven

The version 11 record contains these exact ordered `notProven` values:

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
- `prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend`
- `full_schema_global_object_cross_cluster_or_cross_version_restore`
- `disaster_recovery_storage_encryption_retention_rpo_or_rto`
- `real_or_licensed_market_data`
- `application_composition_root`
- `complete_dossier_history_timeline_or_dimensioned_projection`

B11 proves only the exact closed-v2 prefix/suffix behavior above through two
loopback clients in one disposable PostgreSQL 17.11 service. It does not prove
external or production migrator credentials, TLS, managed secret storage or
rotation, arbitrary manifests, multi-release upgrades, down-migrations, online
application/schema compatibility, concurrent application writes, crash
recovery, cancellation, retry/failover, distributed or cross-cluster
coordination, global platform/application atomicity, application composition,
real data, deployment readiness, or production readiness.

B12 later passed its separate exact fact-as-known and tenant named-index plan
plus 2,000-submission result through at most eight runtime workload backends.
That successor does not change this version 11 record or widen the B11 claim.
See the [B12 evidence note](./POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./CYCLE_1BB12_EXIT_MATRIX.md).
