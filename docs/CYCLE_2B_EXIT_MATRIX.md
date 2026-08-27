# Cycle 2b exit matrix

Scope: a metadata-only, side-effect-free protocol for admitting one exact,
immutable, content-addressed public-filing candidate manifest after separate
rights-authority and data-steward approvals. The decision is recorded in
[ADR 0029](./adr/0029-fixed-public-filing-candidate-manifest-admission.md).

Current status: **Phase-A verifier protocol implemented; its recorded local and
CI jobs remain historical green facts, but the prior bounded owned-byte
security conclusion remains Superseded for those original bytes. Cycle 2b is
Blocked.** Caller document
carriers could spoof backing/length metadata or dispatch allocation hooks.
Cycle 2h restores the corresponding bounded owned-byte conclusion only on exact
hardened successor commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, where
the local, source, two-OS CI, parser live acceptance, and custody live
acceptance gates are Pass. Those parser and custody runs are regression and
historical-boundary anchors, not a Cycle 2b or new Cycle 2h evidence domain.
There
is no real configuration, external metadata inventory, approval, Cycle 2b
workflow, run, evidence schema, artifact, or evidence note. The target claim
`fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission`
has not been established.

Cycle 2p promotes one narrower repository-controlled conclusion only at exact
revision `d642e534b8911b58a32d50f8dfb976ae2900cadc`: an otherwise valid record's
`validUntil` cannot exceed either approval expiry or either supplied scheduled
authority revocation, and protected changes cannot inherit older evidence
routing. This does not authenticate the registry, time, authorities, approvals,
or candidate corpus and therefore does not change Cycle 2b's Blocked status.

Every Pass entry below records the historical exact-source result. The
successor owned-byte restoration is limited to the exact Cycle 2h commit above
and does not establish the blocked Cycle 2b target.

| Gate                     | Required result                                                                                                                                                         | Current status                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Exact external inventory | Exactly 100 unique accessions with exact content digests and closed CIK/form/time/taxonomy/amendment metadata                                                           | Blocked — no external candidate manifest exists                                                                                  |
| Frozen selection         | Signed timestamp/hash consistency places the supplied selection freeze before supplied parser/adjudication results; external attestation establishes no earlier results | Blocked — no externally reviewed plan or chronology attestation exists                                                           |
| Frozen adjudication      | The adjudication protocol is hash-bound before measurement                                                                                                              | Blocked — no externally reviewed protocol exists                                                                                 |
| Rights approval          | A distinct Ed25519 `rights_authority` approval binds the exact manifest, plans, purpose, retention class, and `authorityKeysSha256`                                     | Blocked — no rights approval exists                                                                                              |
| Steward approval         | A distinct Ed25519 `data_steward` approval binds the same exact inputs and `authorityKeysSha256`                                                                        | Blocked — no steward approval exists                                                                                             |
| Key authority and time   | Human review authenticates the out-of-band authority/revocation registry; trusted out-of-band `evaluatedAt` supplies current time                                       | Blocked — no real authority configuration, clock review, or human review exists                                                  |
| Verifier protocol        | Exact canonical parsing, closed schemas, atomic failure, signature/scope/expiry checks, replay, and mutation rejection exist in source                                  | Pass — locally verified                                                                                                          |
| Validity-window bound    | `validUntil` is the earliest rights/steward approval expiry or supplied scheduled revocation; evaluation at the cutoff fails closed                                     | Pass only for the exact promoted Cycle 2p revision                                                                               |
| Promotion-chain routing  | Exact historical implementation blob, source/corrective topology, transition path sets, and protected-surface fail-closed precedence are independently enforced         | Pass only for the exact promoted Cycle 2p revision                                                                               |
| Local integration        | Format, lint, guardrails, all project typechecks/tests, and builds pass on frozen bytes                                                                                 | Pass — 34 files / 810 tests; all builds and 86 production-license checks                                                         |
| Regression CI            | The same frozen source gate passes on the reviewed CI matrix                                                                                                            | Pass — commit `b9a9edf680b4c3a7373cd6d96210a24544ba0bbe`; run `32447542432`; Ubuntu job `96669820813`; Windows job `96669820914` |
| Dedicated evidence       | A separately authorized success-only workflow and evidence domain bind the exact commit, inputs, source hashes, checks, and nonclaims                                   | Not created in Phase A                                                                                                           |
| Independent review       | Original external inputs, authenticated logs, retained artifact, and exact-commit offline review independently agree                                                    | Not performed                                                                                                                    |
| Full Cycle 2 quality     | Real payload bytes, ten normalized facts, dual validation, 2,000 adjudicated assertions, frozen quality thresholds, and zero silent critical failures pass              | Blocked; outside Cycle 2b                                                                                                        |
| Production admission     | External fetch/security, payload custody/retention, production keys/host/queues, composition, load, and real-data controls pass                                         | Blocked                                                                                                                          |

