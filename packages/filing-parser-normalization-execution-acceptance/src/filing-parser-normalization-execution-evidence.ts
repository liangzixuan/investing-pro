import { createHash } from "node:crypto";

export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_VERSION =
  1 as const;
export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM =
  "bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff" as const;
export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW =
  "Filing parser normalization execution acceptance" as const;

export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS =
  Object.freeze([
    "exact_two_synthetic_original_and_amendment_archives_and_strict_options",
    "intrinsic_bounded_owned_archive_signer_and_process_output_snapshots",
    "pinned_python_3_12_zero_install_reviewed_worker_and_taxonomy",
    "fresh_nonroot_capability_dropped_network_none_read_only_container_per_archive",
    "fixed_cpu_memory_pids_nofile_tmpfs_stdout_stderr_and_wall_clock_limits",
    "closed_zip_xml_name_size_ratio_entity_depth_node_text_and_taxonomy_rejection",
    "exact_complete_ten_fact_cycle2d_document_per_distinct_role",
    "canonical_single_document_output_exit_zero_empty_stderr_and_no_extra_fields",
    "host_recomputed_archive_sha256_and_exact_worker_document_binding",
    "outside_worker_ed25519_cycle2i_envelope_signing_with_key_and_image_binding",
    "unchanged_archive_and_envelope_bytes_delegated_to_cycle2i_handoff",
    "atomic_original_amendment_normalization_or_single_empty_value_free_quarantine",
    "timeout_abort_create_start_output_signing_handoff_and_cleanup_failure_quarantine",
    "role_swap_substitution_tamper_partial_duplicate_mutation_and_replay_coverage",
    "success_only_exact_commit_image_case_source_artifact_and_offline_review",
    "no_fetch_network_custody_corpus_database_api_web_queue_or_real_data",
  ] as const);

export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN =
  Object.freeze([
    "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
    "real_public_filing_bytes_sec_source_authenticity_or_attestation",
    "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
    "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
    "general_xbrl_ixbrl_taxonomy_plugin_or_accounting_correctness",
    "signer_identity_or_production_kms_hsm_custody_rotation_nonrepudiation",
    "independent_second_parser_or_cross_engine_validator_independence",
    "independently_adjudicated_ground_truth_or_two_thousand_assertions",
    "precision_recall_document_success_thresholds_or_zero_silent_failures",
    "general_alias_unit_conversion_dimension_or_fiscal_calendar_coverage",
    "real_amendment_completeness_correction_discovery_or_sec_restated_status",
    "production_payload_retention_backup_delete_or_cryptographic_erasure",
    "multi_issuer_batch_concurrency_retry_crash_recovery_load_or_slo",
    "database_api_web_queue_persistence_evidence_passport_or_b15_v15",
    "production_identity_secrets_host_kernel_daemon_or_incident_recovery",
    "real_data_admission_full_cycle2_exit_or_production_use",
  ] as const);

export const FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS =
  Object.freeze([
    ".github/workflows/ci.yml",
    ".github/workflows/filing-parser-normalization-execution-acceptance.yml",
    "fixtures/synthetic/filing-parser-normalization-execution/v1/cases.json",
    "fixtures/synthetic/filing-parser-normalization-execution/v1/manifest.json",
    "LICENSE_POLICY.md",
    "package.json",
    "packages/filing-fact-normalization/package.json",
    "packages/filing-fact-normalization/src/filing-fact-normalization-security.test.ts",
    "packages/filing-fact-normalization/src/filing-fact-normalization.test.ts",
    "packages/filing-fact-normalization/src/filing-fact-normalization.ts",
    "packages/filing-fact-normalization/src/index.ts",
    "packages/filing-fact-normalization/src/test-filing-fact-builder.ts",
    "packages/filing-fact-normalization/tsconfig.json",
    "packages/filing-parser-normalization-handoff/package.json",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff-security.test.ts",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.test.ts",
    "packages/filing-parser-normalization-handoff/src/filing-parser-normalization-handoff.ts",
    "packages/filing-parser-normalization-handoff/src/index.ts",
    "packages/filing-parser-normalization-handoff/src/test-filing-parser-normalization-handoff-builder.ts",
    "packages/filing-parser-normalization-handoff/tsconfig.json",
    "packages/filing-parser-normalization-execution-acceptance/package.json",
    "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-review.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-review.test.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-verifier.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence-verifier.test.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/filing-parser-normalization-execution-evidence.test.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/index.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-acceptance.test.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/run-filing-parser-normalization-execution-evidence-review.ts",
    "packages/filing-parser-normalization-execution-acceptance/src/test-filing-parser-normalization-execution-evidence-builder.ts",
    "packages/filing-parser-normalization-execution-acceptance/tsconfig.json",
    "packages/filing-parser-normalization-execution/package.json",
    "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution-security.test.ts",
    "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.test.ts",
    "packages/filing-parser-normalization-execution/src/filing-parser-normalization-execution.ts",
    "packages/filing-parser-normalization-execution/src/index.ts",
    "packages/filing-parser-normalization-execution/src/test-filing-parser-normalization-execution-builder.ts",
    "packages/filing-parser-normalization-execution/tsconfig.json",
    "packages/filing-parser-normalization-execution/worker/Dockerfile",
    "packages/filing-parser-normalization-execution/worker/parser.py",
    "packages/filing-parser-normalization-execution/worker/parser_test.py",
    "packages/filing-parser-normalization-execution/worker/taxonomy-v1.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/verify-boundaries.ts",
    "scripts/verify-filing-parser-normalization-execution-fixtures.ts",
    "THIRD_PARTY_NOTICES.md",
    "tsconfig.base.json",
  ] as const);

