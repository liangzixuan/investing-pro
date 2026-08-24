# Cycle 2g exit matrix

Scope: one disconnected, bounded synthetic in-process protocol that commits an
owned candidate-observation snapshot before accepting declared-reference bytes,
then performs at most one digest-bound reveal and delegates the resulting fixed
roles to the Cycle 2f quality evaluator. The decision is recorded in
[ADR 0034](./adr/0034-bounded-synthetic-declared-reference-precommitment.md).
The same atomic transition hardens public Cycle 2f byte snapshotting against
hostile typed-array metadata, constructor, and species hooks.

Current status: **local integration and two-OS CI at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708` remain historical green facts, but
the Cycle 2g bounded owned-byte security conclusion and Cycle 2f restoration
are Superseded. A re-prototyped `SharedArrayBuffer` could pass backing prototype
equality, re-prototyped alternate typed arrays could pass carrier prototype
equality, and Cycle 2g performed a proxy-sensitive prototype check before
complete intrinsic brand validation. Cycle 2h implementation and focused
coverage restore the bounded owned-byte conclusion only on exact hardened
successor commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, where the local,
source, two-OS CI, parser live acceptance, and custody live acceptance gates are
Pass. Those parser and custody runs are regression and historical-boundary
anchors, not a new Cycle 2h, Cycle 2g, or Cycle 2f evidence domain. Cycle 2b, full
Cycle 2 quality, and production admission remain Blocked.** There is no real filing,
external configuration, authenticated chronology, independent adjudication,
dedicated Cycle 2g workflow, evidence schema, artifact, offline evidence review,
or evidence note.

| Gate                             | Required result                                                                                                                                                                                                             | Current status                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Exact protocol                   | A zero-argument factory creates one synchronous in-process `commit` / `reveal` protocol instance                                                                                                                            | Historical Pass; semantics unchanged                                                                                      |
| One-shot state                   | State advances only `open` to `candidate_committed` to `consumed`; every first invalid or conflicting attempt consumes without retry or reset                                                                               | Historical Pass; semantics unchanged                                                                                      |
| Reference-content-free commit    | The committed candidate observations bind the exact declared-reference SHA-256 but contain no declared-reference bytes/content or caller `producedAt`                                                                       | Historical Pass; semantics unchanged                                                                                      |
| Owned candidate snapshot         | The candidate snapshot is validated against the closed 100-document coordinate space, with omissions preserved for fail-closed evaluation                                                                                   | Historical Pass; semantics unchanged                                                                                      |
| Capability                       | Commit returns one empty, frozen, identity-bound, same-instance, single-use capability that cannot be serialized into authority                                                                                             | Historical Pass; semantics unchanged                                                                                      |
| Digest-bound reveal              | Reveal consumes first, recomputes the declared-reference byte digest, requires the committed digest, and injects only fixed Cycle 2f compatibility data                                                                     | Historical Pass; semantics unchanged                                                                                      |
| Exact Cycle 2f evaluation        | The derived candidate and revealed reference delegate to the public Cycle 2f evaluator without changing its fixed population, metrics, or thresholds                                                                        | Historical Pass; semantics unchanged                                                                                      |
| Intrinsic byte snapshots         | Both boundaries require the intrinsic `Uint8Array` element type and exact prototype, intrinsic `ArrayBuffer` brand and exact prototype, safe check ordering, preallocation limits, ordinary allocation, and intrinsic `set` | Pass only at exact Cycle 2h successor commit `61701307ded7fa77a555e27925ae86670f6b4dc0`                                   |
| Aggregate-only result            | Successful receipts are immutable and aggregate-only; quarantine is empty and value-free with zero audit counts and `measurement: null`                                                                                     | Historical Pass; semantics unchanged                                                                                      |
| Local integration                | Format, lint, guardrails, all project typechecks/tests, and builds pass on exact Cycle 2h source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`                                                                          | Pass — exact inventory: 47 files; 1,017 passed + 2 skipped (1,019 total)                                                  |
| Two-OS CI                        | The frozen source gate for exact Cycle 2h commit `61701307ded7fa77a555e27925ae86670f6b4dc0` passes on Ubuntu and Windows                                                                                                    | Pass only at exact Cycle 2h successor commit `61701307ded7fa77a555e27925ae86670f6b4dc0`; exact anchors in Cycle 2h matrix |
| Dedicated evidence               | Separate workflow/schema/artifact/offline review                                                                                                                                                                            | Not created                                                                                                               |
| External blinding and chronology | Actual prior reference inaccessibility, label-leakage absence, and authenticated cross-process chronology are established                                                                                                   | Not proven; outside 2g                                                                                                    |
| Cycle 2b authority               | Exact external inventory, approvals, chronology, and human authority review pass before real bytes                                                                                                                          | Blocked; outside 2g                                                                                                       |
| Full Cycle 2 quality             | Representative real filings and 2,000 independently adjudicated real assertions meet approved thresholds with zero silent failures                                                                                          | Blocked                                                                                                                   |
| Production admission             | Real-data rights, authenticity, persistence, security, privacy, scale, and operational gates pass                                                                                                                           | Blocked                                                                                                                   |

