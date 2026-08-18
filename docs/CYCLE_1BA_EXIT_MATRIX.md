# Cycle 1b-a exit matrix

Scope: database-to-core projection contract only. No database driver, API write
path, identity provider, or real data was added.

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

## Later gates

- the Cycle 1b-b4 query's pinned live execution and reviewed version 4 evidence
  are now complete for their separate recorded scope; they do not compose this
  port into the application;
- B8 later proved only one bounded policy-scoped same-cluster restore, and B9
  later proved only one live-reviewed single-client adapter; neither result
  widens this historical matrix or composes the port into the application;
- application composition, adapter-level pool reuse, cancellation, concurrency,
  and broad restore evidence;
- a core composition policy for combining multiple operation views in one
  request without mixing scopes or snapshots;
- production alert execution through the alert-specific view;
- production identity, tenant API writes, real/vendor data, and external
  notifications.

The later Cycle 1b-b1 Ubuntu run supplied bounded live migration, role, RLS, and
sequential-context evidence; b2/b3 added bounded authenticated service-account
and authorization-matrix evidence. None executed this projection port. B4 later
executed the separate driverless query-to-normalizer path, B8 separately proved
one bounded policy-scoped same-cluster restore, and B9 separately proved one
live-reviewed single-client adapter. None of those later results widens this
historical port result or proves application composition, a real pool,
cancellation, concurrency, broad restore, or production readiness. SQLite,
PGlite, mocks, and static SQL checks remain unacceptable substitutes for those
later gates.
