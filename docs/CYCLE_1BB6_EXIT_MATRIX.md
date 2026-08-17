# Cycle 1b-b6 exit matrix

Scope: one ephemeral, authenticated, non-owner login assumes only the existing
owner capability and exercises a fixed transactional DDL canary after the
unchanged historical bootstrap. B6 is a preparatory boundary, not a migration
or deployment proof. The design is accepted in
[ADR 0018](./adr/0018-authenticated-owner-ddl-canary.md).

Source implementation, the pinned live run, and independent version 6 review
are complete for the exact scope recorded in the
[B6 evidence note](./POSTGRESQL_OWNER_DDL_EVIDENCE.md). Historical b1 through
b5 evidence remains valid only for its recorded checks.

| Gate                                     | Evidence required                                                                                                                                                                                                             | Current status  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Historical source preservation           | All seven migrations, the migration manifest, synthetic fixture, capability roles, application dependencies, and exposed-network topology remain unchanged                                                                    | Pass (reviewed) |
| Ephemeral login attributes               | The canary login is acceptance-only, `LOGIN`, non-superuser, non-creator, non-replicating, `NOINHERIT`, `NOBYPASSRLS`, connection-limited to one, and has no unsafe role settings or direct application privileges            | Pass (reviewed) |
| Exact owner membership                   | The sole temporary edge grants `research_cockpit_owner` to the login with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`; no runtime, test-seed, backup, or other edge is added                                               | Pass (reviewed) |
| Container-local SCRAM                    | Valid-password calls use run-local credentials, mode-`0600` non-symlink passfiles, the fixed database, and loopback TCP inside the unexposed pinned container; a wrong password is rejected                                   | Pass (reviewed) |
| Pre-role denial                          | Before explicit role selection, the login cannot use application schemas, access application tables, execute request-context routines, or create temporary objects                                                            | Pass (reviewed) |
| Escalation denial                        | The login cannot use `SET SESSION AUTHORIZATION` or switch to runtime, test-seed, backup, or `postgres`                                                                                                                       | Pass (reviewed) |
| Transaction-local owner identity         | On one authenticated backend, `session_user` remains the canary login and `current_user` becomes only `research_cockpit_owner` after `SET LOCAL ROLE`, then resets                                                            | Pass (reviewed) |
| DDL rollback                             | An injected failure rolls back the complete fixed DDL canary and leaves no object                                                                                                                                             | Pass (reviewed) |
| Committed canary identity                | A separate committed create has only the fixed reviewed identity, exact owner, and exact ACL                                                                                                                                  | Pass (reviewed) |
| Authenticated removal and ledger safety  | The owner-selected authenticated session removes the canary, role state resets, and the exact reviewed migration-ledger rows remain unchanged across rollback, create, and removal                                            | Pass (reviewed) |
| Cleanup before catalog and evidence      | The harness drains canary backends, removes passfiles, drops the login and edge, and proves zero login, membership, backend, file, and object residue before the existing catalog fingerprint and success-only evidence       | Pass (reviewed) |
| Existing acceptance regressions          | Every b1 through b5 migration, fixture, RLS, authenticated-runtime, authorization-matrix, projection-query, test-loader, cleanup, and evidence prerequisite remains mandatory                                                 | Pass (reviewed) |
| Version 6 success-only evidence          | Version 6 appends only `authenticated_owner_ddl_canary`, retains the exact version 5 limitations and six source-hash keys, preserves v1-v5 parsing, and uses a distinct fixed filename and commit/attempt-bound artifact name | Pass (reviewed) |
| Pinned version 6 live evidence           | A clean dedicated PostgreSQL workflow, retained logs/artifact and hashes, and independent offline review support the exact bounded canary claim                                                                               | Pass (reviewed) |
| Authenticated migration execution        | A versioned platform/application split applies the complete migration plan through an authenticated non-superuser and proves rollback, replay, ledger, ownership, and cleanup                                                 | Deferred to B7  |
| Backup, restore, adapter, and production | Authenticated backup/restore, an application driver or pool, concurrency/cancellation, external/TLS identity, managed secrets, real data, deployed operation, and production readiness are demonstrated                       | Out of scope    |

## Exit rule

Source/local rows may be marked only from executable source and focused local
verification. Cycle 1b-b6 becomes live-complete only when the dedicated
PostgreSQL workflow succeeds from a clean checkout against the pinned image and
the exact commit, version 6 record, logs, artifact digest, source hashes, and
independent offline review are retained in a separate evidence note.

ADR acceptance, source code, local tests, or historical b1 through b5 artifacts
cannot satisfy the live row.

That rule was satisfied for tested commit
[`7aac5027011dd4f650658e268425ba6eb4a7993f`](https://github.com/liangzixuan/investing-pro/commit/7aac5027011dd4f650658e268425ba6eb4a7993f)
by PostgreSQL [run `32058853521`, attempt 1](https://github.com/liangzixuan/investing-pro/actions/runs/32058853521)
and the retained, offline-consistent version 6 record. The later documentation
commit does not retest or expand that evidence.

The reviewed B6 run permits only this statement: one ephemeral, non-owner
PostgreSQL login authenticated by SCRAM over container-local TCP, assumed only
the existing owner capability, and exercised the exact rollback, committed
create, authenticated removal, role-reset, ledger, and zero-residue canary
checks recorded above. `authenticated_migrator_sessions` remains a nonclaim:
the canary executes no migration and does not solve the platform/bootstrap split
reserved for B7. It also does not permit claims about production or external
authentication, TLS, managed secrets, a production owner or migrator, backup or
restore, concurrent clients, a driver or pool, real data, application
integration, deployed persistence, or production readiness.

Successor note: B7's separately versioned source work is locally verified and
its version 7 live evidence is pending. It does not alter any historical B6 row or
make the owner-DDL canary a migration.