The successful concurrent Cycle 2a parser run `32447542455` and artifact
`9434590292` are regression health only. They are not Cycle 2b evidence and do
not replace the canonical Cycle 2a result.

## Target claim and fixed checks

The sole bounded target claim is
`fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission`.
It is not a Phase-A result.

The exact ordered checks for a future exit are:

1. `exact_canonical_candidate_manifest_and_duplicate_key_rejection`
2. `fixed_100_accession_content_hash_inventory`
3. `unique_accession_content_identity_and_duplicate_weighting_rejection`
4. `closed_form_cik_timestamp_taxonomy_and_amendment_metadata`
5. `selection_plan_frozen_before_parser_or_adjudication_results`
6. `frozen_strata_counts_and_exclusion_reason_accounting`
7. `adjudication_protocol_hash_bound_before_measurement`
8. `external_approval_binds_manifest_selection_protocol_purpose_and_retention_class`
9. `out_of_band_authority_key_and_curator_approver_separation`
10. `wrong_key_algorithm_scope_expiry_revocation_and_signature_tamper_rejection`
11. `immutable_versioned_manifest_and_no_update_surface`
12. `whole_manifest_atomic_accept_or_value_free_rejection`
13. `no_raw_filing_approval_body_or_sensitive_metadata_in_logs_or_evidence`
14. `no_network_fetch_parser_database_api_web_or_queue_execution`
15. `deterministic_exact_byte_replay_and_mutation_conflict`
16. `source_history_and_cycle2a_preservation`

Check 10 proves rejection only against the exact supplied revocation snapshot;
it does not establish that the snapshot is current. `evaluatedAt` is a trusted
out-of-band input, never approval- or candidate-supplied; Phase A does not prove
the clock's authenticity. Cycle 2p additionally proves that an admitted
record's `validUntil` is capped by the earliest applicable scheduled revocation
in that same supplied snapshot. It does not prove the schedule's freshness or
authority.

Check 5 proves only signed timestamp/hash consistency. The absence of prior
parser or adjudication results is externally attested chronology. Even
`status: "admitted"` proves only internal schema/cryptographic consistency under
the supplied authority registry. Future exit requires a human/host to compare
its exact digest with the reviewed out-of-band anchor; admission is never
itself an authority, counsel, or steward identity decision.

## Exact nonclaims

The exact ordered nonclaims are:

1. `legal_opinion_validity_counsel_identity_authentication_or_revocation_freshness`
2. `sec_source_authenticity_or_sec_attestation`
3. `raw_payload_presence_byte_hash_validation_ingestion_custody_retention_crypto_erasure_or_backup_deletion`
4. `external_fetch_edgar_dns_tls_ssrf_or_rate_limits`
5. `malware_scanning_or_zero_day_safety`
6. `ten_fact_normalization_or_parser_correctness`
7. `independently_adjudicated_ground_truth_or_2000_assertions`
8. `precision_recall_quality_or_zero_silent_critical_failures`
9. `dual_parser_independence_or_conflict_quarantine`
10. `general_xbrl_ixbrl_taxonomy_or_plugins`
11. `correction_supersession_lineage_execution`
12. `production_key_kms_hsm_custody_or_rotation`
13. `queue_scheduler_retry_exactly_once_or_load_slo`
14. `database_api_web_composition_or_b15_v15`
15. `representativeness_beyond_exact_approved_selection_plan`
16. `real_data_beyond_exact_approved_manifest_or_production_admission`

