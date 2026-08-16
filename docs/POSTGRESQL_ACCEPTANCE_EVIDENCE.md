# PostgreSQL acceptance evidence

Reviewed: 2026-08-16

This note records the first successful Cycle 1b-b1 clean-only PostgreSQL run
and the separate offline consistency review of its downloaded success record.
It is an evidence index, not a production-readiness attestation.

## Run anchors

- Repository: [`liangzixuan/investing-pro`](https://github.com/liangzixuan/investing-pro)
- Repository ID: `1335717938`
- Commit: [`611c93dc925f47fd902fc615c47ebedf921a6685`](https://github.com/liangzixuan/investing-pro/commit/611c93dc925f47fd902fc615c47ebedf921a6685)
- Event/branch: `push` to `main`
- PostgreSQL workflow: [run `31961988213`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/31961988213)
- PostgreSQL job: [Ubuntu 24.04 job `95201208147`](https://github.com/liangzixuan/investing-pro/actions/runs/31961988213/job/95201208147)
- Cross-platform release gate: [CI run `31961988188`](https://github.com/liangzixuan/investing-pro/actions/runs/31961988188), with both Ubuntu and Windows jobs successful

## Retained artifact

- Artifact: [`postgres-acceptance-evidence-611c93dc925f47fd902fc615c47ebedf921a6685-1`](https://github.com/liangzixuan/investing-pro/actions/runs/31961988213/artifacts/9267476774)
- Artifact ID: `9267476774`
- GitHub artifact expiry: `2026-09-15T17:34:42Z` (the retained external copy is separate)
- GitHub artifact ZIP SHA-256: `072c79b03fc61de74c8aaf6b94f3486ba66cd1019eb0ee12123bf16586cee85a`
- Evidence JSON filename: `research-cockpit-postgres-acceptance-v1.json`
- Evidence JSON byte length: `2090`
- Producer-log and downloaded-file SHA-256: `1938f048a8b2e79c50182c0acbc628d768e5e77cda15b144082746ae5625be20`
- Recorded completion time: `2026-08-16T17:34:42.539Z`
- Offline verifier verdict: `offline_consistent`

The ZIP and extracted JSON were retained outside the Git worktree. The ZIP
contained exactly the one expected JSON entry. Its SHA-256 matched GitHub's
artifact digest, and the extracted JSON SHA-256 matched the producer-log value
supplied separately before review.

## Reviewed log markers

The reviewed job log contained these exact terminal markers:

- `PostgreSQL acceptance evidence SHA-256: 1938f048a8b2e79c50182c0acbc628d768e5e77cda15b144082746ae5625be20`
- `PostgreSQL 17.11 clean-bootstrap and impersonated-capability acceptance passed; the success-only run record was written.`

## Recorded checks

The success record reports only these implemented checks as passed for this run:

- pristine target and atomic bootstrap rollback;
- clean bootstrap, migration ledger, and replay rejection;
- synthetic fixture load and exact catalog contract;
- backup capability catalog;
- request-context cleanup and tenant isolation;
- operation rights; and
- write denials.

The offline verifier separately established canonical record bytes, external
record-hash equality, metadata-anchor equality, reviewed target equality,
recorded source hashes at the commit, and the exact migration manifest/body
hashes at that commit.

## Explicitly not proven

The record itself says this run does not prove the resolved platform child
manifest, authenticated database sessions, production identity/TLS/secrets or
pooling, concurrent sessions/cancellation/timeouts, dump/restore or disaster
recovery, or real/licensed market data. The offline verifier also cannot prove
GitHub run/artifact authenticity, inspect workflow execution, validate commit
signatures or branch reachability, or establish the provenance of the supplied
trust anchors. Those properties remain unproven; authenticated sessions, pool
behavior, restore, and real-data behavior remain later release gates.
