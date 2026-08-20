# ADR 0025: Versioned resource-identifier privacy and retention lifecycle

Status: accepted technical model; bounded live V13 record retained and reviewed; production admission blocked

## Context

The historical v2 database plan permanently tombstones tenant, resource-type,
and resource UUID tuples. That is useful non-reuse evidence, but a permanent raw
tenant/resource tuple is not an approved production privacy or retention model.
B12 therefore left production privacy approval for permanent resource
identifiers as an explicit successor prerequisite.

B13 must make the technical choice reviewable without claiming legal approval,
DSAR fulfillment, production key custody, backup erasure, populated-database
cutover, or real-data readiness. It must not mutate the historical v2 plan or
widen any retained V1 through V12 result.

## Decision

Freeze policy version 1 in
`packages/db/privacy-retention-plans/v1/policy.json`. It classifies stable
resource tokens as pseudonymous identifiers, permits synthetic data only, and
sets `productionAdmission.allowed` to `false`. The recorded retention targets
are a technical decision contract, not proof of lawful basis, notice, legal
hold, jurisdictional compliance, or an operating production process.

Freeze a separate privacy-retention plan v1:

- `manifest.json` binds the exact platform bootstrap and every named
  application SQL body by SHA-256;
- `platform-bootstrap.sql` accepts only the fixed pristine disposable database
  `research_cockpit_b13_privacy_retention_test`; and
- `application/0001_keyed_resource_identifier_lifecycle.sql` is an empty-data
  suffix over the exact v2 application plan. Any populated tenant table fails
  closed. A standalone write-conflicting lock over every checked tenant table
  precedes the separate emptiness command so a concurrent writer cannot cross
  the preflight snapshot. The historical v2 and legacy migrations remain
  unchanged.

The suffix replaces the raw-identity tombstone registry only in that new plan.
`private_data.resource_privacy_domains` binds one tenant to an external key
reference and an active/offboarding state. The rebuilt
`private_data.resource_id_registry` uses a stable allocation UUID, privacy
domain, resource type, and exactly 32 token bytes. Live rows retain the raw
organization/resource UUIDs needed by the live foreign keys. A hard delete
atomically moves exactly one registry row from `live` to `deleted` while
clearing both raw UUIDs; only the pseudonymous token tuple and lifecycle audit
times remain.

Tokens use the frozen `hmac-sha256-v1` framing in
`packages/db/src/resource-identifier-token.ts`. A trusted external MAC provider
derives them with a tenant privacy-domain key that never crosses that source
boundary. PostgreSQL checks only byte length, uniqueness, lifecycle, and tenant
relationships; it cannot verify that supplied bytes are a genuine HMAC. That
limitation remains explicit in V13.

The privacy-retention capability exposes only the fixed allocation,
single-resource hard-delete, active-to-offboarding, bounded tenant purge, and
bounded expired-metadata purge procedures. Offboarding blocks new live allocations, removes online tenant
resource tokens and the synthetic tenant graph through the reviewed procedure,
and leaves external key destruction to the production KMS boundary.
Idempotency and audit purges use the database transaction clock, fixed expiry
columns, `SKIP LOCKED`, and at most 1,000 rows of each class per call. The
source-controlled fixture and live probe are synthetic only.

## Evidence contract

Version 13 preserves every V1 through V12 parser/verifier/reviewer branch,
tool shape, check, limitation, source shape, and historical meaning. It appends,
in order:

1. `versioned_privacy_retention_decision_contract`; and
2. `authenticated_bounded_synthetic_resource_identifier_privacy_retention_lifecycle`.

It retains the V12 tools and source hashes, then appends exactly these hashes:

1. `privacyRetentionPolicyV1Sha256`;
2. `privacyRetentionPlanManifestV1Sha256`;
3. `privacyRetentionPolicySourceV1Sha256`;
4. `privacyRetentionPlanSourceV1Sha256`;
5. `resourceIdentifierTokenV1Sha256`; and
6. `privacyRetentionFixtureV1Sha256`.

The commit-bound reviewer also reads the manifest-named platform and
application SQL bodies and verifies their hashes. Missing, extra, mixed-version,
or noncanonical bundles fail closed. The runner remains bound by the existing
`acceptanceRunnerSha256`; the image config independently binds the privacy
fixture. The fixed record filename is
`research-cockpit-postgres-acceptance-v13.json`, and the workflow artifact name
is `postgres-acceptance-evidence-v13-${{ github.sha }}-${{ github.run_attempt }}`.

V13 preserves the complete ordered V12 limitation list and appends the exact
production/legal/DSAR/offboarding/KMS/token-verification/database-and-backup
erasure/populated-cutover/global-proof/real-data nonclaims recorded by the
evidence schema. Source and local verification do not establish a live
PostgreSQL result. A V13 live claim requires a retained run, exact log and
artifact anchors, and independent commit-bound review; source or local
verification alone cannot establish it. PostgreSQL run `32305478242` at commit
`a959cba` executed the exact bounded synthetic lifecycle and mandatory cleanup.
Its V13 record and logs were retained, and independent commit-bound review
returned `offline_consistent`. See the
[B13 evidence note](../POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md).

## Consequences

The source now makes one narrow privacy design executable against a pristine,
synthetic, disposable database. It gives later reviewers deterministic evidence
for raw-identifier clearing, same-token non-reuse, offboarding admission closure, online
token purge, and bounded metadata expiry.

The reviewed live V13 result establishes only that exact synthetic lifecycle at
the tested commit. It does not widen the decision into a production policy or
operating system.

Production admission remains blocked. Before real tenant or personal data, the
project still requires explicit product/privacy/legal approval, lawful-basis
and notice decisions, verified-subject DSAR and legal-hold orchestration,
production offboarding scheduling and monitoring, external KMS/HSM custody and
destruction evidence, primary/replica/cache/log/search/analytics/third-party
deletion, backup/archive expiry and restore suppression, and a separately
audited populated-database backfill and online cutover. The synthetic database
result cannot prove global deletion or cryptographic erasure.

## Related decisions

- [ADR 0019: Versioned authenticated migration phase](./0019-versioned-authenticated-migration-phase.md)
- [ADR 0020: Authenticated policy-scoped data backup and bounded clean restore](./0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
- [ADR 0024: Bounded PostgreSQL RLS query-plan and 2,000-read load acceptance](./0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
- [Cycle 1b-b12 exit matrix](../CYCLE_1BB12_EXIT_MATRIX.md)
- [Cycle 1b-b13 exit matrix](../CYCLE_1BB13_EXIT_MATRIX.md)
- [Cycle 1b-b13 evidence note](../POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md)
- [ADR 0026: Bounded populated resource-identifier online cutover](./0026-bounded-populated-resource-identifier-online-cutover.md)
- [Cycle 1b-b14 exit matrix](../CYCLE_1BB14_EXIT_MATRIX.md)
