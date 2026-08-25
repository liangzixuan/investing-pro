import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM,
  FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS,
  FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION,
  type FilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionResult,
  type FilingParserNormalizationExecutionSuccess,
} from "@research-cockpit/filing-parser-normalization-execution";

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM =
  "bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_ROLES = Object.freeze([
  "python-primary",
  "node-secondary",
] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_CHECKS = Object.freeze([
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
  "success_only_exact_commit_transition_two_image_case_source_artifact_and_offline_review",
  "historical_evidence_immutability_and_no_fetch_custody_database_api_web_queue_or_real_data",
] as const);

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_NOT_PROVEN = Object.freeze([
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

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS = Object.freeze({
  archiveBytes: FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.archiveBytes,
  archives: 2,
  engines: 2,
  factVersions: 20,
  lineageEdges: 10,
  normalizationDepth: 12,
  normalizationNodes: 2_048,
  normalizationStringCodePoints: 131_072,
});

export type FilingParserCrossEngineExecutionRole =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_ROLES)[number];

export interface FilingParserCrossEngineExecutionEngineConfiguration<
  Role extends FilingParserCrossEngineExecutionRole,
> {
  readonly boundary: FilingParserNormalizationExecutionBoundary;
  readonly engineId: string;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly role: Role;
}

export interface FilingParserCrossEngineExecutionConfiguration {
  readonly nodeSecondary: FilingParserCrossEngineExecutionEngineConfiguration<"node-secondary">;
  readonly pythonPrimary: FilingParserCrossEngineExecutionEngineConfiguration<"python-primary">;
}

export interface FilingParserCrossEngineExecutionOptions {
  readonly signal?: AbortSignal;
}

export interface FilingParserCrossEngineExecutionEngineProvenance {
  readonly engineId: string;
  readonly executionBindingSha256: `sha256:${string}`;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly role: FilingParserCrossEngineExecutionRole;
}

export interface FilingParserCrossEngineExecutionProvenance {
  readonly agreementSha256: `sha256:${string}`;
  readonly amendmentArchiveSha256: `sha256:${string}`;
  readonly engineCount: 2;
  readonly engines: readonly [
    FilingParserCrossEngineExecutionEngineProvenance,
    FilingParserCrossEngineExecutionEngineProvenance,
  ];
  readonly originalArchiveSha256: `sha256:${string}`;
}

export interface FilingParserCrossEngineExecutionSuccess {
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM;
  readonly normalization: FilingParserNormalizationExecutionSuccess["normalization"];
  readonly provenance: FilingParserCrossEngineExecutionProvenance;
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION;
  readonly status: "agreed";
  readonly synthetic: true;
}

export interface FilingParserCrossEngineExecutionQuarantinedResult {
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM;
  readonly code: "agreement_quarantined";
  readonly normalization: null;
  readonly provenance: null;
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserCrossEngineExecutionResult =
  | FilingParserCrossEngineExecutionQuarantinedResult
  | FilingParserCrossEngineExecutionSuccess;

export interface FilingParserCrossEngineExecutionBoundary {
  execute(
    originalArchive: unknown,
    amendmentArchive: unknown,
    options?: FilingParserCrossEngineExecutionOptions,
  ): Promise<FilingParserCrossEngineExecutionResult>;
}

export class FilingParserCrossEngineExecutionConfigurationError extends Error {
  public constructor() {
    super("Filing parser cross-engine execution configuration is invalid.");
    this.name = "FilingParserCrossEngineExecutionConfigurationError";
  }
}

interface EngineSnapshot {
  readonly boundary: FilingParserNormalizationExecutionBoundary;
  readonly engineId: string;
  readonly execute: FilingParserNormalizationExecutionBoundary["execute"];
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly role: FilingParserCrossEngineExecutionRole;
}

interface ConfigurationSnapshot {
  readonly nodeSecondary: EngineSnapshot;
  readonly pythonPrimary: EngineSnapshot;
}

interface ValidatedExecution {
  readonly executionBindingSha256: `sha256:${string}`;
  readonly normalization: FilingParserNormalizationExecutionSuccess["normalization"];
  readonly normalizationBytes: Uint8Array;
}

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ENGINE_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const KEY_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const FACT_ID = /^fact:sha256:[0-9a-f]{64}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ACCESSION = /^SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const FACT_KEYS = Object.freeze([
  "assets",
  "cash",
  "debt",
  "diluted_shares",
  "free_cash_flow",
  "gross_profit",
  "net_income",
  "operating_cash_flow",
  "operating_income",
  "revenue",
] as const);
const FACT_KEY_SET = new Set<string>(FACT_KEYS);
const AGREEMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-parser-cross-engine-execution:v1\u0000",
);
const textEncoder = new TextEncoder();
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const intrinsicSet = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "set",
)?.value as unknown;
const isProxy = utilTypes.isProxy;

