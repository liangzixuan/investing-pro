import {
  createHash,
  generateKeyPairSync,
  sign as ed25519Sign,
} from "node:crypto";
import {
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL,
  FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS,
  createFilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionProcessRequest,
  type FilingParserNormalizationExecutionProcessResult,
  type FilingParserNormalizationExecutionResult,
} from "@research-cockpit/filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "@research-cockpit/filing-parser-normalization-execution/test";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW,
  createFilingParserNormalizationExecutionEvidence,
  serializeCanonicalFilingParserNormalizationExecutionEvidence,
  type FilingParserNormalizationExecutionEvidenceCaseOutcome,
  type FilingParserNormalizationExecutionEvidenceSourceHash,
} from "./filing-parser-normalization-execution-evidence";

const BASE_INDEX_DIGEST =
  "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2" as const;
const BASE_PLATFORM_MANIFEST_DIGEST =
  "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af" as const;
const BASE_IMAGE =
  "docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2" as const;
const KEY_ID = "cycle2j-ephemeral-ed25519-v1";
const EVIDENCE_FILE =
  "research-cockpit-filing-parser-normalization-execution-v1.json";
const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const MAX_COMMAND_BYTES = 4_194_304;
export const ACCEPTANCE_PHASES = Object.freeze([
  "environment",
  "repository_anchor",
  "source_inventory",
  "image_metadata",
  "staging",
  "image_build",
  "image_inspection",
  "audited_setup",
  "audited_success",
  "audited_replay",
  "audited_tamper",
  "audited_role_swap",
  "audited_residue",
  "production_setup",
  "production_success",
  "production_replay",
  "production_tamper",
  "production_residue",
  "evidence_assembly",
  "tool_versions",
  "image_removal",
  "evidence_write",
  "cleanup",
] as const);
type AcceptancePhase = (typeof ACCEPTANCE_PHASES)[number];
type AcceptancePhaseMarker = (phase: AcceptancePhase) => void;

export function filingParserNormalizationExecutionAcceptanceFailureDiagnostic(
  phase: unknown,
): string {
  switch (phase) {
    case "environment":
      return "filing_parser_normalization_execution_acceptance_failed phase=environment\n";
    case "repository_anchor":
      return "filing_parser_normalization_execution_acceptance_failed phase=repository_anchor\n";
    case "source_inventory":
      return "filing_parser_normalization_execution_acceptance_failed phase=source_inventory\n";
    case "image_metadata":
      return "filing_parser_normalization_execution_acceptance_failed phase=image_metadata\n";
    case "staging":
      return "filing_parser_normalization_execution_acceptance_failed phase=staging\n";
    case "image_build":
      return "filing_parser_normalization_execution_acceptance_failed phase=image_build\n";
    case "image_inspection":
      return "filing_parser_normalization_execution_acceptance_failed phase=image_inspection\n";
    case "audited_setup":
      return "filing_parser_normalization_execution_acceptance_failed phase=audited_setup\n";
    case "audited_success":
      return "filing_parser_normalization_execution_acceptance_failed phase=audited_success\n";
    case "audited_replay":
      return "filing_parser_normalization_execution_acceptance_failed phase=audited_replay\n";
    case "audited_tamper":
      return "filing_parser_normalization_execution_acceptance_failed phase=audited_tamper\n";
    case "audited_role_swap":
      return "filing_parser_normalization_execution_acceptance_failed phase=audited_role_swap\n";
    case "audited_residue":
      return "filing_parser_normalization_execution_acceptance_failed phase=audited_residue\n";
    case "production_setup":
      return "filing_parser_normalization_execution_acceptance_failed phase=production_setup\n";
    case "production_success":
      return "filing_parser_normalization_execution_acceptance_failed phase=production_success\n";
    case "production_replay":
      return "filing_parser_normalization_execution_acceptance_failed phase=production_replay\n";
    case "production_tamper":
      return "filing_parser_normalization_execution_acceptance_failed phase=production_tamper\n";
    case "production_residue":
      return "filing_parser_normalization_execution_acceptance_failed phase=production_residue\n";
    case "evidence_assembly":
      return "filing_parser_normalization_execution_acceptance_failed phase=evidence_assembly\n";
    case "tool_versions":
      return "filing_parser_normalization_execution_acceptance_failed phase=tool_versions\n";
    case "image_removal":
      return "filing_parser_normalization_execution_acceptance_failed phase=image_removal\n";
    case "evidence_write":
      return "filing_parser_normalization_execution_acceptance_failed phase=evidence_write\n";
    case "cleanup":
      return "filing_parser_normalization_execution_acceptance_failed phase=cleanup\n";
    default:
      return "filing_parser_normalization_execution_acceptance_failed phase=internal\n";
  }
}

