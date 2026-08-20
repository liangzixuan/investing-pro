# Cycle 1b-b14 exit matrix

Scope: one versioned, authenticated, bounded synthetic populated-resource-
identifier cutover from the exact v2 pre-`0005` branch to the B13 keyed
lifecycle. The design is recorded in
[ADR 0026](./adr/0026-bounded-populated-resource-identifier-online-cutover.md).
It is not a general or production cutover, a continuous zero-downtime result,
an application-writer deployment protocol, recovery of identifiers deleted
before capture, real-data evidence, or production admission.

The source contract, frozen-byte local integration, pinned live PostgreSQL
execution, retained V14 evidence and logs, and independent artifact review are
complete for this bounded synthetic scope. PostgreSQL run `32343225599`,
attempt 1, at commit `d688aa21e969feef6611f6efcd1aeaaed6e31df9`
returned a version 14 success record whose independent commit-bound review was
`offline_consistent`.
Historical B1 through B13 evidence remains valid only for its exact recorded
checks.

| Gate                             | Evidence required                                                                                                                                                                                                                                                            | Current status                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Historical evidence preservation | Exact V1 through V13 parser, verifier, reviewer, tool/source, check, limitation, and record behavior remains accepted; a V13 commit is reviewable without B14 blobs or config                                                                                                | Pass — compatibility and historical V13 tests  |
| Immutable cutover inventory      | Manifest v1 binds the exact platform, v2 base manifest and selected `0001`-`0004` plus `0006` bodies, excluded `0005`, B13 target policy/manifest/body, and the two ordered cutover bodies                                                                                   | Pass — source/focused tests                    |
| Populated pre-`0005` branch      | Fixed disposable database is built from the exact authenticated base without applying unsafe `v2-0005`, then receives the deterministic populated synthetic fixture                                                                                                          | Pass — reviewed live V14                       |
| Expand and capture boundary      | Expand installs the audited work registry, capture triggers, not-yet-validated target constraints, and the exact synthetic privacy/keyed registry surface                                                                                                                    | Pass — reviewed live V14                       |
| Bounded authenticated backfill   | Authenticated cutover capability claims bounded work and binds externally derived tokens without receiving the key; source/work/registry correspondence fails closed                                                                                                         | Pass — reviewed live V14                       |
| Post-capture writes              | Acceptance-only test-seed insert and authenticated migrator-to-owner delete are captured while backfill is open; only the tested post-capture delete is claimed                                                                                                              | Pass — reviewed live V14                       |
| Rollback and bounded retry       | Injected precommit failure leaves the expanded source intact; a captured insert forces stale-epoch contract rollback, then bounded reinspection, backfill, and retry use the new exact epoch                                                                                 | Pass — reviewed live V14                       |
| Final barrier and serialization  | Exact epoch and zero pending work are rechecked under the advisory gate and short final write-conflicting barrier; a competing contract and pre-derived acceptance writer block, finalize contracts to the semantic B13 catalog, the writer resumes, and replay fails closed | Pass — reviewed live V14                       |
| Version 14 evidence              | V14 appends only two checks and three top-level source hashes; manifest-named bodies are independently commit-bound; V13 tools and historical branches remain exact                                                                                                          | Pass — retained and `offline_consistent`       |
| Integrated local verification    | Evidence, plan, acceptance, TypeScript, lint, format, static guardrail, and compatibility gates pass without making a live-engine claim                                                                                                                                      | Pass — frozen-byte integrated local gates      |
| Pinned V14 live evidence         | Reviewed workflow/log markers, retained V14 artifact and hashes, and independent commit-bound review return `offline_consistent`                                                                                                                                             | Pass — run `32343225599`; `offline_consistent` |
| Production admission             | Production writer authorization/dual-write and quiescence protocol, uninterrupted-write and allocation-gap handling, volume/SLO/lock budgets, crash/restart/failover/downgrade behavior, external key custody, global deletion, and real-data approval exist                 | Blocked; explicitly outside B14                |

## Exit rule

B14 is complete for this bounded synthetic scope. PostgreSQL run `32343225599`
at commit `d688aa21e969feef6611f6efcd1aeaaed6e31df9` executed the exact
capture/backfill/contract sequence with mandatory cleanup. Its V14 record and
logs were retained with independent anchors, and the commit-bound offline
reviewer returned `offline_consistent`. The catalog comparison establishes
normalized semantic equivalence to the B13 target; it is not physical-layout,
OID, page, or storage equivalence. See the
[B14 evidence note](./POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md).

Production admission remains blocked by the final row. In particular, B14
does not recover resource identifiers deleted before its capture boundary and
does not turn the acceptance identities into a production application-writer
integration or dual-write protocol.
