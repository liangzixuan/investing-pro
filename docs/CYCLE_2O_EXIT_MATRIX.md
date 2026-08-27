# Cycle 2o exit matrix

Scope: compose encrypted custody and authenticated readback of the exact
synthetic original/amendment parser archives into unchanged Cycle 2n. The
proposed decision is recorded in
[ADR 0042](./adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md).

Current status: **Source completion, exact-source verification, workflow
evidence, independent review, and promotion are Pending.** No target source
commit, run, job, artifact, digest, or Pass claim exists. Cycle 2b authority,
real quality, B15/V15, real-data admission, full Cycle 2 exit, and production
remain Blocked.

| Gate                                | Required result                                                                                                                                                                                       | Current status |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Exact archive identities            | The fixed 2,306-byte original and 2,330-byte amendment archives match their frozen content digests and cannot be swapped, substituted, repaired, or widened                                           | Pending        |
| Sealed composition boundary         | Public configuration exposes only sealed Cycle 2n engine descriptors; no custody/execution boundary, clock, entropy, key, nonce, path, digest, receipt, result, callback, or options seam             | Pending        |
| Async one-shot state                | The outer operation reserves before validation or I/O; concurrency, replay, retry, substitution, and reset fail closed                                                                                | Pending        |
| Role-bound encrypted custody        | Separate fresh AES-256-GCM key/nonce pairs and closed AAD bind each role, exact content identity, and internally derived source binding                                                               | Pending        |
| Atomic pair publication             | Both bounded ciphertext and canonical audit records complete before publication; partial staging cannot become an accepted pair                                                                       | Pending        |
| Authenticated readback              | Readback accepts only exact bounded regular files and recomputes AAD, ciphertext, plaintext, receipt, and pair bindings                                                                               | Pending        |
| No direct-input bypass              | Only owned authenticated readback snapshots enter a fresh unchanged Cycle 2n protocol                                                                                                                 | Pending        |
| Unchanged quality delegation        | Cycle 2n claim/schema, capability, execution, mapping, Cycle 2g/Cycle 2f delegation, thresholds, and failed-threshold order remain unchanged                                                          | Pending        |
| Honest fixed-denominator result     | Exactly 2/100 documents, 20/1,000 true-positive facts, 980 missing facts, and 1,960/2,000 silent failures produce `evaluated/not_met`                                                                 | Pending        |
| Binding completeness                | Outer commitment/evaluation hashes bind custody receipts/pair, source context, Cycle 2n commitment/evaluation, plan, and declared-reference digest                                                    | Pending        |
| Repeat behavior                     | Same inputs preserve archive, normalization, candidate, and measurement hashes while fresh custody material, Docker lifecycles, and outer bindings remain distinct                                    | Pending        |
| Atomic quarantine and cleanup       | Every invalid or failed path returns one deeply frozen value-free quarantine, attempts key/plaintext cleanup, removes only its verified workspace, and leaves zero observed residue                   | Pending        |
| Local verification                  | Format, lint, guardrails, dependency policy, typechecks, security/unit suites, tests, and builds pass on exact source bytes                                                                           | Pending        |
| Exact-source workflows              | Ubuntu/Windows CI and every triggered parser, custody, normalization, PostgreSQL, dedicated successor, and dependency-review workflow reach terminal green                                            | Pending        |
| Success-only evidence and review    | A new immutable record binds the exact transition, cases, checks/nonclaims, sources, engines, custody/runtime accounting, and prior history; independent anchored review returns `offline_consistent` | Pending        |
| Historical immutability             | Cycle 2c v1 and cross-engine Cycle 2k v1, Cycle 2l v2, Cycle 2m v3, and Cycle 2n v4 evidence and failed-run history remain immutable and are not relabeled                                            | Pending        |
| External authority and real quality | Representative real filings, independently adjudicated assertions, real quality, Cycle 2b rights/authority, real data, B15/V15, and production are not established                                    | Blocked        |

## Target claim

The sole proposed bounded target claim is
`bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding`.
It remains Pending until the exact source and evidence boundary in ADR 0042 is
completed and independently reviewed.

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

## Corrective baseline chain

Separate P1 source `96b042669edc6cb4a876bb0c061fa5e18732c1ca` caps Phase-A
corpus-admission `validUntil` at scheduled revocation. Its corrective closure
and promotion remain Pending. It is not Cycle 2o evidence and cannot supply the
external inventory, rights/steward approvals, authority identity, trusted
clock, or human review required by Cycle 2b.

## Exit rule

Cycle 2o remains Pending until every repository-controlled row above is Pass on
one exact source, every triggered workflow is terminal green, a success-only
artifact is retained and independently reviewed, and all historical evidence
is preserved. Even then, the result is only a bounded synthetic custody-
readback composition with an honest `evaluated/not_met` quality outcome.
