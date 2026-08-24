# ADR 0034: bounded synthetic declared-reference precommitment

Status: exact-source local and two-OS CI jobs at
`df1ddffdede9900302da34160ce6b9a62b9d1708` remain historical green facts, but
the Cycle 2g bounded owned-byte security conclusion and Cycle 2f restoration
are Superseded. Re-prototyped shared backing and alternate typed arrays bypassed
prototype equality, and Cycle 2g checked a proxy-sensitive prototype before
completing intrinsic brand validation. Cycle 2h implementation/focused coverage
are present and its final working-tree local gate is Pass; source commit, two-OS
CI, parser, and custody gates remain Pending. Cycle 2b, full Cycle 2 quality,
and production admission Blocked.

## Context

Cycle 2f correctly derives fixed-population synthetic quality metrics, but it
does not establish prediction-before-label ordering. Its declared reference is
declared before the candidate, the candidate binds the reference hash, and the
canonical test builder can copy reference facts. Running or retaining more
evidence for that sequence would not prove label independence.

The highest-priority repository-controlled gap is narrower: require one owned
candidate-observation document to be committed before the same protocol
instance will accept declared-reference bytes, bind the eventual reference to a
digest already present in that commitment, and consume the protocol on every
first attempt. This can establish an exact in-process call order and immutable
byte binding. It cannot establish that the caller lacked the reference through
another channel or that the digest hides predictable labels.

The Cycle 2g audit also exposed an upstream in-process carrier gap in the public
Cycle 2f evaluator. Its owned-byte path read shadowable instance `buffer` and
`byteLength` properties and used typed-array `slice`, which can consult a
caller-controlled `constructor` / `Symbol.species` hook while allocating the
snapshot. A hostile plain `Uint8Array` could therefore spoof carrier metadata
or trigger caller code during snapshotting. Because Cycle 2g delegates to that
public evaluator, the successor must close the shared gap rather than freeze it
into the new protocol.

## Decision

Add the private `@research-cockpit/filing-quality-precommitment` package with one
exact workspace dependency on `@research-cockpit/filing-quality-measurement`.
The package exposes only the zero-argument synchronous factory
`createSyntheticFilingQualityPrecommitmentProtocol()`. Each returned instance
has `commit(plan, candidateObservations)` and
`reveal(capability, declaredReference)` methods and private state that can move
only through `open`, `candidate_committed`, and `consumed`.

### Commit phase

The commit document has the fixed `candidate_observations_precommit` role. It
contains the exact declared-reference SHA-256 commitment plus a candidate
snapshot fully validated against the closed 100-document coordinate space,
with omitted documents and facts preserved for fail-closed evaluation. It
contains no raw declared-reference bytes or content and no caller-supplied
`producedAt`. It cannot supply metrics, counts, weights, exclusions, assertion
outcomes, or derived quality results.

The first commit attempt reserves the open instance before validation. A
malformed first commit therefore consumes the instance. A second commit attempt
also consumes and destroys any pending commitment. There is no retry,
replacement, reset, rollback, clone, or recovery surface. Before returning a
successful commit receipt, the boundary owns bounded canonical UTF-8 JSON byte
snapshots, rejects duplicate keys and non-canonical or unexpected fields,
validates the candidate snapshot against the closed 100-document coordinate
space, preserves omitted documents and facts for fail-closed evaluation,
recomputes all supplied sorted unique coordinates and domain-separated
bindings, and takes immutable copies.

The successful commit receipt exposes only aggregate hashes and observation
counts plus one empty, frozen capability. That capability is bound to object
identity and the exact protocol instance. It has no serializable authority,
cannot be cloned or reconstructed from bytes, and is usable at most once.
Commit quarantine is empty and value-free.

### Reveal phase

