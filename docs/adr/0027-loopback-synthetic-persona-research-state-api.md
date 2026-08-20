# ADR 0027: Loopback synthetic-persona research-state API

Status: source and frozen-byte local integration pass; CI review pending;
production admission blocked

## Context

Cycle 1a established a context-bound `ResearchStateService`, an atomic
in-memory adapter, optimistic versions, operation-scoped idempotency, and
payload-free audit metadata. That historical slice deliberately had no API
write route. Cycles 1b-b1 through b14 proved separate database boundaries, but
none composed an end-user identity resolver or production writer into the
running application.

Cycle 1c needs the smallest application composition that can exercise the
existing thesis and alert update paths without turning fixture identity into a
credential, moving browser-local state to the server, or connecting the API to
PostgreSQL. The contract is therefore loopback-only, synthetic-only,
update-only, and limited to two seeded resource types.

## Decision

Add exactly two write operations to the REST contract:

- `PUT /v1/theses/{thesisId}` with the exact body
  `{instrumentId,claim,evidence,risks,invalidation}`; and
- `PUT /v1/alerts/{alertId}` with the exact body
  `{instrumentId,metricKey,operator,threshold}`, where `operator` is `above` or
  `below`.

Each path ID must match the runtime UUID grammar exactly: hexadecimal groups
`8-4-4-4-12`, version nibble 1 through 8, and RFC 4122 variant nibble 8, 9, a,
or b, case-insensitively.

Both bodies are closed objects. They accept no organization, principal,
membership role, tenant, resource ID, version, timestamp, creator, audit, or
idempotency field. The route passes the resolved actor and validated payload
directly to the existing service save operation; it does not pre-read the
resource. Each thesis text field must contain a non-whitespace character and
rejects C0 controls other than tab, line feed, and carriage return, as well as
DEL. Field-specific maxima count Unicode code points, so 4,000 astral
characters fit a 4,000-character field and 4,001 do not. The OpenAPI schemas
pin the same rule and bounds. The API also enforces a 384 KiB aggregate
request-body cap before the service, sized so every schema-valid maximum thesis
body fits even with JSON escaping. After context resolution, an oversized body
maps to the same value-free `400` shape as malformed input.

Every request requires exactly one `X-Demo-Persona`, one `If-Match`, and one
`Idempotency-Key` header and allows no query string. `If-Match` is one strong
quoted positive JavaScript-safe integer such as `"1"`; weak tags, wildcards,
lists, duplicates, comma-joined values, zero, leading zeroes, malformed values,
and values above `9007199254740991` fail closed. `Idempotency-Key` is 8 through
128 ASCII characters matching `[A-Za-z0-9._:-]`.

The exact public, non-secret persona selectors are:

1. `synp_7f33c6a91d20` — organization A owner;
2. `synp_b4108e2c753d` — organization A researcher;
3. `synp_0d94f6b821ae` — organization A viewer;
4. `synp_e62a1c9074bf` — organization B owner;
5. `synp_5a6d91c20ef4` — organization A principal with an expired membership;
   and
6. `synp_c8e2475b109d` — organization A principal with no membership.

These selectors are fixture labels, not credentials or authenticators. The
composition accepts only an exact loopback peer and rejects caller-supplied
`X-Organization-Id`, `X-Principal-Id`, `X-Membership-Role`, `X-Tenant-Id`, or
`X-Role`. Organization, principal, and role authority come only from the fixed
resolver and existing membership state. The API process remains bound to
loopback; this contract does not authorize reverse-proxy or external exposure.
Peer, persona, and caller-authority resolution runs in the request hook before
body parsing. A missing, duplicated, malformed, or unresolved persona, a
non-loopback peer, or a caller authority header therefore returns the same
`403` even when the body is malformed. A successfully resolved context then
proceeds to syntax and precondition validation. Viewer, inactive, and
no-membership authorization remains inside `ResearchStateService`: a
syntactically valid request is denied `403` before existence, version, or
idempotency evaluation, while malformed input can return `400` or `428` first.

Idempotency is scoped by organization, principal, operation, and key. The
operation includes resource type and resource ID. Authorization is re-evaluated
before replay. While still authorized and while the resource remains at the
recorded version, an exact replay of the same path, body, and `If-Match` returns
the recorded success. Reusing the same key on that same path with a changed
body or `If-Match`, or replaying after a later mutation supersedes the recorded
version, returns `409`. Another resource or path is a separate operation scope.
For the same resolved organization and principal, the identical key can be
used independently on the thesis and alert paths; both valid operations succeed
and retain separate scoped records. No cross-path key conflict is claimed.

