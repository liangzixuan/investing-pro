# Cycle 1b-b2 exit matrix

Scope: one ephemeral, container-local PostgreSQL runtime service-account login
for the isolated acceptance harness. The bounded source and live evidence were
reviewed at commit `3479e164`; see the
[Cycle 1b-b2 evidence note](./POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). Historical
Cycle 1b-b1 evidence remains valid only for its recorded clean-bootstrap and
impersonated-capability checks.

| Gate                                    | Evidence required                                                                                                                                                                                          | Current status                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Bounded topology                        | The pinned service publishes no host port; the runtime client executes inside that container and connects only to the fixed acceptance database over loopback TCP                                          | Pass — reviewed run `31988811000` used the pinned service container and loopback-only client path                                         |
| SCRAM credential                        | A high-entropy run-local password is generated outside source/workflow YAML, stored by PostgreSQL as SCRAM, never printed, and absent from command-line arguments, reported errors, records, and artifacts | Pass — reviewed source, catalog probe, logs, and secret-free success record                                                               |
| Wrong-password rejection                | The runtime login fails to connect with a wrong credential through the same TCP path used by the positive probe                                                                                            | Pass — bounded negative probe rejected the disposable wrong credential; positive legs required SCRAM                                      |
| Runtime login attributes                | `research_cockpit_runtime_login` is `LOGIN`, non-superuser, non-creator, non-replicating, `NOINHERIT`, and `NOBYPASSRLS`, with no unsafe role settings                                                     | Pass — exact live catalog fingerprint                                                                                                     |
| Exact membership                        | The only new role edge is runtime capability to runtime login with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`; no other inbound or outbound edge exists                                                | Pass — exact live membership fingerprint                                                                                                  |
| Pre-role denial                         | Before `SET ROLE`, the authenticated login cannot use application schemas, read application relations, execute context routines, or create temporary objects                                               | Pass — all bounded pre-role negative probes returned the expected authorization failures                                                  |
| Forbidden role switches                 | The authenticated login cannot switch to owner, test-seed, backup, or another ungranted role                                                                                                               | Pass — reviewed negative probes included owner, test-seed, backup, and `postgres`                                                         |
| Session identity                        | The positive session reports the runtime login as `session_user`, then the runtime capability as `current_user` only after explicit `SET ROLE`                                                             | Pass — exact identity transition, SCRAM `system_user`, loopback addresses, and non-TLS container-local transport observed                 |
| Missing-context fail-closed             | After assuming runtime without request context, the bounded readable fixture surface returns zero rows                                                                                                     | Pass — exact zero-result live probe                                                                                                       |
| Bounded tenant isolation                | One exact alpha-context query exposes the expected alpha organization and does not expose the foreign beta organization                                                                                    | Pass — one reviewed alpha-versus-beta read; this is not the full authenticated query-shape matrix                                         |
| Sequential cleanup                      | Request-context settings clear after commit and after rollback or a handled error on one authenticated backend                                                                                             | Pass — one authenticated backend exercised commit, rollback, and handled-error cleanup; no application pool                               |
| Runtime write denial                    | One representative write attempted after authenticated runtime role selection fails for the expected authorization reason and leaves no row                                                                | Pass — one reviewed write-denial and row-absence probe                                                                                    |
| Success-only evidence                   | The exact commit, acceptance-runner hash covering runtime auth, other reviewed inputs, new completed checks, and explicit b2 limitations appear only after all probes pass and remain reviewable           | Pass — version 2 artifact retained; downloaded record returned `offline_consistent` against independently supplied commit/run/hash inputs |
| Full authenticated authorization matrix | Direct-ID/list/join/count/subquery, all operation-right combinations, and alternating prepared reads rerun through the authenticated login                                                                 | Deferred — those comprehensive checks remain b1 impersonated-capability evidence                                                          |
| Migrator authentication                 | A distinct least-privileged account applies the migrations                                                                                                                                                 | Deferred — `0001` role creation and PostgreSQL 17 implicit creator membership require a separate bootstrap redesign                       |
| Test-loader authentication              | The synthetic fixture is loaded through an authenticated non-owner login                                                                                                                                   | Deferred — b2 retains the b1 impersonated test-seed boundary                                                                              |
| Backup authentication and restore       | A backup login authenticates, creates a bounded logical dump, and restores it with post-restore security checks                                                                                            | Deferred — b2 retains the b1 impersonated backup check and performs no dump/restore                                                       |
| External and production authentication  | External routing, TLS/certificates, managed secrets, rotation, end-user identity binding, and production authorization are demonstrated                                                                    | Out of scope                                                                                                                              |
| Pool and concurrency behavior           | A real driver/pool exercises checkout/reset, cancellation, timeout, and simultaneous sessions                                                                                                              | Out of scope                                                                                                                              |

## Exit rule

Cycle 1b-b2 is complete when every in-scope, non-deferred row above has
executable source, the dedicated PostgreSQL workflow succeeds against the
pinned image from a clean checkout, and a success-only record and reviewed run
are linked to the tested commit. That rule was satisfied only for commit
`3479e1646b1a5d2f12adebfbc1f6d1a48592f2cf`, run `31988811000`, attempt 1. The
single recorded b2 check is the aggregate
`bounded_container_local_scram_runtime_probe`; its acceptance-runner source
hash binds the individual probes described above.

Passing b2 permits only this statement: in the recorded CI run, an ephemeral
PostgreSQL runtime service account authenticated by SCRAM over container-local
TCP and exercised the existing synthetic read-only capability. It does not
permit claims about an authenticated person, production identity, an external
or TLS-protected connection, secret operations, an application pool, a
least-privileged migrator, an authenticated test loader or backup account,
restore viability, deployed persistence, or production readiness.
