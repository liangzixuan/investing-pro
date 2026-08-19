# Cycle 1b-b10 exit matrix

Scope: one owning database-package source over a real, bounded two-client
`pg.Pool`. It reimplements the exact B9 read-only projection transaction. Source
and unit checks cover the lifecycle mechanics; reviewed live V10 proves clean
checkout/reuse, simultaneous synthetic tenant isolation, bounded acquisition,
settlement-before-discard active cancellation, PostgreSQL statement-timeout
recovery, idempotent close, and zero pooled-backend residue. It is not an
application composition, end-user identity, external/TLS, production pool,
load-capacity, or production-readiness result. The design is accepted in
[ADR 0022](./adr/0022-bounded-postgresql-projection-pool-lifecycle.md).

Source and local verification, pinned live PostgreSQL execution, retained
version 10 evidence, reviewed logs, and independent artifact review are
complete. Historical B1 through B9 evidence remains valid only for its recorded
checks.

The settled pool source SHA-256 is
`257e2ab0a0a245c6385f8eddf6d44973dbddbb9cd6fc6a4b089cb0867aefa5e8`; the
acceptance runner SHA-256 is
`1f04e46a73deb32c1bfc74df1c91ae8d33fc9046c794c852fae82e0325d6ac5b`.
Independent integrated review reports GO with no P0/P1 finding.

| Gate                              | Evidence required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Current status                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Historical evidence preservation  | Version 1 through 9 parser branches, source shapes, checks, limitations, records, fixtures, migration and restore plans, adapter contract, and recorded meanings remain exact                                                                                                                                                                                                                                                                                                                                    | Pass — source and live regressions             |
| Exact B9 prerequisite             | Every B1 through B9 bootstrap, authentication, authorization, projection, migration, backup/restore, single-client, cleanup, and evidence prerequisite remains mandatory before B10 evidence                                                                                                                                                                                                                                                                                                                     | Pass — live                                    |
| Real bounded pool                 | `PooledPostgresFinancialFactProjectionSource` exclusively owns one transferred actual `pg.Pool` resolved through pinned `pg@8.23.0` and `pg-pool@3.14.0`, fixed at maximum two clients with finite acquisition and positive server statement timeouts, canonical application name, no client query timeout, and no pre-existing external lifecycle/error listener ownership; the caller does not use or inspect it during ownership, and only read-only counters may be checked after `source.close()` completes | Pass — source and live                         |
| Trusted immutable inputs          | The complete projection query and exact actor are synchronously copied and validated before checkout; concurrent calls never share a mutable actor snapshot                                                                                                                                                                                                                                                                                                                                                      | Pass — source/local                            |
| Clean checkout and recycle        | Checkout executes idle/session reset, reimplements the exact B9 read-only role/context/B4-query transaction, and repeats postflight reset; only complete success may recycle the client                                                                                                                                                                                                                                                                                                                          | Pass — source/unit/static and live             |
| Failure discard                   | Checkout, adapter, transaction, timeout, and cleanup ambiguity release any acquired client destructively exactly once; active abort waits for the in-flight operation to settle under the fixed server timeout before destructive release; failed or canceled backends are never recycled                                                                                                                                                                                                                        | Pass — source/unit plus live abort/timeout     |
| Sequential reuse                  | After a pre-transfer dirty lease, the first source load reuses the same PID; an out-of-band administrator observes only idle state, canonical application name, session user, and advisory-lock absence, then a subsequent actor-isolated source load and timeout/application-name probes succeed; custom-GUC and prepared-statement cleanup remain source/unit/static `DISCARD ALL` evidence, not direct live inspection                                                                                        | Pass — source/unit/static and reviewed live    |
| Simultaneous isolation            | Barrier-controlled alpha and beta loads occupy two distinct authenticated runtime backends concurrently and each returns only its own reviewed tenant result                                                                                                                                                                                                                                                                                                                                                     | Pass — reviewed live                           |
| Bounded queue                     | Configuration fixes `max: 2`; an out-of-band administrator observes two blocked backend PIDs, a third source load reaches the fixed acquisition bound, and any late checkout is destroyed without a pool/client/backend leak; no during-ownership counter inspection is used                                                                                                                                                                                                                                     | Pass — source/unit and live                    |
| Cancellation boundary             | A pre-aborted signal fails before checkout; aborting a blocked B4 query marks cancellation, awaits operation settlement under the fixed server timeout, then destroys and drains its checkout, returns a stable value-free abort, and permits a replacement backend; queued abort remains finitely acquisition-bounded and destroys any late checkout without claiming prompt queue cancellation                                                                                                                 | Pass — source/unit and live active abort       |
| Server timeout recovery           | A blocked B4 query reaches PostgreSQL `statement_timeout`, returns the stable timeout error, discards the failed backend, drains it, and succeeds through a replacement                                                                                                                                                                                                                                                                                                                                          | Pass — source/unit and live                    |
| Owning close                      | Source/unit evidence shows close rejects new loads, waits for registered work, ends the pool exactly once, and is idempotent; only after close completes may read-only total/idle/waiting counters be checked at zero, while the out-of-band live observer verifies zero application-name backends                                                                                                                                                                                                               | Pass — source/unit and live zero residue       |
| Existing security regressions     | Catalog, RLS, operation-rights, write-denial, B4, B9, migration, backup/restore, and cleanup checks remain green on the reviewed database                                                                                                                                                                                                                                                                                                                                                                        | Pass — live                                    |
| Version 10 evidence contract      | V10 appends the exact B10 check, exact pool source hash and exact runtime pg-pool version, narrows only the completed pool gaps, rejects missing/extra/mixed inputs, and preserves V1-V9                                                                                                                                                                                                                                                                                                                         | Pass — source and reviewed artifact            |
| Local source verification         | Database tests, typechecking, migration and PostgreSQL static guardrails, focused ESLint/Prettier, and diff check pass without making a local live-engine claim                                                                                                                                                                                                                                                                                                                                                  | Pass — 12 files / 485 tests; all local gates   |
| Pinned version 10 live evidence   | A clean dedicated PostgreSQL workflow, reviewed log markers, retained artifact/evidence digests, immutable source hashes, and independent offline review support the bounded B10 claim                                                                                                                                                                                                                                                                                                                           | Pass — run `32161137775`; `offline_consistent` |
| Application, production, and load | Application/API composition, end-user identity, external/TLS transport, managed secrets, external poolers, graceful cancel, prompt queued abort, retry/failover, 1,000-read load, capacity/SLOs, real data, deployment, and production readiness are demonstrated                                                                                                                                                                                                                                                | Out of scope                                   |

