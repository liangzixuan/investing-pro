# Canonical data and tenancy contract

Status: Cycle 1b-a2 design contract plus live-reviewed bounded Cycle 1b-b2
runtime authentication, b3 authorization-matrix, b4 projection-query, b5
test-loader, b6 owner-DDL canary, b7 authenticated application-migration, b8
policy-scoped backup/restore, b9 single-client projection-adapter, b10 bounded
projection-pool, b11 locked migration-ledger deployment, and b12 RLS
query-plan/load, b13 keyed privacy/retention, and b14 populated-cutover
boundaries, plus the source-stage Cycle 1c loopback research-state write
contract, historically reviewed Cycle 2a filing-parser envelope, Phase-A Cycle
2b metadata verifier, historically reviewed Cycle 2c synthetic payload custody,
historical source-stage Cycle 2d synthetic ten-fact normalization/lineage,
historical source-stage Cycle 2e two-declared-validator fact comparison, whose
historical bounded owned-byte security conclusions remain Superseded on their
original bytes;
Cycle 2f declared-reference quality measurement with both its original and
`df1ddff` restoration conclusions Superseded, plus historical source-stage
Cycle 2g in-process candidate-observation precommitment at that same commit now
also Superseded, and Cycle 2h cross-boundary intrinsic byte-snapshot hardening
Pass only on exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, restoring the Cycle 2a–2g bounded
owned-byte premises only on that hardened successor; promoted source-stage
Cycle 2i authenticated synthetic parser-result-to-normalization handoff Pass
only for exact source commit `5a1589ede57e00d6ff60521e7b53bea2ac849b0a`;
Cycle 2j isolated ten-fact parser execution-to-normalization Pass only for exact
source commit `b2c7a28c2c5720253eba275b65d3313b114c3bc4` from baseline
`f17bacc6adc46851e182d260d59830652f1953bb`;
Cycle 2k bounded synthetic cross-engine execution historical evidence Pass only
for exact source commit `54908db1ded8193ac4ade7a3d6f38505c6b4b8e5` from baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, with its security conclusion and
claim now Superseded; Cycle 2l current-input and reciprocal-lineage hardening
Pass only for exact source commit `2e3a7e33a76d19b993375958aff671707a81ef05`,
the corrective child of failed precursor
`67af24176df3c17fd6d54498095888c9a43ebe1f` from baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`;
Cycle 2m source-owned direct-Docker lifecycle binding Pending source
implementation from exact baseline
`1cb7d3ce024cbd29665af7ec4e010da0c380b726`;
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

## Cycle 2c synthetic payload-custody boundary

Cycle 2c adds no canonical filing, fact, evidence-passport, corpus-admission,
tenant, research-state, or PostgreSQL entity. It defines one isolated generated
fixture lifecycle: a fixed 4,096-byte synthetic payload, its SHA-256 content
identity, a separate source-binding digest, one opaque internal payload ID, a
fixed 24-hour retention class, and a closed versioned receipt/audit shape.
Plaintext, ciphertext, key IDs, keys, nonces, tags, filesystem paths, and
rejected values never enter the canonical product model.

The injected entropy provider is an out-of-band trusted CSPRNG TCB. Source
validates only the returned byte shape and exact requested length, not
randomness or uniqueness. The dedicated Linux record is limited to
observed Node `crypto.randomBytes` use and distinct DEK-fingerprint and
nonce-hash samples in that run; it cannot establish OS entropy quality. None of
those observations creates a canonical entropy or production-key entity.

The caller's content digest is only an integrity assertion. It is not SEC or
source provenance and cannot prove any real payload exists. Canonical AAD binds
the schema, claim, algorithm, fixture/content/source/payload/key identities,
byte length, creation/expiry, retention class, and fixed key/nonce/tag sizes.
Read revalidates the authenticated record, ciphertext, and resulting plaintext
hash. Expiry forgets the injected key, retains the closed available/terminal
audit-domain history, and then removes ciphertext. Only the public aggregate
view enters the product model. The terminal state is exactly
`logical_key_unavailability`, not physical deletion or cryptographic erasure.

The bounded synthetic claim was historically accepted on exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4`; its bounded owned-byte security
conclusion is now Superseded on those bytes. Exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0` restores only that bounded premise.
The final successor-compatible
local `pnpm verify` gate passed format, lint, every guardrail including 86
production-license checks, all project typechecks and builds, and 39 test files
with 848 passed tests plus 2 POSIX-only Windows skips (850 total cases). Two-OS
CI run `32463955370`, dedicated Linux custody run `32463955421`, exact-commit
offline review, and independent retained artifact/log review passed on
`ef22c7bc10596840b8ff686b9190730956fab0c4`. The later local compatibility
result does not replace or widen that canonical live evidence. This does not
alter Cycle 2b's blocked external approval/authority gate, compose with
parser/API/web/database/queue paths, create B15/V15, admit real data, or
establish production storage, KMS, retention, deletion, backup, or operational
readiness. See
[ADR 0030](./adr/0030-bounded-synthetic-filing-payload-custody.md) and the
[Cycle 2c exit matrix](./CYCLE_2C_EXIT_MATRIX.md), with exact anchors in the
[Cycle 2c evidence note](./FILING_PAYLOAD_CUSTODY_EVIDENCE.md).

## Cycle 2d synthetic fact-normalization boundary

Cycle 2d adds no canonical filing, evidence passport, rights policy, tenant,
research-state, database, or production-ingestion entity. The caller supplies
exactly two byte documents matching one closed synthetic original-10-K and
10-K/A schema, and the boundary immediately takes fresh owned snapshots before
validation. Each document has exactly the same frozen ten launch-fact keys.
Tests generate the canonical pair, but the boundary does not authenticate its
generator or provenance. The disconnected output is a
closed normalization candidate and lineage proof, not an admitted product fact
or persistence command.

Each version binds its synthetic source accession and hash, accepted/available
times, parser and taxonomy metadata, decimal value, permitted unit,
instant/duration reporting period, and dimensions. Derived identifiers and the
single predecessor are deterministic. The source-known interval is half open:
the original is knowable from original availability until amendment
availability, and the amendment is knowable from that instant onward. The
normalizer does not invent `systemRecordedFrom` or `systemRecordedTo`; those
remain persistence-controlled concepts. Unchanged and changed values both
retain their distinct source version and predecessor lineage.

Local verification is Pass on exact frozen bytes: format, lint, guardrails, all
project typechecks and builds, 86 production-license checks, and 41 test files
with 876 passed plus 2 POSIX-only Windows skips (878 total cases: parser 65;
custody 36 passed plus 2 skipped; normalization 26; DB 582; API 49; state 48;
contracts 5; core 62; web 3). The bounded source-stage claim, local gate, and
two-OS CI historically passed for exact source commit
`f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`; CI run `32511008752` passed in
Windows job `96861883906` and Ubuntu job `96861884146`. Parser run/job
`32511008497` / `96861883641`, custody run/job `32511008447` / `96861883543`,
and PostgreSQL run/job `32511008417` / `96861882949` are unchanged regression
health on that commit, not Cycle 2d evidence. Cycle 2d has no dedicated
workflow, evidence schema, artifact, offline evidence review, or evidence note.
It does not alter Cycle 2b's blocked external approval/authority gate, compose
with parser/custody/API/web/database/queue paths, create B15/V15, admit real
data, or establish parser/accounting correctness, independently adjudicated
quality, complete correction discovery, or production readiness. See
[ADR 0031](./adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
and the [Cycle 2d exit matrix](./CYCLE_2D_EXIT_MATRIX.md).

## Cycle 2e synthetic fact-comparison boundary

Cycle 2e adds no canonical filing, admitted fact, evidence passport, rights
policy, persistence command, or production entity. Two fixed argument roles
carry complete canonical synthetic normalization envelopes. Separate strict
validator modules each prove the closed twenty-version/ten-edge payload shape,
source-preimage fact identities, lineage pointers, metadata, chronology, and
known windows before the comparison boundary examines agreement.

Agreement means byte equality of the complete canonical normalized payload,
not digest, subset, count, or selected-field equality. Success returns only an
immutable metadata receipt with source/report/agreement hashes, exact aggregate
counts, and the two declared bindings. It does not expose normalized facts or
lineage and is not an admission or persistence token. Any invalid input or byte
conflict produces coarse, empty, value-free aggregate quarantine with no
hashes, validator metadata, mismatch position, values, preferred output, merge,
or repair.

The A/B role, identifier, version, and implementation digest fields are fixed
declarations. Two separate same-package modules do not establish validator,
parser, codebase, process, host, operator, key, or failure-domain independence,
authenticity, or digest-to-executable correspondence. Local verification is
Pass on exact frozen bytes: `corepack pnpm verify` passed all format, lint,
guardrail, typecheck, test, and build stages with 43 test files, 911 passed plus
2 skipped (913 total), all 11 workspace project checks, and 10 builds. The
bounded source-stage claim, local gate, and two-OS CI historically passed for exact
source commit `60b92aa527435904776144f5e2d5a1a3ab61e67e`; CI run `32518970387`
passed in Ubuntu job `96886795980` and Windows job `96886796247`. Parser
run/job `32518970423` / `96886796118`, custody run/job `32518970453` /
`96886796256`, and PostgreSQL run/job `32518970454` / `96886796382` are
unchanged regression health only, not Cycle 2e evidence. Cycle 2e has no
dedicated workflow, evidence schema, artifact, offline review, or evidence
note; leaves Cycle 2b and production Blocked; creates no B15/V15 composition;
and admits no real data. See
[ADR 0032](./adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
and the [Cycle 2e exit matrix](./CYCLE_2E_EXIT_MATRIX.md).

## Cycle 2f synthetic quality-measurement boundary

Cycle 2f adds no canonical filing, ground-truth entity, admitted fact, evidence
passport, persistence command, rights policy, or production quality record.
Exactly three bounded canonical byte documents occupy fixed plan, candidate,
and declared-reference roles. The boundary takes fresh owned snapshots before
closed-schema validation. Fixed role identifiers and declaration digests are
synthetic declarations, not authenticated adjudicator, parser, or authority
identities.

The declared reference contains exactly 100 unique synthetic document labels
and ten fixed fact coordinates per document. Those 1,000 fact targets are the
complete denominator. The evaluator derives `semantic_value_presence` and
`exact_unit_period` for every target, accounts for exactly 2,000 critical
assertions, and rejects duplicate, omitted, excluded, or reweighted reference
coordinates. It derives all counts, classifications, denominators, assertion
outcomes, and metrics; none enters as caller-supplied canonical state.

The only explicit candidate row statuses are `succeeded` and `quarantined`. A
succeeded row may contain zero through ten sorted unique known-coordinate facts;
fewer than ten is valid measured incomplete, with no caller partial flag, and
absence is derived as missing. Exact facts are true positives. A wrong fact
creates one false positive plus one false negative, and each omitted expected
fact creates one false negative plus two silent assertion failures. Missing or
mismatched succeeded output is silent; explicit quarantine is not silent but
still reduces document success and recall and increases quarantine rate.
Undefined precision or recall denominators fail closed.

The fixed synthetic-pilot threshold policy is document success `>=95/100`, fact
precision and recall `>=99/100`, quarantine rate `<=5/100`, zero silent critical
failures, exact canonical units, and zero-day period tolerance. Ratios use
integer cross-multiplication without float, rounding, epsilon, or caller
tolerance. A valid below-threshold population remains `status: "evaluated"`
with outcome `not_met`; it is not malformed-input quarantine.

An evaluated result is immutable and aggregate-only: input/evaluation hashes,
counts, metrics, failed thresholds, and synthetic-pilot outcome. It carries no
labels, coordinates, concepts, dimensions, units, periods, decimals, or values.
Malformed input yields one coarse code, zero audit counts, and an empty metric
array, with no hashes, mismatch location, input detail, threshold detail, or
canary.

The prior bounded source-stage security conclusion for exact source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` is Superseded. Its recorded local
release run and CI run `32681826143` in Ubuntu job `97299715600` and Windows job
`97299715638` were green, but shadowable typed-array buffer/length metadata and
constructor/species snapshot allocation made the bounded owned-snapshot check
false on those bytes. Those runs are historical green gate facts only. Current
hardened Cycle 2f bytes use intrinsic typed-array metadata and allocation. The
exact final local restoration gate and Cycle 2g Ubuntu/Windows CI passed at
`df1ddffdede9900302da34160ce6b9a62b9d1708`, but that restoration is now also
Superseded because backing prototype equality did not intrinsically brand an
`ArrayBuffer`, while carrier prototype equality did not prove the intrinsic
`Uint8Array` element type; re-prototyped shared backing and alternate typed
arrays remained admissible. Cycle 2h restores the bounded owned-byte premise
only for exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. Parser run/job
`32681826015` / `97299715074`, custody run/job
`32681826030` / `97299715006`, and PostgreSQL run/job `32681826040` /
`97299715107` remain unchanged regression health only, not Cycle 2f evidence.
Cycle 2f creates no
dedicated workflow, evidence schema, artifact, offline review, or evidence
note. It does not establish independent adjudication, blinding,
declared-reference correctness, real parser quality, threshold adequacy, Cycle
2b authority, full Cycle 2 exit, B15/V15, or production readiness. See
[ADR 0033](./adr/0033-bounded-synthetic-declared-reference-quality-measurement.md)
and the [Cycle 2f exit matrix](./CYCLE_2F_EXIT_MATRIX.md).

