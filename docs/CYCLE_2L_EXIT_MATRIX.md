# Cycle 2l exit matrix

Scope: harden the existing disconnected bounded cross-engine agreement boundary
so agreement is possible only when both child normalization receipts and every
fact bind to the current invocation's exact owned synthetic original/amendment
archives and correct document roles. Recompute pair and execution bindings,
validate the fixed 20-fact partition and reciprocal ten-edge lineage, and
retain one atomic empty value-free quarantine for every failure. The decision
is recorded in
[ADR 0039](./adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md).

Current status: **Pass only for exact source commit
`2e3a7e33a76d19b993375958aff671707a81ef05`, the exact single-parent corrective
child of failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f`
from baseline `b9b7dd19996f0c5bb1e073ab5522c42e06dee397`.** The exact transition
contains two commits, two first-parent commits, and 23 paths; the corrective
commit contains 14 paths. Local verification, exact-source CI, the dedicated
v2 artifact, and independent 66-of-66 offline review passed. Cycle 2b,
independent real quality, full Cycle 2 exit, real-data admission, and production
admission remain Blocked.

| Gate                             | Required result                                                                                                                                                                                                                                | Current status                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Exact current inputs             | One owned synthetic original archive and one amendment archive are intrinsically snapshotted; their current-invocation SHA-256 values define the only accepted child input pair                                                                | Pass                           |
| Current child-receipt binding    | Both child results bind their handoff receipts and all normalized facts to those exact current archive hashes and the correct original/amendment document roles                                                                                | Pass                           |
| Recomputed pair binding          | The host recomputes each child handoff pair binding from current archive hashes, document hashes, the configured image, and receipt-declared key/public-key context and rejects every supplied mismatch                                        | Pass                           |
| Recomputed execution binding     | The host recomputes each child execution binding from the verified pair binding and supplied execution context and rejects stale or internally inconsistent supplied bindings                                                                  | Pass                           |
| Fixed fact partition             | Exactly 20 facts appear as ten original facts followed by ten amendment facts in frozen launch-key order; each key retains its fixed concept, unit, period, and role context                                                                   | Pass                           |
| Reciprocal lineage               | Exactly ten per-key edges connect matching original/amendment endpoints with reciprocal predecessor/successor pointers and the same amendment effective time                                                                                   | Pass                           |
| Chronology, periods, and values  | Accepted time precedes available time; lineage windows are half-open; duration start precedes end; all facts share one period end and duration facts share one start across roles; decimals are canonical; changed/unchanged values both exist | Pass                           |
| Accession context                | Each accession's two-digit year matches its accepted-at year, and the original and amendment accessions carry the same ten-digit issuer segment                                                                                                | Pass                           |
| Exact engine agreement           | Only two completely validated archive-bound child results with byte-exact equal normalization records may agree; digest, subset, repair, coercion, or semantic equivalence is insufficient                                                     | Pass                           |
| Atomic result                    | Success exposes one immutable bounded agreement result; any input, receipt, binding, role, fact, lineage, chronology, value, engine, or comparison failure returns one empty value-free quarantine                                             | Pass                           |
| Six-case live matrix             | One exact archive-bound pair agrees; cached replay, identical common-mode lineage mutation, cross-engine normalization mismatch, archive tamper, and role swap each quarantine                                                                 | Pass: 1 agreed / 5 quarantined |
| Local integration                | Format, lint, guardrails, dependency policy, typechecks, security/unit suites, tests, and builds pass on the exact corrective-child bytes                                                                                                      | Pass: full verify; 51 tests    |
| Exact-source CI                  | Required Ubuntu/Windows and dedicated cross-engine workflows pass on the corrective child and exact two-commit chain without source-transition drift                                                                                           | Pass: run `33013464811`        |
| Dedicated v2 evidence            | A success-only retained canonical v2 artifact binds the exact source transition, current-input receipts, six live cases, ordered checks, ordered nonclaims, images, sources, and workflow identity                                             | Pass: artifact `9623531283`    |
| Independent offline review       | Independently supplied repository, revision, run, attempt, artifact, and evidence-digest anchors return offline-consistent for every frozen source hash                                                                                        | Pass: 66 of 66                 |
| Historical evidence immutability | Cycle 2k's exact v1 anchors remain unchanged; Cycle 2l failed precursor and failed-run records remain immutable non-evidence and cannot be relabeled as promotion evidence                                                                     | Pass: history preserved        |
| Cycle 2b authority               | Exact external inventory, rights/steward approvals, chronology, authority keys, and human review pass before real bytes                                                                                                                        | Blocked; outside Cycle 2l      |
| Independent real quality         | Representative real filings and 2,000 independently adjudicated assertions pass frozen thresholds with zero silent critical failures                                                                                                           | Blocked; deferred              |
| Production admission             | Real-data rights, source/fetch, persistence, security, privacy, scale, and operational gates pass                                                                                                                                              | Blocked                        |

## Target claim and exact checks

The sole bounded target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`.
It is accepted only for exact corrective source
`2e3a7e33a76d19b993375958aff671707a81ef05`, whose parent is failed precursor
`67af24176df3c17fd6d54498095888c9a43ebe1f`, itself the exact single-parent
child of baseline `b9b7dd19996f0c5bb1e073ab5522c42e06dee397`, and the complete
evidence record below.

The exact ordered checks are:

