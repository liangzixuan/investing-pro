import {
  createHash,
  randomUUID,
  verify as verifySignature,
  type KeyLike,
} from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export const FILING_PARSER_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_PARSER_PARSER_VERSION =
  "filing-parser-boundary-v1" as const;
export const FILING_PARSER_TAXONOMY_VERSION =
  "rc-synthetic-taxonomy-1.0.0" as const;
export const FILING_PARSER_CONTAINER_LABEL =
  "research-cockpit.boundary=filing-parser-v1" as const;
export const FILING_PARSER_CONCEPTS = ["net_income", "revenue"] as const;
export const FILING_PARSER_QUARANTINE_CODES = [
  "archive_invalid",
  "archive_entry_invalid",
  "archive_encrypted",
  "archive_limit_exceeded",
  "archive_nested",
  "manifest_invalid",
  "xml_forbidden_construct",
  "xml_limit_exceeded",
  "xml_invalid",
  "taxonomy_not_allowed",
  "fact_invalid",
  "fact_ambiguous",
  "worker_timeout",
  "worker_failure",
] as const;

export const FILING_PARSER_LIMITS = Object.freeze({
  archiveBytes: 1_048_576,
  archiveEntries: 2,
  manifestBytes: 16_384,
  xmlBytes: 2_097_152,
  aggregateUncompressedBytes: 2_113_536,
  maximumCompressionRatio: 100,
  xmlDepth: 64,
  xmlNodes: 20_000,
  xmlAttributesPerElement: 16,
  xmlTextCodePoints: 1_048_576,
  facts: 2,
  stdoutBytes: 65_536,
  stderrBytes: 4_096,
  workerWallMilliseconds: 5_000,
  dockerControlMilliseconds: 5_000,
  memoryBytes: 134_217_728,
  temporaryFilesystemBytes: 8_388_608,
  cpuCount: 0.5,
  pids: 32,
  openFiles: 64,
} as const);

export type FilingParserQuarantineCode =
  (typeof FILING_PARSER_QUARANTINE_CODES)[number];
export type FilingParserConcept = (typeof FILING_PARSER_CONCEPTS)[number];

export interface FilingParserFact {
  readonly concept: FilingParserConcept;
  readonly dimensions: Readonly<Record<string, never>>;
  readonly periodEnd: string;
  readonly periodStart: string;
  readonly unit: "USD";
  readonly value: string;
}

interface FilingParserResultBase {
  readonly facts: readonly FilingParserFact[];
  readonly parserVersion: typeof FILING_PARSER_PARSER_VERSION;
  readonly schemaVersion: typeof FILING_PARSER_SCHEMA_VERSION;
  readonly sourceSha256: `sha256:${string}`;
  readonly synthetic: true;
  readonly taxonomyVersion: typeof FILING_PARSER_TAXONOMY_VERSION;
}

export interface FilingParserAcceptedResult extends FilingParserResultBase {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly availableAt: string;
  readonly facts: readonly [FilingParserFact, FilingParserFact];
  readonly status: "accepted";
}

export interface FilingParserQuarantinedResult extends FilingParserResultBase {
  readonly code: FilingParserQuarantineCode;
  readonly facts: readonly [];
  readonly status: "quarantined";
}

export type FilingParserResult =
  FilingParserAcceptedResult | FilingParserQuarantinedResult;

export interface FilingParserProvenance {
  readonly algorithm: "ed25519";
  readonly imageId: `sha256:${string}`;
  readonly keyId: string;
  readonly payloadSha256: `sha256:${string}`;
  readonly signature: string;
}

export interface SignedFilingParserResult {
  readonly result: FilingParserResult;
  readonly provenance: FilingParserProvenance;
}

