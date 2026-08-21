# Canonical data and tenancy contract

Status: Cycle 1b-a2 design contract plus live-reviewed bounded Cycle 1b-b2
runtime authentication, b3 authorization-matrix, b4 projection-query, b5
test-loader, b6 owner-DDL canary, b7 authenticated application-migration, b8
policy-scoped backup/restore, b9 single-client projection-adapter, b10 bounded
projection-pool, b11 locked migration-ledger deployment, and b12 RLS
query-plan/load, b13 keyed privacy/retention, and b14 populated-cutover
boundaries, plus the source-stage Cycle 1c loopback research-state write
contract and reviewed bounded Cycle 2a filing-parser envelope;
synthetic data only.

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

The reviewed Cycle 1b-b9 result changes no canonical entity, tenancy, time,
numeric, evidence, rights, deletion, or projection semantics. Its source
implements the frozen operation-scoped port through one non-owning, exclusively
leased single-client, read-only `pg` adapter. Principal and organization come
from a separately injected trusted synthetic actor; they are not request fields.
The adapter snapshots the query and actor before I/O, resets transaction state,
selects the runtime capability and six-field context inside one read-only
transaction, executes the reviewed B4 query, and normalizes before commit. That
bounded path passed in PostgreSQL run `32083732063` at commit `8e470e9`; the
retained version 9 record returned `offline_consistent`. See the
[B9 evidence note](./POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](./CYCLE_1BB9_EXIT_MATRIX.md).

The reviewed Cycle 1b-b10 result also changes no canonical entity, tenancy,
time, numeric, evidence, rights, deletion, or projection semantics.
`PooledPostgresFinancialFactProjectionSource` owns a transferred, bounded
two-client `pg.Pool`, snapshots the same complete query and trusted synthetic
actor before checkout, and reimplements the exact B9 transaction and B4
normalization boundary independently on each client. Pool acquisition and
PostgreSQL statement execution are finitely bounded; only a fully reset,
successful checkout may be reused. An active abort marks cancellation, waits
for the in-flight operation to settle under the fixed server timeout, and then
destroys the checkout; a server timeout, failed transaction, or ambiguous
cleanup also prevents reuse. This is a locally verified source implementation,
not a new identity or canonical-data capability. The 12-file, 485-test database
suite, database typecheck, migration and PostgreSQL static guardrails, focused
lint/format, and diff checks pass. The bounded live path passed in PostgreSQL
run `32161137775` at commit `2dcb259`; its retained version 10 record returned
`offline_consistent`. See the
[B10 evidence note](./POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./adr/0022-bounded-postgresql-projection-pool-lifecycle.md), and the
[Cycle 1b-b10 exit matrix](./CYCLE_1BB10_EXIT_MATRIX.md).

Cycle 1b-b11 also changes no canonical entity, tenancy, time, numeric,
evidence, rights, deletion, or projection semantics. Its
`PostgresMigrationDeployer` snapshots the existing closed v2 plan and accepts
only an exact non-empty ledger prefix before applying reviewed pending bodies
and exact ledger rows under transaction-scoped locks. The acceptance-only
`v2-0005` reconstruction is a bounded test setup, not a new canonical state,
down-migration contract, or supported historical model. See
[ADR 0023](./adr/0023-locked-postgresql-migration-ledger-deployment.md) and the
[Cycle 1b-b11 exit matrix](./CYCLE_1BB11_EXIT_MATRIX.md). PostgreSQL run
`32183709701` passed the bounded live gate at commit `5df9d07`; its retained V11
record returned `offline_consistent`. See the
[B11 evidence note](./POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md).

