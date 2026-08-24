# ADR 0031: bounded synthetic ten-fact normalization and lineage

Status: bounded source-stage claim, local verification, and two-OS CI Pass only
for exact source commit `f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`; Cycle 2b
and production admission Blocked.

## Context

The Cycle 2 roadmap next requires ten normalized launch facts with source
accession, accepted/available time, parser and taxonomy versions, units,
dimensions, and supersession lineage. Cycle 2a proves only a two-fact synthetic
parser envelope. Cycle 2b Phase A verifies metadata structure but remains
blocked on an external exact-100 inventory, selection/adjudication inputs,
rights/steward approvals, chronology, and human authority-registry review.
Cycle 2c proves only one generated synthetic custody lifecycle.

Those external blockers prohibit real filing bytes, but they do not prevent a
closed synthetic normalization protocol from testing the temporal and lineage
rules before real-data admission. The protocol must not be cited as corpus
approval, parser correctness, accounting truth, adjudicated quality, or
production composition.

## Decision

Add the private, zero-dependency `packages/filing-fact-normalization` package.
The caller supplies exactly two bounded canonical JSON byte documents matching
the closed synthetic fixture schema: one original 10-K and its single 10-K/A
amendment. The boundary immediately takes fresh owned snapshots before
validation. Tests generate the canonical pair, but the boundary does not
authenticate its generator or provenance. It performs no file, network, parser,
custody, corpus-admission, database, API, web, or queue operation.

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

Each document must contain every key exactly once. The byte parser is bounded,
UTF-8 and canonical-JSON strict, rejects duplicate keys, and takes an owned
snapshot before validation. Values remain strict decimal strings; binary
floating point is not a financial interchange type. The closed contract binds
each key to its permitted instant/duration period and unit/dimension form.

The original and amendment must bind the same synthetic entity, reporting
context, parser metadata, and taxonomy metadata. The amendment must identify
the original as its sole predecessor, use the corresponding amendment form,
and be accepted and publicly available later. Derived fact identities are
deterministic. Supersession is single-predecessor and acyclic; fork, cycle,
cross-entity, cross-period, cross-form, cross-parser, and cross-taxonomy inputs
fail closed.

The normalizer derives half-open public-known windows from source availability:
the original versions are visible from the original `availableAt` up to but not
including the amendment `availableAt`; amendment versions are visible from the
amendment `availableAt`. Pre- and post-amendment projections select the exact
corresponding versions. Unchanged values remain separate source versions, while
changed values preserve their predecessor and source lineage. No database
system-recorded interval is manufactured by this disconnected protocol.

The complete pair either normalizes atomically or returns an empty,
value-free quarantine result. Errors and CI output expose only closed aggregate
status/code data and no input values or canary. Exact-byte replay is
deterministic, and caller buffer mutation after invocation cannot change the
owned snapshot or result.

## Evidence and status boundary

Cycle 2d is a deterministic TypeScript source/test contract with no new live or
platform trust boundary. Its gate is the frozen-byte local release suite plus
the existing Ubuntu/Windows CI matrix. It creates no dedicated workflow,
evidence schema, evidence artifact, retained log package, offline evidence
review, or evidence note. The exact frozen-byte local gate is Pass: format,
lint, guardrails, every project typecheck and build, 86 production-license
checks, and 41 test files with 876 passed plus 2 POSIX-only Windows skips (878
total cases: parser 65; custody 36 passed plus 2 skipped; normalization 26; DB
582; API 49; state 48; contracts 5; core 62; web 3). CI run `32511008752`
passed in Windows job `96861883906` and Ubuntu job `96861884146` on exact
source commit `f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`. Parser run/job
`32511008497` / `96861883641`, custody run/job `32511008447` / `96861883543`,
and PostgreSQL run/job `32511008417` / `96861882949` are unchanged regression
health on that commit, not Cycle 2d evidence.

The canonical Cycle 2a evidence contract remains 16 checks, 16 nonclaims, and
26 source hashes. The canonical Cycle 2c evidence contract remains 16 checks,
16 nonclaims, and 29 source hashes. Their schemas, arrays, source sets,
artifacts, and evidence notes remain byte-exact. Their current offline
verifiers may accept the Cycle 2d change only as one exact atomic successor
transition; no Cycle 2d output enters either historical record.

## Exact target claim and checks

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

## Consequences

Cycle 2d can close only the exact closed-schema two-document normalization and
lineage contract. It does not authenticate generator provenance, unblock Cycle 2b, authorize a real manifest or
filing byte, establish parser or accounting correctness, satisfy the
100-filing/2,000-assertion quality gate, create B15/V15, or authorize production
use. Before any real byte is used, Cycle 2b's external inputs, approvals,
chronology, and human registry review remain mandatory.

Cycle 2e is a separate successor-only comparison contract. It consumes only
closed same-schema synthetic envelopes and does not alter Cycle 2d's exact
claim, arrays, source bytes, test/CI anchors, or no-evidence status. Exact
agreement between its two declared same-process validators does not establish
Cycle 2d normalizer correctness, accounting truth, or true validator
independence.

Cycle 2f is a separate successor-only declared-reference measurement contract.
Its fact values and coordinates are synthetic test inputs, not authenticated
Cycle 2d output. Metric consistency does not establish Cycle 2d normalizer or
lineage correctness, accounting truth, or generator provenance, and Cycle 2f
does not alter this ADR's exact claim, arrays, source bytes, test/CI anchors, or
no-evidence status.

## References

- [Cycle 2d exit matrix](../CYCLE_2D_EXIT_MATRIX.md)
- [Cycle 2e exit matrix](../CYCLE_2E_EXIT_MATRIX.md)
- [Cycle 2f exit matrix](../CYCLE_2F_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
- [Cycle 2c exit matrix](../CYCLE_2C_EXIT_MATRIX.md)
- [ADR 0029](./0029-fixed-public-filing-candidate-manifest-admission.md)
- [ADR 0030](./0030-bounded-synthetic-filing-payload-custody.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
- [License policy](../../LICENSE_POLICY.md)
