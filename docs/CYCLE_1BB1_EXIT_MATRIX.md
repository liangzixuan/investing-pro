# Cycle 1b-b1 exit matrix

Scope: source-controlled live-PostgreSQL acceptance harness. This increment
declares the immutable service image, isolated Ubuntu workflow, and evidence
contract. It does not yet claim a successful local or remote database run.

| Gate                        | Evidence required                                                                                                                                | Current status                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Immutable server            | PostgreSQL 17.11 Bookworm is recorded with one OCI image-index digest in the acceptance declaration and workflow                                 | Pass (static); live image pull pending        |
| Isolated runner             | A separate Ubuntu 24.04 job uses the repository's existing SHA-pinned checkout, pnpm, and Node setup actions                                     | Pass (static); remote execution pending       |
| Network boundary            | The service publishes no host port, exposes no database URL, and is addressed only by its GitHub-provided container ID                           | Pass (static); remote execution pending       |
| Client/server parity        | Acceptance invokes `psql`, `pg_dump`, and `pg_restore` from the pinned service container rather than the runner image                            | Remote execution pending                      |
| Clean bootstrap             | Seven ordered manifest-verified migrations and ledger entries commit atomically; an injected final failure rolls back schemas, roles, and ledger | Probe implemented; remote execution pending   |
| Role contract               | Exact roles/schemas/ACLs/policies/RLS/owners, full constraint type counts plus critical bindings, and exact trigger bindings match the contract  | Probe implemented; remote execution pending   |
| Missing-context fail-closed | No-context reads expose zero runtime-readable rows; null procedure inputs, unsupported purpose, and malformed direct UUID context are rejected   | Probe implemented; remote execution pending   |
| Tenant isolation            | Ordered row identities prove direct-ID, list, join, count, `EXISTS`, scalar-subquery, and alternating prepared-plan isolation                    | Probe implemented; remote execution pending   |
| Sequential session reuse    | All six request settings clear after commit, rollback, and a handled error on one backend; prepared reads alternate two tenant contexts          | Probe implemented; remote execution pending   |
| Cancellation/concurrency    | Cancellation, timeout, simultaneous backends, and application-pool reuse are exercised                                                           | Deferred; not run by the b1 workflow          |
| Logical restore             | A custom-format dump restores into a clean database and post-restore security assertions pass                                                    | Deferred; only tool versions are checked      |
| Capability semantics        | Runtime, seed, and backup reads/writes are probed through ephemeral-superuser impersonation of migration-defined non-login roles                 | Declared limitation; remote execution pending |
| Production session proof    | Least-privileged migration credentials, external authentication, identity mapping, TLS, secrets, and a production pooler are demonstrated        | Out of scope                                  |

## Exit rule

Cycle 1b-b1's implemented gates can be called live-verified only after the
PostgreSQL acceptance workflow succeeds against the declared digest and its
logs are linked to the tested commit. Until then, the harness is an executable
contract and those engine-dependent rows remain pending. Rows explicitly
marked deferred require a future harness extension and cannot be certified by
the current workflow. Static checks, mocks, SQLite, and PGlite are not
substitutes for live evidence.

The current machine cannot execute this gate because it has no PostgreSQL
client/service or container runtime. That environmental limitation does not
change the remote workflow's required assertions and must not be represented as
a passing database result.

Targeted static evidence collected on 2026-08-15: the four acceptance artifacts
parse and satisfy repository formatting, and the clean-room boundary scanner
passes. This evidence validates only the declaration and workflow surface, not
the PostgreSQL-engine assertions.
