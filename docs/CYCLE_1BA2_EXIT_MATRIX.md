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

## Deliberately pending

- the SQL query that performs the explicit listing -> share class -> security
  join, enforces a reviewed result-size bound, and emits this exact flat row
  shape;
- a reviewed semantic mapping from stored unit/currency values to core units;
- an authenticated non-owner session, client driver, pool cleanup,
  cancellation, concurrency, and logical restore proof;
- dimensioned facts, complete dossier/history/timeline/evidence projections,
  production identity, vendor data, API writes, and notifications.

Passing this matrix proves only a pure parser contract. It is not live
PostgreSQL evidence and is not a production adapter.

The later Cycle 1b-b1 PostgreSQL acceptance run passed its migration/RLS
harness, but it did not execute this normalizer, a projection query, or an
adapter. The a2 proof boundary therefore remains unchanged.
