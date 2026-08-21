# Cycle 2e exit matrix

Scope: one disconnected, zero-dependency synthetic comparison protocol for two
fixed, distinctly declared validator roles that separately validate complete
same-schema ten-fact normalization payloads and agree only on byte-exact full
payload equality. The decision is recorded in
[ADR 0032](./adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md).

Current status: **source implementation complete; local verification Pass;
two-OS CI Pending. Cycle 2b and production admission remain Blocked.**
There is no real filing, external configuration, dedicated Cycle 2e workflow,
evidence schema, artifact, offline evidence review, or evidence note.

| Gate                 | Required result                                                                                                        | Current status          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Exact input          | Exactly two bounded canonical envelopes occupy fixed A/B roles and bind the two exact declarations                     | Implemented; Local Pass |
| Separate validation  | Each role-specific module validates the complete closed payload before any agreement decision                          | Implemented; Local Pass |
| Complete payload     | Each validator proves ten keys, twenty versions, ten lineage edges, metadata, fact preimages, pointers, and chronology | Implemented; Local Pass |
| Exact agreement      | Complete canonical normalized-payload bytes match exactly; digest/subset/cardinality equality is insufficient          | Implemented; Local Pass |
| Conflict quarantine  | Invalid or differing input yields only empty, value-free aggregate quarantine with no preferred or repaired result     | Implemented; Local Pass |
| Local integration    | Format, lint, guardrails, all project typechecks/tests, and builds pass on frozen bytes                                | Pass                    |
| Two-OS CI            | The same frozen source gate passes on Ubuntu and Windows                                                               | Pending                 |
| Dedicated evidence   | Separate workflow/schema/artifact/offline review                                                                       | Not created             |
| Real independence    | Different parser, codebase, process, host, operator, key, and failure domain are independently established             | Not proven; outside 2e  |
| Cycle 2b authority   | Exact external inventory, approvals, chronology, and human authority review pass before real bytes                     | Blocked; outside 2e     |
| Full Cycle 2 quality | Real bytes, independent validation, 2,000 adjudicated assertions, thresholds, and zero silent critical errors          | Blocked                 |
| Production admission | Real-data rights, authenticity, persistence, security, privacy, scale, and operational gates pass                      | Blocked                 |

The exact frozen bytes pass `corepack pnpm verify`: all format, lint, guardrail,
typecheck, test, and build stages are green with 43 test files, 911 passed plus
2 skipped (913 total), all 11 workspace project checks, and 10 builds.

The fixed declarations are role A
`declared-validator-a` / `synthetic-filing-fact-validator-a` / `1.0.0` /
`sha256:144c62df219b6f6cddfa49783fd9f9e169187d39d3fc848c8bb06147df76fa44`
and role B
`declared-validator-b` / `synthetic-filing-fact-validator-b` / `1.0.0` /
`sha256:8ae5aae1ecc92b3b71e764deb85d6758e38b1b11eee39f6aed07599bb30ae365`.
They are fixed declarations only, not authenticated identities, signatures,
executable measurements, or proof of independent failure domains.

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_two_declared_validator_exact_payload_agreement_conflict_quarantine_and_no_silent_repair`.

The exact ordered checks are:

1. `exact_two_declared_validator_same_schema_synthetic_envelopes`
2. `owned_bounded_utf8_canonical_json_byte_snapshots_and_duplicate_key_rejection`
3. `exact_distinct_declared_validator_identity_version_and_implementation_digest_bindings`
4. `separate_no_shared_runtime_validator_implementations_and_fixed_argument_roles`
5. `each_envelope_closed_schema_validation_precedes_agreement`
6. `closed_original_amendment_entity_instrument_accession_hash_form_and_chronology_binding`
7. `exact_ten_keys_twenty_versions_and_ten_one_to_one_lineage_edges_per_validator`
8. `strict_decimal_unit_period_dimension_concept_parser_taxonomy_and_source_metadata_contract`
9. `complete_source_preimage_fact_identity_recomputation_uniqueness_and_pointer_consistency`
10. `acyclic_single_predecessor_changed_unchanged_and_half_open_known_window_validation`
11. `byte_exact_full_normalized_payload_agreement_not_digest_or_subset_equality`
12. `any_invalid_upstream_quarantine_source_fact_lineage_metadata_or_byte_conflict_fails_closed`
13. `no_primary_preference_merge_fallback_reordering_tolerance_coercion_or_silent_repair`
14. `atomic_metadata_only_agreement_receipt_or_empty_value_free_conflict_quarantine`
15. `domain_separated_determinism_owned_snapshot_mutation_safety_runtime_immutability_and_canary_absence`
16. `no_network_raw_parser_normalizer_custody_corpus_database_api_web_queue_or_historical_evidence_mutation`

Agreement compares the full normalized-payload bytes only after both strict
validators accept. Success is an immutable metadata-only receipt, not a fact
record or admission token. Quarantine contains one coarse code, zero counts,
and empty fact-version, lineage, and validator-binding arrays. It contains no
hashes, validator metadata, mismatch location, values, or preferred report.

## Exact nonclaims

The exact ordered nonclaims are:

1. `true_validator_parser_implementation_process_host_operator_key_or_failure_domain_independence`
2. `declared_validator_identity_digest_authenticity_code_correspondence_signature_or_authority`
3. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
4. `real_filing_raw_payload_identity_digest_equality_or_sec_source_authenticity`
5. `xml_xbrl_ixbrl_parser_worker_or_general_taxonomy_plugin_correctness`
6. `fact_id_source_preimage_authenticity_accounting_truth_or_cycle2d_normalizer_correctness`
7. `independently_adjudicated_ground_truth_or_2000_assertions`
8. `precision_recall_document_success_quality_thresholds_quarantine_rate_or_zero_silent_failures`
9. `merge_repair_majority_tie_break_human_adjudication_or_correction_policy`
10. `malicious_validator_collusion_common_mode_failure_or_real_cross_engine_determinism`
11. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_archive_or_source_safety`
12. `raw_payload_custody_retention_kms_backup_deletion_or_cryptographic_erasure`
13. `real_amendment_completeness_correction_discovery_or_sec_restated_status`
14. `multi_issuer_multi_document_batch_streaming_concurrency_retry_crash_recovery_or_slo`
15. `database_api_web_queue_persistence_evidence_passport_rights_projection_b15_or_v15_composition`
16. `production_identity_secrets_network_operations_real_data_full_cycle2_exit_or_production_use`

## History and exit rule

Cycle 2a's canonical 16 checks, 16 nonclaims, 26-source schema, artifact, and
evidence note remain unchanged. Cycle 2c's canonical 16 checks, 16 nonclaims,
29-source schema, artifact, and evidence note remain unchanged. Their offline
verifiers accept Cycle 2e only as the exact atomic 28-path transition from
`e0ee2e74eac6164487cc09d12b6efab5fd5f8cb5`; no Cycle 2e result enters either
record.

The exact frozen-byte local gate is Pass. Cycle 2e may be marked source-stage
Pass only when Ubuntu/Windows CI agrees. Failure, cancellation, any
omitted/extra or deleted transition path, a partial package tree,
non-value-free quarantine, silent repair, or any real-data input prevents
promotion. Such a future source-stage Pass would not prove true validator
independence or authenticity, unblock Cycle 2b, establish full Cycle 2 quality,
create B15/V15, or authorize production use.
