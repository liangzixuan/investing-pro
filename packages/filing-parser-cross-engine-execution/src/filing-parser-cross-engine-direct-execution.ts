import { spawn } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  sign as ed25519Sign,
} from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL,
  FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS,
  createFilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionProcessRequest,
  type FilingParserNormalizationExecutionProcessResult,
  type FilingParserNormalizationExecutionProcessRunner,
} from "@research-cockpit/filing-parser-normalization-execution";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS,
  createFilingParserCrossEngineExecutionBoundary,
  type FilingParserCrossEngineExecutionEngineProvenance,
  type FilingParserCrossEngineExecutionOptions,
  type FilingParserCrossEngineExecutionProvenance,
  type FilingParserCrossEngineExecutionSuccess,
} from "./filing-parser-cross-engine-execution";

export const FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM =
  "bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding" as const;
export const FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE =
  "source_owned_direct_docker" as const;

export const FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS = Object.freeze(
  [
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
  ] as const,
);

export const FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN =
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

export interface FilingParserCrossEngineDirectExecutionEngineConfiguration {
  readonly engineId: string;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly role: "node-secondary" | "python-primary";
}

export interface FilingParserCrossEngineDirectExecutionConfiguration {
  readonly nodeSecondary: FilingParserCrossEngineDirectExecutionEngineConfiguration & {
    readonly role: "node-secondary";
  };
  readonly pythonPrimary: FilingParserCrossEngineDirectExecutionEngineConfiguration & {
    readonly role: "python-primary";
  };
}

export interface FilingParserCrossEngineDirectExecutionLifecycleReceipt {
  readonly archiveSha256: `sha256:${string}`;
  readonly containerIdSha256: `sha256:${string}`;
  readonly documentRole: "amendment" | "original";
  readonly documentSha256: `sha256:${string}`;
  readonly engineId: string;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly keyId: "cycle2m-ephemeral-ed25519-v1";
  readonly lifecycleBindingSha256: `sha256:${string}`;
  readonly publicKeySpkiSha256: `sha256:${string}`;
  readonly role: "node-secondary" | "python-primary";
  readonly zeroResidue: true;
}

export interface FilingParserCrossEngineDirectExecutionEngineLifecycle {
  readonly engine: FilingParserCrossEngineExecutionEngineProvenance;
  readonly lifecycles: readonly [
    FilingParserCrossEngineDirectExecutionLifecycleReceipt,
    FilingParserCrossEngineDirectExecutionLifecycleReceipt,
  ];
  readonly role: "node-secondary" | "python-primary";
}

export interface FilingParserCrossEngineDirectExecutionProvenance {
  readonly agreement: FilingParserCrossEngineExecutionProvenance;
  readonly engineLifecycles: readonly [
    FilingParserCrossEngineDirectExecutionEngineLifecycle,
    FilingParserCrossEngineDirectExecutionEngineLifecycle,
  ];
  readonly ephemeralPublicKeySpkiSha256: `sha256:${string}`;
  readonly executionMode: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE;
  readonly invocationBindingSha256: `sha256:${string}`;
  readonly keyId: "cycle2m-ephemeral-ed25519-v1";
  readonly normalizationSha256: `sha256:${string}`;
}

export interface FilingParserCrossEngineDirectExecutionSuccess {
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM;
  readonly normalization: FilingParserCrossEngineExecutionSuccess["normalization"];
  readonly provenance: FilingParserCrossEngineDirectExecutionProvenance;
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION;
  readonly status: "agreed";
  readonly synthetic: true;
}

