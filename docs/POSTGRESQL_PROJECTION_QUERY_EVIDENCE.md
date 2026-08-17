# PostgreSQL driverless projection-query evidence

Reviewed: 2026-08-17 (America/Chicago)

This note records the first successful Cycle 1b-b4 execution of the reviewed
driverless financial-fact projection query through the ephemeral
SCRAM-authenticated runtime service account, its fail-closed normalization, and
the separate offline consistency review of the downloaded version 4 success
record. It indexes bounded synthetic test evidence; it is not an application
adapter, production-readiness, tenant-identity, or GitHub-authenticity
attestation.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Event/branch: push to `main`
- Tested commit: [`55c61ececb39136c1ef86c925f47ca7075633ec6`](https://github.com/liangzixuan/investing-pro/commit/55c61ececb39136c1ef86c925f47ca7075633ec6)
- PostgreSQL workflow: [run `32007521395`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32007521395)
- PostgreSQL job: [Ubuntu 24.04 job `95319972163`](https://github.com/liangzixuan/investing-pro/actions/runs/32007521395/job/95319972163)
- Cross-platform release gate: [CI run `32007521422`](https://github.com/liangzixuan/investing-pro/actions/runs/32007521422), with Ubuntu job [`95319972061`](https://github.com/liangzixuan/investing-pro/actions/runs/32007521422/job/95319972061) and Windows job [`95319971920`](https://github.com/liangzixuan/investing-pro/actions/runs/32007521422/job/95319971920) successful

The later documentation commit that links this note is a different commit; it
does not replace, retest, or expand the run anchors above.

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-v4-55c61ececb39136c1ef86c925f47ca7075633ec6-1`](https://github.com/liangzixuan/investing-pro/actions/runs/32007521395/artifacts/9280554556)
- Artifact ID: `9280554556`
- GitHub artifact expiry: `2026-09-16T07:50:36Z`
- Artifact ZIP byte length: `1477`
- GitHub artifact ZIP SHA-256: `319747918e0a016eb5f93a7aa05fce9d0e4f1b3d0d94d93159d6740e634728ee`
- Sole ZIP entry: `research-cockpit-postgres-acceptance-v4.json`
- Evidence JSON byte length: `2688`
- Producer-log and downloaded-file SHA-256: `df2b0ec9b0df7add07cd485cc0e26610cc6cd63b21b72cfc85d30abeb1c45bda`
- Recorded completion time: `2026-08-17T07:50:35.886Z`
- Offline verifier verdict: `offline_consistent`

The ZIP contained exactly the expected JSON entry. Its SHA-256 matched the
reported artifact digest, and the downloaded JSON SHA-256 matched the
producer-log value supplied separately for review. Artifact retention remains
finite; any separately retained operator copy has its own custody boundary.

## Reviewed target and sources

- PostgreSQL image index:
  `docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad`
- Server version number/version: `170011` / `17.11`
- Workflow SHA-256: `b9dc3eafcf31d4829ea71422216390a0be050c2d567d6148da9afd31b9e97012`
- Synthetic fixture SHA-256: `0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7`
- Migration manifest SHA-256: `fc6d00b01edc18e57828c662d6e116b933b12ef0a86e23fe48655037c87630e8`
- Acceptance runner SHA-256: `29d2ddc20c25eb3e92b8b72dee33cd5858255352c68b09ac1710be87ad909655`
- Projection-query SHA-256: `59937ac54312e058e5e4350c114298ae1c443be85ea49b3a27951dfa64431e54`
- Projection-normalizer SHA-256: `ee8564a56f23a9b7d7366564b889e21837812ad041848db4f9e464bae7d9b92c`

## Reviewed log markers

The reviewed successful job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: df2b0ec9b0df7add07cd485cc0e26610cc6cd63b21b72cfc85d30abeb1c45bda`
- `PostgreSQL 17.11 clean-bootstrap, impersonated-capability, container-local SCRAM runtime, and driverless financial-fact projection acceptance passed; the version 4 success-only run record was written.`

The terminal sentence deliberately remains an aggregate acceptance marker. The
version 4 record's closed completed-check list is the machine-readable source
for the additional b4 result.

## Recorded checks and exact b4 scope

The version 4 record preserves every version 1 through version 3 check and adds
exactly `authenticated_financial_fact_projection_query`.

The b4 check executes one source-controlled, operation-specific query through
the container-local SCRAM login after transaction-local selection of
`research_cockpit_runtime`. The query uses typed listing, public-known, and
system-recorded parameters; explicit listing -> share class -> security -> fact
and exact policy/grant joins; reviewed half-open temporal predicates; exact
wire aliases; deterministic ordering; and a 100/101 fail-closed result bound.
Display/API returned the two reviewed facts, while derive/API and
alert/local-alert each returned one. Wrong-listing, pre-cutoff,
inactive-principal, and no-current-membership cases returned empty.

The query output was parsed as untrusted JSON-lines input and passed through
the Cycle 1b-a2 all-or-nothing normalizer. Its source-controlled unit mapping
accepts only the five reviewed unit/currency pairs. No driver, connection URL,
pool, API/web import, application composition, write path, schema migration, or
real data was introduced.

All earlier clean-bootstrap, RLS, authenticated-session,
authorization-matrix, write-denial, backend-drain, and cleanup probes remained
mandatory legs of the same successful run. The b4 result does not retroactively
widen the historical b1-b3 evidence scopes.

## Offline review boundary

The downloaded version 4 JSON returned `offline_consistent` against separately
supplied repository, commit, run, attempt, and byte-hash anchors. The verifier
established canonical record bytes, anchor equality, the reviewed target at the
tested commit, the six recorded source hashes, and the exact migration manifest
and bodies at that commit.

The verifier did not authenticate GitHub or the artifact, inspect workflow
logs, replay the database execution, validate commit signatures or branch
reachability, or establish the provenance of the supplied trust anchors. The
artifact and producer log share the GitHub trust domain; matching hashes detect
corruption or substitution relative to those anchors but are not an independent
signature.

## Explicitly not proven

The version 4 record states that this run does not prove the resolved platform
child manifest; external or production database authentication; authenticated
migrator, test-loader, or backup sessions; end-user/principal/organization
binding; production identity, TLS, secrets, or pooling; concurrent sessions,
cancellation, or timeouts; dump/restore or disaster recovery; real/licensed
market data; an application driver, pool, or composition root; or complete
dossier, history, timeline, or dimensioned projections.

It also does not prove trusted tenant-context selection, pool checkout/reset
behavior, deployed persistence, production secret rotation, secure media
erasure of temporary passfiles, production privacy controls, or production
readiness. The result is one sequential, synthetic, container-local
service-account execution of the narrow reviewed projection only.
