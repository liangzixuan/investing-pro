# Cycle 2j exit matrix

Scope: one disconnected live gate that executes exactly one synthetic
original archive and one synthetic amendment archive in fresh bounded workers,
creates complete signed ten-fact envelopes outside those workers, and delegates
the exact archive/envelope pair to the promoted Cycle 2i handoff. The decision
is recorded in
[ADR 0037](./adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md).

Current status: **Pass only for exact source commit
`b2c7a28c2c5720253eba275b65d3313b114c3bc4` from exact baseline
`f17bacc6adc46851e182d260d59830652f1953bb`. The transition is exactly 44 paths
(31 added, 13 modified), the frozen local gate passed 1,095 tests with 4 skips,
the Python worker passed 6 tests, every exact-source regression workflow
passed, and the dedicated live artifact returned `offline_consistent`. Cycle
2b, full Cycle 2 quality, real-data admission, and production admission remain
Blocked.**

| Gate                         | Required result                                                                                                                                                                  | Current status                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Exact role inventory         | Exactly one source-controlled synthetic original archive and one amendment archive enter the boundary                                                                            | Pass                              |
| Owned bounded inputs         | Archive, signer, option, and process-output carriers are intrinsically validated, bounded, and copied before use                                                                 | Pass                              |
| Pinned worker                | One reviewed digest-pinned Python 3.12 zero-install worker and closed taxonomy produce the documents                                                                             | Pass: Python 3.12.13              |
| Process isolation            | Fresh numeric-nonroot containers drop capabilities, disable networking and privileges, and expose only one read-only input                                                       | Pass                              |
| Resource and cleanup bounds  | CPU, memory, swap, PIDs, nofile, tmpfs, stdout, stderr, control, and wall-clock limits apply; successful live paths prove zero residue; cleanup failure or ambiguity quarantines | Pass                              |
| Closed archive/XML protocol  | ZIP/XML name, count, expansion, construct, depth, node, text, taxonomy, concept, unit, and fact constraints fail closed                                                          | Pass                              |
| Complete distinct documents  | Each accepted worker result is one canonical complete Cycle 2d ten-fact document in its fixed original or amendment role                                                         | Pass                              |
| Source and envelope binding  | Host-recomputed archive digests, exact document bytes, outside-worker Ed25519 signatures, and supplied key/image expectations bind                                               | Pass; authority is not claimed    |
| Exact Cycle 2i delegation    | The original/amendment archive and envelope bytes reach the unchanged Cycle 2i handoff without repair or remapping                                                               | Pass                              |
| Atomic result                | One immutable normalized pair with aggregate execution provenance succeeds, or one empty value-free quarantine returns                                                           | Pass                              |
| Replay and adversarial cases | Exact-byte replay is deterministic; swaps, substitutions, tampering, partial facts, mutation, timeout, abort, and cleanup failure quarantine                                     | Pass                              |
| Exact source transition      | Both historical evidence verifiers admit only one frozen successor from the exact baseline                                                                                       | Pass: 44 paths; 31 A / 13 M       |
| Local integration            | Format, lint, guardrails, dependency policy, typechecks, all tests, and all builds pass on frozen bytes                                                                          | Pass: 55 files; 1,095 / 4 skipped |
| Regression workflows         | Ubuntu/Windows CI plus historical parser, custody, and PostgreSQL workflows pass on the same source commit                                                                       | Pass                              |
| Dedicated live evidence      | Ubuntu live execution, success-only canonical artifact, retained evidence, and independently anchored offline review pass                                                        | Pass: run `32897837981`           |
| Cycle 2b authority           | Exact external inventory, rights/steward approvals, chronology, authority keys, and human review pass before real bytes                                                          | Blocked; outside Cycle 2j         |
| Independent quality          | Representative real filings and 2,000 independently adjudicated assertions pass frozen thresholds with zero silent critical failures                                             | Blocked                           |
| Production admission         | Real-data rights, source/fetch, persistence, security, privacy, scale, and operational gates pass                                                                                | Blocked                           |

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`.
It is accepted only for exact source commit
`b2c7a28c2c5720253eba275b65d3313b114c3bc4` and the evidence anchors below.

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

## Promotion record

The exact source transition begins at
`f17bacc6adc46851e182d260d59830652f1953bb` and ends at
`b2c7a28c2c5720253eba275b65d3313b114c3bc4`: 44 paths, comprising 31 additions
and 13 modifications, with no rename or deletion. The local `pnpm verify` gate
passed formatting, lint, every guardrail, dependency and peer policy, all
typechecks, 55 test files with 1,095 passed and 4 skipped, and all builds. The
closed Python worker separately passed 6 of 6 tests without writing bytecode.

CI run `32897837955` passed in Ubuntu job `97964475832` and Windows job
`97964475617`. Filing parser isolation run/job `32898633916` / `97966990149`,
filing payload custody run/job `32897838012` / `97964476010`, and PostgreSQL
run/job `32898674640` / `97967111035` passed as regression health only. They
are not Cycle 2j execution evidence.

Dedicated run `32897837981`, attempt 1, passed in Ubuntu job `97964475815` and
retained artifact `9581921300`, named
`filing-parser-normalization-execution-evidence-v1-b2c7a28c2c5720253eba275b65d3313b114c3bc4-1`.
The downloaded ZIP SHA-256 is
`sha256:a23c5d291970addb0e6a5369a93bf2dfd29efab1f20520e48d7644bfbf81dcee`,
matching GitHub's artifact digest; the canonical evidence file SHA-256 is
`sha256:671a67088a2630f8c397a7dab71301290271f9474ca78868bc4617aa476b2639`.

The schema-v1 evidence binds fixture manifest
`sha256:4484902fec490f6a949ad1f85621c710e7d31efd2b8d42402122c5fdf5b84d8f`
and built image
`sha256:fe4a350e5a9cff1a3a62bfe0c5338eca486258696c91fec68d454727e16790b5`.
It records Python 3.12.13, Docker client/server 28.0.4, Node v24.19.0, pnpm
11.19.0, 16 checks, 16 nonclaims, and 51 source hashes. Its three canonical
case outcomes are one normalized exact original/amendment pair and two
value-free quarantines for archive tamper and role swap; exact replay matched.
The two-container runtime count describes the successful original/amendment
pair. Replay and adversarial cases use additional fresh workers without
widening the two-input claim.

The independently supplied exact repository, revision, run, attempt, and
evidence digest returned `offline_consistent` with 51 of 51 source hashes. That
verdict establishes internal offline consistency only; it does not authenticate
GitHub, artifact custody, Docker, the host, supplied trust anchors, or signer,
image, or source authority.

## History and exit rule

The promoted Cycle 2j result is confined to the exact source transition and
evidence record above. Cycle 2a, Cycle 2c, Cycle 2d, and Cycle 2i evidence,
checks, nonclaims, source sets, schemas, artifacts, and historical anchors
remain immutable; the regression runs above cannot replace or widen them.

Failure, cancellation, a different source commit, transition drift, partial
worker execution, container residue, noncanonical output, source/signature/
image/key mismatch, role substitution, handoff repair, partial normalized data,
or non-value-free quarantine would have prevented promotion and retained no
candidate artifact. Passing this bounded synthetic gate cannot unblock Cycle
2b, prove independent or real filing quality, satisfy the full Cycle 2 exit,
create B15/V15, admit real data, or authorize production use.