Success and exact replay return `200`, a strong ETag for the next version, and
an identity-free response. The thesis response is exactly
`{schemaVersion:'1.0.0',synthetic:true,id,instrumentId,claim,evidence,risks,invalidation,version,createdAt,updatedAt}`;
the alert response is exactly
`{schemaVersion:'1.0.0',synthetic:true,id,instrumentId,metricKey,operator,threshold,version,createdAt,updatedAt}`.
Neither includes organization, principal, creator, updater, audit, or
idempotency metadata.

Failure mapping is fixed:

- missing `If-Match` is `428`;
- missing `Content-Type` or `Idempotency-Key`, a malformed or duplicate
  non-persona write header, malformed path or body, an oversized body, and any
  query string are `400` after peer/persona/authority resolution succeeds;
- missing, duplicate, malformed, or unresolved persona, non-loopback, and
  caller-authority cases are the same value-free `403` before body parsing;
- viewer, inactive, and no-membership cases return the same `403` only after a
  syntactically valid request reaches service authorization, before existence,
  version, or idempotency evaluation;
- scoped absence is a generic `404`;
- same-operation idempotency fingerprint conflict is `409`;
- optimistic-version conflict is `412`; and
- an unexpected failure is a generic value-free `500`.

Response trace, no-store caching, security-header, and local-origin behavior
remain in force. The server generates the response `X-Trace-Id`; a caller trace
value is ignored and never becomes request or audit identity. Browser thesis
and alert persistence remains the existing local profile; Cycle 1c adds no
browser call to these routes and no state migration.

## Evidence boundary

The sole bounded claim is
`bounded_loopback_synthetic_persona_thesis_alert_write_contract`.

Its source-stage status is: **Implemented and locally verified only for the
bounded synthetic loopback source/test contract; not remote/live-engine or
production evidence.** The full frozen-byte local release gate passes:
formatting, lint, all guardrails, all typechecks, all workspace builds, and
workspace tests comprising database 18 files/582 tests, API 49, research-state
48, contracts 5, core 62, and web 3. CI review remains pending. Cycle 1c is not
B15 or V15, creates no PostgreSQL acceptance record, and does not alter any B1
through B14 evidence or history.

The exact ordered nonclaims are:

1. `end_user_authentication_account_ownership_or_production_oidc`
2. `synthetic_persona_selector_secrecy_unforgeability_or_impersonation_resistance`
3. `external_network_tls_cors_csrf_dns_rebinding_or_hostile_local_process_security`
4. `postgresql_adapter_rls_durable_persistence_or_database_context_cleanup`
5. `production_application_writer_authorization_or_b13_b14_token_integration`
6. `distributed_multi_process_restart_durable_idempotency_or_etag_consistency`
7. `general_api_bola_or_routes_beyond_the_two_exact_updates`
8. `resource_creation_deletion_export_alert_delivery_or_background_evaluation`
9. `browser_profile_server_persistence_or_migration`
10. `tamper_evident_denial_or_security_event_audit`
11. `production_load_capacity_pool_tuning_cancellation_failover_or_slo`
12. `production_privacy_legal_dsar_retention_kms_hsm_backup_global_deletion_or_real_data`

## Consequences

The running source can now exercise two deterministic synthetic update paths
through the established in-memory authorization and atomicity contract. The
small surface makes version, idempotency, tenant isolation, and error behavior
testable without introducing a new storage or identity authority.

The public selector is intentionally forgeable, state is lost on process
restart, and the route is not a general CRUD or tenant API. PostgreSQL/RLS,
production authentication, durable idempotency, browser migration, external
network hardening, operational load, privacy/legal controls, and real data all
remain blocked.

## Related records

- [ADR 0004: Contract-first REST boundary](./0004-contract-first-rest.md)
- [ADR 0006: Context-bound research state](./0006-context-bound-research-state.md)
- [Cycle 1a exit matrix](../CYCLE_1A_EXIT_MATRIX.md)
- [Cycle 1c exit matrix](../CYCLE_1C_EXIT_MATRIX.md)
- [Threat model](../THREAT_MODEL.md)
