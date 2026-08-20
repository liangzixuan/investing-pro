import { createHash } from "node:crypto";

import {
  FILING_PARSER_LIMITS,
  FILING_PARSER_QUARANTINE_CODES,
  type FilingParserQuarantineCode,
} from "./parser-boundary";

export const FILING_PARSER_EVIDENCE_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_PARSER_EVIDENCE_VERSION = 1 as const;
export const FILING_PARSER_EVIDENCE_CLAIM =
  "bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding" as const;
export const FILING_PARSER_EVIDENCE_WORKFLOW =
  "Filing parser isolation acceptance" as const;

export const FILING_PARSER_EVIDENCE_CHECKS = [
  "historical_b1_b14_and_cycle_1c_preservation",
  "pinned_python_3_12_zero_pip_worker",
  "numeric_nonroot_dropped_capabilities_and_no_new_privileges",
  "network_none_no_published_ports_and_no_worker_listener",
  "read_only_root_input_mount_and_hardened_tmpfs",
  "cpu_memory_pids_nofile_and_wall_clock_limits",
  "bounded_input_output_empty_stderr_and_exit_zero",
  "archive_name_duplicate_encryption_nested_count_declared_streamed_size_and_ratio_rejection",
  "xml_dtd_entity_xinclude_depth_node_and_text_rejection",
  "taxonomy_concept_and_plugin_allowlist",
  "closed_canonical_result_protocol_and_duplicate_key_rejection",
  "atomic_quarantine_without_partial_facts",
  "exact_byte_replay",
  "outside_worker_ed25519_signature_and_tamper_rejection",
  "timeout_abort_failure_cleanup_and_zero_residue",
  "source_hash_bound_live_artifact_and_offline_review",
] as const;

export const FILING_PARSER_EVIDENCE_NOT_PROVEN = [
  "real_public_sec_filings",
  "counsel_approved_corpus_or_rights",
  "ten_fact_coverage",
  "precision_recall_or_adjudicated_quality",
  "general_xbrl_ixbrl_taxonomy_or_plugins",
  "external_fetch_edgar_dns_tls_ssrf_or_rate_limits",
  "source_authenticity_or_sec_attestation",
  "production_key_kms_hsm_custody_or_rotation",
  "production_container_host_kernel_or_daemon_isolation",
  "malware_or_zero_day_safety",
  "queue_scheduler_distributed_retry_or_exactly_once",
  "database_api_web_composition_or_b15_v15",
  "retention_crypto_erasure_or_quarantine_operations",
  "correction_supersession_or_lineage",
  "load_scale_or_slo",
  "real_data_or_production_admission",
] as const;

export const FILING_PARSER_EVIDENCE_SOURCE_PATHS = [
  ".github/workflows/ci.yml",
  ".github/workflows/filing-parser-acceptance.yml",
  "fixtures/synthetic/filing-parser/v1/cases.json",
  "fixtures/synthetic/filing-parser/v1/manifest.json",
  "package.json",
  "packages/filing-parser/acceptance/python-image.json",
  "packages/filing-parser/package.json",
  "packages/filing-parser/src/filing-parser-evidence-review.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-parser/src/filing-parser-evidence.test.ts",
  "packages/filing-parser/src/filing-parser-evidence.ts",
  "packages/filing-parser/src/index.ts",
  "packages/filing-parser/src/parser-security.test.ts",
  "packages/filing-parser/src/parser-boundary.test.ts",
  "packages/filing-parser/src/parser-boundary.ts",
  "packages/filing-parser/src/run-filing-parser-acceptance.ts",
  "packages/filing-parser/src/run-filing-parser-evidence-review.ts",
  "packages/filing-parser/src/test-archive-builder.ts",
  "packages/filing-parser/tsconfig.json",
  "packages/filing-parser/worker/Dockerfile",
  "packages/filing-parser/worker/parser.py",
  "packages/filing-parser/worker/taxonomy-v1.json",
  "pnpm-lock.yaml",
  "scripts/verify-boundaries.ts",
  "scripts/verify-filing-parser-fixtures.ts",
] as const;

export const FILING_PARSER_EVIDENCE_TOOL_KEYS = [
  "dockerClient",
  "dockerServer",
  "git",
  "node",
  "pnpm",
  "python",
] as const;

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const VERSION_TEXT = /^[\x20-\x7e]{1,160}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type FilingParserEvidenceSourcePath =
  (typeof FILING_PARSER_EVIDENCE_SOURCE_PATHS)[number];