## Cycle 2g synthetic declared-reference precommitment boundary

Cycle 2g adds no canonical filing, admitted fact, persistent commitment,
credential, authority, evidence passport, database command, rights policy, or
production quality record. The package owns only transient in-process protocol
state for one factory instance: `open`, `candidate_committed`, or `consumed`.
There is no retry, reset, replacement, persistence, recovery, or serialization
of state authority.

The commit input is a bounded canonical plan plus one closed
`candidate_observations_precommit` document. The candidate observation contains
the exact declared-reference SHA-256 commitment and a synthetic candidate
snapshot validated against the closed coordinate space, with omissions
preserved for fail-closed evaluation, but no raw reference bytes/content,
caller `producedAt`, metric, count, weight, exclusion, assertion outcome, or
quality result. The boundary validates and owns the bytes before returning an
aggregate receipt and one empty frozen identity-bound capability. The
capability has no fields and cannot be serialized, cloned, or transferred to
another instance.

The Cycle 2g transition also hardens the byte carrier boundary shared with the
public Cycle 2f evaluator. Both use intrinsic typed-array backing-buffer and
byte-length getters, require an ordinary `ArrayBuffer`, allocate an ordinary
`Uint8Array`, and copy with the intrinsic typed-array `set`. Caller-owned
`buffer`, `byteLength`, `constructor`, or `Symbol.species` properties therefore
cannot spoof the carrier metadata or redirect snapshot allocation.