export function filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase(
  hadPrimaryFailure: boolean,
): boolean {
  return hadPrimaryFailure === false;
}

async function main(markPhase: AcceptancePhaseMarker): Promise<void> {
  markPhase("environment");
  const environment = acceptanceEnvironment();
  const startedAt = new Date().toISOString();
  markPhase("repository_anchor");
  const revision = decodeExactLine(
    (await checkedCommand("git", ["rev-parse", "HEAD"], 5_000)).stdout,
  );
  if (revision !== environment.revision || !COMMIT.test(revision)) fail();
  const worktree = await checkedCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    5_000,
  );
  if (worktree.stdout.byteLength !== 0 || worktree.stderr.byteLength !== 0)
    fail();

  markPhase("source_inventory");
  const sourceHashes = await committedSourceHashes(revision);
  const fixtureManifestSha256 = requiredSourceHash(
    sourceHashes,
    "fixtures/synthetic/filing-parser-normalization-execution/v1/manifest.json",
  );
  markPhase("image_metadata");
  const imageMetadata = await readPinnedImageMetadata();
  markPhase("staging");
  const temporaryDirectory = await mkdtemp(
    join(environment.runnerTemp, "filing-normalization-execution-"),
  );
  const imageIdFile = join(temporaryDirectory, "image-id.txt");
  let imageId: `sha256:${string}` | null = null;
  let temporaryEvidencePath: string | null = null;
  let evidenceWritten = false;
  let primaryFailure = false;
  try {
    markPhase("image_build");
    const build = await command(
      "docker",
      [
        "build",
        "--pull",
        "--platform",
        "linux/amd64",
        "--file",
        "packages/filing-parser-normalization-execution/worker/Dockerfile",
        "--iidfile",
        imageIdFile,
        "packages/filing-parser-normalization-execution",
      ],
      300_000,
      2_097_152,
      2_097_152,
    );
    if (build.exitCode !== 0) fail();
    imageId = imageIdValue(await readFile(imageIdFile, "utf8"));
    markPhase("image_inspection");
    await verifyBuiltImage(imageId);

    markPhase("audited_setup");
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeySpki = Uint8Array.from(
      publicKey.export({ format: "der", type: "spki" }),
    );
    const signer = Object.freeze({
      algorithm: "ed25519" as const,
      keyId: KEY_ID,
      sign: (payload: Uint8Array): Promise<Uint8Array> =>
        Promise.resolve(
          Uint8Array.from(ed25519Sign(null, payload, privateKey)),
        ),
    });
    const recorder = new RecordingDockerProcessRunner();
    const boundary = createFilingParserNormalizationExecutionBoundary({
      imageSha256: imageId,
      processRunner: Object.freeze({
        run: recorder.run.bind(recorder),
      }),
      publicKeySpki,
      signer,
    });

    markPhase("audited_success");
    const successStart = recorder.documentOutputs.length;
    const success = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    const successDocuments = recorder.documentOutputs.slice(successStart);
    assertNormalized(success, successDocuments, fixture);

    markPhase("audited_replay");
    const replayStart = recorder.documentOutputs.length;
    const replay = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    const replayDocuments = recorder.documentOutputs.slice(replayStart);
    assertNormalized(replay, replayDocuments, fixture);
    if (
      canonicalJson(success) !== canonicalJson(replay) ||
      !exactDocumentOutputs(successDocuments, replayDocuments)
    )
      fail();

    markPhase("audited_tamper");
    const tamperedOriginal = Uint8Array.from(fixture.originalArchive);
    tamperedOriginal[0] = (tamperedOriginal[0] ?? 0) ^ 0xff;
    const tampered = await boundary.execute(
      tamperedOriginal,
      fixture.amendmentArchive,
    );
    assertQuarantined(tampered);
    markPhase("audited_role_swap");
    const swapped = await boundary.execute(
      fixture.amendmentArchive,
      fixture.originalArchive,
    );
    assertQuarantined(swapped);
    markPhase("audited_residue");
    recorder.assertComplete();
    await assertZeroResidue();

    // The recorder proves the inspected Docker configuration. This second
    // pass exercises the shipped default process runner itself so a surrogate
    // runner cannot produce the live artifact on its behalf.
    markPhase("production_setup");
    const productionBoundary = createFilingParserNormalizationExecutionBoundary(
      {
        imageSha256: imageId,
        publicKeySpki,
        signer,
      },
    );
    markPhase("production_success");
    const productionSuccess = await productionBoundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    if (
      productionSuccess.status !== "normalized" ||
      canonicalJson(productionSuccess) !== canonicalJson(success)
    )
      fail();
    markPhase("production_replay");
    const productionReplay = await productionBoundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    if (canonicalJson(productionReplay) !== canonicalJson(productionSuccess))
      fail();
    markPhase("production_tamper");
    const productionRejected = await productionBoundary.execute(
      tamperedOriginal,
      fixture.amendmentArchive,
    );
    assertQuarantined(productionRejected);
    markPhase("production_residue");
    await assertZeroResidue();

    markPhase("evidence_assembly");
    const outcomes: readonly FilingParserNormalizationExecutionEvidenceCaseOutcome[] =
      Object.freeze([
        Object.freeze({
          amendmentArchiveSha256: sha256(fixture.amendmentArchive),
          amendmentDocumentSha256: sha256(successDocuments[1] as Uint8Array),
          caseId: "exact-original-amendment-pair" as const,
          expectedStatus: "normalized" as const,
          factVersionCount: 20 as const,
          lineageCount: 10 as const,
          observedStatus: "normalized" as const,
          originalArchiveSha256: sha256(fixture.originalArchive),
          originalDocumentSha256: sha256(successDocuments[0] as Uint8Array),
          pairBindingSha256: success.provenance.handoff.pairBindingSha256,
          replayMatched: true,
          resultSha256: sha256(text(canonicalJson(success))),
        }),
        quarantineOutcome("original-archive-tamper", tampered),
        quarantineOutcome("original-amendment-role-swap", swapped),
      ]);

    markPhase("tool_versions");
    const tools = await toolVersions();
    const completedAt = new Date().toISOString();
    markPhase("evidence_assembly");
    const evidence = createFilingParserNormalizationExecutionEvidence({
      caseOutcomes: outcomes,
      checksPassed: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS,
      claim: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM,
      completedAt,
      evidenceVersion: 1,
      fixtureManifestSha256,
      image: Object.freeze({
        architecture: "amd64" as const,
        baseIndexDigest: imageMetadata.indexDigest,
        basePlatformManifestDigest: imageMetadata.platformManifestDigest,
        builtImageId: imageId,
        operatingSystem: "linux" as const,
        pythonVersion: "3.12.13" as const,
      }),
      notProven: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
      repository: environment.repository,
      revision,
      runtime: Object.freeze({
        capabilitiesDropped: Object.freeze(["ALL"] as const),
        containerControlMilliseconds: 5_000 as const,
        containerCount: 2 as const,
        containerUser: "65532:65532" as const,
        cpuCount: 0.5 as const,
        inputMount: "/input/filing.zip:ro" as const,
        memoryBytes: 134_217_728 as const,
        networkMode: "none" as const,
        noNewPrivileges: true as const,
        noPublishedPorts: true as const,
        openFiles: 64 as const,
        pids: 32 as const,
        processTerminationMilliseconds: 250 as const,
        readOnlyRootFilesystem: true as const,
        signerMilliseconds: 5_000 as const,
        stderrLimitBytes: 4_096 as const,
        stdoutLimitBytes: 262_144 as const,
        temporaryFilesystem:
          "/tmp:rw,noexec,nosuid,nodev,size=8388608" as const,
        wallClockMilliseconds: 5_000 as const,
        zeroResidue: true as const,
      }),
      schemaVersion:
        FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION,
      sourceHashes,
      startedAt,
      status: "passed" as const,
      summary: Object.freeze({
        normalized: 1 as const,
        quarantined: 2 as const,
        replayMatched: true as const,
        total: 3 as const,
      }),
      synthetic: true as const,
      tools,
      workflow: Object.freeze({
        event: environment.event,
        job: "acceptance" as const,
        ref: environment.ref,
        runAttempt: environment.runAttempt,
        runId: environment.runId,
        workflowName: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW,
      }),
    });
    markPhase("image_removal");
    await removeImage(imageId);
    imageId = null;
    markPhase("evidence_write");
    temporaryEvidencePath = `${environment.evidencePath}.tmp`;
    await assertPathAbsent(temporaryEvidencePath);
    await writeFile(
      temporaryEvidencePath,
      serializeCanonicalFilingParserNormalizationExecutionEvidence(evidence),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    await assertPathAbsent(environment.evidencePath);
    await rename(temporaryEvidencePath, environment.evidencePath);
    temporaryEvidencePath = null;
    evidenceWritten = true;
  } catch (error) {
    primaryFailure = true;
    throw error;
  } finally {
    try {
      if (imageId !== null) await removeImage(imageId).catch(() => undefined);
      if (temporaryEvidencePath !== null)
        await rm(temporaryEvidencePath, { force: true });
      await rm(temporaryDirectory, { force: true, recursive: true });
      if (!evidenceWritten) {
        // A candidate artifact is never written on failure or cancellation.
      }
    } catch (error) {
      if (
        filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase(
          primaryFailure,
        )
      )
        markPhase("cleanup");
      await Promise.reject(
        error instanceof Error ? error : new Error("acceptance failed"),
      );
    }
  }
}

