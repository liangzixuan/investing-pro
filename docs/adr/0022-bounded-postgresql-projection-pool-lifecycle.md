# ADR 0022: Bounded PostgreSQL projection-pool lifecycle

Status: accepted and live-reviewed for the bounded Cycle 1b-b10 scope

## Context

Cycle 1b-b9 proved the operation-scoped financial-fact projection through one
real, exclusively leased `pg.Client`. It deliberately did not prove pool
checkout, simultaneous backends, bounded waiting, cancellation, timeout
recovery, or pool shutdown. Merely installing `pg-pool`, returning a client
after an ambiguous error, or racing a promise while PostgreSQL continues work
would not close those gaps.

B10 must exercise a real, bounded pool without moving connection settings,
credentials, end-user identity, or application composition into the database
package. The proof remains a synthetic, loopback-only acceptance boundary.

## Decision

Add `PooledPostgresFinancialFactProjectionSource` in
`packages/db/src/postgres-projection-pool.ts`. The source owns one explicitly
transferred real `pg.Pool` and accepts the same synchronous trusted-actor
provider as B9. It implements the existing one-argument projection source port
and permits an optional `AbortSignal` only on its concrete method. The pool is
closed over exactly two clients, a finite positive `connectionTimeoutMillis`, a
finite positive PostgreSQL `statement_timeout`, the canonical application name,
and no client-side `query_timeout`. Ownership rejects pre-existing pool
lifecycle/error listeners that could observe or mutate checkouts outside the
source, then installs only its owned idle-error listener.

Every load snapshots and validates the complete operation query and actor
before its first await; a pre-aborted signal fails before checkout. After
checkout, it establishes a clean session with `ROLLBACK` and `DISCARD ALL`,
restores the canonical application name and session statement timeout, and
reimplements rather than delegates the exact B9 transaction: `BEGIN READ ONLY`,
transaction-local statement timeout and runtime role, the six-field request
context call, the unchanged B4 array-row-mode query, normalization before
`COMMIT`, then the idle/session reset again. Only a fully successful transaction
and postflight reset may call normal `release()`.

Any checkout ambiguity, adapter failure, statement timeout, failed transaction,
or cleanup failure destroys the checkout with an error release. An active abort
marks cancellation, lets the in-flight PostgreSQL operation settle under the
fixed server statement timeout, and only then destroys the checkout; it never
returns while server work is knowingly continuing. A queued abort cannot make
`pg-pool.connect()` itself cancellable,
so the bounded acquisition must settle and any late checkout is destroyed.
That is intentionally not a prompt queued-cancellation claim. B10 does not use
`Promise.race`, client `query_timeout`, or an undocumented cancel API as proof
that PostgreSQL work stopped.

`close()` atomically rejects new work, waits for all source-owned loads to
settle, removes its pool listener, and ends the transferred pool exactly once.
Repeated close calls are idempotent. No caller may issue queries or end the pool
after transferring ownership; it also may not call `connect()` or release a
client, inspect counters, or otherwise use the pool while the source owns it.
Only read-only pool counters may be inspected after `source.close()` completes.
Construction is the exclusive ownership boundary.

## Live acceptance boundary

After the versioned B7 database and inherited regressions are complete, and
before B8 backup/restore, the dedicated PostgreSQL harness provisions one fresh
ephemeral runtime login and one actual `pg.Pool` with maximum size two. The B10
suite executes once, not once per historical regression lane.

The live suite must prove:

- wrong-password and bounded checkout failures are stable and value-free;
- after a pre-transfer dirty lease, the first source load safely reuses that
  same PID; an out-of-band administrator observes it idle under the canonical
  application name and session user with no advisory lock, and a subsequent
  actor-isolated source load plus timeout/application-name probes succeed;
- two barrier-controlled alpha and beta loads occupy two distinct backends at
  the same time and return only their own tenant-visible results;
- with configuration fixed at `max: 2`, an out-of-band administrator sees two
  blocked backend PIDs and a third source load reaches the fixed acquisition
  bound without leaking a later checkout;
- an active abort marks cancellation, waits for the in-flight operation to
  settle under the fixed server timeout, then destroys and drains its backend,
  and a replacement client succeeds;
- PostgreSQL `statement_timeout` yields the reviewed timeout failure, destroys
  that backend, and a replacement client succeeds;
- failed transactions are never recycled; and
- idempotent close is proved at source/unit level; only after close completes
  may the runner read the ended pool's total/idle/waiting counters, which must be
  zero. The out-of-band live observer sees zero application-name backends, and
  the ephemeral login, memberships, and passfiles are also zero before evidence.

