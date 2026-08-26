# ADR 0038: bounded synthetic cross-engine parser execution agreement

Status: proposed and Pending exact diagnostic recovery from baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`. Source precursor
`14b4ecf41806dca7759a06bebf7ef8da96374f76` is its exact single-parent direct child, but
dedicated run `32910394736` attempt 1 failed closed at `image_inspection`: the
inherited Python image ends in `/worker`, while the shared inspector applied
the Node image's `/input` expectation to both roles. The run retained no
artifact and has no offline-review verdict. Failed corrective revision
`061944f8f770e8a08b2a38d1e2fedf8b8e2de348` is its exact single-parent direct
child. Dedicated run `32912204603` attempt 1 completed live Docker execution
and every residue phase, then failed closed at `evidence_assembly` because the
runner hashed a 62-path static list instead of the required 66-path
source-transition union. That run also retained no artifact and has no
offline-review verdict. Failed recovery revision
`f29e39cea40e76d500df833fd8e0e94e0c86a68c` is its exact single-parent direct
child. Dedicated run `32913611954` attempt 1, job `98012515052`, completed live
Docker execution and every residue phase, then failed closed at
`evidence_assembly`. Its offline review and upload were skipped, it retained
zero artifacts, and it is non-evidence. Failed diagnostic revision
`abd65313705282dab8071f5d36c78d31b1720ee3` is the failed recovery revision's
exact single-parent direct child. Dedicated run `32915949116` attempt 1, job
`98019592738`, completed live Docker execution and every residue phase, then
failed closed at `evidence_validation_transition`. Its offline review and upload
were skipped, it retained zero artifacts, and it is non-evidence. One exact
diagnostic recovery child and all successful gates remain required. This ADR
records no promoted claim. Cycle 2b, full Cycle 2
quality, real-data admission, and production admission remain Blocked.

## Context

Promoted Cycle 2j executes the owned synthetic original and amendment archives
through one digest-pinned Python worker and delegates its complete signed
documents to the unchanged Cycle 2i normalization handoff. Historical Cycle 2e
compares two declared same-process document roles, but it does not execute a
second engine or establish actual validator independence. Neither historical
result may be widened or relabeled as cross-engine evidence.

The next repository-controlled gap is narrower than true independent
validation: execute the same two owned synthetic archives through the existing
Cycle 2j Python worker and one distinct zero-install pinned Node worker, require
exact live document and complete normalization-record agreement, and quarantine
every disagreement atomically. Separate language, source inventory, image, and
process identities reduce one common-implementation risk but cannot establish
organizational, operator, key, host, or failure-domain independence.

## Proposed decision

Add one private, disconnected cross-engine boundary and one dedicated
success-only live acceptance domain. The boundary accepts exactly one owned
synthetic original archive and one owned synthetic amendment archive, strict
expected image and key inputs, an outside-worker signer, and bounded process
runners. It takes intrinsic owned snapshots of every public byte carrier before
use.

For each fixed archive role, the boundary executes both the existing Cycle 2j
Python worker and a separately reviewed zero-install Node worker. The workers
must have distinct exact source inventories and distinct pinned image digests.
Each execution uses a fresh numeric-nonroot container with no network, dropped
capabilities, no privileges, exactly one read-only archive input, no signing
key, and fixed CPU, memory, swap, PID, nofile, tmpfs, stream, control, and
wall-clock limits.

Both workers separately enforce the closed archive and ten-fact document
protocol. Each must exit zero, emit empty stderr, and emit exactly one bounded
canonical complete Cycle 2d document to stdout with no framing or trailing
bytes. For the original role and again for the amendment role, the captured
Python and Node stdout document bytes must be byte-exact equal. Digest, field
subset, fact-count, reordered, repaired, or semantically equivalent agreement
is insufficient.

The host recomputes archive digests, validates all four worker documents, and
creates signed envelopes outside the workers. Each engine's exact
original/amendment pair delegates without defaulting, inference, repair,
synthesis, or semantic remapping to the unchanged Cycle 2i/Cycle 2d
normalization path. Both complete canonical normalization-record byte strings
must be byte-exact equal. Engine-specific execution provenance remains separate
from the compared normalization record and must bind both image and source
identities without being treated as semantic agreement.

Success returns one immutable agreement result containing the single agreed
normalization record and bounded aggregate execution provenance. Any input,
engine, image, process, stdout, stderr, document, archive, signature, role,
normalization, comparison, mutation, timeout, abort, cleanup, or downstream
failure returns one empty value-free `agreement_quarantined` result. Quarantine
must expose no fact values, raw bytes, hashes, image or key identifiers,
provenance, mismatch details, or canary content.

The sole proposed target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`.
It may be accepted only for one exact diagnostic recovery child of failed
diagnostic revision `abd65313705282dab8071f5d36c78d31b1720ee3`, whose sole
parent is failed recovery revision `f29e39cea40e76d500df833fd8e0e94e0c86a68c`, whose sole parent is failed
corrective revision `061944f8f770e8a08b2a38d1e2fedf8b8e2de348`, whose sole parent is failed
precursor `14b4ecf41806dca7759a06bebf7ef8da96374f76`, whose sole parent is baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, and the complete evidence anchors
defined below.