class RecordingDockerProcessRunner {
  public readonly documentOutputs: Uint8Array[] = [];
  readonly #containers = new Map<
    string,
    { readonly archivePath: string; readonly containerId: string }
  >();
  readonly #startExitCodes: number[] = [];
  #auditFailed = false;
  #createCount = 0;
  #imageId: string | null = null;
  #removeCount = 0;
  #residueCount = 0;

  public async run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    try {
      const operation = this.validateRequest(request);
      validateRequestLimits(request, operation.kind);
      const result = await command(
        request.command,
        request.args,
        request.timeoutMilliseconds,
        request.stdoutLimitBytes,
        request.stderrLimitBytes,
        request.signal,
      );
      if (result.stderr.byteLength !== 0) fail();
      if (operation.kind === "create") {
        if (result.exitCode !== 0) fail();
        this.#createCount += 1;
        const containerId = decodeExactLine(result.stdout);
        if (!/^[0-9a-f]{64}$/u.test(containerId)) fail();
        this.#containers.set(operation.containerName, {
          archivePath: operation.archivePath,
          containerId,
        });
        await this.inspectCreatedContainer(
          operation.containerName,
          operation.archivePath,
          containerId,
        );
      } else if (operation.kind === "start") {
        if (result.exitCode !== 0 && result.exitCode !== 2) fail();
        this.#startExitCodes.push(result.exitCode);
        if (result.exitCode === 0)
          this.documentOutputs.push(Uint8Array.from(result.stdout));
      } else if (operation.kind === "remove") {
        if (result.exitCode !== 0) fail();
        this.#removeCount += 1;
        this.#containers.delete(operation.containerName);
      } else {
        if (result.exitCode !== 0 || result.stdout.byteLength !== 0) fail();
        this.#residueCount += 1;
        this.#containers.delete(operation.containerName);
      }
      return Object.freeze({
        exitCode: result.exitCode,
        stderr: Uint8Array.from(result.stderr),
        stdout: Uint8Array.from(result.stdout),
      });
    } catch (error) {
      this.#auditFailed = true;
      throw error;
    }
  }

  public assertComplete(): void {
    if (
      this.#auditFailed ||
      this.#containers.size !== 0 ||
      this.#createCount !== 7 ||
      this.#removeCount !== 7 ||
      this.#residueCount !== 7 ||
      this.documentOutputs.length !== 6 ||
      JSON.stringify(this.#startExitCodes) !==
        JSON.stringify([0, 0, 0, 0, 2, 0, 0])
    )
      fail();
  }

  private validateRequest(
    request: FilingParserNormalizationExecutionProcessRequest,
  ):
    | {
        readonly archivePath: string;
        readonly containerName: string;
        readonly kind: "create";
      }
    | {
        readonly containerName: string;
        readonly kind: "remove" | "residue" | "start";
      } {
    const args = request.args;
    if (request.command !== "docker" || args.length === 0) fail();
    if (args[0] === "create") {
      const name = argumentAfter(args, "--name");
      const mount = argumentAfter(args, "--mount");
      const imageId = args.at(-1);
      const mountMatch =
        /^type=bind,source=(.+),destination=\/input\/filing\.zip,readonly$/u.exec(
          mount,
        );
      if (
        imageId === undefined ||
        !HASH.test(imageId) ||
        !/^research-cockpit-filing-normalization-[0-9a-f-]{36}$/u.test(name) ||
        mountMatch?.[1] === undefined ||
        !isAbsolute(mountMatch[1]) ||
        !exactCreateArguments(args, name, mount, imageId)
      )
        fail();
      this.#imageId ??= imageId;
      if (this.#imageId !== imageId || this.#containers.has(name)) fail();
      return {
        archivePath: mountMatch[1],
        containerName: name,
        kind: "create",
      };
    }
    if (args[0] === "start" && args.length === 3 && args[1] === "--attach") {
      const name = args[2] as string;
      if (!this.#containers.has(name)) fail();
      return { containerName: name, kind: "start" };
    }
    if (args[0] === "rm" && args.length === 3 && args[1] === "--force") {
      const name = args[2] as string;
      if (!/^research-cockpit-filing-normalization-[0-9a-f-]{36}$/u.test(name))
        fail();
      return { containerName: name, kind: "remove" };
    }
    if (
      args.length === 8 &&
      JSON.stringify(args.slice(0, 6)) ===
        JSON.stringify([
          "container",
          "ls",
          "--all",
          "--quiet",
          "--filter",
          `label=${FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL}`,
        ]) &&
      args[6] === "--filter"
    ) {
      const match =
        /^name=\^\/(research-cockpit-filing-normalization-[0-9a-f-]{36})\$$/u.exec(
          args[7] as string,
        );
      if (match?.[1] === undefined) fail();
      return { containerName: match[1], kind: "residue" };
    }
    fail();
  }

  private async inspectCreatedContainer(
    containerName: string,
    archivePath: string,
    containerId: string,
  ): Promise<void> {
    if (this.#imageId === null) fail();
    const inspected = await checkedCommand(
      "docker",
      ["container", "inspect", containerName],
      5_000,
      1_048_576,
      4_096,
    );
    const parsed = JSON.parse(
      new TextDecoder().decode(inspected.stdout),
    ) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 1) fail();
    validateContainerInspection(
      parsed[0],
      containerId,
      containerName,
      this.#imageId,
      archivePath,
    );
  }
}

function argumentAfter(args: readonly string[], option: string): string {
  const index = args.indexOf(option);
  const value = index < 0 ? undefined : args[index + 1];
  if (value === undefined || args.indexOf(option, index + 1) !== -1) fail();
  return value;
}

/** @internal Exported for acceptance-runner audit regression tests. */
export function validateRequestLimits(
  request: FilingParserNormalizationExecutionProcessRequest,
  kind: "create" | "remove" | "residue" | "start",
): void {
  if (
    !(request.signal instanceof AbortSignal) ||
    request.signal.aborted ||
    request.stderrLimitBytes !==
      FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stderrBytes ||
    request.timeoutMilliseconds !==
      (kind === "start"
        ? FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.workerWallMilliseconds
        : FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.containerControlMilliseconds) ||
    request.stdoutLimitBytes !==
      (kind === "start"
        ? FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stdoutBytes
        : 256)
  )
    fail();
}

/** @internal Exported for acceptance-runner audit regression tests. */
export function exactCreateArguments(
  args: readonly string[],
  containerName: string,
  mount: string,
  imageId: string,
): boolean {
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
      "32",
      "--memory",
      "134217728",
      "--memory-swap",
      "134217728",
      "--cpus",
      "0.5",
      "--ulimit",
      "nofile=64:64",
      "--ipc",
      "none",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=8388608",
      "--mount",
      mount,
      imageId,
    ])
  );
}

