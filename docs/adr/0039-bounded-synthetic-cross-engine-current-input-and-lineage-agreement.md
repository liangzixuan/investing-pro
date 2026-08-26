# ADR 0039: bounded synthetic cross-engine current-input and lineage agreement

Status: Accepted and promoted only for exact source commit
`2e3a7e33a76d19b993375958aff671707a81ef05`, the exact single-parent corrective
child of failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f`
from baseline `b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. The exact corrective
chain, exact-source local and workflow gates, success-only retained v2 live
artifact, independent artifact inspection, and independently anchored
offline-consistent review passed. Cycle 2b, independent real quality, real-data
admission, and production remain Blocked.

## Context

Cycle 2k retained a canonical v1 record showing two pinned worker
implementations producing byte-exact equal complete documents and normalization
records for one owned synthetic original/amendment pair. Its exact source,
workflow, run, job, artifact, digests, source hashes, checks, nonclaims, and
offline review remain immutable historical execution facts.

Later review found two P1 agreement gaps. First, the outer boundary hashed the
current supplied archives for outward provenance but trusted structurally valid
child normalization and execution receipts. Cached genuine child results for an
unrelated archive pair could therefore agree while the facts and child receipts
remained bound to stale archives. Second, lineage validation checked bounded
shape, keys, and endpoint existence but not the complete reciprocal relation.
The same malformed lineage in both child results could pass byte-exact
cross-engine agreement. These findings Supersede Cycle 2k's security conclusion
and claim without altering its historical evidence bytes.

This repository-controlled milestone closes only those binding and lineage
gaps. It does not add quality composition, a real corpus, external authority,
or a new production trust boundary.

The first source attempt is preserved as failed precursor
`67af24176df3c17fd6d54498095888c9a43ebe1f`, the exact single-parent child of
baseline `b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. Dedicated Cycle 2l run/job
`33011584084` / `98318943081` failed at `evidence_validation_transition` before
artifact retention. Custody run/job `33011584059` / `98318941993` and
parser-isolation run/job `33011584060` / `98318941736` failed at
`commit_boundary` and are regression non-evidence. All three failed runs
retained zero artifacts and supply no Cycle 2l evidence or promotion anchor.

## Decision

Harden the existing private disconnected cross-engine boundary and dedicated
success-only acceptance domain. The boundary continues to accept exactly one
owned synthetic original archive and one amendment archive, configured image
expectations, receipt-declared key context, and two injected child engine
boundaries. Every public byte carrier must still be intrinsically validated,
bounded, and snapshotted before use.

Treat every child success as untrusted. Compute the current original and
amendment archive SHA-256 values before invoking either child. A child may reach
comparison only when its complete handoff and execution receipt structure binds
to those exact current hashes, the correct original/amendment documents, the
configured image, and the receipt-declared key and public-key context. Recompute
the canonical handoff pair binding and execution binding at the outer boundary
and reject any supplied value that differs. Internal consistency does not
authenticate an injected receipt or prove fresh execution.

Require every normalized fact to bind to its role's current archive hash and
top-level document hash. The complete record contains exactly 20 facts: the ten
frozen launch keys in original role followed by the same ten keys in amendment
role. Concept, unit, period, dimensions, role, and source context are fixed for
each key. Decimal strings must be canonical. Source accepted time must strictly
precede source available time. Every duration start must strictly precede its
end; all facts across both roles must share one period end and all duration
facts must share one duration start. Each accession's two-digit year segment
must match its accepted-at year, and the original and amendment accessions must
carry the same ten-digit issuer segment.

For each frozen key, require one original-to-amendment lineage relation. The
original fact's successor must name the matching amendment fact, the amendment
fact's predecessor must name the matching original fact, and the single edge
must name the same key, endpoints, and amendment effective time. The original
known window ends exactly when the amendment window begins. The ten facts yield
exactly ten reciprocal edges. The pair must include at least one changed value
and at least one unchanged value so an all-change or no-change mutation cannot
satisfy the bounded fixture contract.

Only after both child results independently pass all current-input, receipt,
fact, partition, chronology, value, and lineage checks may their complete
canonical normalization bytes be compared. Agreement requires byte-exact
equality. Any malformed input, stale or internally inconsistent binding, wrong
role, fact or lineage mutation, child failure, or cross-engine mismatch returns
one atomic, empty, value-free `agreement_quarantined` result with no partial
record or mismatch details.

The sole target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`.
It is accepted only for exact corrective source
`2e3a7e33a76d19b993375958aff671707a81ef05`, the complete promotion record
below, and its exact two-commit, two-first-parent chain through failed precursor
`67af24176df3c17fd6d54498095888c9a43ebe1f` from baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`.

## Required checks

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

## Evidence and promotion boundary

The v2 acceptance workflow must record exactly six bounded outcomes: one exact
current archive-bound agreed pair and five empty value-free quarantines for
cached genuine child receipts replayed under different archives, an identical
common-mode lineage mutation in both child results, a cross-engine normalization
mismatch, original-archive tamper, and original/amendment role swap. Exact
replay of the successful pair remains deterministic confirmation inside the
agreed case.

Exact source `2e3a7e33a76d19b993375958aff671707a81ef05` completes one exact
two-commit, two-first-parent transition from baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397` through failed precursor
`67af24176df3c17fd6d54498095888c9a43ebe1f`. The exact parent lines are
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
The artifact binds 66 source hashes, the exact 23-path transition, 16 ordered
checks, 16 ordered nonclaims, and six cases producing one agreed and five
quarantined outcomes. Independently anchored offline review returned
`offline_consistent` for 66 of 66 source hashes.

The failed precursor and its three zero-artifact failed workflow runs remain
immutable non-evidence. Cycle 2k's v1 artifact and anchors remain immutable
historical facts and cannot be relabeled as Cycle 2l evidence.

## Consequences

This bounded Pass establishes only that the bounded synthetic cross-engine
boundary rejected stale child results, internally inconsistent binding context,
wrong roles, and common-mode lineage mutations before accepting byte-exact
agreement for the one reviewed pair. It does not authenticate the injected
cross-engine boundary or child receipt, prove that every injected child result
came from a fresh engine execution, or establish organizational, operator, key,
host, or failure-domain independence.

Quality composition is deferred. This milestone cannot establish general
parser or accounting correctness, representative real filings, SEC/source
authenticity, Cycle 2b authority, independently adjudicated ground truth,
precision/recall thresholds, B15/V15, full Cycle 2 exit, real-data admission, or
production readiness.

## References

- [Cycle 2l exit matrix](../CYCLE_2L_EXIT_MATRIX.md)
- [ADR 0038](./0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
- [Cycle 2k exit matrix](../CYCLE_2K_EXIT_MATRIX.md)
- [ADR 0037](./0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
- [ADR 0036](./0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
- [Cycle 2b exit matrix](../CYCLE_2B_EXIT_MATRIX.md)
