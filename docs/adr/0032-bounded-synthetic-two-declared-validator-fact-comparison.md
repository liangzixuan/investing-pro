# ADR 0032: bounded synthetic two-declared-validator fact comparison

Status: bounded source-stage claim, local verification, and two-OS CI Pass only
for exact source commit `60b92aa527435904776144f5e2d5a1a3ab61e67e`; Cycle 2b
and production admission Blocked.

## Context

Cycle 2d proves one bounded synthetic ten-fact normalization and amendment
lineage contract. It deliberately does not prove a second validator, parser
independence, independently adjudicated ground truth, real filing correctness,
or the full Cycle 2 quality gate. Cycle 2b Phase B also remains externally
blocked on its exact 100-filing metadata inventory, approvals, chronology, and
human authority-registry review.

Those blockers prohibit a real-data quality claim. They do not prevent a
smaller source-only control: requiring two fixed, distinctly declared
validator roles to validate complete same-schema synthetic payloads separately
and then accepting only byte-exact agreement. The comparison must preserve
conflict rather than prefer, merge, coerce, reorder, or repair either report.

## Decision

Add the private, zero-dependency `packages/filing-fact-comparison` package. The
caller supplies exactly two bounded canonical JSON envelope byte documents in
fixed argument roles. Each envelope declares its validator role, identifier,
version, implementation digest, synthetic status, and schema version. On the
agreement path it also carries one complete normalized payload; a valid
upstream-quarantined envelope instead carries `normalizedPayload: null` and can
produce only aggregate quarantine. The comparison boundary immediately takes
fresh owned byte snapshots before parsing or validation.

The fixed declarations are:

- role `declared-validator-a`, identifier
  `synthetic-filing-fact-validator-a`, version `1.0.0`, implementation digest
  `sha256:144c62df219b6f6cddfa49783fd9f9e169187d39d3fc848c8bb06147df76fa44`;
- role `declared-validator-b`, identifier
  `synthetic-filing-fact-validator-b`, version `1.0.0`, implementation digest
  `sha256:8ae5aae1ecc92b3b71e764deb85d6758e38b1b11eee39f6aed07599bb30ae365`.

Distinct declarations are not credentials, signatures, code measurements, or
proof that a digest corresponds to an executable. The two validators are
separate strict source modules with fixed argument roles and no shared runtime
validation implementation, but they execute in the same package and process.
They do not establish parser, implementation, process, host, operator, key, or
failure-domain independence.

Each validator must independently accept its envelope and validate the full
normalized payload before comparison. Validation covers the closed source and
report schema; exact ten-key/twenty-version/ten-edge cardinality; source,
parser, taxonomy, unit, concept, dimension, decimal, period, and chronology
metadata; complete source-preimage fact-identity recomputation; unique and
consistent predecessor/successor pointers; changed and unchanged facts; and
half-open known windows. An upstream quarantine or any invalid source, fact,
lineage, metadata, identity, or canonical byte fails closed.

Only after both validators succeed does the boundary compare the complete
canonical normalized-payload bytes. Digest agreement, selected fields,
cardinality, or semantic subsets are insufficient. Any byte difference is a
conflict. There is no primary validator, preference, merge, fallback,
reordering, tolerance, coercion, repair, or partial result.

Success returns one immutable metadata-only
`FilingFactComparisonAgreementReceipt` with `status: "agreed"`, the exact two
validator declarations, aggregate counts, and domain-separated hashes binding
the agreed bytes and source/report context. It does not return normalized fact
values or lineage rows and is not an admission token, evidence artifact, or
downstream persistence command. Failure returns `status: "quarantined"`, one
coarse closed code, zero aggregate counts, and empty fact-version, lineage, and
validator-binding arrays. It emits no report hash, validator metadata, mismatch
field/index/count, preferred output, input value, or canary.

## Evidence and status boundary

Cycle 2e is a deterministic TypeScript source/test contract with no new live or
platform trust boundary. Its gate is the frozen-byte local release suite and
the existing Ubuntu/Windows CI matrix. It creates no dedicated workflow,
evidence schema, evidence artifact, retained log package, offline review, or
evidence note. Local verification is Pass on exact frozen bytes: `corepack pnpm
verify` passed all format, lint, guardrail, typecheck, test, and build stages
with 43 test files, 911 passed plus 2 skipped (913 total), all 11 workspace
project checks, and 10 builds. CI run `32518970387` passed in Ubuntu job
`96886795980` and Windows job `96886796247` on exact source commit
`60b92aa527435904776144f5e2d5a1a3ab61e67e`. Parser run/job `32518970423` /
`96886796118`, custody run/job `32518970453` / `96886796256`, and PostgreSQL
run/job `32518970454` / `96886796382` are unchanged regression health only,
not Cycle 2e evidence.

The canonical Cycle 2a and Cycle 2c evidence records, schemas, checks,
nonclaims, source sets, notes, and artifacts remain byte-exact. Their current
offline verifiers may accept Cycle 2e only as one exact 28-path atomic successor
transition from baseline
`e0ee2e74eac6164487cc09d12b6efab5fd5f8cb5`; no Cycle 2e result enters either
historical record.

## Exact target claim and checks

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

## Consequences

Cycle 2e can close only this exact same-schema, two-declared-validator synthetic
comparison contract. It cannot establish actual independence, authenticate a
validator declaration or digest, validate a real filing, prove Cycle 2d or
accounting correctness, unblock Cycle 2b, satisfy the 2,000-assertion quality
gate, create B15/V15, or authorize production use.

Cycle 2f is a separate successor-only declared-reference measurement contract.
Its candidate is synthetic input, not an authenticated Cycle 2e receipt or
validator result. Metric consistency cannot establish Cycle 2e validator
independence, declaration authenticity, accounting truth, or resistance to
common-mode failure, and Cycle 2f does not alter this ADR's exact claim, arrays,
source bytes, CI anchors, or no-evidence status.

Cycle 2g is a separate successor-only in-process precommitment contract. Its
candidate observations are synthetic inputs, not an authenticated Cycle 2e
receipt or validator result. Commit-before-reveal ordering cannot establish
Cycle 2e validator independence, declaration authenticity, accounting truth,
or resistance to common-mode failure, and Cycle 2g does not alter this ADR's
exact claim, arrays, source bytes, CI anchors, or no-evidence status.

## References

- [Cycle 2e exit matrix](../CYCLE_2E_EXIT_MATRIX.md)
- [Cycle 2f exit matrix](../CYCLE_2F_EXIT_MATRIX.md)
- [Cycle 2g exit matrix](../CYCLE_2G_EXIT_MATRIX.md)
- [Cycle 2d exit matrix](../CYCLE_2D_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [ADR 0031](./0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
- [ADR 0029](./0029-fixed-public-filing-candidate-manifest-admission.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
- [License policy](../../LICENSE_POLICY.md)
