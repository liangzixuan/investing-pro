# ADR 0023: Locked PostgreSQL migration-ledger deployment

Status: accepted; bounded live V11 record retained and reviewed

## Context

Cycle 1b-b7 proved one clean authenticated application migration after a
separately committed platform bootstrap. Its renderer deliberately requires an
empty ledger, so it does not establish how a populated target refuses checksum
drift, applies a pending suffix once, or behaves when two deployments overlap.
B8 through B10 preserve that limitation.

B11 must add those mechanics without changing the immutable historical
bootstrap lane, rewriting the reviewed v2 migration bodies, turning the
database package into an application composition root, or claiming a general
production upgrade system.

## Decision

Add `PostgresMigrationDeployer` in
`packages/db/src/postgres-migration-deployer.ts`. It is a non-owning,
sequential deployer over one exclusively leased, authenticated `pg.Client`.
The caller owns connection configuration and shutdown and must not share the
client while the deployer uses it.

Construction takes a synchronous, validated snapshot of the closed v2 plan.
Each deployment first resets transaction and role state, then opens one
`READ COMMITTED`, read-write transaction with fixed local statement and lock
timeouts. Inside that transaction it:

1. takes the same transaction-scoped advisory lock used by the v2 migration
   renderer;
2. selects only the reviewed owner capability with `SET LOCAL ROLE`;
3. verifies the exact database, SCRAM service identity, role attributes,
   membership graph, schema ownership, and platform extension;
4. locks `shared_data.schema_migrations` in `SHARE ROW EXCLUSIVE` mode;
5. validates the ledger relation, columns, constraints, owner, and absence of
   public/runtime privileges;
6. accepts only a non-empty, exact ordered prefix of the closed manifest;
7. executes each pending reviewed body and inserts its exact ID, filename, and
   SHA-256 ledger row; and
8. checks transaction identity, commits, and verifies role reset.

A missing ledger, malformed ledger object, extra/reordered row, filename
mismatch, or checksum mismatch is the stable value-free
`POSTGRES_MIGRATION_LEDGER_DRIFT` failure. Other failures use the stable
`POSTGRES_MIGRATION_DEPLOYMENT_FAILURE` boundary. An injected failure occurs
after pending body and ledger work but before commit, so rollback must restore
the original prefix. Rollback or reset failure, an ambiguous commit, or a
failed post-commit role-reset assertion poisons the deployer instance; it may
not guess that the client is reusable.

The source also contains one acceptance-only helper that reconstructs exactly
the reviewed `v2-0001` through `v2-0005` prefix from a complete v2 target. It
derives the pre-`v2-0006` procedure body from reviewed source bytes, requires
the complete ledger before deleting the exact final row, and runs under the
same advisory/table locks and timeouts. It is not a general down-migration or
rollback API.

## Bounded acceptance boundary

The dedicated PostgreSQL harness must preserve every B1 through B10
prerequisite in the same success-only run and must use a fresh ephemeral
loopback-only SCRAM login with no
direct application privileges, exactly one set-only owner edge, and a
connection limit of two. On the disposable v2 database it must prove:

- catalog and connected-session checks prove the exact SCRAM `system_user`,
  login attributes, two-connection limit, absence of direct application ACLs,
  and one set-only owner edge;
- exact reconstruction of the `v2-0005` prefix;
- live checksum drift is refused with the complete target fingerprint
  unchanged, followed by exact repair of the acceptance-only mutation;
- injected final-migration failure rolls body and ledger effects back to the
  exact prefix;
- one deployment applies only `v2-0006`, and the next reports `current` with no
  body replay;
- two authenticated deployers serialize on the reviewed locks, with exactly
  one applying the suffix and the other observing the current ledger;
- finite server timeouts remain in force; and
- clients, backends, login, membership, SCRAM verifier, and advisory locks leave
  zero residue before V11 evidence, while acceptance-only checksum drift and
  prefix reconstruction leave no divergence from the exact current V11 target;
  no passfile or on-disk password artifact is created, while secure erasure of
  the in-memory JavaScript password string is not claimed.

Those rows passed in PostgreSQL run `32183709701` at commit `5df9d07`. Source
and focused tests alone are not live PostgreSQL evidence; the bounded claim
also depends on the reviewed workflow, logs, retained artifact, and independent
offline result.

## Evidence contract

