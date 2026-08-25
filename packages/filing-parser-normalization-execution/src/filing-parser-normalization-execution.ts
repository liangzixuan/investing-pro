import { createHash, createPublicKey, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { types as utilTypes } from "node:util";

import {
  handoffAuthenticatedSyntheticFilingParserResults,
  type FilingParserNormalizationHandoffProvenance,
  type FilingParserNormalizationHandoffSuccess,
} from "@research-cockpit/filing-parser-normalization-handoff";

export const FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM =
  "bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff" as const;
export const FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL =
  "research-cockpit.boundary=filing-parser-normalization-execution-v1" as const;

export const FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS = Object.freeze({
  archiveBytes: 1_048_576,
  archives: 2,
  containerControlMilliseconds: 5_000,
  containers: 2,
  cpuCount: 0.5,
  documentBytes: 131_072,
  memoryBytes: 134_217_728,
  openFiles: 64,
  pids: 32,
  processTerminationMilliseconds: 250,
  publicKeySpkiBytes: 512,
  signatureBytes: 64,
  signerMilliseconds: 5_000,
  stderrBytes: 4_096,
  stdoutBytes: 262_144,
  temporaryFilesystemBytes: 8_388_608,
  workerWallMilliseconds: 5_000,
} as const);

export const FILING_PARSER_NORMALIZATION_EXECUTION_CHECKS = Object.freeze([
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

export const FILING_PARSER_NORMALIZATION_EXECUTION_NOT_PROVEN = Object.freeze([
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

export interface FilingParserNormalizationExecutionSigner {
  readonly algorithm: "ed25519";
  readonly keyId: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

export interface FilingParserNormalizationExecutionProcessRequest {
  readonly args: readonly string[];
  readonly command: "docker";
  readonly signal?: AbortSignal;
  readonly stderrLimitBytes: number;
  readonly stdoutLimitBytes: number;
  readonly timeoutMilliseconds: number;
}

export interface FilingParserNormalizationExecutionProcessResult {
  readonly exitCode: number;
  readonly stderr: Uint8Array;
  readonly stdout: Uint8Array;
}

export interface FilingParserNormalizationExecutionProcessRunner {
  run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult>;
}

export interface FilingParserNormalizationExecutionConfiguration {
  readonly imageSha256: `sha256:${string}`;
  readonly processRunner?: FilingParserNormalizationExecutionProcessRunner;
  readonly publicKeySpki: Uint8Array;
  readonly signer: FilingParserNormalizationExecutionSigner;
}

export interface FilingParserNormalizationExecutionOptions {
  readonly signal?: AbortSignal;
}

export interface FilingParserNormalizationExecutionProvenance {
  readonly archiveCount: 2;
  readonly containerCount: 2;
  readonly documentCount: 2;
  readonly executionBindingSha256: `sha256:${string}`;
  readonly handoff: FilingParserNormalizationHandoffProvenance;
  readonly imageSha256: `sha256:${string}`;
  readonly keyId: string;
}

export interface FilingParserNormalizationExecutionSuccess {
  readonly claim: typeof FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM;
  readonly normalization: FilingParserNormalizationHandoffSuccess["normalization"];
  readonly provenance: FilingParserNormalizationExecutionProvenance;
  readonly schemaVersion: typeof FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION;
  readonly status: "normalized";
  readonly synthetic: true;
}

export interface FilingParserNormalizationExecutionQuarantinedResult {
  readonly claim: typeof FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM;
  readonly code: "execution_quarantined";
  readonly normalization: null;
  readonly provenance: null;
  readonly schemaVersion: typeof FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserNormalizationExecutionResult =
  | FilingParserNormalizationExecutionQuarantinedResult
  | FilingParserNormalizationExecutionSuccess;

export interface FilingParserNormalizationExecutionBoundary {
  execute(
    originalArchive: unknown,
    amendmentArchive: unknown,
    options?: FilingParserNormalizationExecutionOptions,
  ): Promise<FilingParserNormalizationExecutionResult>;
}

export class FilingParserNormalizationExecutionConfigurationError extends Error {
  public constructor() {
    super("Filing parser normalization execution configuration is invalid.");
    this.name = "FilingParserNormalizationExecutionConfigurationError";
  }
}

type ExecutionProcessErrorCode =
  | "execution_aborted"
  | "execution_failure"
  | "execution_output_limit"
  | "execution_timeout";

class ExecutionProcessError extends Error {
  public constructor(public readonly code: ExecutionProcessErrorCode) {
    super("Filing parser normalization execution process failed.");
    this.name = "ExecutionProcessError";
  }
}

interface ConfigurationSnapshot {
  readonly imageSha256: `sha256:${string}`;
  readonly processRunner: FilingParserNormalizationExecutionProcessRunner;
  readonly publicKeySpki: Uint8Array;
  readonly signer: {
    readonly keyId: string;
    readonly sign: (payload: Uint8Array) => Promise<Uint8Array>;
  };
}

interface ExecutedDocument {
  readonly bytes: Uint8Array;
  readonly value: Record<string, unknown>;
}

const IMAGE_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const KEY_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const SOURCE_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ACCESSION = /^SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const ACCESSION_PARTS = /^SYN-([0-9]{10})-([0-9]{2})-[0-9]{6}$/u;
const ENTITY_ID = /^entity\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}$/u;
const INSTRUMENT_ID = /^instrument\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const CONTAINER_ID = /^[0-9a-f]{64}$/u;
const INPUT_PATH = "/input/filing.zip";
const SIGNATURE_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-parser-normalization-handoff-signature:v1\u0000",
);
const EXECUTION_BINDING_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-parser-normalization-execution:v1\u0000",
);
const DOCUMENT_KEYS = [
  "accession",
  "acceptedAt",
  "amendmentOf",
  "availableAt",
  "contentSha256",
  "entityId",
  "facts",
  "form",
  "instrumentId",
  "parserVersion",
  "schemaVersion",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
] as const;
const SIGNER_KEYS = ["algorithm", "keyId", "sign"] as const;
const OPTIONS_KEYS = ["signal"] as const;
const FACT_KEYS = [
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
] as const;
const FACT_CONTRACTS = [
  ["assets", "rc-synthetic:Assets", "instant", "USD"],
  ["cash", "rc-synthetic:CashAndCashEquivalents", "instant", "USD"],
  ["debt", "rc-synthetic:Debt", "instant", "USD"],
  [
    "diluted_shares",
    "rc-synthetic:WeightedAverageDilutedShares",
    "duration",
    "shares",
  ],
  ["free_cash_flow", "rc-synthetic:FreeCashFlow", "duration", "USD"],
  ["gross_profit", "rc-synthetic:GrossProfit", "duration", "USD"],
  ["net_income", "rc-synthetic:NetIncome", "duration", "USD"],
  ["operating_cash_flow", "rc-synthetic:OperatingCashFlow", "duration", "USD"],
  ["operating_income", "rc-synthetic:OperatingIncome", "duration", "USD"],
  ["revenue", "rc-synthetic:Revenue", "duration", "USD"],
] as const;
const FACT_DOCUMENT_KEYS = [
  "concept",
  "dimensions",
  "key",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
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

const QUARANTINED: FilingParserNormalizationExecutionQuarantinedResult =
  Object.freeze({
    claim: FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM,
    code: "execution_quarantined" as const,
    normalization: null,
    provenance: null,
    schemaVersion: FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });

export function createFilingParserNormalizationExecutionBoundary(
  configurationValue: unknown,
): FilingParserNormalizationExecutionBoundary {
  if (arguments.length !== 1)
    throw new FilingParserNormalizationExecutionConfigurationError();
  const configuration = configurationSnapshot(configurationValue);
  return new DockerFilingParserNormalizationExecutionBoundary(configuration);
}

class DockerFilingParserNormalizationExecutionBoundary implements FilingParserNormalizationExecutionBoundary {
  #state: "busy" | "ready" = "ready";

  public constructor(private readonly configuration: ConfigurationSnapshot) {}

  public async execute(
    originalArchiveValue: unknown,
    amendmentArchiveValue: unknown,
    optionsValue?: FilingParserNormalizationExecutionOptions,
  ): Promise<FilingParserNormalizationExecutionResult> {
    if (arguments.length < 2 || arguments.length > 3 || this.#state !== "ready")
      return QUARANTINED;
    this.#state = "busy";
    try {
      const signal = executionSignal(optionsValue);
      if (isAborted(signal)) return QUARANTINED;
      const originalArchive = snapshotBytes(
        originalArchiveValue,
        FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.archiveBytes,
      );
      const amendmentArchive = snapshotBytes(
        amendmentArchiveValue,
        FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.archiveBytes,
      );
      if (
        originalArchive.byteLength === 0 ||
        amendmentArchive.byteLength === 0 ||
        bytesEqual(originalArchive, amendmentArchive)
      )
        return QUARANTINED;

      const original = await this.executeArchive(originalArchive, signal);
      if (original === null || isAborted(signal)) return QUARANTINED;
      const amendment = await this.executeArchive(amendmentArchive, signal);
      if (amendment === null || isAborted(signal)) return QUARANTINED;
      if (!validDocumentPair(original, amendment)) return QUARANTINED;

      const originalEnvelope = await this.signEnvelope(
        original,
        originalArchive,
        signal,
      );
      if (originalEnvelope === null || isAborted(signal)) return QUARANTINED;
      const amendmentEnvelope = await this.signEnvelope(
        amendment,
        amendmentArchive,
        signal,
      );
      if (amendmentEnvelope === null || isAborted(signal)) return QUARANTINED;

      const handoff = handoffAuthenticatedSyntheticFilingParserResults(
        originalArchive,
        amendmentArchive,
        originalEnvelope,
        amendmentEnvelope,
        {
          expectedImageSha256: this.configuration.imageSha256,
          expectedKeyId: this.configuration.signer.keyId,
          publicKeySpki: this.configuration.publicKeySpki,
        },
      );
      if (handoff.status !== "normalized" || isAborted(signal))
        return QUARANTINED;
      const provenance = Object.freeze({
        archiveCount: 2 as const,
        containerCount: 2 as const,
        documentCount: 2 as const,
        executionBindingSha256: sha256(
          concatBytes(
            EXECUTION_BINDING_DOMAIN,
            canonicalBytes({
              handoffPairBindingSha256: handoff.provenance.pairBindingSha256,
              imageSha256: this.configuration.imageSha256,
              keyId: this.configuration.signer.keyId,
              originalDocumentSha256: sha256(original.bytes),
              amendmentDocumentSha256: sha256(amendment.bytes),
            }),
          ),
        ),
        handoff: handoff.provenance,
        imageSha256: this.configuration.imageSha256,
        keyId: this.configuration.signer.keyId,
      });
      return Object.freeze({
        claim: FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM,
        normalization: handoff.normalization,
        provenance,
        schemaVersion: FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION,
        status: "normalized" as const,
        synthetic: true as const,
      });
    } catch {
      return QUARANTINED;
    } finally {
      this.#state = "ready";
    }
  }

  private async executeArchive(
    archive: Uint8Array,
    signal: AbortSignal | undefined,
  ): Promise<ExecutedDocument | null> {
    let stagingDirectory: string | null = null;
    let createAttempted = false;
    let containerCreated = false;
    let cleanupFailed = false;
    let document: ExecutedDocument | null;
    const containerName = `research-cockpit-filing-normalization-${randomUUID()}`;
    try {
      stagingDirectory = await mkdtemp(
        join(tmpdir(), "research-cockpit-filing-normalization-"),
      );
      const archivePath = join(stagingDirectory, "filing.zip");
      if (
        archivePath.includes(",") ||
        archivePath.includes("\r") ||
        archivePath.includes("\n") ||
        archivePath.includes("\u0000")
      )
        return null;
      await writeFile(archivePath, archive, { flag: "wx", mode: 0o444 });
      if (isAborted(signal)) return null;
      createAttempted = true;
      const created = await this.runProcess({
        args: dockerCreateArguments(
          this.configuration.imageSha256,
          containerName,
          archivePath,
        ),
        ...(signal === undefined ? {} : { signal }),
        stderrLimitBytes:
          FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stderrBytes,
        stdoutLimitBytes: 256,
        timeoutMilliseconds:
          FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.containerControlMilliseconds,
      });
      if (
        created.exitCode !== 0 ||
        created.stderr.byteLength !== 0 ||
        !CONTAINER_ID.test(asciiLine(created.stdout))
      )
        return null;
      containerCreated = true;
      const started = await this.runProcess({
        args: ["start", "--attach", containerName],
        ...(signal === undefined ? {} : { signal }),
        stderrLimitBytes:
          FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stderrBytes,
        stdoutLimitBytes:
          FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stdoutBytes,
        timeoutMilliseconds:
          FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.workerWallMilliseconds,
      });
      if (started.exitCode !== 0 || started.stderr.byteLength !== 0)
        return null;
      document = parseExecutedDocument(started.stdout, sha256(archive));
    } catch {
      document = null;
    } finally {
      if (createAttempted) {
        try {
          const removed = await this.runProcess({
            args: ["rm", "--force", containerName],
            stderrLimitBytes:
              FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stderrBytes,
            stdoutLimitBytes: 256,
            timeoutMilliseconds:
              FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.containerControlMilliseconds,
          });
          if (
            (containerCreated && removed.exitCode !== 0) ||
            (!containerCreated &&
              removed.exitCode !== 0 &&
              removed.exitCode !== 1) ||
            removed.stderr.byteLength !== 0
          )
            cleanupFailed = true;
        } catch {
          cleanupFailed = true;
        }
        try {
          const residue = await this.runProcess({
            args: [
              "container",
              "ls",
              "--all",
              "--quiet",
              "--filter",
              `label=${FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL}`,
              "--filter",
              `name=^/${containerName}$`,
            ],
            stderrLimitBytes:
              FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stderrBytes,
            stdoutLimitBytes: 256,
            timeoutMilliseconds:
              FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.containerControlMilliseconds,
          });
          if (
            residue.exitCode !== 0 ||
            residue.stdout.byteLength !== 0 ||
            residue.stderr.byteLength !== 0
          )
            cleanupFailed = true;
        } catch {
          cleanupFailed = true;
        }
      }
      if (stagingDirectory !== null) {
        try {
          await rm(stagingDirectory, { recursive: true, force: false });
        } catch {
          cleanupFailed = true;
        }
      }
    }
    return cleanupFailed ? null : document;
  }

  private async signEnvelope(
    document: ExecutedDocument,
    archive: Uint8Array,
    signal: AbortSignal | undefined,
  ): Promise<Uint8Array | null> {
    try {
      const payload = {
        algorithm: "ed25519" as const,
        document: document.value,
        imageSha256: this.configuration.imageSha256,
        keyId: this.configuration.signer.keyId,
        sourceSha256: sha256(archive),
      };
      const payloadBytes = canonicalBytes(payload);
      const signingPayload = concatBytes(SIGNATURE_DOMAIN, payloadBytes);
      const signature = snapshotBytes(
        await boundedSignerCall(
          this.configuration.signer.sign,
          snapshotBytes(
            signingPayload,
            signingPayload.byteLength,
            signingPayload.byteLength,
          ),
          signal,
        ),
        FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.signatureBytes,
        FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.signatureBytes,
      );
      return canonicalBytes({
        payload,
        schemaVersion: "1.0.0",
        signature: Buffer.from(signature).toString("base64url"),
        synthetic: true,
      });
    } catch {
      return null;
    }
  }

  private async runProcess(
    request: Omit<FilingParserNormalizationExecutionProcessRequest, "command">,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    const processRequest = {
      command: "docker",
      ...request,
    } as const;
    const result = await boundedProcessCall(
      this.configuration.processRunner.run.bind(
        this.configuration.processRunner,
      ),
      processRequest,
    );
    return processResultSnapshot(
      result,
      request.stdoutLimitBytes,
      request.stderrLimitBytes,
    );
  }
}

class NodeDockerProcessRunner implements FilingParserNormalizationExecutionProcessRunner {
  public run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    if (
      request.command !== "docker" ||
      !Array.isArray(request.args) ||
      !request.args.every((argument) => typeof argument === "string") ||
      !positiveInteger(request.timeoutMilliseconds) ||
      !positiveInteger(request.stdoutLimitBytes) ||
      !positiveInteger(request.stderrLimitBytes)
    )
      return Promise.reject(new ExecutionProcessError("execution_failure"));
    if (request.signal?.aborted === true)
      return Promise.reject(new ExecutionProcessError("execution_aborted"));

    return new Promise((resolve, reject) => {
      const child = spawn(request.command, [...request.args], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let failure: ExecutionProcessErrorCode | null = null;
      let settled = false;
      const requestStop = (code: ExecutionProcessErrorCode): void => {
        failure ??= code;
        try {
          child.kill("SIGKILL");
        } catch {
          failure = "execution_failure";
        }
      };
      const abort = (): void => requestStop("execution_aborted");
      const timeout = setTimeout(
        () => requestStop("execution_timeout"),
        request.timeoutMilliseconds,
      );
      request.signal?.addEventListener("abort", abort, { once: true });
      if (request.signal?.aborted === true) abort();
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > request.stdoutLimitBytes) {
          requestStop("execution_output_limit");
          return;
        }
        stdout.push(Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.byteLength;
        if (stderrBytes > request.stderrLimitBytes) {
          requestStop("execution_output_limit");
          return;
        }
        stderr.push(Buffer.from(chunk));
      });
      child.on("error", () => {
        failure ??= "execution_failure";
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", abort);
        if (failure !== null || code === null || !Number.isInteger(code)) {
          reject(new ExecutionProcessError(failure ?? "execution_failure"));
          return;
        }
        resolve({
          exitCode: code,
          stderr: Uint8Array.from(Buffer.concat(stderr)),
          stdout: Uint8Array.from(Buffer.concat(stdout)),
        });
      });
    });
  }
}

function configurationSnapshot(value: unknown): ConfigurationSnapshot {
  try {
    const configuration = exactRecordWithOptional(
      value,
      ["imageSha256", "publicKeySpki", "signer"] as const,
      ["processRunner"] as const,
    );
    const imageSha256 = dataValue(configuration.imageSha256);
    const signerValue = dataValue(configuration.signer);
    const publicKeySpkiValue = dataValue(configuration.publicKeySpki);
    const processRunnerValue = optionalDataValue(configuration.processRunner);
    if (typeof imageSha256 !== "string" || !IMAGE_SHA256.test(imageSha256))
      invalidConfiguration();
    const publicKeySpki = snapshotBytes(
      publicKeySpkiValue,
      FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.publicKeySpkiBytes,
    );
    const publicKey = createPublicKey({
      format: "der",
      key: Buffer.from(publicKeySpki),
      type: "spki",
    });
    const canonicalSpki = publicKey.export({ format: "der", type: "spki" });
    if (
      publicKey.asymmetricKeyType !== "ed25519" ||
      !bytesEqual(publicKeySpki, canonicalSpki)
    )
      invalidConfiguration();
    const signerRecord = exactRecord(signerValue, SIGNER_KEYS);
    const algorithm = dataValue(signerRecord.algorithm);
    const keyId = dataValue(signerRecord.keyId);
    const sign = dataValue(signerRecord.sign);
    if (
      algorithm !== "ed25519" ||
      typeof keyId !== "string" ||
      !KEY_ID.test(keyId) ||
      typeof sign !== "function"
    )
      invalidConfiguration();
    let processRunner: FilingParserNormalizationExecutionProcessRunner;
    if (processRunnerValue === undefined) {
      processRunner = new NodeDockerProcessRunner();
    } else {
      const run = dataMethod(processRunnerValue, "run");
      processRunner = Object.freeze({
        run: run.bind(
          processRunnerValue,
        ) as FilingParserNormalizationExecutionProcessRunner["run"],
      });
    }
    return Object.freeze({
      imageSha256: imageSha256 as `sha256:${string}`,
      processRunner,
      publicKeySpki,
      signer: Object.freeze({
        keyId,
        sign: sign.bind(signerValue) as (
          payload: Uint8Array,
        ) => Promise<Uint8Array>,
      }),
    });
  } catch (error) {
    if (error instanceof FilingParserNormalizationExecutionConfigurationError)
      throw error;
    throw new FilingParserNormalizationExecutionConfigurationError();
  }
}

function executionSignal(
  optionsValue: FilingParserNormalizationExecutionOptions | undefined,
): AbortSignal | undefined {
  if (optionsValue === undefined) return undefined;
  const options = exactRecordWithOptional(
    optionsValue,
    [] as const,
    OPTIONS_KEYS,
  );
  const signal = optionalDataValue(options.signal);
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError();
  return signal;
}

function parseExecutedDocument(
  bytesValue: Uint8Array,
  expectedSourceSha256: `sha256:${string}`,
): ExecutedDocument {
  const bytes = snapshotBytes(
    bytesValue,
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.documentBytes,
  );
  const text = textDecoder.decode(bytes);
  if (!text.endsWith("\n") || text.startsWith("\ufeff")) throw new TypeError();
  const parsed = JSON.parse(text) as unknown;
  if (`${canonicalJson(parsed)}\n` !== text) throw new TypeError();
  const value = plainRecord(parsed);
  if (!exactKeys(Object.keys(value), DOCUMENT_KEYS)) throw new TypeError();
  if (
    value.schemaVersion !== "1.0.0" ||
    value.synthetic !== true ||
    value.parserVersion !== "synthetic-ten-fact-producer-v1" ||
    value.taxonomyFamily !== "rc-synthetic-ten-fact" ||
    value.taxonomyVersion !== "1.0.0" ||
    value.contentSha256 !== expectedSourceSha256 ||
    typeof value.accession !== "string" ||
    !ACCESSION.test(value.accession) ||
    (value.form !== "10-K" && value.form !== "10-K/A") ||
    !Array.isArray(value.facts) ||
    value.facts.length !== 10
  )
    throw new TypeError();
  validateCompleteDocument(value);
  return Object.freeze({ bytes, value });
}

function validDocumentPair(
  original: ExecutedDocument,
  amendment: ExecutedDocument,
): boolean {
  if (!(
    original.value.form === "10-K" &&
    original.value.amendmentOf === null &&
    amendment.value.form === "10-K/A" &&
    amendment.value.amendmentOf === original.value.accession &&
    original.value.accession !== amendment.value.accession &&
    original.value.entityId === amendment.value.entityId &&
    original.value.instrumentId === amendment.value.instrumentId &&
    !bytesEqual(original.bytes, amendment.bytes)
  ))
    return false;
  const originalMatch = ACCESSION_PARTS.exec(
    original.value.accession as string,
  );
  const amendmentMatch = ACCESSION_PARTS.exec(
    amendment.value.accession as string,
  );
  if (
    originalMatch?.[1] === undefined ||
    originalMatch[2] === undefined ||
    amendmentMatch?.[1] === undefined ||
    amendmentMatch[2] === undefined ||
    originalMatch[1] !== amendmentMatch[1] ||
    originalMatch[2] !== (original.value.acceptedAt as string).slice(2, 4) ||
    amendmentMatch[2] !== (amendment.value.acceptedAt as string).slice(2, 4) ||
    (original.value.availableAt as string) >=
      (amendment.value.acceptedAt as string) ||
    original.value.contentSha256 === amendment.value.contentSha256
  )
    return false;
  const originalFacts = original.value.facts as readonly Record<
    string,
    unknown
  >[];
  const amendmentFacts = amendment.value.facts as readonly Record<
    string,
    unknown
  >[];
  let changed = 0;
  let unchanged = 0;
  for (let index = 0; index < FACT_KEYS.length; index += 1) {
    const predecessor = originalFacts[index];
    const successor = amendmentFacts[index];
    if (
      predecessor === undefined ||
      successor === undefined ||
      predecessor.key !== successor.key ||
      predecessor.periodStart !== successor.periodStart ||
      predecessor.periodEnd !== successor.periodEnd ||
      (predecessor.periodEnd as string) >=
        (original.value.acceptedAt as string).slice(0, 10)
    )
      return false;
    if (predecessor.value === successor.value) unchanged += 1;
    else changed += 1;
  }
  return changed > 0 && unchanged > 0;
}

function validateCompleteDocument(value: Record<string, unknown>): void {
  if (
    typeof value.acceptedAt !== "string" ||
    !isUtcInstant(value.acceptedAt) ||
    typeof value.availableAt !== "string" ||
    !isUtcInstant(value.availableAt) ||
    value.acceptedAt > value.availableAt ||
    typeof value.entityId !== "string" ||
    !ENTITY_ID.test(value.entityId) ||
    typeof value.instrumentId !== "string" ||
    !INSTRUMENT_ID.test(value.instrumentId) ||
    typeof value.contentSha256 !== "string" ||
    !SOURCE_SHA256.test(value.contentSha256) ||
    (value.form === "10-K"
      ? value.amendmentOf !== null
      : typeof value.amendmentOf !== "string" ||
        !ACCESSION.test(value.amendmentOf))
  )
    throw new TypeError();
  const facts = value.facts as readonly unknown[];
  for (let index = 0; index < FACT_CONTRACTS.length; index += 1) {
    const contract = FACT_CONTRACTS[index];
    const fact = plainRecord(facts[index]);
    if (
      contract === undefined ||
      !exactKeys(Object.keys(fact), FACT_DOCUMENT_KEYS) ||
      fact.key !== contract[0] ||
      fact.concept !== contract[1] ||
      fact.unit !== contract[3] ||
      !isEmptyPlainRecord(fact.dimensions) ||
      typeof fact.periodEnd !== "string" ||
      !isIsoDate(fact.periodEnd) ||
      typeof fact.value !== "string" ||
      !DECIMAL.test(fact.value) ||
      fact.value === "-0" ||
      (contract[2] === "instant"
        ? fact.periodStart !== null
        : typeof fact.periodStart !== "string" ||
          !isIsoDate(fact.periodStart) ||
          fact.periodStart >= fact.periodEnd)
    )
      throw new TypeError();
  }
  const first = facts[0] as Record<string, unknown> | undefined;
  const firstDuration = facts[3] as Record<string, unknown> | undefined;
  if (
    first === undefined ||
    firstDuration === undefined ||
    first.periodStart !== null ||
    typeof firstDuration.periodStart !== "string" ||
    first.periodEnd !== firstDuration.periodEnd
  )
    throw new TypeError();
  for (let index = 0; index < FACT_CONTRACTS.length; index += 1) {
    const contract = FACT_CONTRACTS[index];
    const fact = facts[index] as Record<string, unknown> | undefined;
    if (
      contract === undefined ||
      fact === undefined ||
      fact.periodEnd !== first.periodEnd ||
      (contract[2] === "instant"
        ? fact.periodStart !== null
        : fact.periodStart !== firstDuration.periodStart)
    )
      throw new TypeError();
  }
}

function isEmptyPlainRecord(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === 0
  );
}

function isUtcInstant(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString().slice(0, 10) === value
  );
}

function dockerCreateArguments(
  imageSha256: string,
  containerName: string,
  archivePath: string,
): string[] {
  return [
    "create",
    "--name",
    containerName,
    "--label",
    FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL,
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges=true",
    "--user",
    "65532:65532",
    "--pids-limit",
    String(FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.pids),
    "--memory",
    String(FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.memoryBytes),
    "--memory-swap",
    String(FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.memoryBytes),
    "--cpus",
    String(FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.cpuCount),
    "--ulimit",
    `nofile=${FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.openFiles}:${FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.openFiles}`,
    "--ipc",
    "none",
    "--tmpfs",
    `/tmp:rw,noexec,nosuid,nodev,size=${FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.temporaryFilesystemBytes}`,
    "--mount",
    `type=bind,source=${archivePath},destination=${INPUT_PATH},readonly`,
    imageSha256,
  ];
}

function processResultSnapshot(
  value: unknown,
  stdoutLimit: number,
  stderrLimit: number,
): FilingParserNormalizationExecutionProcessResult {
  const result = exactRecord(value, ["exitCode", "stderr", "stdout"] as const);
  const exitCode = dataValue(result.exitCode);
  if (
    typeof exitCode !== "number" ||
    !Number.isSafeInteger(exitCode) ||
    exitCode < 0 ||
    exitCode > 255
  )
    throw new ExecutionProcessError("execution_failure");
  return Object.freeze({
    exitCode,
    stderr: snapshotBytes(dataValue(result.stderr), stderrLimit, 0),
    stdout: snapshotBytes(dataValue(result.stdout), stdoutLimit, 0),
  });
}

function snapshotBytes(
  value: unknown,
  maximumBytes: number,
  minimumBytes = 1,
): Uint8Array {
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
    byteLength < minimumBytes ||
    byteLength > maximumBytes
  )
    throw new TypeError();
  const owned = new Uint8Array(byteLength);
  if (typeof intrinsicSet !== "function") throw new TypeError();
  Reflect.apply(intrinsicSet, owned, [value]);
  return owned;
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
  value: unknown,
  name: string,
): (...args: never[]) => unknown {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null ||
    isProxy(value)
  )
    throw new TypeError();
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

function plainRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError();
  return value as Record<string, unknown>;
}

