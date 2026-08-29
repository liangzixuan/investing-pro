# Cycle 2r exit matrix

Scope: add a bounded local filing-payload identity verifier capability for the
active `personal_single_user_local` profile without claiming that a particular
owner corpus was verified, that SEC supplied the bytes, or that the running
application ingests filings. The decision is recorded in
[ADR 0045](./adr/0045-personal-local-filing-payload-identity-verification.md).

Current status: **Pass only for exact source revision
`e15ddd8aa923a43fdca730e233abfbe684101e78`, the direct child of promoted
Cycle 2q documentation baseline
`436f7fed6af9efaec21a26e5709b90073610384e`.**

This Pass is for the verifier source capability and its generated temporary
test fixtures. The promotion adds no owner-selected corpus, manifest, filing
payload, payload-root configuration, or successful owner-corpus operation
record. A specific corpus is verified only by a successful invocation over
that corpus.

| Gate                                   | Required result                                                                                                                                                            | Current status       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Reverified owned documents             | Exact Cycle 2q declaration/manifest verification reruns over owned snapshots before filesystem access                                                                      | Pass                 |
| Fixed mapping                          | Every accession maps only to direct-root `<accession>.payload` under `direct_root_accession_payload_v1`                                                                    | Pass                 |
| Exact bounded inventory                | Root contains exactly the expected 1–100 names before and after reads                                                                                                      | Pass                 |
| Root and path containment              | Absolute non-filesystem-root input, canonical direct-child containment, same canonical root, and Node-visible root-chain link/junction rejection                           | Pass                 |
| Expected file shape                    | Every observed path and descriptor is a regular, positive-inode, single-link file on the root device with declared size                                                    | Pass                 |
| Bounded streamed identity              | One descriptor/file, one reusable 65,536-byte buffer, positional reads, early-EOF/extra-byte checks, inherited 64 MiB/file and 1 GiB aggregate limits, incremental SHA-256 | Pass                 |
| Observed stability                     | Bigint root/path/descriptor identities agree at the verifier's pre/open/post observations                                                                                  | Pass                 |
| Platform-valued assurance              | Result exposes exact `linkAssurance`; Windows remains `observed_snapshots_only`                                                                                            | Pass (bounded claim) |
| Atomic and confidential result         | Any whole-set failure returns no record and only a fresh generic public error; success exposes no path, accession, per-file digest, or bytes                               | Pass                 |
| Aggregate immutable success            | Result is frozen with exact claim and status `payload_identity_verified_for_personal_use`                                                                                  | Pass                 |
| Package isolation                      | Zero production dependencies and no composition into API, web, database, queue, fetcher, parser, or owner corpus                                                           | Pass                 |
| Exact routing and history              | Exact ten-path direct child routes before inherited Cycle 2q/2p/2o; 16-path protected surface fails closed; no artifact; prior history preserved                           | Pass                 |
| Local verification                     | Full release gate passes 1,364 tests with 4 intentional skips; focused personal-package suite passes 45 tests with one capability-based Windows skip                       | Pass                 |
| Exact-revision workflows               | All five workflows triggered for the exact source reach terminal success                                                                                                   | Pass                 |
| Specific owner corpus                  | A successful invocation over an owner-selected corpus and root is recorded                                                                                                 | Unproven             |
| Local custody, audit, and deletion     | Bounded separated custody/audit state plus owner-triggered retention/deletion and an aggregate receipt                                                                     | Next blocker         |
| Authenticity, parser, and fact quality | SEC authenticity/provenance, MIME/archive/malware safety, parser correctness, and owner-reviewed fact quality                                                              | Pending later        |
| Enterprise and shared-service gates    | Organizational approval, tenant/multi-user controls, B15/V15, and production operations                                                                                    | Out of scope         |

## Bounded conclusion

For the exact promoted source only,
`verifyPersonalFilingCorpusPayloadIdentity` provides a bounded verifier
capability for `personal_single_user_local`. On one successful invocation it
re-verifies owned declaration and manifest snapshots, maps each accession to
the fixed direct child `<accession>.payload`, observes an exact root inventory
before and after reading, and reads each expected regular, single-link,
same-device file through one descriptor in positional chunks of at most 65,536
bytes plus an EOF probe.

Success means the bytes read during that invocation had the declared length
and SHA-256 and that the root, path, and descriptor identities matched at the
verifier's pre/open/post observations. The exact claim is
`bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use`.
The frozen result status is `payload_identity_verified_for_personal_use`.
Only aggregate metadata crosses the result boundary; no root path, accession,
per-file digest, or payload bytes do.

Cycle 2q remains a manifest-only historical result. Cycle 2r re-verifies and
consumes its inputs but does not change the Cycle 2q source, claim, or
`verified_for_personal_use` status.

## Filesystem-assurance boundary