## Required checks

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
15. `success_only_exact_five_commit_diagnostic_recovery_transition_two_image_case_source_artifact_and_offline_review`
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

## Evidence and promotion boundary

The proposal begins from exact baseline
`962a00f65835fc6126e4da98e0e0d5998e8d59cc`, continues through failed precursor
`14b4ecf41806dca7759a06bebf7ef8da96374f76` and failed corrective revision
`061944f8f770e8a08b2a38d1e2fedf8b8e2de348` and failed recovery revision
`f29e39cea40e76d500df833fd8e0e94e0c86a68c` and failed diagnostic revision
`abd65313705282dab8071f5d36c78d31b1720ee3`, and may end only at one exact
diagnostic recovery child. Before any promotion, all five exact single-parent
lines, the
exact five-commit and first-parent counts, and the cumulative baseline-to-
recovery path/status inventory must be frozen. No successful recovery revision
is claimed while this ADR is Pending. Failed runs `32910394736`, `32912204603`,
`32913611954`, and `32915949116`, each attempt 1, retained zero artifacts and
have no offline-review verdict. The third and fourth runs' offline review and
upload were skipped; the fourth failed at `evidence_validation_transition`.
They are non-evidence and cannot be substituted for the required successful
artifact.

The frozen recovery revision must pass formatting, lint, every guardrail, dependency
and peer policy, all project typechecks and tests, both worker-specific test
suites, and all builds. The same exact recovery source commit must pass Ubuntu and
Windows CI and the required historical parser, custody, PostgreSQL, and Cycle
2j live regression workflows. Those runs remain regression health only; none is
Cycle 2k execution evidence.

A separately authorized dedicated Ubuntu real-Docker workflow must execute the
success and exact replay paths plus normalization-mismatch, original-archive-
tamper, and original/amendment-role-swap quarantines. Before those live cases,
the workflow must pass the exact-source Python and Node worker suites and the
cross-engine unit/security suites covering stdout mismatch, substitution,
partial or extra output, duplicate output, mutation, timeout, abort, process
failure, and cleanup failure. These source-suite cases are required coverage,
not additional live evidence outcomes. The workflow may retain one canonical
success-only artifact only after every exact check passes. A failed or cancelled
run, source drift, missing or equal engine identity, unpinned image, output
disagreement, partial success, cleanup ambiguity, residue, or non-value-free
quarantine must retain no candidate artifact and must prevent promotion.

The versioned evidence record must bind the exact repository, baseline, failed
precursor, failed corrective revision, failed recovery revision, failed
diagnostic revision, diagnostic recovery revision, cumulative transition inventory,
workflow/run/job/attempt, artifact
identity and digest, both built image digests, both exact worker source
inventories and hashes, fixture manifest and archive hashes, tool versions,
container counts, canonical cases and outcomes, exact checks, exact nonclaims,
and every Cycle 2k source hash. An offline verifier must require independently
supplied repository, revision, run, attempt, artifact, and canonical evidence
digest anchors and return `offline_consistent` only after all internal bindings
and frozen source hashes agree.

`offline_consistent` would establish internal offline consistency only. It
cannot authenticate GitHub, artifact custody, Docker, the host, the worker
authors or operators, supplied trust anchors, source or image authority, SEC
data, accounting truth, or engine independence.

Cycle 2a, Cycle 2c, Cycle 2d, Cycle 2i, and Cycle 2j evidence records, schemas,
checks, nonclaims, source sets, artifacts, and historical anchors must remain
byte-exact and immutable. This successor may add its own evidence domain and
may use historical workflows only as regressions; it must not mutate, replace,
reinterpret, or widen a historical result.

## Consequences

If promoted on exact future source and evidence anchors, Cycle 2k would
establish only that two distinct pinned worker implementations produced
byte-exact equal complete ten-fact stdout documents and byte-exact equal
complete normalization records for the one reviewed owned synthetic
original/amendment pair under the bounded live gate.

It would not establish true organizational, operator, key, host, or
failure-domain independence; general parser, XBRL/iXBRL, taxonomy, plugin, or
accounting correctness; real filing or SEC/source authenticity; Cycle 2b
authority; independently adjudicated ground truth or quality; real-data
admission; full Cycle 2 exit; B15/V15 composition; or production readiness.
Cycle 2b and the full Cycle 2 quality gate remain externally blocked.

## References

- [Cycle 2k exit matrix](../CYCLE_2K_EXIT_MATRIX.md)
- [ADR 0037](./0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
- [ADR 0036](./0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
- [ADR 0032](./0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
- [Cycle 2j exit matrix](../CYCLE_2J_EXIT_MATRIX.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