## Exit rule

Phase A cannot exit Cycle 2b. A later review may promote the bounded claim only
after the exact external 100-entry metadata inventory, frozen selection
and adjudication inputs, distinct rights/steward signatures, and human
key-authority review exist; the frozen-byte local gate passes; and a separately
authorized success-only workflow, retained canonical artifact, authenticated
logs, and independent exact-commit offline review all agree.

Failure, cancellation, missing external authority, or synthetic approval inputs
must produce no candidate artifact and no status promotion. Even a future
Cycle 2b exit would not prove raw payload existence or digest equality, full
Cycle 2 quality, source authenticity, counsel identity or legal validity,
revocation freshness, application composition, B15/V15, real-data admission,
or production readiness.

Cycle 2d is a successor-only closed synthetic normalization/lineage
contract. It provides none of the external inputs or human authority required
above, creates no Cycle 2b workflow or evidence, and does not change this
Blocked status. See the [Cycle 2d exit matrix](./CYCLE_2D_EXIT_MATRIX.md).

Cycle 2e is a successor-only same-schema synthetic comparison contract. Its
fixed validator declarations are not counsel, steward, key-authority, source,
or parser identities and provide none of the external inputs or human review
required above. It creates no Cycle 2b workflow or evidence and does not change
this Blocked status. See the [Cycle 2e exit matrix](./CYCLE_2E_EXIT_MATRIX.md).

Cycle 2f is a successor-only fixed-population synthetic metric-accounting
contract. Its declared reference is not an independently adjudicated corpus,
and its synthetic roles and thresholds provide no external inventory,
rights/steward approval, chronology authority, or human key review. It creates
no Cycle 2b workflow or evidence and does not change this Blocked status. See
the [Cycle 2f exit matrix](./CYCLE_2F_EXIT_MATRIX.md).

Cycle 2g is a successor-only in-process synthetic precommitment contract. Its
candidate-observation digest, object-identity capability, and one-shot call
order authenticate no counsel, steward, authority registry, external clock,
adjudicator, corpus, filing, or parser and provide none of the external Phase-B
inputs. It creates no Cycle 2b workflow or evidence and does not change this
Blocked status. See the [Cycle 2g exit matrix](./CYCLE_2G_EXIT_MATRIX.md).

Cycle 2h hardens the seven Phase-A byte-document roles with intrinsic
typed-array backing, length, and element-type reads before proxy-sensitive
prototype checks, exact intrinsic `Uint8Array` element type/prototype and
intrinsic `ArrayBuffer` brand/prototype validation, each document's actual
maximum before allocation, and an ordinary intrinsic copy. It supplies
no external inventory, approval, chronology, authority, workflow, artifact, or
evidence and does not change Cycle 2b's Blocked status. All Cycle 2h promotion
gates pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. The parser and custody runs remain
regression and historical-boundary anchors rather than a new evidence domain;
the [Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md) records their exact remote
anchors.

Cycle 2p promotes the repository-controlled validity correction only for exact
revision `d642e534b8911b58a32d50f8dfb976ae2900cadc`, the exact corrective child
of source `bc4b371784711102462ad28a9c9eb7cb567f1072`. The immutable Phase-A
implementation caps `validUntil` at the earliest approval expiry or supplied
scheduled rights/steward revocation. Independent parser and custody verifiers
anchor the historical implementation blob and chain. Those verifiers and the
cross-engine workflow independently enforce the exact promotion transition,
route any protected-surface touch before Cycle 2o, and fail closed outside the
one allowed source/corrective topology. The corrective child also replaces
lossy numeric Windows custody identity checks with exact bigint metadata.

Cycle 2p creates no external inventory, approval, authority identity, trusted
clock, human review, Cycle 2b workflow, canonical evidence version, or
independent offline review. Its standard workflow artifacts are regression
anchors only, and Cycle 2o version 5 remains unchanged. It therefore does not
establish the Cycle 2b target claim or alter this matrix's Blocked status. See
the [Cycle 2p exit matrix](./CYCLE_2P_EXIT_MATRIX.md) and
[ADR 0043](./adr/0043-admission-validity-corrective-chain-promotion.md).
