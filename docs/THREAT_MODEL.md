# Sprint 0 through Cycle 1b-a threat model

## Current trust boundaries

The browser accepts dossier JSON only from the local Fastify API. The API reads only source-controlled synthetic fixtures and remains GET-only. Browser thesis and alert state remains local. There is no authentication, customer tenant data, live database, file upload, external fetch, email, broker, payment, model, or filing-parser boundary in the running profile.

Cycle 1a adds an isolated synthetic authorization harness and unexecuted PostgreSQL migration contract. Neither is imported by the API or web application. Synthetic actor context is test-controlled and trusted; it does not establish identity.

Cycle 1b-a adds a disconnected operation-scoped projection contract. It has no
database implementation. The complete synthetic fixture port is explicitly not
a database adapter seam.

Assets at risk are source integrity, fixture provenance, rights-policy behavior, browser-local thesis text, and the guarantee that restricted fixture data does not leave the server projection.

## Implemented controls

- Server-side allow/deny checks run before API serialization; denial paths have tests.
- The API exposes GET only, permits CORS only from the two local web origins, disables caching, emits trace IDs, and applies security headers.
- The web app applies a CSP, denies framing, disables unused browser permissions, has no third-party scripts/fonts/assets, and renders evidence as React text rather than HTML.
- Fixture excerpts have SHA-256 hashes, a provenance manifest, and a gate that rejects missing, stale, or mismatched records.
- Clean-room and dependency gates reject competitor references, unapproved collectors, copied raster assets, and forbidden packages in application source.
- Clean-room scanning now covers SQL, future database/config directories, Dockerfiles, and Compose files. It rejects external database file/network import primitives and paths outside the project boundary.
- Context-bound repository ports remove per-operation tenant arguments. The in-memory unit of work serializes and rolls back transactions, applies a fail-closed owner/researcher/viewer matrix, and returns defensive copies.
- Idempotency records are principal/organization/operation scoped,
  request-hashed, and expire after 24 hours. Audit events are allowlisted
  metadata with a 90-day retention deadline; that deadline is not yet a
  production purge guarantee. Thesis and alert deletes remove payload content
  while retaining only a tenant- and resource-type-scoped ID marker to prevent
  same-type delete/recreate ABA.
- PostgreSQL migrations have ordered SHA-256 checksums and static guards for synthetic-only constraints, fixed numeric values, exact rights-policy versions, tenant composite keys, forced RLS, transaction-local context, public privilege revocation, and read-only runtime grants.
- Operation-scoped projections bind candidates to one instrument and exact
  rights-policy version, validate returned scope and temporal cutoffs in core,
  take policy evaluation time from an injected trusted provider, expose no
  denied row IDs, accept no caller-complete/count state, and force an unknown
  public omission count for every incomplete or RLS-unknown view.
- Exact dependency pins, a lockfile, a single allowed install script, an allowlisted production-license gate, dependency review, and two-OS CI reduce supply-chain drift.
- The evidence dialog traps/restores focus; chart values have a semantic table; reduced-motion and high-contrast preferences are respected.

## Non-production constraints

Local storage and the in-memory authorization harness are not encrypted and have no production identity boundary. Users are explicitly told not to enter sensitive information. The demo must not be exposed as a public service, connected to real data, or used for investment decisions.

Static SQL tests do not prove PostgreSQL syntax, `FORCE RLS`, role ownership, transaction-context cleanup, connection pooling, concurrency, or backup/restore. Those remain Cycle 1b release blockers and must use real pinned PostgreSQL, not an emulator.

## Gates before adding new trust boundaries

1. **Authentication or customer tenant data:** execute the migration and RLS suite on real PostgreSQL; prove role separation, BOLA isolation, context cleanup, retention, export/delete, DSAR, backup deletion, and restore; then add verified OIDC/JWT identity. Synthetic context is never accepted as authentication evidence.
2. **Filing ingestion:** run one-shot non-root parser workers with no unnecessary egress, read-only filesystems, CPU/memory/time limits, archive/XML bomb defenses, allowlisted taxonomy/plugins, quarantine, replay, and signed provenance.
3. **External URLs or files:** add SSRF allowlists, DNS/IP revalidation, MIME and size checks, sandboxed parsing, malware scanning, and stored-XSS sanitization.
4. **Licensed vendor data:** require executed field/channel/purpose/retention/derived-use/AI rights, executable policy versions, deletion tests, and unit economics before connection.
5. **Alerts:** use at-least-once processing, deterministic dedupe keys, idempotent internal state, provider receipts, duplicate SLOs, and correction notices.
6. **AI:** keep it outside deterministic calculations; require a rights-safe evidence ledger, prompt-injection isolation, numeric-claim evaluation, cost limits, and unsupported-claim fail-closed behavior.

These are release blockers, not optional backlog items.
