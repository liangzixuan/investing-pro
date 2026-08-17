# PostgreSQL authenticated backup and bounded clean-restore evidence

Reviewed: 2026-08-17 (America/Chicago)

This note records a successful Cycle 1b-b8 execution of the authenticated,
policy-scoped application-data dump and bounded clean restore, plus the separate
offline consistency review of its downloaded version 8 success record. It
indexes synthetic, container-local, same-cluster acceptance evidence; it is not
a full-database or production backup, a disaster-recovery result, an external
authentication result, application integration, or attestation of GitHub run or
artifact authenticity.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`49d3a961db5ea37b284ef47e0526ba6dfd1518fe`](https://github.com/liangzixuan/investing-pro/commit/49d3a961db5ea37b284ef47e0526ba6dfd1518fe)
- PostgreSQL workflow: successful [run `32076642878`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32076642878)
- PostgreSQL job: successful [Ubuntu 24.04 job `95531170187`](https://github.com/liangzixuan/investing-pro/actions/runs/32076642878/job/95531170187)
- Cross-platform release gate: successful [CI run `32076642913`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32076642913), with [Ubuntu job `95531189307`](https://github.com/liangzixuan/investing-pro/actions/runs/32076642913/job/95531189307) and [Windows job `95531189364`](https://github.com/liangzixuan/investing-pro/actions/runs/32076642913/job/95531189364) successful

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the run anchors above. Any workflow
execution triggered by that documentation commit is a separate repository
health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v8-49d3a961db5ea37b284ef47e0526ba6dfd1518fe-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32076642878/artifacts/9303719178)
- Artifact ID: `9303719178`
- GitHub artifact expiry: `2026-09-16T22:37:25Z`
- GitHub API artifact ZIP byte length: `1891`
- GitHub artifact ZIP SHA-256: `68664561e7321551f023c8de8f2fe2d549ca5d31e18e8a50fcd2620bc4ce9e6a`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v8.json`
- Evidence JSON byte length: `3705`
- Producer-log and downloaded-file SHA-256: `1ceca2fe0d91a500ad744d668dfe44521aa99755ed8a2f9b9bdae84d422cbf7c`
- Recorded completion time: `2026-08-17T22:37:25.053Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `2304`
- Retained offline-verification JSON SHA-256: `963978514d7f600892362e3981ce3f0651438a96e61bd5f5c8071f8ccc5f4f87`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the
producer-log value supplied separately for review. Artifact retention remains
finite; any separately retained operator copy has its own custody boundary.
The temporary data archive itself was deliberately not uploaded as evidence.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `63db230689987f7a927b56e2b2768206a45def3ed0c66e6c61e96279d22adff0`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Historical migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `9409efe95f2b2eb738a5f97d233f0ff1fefa164b7f8bc38ac771c611466c8fa2`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `ee8564a56f23a9b7d7366564b889e21837812ad041848db4f9e464bae7d9b92c`
- V2 platform-bootstrap SHA-256: `21da4c90175b5b22f0e87a21fcd37ce2d6be651ed1c276d30fd01565c9eb41f1`
- V2 application-manifest SHA-256: `633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35`
- Authenticated migration-renderer SHA-256: `e4fae81dd4924f619c62f449c26f534233005e03948804f075bd328dd08993cb`
- Restore-platform V1 SHA-256: `78b566cc1321956f4660619b628ce586fabfa4f22a85c0dfb1c5df7e1456e5ae`
- Authenticated backup/restore-plan V1 SHA-256: `cf9907c04f8a94256a2e342cbd2dbc87eb587f49f32fd4683d5856835ceda7f7`

The V2 application manifest in turn fixed these exact ordered migration body
hashes:

- `v2-0001`: `37d69e26b370e6a0c9f191e6f46a8d59579612f67c16f918e2ed78a5eb399e2f`
- `v2-0002`: `272dce4b0d91e96f58442896621b2d570e8e027fbfc843f83de5f36c005154f6`
- `v2-0003`: `d7a1a3d1991cb0a531a1643111fb8192dfad546efa4aa4913d0d8f8f34fed4d2`
- `v2-0004`: `ecaf289311eea9a58d8c4e4f342e9f7e40f86f0b05fdebc9d50975aa672930eb`
- `v2-0005`: `703205835c4689350ec0d49d4377adaa08dc2abdcc63bf669dda8dee7049d61d`
- `v2-0006`: `b3da4be6401accbd0140f0fe9a85d04d4093a06448eab129aa1c9c78be363f91`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: 1ceca2fe0d91a500ad744d668dfe44521aa99755ed8a2f9b9bdae84d422cbf7c`
- `PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, authenticated policy-scoped application-data dump and bounded clean restore, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, and driverless financial-fact projection acceptance passed; the version 8 success-only run record was written.`

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 8 record's closed completed-check list is the machine-readable source
for the additional B8 result.

## Recorded checks and exact B8 scope

The version 8 record preserves every version 1 through version 7 completed
check and appends exactly
`authenticated_policy_scoped_application_data_dump_and_bounded_clean_restore`.
Historical parser branches, records, checks, limitations, and source shapes
remain frozen for their versions.

After every inherited B1 through B7 regression passed, one ephemeral,
acceptance-only `research_cockpit_backup_login` authenticated by SCRAM over
loopback TCP inside the unexposed service container. It had the reviewed locked
service-login attributes and one exact set-only, non-inheriting, non-admin
membership in `research_cockpit_backup`. Wrong-password, pre-role, cross-role,
session-authorization, write, routine, persistent-DDL, and temporary-object
attempts failed before the dump.

The pinned `pg_dump` then created a custom, data-only, row-security-enabled,
column-insert archive through the backup capability. Its reviewed table of
contents contained exactly the 21 synthetic application `TABLE DATA` entries
and no migration-ledger, schema, sequence, large-object, or global payload. The
archive and passfile met the fixed-path, regular non-symlink, mode-`0600`
contract; the archive's digest remained unchanged through both restore
attempts. The backup backend, passfile, membership, login, and owned-object
state were removed and proved absent before restore began.

The harness created a different disposable database from `template0` in the
same cluster without using the source database as a restore target. The
reviewed restore-platform asset passed injected rollback, successful
application, fingerprint, and replay checks. The exact V2 application plan then
ran through the inherited authenticated-migrator boundary, independently
establishing the schema, ledger, ownership, grants, RLS, constraints, routines,
triggers, defaults, extension hardening, and database envelope before archived
rows were loaded.

A distinct ephemeral restore login authenticated by SCRAM, proved the reviewed
pre-role and escalation denials, and selected only
`research_cockpit_test_seed`. The pinned `pg_restore` data-only,
row-security-enabled, single-transaction path first hit the injected failure;
all attempted archived rows rolled back without catalog or ledger drift. A
separate attempt restored the archive once, and replay into the populated
target failed without accepted drift.

Closed order-independent fingerprints matched for every one of the 21 source
and restored tables without writing row values, identities, counts, or
fingerprints to the record or logs. The independently built target also passed
catalog and bounded authorization equivalence, while the source data, catalog,
ledger, roles, role graph, ACLs, and backend state remained unchanged. Finally,
the restore and migrator backends, logins, memberships, passfiles, archive
paths, login-owned objects, and disposable restore database were removed, and
zero B8 residue was proved before the success record was written.

## Offline review boundary

The downloaded version 8 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, all eleven recorded source hashes, the exact historical
migration manifest and bodies, and the closed V2 and B8 source trees at that
commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature. The verifier did not inspect the temporary data archive.

## Explicitly not proven

The version 8 record contains these exact ordered `notProven` values:

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
- `application_driver_pool_or_composition_root`
- `complete_dossier_history_timeline_or_dimensioned_projection`

B8 proves only one authenticated, policy-scoped, synthetic application-data
dump and bounded clean restore into an independently provisioned database in
the same disposable PostgreSQL 17 cluster. It does not back up or recover the
schema, ledger, roles, extension, ownership, grants, policies, default
privileges, database envelope, large objects, or cluster-global state.

The run does not authorize production backup or restore identities and does not
prove external transport or TLS, managed secret storage or rotation, secure
passfile or archive erasure, archive encryption/signing/authenticity/custody,
retention, off-site storage, scheduled/incremental/continuous backup,
full-schema/global/cross-cluster/cross-version restore, untrusted-archive
handling, physical backup, WAL archiving, point-in-time recovery, failover,
high availability, disaster recovery, any RPO/RTO, concurrent writes,
large-data performance, cancellation or timeout recovery, real or licensed
data, a driver or pool, application/API integration, deployed persistence,
production privacy controls, or production readiness.