/** @internal Exported for acceptance-runner audit regression tests. */
export function validateContainerInspection(
  value: unknown,
  containerId: string,
  containerName: string,
  imageId: string,
  archivePath: string,
): void {
  const container = recordAtLeast(value, [
    "Config",
    "HostConfig",
    "Id",
    "Image",
    "Mounts",
    "Name",
    "NetworkSettings",
    "State",
  ]);
  const state = recordAtLeast(container.State, ["Status"]);
  const config = recordAtLeast(container.Config, [
    "Entrypoint",
    "Env",
    "Image",
    "User",
  ]);
  const host = recordAtLeast(container.HostConfig, [
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
  const network = recordAtLeast(container.NetworkSettings, ["Ports"]);
  if (
    container.Id !== containerId ||
    container.Image !== imageId ||
    container.Name !== `/${containerName}` ||
    state.Status !== "created" ||
    config.Image !== imageId ||
    config.User !== "65532:65532" ||
    !absentNullOrEmptyArray(config.Cmd) ||
    !absentNullOrEmptyRecord(config.ExposedPorts) ||
    JSON.stringify(config.Entrypoint) !==
      JSON.stringify(["python", "-I", "-B", "/worker/parser.py"]) ||
    !safeImageEnvironment(config.Env) ||
    host.NetworkMode !== "none" ||
    host.ReadonlyRootfs !== true ||
    host.Privileged !== false ||
    host.PublishAllPorts !== false ||
    !absentNullOrEmptyArray(host.CapAdd) ||
    JSON.stringify(host.CapDrop) !== JSON.stringify(["ALL"]) ||
    JSON.stringify(host.SecurityOpt) !==
      JSON.stringify(["no-new-privileges=true"]) ||
    host.PidsLimit !== 32 ||
    host.Memory !== 134_217_728 ||
    host.MemorySwap !== 134_217_728 ||
    host.NanoCpus !== 500_000_000 ||
    host.IpcMode !== "none" ||
    !absentNullOrEmptyRecord(host.PortBindings) ||
    !absentNullOrEmptyRecord(network.Ports)
  )
    fail();
  if (!Array.isArray(host.Ulimits) || host.Ulimits.length !== 1) fail();
  const nofile = recordAtLeast(host.Ulimits[0], ["Hard", "Name", "Soft"]);
  if (nofile.Name !== "nofile" || nofile.Hard !== 64 || nofile.Soft !== 64)
    fail();
  const tmpfs = recordAtLeast(host.Tmpfs, ["/tmp"]);
  if (
    typeof tmpfs["/tmp"] !== "string" ||
    JSON.stringify(tmpfs["/tmp"].split(",").sort()) !==
      JSON.stringify(["rw", "noexec", "nosuid", "nodev", "size=8388608"].sort())
  )
    fail();
  if (!Array.isArray(container.Mounts) || container.Mounts.length !== 1) fail();
  const mount = recordAtLeast(container.Mounts[0], [
    "Destination",
    "RW",
    "Source",
    "Type",
  ]);
  if (
    mount.Type !== "bind" ||
    mount.Source !== archivePath ||
    mount.Destination !== "/input/filing.zip" ||
    mount.RW !== false
  )
    fail();
  if (!Array.isArray(host.Mounts) || host.Mounts.length !== 1) fail();
  const hostMount = recordAtLeast(host.Mounts[0], [
    "ReadOnly",
    "Source",
    "Target",
    "Type",
  ]);
  if (
    hostMount.Type !== "bind" ||
    hostMount.Source !== archivePath ||
    hostMount.Target !== "/input/filing.zip" ||
    hostMount.ReadOnly !== true
  )
    fail();
}

function recordAtLeast(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail();
  return value as Record<string, unknown>;
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
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function safeImageEnvironment(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "string" &&
        !/(?:PASSWORD|PRIVATE|SECRET|TOKEN)=/iu.test(entry),
    )
  );
}

function assertNormalized(
  result: FilingParserNormalizationExecutionResult,
  observedDocuments: readonly Uint8Array[],
  fixture: ReturnType<
    typeof buildSyntheticFilingParserNormalizationExecutionFixture
  >,
): asserts result is Extract<
  FilingParserNormalizationExecutionResult,
  { status: "normalized" }
> {
  if (
    result.status !== "normalized" ||
    result.normalization.factVersions.length !== 20 ||
    result.normalization.lineage.length !== 10 ||
    result.provenance.containerCount !== 2 ||
    observedDocuments.length !== 2 ||
    !exactBytes(observedDocuments[0], fixture.originalDocumentBytes) ||
    !exactBytes(observedDocuments[1], fixture.amendmentDocumentBytes) ||
    result.normalization.originalDocumentSha256 !==
      sha256(observedDocuments[0] as Uint8Array) ||
    result.normalization.amendmentDocumentSha256 !==
      sha256(observedDocuments[1] as Uint8Array)
  )
    fail();
}

function assertQuarantined(
  result: FilingParserNormalizationExecutionResult,
): void {
  if (
    result.status !== "quarantined" ||
    result.code !== "execution_quarantined" ||
    result.normalization !== null ||
    result.provenance !== null
  )
    fail();
}

function quarantineOutcome(
  caseId: "original-amendment-role-swap" | "original-archive-tamper",
  result: FilingParserNormalizationExecutionResult,
): FilingParserNormalizationExecutionEvidenceCaseOutcome {
  assertQuarantined(result);
  return Object.freeze({
    amendmentArchiveSha256: null,
    amendmentDocumentSha256: null,
    caseId,
    expectedStatus: "quarantined" as const,
    factVersionCount: 0 as const,
    lineageCount: 0 as const,
    observedStatus: "quarantined" as const,
    originalArchiveSha256: null,
    originalDocumentSha256: null,
    pairBindingSha256: null,
    replayMatched: false,
    resultSha256: sha256(text(canonicalJson(result))),
  });
}

async function committedSourceHashes(
  revision: string,
): Promise<readonly FilingParserNormalizationExecutionEvidenceSourceHash[]> {
  const output: FilingParserNormalizationExecutionEvidenceSourceHash[] = [];
  for (const path of FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS) {
    const source = await checkedCommand(
      "git",
      ["show", `${revision}:${path}`],
      10_000,
      MAX_COMMAND_BYTES,
      65_536,
    );
    output.push(Object.freeze({ path, sha256: sha256(source.stdout) }));
  }
  return Object.freeze(output);
}

async function readPinnedImageMetadata(): Promise<{
  readonly indexDigest: typeof BASE_INDEX_DIGEST;
  readonly platformManifestDigest: typeof BASE_PLATFORM_MANIFEST_DIGEST;
}> {
  const textValue = await readFile(
    "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    "utf8",
  );
  const value = JSON.parse(textValue) as unknown;
  const expected = {
    schemaVersion: 1,
    image: BASE_IMAGE,
    tag: "3.12.13-slim-bookworm",
    indexDigest: BASE_INDEX_DIGEST,
    platform: "linux/amd64",
    platformManifestDigest: BASE_PLATFORM_MANIFEST_DIGEST,
    pythonVersion: "3.12.13",
    distribution: "Debian GNU/Linux 12 (bookworm) slim",
    officialRegistryManifestUrl:
      "https://registry-1.docker.io/v2/library/python/manifests/3.12.13-slim-bookworm",
    officialImageDefinitionUrl:
      "https://github.com/docker-library/official-images/blob/master/library/python",
    cpythonLicense: "Python Software Foundation License Version 2",
    cpythonLicenseUrl: "https://docs.python.org/3.12/license.html",
    containerPackageLicenseInventoryStatus: "not_proven_ci_acceptance_only",
  } as const;
  if (
    `${JSON.stringify(value, null, 2)}\n` !== textValue ||
    canonicalJson(value) !== canonicalJson(expected)
  )
    fail();
  return Object.freeze({
    indexDigest: BASE_INDEX_DIGEST,
    platformManifestDigest: BASE_PLATFORM_MANIFEST_DIGEST,
  });
}

async function verifyBuiltImage(imageId: `sha256:${string}`): Promise<void> {
  const inspected = await checkedCommand(
    "docker",
    ["image", "inspect", imageId],
    10_000,
    1_048_576,
    65_536,
  );
  const values = JSON.parse(
    new TextDecoder().decode(inspected.stdout),
  ) as unknown;
  if (!Array.isArray(values) || values.length !== 1) fail();
  const image = recordAtLeast(values[0], [
    "Architecture",
    "Config",
    "Id",
    "Os",
  ]);
  const config = recordAtLeast(image.Config, [
    "Entrypoint",
    "Env",
    "User",
    "WorkingDir",
  ]);
  if (
    image.Id !== imageId ||
    image.Os !== "linux" ||
    image.Architecture !== "amd64" ||
    config.User !== "65532:65532" ||
    config.WorkingDir !== "/worker" ||
    !absentNullOrEmptyArray(config.Cmd) ||
    !absentNullOrEmptyRecord(config.ExposedPorts) ||
    JSON.stringify(config.Entrypoint) !==
      JSON.stringify(["python", "-I", "-B", "/worker/parser.py"]) ||
    !safeImageEnvironment(config.Env)
  )
    fail();
}

async function assertZeroResidue(): Promise<void> {
  const result = await checkedCommand(
    "docker",
    [
      "ps",
      "--all",
      "--filter",
      `label=${FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL}`,
      "--format",
      "{{.ID}}",
    ],
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.containerControlMilliseconds,
    4_096,
    4_096,
  );
  if (result.stdout.byteLength !== 0) fail();
}

async function removeImage(imageId: string): Promise<void> {
  await checkedCommand("docker", ["image", "rm", "--force", imageId], 30_000);
}

async function toolVersions(): Promise<{
  readonly dockerClient: string;
  readonly dockerServer: string;
  readonly git: string;
  readonly node: string;
  readonly pnpm: string;
  readonly python: string;
}> {
  const docker = decodeExactLine(
    (
      await checkedCommand(
        "docker",
        ["version", "--format", "{{.Client.Version}}|{{.Server.Version}}"],
        10_000,
      )
    ).stdout,
  ).split("|");
  if (docker.length !== 2 || docker[0] === undefined || docker[1] === undefined)
    fail();
  return Object.freeze({
    dockerClient: docker[0],
    dockerServer: docker[1],
    git: decodeExactLine(
      (await checkedCommand("git", ["--version"], 5_000)).stdout,
    ),
    node: process.version,
    pnpm: decodeExactLine(
      (await checkedCommand("pnpm", ["--version"], 5_000)).stdout,
    ),
    python: decodeExactLine(
      (await checkedCommand("python", ["--version"], 5_000)).stdout,
    ),
  });
}

interface AcceptanceEnvironment {
  readonly evidencePath: string;
  readonly event: "pull_request" | "push" | "workflow_dispatch";
  readonly ref: string;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly runnerTemp: string;
}

function acceptanceEnvironment(): AcceptanceEnvironment {
  if (
    process.platform !== "linux" ||
    process.arch !== "x64" ||
    process.env.CI !== "true" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_JOB !== "acceptance" ||
    process.env.GITHUB_WORKFLOW !==
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW
  )
    fail();
  const evidencePath = requiredEnvironment(
    "FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_PATH",
  );
  const event = requiredEnvironment("GITHUB_EVENT_NAME");
  const runnerTemp = requiredEnvironment("RUNNER_TEMP");
  if (
    !isAbsolute(evidencePath) ||
    !isAbsolute(runnerTemp) ||
    resolve(evidencePath) !== resolve(join(runnerTemp, EVIDENCE_FILE)) ||
    !["pull_request", "push", "workflow_dispatch"].includes(event)
  )
    fail();
  return Object.freeze({
    evidencePath,
    event: event as AcceptanceEnvironment["event"],
    ref: requiredEnvironment("GITHUB_REF"),
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    revision: requiredEnvironment("GITHUB_SHA"),
    runAttempt: positiveInteger(requiredEnvironment("GITHUB_RUN_ATTEMPT")),
    runId: requiredEnvironment("GITHUB_RUN_ID"),
    runnerTemp,
  });
}

function requiredEnvironment(key: string): string {
  const value = process.env[key];
  if (
    value === undefined ||
    value.length === 0 ||
    value.length > 4_096 ||
    /[\0\r\n]/u.test(value)
  )
    fail();
  return value;
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]{0,8}$/u.test(value)) fail();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail();
  return parsed;
}