Every reveal consumes before capability, reference, or dependency validation.
The reference byte digest must equal the committed digest. Only then does the
protocol inject the fixed Cycle 2f candidate role and compatibility
`producedAt`, derive the Cycle 2f candidate, and call the public Cycle 2f
evaluator. The nested measurement is a fresh owned deep-frozen aggregate copy.
A valid below-threshold measurement remains `evaluated` / `not_met`; failure
returns only a coarse closed quarantine code, zero audit counts, and
`measurement: null`, without hashes, capability, mismatch detail, observation,
reference content, or canary.

The local gate and two-OS CI at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708` remain historical green facts, but
the Cycle 2g bounded owned-byte security conclusion and Cycle 2f restoration
are Superseded. Backing prototype equality did not intrinsically brand an
`ArrayBuffer`, carrier prototype equality did not prove the intrinsic
`Uint8Array` element type, and re-prototyped shared backing and alternate typed
arrays remained admissible. Cycle 2g also performed a proxy-sensitive prototype
check before complete intrinsic brand validation. Cycle 2h restores the bounded
owned-byte premise only for exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.
The local gate
passed formatting, full ESLint, all guardrails, 86 production license versions,
every scripted
typecheck/test/build across 12 of 13 workspace projects, 47 test files with 987
passed plus two skipped (989 total), and the boundary verifier. Cycle 2g has no
dedicated workflow, evidence schema, artifact, offline review, or evidence note.
CI run `32690685837` passed in Ubuntu job `97323672725` and Windows job
`97323672813`. Parser run/job `32690685841` / `97323672800`, custody run/job
`32690685846` / `97323672628`, and PostgreSQL run/job `32690685829` /
`97323672631` passed as unchanged regression health only; they are not Cycle 2g
or Cycle 2f restoration evidence. Cycle 2g cannot establish actual reference inaccessibility,
label secrecy, authenticated or durable chronology, external capability
security, independent adjudication, real parser quality, Cycle 2b authority,
full Cycle 2 exit, B15/V15, or production readiness. Cycle 2f's prior CI
anchors remain historical green gate facts for source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` only; the hardened Cycle 2f claim
was historically restored at `df1ddffdede9900302da34160ce6b9a62b9d1708`.
That restoration and the Cycle 2g conclusion are now Superseded; the original
`72e91f5` conclusion remains Superseded. See
[ADR 0034](./adr/0034-bounded-synthetic-declared-reference-precommitment.md)
and the [Cycle 2g exit matrix](./CYCLE_2G_EXIT_MATRIX.md).

