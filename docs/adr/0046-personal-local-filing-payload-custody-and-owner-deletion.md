# ADR 0046: personal local filing-payload custody and owner deletion

Status: Accepted and **Promoted only for exact source revision
`78b3880632ff7e54ac493e9c208ee1d93a275aa1`, the direct child of promoted
Cycle 2r documentation baseline
`a13b51d2cd6862029aa598829e40209ce178c7be`.**

## Context

ADR 0045 added a bounded local payload-identity verifier for the
`personal_single_user_local` profile. It did not record where the live payload
set was observed, bind a separate audit location to that result, preserve an
intent before deletion, or create a bounded terminal receipt after selected
live names became absent.

The next source boundary must remain one-owner and local-only. It must avoid
enterprise admission semantics, keep paths and payload details out of public
results, record retention as honest metadata rather than an automated promise,
and distinguish selected-live-root deletion from global or cryptographic
erasure.

## Decision

Extend the zero-production-dependency
`@research-cockpit/personal-filing-corpus` package with two public operations:

- `recordPersonalFilingPayloadCustody({ declaration, manifest,
payloadRootPath, auditRootPath })`; and
- `deletePersonalFilingPayloadCustody({ declaration, manifest,
payloadRootPath, auditRootPath, confirmation,
expectedCustodyRecordSha256 })`.

Both operations snapshot and reverify the Cycle 2q documents. Custody invokes
the Cycle 2r payload-identity verifier internally against the current exact
live set. The caller-selected payload and audit roots must already exist and be
canonical, distinct, non-root, and nonnested. An unkeyed domain-separated
SHA-256 binds their canonical paths plus bigint identities. Neither path is
returned as a plaintext field, but digest secrecy, unlinkability, and
resistance to offline path/root-identity guessing are not claimed.

From an empty audit root, custody publishes one canonical aggregate record
through exclusive pending-file creation, file synchronization,
destination-absence observation, same-directory rename, and reread. A later
call revalidates and replays an existing final record or may promote a valid
pending record; not every successful call publishes new bytes.
It binds declaration and manifest digests, runtime payload-identity binding,
location binding, corpus/count/byte metadata, fixed path mapping, and
platform-valued link assurance. Its exact claim is
`bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use`;
its status is `local_payload_custody_recorded_for_personal_use`.

The record computes `retentionTargetAt` from custody time plus the verified
manifest's retention days. This is policy metadata only. There is no scheduler,
automatic deadline, legal-hold engine, or minimum hold, and an explicit
owner-delete operation may run before the target.

Deletion requires the literal `delete_all_manifest_bound_local_payloads` and
the expected custody-record SHA-256. After rereading the complete bound custody
chain, it publishes a canonical append-only intent before any unlink. It may
target only manifest-derived direct children; recursive removal and root
deletion are forbidden. Each present file is boundedly rehashed and its path
and descriptor identity are observed immediately before unlink.

A retry may accept an already-missing selected name only after a persisted,
validated intent. No terminal receipt is published while any name remains in
the exact live-root inventory. Success retains the now-empty payload directory
and the three canonical custody, intent, and receipt audit files. Its exact
claim is
`bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use`;
its status is `live_payload_names_absent_after_explicit_personal_delete`; and
its assurance is
`observed_pre_unlink_identity_and_post_unlink_path_absence`.

## Publication and recovery boundary

Every public audit record is aggregate-only canonical JSON bounded to 16,384
bytes. Fixed pending names provide narrow retry without opening a general
recovery channel. Custody pending requires complete canonical bytes plus the
current manifest, location, and exact live-payload identity. Intent pending
requires the canonical custody/location/intent chain; after promotion,
deletion rejects extras, rehashes each present selected payload before unlink,
and permits missing selected names under that persisted intent. Receipt pending
requires the canonical custody/intent/receipt chain and an observed-empty live
root.

A matching filename alone conveys no authority. Arbitrary bytes, partial
records, directories, symbolic links, hard links, binding-mismatched records,
or otherwise invalid candidates remain untouched and fail closed. This does not establish
transactional atomicity, rollback, crash or power-loss recovery, cross-process
coordination, or exactly-once deletion.

## Assurance and nonclaims

Custody means that the aggregate record was made after the bounded observations
in that invocation. It does not mean continuous possession, post-return
immutability, storage attestation, or confidentiality elsewhere. Deletion
means the manifest-selected live names and exact live-root inventory were
observed absent at terminal success. It does not mean deletion from backups,
cloud sync, replicas, snapshots, caches, temporary files, logs, swap, recycle
bins, third parties, journals, forensic history, or physical media, and it is
not cryptographic erasure or memory zeroization.

