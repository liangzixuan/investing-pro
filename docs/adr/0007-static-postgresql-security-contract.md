# ADR 0007: Static PostgreSQL security contract

Status: accepted for Cycle 1a; live execution pending

PostgreSQL schema evolution is represented as ordered, transaction-wrapped raw
SQL with an immutable SHA-256 manifest. No ORM, migration runtime, database
driver, or emulator is added in this increment. Static checks reject destructive
forward SQL, public grants, RLS disablement, unreviewed definer functions,
checksum drift, missing tenant keys, and missing `ENABLE`/`FORCE ROW LEVEL
SECURITY` clauses.

Shared research data and organization-private product data use separate schemas.
Runtime access is a non-login, non-owner, `NOBYPASSRLS` read-only capability
role. Request context is accepted only through typed parameters and stored with
transaction-local `set_config(..., true)` values. Missing or malformed context
fails closed.

The SQL remains an unexecuted contract until a pinned real PostgreSQL service
proves syntax, roles, RLS, context cleanup, concurrent tenant isolation,
migration replay, and logical restore. PGlite, SQLite, and mocks are not accepted
as that security evidence.

Adapter composition is also pending. A transaction context currently represents
one purpose/channel decision, while a dossier can require display, derive, and
local-alert authorization. Cycle 1b must define that operation-aware evaluation
and an RLS-aware completeness signal before treating SQL-visible rows as a
complete research snapshot.
