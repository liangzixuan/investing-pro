# Cycle 2f exit matrix

Scope: one disconnected, zero-dependency synthetic quality-measurement
protocol for an exact fixed population of 100 declared-reference documents,
ten fixed fact targets per document, and two evaluator-derived critical
assertions per target. The decision is recorded in
[ADR 0033](./adr/0033-bounded-synthetic-declared-reference-quality-measurement.md).

Current status: **bounded source-stage claim, local verification, and two-OS CI
Pass only for exact source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39`. Cycle 2b, full Cycle 2 quality,
and production admission remain Blocked.** There is no real filing, external
configuration, independent adjudication, dedicated Cycle 2f workflow, evidence
schema, artifact, offline evidence review, or evidence note.

| Gate                     | Required result                                                                                                                                   | Current status          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Exact input              | Exactly three bounded canonical documents occupy fixed plan, candidate, and declared-reference roles                                              | Implemented; Local Pass |
| Fixed population         | The declared reference contains exactly 100 unique documents, ten fixed fact coordinates each, and 2,000 derived critical assertions              | Implemented; Local Pass |
| Candidate state          | Rows are only `succeeded` or `quarantined`; succeeded rows carry zero through ten facts and omissions are measured incomplete; absence is missing | Implemented; Local Pass |
| Metric accounting        | The evaluator derives every count and denominator; callers cannot supply metrics, weights, exclusions, or assertion outcomes                      | Implemented; Local Pass |
| Fixed threshold policy   | Exact integer-rational 0.95/0.99/0.99/0.05/0 thresholds, exact units, and zero-day periods are applied without float tolerance                    | Implemented; Local Pass |
| Outcome semantics        | Valid inputs yield `evaluated` plus `met` or `not_met`; malformed inputs alone yield empty value-free quarantine                                  | Implemented; Local Pass |
| Local integration        | Format, lint, guardrails, all project typechecks/tests, and builds pass on frozen bytes                                                           | Pass                    |
| Two-OS CI                | The same frozen source gate passes on Ubuntu and Windows                                                                                          | Pass                    |
| Dedicated evidence       | Separate workflow/schema/artifact/offline review                                                                                                  | Not created             |
| Independent adjudication | Real adjudicator identity, independence, blinding, chronology, and resolution quality are established                                             | Not proven; outside 2f  |
| Cycle 2b authority       | Exact external inventory, approvals, chronology, and human authority review pass before real bytes                                                | Blocked; outside 2f     |
| Full Cycle 2 quality     | Representative real filings and 2,000 independently adjudicated real assertions meet approved thresholds with zero silent failures                | Blocked                 |
| Production admission     | Real-data rights, authenticity, persistence, security, privacy, scale, and operational gates pass                                                 | Blocked                 |

The exact frozen bytes pass `corepack pnpm verify`: all format, lint,
guardrail, typecheck, test, and build stages are green with 45 test files, 951
passed plus 2 skipped (953 total), all 12 workspace project checks, and 11
builds.

CI run `32681826143` passed in Ubuntu job `97299715600` and Windows job
`97299715638`. Parser run/job `32681826015` / `97299715074`, custody run/job
`32681826030` / `97299715006`, and PostgreSQL run/job `32681826040` /
`97299715107` passed as unchanged regression health only; they are not Cycle 2f
evidence.

The fixed synthetic-pilot policy uses document success at least `95/100`, fact
precision at least `99/100`, fact recall at least `99/100`, quarantine rate at
most `5/100`, zero silent critical failures, exact canonical units, and zero
date-tolerance days. Ratios are evaluated only by integer cross-multiplication.
There is no float, `NaN`, rounding, epsilon, caller tolerance, or zero-denominator
fallback.

The canonical met fixture has 99 succeeded documents with ten exact facts each
and one explicit-quarantine document. It therefore accounts for 1,000 expected
fact targets and all 2,000 critical assertions, while recording 990 true
positives, ten false negatives, zero false positives, and 1,980 passed critical
assertions. The remaining 20 assertions are accounted but not passed. The
explicit quarantine is not silent, but it still reduces document success and
fact recall and increases quarantine rate. This synthetic outcome is not a
real-parser quality result or a production threshold approval.

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation`.