export interface FilingParserSigner {
  readonly algorithm: "ed25519";
  readonly keyId: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

export type FilingParserProcessErrorCode =
  | "FILING_PARSER_PROCESS_ABORTED"
  | "FILING_PARSER_PROCESS_TIMEOUT"
  | "FILING_PARSER_PROCESS_OUTPUT_LIMIT"
  | "FILING_PARSER_PROCESS_FAILURE";

export class FilingParserProcessError extends Error {
  public constructor(public readonly code: FilingParserProcessErrorCode) {
    super("Filing parser process failed.");
    this.name = "FilingParserProcessError";
  }
}

export interface FilingParserProcessRequest {
  readonly command: "docker";
  readonly args: readonly string[];
  readonly signal?: AbortSignal;
  readonly timeoutMilliseconds: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
}

export interface FilingParserProcessResult {
  readonly exitCode: number;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
}

export interface FilingParserProcessRunner {
  run(request: FilingParserProcessRequest): Promise<FilingParserProcessResult>;
}

export interface FilingParserParseOptions {
  readonly signal?: AbortSignal;
}

export interface FilingParserBoundary {
  parse(
    archive: Uint8Array,
    options?: FilingParserParseOptions,
  ): Promise<SignedFilingParserResult>;
}

export type FilingParserBoundaryErrorCode =
  | "FILING_PARSER_INVALID_CONFIGURATION"
  | "FILING_PARSER_INVALID_INPUT"
  | "FILING_PARSER_BUSY"
  | "FILING_PARSER_ABORTED"
  | "FILING_PARSER_FAILURE";

export class FilingParserBoundaryError extends Error {
  public constructor(public readonly code: FilingParserBoundaryErrorCode) {
    super("Filing parser boundary failed.");
    this.name = "FilingParserBoundaryError";
  }
}

export interface DockerFilingParserBoundaryOptions {
  readonly imageId: string;
  readonly signer: FilingParserSigner;
  readonly processRunner?: FilingParserProcessRunner;
}

const IMAGE_ID = /^sha256:[0-9a-f]{64}$/;
const CONTAINER_ID = /^[0-9a-f]{64}$/;
const KEY_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const SOURCE_SHA256 = /^sha256:[0-9a-f]{64}$/;
const ACCESSION = /^SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{1,12})?$/;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const SIGNING_DOMAIN = new TextEncoder().encode(
  "research-cockpit:filing-parser-result:v1\u0000",
);
const INPUT_PATH = "/input/filing.zip";

interface SignerSnapshot {
  readonly keyId: string;
  readonly sign: (payload: Uint8Array) => Promise<Uint8Array>;
}

export function createDockerFilingParserBoundary(
  options: DockerFilingParserBoundaryOptions,
): FilingParserBoundary {
  const configuration = exactDataSnapshot(
    options,
    ["imageId", "signer"],
    ["processRunner"],
  );
  if (
    configuration === null ||
    typeof configuration.imageId !== "string" ||
    !IMAGE_ID.test(configuration.imageId)
  ) {
    invalidConfiguration();
  }
  const signer = signerSnapshot(configuration.signer);
  const processRunner =
    configuration.processRunner === undefined
      ? new NodeProcessRunner()
      : configuration.processRunner;
  let run: FilingParserProcessRunner["run"];
  try {
    if (
      (typeof processRunner !== "object" &&
        typeof processRunner !== "function") ||
      processRunner === null ||
      typeof (processRunner as FilingParserProcessRunner).run !== "function"
    ) {
      invalidConfiguration();
    }
    run = (processRunner as FilingParserProcessRunner).run.bind(processRunner);
  } catch {
    invalidConfiguration();
  }
  return new DockerFilingParserBoundary(configuration.imageId, signer, {
    run,
  });
}

class DockerFilingParserBoundary implements FilingParserBoundary {
  #state: "ready" | "busy" = "ready";

  public constructor(
    private readonly imageId: string,
    private readonly signer: SignerSnapshot,
    private readonly processRunner: FilingParserProcessRunner,
  ) {}

  public async parse(
    archiveValue: Uint8Array,
    options?: FilingParserParseOptions,
  ): Promise<SignedFilingParserResult> {
    if (this.#state !== "ready") {
      throw new FilingParserBoundaryError("FILING_PARSER_BUSY");
    }
    this.#state = "busy";
    try {
      const signal = parseSignal(options);
      failIfAborted(signal);
      const archive = archiveSnapshot(archiveValue);
      const sourceSha256 = sha256(archive);
      let result: FilingParserResult;
      if (archive.byteLength === 0) {
        result = quarantined(sourceSha256, "archive_invalid");
      } else if (archive.byteLength > FILING_PARSER_LIMITS.archiveBytes) {
        result = quarantined(sourceSha256, "archive_limit_exceeded");
      } else {
        result = await this.runWorker(archive, sourceSha256, signal);
      }
      failIfAborted(signal);
      const signed = await signResult(result, this.signer, this.imageId);
      failIfAborted(signal);
      return signed;
    } finally {
      this.#state = "ready";
    }
  }

