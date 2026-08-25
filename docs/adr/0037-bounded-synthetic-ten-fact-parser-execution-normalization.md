# ADR 0037: bounded synthetic ten-fact parser execution to normalization

Status: proposed; implementation and promotion are Pending from exact baseline
`f17bacc6adc46851e182d260d59830652f1953bb`. No source successor, transition
inventory, local result, live run, artifact, or offline review is accepted yet.
Cycle 2b, full Cycle 2 quality, real-data admission, and production admission
remain Blocked.

## Context

Historical Cycle 2a proved one isolated synthetic two-fact parser execution.
Promoted Cycle 2i separately verifies complete signed ten-fact envelopes and
hands their exact canonical documents to the Cycle 2d normalizer. Cycle 2i does
not execute a parser, and its test builder does not prove that its documents
were derived by a worker from the supplied archives. Cycle 2a's frozen v1
two-fact protocol must not be widened or cited as ten-fact evidence.

The next repository-controlled gap is therefore one narrow live composition:
execute exactly two closed synthetic archives in fresh isolated workers, create
the complete signed Cycle 2i envelopes outside those workers, and delegate the
exact archives and envelopes to the unchanged Cycle 2i handoff. This work
cannot replace the externally controlled Cycle 2b authority gate or the real
quality gate.

## Proposed decision

Add one private, disconnected
`@research-cockpit/filing-parser-normalization-execution` package and one
dedicated success-only live acceptance domain. The boundary accepts exactly one
synthetic original archive and one synthetic amendment archive, strict expected
image/key inputs, an outside-worker Ed25519 signer, and a bounded process
runner. It owns all public byte carriers before use.

Each nonempty eligible archive executes in a fresh container built from one
reviewed digest-pinned Python 3.12 image. The container receives one read-only
archive, no signing key, no network, no application/database/tenant context,
and fixed CPU, memory, PID, file, stream, and time limits. Its ZIP/XML parser is
limited to one closed synthetic taxonomy and the exact Cycle 2d ten-fact
document schema. It emits exactly one bounded canonical document result and
nothing to stderr. Any invalid archive, worker output, timeout, abort, or
cleanup ambiguity fails closed without partial facts.

The host recomputes each archive SHA-256, validates the exact complete document,
and creates a domain-separated Cycle 2i envelope only after worker validation.
The private signing key remains outside the worker. The exact original and
amendment archive/envelope bytes then delegate without defaulting, inference,
repair, fact synthesis, or semantic remapping to the promoted Cycle 2i handoff.
Only its `normalized` result succeeds.

Success returns one immutable Cycle 2d normalized original/amendment record and
bounded aggregate execution provenance. Any input, parser, container, output,
signature, key/image, source binding, role, mutation, cleanup, or downstream
failure returns one empty value-free `execution_quarantined` result with no
fact values, raw bytes, hashes, provenance identifiers, mismatch details, or
canary content.

The sole proposed target claim is
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`.
It remains Pending until one exact successor commit passes every source and
live promotion gate below.

## Required checks

The exact ordered checks are:

1. `exact_two_synthetic_original_and_amendment_archives_and_strict_options`
2. `intrinsic_bounded_owned_archive_signer_and_process_output_snapshots`
3. `pinned_python_3_12_zero_install_reviewed_worker_and_taxonomy`
4. `fresh_nonroot_capability_dropped_network_none_read_only_container_per_archive`
5. `fixed_cpu_memory_pids_nofile_tmpfs_stdout_stderr_and_wall_clock_limits`
6. `closed_zip_xml_name_size_ratio_entity_depth_node_text_and_taxonomy_rejection`
7. `exact_complete_ten_fact_cycle2d_document_per_distinct_role`
8. `canonical_single_document_output_exit_zero_empty_stderr_and_no_extra_fields`
9. `host_recomputed_archive_sha256_and_exact_worker_document_binding`
10. `outside_worker_ed25519_cycle2i_envelope_signing_with_key_and_image_binding`
11. `unchanged_archive_and_envelope_bytes_delegated_to_cycle2i_handoff`
12. `atomic_original_amendment_normalization_or_single_empty_value_free_quarantine`
13. `timeout_abort_create_start_output_signing_handoff_and_cleanup_failure_quarantine`
14. `role_swap_substitution_tamper_partial_duplicate_mutation_and_replay_coverage`
15. `success_only_exact_commit_image_case_source_artifact_and_offline_review`
16. `no_fetch_network_custody_corpus_database_api_web_queue_or_real_data`

## Exact nonclaims

The exact ordered nonclaims are:

1. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
2. `real_public_filing_bytes_sec_source_authenticity_or_attestation`
3. `counsel_identity_legal_validity_revocation_freshness_or_data_rights`
4. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
5. `general_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness`
6. `signer_identity_or_production_kms_hsm_custody_rotation_nonrepudiation`
7. `independent_second_parser_or_cross_engine_validator_independence`
8. `independently_adjudicated_ground_truth_or_two_thousand_assertions`
9. `precision_recall_document_success_thresholds_or_zero_silent_failures`
10. `general_alias_unit_conversion_dimension_or_fiscal_calendar_coverage`
11. `real_amendment_completeness_correction_discovery_or_sec_restated_status`
12. `production_payload_retention_backup_delete_or_cryptographic_erasure`
13. `multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo`
14. `database_api_web_queue_persistence_evidence_passport_or_b15_v15`
15. `production_identity_secrets_host_kernel_daemon_or_incident_recovery`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## Evidence and promotion boundary

Source promotion requires an exact transition from baseline
`f17bacc6adc46851e182d260d59830652f1953bb`, frozen in both historical filing
evidence verifiers with omission, extra-path, status, baseline, and merge-base
regressions. The full local release gate and the existing Ubuntu/Windows CI,
historical parser, custody, and PostgreSQL regression workflows must pass on
the exact same source commit.

Because this claim includes actual container execution, it also requires a
dedicated Ubuntu live workflow, success-only canonical evidence bound to the
exact commit, image, sources, cases, run, and attempt, a retained artifact, and
an independently anchored offline review whose only success verdict is
`offline_consistent`. Failure or cancellation retains no candidate artifact and
cannot promote the claim. All of these gates are Pending.

No pending or future Cycle 2j result can authenticate GitHub, Docker, the host
kernel, supplied trust anchors, signer authority, SEC source truth, or real
filing quality. Those remain separate review or external admission duties.

## Consequences

If promoted, Cycle 2j can establish only that two reviewed synthetic archives
were processed by the exact bounded worker path, converted into complete signed
ten-fact envelopes, and normalized atomically through Cycle 2i. It cannot
establish that the synthetic extraction rules are generally correct, that a
second independent engine agrees, or that any real filing may be admitted.

Cycle 2b remains Blocked until an externally reviewed exact 100-filing manifest,
rights and steward approvals, chronology, authority keys, and human review all
exist. The full Cycle 2 quality exit remains Blocked until representative real
filings and 2,000 independently adjudicated assertions pass frozen thresholds
with zero silent critical failures.

## References

- [Cycle 2j exit matrix](../CYCLE_2J_EXIT_MATRIX.md)
- [ADR 0036](./0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
- [ADR 0028](./0028-bounded-synthetic-filing-parser-isolation.md)
- [Cycle 2i exit matrix](../CYCLE_2I_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
