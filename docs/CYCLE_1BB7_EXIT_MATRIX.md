# Cycle 1b-b7 exit matrix

Scope: a separately committed container-superuser platform bootstrap is
followed by the complete role-neutral application migration plan through one
ephemeral, SCRAM-authenticated, non-superuser migrator that may select only the
owner capability. B7 is an acceptance proof of that bounded migration phase,
not a production deployment design. The decision is recorded in
[ADR 0019](./adr/0019-versioned-authenticated-migration-phase.md).

The design, source implementation, pinned live version 7 run, and independent
review are complete for the bounded recorded scope at commit `41d13dd`.
Historical b1 through b6 evidence remains valid only for its recorded checks.

The v2 platform/application plan is the sole B7 migration authority. The
legacy manifest and bodies run only as inherited b1 through b6 regressions
before the exact disposable reset; they are not an alternate B7 plan.

| Gate                                     | Evidence required                                                                                                                                                                                                                                                                                                                                         | Current status                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Historical evidence preservation         | The historical manifest, seven migrations, fixture, v1-v6 parser branches, source shapes, checks, limitations, and retained records remain unchanged                                                                                                                                                                                                      | Pass — anchored source and retained regressions |
| Distinct versioned plans                 | A closed platform plan, role-neutral application migration manifest and exact bodies, and authenticated renderer are separate from historical bootstrap inputs                                                                                                                                                                                            | Pass — anchored source/offline review           |
| Platform rollback                        | An injected platform-stage failure leaves no capability role, application schema, extension, object, ledger, or database-privilege drift                                                                                                                                                                                                                  | Pass — reviewed live run                        |
| Reviewed platform state                  | The successful platform phase creates the exact roles, schemas and owners, public ACL lockdown, `btree_gist` plus extension-routine lockdown, and database `CREATE`/`TEMPORARY` lockdown; replay is rejected without drift                                                                                                                                | Pass — reviewed live run                        |
| Ephemeral migrator provisioning          | After the platform fingerprint passes, the harness creates only the locked-down login and one `research_cockpit_owner` edge with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`; role settings and direct ACLs are empty                                                                                                                                  | Pass — reviewed live run                        |
| Migrator login boundary                  | The login is acceptance-only, non-superuser, non-creator, non-replicating, `NOINHERIT`, `NOBYPASSRLS`, connection-limited, and authenticates with a run-local SCRAM password over container-local loopback TCP                                                                                                                                            | Pass — reviewed live run                        |
| Pre-role and escalation denial           | Before owner selection the login cannot use application schemas or unreviewed DDL paths; forbidden `SET ROLE` and `SET SESSION AUTHORIZATION` transitions fail closed                                                                                                                                                                                     | Pass — reviewed live run                        |
| Authenticated identity                   | On the authenticated backend `session_user` remains the migrator login, `current_user` becomes only the owner under transaction-local role selection, and role state resets after transaction completion                                                                                                                                                  | Pass — reviewed live run                        |
| Migration rollback                       | An injected pre-commit failure removes every application object and ledger row from the role-neutral plan while retaining only the exact reviewed platform schemas, extension, roles, and privileges                                                                                                                                                      | Pass — reviewed live run                        |
| Complete migration phase                 | The successful authenticated transaction applies every role-neutral migration exactly once with exact ordering, body hashes, ownership, constraints, RLS, privileges, and ledger rows                                                                                                                                                                     | Pass — reviewed live run                        |
| Ledger attribution                       | Every versioned application ledger row has the exact manifest identity/hash and records the authenticated login as `applied_by` rather than the selected owner capability or administrator                                                                                                                                                                | Pass — reviewed live run                        |
| Replay rejection                         | A second authenticated execution is rejected for the reviewed reason and leaves the successful catalog and ledger unchanged                                                                                                                                                                                                                               | Pass — reviewed live run                        |
| Mandatory cleanup                        | Before catalog fingerprinting or evidence, the harness drains migrator backends, removes passfiles, drops the login without `DROP OWNED` or `REASSIGN OWNED` and thereby removes the membership, then proves zero temporary auth/file/login-owned-object residue                                                                                          | Pass — reviewed live run                        |
| Existing acceptance regressions          | Every b1 through b6 migration, fixture, RLS, authenticated-runtime, authorization, projection, test-loader, owner-canary, cleanup, and evidence prerequisite remains mandatory                                                                                                                                                                            | Pass — reviewed live run                        |
| Exact legacy-to-v2 reset                 | After all ephemeral sessions/logins are gone, the harness connects only to maintenance database `postgres`, proves zero target sessions/backends, drops the exact disposable target without `FORCE`, drops exactly the four dependency-free capability roles, recreates the exact target, and proves the v2 namespace pristine                            | Pass — reviewed live run                        |
| Version 7 source contract                | V7 preserves exact v1-v6 behavior; appends only `authenticated_clean_application_migrations_after_platform_bootstrap`; replaces only `authenticated_migrator_sessions` with the external/production/incremental and global-atomicity nonclaims; expands exact source hashes for all new plan inputs; and rejects missing, extra, or mixed-version sources | Pass — artifact/offline review                  |
| Pinned version 7 live evidence           | A clean dedicated PostgreSQL workflow, reviewed log markers, retained artifact/evidence digests, and independent offline review support the exact bounded B7 claim                                                                                                                                                                                        | Pass — run `32068159652`; `offline_consistent`  |
| Global/platform and extension provenance | One globally atomic platform-plus-migration bootstrap, authenticated non-superuser platform creation, and independent provenance for trusted-extension contents are demonstrated                                                                                                                                                                          | Out of scope                                    |
| Backup, restore, adapter, and production | Authenticated backup/restore, a driver or pool, concurrency/cancellation, external/TLS identity, managed secrets, real data, deployment, and production readiness are demonstrated                                                                                                                                                                        | Out of scope                                    |

## Exit rule

Cycle 1b-b7 is live-complete only for the bounded recorded scope at tested
commit `41d13dde55148c05342d782c76fc80e9b76f4e95`. PostgreSQL run
`32068159652`, attempt 1, its version 7 artifact digest, producer-log evidence
digest, reviewed log markers, expanded source bundle, and independent
`offline_consistent` review are retained in the
[B7 evidence note](./POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md). The later
documentation commit does not replace, retest, or expand those anchors; any
workflow it triggers is a separate repository-health check.

Historical artifacts or the B6 owner-DDL canary cannot satisfy the B7 live row.
Even after B7 passes, the claim must stay narrower than a production migrator:
the separately committed container-superuser platform phase, global atomicity,
trusted-extension provenance, incremental upgrades, cluster-wide or
multi-database migration safety, external/TLS authentication, managed secrets,
backup/restore, concurrency, driver/pool integration, real data, deployment,
and production readiness remain unproven.

The later [B8 evidence](./POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md)
separately records one bounded authenticated policy-scoped data dump and clean
same-cluster restore. It does not widen any B7 row or historical version 7
claim.