  private async runWorker(
    archive: Uint8Array,
    sourceSha256: `sha256:${string}`,
    signal: AbortSignal | undefined,
  ): Promise<FilingParserResult> {
    const { archivePath, containerName, stagingDirectory } =
      await createParserStaging();
    let createAttempted = false;
    let containerCreated = false;
    let result: FilingParserResult | null = null;
    let pendingError: FilingParserBoundaryError | null = null;
    let cleanupFailed = false;

    try {
      if (
        archivePath.includes(",") ||
        archivePath.includes("\r") ||
        archivePath.includes("\n") ||
        archivePath.includes("\u0000")
      ) {
        throw new FilingParserBoundaryError("FILING_PARSER_FAILURE");
      }
      await writeFile(archivePath, archive, { flag: "wx", mode: 0o444 });
      failIfAborted(signal);
      createAttempted = true;
      const create = await this.runProcess(
        withSignal(
          {
            args: dockerCreateArguments(
              this.imageId,
              containerName,
              archivePath,
            ),
            timeoutMilliseconds: FILING_PARSER_LIMITS.dockerControlMilliseconds,
            stdoutLimitBytes: 256,
            stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
          },
          signal,
        ),
      );
      if (
        create.exitCode !== 0 ||
        create.stderr.byteLength !== 0 ||
        !CONTAINER_ID.test(asciiLine(create.stdout))
      ) {
        result = quarantined(sourceSha256, "worker_failure");
      } else {
        containerCreated = true;
        const started = await this.runProcess(
          withSignal(
            {
              args: ["start", "--attach", containerName],
              timeoutMilliseconds: FILING_PARSER_LIMITS.workerWallMilliseconds,
              stdoutLimitBytes: FILING_PARSER_LIMITS.stdoutBytes,
              stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
            },
            signal,
          ),
        );
        result =
          started.exitCode === 0 && started.stderr.byteLength === 0
            ? parseCanonicalWorkerResult(started.stdout, sourceSha256)
            : quarantined(sourceSha256, "worker_failure");
      }
    } catch (error) {
      if (
        error instanceof FilingParserBoundaryError &&
        error.code === "FILING_PARSER_ABORTED"
      ) {
        pendingError = error;
      } else if (error instanceof FilingParserProcessError) {
        if (error.code === "FILING_PARSER_PROCESS_ABORTED") {
          pendingError = new FilingParserBoundaryError("FILING_PARSER_ABORTED");
        } else {
          result = quarantined(
            sourceSha256,
            error.code === "FILING_PARSER_PROCESS_TIMEOUT"
              ? "worker_timeout"
              : "worker_failure",
          );
        }
      } else if (!(error instanceof FilingParserBoundaryError)) {
        result = quarantined(sourceSha256, "worker_failure");
      } else {
        pendingError = error;
      }
    } finally {
      if (createAttempted) {
        try {
          const removed = await this.runProcess({
            args: ["rm", "--force", containerName],
            timeoutMilliseconds: FILING_PARSER_LIMITS.dockerControlMilliseconds,
            stdoutLimitBytes: 256,
            stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
          });
          if (
            (containerCreated && removed.exitCode !== 0) ||
            (!containerCreated &&
              removed.exitCode !== 0 &&
              removed.exitCode !== 1)
          ) {
            cleanupFailed = true;
          }
          const residue = await this.runProcess({
            args: [
              "container",
              "ls",
              "--all",
              "--quiet",
              "--filter",
              `name=^/${containerName}$`,
            ],
            timeoutMilliseconds: FILING_PARSER_LIMITS.dockerControlMilliseconds,
            stdoutLimitBytes: 256,
            stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
          });
          if (
            residue.exitCode !== 0 ||
            residue.stdout.byteLength !== 0 ||
            residue.stderr.byteLength !== 0
          ) {
            cleanupFailed = true;
          }
        } catch {
          cleanupFailed = true;
        }
      }
      try {
        await rm(stagingDirectory, { recursive: true, force: false });
      } catch {
        cleanupFailed = true;
      }
    }

    if (cleanupFailed) {
      throw new FilingParserBoundaryError("FILING_PARSER_FAILURE");
    }
    if (pendingError !== null) throw pendingError;
    if (result === null)
      throw new FilingParserBoundaryError("FILING_PARSER_FAILURE");
    return result;
  }