`linkAssurance` makes the platform boundary explicit. On supported non-Windows
runtimes where Node exposes `O_NOFOLLOW`, success reports
`kernel_final_component_nofollow_plus_observed_snapshots`. On Windows it
reports `observed_snapshots_only`: the verifier rejects Node-visible
symlinks/junctions and observed multi-link files and compares bigint identities,
but it does not claim kernel final-component no-follow, rejection of every
Windows reparse/cloud-placeholder/filter-driver behavior, adversarial namespace
ABA elimination, race freedom, or absence of transient out-of-root reads
against an active same-machine attacker.

The successful record also does not prove filesystem kernel/device ownership,
ACL or local-storage attestation, hard-link history or future link creation,
post-return immutability, confidentiality in memory/swap/backups/other
processes, wall-clock deadline/cancellation/availability, or a transactional
snapshot.

## Exact source transition

The promotion is one direct child:

1. baseline `436f7fed6af9efaec21a26e5709b90073610384e`;
2. source revision `e15ddd8aa923a43fdca730e233abfbe684101e78`.

The NUL-delimited `git diff --name-status --no-renames -z` transition has 10
paths, 20 NUL fields, 693 bytes, and digest
`sha256:46e497134b8cae95acc6211503a636b559064fdcf0dc95924d793f2d5dbaf4fb`.
It consists of:

- the cross-engine workflow;
- both independent evidence verifiers and their tests;
- the personal package public barrel and three payload-identity source/test
  files; and
- the repository boundary verifier.

The 16-path protected surface is those ten paths plus immutable enterprise
`corpus-admission.ts` and the five unchanged personal-package manifest,
tsconfig, manifest-verifier, and manifest-test files. Any non-exact protected
intersection fails closed. Both independent offline boundaries accept the
committed source.

The cross-engine route typechecks and tests the personal package. It creates no
Cycle 2r evidence schema, canonical evidence version, or artifact. Historical
Cycle 2q source `398bb280593b6de125c5561ac9dd1b1c0fe254bd`, enterprise Cycle 2p
blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`, and Cycle 2o version 5 at
`472cc10b8df90bee01925b2efd4fbcb614d7590c` remain unchanged.

## Verification record

Full local verification passed 1,364 tests with 4 intentional skips. The
focused personal-package suite passed 45 tests with one capability-based
Windows symlink skip. Every exact-source workflow triggered for this revision
reached terminal success:

- CI run `33207340001`: Ubuntu job `98971624813` and Windows job
  `98971625033`;
- payload-custody run/job `33207340021` / `98971625062`;
- cross-engine run/job `33207340045` / `98971625271`, with no Cycle 2r
  artifact by design;
- normalization run/job `33207340070` / `98971625207`; and
- parser-isolation run/job `33207340114` / `98971625367`.

The parser, custody, and normalization workflows are regression health, not a
Cycle 2r evidence artifact. No independent artifact review is claimed because
the personal route creates no artifact.

## Profile and nonclaim boundary

For the active `personal_single_user_local` profile only, organizational
rights-authority/data-steward/key-authority approval, tenant and multi-user
controls, B15/V15, and production operations remain **Out of scope**—not Pass
and not current blockers. Reopen those gates only if use expands to additional
users, a shared or customer-facing service, commercial use, payload
redistribution, or production operation. External law and source terms remain
outside this internal engineering classification.

Cycle 2r does not prove SEC authenticity or complete provenance; MIME truth,
archive structure, malware safety, parser correctness, or fact quality;
retention enforcement, backup/cloud-copy deletion, or cryptographic erasure;
or fitness for a wider profile. The package remains disconnected from the
running synthetic application.

## Next blocker

At the Cycle 2r exit, the requested next design was bounded local custody,
audit metadata, retention-target metadata, and owner-managed deletion. Keep raw
payloads and audit metadata in separate bounded locations, bind custody
metadata to the corpus/manifest and a successful payload-identity result, and
provide an explicit owner-triggered deletion operation with an aggregate
receipt. The capability boundary—not necessarily a field embedded in that
receipt—must state that selected-live-file deletion does not prove deletion
from backups, cloud copies, swap, filesystem history, or physical media and is
not cryptographic erasure.

## Custody/deletion follow-on

Cycle 2s later adds bounded local custody, audit, retention-metadata, and
owner-triggered deletion capabilities at exact source revision
`78b3880632ff7e54ac493e9c208ee1d93a275aa1`, using generated temporary
fixtures only. It does not revise Cycle 2r or prove a specific owner corpus.
See
[ADR 0046](./adr/0046-personal-local-filing-payload-custody-and-owner-deletion.md)
and the [Cycle 2s exit matrix](./CYCLE_2S_EXIT_MATRIX.md).

After that source-capability follow-on, Cycle 2t is the next operational
blocker: take one owner-selected canonical declaration and manifest plus
separate payload and audit roots through manifest verification,
payload-identity verification, and custody recording while keeping all owner
inputs, payloads, paths, and audit records outside Git. Generated fixtures do
not close this gate.

## Exit rule

Cycle 2r is Pass only for the exact source transition and bounded verifier
capability above. A specific owner corpus remains Unproven until a successful
invocation over that corpus. Local custody/deletion, authenticity, parsing,
quality, and every wider-profile gate remain separate work.
