# Canonical data and tenancy contract

Status: Cycle 1a design contract; synthetic data only.

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
tests. The SQL package is a statically checked migration contract only. Neither
proves production identity, PostgreSQL RLS, connection-pool context clearing,
backup/restore, or deletion until the real PostgreSQL acceptance lane exists.
A database adapter must not infer “no omissions” merely because RLS hid rows;
it needs an explicit completeness signal and must use `count: null` when an
exact count cannot be disclosed or established.