  private runProcess(
    request: Omit<FilingParserProcessRequest, "command">,
  ): Promise<FilingParserProcessResult> {
    return this.processRunner.run({ command: "docker", ...request });
  }
}

class NodeProcessRunner implements FilingParserProcessRunner {
  public run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    if (
      request.command !== "docker" ||
      !Array.isArray(request.args) ||
      !request.args.every((argument) => typeof argument === "string") ||
      !positiveInteger(request.timeoutMilliseconds) ||
      !positiveInteger(request.stdoutLimitBytes) ||
      !positiveInteger(request.stderrLimitBytes)
    ) {
      return Promise.reject(
        new FilingParserProcessError("FILING_PARSER_PROCESS_FAILURE"),
      );
    }
    if (request.signal?.aborted === true) {
      return Promise.reject(
        new FilingParserProcessError("FILING_PARSER_PROCESS_ABORTED"),
      );
    }

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
      let failure: FilingParserProcessErrorCode | null = null;
      let settled = false;

      const requestStop = (code: FilingParserProcessErrorCode) => {
        failure ??= code;
        try {
          child.kill("SIGKILL");
        } catch {
          failure = "FILING_PARSER_PROCESS_FAILURE";
        }
      };
      const abort = () => requestStop("FILING_PARSER_PROCESS_ABORTED");
      const timeout = setTimeout(
        () => requestStop("FILING_PARSER_PROCESS_TIMEOUT"),
        request.timeoutMilliseconds,
      );
      request.signal?.addEventListener("abort", abort, { once: true });
      if (request.signal?.aborted === true) abort();

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > request.stdoutLimitBytes) {
          requestStop("FILING_PARSER_PROCESS_OUTPUT_LIMIT");
          return;
        }
        stdout.push(Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.byteLength;
        if (stderrBytes > request.stderrLimitBytes) {
          requestStop("FILING_PARSER_PROCESS_OUTPUT_LIMIT");
          return;
        }
        stderr.push(Buffer.from(chunk));
      });
      child.on("error", () => {
        failure ??= "FILING_PARSER_PROCESS_FAILURE";
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", abort);
        if (failure !== null || !Number.isInteger(code) || code === null) {
          reject(
            new FilingParserProcessError(
              failure ?? "FILING_PARSER_PROCESS_FAILURE",
            ),
          );
          return;
        }
        resolve({
          exitCode: code,
          stdout: Uint8Array.from(Buffer.concat(stdout)),
          stderr: Uint8Array.from(Buffer.concat(stderr)),
        });
      });
    });
  }
}

function dockerCreateArguments(
  imageId: string,
  containerName: string,
  archivePath: string,
): string[] {
  return [
    "create",
    "--name",
    containerName,
    "--label",
    FILING_PARSER_CONTAINER_LABEL,
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
    String(FILING_PARSER_LIMITS.pids),
    "--memory",
    String(FILING_PARSER_LIMITS.memoryBytes),
    "--memory-swap",
    String(FILING_PARSER_LIMITS.memoryBytes),
    "--cpus",
    String(FILING_PARSER_LIMITS.cpuCount),
    "--ulimit",
    `nofile=${FILING_PARSER_LIMITS.openFiles}:${FILING_PARSER_LIMITS.openFiles}`,
    "--ipc",
    "none",
    "--tmpfs",
    `/tmp:rw,noexec,nosuid,nodev,size=${FILING_PARSER_LIMITS.temporaryFilesystemBytes}`,
    "--mount",
    `type=bind,source=${archivePath},destination=${INPUT_PATH},readonly`,
    imageId,
  ];
}