export type FilingParserEvidenceToolKey =
  (typeof FILING_PARSER_EVIDENCE_TOOL_KEYS)[number];

export interface FilingParserEvidenceSourceHash {
  readonly path: FilingParserEvidenceSourcePath;
  readonly sha256: `sha256:${string}`;
}

export interface FilingParserEvidenceCaseOutcome {
  readonly caseId: string;
  readonly expectedStatus: "accepted" | "quarantined";
  readonly factCount: 0 | 2;
  readonly imageId: `sha256:${string}`;
  readonly observedStatus: "accepted" | "quarantined";
  readonly provenanceAlgorithm: "ed25519";
  readonly provenanceKeyId: "cycle2a-ephemeral-ed25519-v1";
  readonly provenancePayloadSha256: `sha256:${string}`;
  readonly provenanceVerified: true;
  readonly quarantineCode: FilingParserQuarantineCode | null;
  readonly replayMatched: boolean;
  readonly resultSha256: `sha256:${string}`;
  readonly signatureSha256: `sha256:${string}`;
  readonly sourceSha256: `sha256:${string}`;
  readonly tamperRejected: true;
}

export interface FilingParserEvidence {
  readonly caseOutcomes: readonly FilingParserEvidenceCaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_EVIDENCE_CHECKS;
  readonly claim: typeof FILING_PARSER_EVIDENCE_CLAIM;
  readonly completedAt: string;
  readonly evidenceVersion: typeof FILING_PARSER_EVIDENCE_VERSION;
  readonly fixtureManifestSha256: `sha256:${string}`;
  readonly image: {
    readonly architecture: "amd64";
    readonly baseIndexDigest: `sha256:${string}`;
    readonly basePlatformManifestDigest: `sha256:${string}`;
    readonly builtImageId: `sha256:${string}`;
    readonly operatingSystem: "linux";
    readonly pythonVersion: "3.12.13";
  };
  readonly notProven: typeof FILING_PARSER_EVIDENCE_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly capabilitiesDropped: readonly ["ALL"];
    readonly containerUser: "65532:65532";
    readonly cpuCount: 0.5;
    readonly inputMount: "/input/filing.zip:ro";
    readonly memoryBytes: 134_217_728;
    readonly networkMode: "none";
    readonly noNewPrivileges: true;
    readonly noPublishedPorts: true;
    readonly openFiles: 64;
    readonly pids: 32;
    readonly readOnlyRootFilesystem: true;
    readonly temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608";
    readonly wallClockMilliseconds: 5_000;
    readonly zeroResidue: true;
  };
  readonly schemaVersion: typeof FILING_PARSER_EVIDENCE_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly accepted: number;
    readonly exactByteReplayPassed: true;
    readonly quarantined: number;
    readonly total: number;
  };
  readonly synthetic: true;
  readonly tools: Readonly<Record<FilingParserEvidenceToolKey, string>>;
  readonly workflow: {
    readonly event: "pull_request" | "push" | "workflow_dispatch";
    readonly job: "acceptance";
    readonly ref: string;
    readonly runAttempt: number;
    readonly runId: string;
    readonly workflowName: typeof FILING_PARSER_EVIDENCE_WORKFLOW;
  };
}

export type FilingParserEvidenceInput = FilingParserEvidence;

export interface FilingParserContainerInspectionExpected {
  readonly containerId: string;
  readonly containerName: string;
  readonly imageId: `sha256:${string}`;
  readonly inputSource: string;
}

export function createFilingParserEvidence(
  value: FilingParserEvidenceInput,
): FilingParserEvidence {
  return normalizeEvidence(value);
}

export function parseCanonicalFilingParserEvidence(
  bytes: Uint8Array,
): FilingParserEvidence {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return invalidEvidence();
  }
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) {
    return invalidEvidence();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(0, -1)) as unknown;
  } catch {
    return invalidEvidence();
  }
  const evidence = normalizeEvidence(parsed);
  if (serializeCanonicalFilingParserEvidence(evidence) !== text) {
    return invalidEvidence();
  }
  return evidence;
}

export function serializeCanonicalFilingParserEvidence(
  evidence: FilingParserEvidence,
): string {
  return `${canonicalJson(normalizeEvidence(evidence))}\n`;
}

