# PostgreSQL bounded projection-pool evidence

Reviewed: 2026-08-18 (America/Chicago)

This note records a successful Cycle 1b-b10 execution of one owning, bounded,
two-client PostgreSQL projection pool, plus the separate offline consistency
review of its downloaded version 10 success record. It indexes synthetic
acceptance evidence from `pg@8.23.0`, `pg-pool@3.14.0`, and an ephemeral
PostgreSQL service. It is not application composition, end-user identity,
external/TLS transport, a production pool, load/capacity, real data,
deployment, or production-readiness evidence.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`2dcb259b0e10ed458b17068453921db638e61234`](https://github.com/liangzixuan/investing-pro/commit/2dcb259b0e10ed458b17068453921db638e61234)
- PostgreSQL workflow: successful [run `32161137775`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32161137775)
- PostgreSQL job: successful [Ubuntu 24.04 job `95790054695`](https://github.com/liangzixuan/investing-pro/actions/runs/32161137775/job/95790054695)
- Cross-platform release gate: successful [CI run `32161137974`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32161137974), with [Ubuntu job `95790055774`](https://github.com/liangzixuan/investing-pro/actions/runs/32161137974/job/95790055774) and [Windows job `95790055916`](https://github.com/liangzixuan/investing-pro/actions/runs/32161137974/job/95790055916) successful

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the run anchors above. Any workflow
execution triggered by that documentation commit is a separate repository
health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v10-2dcb259b0e10ed458b17068453921db638e61234-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32161137775/artifacts/9333723995)
- Artifact ID: `9333723995`
- Artifact created: `2026-08-18T16:38:18Z`
- GitHub artifact expiry: `2026-09-17T16:38:18Z`
- GitHub artifact ZIP byte length: `2253`
- GitHub/local artifact ZIP SHA-256: `05e7142fb8f08b4a4084f6b63b471ed90404b7e678ee8135f2f5f8431d3f6e3d`
- Sole regular non-symlink ZIP entry: `research-cockpit-postgres-acceptance-v10.json`
- Evidence JSON byte length: `4538`
- Producer-log and downloaded-file SHA-256: `e9f4147352ae6450691242c3bcd7c56535b0dc7353fd88f823d1b9685bdbd22f`
- Recorded completion time: `2026-08-18T16:38:18.034Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `2553`
- Retained offline-verification JSON SHA-256: `326716315d493e76d07cbcd63315be9aed0f75ca305220ced7e228e9b02c5e05`

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
- Workflow SHA-256: `7d993fea4c18469ebc07e900c798e06af881f7c1e01f621b3145d9c1fd13af0b`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Historical migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `1f04e46a73deb32c1bfc74df1c91ae8d33fc9046c794c852fae82e0325d6ac5b`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `6e31fc64a360bbde19c888a0a9d9bba73586526700aaff3da7fbf80d537f7afe`
- V2 platform-bootstrap SHA-256: `21da4c90175b5b22f0e87a21fcd37ce2d6be651ed1c276d30fd01565c9eb41f1`
- V2 application-manifest SHA-256: `633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35`
- Authenticated migration-renderer SHA-256: `e4fae81dd4924f619c62f449c26f534233005e03948804f075bd328dd08993cb`
- Restore-platform V1 SHA-256: `78b566cc1321956f4660619b628ce586fabfa4f22a85c0dfb1c5df7e1456e5ae`
- Authenticated backup/restore-plan V1 SHA-256: `cf9907c04f8a94256a2e342cbd2dbc87eb587f49f32fd4683d5856835ceda7f7`
- PostgreSQL projection-adapter SHA-256: `230cc911ea8c87e4c4713e5f9b018bd904fbf5bc665b921c2b48e162e7039dda`
- Core operation-projection contract SHA-256: `9ac7c0fca7ed1d37cea1f03dccd743d2a4120108eca096ec39dd49265ef7cb08`
- Database package-manifest SHA-256: `440de7d976e32e4e4bcbff97cbeb40586d69d29e47f3958f0c00fc25249497ea`
- Workspace lockfile SHA-256: `7177d4376117e4c93a985cd0c895cc90acae18041ecd0c1ae28fffda06843dc4`
- PostgreSQL projection-pool SHA-256: `257e2ab0a0a245c6385f8eddf6d44973dbddbb9cd6fc6a4b089cb0867aefa5e8`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- [`PostgreSQL acceptance evidence SHA-256: e9f4147352ae6450691242c3bcd7c56535b0dc7353fd88f823d1b9685bdbd22f`](https://github.com/liangzixuan/investing-pro/actions/runs/32161137775/job/95790054695#step:7:12)
- [`PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, single-client read-only financial-fact projection adapter, and bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery acceptance passed; the version 10 success-only run record was written.`](https://github.com/liangzixuan/investing-pro/actions/runs/32161137775/job/95790054695#step:7:13)

The upload step separately recorded the reviewed ZIP digest, artifact ID, and
final size. The terminal sentence deliberately remains an aggregate acceptance
marker. The version 10 record's closed completed-check list is the
machine-readable source for the additional B10 result.

## Recorded checks and exact B10 scope

The version 10 record contains these exact ordered `checksPassed` values:

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

Version 10 preserves every version 1 through version 9 check and appends only
the final B10 check. Historical parser branches, records, checks, limitations,
and source shapes remain frozen for their versions.

After the versioned B7 database and inherited regressions, including B9, passed,
and before B8 backup/restore, the runner provisioned one fresh ephemeral SCRAM
runtime login with connection limit two, verified its exact catalog state, and
then rejected a wrong password through the pool source. The accepted source
owned one actual `pg.Pool` fixed at `max: 2`, finite acquisition and positive
PostgreSQL statement timeouts, the canonical `research-cockpit-b10-pool`
application name, loopback-only connectivity, and no TLS. The caller did not
query, checkout, release, end, or inspect the pool while the source owned it.

Before transferring ownership, the runner acquired two distinct backend PIDs
and dirtied one checkout with a custom GUC, prepared statement, advisory lock,
read-write transaction, runtime role, and request context. The first
source-owned load reused that PID after its fixed reset sequence. An out-of-band
administrator then observed the same backend idle under the exact runtime login
and application name, outside a transaction, with no advisory lock and no TLS.
A subsequent beta-actor load returned only the beta tenant's reviewed result.
Custom-GUC and prepared-statement removal remain source/unit/static evidence for
the exact `DISCARD ALL` sequence; the transferred pool was not directly
inspected during ownership.

With an administrative table lock holding the B4 query, simultaneous alpha and
beta source loads occupied two distinct active backends. A third source load
reached the fixed acquisition timeout while those exact PIDs remained blocked.
After lock release, the first two loads returned only their respective
tenant-visible results.

For active cancellation, the runner aborted a blocked source load, observed the
stable value-free abort, proved the PostgreSQL operation had settled before the
source returned, and proved the discarded backend PID drained. A separate
blocked load reached PostgreSQL `statement_timeout`, returned the stable timeout
failure, and drained that discarded PID. A replacement source load succeeded on
a backend distinct from both discarded PIDs.

The runner called the owning close path twice, rejected a post-close load, and
read total, idle, and waiting counters only after close completed; all were
zero. The out-of-band observer then proved zero pool or blocker application-name
backends. Mandatory cleanup removed the ephemeral login, membership, and
passfiles before the version 10 record was written.

## Offline review boundary

The downloaded version 10 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, all sixteen recorded source hashes, the exact historical
migration manifest and bodies, the closed V2, B8, B9, and B10 source trees, and
exact `nodePostgres: "8.23.0"` and `nodePostgresPool: "3.14.0"` values at that
commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature. The live pool behavior above also depends on the separate reviewed
workflow and log markers, not on `offline_consistent` alone.

## Explicitly not proven

The version 10 record contains these exact ordered `notProven` values:

- `resolved_platform_image_manifest`
- `external_or_production_authenticated_database_sessions`
- `external_production_or_incremental_authenticated_migrations`
- `globally_atomic_platform_and_application_bootstrap`
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

B10 proves only two simultaneous synthetic reads through one runner-local,
source-owned pool, bounded acquisition, settlement-before-discard active abort,
server-timeout recovery, destructive failure discard, idempotent close, and
zero observed residue. It does not prove graceful PostgreSQL CancelRequest,
prompt queued cancellation, reuse of a canceled backend, production pool tuning
or external poolers, load capacity or SLOs, retry/failover, end-user identity or
tenant resolution, application/API composition, external/TLS transport,
managed secrets, complete or dimensioned projections, real data, deployment,
or production readiness.

Cycle 1b-b11 now has an implemented source contract for migration-ledger
locking, checksum-mismatch refusal against live drift, exact one-time suffix
replay, injected-failure rollback, and concurrent deployment. Its integrated
local verification is complete; live V11 review remains pending. Neither B10
nor B11 proves external
or production incremental migrator credentials, arbitrary or multi-release
upgrades, production migration orchestration/recovery/cancellation/failover,
or global platform/application atomicity. See
[ADR 0023](./adr/0023-locked-postgresql-migration-ledger-deployment.md) and the
[Cycle 1b-b11 exit matrix](./CYCLE_1BB11_EXIT_MATRIX.md).