export type FilingParserNormalizationExecutionEvidenceSourcePath =
  (typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS)[number];

export interface FilingParserNormalizationExecutionEvidenceSourceHash {
  readonly path: FilingParserNormalizationExecutionEvidenceSourcePath;
  readonly sha256: `sha256:${string}`;
}

export interface FilingParserNormalizationExecutionEvidenceCaseOutcome {
  readonly amendmentArchiveSha256: `sha256:${string}` | null;
  readonly amendmentDocumentSha256: `sha256:${string}` | null;
  readonly caseId:
    | "exact-original-amendment-pair"
    | "original-amendment-role-swap"
    | "original-archive-tamper";
  readonly expectedStatus: "normalized" | "quarantined";
  readonly factVersionCount: 0 | 20;
  readonly lineageCount: 0 | 10;
  readonly observedStatus: "normalized" | "quarantined";
  readonly originalArchiveSha256: `sha256:${string}` | null;
  readonly originalDocumentSha256: `sha256:${string}` | null;
  readonly pairBindingSha256: `sha256:${string}` | null;
  readonly replayMatched: boolean;
  readonly resultSha256: `sha256:${string}`;
}

export interface FilingParserNormalizationExecutionEvidence {
  readonly caseOutcomes: readonly FilingParserNormalizationExecutionEvidenceCaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS;
  readonly claim: typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM;
  readonly completedAt: string;
  readonly evidenceVersion: typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_VERSION;
  readonly fixtureManifestSha256: `sha256:${string}`;
  readonly image: {
    readonly architecture: "amd64";
    readonly baseIndexDigest: `sha256:${string}`;
    readonly basePlatformManifestDigest: `sha256:${string}`;
    readonly builtImageId: `sha256:${string}`;
    readonly operatingSystem: "linux";
    readonly pythonVersion: "3.12.13";
  };
  readonly notProven: typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly capabilitiesDropped: readonly ["ALL"];
    readonly containerControlMilliseconds: 5_000;
    readonly containerCount: 2;
    readonly containerUser: "65532:65532";
    readonly cpuCount: 0.5;
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
    readonly temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608";
    readonly wallClockMilliseconds: 5_000;
    readonly zeroResidue: true;
  };
  readonly schemaVersion: typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserNormalizationExecutionEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly normalized: 1;
    readonly quarantined: 2;
    readonly replayMatched: true;
    readonly total: 3;
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
  readonly workflow: {
    readonly event: "pull_request" | "push" | "workflow_dispatch";
    readonly job: "acceptance";
    readonly ref: string;
    readonly runAttempt: number;
    readonly runId: string;
    readonly workflowName: typeof FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW;
  };
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const VERSION = /^[\x20-\x7e]{1,160}$/u;

export function createFilingParserNormalizationExecutionEvidence(
  value: FilingParserNormalizationExecutionEvidence,
): FilingParserNormalizationExecutionEvidence {
  return normalizeEvidence(value);
}

export function parseCanonicalFilingParserNormalizationExecutionEvidence(
  bytes: Uint8Array,
): FilingParserNormalizationExecutionEvidence {
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
  const evidence = normalizeEvidence(parsed);
  if (
    serializeCanonicalFilingParserNormalizationExecutionEvidence(evidence) !==
    text
  )
    return invalid();
  return evidence;
}