The exact ordered checks are:

1. `exact_fixed_role_synthetic_plan_candidate_and_declared_reference_documents`
2. `owned_bounded_utf8_canonical_json_snapshots_and_duplicate_key_rejection`
3. `fixed_095_099_099_005_zero_silent_exact_unit_zero_date_policy_binding`
4. `closed_label_separated_plan_candidate_and_reference_schemas`
5. `declared_plan_candidate_reference_chronology_and_exact_hash_role_binding`
6. `exact_100_unique_documents_ten_fixed_keys_and_2000_derived_critical_assertions`
7. `sorted_unique_coordinate_recomputation_and_no_duplicate_omission_exclusion_or_reweighting`
8. `strict_canonical_decimal_concept_dimension_unit_and_gregorian_period_validation`
9. `succeeded_partial_fact_or_quarantined_empty_candidate_state_coherence`
10. `evaluator_derived_counts_denominators_classification_and_no_caller_supplied_metrics`
11. `exact_fact_true_positive_wrong_prediction_false_positive_plus_false_negative_and_zero_denominator_fail_closed`
12. `integer_cross_multiplication_without_float_nan_rounding_epsilon_or_tolerance_widening`
13. `fixed_document_success_precision_recall_unit_date_silent_failure_and_quarantine_semantics`
14. `valid_below_threshold_evaluation_recorded_as_not_met_not_input_quarantine`
15. `immutable_aggregate_only_evaluated_receipt_or_empty_value_free_quarantine_and_canary_absence`
16. `domain_separated_determinism_mutation_safety_no_io_composition_or_historical_evidence_mutation`

## Exact nonclaims

The exact ordered nonclaims are:

1. `actual_independent_adjudicator_identity_process_host_operator_key_or_failure_domain`
2. `actual_blinding_label_leakage_absence_prediction_precommitment_or_chronology_authenticity`
3. `declared_reference_accounting_correctness_or_human_resolution_quality`
4. `candidate_report_parser_execution_identity_digest_authenticity_or_cycle2e_output`
5. `cycle2b_external_inventory_rights_steward_key_authority_or_human_review`
6. `real_filing_payload_digest_sec_source_authenticity_or_custody`
7. `representative_100_real_filings_or_independently_adjudicated_2000_real_assertions`
8. `real_parser_quality_precision_recall_document_success_quarantine_or_zero_silent_failures`
9. `threshold_statistical_adequacy_confidence_calibration_or_production_acceptance`
10. `strategic_quarantine_reason_authenticity_or_malicious_failure_masking_detection`
11. `cycle2d_normalizer_lineage_correctness_or_cycle2e_independent_validator_composition`
12. `adaptive_metric_oracle_privacy_differential_privacy_or_real_label_confidentiality`
13. `general_xbrl_ixbrl_taxonomy_concept_unit_dimension_fiscal_or_amendment_correctness`
14. `network_fetch_custody_retention_kms_backup_deletion_or_cryptographic_erasure`
15. `database_api_web_queue_persistence_evidence_passport_b15_v15_or_slo`
16. `production_identity_secrets_real_data_full_cycle2_exit_or_production_use`

## History and exit rule

Cycle 2a's canonical 16 checks, 16 nonclaims, 26-source schema, artifact, and
evidence note remain unchanged. Cycle 2c's canonical 16 checks, 16 nonclaims,
29-source schema, artifact, and evidence note remain unchanged. Their offline
verifiers may accept Cycle 2f only as the exact atomic 28-path transition from
`baa79baa466cf1c869f63a279f90a6dde61c97ac`; no Cycle 2f result enters either
record.

The exact frozen-byte local and two-OS CI gates are Pass only for source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39`. Failure, cancellation, an
omitted, extra, or deleted transition path, a partial package tree, unaccounted
reference target, caller-supplied metric, float tolerance, malformed-input
metric leakage, or any real-data input prevents promotion. This source-stage
Pass does not prove independent adjudication, real parser quality, Cycle 2b
authority, approved production thresholds, full Cycle 2 exit, B15/V15, or
production use.
