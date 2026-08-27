# ADR 0043: admission-validity corrective-chain promotion

Status: Accepted and **Promoted only for exact revision
`d642e534b8911b58a32d50f8dfb976ae2900cadc`, the exact corrective child of
source `bc4b371784711102462ad28a9c9eb7cb567f1072` from frozen documentation
baseline `e21408acf70a28909136cc3eb0c10bbbd48b8266`. Cycle 2b remains Blocked.**

## Context

Cycle 2b Phase A defines a metadata-only verifier for a future exact,
content-addressed 100-filing candidate manifest. It accepts caller-supplied
authority and revocation metadata plus caller-supplied `evaluatedAt`; no real
inventory, approval, authority configuration, trusted clock, or human review
exists in the repository.

Historical source `96b042669edc6cb4a876bb0c061fa5e18732c1ca` corrected one
repository-controlled validity bug. An admission record had used only the two
approval expiry instants for `validUntil`, even when the supplied authority
registry scheduled an earlier rights or steward revocation. The implementation
now computes each approval's effective end and publishes the earliest end
across both roles. Historical corrective `711fe866594d5e20a657a24c0a0c72fd78ab90be`
added exact parser evidence routing, but the complete custody-side and
cross-engine promotion closure was still pending.

The next bounded milestone is therefore to promote that correction without
claiming external authority or silently inheriting Cycle 2o evidence. The
milestone must preserve the exact historical implementation blob, exact
historical topology and path sets, and failed-run history.

## Decision

For an otherwise valid Phase-A admission, define each role's effective end as
the earlier of its signed approval expiry and its supplied scheduled revocation,
if any. Define the aggregate `validUntil` as the earlier effective end across
the distinct rights-authority and data-steward approvals. The interval is
half-open: evaluation before the cutoff may admit, while evaluation at or after
the cutoff fails with inactive approval status.

Promote only the immutable corpus-admission implementation blob
`e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`, first introduced by historical
source `96b042669edc6cb4a876bb0c061fa5e18732c1ca`. Tests cover either role as the
earliest revocation, both role orderings, the exact cutoff boundary, and an
approval expiry earlier than a later revocation.

Both independent evidence verifiers and the cross-engine workflow must route
Cycle 2p before Cycle 2o. All three admit only the exact six-path source from
`e21408acf70a28909136cc3eb0c10bbbd48b8266` or one exact eight-path corrective
child, with the exact nine-path cumulative transition. Any intersection with
the ten-path protected surface outside that chain fails closed. Separately, the
two verifiers replay the exact historical `7243f16` → `96b0426` → `711fe86`
topology and path sets and compare the current corpus-admission blob to its
historical source.

Cycle 2p creates no new evidence schema or version. The cross-engine workflow
terminates successfully for the exact chain without producing an artifact.
Historical Cycle 2o version 5 remains exclusively bound to
`472cc10b8df90bee01925b2efd4fbcb614d7590c`; its artifact, digest, claim,
checks, nonclaims, and review result are unchanged.

## Windows corrective

The exact source revision passed parser isolation, payload custody, and
cross-engine acceptance, but its first CI run failed on Windows. The cleanup
protocol compared numeric `fs.Stats.dev` and `ino` values. NTFS identities may
exceed JavaScript's exact integer range, so distinct concurrent workspaces
could round to the same numeric pair and trigger a false quarantine.

The exact corrective child uses `{ bigint: true }` metadata throughout
workspace capture, identity search, revalidation, canonical-directory checks,
and bounded regular-file link-count and size checks. A deterministic regression
holds two 64-bit identities that alias as numbers but remain unequal as bigint.
This is an implementation-integrity correction, not a new canonical domain
object or host/filesystem attestation.

## Exact promotion boundary

The NUL-delimited `git diff --name-status --no-renames -z` records are:

- baseline to source: 6 modified paths, 12 NUL fields, 437 bytes, digest
  `sha256:50f2ea0f8c6050a7e126955f959eb1249a535861280c6002b5b4c84323d5d2dd`;
- source to corrective: 8 modified paths, 16 NUL fields, 548 bytes, digest
  `sha256:79ab5ad85d90a1f130a497a1c3d7c58ecb0ff4e39f82c492373b5c29b69c64c9`;
- baseline to corrective: 9 modified paths, 18 NUL fields, 611 bytes,
  digest
  `sha256:7b7887c43ff5df6c969f45842d34a6e04783d9bfcedd276daaed3477544ff4e6`.

The historical source, corrective, and cumulative transitions contain exact
2-, 3-, and 5-path sets. Their NUL-record digests are respectively
`sha256:c3d8bc3cbcc41eb159fa9c55b346ec290d63598a5e4897b17bb2ced0c1817ea9`,
`sha256:98e9ba644c2c45a9f35a65f6f2c220693330da39226e50bc341ef5e0d4fea2d5`,
and
`sha256:a1ff506d8575d1ead374a0cf8e85a53f90e1cd9e3557dd2b92f0d6f1dcb34b3f`.

Full local verification passed 1,306 tests with 4 intentional skips. Exact
revision CI run `33118610052` passed Ubuntu/Windows jobs `98679559915` /
`98679560385`. Parser isolation run/job `33118609943` / `98679559855`, payload
custody `33118610058` / `98679560095`, normalization execution `33118609968` /
`98679560122`, and cross-engine acceptance `33118610020` / `98679560195` all
reached terminal success on attempt 1.

Parser, custody, and normalization retained their standard revision-bound
artifacts. They are regression anchors, not Cycle 2p canonical evidence, and no
independent offline review is claimed for them. Cross-engine acceptance emitted
no artifact by design.

## Consequences

The repository-controlled Phase-A validity calculation and its exact routing
boundary are closed for one immutable promotion chain. A scheduled revocation
can no longer leave an admitted record advertising a later validity end, and a
protected change can no longer fall through to older Cycle 2o evidence.

This decision does not establish an exact external 100-filing inventory,
independent rights-authority or data-steward approval, authenticated authority
identity, trusted evaluation time or clock, human review, real filing or raw
payload data, independent adjudication, real quality, B15/V15, real-data
admission, full Cycle 2 exit, or production authorization. Cycle 2b and all
those downstream gates remain Blocked.

## Personal-profile follow-on

ADR 0044 leaves this decision, its exact promotion chain, immutable blob, and
enterprise nonclaims unchanged. It establishes a separate active
`personal_single_user_local` profile for one owner's local, offline,
noncommercial, nonredistributed use. The enterprise rights/steward/authority,
multi-user, B15/V15, and production gates above are inactive and Out of scope
only while that profile holds; widening the use reopens the applicable gates.

## References

- [Cycle 2p exit matrix](../CYCLE_2P_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [ADR 0029](./0029-fixed-public-filing-candidate-manifest-admission.md)
- [Cycle 2o exit matrix](../CYCLE_2O_EXIT_MATRIX.md)
- [ADR 0042](./0042-bounded-synthetic-parser-archive-custody-quality-composition.md)
- [ADR 0044](./0044-personal-single-user-local-filing-corpus-manifest-verification.md)
- [Cycle 2q exit matrix](../CYCLE_2Q_EXIT_MATRIX.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