Cycle 1b-b12 likewise changes no canonical entity, tenancy, time, numeric,
evidence, rights, deletion, or projection semantics. Its fixed module reuses the
exact B4 fact-as-known shape and adds one source-controlled tenant thesis read
only to inspect named-index use and exercise a deterministic synthetic load.
The B12 fixture and disposable clone are acceptance-only; 1,000 fact plus 1,000
tenant submissions do not add canonical records, complete dossier breadth, or
a production load model. Source, integrated local verification, and bounded live
V12 review are complete. PostgreSQL run `32230667908` passed at commit
`59c4e58`; its retained record returned `offline_consistent`. See the
[B12 evidence note](./POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./CYCLE_1BB12_EXIT_MATRIX.md).

Cycle 1b-b13 defines a separate, versioned privacy model for permanent thesis
and alert identifiers without changing historical v2 semantics. In the privacy
v1 plan, a canonical resource allocation is identified internally by
`allocation_id` and belongs to one tenant privacy domain. Its stable external
comparison value is a 32-byte `hmac-sha256-v1` token over the frozen domain,
resource-type, and resource-ID framing. The MAC key and derivation remain
outside PostgreSQL. The database treats the token as a pseudonymous identifier,
checks only its shape and uniqueness, and cannot attest that it is a genuine
HMAC.

A `live` allocation temporarily carries organization and resource UUIDs so the
thesis/alert row can hold an exact live-state foreign key. Hard deletion must
atomically remove that row and transition exactly one allocation to `deleted`,
clearing both raw UUIDs. The retained domain/type/token tuple is therefore not
a raw tenant/resource mapping and cannot be revived or reused. A tenant privacy
domain transitions only from `active` to `offboarding`; the transition blocks
new allocations before the fixed synthetic purge removes online resource
tokens and the tenant graph. External key destruction is a separate production
operation.

Policy v1 also fixes technical targets for 24-hour idempotency metadata,
90-day audit metadata, bounded 1,000-row transaction-clock purge batches,
24-hour online offboarding, and 30-day backup expiry. Those values are an
accepted synthetic technical decision, not a legal conclusion or evidence that
a scheduler, DSAR/legal-hold system, KMS/HSM, deletion across replicas/caches/
logs/search/analytics/third parties, or backup expiry/restore suppression is
operating. The B13 plan is pristine/empty-data-only; its separate bounded B14
successor does not widen that historical result. PostgreSQL run `32305478242`
passed the exact bounded synthetic lifecycle at commit `a959cba`; its retained
V13 record returned `offline_consistent`. See the
[B13 evidence note](./POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](./CYCLE_1BB13_EXIT_MATRIX.md).

B14 defines a separate transition into that keyed model for one populated,
synthetic pre-`0005` branch. At the capture boundary, every current thesis and
alert raw identifier enters a temporary audited work registry. Post-boundary
inserts and deletes update that registry while authenticated bounded backfill
assigns stable allocation IDs and externally derived tokens. Contract requires
the exact observed capture epoch, no pending work, complete bidirectional
source/registry correspondence, and a short final write-conflicting barrier
before the temporary capture surface is removed and the B13 lifecycle target
is finalized. There is no authoritative record for identifiers deleted before
capture. The acceptance writer identities do not define a production
allocation, authorization, or dual-write protocol. PostgreSQL run
`32343225599` passed this exact bounded synthetic transition at commit
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`; its retained V14 record returned
`offline_consistent`. The final target check is normalized semantic rather than
physical B13 catalog equivalence. See the
[B14 evidence note](./POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](./CYCLE_1BB14_EXIT_MATRIX.md).

Cycle 1c changes no canonical entity, tenant, temporal, numeric, evidence,
rights, deletion, or PostgreSQL contract. It composes the existing in-memory
service into only two seeded update operations. A fixed public fixture selector
resolves the synthetic organization and principal only for an exact loopback
peer; caller identity/tenant/role fields and authority headers are rejected.
The request body carries resource payload only, while a strong `If-Match`
supplies the expected version. Idempotency remains organization + principal +
operation + key scoped, where operation includes resource type and ID. Thus a
same-path key with a changed body or `If-Match` conflicts, authorization is
re-evaluated before replay, and an exact replay conflicts after the recorded
resource version has been superseded. Another path/resource is a separate
operation scope, so one resolved principal and organization may use an
identical key for independent valid thesis and alert writes. Responses omit
organization, principal, creator/updater, audit, and idempotency metadata.
Browser-local state remains separate. See
[ADR 0027](./adr/0027-loopback-synthetic-persona-research-state-api.md) and the
[Cycle 1c exit matrix](./CYCLE_1C_EXIT_MATRIX.md).

This Cycle 1c source is implemented and verified only for the bounded synthetic
loopback source/test contract; it is not remote/live-engine or production
evidence. The full frozen-byte local release gate and two-OS CI run
`32401541724` passed on exact commit
`84f6b92163e93fa8c5c079a786e49f8134b81f56`. Separate PostgreSQL run
`32401541467` is unchanged V14 regression health only; it is not Cycle 1c
engine evidence, B15/V15, or a replacement for the canonical B14 result at
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`. Cycle 1c does not widen any B1
through B14 result, and production admission remains blocked.

