# ADR 0044: personal single-user local filing-corpus manifest verification

Status: Accepted and **Promoted only for exact source revision
`398bb280593b6de125c5561ac9dd1b1c0fe254bd`, the direct child of baseline
`2f0534d2a5b4206221cc66ece5e03cf529e5d373`.**

## Context

This repository is a personal project used by one owner. It is not a team,
customer, tenant, commercial, redistributed-data, or production service. The
existing Cycle 2b/2p enterprise admission model intentionally requires
independent rights-authority and data-steward signatures, key-authority review,
and later B15/V15 and production gates. Those remain valid historical design
work, but they are not applicable blockers for the current use.

Simply ignoring the enterprise gates would leave the intended use implicit and
make later scope drift hard to detect. The personal path therefore needs a
closed machine-readable profile declaration and a narrow verifier that proves
only the integrity and shape of a local corpus manifest.

## Decision

Add the zero-production-dependency package
`@research-cockpit/personal-filing-corpus`. Its public operation,
`verifyPersonalFilingCorpusManifest`, accepts exactly two owned `Uint8Array`
documents: a declaration and a manifest.

The declaration must state the exact `personal_single_user_local` profile,
`personal_offline_filing_research_only` purpose, one local user, no commercial
use, no redistribution, bounded retention, delete-on-request, and
user-managed local deletion. It binds the exact canonical manifest SHA-256,
corpus ID, and corpus version; both documents independently require schema
version `1.0.0`.

The manifest must contain 1–100 accession-sorted unique entries. Every entry
has a closed CIK/form/time/media/taxonomy/source/declared-digest/amendment shape,
bounded declared size, a matching `sec-edgar:<accession>` locator, and valid
chronology. Declared digest syntax and uniqueness plus total declared bytes are
checked. Inputs are snapshotted before parsing, canonical JSON is required,
duplicate and unknown properties fail, and hostile carriers collapse to a
fresh public error with no input value or attacker-forged detail.

Success returns an immutable aggregate-only record with status
`verified_for_personal_use`. The operation never returns `admitted`. It does
not open files or inspect payload bytes, so it cannot prove payload presence or
equality with a declared digest.

The exact successful claim is
`bounded_content_addressed_manifest_verified_for_personal_single_user_local_use`.
The verifier computes declaration and manifest SHA-256 values over the owned
canonical bytes and compares the computed manifest digest with the declaration.
Per-entry content digests are validated for syntax and uniqueness only; payload
equality is not checked.

## Applicability decision

For `personal_single_user_local`, the following are Out of scope rather than
Pass or Blocked:

- organizational rights-authority, data-steward, counsel, or key-authority
  approval;
- tenant identity, roles, shared-service isolation, and multi-user privacy
  operations; and
- B15/V15, production KMS/queues/load/SLOs, incident response, and production
  authorization.

This does not erase or reinterpret Cycle 2b or Cycle 2p. Their enterprise
contracts and immutable implementation remain historical truth and become
applicable again if the project adds users, a shared or customer-facing
service, commercial use, payload redistribution, or production operation.
External law and source terms are not waived by this repository profile.

## Exact routing boundary

The exact source is the one direct child
`398bb280593b6de125c5561ac9dd1b1c0fe254bd` of
`2f0534d2a5b4206221cc66ece5e03cf529e5d373`. Its 13-path, 26-NUL-field,
775-byte source transition has digest
`sha256:a780c8a8fc65a204c41e5daf05b6ac2120f6a3d952d2e677c7775879c6270ff8`.

The cross-engine workflow and both independent evidence verifiers route that
exact transition before Cycle 2p and Cycle 2o. The protected set is the 13
transition paths plus the unchanged enterprise `corpus-admission.ts`. Any
non-exact protected intersection fails closed. Both offline boundaries accept
the committed source and separately preserve historical Cycle 2p blob
`e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`.

Cycle 2q creates no evidence schema, canonical evidence version, or artifact.
The exact route only typechecks and tests the new package. Cycle 2o version 5
remains exclusively anchored at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`.

Full local verification passed 1,330 tests with 4 intentional skips. Exact
source CI run `33125521900` passed Windows/Ubuntu jobs `98702620717` /
`98702620941`. Normalization, cross-engine, parser-isolation, PostgreSQL,
payload-custody, and Dependabot runs `33125521872`, `33125521890`,
`33125521898`, `33125521899`, `33125521910`, and `33125607844` also reached
terminal success.

## Consequences

The project now has an explicit, testable personal-use scope and a fail-closed
manifest-verification boundary. Enterprise-only approvals no longer block work
on that active profile.

When this decision was accepted, the highest-priority remaining blocker was
local payload identity. The next milestone needed to define and validate one deterministic
accession-to-relative-path mapping (or a separately manifest-bound local path
map), then stream the expected files from a caller-selected local root, reject
path escape and links, enforce size limits during reading, recompute SHA-256,
and report aggregate success without exposing payload data.

This decision does not prove raw payload presence or digest equality, SEC
authenticity or complete provenance, fetch/archive safety, parser correctness,
fact quality, enforced backup deletion or cryptographic erasure, or fitness for
any wider profile.

## Payload-identity follow-on

Cycle 2r later closes the source-capability blocker identified above at exact
revision `e15ddd8aa923a43fdca730e233abfbe684101e78`. Its payload-identity operation
consumes and re-verifies the declaration and manifest defined here, maps each
accession to the fixed direct-root `<accession>.payload` child, and can verify
presence, declared length, and SHA-256 for the bytes observed during one
successful invocation.

That follow-on does not alter this ADR's exact revision, decision, claim, or
`verified_for_personal_use` status. Cycle 2q remains manifest-only. Cycle 2r
uses the distinct `payload_identity_verified_for_personal_use` status, creates
no evidence artifact, and does not prove a specific owner corpus unless the
operation successfully runs over that corpus. Its next blocker is local
custody, audit metadata, retention, and owner-managed deletion rather than
enterprise stewardship. See [ADR 0045](./0045-personal-local-filing-payload-identity-verification.md)
and the [Cycle 2r exit matrix](../CYCLE_2R_EXIT_MATRIX.md).

## References

- [Cycle 2q exit matrix](../CYCLE_2Q_EXIT_MATRIX.md)
- [Cycle 2r exit matrix](../CYCLE_2R_EXIT_MATRIX.md)
- [ADR 0045](./0045-personal-local-filing-payload-identity-verification.md)
- [Cycle 2p exit matrix](../CYCLE_2P_EXIT_MATRIX.md)
- [ADR 0043](./0043-admission-validity-corrective-chain-promotion.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [ADR 0029](./0029-fixed-public-filing-candidate-manifest-admission.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
