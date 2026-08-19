# ADR 0024: Bounded PostgreSQL RLS query-plan and 2,000-read load acceptance

Status: accepted; bounded live V12 record retained and reviewed

## Context

The reviewed B4, B9, and B10 results prove one exact financial-fact projection
query, a real single-client adapter, and a bounded two-client pool lifecycle.
They do not prove that PostgreSQL selects the reviewed indexes under forced RLS
or that a finite shared topology can settle a larger submitted workload without
cross-tenant results or residue. B11 separately closes only its exact locked
migration-ledger boundary.

B12 must add a deterministic acceptance-only plan/load probe without turning a
single fixture into a general planner guarantee, treating submitted promises as
database connections, changing application composition, accepting real data,
or claiming production capacity.

## Decision

Add one fixed source module,
`packages/db/src/postgres-query-plan-load.ts`, and one fixed deterministic
fixture, `packages/db/acceptance/query-plan-load-fixture.sql`. The source owns
only the closed B12 query-plan/load contract; it accepts no caller-selected SQL,
planner setting, connection configuration, production endpoint, benchmark
scenario, or fixture.

The live design uses a disposable fixed-name clone,
`research_cockpit_b12_query_load_test`, made from the exact accepted source
database only after the source has zero sessions. The B12 fixture is loaded
only into that clone and followed by `ANALYZE`. The source database must retain
its exact pre-probe fingerprint, and the clone is dropped without `FORCE` after
all clients and backends drain.

The plan contract has two source-controlled shapes:

- the exact existing B4 listing-to-financial-fact projection with the reviewed
  listing, public-known, and system-recorded cutoffs; and
- one tenant thesis read scoped by instrument, with organization scope supplied
  only through transaction-local runtime context and RLS.

Both shapes are explained under the authenticated `NOBYPASSRLS` runtime
capability and through a separately privileged synthetic reference path. The
closed `FORMAT JSON` parser must prove executed index scans using
`financial_facts_as_known` for the large fact fixture and
`theses_by_instrument` for the large tenant fixture, with no sequential scan on
either benchmark relation. B12 must not disable `enable_seqscan`, create a
temporary or replacement index, or infer a production planner guarantee from
the reference comparison.

The bounded load contract creates one fresh ephemeral SCRAM runtime login with
`CONNECTION LIMIT 8` and one runner-owned pool fixed at `max: 8`. Exactly 2,000
read promises—1,000 fact-as-known reads and 1,000 tenant thesis reads—are
submitted before one acceptance barrier releases them. An out-of-band
administrator must observe exactly the first eight B12 application backends
blocked at that barrier. That separately connected administrator is not a
workload client and is outside the runtime login's eight-connection bound. The remaining work is queued through the same bounded
topology; it is not 2,000 connections, 1,000 simultaneous database sessions,
or a production concurrency model.

Every completed read must match the closed Alpha/Beta result and isolation
contract with no failure, cross-tenant row, or partial batch. The pool's pending
checkout and the workload, plan, seed, and `ANALYZE` statements have configured
bounds. Success requires all 2,000 submissions to settle, `pool.end()` to
complete, the observers to close, B12 backends to drain, the login and its
memberships/SCRAM verifier to be removed, the clone to be dropped without
`FORCE`, and zero client, login, backend, application-name, barrier, or clone
residue. Cleanup calls are not each independently cancellable; the workflow's
15-minute job timeout is the outer fail-closed bound.

## Evidence contract

Version 12 preserves every V1 through V11 parser branch, source/tool shape,
check, limitation, record, and historical meaning. It appends only
`authenticated_rls_indexed_query_plans_and_bounded_2000_read_load` and adds
exactly these ordered source hashes:

- `postgresQueryPlanLoadSha256` for
  `packages/db/src/postgres-query-plan-load.ts`; and
- `queryPlanLoadFixtureSha256` for
  `packages/db/acceptance/query-plan-load-fixture.sql`.

V12 retains the exact V11 PostgreSQL, node-postgres, and pg-pool tool fields. It
preserves the complete ordered V11 `notProven` list and inserts only
`thousand_simultaneous_database_backends_or_connections` immediately after
`production_load_capacity_pool_tuning_or_failover`.

The fixed record filename is
`research-cockpit-postgres-acceptance-v12.json`; the workflow artifact name is
`postgres-acceptance-evidence-v12-${{ github.sha }}-${{ github.run_attempt }}`.
The writer remains exclusive-create and success-only, and the offline reviewer
must require both B12 blobs only for V12 while preserving historical review.

Source and integrated local verification alone do not establish any live
PostgreSQL result. PostgreSQL run `32230667908` at commit `59c4e58` executed the
exact bounded plan/load matrix and mandatory cleanup. Its V12 record and exact
logs were retained, and independent commit-bound review returned
`offline_consistent`. See the
[B12 evidence note](../POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md).

## Explicit exclusions

B12 does not prove 1,000 or 2,000 simultaneous database backends or
connections, production load capacity, throughput, latency SLOs, pool sizing or
tuning, retries, failover, or resource saturation behavior. It does not prove
plan stability across other data distributions, statistics, hardware,
PostgreSQL versions, extensions, settings, or schema changes. The synthetic
privileged reference is not an application authorization path and does not
weaken forced RLS for runtime reads.

The result also excludes end-user identity binding, external/TLS transport,
managed secrets, real or licensed data, complete dossiers, application/API
composition, writes, deployment, and production readiness. All V11 migration,
backup/restore, cancellation, identity, composition, and real-data nonclaims
remain in force.

## Consequences

B12 defines one reproducible, reviewed gate for two named-index plan shapes and
2,000 queued synthetic reads through at most eight runtime workload backends.
It does not widen any B1 through B11 record. The existing unassigned
[package-roadmap prerequisite](../../packages/db/README.md) is approval of the
production privacy and retention model for permanent resource identifiers. No
B13 milestone or claim is assigned here.

## Related decisions and primary sources

- [ADR 0012: Success-only PostgreSQL acceptance run record](./0012-success-only-postgresql-run-record.md)
- [ADR 0013: Offline PostgreSQL run-record verification](./0013-offline-postgresql-run-record-verification.md)
- [ADR 0021: Single-client read-only PostgreSQL projection adapter](./0021-single-client-read-only-postgresql-projection-adapter.md)
- [ADR 0022: Bounded PostgreSQL projection-pool lifecycle](./0022-bounded-postgresql-projection-pool-lifecycle.md)
- [ADR 0023: Locked PostgreSQL migration-ledger deployment](./0023-locked-postgresql-migration-ledger-deployment.md)
- [Cycle 1b-b11 exit matrix](../CYCLE_1BB11_EXIT_MATRIX.md)
- [Cycle 1b-b12 exit matrix](../CYCLE_1BB12_EXIT_MATRIX.md)
- [Cycle 1b-b12 evidence note](../POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [PostgreSQL `EXPLAIN`](https://www.postgresql.org/docs/17/sql-explain.html)
- [PostgreSQL planner statistics](https://www.postgresql.org/docs/17/planner-stats.html)