interface ParserStaging {
  readonly archivePath: string;
  readonly containerName: string;
  readonly stagingDirectory: string;
}

async function createParserStaging(): Promise<ParserStaging> {
  let stagingDirectory: string | null = null;
  try {
    stagingDirectory = await mkdtemp(
      join(tmpdir(), "research-cockpit-filing-parser-"),
    );
    return {
      archivePath: join(stagingDirectory, "filing.zip"),
      containerName: `research-cockpit-filing-parser-${randomUUID()}`,
      stagingDirectory,
    };
  } catch {
    if (stagingDirectory !== null) {
      try {
        await rm(stagingDirectory, { recursive: true, force: false });
      } catch {
        // The stable boundary failure below also covers ambiguous cleanup.
      }
    }
    throw new FilingParserBoundaryError("FILING_PARSER_FAILURE");
  }
}

async function signResult(
  result: FilingParserResult,
  signer: SignerSnapshot,
  imageId: string,
): Promise<SignedFilingParserResult> {
  const payload = signingPayload(result, signer.keyId, imageId);
  let signature: Uint8Array;
  try {
    signature = Uint8Array.from(await signer.sign(Uint8Array.from(payload)));
  } catch {
    throw new FilingParserBoundaryError("FILING_PARSER_FAILURE");
  }
  if (signature.byteLength !== 64) {
    throw new FilingParserBoundaryError("FILING_PARSER_FAILURE");
  }
  return deepFreeze({
    result,
    provenance: {
      algorithm: "ed25519" as const,
      imageId: imageId as `sha256:${string}`,
      keyId: signer.keyId,
      payloadSha256: sha256(payload),
      signature: Buffer.from(signature).toString("base64url"),
    },
  });
}

export function verifyFilingParserProvenance(
  signedValue: SignedFilingParserResult,
  publicKey: KeyLike,
): boolean {
  try {
    const signed = exactRecord(signedValue, ["result", "provenance"]);
    const resultValue = exactRecord(signed.result, [
      ...(isPlainObject(signed.result) && signed.result.status === "accepted"
        ? ["accession", "acceptedAt", "availableAt"]
        : ["code"]),
      "facts",
      "parserVersion",
      "schemaVersion",
      "sourceSha256",
      "status",
      "synthetic",
      "taxonomyVersion",
    ]);
    const sourceSha256 = stringMatching(
      resultValue.sourceSha256,
      SOURCE_SHA256,
    ) as `sha256:${string}`;
    const result = normalizeResult(resultValue, sourceSha256);
    const provenance = exactRecord(signed.provenance, [
      "algorithm",
      "imageId",
      "keyId",
      "payloadSha256",
      "signature",
    ]);
    if (provenance.algorithm !== "ed25519") return false;
    const imageId = stringMatching(provenance.imageId, IMAGE_ID);
    const keyId = stringMatching(provenance.keyId, KEY_ID);
    const payload = signingPayload(result, keyId, imageId);
    if (provenance.payloadSha256 !== sha256(payload)) return false;
    const encodedSignature = stringMatching(
      provenance.signature,
      BASE64URL_SIGNATURE,
    );
    const signature = Buffer.from(encodedSignature, "base64url");
    if (signature.byteLength !== 64) return false;
    return verifySignature(null, payload, publicKey, signature);
  } catch {
    return false;
  }
}

function signingPayload(
  result: FilingParserResult,
  keyId: string,
  imageId: string,
): Uint8Array {
  const body = new TextEncoder().encode(
    canonicalJson({ algorithm: "ed25519", imageId, keyId, result }),
  );
  const payload = new Uint8Array(SIGNING_DOMAIN.byteLength + body.byteLength);
  payload.set(SIGNING_DOMAIN, 0);
  payload.set(body, SIGNING_DOMAIN.byteLength);
  return payload;
}

