# Cycle 2k exit matrix

Scope: one disconnected proposal to execute the same owned synthetic original
archive and amendment archive through the existing Cycle 2j Python worker and a
distinct zero-install pinned Node worker. For each fixed archive role, the two
live workers must emit byte-exact equal canonical stdout documents. Each
engine's complete original/amendment pair must separately reach the
unchanged normalization boundary and produce one byte-exact equal complete
Cycle 2d normalization record. Any disagreement or failure returns one atomic,
empty, value-free quarantine. The proposed decision is recorded in
[ADR 0038](./adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md).

Current status: **Pending exact recovery from baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`. Source precursor
`14b4ecf41806dca7759a06bebf7ef8da96374f76` is its exact direct child, but
dedicated run `32910394736` attempt 1 failed closed at `image_inspection`
because the Python image's final `/worker` directory was compared with the
Node image's `/input` expectation. The run retained no artifact and has no
offline-review verdict. Failed corrective revision
`061944f8f770e8a08b2a38d1e2fedf8b8e2de348` is the precursor's exact direct
child. Its dedicated run `32912204603` attempt 1 completed live Docker
execution and every residue phase, then failed closed at `evidence_assembly`
because the runner hashed a 62-path static list instead of the required
66-path source-transition union. That run also retained no artifact and has no
offline-review verdict. Failed recovery revision
`f29e39cea40e76d500df833fd8e0e94e0c86a68c` is its exact single-parent direct
child. Dedicated run `32913611954` attempt 1, job `98012515052`, completed live
Docker execution and every residue phase, then failed closed at
`evidence_assembly`. Its offline review and upload were skipped, it retained
zero artifacts, and it is non-evidence. One exact recovery child, its full green gates, and
successful evidence anchors are still required. This proposal promotes no
claim. Cycle 2b, full Cycle 2 quality, real-data admission, and production
admission remain Blocked.**

| Gate                            | Required result                                                                                                                                                                                                       | Current status            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Exact input and role inventory  | The same owned synthetic original archive and amendment archive enter fixed Python and Node engine roles; no third input or role exists                                                                               | Pending                   |
| Owned bounded inputs            | Archive, configuration, signer, and process-output carriers are intrinsically validated, bounded, and copied before use                                                                                               | Pending                   |
| Distinct pinned engines         | The existing reviewed Cycle 2j Python worker and one separately reviewed zero-install Node worker have distinct exact source inventories and distinct pinned image digests                                            | Pending                   |
| Fresh process isolation         | Each engine/archive execution uses a fresh numeric-nonroot container with dropped capabilities, no network or privileges, and exactly one read-only archive input                                                     | Pending                   |
| Resource and cleanup bounds     | CPU, memory, swap, PIDs, nofile, tmpfs, stdout, stderr, control, and wall-clock limits apply; successful live paths prove zero residue; cleanup failure or ambiguity quarantines                                      | Pending                   |
| Complete stdout documents       | Each worker emits exactly one bounded canonical complete Cycle 2d ten-fact document, exits zero, writes empty stderr, and emits no extra bytes                                                                        | Pending                   |
| Live stdout agreement           | For each fixed original or amendment role, the Python and Node canonical stdout document bytes are exactly equal                                                                                                      | Pending                   |
| Exact normalization agreement   | Each engine's complete pair reaches the unchanged normalization boundary without repair or remapping, and the two complete canonical normalization-record byte strings are exactly equal                              | Pending                   |
| Atomic result                   | One immutable agreement result with bounded aggregate provenance succeeds, or one empty value-free quarantine returns                                                                                                 | Pending                   |
| Replay and adversarial coverage | Live exact replay agrees and live mismatch, tamper, and role swap quarantine; exact-source security suites cover substitution, partial/extra/duplicate output, mutation, timeout, abort, process, and cleanup failure | Pending                   |
| Frozen source transition        | One exact linear four-commit recovery chain from the baseline through all three failed revisions is frozen by ancestry, path, status, and content expectation with no unreviewed widening                             | Pending                   |
| Local integration               | Format, lint, guardrails, dependency policy, typechecks, all tests, both worker tests, and all builds pass on frozen bytes                                                                                            | Pending                   |
| Exact-source CI and regressions | Ubuntu/Windows CI plus the required historical parser, custody, PostgreSQL, and Cycle 2j live regressions pass on the same successor commit                                                                           | Pending                   |
| Dedicated live evidence         | A separately authorized Ubuntu real-Docker run retains a success-only canonical artifact binding both images, both source inventories, cases, checks, and nonclaims                                                   | Pending                   |
| Independent offline review      | Independently supplied repository, revision, run, attempt, artifact, and evidence-digest anchors return `offline_consistent` for every frozen source hash                                                             | Pending                   |
| Cycle 2b authority              | Exact external inventory, rights/steward approvals, chronology, authority keys, and human review pass before real bytes                                                                                               | Blocked; outside Cycle 2k |
| Independent real quality        | Representative real filings and 2,000 independently adjudicated assertions pass frozen thresholds with zero silent critical failures                                                                                  | Blocked                   |
| Production admission            | Real-data rights, source/fetch, persistence, security, privacy, scale, and operational gates pass                                                                                                                     | Blocked                   |

## Target claim and exact checks

The sole proposed bounded target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`.
It may be accepted only for one exact recovery child of failed recovery
revision `f29e39cea40e76d500df833fd8e0e94e0c86a68c`, with that revision itself
the exact single-parent direct child of failed corrective revision
`061944f8f770e8a08b2a38d1e2fedf8b8e2de348`, with that revision itself
the exact single-parent direct child of failed precursor
`14b4ecf41806dca7759a06bebf7ef8da96374f76`, with that precursor itself the
exact single-parent direct child of baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, and the complete evidence anchors
required below.