The exact final pre-promotion local source gate passed formatting, full ESLint,
all guardrails, the production-license check across 86 versions, and every
scripted typecheck, test, and build across 12 of 13 workspace projects. All 47
test files completed with 987 passed plus two skipped (989 total), including 39
Cycle 2f tests, 29 Cycle 2g tests, 582 database tests, 70 parser tests, and 41
passed plus two skipped custody tests. The boundary verifier is green. No
source bytes changed between that local gate and exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`. CI run `32690685837` passed in
Ubuntu job `97323672725` and Windows job `97323672813`. Parser run/job
`32690685841` / `97323672800`, custody run/job `32690685846` / `97323672628`,
and PostgreSQL run/job `32690685829` / `97323672631` passed as unchanged
regression health only; they are not Cycle 2g or Cycle 2f restoration evidence.
Those gates remain historical green facts, but the missing intrinsic backing
brand and safe prototype ordering mean they no longer support either bounded
owned-byte conclusion.

The canonical synthetic met fixture commits observations for all 100 fixed
documents: 99 succeeded, one explicitly quarantined, and 990 emitted facts.
After exact digest-matching declared-reference bytes are revealed, the delegated
Cycle 2f measurement records 990 true positives, zero false positives, ten
false negatives, zero silent critical failures, and 1,980 passed assertions
while accounting for all 2,000. It meets the fixed synthetic-pilot policy. This
is one in-process fixture sequence, not evidence of actual external blinding,
real chronology, real-parser quality, or production threshold approval.

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation`.

The exact ordered checks are:

1. `exact_one_shot_in_process_protocol_factory_and_open_candidate_committed_consumed_state_machine`
2. `first_commit_or_reveal_attempt_reserves_and_consumes_before_validation_and_forbids_retry_or_reset`
3. `exact_commit_plan_and_reference_content_free_digest_bound_candidate_observation_then_reveal_capability_and_declared_reference_roles`
4. `owned_bounded_utf8_canonical_json_snapshots_and_duplicate_key_rejection`
5. `closed_label_separated_plan_candidate_observation_and_declared_reference_schemas`
6. `fixed_cycle2f_schema_claim_function_and_095_099_099_005_zero_silent_exact_unit_zero_date_policy_binding`
7. `candidate_observation_payload_binds_exact_reference_digest_but_excludes_reference_content_produced_at_metrics_counts_weights_exclusions_and_outcomes`
8. `full_reference_content_free_candidate_document_fact_quarantine_sorted_unique_closed_population_validation_at_commit`
9. `domain_separated_plan_candidate_observation_and_reference_digest_commitment_recomputation_and_immutable_aggregate_receipt`
10. `opaque_instance_identity_bound_empty_frozen_single_use_capability_and_serialization_does_not_transfer_authority`
11. `reveal_recomputes_committed_reference_digest_and_injects_fixed_candidate_role_produced_at_into_exact_derived_cycle2f_candidate`
12. `exact_cycle2f_measurement_execution_preserves_fixed_denominators_missing_quarantine_wrong_prediction_zero_denominator_and_integer_ratio_semantics`
13. `committed_snapshot_mutation_safety_and_substitution_replay_cross_instance_capability_or_role_swap_fail_closed`
14. `valid_below_threshold_quality_remains_evaluated_not_met_and_reference_digest_mismatch_is_consuming_quarantine`
15. `immutable_aggregate_only_commit_and_evaluated_receipts_or_empty_value_free_quarantine_and_canary_absence`
16. `domain_separated_determinism_no_io_clock_randomness_parser_custody_corpus_normalizer_comparison_database_api_web_queue_or_historical_evidence_mutation`

## Exact nonclaims

The exact ordered nonclaims are:

