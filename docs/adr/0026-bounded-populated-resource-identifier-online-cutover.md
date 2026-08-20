# ADR 0026: Bounded populated resource-identifier online cutover

Status: accepted source design; local integration complete; live V14 evidence pending; production admission blocked

## Context

ADR 0025 deliberately applies the keyed resource-identifier lifecycle only to
an empty database. Historical migration `v2-0005` creates its raw-identifier
registry directly and is not safe to apply as a populated-database upgrade.
Package-roadmap item 18 therefore requires a separately versioned, audited
backfill and cutover that does not mutate the historical v2 or privacy v1
inputs and does not widen any retained V1 through V13 result.

B14 addresses only a bounded, synthetic transition. It must not be described
as a general production migration, continuous zero-downtime deployment, proof
of an application-writer protocol, or permission to admit real tenant or
personal data.

## Decision

Freeze populated-cutover plan v1 under
`packages/db/populated-cutover-plans/v1`. Its authenticated base is the exact
v2 application sequence `v2-0001` through `v2-0004`, followed by `v2-0006`.
The manifest explicitly excludes `v2-0005` with reason
`replaced_by_audited_populated_cutover`. It binds that base manifest, the exact
selected bodies, the B13 privacy policy/manifest/application target, its own
platform bootstrap, and both cutover bodies by SHA-256.

The plan runs only in the fixed pristine disposable
`research_cockpit_b14_populated_cutover_test` database and consists of two
application phases:

1. `expand_capture_backfill` installs the B13-shaped privacy domain and keyed
   registry tables, adds not-yet-validated live-state foreign keys, establishes
   an audited intermediate raw work registry, and installs triggers that
   capture subsequent synthetic thesis/alert inserts and deletes. The source
   rows present at the capture boundary are inserted into the work registry.
   An authenticated cutover capability claims bounded work and records
   externally derived 32-byte tokens; PostgreSQL never receives a token key and
   does not authenticate the HMAC.
2. `validate_contract` accepts the exact observed capture epoch only after no
   unbackfilled work remains. Under an advisory gate and a short final
   write-conflicting relation barrier, it validates source/work/registry
   correspondence, validates and contracts the foreign keys and not-null
   columns, removes the temporary capture surface, and installs the exact B13
   lifecycle target.

The synthetic acceptance path starts with populated rows on the pre-`0005`
branch, exercises a post-capture insert while backfill is open and a
post-capture delete before contract, and checks the final keyed B13-shaped
catalog and lifecycle. It also requires injected precommit contract rollback,
forces an epoch-mismatch rollback and bounded retry after a captured insert,
and holds the final barrier while a competing contract and a pre-derived
acceptance writer are blocked. Finalize must serialize the competing contract,
allow the writer to resume against the contracted target, and reject contract
replay. The insert uses the acceptance-only test-seed identity; the delete uses
the authenticated migrator selecting the owner capability. Those actors do
not model or authorize a production application writer.

There is no authoritative pre-B14 registry from which to recover identifiers
deleted before the capture boundary. B14 proves only that the exercised
post-capture delete is carried into a keyed deleted allocation. The supported
expand surface grants allocation to neither the privacy capability nor the
test-seed identity. After contract, however, a production application using
the B13 target must coordinate its allocation and source-row creation so an
allocation-before-source-row interval cannot escape its operating protocol.
A production writer integration, authorization model, allocation/dual-write
protocol, and deployment coordination or quiescence contract therefore remain
required.

## Evidence contract

Version 14 preserves every exact V1 through V13 parser, verifier, reviewer,
tool, source, check, limitation, and historical record branch. A historical V13
commit remains reviewable without any B14 path, hash, or image-config field.
V14 appends these checks in order:

1. `versioned_populated_resource_identifier_cutover_contract`; and
2. `authenticated_bounded_synthetic_populated_resource_identifier_online_cutover`.

V14 retains the V13 tool shape and source hashes, then appends exactly:

1. `populatedCutoverPlanManifestV1Sha256`;
2. `populatedCutoverPlanSourceV1Sha256`; and
3. `populatedCutoverFixtureV1Sha256`.

The commit-bound reviewer additionally reads the manifest-named platform and
two application bodies, requires the exact populated-cutover plan tree, and
validates the manifest's exact base, exclusion, target, ordering, and body
hashes. The image config independently binds the B14 fixture. Missing, extra,
mixed-version, noncanonical, or non-regular bundles fail closed. The fixed
record filename is `research-cockpit-postgres-acceptance-v14.json`; the
workflow artifact is
`postgres-acceptance-evidence-v14-${{ github.sha }}-${{ github.run_attempt }}`.

V14 removes only V13's broad
`populated_database_privacy_migration_backfill_or_online_cutover` nonclaim.
All other V13 limitations retain their exact order and meaning, with these
narrower cutover limitations inserted in its place:

- `external_or_production_populated_database_privacy_migration_or_cutover`
- `zero_downtime_uninterrupted_writes_or_application_dual_write_deployment`
- `production_application_writer_integration_authorization_or_dual_write_protocol`
- `production_cutover_volume_duration_slo_or_lock_budget`
- `migration_process_or_cluster_crash_recovery_resume_or_post_commit_downgrade`
- `long_running_prepared_transaction_ddl_replication_or_failover_concurrency`
- `real_customer_tenant_personal_or_non_synthetic_cutover`
- `recovery_of_resource_identifiers_deleted_before_b14_capture_boundary`

Source and local verification cannot establish a live V14 result. A live claim
requires a retained green workflow run, exact log and artifact anchors, and an
independent commit-bound `offline_consistent` review.

## Consequences

The source closes the design gap for one exact populated synthetic pre-`0005`
to B13-shaped transition while preserving all historical inputs. It makes the
capture window, backfill work, final barrier, and target validation auditable.

Production admission remains blocked. B14 does not establish production
writer compatibility, uninterrupted writes, arbitrary allocation gaps,
general schema evolution, sustained volume or lock budgets, crash/restart or
failover recovery, prepared-transaction/replication behavior, downgrade after
contract, external key custody, global deletion, real-data safety, or a
production cutover runbook.

## Related decisions

- [ADR 0019: Versioned authenticated migration phase](./0019-versioned-authenticated-migration-phase.md)
- [ADR 0023: Locked PostgreSQL migration-ledger deployment](./0023-locked-postgresql-migration-ledger-deployment.md)
- [ADR 0025: Versioned resource-identifier privacy and retention lifecycle](./0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
- [Cycle 1b-b13 exit matrix](../CYCLE_1BB13_EXIT_MATRIX.md)
- [Cycle 1b-b14 exit matrix](../CYCLE_1BB14_EXIT_MATRIX.md)
