# ADR 0011: Fail-closed PostgreSQL projection-row normalization

Status: accepted for Cycle 1b-a2; separate B4 query-to-normalizer live proof
reviewed; separate B9 adapter result live-reviewed

The operation-scoped core port accepts already typed candidates. A database
driver, however, returns untrusted runtime values whose timestamp precision,
decimal representation, identity joins, and enums cannot be established by
TypeScript. Passing those rows directly to core would silently widen the trust
boundary.

The database package therefore owns a pure normalizer for one narrow shape: a
flat, dimensionless synthetic financial-fact row joined to its exact policy
and the one grant for the requested operation. The query must emit the decimal,
dates, timestamps, and JSON as text; timestamp expressions must explicitly
produce zoned RFC 3339 rather than relying on PostgreSQL's display format.
Scale remains a bounded integer and the grant remains boolean. The normalizer
accepts `unknown`, requires plain data records with an exact key set, rejects
the entire batch on any invalid row, and reports only one stable, value-free
error. It never drops a row, rounds a value, uses JavaScript numbers for
financial amounts, accepts a completeness claim, or returns a partial result.

The normalized result copies the validated request scope and operation and
always marks source completeness `unknown` with reason `rls_filtered`.
Candidate and policy ordering is deterministic. Policy, grant, and fact
policy-reference echoes must agree exactly; repeated policy metadata must also
agree. The current-operation grant must be explicit and allowed.

`instrument_id` in this wire shape means the requested listing ID, produced by
an explicit listing -> share class -> security join. `security_id` remains a
separate required field and is never substituted for the core instrument ID or
a ticker. This froze the identity direction before B4 implemented the separate
driverless query; no database adapter existed at the a2 boundary.

Only values the current core can represent are accepted. Timestamps must be
losslessly convertible to millisecond UTC, intervals are half-open, source
availability precedes public knowledge and system recording, and each row must
be active at both independent request cutoffs. Decimal text is bounded by
`numeric(38,12)` and its declared scale without rounding. Quality and unit
values use exact core enums. Currency-bearing units require USD; non-currency
units require null currency. Dimensions must be exactly `{}`. Quarantined,
dimensioned, unknown-unit, or semantically ambiguous rows fail closed.

This a2 decision did not add a driver, SQL query, pool, credentials, API route,
migration, or composition-root wiring. B4 later added a separate driverless
query, corrected only the two acceptance-fixture facts to explicit
`USD_MILLIONS`, and enforced a 100/101 result bound while preserving rejection
of ambiguous `USD` / `USD`. General dimensions, complete dossiers,
history/timeline persistence, a database driver, and composition wiring remain
later work.

The later Cycle 1b-b1 through b3 PostgreSQL runs did not execute this normalizer
or a projection query and do not change this decision's proof boundary. B4 now
has a separate reviewed live query-to-normalizer path; it does not retroactively
widen a2 or prove an application adapter.

Cycle 1b-b9 later reuses this unchanged all-or-nothing boundary inside a
separate single-client read-only adapter. Its pinned live version 9 result
passed in run `32083732063`. B9 does not retroactively widen a2, and general
dimensions, complete dossiers, app composition, and pooling remain outside this
ADR. See
[ADR 0021](./0021-single-client-read-only-postgresql-projection-adapter.md).
