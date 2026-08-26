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
    "success_only_exact_four_commit_recovery_transition_two_image_case_source_artifact_and_offline_review",
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
    if (
      !PATH.test(string(entry.path)) ||
      !["A", "M"].includes(string(entry.status))
    )
      return invalid();
    return entry;
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
  return transition as unknown as FilingParserCrossEngineExecutionEvidence["transition"];
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

function invalid(): never {
  throw new Error("Filing parser cross-engine execution evidence is invalid.");
}
