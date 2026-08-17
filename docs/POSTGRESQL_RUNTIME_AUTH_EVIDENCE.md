# PostgreSQL runtime-authentication evidence

Reviewed: 2026-08-16 (America/Chicago)

This note records the first successful Cycle 1b-b2 container-local SCRAM
runtime-service-account run and the separate offline consistency review of its
downloaded success record. It indexes bounded test evidence; it is not a
production-readiness or GitHub-authenticity attestation.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Tested commit: [`3479e1646b1a5d2f12adebfbc1f6d1a48592f2cf`](https://github.com/liangzixuan/investing-pro/commit/3479e1646b1a5d2f12adebfbc1f6d1a48592f2cf)
- Event/branch: `push` to `main`
- PostgreSQL workflow: [run `31988811000`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/31988811000)
- PostgreSQL job: [Ubuntu 24.04 job `95268471895`](https://github.com/liangzixuan/investing-pro/actions/runs/31988811000/job/95268471895)
- Cross-platform release gate: [CI run `31988810990`](https://github.com/liangzixuan/investing-pro/actions/runs/31988810990), with Ubuntu job `95268471726` and Windows job `95268471758` successful

The later documentation commit that links this note is a different commit; it
does not replace or expand the run anchors above.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v2-3479e1646b1a5d2f12adebfbc1f6d1a48592f2cf-1`](https://github.com/liangzixuan/investing-pro/actions/runs/31988811000/artifacts/9274629762)
- Artifact ID: `9274629762`
- GitHub artifact expiry: `2026-09-16T02:43:04Z` (the retained external copy is separate)
- Artifact ZIP byte length: `1306`
- GitHub artifact ZIP SHA-256: `9f6cf3be53ee71d1db33d952493ef86696721090754e75c4fda5f7cf87dbf1ec`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v2.json`
- Evidence JSON byte length: `2323`
- Producer-log and downloaded-file SHA-256: `a9891280c7dd4e401514c3cc52ee13773063c422d84d0173e110637f58f2fa65`
- Recorded completion time: `2026-08-17T02:43:04.581Z`
- Offline verifier verdict: `offline_consistent`

The ZIP, extracted JSON, and verifier output were retained outside the Git
worktree. The ZIP contained exactly the expected JSON entry. Its SHA-256
matched GitHub's reported artifact digest, and the JSON SHA-256 matched the
producer-log value supplied separately for review.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `f49462e77c9a902954cef053d741d73429e1c3c25519eed69b65a75c1e673239`
- Synthetic fixture SHA-256: `69974bf2996cbdd0078d509db933fe89d670005e177b7f57187df54b201b99bf`
- Migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `6ba66f953e577329be38aacf9c80d4ff2296618039ef353e9196b8bc2d9296bb`

## Reviewed log markers

The reviewed job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: a9891280c7dd4e401514c3cc52ee13773063c422d84d0173e110637f58f2fa65`
- `PostgreSQL 17.11 clean-bootstrap, impersonated-capability, and container-local SCRAM runtime acceptance passed; the success-only run record was written.`

## Recorded checks

The version 2 success record reports these implemented checks as passed for
this run:

- pristine target and atomic bootstrap rollback;
- clean bootstrap, migration ledger, and replay rejection;
- synthetic fixture load and exact catalog contract;
- backup capability catalog;
- request-context cleanup and tenant isolation;
- operation rights and write denials; and
- one `bounded_container_local_scram_runtime_probe`.

The aggregate runtime-authentication check covers the source-reviewed b2
topology, SCRAM credential, wrong-password rejection, runtime-login attributes,
exact SET-only membership, pre-role denials, forbidden role changes, session
identity, missing-context result, one alpha-versus-beta tenant read, sequential
transaction cleanup, representative write denial, and teardown/residue checks.
It does not reclassify the broader b1 query-shape or operation-rights matrix as
authenticated-session evidence.

The offline verifier separately established canonical record bytes, external
record-hash equality, metadata-anchor equality, reviewed-target equality,
recorded source hashes at the tested commit, and the exact migration
manifest/body hashes at that commit.

## Explicitly not proven

The record says this run does not prove the resolved platform child manifest;
external or production database authentication; authenticated migrator,
test-loader, or backup sessions; the full authorization matrix through the
authenticated runtime login; end-user/principal/organization binding;
production identity, TLS, secrets, or pooling; concurrent sessions,
cancellation, or timeouts; dump/restore or disaster recovery; or real/licensed
market data.

It also does not prove driver or app wiring, deployed persistence, secure media
erasure of temporary passfiles, or production secret rotation. The offline
verifier cannot authenticate the GitHub run or artifact, inspect the workflow
logs or independently prove database execution, validate a commit signature or
branch reachability, or establish the provenance of supplied trust anchors.
The artifact and producer log share the GitHub trust domain, so matching hashes
detect corruption or substitution relative to those anchors but are not an
independent signature.
