# Cycle 1b-a exit matrix

Scope: database-to-core projection contract only. No database driver, live
PostgreSQL service, API write path, identity provider, or real data was added.

| Gate                        | Evidence                                                                                                                                            | Status |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Instrument-generic research | History and timeline are supplied as instrument-scoped snapshot records; no SYN1 record constants remain in the composer                            | Pass   |
| Second-symbol isolation     | Mixed and foreign-only SYN1/SYN2 snapshots cannot inherit facts, history, events, passports, or evidence bindings                                   | Pass   |
| Evidence boundary           | Internal many-to-many instrument/evidence bindings gate every projected citation without changing `EvidencePassportDto`                             | Pass   |
| Deterministic compatibility | SYN1 history, timeline, evidence order, historical restatement behavior, API tests, and dossier DTO shape remain stable                             | Pass   |
| Exact authorization         | One operation is evaluated at a time against the candidate's exact policy ID/version, purpose/channel, provider territory, and trusted-clock expiry | Pass   |
| Adapter identity            | Core use case rejects a source result whose instrument, public cutoff, system cutoff, or operation differs from the request                         | Pass   |
| RLS completeness            | Repository results can be only known-incomplete or unknown; both force `hasOmissions: true`, `count: null`                                          | Pass   |
| Side-channel boundary       | No expected/missing counts, caller completeness attestation, denied row IDs, or row-decision list exists in the repository result                   | Pass   |
| Current runtime scope       | Existing GET-only SYN1 demo and browser-local state remain disconnected from the new port                                                           | Pass   |
| Dependency surface          | No runtime or development dependency was added                                                                                                      | Pass   |
| Full release gate           | Formatting, lint, clean-room/fixture/migration/license guards, strict types, 149 tests, and production builds                                       | Pass   |

## Deliberately pending

- live migration, RLS, role, pool-reuse, cancellation, concurrency, and restore
  evidence against a digest-pinned PostgreSQL image;
- a read-only adapter that normalizes full RFC 3339, half-open interval,
  fixed-decimal, nonempty-text, and exact-enum semantics before calling core;
- a core composition policy for combining multiple operation views in one
  request without mixing scopes or snapshots;
- production alert execution through the alert-specific view;
- production identity, tenant API writes, real/vendor data, and external
  notifications.

The local machine has no PostgreSQL client/service or container runtime. The
next database proof therefore requires an approved, separate Ubuntu CI
acceptance job; it must not be represented by SQLite, PGlite, mocks, or static
SQL checks.
