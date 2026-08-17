# PostgreSQL authenticated owner-DDL canary evidence

Reviewed: 2026-08-17 (America/Chicago)

This note records the first successful Cycle 1b-b6 execution of the bounded
authenticated owner-DDL canary and the separate offline consistency review of
the downloaded version 6 success record. It indexes synthetic acceptance
evidence; it is not an authenticated-migrator, production-owner, deployment,
external-authentication, restore, application-integration, or attestation of
GitHub run or artifact authenticity.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`7aac5027011dd4f650658e268425ba6eb4a7993f`](https://github.com/liangzixuan/investing-pro/commit/7aac5027011dd4f650658e268425ba6eb4a7993f)
- PostgreSQL workflow: successful [run `32058853521`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32058853521)
- PostgreSQL job: successful [Ubuntu 24.04 job `95475199101`](https://github.com/liangzixuan/investing-pro/actions/runs/32058853521/job/95475199101)
- Cross-platform release gate: successful [CI run `32058853516`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32058853516), with [Windows job `95475199461`](https://github.com/liangzixuan/investing-pro/actions/runs/32058853516/job/95475199461) and [Ubuntu job `95475199752`](https://github.com/liangzixuan/investing-pro/actions/runs/32058853516/job/95475199752) successful

The later documentation commit that links this note is a different commit; it
does not replace, retest, or expand the run anchors above.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v6-7aac5027011dd4f650658e268425ba6eb4a7993f-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32058853521/artifacts/9297381884)
- Artifact ID: `9297381884`
- GitHub artifact expiry: `2026-09-16T19:11:11Z`
- GitHub API artifact ZIP byte length: `1491`
- GitHub artifact ZIP SHA-256: `c425bde7e89bbad67c579e293ac2783a1b4eec4d308948527204edf0bd844459`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v6.json`
- Evidence JSON byte length: `2787`
- Producer-log and downloaded-file SHA-256: `e9744b8c05b0ddbb08b410cb22ec76e59f9418f7e108f5742e6f9d6caa65505f`
- Recorded completion time: `2026-08-17T19:11:11.678Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `1926`
- Retained offline-verification JSON SHA-256: `2f9ef1279d6ef82f0d7e0e75b5f2f857faa7485b80fe4927d4ddd8cd27d7c815`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the
producer-log value supplied separately for review. Artifact retention remains
finite; any separately retained operator copy has its own custody boundary.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `c0e3531a791dfee4472aef818465e8a551d240c1c2a870fe5cd68c224cf5712d`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `3226c05a0f3b9717c1353c14abe5e6867eed9ddac41ad831a62576e323324c24`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `ee8564a56f23a9b7d7366564b889e21837812ad041848db4f9e464bae7d9b92c`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: e9744b8c05b0ddbb08b410cb22ec76e59f9418f7e108f5742e6f9d6caa65505f`
- `PostgreSQL 17.11 clean-bootstrap, impersonated-capability, authenticated test-loader, authenticated owner-DDL canary, container-local SCRAM runtime, and driverless financial-fact projection acceptance passed; the version 6 success-only run record was written.`

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 6 record's closed completed-check list is the machine-readable source
for the additional b6 result.

## Recorded checks and exact b6 scope

The version 6 record preserves every version 1 through version 5 check and adds
exactly `authenticated_owner_ddl_canary`. It retains the exact version 5
limitation list and six-source-hash shape; the new acceptance-runner and
workflow hashes bind the B6 orchestration and artifact path.

After the unchanged clean bootstrap and authenticated test-loader cleanup, the
B6 path created one ephemeral `research_cockpit_owner_ddl_login` with the
reviewed non-owner, non-creator, non-replicating, `NOINHERIT`, `NOBYPASSRLS`,
connection-limited attributes and one exact set-only, non-inheriting, non-admin
membership in `research_cockpit_owner`. It authenticated by SCRAM over loopback
TCP inside the unexposed service container. The run covered wrong-password
rejection; exact pre-role identity and membership semantics; pre-role table,
ledger, request-context-routine, persistent/public DDL, and temporary-object
denial; and forbidden role and session-authorization transitions.

Through transaction-local selection of only the owner capability, an injected
failure rolled back the fixed canary table completely. A separate transaction
committed the exact reviewed table shape with the owner capability as owner and
no non-owner ACL. A later authenticated owner-selected transaction removed the
canary and proved role reset. The migration ledger remained unchanged across
rollback, committed creation, removal, and final cleanup. The login, temporary
membership, client backends, passfiles, and object were removed, and their
absence was verified before the existing zero-membership catalog fingerprint
and success-only evidence emission.

All earlier clean-bootstrap, RLS, authenticated-runtime,
authorization-matrix, financial-fact projection, authenticated test-loader,
write-denial, cleanup, and evidence probes remained mandatory legs of the same
successful run. B6 does not retroactively widen the historical b1 through b5
evidence scopes.

## Offline review boundary

The downloaded version 6 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, all six recorded source hashes, and the exact migration manifest
and bodies at that commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature.

## Explicitly not proven

The version 6 record preserves these exact `notProven` values from version 5:

- `resolved_platform_image_manifest`
- `external_or_production_authenticated_database_sessions`
- `authenticated_migrator_sessions`
- `authenticated_backup_sessions`
- `end_user_identity_or_tenant_binding`
- `production_identity_tls_secrets_or_pooling`
- `concurrent_sessions_cancellation_or_timeouts`
- `dump_restore_or_disaster_recovery`
- `real_or_licensed_market_data`
- `application_driver_pool_or_composition_root`
- `complete_dossier_history_timeline_or_dimensioned_projection`

The canary is not a migration. The run did not split platform provisioning from
application migrations, execute the reviewed migration plan through an
authenticated non-superuser, install an extension, transfer existing object
ownership, or authorize a production owner or migrator login. It also does not
prove external network exposure, secret rotation, secure media erasure of
temporary passfiles, application/API integration, deployed persistence,
production privacy controls, or production readiness. B7 retains the full
versioned platform/application migration redesign and authenticated-migrator
proof.
