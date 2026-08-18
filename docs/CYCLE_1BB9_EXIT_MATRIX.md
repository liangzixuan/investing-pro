# Cycle 1b-b9 exit matrix

Scope: one non-owning, exclusively leased single-client, read-only PostgreSQL implementation of
`OperationScopedProjectionSource<FinancialFact>`. It injects one trusted
synthetic actor outside the request, reuses the reviewed B4 query and
all-or-nothing normalizer, and executes through an actual pinned
`node-postgres` client. B9 is not a pool, application composition, end-user
identity, external/TLS transport, or production-readiness proof. The design is
accepted in [ADR 0021](./adr/0021-single-client-read-only-postgresql-projection-adapter.md).

Source, local verification, pinned live PostgreSQL execution, retained version
9 evidence, and independent artifact review are complete at commit `8e470e9`.
Historical B1 through B8 evidence remains valid only for its recorded checks.

| Gate                                  | Evidence required                                                                                                                                                                                                                                                                                        | Current status                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Historical evidence preservation      | Version 1 through 8 parser branches, source shapes, checks, limitations, retained records, migrations, fixtures, migration plans, and backup/restore inputs preserve their exact meanings                                                                                                                | Pass — source and live regressions             |
| Exact B8 prerequisite                 | Every B1 through B8 bootstrap, authentication, authorization, projection, loader, migration, backup/restore, cleanup, and evidence prerequisite remains mandatory before B9 evidence                                                                                                                     | Pass — live                                    |
| Real pinned driver                    | `packages/db` pins `pg@8.23.0`, exact development types, lockfile bytes, and the approved MIT notice; the runtime-resolved package version is recorded as `nodePostgres: "8.23.0"`                                                                                                                       | Pass — source and live                         |
| Core port implementation              | `PostgresFinancialFactProjectionSource` implements the exact `OperationScopedProjectionSource<FinancialFact>` contract and returns conservative non-null empty results                                                                                                                                   | Pass — source/local                            |
| Non-owning single-client seam         | The adapter receives only one exclusively leased, already-connected query-capable client plus one synchronous actor provider; the caller owns lifecycle but must issue no direct query or retain a transaction during the lease, and the adapter exposes no connection/configuration/pool/lifecycle seam | Pass — source/local                            |
| Trusted actor boundary                | Principal and organization come only from the constructor-injected provider, whose method is captured once; each exact two-field value is snapshotted before the first await and never comes from the operation query                                                                                    | Pass — source/local                            |
| Mutation-hostile query snapshot       | Scope, operation, territory, and evaluation time are copied and validated before SQL; accessors, inherited/extra fields, malformed cutoffs, unsupported operations, and non-synthetic territory fail before a client call                                                                                | Pass — source/local                            |
| Closed read-only transaction          | Every load first issues `ROLLBACK` to establish idle, then uses exactly `BEGIN READ ONLY`, transaction-local runtime role, one parameterized context call, the unnamed parameterized B4 SELECT in array-row mode, normalization before commit, and one commit                                            | Pass — source and live                         |
| Driver result bridge                  | The driver must report one text field and exact row count; every row is a dense one-string array containing JSON; the 100/101 bound is enforced before value parsing and normalization remains whole-batch                                                                                               | Pass — source and live                         |
| Fail-closed lifecycle                 | Reset failure poisons the instance; after a successful reset, a rejected `BEGIN` or later failure attempts one additional rollback, rollback failure poisons, overlap fails before SQL, and all exposed errors are stable and value-free                                                                 | Pass — source plus live failure/reuse          |
| Loopback-only workflow path           | The PostgreSQL service exposes exactly one random host port bound to `127.0.0.1`; only the dynamic target-5432 mapping and exact loopback host reach the acceptance runner, with no database URL or other published port                                                                                 | Pass — live                                    |
| Real SCRAM client identity            | Wrong-password login fails; the accepted client uses the ephemeral runtime login, fixed application name, non-TLS runner path, one stable backend, and exact SCRAM `system_user`                                                                                                                         | Pass — live                                    |
| Live authorization and isolation      | One real client executes display/API, derive/API, alert/local-alert, missing listing, pre-cutoff, inactive principal, no current membership, alpha/beta/alpha reuse, and cross-tenant mismatch cases with exact normalized results                                                                       | Pass — live                                    |
| Live read-only and cleanup            | The real backend proves a pre-existing read-write canary is rolled back rather than committed, observes read-only state inside the adapter's actual B4 transaction, denies mutation, cleans role/context after success and injected rollback, closes/drains, and leaves zero runtime-login residue       | Pass — live                                    |
| Version 9 evidence contract           | V9 appends only `authenticated_single_client_read_only_financial_fact_projection_adapter`, narrows only the application-driver limitation, adds the four exact source hashes and exact node-postgres tool version, and rejects missing, extra, or mixed-version inputs while retaining V1–V8             | Pass — source/local                            |
| Local source verification             | All 450 tests across the 11 database test files, database typechecking, static PostgreSQL and migration guardrails, focused ESLint/Prettier, and the diff check pass; no local live PostgreSQL claim follows                                                                                             | Pass — local                                   |
| Pinned version 9 live evidence        | A clean dedicated PostgreSQL workflow, exact logs, retained artifact/evidence digests, immutable source hashes, and independent offline review support the bounded B9 claim                                                                                                                              | Pass — run `32083732063`; `offline_consistent` |
| Pool, app, production, and broad data | Pool checkout/reset, concurrent backends, cancellation/timeouts, app/API composition, end-user identity, external/TLS transport, managed secrets, complete dossiers, real data, deployment, and production readiness are demonstrated                                                                    | Out of scope                                   |

## Exit rule

Cycle 1b-b9 is live-complete for this bounded scope because the dedicated
PostgreSQL workflow succeeded from a clean checkout of commit `8e470e9` against
the pinned PostgreSQL image, every real-driver and cleanup gate passed, and the
version 9 record, reviewed log markers, artifact digest, expanded source hashes,
and independent offline review were retained. Source presence, unit tests, an
installed-but-unused driver, the historical driverless B4 result, or an adapter
exercised only with a fake client would not have satisfied the live row. See the
[B9 evidence note](./POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md).

The resulting claim remains one sequential synthetic client. It does not
promote the trusted actor provider into an identity resolver, the temporary
loopback mapping into an application port, fail-fast overlap rejection into
concurrency support, or the transitive `pg-pool` package into an application
pool. The bounded pool/concurrency/cancellation proof is the separate successor,
Cycle 1b-b10.

ADR 0022 and the
[B10 evidence note](./POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md) now record
that successor's real, bounded two-client pool source and reviewed V10 result.
None of that successor work changes this matrix or widens the reviewed B9
claim. B11 migration-ledger locking, checksum-drift, and concurrent deployment
is next.
