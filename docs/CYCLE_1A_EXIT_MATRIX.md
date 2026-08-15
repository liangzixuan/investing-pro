# Cycle 1a exit matrix

Scope: synthetic-only authorization and storage contract. Updated after the
final verification run.

| Gate                      | Evidence                                                                                                                                                                    | Status                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Immutable starting point  | Git commit `a388899`, annotated tag `sprint-0-baseline`                                                                                                                     | Pass                            |
| Competitor/data isolation | Boundary scanner covers application, fixtures, SQL, database/config roots, Dockerfiles, and Compose surfaces                                                                | Pass                            |
| Runtime scope unchanged   | No database/state import in `apps`; no API write route; browser-local state retained                                                                                        | Pass                            |
| Tenant port safety        | Unit of work binds one trusted synthetic actor; scoped repositories accept no tenant parameter                                                                              | Pass                            |
| Role/object isolation     | Owner/researcher/viewer, inactive membership, forged organization, and identical cross-tenant object-ID tests                                                               | Pass                            |
| Atomic mutation           | Service resource, idempotency, and audit roll back together; concurrent stale writers serialize                                                                             | Pass                            |
| Replay semantics          | Principal/organization/operation/key scope, fingerprint conflicts, 24-hour boundary, delete/recreate conflict                                                               | Pass                            |
| Content deletion          | Thesis/alert payload hard delete; export excludes deleted rows; payload-free tenant/type ID markers prevent same-type recreation; audit/idempotency contain no user payload | Pass in memory; live DB pending |
| Rights enforcement        | Exact policy ID/version plus purpose/channel/territory/expiry; fact evidence and fixed timeline/history projections fail closed                                             | Pass                            |
| Temporal contract         | Reporting period, source availability, public-known interval, and system-recorded interval have distinct names and half-open rules                                          | Pass                            |
| Migration integrity       | Ordered forward SQL, immutable SHA-256 manifest, synthetic-only/fixed-numeric/tenant/RLS/static security checks                                                             | Pass (static only)              |
| Dependency surface        | No new third-party runtime or development package                                                                                                                           | Pass                            |

## Deliberately pending

These gates cannot be marked complete without an exact pinned real PostgreSQL
service and remain mandatory before any database adapter or tenant API is
enabled:

- migration execution and syntax on the target PostgreSQL major;
- non-owner runtime role and `FORCE RLS` behavior;
- cross-tenant list/direct-ID/join/count/subquery and composite-FK attacks;
- missing/malformed context, commit/rollback/cancellation, and pool reuse;
- operation-aware display/derive/alert rights loading and an RLS-aware
  completeness/unknown-omission contract;
- instrument-generic history/timeline snapshot records plus a second-symbol
  isolation test;
- at least 1,000 alternating/concurrent tenant operations;
- migration replay, injected failure rollback, logical dump/restore, and
  post-restore authorization parity; and
- production identity verification, retention jobs, DSAR, and backup deletion.

The `OmissionSummaryDto` gained `hasOmissions` and a nullable count while the API
is version `0.1.0`; route inventory and query parameters are unchanged, but this
is intentionally not described as byte-for-byte response compatibility.
