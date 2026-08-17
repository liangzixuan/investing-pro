# Cycle 1b-b3 exit matrix

Scope: rerun the existing finite synthetic runtime authorization matrix through
the Cycle 1b-b2 ephemeral, container-local SCRAM service account. The source
and first live execution were reviewed at commit `664c0e5b`; see the
[Cycle 1b-b3 evidence note](./POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md).
Historical b1 and b2 evidence remains valid only for the checks and limitations
recorded in their respective evidence notes.

| Gate                                       | Evidence required                                                                                                                                                                                                  | Current status                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Source and historical compatibility        | B3 preserves the b1 impersonated-capability regression path, the b2 bounded-authentication probes, and parsing/review of historical version 1 and version 2 records                                                | Pass — tested source preserves both earlier paths; the downloaded version 3 record returned `offline_consistent` |
| Authenticated execution boundary           | Every b3 matrix statement runs through the SCRAM-authenticated runtime login; application access occurs only after transaction-local `SET LOCAL ROLE research_cockpit_runtime`                                     | Pass — reviewed run `31991498652` completed the authenticated matrix                                             |
| Preserved bounded b2 controls              | Wrong-password, pre-role, role-escalation, identity, missing-context, transaction-cleanup, write-denial, backend-drain, and residue-removal probes remain mandatory prerequisites                                  | Pass — version 3 retains the bounded b2 completed check and the reviewed run completed before emitting evidence  |
| Session and transaction boundary           | `session_user` remains the login, every matrix context and runtime role selection is transaction-local, the prepared sequence stays on one authenticated backend, and mandatory cleanup leaves no residue          | Pass — reviewed sequential service-account path; no application pool                                             |
| Complete reviewed tenant visibility        | Alpha and beta receive only their expected rows across the reviewed private/shared surface; inactive, no-membership, expired-membership, and future-membership cases match the frozen expectations                 | Pass — reviewed shared matrix completed through the authenticated client                                         |
| Query-shape isolation                      | Direct lookup, enumeration, joins, `EXISTS`, scalar subqueries, counts, and identical tenant-local resource IDs reveal no foreign-tenant row or identifier                                                         | Pass — reviewed shared matrix completed through the authenticated client                                         |
| Authenticated operation rights             | Display/API, derive/API, and alert/local-alert return exactly the reviewed evidence and financial-fact rows, including the expected policy denials                                                                 | Pass — all three reviewed operation tuples completed through the authenticated client                            |
| Authenticated prepared-statement isolation | One authenticated backend alternates alpha and beta transaction-local contexts through a prepared statement without role, context, or tenant leakage                                                               | Pass — reviewed one-backend alternating sequence; this is sequential and not a pool/concurrency result           |
| Version 3 success-only evidence            | A new immutable record meaning identifies the exact commit/run, reviewed hashes, completed b3 check, and remaining limitations only after every b3 probe and cleanup succeeds; older record meanings remain frozen | Pass — artifact `9275477303`; JSON SHA-256 `aefbfe52d8d7eb1b9ddef6cb3b743c0bf18ecb54bda190c5bdf18eee6daa38f6`    |
| Clean pinned remote execution              | The dedicated PostgreSQL workflow succeeds from a clean checkout against the reviewed PostgreSQL 17.11 image, and its logs and success artifact are independently reviewed                                         | Pass — run `31991498652`, attempt 1, job `95275773749`                                                           |
| End-user and tenant identity binding       | A verified identity resolver binds the authenticated person/service to the principal and organization context and prevents caller-selected tenant context                                                          | Out of scope                                                                                                     |
| External/production authentication         | External routing, TLS/certificates, managed secrets, rotation, production role provisioning, and deployed authorization are demonstrated                                                                           | Out of scope                                                                                                     |
| Pool, cancellation, concurrency, and load  | A real driver/pool proves checkout/reset, cancellation, timeouts, simultaneous backends, and required load                                                                                                         | Out of scope                                                                                                     |
| Migrator, test-loader, backup, and restore | Separately designed least-privileged identities authenticate for their exact responsibilities, and a bounded logical restore passes post-restore security checks                                                   | Deferred                                                                                                         |
| Real or licensed data                      | Approved data provenance, rights, retention, and production privacy controls are exercised                                                                                                                         | Out of scope                                                                                                     |

## Exit rule

Cycle 1b-b3 is live-complete only when every in-scope row above has executable
source, the dedicated PostgreSQL workflow passes against the pinned image from
a clean checkout, and the exact run, logs, success-only version 3 record, record
hash, and offline review are retained and linked. That rule was satisfied only
for commit `664c0e5b0158925918c4ff07c9f7f28fe345327b`, run `31991498652`, at
workflow attempt `1`. The downloaded record returned `offline_consistent`
against separately supplied commit, repository, run, attempt, and byte-hash anchors. Exact links,
hashes, scope, and limitations are in the
[evidence note](./POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md).

Even after a successful b3 run, the permitted claim is limited to one recorded
CI execution of the reviewed synthetic authorization matrix through an
ephemeral SCRAM-authenticated runtime service account over container-local TCP.
It will not establish an authenticated end user, trusted tenant selection,
external/TLS transport, production secrets, pool/concurrency safety,
least-privileged deployment identities, restore viability, deployed
persistence, or production readiness.

B1's additional null, malformed, and unsupported-context failures remain
administrator-impersonation evidence. They are not silently promoted by b3.
