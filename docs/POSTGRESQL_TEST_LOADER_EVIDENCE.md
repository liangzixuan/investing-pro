# PostgreSQL authenticated test-loader evidence

Reviewed: 2026-08-17 (America/Chicago)

This note records the first successful Cycle 1b-b5 execution of the unchanged
reviewed synthetic fixture through an ephemeral, non-owner,
SCRAM-authenticated test-loader login and the separate offline consistency
review of the downloaded version 5 success record. It indexes bounded synthetic
acceptance evidence; it is not a production-loader, external-authentication,
restore, application-integration, or GitHub-authenticity attestation.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`04e5c1b94c6488b72705c0c5d5e176909a33c857`](https://github.com/liangzixuan/investing-pro/commit/04e5c1b94c6488b72705c0c5d5e176909a33c857)
- PostgreSQL workflow: successful [run `32012508025`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32012508025)
- PostgreSQL job: successful [Ubuntu 24.04 job `95334929305`](https://github.com/liangzixuan/investing-pro/actions/runs/32012508025/job/95334929305)
- Cross-platform release gate: successful [CI run `32012507963`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32012507963), with [Windows job `95334929193`](https://github.com/liangzixuan/investing-pro/actions/runs/32012507963/job/95334929193) and [Ubuntu job `95334929286`](https://github.com/liangzixuan/investing-pro/actions/runs/32012507963/job/95334929286) successful

The later documentation commit that links this note is a different commit; it
does not replace, retest, or expand the run anchors above.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v5-04e5c1b94c6488b72705c0c5d5e176909a33c857-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32012508025/artifacts/9282297019)
- Artifact ID: `9282297019`
- GitHub artifact expiry: `2026-09-16T08:54:26Z`
- GitHub API artifact ZIP byte length: `1483`
- GitHub artifact ZIP SHA-256: `3d97e900692efc9895f84032a1e92228b30f60cc9878073a5d828f954f90e743`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v5.json`
- Evidence JSON byte length: `2749`
- Producer-log and downloaded-file SHA-256: `ac49f9d9801ec1d290a0ecca1d516fc40a6b221ce92727692d73f620c30962d4`
- Recorded completion time: `2026-08-17T08:54:25.948Z`
- Offline verifier verdict: `offline_consistent`
- Retained offline-verification JSON byte length: `1888`
- Retained offline-verification JSON SHA-256: `7dfa0116dfa0ae17e46712a1452f97c03627c9cfc2d1aa3991b5c73a7a340183`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the
producer-log value supplied separately for review. Artifact retention remains
finite; any separately retained operator copy has its own custody boundary.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `3e371584789e8408e223da4386caf2dfcaf0edf9974116fd42ea74f907b8901d`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `63df620b92e6c8f1cf6f9fd07269700bde0acff9183cc7aad49a15a609ce68d3`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `ee8564a56f23a9b7d7366564b889e21837812ad041848db4f9e464bae7d9b92c`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: ac49f9d9801ec1d290a0ecca1d516fc40a6b221ce92727692d73f620c30962d4`
- `PostgreSQL 17.11 clean-bootstrap, impersonated-capability, authenticated test-loader, container-local SCRAM runtime, and driverless financial-fact projection acceptance passed; the version 5 success-only run record was written.`

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 5 record's closed completed-check list is the machine-readable source
for the additional b5 result.

## Recorded checks and exact b5 scope

The version 5 record preserves every version 1 through version 4 check and adds
exactly `authenticated_test_loader_fixture_load`. It retains the version 4
six-source-hash shape. The fixture and migration bytes remain unchanged; the
new acceptance-runner hash binds the B5 orchestration.

After clean bootstrap and replay rejection, the B5 path created one ephemeral
`research_cockpit_test_loader_login` with the reviewed non-owner, non-creator,
non-replicating, `NOINHERIT`, `NOBYPASSRLS`, connection-limited attributes and
one exact set-only, non-inheriting, non-admin membership in
`research_cockpit_test_seed`. It authenticated by SCRAM over loopback TCP inside
the unexposed service container. The run covered wrong-password rejection;
pre-role schema, table, routine, and temporary-object denial; forbidden role and
session-authorization transitions; and exact authenticated identity before and
after transaction-local capability selection.

The harness validated the historical fixture wrapper and extracted its exact
direct-insert body. A full-body injected failure before commit left the fixture
relations empty and the migration ledger unchanged. The successful transaction
then loaded that body through the test-seed capability and proved role reset.
Non-synthetic insertion, update, delete, truncate, migration-ledger read/write,
persistent DDL, and temporary DDL attempts failed closed. The login, temporary
membership, client backends, and passfiles were removed and their absence was
verified before the existing zero-membership catalog fingerprint and before
success-only evidence emission.

All earlier clean-bootstrap, RLS, authenticated-runtime,
authorization-matrix, financial-fact projection, write-denial, cleanup, and
evidence probes remained mandatory legs of the same successful run. B5 does
not retroactively widen the historical b1 through b4 evidence scopes.

## Offline review boundary

The downloaded version 5 JSON returned `offline_consistent` against separately
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

The version 5 record states that this run does not prove the resolved platform
child manifest; external or production authenticated database sessions; an
authenticated migrator or backup session; end-user, principal, organization,
or trusted-tenant binding; production identity, TLS, secrets, or pooling;
concurrent sessions, cancellation, or timeouts; dump/restore or disaster
recovery; real or licensed market data; an application driver, pool, or
composition root; or complete dossier, history, timeline, or dimensioned
projections.

It also does not prove a production loader or ingestion path, external network
exposure, secret rotation, secure media erasure of temporary passfiles,
application/API integration, deployed persistence, production privacy controls,
or production readiness. The result is one sequential, synthetic,
container-local acceptance-only test-loader execution.
