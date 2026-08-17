# PostgreSQL authenticated application-migration evidence

Reviewed: 2026-08-17 (America/Chicago)

This note records a successful Cycle 1b-b7 execution of the bounded
authenticated clean application-migration phase after the separately committed
container-superuser platform bootstrap, and the separate offline consistency
review of its downloaded version 7 success record. It indexes synthetic,
container-local acceptance evidence; it is not a production or incremental
migrator design, deployment result, external-authentication result, restore
test, application integration, or attestation of GitHub run or artifact
authenticity.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`41d13dde55148c05342d782c76fc80e9b76f4e95`](https://github.com/liangzixuan/investing-pro/commit/41d13dde55148c05342d782c76fc80e9b76f4e95)
- PostgreSQL workflow: successful [run `32068159652`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32068159652)
- PostgreSQL job: successful [Ubuntu 24.04 job `95504975067`](https://github.com/liangzixuan/investing-pro/actions/runs/32068159652/job/95504975067)
- Cross-platform release gate: successful [CI run `32068159662`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32068159662), with [Windows job `95504975307`](https://github.com/liangzixuan/investing-pro/actions/runs/32068159662/job/95504975307) and [Ubuntu job `95504975421`](https://github.com/liangzixuan/investing-pro/actions/runs/32068159662/job/95504975421) successful

The later documentation commit that links this note is a different commit. It
does not replace, retest, or expand the run anchors above. Any workflow
execution triggered by that documentation commit is a separate repository
health check.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v7-41d13dde55148c05342d782c76fc80e9b76f4e95-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32068159652/artifacts/9300733229)
- Artifact ID: `9300733229`
- GitHub artifact expiry: `2026-09-16T20:54:28Z`
- GitHub API artifact ZIP byte length: `1691`
- GitHub artifact ZIP SHA-256: `b285c956be6e54407438f9390e41598fde1ab112649b8d090e50182b43a37b43`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v7.json`
- Evidence JSON byte length: `3275`
- Producer-log and downloaded-file SHA-256: `3e7906a1c6fbb9149047e20ad2c40ad02411ea19c5a3249c610d65a6468e93cb`
- Recorded completion time: `2026-08-17T20:54:28.011Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `2087`
- Retained offline-verification JSON SHA-256: `7b8724e3aca606825170f1e453fd611e271ccd623c79704709c3c0f5208da226`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the
producer-log value supplied separately for review. Artifact retention remains
finite; any separately retained operator copy has its own custody boundary.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `c39a9e2f24300f05e30f26e41bf72b8bf264513e90a1e1bebdf4efbc4f1b64ec`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Historical migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `0a5ff506e9a4d9124f88d6abcd806509248ea2cc5dc1b415e1e27e2fa7d8126d`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `ee8564a56f23a9b7d7366564b889e21837812ad041848db4f9e464bae7d9b92c`
- V2 platform-bootstrap SHA-256: `21da4c90175b5b22f0e87a21fcd37ce2d6be651ed1c276d30fd01565c9eb41f1`
- V2 application-manifest SHA-256: `633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35`
- Authenticated migration-renderer SHA-256: `6121ad33f312e71f42177610c9a569280694345135eb7273d443ac6e95be525b`

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

- `PostgreSQL acceptance evidence SHA-256: 3e7906a1c6fbb9149047e20ad2c40ad02411ea19c5a3249c610d65a6468e93cb`
- `PostgreSQL 17.11 legacy clean-bootstrap regression, versioned platform bootstrap, authenticated clean application migrations, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, and driverless financial-fact projection acceptance passed; the version 7 success-only run record was written.`

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 7 record's closed completed-check list is the machine-readable source
for the additional B7 result.

## Recorded checks and exact B7 scope

The version 7 record preserves every version 1 through version 6 completed
check and appends exactly
`authenticated_clean_application_migrations_after_platform_bootstrap`.
Historical parser branches, records, checks, limitations, and source shapes
remain frozen for their versions.

The run first completed the inherited b1 through b6 regressions using the
unchanged historical manifest and seven historical bodies. After all ephemeral
sessions and logins were gone, the harness connected through maintenance
database `postgres`, proved zero target sessions, dropped the exact disposable
target without `FORCE`, dropped the four dependency-free capability roles,
recreated the target, and proved its V2 namespace pristine.

The container-superuser platform phase then proved injected rollback, created
the exact capability roles and owner-owned schemas, locked down public schema
and database privileges, installed and hardened `btree_gist`, fingerprinted the
result, and rejected replay without drift. That phase committed separately.

One ephemeral, acceptance-only `research_cockpit_migrator_login` then had the
reviewed non-superuser, non-creator, non-replicating, `NOINHERIT`,
`NOBYPASSRLS`, connection-limited attributes and one exact set-only,
non-inheriting, non-admin membership in `research_cockpit_owner`. It
authenticated by SCRAM over loopback TCP inside the unexposed service
container. The run covered wrong-password rejection; exact pre-role identity
and privilege denial; forbidden role and session-authorization transitions;
and transaction-local selection of only the owner capability.

An injected authenticated application-stage failure rolled back every
application object and ledger row while preserving only the reviewed platform
state. A separate authenticated transaction applied all six V2 application
bodies once, with exact ordering, hashes, ownership, constraints, RLS,
privileges, and login-attributed ledger rows. Replay was rejected without
catalog or ledger drift. The migrator owned no objects; its passfiles, backends,
membership, and login were removed without `DROP OWNED` or `REASSIGN OWNED`;
and zero temporary authentication, file, or object residue was verified before
the final catalog and evidence gates.

All earlier clean-bootstrap, RLS, authenticated-runtime,
authorization-matrix, financial-fact projection, authenticated test-loader,
owner-DDL canary, write-denial, cleanup, and evidence probes remained mandatory
legs of the same successful run. B7 does not retroactively widen the historical
b1 through b6 evidence scopes.

## Offline review boundary

The downloaded version 7 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, all nine recorded source hashes, the exact historical migration
manifest and bodies, and the closed V2 platform/application source tree at that
commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature.

## Explicitly not proven

The version 7 record contains these exact ordered `notProven` values:

- `resolved_platform_image_manifest`
- `external_or_production_authenticated_database_sessions`
- `external_production_or_incremental_authenticated_migrations`
- `globally_atomic_platform_and_application_bootstrap`
- `authenticated_backup_sessions`
- `end_user_identity_or_tenant_binding`
- `production_identity_tls_secrets_or_pooling`
- `concurrent_sessions_cancellation_or_timeouts`
- `dump_restore_or_disaster_recovery`
- `real_or_licensed_market_data`
- `application_driver_pool_or_composition_root`
- `complete_dossier_history_timeline_or_dimensioned_projection`

B7 proves only the authenticated clean application-migration phase after a
separately committed container-superuser platform phase in one disposable,
container-local acceptance environment. It does not prove non-superuser
platform provisioning, a globally atomic platform-plus-application bootstrap,
or independent provenance for trusted-extension contents.

The run does not authorize a production owner or migrator login and does not
prove external or production authentication, TLS, managed secret storage or
rotation, secure passfile erasure, incremental upgrades, concurrent migrations,
cancellation or timeout recovery, cluster-wide or multi-database safety,
authenticated backup, dump/restore or disaster recovery, end-user identity or
tenant binding, real or licensed data, a driver or pool, application/API
integration, deployed persistence, production privacy controls, or production
readiness.