const QUARANTINED: FilingParserCrossEngineExecutionQuarantinedResult =
  Object.freeze({
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM,
    code: "agreement_quarantined" as const,
    normalization: null,
    provenance: null,
    schemaVersion: FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });

export function createFilingParserCrossEngineExecutionBoundary(
  configurationValue: unknown,
): FilingParserCrossEngineExecutionBoundary {
  if (arguments.length !== 1) invalidConfiguration();
  const configuration = snapshotConfiguration(configurationValue);
  return new CrossEngineExecutionBoundary(configuration);
}

class CrossEngineExecutionBoundary implements FilingParserCrossEngineExecutionBoundary {
  #busy = false;

  public constructor(private readonly configuration: ConfigurationSnapshot) {}

  public async execute(
    originalArchiveValue: unknown,
    amendmentArchiveValue: unknown,
    optionsValue?: FilingParserCrossEngineExecutionOptions,
  ): Promise<FilingParserCrossEngineExecutionResult> {
    if (arguments.length < 2 || arguments.length > 3 || this.#busy)
      return QUARANTINED;
    this.#busy = true;
    try {
      const signal = executionSignal(optionsValue);
      if (isAborted(signal)) return QUARANTINED;
      const originalArchive = snapshotBytes(
        originalArchiveValue,
        FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.archiveBytes,
      );
      const amendmentArchive = snapshotBytes(
        amendmentArchiveValue,
        FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.archiveBytes,
      );
      if (bytesEqual(originalArchive, amendmentArchive)) return QUARANTINED;

      const python = await executeEngine(
        this.configuration.pythonPrimary,
        originalArchive,
        amendmentArchive,
        signal,
      );
      if (python === null || isAborted(signal)) return QUARANTINED;
      const node = await executeEngine(
        this.configuration.nodeSecondary,
        originalArchive,
        amendmentArchive,
        signal,
      );
      if (
        node === null ||
        isAborted(signal) ||
        !bytesEqual(python.normalizationBytes, node.normalizationBytes) ||
        python.executionBindingSha256 === node.executionBindingSha256
      )
        return QUARANTINED;

      const originalArchiveSha256 = sha256(originalArchive);
      const amendmentArchiveSha256 = sha256(amendmentArchive);
      const engineValues: [
        FilingParserCrossEngineExecutionEngineProvenance,
        FilingParserCrossEngineExecutionEngineProvenance,
      ] = [
        engineProvenance(this.configuration.pythonPrimary, python),
        engineProvenance(this.configuration.nodeSecondary, node),
      ];
      const engines = Object.freeze(engineValues);
      const agreementSha256 = sha256(
        concatBytes(
          AGREEMENT_DOMAIN,
          canonicalBytes({
            amendmentArchiveSha256,
            engines,
            normalizationSha256: sha256(python.normalizationBytes),
            originalArchiveSha256,
          }),
        ),
      );
      return Object.freeze({
        claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM,
        normalization: python.normalization,
        provenance: Object.freeze({
          agreementSha256,
          amendmentArchiveSha256,
          engineCount: 2 as const,
          engines,
          originalArchiveSha256,
        }),
        schemaVersion: FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION,
        status: "agreed" as const,
        synthetic: true as const,
      });
    } catch {
      return QUARANTINED;
    } finally {
      this.#busy = false;
    }
  }
}

async function executeEngine(
  engine: EngineSnapshot,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
  signal: AbortSignal | undefined,
): Promise<ValidatedExecution | null> {
  const originalCopy = snapshotBytes(
    originalArchive,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.archiveBytes,
  );
  const amendmentCopy = snapshotBytes(
    amendmentArchive,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.archiveBytes,
  );
  const options = signal === undefined ? undefined : Object.freeze({ signal });
  const result = (await Reflect.apply(engine.execute, engine.boundary, [
    originalCopy,
    amendmentCopy,
    ...(options === undefined ? [] : [options]),
  ])) as FilingParserNormalizationExecutionResult;
  if (isAborted(signal)) return null;
  return validateExecutionResult(result, engine.imageSha256);
}

function validateExecutionResult(
  value: unknown,
  expectedImageSha256: `sha256:${string}`,
): ValidatedExecution | null {
  try {
    const result = exactRecord(value, [
      "claim",
      "normalization",
      "provenance",
      "schemaVersion",
      "status",
      "synthetic",
    ] as const);
    if (
      dataValue(result.claim) !== FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM ||
      dataValue(result.schemaVersion) !==
        FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION ||
      dataValue(result.status) !== "normalized" ||
      dataValue(result.synthetic) !== true
    )
      return null;
    const provenance = exactRecord(dataValue(result.provenance), [
      "archiveCount",
      "containerCount",
      "documentCount",
      "executionBindingSha256",
      "handoff",
      "imageSha256",
      "keyId",
    ] as const);
    const executionBindingSha256 = dataValue(provenance.executionBindingSha256);
    const imageSha256 = dataValue(provenance.imageSha256);
    const keyId = dataValue(provenance.keyId);
    if (
      dataValue(provenance.archiveCount) !== 2 ||
      dataValue(provenance.containerCount) !== 2 ||
      dataValue(provenance.documentCount) !== 2 ||
      typeof executionBindingSha256 !== "string" ||
      !SHA256.test(executionBindingSha256) ||
      imageSha256 !== expectedImageSha256 ||
      typeof keyId !== "string" ||
      !KEY_ID.test(keyId)
    )
      return null;
    const handoff = exactRecord(dataValue(provenance.handoff), [
      "archiveCount",
      "documentCount",
      "imageSha256",
      "keyId",
      "pairBindingSha256",
      "publicKeySpkiSha256",
      "signatureCount",
    ] as const);
    if (
      dataValue(handoff.archiveCount) !== 2 ||
      dataValue(handoff.documentCount) !== 2 ||
      dataValue(handoff.signatureCount) !== 2 ||
      dataValue(handoff.imageSha256) !== expectedImageSha256 ||
      dataValue(handoff.keyId) !== keyId ||
      !sha256Value(dataValue(handoff.pairBindingSha256)) ||
      !sha256Value(dataValue(handoff.publicKeySpkiSha256))
    )
      return null;
    const normalization = snapshotJson(
      dataValue(result.normalization),
      FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.normalizationDepth,
      FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.normalizationNodes,
      FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.normalizationStringCodePoints,
    );
    validateNormalization(normalization);
    const frozen = deepFreeze(
      normalization,
    ) as unknown as FilingParserNormalizationExecutionSuccess["normalization"];
    return Object.freeze({
      executionBindingSha256: executionBindingSha256 as `sha256:${string}`,
      normalization: frozen,
      normalizationBytes: canonicalBytes(frozen),
    });
  } catch {
    return null;
  }
}

function validateNormalization(value: JsonValue): void {
  const record = jsonRecord(value, [
    "amendmentDocumentSha256",
    "audit",
    "claim",
    "factVersions",
    "lineage",
    "originalDocumentSha256",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  if (
    record.claim !==
      "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage" ||
    record.schemaVersion !== "1.0.0" ||
    record.status !== "normalized" ||
    record.synthetic !== true ||
    !sha256Value(record.originalDocumentSha256) ||
    !sha256Value(record.amendmentDocumentSha256) ||
    record.originalDocumentSha256 === record.amendmentDocumentSha256
  )
    throw new TypeError();
  const audit = jsonRecord(record.audit, [
    "factVersionCount",
    "lineageCount",
    "outcome",
  ]);
  if (
    audit.factVersionCount !== 20 ||
    audit.lineageCount !== 10 ||
    audit.outcome !== "normalized"
  )
    throw new TypeError();
  if (!Array.isArray(record.factVersions) || record.factVersions.length !== 20)
    throw new TypeError();
  if (!Array.isArray(record.lineage) || record.lineage.length !== 10)
    throw new TypeError();
  const factIds = new Set<string>();
  const keyCounts = new Map<string, number>();
  for (const value of record.factVersions) {
    const fact = jsonRecord(value, [
      "dimensions",
      "factId",
      "key",
      "knownFrom",
      "knownToExclusive",
      "parserVersion",
      "periodEnd",
      "periodStart",
      "predecessorFactId",
      "sourceAcceptedAt",
      "sourceAccession",
      "sourceAvailableAt",
      "sourceConcept",
      "sourceContentSha256",
      "sourceDocumentSha256",
      "successorFactId",
      "synthetic",
      "taxonomyFamily",
      "taxonomyVersion",
      "unit",
      "value",
    ]);
    if (
      !emptyJsonRecord(fact.dimensions) ||
      typeof fact.factId !== "string" ||
      !FACT_ID.test(fact.factId) ||
      factIds.has(fact.factId) ||
      typeof fact.key !== "string" ||
      !FACT_KEY_SET.has(fact.key) ||
      !isoUtc(fact.knownFrom) ||
      !(fact.knownToExclusive === null || isoUtc(fact.knownToExclusive)) ||
      fact.parserVersion !== "synthetic-ten-fact-producer-v1" ||
      !isoDate(fact.periodEnd) ||
      !(fact.periodStart === null || isoDate(fact.periodStart)) ||
      !nullableFactId(fact.predecessorFactId) ||
      !isoUtc(fact.sourceAcceptedAt) ||
      !accession(fact.sourceAccession) ||
      !isoUtc(fact.sourceAvailableAt) ||
      typeof fact.sourceConcept !== "string" ||
      fact.sourceConcept.length === 0 ||
      !sha256Value(fact.sourceContentSha256) ||
      (fact.sourceDocumentSha256 !== record.originalDocumentSha256 &&
        fact.sourceDocumentSha256 !== record.amendmentDocumentSha256) ||
      !nullableFactId(fact.successorFactId) ||
      fact.synthetic !== true ||
      fact.taxonomyFamily !== "rc-synthetic-ten-fact" ||
      fact.taxonomyVersion !== "1.0.0" ||
      (fact.unit !== "USD" && fact.unit !== "shares") ||
      typeof fact.value !== "string" ||
      fact.value.length === 0
    )
      throw new TypeError();
    factIds.add(fact.factId);
    keyCounts.set(fact.key, (keyCounts.get(fact.key) ?? 0) + 1);
  }
  if (FACT_KEYS.some((key) => keyCounts.get(key) !== 2)) throw new TypeError();
  const lineageKeys = new Set<string>();
  for (const value of record.lineage) {
    const lineage = jsonRecord(value, [
      "effectiveAt",
      "key",
      "predecessorFactId",
      "successorFactId",
    ]);
    if (
      !isoUtc(lineage.effectiveAt) ||
      typeof lineage.key !== "string" ||
      !FACT_KEY_SET.has(lineage.key) ||
      lineageKeys.has(lineage.key) ||
      typeof lineage.predecessorFactId !== "string" ||
      !factIds.has(lineage.predecessorFactId) ||
      typeof lineage.successorFactId !== "string" ||
      !factIds.has(lineage.successorFactId) ||
      lineage.predecessorFactId === lineage.successorFactId
    )
      throw new TypeError();
    lineageKeys.add(lineage.key);
  }
}

function snapshotConfiguration(value: unknown): ConfigurationSnapshot {
  try {
    const configuration = exactRecord(value, [
      "nodeSecondary",
      "pythonPrimary",
    ] as const);
    const pythonPrimary = engineSnapshot(
      dataValue(configuration.pythonPrimary),
      "python-primary",
    );
    const nodeSecondary = engineSnapshot(
      dataValue(configuration.nodeSecondary),
      "node-secondary",
    );
    if (
      pythonPrimary.boundary === nodeSecondary.boundary ||
      pythonPrimary.engineId === nodeSecondary.engineId ||
      pythonPrimary.imageSha256 === nodeSecondary.imageSha256 ||
      pythonPrimary.implementationSha256 === nodeSecondary.implementationSha256
    )
      invalidConfiguration();
    return Object.freeze({ nodeSecondary, pythonPrimary });
  } catch (error) {
    if (error instanceof FilingParserCrossEngineExecutionConfigurationError)
      throw error;
    invalidConfiguration();
  }
}

function engineSnapshot(
  value: unknown,
  expectedRole: FilingParserCrossEngineExecutionRole,
): EngineSnapshot {
  const record = exactRecord(value, [
    "boundary",
    "engineId",
    "imageSha256",
    "implementationSha256",
    "role",
  ] as const);
  const boundary = dataValue(record.boundary);
  const engineId = dataValue(record.engineId);
  const imageSha256 = dataValue(record.imageSha256);
  const implementationSha256 = dataValue(record.implementationSha256);
  if (
    (typeof boundary !== "object" && typeof boundary !== "function") ||
    boundary === null ||
    isProxy(boundary) ||
    typeof engineId !== "string" ||
    !ENGINE_ID.test(engineId) ||
    !sha256Value(imageSha256) ||
    !sha256Value(implementationSha256) ||
    dataValue(record.role) !== expectedRole
  )
    invalidConfiguration();
  const execute = dataMethod(boundary, "execute") as EngineSnapshot["execute"];
  return Object.freeze({
    boundary: boundary as FilingParserNormalizationExecutionBoundary,
    engineId,
    execute,
    imageSha256,
    implementationSha256,
    role: expectedRole,
  });
}

function engineProvenance(
  engine: EngineSnapshot,
  result: ValidatedExecution,
): FilingParserCrossEngineExecutionEngineProvenance {
  return Object.freeze({
    engineId: engine.engineId,
    executionBindingSha256: result.executionBindingSha256,
    imageSha256: engine.imageSha256,
    implementationSha256: engine.implementationSha256,
    role: engine.role,
  });
}

function executionSignal(
  value: FilingParserCrossEngineExecutionOptions | undefined,
): AbortSignal | undefined {
  if (value === undefined) return undefined;
  const options = exactRecordWithOptional(
    value,
    [] as const,
    ["signal"] as const,
  );
  const signal = optionalDataValue(options.signal);
  if (
    signal !== undefined &&
    (!(signal instanceof AbortSignal) ||
      isProxy(signal) ||
      Object.getPrototypeOf(signal) !== AbortSignal.prototype)
  )
    throw new TypeError();
  return signal;
}

function snapshotBytes(value: unknown, maximumBytes: number): Uint8Array {
  if (typeof value !== "object" || value === null || isProxy(value))
    throw new TypeError();
  const tag = TYPED_ARRAY_TAG_DESCRIPTOR?.get?.call(value) as unknown;
  const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(value) as unknown;
  const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
    value,
  ) as unknown;
  const backingLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
    buffer,
  ) as unknown;
  if (
    tag !== "Uint8Array" ||
    typeof byteLength !== "number" ||
    typeof backingLength !== "number" ||
    Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
    byteLength < 1 ||
    byteLength > maximumBytes ||
    typeof intrinsicSet !== "function"
  )
    throw new TypeError();
  const owned = new Uint8Array(byteLength);
  Reflect.apply(intrinsicSet, owned, [value]);
  return owned;
}

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function snapshotJson(
  value: unknown,
  maximumDepth: number,
  maximumNodes: number,
  maximumStringCodePoints: number,
): JsonValue {
  let nodes = 0;
  let stringCodePoints = 0;
  const visit = (candidate: unknown, depth: number): JsonValue => {
    nodes += 1;
    if (nodes > maximumNodes || depth > maximumDepth) throw new TypeError();
    if (candidate === null || typeof candidate === "boolean") return candidate;
    if (typeof candidate === "number") {
      if (!Number.isSafeInteger(candidate)) throw new TypeError();
      return candidate;
    }
    if (typeof candidate === "string") {
      stringCodePoints += Array.from(candidate).length;
      if (stringCodePoints > maximumStringCodePoints) throw new TypeError();
      return candidate;
    }
    if (typeof candidate !== "object" || isProxy(candidate))
      throw new TypeError();
    if (Array.isArray(candidate)) {
      if (Object.getPrototypeOf(candidate) !== Array.prototype)
        throw new TypeError();
      const keys = Reflect.ownKeys(candidate);
      const expectedKeys: PropertyKey[] = Array.from(
        { length: candidate.length },
        (_, index) => String(index),
      );
      expectedKeys.push("length");
      if (!exactKeys(keys, expectedKeys)) throw new TypeError();
      const output: JsonValue[] = [];
      for (let index = 0; index < candidate.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          candidate,
          String(index),
        );
        if (descriptor === undefined) throw new TypeError();
        output.push(visit(dataValue(descriptor), depth + 1));
      }
      return output;
    }
    if (Object.getPrototypeOf(candidate) !== Object.prototype)
      throw new TypeError();
    const output: { [key: string]: JsonValue } = {};
    for (const key of Reflect.ownKeys(candidate)) {
      if (typeof key !== "string") throw new TypeError();
      output[key] = visit(
        dataValue(Object.getOwnPropertyDescriptor(candidate, key)),
        depth + 1,
      );
    }
    return output;
  };
  return visit(value, 0);
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Record<Keys[number], PropertyDescriptor | undefined> {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(Reflect.ownKeys(value), keys)
  )
    throw new TypeError();
  return Object.getOwnPropertyDescriptors(value) as Record<
    Keys[number],
    PropertyDescriptor | undefined
  >;
}

