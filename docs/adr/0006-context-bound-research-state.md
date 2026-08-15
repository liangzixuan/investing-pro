# ADR 0006: Context-bound research state

Status: accepted for Cycle 1a

Research-state repositories are created inside a unit of work bound to one
trusted synthetic actor. Scoped repository methods do not accept organization
or principal IDs. This reduces accidental BOLA paths and maps directly to a
future transaction-local PostgreSQL context.

The demo adapter clones state, serializes transactions, and commits only after
resource, idempotency, and audit operations all succeed. It returns defensive
copies. Idempotency records contain hashes and resource metadata, while audit
events accept only an allowlist of payload-free fields. Deletes remove thesis or
alert content and retain a payload-free, tenant- and resource-type-scoped ID
marker that prevents same-type delete/recreate ABA. The marker is not a
soft-deleted content row.

The adapter's idempotency record stores response metadata, not a full immutable
response. It can replay while the referenced object remains at the recorded
version; after a later mutation it fails closed with an idempotency conflict.
Audit records carry retention deadlines, but production purge and backup
deletion are deliberately outside this in-memory proof.

This adapter is a deterministic authorization harness. It is not authentication,
durable persistence, or proof of database row-level security, and it is not
wired into the API or browser profile.

Repository and unit-of-work ports are trusted infrastructure surfaces, not
request-handler APIs. Application mutations must enter through
`ResearchStateService`, which couples the resource, idempotency record, and
success audit in one unit of work.