## Cycle 2a parser-envelope boundary

Cycle 2a adds no canonical market, tenant, research-state, evidence-passport,
or PostgreSQL entity. It defines one separate parser-domain candidate whose
only accepted facts are the two fixed synthetic sentinel concepts. The parser
candidate retains exact accession, accepted/available timestamps, parser and
taxonomy versions, unit, empty dimensions, source archive hash, synthetic
marker, and the exact built image ID in outside-worker signed provenance. It is
not persisted or projected into the canonical application model.

A rejected archive is represented only by an allowlisted quarantine code and
an empty fact array; partial facts and silent repair are forbidden. Exact-byte
replay equality applies to the normalized candidate and domain-separated
signing payload, not to application idempotency, delivery exactly-once, or
correction/supersession lineage.

The exact frozen-byte local `pnpm verify` gate passes format, lint, every
guardrail, seven-project typechecking, all builds, and 32 test files with 792
tests. Dedicated Linux run `32431896953` passed all 103 synthetic cases on
commit `73e391e339bf42332d7082adaba00807facc233c`; its retained canonical
artifact passed independent offline source review. It is not B15/V15, changes
no B1 through B14 or Cycle 1c result, and is not composed into the API, web,
database, or real-data model. See
[ADR 0028](./adr/0028-bounded-synthetic-filing-parser-isolation.md) and the
[Cycle 2a exit matrix](./CYCLE_2A_EXIT_MATRIX.md), with exact anchors in the
[Cycle 2a evidence note](./FILING_PARSER_ISOLATION_EVIDENCE.md).

## Cycle 2b candidate-manifest admission boundary