interface CommandResult {
  readonly exitCode: number;
  readonly stderr: Uint8Array;
  readonly stdout: Uint8Array;
}

async function checkedCommand(
  executable: string,
  args: readonly string[],
  timeoutMilliseconds: number,
  stdoutLimitBytes = MAX_COMMAND_BYTES,
  stderrLimitBytes = 65_536,
): Promise<CommandResult> {
  const result = await command(
    executable,
    args,
    timeoutMilliseconds,
    stdoutLimitBytes,
    stderrLimitBytes,
  );
  if (result.exitCode !== 0 || result.stderr.byteLength !== 0) fail();
  return result;
}

function command(
  executable: string,
  args: readonly string[],
  timeoutMilliseconds: number,
  stdoutLimitBytes = MAX_COMMAND_BYTES,
  stderrLimitBytes = 65_536,
  signal?: AbortSignal,
): Promise<CommandResult> {
  if (signal?.aborted === true)
    return Promise.reject(new Error("acceptance failed"));
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failed = false;
    let settled = false;
    const stop = (): void => {
      failed = true;
      child.kill("SIGKILL");
    };
    const abort = (): void => stop();
    const timer = setTimeout(stop, timeoutMilliseconds);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted === true) stop();
    const finish = (error?: Error, result?: CommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error !== undefined) rejectPromise(error);
      else if (result !== undefined) resolvePromise(result);
      else rejectPromise(new Error("acceptance failed"));
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > stdoutLimitBytes) stop();
      else stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > stderrLimitBytes) stop();
      else stderr.push(Buffer.from(chunk));
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code, closeSignal) => {
      if (
        failed ||
        closeSignal !== null ||
        code === null ||
        !Number.isSafeInteger(code) ||
        code < 0 ||
        code > 255
      ) {
        finish(new Error("acceptance failed"));
        return;
      }
      finish(undefined, {
        exitCode: code,
        stderr: Uint8Array.from(Buffer.concat(stderr)),
        stdout: Uint8Array.from(Buffer.concat(stdout)),
      });
    });
  });
}

