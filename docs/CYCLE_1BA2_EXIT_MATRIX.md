# Cycle 1b-a2 exit matrix

Scope: disconnected normalization of synthetic financial-fact PostgreSQL wire
rows only. No driver, query, pool, database connection, app import, or real data
was added.

| Gate                  | Evidence                                                                                                                            | Status |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Fail-closed batch     | Input is `unknown`; exact plain data rows are all accepted or the entire batch raises one value-free stable error                   | Pass   |
| Identity              | Listing and security IDs are separate; the requested listing must match every row and security IDs are never treated as instruments | Pass   |
| Exact authorization   | Fact, policy, and grant policy references match; one exact operation grant is required; repeated policy metadata is consistent      | Pass   |
| Temporal semantics    | Gregorian dates, lossless zoned RFC 3339 conversion, half-open intervals, causal ordering, and both independent cutoffs are checked | Pass   |
| Decimal semantics     | Decimal text only, `numeric(38,12)` bounds, declared scale, zero-only discarded digits, and no exponent/rounding are enforced       | Pass   |
| Representable subset  | Synthetic, dimensionless, non-quarantined facts with exact unit/currency semantics are the only accepted rows                       | Pass   |
| Side-channel boundary | Source completeness is always unknown/RLS-filtered; input cannot contain counts, denied IDs, row decisions, or completeness claims  | Pass   |
| Determinism           | Candidate/policy ordering and normalized UTC/decimal output are deterministic and independent of input mutation                     | Pass   |
| Current runtime scope | Database and core modules are not imported by the API or web composition roots; the SYN1 fixture path is unchanged                  | Pass   |
| Dependency surface    | One internal workspace dependency only; no external package or install script was added                                             | Pass   |

## Later gates

- Cycle 1b-b4 source now contains the SQL query that performs the explicit listing
  -> share class -> security join, enforces a reviewed result-size bound, emits
  this exact flat row shape, and applies the closed stored-unit/currency mapping;
  its pinned live execution and version 4 artifact review later passed for a
  separate recorded scope;
- b2/b3 completed a bounded authenticated non-owner runtime service-account
  path; B8 later proved only one bounded policy-scoped same-cluster restore and
  B9 later proved only one live-reviewed single-client adapter; application
  identity/tenant resolution, app composition, pool cleanup, cancellation,
  concurrency, and broad restore remain pending;
- dimensioned facts, complete dossier/history/timeline/evidence projections,
  production identity, vendor data, API writes, and notifications.

Passing this matrix proves only a pure parser contract. It is not live
PostgreSQL evidence and is not a production adapter.

The later b1-b3 PostgreSQL acceptance runs passed their recorded migration,
RLS, service-account, and authorization checks, but they did not execute this
normalizer, a projection query, or an adapter. The a2 proof boundary remains
unchanged. B4 later passed a separate live query-to-normalizer proof, B8 later
passed one bounded policy-scoped same-cluster restore, and B9 later passed one
single-client adapter proof. None retroactively widens a2 or proves application
composition, pooling, concurrency/cancellation, broad restore, or production
readiness.