## Exit rule

Cycle 1b-b10 is live-complete for this bounded scope because the dedicated
PostgreSQL workflow succeeded from a clean checkout of commit `2dcb259` against
the pinned PostgreSQL image, every pool and inherited cleanup gate passed, and
the version 10 record, reviewed log markers, retained artifact digest, immutable
source hashes, and independent offline review were retained. Installing
`pg-pool`, mocking a pool, racing a promise while PostgreSQL continues work,
recycling an ambiguous checkout, or passing only the single-client B9 suite
would not have satisfied this gate. See the
[B10 evidence note](./POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md).

The resulting claim remains two simultaneous synthetic reads through one
runner-local pool. It does not turn the actor provider into an identity
resolver, the workflow port into a production endpoint, post-settlement
destructive discard into graceful cancellation, or a two-client proof into
production sizing or load evidence.

Cycle 1b-b11 later passed its separate bounded live V11 gate for locked-ledger
validation, exact live checksum-drift refusal, one-time suffix replay, injected
rollback, and two-deployer serialization. Neither B10 nor B11 proves
external or production incremental migrator credentials, arbitrary or
multi-release upgrades, production migration orchestration/recovery/
cancellation/failover, or global platform/application atomicity. See
[ADR 0023](./adr/0023-locked-postgresql-migration-ledger-deployment.md) and the
[Cycle 1b-b11 exit matrix](./CYCLE_1BB11_EXIT_MATRIX.md); the
[B11 evidence note](./POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md) records
the successor's independent anchors without changing this V10 record.

Cycle 1b-b12 later passed its separate authenticated named-index plan and
exactly 2,000-submission result through at most eight runtime workload
backends. It neither changes this V10 record nor turns B10's reviewed two-client
pool into load or capacity evidence. See the
[B12 evidence note](./POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./CYCLE_1BB12_EXIT_MATRIX.md).