function parseCanonicalWorkerResult(
  stdout: Uint8Array,
  expectedSourceSha256: `sha256:${string}`,
): FilingParserResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
  } catch {
    return quarantined(expectedSourceSha256, "worker_failure");
  }
  if (
    !text.endsWith("\n") ||
    text.length < 3 ||
    text.slice(0, -1).includes("\n") ||
    text.includes("\r") ||
    !isAsciiWorkerOutput(text)
  ) {
    return quarantined(expectedSourceSha256, "worker_failure");
  }
  const body = text.slice(0, -1);
  try {
    const parsed: unknown = JSON.parse(body);
    const result = normalizeResult(parsed, expectedSourceSha256);
    return canonicalJson(result) === body
      ? result
      : quarantined(expectedSourceSha256, "worker_failure");
  } catch {
    return quarantined(expectedSourceSha256, "worker_failure");
  }
}

function normalizeResult(
  value: unknown,
  expectedSourceSha256: `sha256:${string}`,
): FilingParserResult {
  if (!isPlainObject(value)) invalidInput();
  if (value.status === "accepted") {
    const record = exactRecord(value, [
      "accession",
      "acceptedAt",
      "availableAt",
      "facts",
      "parserVersion",
      "schemaVersion",
      "sourceSha256",
      "status",
      "synthetic",
      "taxonomyVersion",
    ]);
    requireFixedResultFields(record, expectedSourceSha256);
    const acceptedAt = isoUtc(record.acceptedAt);
    const availableAt = isoUtc(record.availableAt);
    if (Date.parse(availableAt) < Date.parse(acceptedAt)) invalidInput();
    const facts = exactArray(record.facts, FILING_PARSER_LIMITS.facts).map(
      normalizeFact,
    );
    if (
      facts[0]?.concept !== FILING_PARSER_CONCEPTS[0] ||
      facts[1]?.concept !== FILING_PARSER_CONCEPTS[1]
    ) {
      invalidInput();
    }
    return deepFreeze({
      accession: stringMatching(record.accession, ACCESSION),
      acceptedAt,
      availableAt,
      facts: [facts[0], facts[1]] as [FilingParserFact, FilingParserFact],
      parserVersion: FILING_PARSER_PARSER_VERSION,
      schemaVersion: FILING_PARSER_SCHEMA_VERSION,
      sourceSha256: expectedSourceSha256,
      status: "accepted" as const,
      synthetic: true as const,
      taxonomyVersion: FILING_PARSER_TAXONOMY_VERSION,
    });
  }
  const record = exactRecord(value, [
    "code",
    "facts",
    "parserVersion",
    "schemaVersion",
    "sourceSha256",
    "status",
    "synthetic",
    "taxonomyVersion",
  ]);
  if (record.status !== "quarantined") invalidInput();
  requireFixedResultFields(record, expectedSourceSha256);
  exactArray(record.facts, 0);
  if (!FILING_PARSER_QUARANTINE_CODES.includes(record.code as never)) {
    invalidInput();
  }
  return quarantined(
    expectedSourceSha256,
    record.code as FilingParserQuarantineCode,
  );
}

function requireFixedResultFields(
  record: Readonly<Record<string, unknown>>,
  expectedSourceSha256: `sha256:${string}`,
): void {
  if (
    record.parserVersion !== FILING_PARSER_PARSER_VERSION ||
    record.schemaVersion !== FILING_PARSER_SCHEMA_VERSION ||
    record.sourceSha256 !== expectedSourceSha256 ||
    record.synthetic !== true ||
    record.taxonomyVersion !== FILING_PARSER_TAXONOMY_VERSION
  ) {
    invalidInput();
  }
}

function normalizeFact(value: unknown): FilingParserFact {
  const record = exactRecord(value, [
    "concept",
    "dimensions",
    "periodEnd",
    "periodStart",
    "unit",
    "value",
  ]);
  if (!FILING_PARSER_CONCEPTS.includes(record.concept as never)) invalidInput();
  const dimensions = exactRecord(record.dimensions, []);
  const periodStart = isoDate(record.periodStart);
  const periodEnd = isoDate(record.periodEnd);
  if (
    Date.parse(`${periodEnd}T00:00:00.000Z`) <
    Date.parse(`${periodStart}T00:00:00.000Z`)
  ) {
    invalidInput();
  }
  if (record.unit !== "USD") invalidInput();
  return Object.freeze({
    concept: record.concept as FilingParserConcept,
    dimensions,
    periodEnd,
    periodStart,
    unit: "USD" as const,
    value: stringMatching(record.value, DECIMAL),
  });
}

