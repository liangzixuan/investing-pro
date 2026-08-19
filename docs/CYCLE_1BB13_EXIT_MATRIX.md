# Cycle 1b-b13 exit matrix

Scope: one accepted, versioned technical privacy/retention decision and one
bounded synthetic PostgreSQL lifecycle for keyed permanent resource
identifiers. The source is restricted to the fixed pristine disposable
database and an empty-data suffix over the exact v2 plan. It is not production
privacy/legal approval, a populated migration, real-data evidence, a production
DSAR/offboarding/KMS/backup system, or complete deletion proof. The design is
recorded in [ADR 0025](./adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md).

| Gate                                             | Evidence required                                                                                                                                                                                                                               | Current status                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Historical evidence preservation                 | Exact V1 through V12 parser, verifier, reviewer, source/tool, check, limitation, and record behavior remains accepted without B13 blobs                                                                                                         | Pass — exact historical compatibility tests are green locally |
| Versioned decision contract                      | Canonical policy v1 is synthetic-only, records exact technical retention targets and external gates, and keeps production admission false                                                                                                       | Implemented in source                                         |
| Immutable plan inventory                         | Canonical manifest v1 hashes the fixed platform bootstrap and every named application body; missing, extra, reordered, or changed plan input fails closed                                                                                       | Implemented in source and offline reviewer                    |
| Empty-only compatibility                         | Historical v2/legacy files remain unchanged; the privacy v1 suffix takes write-conflicting locks before a separate emptiness check, rejects populated or concurrently populated tenant tables, and runs only in the dedicated pristine database | Implemented in source; live V13 pending                       |
| External keyed-token boundary                    | Exact HMAC-SHA-256 framing and 32-byte output are fixed; the key remains external; PostgreSQL does not claim to verify token authenticity                                                                                                       | Implemented in source                                         |
| Raw identifier clearing and same-token non-reuse | The authenticated privacy capability hard-deletes one live resource, clears raw organization/resource UUIDs in its registry allocation, and retains a domain/type/token tombstone that cannot be revived or reused                              | Implemented in source; live V13 pending                       |
| Offboarding admission and purge                  | Active-to-offboarding blocks allocation; the fixed bounded procedure removes the synthetic online tenant graph and token rows with mandatory cleanup                                                                                            | Implemented in source; live V13 pending                       |
| Bounded metadata expiry                          | Transaction-clock idempotency/audit expiry deletes no more than 1,000 rows of each class per call and preserves every unexpired row across tenants                                                                                              | Implemented in source; live V13 pending                       |
| Version 13 evidence                              | V13 appends only the two exact checks, six exact source hashes, and ordered nonclaims; manifest-named SQL bodies are commit-bound; tools remain V12 exact                                                                                       | Implemented; live artifact pending                            |
| Integrated local verification                    | Evidence, token, policy/plan, acceptance, type, lint, format, static guardrail, and build gates pass without making a live-engine claim                                                                                                         | Pass locally — 17 DB files / 562 tests; no live claim         |
| Pinned V13 live evidence                         | Exact workflow/log markers, retained V13 artifact and hashes, and independent commit-bound review return `offline_consistent`                                                                                                                   | Pending — no V13 run or artifact is claimed                   |
| Production admission                             | Privacy/legal approval, lawful basis/notices/holds, verified DSAR, operating offboarding scheduler/monitoring, KMS/HSM custody/destruction/recovery, all online and backup deletion planes, populated cutover, and real-data approval exist     | Blocked; explicitly outside B13                               |

## Exit rule

B13 source completion requires the exact policy, plan, token boundary, fixture,
acceptance path, V13 evidence branches, documentation, and integrated local
verification to pass. That source milestone does not become a live V13 result
until the pinned workflow completes, its success-only artifact and logs are
retained, and the commit-bound offline reviewer returns `offline_consistent`
against independent anchors.

Even a reviewed live V13 result would remain bounded to synthetic mechanics in
one disposable database. Production admission stays blocked until every
external approval and operating control in the final matrix row is separately
implemented, tested, and approved. Item 18 of the package roadmap continues to
own any populated-database backfill and online cutover; B13 does not satisfy it.
