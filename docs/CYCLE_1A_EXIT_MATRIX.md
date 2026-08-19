# Cycle 1a exit matrix

Scope: synthetic-only authorization and storage contract. Updated after the
final verification run.

| Gate                      | Evidence                                                                                                                                                                    | Status                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Immutable starting point  | Git commit `a388899`, annotated tag `sprint-0-baseline`                                                                                                                     | Pass                             |
| Competitor/data isolation | Boundary scanner covers application, fixtures, SQL, database/config roots, Dockerfiles, and Compose surfaces                                                                | Pass                             |
| Runtime scope unchanged   | No database/state import in `apps`; no API write route; browser-local state retained                                                                                        | Pass                             |
| Tenant port safety        | Unit of work binds one trusted synthetic actor; scoped repositories accept no tenant parameter                                                                              | Pass                             |
| Role/object isolation     | Owner/researcher/viewer, inactive membership, forged organization, and identical cross-tenant object-ID tests                                                               | Pass                             |
| Atomic mutation           | Service resource, idempotency, and audit roll back together; concurrent stale writers serialize                                                                             | Pass                             |
| Replay semantics          | Principal/organization/operation/key scope, fingerprint conflicts, 24-hour boundary, delete/recreate conflict                                                               | Pass                             |
| Content deletion          | Thesis/alert payload hard delete; export excludes deleted rows; payload-free tenant/type ID markers prevent same-type recreation; audit/idempotency contain no user payload | Pass in memory; live DB pending  |
| Rights enforcement        | Exact policy ID/version plus purpose/channel/territory/expiry; fact evidence and fixed timeline/history projections fail closed                                             | Pass                             |
| Temporal contract         | Reporting period, source availability, public-known interval, and system-recorded interval have distinct names and half-open rules                                          | Pass                             |
| Migration integrity       | Ordered forward SQL, immutable SHA-256 manifest, synthetic-only/fixed-numeric/tenant/RLS/static security checks                                                             | Pass static; bounded b1 live run |
| Dependency surface        | No new third-party runtime or development package                                                                                                                           | Pass                             |

## Deliberately pending

The later Cycle 1b-b1 run supplied bounded clean-migration syntax, catalog and
impersonated `FORCE RLS` evidence, selected cross-tenant/context probes, replay
refusal, and injected rollback against pinned PostgreSQL 17.11. Later b2/b3
runs added one bounded container-local authenticated runtime service account
and the reviewed synthetic authorization matrix. They did not exercise a
database adapter, application identity resolver, trusted tenant-selection
boundary, or an application/future authorized writer path. Later B8 through B12
results do not widen this historical Cycle 1a result. These remaining gates
stay mandatory before any application-composed database adapter or tenant API
is enabled:

- application-integrated end-user/principal/organization resolution and
  trusted tenant selection;
- composite-FK and future writer-path attacks beyond b1's read probes;
- production/load-ready pool tuning and failover, graceful cancel requests,
  prompt queued cancellation, and reuse of canceled backends;
- application-composed execution of the operation-aware projection contract;
  Cycle 1b-b4 later supplied a reviewed driverless query/unit execution, B9
  separately supplied one reviewed single-client adapter, and B10 supplied one
  bounded two-client pool result, but none is an application composition-root
  proof;
- at least 1,000 alternating/concurrent tenant operations; B12 separately
  passed 1,000 fact plus 1,000 tenant submissions through at most eight runtime
  workload backends, not 1,000 simultaneous database sessions, but it does not
  supply the missing application-composed tenant-operation proof;
- broad live checksum-drift handling and broad restore evidence; B11 separately
  proved only one exact bounded live ledger-checksum drift refusal, and B8
  separately proved only one bounded policy-scoped same-cluster restore with
  post-restore authorization checks; and
- production identity verification, retention jobs, DSAR, and backup deletion.

The `OmissionSummaryDto` gained `hasOmissions` and a nullable count while the API
is version `0.1.0`; route inventory and query parameters are unchanged, but this
is intentionally not described as byte-for-byte response compatibility.
