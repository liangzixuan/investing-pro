# PostgreSQL authenticated-authorization-matrix evidence

Reviewed: 2026-08-16 (America/Chicago)

This note records the first successful Cycle 1b-b3 execution of the reviewed
synthetic authorization matrix through the ephemeral SCRAM-authenticated
runtime service account and the separate offline consistency review of its
downloaded success record. It indexes bounded test evidence; it is not a
production-readiness, tenant-identity, or GitHub-authenticity attestation.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Tested commit: [`664c0e5b0158925918c4ff07c9f7f28fe345327b`](https://github.com/liangzixuan/investing-pro/commit/664c0e5b0158925918c4ff07c9f7f28fe345327b)
- PostgreSQL workflow: [run `31991498652`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/31991498652)
- PostgreSQL job: [Ubuntu 24.04 job `95275773749`](https://github.com/liangzixuan/investing-pro/actions/runs/31991498652/job/95275773749)
- Cross-platform release gate: [CI run `31991498671`](https://github.com/liangzixuan/investing-pro/actions/runs/31991498671), with Ubuntu job `95275773926` and Windows job `95275773854` successful

The later documentation commit that links this note is a different commit; it
does not replace, retest, or expand the run anchors above.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v3-664c0e5b0158925918c4ff07c9f7f28fe345327b-1`](https://github.com/liangzixuan/investing-pro/actions/runs/31991498652/artifacts/9275477303)
- Artifact ID: `9275477303`
- GitHub artifact expiry: `2026-09-16T03:33:33Z`
- Artifact ZIP byte length: `1300`
- GitHub artifact ZIP SHA-256: `8e385ffd17dcf26ef275ae714e3aab70495fa20e9cff499d7d4f81b3c918e898`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v3.json`
- Evidence JSON byte length: `2318`
- Producer-log and downloaded-file SHA-256: `aefbfe52d8d7eb1b9ddef6cb3b743c0bf18ecb54bda190c5bdf18eee6daa38f6`
- Recorded completion time: `2026-08-17T03:33:33.451Z`
- Offline verifier verdict: `offline_consistent`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the
producer-log value supplied separately for review. Artifact retention remains
finite; any separately retained operator copy has its own custody boundary.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `8d5b8a58119692dedb1e6409f56f478d327f79610e1c863131bf7f74d073636c`
- Synthetic fixture SHA-256: `69974bf2996cbdd0078d509db933fe89d670005e177b7f57187df54b201b99bf`
- Migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `a58fc48231d304826a0d2bd6373e29b1f8fa5f13ff324de4cce30192f51af8d9`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: aefbfe52d8d7eb1b9ddef6cb3b743c0bf18ecb54bda190c5bdf18eee6daa38f6`
- `PostgreSQL 17.11 clean-bootstrap, impersonated-capability, and container-local SCRAM runtime acceptance passed; the success-only run record was written.`

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 3 record's closed completed-check list is the machine-readable source
for the additional b3 result.

## Recorded checks and exact b3 scope

The version 3 record preserves every version 1 clean-bootstrap and
impersonated-capability check, preserves the version 2
`bounded_container_local_scram_runtime_probe`, and adds exactly
`authenticated_runtime_authorization_matrix`.

The b3 check reruns the shared synthetic tenant-isolation and operation-rights
assertions through the service account after transaction-local selection of
`research_cockpit_runtime`. It covers the reviewed alpha/beta visibility,
inactive and non-current membership states, direct lookup and enumeration,
join/`EXISTS`/scalar-subquery isolation, duplicate tenant-local identifiers,
the exact display/API, derive/API, and alert/local-alert rights outcomes, and
the alternating prepared sequence on one authenticated backend. The record and
this note disclose no tenant-row totals or hidden identifiers.

The earlier b2 wrong-password, pre-role, role-escalation, identity,
missing-context, transaction-cleanup, representative write-denial,
backend-drain, and residue-removal probes remained mandatory legs of the same
successful run. The b1 null, malformed, and unsupported-context failure cases
were not rerun through the authenticated login and are not promoted by b3.

## Offline review boundary

The downloaded version 3 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, the recorded source hashes, and the exact migration manifest and
bodies at that commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an
independent signature.

## Explicitly not proven

The version 3 record continues to state that this run does not prove the
resolved platform child manifest; external or production database
authentication; authenticated migrator, test-loader, or backup sessions;
end-user/principal/organization binding; production identity, TLS, secrets, or
pooling; concurrent sessions, cancellation, or timeouts; dump/restore or
disaster recovery; or real/licensed market data.

It also does not prove a driver or application adapter, trusted tenant-context
selection, pool checkout/reset behavior, deployed persistence, production
secret rotation, secure media erasure of temporary passfiles, production
privacy controls, or production readiness. The result is one sequential,
synthetic, container-local service-account execution only.
