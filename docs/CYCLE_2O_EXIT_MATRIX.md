# Cycle 2o exit matrix

Scope: compose encrypted custody and authenticated readback of the exact
synthetic original/amendment parser archives into unchanged Cycle 2n. The
decision is recorded in
[ADR 0042](./adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md).

Current status: **Promoted only for exact revision
`472cc10b8df90bee01925b2efd4fbcb614d7590c`, the exact corrective child of
source precursor `46408ec875755ef531c124846143e9b619c1961f` from frozen
baseline `711fe866594d5e20a657a24c0a0c72fd78ab90be`.** The result remains
`evaluated/not_met`; Cycle 2b authority, real quality, B15/V15, real-data admission, full
Cycle 2 exit, and production remain Blocked.

| Gate                                | Required result                                                                                                                                                                                       | Current status |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Exact archive identities            | The fixed 2,306-byte original and 2,330-byte amendment archives match their frozen content digests and cannot be swapped, substituted, repaired, or widened                                           | Pass           |
| Sealed composition boundary         | Public configuration exposes only sealed Cycle 2n engine descriptors; no custody/execution boundary, clock, entropy, key, nonce, path, digest, receipt, result, callback, or options seam             | Pass           |
| Async one-shot state                | The outer operation reserves before validation or I/O; concurrency, replay, retry, substitution, and reset fail closed                                                                                | Pass           |
| Role-bound encrypted custody        | Separate fresh AES-256-GCM key/nonce pairs and closed AAD bind each role, exact content identity, and internally derived source binding                                                               | Pass           |
| Atomic pair publication             | Both bounded ciphertext and canonical audit records complete before publication; partial staging cannot become an accepted pair                                                                       | Pass           |
| Authenticated readback              | Readback accepts only exact bounded regular files and recomputes AAD, ciphertext, plaintext, receipt, and pair bindings                                                                               | Pass           |
| No direct-input bypass              | Only owned authenticated readback snapshots enter a fresh unchanged Cycle 2n protocol                                                                                                                 | Pass           |
| Unchanged quality delegation        | Cycle 2n claim/schema, capability, execution, mapping, Cycle 2g/Cycle 2f delegation, thresholds, and failed-threshold order remain unchanged                                                          | Pass           |
| Honest fixed-denominator result     | Exactly 2/100 documents, 20/1,000 true-positive facts, 980 missing facts, and 1,960/2,000 silent failures produce `evaluated/not_met`                                                                 | Pass           |
| Binding completeness                | Outer commitment/evaluation hashes bind custody receipts/pair, source context, Cycle 2n commitment/evaluation, plan, and declared-reference digest                                                    | Pass           |
| Repeat behavior                     | Same inputs preserve archive, normalization, candidate, and measurement hashes while fresh custody material, Docker lifecycles, and outer bindings remain distinct                                    | Pass           |
| Atomic quarantine and cleanup       | Every invalid or failed path returns one deeply frozen value-free quarantine, attempts key/plaintext cleanup, removes only its verified workspace, and leaves zero observed residue                   | Pass           |
| Local verification                  | Format, lint, guardrails, dependency policy, typechecks, security/unit suites, tests, and builds pass on exact source bytes                                                                           | Pass           |
| Exact-source workflows              | The five triggered workflows—Ubuntu/Windows CI, parser isolation, payload custody, normalization execution, and dedicated cross-engine version 5—reach terminal green                                 | Pass           |
| Success-only evidence and review    | A new immutable record binds the exact transition, cases, checks/nonclaims, sources, engines, custody/runtime accounting, and prior history; independent anchored review returns `offline_consistent` | Pass           |
| Historical immutability             | Cycle 2c v1 and cross-engine Cycle 2k v1, Cycle 2l v2, Cycle 2m v3, and Cycle 2n v4 evidence and failed-run history remain immutable and are not relabeled                                            | Pass           |
| External authority and real quality | Representative real filings, independently adjudicated assertions, real quality, Cycle 2b rights/authority, real data, B15/V15, and production are not established                                    | Blocked        |

## Target claim

The sole bounded target claim is
`bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding`.
It is accepted only for the exact source chain and evidence boundary in ADR 0042.

## Exact accounting

The only admissible successful evaluation preserves Cycle 2n exactly:

