# Cycle 1c exit matrix

Scope: exactly two update-only, synthetic, in-memory research-state API routes
behind fixed public persona selectors and an exact loopback peer boundary. The
design is recorded in
[ADR 0027](./adr/0027-loopback-synthetic-persona-research-state-api.md).
Browser persistence remains local, PostgreSQL remains disconnected, and no
production identity or external network boundary is established.

Current status: **Implemented and locally verified only for the bounded
synthetic loopback source/test contract; not remote/live-engine or production
evidence.** The full frozen-byte local release gate passes. CI review remains
pending. Cycle 1c is not B15 or V15 and does not change any B1 through B14
claim, artifact, or historical result.

| Gate                             | Evidence required                                                                                                                                                                                                                                              | Current status                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Historical evidence preservation | B1 through B14 source/evidence history is unchanged; Cycle 1c creates no PostgreSQL evidence version                                                                                                                                                           | Pass — frozen-byte local diff review                                  |
| Exact route inventory            | Only `PUT /v1/theses/{thesisId}` and `PUT /v1/alerts/{alertId}` are added; path IDs pin the runtime UUID version/variant grammar; no research-state create/delete/read/list/export/query surface                                                               | Pass — source/focused tests                                           |
| Loopback composition             | Exact loopback peer required; API bind remains loopback; missing/duplicate/malformed/unresolved persona, non-loopback peer, or caller-authority header is `403` before body parsing                                                                            | Pass — source/focused tests                                           |
| Persona resolution               | Exact six public, non-secret selectors cover A owner/researcher/viewer, B owner, A expired membership, and A no membership                                                                                                                                     | Pass — source/focused tests                                           |
| Authority rejection              | Organization/principal/role never comes from path, body, query, or caller authority headers                                                                                                                                                                    | Pass — source/focused tests                                           |
| Closed payloads                  | Thesis safe-text maxima count Unicode code points; all bodies accept only exact frozen keys; identity/version/audit metadata is forbidden; 384 KiB accepts every schema-valid maximum and resolved oversize maps value-free to `400`                           | Pass — contracts/OpenAPI and route tests                              |
| Optimistic concurrency           | One exact strong positive-safe-integer `If-Match` is required; success increments once and returns the next strong ETag; missing/stale/malformed cases map to `428`/`412`/`400`                                                                                | Pass — source/focused tests                                           |
| Idempotency                      | Organization + principal + operation + key scope; auth is re-evaluated; current exact replay is `200`; same-operation changed body/`If-Match` or superseded replay is `409`; identical key on thesis versus alert is independent and both valid writes succeed | Pass — source/focused tests                                           |
| Authorization and scoped absence | Owner/researcher update; after valid syntax, viewer/inactive/no-member is `403` before existence/version/idempotency; malformed resolved-member input may be `400`/`428`; scoped absence is generic `404`                                                      | Pass — source/focused tests                                           |
| Atomic service reuse             | Routes call `ResearchStateService.saveThesis` or `saveAlert` directly without a pre-read; existing resource/idempotency/audit rollback remains the authority                                                                                                   | Pass — source/focused tests                                           |
| Response minimization            | `200` DTOs contain schema/synthetic marker, resource ID and payload, version, creation/update times only; no tenant, principal, creator/updater, audit, or idempotency metadata                                                                                | Pass — contracts/OpenAPI and route tests                              |
| Error minimization               | Malformed input `400`, forbidden `403`, scoped absence `404`, idempotency conflict `409`, stale version `412`, missing precondition `428`, and unexpected `500` disclose no rejected values or tenant-state detail                                             | Pass — source/focused tests                                           |
| Browser profile                  | Existing browser-local thesis and alert persistence remains unchanged; UI does not depend on the new server write routes                                                                                                                                       | Pass — frozen-byte local regression                                   |
| Integrated local verification    | Format, lint, all guardrails, all typechecks, workspace tests/builds, exact API/contract suites, and unchanged database gates pass together                                                                                                                    | Pass — DB 18 files/582; API 49; state 48; contracts 5; core 62; web 3 |
| CI/review                        | Required repository CI passes on the exact candidate commit and the final diff is reviewed                                                                                                                                                                     | Pending                                                               |
| Production admission             | End-user identity, external transport, PostgreSQL durability/RLS, production writer authorization, load/operations, privacy/legal controls, and real data are separately proved                                                                                | Blocked; explicitly outside Cycle 1c                                  |

## Bounded claim and nonclaims

The only bounded claim proposed for final exit is
`bounded_loopback_synthetic_persona_thesis_alert_write_contract`.

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

## Exit rule

Do not promote the bounded claim until the CI row passes on the exact candidate
bytes. Even after that promotion, the result remains only a deterministic
source/test proof for two seeded synthetic loopback updates.
It cannot be cited as authentication, a secret persona mechanism, general
BOLA protection, deployed durability, remote/live-engine evidence, production
readiness, or permission to use real tenant or personal data.
