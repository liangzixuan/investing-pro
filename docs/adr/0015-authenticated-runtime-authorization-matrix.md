# ADR 0015: Authenticated runtime authorization matrix

Status: accepted for Cycle 1b-b3 source; first remote execution pending

## Context

Cycle 1b-b1 exercised the complete reviewed synthetic authorization matrix on
PostgreSQL 17.11, but it connected as the ephemeral service-container
administrator and used `SET SESSION AUTHORIZATION` to impersonate the
`NOLOGIN` runtime capability. Cycle 1b-b2 separately proved that one ephemeral
runtime service account could authenticate with SCRAM over container-local TCP,
explicitly assume only that runtime capability, fail closed before role
selection and without context, isolate one alpha-versus-beta read, clear
transaction-local context, and remain unable to write.

Those results leave an explicit evidence gap. The broader direct lookup,
enumeration, join, subquery, inactive-principal, operation-rights, and
alternating prepared-read checks are live evidence only for an impersonated
capability. A successful bounded b2 session does not make them authenticated
session evidence.

The next increment must close that gap without adding a driver, pool, exposed
database port, new database capability, application composition, or production
identity boundary.

## Decision

Cycle 1b-b3 extends only the isolated PostgreSQL acceptance harness. It retains
the b1 impersonated-capability checks as an independent regression boundary and
repeats the finite tenant-isolation and operation-rights assertions that b2
left as an explicit authenticated-session gap while the b2 ephemeral runtime
login and secret-safe passfile are active.

Every authenticated matrix transaction explicitly selects
`research_cockpit_runtime` with transaction-local `SET LOCAL ROLE`. It never
uses `SET SESSION AUTHORIZATION`; `session_user` therefore remains
`research_cockpit_runtime_login`, and role and request settings must clear at
the transaction boundary. The existing login remains `NOINHERIT`, limited to
one connection, and connected by the pinned container's `psql` over loopback
TCP.

The authenticated matrix covers these reviewed synthetic cases already bounded
by b1:

- alpha and beta visibility over the reviewed private and shared relation
  surface, including direct lookup, enumeration, joins, `EXISTS`, scalar
  subqueries, and duplicate tenant-local resource IDs;
- inactive principals and active principals with no current membership,
  expired membership, or future membership;
- the exact display/API, derive/API, and alert/local-alert rights outcomes for
  the source-controlled evidence and financial-fact rows;
- alternating alpha and beta transactions through one prepared statement.

The existing b2 wrong-password, pre-role, role-escalation, identity,
missing-context, transaction-cleanup, and representative write-denial probes
remain mandatory earlier legs of the same acceptance run. B3 does not classify
b1's additional null, malformed, and unsupported-context failure cases as
authenticated-session evidence.

The authenticated and impersonated paths must share the reviewed statements
and expected results rather than maintain divergent copies of the
authorization contract. A b3 result may be recorded only after the complete
authenticated matrix and the existing cleanup/residue checks succeed.

The success-only run-record contract advances to a new immutable schema version
for b3. Historical version 1 and version 2 records retain their original
meanings and remain reviewable. The new record may add an authenticated-runtime
matrix completed check and remove only the corresponding
`full_authenticated_runtime_authorization_matrix` limitation. Every other
limitation remains explicit.

## Source and live-evidence boundary

The b3 source is not live evidence by itself. No b3 row may be marked passed,
and no version 3 record may be cited as engine evidence, until the dedicated
PostgreSQL workflow succeeds from a clean checkout against the pinned image and
the success-only artifact and logs are independently reviewed. Until then, b1
remains the latest live evidence for the comprehensive matrix and b2 remains
the latest live evidence for authenticated runtime behavior.

The offline record verifier may establish only record/source consistency
against independently supplied anchors. It cannot authenticate GitHub,
inspect the database execution, or promote a source-only implementation to a
live result.

## Explicit non-claims

Cycle 1b-b3 remains one sequential, synthetic, container-local service-account
probe. It does not authenticate an end user or bind the database login to the
principal or organization passed to `set_request_context`. It does not prove a
compromised runtime service cannot choose a different synthetic context.

It also does not prove an external or TLS-protected connection, certificate or
channel binding, production secret storage or rotation, a driver or pool,
checkout/reset behavior, cancellation, timeouts, concurrent backends, load,
least-privileged migration, authenticated test loading, authenticated backup,
logical dump/restore, disaster recovery, deployed persistence, real-data
handling, or production readiness. The current migrations, capability roles,
application composition, and network boundary remain unchanged.

## Consequences

Once a reviewed b3 run exists, the project may describe the recorded synthetic
matrix as exercised through one authenticated container-local runtime service
account. That statement still cannot be shortened to “production
authentication,” “tenant identity is verified,” “the application uses
PostgreSQL,” or “pool safety is proven.”

Migrator, test-loader, backup/restore, query/driver, and pool/concurrency work
remain separate increments. In particular, b3 does not weaken migration
`0001`'s zero-membership bootstrap invariant or authorize another capability
login.

## Related decisions

- [ADR 0009: Operation-scoped projections](./0009-operation-scoped-projections.md)
- [ADR 0010: Live PostgreSQL acceptance harness](./0010-live-postgresql-acceptance-harness.md)
- [ADR 0012: Success-only PostgreSQL run record](./0012-success-only-postgresql-run-record.md)
- [ADR 0013: Offline PostgreSQL run-record verification](./0013-offline-postgresql-run-record-verification.md)
- [ADR 0014: Container-local runtime service-account authentication](./0014-container-local-runtime-authentication.md)
- [Cycle 1b-b3 exit matrix](../CYCLE_1BB3_EXIT_MATRIX.md)