- 100 declared documents: 2 succeeded, 98 missing, 0 quarantined.
- 1,000 expected facts: 20 emitted/true-positive, 0 false-positive, 980
  missing/false-negative.
- 2,000 critical assertions: 1,960 silent failures.
- Precision `20/20` and quarantine rate `0/100` meet.
- Document success `2/100`, recall `20/1000`, and maximum silent failures do
  not meet.
- Overall measurement outcome `not_met` inside protocol status `evaluated`.

Custody may bind the input route but cannot change any quality coordinate,
denominator, threshold, failed-threshold order, or outcome.

## Nonclaims

All 16 exact ordered Cycle 2n nonclaims remain the frozen ordered prefix without
replacement. Six custody-specific limitations are appended: no host/OS/
filesystem/temp/disk/runtime attestation; physical or cryptographic erasure;
durable retention/expiry/crash recovery/backup deletion; cross-process custody
recovery; production identity, rotation, or nonrepudiation for the ephemeral
key; or guaranteed JavaScript plaintext-memory wiping. ADR 0042 records the
complete exact ordered tuple.

## Promotion record

Promoted revision `472cc10b8df90bee01925b2efd4fbcb614d7590c` is the exact
corrective child of source precursor
`46408ec875755ef531c124846143e9b619c1961f`, which is the direct child of
frozen baseline `711fe866594d5e20a657a24c0a0c72fd78ab90be`. The cumulative
baseline-to-promoted transition contains exactly 39 paths and 78 NUL fields
with digest
`sha256:d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212`.
The corrective transition contains exactly 14 paths, 28 NUL fields, and 1,274
bytes with digest
`sha256:5104d3ef85cfcee8e62010d9a76e3efbf0479dcf7f777fa784e956620b02df63`.

Full local verification passed 1,295 tests with 4 intentional skips. All five
triggered workflows reached terminal green. CI run `33060480830` passed Ubuntu
job `98477727410` and Windows job `98477727517`; parser isolation run/job
`33060480816` / `98477727240`, payload custody `33060480845` / `98477727017`,
normalization execution `33060480837` / `98477728031`, and dedicated version 5
run/job `33060480847` / `98477728062` passed. No separate PostgreSQL workflow
was triggered by the exact corrective path set.

The dedicated run retained 12,449-byte artifact `9641519947`, named
`filing-parser-cross-engine-execution-evidence-v5-472cc10b8df90bee01925b2efd4fbcb614d7590c-1`.
Its ZIP digest is
`sha256:82916aa3b53112b8cc29b0e3bc5e575213757ca70a7d623a87d0167c89ecf419`.
The canonical entry
`research-cockpit-filing-parser-cross-engine-execution-v5.json` is 45,312
bytes, status `passed`, version `5`, schema `5.0.0`, and has digest
`sha256:1f53136f1811b19de0ba63ae1c1ec6d70cf2d5f86f578214e884069d137e5581`.
It binds `sourceCount: 105`, `transitionPathCount: 39`, the exact ordered
checks/nonclaims, outcomes, engines, custody/runtime accounting, and prior
evidence history. Independently anchored review returned `offline_consistent`.
Artifact expiry is 2026-09-26; expiry does not alter the recorded reviewed
digest or widen the claim.

## Corrective baseline chain

Separate P1 source `96b042669edc6cb4a876bb0c061fa5e18732c1ca` caps Phase-A
corpus-admission `validUntil` at scheduled revocation. Its exact historical
chain, immutable implementation blob, independent verifier routing, and Windows
identity corrective are promoted separately by Cycle 2p only at revision
`d642e534b8911b58a32d50f8dfb976ae2900cadc`. That result is not Cycle 2o
evidence and does not replace or reinterpret version 5. It cannot supply the
external inventory, rights/steward approvals, authority identity, trusted
clock, or human review required by Cycle 2b. See the
[Cycle 2p exit matrix](./CYCLE_2P_EXIT_MATRIX.md).

## Exit rule

Every repository-controlled row is Pass only for the exact promoted source
chain and version 5 evidence boundary above. The result is only a bounded
synthetic custody-readback composition with an honest `evaluated/not_met`
quality outcome. External authority, representative real filings, independent
adjudication, real quality, B15/V15, real-data admission, full Cycle 2 exit,
and production remain Blocked.