The proposed exact ordered checks are:

1. `exact_owned_synthetic_original_and_amendment_pair_in_fixed_python_and_node_roles`
2. `intrinsic_bounded_owned_archive_configuration_signer_and_process_output_snapshots`
3. `distinct_reviewed_pinned_python_and_zero_install_node_worker_sources_and_images`
4. `fresh_nonroot_capability_dropped_network_none_read_only_container_per_engine_and_archive`
5. `fixed_cpu_memory_pids_nofile_tmpfs_stdout_stderr_control_and_wall_clock_limits`
6. `closed_archive_and_document_protocol_separately_enforced_by_both_engines`
7. `canonical_single_complete_ten_fact_stdout_document_per_engine_and_role`
8. `byte_exact_python_node_live_stdout_document_agreement_per_archive_role`
9. `host_recomputed_archive_sha256_and_exact_engine_document_binding`
10. `outside_worker_signing_and_unchanged_normalization_delegation_per_engine_pair`
11. `byte_exact_complete_normalization_record_agreement_without_subset_or_digest_substitution`
12. `atomic_cross_engine_agreement_or_single_empty_value_free_quarantine`
13. `engine_role_mismatch_timeout_abort_process_and_cleanup_failure_quarantine`
14. `swap_substitution_tamper_partial_extra_duplicate_mutation_and_replay_coverage`
15. `success_only_exact_four_commit_recovery_transition_two_image_case_source_artifact_and_offline_review`
16. `historical_evidence_immutability_and_no_fetch_custody_database_api_web_queue_or_real_data`

## Exact nonclaims

The proposed exact ordered nonclaims are:

1. `true_organizational_operator_key_host_or_failure_domain_independence`
2. `general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness`
3. `real_public_filing_bytes_sec_source_authenticity_or_attestation`
4. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
5. `counsel_identity_legal_validity_revocation_freshness_or_data_rights`
6. `independently_adjudicated_ground_truth_or_two_thousand_assertions`
7. `precision_recall_document_success_thresholds_or_zero_silent_failures`
8. `general_alias_unit_conversion_dimension_or_fiscal_calendar_coverage`
9. `real_amendment_completeness_correction_discovery_or_sec_restated_status`
10. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
11. `production_signer_kms_hsm_custody_rotation_or_nonrepudiation`
12. `production_payload_retention_backup_delete_or_cryptographic_erasure`
13. `multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo`
14. `database_api_web_queue_persistence_evidence_passport_or_b15_v15`
15. `production_identity_secrets_host_kernel_daemon_or_incident_recovery`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## Required evidence and promotion rule

Before promotion, one exact linear four-commit recovery chain from baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, through failed precursor
`14b4ecf41806dca7759a06bebf7ef8da96374f76` and failed corrective revision
`061944f8f770e8a08b2a38d1e2fedf8b8e2de348` and failed recovery revision
`f29e39cea40e76d500df833fd8e0e94e0c86a68c`, to one exact recovery child must
be frozen by all four exact parent lines plus the complete cumulative path and
status inventory. The full local gate, separate Python and Node worker tests,
exact-source Ubuntu and Windows CI, and required parser, custody, PostgreSQL,
and Cycle 2j live regression workflows must pass on the recovery child. Those
regression runs are health checks only and are not Cycle 2k execution evidence.
Failed runs `32910394736`, `32912204603`, and `32913611954`, each attempt 1,
are explicitly non-evidence. All retained zero artifacts; the third run's
offline review and upload were skipped. No missing artifact may be substituted
for the required successful artifact; completing live execution phases in the
second or third run does not convert a later evidence-assembly failure into
passing evidence.

A separately authorized dedicated Ubuntu real-Docker workflow must execute the
success and exact replay paths plus normalization-mismatch, original-archive-
tamper, and original/amendment-role-swap quarantines. The same workflow must
first pass the exact-source Python and Node worker suites and the cross-engine
unit/security suites that cover stdout mismatch, substitution, partial or extra
output, duplicate output, mutation, timeout, abort, process failure, and cleanup
failure. Those source-suite cases are required coverage, not additional live
evidence outcomes. The workflow may upload a canonical artifact only after
every exact check passes.
Failure, cancellation, source-transition drift, a different commit, a missing
engine, an unpinned or equal image identity, any stdout or normalization
disagreement, noncanonical output, container residue, or non-value-free
quarantine must retain no candidate artifact and must prevent promotion.

The versioned canonical evidence must bind the exact repository, baseline,
failed precursor, failed corrective revision, failed recovery revision, and
recovery revision, cumulative
transition inventory, workflow/run/job/attempt, artifact
identity and digest, both built image digests, both exact worker source
inventories and hashes, fixture manifest and archive hashes, tool versions,
container counts, canonical case outcomes, exact checks, exact nonclaims, and
every Cycle 2k source hash. An offline verifier must require independently
supplied repository, revision, run, attempt, artifact, and canonical evidence
digest anchors and return `offline_consistent` only when every internal binding
and source hash agrees. That verdict cannot authenticate GitHub, artifact
custody, Docker, the host, the engines' authors or operators, supplied trust
anchors, images, keys, sources, SEC data, or accounting truth.

Cycle 2a, Cycle 2c, Cycle 2d, Cycle 2i, and Cycle 2j evidence records, schemas,
checks, nonclaims, source sets, artifacts, and historical run anchors must remain
byte-exact and immutable. No historical run may be relabeled as Cycle 2k
evidence or used to widen a historical claim.

This document remains proposal-only until every required source and evidence
anchor is replaced with exact successful values after independent review.
Passing the proposed bounded gate still could not unblock Cycle 2b, establish
true independence or real filing quality, satisfy the full Cycle 2 exit, admit
real data, create B15/V15, or authorize production use.