An open-state reveal consumes the instance and quarantines. From
`candidate_committed`, every reveal attempt advances to `consumed` before
capability, declared-reference, or dependency validation. Wrong, cloned,
cross-instance, or replayed capability; malformed reference; reference digest
mismatch; mutation; dependency failure; or delegated measurement quarantine
therefore cannot be retried.

Reveal takes an owned bounded canonical snapshot of the declared-reference
bytes and recomputes their exact SHA-256. It must match the digest already bound
inside the candidate observation commitment. Only after that match does the
protocol derive the Cycle 2f candidate by injecting the fixed Cycle 2f role and
compatibility `producedAt` value `2026-01-03T00:00:00.000Z`. The Cycle 2f plan
and reference keep their fixed January 1 and January 2 declarations. No caller
timestamp or widened chronology is accepted.

The protocol then calls the public Cycle 2f evaluator. It does not reimplement
or alter the fixed 100-document population, 1,000 fact targets, 2,000 critical
assertions, exact missing/quarantine/wrong-prediction accounting, integer-ratio
evaluation, or the fixed 0.95/0.99/0.99/0.05/zero-silent/exact-unit/zero-date
policy.

A successful reveal receipt is an immutable aggregate-only outer binding with
the plan, candidate-observation commitment, candidate-observation, evaluation,
and measurement hashes plus a fresh owned deep-frozen copy of the aggregate
Cycle 2f measurement. A valid below-threshold measurement remains
`evaluated` / `not_met`; it is not protocol quarantine. Protocol failure
returns only `protocol_quarantined` or `measurement_quarantined`, zero audit
counts, and `measurement: null`, with no hashes, capability, mismatch detail,
candidate observations, or reference content.

### Byte-carrier hardening

The `df1ddff` protocol and public Cycle 2f evaluator both recover the actual
backing buffer and byte length through intrinsic typed-array getters, require
the backing object to have exactly `ArrayBuffer.prototype`, allocate an
ordinary `Uint8Array` directly, and copy with the intrinsic typed-array `set`.
They never dispatch snapshot allocation through a caller-owned `constructor`
or `Symbol.species`. Own `buffer` or `byteLength` properties cannot disguise an
ordinary oversized carrier, and constructor/species hooks cannot observe
snapshot bytes or reenter the boundary during allocation. Security regressions
exercise every byte role in both packages. That implementation still lacked
intrinsic `Uint8Array` element-type and `ArrayBuffer` brand checks, so a
`SharedArrayBuffer` re-prototyped to `ArrayBuffer.prototype` and an alternate
typed array re-prototyped to `Uint8Array.prototype` passed; Cycle 2g also
performed a proxy-sensitive prototype check before completing intrinsic brand
validation. Cycle 2h moves intrinsic slot/type/brand checks ahead of prototype
checks and covers all six roles.

The canonical synthetic met fixture commits observations for 100 documents:
99 succeeded, one explicitly quarantined, and 990 emitted facts. The
digest-matched reveal delegates a Cycle 2f result with 990 true positives, zero
false positives, ten false negatives, zero silent critical failures, 1,980
passed assertions, and all 2,000 assertions accounted. It meets the fixed
synthetic-pilot policy. This is fixture arithmetic and in-process state
ordering only.

## Evidence and status boundary

