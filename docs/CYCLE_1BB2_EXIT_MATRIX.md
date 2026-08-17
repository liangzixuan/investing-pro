# Cycle 1b-b2 exit matrix

Scope: one ephemeral, container-local PostgreSQL runtime service-account login
for the isolated acceptance harness. Source is implemented; live execution and
evidence review are pending. Historical Cycle 1b-b1 evidence remains valid only for its recorded
clean-bootstrap and impersonated-capability checks.

| Gate                                    | Evidence required                                                                                                                                                                                              | Current status                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Bounded topology                        | The pinned service publishes no host port; the runtime client executes inside that container and connects only to the fixed acceptance database over loopback TCP                                              | Pending — source implemented; live run required                                                                     |
| SCRAM credential                        | A high-entropy run-local password is generated outside source/workflow YAML, stored by PostgreSQL as SCRAM, never printed, and absent from command-line arguments, reported errors, records, and artifacts     | Pending — source implemented; live run required                                                                     |
| Wrong-password rejection                | The runtime login fails to connect with a wrong credential through the same TCP path used by the positive probe                                                                                                | Pending — live run required                                                                                         |
| Runtime login attributes                | `research_cockpit_runtime_login` is `LOGIN`, non-superuser, non-creator, non-replicating, `NOINHERIT`, and `NOBYPASSRLS`, with no unsafe role settings                                                         | Pending — source implemented; live catalog proof required                                                           |
| Exact membership                        | The only new role edge is runtime capability to runtime login with `ADMIN FALSE`, `INHERIT FALSE`, and `SET TRUE`; no other inbound or outbound edge exists                                                    | Pending — source implemented; live catalog proof required                                                           |
| Pre-role denial                         | Before `SET ROLE`, the authenticated login cannot use application schemas, read application relations, execute context routines, or create temporary objects                                                   | Pending — live negative probes required                                                                             |
| Forbidden role switches                 | The authenticated login cannot switch to owner, test-seed, backup, or another ungranted role                                                                                                                   | Pending — live negative probes required                                                                             |
| Session identity                        | The positive session reports the runtime login as `session_user`, then the runtime capability as `current_user` only after explicit `SET ROLE`                                                                 | Pending — live run required                                                                                         |
| Missing-context fail-closed             | After assuming runtime without request context, the bounded readable fixture surface returns zero rows                                                                                                         | Pending — live run required                                                                                         |
| Bounded tenant isolation                | One exact alpha-context query exposes the expected alpha organization and does not expose the foreign beta organization                                                                                        | Pending — live run required; not the full authenticated query-shape matrix                                          |
| Sequential cleanup                      | Request-context settings clear after commit and after rollback or a handled error on one authenticated backend                                                                                                 | Pending — live run required; no application pool                                                                    |
| Runtime write denial                    | One representative write attempted after authenticated runtime role selection fails for the expected authorization reason and leaves no row                                                                    | Pending — live run required                                                                                         |
| Success-only evidence                   | The exact commit, acceptance-runner hash covering runtime auth, other reviewed inputs, new completed checks, and explicit b2 limitations appear only after all probes pass and remain independently reviewable | Pending — remote artifact and review required                                                                       |
| Full authenticated authorization matrix | Direct-ID/list/join/count/subquery, all operation-right combinations, and alternating prepared reads rerun through the authenticated login                                                                     | Deferred — those comprehensive checks remain b1 impersonated-capability evidence                                    |
| Migrator authentication                 | A distinct least-privileged account applies the migrations                                                                                                                                                     | Deferred — `0001` role creation and PostgreSQL 17 implicit creator membership require a separate bootstrap redesign |
| Test-loader authentication              | The synthetic fixture is loaded through an authenticated non-owner login                                                                                                                                       | Deferred — b2 retains the b1 impersonated test-seed boundary                                                        |
| Backup authentication and restore       | A backup login authenticates, creates a bounded logical dump, and restores it with post-restore security checks                                                                                                | Deferred — b2 retains the b1 impersonated backup check and performs no dump/restore                                 |
| External and production authentication  | External routing, TLS/certificates, managed secrets, rotation, end-user identity binding, and production authorization are demonstrated                                                                        | Out of scope                                                                                                        |
| Pool and concurrency behavior           | A real driver/pool exercises checkout/reset, cancellation, timeout, and simultaneous sessions                                                                                                                  | Out of scope                                                                                                        |

## Exit rule

Cycle 1b-b2 is complete only when every non-deferred row above has executable
source, the dedicated PostgreSQL workflow succeeds against the pinned image
from a clean checkout, and a success-only record and reviewed run are linked to
the tested commit. Until then, every b2 implementation and engine row remains
Pending. The existing b1 run cannot be reused to satisfy these rows because it
used superuser `SET SESSION AUTHORIZATION` rather than a password-authenticated
runtime login.

Passing b2 permits only this statement: an ephemeral PostgreSQL runtime service
account authenticated by SCRAM over container-local TCP and exercised the
existing synthetic read-only capability in the recorded CI run. It does not
permit claims about an authenticated person, production identity, an external
or TLS-protected connection, secret operations, an application pool, a
least-privileged migrator, an authenticated test loader or backup account,
restore viability, deployed persistence, or production readiness.