1. `exact_two_owned_synthetic_archives_in_fixed_original_and_amendment_roles`
2. `intrinsic_bounded_owned_archive_configuration_and_child_receipt_snapshots`
3. `exact_cycle2j_success_receipt_schema_claim_and_provenance_constraint`
4. `supplied_archive_sha256_bound_to_every_original_and_amendment_role_fact`
5. `top_level_document_sha256_bound_to_every_original_and_amendment_role_fact`
6. `recomputed_handoff_pair_binding_from_archives_documents_image_key_and_public_key`
7. `recomputed_execution_binding_from_handoff_image_key_and_documents`
8. `exact_twenty_fact_original_then_amendment_fixed_key_role_partition`
9. `per_key_reciprocal_predecessor_successor_and_half_open_known_window`
10. `lineage_key_endpoint_and_effective_time_reciprocity`
11. `role_metadata_chronology_context_and_changed_unchanged_invariants`
12. `byte_exact_cross_engine_normalization_agreement_only_after_child_validation`
13. `atomic_archive_bound_agreement_or_single_empty_value_free_quarantine`
14. `cached_replay_rebound_binding_role_lineage_mutation_and_abort_coverage`
15. `success_only_exact_two_commit_failed_precursor_corrective_transition_v2_workflow_artifact_and_offline_review`
16. `v1_evidence_v2_failed_precursor_and_failed_run_immutability_and_no_quality_real_data_or_production_widening`

## Required v2 live outcomes

The v2 acceptance record must contain exactly six bounded outcomes:

1. The exact current original/amendment archive pair produces one agreement,
   and exact replay of that pair is retained as deterministic confirmation.
2. Cached genuine child receipts replayed under different supplied archives
   produce one empty value-free quarantine.
3. The same common-mode lineage mutation applied to both child results produces
   one empty value-free quarantine.
4. A cross-engine normalization mismatch produces one empty value-free
   quarantine.
5. Original-archive tamper produces one empty value-free quarantine.
6. Original/amendment role swap produces one empty value-free quarantine.

## Exact nonclaims

The exact ordered nonclaims are:

1. `injected_child_boundary_factory_runner_signer_receipt_authenticity_or_fresh_execution`
2. `true_organizational_operator_key_host_or_failure_domain_independence`
3. `general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness`
4. `fact_id_preimage_authenticity_beyond_the_constrained_child_receipt`
5. `real_public_filing_bytes_sec_source_authenticity_or_attestation`
6. `cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission`
7. `counsel_identity_legal_validity_revocation_freshness_or_data_rights`
8. `independently_adjudicated_ground_truth_or_two_thousand_assertions`
9. `precision_recall_document_success_thresholds_or_zero_silent_failures`
10. `general_alias_unit_conversion_dimension_or_fiscal_calendar_coverage`
11. `real_amendment_completeness_correction_discovery_or_sec_restated_status`
12. `edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety`
13. `production_signer_kms_hsm_custody_rotation_or_nonrepudiation`
14. `multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo`
15. `database_api_web_queue_persistence_evidence_passport_or_b15_v15`
16. `real_data_admission_full_cycle2_exit_or_production_use`

## Promotion record

Exact source `2e3a7e33a76d19b993375958aff671707a81ef05` is the failed precursor's
exact single-parent corrective child. The complete chain has exactly two commits
and two first-parent commits with exact parent lines
`2e3a7e33a76d19b993375958aff671707a81ef05 67af24176df3c17fd6d54498095888c9a43ebe1f`
and
`67af24176df3c17fd6d54498095888c9a43ebe1f b9b7dd19996f0c5bb1e073ab5522c42e06dee397`.
The cumulative transition contains 23 paths, and the corrective commit contains
14 paths. Full local `pnpm verify` passed, including 51 acceptance tests.
Exact-source CI run `33013464811` passed Ubuntu job `98325467206` and Windows
job `98325467249`. Dedicated run/job `33013464847` / `98325467722` succeeded and
retained artifact `9623531283`, named
`filing-parser-cross-engine-execution-evidence-v2-2e3a7e33a76d19b993375958aff671707a81ef05-1`,
size 7,581 bytes. The downloaded ZIP digest is
`sha256:bfd3eb2fabdba8b533cbbcd488fe9decd19f47cd4d73c408ac824a87717aaed8`;
the canonical evidence digest is
`sha256:c1d4d7c6c77bd5aa0a9a0af5de08fbbf3b823744b9cba47e3a59283dfd41f6d8`.
The record binds 66 source hashes, the exact 23-path transition, 16 ordered
checks, 16 ordered nonclaims, and six outcomes (one agreed and five
quarantined). Independently anchored offline review returned
`offline_consistent` for 66 of 66 source hashes.

## Failed precursor record

Failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f` remains immutable
non-evidence. Dedicated Cycle 2l run/job `33011584084` / `98318943081` failed at
`evidence_validation_transition` before artifact retention. Custody run/job
`33011584059` / `98318941993` and parser-isolation run/job `33011584060` /
`98318941736` failed at `commit_boundary` and are regression non-evidence. All
three failed runs retained zero artifacts. None supplies a Cycle 2l artifact,
digest, offline-review anchor, or promotion result.

Cycle 2k's successful dedicated run `32917020041`, job `98022742591`, retained
artifact `9588542275`, ZIP digest
`sha256:35084ca18d99106e080a3f1cea48f164073b5666602e6a2ff35646cbd1b8a048`, and
canonical evidence digest
`sha256:aa45aaed5d28898fd0ea9b563792c61f5d4b908a8e2a8a4602bcb96bb9d2c965`
remain immutable historical execution facts. They cannot substitute for Cycle
2l v2 evidence or support Cycle 2k's Superseded security conclusion.

Quality composition is explicitly deferred. This bounded Cycle 2l Pass cannot
authenticate an injected child boundary or receipt, prove fresh execution,
establish true independence or real filing quality, unblock Cycle 2b, satisfy
the full Cycle 2 exit, admit real data, create B15/V15, or authorize production
use.
