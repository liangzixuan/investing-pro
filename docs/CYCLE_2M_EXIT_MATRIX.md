# Cycle 2m exit matrix

Scope: replace the injected cross-engine child factory, runners, and signer with
a source-owned direct-Docker execution boundary. Public configuration exposes
only sealed engine descriptors. The package owns an internal ephemeral Ed25519
signer and audited runners that bind exact fresh container lifecycles to the
Cycle 2l current-input and reciprocal-lineage agreement. The decision is
recorded in
[ADR 0040](./adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md).

Current status: **Pending source implementation from exact baseline
`1cb7d3ce024cbd29665af7ec4e010da0c380b726`.** Promotion requires one exact
single-parent source child, full local and exact-source Ubuntu/Windows CI, a
success-only retained canonical v3 artifact, artifact and evidence digest
inspection, and independently anchored offline review. The source SHA,
runs/jobs, artifact identity, digests, and offline verdict are Pending. Cycle
2l v2 and Cycle 2k v1 evidence remain immutable. Cycle 2b, real quality,
real-data admission, B15/V15, and production remain Blocked.

| Gate                             | Required result                                                                                                                                                                             | Current status |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Sealed public configuration      | Callers provide only exact closed engine descriptors; no public runner, factory, signer, key, receipt, or result injection surface exists                                                   | Pending        |
| Internal signer                  | Each invocation creates one internal ephemeral Ed25519 signer and binds its public-key context into every lifecycle and invocation receipt                                                  | Pending        |
| Source-owned direct Docker       | Package-owned audited runners perform the fixed Docker command protocol without a caller-supplied execution boundary                                                                        | Pending        |
| Exact fresh lifecycles           | Each invocation performs exactly four fresh create/start/attach/remove lifecycles and accepts no container reuse                                                                            | Pending        |
| Removal and zero residue         | Every lifecycle verifies removal and the invocation completes only with zero matching container residue                                                                                     | Pending        |
| Lifecycle receipt binding        | Each independently recomputable receipt binds archive digest, document role and digest, container-ID digest, engine id/role/image/implementation, key id and SPKI digest, and `zeroResidue` | Pending        |
| Audited runner protocol          | The internal runner validates exact create/start `--attach`/`rm --force`/residue order plus exit and output snapshots without placing a hidden transcript in the public receipt             | Pending        |
| Agreement binding                | Cycle 2l current-input, receipt/fact, pair/execution, normalization, and reciprocal-lineage agreement is bound into the lifecycle result                                                    | Pending        |
| Invocation binding               | The four lifecycle receipts, Cycle 2l agreement, complete normalization bytes, and key context produce one distinct invocation binding                                                      | Pending        |
| Repeat freshness                 | Two invocations over the same inputs normalize byte-identically while producing eight unique container-ID digests and distinct lifecycle/invocation hashes                                  | Pending        |
| Atomic quarantine                | Any descriptor, signer, Docker operation, receipt, agreement, binding, uniqueness, or cleanup failure returns one empty value-free quarantine                                               | Pending        |
| Local integration                | Format, lint, guardrails, dependency policy, typechecks, security/unit suites, tests, and builds pass on the exact source bytes                                                             | Pending        |
| Exact-source CI                  | Required Ubuntu/Windows and dedicated lifecycle workflow pass on the exact single-parent source child without transition drift                                                              | Pending        |
| Dedicated v3 evidence            | A success-only retained canonical v3 artifact binds the exact source transition, lifecycle outcomes, ordered checks/nonclaims, images, sources, and workflow identity                       | Pending        |
| Independent offline review       | Independently supplied repository, revision, run, attempt, artifact, and evidence-digest anchors return offline-consistent for every frozen source hash                                     | Pending        |
| Historical evidence immutability | Cycle 2l v2, Cycle 2k v1, and failed-run records remain byte-immutable historical facts and cannot be relabeled                                                                             | Pending        |
| External authority and quality   | Cycle 2b external authority, 100 real filings, 2,000 assertions, real quality, B15/V15, real-data admission, and production remain outside this milestone                                   | Blocked        |

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding`.
It is not accepted in the source state. Promotion requires the exact boundary
and evidence record defined here for one exact single-parent child of baseline
`1cb7d3ce024cbd29665af7ec4e010da0c380b726`.

The exact ordered checks are:

1. `exact_source_owned_direct_docker_python_and_node_engine_configuration`
2. `no_caller_injected_boundary_runner_signer_key_factory_or_execution_callback`
3. `intrinsic_closed_descriptor_and_digest_configuration_snapshot`
4. `internally_generated_ephemeral_ed25519_signer_and_public_key_binding`
5. `fresh_unique_container_create_start_attach_remove_and_zero_residue_per_engine_role_archive`
6. `exact_four_container_original_amendment_python_node_lifecycle_partition`
7. `package_owned_bounded_shell_false_docker_process_execution_and_output_snapshots`
8. `current_archive_document_handoff_execution_fact_and_reciprocal_lineage_validation`
9. `byte_exact_cross_engine_normalization_agreement_after_complete_child_validation`
10. `lifecycle_receipt_container_identity_role_image_and_archive_binding`
11. `outer_invocation_binding_over_agreement_normalization_key_and_lifecycle_receipts`
12. `same_input_normalization_stability_with_distinct_lifecycle_and_invocation_bindings`
13. `atomic_direct_agreement_or_single_empty_value_free_quarantine`
14. `abort_timeout_process_signer_output_cleanup_residue_and_concurrency_failure_coverage`
15. `success_only_exact_source_v3_workflow_artifact_and_offline_review`
16. `v1_v2_evidence_immutability_and_no_quality_real_data_or_production_widening`

## Required v3 live outcomes

The canonical v3 acceptance record must contain exactly six ordered outcomes:

1. `same-input-direct-docker-distinct-lifecycle-invocations` agrees across two
   invocations over the same exact owned synthetic input pair. Each invocation
   performs four fresh container lifecycles; normalization is byte-identical;
   all eight container-ID digests and lifecycle bindings are unique; and the two
   invocation bindings are distinct.
2. `unknown-python-image` returns one empty value-free quarantine.
3. `pre-aborted-signal` returns one empty value-free quarantine.
4. `original-archive-tamper` returns one empty value-free quarantine.
5. `original-amendment-role-swap` returns one empty value-free quarantine.
6. `identical-archives` returns one empty value-free quarantine.

## Exact nonclaims

The exact ordered nonclaims are:

1. `docker_daemon_host_kernel_runtime_or_container_id_authenticity`
2. `worker_binary_runtime_image_registry_supply_chain_or_attestation_beyond_reviewed_digests`
3. `fresh_semantic_computation_nonce_challenge_or_cache_absence_inside_worker`
4. `ephemeral_signer_external_identity_kms_hsm_custody_rotation_or_nonrepudiation`
5. `true_organizational_operator_key_host_or_failure_domain_independence`
6. `general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness`
7. `real_public_filing_bytes_sec_source_authenticity_or_attestation`
8. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
9. `counsel_identity_legal_validity_revocation_freshness_or_data_rights`
10. `independently_adjudicated_ground_truth_or_two_thousand_assertions`
11. `precision_recall_document_success_thresholds_or_zero_silent_failures`
12. `general_alias_unit_conversion_dimension_fiscal_calendar_or_amendment_coverage`
13. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
14. `multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo`
15. `database_api_web_queue_persistence_evidence_passport_or_b15_v15`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## Promotion boundary

The frozen baseline is `1cb7d3ce024cbd29665af7ec4e010da0c380b726`.
Promotion requires one exact single-parent child with an exact parent line
`<source> 1cb7d3ce024cbd29665af7ec4e010da0c380b726`. The source SHA, transition
inventory, local verification counts, exact-source CI runs/jobs, dedicated v3
run/job, artifact identity and size, ZIP digest, canonical evidence digest,
source-hash count, and offline-review verdict are Pending. No live anchor may be
recorded before the exact-source success-only artifact is retained,
independently inspected, and verified offline.

Cycle 2l's canonical v2 artifact and exact anchors remain immutable promoted
history. Cycle 2k's canonical v1 artifact and exact anchors remain immutable
historical execution facts whose security conclusion is Superseded. Failed-run
records remain non-evidence. Cycle 2m v3 must be additive and cannot rewrite,
substitute for, or relabel either schema's historical evidence.

Quality composition is deferred because a metric boundary must not consume an
execution result until repository-owned lifecycle freshness, cleanup, and
invocation binding are established. Cycle 2b cannot be manufactured from
synthetic manifests, authority keys, approvals, clocks, signatures, or asserted
human review; its exact external inventory and authority package remain a
separate Blocked gate.
