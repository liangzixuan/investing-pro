# Cycle 2d exit matrix

Scope: one disconnected, zero-dependency synthetic protocol for atomically
normalizing an exact original 10-K and 10-K/A pair into ten closed fact-version
lineages. The decision is recorded in
[ADR 0031](./adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md).
The caller supplies the two byte documents, and the boundary immediately takes
fresh owned snapshots before validation. Tests generate the canonical pair,
but the boundary proves only conformance to the closed synthetic schema, not
generator identity or provenance.

Current status: **bounded source-stage claim, local verification, and two-OS CI
Pass only for exact source commit
`f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`. Cycle 2b and production admission
remain Blocked.**
There is no real filing, external configuration, dedicated Cycle 2d workflow,
evidence schema, artifact, offline evidence review, or evidence note.

| Gate                     | Required result                                                                                                      | Current status                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact input              | Two caller-supplied canonical documents match the closed synthetic 10-K/10-K/A schema; no generator provenance claim | Implemented; local verification Pass                                                                                                                                                                |
| Ten facts                | Each document contains the exact frozen ten-key set once                                                             | Implemented; local verification Pass                                                                                                                                                                |
| Numeric/context contract | Decimal, unit, instant/duration period, dimension, and metadata rules pass                                           | Implemented; local verification Pass                                                                                                                                                                |
| Temporal lineage         | One acyclic predecessor, half-open known windows, and exact pre/post projections pass                                | Implemented; local verification Pass                                                                                                                                                                |
| Atomic failure           | Invalid pair yields only an empty, value-free quarantine result                                                      | Implemented; local verification Pass                                                                                                                                                                |
| Local integration        | Format, lint, guardrails, all project typechecks/tests, and builds pass on frozen bytes                              | Pass: 41 files; 876 passed + 2 POSIX-only Windows skips (878 total); parser 65; custody 36 passed + 2 skipped; normalization 26; DB 582; API 49; state 48; contracts 5; core 62; web 3; 86 licenses |
| Two-OS CI                | The same frozen source gate passes on Ubuntu and Windows                                                             | Pass: run `32511008752`; Windows job `96861883906`; Ubuntu job `96861884146`                                                                                                                        |
| Regression health        | Historical parser, custody, and PostgreSQL domains remain healthy without becoming Cycle 2d evidence                 | Unchanged health only: parser `32511008497` / `96861883641`; custody `32511008447` / `96861883543`; PostgreSQL `32511008417` / `96861882949`                                                        |
| Dedicated evidence       | Separate workflow/schema/artifact/offline review                                                                     | Not created; no new live boundary in Cycle 2d                                                                                                                                                       |
| Cycle 2b authority       | Exact external 100-entry metadata, approvals, chronology, and human registry/key review pass before any real bytes   | Blocked; outside Cycle 2d                                                                                                                                                                           |
| Full Cycle 2 quality     | Real bytes, independent validation, 2,000 adjudicated assertions, frozen thresholds, and zero silent critical errors | Blocked                                                                                                                                                                                             |
| Production admission     | Real-data rights, source/fetch, persistence, security, privacy, scale, and operational gates pass                    | Blocked                                                                                                                                                                                             |

The exact ordered launch-fact keys are:

1. `assets`
2. `cash`
3. `debt`
4. `diluted_shares`
5. `free_cash_flow`
6. `gross_profit`
7. `net_income`
8. `operating_cash_flow`
9. `operating_income`
10. `revenue`

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage`.

The exact ordered checks are:

1. `exact_two_document_original_and_amendment_synthetic_fixture`
2. `exact_ten_launch_fact_keys_once_per_document`
3. `owned_bounded_canonical_json_byte_snapshot_and_duplicate_key_rejection`
4. `closed_accession_form_entity_source_hash_parser_and_taxonomy_metadata`
5. `strict_decimal_string_precision_scale_and_no_binary_float`
6. `fact_key_unit_instant_duration_period_and_dimension_contract`
7. `accepted_available_and_report_period_time_ordering`
8. `amendment_predecessor_entity_form_period_and_later_publication_binding`
9. `derived_fact_identity_and_single_predecessor_acyclic_supersession`
10. `half_open_known_windows_and_pre_post_as_known_projection`
11. `unchanged_and_changed_fact_versions_preserve_source_lineage`
12. `missing_duplicate_ambiguous_fork_cycle_and_cross_context_rejection`
13. `whole_document_pair_atomic_normalization_or_empty_quarantine`
14. `exact_byte_replay_determinism_owned_input_snapshot_and_buffer_mutation_safety`
15. `aggregate_value_free_quarantine_error_and_ci_output_canary_absence`
16. `no_network_raw_parser_custody_corpus_database_api_web_queue_and_cycle2a_cycle2c_schema_check_nonclaim_source_set_artifact_preservation`

The public-known intervals are half open. Original versions are eligible from
the original source's `availableAt` until, but not including, the amendment
source's `availableAt`; amendment versions are eligible from the amendment
availability instant. The disconnected normalizer creates no database system
interval and does not assert when the repository first recorded a version.

## Exact nonclaims

The exact ordered nonclaims are:

1. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
2. `real_filing_raw_payload_identity_digest_equality_or_sec_source_authenticity`
3. `counsel_identity_legal_validity_revocation_freshness_or_data_rights`
4. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
5. `xml_xbrl_ixbrl_parser_worker_or_general_taxonomy_plugin_correctness`
6. `raw_payload_custody_retention_kms_backup_deletion_or_cryptographic_erasure`
7. `independent_dual_parser_validator_or_cross_engine_conflict_quarantine`
8. `independently_adjudicated_ground_truth_or_2000_assertions`
9. `precision_recall_document_success_quality_thresholds_or_zero_silent_failures`
10. `general_concept_alias_unit_conversion_dimensions_or_fiscal_calendar_coverage`
11. `real_amendment_completeness_correction_discovery_or_sec_restated_status`
12. `multi_issuer_multi_document_batch_streaming_concurrency_retry_or_crash_recovery`
13. `derived_metrics_formulas_evidence_passports_rights_projection_or_valuation`
14. `database_api_web_queue_persistence_or_b15_v15_composition`
15. `production_identity_secrets_network_load_slo_operations_or_incident_recovery`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## History and exit rule

Cycle 2a's 16 checks, 16 nonclaims, 26-source schema, canonical artifact, and
evidence note remain unchanged. Cycle 2c's 16 checks, 16 nonclaims, 29-source
schema, canonical artifact, and evidence note remain unchanged. Their current
offline verifiers accept Cycle 2d only as one exact atomic successor transition;
no Cycle 2d result enters either record.

Cycle 2d's bounded source-stage claim is Pass only because the exact frozen-byte
local gate and Ubuntu/Windows CI agree at commit
`f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`. Failure, cancellation, any source
change, a partial/extra successor tree, a non-value-free quarantine, or any
attempted real-data input means no successor promotion without fresh gates.
This Pass does not unblock Cycle 2b, establish full Cycle 2 quality, create
B15/V15, or authorize production use.

Cycle 2e is a separate successor-only synthetic comparison contract. It does
not alter the exact Cycle 2d claim, checks, nonclaims, source bytes, test/CI
anchors, or no-evidence status, and it does not establish Cycle 2d normalizer
correctness. See the [Cycle 2e exit matrix](./CYCLE_2E_EXIT_MATRIX.md).