function exactRecordWithOptional<
  const Required extends readonly string[],
  const Optional extends readonly string[],
>(
  value: unknown,
  required: Required,
  optional: Optional,
): Record<Required[number] | Optional[number], PropertyDescriptor | undefined> {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError();
  const actual = Reflect.ownKeys(value);
  const allowed: readonly PropertyKey[] = [...required, ...optional];
  if (
    !required.every((key) => actual.includes(key)) ||
    actual.some((key) => !allowed.includes(key))
  )
    throw new TypeError();
  return Object.getOwnPropertyDescriptors(value) as Record<
    Required[number] | Optional[number],
    PropertyDescriptor | undefined
  >;
}

function dataValue(descriptor: PropertyDescriptor | undefined): unknown {
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    throw new TypeError();
  return descriptor.value as unknown;
}

function optionalDataValue(
  descriptor: PropertyDescriptor | undefined,
): unknown {
  return descriptor === undefined ? undefined : dataValue(descriptor);
}

function dataMethod(
  value: object,
  name: string,
): (...args: never[]) => unknown {
  let current: object | null = value;
  for (let depth = 0; current !== null && depth < 16; depth += 1) {
    if (isProxy(current)) throw new TypeError();
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor !== undefined) {
      const method = dataValue(descriptor);
      if (typeof method !== "function") throw new TypeError();
      return method as (...args: never[]) => unknown;
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  throw new TypeError();
}

function exactKeys(
  actual: readonly PropertyKey[],
  expected: readonly PropertyKey[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((key) => actual.includes(key))
  );
}

function jsonRecord(
  value: JsonValue | undefined,
  keys: readonly string[],
): { [key: string]: JsonValue } {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !exactKeys(Object.keys(value), keys)
  )
    throw new TypeError();
  return value;
}

function emptyJsonRecord(value: JsonValue | undefined): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function canonicalBytes(value: JsonValue | object): Uint8Array {
  return textEncoder.encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function concatBytes(...values: readonly Uint8Array[]): Uint8Array {
  const length = values.reduce((total, value) => total + value.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.byteLength;
  }
  return result;
}

function bytesEqual(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  for (let index = 0; index < first.byteLength; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256Value(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && SHA256.test(value);
}

function nullableFactId(value: JsonValue | undefined): boolean {
  return value === null || (typeof value === "string" && FACT_ID.test(value));
}

function accession(value: JsonValue | undefined): boolean {
  return typeof value === "string" && ACCESSION.test(value);
}

function isoDate(value: JsonValue | undefined): boolean {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) && new Date(parsed).toISOString().startsWith(value)
  );
}

function isoUtc(value: JsonValue | undefined): boolean {
  if (typeof value !== "string" || !ISO_UTC.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function invalidConfiguration(): never {
  throw new FilingParserCrossEngineExecutionConfigurationError();
}
