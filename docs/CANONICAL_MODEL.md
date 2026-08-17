# Canonical data and tenancy contract

Status: Cycle 1b-a2 design contract plus live-reviewed bounded Cycle 1b-b2
runtime authentication, b3 authorization-matrix, b4 projection-query, b5
test-loader, b6 owner-DDL canary, b7 authenticated application-migration, and
b8 policy-scoped backup/restore boundaries; synthetic data only.

## Identity

Shared market identity and private product state are separate domains. Issuer,
security, share class, listing, and symbol history are distinct shared records;
a ticker is not a security identifier. Organization-owned theses, alerts,
idempotency records, and audit events always carry a non-null organization ID.
Private cross-references must include that organization ID so one tenant cannot
reference another tenant's object through a globally valid ID.

Application-created organizations, principals, theses, alerts, exports, and
audit events use UUIDs. Shared synthetic fixture identifiers may be stable
opaque strings. No nullable organization value means “global.”

## Time semantics

These concepts must not be collapsed:

1. `period_start` / `period_end` describe the financial reporting period.
2. `available_at` is when the source first became public.
3. `known_from` / `known_to` is the half-open interval during which a fact was
   publicly knowable, including explicit supersession by a restatement.
4. `system_from` / `system_to` is the half-open interval during which that
   version existed in our database. System time is controlled by persistence,
   not supplied by an external record.

All instants are UTC. Interval membership is `from <= instant < to`; a null end
is open. The storage contract requires `available_at <= known_from <=
system_from`. A future database-backed “as known” query must accept a public
knowledge cutoff and a system-recorded cutoff separately. The current memory
demo's one-cutoff wrapper is compatibility behavior, not the final query model.

## Numeric contract

Financial values cross boundaries as decimal strings and persist as fixed
precision numeric values with an explicit scale, unit, and optional ISO
currency. Binary floating point is not a financial storage type.

## Evidence and rights

Every fact references evidence and the exact immutable pair
`(rights_policy_id, rights_policy_version)`. Authorization is a grant over the
combined purpose, channel, territory, expiry, and classification—not the
Cartesian product of independent arrays. Unknown, expired, or mismatched
policy versions fail closed. Rights filtering happens before projection; no
counting bypass may reveal rows hidden by policy.

## Private-state invariants

- The trusted actor context binds organization and principal for the entire
  transaction; repositories never accept a tenant argument per method.
- Owner and researcher may mutate synthetic theses and alerts. Viewer may only
  read them. Export requires owner or researcher.
- Optimistic versions start at one and increase once per successful mutation.
- Idempotency is scoped by organization, principal, operation, and key, with a
  24-hour half-open lifetime. The current adapter replays only while the
  referenced resource remains at the recorded version; a later mutation fails
  the old replay rather than reconstructing its original response.
- Thesis and alert deletion removes the user payload and retains only a
  tenant- and resource-type-scoped, payload-free identifier marker so a
  deleted ID cannot be recreated as the same resource type. Security audit
  events are metadata-only and carry a 90-day
  retention deadline; a production purge job and backup-deletion proof remain
  pending.
- Mutation, idempotency, and success audit either commit together or all roll
  back.

## Proof boundary

The in-memory adapter proves use-case and repository behavior under
deterministic tests. The SQL package has a reviewed clean-only b1 run covering
its recorded PostgreSQL catalog, RLS, authorization, and sequential-context
probes. B1 does not prove an authenticated database session. A reviewed b2 run
now proves one ephemeral PostgreSQL runtime service account using SCRAM over
container-local TCP and explicitly selecting the existing read-only capability.
Its exact anchors and limits are in the
[Cycle 1b-b2 evidence note](./POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md).

Cycle 1b-b3 now implements a second execution path for the reviewed alpha/beta
tenant-visibility, inactive and non-current membership, direct/join/subquery,
operation-rights, and alternating prepared-read assertions. That path uses the
b2 SCRAM login and transaction-local runtime role selection, while the b1
administrator-impersonation path remains as a separate regression check. The
path passed in reviewed PostgreSQL run `31991498652` at commit `664c0e5b`; the
downloaded version 3 record returned `offline_consistent` against separately
supplied anchors. Exact scope and limits are in the
[Cycle 1b-b3 evidence note](./POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md) and
[exit matrix](./CYCLE_1BB3_EXIT_MATRIX.md). The result does not promote b1's
additional null/malformed/unsupported-context failures.

Cycle 1b-b4 passed a separate driverless query-to-normalizer path through the
same authenticated service account in PostgreSQL run `32007521395` at commit
`55c61ec`. The query used the reviewed listing -> share class -> security ->
financial fact and exact policy/grant joins, closed operation and unit mappings,
temporal cutoffs, and 100/101 fail-closed bound. The downloaded version 4 record
returned `offline_consistent`; see the
[Cycle 1b-b4 evidence note](./POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md) and
[exit matrix](./CYCLE_1BB4_EXIT_MATRIX.md). This is not an application adapter,
pool, composition root, complete/dimensioned projection, writer, or real-data
proof.

Cycle 1b-b5 source adds one separate acceptance-only fixture-load path. It
leaves the canonical fixture and migrations unchanged, uses a distinct
ephemeral SCRAM login with only an exact set-only edge to the existing
test-seed capability, and removes the login and membership before later catalog
checks. That exact path passed in reviewed PostgreSQL run `32012508025` at
commit `04e5c1b`; the retained version 5 record returned `offline_consistent`.
See the [B5 evidence note](./POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./adr/0017-authenticated-test-loader-fixture-load.md), and the
[Cycle 1b-b5 exit matrix](./CYCLE_1BB5_EXIT_MATRIX.md). This changes no data,
tenancy, projection, or application contract.

