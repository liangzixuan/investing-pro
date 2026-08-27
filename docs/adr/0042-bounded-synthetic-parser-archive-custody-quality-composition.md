# ADR 0042: bounded synthetic parser-archive custody and quality composition

Status: Proposed source milestone. **Source completion, exact-source
verification, workflow evidence, independent review, and promotion are
Pending.** No target source commit, run, job, artifact, or evidence digest has
been accepted.

## Context

Cycle 2c proves one disconnected, generated 4,096-byte synthetic custody
fixture. It does not custody either archive consumed by the parser path. Cycle
2n separately accepts the exact synthetic original and amendment archives,
owns Cycle 2m direct-Docker execution, and binds the resulting two-document
observation into unchanged Cycle 2g/Cycle 2f quality evaluation. Cycle 2n does
not establish that its parser inputs came from an encrypted custody record and
authenticated readback.

The next repository-controlled blocker is therefore the missing adapter
between those exact parser archives and the promoted Cycle 2n boundary. This
decision must not relabel Cycle 2c evidence, invent a real filing or approval,
fill any of the 98 absent quality coordinates, or turn the honest Cycle 2n
`evaluated/not_met` result into a quality Pass.

## Decision

Add one package-owned outer composition over a new exact-pair synthetic custody
protocol and unchanged Cycle 2n. Public configuration accepts only the sealed
Cycle 2n engine descriptors. It exposes no custody boundary, execution
boundary, runner, clock, entropy source, key store, key, nonce, workspace path,
digest, receipt, readback, execution result, candidate, measurement, callback,
or options injection surface. Test-only fault seams remain absent from public
exports.

The exact fixed inputs are:

- original archive: 2,306 bytes with SHA-256
  `sha256:f331ff51540c11aca55a5d1d81d2c1daeaf4354acdea45530faed5275a5322ba`;
- amendment archive: 2,330 bytes with SHA-256
  `sha256:df7f1ff416b60168b09902bd7714fa47bf0453ef9732c8c5b476988bb70f47a8`.

The asynchronous outer commit reserves its one-shot state before validation or
I/O and snapshots the plan, declared-reference digest, and both archives with
intrinsic owned-byte operations. It derives one common source context and two
role-specific source bindings internally. It stages the original and amendment
as separate AES-256-GCM records under fresh distinct keys and nonces. Closed,
domain-separated AAD binds the custody claim, schema, role, byte length,
content digest, and role-specific source binding. Both ciphertext and canonical
audit records must be complete before the pair is published.

Readback accepts only bounded regular files and the exact closed audit schema.
It recomputes ciphertext, AAD, plaintext, and receipt digests; authenticates
each record; preserves the original/amendment partition; and returns owned
readback snapshots. Only those authenticated readback bytes may enter a fresh,
unchanged Cycle 2n protocol. Direct caller snapshots must never bypass custody
into Cycle 2n. After Cycle 2n has made its own intrinsic snapshots, the outer
protocol wipes reachable transient plaintext and key buffers and removes only
its verified owned temporary workspace. Cleanup failure quarantines the whole
operation.

The outer commitment binds both custody receipts, the custody-pair binding,
the common source context, the exact Cycle 2n commitment, and the unchanged
plan and declared-reference digest. Reveal remains an instance-bound one-shot
capability operation and delegates to unchanged Cycle 2n. The outer evaluation
binding additionally binds the complete Cycle 2n evaluation. Same inputs keep
archive identities, normalization, candidate observation, and measurement
stable while fresh custody keys/nonces/ciphertexts, Docker lifecycles, and outer
bindings remain distinct.

The sole proposed target claim is
`bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding`.
It can be accepted only for a future exact source and success-only evidence
boundary. Until every gate passes, its status remains Pending.

## Required checks

The proposed exact ordered checks are:

1. `exact_sealed_cycle2m_engine_configuration_and_frozen_archive_pair_profile`
2. `no_caller_injected_custody_path_clock_entropy_key_store_receipt_readback_boundary_runner_signer_result_or_callback`
3. `intrinsic_owned_plan_and_archive_snapshots_before_first_await`
4. `async_one_shot_commit_reservation_and_reveal_consumption_before_validation`
5. `common_source_context_binds_plan_reference_digest_and_both_archive_digests`
6. `role_specific_custody_bindings_cover_common_context_role_and_both_archives`
7. `exact_two_archive_encrypted_stage_atomic_publish_and_authenticated_readback`
8. `only_authenticated_owned_readback_snapshots_enter_fresh_cycle2n_composition`
9. `custody_cleanup_and_key_forget_complete_before_commit_publication`
10. `exact_cycle2n_candidate_commitment_projection_and_source_execution_validation`
11. `unchanged_cycle2g_reveal_and_cycle2f_fixed_population_measurement`
12. `honest_two_document_evaluated_not_met_accounting_is_preserved`
13. `outer_commitment_binds_custody_receipts_pair_and_cycle2n_commitment`
14. `outer_evaluation_binds_custody_commitment_and_cycle2n_evaluation`
15. `mutation_tamper_role_swap_replay_concurrency_dependency_and_cleanup_failure_coverage`
16. `single_deeply_frozen_value_free_quarantine_and_cycle2c_cycle2n_history_immutability`