export interface FilingParserCrossEngineDirectExecutionQuarantinedResult {
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM;
  readonly code: "direct_execution_quarantined";
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserCrossEngineDirectExecutionResult =
  | FilingParserCrossEngineDirectExecutionQuarantinedResult
  | FilingParserCrossEngineDirectExecutionSuccess;

export interface FilingParserCrossEngineDirectExecutionBoundary {
  execute(
    originalArchive: unknown,
    amendmentArchive: unknown,
    options?: FilingParserCrossEngineExecutionOptions,
  ): Promise<FilingParserCrossEngineDirectExecutionResult>;
}

interface ConfigurationSnapshot {
  readonly nodeSecondary: EngineConfigurationSnapshot;
  readonly pythonPrimary: EngineConfigurationSnapshot;
}

interface EngineConfigurationSnapshot {
  readonly engineId: string;
  readonly imageSha256: `sha256:${string}`;
  readonly implementationSha256: `sha256:${string}`;
  readonly role: "node-secondary" | "python-primary";
}

interface DockerExecutor {
  execute(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult>;
}

interface CompletedLifecycle {
  readonly containerId: string;
  readonly receipt: FilingParserCrossEngineDirectExecutionLifecycleReceipt;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const ENGINE_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const CONTAINER_ID = /^[0-9a-f]{64}$/u;
const CONTAINER_NAME = /^research-cockpit-filing-normalization-[0-9a-f-]{36}$/u;
const textEncoder = new TextEncoder();
const isProxy = utilTypes.isProxy;
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
const INVOCATION_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-direct-cross-engine-invocation:v1\u0000",
);
const LIFECYCLE_DOMAIN = textEncoder.encode(
  "research-cockpit:synthetic-filing-parser-direct-container-lifecycle:v1\u0000",
);

const QUARANTINED: FilingParserCrossEngineDirectExecutionQuarantinedResult =
  Object.freeze({
    claim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
    code: "direct_execution_quarantined" as const,
    schemaVersion: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
const QUARANTINING_BOUNDARY: FilingParserCrossEngineDirectExecutionBoundary =
  Object.freeze({
    execute: (): Promise<FilingParserCrossEngineDirectExecutionResult> =>
      Promise.resolve(QUARANTINED),
  });

export function createFilingParserCrossEngineDirectExecutionBoundary(
  configurationValue: unknown,
): FilingParserCrossEngineDirectExecutionBoundary {
  if (arguments.length !== 1) return QUARANTINING_BOUNDARY;
  const configuration = snapshotConfiguration(configurationValue);
  if (configuration === null) return QUARANTINING_BOUNDARY;
  return new DirectExecutionBoundary(configuration, new NodeDockerExecutor());
}

/** @internal Test-only dependency seam; intentionally absent from package exports. */
export function createFilingParserCrossEngineDirectExecutionBoundaryForTest(
  configurationValue: unknown,
  executor: DockerExecutor,
  signerOverride?: (payload: Uint8Array) => Promise<Uint8Array>,
): FilingParserCrossEngineDirectExecutionBoundary {
  const configuration = snapshotConfiguration(configurationValue);
  return configuration === null
    ? QUARANTINING_BOUNDARY
    : new DirectExecutionBoundary(configuration, executor, signerOverride);
}

class DirectExecutionBoundary implements FilingParserCrossEngineDirectExecutionBoundary {
  #busy = false;
  readonly #usedContainerIds = new Set<string>();

  public constructor(
    private readonly configuration: ConfigurationSnapshot,
    private readonly executor: DockerExecutor,
    private readonly signerOverride?: (
      payload: Uint8Array,
    ) => Promise<Uint8Array>,
  ) {}

  public async execute(
    originalArchive: unknown,
    amendmentArchive: unknown,
    options?: FilingParserCrossEngineExecutionOptions,
  ): Promise<FilingParserCrossEngineDirectExecutionResult> {
    if (arguments.length < 2 || arguments.length > 3 || this.#busy)
      return QUARANTINED;
    this.#busy = true;
    try {
      const originalArchiveSnapshot = snapshotBytes(originalArchive);
      const amendmentArchiveSnapshot = snapshotBytes(amendmentArchive);
      if (bytesEqual(originalArchiveSnapshot, amendmentArchiveSnapshot))
        return QUARANTINED;
      const archiveSha256s = Object.freeze([
        sha256(originalArchiveSnapshot),
        sha256(amendmentArchiveSnapshot),
      ] as const);
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      const publicKeySpki = Uint8Array.from(
        publicKey.export({ format: "der", type: "spki" }),
      );
      const signer = Object.freeze({
        algorithm: "ed25519" as const,
        keyId: "cycle2m-ephemeral-ed25519-v1" as const,
        sign: (payload: Uint8Array): Promise<Uint8Array> =>
          this.signerOverride?.(payload) ??
          Promise.resolve(
            Uint8Array.from(ed25519Sign(null, payload, privateKey)),
          ),
      });
      const pythonRunner = new AuditedDockerRunner(
        this.executor,
        this.configuration.pythonPrimary,
        this.#usedContainerIds,
      );
      const nodeRunner = new AuditedDockerRunner(
        this.executor,
        this.configuration.nodeSecondary,
        this.#usedContainerIds,
      );
      const pythonBoundary = createFilingParserNormalizationExecutionBoundary({
        imageSha256: this.configuration.pythonPrimary.imageSha256,
        processRunner: pythonRunner,
        publicKeySpki,
        signer,
      });
      const nodeBoundary = createFilingParserNormalizationExecutionBoundary({
        imageSha256: this.configuration.nodeSecondary.imageSha256,
        processRunner: nodeRunner,
        publicKeySpki,
        signer,
      });
      const crossBoundary = createFilingParserCrossEngineExecutionBoundary({
        nodeSecondary: {
          ...this.configuration.nodeSecondary,
          boundary: nodeBoundary,
        },
        pythonPrimary: {
          ...this.configuration.pythonPrimary,
          boundary: pythonBoundary,
        },
      });
      const agreement = await crossBoundary.execute(
        originalArchiveSnapshot,
        amendmentArchiveSnapshot,
        ...(options === undefined ? [] : [options]),
      );
      if (agreement.status !== "agreed") return QUARANTINED;
      const keyId = "cycle2m-ephemeral-ed25519-v1" as const;
      const ephemeralPublicKeySpkiSha256 = sha256(publicKeySpki);
      const pythonLifecycles = pythonRunner.complete(
        archiveSha256s,
        keyId,
        ephemeralPublicKeySpkiSha256,
      );
      const nodeLifecycles = nodeRunner.complete(
        archiveSha256s,
        keyId,
        ephemeralPublicKeySpkiSha256,
      );
      if (pythonLifecycles === null || nodeLifecycles === null)
        return QUARANTINED;
      const normalizationSha256 = sha256(
        textEncoder.encode(`${canonicalJson(agreement.normalization)}\n`),
      );
      const engineLifecycles = Object.freeze([
        engineLifecycle(
          agreement.provenance.engines[0],
          pythonLifecycles,
          "python-primary",
        ),
        engineLifecycle(
          agreement.provenance.engines[1],
          nodeLifecycles,
          "node-secondary",
        ),
      ] as const);
      const invocationBindingSha256 = domainSha256(INVOCATION_DOMAIN, {
        agreementSha256: agreement.provenance.agreementSha256,
        executionMode: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
        keyId,
        lifecycleReceipts: engineLifecycles.flatMap(
          ({ lifecycles }) => lifecycles,
        ),
        normalizationSha256,
        publicKeySpkiSha256: ephemeralPublicKeySpkiSha256,
      });
      return Object.freeze({
        claim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
        normalization: agreement.normalization,
        provenance: Object.freeze({
          agreement: agreement.provenance,
          engineLifecycles,
          ephemeralPublicKeySpkiSha256,
          executionMode: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
          invocationBindingSha256,
          keyId,
          normalizationSha256,
        }),
        schemaVersion:
          FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION,
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

class AuditedDockerRunner implements FilingParserNormalizationExecutionProcessRunner {
  readonly #events: Array<{
    readonly args: readonly string[];
    readonly exitCode: number;
    readonly stderrSha256: `sha256:${string}`;
    readonly stdoutSha256: `sha256:${string}`;
  }> = [];

  public constructor(
    private readonly executor: DockerExecutor,
    private readonly engine: EngineConfigurationSnapshot,
    private readonly usedContainerIds: Set<string>,
  ) {}

  public async run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    if (
      request.command !== "docker" ||
      !Array.isArray(request.args) ||
      !request.args.every((value) => typeof value === "string")
    )
      throw new TypeError();
    const result = await this.executor.execute(request);
    const snapshot = snapshotProcessResult(result);
    const event = Object.freeze({
      args: Object.freeze([...request.args]),
      exitCode: snapshot.exitCode,
      stderrSha256: sha256(snapshot.stderr),
      stdoutSha256: sha256(snapshot.stdout),
    });
    if (request.args[0] === "create") {
      createStdout.set(event, Uint8Array.from(snapshot.stdout));
      const containerId = createOutputLine(event);
      if (containerId === null || this.usedContainerIds.has(containerId))
        throw new TypeError();
      this.usedContainerIds.add(containerId);
    }
    this.#events.push(event);
    return snapshot;
  }

  public complete(
    archiveSha256s: readonly [`sha256:${string}`, `sha256:${string}`],
    keyId: "cycle2m-ephemeral-ed25519-v1",
    publicKeySpkiSha256: `sha256:${string}`,
  ): readonly [CompletedLifecycle, CompletedLifecycle] | null {
    if (this.#events.length !== 8) return null;
    const completed: CompletedLifecycle[] = [];
    for (let index = 0; index < 2; index += 1) {
      const events = this.#events.slice(index * 4, index * 4 + 4);
      const create = events[0];
      const start = events[1];
      const remove = events[2];
      const residue = events[3];
      if (
        create === undefined ||
        start === undefined ||
        remove === undefined ||
        residue === undefined ||
        create.args[0] !== "create" ||
        create.args.at(-1) !== this.engine.imageSha256 ||
        start.args[0] !== "start" ||
        start.args[1] !== "--attach" ||
        remove.args[0] !== "rm" ||
        remove.args[1] !== "--force" ||
        residue.args[0] !== "container" ||
        residue.args[1] !== "ls" ||
        [create, start, remove, residue].some(
          (event) =>
            event.exitCode !== 0 ||
            event.stderrSha256 !== sha256(new Uint8Array()),
        ) ||
        residue.stdoutSha256 !== sha256(new Uint8Array())
      )
        return null;
      const nameIndex = create.args.indexOf("--name");
      const containerName = create.args[nameIndex + 1];
      const containerId = createOutputLine(create);
      if (
        nameIndex < 0 ||
        typeof containerName !== "string" ||
        !CONTAINER_NAME.test(containerName) ||
        !validCreateArguments(
          create.args,
          this.engine.imageSha256,
          containerName,
        ) ||
        JSON.stringify(start.args) !==
          JSON.stringify(["start", "--attach", containerName]) ||
        JSON.stringify(remove.args) !==
          JSON.stringify(["rm", "--force", containerName]) ||
        JSON.stringify(residue.args) !==
          JSON.stringify([
            "container",
            "ls",
            "--all",
            "--quiet",
            "--filter",
            `label=${FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL}`,
            "--filter",
            `name=^/${containerName}$`,
          ]) ||
        start.args[2] !== containerName ||
        remove.args[2] !== containerName ||
        !residue.args.includes(`name=^/${containerName}$`) ||
        !residue.args.includes(
          `label=${FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL}`,
        ) ||
        containerId === null ||
        !this.usedContainerIds.has(containerId)
      )
        return null;
      const documentRole = index === 0 ? "original" : "amendment";
      const lifecyclePreimage = Object.freeze({
        archiveSha256: archiveSha256s[index]!,
        containerIdSha256: sha256(textEncoder.encode(containerId)),
        documentRole,
        documentSha256: start.stdoutSha256,
        engineId: this.engine.engineId,
        imageSha256: this.engine.imageSha256,
        implementationSha256: this.engine.implementationSha256,
        keyId,
        publicKeySpkiSha256,
        role: this.engine.role,
        zeroResidue: true as const,
      });
      const receipt = Object.freeze({
        ...lifecyclePreimage,
        lifecycleBindingSha256: domainSha256(
          LIFECYCLE_DOMAIN,
          lifecyclePreimage,
        ),
      });
      completed.push(Object.freeze({ containerId, receipt }));
    }
    return Object.freeze(completed) as unknown as readonly [
      CompletedLifecycle,
      CompletedLifecycle,
    ];
  }
}

/* Create stdout is intentionally retained out-of-band from the public receipt. */
const createStdout = new WeakMap<object, Uint8Array>();

class NodeDockerExecutor implements DockerExecutor {
  public execute(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    if (
      request.command !== "docker" ||
      !Array.isArray(request.args) ||
      !request.args.every((value) => typeof value === "string") ||
      !positiveInteger(request.timeoutMilliseconds) ||
      !positiveInteger(request.stdoutLimitBytes) ||
      !positiveInteger(request.stderrLimitBytes) ||
      request.signal?.aborted === true
    )
      return Promise.reject(new TypeError());
    return new Promise((resolve, reject) => {
      const child = spawn("docker", [...request.args], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let failure = false;
      let settled = false;
      const stop = (): void => {
        failure = true;
        try {
          child.kill("SIGKILL");
        } catch {
          // The eventual close remains a failure.
        }
      };
      const abort = (): void => stop();
      const timeout = setTimeout(stop, request.timeoutMilliseconds);
      request.signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > request.stdoutLimitBytes) stop();
        else stdout.push(Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.byteLength;
        if (stderrBytes > request.stderrLimitBytes) stop();
        else stderr.push(Buffer.from(chunk));
      });
      child.on("error", stop);
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", abort);
        if (failure || code === null || !Number.isInteger(code)) {
          reject(new TypeError());
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

function createOutputLine(event: object): string | null {
  const stdout = createStdout.get(event);
  if (stdout === undefined) return null;
  const text = Buffer.from(stdout).toString("ascii");
  return text.endsWith("\n") && CONTAINER_ID.test(text.slice(0, -1))
    ? text.slice(0, -1)
    : null;
}

function engineLifecycle(
  engine: FilingParserCrossEngineExecutionEngineProvenance,
  completed: readonly [CompletedLifecycle, CompletedLifecycle],
  role: "node-secondary" | "python-primary",
): FilingParserCrossEngineDirectExecutionEngineLifecycle {
  if (engine.role !== role) throw new TypeError();
  return Object.freeze({
    engine,
    lifecycles: Object.freeze([
      completed[0].receipt,
      completed[1].receipt,
    ] as const),
    role,
  });
}

function snapshotConfiguration(value: unknown): ConfigurationSnapshot | null {
  try {
    const root = exactRecord(value, ["nodeSecondary", "pythonPrimary"]);
    const pythonPrimary = engineConfiguration(
      dataValue(root.pythonPrimary),
      "python-primary",
    );
    const nodeSecondary = engineConfiguration(
      dataValue(root.nodeSecondary),
      "node-secondary",
    );
    if (
      pythonPrimary.engineId === nodeSecondary.engineId ||
      pythonPrimary.imageSha256 === nodeSecondary.imageSha256 ||
      pythonPrimary.implementationSha256 === nodeSecondary.implementationSha256
    )
      return null;
    return Object.freeze({ nodeSecondary, pythonPrimary });
  } catch {
    return null;
  }
}

function engineConfiguration(
  value: unknown,
  role: "node-secondary" | "python-primary",
): EngineConfigurationSnapshot {
  const record = exactRecord(value, [
    "engineId",
    "imageSha256",
    "implementationSha256",
    "role",
  ]);
  const engineId = dataValue(record.engineId);
  const imageSha256 = dataValue(record.imageSha256);
  const implementationSha256 = dataValue(record.implementationSha256);
  if (
    typeof engineId !== "string" ||
    !ENGINE_ID.test(engineId) ||
    typeof imageSha256 !== "string" ||
    !HASH.test(imageSha256) ||
    typeof implementationSha256 !== "string" ||
    !HASH.test(implementationSha256) ||
    dataValue(record.role) !== role
  )
    throw new TypeError();
  return Object.freeze({
    engineId,
    imageSha256: imageSha256 as `sha256:${string}`,
    implementationSha256: implementationSha256 as `sha256:${string}`,
    role,
  });
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, PropertyDescriptor> {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    JSON.stringify(Reflect.ownKeys(value).sort()) !==
      JSON.stringify([...keys].sort())
  )
    throw new TypeError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return descriptors;
}

function dataValue(descriptor: PropertyDescriptor | undefined): unknown {
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    throw new TypeError();
  return descriptor.value;
}

function snapshotProcessResult(
  value: FilingParserNormalizationExecutionProcessResult,
): FilingParserNormalizationExecutionProcessResult {
  if (
    !Number.isSafeInteger(value.exitCode) ||
    value.exitCode < 0 ||
    value.exitCode > 255 ||
    !(value.stdout instanceof Uint8Array) ||
    !(value.stderr instanceof Uint8Array)
  )
    throw new TypeError();
  const result = Object.freeze({
    exitCode: value.exitCode,
    stderr: Uint8Array.from(value.stderr),
    stdout: Uint8Array.from(value.stdout),
  });
  return result;
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validCreateArguments(
  args: readonly string[],
  imageSha256: string,
  containerName: string,
): boolean {
  const mountIndex = args.indexOf("--mount");
  const mount = args[mountIndex + 1];
  if (
    mountIndex < 0 ||
    typeof mount !== "string" ||
    !mount.startsWith("type=bind,source=") ||
    !mount.endsWith(",destination=/input/filing.zip,readonly") ||
    mount.includes("\r") ||
    mount.includes("\n") ||
    mount.includes("\u0000")
  )
    return false;
  return (
    JSON.stringify(args) ===
    JSON.stringify([
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
      mount,
      imageSha256,
    ])
  );
}

function snapshotBytes(value: unknown): Uint8Array {
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
    byteLength > FILING_PARSER_CROSS_ENGINE_EXECUTION_LIMITS.archiveBytes ||
    typeof intrinsicSet !== "function"
  )
    throw new TypeError();
  const owned = new Uint8Array(byteLength);
  Reflect.apply(intrinsicSet, owned, [value]);
  return owned;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function domainSha256(domain: Uint8Array, value: object): `sha256:${string}` {
  return sha256(Buffer.concat([domain, canonicalBytes(value)]));
}

function canonicalBytes(value: object): Uint8Array {
  return textEncoder.encode(canonicalJson(value));
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

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