## Cycle 2h cross-boundary intrinsic byte-snapshot hardening

Cycle 2h adds no canonical filing, fact, evidence passport, rights policy,
tenant, persistent commitment, database command, or production entity. It
changes only how existing Cycle 2a through Cycle 2g public and injected
`Uint8Array` roles establish an owned byte snapshot. The affected inventory is
the parser archive, injected signer signature output, create/start/remove/residue
process-runner stdout/stderr, seven corpus-admission documents, the custody
staging payload/five semantic entropy outputs/key-store reads and writes, two normalization documents, two comparison
reports, three quality-measurement documents, and three quality-precommitment
documents.

Each boundary invokes intrinsic typed-array backing-buffer, byte-length, and
`%TypedArray%.prototype[Symbol.toStringTag]` getters before proxy-sensitive
prototype checks, then requires intrinsic element type `Uint8Array` plus exact
`Uint8Array.prototype`, brand-checks actual `ArrayBuffer` internal slots, and
requires exact `ArrayBuffer.prototype`. It applies the role's actual internal length
limit—including exact 64-byte signatures and each process request's stream
limits—before owned-snapshot allocation, allocates a
direct ordinary `Uint8Array`, and copies with intrinsic `set.call`. Caller own
`buffer`, `byteLength`, iterator, constructor, `Symbol.species`, accessor,
proxy, or instance-method hooks neither supply admission metadata nor receive
snapshot allocation/copy dispatch. Accepted input is owned before parsing,
validation, asynchronous work, storage, or comparison. Cycle 2a alone hashes
an exact oversized archive synchronously without allocating a copy so the
existing signed `archive_limit_exceeded` quarantine remains unchanged.