## Exact accounting

The only successful quality result remains the unchanged Cycle 2n accounting:

- 100 declared documents: 2 succeeded, 98 missing, and 0 quarantined.
- 1,000 expected facts: 20 emitted/true-positive, 0 false-positive, and 980
  missing/false-negative.
- 2,000 critical assertions: 1,960 silent failures.
- Precision `20/20` and quarantine rate `0/100` meet their thresholds.
- Document success `2/100`, recall `20/1000`, and maximum silent failures do
  not meet their thresholds.
- Protocol status is `evaluated`; measurement outcome is `not_met`.

Encrypted staging and authenticated readback must not change a coordinate,
fact, denominator, threshold, outcome, or failed-threshold order.

## Exact nonclaims

Cycle 2o preserves every exact ordered Cycle 2n nonclaim as its ordered prefix
without replacement:

1. `docker_daemon_host_kernel_runtime_or_container_id_authenticity`
2. `worker_image_registry_supply_chain_attestation_nonce_freshness_or_cache_absence`
3. `external_signer_identity_kms_hsm_custody_rotation_or_nonrepudiation`
4. `organizational_operator_key_host_or_failure_domain_independence`
5. `independent_adjudicator_identity_declared_reference_correctness_or_human_resolution_quality`
6. `reference_secrecy_external_blinding_label_leakage_absence_or_authenticated_durable_chronology`
7. `representative_one_hundred_real_filings_or_independently_adjudicated_two_thousand_real_assertions`
8. `real_parser_quality_threshold_adequacy_confidence_or_production_acceptance`
9. `general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness`
10. `real_public_filing_bytes_sec_source_authenticity_attestation_or_custody`
11. `cycle2b_external_inventory_rights_steward_key_authority_human_review_or_phaseb_admission`
12. `strategic_quarantine_reason_authenticity_collusion_common_mode_or_malicious_failure_masking_detection`
13. `general_alias_unit_conversion_dimension_fiscal_calendar_or_amendment_coverage`
14. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
15. `multi_issuer_batch_retry_crash_recovery_load_slo_database_api_web_queue_or_b15_v15`
16. `real_data_admission_full_cycle2_exit_or_production_use`

The exact custody-specific limitations are appended in this order:

17. `host_os_filesystem_temp_directory_disk_or_docker_runtime_attestation`
18. `physical_or_cryptographic_erasure_disk_remanence_swap_or_gc_copy_absence`
19. `durable_twenty_four_hour_retention_expiry_crash_recovery_or_backup_deletion`
20. `process_crash_power_loss_or_cross_process_custody_recovery`
21. `source_owned_ephemeral_custody_key_production_identity_rotation_or_nonrepudiation`
22. `javascript_plaintext_memory_wipe_guarantee_or_gc_copy_absence`

## Evidence and promotion boundary

Source completion is not promotion. A future promotion requires one clean
exact-source transition, full local verification, terminal-green Ubuntu and
Windows CI plus every triggered dedicated workflow, a success-only successor
record that preserves evidence versions 1 through 4, retained artifact and
digest inspection, and independently anchored offline review against the full
source inventory. Failed runs must retain no artifact and remain non-evidence.
No target source SHA, run/job ID, artifact ID, source count, transition count,
runtime count, or digest is known yet.

The current baseline also contains separate P1 corrective source
`96b042669edc6cb4a876bb0c061fa5e18732c1ca`, which caps Phase-A corpus
admission `validUntil` at a scheduled authority revocation. Corrective closure
and promotion remain Pending. That chain is not Cycle 2o evidence, supplies no
external inventory, rights/steward approval, authority identity, trusted clock,
or human review, and does not change Cycle 2b's Blocked status.

## Consequences

If promoted, Cycle 2o would close only the exact synthetic parser-archive
custody-readback-to-Cycle 2n composition gap. It would prove neither real
filing custody nor retention. The honest quality result remains
`evaluated/not_met`; representative real filings, independently adjudicated
truth, real parser quality, Cycle 2b authority, B15/V15, real-data admission,
full Cycle 2 exit, and production remain Blocked.