The fixed confirmation expresses explicit caller intent; it does not
authenticate or authorize an owner. Neither result proves SEC authenticity or
complete provenance; MIME/archive/malware safety; parser correctness or fact
quality; scheduling, legal hold, audit signatures, trusted timestamps, or
tamper proofing; active-attacker race safety; universal Windows reparse
behavior; any specific owner corpus without a successful invocation; or
composition into the running application.

The returned unkeyed location digest is not plaintext-path disclosure, but no
secrecy, unlinkability, or resistance to offline guessing is attributed to it.

The deletion receipt does not embed these nonclaims. Its meaning is bounded by
the exported `PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN` list and the Cycle 2s
exit matrix.

## Applicability

This decision applies only while the profile remains one owner, local-only
offline research, noncommercial, nonredistributed, and not a shared or
production service. Organizational rights/steward/key-authority approval,
tenant and multi-user controls, B15/V15, and production operations are Out of
scope—not Pass and not current blockers—for that profile only.

Those gates reopen if use adds users, a shared or customer-facing service,
commercial use, payload redistribution, or production operation. External law
and source terms remain outside this internal engineering classification.

## Exact routing boundary

The exact source is the one direct child
`78b3880632ff7e54ac493e9c208ee1d93a275aa1` of
`a13b51d2cd6862029aa598829e40209ce178c7be`. Its 11-path, 22-NUL-field,
778-byte transition has digest
`sha256:f8feb8c71409711439761778e738872c3ff91974ce1a2a047dbf410f276805e6`.

The cross-engine workflow and both independent evidence verifiers route that
exact transition before Cycle 2r, Cycle 2q, Cycle 2p, and Cycle 2o. The
protected surface contains 19 paths. Any non-exact protected intersection
fails closed. Both offline boundaries accept the exact committed source.

Cycle 2s creates no evidence schema, canonical evidence version, or
cross-engine/CI evidence artifact.
The route includes the personal-package checks and common regressions while
preserving Cycle 2r source `e15ddd8aa923a43fdca730e233abfbe684101e78`,
Cycle 2q source `398bb280593b6de125c5561ac9dd1b1c0fe254bd`, enterprise
Cycle 2p admission blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`, and
Cycle 2o version 5 at `472cc10b8df90bee01925b2efd4fbcb614d7590c`.

## Verification

Full local verification passed 1,405 tests with 8 intentional capability
skips. The focused personal-package suite passed 80 tests with 4 skips. Both
offline boundaries accepted the exact committed SHA. Exact-source CI run
`33221451567` passed Ubuntu/Windows jobs `99016146240` / `99016146391`.
Cross-engine, parser-isolation, normalization, and payload-custody runs/jobs
`33221451518` / `99016145897`, `33221451525` / `99016146058`,
`33221451528` / `99016145920`, and `33221451601` / `99016146192` also reached
terminal success. Cross-engine artifact generation was skipped by design.

These results prove source behavior with generated temporary fixtures only.
They add no owner-selected declaration, manifest, payload root, audit root, or
successful owner-corpus custody/deletion operation record. No particular
personal corpus is therefore represented as operated canonical state.

## Consequences

The highest-priority disconnected source-capability blocker from Cycle 2r is
closed. The project can record bounded aggregate custody metadata after current
payload-identity verification, preserve intent before selected-live-root
deletion, and mint a bounded terminal absence receipt.

The next blocker is Cycle 2t owner-corpus activation. The owner must supply
canonical declaration/manifest bytes, the exact manifest-complete live payload
root, and a new empty canonical non-root audit root which is separate and
nonnested. Activation calls custody recording only, requires a returned custody
record plus exactly the final custody JSON and no pending name, and keeps every
owner input, payload, raw path, returned record/digest, and audit byte outside
Git and logs. Generated fixtures do not close that operational gate; the
repository may record only a coarse owner-approved status. If those inputs do
not yet exist, the blocker is the private owner corpus rather than an
enterprise approval. After activation, the next engineering milestone is
bounded personal ten-fact normalization and correction lineage.

## References

- [Cycle 2s exit matrix](../CYCLE_2S_EXIT_MATRIX.md)
- [Cycle 2r exit matrix](../CYCLE_2R_EXIT_MATRIX.md)
- [ADR 0045](./0045-personal-local-filing-payload-identity-verification.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
