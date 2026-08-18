# Cycle 1b-b11 exit matrix

Scope: one non-owning migration deployer over an exclusively leased,
authenticated `pg.Client`, the exact closed v2 plan, one transaction-scoped
advisory lock, one locked migration ledger, and a bounded two-client
container-local concurrency proof. It is not a general migration framework,
application deployment, external credential, distributed orchestration, or
production-readiness result. The design is accepted in
[ADR 0023](./adr/0023-locked-postgresql-migration-ledger-deployment.md).

The source, V11 evidence contract, and integrated local verification are
complete. Pinned live PostgreSQL execution, retained V11 evidence, log review,
and independent artifact review remain pending. Historical B1 through B10
evidence remains valid only for its recorded checks.

| Gate                             | Evidence required                                                                                                                                                                                                                                                                                                                                | Current status                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Historical evidence preservation | V1 through V10 parser branches, source/tool shapes, checks, limitations, records, migration/restore plans, adapter and pool contracts, and recorded meanings remain exact                                                                                                                                                                        | Pass — focused evidence tests                         |
| Exact prerequisites              | Every B1 through B10 bootstrap, authentication, authorization, projection, migration, backup/restore, client, pool, cleanup, and evidence prerequisite remains mandatory before V11 evidence                                                                                                                                                     | Pass — preserved; live V11 pending                    |
| Closed immutable input           | The deployer synchronously snapshots and validates the exact v2 manifest and six reviewed bodies before its first await                                                                                                                                                                                                                          | Implemented — source/focused unit                     |
| Exclusive authenticated client   | One non-owning deployer uses one exclusively leased client; the live login has exact SCRAM identity, attributes, two-connection limit, no direct application privilege, and one set-only owner edge                                                                                                                                              | Implemented — live pending                            |
| Finite transaction boundary      | Every attempt resets transaction/role state, opens one read-write `READ COMMITTED` transaction, and fixes local statement and lock timeouts                                                                                                                                                                                                      | Implemented — source/focused unit; live pending       |
| Lock ordering                    | The transaction takes the reviewed advisory lock before owner selection and a `SHARE ROW EXCLUSIVE` lock on the exact ledger before reading or applying a suffix                                                                                                                                                                                 | Implemented — source/focused unit; live pending       |
| Ledger object validation         | Relation persistence, owner, RLS flags, five columns/defaults, three constraints, and public/runtime privilege absence match the reviewed contract                                                                                                                                                                                               | Implemented — source/focused unit; live pending       |
| Prefix and drift refusal         | Only a non-empty exact ordered manifest prefix is accepted; gapped/extra/reordered rows or ID, filename, or SHA-256 mismatch returns stable value-free drift without applying pending work; an exact missing tail is the pending suffix                                                                                                          | Implemented — source/focused unit; live drift pending |
| Injected rollback                | A deterministic failure after the pending body and ledger insert but before commit restores the exact `v2-0005` prefix and leaves no `v2-0006` procedure change or ledger row                                                                                                                                                                    | Implemented — source/focused unit; live pending       |
| Once-only suffix                 | From the exact five-row prefix, one deployment applies only `v2-0006`; a later deployment reports `current` with no body replay                                                                                                                                                                                                                  | Implemented — source/focused unit; live pending       |
| Concurrent serialization         | Two authenticated clients overlap against the same prefix; locks serialize them so exactly one reports `applied` for `v2-0006` and the other reports `current`                                                                                                                                                                                   | Implemented — bounded live proof pending              |
| Ambiguity handling               | Rollback/reset failure, ambiguous commit, and post-commit cleanup ambiguity poison the deployer instead of claiming safe reuse                                                                                                                                                                                                                   | Implemented — source/focused unit                     |
| Zero residue                     | Both clients/backends, ephemeral login and membership/SCRAM verifier, and locks are absent before evidence; checksum drift and prefix reconstruction leave no divergence from the exact current V11 target; no passfile or on-disk password artifact is created, while secure erasure of the in-memory JavaScript password string is not claimed | Implemented — live pending                            |
| Version 11 evidence              | V11 appends the exact B11 check and `postgresMigrationDeployerSha256`, retains V10 tools, applies only the frozen migration nonclaim split, rejects mixed source bundles, and preserves V1-V10                                                                                                                                                   | Pass — 158 focused evidence tests                     |
| Integrated local verification    | Complete database tests, typecheck, migration/PostgreSQL static guardrails, focused lint/format, and diff check pass without making a live-engine claim                                                                                                                                                                                          | Pass — 13 database files / 515 tests; workspace gates |
| Pinned V11 live evidence         | Clean dedicated PostgreSQL workflow, exact log markers, retained artifact/evidence hashes, immutable source hashes, and independent offline review support the bounded B11 claim                                                                                                                                                                 | Pending                                               |
| General or production migration  | External/production credentials, arbitrary manifests, multi-release upgrades, application compatibility, concurrent writes, crash recovery, cancellation, retries/failover, global atomicity, distributed coordination, and production readiness are demonstrated                                                                                | Out of scope                                          |

## Exit rule

Cycle 1b-b11 is not live-complete yet. Its source and integrated local gates
pass; it becomes complete only after a clean pinned PostgreSQL workflow
executes the exact bounded matrix with mandatory cleanup, the V11 record and
logs are retained with independent anchors, and the commit-bound offline
reviewer returns `offline_consistent`.

The passing local matrix also includes every other workspace test project,
root and database typechecks, lint, formatting, production builds, static
database guardrails, and diff checks. Docker was unavailable locally, so this
is not live PostgreSQL evidence. The local license inventory could not enumerate
a pre-existing pnpm-store entry for `@fastify/cors@11.3.0`; a clean CI install
and release gate remain mandatory.

Mock-only lock ordering, a checksum comparison performed only before database
I/O, an unlocked ledger read, replay that reruns an applied body, or two
sequential invocations presented as concurrency would not satisfy this gate.

No B12 milestone label is assigned here; subsequent work follows the remaining
roadmap gates without inferring a successor claim from B11.
