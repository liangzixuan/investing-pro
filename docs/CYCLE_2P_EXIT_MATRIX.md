# Cycle 2p exit matrix

Scope: promote the repository-controlled Phase-A corpus-admission validity
correction and its exact evidence-routing boundary. The decision is recorded in
[ADR 0043](./adr/0043-admission-validity-corrective-chain-promotion.md).

Current status: **Pass only for exact promoted revision
`d642e534b8911b58a32d50f8dfb976ae2900cadc`, the exact corrective child of
source `bc4b371784711102462ad28a9c9eb7cb567f1072` from frozen documentation
baseline `e21408acf70a28909136cc3eb0c10bbbd48b8266`. Cycle 2b remains Blocked.**

Cycle 2p creates no filing, corpus, approval, authority, clock, admission,
quality, or production evidence. It creates no new canonical evidence version
and does not replace or reinterpret Cycle 2o version 5. Parser isolation,
payload custody, and normalization artifacts at the promoted revision are
regression anchors only.

| Gate                           | Required result                                                                                                                                          | Current status |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Earliest validity cutoff       | `validUntil` is the earliest of both approval expiries and any scheduled rights-authority or data-steward revocation                                     | Pass           |
| Half-open validity             | Evaluation one millisecond before a scheduled revocation may admit with that exact cutoff; evaluation at or after the cutoff fails closed                | Pass           |
| Dual-role ordering             | Either role may hold the earliest scheduled revocation; a later revocation cannot extend an earlier approval expiry                                      | Pass           |
| Immutable implementation       | The current `corpus-admission.ts` blob exactly equals historical source blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`                                  | Pass           |
| Historical correction chain    | Exact topology and path sets from `7243f16` through `96b0426` to `711fe86` remain anchored with failed-run history intact                                | Pass           |
| Promotion topology             | One exact six-path source and one exact eight-path corrective child produce the exact nine-path cumulative transition                                    | Pass           |
| Protected-surface routing      | Any touch to the nine cumulative paths or immutable corpus-admission source routes before Cycle 2o and fails closed unless it is the exact allowed chain | Pass           |
| Independent verifier agreement | Parser and payload-custody evidence verifiers independently enforce the same topology, path sets, historical chain, and immutable blob                   | Pass           |
| Windows file identity          | Workspace, directory, bounded-file, link-count, and size checks preserve exact NTFS identity with bigint metadata rather than lossy numbers              | Pass           |
| Local verification             | Full release verification, including the two formerly failing composition files, passes on the promoted revision                                         | Pass           |
| Exact-revision workflows       | CI on Ubuntu and Windows plus parser isolation, payload custody, normalization execution, and cross-engine acceptance reach terminal success             | Pass           |
| Evidence-version immutability  | Cross-engine acceptance intentionally emits no Cycle 2p artifact; Cycle 2o version 5 remains historical only at `472cc10`                                | Pass           |
| External corpus and authority  | Exact external 100-filing inventory, rights/steward approvals, authenticated authority identity, trusted time, and human review exist                    | Blocked        |
| Real quality and production    | Real payloads, independent adjudication, B15/V15, real-data admission, full Cycle 2 exit, and production authorization exist                             | Blocked        |

## Bounded conclusion

For the exact promoted revision only, an otherwise valid Phase-A admission
record cannot claim a validity window beyond the first applicable approval
expiry or scheduled revocation across its distinct rights and steward
authorities. The correction remains a calculation over the supplied registry
and supplied `evaluatedAt`; it does not authenticate either input.

The exact source and corrective routing also prevent this protected change from
silently inheriting Cycle 2o evidence. Both independent verifiers and the
cross-engine workflow recognize only the frozen source or its one exact
corrective child. Any other protected-surface intersection is rejected before
older evidence routes are considered.

## Exact transition record

The promotion chain is:

1. baseline `e21408acf70a28909136cc3eb0c10bbbd48b8266`;
2. direct source child `bc4b371784711102462ad28a9c9eb7cb567f1072`;
3. direct corrective child and promoted revision
   `d642e534b8911b58a32d50f8dfb976ae2900cadc`.

Its NUL-delimited `git diff --name-status --no-renames -z` records are exact:

- baseline to source: 6 modified paths, 12 NUL fields, 437 bytes, digest
  `sha256:50f2ea0f8c6050a7e126955f959eb1249a535861280c6002b5b4c84323d5d2dd`;
- source to corrective: 8 modified paths, 16 NUL fields, 548 bytes, digest
  `sha256:79ab5ad85d90a1f130a497a1c3d7c58ecb0ff4e39f82c492373b5c29b69c64c9`;
- baseline to corrective: 9 modified paths, 18 NUL fields, 611 bytes,
  digest
  `sha256:7b7887c43ff5df6c969f45842d34a6e04783d9bfcedd276daaed3477544ff4e6`.

The nine cumulative paths are the cross-engine workflow, the corpus-admission
security test, both independent evidence verifiers and their tests, the exact
parser-archive-pair custody implementation and test, and the boundary guard.
The protected surface adds
`packages/filing-parser/src/corpus-admission.ts` as its tenth path.

The separately anchored historical implementation chain is exact:

- `7243f16df0c4bd8691ff11fa037085e3beb3447e` to
  `96b042669edc6cb4a876bb0c061fa5e18732c1ca`: 2 modified paths, 4 NUL
  fields, 112 bytes, digest
  `sha256:c3d8bc3cbcc41eb159fa9c55b346ec290d63598a5e4897b17bb2ced0c1817ea9`;
- `96b042669edc6cb4a876bb0c061fa5e18732c1ca` to
  `711fe866594d5e20a657a24c0a0c72fd78ab90be`: 3 modified paths, 6 NUL
  fields, 205 bytes, digest
  `sha256:98e9ba644c2c45a9f35a65f6f2c220693330da39226e50bc341ef5e0d4fea2d5`;
- cumulative historical transition: 5 modified paths, 10 NUL fields, 317
  bytes, digest
  `sha256:a1ff506d8575d1ead374a0cf8e85a53f90e1cd9e3557dd2b92f0d6f1dcb34b3f`.

## Windows corrective

The source revision's focused workflows passed, but CI run `33114765641`
failed on Windows. Concurrent custody workspaces could have distinct 64-bit
NTFS file identities whose numeric `fs.Stats.dev` and `ino` values rounded to
the same JavaScript number. Cleanup then observed an apparent duplicate,
quarantining an otherwise valid fresh composition.

The corrective revision obtains bigint file metadata throughout workspace
capture, discovery, revalidation, canonical-directory checks, and bounded-file
pre/post checks. A deterministic regression demonstrates two identities at and
above `2^53` that collide after number conversion but remain distinct as bigint.
This closes the false-quarantine blocker; it does not attest the Windows host,
filesystem, storage, or cleanup durability.

## Verification record

Full local verification passed 1,306 tests with 4 intentional skips. All five
triggered attempt-1 workflows reached terminal success:

- CI run `33118610052`: Ubuntu job `98679559915` and Windows job
  `98679560385`;
- cross-engine acceptance run/job `33118610020` / `98679560195`, with no
  artifact by design;
- parser isolation run/job `33118609943` / `98679559855`;
- payload custody run/job `33118610058` / `98679560095`;
- normalization execution run/job `33118609968` / `98679560122`.

The three standard success artifacts are regression evidence only:

- 20,998-byte parser artifact `9665568889`, named
  `filing-parser-isolation-evidence-v1-d642e534b8911b58a32d50f8dfb976ae2900cadc-1`,
  ZIP digest
  `sha256:3f426a9559c0c763a17246fef27717407fe2d450c2c5678e6507874d6936e140`;
- 3,468-byte custody artifact `9665533082`, named
  `filing-payload-custody-evidence-v1-d642e534b8911b58a32d50f8dfb976ae2900cadc-1`,
  ZIP digest
  `sha256:5096ad1ac6ec15222f033f322c50f9112745dd29a86c9830268cc5c746fa1f85`;
- 5,308-byte normalization artifact `9665547940`, named
  `filing-parser-normalization-execution-evidence-v1-d642e534b8911b58a32d50f8dfb976ae2900cadc-1`,
  ZIP digest
  `sha256:3681aa3f111f7a774d8ecf585f184c06d921551ac9b1320cb140b5feb1166714`.

No independent offline review is claimed for these regression artifacts.

## Exit rule

Every repository-controlled row is Pass only for the exact promoted chain
above. The result does not establish an external 100-filing inventory,
independent rights-authority or data-steward approval, trusted evaluation time,
authenticated human authority or review, real filing bytes, real quality or
adjudication, B15/V15, real-data admission, full Cycle 2 exit, or production
authorization. Those requirements remain Blocked.
