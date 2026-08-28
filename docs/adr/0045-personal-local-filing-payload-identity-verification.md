# ADR 0045: personal local filing-payload identity verification

Status: Accepted and **Promoted only for exact source revision
`e15ddd8aa923a43fdca730e233abfbe684101e78`, the direct child of promoted
Cycle 2q documentation baseline
`436f7fed6af9efaec21a26e5709b90073610384e`.**

## Context

ADR 0044 created the closed `personal_single_user_local` profile and a bounded
declaration/manifest verifier. That verifier authenticates neither a local
file's presence nor equality between its bytes and the manifest's declared
length and SHA-256. Valid metadata can coexist with missing, substituted,
truncated, extended, or otherwise different local bytes.

The project needs a narrow next boundary before local parsing or custody work.
It must reuse the personal profile, avoid enterprise admission semantics, keep
payload content out of results and errors, make filesystem limits explicit,
and state honestly what can and cannot be promised across Windows and
non-Windows runtimes.

## Decision

Extend the zero-production-dependency
`@research-cockpit/personal-filing-corpus` package with
`verifyPersonalFilingCorpusPayloadIdentity({ declaration, manifest,
payloadRootPath })`. Before filesystem access, the operation snapshots and
re-verifies the exact Cycle 2q declaration and manifest. It then reads only the
payload set derived from that verified manifest.

The only supported path mapping is
`direct_root_accession_payload_v1`: every canonical accession maps to the
direct child `<accession>.payload` beneath one absolute caller-selected local
root. The root cannot be a filesystem root. Canonical root equality, direct
child containment, and lexical directory-chain observations reject path escape
and Node-visible symlink/junction components.

The root inventory must contain exactly the expected 1–100 names before and
after reads. Each expected path and opened descriptor must be observed as a
regular, positive-inode, single-link file on the same device as the root and
with the declared size. Each file is opened through one descriptor and read
positionally through one reusable 65,536-byte buffer. Early EOF, unsafe read
counts, an extra byte after the declared length, aggregate overflow, or a
SHA-256 mismatch rejects the whole set. Inherited limits remain 64 MiB per file
and 1 GiB total declared content.

The verifier compares bigint root, path, and descriptor identity fields at its
pre/open/post observations. The declaration and manifest are reverified once
before filesystem access. The root inventory is checked before and after all
reads, and root identity is revalidated around file processing. Any failure
returns no partial record and only a fresh closed public error with a generic
value-free message.

Success returns an immutable aggregate-only record. Its exact claim is
`bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use`,
its status is `payload_identity_verified_for_personal_use`, and its path mapping
is `direct_root_accession_payload_v1`. The record includes corpus/schema
identity, declaration and manifest digests, frozen time, filing count,
retention days, total verified bytes, and `linkAssurance`. It exposes no root
path, accession, per-file digest, or payload bytes.

## Filesystem assurance

`linkAssurance` is a required part of every successful record:

- supported non-Windows runtimes where Node exposes `O_NOFOLLOW` report
  `kernel_final_component_nofollow_plus_observed_snapshots`; and
- Windows and any runtime without that supported flag report
  `observed_snapshots_only`.

The Windows path rejects Node-visible symlinks/junctions and observed
multi-link files and compares bigint identities. It does not claim kernel
final-component no-follow, rejection of every Windows reparse point, cloud
placeholder, or filter-driver behavior, adversarial namespace ABA elimination,
race freedom, transactional snapshot semantics, or absence of transient
out-of-root reads against an active same-machine attacker.

No platform result attests filesystem kernel/device ownership, ACLs, or local
storage; hard-link history or future link creation; future or post-return
immutability; confidentiality in memory, swap, storage, backups, or other
processes; or wall-clock deadlines, cancellation, or availability.

## Applicability

This decision applies only while the profile remains one owner, local-only
offline research, noncommercial, nonredistributed, and not a shared or
production service. Organizational rights-authority/data-steward/key-authority
approval, tenant and multi-user controls, B15/V15, and production operations
are Out of scope—not Pass and not current blockers—for that profile only.

Those gates reopen if use adds users, a shared or customer-facing service,
commercial use, payload redistribution, or production operation. External law
and source terms remain outside this internal engineering classification.

## Exact routing boundary

The exact source is the one direct child
`e15ddd8aa923a43fdca730e233abfbe684101e78` of
`436f7fed6af9efaec21a26e5709b90073610384e`. Its ten-path, 20-NUL-field,
693-byte source transition has digest
`sha256:46e497134b8cae95acc6211503a636b559064fdcf0dc95924d793f2d5dbaf4fb`.

The cross-engine workflow and both independent evidence verifiers route that
exact transition before Cycle 2q, Cycle 2p, and Cycle 2o. The protected surface
contains the ten transition paths, unchanged enterprise `corpus-admission.ts`,
and five unchanged personal-package files, for 16 paths total. Any non-exact
protected intersection fails closed. Both offline boundaries accept the exact
committed source.

Cycle 2r creates no evidence schema, canonical evidence version, or artifact.
The route includes the personal-package checks and common regression/guard
checks, runs no Cycle 2o acceptance, and emits no Cycle 2r artifact. Historical
Cycle 2q source `398bb280593b6de125c5561ac9dd1b1c0fe254bd`, Cycle 2p
implementation blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`, and Cycle 2o version 5
at `472cc10b8df90bee01925b2efd4fbcb614d7590c` remain unchanged.

## Verification

Full local verification passed 1,364 tests with 4 intentional skips. The
focused personal-package suite passed 45 tests with one capability-based
Windows symlink skip. Exact-source CI run `33207340001` passed Ubuntu/Windows
jobs `98971624813` / `98971625033`. Payload-custody, cross-engine,
normalization, and parser-isolation runs/jobs `33207340021` / `98971625062`,
`33207340045` / `98971625271`, `33207340070` / `98971625207`, and
`33207340114` / `98971625367` also reached terminal success. Cross-engine
artifact generation was skipped by design.

These results prove source behavior with generated temporary fixtures. They do
not record a successful invocation over an owner-selected corpus. No owner
manifest, filing payload, payload-root configuration, or operation record is
added by this promotion, so the revision alone cannot be cited as proof that a
specific personal corpus has been verified.

## Consequences

The project now has a bounded capability to prove local payload presence,
declared length, and SHA-256 for the bytes and identities observed during one
successful invocation. It remains disconnected from the synthetic-only
running application and does not grant admission status.

The highest-priority next blocker is bounded local custody, audit metadata,
retention, and owner-managed deletion. The next milestone should keep raw
payloads and audit metadata in separate bounded locations, bind custody
metadata to the corpus/manifest and a successful payload-identity result, and
provide an explicit owner-triggered deletion operation with an aggregate
receipt. That receipt must not claim deletion from backups, cloud copies, swap,
filesystem history, or physical media, and must not claim cryptographic
erasure.

This decision does not prove SEC authenticity or complete provenance; MIME
truth, archive structure, malware safety, parser correctness, or fact quality;
enforced retention or deletion; or safety for multi-user, commercial,
redistributed, shared-service, or production use.

## References

- [Cycle 2r exit matrix](../CYCLE_2R_EXIT_MATRIX.md)
- [Cycle 2q exit matrix](../CYCLE_2Q_EXIT_MATRIX.md)
- [ADR 0044](./0044-personal-single-user-local-filing-corpus-manifest-verification.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