export function serializeCanonicalFilingParserNormalizationExecutionEvidence(
  evidence: FilingParserNormalizationExecutionEvidence,
): string {
  return `${canonicalJson(normalizeEvidence(evidence))}\n`;
}

export function filingParserNormalizationExecutionEvidenceSha256(
  evidence: FilingParserNormalizationExecutionEvidence,
): `sha256:${string}` {
  return sha256(
    new TextEncoder().encode(
      serializeCanonicalFilingParserNormalizationExecutionEvidence(evidence),
    ),
  );
}

function normalizeEvidence(
  value: unknown,
): FilingParserNormalizationExecutionEvidence {
  const evidence = record(value, [
    "caseOutcomes",
    "checksPassed",
    "claim",
    "completedAt",
    "evidenceVersion",
    "fixtureManifestSha256",
    "image",
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
    "workflow",
  ]);
  if (
    evidence.schemaVersion !==
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION ||
    evidence.evidenceVersion !==
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_VERSION ||
    evidence.claim !== FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM ||
    evidence.status !== "passed" ||
    evidence.synthetic !== true ||
    !HASH.test(string(evidence.fixtureManifestSha256)) ||
    !COMMIT.test(string(evidence.revision)) ||
    !REPOSITORY.test(string(evidence.repository)) ||
    !isExactUtc(string(evidence.startedAt)) ||
    !isExactUtc(string(evidence.completedAt)) ||
    Date.parse(string(evidence.completedAt)) <
      Date.parse(string(evidence.startedAt))
  )
    return invalid();
  exactTuple(
    evidence.checksPassed,
    FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS,
  );
  exactTuple(
    evidence.notProven,
    FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
  );

  const sourceHashes = array(evidence.sourceHashes).map((entry, index) => {
    const source = record(entry, ["path", "sha256"]);
    if (
      source.path !==
        FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS[index] ||
      !HASH.test(string(source.sha256))
    )
      return invalid();
    return Object.freeze({
      path: source.path as FilingParserNormalizationExecutionEvidenceSourcePath,
      sha256: source.sha256 as `sha256:${string}`,
    });
  });
  if (
    sourceHashes.length !==
    FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS.length
  )
    return invalid();

  const expectedCases = [
    ["exact-original-amendment-pair", "normalized", 20, 10, true],
    ["original-archive-tamper", "quarantined", 0, 0, false],
    ["original-amendment-role-swap", "quarantined", 0, 0, false],
  ] as const;
  const caseOutcomes = array(evidence.caseOutcomes).map((entry, index) => {
    const outcome = record(entry, [
      "amendmentArchiveSha256",
      "amendmentDocumentSha256",
      "caseId",
      "expectedStatus",
      "factVersionCount",
      "lineageCount",
      "observedStatus",
      "originalArchiveSha256",
      "originalDocumentSha256",
      "pairBindingSha256",
      "replayMatched",
      "resultSha256",
    ]);
    const expected = expectedCases[index];
    if (
      expected === undefined ||
      outcome.caseId !== expected[0] ||
      outcome.expectedStatus !== expected[1] ||
      outcome.observedStatus !== expected[1] ||
      outcome.factVersionCount !== expected[2] ||
      outcome.lineageCount !== expected[3] ||
      outcome.replayMatched !== expected[4] ||
      !HASH.test(string(outcome.resultSha256)) ||
      (expected[1] === "normalized"
        ? ![
            outcome.amendmentArchiveSha256,
            outcome.amendmentDocumentSha256,
            outcome.originalArchiveSha256,
            outcome.originalDocumentSha256,
            outcome.pairBindingSha256,
          ].every((value) => HASH.test(string(value)))
        : outcome.amendmentArchiveSha256 !== null ||
          outcome.amendmentDocumentSha256 !== null ||
          outcome.originalArchiveSha256 !== null ||
          outcome.originalDocumentSha256 !== null ||
          outcome.pairBindingSha256 !== null)
    )
      return invalid();
    return Object.freeze({
      amendmentArchiveSha256:
        expected[1] === "normalized"
          ? (outcome.amendmentArchiveSha256 as `sha256:${string}`)
          : null,
      amendmentDocumentSha256:
        expected[1] === "normalized"
          ? (outcome.amendmentDocumentSha256 as `sha256:${string}`)
          : null,
      caseId: expected[0],
      expectedStatus: expected[1],
      factVersionCount: expected[2],
      lineageCount: expected[3],
      observedStatus: expected[1],
      originalArchiveSha256:
        expected[1] === "normalized"
          ? (outcome.originalArchiveSha256 as `sha256:${string}`)
          : null,
      originalDocumentSha256:
        expected[1] === "normalized"
          ? (outcome.originalDocumentSha256 as `sha256:${string}`)
          : null,
      pairBindingSha256:
        expected[1] === "normalized"
          ? (outcome.pairBindingSha256 as `sha256:${string}`)
          : null,
      replayMatched: expected[4],
      resultSha256: outcome.resultSha256 as `sha256:${string}`,
    });
  });
  if (caseOutcomes.length !== expectedCases.length) return invalid();

  const image = record(evidence.image, [
    "architecture",
    "baseIndexDigest",
    "basePlatformManifestDigest",
    "builtImageId",
    "operatingSystem",
    "pythonVersion",
  ]);
  if (
    image.architecture !== "amd64" ||
    image.operatingSystem !== "linux" ||
    image.pythonVersion !== "3.12.13" ||
    image.baseIndexDigest !==
      "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2" ||
    image.basePlatformManifestDigest !==
      "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af" ||
    !HASH.test(string(image.builtImageId))
  )
    return invalid();

  const runtime = record(evidence.runtime, [
    "capabilitiesDropped",
    "containerControlMilliseconds",
    "containerCount",
    "containerUser",
    "cpuCount",
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
    "temporaryFilesystem",
    "wallClockMilliseconds",
    "zeroResidue",
  ]);
  exactTuple(runtime.capabilitiesDropped, ["ALL"] as const);
  if (
    runtime.containerControlMilliseconds !== 5_000 ||
    runtime.containerCount !== 2 ||
    runtime.containerUser !== "65532:65532" ||
    runtime.cpuCount !== 0.5 ||
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
    runtime.temporaryFilesystem !==
      "/tmp:rw,noexec,nosuid,nodev,size=8388608" ||
    runtime.wallClockMilliseconds !== 5_000 ||
    runtime.zeroResidue !== true
  )
    return invalid();

  const summary = record(evidence.summary, [
    "normalized",
    "quarantined",
    "replayMatched",
    "total",
  ]);
  if (
    summary.normalized !== 1 ||
    summary.quarantined !== 2 ||
    summary.replayMatched !== true ||
    summary.total !== 3
  )
    return invalid();

  const tools = record(evidence.tools, [
    "dockerClient",
    "dockerServer",
    "git",
    "node",
    "pnpm",
    "python",
  ]);
  for (const value of Object.values(tools))
    if (!VERSION.test(string(value))) return invalid();

  const workflow = record(evidence.workflow, [
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !["pull_request", "push", "workflow_dispatch"].includes(
      string(workflow.event),
    ) ||
    workflow.job !== "acceptance" ||
    typeof workflow.ref !== "string" ||
    workflow.ref.length === 0 ||
    workflow.ref.length > 512 ||
    !Number.isSafeInteger(workflow.runAttempt) ||
    Number(workflow.runAttempt) < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(string(workflow.runId)) ||
    workflow.workflowName !==
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW
  )
    return invalid();

  return deepFreeze({
    caseOutcomes,
    checksPassed: [...FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS],
    claim: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM,
    completedAt: evidence.completedAt,
    evidenceVersion: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_VERSION,
    fixtureManifestSha256: evidence.fixtureManifestSha256,
    image,
    notProven: [...FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN],
    repository: evidence.repository,
    revision: evidence.revision,
    runtime,
    schemaVersion:
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION,
    sourceHashes,
    startedAt: evidence.startedAt,
    status: "passed",
    summary,
    synthetic: true,
    tools,
    workflow,
  }) as unknown as FilingParserNormalizationExecutionEvidence;
}

function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
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

function exactTuple(value: unknown, expected: readonly string[]): void {
  const observed = array(value);
  if (
    observed.length !== expected.length ||
    observed.some((entry, index) => entry !== expected[index])
  )
    invalid();
}

function string(value: unknown): string {
  if (typeof value !== "string") return invalid();
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) return invalid();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") return invalid();
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(candidate[key])}`)
    .join(",")}}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function isExactUtc(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function invalid(): never {
  throw new Error("Filing parser normalization execution evidence is invalid.");
}