No canonical failure or output schema changes. Existing Cycle 2a invalid-input
and signed quarantine, Cycle 2b invalid-input/document-invalid, Cycle 2c
invalid-input/key-store wrapping, Cycle 2d empty document quarantine, Cycle 2e
empty conflict quarantine, Cycle 2f measurement quarantine, and Cycle 2g
one-shot protocol/measurement quarantine remain coarse and value-free. Focused tests cover
hostile metadata, accessor, iterator, constructor/species, instance-method,
backing, re-prototyped alternate typed-array, subclass, detached, proxy, and
mutation behavior across the inventory.

The prior Cycle 2a through Cycle 2g bounded owned-byte security conclusions on
their original bytes remain Superseded. Their exact local, CI, live, artifact,
and review anchors remain historical facts only. Cycle 2h's sole target claim is
`bounded_synthetic_cycle2_public_uint8array_ingress_intrinsic_backing_and_length_validation_owned_copy_and_no_caller_metadata_iterator_or_allocation_dispatch`.
It is Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`; the frozen-byte local gate,
Ubuntu/Windows CI, parser live acceptance, and custody live acceptance all
passed. Those exact hardened bytes restore the Cycle 2a–2g bounded owned-byte
premises without reviving their historical conclusions.

Cycle 2h is the exact 40-path transition (38 modified, two added) from
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`, with exactly 82 cumulative
unique Cycle 2c history paths because all eight added Cycle 2f/Cycle 2g paths
already exist in cumulative history. The existing historical custody fixture
manifest is the additional transition path and adds no new union path; it
refreshes only the two changed custody source/test SHA-256 entries, while
fixture cases, schema, order, and payload identity/content remain unchanged. It leaves the historical exact
32-path/73-unique Cycle 2g transition immutable; one pinned intervening database-test maintenance path
raises pre-Cycle 2h cumulative history to 74 and is not evidence. The canonical
Cycle 2a/Cycle 2c schemas, artifacts, notes, checks, nonclaims, and source sets
remain unchanged. Cycle 2f's original `72e91f5` conclusion remains Superseded;
its restored claim and Cycle 2g's claim at `df1ddff` remain Superseded
because prototype equality admitted re-prototyped shared backing and alternate
typed-array element types. Their non-carrier schemas, checks, nonclaims, arithmetic,
state, capability, delegation, historical anchors, and no-evidence status
remain unchanged.

For exact source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, CI run
`32757171049` passed in Ubuntu job `97527284364` and Windows job `97527284624`.
Parser run/job/artifact `32757171096` / `97527284903` / `9531335028` and custody
run/job/artifact `32757171127` / `97527284597` / `9531290999` passed runtime
acceptance and commit-bound review on attempt 1. Parser and custody remain
regression and historical-boundary anchors, not a new Cycle 2h evidence domain.

