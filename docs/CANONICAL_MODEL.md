# Canonical data and tenancy contract

Status: Cycle 1b-a2 design contract; synthetic data only.

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

The in-memory adapter proves use-case and repository behavior under deterministic
tests. The SQL package also has a reviewed clean-only b1 run covering its recorded
PostgreSQL catalog, RLS, authorization, and sequential-context probes. Neither
proves production identity, authenticated sessions, connection-pool context
clearing, concurrent behavior, backup/restore, or the future deletion path.
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
unit mapping, dimensions, a real query/driver, and complete dossier projection
remain adapter-enablement blockers.