1. `actual_reference_content_inaccessibility_to_caller_before_commit_external_blinding_or_label_leakage_absence`
2. `trusted_clock_timestamp_cross_process_host_operator_or_failure_domain_chronology_authenticity`
3. `durable_distributed_commitment_storage_receipt_timestamp_transparency_log_recovery_or_nonrepudiation`
4. `candidate_or_commitment_signer_identity_key_authority_signature_or_external_capability_security`
5. `reference_digest_or_candidate_commitment_hiding_secrecy_salt_privacy_zero_knowledge_or_adaptive_oracle_resistance`
6. `declared_reference_correctness_independent_adjudicator_identity_or_human_resolution_quality`
7. `candidate_observation_parser_execution_identity_digest_authenticity_or_cycle2d_cycle2e_output`
8. `cycle2b_external_inventory_rights_steward_key_authority_human_review_or_phaseb_admission`
9. `real_filing_payload_presence_digest_equality_sec_source_authenticity_or_custody`
10. `representative_100_real_filings_independently_adjudicated_2000_real_assertions_or_real_parser_quality`
11. `threshold_statistical_adequacy_confidence_calibration_or_production_acceptance`
12. `strategic_quarantine_reason_authenticity_malicious_failure_masking_collusion_or_common_mode_failure`
13. `general_xbrl_ixbrl_taxonomy_concept_alias_unit_conversion_dimension_fiscal_or_amendment_correctness`
14. `network_fetch_custody_retention_kms_backup_deletion_or_cryptographic_erasure`
15. `database_api_web_queue_persistence_evidence_passport_rights_projection_b15_v15_or_slo`
16. `production_identity_secrets_real_data_full_cycle2_exit_or_production_use`

## History and exit rule

Cycle 2a's canonical 16 checks, 16 nonclaims, 26-source schema, artifact, and
evidence note remain unchanged. Cycle 2c's canonical 16 checks, 16 nonclaims,
29-source schema, artifact, and evidence note remain unchanged. Their offline
verifiers may accept Cycle 2g only as the exact atomic 32-path transition (23
modified and nine added paths) from
`033e59cc06a421f104ecd869ae77ac694fa8ff31`; its cumulative Cycle 2c custody
surface remains exactly 73 unique paths because both hardened Cycle 2f paths
were already introduced by Cycle 2f. No Cycle 2g result enters either
historical record.

Cycle 2f's Ubuntu and Windows CI anchors remain historical green gate facts for
source commit `72e91f502b31f15deeaad761b82d9ed7b6377d39` only. Missing hostile
carrier coverage made its bounded owned-snapshot check false, so the prior
Cycle 2f source-stage security conclusion is Superseded. The anchors do not
attest the current hardened Cycle 2f implementation or security-test bytes;
those bytes are part of the exact Cycle 2g transition. Their local restoration
gate and Cycle 2g Ubuntu/Windows CI passed on exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`, historically restoring the
hardened Cycle 2f bounded claim for those bytes. That restoration and the Cycle
2g conclusion remain Superseded for those historical bytes; the original
`72e91f5` conclusion also remains Superseded. Cycle 2h restores only the
corresponding bounded owned-byte conclusions at exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.

Cycle 2g's bounded source-stage security conclusion for `df1ddff` remains
Superseded despite the
exact frozen-byte local gate and Ubuntu/Windows CI agreement on source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`. Its bounded owned-byte portion is
restored only at exact successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, where every Cycle 2h promotion gate
passes. Failure, cancellation, an omitted,
extra, renamed, or deleted transition path, a partial package tree,
reference content in the commit document, an unbound reference digest, a
retry/reset path, reusable or cross-instance capability, mutation leakage,
caller-controlled typed-array metadata or allocation dispatch, non-value-free
quarantine, or any real-data input prevents promotion. This bounded owned-byte
restoration does not prove actual external blinding, label
secrecy, authenticated chronology, independent adjudication, real parser
quality, Cycle 2b authority, approved production thresholds, full Cycle 2 exit,
B15/V15, or production use.

Cycle 2h hardens the plan, candidate-observation, and declared-reference roles
in this package plus all three delegated Cycle 2f roles. Intrinsic `Uint8Array`
element-type and `ArrayBuffer` brand validation occur with exact prototypes and
safe ordering before role limits, ordinary allocation, and intrinsic copy. All non-carrier schemas,
exact checks, exact nonclaims, metric arithmetic, one-shot state, capability,
delegation, failure/result semantics, historical anchors, exact historical
32-path/73-unique transition, and no-dedicated-evidence status remain
unchanged. Cycle 2h is the exact 40-path transition (38 modified and two added)
from `14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`. The additional path is the
existing historical local custody fixture manifest,
not a new/dedicated/live evidence artifact. Its two changed custody source/test
SHA-256 entries refresh, while fixture cases, schema, order, and payload
identity/content remain unchanged. The local, source, two-OS CI, parser live
acceptance, and custody live acceptance promotion gates all pass only for exact
source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`. The parser and custody
runs remain regression and historical-boundary anchors rather than a new
evidence domain; the [Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md) records
their exact remote anchors.
