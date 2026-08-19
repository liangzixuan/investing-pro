# ADR 0021: Single-client read-only PostgreSQL projection adapter

Status: accepted and live-reviewed for the bounded Cycle 1b-b9 scope

## Context

Cycle 1b-a froze `OperationScopedProjectionSource<FinancialFact>`. Cycle 1b-a2
added an all-or-nothing PostgreSQL row normalizer, and B4 later proved the exact
driverless listing-to-security query through authenticated PostgreSQL. Those
milestones intentionally stopped before a database driver. B9 must exercise the
same contract through a real Node PostgreSQL client without introducing a pool,
an application composition root, or request-controlled tenant identity.

The core query contains scope, operation, territory, and a trusted evaluation
time. It deliberately contains no principal or organization. Those values must
come from a separate trusted actor boundary. The current proof remains
synthetic: an injected actor is not an end-user identity resolver, and
`evaluatedAt` is not a PostgreSQL authorization clock.

## Decision

Add `PostgresFinancialFactProjectionSource` in
`packages/db/src/postgres-projection-adapter.ts`. The class implements the core
operation-scoped source over one exclusively leased, already-connected
`pg.Client` query seam. It is non-owning: it accepts no host, port, database
URL, username, password, environment, client factory, pool, logger, or
lifecycle callback. The caller owns connection and disconnection but must not
issue direct queries or retain a transaction during the adapter lease. B9 pins
the exact runtime dependency
`pg@8.23.0` and development types `@types/pg@8.20.0`; neither the API nor web
application imports the database package.

A synchronous constructor-injected provider supplies one trusted synthetic
principal and organization. The provider method is captured at construction,
then its exact two-field value and the complete projection query are copied and
validated before the first asynchronous database call of every load. Caller
mutation, accessors, inherited fields, extra tenant fields, malformed UUIDs,
unsupported operations, non-synthetic territory, or invalid cutoff times fail
before SQL.

Each successful load uses the same client and exactly one fixed transaction:

1. acquire an instance-local one-in-flight guard;
2. issue `ROLLBACK` to establish a known-idle transaction boundary even if the
   caller accidentally left a read-write transaction open;
3. `BEGIN READ ONLY`;
4. `SET LOCAL ROLE research_cockpit_runtime`;
5. call `private_data.set_request_context` with six bound values: the trusted
   actor, the closed operation-to-purpose/channel tuple, `demo_only`, and
   `synthetic`;
6. execute the unchanged B4 query as an unnamed, parameterized, array-row-mode
   query with only listing ID, public-known cutoff, and system-recorded cutoff;
7. validate and parse the exact one-text-column driver result and run the B4
   row bound and all-or-nothing normalizer while the transaction is open; and
8. commit only after normalization succeeds.

An empty authorized result remains a non-null conservative source result with
`unknown/rls_filtered` completeness. A driver, transaction, result-shape,
parsing, or normalization failure returns only the stable value-free adapter
error. Failure of the initial reset poisons the instance because an idle state
cannot be established. After a successful reset, an ambiguous or rejected
`BEGIN` and every later failure attempt exactly one additional rollback. A
rollback failure poisons the adapter instance, and every later load fails before
using the client. An overlapping load likewise fails before sending SQL; this
is rejection of unsupported concurrency, not concurrency support.

PostgreSQL membership, grants, policies, and RLS continue to use transaction
time. The query's `evaluatedAt` is retained for the core rights decision and
cutoff validation but is not written into PostgreSQL request context and must
not be interpreted as historical database authorization.

## Live acceptance boundary

The dedicated PostgreSQL workflow maps the pinned service container's port to
one randomly assigned host port bound only to `127.0.0.1`. The acceptance step
receives exactly that loopback address and the GitHub-generated mapping; it
does not receive a database URL. This is a runner-internal test path, not an
external or production transport claim.