Version 11 preserves every V1 through V10 parser branch, source shape, tool
shape, check, limitation, and historical meaning. It appends only
`authenticated_locked_migration_ledger_checksum_drift_refusal_one_time_replay_rollback_and_concurrent_deployment`
and adds `postgresMigrationDeployerSha256` for the exact committed bytes of
`packages/db/src/postgres-migration-deployer.ts`. No tool-version field is
added; V11 retains the exact V10 PostgreSQL, node-postgres, and pg-pool tool
shape.

V11 replaces only
`external_production_or_incremental_authenticated_migrations` with the ordered
nonclaims:

- `external_or_production_incremental_migrator_credentials`;
- `arbitrary_manifest_multi_release_or_general_incremental_migrations`;
- the retained `globally_atomic_platform_and_application_bootstrap`; and
- `production_migration_orchestration_crash_recovery_cancellation_or_failover`.

Every other V10 limitation remains exact and ordered. The fixed filename is
`research-cockpit-postgres-acceptance-v11.json`; the artifact name is exactly
`postgres-acceptance-evidence-v11-${{ github.sha }}-${{ github.run_attempt }}`.
The writer remains success-only, and the success path ends with the exact
terminal fragment `the version 11 success-only run record was written.` The
offline reviewer requires the V11 deployer blob only for V11 and continues to
review a historical V10 commit that does not contain it.

The V11 evidence source, parser, verifier, reviewer, workflow, and focused
compatibility tests are implemented. Integrated local verification passes:
13 database test files with 515 tests, every other workspace test project,
root and database typechecks, migration and PostgreSQL static guardrails,
lint, formatting, production builds, and diff checks. Docker was unavailable
locally, so no live-engine result is inferred. The local license inventory
could not enumerate a pre-existing pnpm-store entry for
`@fastify/cors@11.3.0`; the later clean cross-platform CI install passed at the
tested commit.

The retained V11 record binds
`50e5829deaa5465935c2fc4669f9bd27622f6e8f59048ace6e028de4a0613374` for the
migration deployer,
`195510475d2eb6dcfe9dca4f781f335c00a1b4e40de672ef07091a17c717eb7e` for the
authenticated migration-plan source,
`62736f5a71e070a6893cf75fb72dc2079f905e90600d71de65b71cba7fe38c74` for the
acceptance runner, and
`73bc100eb27a1e7884d05f6feb642bc00c224d56e7b480899ba901cd9934f24a` for the
workflow; the image config pins that workflow hash. The downloaded evidence
bytes returned `offline_consistent` against the independently supplied commit,
run, attempt, repository, and byte-hash anchors. See the
[B11 evidence note](../POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md) for all
seventeen source hashes, log markers, and artifact anchors.

## Explicit exclusions

B11 does not prove external or production migrator credentials, TLS, managed
secrets or rotation, arbitrary manifests, multi-release upgrades, destructive
or reversible down-migrations, online application/schema compatibility,
concurrent application writes, distributed orchestration, crash recovery,
cancellation, retry/failover, global platform/application atomicity,
multi-database or cross-cluster coordination, application composition, real
data, deployment readiness, or production readiness.

The acceptance-only prefix reconstruction is not a supported downgrade path.
Two loopback clients in one disposable PostgreSQL 17.11 service are not a
production deployment topology.

## Consequences

B11 creates a fail-closed boundary for one exact reviewed v2 suffix and a
bounded two-deployer serialization proof. Its reviewed V11 result does not
widen the clean-only B7 claim or any B1 through B10 record. B12 later passed its
separate bounded live query-plan and 2,000-submission result; it does not widen
this migration result.

## Related decisions

- [ADR 0019: Versioned authenticated migration phase](./0019-versioned-authenticated-migration-phase.md)
- [ADR 0022: Bounded PostgreSQL projection-pool lifecycle](./0022-bounded-postgresql-projection-pool-lifecycle.md)
- [Cycle 1b-b10 exit matrix](../CYCLE_1BB10_EXIT_MATRIX.md)
- [Cycle 1b-b11 exit matrix](../CYCLE_1BB11_EXIT_MATRIX.md)
- [Cycle 1b-b11 evidence note](../POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md)
- [ADR 0024: Bounded PostgreSQL RLS query-plan and 2,000-read load acceptance](./0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
- [Cycle 1b-b12 exit matrix](../CYCLE_1BB12_EXIT_MATRIX.md)
- [Cycle 1b-b12 evidence note](../POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md)