Cycle 1b-b6 adds a different, preparatory post-bootstrap path. One
ephemeral authenticated login may select only the existing owner capability for
one fixed transactional DDL canary. The reviewed run proved pre-role denial,
rejection of the reviewed forbidden role/session transitions, rollback, a
committed object with exact owner and ACL, authenticated removal, ledger
immutability, role reset, and zero authentication/object residue. That path
passed in PostgreSQL run `32058853521` at commit `7aac502`; the retained version
6 record returned `offline_consistent`. See the
[B6 evidence note](./POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./CYCLE_1BB6_EXIT_MATRIX.md). B6 changes no canonical
entity, tenancy, time, numeric, evidence, rights, or projection contract.

Cycle 1b-b7 also changes no canonical entity, tenancy, time, numeric, evidence,
rights, or projection semantics. It versions how the same clean application
contract is established: a local container-superuser platform phase creates
the capability roles, owner-owned schemas, ACL lockdown and hardened
`btree_gist`; a separate ephemeral non-superuser then authenticates with SCRAM,
selects only the owner capability, and applies the role-neutral application
plan with login-attributed ledger rows. The legacy manifest/bodies remain b1
through b6 regression-only inputs, not an alternate B7 authority. That bounded
path passed in PostgreSQL run `32068159652` at commit `41d13dd`; the retained
version 7 record returned `offline_consistent`. See the
[B7 evidence note](./POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](./adr/0019-versioned-authenticated-migration-phase.md), and the
[Cycle 1b-b7 exit matrix](./CYCLE_1BB7_EXIT_MATRIX.md).

The reviewed Cycle 1b-b8 result likewise changes no canonical
entity, tenancy, time, numeric, evidence, rights, deletion, or projection
semantics. It defines an authenticated, RLS-scoped, data-only archive of the 21
current synthetic application data tables, excluding the migration ledger,
followed by a bounded restore into a second database in the same pinned cluster.
The restore target's platform, exact v2 application schema, ownership, grants,
RLS, policies, constraints, routines, triggers, defaults, and ledger are
established independently before a separate authenticated test-seed session
restores the archive. That bounded path passed in PostgreSQL run `32076642878`
at commit `49d3a96`; the retained version 8 record returned
`offline_consistent`. See the
[B8 evidence note](./POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
and the [Cycle 1b-b8 exit matrix](./CYCLE_1BB8_EXIT_MATRIX.md).

That bounded result does not prove production identity or external
authentication. `session_user` identifies only the database service account;
it does not bind an end user to a principal or organization, and
`set_request_context` remains a trusted runtime operation rather than an
identity resolver. External/TLS transport, production secrets, connection-pool
cleanup, concurrency, external/production/incremental migrator and
external/production/incremental/continuous authenticated backup, full-schema/
global/cross-cluster/version restore, disaster recovery, storage encryption or
retention, RPO/RTO, and the future deletion path remain separate engine gates.
B8 closes only the exact synthetic, data-only, same-cluster acceptance result.
B5 closes only one sequential, synthetic, container-local acceptance-only
test-loader result. B6 does not execute a migration or close the
authenticated-migrator gate. The reviewed B7 result proves only the bounded
clean application migration after a separately committed local platform
bootstrap; it does not prove production/incremental migration or global
cross-phase atomicity.
The successful b3 run closes only the recorded synthetic authenticated
tenant/rights/prepared-read gap; it does not change any of these remaining
identity, transport, operational, or deployment gates.
A database adapter must not infer “no omissions” merely because RLS hid rows;
it needs an explicit completeness signal and must use `count: null` when an
exact count cannot be disclosed or established.

## Projection boundary

The complete source-controlled snapshot port and a future RLS database port are
different capabilities. An RLS read is operation-scoped to one exact
purpose/channel tuple and must return its instrument ID, public-knowledge
cutoff, system-recorded cutoff, and operation for core-side equality checks.
Candidate rows carry an instrument ID and frozen rights-policy ID/version; core
resolves the matching policy and does not trust a policy object attached by an
adapter. Display/API, derive/API, and alert/local-alert decisions are separate.
Authorization territory and evaluation time come from a trusted context
provider; a historical projection request supplies neither and therefore cannot
backdate policy expiry.

RLS projection completeness is only `known_incomplete` or `unknown`; neither
state may contain an expected or missing row count, and both serialize an
unknown omission count. The exact count in the memory dossier is evidence only
for the closed fixture, not a database adapter precedent.

Historical points and timeline events are instrument-scoped, synthetic snapshot
records. Evidence reuse is many-to-many through explicit instrument/evidence
bindings, and only bound citations can cross an instrument projection boundary.

The disconnected PostgreSQL wire normalizer covers only dimensionless
financial facts already joined to a listing, exact policy, and one
operation-specific grant. It validates lossless zoned timestamps, interval and
causal order, fixed decimals, canonical text/enums, identity echoes, and cutoff
membership before producing core candidates. The listing ID is the core
instrument ID; a fact's security ID or ticker may not be substituted. General
dimensioned unit mapping, a real database driver and application composition,
and complete dossier projection remain adapter-enablement blockers.
