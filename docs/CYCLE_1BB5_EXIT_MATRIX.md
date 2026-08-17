# Cycle 1b-b5 exit matrix

Scope: one ephemeral, authenticated, non-owner test-loader login loads the
unchanged synthetic fixture through the existing `NOLOGIN` test-seed
capability inside the isolated PostgreSQL acceptance container. The B5 design
is accepted in [ADR 0017](./adr/0017-authenticated-test-loader-fixture-load.md).
Source implementation and local verification are complete; no pinned live
version 5 evidence exists yet. Historical b1 through b4 evidence remains valid
only for its recorded checks.

| Gate                                    | Evidence required                                                                                                                                                                                                                      | Current status                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Fixture and migration immutability      | All seven migrations and `acceptance/synthetic-fixture.sql` remain byte-for-byte unchanged; the harness accepts only the exact reviewed fixture wrapper and extracts only its enclosed direct-`INSERT` body                            | Pass (source)                        |
| Ephemeral login attributes              | `research_cockpit_test_loader_login` is acceptance-only, `LOGIN`, non-superuser, non-creator, non-replicating, `NOINHERIT`, `NOBYPASSRLS`, connection-limited to one, and has no unsafe role settings or direct application privileges | Implemented; live pending            |
| Exact membership                        | The sole temporary edge grants the existing `research_cockpit_test_seed` capability to the login with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`; no runtime or other edge is added                                                | Implemented; live pending            |
| Container-local SCRAM transport         | The positive client uses run-local credentials, mode-`0600` non-symlink passfiles, the fixed database, and loopback TCP inside the unexposed pinned container; every valid-password call requires SCRAM                                | Implemented; live pending            |
| Wrong-password rejection                | A disposable wrong credential fails through the same TCP path without exposing either credential                                                                                                                                       | Implemented; live pending            |
| Pre-role denial                         | Before explicit role selection, the authenticated login cannot use application schemas, read application relations, execute context routines, or create temporary objects                                                              | Implemented; live pending            |
| Escalation denial                       | The login cannot use `SET SESSION AUTHORIZATION` or switch to owner, runtime, backup, or `postgres`                                                                                                                                    | Implemented; live pending            |
| Atomic rollback                         | One full-body injected failure occurs after all extracted fixture inserts and before commit; fixture relations remain empty and the migration ledger remains unchanged                                                                 | Implemented; live pending            |
| Authenticated identity and load         | In one transaction, `session_user` remains the SCRAM login and `current_user` becomes only `research_cockpit_test_seed` after `SET LOCAL ROLE`; the exact reviewed fixture body loads and role state resets after commit               | Implemented; live pending            |
| Synthetic-only RLS                      | A non-synthetic insert through the authenticated capability is rejected and leaves no row                                                                                                                                              | Implemented; live pending            |
| Mutation, ledger, and DDL denial        | Authenticated update, delete, truncate, migration-ledger read/write, persistent DDL, and temporary DDL attempts all fail closed and leave no residue                                                                                   | Implemented; live pending            |
| Cleanup before catalog checks           | The harness drains the login's backends, removes passfiles, drops the login and thereby its ephemeral edge, and proves zero login, membership, backend, and file residue before the existing zero-membership catalog fingerprint       | Implemented; live pending            |
| Existing acceptance regressions         | Every b1 through b4 migration, fixture, RLS, authenticated-runtime, projection-query, cleanup, and evidence prerequisite remains mandatory                                                                                             | Pass (local); B5 live rerun pending  |
| Version 5 success-only evidence         | A new immutable record appends only `authenticated_test_loader_fixture_load` after all probes and cleanup, binds the current runner plus unchanged fixture, preserves v1-v4 semantics, and passes independent offline review           | Pass (source); live artifact pending |
| Remaining session nonclaims             | Version 5 replaces the combined v4 future-session limitation with exactly `authenticated_migrator_sessions` and `authenticated_backup_sessions`, retaining every other v4 limitation                                                   | Pass (source); live record pending   |
| Production and external authentication  | Production or external database routes, TLS, end-user/external identity, managed secrets, rotation, and secure passfile erasure are demonstrated                                                                                       | Out of scope                         |
| Driver, pool, and concurrency           | A real client/pool proves application lifecycle, simultaneous sessions, reset, cancellation, timeouts, and load                                                                                                                        | Out of scope                         |
| Restore, real data, and application use | Authenticated backup/restore, real or licensed data, ingestion, API/app integration, and deployed operation are demonstrated                                                                                                           | Out of scope                         |
| Authenticated migrator                  | A distinct least-privileged account applies migrations after the PostgreSQL 17 role-bootstrap conflict is redesigned                                                                                                                   | Deferred                             |
| Authenticated backup                    | A distinct backup login creates a bounded logical dump and a restore passes security checks                                                                                                                                            | Deferred                             |

## Exit rule

Cycle 1b-b5 is complete only when every in-scope row above has executable
source, local verification passes, and the dedicated PostgreSQL workflow
succeeds from a clean checkout against the pinned image. The tested commit,
version 5 record, workflow logs, artifact digest, source hashes, and independent
offline review must then be retained and linked in a separate live-evidence
note. ADR acceptance, source code, unit/static tests, or historical b1 through
b4 artifacts cannot satisfy the live exit rule.

Passing B5 permits only this statement: in the recorded run, one ephemeral
non-owner PostgreSQL test-loader login authenticated by SCRAM over
container-local TCP, assumed only the existing synthetic test-seed capability,
and atomically loaded the unchanged reviewed fixture before leaving zero
acceptance-role residue. It does not permit claims about production or external
authentication, TLS, managed secrets, a production loader, concurrent clients,
an authenticated migrator or backup account, restore viability, real data,
application integration, deployed persistence, or production readiness.