export function filingParserEvidenceSha256(
  evidence: FilingParserEvidence,
): `sha256:${string}` {
  return sha256(
    new TextEncoder().encode(serializeCanonicalFilingParserEvidence(evidence)),
  );
}

export function validateFilingParserContainerInspection(
  value: unknown,
  expected: FilingParserContainerInspectionExpected,
): void {
  const container = exactRecordAtLeast(value, [
    "Config",
    "HostConfig",
    "Id",
    "Image",
    "Mounts",
    "Name",
    "NetworkSettings",
    "State",
  ]);
  if (
    container.Id !== expected.containerId ||
    container.Image !== expected.imageId ||
    container.Name !== `/${expected.containerName}`
  )
    invalidEvidence();
  const state = exactRecordAtLeast(container.State, ["Status"]);
  const config = exactRecordAtLeast(container.Config, [
    "Entrypoint",
    "Env",
    "Image",
    "User",
  ]);
  const host = exactRecordAtLeast(container.HostConfig, [
    "CapAdd",
    "CapDrop",
    "IpcMode",
    "Memory",
    "MemorySwap",
    "Mounts",
    "NanoCpus",
    "NetworkMode",
    "PidsLimit",
    "PortBindings",
    "Privileged",
    "PublishAllPorts",
    "ReadonlyRootfs",
    "SecurityOpt",
    "Tmpfs",
    "Ulimits",
  ]);
  const network = exactRecordAtLeast(container.NetworkSettings, ["Ports"]);
  if (
    state.Status !== "created" ||
    config.Image !== expected.imageId ||
    config.User !== "65532:65532" ||
    !absentNullOrEmptyArray(config.Cmd) ||
    !absentNullOrEmptyRecord(config.ExposedPorts) ||
    canonicalJson(config.Entrypoint) !==
      canonicalJson(["python", "-I", "-B", "/worker/parser.py"]) ||
    !Array.isArray(config.Env) ||
    config.Env.some(
      (entry) =>
        typeof entry !== "string" ||
        /(?:PASSWORD|PRIVATE|SECRET|TOKEN)=/iu.test(entry),
    ) ||
    host.NetworkMode !== "none" ||
    host.ReadonlyRootfs !== true ||
    host.Privileged !== false ||
    host.PublishAllPorts !== false ||
    !absentNullOrEmptyArray(host.CapAdd) ||
    canonicalJson(host.CapDrop) !== canonicalJson(["ALL"]) ||
    canonicalJson(host.SecurityOpt) !==
      canonicalJson(["no-new-privileges=true"]) ||
    host.PidsLimit !== FILING_PARSER_LIMITS.pids ||
    host.Memory !== FILING_PARSER_LIMITS.memoryBytes ||
    host.MemorySwap !== FILING_PARSER_LIMITS.memoryBytes ||
    host.NanoCpus !== FILING_PARSER_LIMITS.cpuCount * 1_000_000_000 ||
    host.IpcMode !== "none" ||
    !absentNullOrEmptyRecord(host.PortBindings) ||
    !absentNullOrEmptyRecord(network.Ports)
  )
    invalidEvidence();
  if (!Array.isArray(host.Ulimits) || host.Ulimits.length !== 1)
    invalidEvidence();
  const nofile = exactRecordAtLeast(host.Ulimits[0], ["Hard", "Name", "Soft"]);
  if (
    nofile.Name !== "nofile" ||
    nofile.Hard !== FILING_PARSER_LIMITS.openFiles ||
    nofile.Soft !== FILING_PARSER_LIMITS.openFiles
  )
    invalidEvidence();
  const tmpfs = exactRecord(host.Tmpfs, ["/tmp"]);
  const tmpfsOptions = stringMatching(tmpfs["/tmp"], VERSION_TEXT)
    .split(",")
    .sort();
  if (
    canonicalJson(tmpfsOptions) !==
    canonicalJson(["rw", "noexec", "nosuid", "nodev", "size=8388608"].sort())
  )
    invalidEvidence();
  if (!Array.isArray(container.Mounts) || container.Mounts.length !== 1)
    invalidEvidence();
  const mount = exactRecordAtLeast(container.Mounts[0], [
    "Destination",
    "Mode",
    "RW",
    "Source",
    "Type",
  ]);
  if (
    mount.Type !== "bind" ||
    mount.Source !== expected.inputSource ||
    mount.Destination !== "/input/filing.zip" ||
    mount.Mode !== "ro" ||
    mount.RW !== false
  )
    invalidEvidence();
  if (!Array.isArray(host.Mounts) || host.Mounts.length !== 1)
    invalidEvidence();
  const hostMount = exactRecordAtLeast(host.Mounts[0], [
    "ReadOnly",
    "Source",
    "Target",
    "Type",
  ]);
  if (
    hostMount.Type !== "bind" ||
    hostMount.Source !== expected.inputSource ||
    hostMount.Target !== "/input/filing.zip" ||
    hostMount.ReadOnly !== true
  )
    invalidEvidence();
}

