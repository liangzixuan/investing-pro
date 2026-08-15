# Sprint 0 threat model

## Current trust boundaries

The browser accepts dossier JSON only from the local Fastify API. The API reads only source-controlled synthetic fixtures. There is no authentication, tenant data, database, file upload, external fetch, email, broker, payment, model, or filing-parser boundary in this slice.

Assets at risk are source integrity, fixture provenance, rights-policy behavior, browser-local thesis text, and the guarantee that restricted fixture data does not leave the server projection.

## Implemented controls

- Server-side allow/deny checks run before API serialization; denial paths have tests.
- The API exposes GET only, permits CORS only from the two local web origins, disables caching, emits trace IDs, and applies security headers.
- The web app applies a CSP, denies framing, disables unused browser permissions, has no third-party scripts/fonts/assets, and renders evidence as React text rather than HTML.
- Fixture excerpts have SHA-256 hashes, a provenance manifest, and a gate that rejects missing, stale, or mismatched records.
- Clean-room and dependency gates reject competitor references, unapproved collectors, copied raster assets, and forbidden packages in application source.
- Exact dependency pins, a lockfile, a single allowed install script, an allowlisted production-license gate, dependency review, and two-OS CI reduce supply-chain drift.
- The evidence dialog traps/restores focus; chart values have a semantic table; reduced-motion and high-contrast preferences are respected.

## Non-production constraints

Local storage is not encrypted and has no identity boundary. Users are explicitly told not to enter sensitive information. The demo must not be exposed as a public service, connected to real data, or used for investment decisions.

## Gates before adding new trust boundaries

1. **Authentication or tenant data:** define organization membership, object-level authorization, private/shared data classification, database RLS, BOLA/property tests, audit logs, retention, export, DSAR, and backup deletion.
2. **Filing ingestion:** run one-shot non-root parser workers with no unnecessary egress, read-only filesystems, CPU/memory/time limits, archive/XML bomb defenses, allowlisted taxonomy/plugins, quarantine, replay, and signed provenance.
3. **External URLs or files:** add SSRF allowlists, DNS/IP revalidation, MIME and size checks, sandboxed parsing, malware scanning, and stored-XSS sanitization.
4. **Licensed vendor data:** require executed field/channel/purpose/retention/derived-use/AI rights, executable policy versions, deletion tests, and unit economics before connection.
5. **Alerts:** use at-least-once processing, deterministic dedupe keys, idempotent internal state, provider receipts, duplicate SLOs, and correction notices.
6. **AI:** keep it outside deterministic calculations; require a rights-safe evidence ledger, prompt-injection isolation, numeric-claim evaluation, cost limits, and unsupported-claim fail-closed behavior.

These are release blockers, not optional backlog items.
