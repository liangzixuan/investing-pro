# Sprint 0 through Cycle 1b-b1 threat model

## Current trust boundaries

The browser accepts dossier JSON only from the local Fastify API. The API reads only source-controlled synthetic fixtures and remains GET-only. Browser thesis and alert state remains local. There is no authentication, customer tenant data, live database, file upload, external fetch, email, broker, payment, model, or filing-parser boundary in the running profile.

Cycle 1a adds an isolated synthetic authorization harness and PostgreSQL
migration contract. The contract now has a reviewed clean-only acceptance execution,
but neither database component is imported by the API or web application.
Synthetic actor context is test-controlled and trusted; it does not establish
identity.

Cycle 1b-a adds a disconnected operation-scoped projection contract. It has no
database implementation. The complete synthetic fixture port is explicitly not
a database adapter seam.

Cycle 1b-a2 adds a disconnected PostgreSQL-row normalizer for dimensionless
synthetic financial facts. It accepts no connection or SQL capability and is
not imported by either running app.

Cycle 1b-b1 adds a disconnected, clean-only PostgreSQL acceptance harness and a
digest-pinned Ubuntu service workflow. Its first reviewed run passed at
`611c93d`. The live checks bootstrap through the ephemeral container superuser and impersonate
the migration-defined `NOLOGIN` capabilities, so they do not establish
production authentication, identity binding, network security, or migrator
separation. `set_request_context` still accepts trusted synthetic IDs and must
not be treated as an identity resolver.

After all implemented probes pass, the acceptance entry point creates one
exact-schema, success-only run record and the workflow may upload exactly that
file. Exclusive creation and success-only upload reduce stale or false-green
records; exact source hashes bind the record to reviewed inputs. The record is
unsigned metadata, not independent provenance. It intentionally excludes
secrets, raw environment values, SQL/logs, data identities, and counts. Pull
request artifacts and expired/deleted artifacts remain an external trust and
retention boundary.

The first retained record, run links, hashes, and explicit limitations are
listed in the [Cycle 1b-b1 evidence note](./POSTGRESQL_ACCEPTANCE_EVIDENCE.md).

The offline record verifier accepts only a small regular non-symlink file,
requires independent repository/run/hash anchors, and compares canonical bytes
with fixed source blobs read from the explicit local Git commit. It never
consults a remote or mutable worktree and emits only `offline_consistent`.
Malicious or mistaken trust anchors, forged GitHub runs/artifacts, compromised
workflow logs, unsigned/unreachable commits, and a dishonest database execution
remain outside that result and require operator review.
The operator-controlled local Git database and PATH-resolved Git executable are
part of this verifier's trusted computing base; the CLI is not a sandbox for an
untrusted repository.

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
- The PostgreSQL wire boundary accepts only exact plain data rows, keeps
  listing and security identities separate, validates lossless timestamps,
  fixed decimals, intervals, cutoffs, units, and exact policy/grant echoes, and
  rejects an entire malformed batch with a value-free error. It cannot accept
  completeness or count input.
- Exact dependency pins, a lockfile, a single allowed install script, an allowlisted production-license gate, dependency review, and two-OS CI reduce supply-chain drift.
- The evidence dialog traps/restores focus; chart values have a semantic table; reduced-motion and high-contrast preferences are respected.

## Non-production constraints

Local storage and the in-memory authorization harness are not encrypted and have no production identity boundary. Users are explicitly told not to enter sensitive information. The demo must not be exposed as a public service, connected to real data, or used for investment decisions.

The reviewed clean-only run proves PostgreSQL syntax and only the exact catalog,
RLS, authorization, transaction-context, and failure probes listed in its run
record. It does not prove authenticated sessions, connection pooling,
concurrent backends, cancellation, dump/restore, disaster recovery, or
production identity. An emulator is not a substitute for those later gates,
and `offline_consistent` alone is not engine evidence without the independently
reviewed GitHub run and logs.

## Gates before adding new trust boundaries

1. **Authentication or customer tenant data:** building on b1's bounded real-PostgreSQL run, prove authenticated non-owner identity/role mapping, BOLA isolation, pooled context cleanup, retention, export/delete, DSAR, backup deletion, and restore; then add verified OIDC/JWT identity. Synthetic context is never accepted as authentication evidence.
2. **Filing ingestion:** run one-shot non-root parser workers with no unnecessary egress, read-only filesystems, CPU/memory/time limits, archive/XML bomb defenses, allowlisted taxonomy/plugins, quarantine, replay, and signed provenance.
3. **External URLs or files:** add SSRF allowlists, DNS/IP revalidation, MIME and size checks, sandboxed parsing, malware scanning, and stored-XSS sanitization.
4. **Licensed vendor data:** require executed field/channel/purpose/retention/derived-use/AI rights, executable policy versions, deletion tests, and unit economics before connection.
5. **Alerts:** use at-least-once processing, deterministic dedupe keys, idempotent internal state, provider receipts, duplicate SLOs, and correction notices.
6. **AI:** keep it outside deterministic calculations; require a rights-safe evidence ledger, prompt-injection isolation, numeric-claim evaluation, cost limits, and unsupported-claim fail-closed behavior.

These are release blockers, not optional backlog items.