Cycle 2g is a deterministic TypeScript source/test contract with no new live or
platform trust boundary. Its gate is the frozen-byte local release suite and
existing Ubuntu/Windows CI matrix. The `df1ddff` source implementation and
pre-promotion local gate passed as historical facts but do not establish the
current owned-byte conclusion. The local gate passed
formatting, full ESLint, all guardrails, the production-license check across 86
versions, every scripted typecheck/test/build across 12 of 13 workspace
projects, and the boundary verifier. All 47 test files completed with 987
passed plus two skipped (989 total): Cycle 2f had 39 passed, Cycle 2g had 29,
database had 582, parser had 70, and custody had 41 passed plus two skipped.
Cycle 2g creates no dedicated workflow, evidence schema, evidence artifact,
retained log package, offline evidence review, or evidence note. CI run
`32690685837` passed in Ubuntu job `97323672725` and Windows job
`97323672813` on exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`. Parser run/job `32690685841` /
`97323672800`, custody run/job `32690685846` / `97323672628`, and PostgreSQL
run/job `32690685829` / `97323672631` passed as unchanged regression health
only; they are not Cycle 2g or Cycle 2f restoration evidence.

The canonical Cycle 2a and Cycle 2c evidence checks, nonclaims, schemas, source
sets, artifacts, and notes remain byte-exact. Their offline verifiers may accept
Cycle 2g only as one exact 32-path atomic successor transition, 23 modified and
nine added paths, from baseline
`033e59cc06a421f104ecd869ae77ac694fa8ff31`. The cumulative Cycle 2c custody
surface remains 73 unique paths because the two hardened Cycle 2f paths were
already introduced in Cycle 2f. No Cycle 2g result enters either historical
record.

Cycle 2f's existing Ubuntu and Windows CI anchors remain historical green gate
facts for source commit `72e91f502b31f15deeaad761b82d9ed7b6377d39`
only. Missing hostile-carrier coverage made the bounded owned-snapshot check
false, so the prior Cycle 2f source-stage security conclusion is Superseded.
The anchors do not attest the current hardened Cycle 2f implementation and
security-test bytes. Those two modified paths are part of the exact Cycle 2g
transition. Their local restoration gate and Cycle 2g Ubuntu/Windows CI passed
on exact source commit `df1ddffdede9900302da34160ce6b9a62b9d1708`, historically
restoring the hardened Cycle 2f bounded claim for those bytes. That restoration
and Cycle 2g's conclusion are now Superseded; the original `72e91f5` conclusion
remains Superseded.

## Exact target claim and checks

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

## Consequences

Cycle 2g can close only the exact in-process ordering, ownership, digest
non-substitution, instance-bound single-use capability, one-shot consumption,
and Cycle 2f delegation claims above. A caller can know the reference before
commit, brute-force predictable reference content from its digest, create a
fresh instance, restart a process, call Cycle 2f directly, forge external time,
or bypass this disconnected package. Cycle 2g therefore cannot prove actual
blinding, label secrecy, authenticated chronology, durable precommitment,
independent adjudication, real quality, Cycle 2b authority, full Cycle 2 exit,
B15/V15, or production use.

Cycle 2h hardens the Cycle 2g plan, candidate-observation, and
declared-reference roles with intrinsic `Uint8Array` element-type and
`ArrayBuffer` brand validation, exact prototypes, safe check ordering,
preallocation actual-length limits, ordinary allocation, and intrinsic copying. It preserves this ADR's non-carrier schemas, exact
checks, exact nonclaims, state machine, capabilities, delegation, result and
failure semantics, historical anchors, and no-dedicated-evidence status. Cycle
2h is the exact 40-path transition (38 modified and two added) from
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`. The additional path is the
existing historical local custody fixture manifest,
not a new/dedicated/live evidence artifact. Its two changed custody source/test
SHA-256 entries refresh, while fixture cases, schema, order, and payload
identity/content remain unchanged. The final working-tree local gate is Pass;
source commit, CI, parser, and custody promotion gates remain Pending.

## References

- [Cycle 2g exit matrix](../CYCLE_2G_EXIT_MATRIX.md)
- [Cycle 2f exit matrix](../CYCLE_2F_EXIT_MATRIX.md)
- [Cycle 2h exit matrix](../CYCLE_2H_EXIT_MATRIX.md)
- [ADR 0035](./0035-cross-boundary-intrinsic-byte-snapshot-hardening.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [ADR 0033](./0033-bounded-synthetic-declared-reference-quality-measurement.md)
- [ADR 0029](./0029-fixed-public-filing-candidate-manifest-admission.md)