function normalizeEvidence(value: unknown): FilingParserEvidence {
  const record = exactRecord(value, [
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
    record.schemaVersion !== FILING_PARSER_EVIDENCE_SCHEMA_VERSION ||
    record.evidenceVersion !== FILING_PARSER_EVIDENCE_VERSION ||
    record.claim !== FILING_PARSER_EVIDENCE_CLAIM ||
    record.status !== "passed" ||
    record.synthetic !== true
  )
    return invalidEvidence();
  const startedAt = isoUtc(record.startedAt);
  const completedAt = isoUtc(record.completedAt);
  if (Date.parse(completedAt) < Date.parse(startedAt)) return invalidEvidence();
  const sourceHashes = normalizeSourceHashes(record.sourceHashes);
  const image = normalizeImage(record.image);
  const caseOutcomes = normalizeCaseOutcomes(
    record.caseOutcomes,
    image.builtImageId,
  );
  const replaySource = caseOutcomes.find(
    (outcome) => outcome.caseId === "accepted_canonical",
  );
  const replay = caseOutcomes.find(
    (outcome) => outcome.caseId === "accepted_exact_replay",
  );
  if (
    replaySource?.observedStatus !== "accepted" ||
    replay?.observedStatus !== "accepted" ||
    replaySource.replayMatched !== true ||
    replay.replayMatched !== true ||
    caseOutcomes.some(
      (outcome) =>
        outcome.replayMatched &&
        outcome.caseId !== "accepted_canonical" &&
        outcome.caseId !== "accepted_exact_replay",
    ) ||
    replaySource.sourceSha256 !== replay.sourceSha256 ||
    replaySource.resultSha256 !== replay.resultSha256 ||
    replaySource.provenancePayloadSha256 !== replay.provenancePayloadSha256 ||
    replaySource.signatureSha256 !== replay.signatureSha256
  )
    return invalidEvidence();
  const accepted = caseOutcomes.filter(
    (outcome) => outcome.observedStatus === "accepted",
  ).length;
  const quarantined = caseOutcomes.length - accepted;
  if (
    accepted < 1 ||
    quarantined < 1 ||
    !caseOutcomes.some(
      (outcome) =>
        outcome.observedStatus === "accepted" && outcome.replayMatched,
    )
  )
    return invalidEvidence();
  const summary = exactRecord(record.summary, [
    "accepted",
    "exactByteReplayPassed",
    "quarantined",
    "total",
  ]);
  if (
    summary.accepted !== accepted ||
    summary.quarantined !== quarantined ||
    summary.total !== caseOutcomes.length ||
    summary.exactByteReplayPassed !== true
  )
    return invalidEvidence();

  return deepFreeze({
    caseOutcomes,
    checksPassed: exactLiteralArray(
      record.checksPassed,
      FILING_PARSER_EVIDENCE_CHECKS,
    ),
    claim: FILING_PARSER_EVIDENCE_CLAIM,
    completedAt,
    evidenceVersion: FILING_PARSER_EVIDENCE_VERSION,
    fixtureManifestSha256: hash(record.fixtureManifestSha256),
    image,
    notProven: exactLiteralArray(
      record.notProven,
      FILING_PARSER_EVIDENCE_NOT_PROVEN,
    ),
    repository: stringMatching(record.repository, REPOSITORY),
    revision: stringMatching(record.revision, COMMIT_SHA),
    runtime: normalizeRuntime(record.runtime),
    schemaVersion: FILING_PARSER_EVIDENCE_SCHEMA_VERSION,
    sourceHashes,
    startedAt,
    status: "passed" as const,
    summary: {
      accepted,
      exactByteReplayPassed: true as const,
      quarantined,
      total: caseOutcomes.length,
    },
    synthetic: true as const,
    tools: normalizeTools(record.tools),
    workflow: normalizeWorkflow(record.workflow),
  });
}

function normalizeSourceHashes(
  value: unknown,
): FilingParserEvidenceSourceHash[] {
  if (
    !Array.isArray(value) ||
    value.length !== FILING_PARSER_EVIDENCE_SOURCE_PATHS.length
  )
    return invalidEvidence();
  return value.map((entry, index) => {
    const record = exactRecord(entry, ["path", "sha256"]);
    const path = FILING_PARSER_EVIDENCE_SOURCE_PATHS[index];
    if (record.path !== path || path === undefined) return invalidEvidence();
    return Object.freeze({ path, sha256: hash(record.sha256) });
  });
}

function normalizeCaseOutcomes(
  value: unknown,
  builtImageId: `sha256:${string}`,
): FilingParserEvidenceCaseOutcome[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 128)
    return invalidEvidence();
  const ids = new Set<string>();
  return value.map((entry) => {
    const record = exactRecord(entry, [
      "caseId",
      "expectedStatus",
      "factCount",
      "imageId",
      "observedStatus",
      "provenanceAlgorithm",
      "provenanceKeyId",
      "provenancePayloadSha256",
      "provenanceVerified",
      "quarantineCode",
      "replayMatched",
      "resultSha256",
      "signatureSha256",
      "sourceSha256",
      "tamperRejected",
    ]);
    const caseId = stringMatching(record.caseId, SAFE_ID);
    if (ids.has(caseId)) return invalidEvidence();
    ids.add(caseId);
    const expectedStatus = status(record.expectedStatus);
    const observedStatus = status(record.observedStatus);
    if (expectedStatus !== observedStatus) return invalidEvidence();
    const quarantineCode =
      observedStatus === "accepted"
        ? record.quarantineCode === null
          ? null
          : invalidEvidence()
        : quarantine(record.quarantineCode);
    const factCount = record.factCount;
    if (
      (observedStatus === "accepted" &&
        factCount !== FILING_PARSER_LIMITS.facts) ||
      (observedStatus === "quarantined" && factCount !== 0) ||
      record.provenanceVerified !== true ||
      record.tamperRejected !== true ||
      record.provenanceAlgorithm !== "ed25519" ||
      record.provenanceKeyId !== "cycle2a-ephemeral-ed25519-v1" ||
      typeof record.replayMatched !== "boolean"
    )
      return invalidEvidence();
    const imageId = hash(record.imageId);
    if (imageId !== builtImageId) return invalidEvidence();
    return Object.freeze({
      caseId,
      expectedStatus,
      factCount: factCount as 0 | 2,
      imageId,
      observedStatus,
      provenanceAlgorithm: "ed25519" as const,
      provenanceKeyId: "cycle2a-ephemeral-ed25519-v1" as const,
      provenancePayloadSha256: hash(record.provenancePayloadSha256),
      provenanceVerified: true as const,
      quarantineCode,
      replayMatched: record.replayMatched,
      resultSha256: hash(record.resultSha256),
      signatureSha256: hash(record.signatureSha256),
      sourceSha256: hash(record.sourceSha256),
      tamperRejected: true as const,
    });
  });
}

