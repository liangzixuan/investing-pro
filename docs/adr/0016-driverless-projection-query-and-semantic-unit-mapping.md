# ADR 0016: Driverless projection query and semantic unit mapping

Status: accepted for Cycle 1b-b4 design; source and live evidence pending

## Context

Cycle 1b-a froze an operation-scoped database-to-core port, and Cycle 1b-a2
froze an all-or-nothing normalizer for a narrow financial-fact wire shape. B2
and b3 proved a bounded authenticated runtime service account and the reviewed
synthetic authorization matrix. No slice has yet executed a production-shaped
projection query or passed its untrusted PostgreSQL output through the
normalizer.

The acceptance fixture currently stores the ambiguous pair `USD` / `USD` for
its two financial facts, while the core distinguishes `USD_MILLIONS` from
`USD_PER_SHARE`. Inferring magnitude from currency alone would create a
material correctness defect. Introducing a driver and pool before the query,
identity direction, unit semantics, encodings, and result bound are frozen
would combine too many trust boundaries.

## Decision

Cycle 1b-b4 is the selected next milestone. It adds one source-controlled,
parameterized, read-only PostgreSQL query and executes it only through the
existing container-local SCRAM runtime acceptance path. The returned rows are
untrusted input to `normalizePostgresFinancialFactRows`.

The query contract is:

- inputs are one listing ID, one public-known cutoff, and one system-recorded
  cutoff, each passed through typed positional parameters;
- display/API, derive/API, and alert/local-alert are rendered from one closed,
  exhaustive operation-to-purpose/channel mapping, never caller strings;
- the acceptance wrapper, not the query, establishes the source-controlled
  principal/organization context inside a transaction after
  `SET LOCAL ROLE research_cockpit_runtime`;
- joins are explicit from listing to share class, security, financial fact,
  evidence, the fact's exact rights-policy version, and the exact
  current-operation grant;
- listing effective/system-recorded and fact public-known/system-recorded
  intervals use half-open predicates, and source availability cannot exceed the
  public-known cutoff;
- every normalizer field has an explicit alias and deterministic primitive/text
  encoding; `SELECT *`, interpolation, hidden counts, denied IDs, row decisions,
  and completeness assertions are forbidden;
- ordering is deterministic; `MAX_POSTGRES_PROJECTION_ROWS` is `100`, the SQL
  requests `LIMIT 101`, and the consumer rejects 101 rows before normalization
  rather than truncating; and
- an empty authorized result is valid, while any malformed, ambiguous, or
  oversized result fails as one value-free batch error.

The closed storage-unit/currency pairs are:

- `USD_MILLIONS` / `USD`;
- `USD_PER_SHARE` / `USD`;
- `MILLIONS_SHARES` / null;
- `PERCENT` / null; and
- `RATIO` / null.

The query emits stored unit and currency values unchanged. The normalizer owns
the allowlist and must reject unknown or mismatched pairs. It may not map
`USD` / `USD` to a core unit. B4 implementation will change only the two
acceptance-fixture fact unit codes from `USD` to the explicitly intended
`USD_MILLIONS`, retaining currency `USD`; the other four pairs remain unit-test
evidence. This fixture correction is not a schema or migration change.

## Evidence contract

Source implementation is not live evidence. A reviewed B4 run must use a new
immutable version 4 success record that:

- preserves every version 1 through version 3 meaning;
- adds `authenticated_financial_fact_projection_query` only after all earlier
  probes, the B4 query/normalization checks, and cleanup succeed;
- adds `projectionQuerySha256` for
  `packages/db/src/postgres-projection-query.ts`, which must own the SQL,
  exhaustive operation mapping, 100/101 bound, raw-result parsing, and
  normalization invocation;
- adds `projectionNormalizerSha256` for the existing
  `packages/db/src/projection-normalization.ts`; the existing
  `acceptanceRunnerSha256` continues to bind authenticated orchestration;
- preserves the exact version 1 through version 3 source-hash key schemas; and
- adds the explicit limitations
  `application_driver_pool_or_composition_root` and
  `complete_dossier_history_timeline_or_dimensioned_projection` while
  retaining every other version 3 limitation.

The version 4 filename and artifact path must be new. A B4 row becomes live
`Pass` only after a clean pinned PostgreSQL 17 run, retained success artifact
and logs, matching byte hashes, and offline review.

## Explicit exclusions

B4 adds no database-driver or other external runtime/development dependency,
manifest dependency change, lockfile change, pool, connection URL, application
or web import, composition-root change, identity resolver, migration,
role/grant change, writer, authenticated test-loader/migrator/backup,
dump/restore, dimensioned or complete-dossier projection, real data, or
production claim. Those remain separate milestones. B5 is reserved for
authenticated test-loader proof.

## Consequences

This ordering produces product-relevant evidence about the actual financial
fact read path before committing to a driver or pool. It also leaves the
current demo and all historical b1-b3 evidence unchanged. A later read-only
adapter can reuse only a query and unit contract that has passed B4; adapter
creation still requires its own client lifecycle and pool/cancellation proof.

## Related decisions

- [ADR 0009: Operation-scoped projections](./0009-operation-scoped-projections.md)
- [ADR 0011: Fail-closed PostgreSQL row normalization](./0011-fail-closed-postgresql-row-normalization.md)
- [ADR 0014: Container-local runtime authentication](./0014-container-local-runtime-authentication.md)
- [ADR 0015: Authenticated runtime authorization matrix](./0015-authenticated-runtime-authorization-matrix.md)
- [Cycle 1b-b4 exit matrix](../CYCLE_1BB4_EXIT_MATRIX.md)