Baseline CI `32695006904` and PostgreSQL `32695006890` are historical health
only. Parser `32695006897` and custody `32695006869` passed source/test stages
but failed at `commit_boundary` on the already-pinned unrelated database path;
no runtime acceptance occurred. Cycle 2h creates no new package, dependency,
workflow, new evidence schema, new/dedicated/live evidence artifact, evidence
note, or application composition. The refreshed existing local custody manifest
is a fixture-integrity anchor, not new live evidence. Cycle 2h establishes no primordial hardening, process isolation, real source
authenticity, Cycle 2b authority, independent validation/adjudication, real
quality, durable precommitment, network safety, production custody/KMS, full
Cycle 2 exit, or production admission. See
[ADR 0035](./adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md) and
the [Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md).

## Cycle 2i authenticated parser-normalization handoff boundary

Cycle 2i adds no canonical admitted filing, parser execution, normalized fact
authority, evidence passport, rights policy, tenant, persistent record,
database command, or production entity. Its private
`@research-cockpit/filing-parser-normalization-handoff` package defines one
disconnected synthetic transport result: an immutable Cycle 2d normalized
record paired with aggregate handoff provenance after an exact four-role input
set passes.

The four roles are the original raw archive, amendment raw archive, canonical
Ed25519-signed original complete ten-fact parser-result envelope, and canonical
Ed25519-signed amendment complete ten-fact parser-result envelope. Archive,
envelope, and supplied public-key byte carriers are owned and bounded. The
boundary recomputes each raw-archive SHA-256, requires the corresponding signed
source binding, verifies each canonical domain-separated signature under the
supplied public key, and requires the supplied expected key/image identities.
These fields record internally verified synthetic call provenance, not signer,
key, image, SEC, counsel, steward, or filing authority.

The embedded documents are reconstructed as exact canonical original/amendment
Cycle 2d bytes and delegated to `normalizeSyntheticFilingFactPair`. Cycle 2d
then validates the closed ten-fact roles, parser, taxonomy, concept, unit,
period, dimension, source, amendment-lineage, and pair contracts. Missing,
duplicate, defaulted, inferred, repaired, or silently remapped facts cannot
produce a successful handoff. Cycle 2i neither creates a parallel normalizer
nor changes the Cycle 2d canonical document, normalized record, fact-version,
or lineage contracts.

A successful handoff exposes the unchanged normalized record plus immutable
aggregate counts, expected key/image identifiers, the canonical SPKI hash, and
a pair binding over both source hashes, both Cycle 2d document hashes, and the
key/image/SPKI identities. It does not hash the signed-envelope or signature
bytes or the normalized result. That aggregate is not admitted filing
provenance, an evidence passport, an authority decision, or durable custody.
Every invalid carrier,
envelope, signature, provenance assertion, archive binding, role or fact set,
pair lineage, dependency failure, or downstream quarantine maps to one empty
value-free handoff quarantine. Failure has no canonical facts, normalized
record, archive/document hashes, provenance identifiers, mismatch detail, or
canary content.