Inside the existing ephemeral runtime-login lifetime, the harness must use one
actual `pg.Client` with explicit synthetic database, login, run-local password,
non-TLS setting, and fixed application name. It must prove wrong-password SCRAM
rejection, one stable backend, rollback of a deliberately pre-existing
read-write transaction without committing its canary, read-only state observed
inside the adapter's actual B4 query transaction, runtime-role and
request-context selection, all reviewed operation results, empty and denied
results, alpha/beta/alpha context replacement, cross-tenant mismatch denial,
injected adapter rollback, post-transaction role/context cleanup, value-free
failure, client close, backend drain, and the existing login cleanup before
success-only evidence.

The driverless B4 path remains a regression prerequisite. A fake executor or
an installed-but-unused driver cannot satisfy B9.

## Evidence contract

Version 9 preserves the exact version 1 through 8 parser branches and meanings.
It appends only
`authenticated_single_client_read_only_financial_fact_projection_adapter`,
replaces only `application_driver_pool_or_composition_root` with the narrower
`application_pool_or_composition_root`, and retains every other version 8
limitation in order.

The version 9 source bundle adds exact hashes for the adapter, the core
operation-projection contract, `packages/db/package.json`, and
`pnpm-lock.yaml`. Its tool versions add exact `nodePostgres: "8.23.0"` while
historical tool-version shapes remain unchanged. The current record is
`research-cockpit-postgres-acceptance-v9.json`; the workflow artifact is
`postgres-acceptance-evidence-v9-${sha}-${attempt}`.

Source and local tests alone are not live evidence. The required clean pinned
workflow passed in PostgreSQL run `32083732063` at commit `8e470e9`. Its
commit-bound artifact, exact log markers, and immutable source hashes were
reviewed after mandatory cleanup, and the downloaded version 9 record returned
`offline_consistent`. See the
[B9 evidence note](../POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md).

## Explicit exclusions

B9 does not prove an end-user identity or tenant resolver, production BOLA
protection, external connectivity, TLS, managed secret storage or rotation,
connection pooling, simultaneous backends, queued concurrency, cancellation,
timeouts, retry or reconnect behavior, failover, load capacity, application or
API composition, write persistence, complete dossier projection, dimensioned
units, real or licensed data, deployment, or production readiness.

The acceptance workflow's temporary loopback mapping is not an application
port and is not retained after the job. The transitive presence of
`pg-pool` inside the `pg` package is not use or proof of an application pool.

## Consequences

B9 establishes the first real database-driver implementation of the frozen
operation-scoped read port while keeping identity, connection ownership, and
application composition outside the adapter. The separate bounded Cycle 1b-b10
pool/concurrency/cancellation source and live V10 result are reviewed under ADR
0022; that successor does not widen B9. B11 later passed its separate bounded
live locked-ledger and two-deployer result; it also does not widen B9.
B12 later passed its separate bounded live two-plan and 2,000-submission
result; it likewise does not widen B9. Application
composition, production identity, external TLS, and managed secrets remain
later work.

## Related decisions and primary sources

- [ADR 0009: Operation-scoped projections](./0009-operation-scoped-projections.md)
- [ADR 0011: Fail-closed PostgreSQL row normalization](./0011-fail-closed-postgresql-row-normalization.md)
- [ADR 0016: Driverless projection query and semantic unit mapping](./0016-driverless-projection-query-and-semantic-unit-mapping.md)
- [ADR 0020: Authenticated policy-scoped data backup and bounded clean restore](./0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
- [Cycle 1b-b9 exit matrix](../CYCLE_1BB9_EXIT_MATRIX.md)
- [Cycle 1b-b9 evidence note](../POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md)
- [ADR 0022: Bounded PostgreSQL projection-pool lifecycle](./0022-bounded-postgresql-projection-pool-lifecycle.md)
- [Cycle 1b-b10 exit matrix](../CYCLE_1BB10_EXIT_MATRIX.md)
- [Cycle 1b-b10 evidence note](../POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md)
- [ADR 0024: Bounded PostgreSQL RLS query-plan and 2,000-read load acceptance](./0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
- [Cycle 1b-b12 exit matrix](../CYCLE_1BB12_EXIT_MATRIX.md)
- [Cycle 1b-b12 evidence note](../POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md)
- [node-postgres queries](https://node-postgres.com/features/queries)
- [node-postgres transactions](https://node-postgres.com/features/transactions)
- [GitHub Actions PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
