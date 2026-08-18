# PostgreSQL single-client projection-adapter evidence

Reviewed: 2026-08-17 (America/Chicago)

This note records a successful Cycle 1b-b9 execution of one non-owning,
exclusively leased, single-client read-only PostgreSQL projection adapter, plus
the separate offline consistency review of its downloaded version 9 success
record. It indexes synthetic acceptance evidence from one runner-hosted
`pg@8.23.0` client and an ephemeral PostgreSQL service. It is not a pool,
application composition, end-user identity, external/TLS transport, production
secret, complete dossier, real data, deployment, or production-readiness result.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`8e470e909bd556cc21aa27b822196324e537311b`](https://github.com/liangzixuan/investing-pro/commit/8e470e909bd556cc21aa27b822196324e537311b)
- PostgreSQL workflow: successful [run `32083732063`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32083732063)
- PostgreSQL job: successful [Ubuntu 24.04 job `95551752915`](https://github.com/liangzixuan/investing-pro/actions/runs/32083732063/job/95551752915)
- Cross-platform release gate: successful [CI run `32083732040`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32083732040), with [Ubuntu job `95551752947`](https://github.com/liangzixuan/investing-pro/actions/runs/32083732040/job/95551752947) and [Windows job `95551752995`](https://github.com/liangzixuan/investing-pro/actions/runs/32083732040/job/95551752995) successful

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the run anchors above. Any workflow
execution triggered by that documentation commit is a separate repository
health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v9-8e470e909bd556cc21aa27b822196324e537311b-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32083732063/artifacts/9306006123)
- Artifact ID: `9306006123`
- GitHub artifact expiry: `2026-09-17T00:16:50Z`
- GitHub API artifact ZIP byte length: `2118`
- GitHub artifact ZIP SHA-256: `1c5675770350fca6f3414ea096ef9f711003db00eafc04814d3135b328835ce9`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v9.json`
- Evidence JSON byte length: `4222`
- Producer-log and downloaded-file SHA-256: `2555fcbc231ba83a529bfab1a971cc016931eb4e56bc6550dffb118cd9fb8f30`
- Recorded completion time: `2026-08-18T00:16:49.935Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `2376`
- Retained offline-verification JSON SHA-256: `f5c355854894b54b3e605699d3e44283d64b224537c1fac0e7456a764ef28e69`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the reviewed
producer-log value. Artifact retention remains finite; any separately retained
operator copy has its own custody boundary.

## Reviewed target, tools, and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- PostgreSQL tool version: `postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `psql` tool version: `psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `pg_dump` tool version: `pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- `pg_restore` tool version: `pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg12+2)`
- node-postgres version: `8.23.0`
- Workflow SHA-256: `349c5e2beef444698068969bc264004240824b4bbb1e641e3e60e30165d380d7`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Historical migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `fc2f31f603ee713a27ef5d1b18f27887df97e31d1a2a1381ed98bf4011bc4bfc`
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

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- [`PostgreSQL acceptance evidence SHA-256: 2555fcbc231ba83a529bfab1a971cc016931eb4e56bc6550dffb118cd9fb8f30`](https://github.com/liangzixuan/investing-pro/actions/runs/32083732063/job/95551752915#step:7:12)
- [`PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, driverless financial-fact projection, and single-client read-only financial-fact projection adapter acceptance passed; the version 9 success-only run record was written.`](https://github.com/liangzixuan/investing-pro/actions/runs/32083732063/job/95551752915#step:7:13)

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 9 record's closed completed-check list is the machine-readable source
for the additional B9 result.

## Recorded checks and exact B9 scope

The version 9 record contains these exact ordered `checksPassed` values:

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

Version 9 preserves every version 1 through version 8 check and appends only
the final B9 check. Historical parser branches, records, checks, limitations,
and source shapes remain frozen for their versions.

After every inherited B1 through B8 regression passed, the runner rejected a
wrong password and connected one actual `pg.Client` through the exact temporary
loopback mapping as the ephemeral `research_cockpit_runtime_login`. The client
used the fixed `research_cockpit_acceptance_test` database,
`research-cockpit-b9-acceptance` application name, no TLS, one stable backend,
and the exact SCRAM `system_user`. The adapter owns neither that connection nor
its lifecycle.

The harness deliberately opened a read-write transaction before the adapter
lease. The adapter's initial reset rolled that transaction and its canary back,
then each load used `BEGIN READ ONLY`, transaction-local runtime-role selection,
one six-value parameterized request-context call, and the unnamed,
parameterized B4 projection query in array-row mode. Driver rows crossed the
strict one-text-column JSON bridge and the existing whole-batch normalizer
before commit.

The same real backend passed the reviewed display/API, derive/API,
alert/local-alert, missing-listing, pre-cutoff, inactive-principal,
no-current-membership, alpha/beta/alpha reuse, and cross-tenant-mismatch cases.
An empty authorized result remained non-null and conservatively marked
`unknown/rls_filtered`. The live transaction was observed as read-only and a
mutation attempt was denied with SQLSTATE `25006`.

An injected SELECT failure produced only the stable value-free adapter error,
rolled the transaction back, and left the same client reusable. Successful and
failure paths cleared the transaction-local role and request context. The
caller then closed the client, the harness observed its backend drain, and the
existing runtime-login cleanup proved zero residue before version 9 evidence
was written.

## Offline review boundary

The downloaded version 9 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, all fifteen recorded source hashes, the exact historical
migration manifest and bodies, the closed V2, B8, and B9 source trees, and exact
`nodePostgres: "8.23.0"` at that commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature.

## Explicitly not proven

The version 9 record contains these exact ordered `notProven` values:

- `resolved_platform_image_manifest`
- `external_or_production_authenticated_database_sessions`
- `external_production_or_incremental_authenticated_migrations`
- `globally_atomic_platform_and_application_bootstrap`
- `external_production_incremental_or_continuous_authenticated_backups`
- `end_user_identity_or_tenant_binding`
- `production_identity_tls_secrets_or_pooling`
- `concurrent_sessions_cancellation_or_timeouts`
- `full_schema_global_object_cross_cluster_or_cross_version_restore`
- `disaster_recovery_storage_encryption_retention_rpo_or_rto`
- `real_or_licensed_market_data`
- `application_pool_or_composition_root`
- `complete_dossier_history_timeline_or_dimensioned_projection`

B9 proves only one sequential, synthetic, exclusively leased client through the
reviewed non-owning adapter. Its trusted actor provider is not an identity
resolver, and the temporary runner-loopback mapping is not an application or
production network path. The result does not prove a pool, pool checkout or
reset, simultaneous backends, queueing, cancellation, timeouts, retry,
reconnection, failover, load capacity, application/API composition, production
identity, TLS, managed secrets, write persistence, complete or dimensioned
projections, real or licensed data, deployment, or production readiness. The
separate bounded pool/concurrency/cancellation proof is Cycle 1b-b10.