function quarantined(
  sourceSha256: `sha256:${string}`,
  code: FilingParserQuarantineCode,
): FilingParserQuarantinedResult {
  return deepFreeze({
    code,
    facts: [] as [],
    parserVersion: FILING_PARSER_PARSER_VERSION,
    schemaVersion: FILING_PARSER_SCHEMA_VERSION,
    sourceSha256,
    status: "quarantined" as const,
    synthetic: true as const,
    taxonomyVersion: FILING_PARSER_TAXONOMY_VERSION,
  });
}

function signerSnapshot(signer: unknown): SignerSnapshot {
  const configuration = exactDataSnapshot(signer, [
    "algorithm",
    "keyId",
    "sign",
  ]);
  if (
    configuration === null ||
    configuration.algorithm !== "ed25519" ||
    typeof configuration.keyId !== "string" ||
    !KEY_ID.test(configuration.keyId) ||
    typeof configuration.sign !== "function"
  ) {
    invalidConfiguration();
  }
  return Object.freeze({
    keyId: configuration.keyId,
    sign: (configuration.sign as SignerSnapshot["sign"]).bind(signer),
  });
}

function archiveSnapshot(value: Uint8Array): Uint8Array {
  try {
    if (!(value instanceof Uint8Array)) invalidInput();
    return Uint8Array.from(value);
  } catch {
    invalidInput();
  }
}

function parseSignal(
  options: FilingParserParseOptions | undefined,
): AbortSignal | undefined {
  if (options === undefined) return undefined;
  const input = exactDataSnapshot(options, [], ["signal"]);
  if (input === null) invalidInput();
  if (input.signal === undefined) return undefined;
  if (!(input.signal instanceof AbortSignal)) invalidInput();
  return input.signal;
}

function failIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new FilingParserBoundaryError("FILING_PARSER_ABORTED");
  }
}

function asciiLine(value: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(value);
    return /^[\x20-\x7e]+\n$/u.test(text) ? text.slice(0, -1) : "";
  } catch {
    return "";
  }
}

function isoUtc(value: unknown): string {
  const text = stringMatching(value, ISO_UTC);
  if (new Date(text).toISOString() !== text) invalidInput();
  return text;
}

function isoDate(value: unknown): string {
  const text = stringMatching(value, ISO_DATE);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    invalidInput();
  }
  return text;
}

function stringMatching(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) invalidInput();
  return value;
}

function exactArray(value: unknown, length: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) invalidInput();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    !keys.includes("length") ||
    Array.from({ length }, (_unused, index) => String(index)).some(
      (key) => !keys.includes(key),
    )
  ) {
    invalidInput();
  }
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      invalidInput();
    }
  }
  return value;
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Readonly<Record<TKeys[number], unknown>> {
  if (!isPlainObject(value)) invalidInput();
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    invalidInput();
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      invalidInput();
    }
  }
  return value as Readonly<Record<TKeys[number], unknown>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataSnapshot(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const candidate: object = value;
    const prototype: unknown = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const allowedKeys = [...requiredKeys, ...optionalKeys];
    const actualKeys = Reflect.ownKeys(candidate);
    if (
      actualKeys.some(
        (key) => typeof key !== "string" || !allowedKeys.includes(key),
      ) ||
      requiredKeys.some((key) => !actualKeys.includes(key))
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of actualKeys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) invalidInput();
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (!isPlainObject(value)) invalidInput();
  const record = value;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function isAsciiWorkerOutput(value: string): boolean {
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint !== 0x0a && (codePoint < 0x20 || codePoint > 0x7e)) {
      return false;
    }
  }
  return true;
}

function withSignal(
  request: Omit<FilingParserProcessRequest, "command" | "signal">,
  signal: AbortSignal | undefined,
): Omit<FilingParserProcessRequest, "command"> {
  return signal === undefined ? request : { ...request, signal };
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function invalidConfiguration(): never {
  throw new FilingParserBoundaryError("FILING_PARSER_INVALID_CONFIGURATION");
}

function invalidInput(): never {
  throw new FilingParserBoundaryError("FILING_PARSER_INVALID_INPUT");
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
