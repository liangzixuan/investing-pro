# Cycle 1b-b13 exit matrix

Scope: one accepted, versioned technical privacy/retention decision and one
bounded synthetic PostgreSQL lifecycle for keyed permanent resource
identifiers. The source is restricted to the fixed pristine disposable
database and an empty-data suffix over the exact v2 plan. It is not production
privacy/legal approval, a populated migration, real-data evidence, a production
DSAR/offboarding/KMS/backup system, or complete deletion proof. The design is
recorded in [ADR 0025](./adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md).

The source contract, integrated local verification, pinned live PostgreSQL
execution, retained V13 evidence and logs, and independent artifact review are
complete for this bounded synthetic scope. Historical B1 through B12 evidence
remains valid only for its recorded checks.

| Gate                                             | Evidence required                                                                                                                                                                                                                               | Current status                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Historical evidence preservation                 | Exact V1 through V12 parser, verifier, reviewer, source/tool, check, limitation, and record behavior remains accepted without B13 blobs                                                                                                         | Pass — compatibility tests and commit-bound review |
| Versioned decision contract                      | Canonical policy v1 is synthetic-only, records exact technical retention targets and external gates, and keeps production admission false                                                                                                       | Pass — source and reviewed V13 record              |
| Immutable plan inventory                         | Canonical manifest v1 hashes the fixed platform bootstrap and every named application body; missing, extra, reordered, or changed plan input fails closed                                                                                       | Pass — source and commit-bound offline review      |
| Empty-only compatibility                         | Historical v2/legacy files remain unchanged; the privacy v1 suffix takes write-conflicting locks before a separate emptiness check, rejects populated or concurrently populated tenant tables, and runs only in the dedicated pristine database | Pass — source/focused tests and reviewed live      |
| External keyed-token boundary                    | Exact HMAC-SHA-256 framing and 32-byte output are fixed; the key remains external; PostgreSQL does not claim to verify token authenticity                                                                                                       | Pass — source/focused tests and reviewed live      |
| Raw identifier clearing and same-token non-reuse | The authenticated privacy capability hard-deletes one live resource, clears raw organization/resource UUIDs in its registry allocation, and retains a domain/type/token tombstone that cannot be revived or reused                              | Pass — reviewed live; same-token reuse rejected    |
| Offboarding admission and purge                  | Active-to-offboarding blocks allocation; the fixed bounded procedure removes the synthetic online tenant graph and token rows with mandatory cleanup                                                                                            | Pass — reviewed live                               |
| Bounded metadata expiry                          | Transaction-clock idempotency/audit expiry deletes no more than 1,000 rows of each class per call and preserves every unexpired row across tenants                                                                                              | Pass — reviewed live                               |
| Version 13 evidence                              | V13 appends only the two exact checks, six exact source hashes, and ordered nonclaims; manifest-named SQL bodies are commit-bound; tools remain V12 exact                                                                                       | Pass — retained and `offline_consistent`           |
| Integrated local verification                    | Evidence, token, policy/plan, acceptance, type, lint, format, static guardrail, and build gates pass without making a live-engine claim                                                                                                         | Pass — integrated local gates                      |
| Pinned V13 live evidence                         | Exact workflow/log markers, retained V13 artifact and hashes, and independent commit-bound review return `offline_consistent`                                                                                                                   | Pass — run `32305478242`; `offline_consistent`     |
| Production admission                             | Privacy/legal approval, lawful basis/notices/holds, verified DSAR, operating offboarding scheduler/monitoring, KMS/HSM custody/destruction/recovery, all online and backup deletion planes, populated cutover, and real-data approval exist     | Blocked; explicitly outside B13                    |

## Exit rule

B13 is complete for this bounded synthetic scope. PostgreSQL run `32305478242`
at commit `a959cba` executed the exact lifecycle with mandatory cleanup; its V13
record and logs were retained with independent anchors, and the commit-bound
offline reviewer returned `offline_consistent`. See the
[B13 evidence note](./POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md).

The reviewed live V13 result remains bounded to synthetic mechanics in one
disposable database. Production admission stays blocked until every
external approval and operating control in the final matrix row is separately
implemented, tested, and approved. Item 18 of the package roadmap continues to
own any populated-database backfill and online cutover; B13 does not satisfy it.
The accepted successor source design is documented in
[ADR 0026](./adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](./CYCLE_1BB14_EXIT_MATRIX.md); it does not
retroactively widen this retained V13 result.