Cycle 2b Phase A adds no canonical filing, fact, evidence-passport, rights,
tenant, research-state, or PostgreSQL entity. It implements only a
side-effect-free verifier protocol over exact candidate-manifest, selection,
adjudication, authority, and approval bytes. No real configuration or approval
exists. The exact 34-file/810-test local source gate and
[CI run 32447542432](https://github.com/liangzixuan/investing-pro/actions/runs/32447542432)
pass for commit `b9a9edf680b4c3a7373cd6d96210a24544ba0bbe`; Cycle 2b
remains blocked.

The future manifest contract requires exactly 100 unique content-addressed
filing accessions with closed CIK, form, accepted/available time, taxonomy, and
amendment metadata. Selection strata and an adjudication protocol are frozen
before results. Distinct `rights_authority` and `data_steward` signatures bind
the exact inputs, evaluation purpose, and retention class. Success returns only
a closed schema/claim/corpus/version/evaluation identity, aggregate input
hashes, count, validity, and `status: "admitted"`; it does not project candidate
entries or approval bodies into the canonical product model.

Both approval signatures include the exact `authorityKeysSha256` for the
supplied validity/revocation registry. `status: "admitted"` proves only internal
schema and cryptographic consistency under that syntactically untrusted input;
it does not identify or authenticate an authority, counsel, or steward. Future
promotion requires a human/host to compare the registry digest to the reviewed
out-of-band anchor. Signed timestamp/hash consistency does not prove the
absence of earlier parser or adjudication results; that chronology is
externally attested.

The target claim
`fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission`
has not been established. An external inventory, both signatures, and human
key-authority review are absent. The protocol does not observe raw payload
bytes, validate declared digests against files, normalize facts, execute
lineage, or establish source authenticity, legal validity, revocation
freshness, quality, application/database composition, B15/V15, or production
admission. See
[ADR 0029](./adr/0029-fixed-public-filing-candidate-manifest-admission.md) and
the [Cycle 2b exit matrix](./CYCLE_2B_EXIT_MATRIX.md).

These bounded database results do not prove production identity or external
authentication. `session_user` identifies only the database service account;
it does not bind an end user to a principal or organization, and
`set_request_context` remains a trusted runtime operation rather than an
identity resolver. External/TLS transport, production secrets, load-ready pool
tuning/failover, prompt queued or graceful cancellation, load capacity,
external/production/incremental migrator and
external/production/incremental/continuous authenticated backup, full-schema/
global/cross-cluster/version restore, disaster recovery, storage encryption or
retention, RPO/RTO, and the future deletion path remain separate engine gates.
B8 closes only the exact synthetic, data-only, same-cluster acceptance result.
The reviewed B9 result remains one sequential, exclusively leased synthetic
service client, not an end-user identity, application composition, or pool
result. B10 separately defines a bounded two-client pool/concurrency/
cancellation boundary whose pinned V10 run and independent artifact review are
complete. Production pool tuning, load capacity, retry/failover, graceful
cancellation, prompt queued abort, and application composition remain outside
B10. B11's reviewed result covers only one exact v2 suffix; external or
production credentials, arbitrary/multi-release upgrades, online application
compatibility, crash recovery, cancellation, distributed coordination, global
atomicity, and production readiness remain outside it.
B12's reviewed result remains bounded to two exact synthetic plan shapes,
2,000 queued reads, and at most eight runtime workload backends. It does not
establish 1,000/2,000 simultaneous connections, production capacity or SLOs, pool
tuning/failover, planner stability across other data/statistics/hardware/
versions, real data, application composition, or production readiness.
B13's reviewed result remains bounded to the exact synthetic,
pristine/empty-data-only keyed-identifier lifecycle. It does not establish
production privacy/legal approval, verified DSAR or legal-hold handling,
operating scheduler/monitoring, KMS/HSM custody or token authenticity,
cryptographic erasure, deletion across external planes, populated cutover,
global deletion proof, real-data admission, application composition, or
production readiness.
B14's reviewed live transition remains bounded to synthetic data in one fixed
disposable database. It does not establish continuous zero downtime,
production writer integration or allocation-gap handling, production
scale/locks/SLOs, crash/failover/restart or downgrade behavior, recovery of
pre-capture deletions, physical catalog equivalence, real-data admission, or
production readiness.
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

The complete source-controlled snapshot port and the reviewed B9 RLS database
adapter are different capabilities. An RLS read is operation-scoped to one exact
purpose/channel tuple and must return its instrument ID, public-knowledge
cutoff, system-recorded cutoff, and operation for core-side equality checks.
Candidate rows carry an instrument ID and frozen rights-policy ID/version; core
resolves the matching policy and does not trust a policy object attached by an
adapter. Display/API, derive/API, and alert/local-alert decisions are separate.
Authorization territory and evaluation time come from a trusted context
provider; a historical projection request supplies neither and therefore cannot
backdate policy expiry. B9's actor provider separately supplies principal and
organization. PostgreSQL membership and policy RLS use transaction time;
`evaluatedAt` remains a core rights clock and is not a database-authorization
override.

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
dimensioned unit mapping, application composition, and complete dossier
projection remain product/composition blockers.