The runner performs no direct `connect()`, client query, client release, `end()`,
counter read, or other pool inspection while the source owns the pool.
Custom-GUC and prepared-statement cleanup are proved by the exact source
sequence plus unit/static assertions for `DISCARD ALL`; they are not directly
inspected through the transferred pool in the live run.

The driverless B4 and real single-client B9 paths remain prerequisites. Two
simultaneous synthetic reads are a bounded concurrency result, not a load or
capacity test.

## Evidence contract

Version 10 preserves the exact version 1 through 9 parser branches and
meanings. It appends only
`authenticated_bounded_pool_lifecycle_concurrency_cancellation_and_timeout_recovery`,
records runtime `nodePostgresPool: "3.14.0"`, and adds
`postgresProjectionPoolSha256` for the exact bytes of
`packages/db/src/postgres-projection-pool.ts`.

The current evidence filename becomes
`research-cockpit-postgres-acceptance-v10.json`; the workflow artifact becomes
`postgres-acceptance-evidence-v10-${sha}-${attempt}`. The V10 limitations keep
production identity, TLS, secrets, application composition, load sizing,
failover, prompt queued abort, graceful cancel-request, reusable canceled
backends, and all other historical nonclaims explicit.

Specifically, V10 replaces only the three completed V9 pool-shaped limitations:
`production_identity_tls_secrets_or_pooling` becomes
`production_identity_tls_secrets_or_load_ready_pooling`,
`concurrent_sessions_cancellation_or_timeouts` becomes
`production_load_capacity_pool_tuning_or_failover`, and
`application_pool_or_composition_root` becomes
`application_composition_root`. It also inserts
`prompt_queued_abort_graceful_cancel_request_or_reusable_canceled_backend`.
Every other V9 limitation remains exact and ordered.

Source and local verification pass all 12 database test files and 485 tests,
database typechecking, migration and PostgreSQL static guardrails, focused
ESLint/Prettier, and the diff check. Independent integrated review reports GO
with no P0/P1 finding. The settled pool source SHA-256 is
`257e2ab0a0a245c6385f8eddf6d44973dbddbb9cd6fc6a4b089cb0867aefa5e8`; the
acceptance runner SHA-256 is
`1f04e46a73deb32c1bfc74df1c91ae8d33fc9046c794c852fae82e0325d6ac5b`.
These source/local results alone are not live evidence. The separate pinned
workflow passed in run `32161137775` at commit `2dcb259` after mandatory
cleanup; the success-only V10 artifact and log markers were retained, and the
independent commit-bound reviewer returned `offline_consistent`. See the
[B10 evidence note](../POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md).

## Explicit exclusions

B10 does not prove an end-user identity or tenant resolver, production BOLA,
external connectivity, TLS, managed secrets or rotation, an external pooler,
application/API composition, retries, reconnect or failover policy, graceful
PostgreSQL CancelRequest, prompt abort while queued, reuse of a canceled
backend, production pool tuning, load capacity or SLOs, 1,000 concurrent reads,
writes, complete dossiers, real data, deployment, or production readiness.

## Consequences

B10 closes only the bounded two-client lifecycle, simultaneous synthetic
isolation, settlement-before-discard cancellation, server-timeout recovery, and
zero-residue pool gate. Cycle 1b-b11 later passed its separate bounded live V11
gate for locked-ledger validation, exact live-drift refusal, once-only suffix
replay, injected rollback, and two-deployer serialization. External or
production incremental migrator
credentials, arbitrary or multi-release upgrades, production migration
orchestration/recovery/cancellation/failover, and global platform/application
atomicity are not inferred from B10 or B11. See
[ADR 0023](./0023-locked-postgresql-migration-ledger-deployment.md) and the
[Cycle 1b-b11 exit matrix](../CYCLE_1BB11_EXIT_MATRIX.md).

## Related decisions and primary sources

- [ADR 0021: Single-client read-only PostgreSQL projection adapter](./0021-single-client-read-only-postgresql-projection-adapter.md)
- [Cycle 1b-b9 exit matrix](../CYCLE_1BB9_EXIT_MATRIX.md)
- [Cycle 1b-b10 exit matrix](../CYCLE_1BB10_EXIT_MATRIX.md)
- [Cycle 1b-b10 evidence note](../POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md)
- [ADR 0023: Locked PostgreSQL migration-ledger deployment](./0023-locked-postgresql-migration-ledger-deployment.md)
- [Cycle 1b-b11 exit matrix](../CYCLE_1BB11_EXIT_MATRIX.md)
- [Cycle 1b-b11 evidence note](../POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md)
- [node-postgres pools](https://node-postgres.com/features/pooling)
- [node-postgres transactions](https://node-postgres.com/features/transactions)
- [PostgreSQL 17 client connection defaults](https://www.postgresql.org/docs/17/runtime-config-client.html)