The sole target claim is
`bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff`.
Implementation and promotion are Pass only for exact source commit
`5a1589ede57e00d6ff60521e7b53bea2ac849b0a` from baseline
`dda2ecafc70aa6c4859a29cb312849bac5dec253`: 21 exact transition paths (9 added,
12 modified), a frozen local gate with 1,064 passed tests and 3 skips, and CI
run `32817294734` with Ubuntu job `97708048290` and Windows job `97708048027`.
Parser run/job `32817294720` / `97708047987`, custody run/job `32817294732` /
`97708048009`, and PostgreSQL run/job `32817294741` / `97708049006` passed as
regression health only. Cycle 2i adds no dedicated workflow, evidence schema,
artifact, review, or note and does not modify historical Cycle 2a or Cycle 2d evidence. It cannot
establish actual parser execution/correctness, key or source authority, real
inputs, Cycle 2b approval, independence, adjudicated quality, persistence, B15/V15, full Cycle
2 exit, real-data admission, or production. See
[ADR 0036](./adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
and the [Cycle 2i exit matrix](./CYCLE_2I_EXIT_MATRIX.md).

## Promoted Cycle 2j parser-execution normalization boundary

Cycle 2j adds no canonical real filing, authority decision, tenant record, or
persistent production entity. It adds one disconnected synthetic execution
result: exactly one original and one amendment archive execute in
fresh bounded workers; the host validates their complete canonical Cycle 2d
ten-fact documents, signs Cycle 2i envelopes outside the workers, and delegates
the exact archive/envelope bytes to the unchanged Cycle 2i handoff.

Only a Cycle 2i `normalized` result may expose the immutable normalized pair and
bounded aggregate execution provenance. Any archive, worker, output, cleanup,
source binding, signature, role, mutation, or downstream failure must expose one
empty value-free execution quarantine. The sole claim is
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`.
It is Pass only for exact source commit
`b2c7a28c2c5720253eba275b65d3313b114c3bc4` from baseline
`f17bacc6adc46851e182d260d59830652f1953bb`: the 44-path transition, 1,095-pass
local gate, all exact-source workflows, dedicated run `32897837981`, retained
artifact `9581921300`, and 51-of-51 `offline_consistent` review passed.

This promoted bounded contract creates no real source, signer/image authority,
independent second parser, adjudicated quality, custody, API/web/database/queue
composition, B15/V15, real-data admission, or production authority. See
[ADR 0037](./adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
and the [Cycle 2j exit matrix](./CYCLE_2J_EXIT_MATRIX.md).

## Historical Cycle 2k cross-engine execution agreement

Cycle 2k adds no canonical real filing, authority, quality, tenant,
persistence, or production entity. From exact baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, through failed precursor
`14b4ecf41806dca7759a06bebf7ef8da96374f76`, failed corrective revision
`061944f8f770e8a08b2a38d1e2fedf8b8e2de348`, failed recovery revision
`f29e39cea40e76d500df833fd8e0e94e0c86a68c`, failed diagnostic revision
`abd65313705282dab8071f5d36c78d31b1720ee3`, and exact diagnostic recovery
child `54908db1ded8193ac4ade7a3d6f38505c6b4b8e5`, it executes the same
owned synthetic original/amendment pair through the existing Cycle 2j Python
worker and a distinct zero-install pinned Node worker. Per-role complete
canonical stdout documents and both complete Cycle 2d normalization records
must agree byte for byte; otherwise the result is one atomic empty value-free
quarantine. The historical sole claim was
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`.

The historical execution evidence passed only for exact source commit
`54908db1ded8193ac4ade7a3d6f38505c6b4b8e5`: the exact five-commit chain,
44-path transition, full local and exact-source workflow gates, dedicated
run/job `32917020041` / `98022742591`, retained artifact `9588542275`, and
66-of-66 `offline_consistent` review passed. The evidence binds both engines,
four live outcomes, 16 checks, and 16 nonclaims. Failed runs `32910394736`,
`32912204603`, `32913611954`, and `32915949116` remain immutable historical
non-evidence with zero artifacts. Every historical evidence record and anchor
remains immutable.

The execution facts above remain exact historical records, but the Cycle 2k
security conclusion and claim are Superseded. The boundary did not require each
child receipt and normalized fact to bind to the current invocation's archive
pair, so cached valid receipts from unrelated archives could be accepted while
outer provenance named the new inputs. It also did not validate the complete
per-key reciprocal lineage relation, so identical common-mode lineage mutations
could pass byte-exact cross-engine agreement.

Distinct language, source, image, and process identities do not prove true
organizational, operator, key, host, or failure-domain independence. The
historical bounded result cannot establish general parser/accounting correctness, real
SEC/source authority, Cycle 2b approval, independently adjudicated real quality,
real-data admission, B15/V15, full Cycle 2 exit, or production. Cycle 2b remains
externally Blocked on the exact inventory, rights/steward approvals, chronology,
authority keys, and human review. See
[ADR 0038](./adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
and the [Cycle 2k exit matrix](./CYCLE_2K_EXIT_MATRIX.md).

## Promoted Cycle 2l current-input and reciprocal-lineage agreement

Cycle 2l adds no canonical real filing, authority, quality, tenant,
persistence, or production entity. From exact baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`, it hardens the existing synthetic
cross-engine result so agreement is possible only after both child results bind
to the current invocation's exact original and amendment archive hashes, each
fact binds to the correct current archive and top-level document role, and the
host recomputes the child pair and execution bindings from current archive and
document hashes, the configured image, and receipt-declared key/public-key
context.

The canonical result remains exactly 20 facts partitioned into ten original
facts followed by ten amendment facts in frozen key order. For every key, the
two versions must preserve fixed concept, unit, and period context and one
reciprocal predecessor/successor lineage edge with matching endpoints and
effective time. Accepted time must strictly precede available time, decimals
must use canonical spelling, duration start must strictly precede end, all facts
across both roles must share one period end, and all duration facts must share
one duration start. Each
accession's two-digit year must match its accepted-at year, the original and
amendment accessions must share the same ten-digit issuer segment, and the pair
must contain at least one changed and one unchanged value. Any mismatch returns
one empty value-free quarantine.

The sole target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`.
Failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f` is the exact
single-parent direct child of baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. Dedicated run/job `33011584084` /
`98318943081` failed at `evidence_validation_transition` before artifact
retention. Custody run/job `33011584059` / `98318941993` and parser-isolation
run/job `33011584060` / `98318941736` failed at `commit_boundary`; both are
regression non-evidence. All three failed runs retained zero artifacts. The
claim is promoted only for exact source
`2e3a7e33a76d19b993375958aff671707a81ef05`, its exact two-commit,
two-first-parent, 23-path transition, and 14-path corrective commit. Full local
`pnpm verify` passed, including 51 acceptance tests. Source CI run `33013464811`
passed Ubuntu job `98325467206` and Windows job `98325467249`. Dedicated run/job
`33013464847` / `98325467722` retained 7,581-byte artifact `9623531283`, named
`filing-parser-cross-engine-execution-evidence-v2-2e3a7e33a76d19b993375958aff671707a81ef05-1`,
with ZIP digest
`sha256:bfd3eb2fabdba8b533cbbcd488fe9decd19f47cd4d73c408ac824a87717aaed8`
and canonical evidence digest
`sha256:c1d4d7c6c77bd5aa0a9a0af5de08fbbf3b823744b9cba47e3a59283dfd41f6d8`.
The record binds 66 source hashes, 23 transition paths, 16 ordered checks, 16
ordered nonclaims, and six outcomes (one agreed and five quarantined); the
independent review returned `offline_consistent` for 66 of 66 source hashes.

Injected boundary or child-receipt authenticity and fresh engine execution are
not established. Quality composition is deferred; true independence,
independently adjudicated real quality, representative real filings, Cycle 2b
authority, B15/V15, full Cycle 2 exit, real-data admission, and production
remain Blocked. See
[ADR 0039](./adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md)
and the [Cycle 2l exit matrix](./CYCLE_2L_EXIT_MATRIX.md).

## Pending Cycle 2m source-owned Docker lifecycle agreement

Cycle 2m adds no canonical real filing, authority, quality, tenant,
persistence, or production entity. Public configuration contains only sealed
engine descriptors. An internal ephemeral Ed25519 signer and package-owned
audited direct-Docker runners must perform exactly four fresh
create/start/attach/remove lifecycles per invocation and prove removal with zero
container residue.

Each independently recomputable lifecycle receipt must bind archive digest,
document role and digest, container-ID digest, engine id, role, image and
implementation digests, key id and SPKI digest, and `zeroResidue`. The internal
runner separately validates exact create/start `--attach`/`rm --force`/residue
order plus exit and output snapshots; no hidden operation transcript is part of
the public receipt preimage. The four receipts, Cycle 2l agreement, complete
normalization record, and key context bind into one distinct invocation hash.
Two invocations over the same
owned synthetic inputs must produce byte-identical normalization while yielding
eight unique container-ID digests and distinct lifecycle and invocation hashes.
Any malformed configuration, Docker operation failure, receipt mismatch,
agreement mismatch, reuse, or cleanup failure returns one atomic empty
value-free quarantine.

The sole target claim is
`bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding`.
It remains Pending until one exact single-parent child of baseline
`1cb7d3ce024cbd29665af7ec4e010da0c380b726` passes full local and exact-source
CI, retains a success-only canonical v3 artifact, and returns an independently
anchored offline-consistent review. The source SHA, runs/jobs, artifact,
digests, and offline verdict remain Pending. Cycle 2l v2 and Cycle 2k v1
evidence and their source history remain immutable.

Docker daemon/host/kernel/container-ID authenticity, worker-image supply-chain
attestation, semantic absence of nonce/cache behavior inside workers, external
signer identity/KMS/HSM custody, real parser quality, Cycle 2b authority, 100
real filings/2,000 assertions, B15/V15, real-data admission, and production are
not established. Quality composition is deferred until this lifecycle boundary
is proven. Synthetic manifests, keys, approvals, or clocks cannot establish
Cycle 2b's externally reviewed authority. See
[ADR 0040](./adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md)
and the [Cycle 2m exit matrix](./CYCLE_2M_EXIT_MATRIX.md).

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
