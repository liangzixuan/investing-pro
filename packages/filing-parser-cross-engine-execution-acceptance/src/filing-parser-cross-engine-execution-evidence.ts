import { createHash } from "node:crypto";

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VERSION = 1 as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE =
  "962a00f65835fc6126e4da98e0e0d5998e8d59cc" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION =
  "14b4ecf41806dca7759a06bebf7ef8da96374f76" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION =
  "061944f8f770e8a08b2a38d1e2fedf8b8e2de348" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION =
  "f29e39cea40e76d500df833fd8e0e94e0c86a68c" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION =
  "abd65313705282dab8071f5d36c78d31b1720ee3" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM =
  "bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW =
  "Filing parser cross-engine execution acceptance" as const;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS =
  Object.freeze([
    "exact_owned_synthetic_original_and_amendment_pair_in_fixed_python_and_node_roles",
    "intrinsic_bounded_owned_archive_configuration_signer_and_process_output_snapshots",
    "distinct_reviewed_pinned_python_and_zero_install_node_worker_sources_and_images",
    "fresh_nonroot_capability_dropped_network_none_read_only_container_per_engine_and_archive",
    "fixed_cpu_memory_pids_nofile_tmpfs_stdout_stderr_control_and_wall_clock_limits",
    "closed_archive_and_document_protocol_separately_enforced_by_both_engines",
    "canonical_single_complete_ten_fact_stdout_document_per_engine_and_role",
    "byte_exact_python_node_live_stdout_document_agreement_per_archive_role",
    "host_recomputed_archive_sha256_and_exact_engine_document_binding",
    "outside_worker_signing_and_unchanged_normalization_delegation_per_engine_pair",
    "byte_exact_complete_normalization_record_agreement_without_subset_or_digest_substitution",
    "atomic_cross_engine_agreement_or_single_empty_value_free_quarantine",
    "engine_role_mismatch_timeout_abort_process_and_cleanup_failure_quarantine",
    "swap_substitution_tamper_partial_extra_duplicate_mutation_and_replay_coverage",
    "success_only_exact_five_commit_diagnostic_recovery_transition_two_image_case_source_artifact_and_offline_review",
    "historical_evidence_immutability_and_no_fetch_custody_database_api_web_queue_or_real_data",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN =
  Object.freeze([
    "true_organizational_operator_key_host_or_failure_domain_independence",
    "general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness",
    "real_public_filing_bytes_sec_source_authenticity_or_attestation",
    "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
    "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
    "independently_adjudicated_ground_truth_or_two_thousand_assertions",
    "precision_recall_document_success_thresholds_or_zero_silent_failures",
    "general_alias_unit_conversion_dimension_or_fiscal_calendar_coverage",
    "real_amendment_completeness_correction_discovery_or_sec_restated_status",
    "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
    "production_signer_kms_hsm_custody_rotation_or_nonrepudiation",
    "production_payload_retention_backup_delete_or_cryptographic_erasure",
    "multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo",
    "database_api_web_queue_persistence_evidence_passport_or_b15_v15",
    "production_identity_secrets_host_kernel_daemon_or_incident_recovery",
    "real_data_admission_full_cycle2_exit_or_production_use",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SOURCE_PATHS =
  Object.freeze([
    ".github/workflows/ci.yml",
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "LICENSE_POLICY.md",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "docs/BUILD_ROADMAP.md",
    "docs/CANONICAL_MODEL.md",
    "docs/CYCLE_2K_EXIT_MATRIX.md",
    "docs/THREAT_MODEL.md",
    "docs/adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v1/cases.json",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v1/manifest.json",
    "fixtures/synthetic/filing-parser-normalization-execution/v1/cases.json",
    "fixtures/synthetic/filing-parser-normalization-execution/v1/manifest.json",
    "package.json",
    "packages/filing-fact-normalization/package.json",
    "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
    "packages/filing-fact-normalization/src/index.ts",
    "packages/filing-parser-normalization-handoff/package.json",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.ts",
    "packages/filing-parser-normalization-handoff/src/index.ts",
    "packages/filing-parser-normalization-execution/package.json",
    "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.ts",
    "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution-security.test.ts",
    "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.test.ts",
    "packages/filing-parser-normalization-execution/src/index.ts",
    "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
    "packages/filing-parser-normalization-execution/worker/Dockerfile",
    "packages/filing-parser-normalization-execution/worker/parser.py",
    "packages/filing-parser-normalization-execution/worker/parser_test.py",
    "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
    "packages/filing-parser-cross-engine-execution/package.json",
    "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
    "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
    "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution-security.test.ts",
    "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.test.ts",
    "packages/filing-parser-cross-engine-execution/src/index.ts",
    "packages/filing-parser-cross-engine-execution/src/test-cross-engine-execution-builder.ts",
    "packages/filing-parser-cross-engine-execution/tsconfig.json",
    "packages/filing-parser-cross-engine-execution/worker/Dockerfile",
    "packages/filing-parser-cross-engine-execution/worker/parser.mjs",
    "packages/filing-parser-cross-engine-execution/worker/parser.test.mjs",
    "packages/filing-parser-cross-engine-execution/worker/taxonomy-v1.json",
    "packages/filing-parser-cross-engine-execution-acceptance/package.json",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.test.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.test.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/index.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.test.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-evidence-review.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/src/test-filing-parser-cross-engine-execution-evidence-builder.ts",
    "packages/filing-parser-cross-engine-execution-acceptance/tsconfig.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/verify-boundaries.ts",
    "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
    "tsconfig.base.json",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS = Object.freeze({
  node: Object.freeze([
    "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
    "packages/filing-parser-cross-engine-execution/worker/Dockerfile",
    "packages/filing-parser-cross-engine-execution/worker/parser.mjs",
    "packages/filing-parser-cross-engine-execution/worker/taxonomy-v1.json",
  ] as const),
  python: Object.freeze([
    "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    "packages/filing-parser-normalization-execution/worker/Dockerfile",
    "packages/filing-parser-normalization-execution/worker/parser.py",
    "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
  ] as const),
});

export interface FilingParserCrossEngineExecutionEvidenceSourceHash {
  readonly path: string;
  readonly sha256: `sha256:${string}`;
}

export interface FilingParserCrossEngineExecutionEvidenceTransitionEntry {
  readonly path: string;
  readonly status: "A" | "M";
}

export interface FilingParserCrossEngineExecutionEvidenceEngine {
  readonly architecture: "amd64";
  readonly baseIndexDigest: `sha256:${string}`;
  readonly basePlatformManifestDigest: `sha256:${string}`;
  readonly builtImageId: `sha256:${string}`;
  readonly engineId: string;
  readonly implementationSha256: `sha256:${string}`;
  readonly implementationSourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
  readonly operatingSystem: "linux";
  readonly role: "node-secondary" | "python-primary";
  readonly runtimeVersion: string;
}

export interface FilingParserCrossEngineExecutionEvidenceCaseOutcome {
  readonly amendmentArchiveSha256: `sha256:${string}` | null;
  readonly agreementSha256: `sha256:${string}` | null;
  readonly caseId:
    | "cross-engine-normalization-mismatch"
    | "exact-original-amendment-cross-engine-pair"
    | "original-amendment-role-swap"
    | "original-archive-tamper";
  readonly expectedStatus: "agreed" | "quarantined";
  readonly factVersionCount: 20 | null;
  readonly lineageCount: 10 | null;
  readonly nodeAmendmentStdoutSha256: `sha256:${string}` | null;
  readonly nodeExecutionBindingSha256: `sha256:${string}` | null;
  readonly nodeOriginalStdoutSha256: `sha256:${string}` | null;
  readonly normalizationSha256: `sha256:${string}` | null;
  readonly observedStatus: "agreed" | "quarantined";
  readonly originalArchiveSha256: `sha256:${string}` | null;
  readonly pythonAmendmentStdoutSha256: `sha256:${string}` | null;
  readonly pythonExecutionBindingSha256: `sha256:${string}` | null;
  readonly pythonOriginalStdoutSha256: `sha256:${string}` | null;
  readonly replayMatched: boolean;
  readonly resultSha256: `sha256:${string}` | null;
}

export interface FilingParserCrossEngineExecutionEvidence {
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE;
  readonly caseOutcomes: readonly FilingParserCrossEngineExecutionEvidenceCaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS;
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM;
  readonly completedAt: string;
  readonly engines: readonly [
    FilingParserCrossEngineExecutionEvidenceEngine,
    FilingParserCrossEngineExecutionEvidenceEngine,
  ];
  readonly evidenceVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VERSION;
  readonly failedCorrectiveRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION;
  readonly failedDiagnosticRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION;
  readonly failedPrecursorRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION;
  readonly failedRecoveryRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION;
  readonly fixtureManifestSha256: `sha256:${string}`;
  readonly notProven: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly auditedContainerCount: number;
    readonly capabilitiesDropped: readonly ["ALL"];
    readonly containerControlMilliseconds: 5_000;
    readonly containerUser: "65532:65532";
    readonly cpuCount: 0.5;
    readonly engineCount: 2;
    readonly inputMount: "/input/filing.zip:ro";
    readonly memoryBytes: 134_217_728;
    readonly networkMode: "none";
    readonly noNewPrivileges: true;
    readonly noPublishedPorts: true;
    readonly openFiles: 64;
    readonly pids: 32;
    readonly processTerminationMilliseconds: 250;
    readonly productionContainerCount: number;
    readonly readOnlyRootFilesystem: true;
    readonly signerMilliseconds: 5_000;
    readonly stderrLimitBytes: 4_096;
    readonly stdoutLimitBytes: 262_144;
    readonly successfulPairContainerCount: 4;
    readonly temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608";
    readonly wallClockMilliseconds: 5_000;
    readonly zeroResidue: true;
  };
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly agreed: 1;
    readonly quarantined: 3;
    readonly replayMatched: true;
    readonly total: 4;
  };
  readonly synthetic: true;
  readonly tools: {
    readonly dockerClient: string;
    readonly dockerServer: string;
    readonly git: string;
    readonly node: string;
    readonly pnpm: string;
    readonly python: string;
  };
  readonly transition: {
    readonly entries: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[];
    readonly pathCount: number;
  };
  readonly workflow: {
    readonly artifactName: string;
    readonly event: "push" | "workflow_dispatch";
    readonly job: "acceptance";
    readonly ref: string;
    readonly runAttempt: number;
    readonly runId: string;
    readonly workflowName: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW;
  };
}

/**
 * Cycle 2l is an additive evidence protocol. The v1 constants, types and
 * functions above deliberately remain available for historical artifact
 * review; live acceptance uses this closed v2 contract.
 */
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SCHEMA_VERSION =
  "2.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VERSION =
  2 as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE =
  "b9b7dd19996f0c5bb1e073ab5522c42e06dee397" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION =
  "67af24176df3c17fd6d54498095888c9a43ebe1f" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN =
  Object.freeze({
    artifactCount: 0 as const,
    failurePhase: "evidence_validation_transition" as const,
    jobId: "98318943081" as const,
    runAttempt: 1 as const,
    runId: "33011584084" as const,
    sourceRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
  });
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CLAIM =
  "bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_WORKFLOW =
  "Filing parser cross-engine execution acceptance" as const;
const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SOURCE_PATHS =
  Object.freeze([
    ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SOURCE_PATHS,
    "fixtures/synthetic/filing-parser-cross-engine-execution/v2/cases.json",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS =
  Object.freeze([
    "exact_two_owned_synthetic_archives_in_fixed_original_and_amendment_roles",
    "intrinsic_bounded_owned_archive_configuration_and_child_receipt_snapshots",
    "exact_cycle2j_success_receipt_schema_claim_and_provenance_constraint",
    "supplied_archive_sha256_bound_to_every_original_and_amendment_role_fact",
    "top_level_document_sha256_bound_to_every_original_and_amendment_role_fact",
    "recomputed_handoff_pair_binding_from_archives_documents_image_key_and_public_key",
    "recomputed_execution_binding_from_handoff_image_key_and_documents",
    "exact_twenty_fact_original_then_amendment_fixed_key_role_partition",
    "per_key_reciprocal_predecessor_successor_and_half_open_known_window",
    "lineage_key_endpoint_and_effective_time_reciprocity",
    "role_metadata_chronology_context_and_changed_unchanged_invariants",
    "byte_exact_cross_engine_normalization_agreement_only_after_child_validation",
    "atomic_archive_bound_agreement_or_single_empty_value_free_quarantine",
    "cached_replay_rebound_binding_role_lineage_mutation_and_abort_coverage",
    "success_only_exact_two_commit_failed_precursor_corrective_transition_v2_workflow_artifact_and_offline_review",
    "v1_evidence_v2_failed_precursor_and_failed_run_immutability_and_no_quality_real_data_or_production_widening",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN =
  Object.freeze([
    "injected_child_boundary_factory_runner_signer_receipt_authenticity_or_fresh_execution",
    "true_organizational_operator_key_host_or_failure_domain_independence",
    "general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness",
    "fact_id_preimage_authenticity_beyond_the_constrained_child_receipt",
    "real_public_filing_bytes_sec_source_authenticity_or_attestation",
    "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
    "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
    "independently_adjudicated_ground_truth_or_two_thousand_assertions",
    "precision_recall_document_success_thresholds_or_zero_silent_failures",
    "general_alias_unit_conversion_dimension_or_fiscal_calendar_coverage",
    "real_amendment_completeness_correction_discovery_or_sec_restated_status",
    "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
    "production_signer_kms_hsm_custody_rotation_or_nonrepudiation",
    "multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo",
    "database_api_web_queue_persistence_evidence_passport_or_b15_v15",
    "real_data_admission_full_cycle2_exit_or_production_use",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY =
  Object.freeze({
    artifactId: "9588542275",
    claimStatus: "superseded" as const,
    evidenceSha256:
      "sha256:aa45aaed5d28898fd0ea9b563792c61f5d4b908a8e2a8a4602bcb96bb9d2c965" as const,
    evidenceVersion: 1 as const,
    jobId: "98022742591",
    reason:
      "cross_input_child_receipt_replay_and_common_mode_lineage_reciprocity_gap" as const,
    runId: "32917020041",
    sourceRevision: "54908db1ded8193ac4ade7a3d6f38505c6b4b8e5" as const,
  });

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CASE_IDS =
  Object.freeze([
    "exact-original-amendment-cross-engine-bound-pair",
    "cached-genuine-child-receipts-under-different-archives",
    "common-mode-lineage-mutation",
    "cross-engine-normalization-mismatch",
    "original-archive-tamper",
    "original-amendment-role-swap",
  ] as const);

export type FilingParserCrossEngineExecutionEvidenceV2CaseId =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CASE_IDS)[number];

export interface FilingParserCrossEngineExecutionEvidenceV2CaseOutcome {
  readonly amendmentArchiveSha256: `sha256:${string}` | null;
  readonly amendmentDocumentSha256: `sha256:${string}` | null;
  readonly agreementSha256: `sha256:${string}` | null;
  readonly caseId: FilingParserCrossEngineExecutionEvidenceV2CaseId;
  readonly expectedStatus: "agreed" | "quarantined";
  readonly factVersionCount: 20 | null;
  readonly lineageCount: 10 | null;
  readonly nodeAmendmentStdoutSha256: `sha256:${string}` | null;
  readonly nodeExecutionBindingSha256: `sha256:${string}` | null;
  readonly nodeHandoffPairBindingSha256: `sha256:${string}` | null;
  readonly nodeKeyId: string | null;
  readonly nodeOriginalStdoutSha256: `sha256:${string}` | null;
  readonly nodePublicKeySpkiSha256: `sha256:${string}` | null;
  readonly normalizationSha256: `sha256:${string}` | null;
  readonly observedStatus: "agreed" | "quarantined";
  readonly originalArchiveSha256: `sha256:${string}` | null;
  readonly originalDocumentSha256: `sha256:${string}` | null;
  readonly pythonAmendmentStdoutSha256: `sha256:${string}` | null;
  readonly pythonExecutionBindingSha256: `sha256:${string}` | null;
  readonly pythonHandoffPairBindingSha256: `sha256:${string}` | null;
  readonly pythonKeyId: string | null;
  readonly pythonOriginalStdoutSha256: `sha256:${string}` | null;
  readonly pythonPublicKeySpkiSha256: `sha256:${string}` | null;
  readonly replayMatched: boolean;
  readonly resultSha256: `sha256:${string}` | null;
}

export interface FilingParserCrossEngineExecutionEvidenceV2 {
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE;
  readonly bindingValidation: {
    readonly childReceiptArchiveBinding: "recomputed_exact";
    readonly executionBinding: "recomputed_exact";
    readonly handoffPairBinding: "recomputed_exact";
    readonly injectedBoundaryAuthenticity: "not_established";
    readonly inputFactRoleBinding: "validated_exact";
    readonly lineageReciprocity: "validated_exact";
  };
  readonly caseOutcomes: readonly FilingParserCrossEngineExecutionEvidenceV2CaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS;
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CLAIM;
  readonly completedAt: string;
  readonly engines: FilingParserCrossEngineExecutionEvidence["engines"];
  readonly evidenceVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VERSION;
  readonly failedPrecursorRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION;
  readonly failedRun: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN;
  readonly fixtureManifestSha256: `sha256:${string}`;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly notProven: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: FilingParserCrossEngineExecutionEvidence["runtime"];
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly agreed: 1;
    readonly quarantined: 5;
    readonly replayMatched: true;
    readonly total: 6;
  };
  readonly synthetic: true;
  readonly tools: FilingParserCrossEngineExecutionEvidence["tools"];
  readonly transition: FilingParserCrossEngineExecutionEvidence["transition"];
  readonly workflow: FilingParserCrossEngineExecutionEvidence["workflow"];
}

/**
 * Cycle 2m is an additive direct-execution evidence protocol. Historical v1
 * and v2 constants, parsers, formulas, and artifacts remain independently
 * reviewable; live acceptance writes only this closed v3 contract.
 */
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION =
  "3.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VERSION =
  3 as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE =
  "1cb7d3ce024cbd29665af7ec4e010da0c380b726" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM =
  "bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW =
  "Filing parser cross-engine execution acceptance" as const;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS =
  Object.freeze([
    "exact_source_owned_direct_docker_python_and_node_engine_configuration",
    "no_caller_injected_boundary_runner_signer_key_factory_or_execution_callback",
    "intrinsic_closed_descriptor_and_digest_configuration_snapshot",
    "internally_generated_ephemeral_ed25519_signer_and_public_key_binding",
    "fresh_unique_container_create_start_attach_remove_and_zero_residue_per_engine_role_archive",
    "exact_four_container_original_amendment_python_node_lifecycle_partition",
    "package_owned_bounded_shell_false_docker_process_execution_and_output_snapshots",
    "current_archive_document_handoff_execution_fact_and_reciprocal_lineage_validation",
    "byte_exact_cross_engine_normalization_agreement_after_complete_child_validation",
    "lifecycle_receipt_container_identity_role_image_and_archive_binding",
    "outer_invocation_binding_over_agreement_normalization_key_and_lifecycle_receipts",
    "same_input_normalization_stability_with_distinct_lifecycle_and_invocation_bindings",
    "atomic_direct_agreement_or_single_empty_value_free_quarantine",
    "abort_timeout_process_signer_output_cleanup_residue_and_concurrency_failure_coverage",
    "success_only_exact_source_v3_workflow_artifact_and_offline_review",
    "v1_v2_evidence_immutability_and_no_quality_real_data_or_production_widening",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN =
  Object.freeze([
    "docker_daemon_host_kernel_runtime_or_container_id_authenticity",
    "worker_binary_runtime_image_registry_supply_chain_or_attestation_beyond_reviewed_digests",
    "fresh_semantic_computation_nonce_challenge_or_cache_absence_inside_worker",
    "ephemeral_signer_external_identity_kms_hsm_custody_rotation_or_nonrepudiation",
    "true_organizational_operator_key_host_or_failure_domain_independence",
    "general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness",
    "real_public_filing_bytes_sec_source_authenticity_or_attestation",
    "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
    "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
    "independently_adjudicated_ground_truth_or_two_thousand_assertions",
    "precision_recall_document_success_thresholds_or_zero_silent_failures",
    "general_alias_unit_conversion_dimension_fiscal_calendar_or_amendment_coverage",
    "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
    "multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo",
    "database_api_web_queue_persistence_evidence_passport_or_b15_v15",
    "real_data_admission_full_cycle2_exit_or_production_use",
  ] as const);

const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SOURCE_PATHS =
  Object.freeze([
    ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SOURCE_PATHS,
    "fixtures/synthetic/filing-parser-cross-engine-execution/v3/cases.json",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v3/manifest.json",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY =
  Object.freeze({
    artifactId: "9623531283" as const,
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
    claimStatus: "historical_pass" as const,
    evidenceSha256:
      "sha256:c1d4d7c6c77bd5aa0a9a0af5de08fbbf3b823744b9cba47e3a59283dfd41f6d8" as const,
    evidenceVersion: 2 as const,
    failedPrecursorRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
    jobId: "98325467722" as const,
    runId: "33013464847" as const,
    sourceRevision: "2e3a7e33a76d19b993375958aff671707a81ef05" as const,
  });

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS =
  Object.freeze([
    "same-input-direct-docker-distinct-lifecycle-invocations",
    "unknown-python-image",
    "pre-aborted-signal",
    "original-archive-tamper",
    "original-amendment-role-swap",
    "identical-archives",
  ] as const);

export type FilingParserCrossEngineExecutionEvidenceV3CaseId =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS)[number];

export interface FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt {
  readonly archiveSha256: `sha256:${string}`;
  readonly containerIdSha256: `sha256:${string}`;
  readonly documentRole: "amendment" | "original";
  readonly documentSha256: `sha256:${string}`;
  readonly engineId: string;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly keyId: string;
  readonly lifecycleBindingSha256: `sha256:${string}`;
  readonly publicKeySpkiSha256: `sha256:${string}`;
  readonly role: "node-secondary" | "python-primary";
  readonly zeroResidue: true;
}

export interface FilingParserCrossEngineExecutionEvidenceV3Invocation {
  readonly agreementSha256: `sha256:${string}`;
  readonly agreementEngines: readonly [
    {
      readonly engineId: string;
      readonly executionBindingSha256: `sha256:${string}`;
      readonly imageSha256: `sha256:${string}`;
      readonly implementationSha256: `sha256:${string}`;
      readonly role: "python-primary";
    },
    {
      readonly engineId: string;
      readonly executionBindingSha256: `sha256:${string}`;
      readonly imageSha256: `sha256:${string}`;
      readonly implementationSha256: `sha256:${string}`;
      readonly role: "node-secondary";
    },
  ];
  readonly executionMode: "source_owned_direct_docker";
  readonly invocationBindingSha256: `sha256:${string}`;
  readonly keyId: string;
  readonly lifecycleReceipts: readonly [
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
  ];
  readonly normalizationSha256: `sha256:${string}`;
  readonly publicKeySpkiSha256: `sha256:${string}`;
  readonly resultSha256: `sha256:${string}`;
}

export interface FilingParserCrossEngineExecutionEvidenceV3CaseOutcome {
  readonly amendmentArchiveSha256: `sha256:${string}` | null;
  readonly caseId: FilingParserCrossEngineExecutionEvidenceV3CaseId;
  readonly expectedStatus: "agreed" | "quarantined";
  readonly factVersionCount: 20 | null;
  readonly invocationBindingsDistinct: boolean;
  readonly invocations:
    | readonly [
        FilingParserCrossEngineExecutionEvidenceV3Invocation,
        FilingParserCrossEngineExecutionEvidenceV3Invocation,
      ]
    | null;
  readonly lifecycleBindingsDistinct: boolean;
  readonly lineageCount: 10 | null;
  readonly normalizationStable: boolean;
  readonly observedStatus: "agreed" | "quarantined";
  readonly originalArchiveSha256: `sha256:${string}` | null;
}

export interface FilingParserCrossEngineExecutionEvidenceV3 {
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE;
  readonly caseOutcomes: readonly FilingParserCrossEngineExecutionEvidenceV3CaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS;
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM;
  readonly completedAt: string;
  readonly directExecutionValidation: {
    readonly configurationSnapshot: "intrinsic_closed_exact";
    readonly callerInjectionSurface: "none";
    readonly lifecycleBinding: "recomputed_exact";
    readonly outerInvocationBinding: "recomputed_exact";
    readonly processExecution: "package_owned_bounded_shell_false";
    readonly signer: "internally_generated_ephemeral_ed25519";
  };
  readonly engines: FilingParserCrossEngineExecutionEvidence["engines"];
  readonly evidenceVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VERSION;
  readonly fixtureManifestSha256: `sha256:${string}`;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly historicalV2: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY;
  readonly notProven: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly capabilitiesDropped: readonly ["ALL"];
    readonly containerControlMilliseconds: 5_000;
    readonly containerUser: "65532:65532";
    readonly cpuCount: 0.5;
    readonly engineCount: 2;
    readonly inputMount: "/input/filing.zip:ro";
    readonly memoryBytes: 134_217_728;
    readonly networkMode: "none";
    readonly noNewPrivileges: true;
    readonly noPublishedPorts: true;
    readonly openFiles: 64;
    readonly pids: 32;
    readonly processTerminationMilliseconds: 250;
    readonly readOnlyRootFilesystem: true;
    readonly signerMilliseconds: 5_000;
    readonly stderrLimitBytes: 4_096;
    readonly stdoutLimitBytes: 262_144;
    readonly successfulContainerCount: 8;
    readonly successfulInvocationCount: 2;
    readonly successfulLifecycleReceiptCount: 8;
    readonly temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608";
    readonly uniqueContainerIdSha256Count: 8;
    readonly wallClockMilliseconds: 5_000;
    readonly zeroResidue: true;
  };
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly agreed: 1;
    readonly invocationBindingsDistinct: true;
    readonly lifecycleBindingsDistinct: true;
    readonly normalizationStable: true;
    readonly quarantined: 5;
    readonly total: 6;
  };
  readonly synthetic: true;
  readonly tools: FilingParserCrossEngineExecutionEvidence["tools"];
  readonly transition: FilingParserCrossEngineExecutionEvidence["transition"];
  readonly workflow: {
    readonly artifactName: string;
    readonly event: "push" | "workflow_dispatch";
    readonly job: "acceptance";
    readonly ref: string;
    readonly runAttempt: number;
    readonly runId: string;
    readonly workflowName: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW;
  };
}

/**
 * Cycle 2n is an additive quality-composition evidence protocol. Historical
 * v1, v2, and v3 evidence remains byte-immutable and independently reviewable;
 * live acceptance writes only this closed v4 contract.
 */
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SCHEMA_VERSION =
  "4.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VERSION =
  4 as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE =
  "09e76235b5683427f2dd3201aefa740bb5adb16e" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM =
  "bounded_synthetic_source_owned_direct_docker_cross_engine_two_document_observation_precommitment_and_fixed_population_quality_evaluation_binding" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_WORKFLOW =
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_DIRECT_EXECUTION_SCHEMA_VERSION =
  "1.0.0" as const;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS =
  Object.freeze([
    "exact_source_owned_direct_docker_cross_engine_and_cycle2g_cycle2f_contract_configuration",
    "no_caller_injected_boundary_runner_signer_key_factory_execution_result_candidate_observation_measurement_or_callback",
    "intrinsic_owned_bounded_plan_archive_configuration_and_dependency_output_snapshots_before_use",
    "async_one_shot_open_committing_candidate_committed_consumed_state_machine_with_reservation_before_await",
    "reference_digest_only_commit_and_reference_bytes_only_identity_bound_capability_reveal",
    "exact_cycle2m_agreed_claim_schema_mode_current_input_lineage_and_recomputed_normalization_binding",
    "exact_four_lifecycle_receipt_python_node_original_amendment_partition_and_zero_residue",
    "exact_twenty_fact_version_original_amendment_source_document_partition_and_complete_validation",
    "exact_two_fixed_quality_coordinates_with_ten_sorted_facts_and_source_document_binding",
    "ninety_eight_documents_remain_omitted_without_replication_reweighting_exclusion_or_population_widening",
    "exact_cycle2g_candidate_commitment_and_cycle2f_fixed_denominator_delegation",
    "two_document_quality_accounting_preserves_precision_and_fail_closed_document_recall_silent_thresholds",
    "outer_commitment_and_evaluation_binding_over_execution_lifecycle_source_mapping_and_quality_hashes",
    "same_input_candidate_measurement_stability_with_distinct_lifecycle_commitment_and_evaluation_bindings",
    "timeout_process_quarantine_mutation_role_swap_replay_cross_instance_concurrency_and_dependency_failure_coverage",
    "atomic_composed_success_or_single_empty_value_free_quarantine_and_success_only_exact_source_v4_evidence_history_immutability",
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN =
  Object.freeze([
    "docker_daemon_host_kernel_runtime_or_container_id_authenticity",
    "worker_image_registry_supply_chain_attestation_nonce_freshness_or_cache_absence",
    "external_signer_identity_kms_hsm_custody_rotation_or_nonrepudiation",
    "organizational_operator_key_host_or_failure_domain_independence",
    "independent_adjudicator_identity_declared_reference_correctness_or_human_resolution_quality",
    "reference_secrecy_external_blinding_label_leakage_absence_or_authenticated_durable_chronology",
    "representative_one_hundred_real_filings_or_independently_adjudicated_two_thousand_real_assertions",
    "real_parser_quality_threshold_adequacy_confidence_or_production_acceptance",
    "general_parser_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness",
    "real_public_filing_bytes_sec_source_authenticity_attestation_or_custody",
    "cycle2b_external_inventory_rights_steward_key_authority_human_review_or_phaseb_admission",
    "strategic_quarantine_reason_authenticity_collusion_common_mode_or_malicious_failure_masking_detection",
    "general_alias_unit_conversion_dimension_fiscal_calendar_or_amendment_coverage",
    "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
    "multi_issuer_batch_retry_crash_recovery_load_slo_database_api_web_queue_or_b15_v15",
    "real_data_admission_full_cycle2_exit_or_production_use",
  ] as const);

const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SOURCE_PATHS =
  Object.freeze([
    ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SOURCE_PATHS,
    "fixtures/synthetic/filing-parser-cross-engine-execution/v4/cases.json",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v4/manifest.json",
    "packages/filing-quality-measurement/package.json",
    "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
    "packages/filing-quality-measurement/src/filing-quality-measurement.test.ts",
    "packages/filing-quality-measurement/src/filing-quality-measurement.ts",
    "packages/filing-quality-measurement/src/index.ts",
    "packages/filing-quality-measurement/src/test-filing-quality-measurement-builder.ts",
    "packages/filing-quality-measurement/tsconfig.json",
    "packages/filing-quality-precommitment/package.json",
    "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
    "packages/filing-quality-precommitment/src/filing-quality-precommitment.test.ts",
    "packages/filing-quality-precommitment/src/filing-quality-precommitment.ts",
    "packages/filing-quality-precommitment/src/index.ts",
    "packages/filing-quality-precommitment/src/test-filing-quality-precommitment-builder.ts",
    "packages/filing-quality-precommitment/tsconfig.json",
  ] as const);

const FILING_PARSER_QUALITY_COMPOSITION_EXACT_SOURCE_PATHS = Object.freeze([
  "packages/filing-parser-quality-composition/package.json",
  "packages/filing-parser-quality-composition/src/filing-parser-quality-composition-security.test.ts",
  "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.test.ts",
  "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.ts",
  "packages/filing-parser-quality-composition/src/index.ts",
  "packages/filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder.ts",
  "packages/filing-parser-quality-composition/tsconfig.json",
] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION =
  Object.freeze([
    {
      path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
      status: "M",
    },
    { path: "README.md", status: "M" },
    { path: "docs/BUILD_ROADMAP.md", status: "M" },
    { path: "docs/CANONICAL_MODEL.md", status: "M" },
    { path: "docs/CYCLE_2N_EXIT_MATRIX.md", status: "A" },
    { path: "docs/THREAT_MODEL.md", status: "M" },
    {
      path: "docs/adr/0041-bounded-synthetic-source-owned-quality-composition.md",
      status: "A",
    },
    {
      path: "fixtures/synthetic/filing-parser-cross-engine-execution/v4/cases.json",
      status: "A",
    },
    {
      path: "fixtures/synthetic/filing-parser-cross-engine-execution/v4/manifest.json",
      status: "A",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/package.json",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/index.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-cross-engine-execution-acceptance/src/test-filing-parser-cross-engine-execution-evidence-builder.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser-quality-composition/package.json",
      status: "A",
    },
    {
      path: "packages/filing-parser-quality-composition/src/filing-parser-quality-composition-security.test.ts",
      status: "A",
    },
    {
      path: "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.test.ts",
      status: "A",
    },
    {
      path: "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.ts",
      status: "A",
    },
    {
      path: "packages/filing-parser-quality-composition/src/index.ts",
      status: "A",
    },
    {
      path: "packages/filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder.ts",
      status: "A",
    },
    {
      path: "packages/filing-parser-quality-composition/tsconfig.json",
      status: "A",
    },
    {
      path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      status: "M",
    },
    {
      path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
      status: "M",
    },
    {
      path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
      status: "M",
    },
    { path: "pnpm-lock.yaml", status: "M" },
    { path: "scripts/verify-boundaries.ts", status: "M" },
    {
      path: "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
      status: "M",
    },
  ] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY =
  Object.freeze({
    artifactId: "9627207288" as const,
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
    claimStatus: "historical_pass" as const,
    evidenceSha256:
      "sha256:25dfd0dd5c36d24656de9eda85a34940a40f50e11cd02535bae1fb8f24c05c6e" as const,
    evidenceVersion: 3 as const,
    jobId: "98356972412" as const,
    maintenance: Object.freeze({
      artifactCount: 0 as const,
      jobId: "98363074109" as const,
      revision: "1860bb367afdb6d725e41880ebb121dda4a04f39" as const,
      runId: "33024664259" as const,
    }),
    promotionRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
    runId: "33022797708" as const,
    sourceRevision: "5d61868e6075865b32640ddaceb845ac9dbc69f3" as const,
  });

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS =
  Object.freeze([
    "same-input-quality-evaluation-distinct-lifecycle-invocations",
    "declared-reference-digest-mismatch",
    "quality-capability-replay",
    "reference-content-at-commit",
    "original-archive-tamper",
    "original-amendment-role-swap",
  ] as const);

export type FilingParserCrossEngineExecutionEvidenceV4CaseId =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS)[number];

export interface FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt {
  readonly documentRole: "amendment" | "original";
  readonly factCount: 10;
  readonly observationSha256: `sha256:${string}`;
  readonly projectionBindingSha256: `sha256:${string}`;
  readonly qualityDocumentId: "synthetic-filing-0001" | "synthetic-filing-0002";
  readonly qualityDocumentSha256: `sha256:${string}`;
  readonly sourceArchiveSha256: `sha256:${string}`;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly sourceLifecycleBindingSha256s: readonly [
    `sha256:${string}`,
    `sha256:${string}`,
  ];
}

export interface FilingParserCrossEngineExecutionEvidenceV4SourceExecution {
  readonly agreementSha256: `sha256:${string}`;
  readonly directExecutionClaim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM;
  readonly directExecutionSchemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_DIRECT_EXECUTION_SCHEMA_VERSION;
  readonly ephemeralPublicKeySpkiSha256: `sha256:${string}`;
  readonly executionMode: "source_owned_direct_docker";
  readonly invocationBindingSha256: `sha256:${string}`;
  readonly lifecycleBindingSha256s: readonly [
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
  ];
  readonly normalizationSha256: `sha256:${string}`;
}

export interface FilingParserCrossEngineExecutionEvidenceV4Invocation {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly compositionCommitmentSha256: `sha256:${string}`;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly evaluationBindingSha256: `sha256:${string}`;
  readonly measurementEvaluationSha256: `sha256:${string}`;
  readonly planSha256: `sha256:${string}`;
  readonly projectionReceipts: readonly [
    FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt,
    FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt,
  ];
  readonly qualityAccounting: {
    readonly counts: {
      readonly conceptMismatchCount: 0;
      readonly criticalAssertionCount: 2_000;
      readonly dimensionMismatchCount: 0;
      readonly documentCount: 100;
      readonly emittedFactCount: 20;
      readonly expectedFactCount: 1_000;
      readonly falseNegativeFactCount: 980;
      readonly falsePositiveFactCount: 0;
      readonly missingDocumentCount: 98;
      readonly missingFactCount: 980;
      readonly periodMismatchCount: 0;
      readonly quarantinedDocumentCount: 0;
      readonly semanticAssertionPassCount: 20;
      readonly silentCriticalFailureCount: 1_960;
      readonly succeededDocumentCount: 2;
      readonly truePositiveFactCount: 20;
      readonly unitMismatchCount: 0;
      readonly unitPeriodAssertionPassCount: 20;
      readonly valueMismatchCount: 0;
    };
    readonly failedThresholds: readonly [
      "document_success_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ];
    readonly metrics: {
      readonly documentSuccess: {
        readonly defined: true;
        readonly denominator: 100;
        readonly met: false;
        readonly numerator: 2;
        readonly threshold: {
          readonly denominator: 100;
          readonly numerator: 95;
        };
        readonly thresholdKind: "minimum";
      };
      readonly factPrecision: {
        readonly defined: true;
        readonly denominator: 20;
        readonly met: true;
        readonly numerator: 20;
        readonly threshold: {
          readonly denominator: 100;
          readonly numerator: 99;
        };
        readonly thresholdKind: "minimum";
      };
      readonly factRecall: {
        readonly defined: true;
        readonly denominator: 1_000;
        readonly met: false;
        readonly numerator: 20;
        readonly threshold: {
          readonly denominator: 100;
          readonly numerator: 99;
        };
        readonly thresholdKind: "minimum";
      };
      readonly quarantineRate: {
        readonly defined: true;
        readonly denominator: 100;
        readonly met: true;
        readonly numerator: 0;
        readonly threshold: {
          readonly denominator: 100;
          readonly numerator: 5;
        };
        readonly thresholdKind: "maximum";
      };
      readonly silentCriticalFailure: {
        readonly count: 1_960;
        readonly denominator: 2_000;
        readonly maximumCount: 0;
        readonly met: false;
      };
      readonly unitDateTolerance: {
        readonly dateToleranceDays: 0;
        readonly periodMismatchCount: 0;
        readonly unitMismatchCount: 0;
        readonly unitTolerancePolicy: "exact_canonical_unit.v1";
      };
    };
    readonly syntheticPilotThresholdOutcome: "not_met";
  };
  readonly qualityEvaluationBindingSha256: `sha256:${string}`;
  readonly sourceExecution: FilingParserCrossEngineExecutionEvidenceV4SourceExecution;
}

export interface FilingParserCrossEngineExecutionEvidenceV4CaseOutcome {
  readonly candidateCommitmentsStable: boolean;
  readonly candidateObservationsStable: boolean;
  readonly caseId: FilingParserCrossEngineExecutionEvidenceV4CaseId;
  readonly compositionBindingsDistinct: boolean;
  readonly expectedStatus: "evaluated_not_met" | "quarantined";
  readonly invocations:
    | readonly [
        FilingParserCrossEngineExecutionEvidenceV4Invocation,
        FilingParserCrossEngineExecutionEvidenceV4Invocation,
      ]
    | null;
  readonly lifecycleBindingsDistinct: boolean;
  readonly measurementStable: boolean;
  readonly observedStatus: "evaluated_not_met" | "quarantined";
}

export interface FilingParserCrossEngineExecutionEvidenceV4 {
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE;
  readonly caseOutcomes: readonly FilingParserCrossEngineExecutionEvidenceV4CaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS;
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM;
  readonly completedAt: string;
  readonly compositionValidation: {
    readonly callerInjectionSurface: "none";
    readonly candidatePopulation: "exact_two_observed_ninety_eight_omitted";
    readonly outerBindings: "recomputed_exact";
    readonly precommitment: "one_shot_reference_digest_only";
    readonly qualityEvaluation: "fixed_denominator_evaluated_not_met";
    readonly sourceExecution: "cycle2m_source_owned_direct_docker";
  };
  readonly engines: FilingParserCrossEngineExecutionEvidence["engines"];
  readonly evidenceVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VERSION;
  readonly fixtureManifestSha256: `sha256:${string}`;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly historicalV2: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY;
  readonly historicalV3: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY;
  readonly notProven: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly capabilitiesDropped: readonly ["ALL"];
    readonly compositionCommitCount: 4;
    readonly engineCount: 2;
    readonly networkMode: "none";
    readonly readOnlyRootFilesystem: true;
    readonly successfulEvaluationCount: 3;
    readonly successfulLifecycleReceiptCount: 16;
    readonly successfulTwoDocumentObservationCount: 4;
    readonly zeroResidue: true;
  };
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly candidateCommitmentsStable: true;
    readonly candidateObservationsStable: true;
    readonly compositionBindingsDistinct: true;
    readonly evaluatedNotMet: 1;
    readonly lifecycleBindingsDistinct: true;
    readonly measurementStable: true;
    readonly quarantined: 5;
    readonly total: 6;
  };
  readonly synthetic: true;
  readonly tools: FilingParserCrossEngineExecutionEvidence["tools"];
  readonly transition: FilingParserCrossEngineExecutionEvidence["transition"];
  readonly workflow: FilingParserCrossEngineExecutionEvidenceV3["workflow"];
}

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES =
  Object.freeze([
    "root_contract",
    "timestamps",
    "claim_tuples",
    "historical_evidence",
    "composition_validation",
    "case_outcomes",
    "transition",
    "runtime",
    "source_hashes",
    "engines",
    "source_bindings",
    "quality_bindings",
    "fixture_binding",
    "summary",
    "tools_contract",
    "workflow",
    "canonical_freeze",
  ] as const);
export type FilingParserCrossEngineExecutionEvidenceV4ValidationStage =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES)[number];
type FilingParserCrossEngineExecutionEvidenceV4ValidationStageMarker = (
  stage: FilingParserCrossEngineExecutionEvidenceV4ValidationStage,
) => void;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES =
  Object.freeze([
    "root_contract",
    "timestamps",
    "claim_tuples",
    "historical_evidence",
    "direct_execution_validation",
    "case_outcomes",
    "transition",
    "runtime",
    "source_hashes",
    "engines",
    "lifecycle_bindings",
    "outer_invocation_bindings",
    "fixture_binding",
    "summary",
    "tools_contract",
    "workflow",
    "canonical_freeze",
  ] as const);
export type FilingParserCrossEngineExecutionEvidenceV3ValidationStage =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES)[number];
type FilingParserCrossEngineExecutionEvidenceV3ValidationStageMarker = (
  stage: FilingParserCrossEngineExecutionEvidenceV3ValidationStage,
) => void;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES =
  Object.freeze([
    "root_contract",
    "timestamps",
    "claim_tuples",
    "historical_v1",
    "binding_validation",
    "case_outcomes",
    "transition",
    "runtime",
    "source_hashes",
    "engines",
    "fixture_binding",
    "summary",
    "tools_contract",
    "workflow",
    "canonical_freeze",
  ] as const);
export type FilingParserCrossEngineExecutionEvidenceV2ValidationStage =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES)[number];
type FilingParserCrossEngineExecutionEvidenceV2ValidationStageMarker = (
  stage: FilingParserCrossEngineExecutionEvidenceV2ValidationStage,
) => void;

/** @internal Closed value-free stages used only by the live acceptance diagnostic. */
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES =
  Object.freeze([
    "root_contract",
    "timestamps",
    "claim_tuples",
    "case_outcomes",
    "transition",
    "runtime",
    "source_hashes",
    "engines",
    "fixture_binding",
    "summary",
    "tools_contract",
    "tool_docker_client",
    "tool_docker_server",
    "tool_git",
    "tool_node",
    "tool_pnpm",
    "tool_python",
    "workflow",
    "canonical_freeze",
  ] as const);
export type FilingParserCrossEngineExecutionEvidenceValidationStage =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES)[number];
type FilingParserCrossEngineExecutionEvidenceValidationStageMarker = (
  stage: FilingParserCrossEngineExecutionEvidenceValidationStage,
) => void;

const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\x20-\x7e]{1,300}$/u;
const VERSION = /^[\x20-\x7e]{1,160}$/u;
const ENGINE = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const KEY_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const V2_HANDOFF_PAIR_BINDING_DOMAIN =
  "research-cockpit:synthetic-parser-normalization-handoff-pair:v1\u0000";
const V2_EXECUTION_BINDING_DOMAIN =
  "research-cockpit:synthetic-parser-normalization-execution:v1\u0000";
const V2_AGREEMENT_DOMAIN =
  "research-cockpit:synthetic-filing-parser-cross-engine-execution:v1\u0000";
const V2_LIVE_KEY_ID = "cycle2k-ephemeral-ed25519-v1";
const V3_LIFECYCLE_BINDING_DOMAIN =
  "research-cockpit:synthetic-filing-parser-direct-container-lifecycle:v1\u0000";
const V3_INVOCATION_BINDING_DOMAIN =
  "research-cockpit:synthetic-filing-parser-direct-cross-engine-invocation:v1\u0000";
const V3_LIVE_KEY_ID = "cycle2m-ephemeral-ed25519-v1";
const V4_QUALITY_DOCUMENT_DOMAIN =
  "research-cockpit:synthetic-filing-quality-document:v1\u0000";
const V4_PROJECTION_BINDING_DOMAIN =
  "research-cockpit:synthetic-filing-parser-quality-projection:v1\u0000";
const V4_COMPOSITION_COMMITMENT_DOMAIN =
  "research-cockpit:synthetic-filing-parser-quality-composition-commitment:v1\u0000";
const V4_COMPOSITION_EVALUATION_DOMAIN =
  "research-cockpit:synthetic-filing-parser-quality-composition-evaluation:v1\u0000";
const V4_PRECOMMITMENT_COMMITMENT_DOMAIN =
  "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000";
const V4_PRECOMMITMENT_EVALUATION_DOMAIN =
  "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000";
const V4_MEASUREMENT_EVALUATION_DOMAIN =
  "research-cockpit:synthetic-filing-quality-measurement:v1\u0000";
const V4_COMPOSITION_SCHEMA_VERSION = "1.0.0" as const;
const V4_PRECOMMITMENT_CLAIM =
  "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation" as const;
const V4_PLAN_SHA256 =
  "sha256:09fafed655e368f2649ba65b0353e05a369bab714da30132482e84ec81699429" as const;
const V4_DECLARED_REFERENCE_SHA256 =
  "sha256:e49aa407b4d92a486418ac93ae9cdaac39c921ed467fd48e359042b97d06d579" as const;
const V4_CANDIDATE_DECLARATION = Object.freeze({
  declarationSha256:
    "sha256:c254e5f327be470a72f9feb206a7c34341b5020cf425592199a17fb4122e4b2a",
  id: "synthetic-filing-quality-candidate",
  role: "declared-candidate" as const,
  version: "1.0.0" as const,
});
const V4_EXACT_FACTS = Object.freeze([
  Object.freeze({
    amendmentValue: "250000000",
    concept: "rc-synthetic:Assets",
    factKey: "assets",
    originalValue: "250000000",
    periodStart: null,
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "24000000",
    concept: "rc-synthetic:CashAndCashEquivalents",
    factKey: "cash",
    originalValue: "24000000",
    periodStart: null,
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "40000000",
    concept: "rc-synthetic:Debt",
    factKey: "debt",
    originalValue: "40000000",
    periodStart: null,
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "25000000",
    concept: "rc-synthetic:WeightedAverageDilutedShares",
    factKey: "diluted_shares",
    originalValue: "25000000",
    periodStart: "2025-01-01",
    unit: "shares",
  }),
  Object.freeze({
    amendmentValue: "14000000",
    concept: "rc-synthetic:FreeCashFlow",
    factKey: "free_cash_flow",
    originalValue: "15000000",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "57000000",
    concept: "rc-synthetic:GrossProfit",
    factKey: "gross_profit",
    originalValue: "60000000",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "10000000",
    concept: "rc-synthetic:NetIncome",
    factKey: "net_income",
    originalValue: "12000000",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "20000000",
    concept: "rc-synthetic:OperatingCashFlow",
    factKey: "operating_cash_flow",
    originalValue: "20000000",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "16000000",
    concept: "rc-synthetic:OperatingIncome",
    factKey: "operating_income",
    originalValue: "18000000",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  Object.freeze({
    amendmentValue: "116400000",
    concept: "rc-synthetic:Revenue",
    factKey: "revenue",
    originalValue: "120000000",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
] as const);
const ENGINE_CONTRACTS = Object.freeze({
  "python-primary": Object.freeze({
    engineId: "python-3.12-primary-v1",
    runtimeVersion: "Python 3.12.13",
    baseIndexDigest:
      "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
    basePlatformManifestDigest:
      "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
  }),
  "node-secondary": Object.freeze({
    engineId: "node-24-secondary-v1",
    runtimeVersion: "Node v24.19.0",
    baseIndexDigest:
      "sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df",
    basePlatformManifestDigest:
      "sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174",
  }),
});
const CASE_IDS = Object.freeze([
  "exact-original-amendment-cross-engine-pair",
  "cross-engine-normalization-mismatch",
  "original-archive-tamper",
  "original-amendment-role-swap",
] as const);
const CYCLE_2K_ADDED_PATHS = Object.freeze(
  [
    ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
    "docs/CYCLE_2K_EXIT_MATRIX.md",
    "docs/adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v1/cases.json",
    "fixtures/synthetic/filing-parser-cross-engine-execution/v1/manifest.json",
    ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SOURCE_PATHS.filter(
      (path) =>
        path.startsWith("packages/filing-parser-cross-engine-execution/") ||
        path.startsWith(
          "packages/filing-parser-cross-engine-execution-acceptance/",
        ),
    ),
    "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
  ].sort(),
);
const CYCLE_2K_MODIFIED_PATHS = Object.freeze(
  [
    "LICENSE_POLICY.md",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "docs/BUILD_ROADMAP.md",
    "docs/CANONICAL_MODEL.md",
    "docs/THREAT_MODEL.md",
    "package.json",
    "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
    "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
    "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    "pnpm-lock.yaml",
    "scripts/verify-boundaries.ts",
  ].sort(),
);
const CYCLE_2K_TRANSITION = Object.freeze(
  [
    ...CYCLE_2K_ADDED_PATHS.map((path) => ({ path, status: "A" as const })),
    ...CYCLE_2K_MODIFIED_PATHS.map((path) => ({ path, status: "M" as const })),
  ].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  ),
);

export function createFilingParserCrossEngineExecutionEvidence(
  value: FilingParserCrossEngineExecutionEvidence,
): FilingParserCrossEngineExecutionEvidence {
  try {
    return normalizeEvidence(value);
  } catch {
    return invalid();
  }
}

/** @internal Uses the same model while exposing only a closed validation stage. */
export function createFilingParserCrossEngineExecutionEvidenceForAcceptance(
  value: FilingParserCrossEngineExecutionEvidence,
  markStage: FilingParserCrossEngineExecutionEvidenceValidationStageMarker,
): FilingParserCrossEngineExecutionEvidence {
  try {
    const staged = normalizeEvidence(value, markStage);
    return normalizeEvidence(staged);
  } catch {
    return invalid();
  }
}

export function parseCanonicalFilingParserCrossEngineExecutionEvidence(
  bytes: Uint8Array,
): FilingParserCrossEngineExecutionEvidence {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return invalid();
  }
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n"))
    return invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(0, -1)) as unknown;
  } catch {
    return invalid();
  }
  try {
    const evidence = normalizeEvidence(parsed);
    if (
      serializeCanonicalFilingParserCrossEngineExecutionEvidence(evidence) !==
      text
    )
      return invalid();
    return evidence;
  } catch {
    return invalid();
  }
}

export function serializeCanonicalFilingParserCrossEngineExecutionEvidence(
  evidence: FilingParserCrossEngineExecutionEvidence,
): string {
  try {
    return `${canonicalJson(normalizeEvidence(evidence))}\n`;
  } catch {
    return invalid();
  }
}

export function filingParserCrossEngineExecutionEvidenceSha256(
  evidence: FilingParserCrossEngineExecutionEvidence,
): `sha256:${string}` {
  try {
    return sha256(
      new TextEncoder().encode(
        serializeCanonicalFilingParserCrossEngineExecutionEvidence(evidence),
      ),
    );
  } catch {
    return invalid();
  }
}

export function filingParserCrossEngineImplementationSha256(
  sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[],
): `sha256:${string}` {
  try {
    const hash = createHash("sha256");
    hash.update(
      "research-cockpit:filing-parser-cross-engine-implementation:v1\0",
      "utf8",
    );
    for (const source of sourceHashes) {
      if (!PATH.test(source.path) || !HASH.test(source.sha256))
        return invalid();
      hash.update(source.path, "utf8");
      hash.update("\0", "utf8");
      hash.update(source.sha256, "utf8");
      hash.update("\n", "utf8");
    }
    return `sha256:${hash.digest("hex")}`;
  } catch {
    return invalid();
  }
}

/** @internal Exact-transition test and runner seam; not re-exported publicly. */
export function filingParserCrossEngineExecutionExpectedTransition(): readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[] {
  return CYCLE_2K_TRANSITION;
}

/** @internal Exact source-inventory projection shared by model, runner, and tests. */
export function filingParserCrossEngineExecutionRequiredSourcePaths(
  transition: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[],
): readonly string[] {
  return Object.freeze(
    [
      ...new Set([
        ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SOURCE_PATHS,
        ...transition.map((entry) => entry.path),
      ]),
    ].sort((left, right) => left.localeCompare(right)),
  );
}

/** @internal Additive Cycle 2l evidence model; v1 remains the public history model. */
export function createFilingParserCrossEngineExecutionEvidenceV2(
  value: FilingParserCrossEngineExecutionEvidenceV2,
): FilingParserCrossEngineExecutionEvidenceV2 {
  try {
    return normalizeEvidenceV2(value);
  } catch {
    return invalid();
  }
}

/** @internal Closed, value-free live-acceptance validation seam for v2. */
export function createFilingParserCrossEngineExecutionEvidenceV2ForAcceptance(
  value: FilingParserCrossEngineExecutionEvidenceV2,
  markStage: FilingParserCrossEngineExecutionEvidenceV2ValidationStageMarker,
): FilingParserCrossEngineExecutionEvidenceV2 {
  try {
    const staged = normalizeEvidenceV2(value, markStage);
    return normalizeEvidenceV2(staged);
  } catch {
    return invalid();
  }
}

/** @internal Parses the canonical one-line Cycle 2l evidence artifact. */
export function parseCanonicalFilingParserCrossEngineExecutionEvidenceV2(
  bytes: Uint8Array,
): FilingParserCrossEngineExecutionEvidenceV2 {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return invalid();
  }
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n"))
    return invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(0, -1)) as unknown;
  } catch {
    return invalid();
  }
  try {
    const evidence = normalizeEvidenceV2(parsed);
    if (
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2(evidence) !==
      text
    )
      return invalid();
    return evidence;
  } catch {
    return invalid();
  }
}

/** @internal Serializes the canonical one-line Cycle 2l evidence artifact. */
export function serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2(
  evidence: FilingParserCrossEngineExecutionEvidenceV2,
): string {
  try {
    return `${canonicalJson(normalizeEvidenceV2(evidence))}\n`;
  } catch {
    return invalid();
  }
}

/** @internal Computes the digest of the exact canonical Cycle 2l artifact. */
export function filingParserCrossEngineExecutionEvidenceV2Sha256(
  evidence: FilingParserCrossEngineExecutionEvidenceV2,
): `sha256:${string}` {
  try {
    return sha256(
      new TextEncoder().encode(
        serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2(evidence),
      ),
    );
  } catch {
    return invalid();
  }
}

/** @internal Exact Cycle 2j handoff-pair receipt recomputation (no newline). */
export function filingParserCrossEngineExecutionV2HandoffPairBindingSha256(value: {
  readonly amendmentDocumentSha256: `sha256:${string}`;
  readonly amendmentSourceSha256: `sha256:${string}`;
  readonly imageSha256: `sha256:${string}`;
  readonly keyId: string;
  readonly originalDocumentSha256: `sha256:${string}`;
  readonly originalSourceSha256: `sha256:${string}`;
  readonly publicKeySpkiSha256: `sha256:${string}`;
}): `sha256:${string}` {
  return domainCanonicalSha256(V2_HANDOFF_PAIR_BINDING_DOMAIN, value, false);
}

/** @internal Exact Cycle 2j execution receipt recomputation (canonical newline). */
export function filingParserCrossEngineExecutionV2ExecutionBindingSha256(value: {
  readonly amendmentDocumentSha256: `sha256:${string}`;
  readonly handoffPairBindingSha256: `sha256:${string}`;
  readonly imageSha256: `sha256:${string}`;
  readonly keyId: string;
  readonly originalDocumentSha256: `sha256:${string}`;
}): `sha256:${string}` {
  return domainCanonicalSha256(V2_EXECUTION_BINDING_DOMAIN, value, true);
}

/** @internal Exact Cycle 2k outer agreement recomputation (canonical newline). */
export function filingParserCrossEngineExecutionV2AgreementSha256(value: {
  readonly amendmentArchiveSha256: `sha256:${string}`;
  readonly engines: readonly [
    {
      readonly engineId: string;
      readonly executionBindingSha256: `sha256:${string}`;
      readonly imageSha256: `sha256:${string}`;
      readonly implementationSha256: `sha256:${string}`;
      readonly role: "python-primary";
    },
    {
      readonly engineId: string;
      readonly executionBindingSha256: `sha256:${string}`;
      readonly imageSha256: `sha256:${string}`;
      readonly implementationSha256: `sha256:${string}`;
      readonly role: "node-secondary";
    },
  ];
  readonly normalizationSha256: `sha256:${string}`;
  readonly originalArchiveSha256: `sha256:${string}`;
}): `sha256:${string}` {
  return domainCanonicalSha256(V2_AGREEMENT_DOMAIN, value, true);
}

/** @internal Exact v2 source-inventory projection shared by model and runner. */
export function filingParserCrossEngineExecutionV2RequiredSourcePaths(
  transition: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[],
): readonly string[] {
  return Object.freeze(
    [
      ...new Set([
        ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SOURCE_PATHS,
        ...transition.map((entry) => entry.path),
      ]),
    ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

/** @internal Additive Cycle 2n quality-composition evidence model. */
export function createFilingParserCrossEngineExecutionEvidenceV4(
  value: FilingParserCrossEngineExecutionEvidenceV4,
): FilingParserCrossEngineExecutionEvidenceV4 {
  try {
    return normalizeEvidenceV4(value);
  } catch {
    return invalid();
  }
}

/** @internal Closed, value-free live-acceptance validation seam for v4. */
export function createFilingParserCrossEngineExecutionEvidenceV4ForAcceptance(
  value: FilingParserCrossEngineExecutionEvidenceV4,
  markStage: FilingParserCrossEngineExecutionEvidenceV4ValidationStageMarker,
): FilingParserCrossEngineExecutionEvidenceV4 {
  try {
    const staged = normalizeEvidenceV4(value, markStage);
    return normalizeEvidenceV4(staged);
  } catch {
    return invalid();
  }
}

/** @internal Parses the canonical one-line Cycle 2n evidence artifact. */
export function parseCanonicalFilingParserCrossEngineExecutionEvidenceV4(
  bytes: Uint8Array,
): FilingParserCrossEngineExecutionEvidenceV4 {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return invalid();
  }
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n"))
    return invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(0, -1)) as unknown;
  } catch {
    return invalid();
  }
  try {
    const evidence = normalizeEvidenceV4(parsed);
    if (
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4(evidence) !==
      text
    )
      return invalid();
    return evidence;
  } catch {
    return invalid();
  }
}

/** @internal Serializes the canonical one-line Cycle 2n evidence artifact. */
export function serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4(
  evidence: FilingParserCrossEngineExecutionEvidenceV4,
): string {
  try {
    return `${canonicalJson(normalizeEvidenceV4(evidence))}\n`;
  } catch {
    return invalid();
  }
}

/** @internal Computes the digest of the exact canonical Cycle 2n artifact. */
export function filingParserCrossEngineExecutionEvidenceV4Sha256(
  evidence: FilingParserCrossEngineExecutionEvidenceV4,
): `sha256:${string}` {
  try {
    return sha256(
      new TextEncoder().encode(
        serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4(evidence),
      ),
    );
  } catch {
    return invalid();
  }
}

/** @internal Exact v4 source-inventory projection shared by model and runner. */
export function filingParserCrossEngineExecutionV4RequiredSourcePaths(
  transition: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[],
): readonly string[] {
  return Object.freeze(
    [
      ...new Set([
        ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SOURCE_PATHS,
        ...transition.map((entry) => entry.path),
      ]),
    ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

/** @internal Independently recomputes one fixed quality-coordinate digest. */
export function filingParserCrossEngineExecutionV4QualityDocumentSha256(
  qualityDocumentId: "synthetic-filing-0001" | "synthetic-filing-0002",
): `sha256:${string}` {
  const hash = createHash("sha256");
  hash.update(V4_QUALITY_DOCUMENT_DOMAIN, "utf8");
  hash.update(qualityDocumentId, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function v4ExactCandidateDocument(index: 0 | 1): object {
  const documentId =
    index === 0 ? "synthetic-filing-0001" : "synthetic-filing-0002";
  return {
    documentId,
    documentSha256:
      filingParserCrossEngineExecutionV4QualityDocumentSha256(documentId),
    facts: V4_EXACT_FACTS.map((fact) => ({
      concept: fact.concept,
      dimensions: [],
      factKey: fact.factKey,
      periodEnd: "2025-12-31",
      periodStart: fact.periodStart,
      unit: fact.unit,
      value: index === 0 ? fact.originalValue : fact.amendmentValue,
    })),
    status: "succeeded",
  };
}

function v4CandidateObservationSha256(index: 0 | 1): `sha256:${string}` {
  return sha256(
    new TextEncoder().encode(canonicalJson(v4ExactCandidateDocument(index))),
  );
}

function v4ExpectedInnerBindings(
  qualityAccounting: FilingParserCrossEngineExecutionEvidenceV4Invocation["qualityAccounting"],
): Readonly<{
  candidateCommitmentSha256: `sha256:${string}`;
  candidateObservationsSha256: `sha256:${string}`;
  measurementEvaluationSha256: `sha256:${string}`;
  qualityEvaluationBindingSha256: `sha256:${string}`;
}> {
  const documentObservations = [
    v4ExactCandidateDocument(0),
    v4ExactCandidateDocument(1),
  ];
  const commonCandidate = {
    candidateDeclaration: V4_CANDIDATE_DECLARATION,
    declaredReferenceSha256: V4_DECLARED_REFERENCE_SHA256,
    documentObservations,
    planSha256: V4_PLAN_SHA256,
    populationId: "synthetic-filing-quality-reference.v1",
    populationVersion: "1.0.0",
    schemaVersion: "1.0.0",
    synthetic: true,
  };
  const candidateObservationsSha256 = canonicalDocumentSha256({
    ...commonCandidate,
    documentRole: "candidate_observations_precommit",
  });
  const candidateCommitmentSha256 = domainCanonicalSha256(
    V4_PRECOMMITMENT_COMMITMENT_DOMAIN,
    {
      candidateObservationsSha256,
      claim: V4_PRECOMMITMENT_CLAIM,
      declaredReferenceSha256: V4_DECLARED_REFERENCE_SHA256,
      planSha256: V4_PLAN_SHA256,
      schemaVersion: "1.0.0",
    },
    true,
  );
  const measurementCandidateSha256 = canonicalDocumentSha256({
    ...commonCandidate,
    documentRole: "candidate_observations",
    producedAt: "2026-01-03T00:00:00.000Z",
  });
  const measurementEvaluationSha256 = domainCanonicalSha256(
    V4_MEASUREMENT_EVALUATION_DOMAIN,
    {
      candidateSha256: measurementCandidateSha256,
      counts: qualityAccounting.counts,
      declaredReferenceSha256: V4_DECLARED_REFERENCE_SHA256,
      failedThresholds: qualityAccounting.failedThresholds,
      planSha256: V4_PLAN_SHA256,
      syntheticPilotThresholdOutcome:
        qualityAccounting.syntheticPilotThresholdOutcome,
    },
    false,
  );
  const qualityEvaluationBindingSha256 = domainCanonicalSha256(
    V4_PRECOMMITMENT_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256,
      candidateObservationsSha256,
      measurementEvaluationSha256,
      planSha256: V4_PLAN_SHA256,
    },
    true,
  );
  return Object.freeze({
    candidateCommitmentSha256,
    candidateObservationsSha256,
    measurementEvaluationSha256,
    qualityEvaluationBindingSha256,
  });
}

/** @internal Independently recomputes one source-to-quality projection receipt. */
export function filingParserCrossEngineExecutionV4ProjectionBindingSha256(
  value: Omit<
    FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt,
    "projectionBindingSha256"
  >,
): `sha256:${string}` {
  return domainCanonicalSha256(V4_PROJECTION_BINDING_DOMAIN, value, false);
}

/** @internal Independently recomputes the outer one-shot commitment. */
export function filingParserCrossEngineExecutionV4CompositionCommitmentSha256(
  value: Pick<
    FilingParserCrossEngineExecutionEvidenceV4Invocation,
    | "candidateCommitmentSha256"
    | "candidateObservationsSha256"
    | "declaredReferenceSha256"
    | "planSha256"
    | "projectionReceipts"
    | "sourceExecution"
  >,
): `sha256:${string}` {
  return domainCanonicalSha256(
    V4_COMPOSITION_COMMITMENT_DOMAIN,
    {
      candidateCommitmentSha256: value.candidateCommitmentSha256,
      candidateObservationsSha256: value.candidateObservationsSha256,
      claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM,
      declaredReferenceSha256: value.declaredReferenceSha256,
      planSha256: value.planSha256,
      projectionReceipts: value.projectionReceipts,
      schemaVersion: V4_COMPOSITION_SCHEMA_VERSION,
      sourceExecution: value.sourceExecution,
    },
    false,
  );
}

/** @internal Independently recomputes the outer evaluation binding. */
export function filingParserCrossEngineExecutionV4EvaluationBindingSha256(
  value: Pick<
    FilingParserCrossEngineExecutionEvidenceV4Invocation,
    | "candidateCommitmentSha256"
    | "compositionCommitmentSha256"
    | "declaredReferenceSha256"
    | "measurementEvaluationSha256"
    | "qualityEvaluationBindingSha256"
  >,
): `sha256:${string}` {
  return domainCanonicalSha256(
    V4_COMPOSITION_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256: value.candidateCommitmentSha256,
      compositionCommitmentSha256: value.compositionCommitmentSha256,
      declaredReferenceSha256: value.declaredReferenceSha256,
      measurementEvaluationSha256: value.measurementEvaluationSha256,
      qualityEvaluationBindingSha256: value.qualityEvaluationBindingSha256,
    },
    false,
  );
}

export function createFilingParserCrossEngineExecutionEvidenceV3(
  value: FilingParserCrossEngineExecutionEvidenceV3,
): FilingParserCrossEngineExecutionEvidenceV3 {
  try {
    return normalizeEvidenceV3(value);
  } catch {
    return invalid();
  }
}

/** @internal Closed, value-free live-acceptance validation seam for v3. */
export function createFilingParserCrossEngineExecutionEvidenceV3ForAcceptance(
  value: FilingParserCrossEngineExecutionEvidenceV3,
  markStage: FilingParserCrossEngineExecutionEvidenceV3ValidationStageMarker,
): FilingParserCrossEngineExecutionEvidenceV3 {
  try {
    const staged = normalizeEvidenceV3(value, markStage);
    return normalizeEvidenceV3(staged);
  } catch {
    return invalid();
  }
}

/** @internal Parses the canonical one-line Cycle 2m evidence artifact. */
export function parseCanonicalFilingParserCrossEngineExecutionEvidenceV3(
  bytes: Uint8Array,
): FilingParserCrossEngineExecutionEvidenceV3 {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return invalid();
  }
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n"))
    return invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(0, -1)) as unknown;
  } catch {
    return invalid();
  }
  try {
    const evidence = normalizeEvidenceV3(parsed);
    if (
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(evidence) !==
      text
    )
      return invalid();
    return evidence;
  } catch {
    return invalid();
  }
}

/** @internal Serializes the canonical one-line Cycle 2m evidence artifact. */
export function serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(
  evidence: FilingParserCrossEngineExecutionEvidenceV3,
): string {
  try {
    return `${canonicalJson(normalizeEvidenceV3(evidence))}\n`;
  } catch {
    return invalid();
  }
}

/** @internal Computes the digest of the exact canonical Cycle 2m artifact. */
export function filingParserCrossEngineExecutionEvidenceV3Sha256(
  evidence: FilingParserCrossEngineExecutionEvidenceV3,
): `sha256:${string}` {
  try {
    return sha256(
      new TextEncoder().encode(
        serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(evidence),
      ),
    );
  } catch {
    return invalid();
  }
}

/** @internal Independently recomputes one direct Docker lifecycle receipt. */
export function filingParserCrossEngineExecutionV3LifecycleBindingSha256(value: {
  readonly archiveSha256: `sha256:${string}`;
  readonly containerIdSha256: `sha256:${string}`;
  readonly documentRole: "amendment" | "original";
  readonly documentSha256: `sha256:${string}`;
  readonly engineId: string;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly keyId: string;
  readonly publicKeySpkiSha256: `sha256:${string}`;
  readonly role: "node-secondary" | "python-primary";
  readonly zeroResidue: true;
}): `sha256:${string}` {
  return domainCanonicalSha256(V3_LIFECYCLE_BINDING_DOMAIN, value, false);
}

/** @internal Independently recomputes one direct cross-engine invocation. */
export function filingParserCrossEngineExecutionV3InvocationBindingSha256(value: {
  readonly agreementSha256: `sha256:${string}`;
  readonly executionMode: "source_owned_direct_docker";
  readonly keyId: string;
  readonly lifecycleReceipts: readonly [
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
    FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
  ];
  readonly normalizationSha256: `sha256:${string}`;
  readonly publicKeySpkiSha256: `sha256:${string}`;
}): `sha256:${string}` {
  return domainCanonicalSha256(V3_INVOCATION_BINDING_DOMAIN, value, false);
}

/** @internal Exact v3 source-inventory projection shared by model and runner. */
export function filingParserCrossEngineExecutionV3RequiredSourcePaths(
  transition: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[],
): readonly string[] {
  return Object.freeze(
    [
      ...new Set([
        ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SOURCE_PATHS,
        ...transition.map((entry) => entry.path),
      ]),
    ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

function normalizeEvidenceV4(
  value: unknown,
  markStage?: FilingParserCrossEngineExecutionEvidenceV4ValidationStageMarker,
): FilingParserCrossEngineExecutionEvidenceV4 {
  markStage?.("root_contract");
  const root = exactRecord(value, [
    "baseline",
    "caseOutcomes",
    "checksPassed",
    "claim",
    "completedAt",
    "compositionValidation",
    "engines",
    "evidenceVersion",
    "fixtureManifestSha256",
    "historicalV1",
    "historicalV2",
    "historicalV3",
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceHashes",
    "startedAt",
    "status",
    "summary",
    "synthetic",
    "tools",
    "transition",
    "workflow",
  ]);
  if (
    root.schemaVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SCHEMA_VERSION ||
    root.evidenceVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VERSION ||
    root.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE ||
    root.claim !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM ||
    root.status !== "passed" ||
    root.synthetic !== true ||
    !REPOSITORY.test(string(root.repository)) ||
    !COMMIT.test(string(root.revision)) ||
    root.revision ===
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE ||
    !HASH.test(string(root.fixtureManifestSha256))
  )
    return invalid();

  markStage?.("timestamps");
  const startedAt = string(root.startedAt);
  const completedAt = string(root.completedAt);
  if (
    !isExactUtc(startedAt) ||
    !isExactUtc(completedAt) ||
    completedAt < startedAt
  )
    return invalid();

  markStage?.("claim_tuples");
  exactStringTuple(
    root.checksPassed,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS,
  );
  exactStringTuple(
    root.notProven,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN,
  );

  markStage?.("historical_evidence");
  if (
    canonicalJson(root.historicalV1) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY) ||
    canonicalJson(root.historicalV2) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY) ||
    canonicalJson(root.historicalV3) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY)
  )
    return invalid();

  markStage?.("composition_validation");
  const compositionValidation = exactRecord(root.compositionValidation, [
    "callerInjectionSurface",
    "candidatePopulation",
    "outerBindings",
    "precommitment",
    "qualityEvaluation",
    "sourceExecution",
  ]);
  if (
    compositionValidation.callerInjectionSurface !== "none" ||
    compositionValidation.candidatePopulation !==
      "exact_two_observed_ninety_eight_omitted" ||
    compositionValidation.outerBindings !== "recomputed_exact" ||
    compositionValidation.precommitment !== "one_shot_reference_digest_only" ||
    compositionValidation.qualityEvaluation !==
      "fixed_denominator_evaluated_not_met" ||
    compositionValidation.sourceExecution !==
      "cycle2m_source_owned_direct_docker"
  )
    return invalid();

  markStage?.("case_outcomes");
  const outcomes = array(root.caseOutcomes).map(normalizeOutcomeV4);
  if (
    outcomes.length !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS.length ||
    outcomes.some(
      (outcome, index) =>
        outcome.caseId !==
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS[index],
    )
  )
    return invalid();

  markStage?.("transition");
  const transition = normalizeTransitionV2(root.transition);
  if (
    canonicalJson(transition.entries) !==
    canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION)
  )
    return invalid();
  const compositionPaths = transition.entries
    .filter((entry) =>
      entry.path.startsWith("packages/filing-parser-quality-composition/"),
    )
    .map((entry) => entry.path);
  if (
    canonicalJson(compositionPaths) !==
    canonicalJson(FILING_PARSER_QUALITY_COMPOSITION_EXACT_SOURCE_PATHS)
  )
    return invalid();

  markStage?.("runtime");
  normalizeRuntimeV4(root.runtime);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionV4RequiredSourcePaths(transition.entries);
  markStage?.("source_hashes");
  const sourceHashes = normalizeSourceHashes(
    root.sourceHashes,
    requiredSourcePaths,
  );

  markStage?.("engines");
  const engines = array(root.engines).map(normalizeEngine);
  if (
    engines.length !== 2 ||
    engines[0]?.role !== "python-primary" ||
    engines[1]?.role !== "node-secondary" ||
    engines[0].builtImageId === engines[1].builtImageId ||
    engines[0].implementationSha256 === engines[1].implementationSha256 ||
    engines[0].engineId === engines[1].engineId
  )
    return invalid();
  for (const engine of engines) {
    const paths =
      engine.role === "python-primary"
        ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python
        : FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node;
    const projected = paths.map((path) => {
      const source = sourceHashes.find((entry) => entry.path === path);
      return source ?? invalid();
    });
    if (
      canonicalJson(engine.implementationSourceHashes) !==
      canonicalJson(projected)
    )
      return invalid();
  }

  markStage?.("source_bindings");
  validateV4SuccessBindings(outcomes[0]);
  markStage?.("quality_bindings");

  markStage?.("fixture_binding");
  const fixtureManifest = sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v4/manifest.json",
  );
  if (fixtureManifest?.sha256 !== root.fixtureManifestSha256) return invalid();

  markStage?.("summary");
  const summary = exactRecord(root.summary, [
    "candidateCommitmentsStable",
    "candidateObservationsStable",
    "compositionBindingsDistinct",
    "evaluatedNotMet",
    "lifecycleBindingsDistinct",
    "measurementStable",
    "quarantined",
    "total",
  ]);
  if (
    summary.candidateCommitmentsStable !== true ||
    summary.candidateObservationsStable !== true ||
    summary.compositionBindingsDistinct !== true ||
    summary.evaluatedNotMet !== 1 ||
    summary.lifecycleBindingsDistinct !== true ||
    summary.measurementStable !== true ||
    summary.quarantined !== 5 ||
    summary.total !== 6
  )
    return invalid();

  markStage?.("tools_contract");
  const tools = exactRecord(root.tools, [
    "dockerClient",
    "dockerServer",
    "git",
    "node",
    "pnpm",
    "python",
  ]);
  if (
    [
      tools.dockerClient,
      tools.dockerServer,
      tools.git,
      tools.node,
      tools.pnpm,
      tools.python,
    ].some((tool) => !VERSION.test(string(tool)))
  )
    return invalid();

  markStage?.("workflow");
  const workflow = exactRecord(root.workflow, [
    "artifactName",
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !/^[A-Za-z0-9._-]{1,240}$/u.test(string(workflow.artifactName)) ||
    !["push", "workflow_dispatch"].includes(string(workflow.event)) ||
    workflow.job !== "acceptance" ||
    !VERSION.test(string(workflow.ref)) ||
    !positiveInteger(workflow.runAttempt) ||
    !/^[1-9][0-9]{0,19}$/u.test(string(workflow.runId)) ||
    workflow.workflowName !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_WORKFLOW ||
    workflow.artifactName !==
      `filing-parser-cross-engine-execution-evidence-v4-${String(root.revision)}-${String(workflow.runAttempt)}`
  )
    return invalid();

  markStage?.("canonical_freeze");
  return deepFreeze(
    JSON.parse(
      canonicalJson(root),
    ) as FilingParserCrossEngineExecutionEvidenceV4,
  );
}

function normalizeOutcomeV4(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV4CaseOutcome {
  const outcome = exactRecord(value, [
    "candidateCommitmentsStable",
    "candidateObservationsStable",
    "caseId",
    "compositionBindingsDistinct",
    "expectedStatus",
    "invocations",
    "lifecycleBindingsDistinct",
    "measurementStable",
    "observedStatus",
  ]);
  if (
    !FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS.includes(
      outcome.caseId as FilingParserCrossEngineExecutionEvidenceV4CaseId,
    )
  )
    return invalid();
  const success =
    outcome.caseId ===
    "same-input-quality-evaluation-distinct-lifecycle-invocations";
  if (
    outcome.expectedStatus !==
      (success ? "evaluated_not_met" : "quarantined") ||
    outcome.observedStatus !== outcome.expectedStatus ||
    outcome.candidateCommitmentsStable !== success ||
    outcome.candidateObservationsStable !== success ||
    outcome.compositionBindingsDistinct !== success ||
    outcome.lifecycleBindingsDistinct !== success ||
    outcome.measurementStable !== success
  )
    return invalid();
  if (!success) {
    if (outcome.invocations !== null) return invalid();
    return outcome as unknown as FilingParserCrossEngineExecutionEvidenceV4CaseOutcome;
  }
  const invocations = array(outcome.invocations).map(normalizeInvocationV4);
  if (invocations.length !== 2) return invalid();
  return Object.freeze({
    ...outcome,
    invocations: Object.freeze(invocations),
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV4CaseOutcome;
}

function normalizeInvocationV4(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV4Invocation {
  const invocation = exactRecord(value, [
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "compositionCommitmentSha256",
    "declaredReferenceSha256",
    "evaluationBindingSha256",
    "measurementEvaluationSha256",
    "planSha256",
    "projectionReceipts",
    "qualityAccounting",
    "qualityEvaluationBindingSha256",
    "sourceExecution",
  ]);
  for (const key of [
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "compositionCommitmentSha256",
    "declaredReferenceSha256",
    "evaluationBindingSha256",
    "measurementEvaluationSha256",
    "planSha256",
    "qualityEvaluationBindingSha256",
  ] as const) {
    if (!HASH.test(string(invocation[key]))) return invalid();
  }
  const sourceExecution = normalizeSourceExecutionV4(
    invocation.sourceExecution,
  );
  const projectionReceipts = array(invocation.projectionReceipts).map(
    (receipt, index) =>
      normalizeProjectionReceiptV4(receipt, index, sourceExecution),
  );
  if (
    projectionReceipts.length !== 2 ||
    projectionReceipts[0]?.sourceArchiveSha256 ===
      projectionReceipts[1]?.sourceArchiveSha256 ||
    projectionReceipts[0]?.sourceDocumentSha256 ===
      projectionReceipts[1]?.sourceDocumentSha256 ||
    projectionReceipts[0]?.qualityDocumentSha256 ===
      projectionReceipts[1]?.qualityDocumentSha256 ||
    projectionReceipts[0]?.observationSha256 ===
      projectionReceipts[1]?.observationSha256 ||
    projectionReceipts[0]?.projectionBindingSha256 ===
      projectionReceipts[1]?.projectionBindingSha256
  )
    return invalid();
  const qualityAccounting = normalizeQualityAccountingV4(
    invocation.qualityAccounting,
  );
  const expectedInnerBindings = v4ExpectedInnerBindings(qualityAccounting);
  const normalized = Object.freeze({
    ...invocation,
    projectionReceipts: Object.freeze(projectionReceipts),
    qualityAccounting,
    sourceExecution,
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV4Invocation;
  if (
    normalized.planSha256 !== V4_PLAN_SHA256 ||
    normalized.declaredReferenceSha256 !== V4_DECLARED_REFERENCE_SHA256 ||
    normalized.candidateObservationsSha256 !==
      expectedInnerBindings.candidateObservationsSha256 ||
    normalized.candidateCommitmentSha256 !==
      expectedInnerBindings.candidateCommitmentSha256 ||
    normalized.measurementEvaluationSha256 !==
      expectedInnerBindings.measurementEvaluationSha256 ||
    normalized.qualityEvaluationBindingSha256 !==
      expectedInnerBindings.qualityEvaluationBindingSha256 ||
    normalized.compositionCommitmentSha256 !==
      filingParserCrossEngineExecutionV4CompositionCommitmentSha256(
        normalized,
      ) ||
    normalized.evaluationBindingSha256 !==
      filingParserCrossEngineExecutionV4EvaluationBindingSha256(normalized)
  )
    return invalid();
  return normalized;
}

function normalizeSourceExecutionV4(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV4SourceExecution {
  const source = exactRecord(value, [
    "agreementSha256",
    "directExecutionClaim",
    "directExecutionSchemaVersion",
    "ephemeralPublicKeySpkiSha256",
    "executionMode",
    "invocationBindingSha256",
    "lifecycleBindingSha256s",
    "normalizationSha256",
  ]);
  if (
    !HASH.test(string(source.agreementSha256)) ||
    source.directExecutionClaim !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM ||
    source.directExecutionSchemaVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_DIRECT_EXECUTION_SCHEMA_VERSION ||
    !HASH.test(string(source.ephemeralPublicKeySpkiSha256)) ||
    source.executionMode !== "source_owned_direct_docker" ||
    !HASH.test(string(source.invocationBindingSha256)) ||
    !HASH.test(string(source.normalizationSha256))
  )
    return invalid();
  const lifecycleBindingSha256s = array(source.lifecycleBindingSha256s).map(
    (binding) => string(binding),
  );
  if (
    lifecycleBindingSha256s.length !== 4 ||
    lifecycleBindingSha256s.some((binding) => !HASH.test(binding)) ||
    new Set(lifecycleBindingSha256s).size !== 4
  )
    return invalid();
  return Object.freeze({
    ...source,
    lifecycleBindingSha256s: Object.freeze(lifecycleBindingSha256s),
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV4SourceExecution;
}

function normalizeProjectionReceiptV4(
  value: unknown,
  index: number,
  sourceExecution: FilingParserCrossEngineExecutionEvidenceV4SourceExecution,
): FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt {
  const receipt = exactRecord(value, [
    "documentRole",
    "factCount",
    "observationSha256",
    "projectionBindingSha256",
    "qualityDocumentId",
    "qualityDocumentSha256",
    "sourceArchiveSha256",
    "sourceDocumentSha256",
    "sourceLifecycleBindingSha256s",
  ]);
  const expectedRole = index === 0 ? "original" : "amendment";
  const expectedQualityDocumentId =
    index === 0 ? "synthetic-filing-0001" : "synthetic-filing-0002";
  if (
    receipt.documentRole !== expectedRole ||
    receipt.factCount !== 10 ||
    receipt.qualityDocumentId !== expectedQualityDocumentId ||
    !HASH.test(string(receipt.observationSha256)) ||
    receipt.observationSha256 !==
      v4CandidateObservationSha256(index === 0 ? 0 : 1) ||
    !HASH.test(string(receipt.projectionBindingSha256)) ||
    !HASH.test(string(receipt.qualityDocumentSha256)) ||
    receipt.qualityDocumentSha256 !==
      filingParserCrossEngineExecutionV4QualityDocumentSha256(
        expectedQualityDocumentId,
      ) ||
    !HASH.test(string(receipt.sourceArchiveSha256)) ||
    !HASH.test(string(receipt.sourceDocumentSha256))
  )
    return invalid();
  const sourceLifecycleBindingSha256s = array(
    receipt.sourceLifecycleBindingSha256s,
  ).map((binding) => string(binding));
  const expectedLifecycleBindings =
    index === 0
      ? [
          sourceExecution.lifecycleBindingSha256s[0],
          sourceExecution.lifecycleBindingSha256s[2],
        ]
      : [
          sourceExecution.lifecycleBindingSha256s[1],
          sourceExecution.lifecycleBindingSha256s[3],
        ];
  if (
    sourceLifecycleBindingSha256s.length !== 2 ||
    canonicalJson(sourceLifecycleBindingSha256s) !==
      canonicalJson(expectedLifecycleBindings)
  )
    return invalid();
  const normalized = Object.freeze({
    ...receipt,
    sourceLifecycleBindingSha256s: Object.freeze(sourceLifecycleBindingSha256s),
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV4ProjectionReceipt;
  const { projectionBindingSha256, ...preimage } = normalized;
  if (
    projectionBindingSha256 !==
    filingParserCrossEngineExecutionV4ProjectionBindingSha256(preimage)
  )
    return invalid();
  return normalized;
}

function normalizeQualityAccountingV4(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV4Invocation["qualityAccounting"] {
  const quality = exactRecord(value, [
    "counts",
    "failedThresholds",
    "metrics",
    "syntheticPilotThresholdOutcome",
  ]);
  const counts = exactRecord(quality.counts, [
    "conceptMismatchCount",
    "criticalAssertionCount",
    "dimensionMismatchCount",
    "documentCount",
    "emittedFactCount",
    "expectedFactCount",
    "falseNegativeFactCount",
    "falsePositiveFactCount",
    "missingDocumentCount",
    "missingFactCount",
    "periodMismatchCount",
    "quarantinedDocumentCount",
    "semanticAssertionPassCount",
    "silentCriticalFailureCount",
    "succeededDocumentCount",
    "truePositiveFactCount",
    "unitMismatchCount",
    "unitPeriodAssertionPassCount",
    "valueMismatchCount",
  ]);
  if (
    canonicalJson(counts) !==
    canonicalJson({
      conceptMismatchCount: 0,
      criticalAssertionCount: 2_000,
      dimensionMismatchCount: 0,
      documentCount: 100,
      emittedFactCount: 20,
      expectedFactCount: 1_000,
      falseNegativeFactCount: 980,
      falsePositiveFactCount: 0,
      missingDocumentCount: 98,
      missingFactCount: 980,
      periodMismatchCount: 0,
      quarantinedDocumentCount: 0,
      semanticAssertionPassCount: 20,
      silentCriticalFailureCount: 1_960,
      succeededDocumentCount: 2,
      truePositiveFactCount: 20,
      unitMismatchCount: 0,
      unitPeriodAssertionPassCount: 20,
      valueMismatchCount: 0,
    })
  )
    return invalid();
  exactStringTuple(quality.failedThresholds, [
    "document_success_minimum",
    "fact_recall_minimum",
    "maximum_silent_critical_failures",
  ]);
  const metrics = exactRecord(quality.metrics, [
    "documentSuccess",
    "factPrecision",
    "factRecall",
    "quarantineRate",
    "silentCriticalFailure",
    "unitDateTolerance",
  ]);
  normalizeRatioAccountingV4(
    metrics.documentSuccess,
    2,
    100,
    false,
    95,
    100,
    "minimum",
  );
  normalizeRatioAccountingV4(
    metrics.factPrecision,
    20,
    20,
    true,
    99,
    100,
    "minimum",
  );
  normalizeRatioAccountingV4(
    metrics.factRecall,
    20,
    1_000,
    false,
    99,
    100,
    "minimum",
  );
  normalizeRatioAccountingV4(
    metrics.quarantineRate,
    0,
    100,
    true,
    5,
    100,
    "maximum",
  );
  const silent = exactRecord(metrics.silentCriticalFailure, [
    "count",
    "denominator",
    "maximumCount",
    "met",
  ]);
  const unitDate = exactRecord(metrics.unitDateTolerance, [
    "dateToleranceDays",
    "periodMismatchCount",
    "unitMismatchCount",
    "unitTolerancePolicy",
  ]);
  if (
    silent.count !== 1_960 ||
    silent.denominator !== 2_000 ||
    silent.maximumCount !== 0 ||
    silent.met !== false ||
    unitDate.dateToleranceDays !== 0 ||
    unitDate.periodMismatchCount !== 0 ||
    unitDate.unitMismatchCount !== 0 ||
    unitDate.unitTolerancePolicy !== "exact_canonical_unit.v1" ||
    quality.syntheticPilotThresholdOutcome !== "not_met"
  )
    return invalid();
  return quality as unknown as FilingParserCrossEngineExecutionEvidenceV4Invocation["qualityAccounting"];
}

function normalizeRatioAccountingV4(
  value: unknown,
  numerator: number,
  denominator: number,
  met: boolean,
  thresholdNumerator: number,
  thresholdDenominator: number,
  thresholdKind: "maximum" | "minimum",
): void {
  const ratio = exactRecord(value, [
    "defined",
    "denominator",
    "met",
    "numerator",
    "threshold",
    "thresholdKind",
  ]);
  const threshold = exactRecord(ratio.threshold, ["denominator", "numerator"]);
  if (
    ratio.defined !== true ||
    ratio.numerator !== numerator ||
    ratio.denominator !== denominator ||
    ratio.met !== met ||
    threshold.numerator !== thresholdNumerator ||
    threshold.denominator !== thresholdDenominator ||
    ratio.thresholdKind !== thresholdKind
  )
    return invalid();
}

function validateV4SuccessBindings(
  outcome: FilingParserCrossEngineExecutionEvidenceV4CaseOutcome | undefined,
): void {
  const invocations = outcome?.invocations;
  if (
    outcome === undefined ||
    invocations === null ||
    invocations === undefined ||
    invocations.length !== 2
  )
    return invalid();
  const first = invocations[0];
  const second = invocations[1];
  if (
    first.candidateCommitmentSha256 !== second.candidateCommitmentSha256 ||
    first.candidateObservationsSha256 !== second.candidateObservationsSha256 ||
    first.declaredReferenceSha256 !== second.declaredReferenceSha256 ||
    first.measurementEvaluationSha256 !== second.measurementEvaluationSha256 ||
    first.planSha256 !== second.planSha256 ||
    first.qualityEvaluationBindingSha256 !==
      second.qualityEvaluationBindingSha256 ||
    canonicalJson(first.qualityAccounting) !==
      canonicalJson(second.qualityAccounting) ||
    first.sourceExecution.agreementSha256 ===
      second.sourceExecution.agreementSha256 ||
    first.sourceExecution.normalizationSha256 !==
      second.sourceExecution.normalizationSha256 ||
    first.compositionCommitmentSha256 === second.compositionCommitmentSha256 ||
    first.evaluationBindingSha256 === second.evaluationBindingSha256 ||
    first.sourceExecution.ephemeralPublicKeySpkiSha256 ===
      second.sourceExecution.ephemeralPublicKeySpkiSha256 ||
    first.sourceExecution.invocationBindingSha256 ===
      second.sourceExecution.invocationBindingSha256 ||
    new Set([
      ...first.sourceExecution.lifecycleBindingSha256s,
      ...second.sourceExecution.lifecycleBindingSha256s,
    ]).size !== 8
  )
    return invalid();
  for (let index = 0; index < 2; index += 1) {
    const left = first.projectionReceipts[index];
    const right = second.projectionReceipts[index];
    if (
      left === undefined ||
      right === undefined ||
      left.documentRole !== right.documentRole ||
      left.factCount !== right.factCount ||
      left.qualityDocumentId !== right.qualityDocumentId ||
      left.qualityDocumentSha256 !== right.qualityDocumentSha256 ||
      left.observationSha256 !== right.observationSha256 ||
      left.sourceArchiveSha256 !== right.sourceArchiveSha256 ||
      left.sourceDocumentSha256 !== right.sourceDocumentSha256 ||
      left.projectionBindingSha256 === right.projectionBindingSha256 ||
      canonicalJson(left.sourceLifecycleBindingSha256s) ===
        canonicalJson(right.sourceLifecycleBindingSha256s)
    )
      return invalid();
  }
}

function normalizeRuntimeV4(value: unknown): void {
  const runtime = exactRecord(value, [
    "capabilitiesDropped",
    "compositionCommitCount",
    "engineCount",
    "networkMode",
    "readOnlyRootFilesystem",
    "successfulEvaluationCount",
    "successfulLifecycleReceiptCount",
    "successfulTwoDocumentObservationCount",
    "zeroResidue",
  ]);
  exactStringTuple(runtime.capabilitiesDropped, ["ALL"]);
  if (
    runtime.compositionCommitCount !== 4 ||
    runtime.engineCount !== 2 ||
    runtime.networkMode !== "none" ||
    runtime.readOnlyRootFilesystem !== true ||
    runtime.successfulEvaluationCount !== 3 ||
    runtime.successfulLifecycleReceiptCount !== 16 ||
    runtime.successfulTwoDocumentObservationCount !== 4 ||
    runtime.zeroResidue !== true
  )
    return invalid();
}

function normalizeEvidenceV3(
  value: unknown,
  markStage?: FilingParserCrossEngineExecutionEvidenceV3ValidationStageMarker,
): FilingParserCrossEngineExecutionEvidenceV3 {
  markStage?.("root_contract");
  const root = exactRecord(value, [
    "baseline",
    "caseOutcomes",
    "checksPassed",
    "claim",
    "completedAt",
    "directExecutionValidation",
    "engines",
    "evidenceVersion",
    "fixtureManifestSha256",
    "historicalV1",
    "historicalV2",
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceHashes",
    "startedAt",
    "status",
    "summary",
    "synthetic",
    "tools",
    "transition",
    "workflow",
  ]);
  if (
    root.schemaVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION ||
    root.evidenceVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VERSION ||
    root.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE ||
    root.claim !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM ||
    root.status !== "passed" ||
    root.synthetic !== true ||
    !REPOSITORY.test(string(root.repository)) ||
    !COMMIT.test(string(root.revision)) ||
    !HASH.test(string(root.fixtureManifestSha256))
  )
    return invalid();

  markStage?.("timestamps");
  const startedAt = string(root.startedAt);
  const completedAt = string(root.completedAt);
  if (
    !isExactUtc(startedAt) ||
    !isExactUtc(completedAt) ||
    completedAt < startedAt
  )
    return invalid();

  markStage?.("claim_tuples");
  exactStringTuple(
    root.checksPassed,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
  );
  exactStringTuple(
    root.notProven,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
  );

  markStage?.("historical_evidence");
  if (
    canonicalJson(root.historicalV1) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY) ||
    canonicalJson(root.historicalV2) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY)
  )
    return invalid();

  markStage?.("direct_execution_validation");
  const direct = exactRecord(root.directExecutionValidation, [
    "callerInjectionSurface",
    "configurationSnapshot",
    "lifecycleBinding",
    "outerInvocationBinding",
    "processExecution",
    "signer",
  ]);
  if (
    direct.callerInjectionSurface !== "none" ||
    direct.configurationSnapshot !== "intrinsic_closed_exact" ||
    direct.lifecycleBinding !== "recomputed_exact" ||
    direct.outerInvocationBinding !== "recomputed_exact" ||
    direct.processExecution !== "package_owned_bounded_shell_false" ||
    direct.signer !== "internally_generated_ephemeral_ed25519"
  )
    return invalid();

  markStage?.("case_outcomes");
  const outcomes = array(root.caseOutcomes).map(normalizeOutcomeV3);
  if (
    outcomes.length !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS.length ||
    outcomes.some(
      (outcome, index) =>
        outcome.caseId !==
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS[index],
    )
  )
    return invalid();

  markStage?.("transition");
  const transition = normalizeTransitionV2(root.transition);
  markStage?.("runtime");
  normalizeRuntimeV3(root.runtime);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionV3RequiredSourcePaths(transition.entries);
  markStage?.("source_hashes");
  const sourceHashes = normalizeSourceHashes(
    root.sourceHashes,
    requiredSourcePaths,
  );

  markStage?.("engines");
  const engines = array(root.engines).map(normalizeEngine);
  if (
    engines.length !== 2 ||
    engines[0]?.role !== "python-primary" ||
    engines[1]?.role !== "node-secondary" ||
    engines[0].builtImageId === engines[1].builtImageId ||
    engines[0].implementationSha256 === engines[1].implementationSha256 ||
    engines[0].engineId === engines[1].engineId
  )
    return invalid();
  for (const engine of engines) {
    const paths =
      engine.role === "python-primary"
        ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python
        : FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node;
    const projected = paths.map((path) => {
      const source = sourceHashes.find((entry) => entry.path === path);
      return source ?? invalid();
    });
    if (
      canonicalJson(engine.implementationSourceHashes) !==
      canonicalJson(projected)
    )
      return invalid();
  }
  markStage?.("lifecycle_bindings");
  validateV3SuccessBindings(outcomes[0], engines);
  markStage?.("outer_invocation_bindings");

  markStage?.("fixture_binding");
  const fixtureManifest = sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v3/manifest.json",
  );
  if (fixtureManifest?.sha256 !== root.fixtureManifestSha256) return invalid();

  markStage?.("summary");
  const summary = exactRecord(root.summary, [
    "agreed",
    "invocationBindingsDistinct",
    "lifecycleBindingsDistinct",
    "normalizationStable",
    "quarantined",
    "total",
  ]);
  if (
    summary.agreed !== 1 ||
    summary.invocationBindingsDistinct !== true ||
    summary.lifecycleBindingsDistinct !== true ||
    summary.normalizationStable !== true ||
    summary.quarantined !== 5 ||
    summary.total !== 6
  )
    return invalid();

  markStage?.("tools_contract");
  const tools = exactRecord(root.tools, [
    "dockerClient",
    "dockerServer",
    "git",
    "node",
    "pnpm",
    "python",
  ]);
  if (
    [
      tools.dockerClient,
      tools.dockerServer,
      tools.git,
      tools.node,
      tools.pnpm,
      tools.python,
    ].some((tool) => !VERSION.test(string(tool)))
  )
    return invalid();

  markStage?.("workflow");
  const workflow = exactRecord(root.workflow, [
    "artifactName",
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !/^[A-Za-z0-9._-]{1,240}$/u.test(string(workflow.artifactName)) ||
    !["push", "workflow_dispatch"].includes(string(workflow.event)) ||
    workflow.job !== "acceptance" ||
    !VERSION.test(string(workflow.ref)) ||
    !positiveInteger(workflow.runAttempt) ||
    !/^[1-9][0-9]{0,19}$/u.test(string(workflow.runId)) ||
    workflow.workflowName !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW ||
    workflow.artifactName !==
      `filing-parser-cross-engine-execution-evidence-v3-${String(root.revision)}-${String(workflow.runAttempt)}`
  )
    return invalid();

  markStage?.("canonical_freeze");
  return deepFreeze(
    JSON.parse(
      canonicalJson(root),
    ) as FilingParserCrossEngineExecutionEvidenceV3,
  );
}

function normalizeOutcomeV3(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV3CaseOutcome {
  const outcome = exactRecord(value, [
    "amendmentArchiveSha256",
    "caseId",
    "expectedStatus",
    "factVersionCount",
    "invocationBindingsDistinct",
    "invocations",
    "lifecycleBindingsDistinct",
    "lineageCount",
    "normalizationStable",
    "observedStatus",
    "originalArchiveSha256",
  ]);
  if (
    !FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS.includes(
      outcome.caseId as FilingParserCrossEngineExecutionEvidenceV3CaseId,
    )
  )
    return invalid();
  const success =
    outcome.caseId ===
    "same-input-direct-docker-distinct-lifecycle-invocations";
  if (
    outcome.expectedStatus !== (success ? "agreed" : "quarantined") ||
    outcome.observedStatus !== outcome.expectedStatus ||
    outcome.invocationBindingsDistinct !== success ||
    outcome.lifecycleBindingsDistinct !== success ||
    outcome.normalizationStable !== success
  )
    return invalid();
  if (!success) {
    if (
      outcome.amendmentArchiveSha256 !== null ||
      outcome.factVersionCount !== null ||
      outcome.invocations !== null ||
      outcome.lineageCount !== null ||
      outcome.originalArchiveSha256 !== null
    )
      return invalid();
    return outcome as unknown as FilingParserCrossEngineExecutionEvidenceV3CaseOutcome;
  }
  if (
    !HASH.test(string(outcome.originalArchiveSha256)) ||
    !HASH.test(string(outcome.amendmentArchiveSha256)) ||
    outcome.originalArchiveSha256 === outcome.amendmentArchiveSha256 ||
    outcome.factVersionCount !== 20 ||
    outcome.lineageCount !== 10
  )
    return invalid();
  const invocations = array(outcome.invocations).map(normalizeInvocationV3);
  if (invocations.length !== 2) return invalid();
  return Object.freeze({
    ...outcome,
    invocations: Object.freeze(invocations),
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV3CaseOutcome;
}

function normalizeInvocationV3(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV3Invocation {
  const invocation = exactRecord(value, [
    "agreementEngines",
    "agreementSha256",
    "executionMode",
    "invocationBindingSha256",
    "keyId",
    "lifecycleReceipts",
    "normalizationSha256",
    "publicKeySpkiSha256",
    "resultSha256",
  ]);
  if (
    !HASH.test(string(invocation.agreementSha256)) ||
    invocation.executionMode !== "source_owned_direct_docker" ||
    !HASH.test(string(invocation.invocationBindingSha256)) ||
    invocation.keyId !== V3_LIVE_KEY_ID ||
    !HASH.test(string(invocation.normalizationSha256)) ||
    !HASH.test(string(invocation.publicKeySpkiSha256)) ||
    !HASH.test(string(invocation.resultSha256))
  )
    return invalid();
  const agreementEngines = array(invocation.agreementEngines).map(
    (engineValue, index) => normalizeAgreementEngineV3(engineValue, index),
  );
  const lifecycleReceipts = array(invocation.lifecycleReceipts).map(
    normalizeLifecycleReceiptV3,
  );
  if (agreementEngines.length !== 2 || lifecycleReceipts.length !== 4)
    return invalid();
  return Object.freeze({
    ...invocation,
    agreementEngines: Object.freeze(agreementEngines),
    lifecycleReceipts: Object.freeze(lifecycleReceipts),
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV3Invocation;
}

function normalizeAgreementEngineV3(
  value: unknown,
  index: number,
): FilingParserCrossEngineExecutionEvidenceV3Invocation["agreementEngines"][number] {
  const engine = exactRecord(value, [
    "engineId",
    "executionBindingSha256",
    "imageSha256",
    "implementationSha256",
    "role",
  ]);
  const expectedRole = index === 0 ? "python-primary" : "node-secondary";
  if (
    !ENGINE.test(string(engine.engineId)) ||
    !HASH.test(string(engine.executionBindingSha256)) ||
    !HASH.test(string(engine.imageSha256)) ||
    !HASH.test(string(engine.implementationSha256)) ||
    engine.role !== expectedRole
  )
    return invalid();
  return engine as unknown as FilingParserCrossEngineExecutionEvidenceV3Invocation["agreementEngines"][number];
}

function normalizeLifecycleReceiptV3(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt {
  const receipt = exactRecord(value, [
    "archiveSha256",
    "containerIdSha256",
    "documentRole",
    "documentSha256",
    "engineId",
    "imageSha256",
    "implementationSha256",
    "keyId",
    "lifecycleBindingSha256",
    "publicKeySpkiSha256",
    "role",
    "zeroResidue",
  ]);
  if (
    !HASH.test(string(receipt.archiveSha256)) ||
    !HASH.test(string(receipt.containerIdSha256)) ||
    !["amendment", "original"].includes(string(receipt.documentRole)) ||
    !HASH.test(string(receipt.documentSha256)) ||
    !ENGINE.test(string(receipt.engineId)) ||
    !HASH.test(string(receipt.imageSha256)) ||
    !HASH.test(string(receipt.implementationSha256)) ||
    receipt.keyId !== V3_LIVE_KEY_ID ||
    !HASH.test(string(receipt.lifecycleBindingSha256)) ||
    !HASH.test(string(receipt.publicKeySpkiSha256)) ||
    !["node-secondary", "python-primary"].includes(string(receipt.role)) ||
    receipt.zeroResidue !== true
  )
    return invalid();
  const expected = filingParserCrossEngineExecutionV3LifecycleBindingSha256({
    archiveSha256: receipt.archiveSha256 as `sha256:${string}`,
    containerIdSha256: receipt.containerIdSha256 as `sha256:${string}`,
    documentRole: receipt.documentRole as "amendment" | "original",
    documentSha256: receipt.documentSha256 as `sha256:${string}`,
    engineId: string(receipt.engineId),
    imageSha256: receipt.imageSha256 as `sha256:${string}`,
    implementationSha256: receipt.implementationSha256 as `sha256:${string}`,
    keyId: string(receipt.keyId),
    publicKeySpkiSha256: receipt.publicKeySpkiSha256 as `sha256:${string}`,
    role: receipt.role as "node-secondary" | "python-primary",
    zeroResidue: true,
  });
  if (receipt.lifecycleBindingSha256 !== expected) return invalid();
  return receipt as unknown as FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt;
}

function validateV3SuccessBindings(
  outcome: FilingParserCrossEngineExecutionEvidenceV3CaseOutcome | undefined,
  engines: readonly FilingParserCrossEngineExecutionEvidenceEngine[],
): void {
  const python = engines[0];
  const node = engines[1];
  const invocations = outcome?.invocations;
  if (
    outcome === undefined ||
    python === undefined ||
    node === undefined ||
    invocations === null ||
    invocations === undefined ||
    invocations.length !== 2
  )
    return invalid();
  const containerIds = new Set<string>();
  const lifecycleBindings = new Set<string>();
  const originalDocuments: string[] = [];
  const amendmentDocuments: string[] = [];
  for (const invocation of invocations) {
    const receipts = invocation.lifecycleReceipts;
    const expectedRoles = [
      [python, "python-primary", "original"],
      [python, "python-primary", "amendment"],
      [node, "node-secondary", "original"],
      [node, "node-secondary", "amendment"],
    ] as const;
    if (
      invocation.keyId !== V3_LIVE_KEY_ID ||
      receipts.some((receipt, index) => {
        const expected = expectedRoles[index];
        if (expected === undefined) return true;
        const [engine, role, documentRole] = expected;
        return (
          receipt.role !== role ||
          receipt.documentRole !== documentRole ||
          receipt.engineId !== engine.engineId ||
          receipt.imageSha256 !== engine.builtImageId ||
          receipt.implementationSha256 !== engine.implementationSha256 ||
          receipt.keyId !== invocation.keyId ||
          receipt.publicKeySpkiSha256 !== invocation.publicKeySpkiSha256 ||
          receipt.archiveSha256 !==
            (documentRole === "original"
              ? outcome.originalArchiveSha256
              : outcome.amendmentArchiveSha256)
        );
      })
    )
      return invalid();
    for (const receipt of receipts) {
      containerIds.add(receipt.containerIdSha256);
      lifecycleBindings.add(receipt.lifecycleBindingSha256);
    }
    if (
      receipts[0].documentSha256 !== receipts[2].documentSha256 ||
      receipts[1].documentSha256 !== receipts[3].documentSha256 ||
      receipts[0].documentSha256 === receipts[1].documentSha256
    )
      return invalid();
    originalDocuments.push(receipts[0].documentSha256);
    amendmentDocuments.push(receipts[1].documentSha256);
    const agreementEngines = invocation.agreementEngines;
    if (
      agreementEngines[0].engineId !== python.engineId ||
      agreementEngines[0].imageSha256 !== python.builtImageId ||
      agreementEngines[0].implementationSha256 !==
        python.implementationSha256 ||
      agreementEngines[1].engineId !== node.engineId ||
      agreementEngines[1].imageSha256 !== node.builtImageId ||
      agreementEngines[1].implementationSha256 !== node.implementationSha256 ||
      agreementEngines[0].executionBindingSha256 ===
        agreementEngines[1].executionBindingSha256
    )
      return invalid();
    const expectedAgreement = filingParserCrossEngineExecutionV2AgreementSha256(
      {
        amendmentArchiveSha256:
          outcome.amendmentArchiveSha256 as `sha256:${string}`,
        engines: agreementEngines,
        normalizationSha256: invocation.normalizationSha256,
        originalArchiveSha256:
          outcome.originalArchiveSha256 as `sha256:${string}`,
      },
    );
    if (invocation.agreementSha256 !== expectedAgreement) return invalid();
    const expectedInvocation =
      filingParserCrossEngineExecutionV3InvocationBindingSha256({
        agreementSha256: invocation.agreementSha256,
        executionMode: invocation.executionMode,
        keyId: invocation.keyId,
        lifecycleReceipts: invocation.lifecycleReceipts,
        normalizationSha256: invocation.normalizationSha256,
        publicKeySpkiSha256: invocation.publicKeySpkiSha256,
      });
    if (invocation.invocationBindingSha256 !== expectedInvocation)
      return invalid();
  }
  if (
    containerIds.size !== 8 ||
    lifecycleBindings.size !== 8 ||
    originalDocuments[0] !== originalDocuments[1] ||
    amendmentDocuments[0] !== amendmentDocuments[1] ||
    invocations[0].normalizationSha256 !== invocations[1].normalizationSha256 ||
    invocations[0].publicKeySpkiSha256 === invocations[1].publicKeySpkiSha256 ||
    invocations[0].invocationBindingSha256 ===
      invocations[1].invocationBindingSha256 ||
    invocations[0].resultSha256 === invocations[1].resultSha256
  )
    return invalid();
}

function normalizeRuntimeV3(value: unknown): void {
  const runtime = exactRecord(value, [
    "capabilitiesDropped",
    "containerControlMilliseconds",
    "containerUser",
    "cpuCount",
    "engineCount",
    "inputMount",
    "memoryBytes",
    "networkMode",
    "noNewPrivileges",
    "noPublishedPorts",
    "openFiles",
    "pids",
    "processTerminationMilliseconds",
    "readOnlyRootFilesystem",
    "signerMilliseconds",
    "stderrLimitBytes",
    "stdoutLimitBytes",
    "successfulContainerCount",
    "successfulInvocationCount",
    "successfulLifecycleReceiptCount",
    "temporaryFilesystem",
    "uniqueContainerIdSha256Count",
    "wallClockMilliseconds",
    "zeroResidue",
  ]);
  exactStringTuple(runtime.capabilitiesDropped, ["ALL"]);
  if (
    runtime.containerControlMilliseconds !== 5_000 ||
    runtime.containerUser !== "65532:65532" ||
    runtime.cpuCount !== 0.5 ||
    runtime.engineCount !== 2 ||
    runtime.inputMount !== "/input/filing.zip:ro" ||
    runtime.memoryBytes !== 134_217_728 ||
    runtime.networkMode !== "none" ||
    runtime.noNewPrivileges !== true ||
    runtime.noPublishedPorts !== true ||
    runtime.openFiles !== 64 ||
    runtime.pids !== 32 ||
    runtime.processTerminationMilliseconds !== 250 ||
    runtime.readOnlyRootFilesystem !== true ||
    runtime.signerMilliseconds !== 5_000 ||
    runtime.stderrLimitBytes !== 4_096 ||
    runtime.stdoutLimitBytes !== 262_144 ||
    runtime.successfulContainerCount !== 8 ||
    runtime.successfulInvocationCount !== 2 ||
    runtime.successfulLifecycleReceiptCount !== 8 ||
    runtime.temporaryFilesystem !==
      "/tmp:rw,noexec,nosuid,nodev,size=8388608" ||
    runtime.uniqueContainerIdSha256Count !== 8 ||
    runtime.wallClockMilliseconds !== 5_000 ||
    runtime.zeroResidue !== true
  )
    return invalid();
}

function normalizeEvidenceV2(
  value: unknown,
  markStage?: FilingParserCrossEngineExecutionEvidenceV2ValidationStageMarker,
): FilingParserCrossEngineExecutionEvidenceV2 {
  markStage?.("root_contract");
  const root = exactRecord(value, [
    "baseline",
    "bindingValidation",
    "caseOutcomes",
    "checksPassed",
    "claim",
    "completedAt",
    "engines",
    "evidenceVersion",
    "failedPrecursorRevision",
    "failedRun",
    "fixtureManifestSha256",
    "historicalV1",
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceHashes",
    "startedAt",
    "status",
    "summary",
    "synthetic",
    "tools",
    "transition",
    "workflow",
  ]);
  if (
    root.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE ||
    root.claim !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CLAIM ||
    root.evidenceVersion !== 2 ||
    root.failedPrecursorRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION ||
    root.schemaVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SCHEMA_VERSION ||
    root.status !== "passed" ||
    root.synthetic !== true ||
    !REPOSITORY.test(string(root.repository)) ||
    !COMMIT.test(string(root.revision)) ||
    root.revision ===
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE ||
    root.revision ===
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION ||
    !HASH.test(string(root.fixtureManifestSha256))
  )
    return invalid();

  markStage?.("timestamps");
  if (
    !isExactUtc(string(root.startedAt)) ||
    !isExactUtc(string(root.completedAt)) ||
    string(root.startedAt) > string(root.completedAt)
  )
    return invalid();

  markStage?.("claim_tuples");
  exactStringTuple(
    root.checksPassed,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS,
  );
  exactStringTuple(
    root.notProven,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
  );

  markStage?.("historical_v1");
  const failedRun = exactRecord(root.failedRun, [
    "artifactCount",
    "failurePhase",
    "jobId",
    "runAttempt",
    "runId",
    "sourceRevision",
  ]);
  if (
    canonicalJson(failedRun) !==
    canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN)
  )
    return invalid();

  const historicalV1 = exactRecord(root.historicalV1, [
    "artifactId",
    "claimStatus",
    "evidenceSha256",
    "evidenceVersion",
    "jobId",
    "reason",
    "runId",
    "sourceRevision",
  ]);
  if (
    canonicalJson(historicalV1) !==
    canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY)
  )
    return invalid();

  markStage?.("binding_validation");
  const bindingValidation = exactRecord(root.bindingValidation, [
    "childReceiptArchiveBinding",
    "executionBinding",
    "handoffPairBinding",
    "injectedBoundaryAuthenticity",
    "inputFactRoleBinding",
    "lineageReciprocity",
  ]);
  if (
    bindingValidation.childReceiptArchiveBinding !== "recomputed_exact" ||
    bindingValidation.executionBinding !== "recomputed_exact" ||
    bindingValidation.handoffPairBinding !== "recomputed_exact" ||
    bindingValidation.injectedBoundaryAuthenticity !== "not_established" ||
    bindingValidation.inputFactRoleBinding !== "validated_exact" ||
    bindingValidation.lineageReciprocity !== "validated_exact"
  )
    return invalid();

  markStage?.("case_outcomes");
  const outcomes = array(root.caseOutcomes).map(normalizeOutcomeV2);
  if (
    outcomes.length !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CASE_IDS.length ||
    outcomes.some(
      (outcome, index) =>
        outcome.caseId !==
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CASE_IDS[index],
    )
  )
    return invalid();

  markStage?.("transition");
  const transition = normalizeTransitionV2(root.transition);
  markStage?.("runtime");
  normalizeRuntime(root.runtime);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionV2RequiredSourcePaths(transition.entries);
  markStage?.("source_hashes");
  const sourceHashes = normalizeSourceHashes(
    root.sourceHashes,
    requiredSourcePaths,
  );

  markStage?.("engines");
  const engines = array(root.engines).map(normalizeEngine);
  if (
    engines.length !== 2 ||
    engines[0]?.role !== "python-primary" ||
    engines[1]?.role !== "node-secondary" ||
    engines[0].builtImageId === engines[1].builtImageId ||
    engines[0].implementationSha256 === engines[1].implementationSha256 ||
    engines[0].engineId === engines[1].engineId
  )
    return invalid();
  for (const engine of engines) {
    const paths =
      engine.role === "python-primary"
        ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python
        : FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node;
    const projected = paths.map((path) => {
      const source = sourceHashes.find((entry) => entry.path === path);
      return source ?? invalid();
    });
    if (
      canonicalJson(engine.implementationSourceHashes) !==
      canonicalJson(projected)
    )
      return invalid();
  }
  validateV2SuccessReceiptBindings(outcomes[0], engines);

  markStage?.("fixture_binding");
  const fixtureManifest = sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
  );
  if (fixtureManifest?.sha256 !== root.fixtureManifestSha256) return invalid();

  markStage?.("summary");
  const summary = exactRecord(root.summary, [
    "agreed",
    "quarantined",
    "replayMatched",
    "total",
  ]);
  if (
    summary.agreed !== 1 ||
    summary.quarantined !== 5 ||
    summary.replayMatched !== true ||
    summary.total !== 6
  )
    return invalid();

  markStage?.("tools_contract");
  const tools = exactRecord(root.tools, [
    "dockerClient",
    "dockerServer",
    "git",
    "node",
    "pnpm",
    "python",
  ]);
  if (
    [
      tools.dockerClient,
      tools.dockerServer,
      tools.git,
      tools.node,
      tools.pnpm,
      tools.python,
    ].some((tool) => !VERSION.test(string(tool)))
  )
    return invalid();

  markStage?.("workflow");
  const workflow = exactRecord(root.workflow, [
    "artifactName",
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !/^[A-Za-z0-9._-]{1,240}$/u.test(string(workflow.artifactName)) ||
    !["push", "workflow_dispatch"].includes(string(workflow.event)) ||
    workflow.job !== "acceptance" ||
    !VERSION.test(string(workflow.ref)) ||
    !positiveInteger(workflow.runAttempt) ||
    !/^[1-9][0-9]{0,19}$/u.test(string(workflow.runId)) ||
    workflow.workflowName !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_WORKFLOW ||
    workflow.artifactName !==
      `filing-parser-cross-engine-execution-evidence-v2-${String(root.revision)}-${String(workflow.runAttempt)}`
  )
    return invalid();

  markStage?.("canonical_freeze");
  return deepFreeze(
    JSON.parse(
      canonicalJson(root),
    ) as FilingParserCrossEngineExecutionEvidenceV2,
  );
}

function normalizeOutcomeV2(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV2CaseOutcome {
  const outcome = exactRecord(value, [
    "amendmentArchiveSha256",
    "amendmentDocumentSha256",
    "agreementSha256",
    "caseId",
    "expectedStatus",
    "factVersionCount",
    "lineageCount",
    "nodeAmendmentStdoutSha256",
    "nodeExecutionBindingSha256",
    "nodeHandoffPairBindingSha256",
    "nodeKeyId",
    "nodeOriginalStdoutSha256",
    "nodePublicKeySpkiSha256",
    "normalizationSha256",
    "observedStatus",
    "originalArchiveSha256",
    "originalDocumentSha256",
    "pythonAmendmentStdoutSha256",
    "pythonExecutionBindingSha256",
    "pythonHandoffPairBindingSha256",
    "pythonKeyId",
    "pythonOriginalStdoutSha256",
    "pythonPublicKeySpkiSha256",
    "replayMatched",
    "resultSha256",
  ]);
  if (
    !FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CASE_IDS.includes(
      outcome.caseId as FilingParserCrossEngineExecutionEvidenceV2CaseId,
    )
  )
    return invalid();
  const success =
    outcome.caseId === "exact-original-amendment-cross-engine-bound-pair";
  if (
    outcome.expectedStatus !== (success ? "agreed" : "quarantined") ||
    outcome.observedStatus !== outcome.expectedStatus ||
    outcome.replayMatched !== success
  )
    return invalid();
  for (const key of [
    "amendmentArchiveSha256",
    "amendmentDocumentSha256",
    "agreementSha256",
    "nodeAmendmentStdoutSha256",
    "nodeExecutionBindingSha256",
    "nodeHandoffPairBindingSha256",
    "nodeOriginalStdoutSha256",
    "nodePublicKeySpkiSha256",
    "normalizationSha256",
    "originalArchiveSha256",
    "originalDocumentSha256",
    "pythonAmendmentStdoutSha256",
    "pythonExecutionBindingSha256",
    "pythonHandoffPairBindingSha256",
    "pythonOriginalStdoutSha256",
    "pythonPublicKeySpkiSha256",
    "resultSha256",
  ] as const) {
    if (success ? !HASH.test(string(outcome[key])) : outcome[key] !== null)
      return invalid();
  }
  for (const key of ["nodeKeyId", "pythonKeyId"] as const) {
    if (success ? !KEY_ID.test(string(outcome[key])) : outcome[key] !== null)
      return invalid();
  }
  if (
    (success
      ? outcome.factVersionCount !== 20 || outcome.lineageCount !== 10
      : outcome.factVersionCount !== null || outcome.lineageCount !== null) ||
    (success &&
      (outcome.pythonOriginalStdoutSha256 !==
        outcome.nodeOriginalStdoutSha256 ||
        outcome.pythonOriginalStdoutSha256 !== outcome.originalDocumentSha256 ||
        outcome.pythonAmendmentStdoutSha256 !==
          outcome.nodeAmendmentStdoutSha256 ||
        outcome.pythonAmendmentStdoutSha256 !==
          outcome.amendmentDocumentSha256 ||
        outcome.originalArchiveSha256 === outcome.amendmentArchiveSha256 ||
        outcome.originalDocumentSha256 === outcome.amendmentDocumentSha256 ||
        outcome.pythonExecutionBindingSha256 ===
          outcome.nodeExecutionBindingSha256))
  )
    return invalid();
  return outcome as unknown as FilingParserCrossEngineExecutionEvidenceV2CaseOutcome;
}

function validateV2SuccessReceiptBindings(
  outcome: FilingParserCrossEngineExecutionEvidenceV2CaseOutcome | undefined,
  engines: readonly FilingParserCrossEngineExecutionEvidenceEngine[],
): void {
  const python = engines[0];
  const node = engines[1];
  if (outcome === undefined || python === undefined || node === undefined)
    return invalid();
  const amendmentArchiveSha256 = string(
    outcome.amendmentArchiveSha256,
  ) as `sha256:${string}`;
  const amendmentDocumentSha256 = string(
    outcome.amendmentDocumentSha256,
  ) as `sha256:${string}`;
  const normalizationSha256 = string(
    outcome.normalizationSha256,
  ) as `sha256:${string}`;
  const originalArchiveSha256 = string(
    outcome.originalArchiveSha256,
  ) as `sha256:${string}`;
  const originalDocumentSha256 = string(
    outcome.originalDocumentSha256,
  ) as `sha256:${string}`;
  const pythonKeyId = string(outcome.pythonKeyId);
  const nodeKeyId = string(outcome.nodeKeyId);
  const pythonPublicKeySpkiSha256 = string(
    outcome.pythonPublicKeySpkiSha256,
  ) as `sha256:${string}`;
  const nodePublicKeySpkiSha256 = string(
    outcome.nodePublicKeySpkiSha256,
  ) as `sha256:${string}`;
  if (
    pythonKeyId !== V2_LIVE_KEY_ID ||
    nodeKeyId !== V2_LIVE_KEY_ID ||
    pythonPublicKeySpkiSha256 !== nodePublicKeySpkiSha256
  )
    return invalid();
  const expectedPythonPair =
    filingParserCrossEngineExecutionV2HandoffPairBindingSha256({
      amendmentDocumentSha256,
      amendmentSourceSha256: amendmentArchiveSha256,
      imageSha256: python.builtImageId,
      keyId: pythonKeyId,
      originalDocumentSha256,
      originalSourceSha256: originalArchiveSha256,
      publicKeySpkiSha256: pythonPublicKeySpkiSha256,
    });
  const expectedNodePair =
    filingParserCrossEngineExecutionV2HandoffPairBindingSha256({
      amendmentDocumentSha256,
      amendmentSourceSha256: amendmentArchiveSha256,
      imageSha256: node.builtImageId,
      keyId: nodeKeyId,
      originalDocumentSha256,
      originalSourceSha256: originalArchiveSha256,
      publicKeySpkiSha256: nodePublicKeySpkiSha256,
    });
  if (
    outcome.pythonHandoffPairBindingSha256 !== expectedPythonPair ||
    outcome.nodeHandoffPairBindingSha256 !== expectedNodePair
  )
    return invalid();
  const expectedPythonExecution =
    filingParserCrossEngineExecutionV2ExecutionBindingSha256({
      amendmentDocumentSha256,
      handoffPairBindingSha256: expectedPythonPair,
      imageSha256: python.builtImageId,
      keyId: pythonKeyId,
      originalDocumentSha256,
    });
  const expectedNodeExecution =
    filingParserCrossEngineExecutionV2ExecutionBindingSha256({
      amendmentDocumentSha256,
      handoffPairBindingSha256: expectedNodePair,
      imageSha256: node.builtImageId,
      keyId: nodeKeyId,
      originalDocumentSha256,
    });
  if (
    outcome.pythonExecutionBindingSha256 !== expectedPythonExecution ||
    outcome.nodeExecutionBindingSha256 !== expectedNodeExecution
  )
    return invalid();
  const expectedAgreement = filingParserCrossEngineExecutionV2AgreementSha256({
    amendmentArchiveSha256,
    engines: [
      {
        engineId: python.engineId,
        executionBindingSha256: outcome.pythonExecutionBindingSha256,
        imageSha256: python.builtImageId,
        implementationSha256: python.implementationSha256,
        role: "python-primary",
      },
      {
        engineId: node.engineId,
        executionBindingSha256: outcome.nodeExecutionBindingSha256,
        imageSha256: node.builtImageId,
        implementationSha256: node.implementationSha256,
        role: "node-secondary",
      },
    ],
    normalizationSha256,
    originalArchiveSha256,
  });
  if (outcome.agreementSha256 !== expectedAgreement) return invalid();
}

function normalizeTransitionV2(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV2["transition"] {
  const transition = exactRecord(value, ["entries", "pathCount"]);
  const entries = array(transition.entries).map((entryValue) => {
    const entry = exactRecord(entryValue, ["path", "status"]);
    const path = string(entry.path);
    const status = string(entry.status);
    if (!PATH.test(path) || !["A", "M"].includes(status)) return invalid();
    return Object.freeze({ path, status: status as "A" | "M" });
  });
  if (
    entries.length === 0 ||
    transition.pathCount !== entries.length ||
    entries.some(
      (entry, index) =>
        index > 0 && string(entries[index - 1]?.path) >= string(entry.path),
    )
  )
    return invalid();
  return Object.freeze({
    entries: Object.freeze(entries),
    pathCount: entries.length,
  });
}

function normalizeEvidence(
  value: unknown,
  markStage?: FilingParserCrossEngineExecutionEvidenceValidationStageMarker,
): FilingParserCrossEngineExecutionEvidence {
  markStage?.("root_contract");
  const root = exactRecord(value, [
    "baseline",
    "caseOutcomes",
    "checksPassed",
    "claim",
    "completedAt",
    "engines",
    "evidenceVersion",
    "failedCorrectiveRevision",
    "failedDiagnosticRevision",
    "failedPrecursorRevision",
    "failedRecoveryRevision",
    "fixtureManifestSha256",
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceHashes",
    "startedAt",
    "status",
    "summary",
    "synthetic",
    "tools",
    "transition",
    "workflow",
  ]);
  if (
    root.baseline !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE ||
    root.claim !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM ||
    root.evidenceVersion !== 1 ||
    root.failedCorrectiveRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION ||
    root.failedDiagnosticRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION ||
    root.failedPrecursorRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION ||
    root.failedRecoveryRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION ||
    root.schemaVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION ||
    root.status !== "passed" ||
    root.synthetic !== true ||
    !REPOSITORY.test(string(root.repository)) ||
    !COMMIT.test(string(root.revision)) ||
    !HASH.test(string(root.fixtureManifestSha256))
  )
    return invalid();

  markStage?.("timestamps");
  if (
    !isExactUtc(string(root.startedAt)) ||
    !isExactUtc(string(root.completedAt)) ||
    string(root.startedAt) > string(root.completedAt)
  )
    return invalid();

  markStage?.("claim_tuples");
  exactStringTuple(
    root.checksPassed,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS,
  );
  exactStringTuple(
    root.notProven,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN,
  );

  markStage?.("case_outcomes");
  const outcomes = array(root.caseOutcomes).map(normalizeOutcome);
  if (
    outcomes.length !== CASE_IDS.length ||
    outcomes.some((outcome, index) => outcome.caseId !== CASE_IDS[index])
  )
    return invalid();

  markStage?.("transition");
  const transition = normalizeTransition(root.transition);
  markStage?.("runtime");
  normalizeRuntime(root.runtime);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionRequiredSourcePaths(transition.entries);
  markStage?.("source_hashes");
  const sourceHashes = normalizeSourceHashes(
    root.sourceHashes,
    requiredSourcePaths,
  );
  markStage?.("engines");
  const engines = array(root.engines).map(normalizeEngine);
  if (
    engines.length !== 2 ||
    engines[0]?.role !== "python-primary" ||
    engines[1]?.role !== "node-secondary" ||
    engines[0].builtImageId === engines[1].builtImageId ||
    engines[0].implementationSha256 === engines[1].implementationSha256 ||
    engines[0].engineId === engines[1].engineId
  )
    return invalid();
  for (const engine of engines) {
    const paths =
      engine.role === "python-primary"
        ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python
        : FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node;
    const projected = paths.map((path) => {
      const source = sourceHashes.find((entry) => entry.path === path);
      return source ?? invalid();
    });
    if (
      JSON.stringify(engine.implementationSourceHashes) !==
      JSON.stringify(projected)
    )
      return invalid();
  }
  markStage?.("fixture_binding");
  const fixtureManifest = sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v1/manifest.json",
  );
  if (fixtureManifest?.sha256 !== root.fixtureManifestSha256) return invalid();
  markStage?.("summary");
  const summary = exactRecord(root.summary, [
    "agreed",
    "quarantined",
    "replayMatched",
    "total",
  ]);
  if (
    summary.agreed !== 1 ||
    summary.quarantined !== 3 ||
    summary.replayMatched !== true ||
    summary.total !== 4
  )
    return invalid();
  markStage?.("tools_contract");
  const tools = exactRecord(root.tools, [
    "dockerClient",
    "dockerServer",
    "git",
    "node",
    "pnpm",
    "python",
  ]);
  for (const [key, stage] of [
    ["dockerClient", "tool_docker_client"],
    ["dockerServer", "tool_docker_server"],
    ["git", "tool_git"],
    ["node", "tool_node"],
    ["pnpm", "tool_pnpm"],
    ["python", "tool_python"],
  ] as const) {
    markStage?.(stage);
    if (!VERSION.test(string(tools[key]))) return invalid();
  }
  markStage?.("workflow");
  const workflow = exactRecord(root.workflow, [
    "artifactName",
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !/^[A-Za-z0-9._-]{1,240}$/u.test(string(workflow.artifactName)) ||
    !["push", "workflow_dispatch"].includes(string(workflow.event)) ||
    workflow.job !== "acceptance" ||
    !VERSION.test(string(workflow.ref)) ||
    !positiveInteger(workflow.runAttempt) ||
    !/^[1-9][0-9]{0,19}$/u.test(string(workflow.runId)) ||
    workflow.workflowName !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW
  )
    return invalid();
  if (
    workflow.artifactName !==
    `filing-parser-cross-engine-execution-evidence-v1-${String(root.revision)}-${String(workflow.runAttempt)}`
  )
    return invalid();

  markStage?.("canonical_freeze");
  return deepFreeze(
    JSON.parse(canonicalJson(root)) as FilingParserCrossEngineExecutionEvidence,
  );
}

function normalizeEngine(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceEngine {
  const engine = exactRecord(value, [
    "architecture",
    "baseIndexDigest",
    "basePlatformManifestDigest",
    "builtImageId",
    "engineId",
    "implementationSha256",
    "implementationSourceHashes",
    "operatingSystem",
    "role",
    "runtimeVersion",
  ]);
  const role = string(engine.role);
  const expectedPaths =
    role === "python-primary"
      ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python
      : role === "node-secondary"
        ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node
        : invalid();
  const contract = ENGINE_CONTRACTS[role as keyof typeof ENGINE_CONTRACTS];
  if (
    engine.architecture !== "amd64" ||
    engine.operatingSystem !== "linux" ||
    !HASH.test(string(engine.baseIndexDigest)) ||
    !HASH.test(string(engine.basePlatformManifestDigest)) ||
    !HASH.test(string(engine.builtImageId)) ||
    !HASH.test(string(engine.implementationSha256)) ||
    !ENGINE.test(string(engine.engineId)) ||
    engine.engineId !== contract.engineId ||
    engine.runtimeVersion !== contract.runtimeVersion ||
    engine.baseIndexDigest !== contract.baseIndexDigest ||
    engine.basePlatformManifestDigest !== contract.basePlatformManifestDigest
  )
    return invalid();
  const implementationSourceHashes = normalizeSourceHashes(
    engine.implementationSourceHashes,
    expectedPaths,
  );
  if (
    engine.implementationSha256 !==
    filingParserCrossEngineImplementationSha256(implementationSourceHashes)
  )
    return invalid();
  return engine as unknown as FilingParserCrossEngineExecutionEvidenceEngine;
}

function normalizeOutcome(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceCaseOutcome {
  const outcome = exactRecord(value, [
    "amendmentArchiveSha256",
    "agreementSha256",
    "caseId",
    "expectedStatus",
    "factVersionCount",
    "lineageCount",
    "nodeAmendmentStdoutSha256",
    "nodeExecutionBindingSha256",
    "nodeOriginalStdoutSha256",
    "normalizationSha256",
    "observedStatus",
    "originalArchiveSha256",
    "pythonAmendmentStdoutSha256",
    "pythonExecutionBindingSha256",
    "pythonOriginalStdoutSha256",
    "replayMatched",
    "resultSha256",
  ]);
  if (!CASE_IDS.includes(outcome.caseId as (typeof CASE_IDS)[number]))
    return invalid();
  const success =
    outcome.caseId === "exact-original-amendment-cross-engine-pair";
  if (
    outcome.expectedStatus !== (success ? "agreed" : "quarantined") ||
    outcome.observedStatus !== outcome.expectedStatus ||
    outcome.replayMatched !== success
  )
    return invalid();
  for (const key of [
    "amendmentArchiveSha256",
    "agreementSha256",
    "nodeAmendmentStdoutSha256",
    "nodeExecutionBindingSha256",
    "nodeOriginalStdoutSha256",
    "normalizationSha256",
    "originalArchiveSha256",
    "pythonAmendmentStdoutSha256",
    "pythonExecutionBindingSha256",
    "pythonOriginalStdoutSha256",
    "resultSha256",
  ] as const) {
    if (success ? !HASH.test(string(outcome[key])) : outcome[key] !== null)
      return invalid();
  }
  if (
    (success
      ? outcome.factVersionCount !== 20 || outcome.lineageCount !== 10
      : outcome.factVersionCount !== null || outcome.lineageCount !== null) ||
    (success &&
      (outcome.pythonOriginalStdoutSha256 !==
        outcome.nodeOriginalStdoutSha256 ||
        outcome.pythonAmendmentStdoutSha256 !==
          outcome.nodeAmendmentStdoutSha256 ||
        outcome.pythonExecutionBindingSha256 ===
          outcome.nodeExecutionBindingSha256))
  )
    return invalid();
  return outcome as unknown as FilingParserCrossEngineExecutionEvidenceCaseOutcome;
}

function normalizeRuntime(
  value: unknown,
): FilingParserCrossEngineExecutionEvidence["runtime"] {
  const runtime = exactRecord(value, [
    "auditedContainerCount",
    "capabilitiesDropped",
    "containerControlMilliseconds",
    "containerUser",
    "cpuCount",
    "engineCount",
    "inputMount",
    "memoryBytes",
    "networkMode",
    "noNewPrivileges",
    "noPublishedPorts",
    "openFiles",
    "pids",
    "processTerminationMilliseconds",
    "productionContainerCount",
    "readOnlyRootFilesystem",
    "signerMilliseconds",
    "stderrLimitBytes",
    "stdoutLimitBytes",
    "successfulPairContainerCount",
    "temporaryFilesystem",
    "wallClockMilliseconds",
    "zeroResidue",
  ]);
  exactStringTuple(runtime.capabilitiesDropped, ["ALL"]);
  if (
    runtime.auditedContainerCount !== 15 ||
    runtime.productionContainerCount !== 9 ||
    runtime.containerControlMilliseconds !== 5_000 ||
    runtime.containerUser !== "65532:65532" ||
    runtime.cpuCount !== 0.5 ||
    runtime.engineCount !== 2 ||
    runtime.inputMount !== "/input/filing.zip:ro" ||
    runtime.memoryBytes !== 134_217_728 ||
    runtime.networkMode !== "none" ||
    runtime.noNewPrivileges !== true ||
    runtime.noPublishedPorts !== true ||
    runtime.openFiles !== 64 ||
    runtime.pids !== 32 ||
    runtime.processTerminationMilliseconds !== 250 ||
    runtime.readOnlyRootFilesystem !== true ||
    runtime.signerMilliseconds !== 5_000 ||
    runtime.stderrLimitBytes !== 4_096 ||
    runtime.stdoutLimitBytes !== 262_144 ||
    runtime.successfulPairContainerCount !== 4 ||
    runtime.temporaryFilesystem !==
      "/tmp:rw,noexec,nosuid,nodev,size=8388608" ||
    runtime.wallClockMilliseconds !== 5_000 ||
    runtime.zeroResidue !== true
  )
    return invalid();
  return runtime as unknown as FilingParserCrossEngineExecutionEvidence["runtime"];
}

function normalizeTransition(
  value: unknown,
): FilingParserCrossEngineExecutionEvidence["transition"] {
  const transition = exactRecord(value, ["entries", "pathCount"]);
  const entries = array(transition.entries).map((entryValue) => {
    const entry = exactRecord(entryValue, ["path", "status"]);
    const path = string(entry.path);
    const status = string(entry.status);
    if (!PATH.test(path) || !["A", "M"].includes(status)) return invalid();
    return Object.freeze({ path, status: status as "A" | "M" });
  });
  if (
    transition.pathCount !== entries.length ||
    entries.some(
      (entry, index) =>
        index > 0 && string(entries[index - 1]?.path) >= string(entry.path),
    ) ||
    JSON.stringify(entries) !== JSON.stringify(CYCLE_2K_TRANSITION)
  )
    return invalid();
  return Object.freeze({
    entries: Object.freeze(entries),
    pathCount: entries.length,
  });
}

function normalizeSourceHashes(
  value: unknown,
  expectedPaths: readonly string[],
): readonly FilingParserCrossEngineExecutionEvidenceSourceHash[] {
  const hashes = array(value).map((entryValue) => {
    const entry = exactRecord(entryValue, ["path", "sha256"]);
    if (!PATH.test(string(entry.path)) || !HASH.test(string(entry.sha256)))
      return invalid();
    return entry;
  });
  if (
    hashes.length !== expectedPaths.length ||
    hashes.some((entry, index) => entry.path !== expectedPaths[index])
  )
    return invalid();
  return hashes as unknown as readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...keys].sort())
  )
    return invalid();
  return value as Record<string, unknown>;
}

function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) return invalid();
  return value;
}

function exactStringTuple(value: unknown, expected: readonly string[]): void {
  if (
    !Array.isArray(value) ||
    JSON.stringify(value) !== JSON.stringify(expected)
  )
    return invalid();
}

function string(value: unknown): string {
  if (typeof value !== "string") return invalid();
  return value;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isExactUtc(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalDocumentSha256(value: unknown): `sha256:${string}` {
  return sha256(new TextEncoder().encode(`${canonicalJson(value)}\n`));
}

function domainCanonicalSha256(
  domain: string,
  value: unknown,
  newline: boolean,
): `sha256:${string}` {
  const hash = createHash("sha256");
  hash.update(domain, "utf8");
  hash.update(`${canonicalJson(value)}${newline ? "\n" : ""}`, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function invalid(): never {
  throw new Error("Filing parser cross-engine execution evidence is invalid.");
}