function canonicalBytes(value: unknown): Uint8Array {
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

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function asciiLine(value: Uint8Array): string {
  const text = new TextDecoder("ascii", { fatal: true }).decode(value);
  if (!text.endsWith("\n") || text.includes("\r") || text.includes("\u0000"))
    return "";
  const line = text.slice(0, -1);
  return line.includes("\n") ? "" : line;
}

function boundedSignerCall(
  sign: (payload: Uint8Array) => Promise<Uint8Array>,
  payload: Uint8Array,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  if (isAborted(signal))
    return Promise.reject(new ExecutionProcessError("execution_aborted"));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      action();
    };
    const abort = (): void =>
      finish(() => reject(new ExecutionProcessError("execution_aborted")));
    const timeout = setTimeout(
      () =>
        finish(() => reject(new ExecutionProcessError("execution_timeout"))),
      FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.signerMilliseconds,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (isAborted(signal)) {
      abort();
      return;
    }
    Promise.resolve()
      .then(() => sign(payload))
      .then(
        (signature) => finish(() => resolve(signature)),
        () =>
          finish(() => reject(new ExecutionProcessError("execution_failure"))),
      );
  });
}

function boundedProcessCall(
  run: FilingParserNormalizationExecutionProcessRunner["run"],
  request: FilingParserNormalizationExecutionProcessRequest,
): Promise<FilingParserNormalizationExecutionProcessResult> {
  if (isAborted(request.signal))
    return Promise.reject(new ExecutionProcessError("execution_aborted"));
  return new Promise((resolve, reject) => {
    let settled = false;
    let stopCode: ExecutionProcessErrorCode | null = null;
    let terminationTimeout: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const forwardedRequest: FilingParserNormalizationExecutionProcessRequest = {
      ...request,
      signal: controller.signal,
    };
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (terminationTimeout !== undefined) clearTimeout(terminationTimeout);
      request.signal?.removeEventListener("abort", abort);
      action();
    };
    const requestStop = (code: ExecutionProcessErrorCode): void => {
      if (stopCode !== null) return;
      stopCode = code;
      controller.abort();
      terminationTimeout = setTimeout(
        () => finish(() => reject(new ExecutionProcessError(code))),
        FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.processTerminationMilliseconds,
      );
    };
    const abort = (): void => requestStop("execution_aborted");
    const deadline = setTimeout(
      () => requestStop("execution_timeout"),
      request.timeoutMilliseconds,
    );
    request.signal?.addEventListener("abort", abort, { once: true });
    if (isAborted(request.signal)) {
      abort();
      return;
    }
    Promise.resolve()
      .then(() => run(forwardedRequest))
      .then(
        (result) =>
          finish(() => {
            if (stopCode === null) resolve(result);
            else reject(new ExecutionProcessError(stopCode));
          }),
        () =>
          finish(() =>
            reject(new ExecutionProcessError(stopCode ?? "execution_failure")),
          ),
      );
  });
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function invalidConfiguration(): never {
  throw new FilingParserNormalizationExecutionConfigurationError();
}