/** @internal Exported for exact Docker IID-file regression tests. */
export function imageIdValue(value: string): `sha256:${string}` {
  if (!HASH.test(value)) fail();
  return value as `sha256:${string}`;
}

function decodeExactLine(value: Uint8Array): string {
  const output = new TextDecoder("utf-8", { fatal: true }).decode(value);
  if (!output.endsWith("\n") || /[\0\r]/u.test(output)) fail();
  const line = output.slice(0, -1);
  if (line.length === 0 || line.includes("\n")) fail();
  return line;
}

async function assertPathAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    fail();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function exactBytes(left: Uint8Array | undefined, right: Uint8Array): boolean {
  return (
    left !== undefined &&
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

function exactDocumentOutputs(
  left: readonly Uint8Array[],
  right: readonly Uint8Array[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => exactBytes(value, right[index] as Uint8Array))
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") fail();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function requiredSourceHash(
  sourceHashes: readonly FilingParserNormalizationExecutionEvidenceSourceHash[],
  path: string,
): `sha256:${string}` {
  const source = sourceHashes.find((entry) => entry.path === path);
  if (source === undefined) fail();
  return source.sha256;
}

function fail(): never {
  throw new Error("acceptance failed");
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  let acceptancePhase: AcceptancePhase = "environment";
  await main((phase) => {
    acceptancePhase = phase;
  }).catch(() => {
    process.stderr.write(
      filingParserNormalizationExecutionAcceptanceFailureDiagnostic(
        acceptancePhase,
      ),
    );
    process.exitCode = 1;
  });
}