function normalizeImage(value: unknown): FilingParserEvidence["image"] {
  const record = exactRecord(value, [
    "architecture",
    "baseIndexDigest",
    "basePlatformManifestDigest",
    "builtImageId",
    "operatingSystem",
    "pythonVersion",
  ]);
  if (
    record.architecture !== "amd64" ||
    record.operatingSystem !== "linux" ||
    record.pythonVersion !== "3.12.13"
  )
    return invalidEvidence();
  return Object.freeze({
    architecture: "amd64" as const,
    baseIndexDigest: hash(record.baseIndexDigest),
    basePlatformManifestDigest: hash(record.basePlatformManifestDigest),
    builtImageId: hash(record.builtImageId),
    operatingSystem: "linux" as const,
    pythonVersion: "3.12.13" as const,
  });
}

function normalizeRuntime(value: unknown): FilingParserEvidence["runtime"] {
  const record = exactRecord(value, [
    "capabilitiesDropped",
    "containerUser",
    "cpuCount",
    "inputMount",
    "memoryBytes",
    "networkMode",
    "noNewPrivileges",
    "noPublishedPorts",
    "openFiles",
    "pids",
    "readOnlyRootFilesystem",
    "temporaryFilesystem",
    "wallClockMilliseconds",
    "zeroResidue",
  ]);
  const fixed = {
    capabilitiesDropped: ["ALL"] as const,
    containerUser: "65532:65532" as const,
    cpuCount: FILING_PARSER_LIMITS.cpuCount,
    inputMount: "/input/filing.zip:ro" as const,
    memoryBytes: FILING_PARSER_LIMITS.memoryBytes,
    networkMode: "none" as const,
    noNewPrivileges: true as const,
    noPublishedPorts: true as const,
    openFiles: FILING_PARSER_LIMITS.openFiles,
    pids: FILING_PARSER_LIMITS.pids,
    readOnlyRootFilesystem: true as const,
    temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608" as const,
    wallClockMilliseconds: FILING_PARSER_LIMITS.workerWallMilliseconds,
    zeroResidue: true as const,
  };
  if (canonicalJson(record) !== canonicalJson(fixed)) return invalidEvidence();
  return deepFreeze(fixed);
}

