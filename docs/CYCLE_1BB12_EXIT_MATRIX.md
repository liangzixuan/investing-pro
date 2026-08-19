# Cycle 1b-b12 exit matrix

Scope: one deterministic synthetic fixture, two closed authenticated plan
shapes, and exactly 2,000 submitted reads through a runner-owned pool bounded to
eight runtime workload backends. A separate out-of-band administrator observes
the barrier but performs none of the 2,000 workload reads. B12 is not 2,000 connections, a production
benchmark, an application composition root, a real-data result, or a planner
guarantee beyond the exact reviewed target. The design is accepted in
[ADR 0024](./adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md).

The source contract and integrated local verification are complete. Pinned
live PostgreSQL execution, retained V12 evidence and logs, and independent
artifact review remain pending. Historical B1 through B11 evidence remains
valid only for its recorded checks.

| Gate                                          | Evidence required                                                                                                                                                                                                                                                                                                                             | Current status                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Historical evidence preservation              | V1 through V11 parser branches, source/tool shapes, checks, limitations, records, plans, fixtures, adapter, pool, deployer, and recorded meanings remain exact                                                                                                                                                                                | Pass — focused evidence tests                        |
| Exact prerequisites                           | Every B1 through B11 bootstrap, authentication, authorization, projection, migration, backup/restore, client, pool, cleanup, and evidence prerequisite remains mandatory before V12 evidence                                                                                                                                                  | Pass — source/focused tests; live V12 pending        |
| Closed immutable inputs                       | The B12 module and deterministic fixture are fixed source inputs; caller-selected SQL, fixture, planner or connection setting, endpoint, or benchmark scenario is rejected or absent                                                                                                                                                          | Pass — source/focused tests                          |
| Disposable clone isolation                    | A fixed-name clone is templated from the exact source only after zero source sessions; fixture load and `ANALYZE` touch only the clone; source fingerprint is unchanged; cleanup drops the clone without `FORCE`                                                                                                                              | Implemented — live pending                           |
| Authenticated forced-RLS plans                | The exact B4 fact-as-known and tenant thesis shapes execute under a fresh SCRAM `NOBYPASSRLS` runtime login with transaction-local context; a privileged synthetic reference remains separate                                                                                                                                                 | Implemented — source/focused tests; live pending     |
| Named-index contract                          | Closed `FORMAT JSON` parsing requires executed scans on `financial_facts_as_known` and `theses_by_instrument`, with no sequential scan on either large benchmark relation, no disabled sequential scans, and no temporary/replacement index                                                                                                   | Implemented — source/focused tests; live pending     |
| Bounded connection topology                   | One fresh runtime login has `CONNECTION LIMIT 8`; one runner-owned pool fixes `max: 8`; a separate administrator connection observes the first eight runtime application backends blocked at one acceptance barrier                                                                                                                           | Implemented — live pending                           |
| Exact 2,000-read submission                   | Exactly 1,000 fact and 1,000 tenant promises are submitted before barrier release, then settle through the eight-backend topology; this is not 1,000 or 2,000 simultaneous database sessions                                                                                                                                                  | Implemented — source/focused tests; live pending     |
| Alpha/Beta isolation                          | Every completed fact and tenant read returns only its closed Alpha/Beta expected result; cross-tenant rows, partial batches, and any failed submission reject the gate                                                                                                                                                                        | Implemented — source/focused tests; live pending     |
| Bounded operations                            | The pool's pending checkout and the workload, plan, seed, and `ANALYZE` statements have configured bounds; a timeout cannot be reinterpreted as load success                                                                                                                                                                                  | Implemented — source/focused tests; live pending     |
| Required settlement and cleanup               | Success requires all 2,000 submissions to settle, `pool.end()` and observer closure, backend drain, removal of the login and memberships/SCRAM verifier, and absence of application-name, barrier, and clone residue; cleanup calls are not each independently cancellable, and the 15-minute workflow ceiling is the outer fail-closed bound | Implemented — live pending                           |
| Version 12 evidence                           | V12 appends only the exact B12 check and two exact B12 source hashes, retains V11 tools and nonclaims, inserts only `thousand_simultaneous_database_backends_or_connections` at the frozen position, rejects mixed bundles, and preserves V1-V11                                                                                              | Pass — focused evidence tests; live artifact pending |
| Integrated local verification                 | Complete database tests, typechecks, migration/PostgreSQL static guardrails, lint/format, production builds, and diff checks pass without making a live-engine claim                                                                                                                                                                          | Pass — integrated local gates                        |
| Pinned V12 live evidence                      | A clean dedicated PostgreSQL workflow, exact log markers, retained artifact/evidence hashes, immutable source hashes, and independent offline review support the bounded B12 claim                                                                                                                                                            | Pending                                              |
| Production capacity or general plan stability | 1,000/2,000 simultaneous database backends, capacity/SLOs, production pool tuning/failover, plan stability across data/statistics/hardware/versions, real data, application composition, and production readiness are demonstrated                                                                                                            | Out of scope                                         |

## Exit rule

Cycle 1b-b12 is not live-complete. Its source and integrated local gates pass;
it becomes complete only after a clean pinned PostgreSQL workflow executes the
exact bounded matrix with mandatory cleanup, the V12 record and exact logs are
retained with independent anchors, and the commit-bound offline reviewer
returns `offline_consistent`.

Two thousand promises submitted to one runner-owned queue do not represent two
thousand database connections. Only eight runtime workload backends may execute
at once; the separate administrator observer is not a workload client. The
observed first-eight barrier is a bounded topology check, not production
capacity evidence. A plan accepted only after disabling sequential scans,
creating an acceptance-only index, or using a privileged reference in place of
the runtime RLS path would not satisfy this gate.

No V12 live artifact or B12 post-live evidence note exists yet. B12 remains the
current database gate until that live review closes. The next existing
unassigned [package-roadmap prerequisite](../packages/db/README.md) is approval
of the production privacy and retention model for permanent resource
identifiers; no B13 milestone or successor claim is assigned here.
