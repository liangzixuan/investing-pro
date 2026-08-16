# Cycle 1b-b1 exit matrix

Scope: source-controlled live-PostgreSQL acceptance harness. This increment
declares the immutable service image, isolated Ubuntu workflow, executable
probes, and a success-only run-record contract. Its first reviewed remote run
and offline artifact review are recorded in the
[evidence note](./POSTGRESQL_ACCEPTANCE_EVIDENCE.md).

| Gate                        | Evidence required                                                                                                                                | Current status                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Immutable server            | PostgreSQL 17.11 Bookworm is recorded with one OCI image-index digest in the acceptance declaration and workflow                                 | Pass for reviewed run; resolved child manifest not proven      |
| Isolated runner             | A separate Ubuntu 24.04 job uses the repository's existing SHA-pinned checkout, pnpm, and Node setup actions                                     | Pass for reviewed run                                          |
| Network boundary            | The service publishes no host port, exposes no database URL, and is addressed only by its GitHub-provided container ID                           | Pass for reviewed run                                          |
| Client/server parity        | Acceptance invokes `psql`, `pg_dump`, and `pg_restore` from the pinned service container rather than the runner image                            | Pass for reviewed run                                          |
| Clean bootstrap             | Seven ordered manifest-verified migrations and ledger entries commit atomically; an injected final failure rolls back schemas, roles, and ledger | Pass for reviewed run                                          |
| Role contract               | Exact roles/schemas/ACLs/policies/RLS/owners, full constraint type counts plus critical bindings, and exact trigger bindings match the contract  | Pass for reviewed run                                          |
| Missing-context fail-closed | No-context reads expose zero runtime-readable rows; null procedure inputs, unsupported purpose, and malformed direct UUID context are rejected   | Pass for reviewed run                                          |
| Tenant isolation            | Ordered row identities prove direct-ID, list, join, count, `EXISTS`, scalar-subquery, and alternating prepared-plan isolation                    | Pass for reviewed run                                          |
| Sequential session reuse    | All six request settings clear after commit, rollback, and a handled error on one backend; prepared reads alternate two tenant contexts          | Pass for reviewed run; no application pool                     |
| Cancellation/concurrency    | Cancellation, timeout, simultaneous backends, and application-pool reuse are exercised                                                           | Deferred; not run by the b1 workflow                           |
| Logical restore             | A custom-format dump restores into a clean database and post-restore security assertions pass                                                    | Deferred; only tool versions are checked                       |
| Capability semantics        | Runtime, seed, and backup reads/writes are probed through ephemeral-superuser impersonation of migration-defined non-login roles                 | Pass for impersonated roles; authenticated sessions not proven |
| Run-to-commit binding       | After all probes pass, an exact-schema record binds the checkout SHA, GitHub run/attempt, reviewed inputs, observed versions, checks, and limits | Pass for run `31961988213`, attempt 1                          |
| Failure/stale-file safety   | No record is written after a failed probe; the fixed runner-temp file is exclusive-create and the workflow uploads it only on success            | Pass in source/tests; success-only upload observed             |
| Offline record consistency  | Canonical artifact bytes match independent hash/run/repository anchors and fixed source/migration blobs at the explicit Git commit               | Pass: `offline_consistent` for retained artifact               |
| Production session proof    | Least-privileged migration credentials, external authentication, identity mapping, TLS, secrets, and a production pooler are demonstrated        | Out of scope                                                   |

## Exit rule

Cycle 1b-b1's implemented gates can be called live-verified only after the
PostgreSQL acceptance workflow succeeds against the declared digest and its
success-only run record and logs are linked to the tested commit. The record
must parse against the exact source-controlled schema and its source hashes
must match that commit. Until then, the harness is an executable contract and
those engine-dependent rows remain pending. Merely implementing or unit-testing
the record cannot change an engine row to Pass. Rows explicitly marked deferred
require a future harness extension and cannot be certified by the current
workflow. That rule is satisfied for the implemented rows at `611c93d` by run
`31961988213`, attempt 1. Static checks, mocks, SQLite, and PGlite remain
unacceptable substitutes for later live gates.

After download, the offline verifier must be given the expected artifact hash,
repository name and ID, commit, run ID, and run attempt from independently
reviewed run information. Its `offline_consistent` verdict establishes only
that those anchors, canonical record bytes, reviewed target, and committed
source/migration hashes agree. It does not authenticate GitHub, inspect the
workflow logs, prove database execution, validate a commit signature or branch,
or establish where the supplied anchors came from.

The current machine cannot execute this gate because it has no PostgreSQL
client/service or container runtime. That environmental limitation does not
change the remote workflow's required assertions and must not be represented as
a passing database result.

Targeted static evidence collected on 2026-08-15 established the declaration
and workflow surface. On 2026-08-16, the linked clean-checkout workflow passed
against PostgreSQL 17.11, uploaded one success record, and the downloaded JSON
matched its independently supplied byte hash and committed sources. This does
not promote any deferred or out-of-scope row.

The run record is deliberately small and secret-free. It is not signed, does
not identify the resolved platform child image, and is not an archival or
compliance guarantee. Review it together with the immutable commit and GitHub
run; do not trust a pull-request artifact solely because it matches the JSON
schema.