function normalizeTools(value: unknown): FilingParserEvidence["tools"] {
  const record = exactRecord(value, FILING_PARSER_EVIDENCE_TOOL_KEYS);
  return Object.freeze(
    Object.fromEntries(
      FILING_PARSER_EVIDENCE_TOOL_KEYS.map((key) => [
        key,
        stringMatching(record[key], VERSION_TEXT),
      ]),
    ),
  ) as Readonly<Record<FilingParserEvidenceToolKey, string>>;
}

function normalizeWorkflow(value: unknown): FilingParserEvidence["workflow"] {
  const record = exactRecord(value, [
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    !["pull_request", "push", "workflow_dispatch"].includes(
      record.event as string,
    ) ||
    record.job !== "acceptance" ||
    record.workflowName !== FILING_PARSER_EVIDENCE_WORKFLOW ||
    !positiveInteger(record.runAttempt)
  )
    return invalidEvidence();
  const ref = stringMatching(record.ref, VERSION_TEXT);
  const runId = stringMatching(record.runId, /^[1-9][0-9]{0,19}$/);
  return Object.freeze({
    event: record.event as FilingParserEvidence["workflow"]["event"],
    job: "acceptance" as const,
    ref,
    runAttempt: record.runAttempt,
    runId,
    workflowName: FILING_PARSER_EVIDENCE_WORKFLOW,
  });
}

function exactLiteralArray<const T extends readonly string[]>(
  value: unknown,
  expected: T,
): T {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((entry, index) => entry !== expected[index])
  )
    return invalidEvidence();
  return Object.freeze([...expected]) as unknown as T;
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Readonly<Record<TKeys[number], unknown>> {
  if (!isRecord(value)) return invalidEvidence();
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => !keys.includes(key))
  )
    return invalidEvidence();
  return value as Readonly<Record<TKeys[number], unknown>>;
}

function exactRecordAtLeast<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Readonly<Record<string, unknown> & Record<TKeys[number], unknown>> {
  if (!isRecord(value) || keys.some((key) => !(key in value)))
    return invalidEvidence();
  return value as Readonly<
    Record<string, unknown> & Record<TKeys[number], unknown>
  >;
}

function absentNullOrEmptyArray(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  );
}

function absentNullOrEmptyRecord(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) && Object.keys(value).length === 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) && value !== 0.5) return invalidEvidence();
    return String(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (!isRecord(value)) return invalidEvidence();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function status(value: unknown): "accepted" | "quarantined" {
  if (value !== "accepted" && value !== "quarantined") return invalidEvidence();
  return value;
}

function quarantine(value: unknown): FilingParserQuarantineCode {
  if (!FILING_PARSER_QUARANTINE_CODES.includes(value as never))
    return invalidEvidence();
  return value as FilingParserQuarantineCode;
}

function hash(value: unknown): `sha256:${string}` {
  return stringMatching(value, SHA256) as `sha256:${string}`;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isoUtc(value: unknown): string {
  const text = stringMatching(value, ISO_UTC);
  if (new Date(text).toISOString() !== text) return invalidEvidence();
  return text;
}

function stringMatching(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value))
    return invalidEvidence();
  return value;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function invalidEvidence(): never {
  throw new Error("Filing parser evidence is invalid.");
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
