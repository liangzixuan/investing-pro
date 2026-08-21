import {
  createHash,
  generateKeyPairSync,
  sign as ed25519Sign,
  type KeyObject,
} from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";

import {
  FILING_PARSER_CONTAINER_LABEL,
  FILING_PARSER_LIMITS,
  FilingParserProcessError,
  createDockerFilingParserBoundary,
  verifyFilingParserProvenance,
  type FilingParserProcessErrorCode,
  type FilingParserProcessRequest,
  type FilingParserProcessResult,
  type FilingParserProcessRunner,
  type FilingParserSigner,
  type SignedFilingParserResult,
} from "./parser-boundary";
import {
  FILING_PARSER_EVIDENCE_CHECKS,
  FILING_PARSER_EVIDENCE_CLAIM,
  FILING_PARSER_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_EVIDENCE_SOURCE_PATHS,
  FILING_PARSER_EVIDENCE_WORKFLOW,
  FilingParserContainerInspectionError,
  FilingParserImageInspectionError,
  createFilingParserEvidence,
  filingParserEvidenceSha256,
  serializeCanonicalFilingParserEvidence,
  validateFilingParserContainerInspection,
  validateFilingParserImageInspection,
  type FilingParserContainerInspectionCheckCode,
  type FilingParserEvidenceCaseOutcome,
  type FilingParserEvidenceSourceHash,
  type FilingParserImageInspectionCheckCode,
} from "./filing-parser-evidence";
import { verifyCycle2aCommitBoundary } from "./filing-parser-evidence-verifier";
import { buildParserSecurityCases } from "./test-archive-builder";

const EXPECTED_IMAGE =
  "docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2";
const BASE_INDEX_DIGEST =
  "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2" as const;
const BASE_PLATFORM_MANIFEST_DIGEST =
  "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af" as const;
const SIGNING_KEY_ID = "cycle2a-ephemeral-ed25519-v1";
const EVIDENCE_FILE_NAME = "research-cockpit-filing-parser-isolation-v1.json";
const MAX_COMMAND_OUTPUT_BYTES = 4_194_304;

type FilingParserAcceptanceStage =
  | "bootstrap"
  | "boundary_setup"
  | "case_execution"
  | "commit_boundary"
  | "environment"
  | "evidence_construction"
  | "evidence_write"
  | "fixture_inventory"
  | "image_build"
  | "image_inspection"
  | "image_removal"
  | "replay_validation"
  | "residue_validation"
  | "revision"
  | "process_runner_setup"
  | "signing_setup"
  | "source_hashes"
  | "tool_versions"
  | "worktree";

type FilingParserDockerFailurePhase =
  | "container_create"
  | "container_inspection"
  | "container_remove"
  | "container_start"
  | "label_residue"
  | "name_residue"
  | "none";

type FilingParserInspectionDiagnosticCode =
  | FilingParserContainerInspectionCheckCode
  | FilingParserImageInspectionCheckCode
  | "create_result_shape"
  | "inspect_command"
  | "inspect_json"
  | "inspect_result_count"
  | "mount_argument_shape"
  | "none"
  | "validator_unexpected";

let acceptanceStage: FilingParserAcceptanceStage = "bootstrap";
let acceptanceCaseIndex = -1;
let firstDockerFailurePhase: FilingParserDockerFailurePhase = "none";
let firstInspectionCheck: FilingParserInspectionDiagnosticCode = "none";

async function main(): Promise<void> {
  acceptanceStage = "environment";
  const environment = acceptanceEnvironment();
  const startedAt = new Date().toISOString();
  const repositoryPath = resolve(process.cwd());
  acceptanceStage = "revision";
  const revision = oneLine(
    await checkedCommandStdout("git", ["rev-parse", "HEAD"], 5_000),
  );
  if (revision !== environment.revision) fail();
  acceptanceStage = "worktree";
  const worktree = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    5_000,
  );
  if (
    worktree.exitCode !== 0 ||
    worktree.stdout.byteLength !== 0 ||
    worktree.stderr.byteLength !== 0
  )
    fail();
  acceptanceStage = "commit_boundary";
  await verifyCycle2aCommitBoundary(repositoryPath, revision);

  acceptanceStage = "source_hashes";
  const sourceHashes = await committedSourceHashes(repositoryPath, revision);
  const fixtureManifestSha256 = requiredSourceHash(
    sourceHashes,
    "fixtures/synthetic/filing-parser/v1/manifest.json",
  );
  const cases = buildParserSecurityCases();
  acceptanceStage = "fixture_inventory";
  await verifyFixtureInventory(repositoryPath, cases, sourceHashes);

  acceptanceStage = "image_build";
  const buildDirectory = await mkdtemp(
    join(environment.runnerTemp, "filing-parser-build-"),
  );
  const imageIdPath = join(buildDirectory, "image-id.txt");
  let imageId: `sha256:${string}` | null = null;
  try {
    acceptanceStage = "image_build";
    const build = await runCommand(
      "docker",
      [
        "build",
        "--pull",
        "--platform",
        "linux/amd64",
        "--file",
        "packages/filing-parser/worker/Dockerfile",
        "--iidfile",
        imageIdPath,
        "packages/filing-parser",
      ],
      300_000,
      2_097_152,
      2_097_152,
    );
    if (build.exitCode !== 0) fail();
    imageId = imageIdValue(await readFile(imageIdPath, "utf8"));
    acceptanceStage = "image_inspection";
    await verifyBuiltImage(imageId);

    acceptanceStage = "signing_setup";
    const signing = signingHarness();
    acceptanceStage = "process_runner_setup";
    const processRunner = new AuditedDockerProcessRunner(imageId);
    acceptanceStage = "boundary_setup";
    const boundary = createDockerFilingParserBoundary({
      imageId,
      signer: signing.signer,
      processRunner,
    });
    const outcomes: FilingParserEvidenceCaseOutcome[] = [];
    const acceptedReplay: SignedFilingParserResult[] = [];

    acceptanceStage = "case_execution";
    for (const [caseIndex, parserCase] of cases.entries()) {
      acceptanceCaseIndex = caseIndex;
      resetDockerFailureDiagnostic();
      const signed = await boundary.parse(Uint8Array.from(parserCase.archive));
      if (
        signed.result.status !== parserCase.expected.status ||
        signed.provenance.imageId !== imageId ||
        signed.provenance.keyId !== SIGNING_KEY_ID ||
        !verifyFilingParserProvenance(signed, signing.publicKey)
      )
        fail();
      if (
        signed.result.status === "quarantined" &&
        (parserCase.expected.status !== "quarantined" ||
          signed.result.code !== parserCase.expected.code ||
          signed.result.facts.length !== 0)
      )
        fail();
      if (
        signed.result.status === "accepted" &&
        (parserCase.expected.status !== "accepted" ||
          signed.result.facts.length !== FILING_PARSER_LIMITS.facts)
      )
        fail();
      if (
        parserCase.id === "accepted_canonical" ||
        parserCase.id === "accepted_exact_replay"
      )
        acceptedReplay.push(signed);
      const tampered = tamperSignature(signed);
      if (verifyFilingParserProvenance(tampered, signing.publicKey)) fail();
      outcomes.push({
        caseId: parserCase.id,
        expectedStatus: parserCase.expected.status,
        factCount: signed.result.facts.length,
        imageId,
        observedStatus: signed.result.status,
        provenanceAlgorithm: signed.provenance.algorithm,
        provenanceKeyId: "cycle2a-ephemeral-ed25519-v1",
        provenancePayloadSha256: signed.provenance.payloadSha256,
        provenanceVerified: true,
        quarantineCode:
          signed.result.status === "quarantined" ? signed.result.code : null,
        replayMatched: false,
        resultSha256: sha256(canonicalBytes(signed.result)),
        signatureSha256: sha256(
          Uint8Array.from(
            Buffer.from(signed.provenance.signature, "base64url"),
          ),
        ),
        sourceSha256: signed.result.sourceSha256,
        tamperRejected: true,
      });
    }

    acceptanceCaseIndex = -1;
    resetDockerFailureDiagnostic();
    acceptanceStage = "replay_validation";
    if (
      acceptedReplay.length !== 2 ||
      canonicalJson(acceptedReplay[0]) !== canonicalJson(acceptedReplay[1]) ||
      canonicalJson(acceptedReplay[0]?.result) !==
        canonicalJson(acceptedReplay[1]?.result) ||
      acceptedReplay[0]?.provenance.payloadSha256 !==
        acceptedReplay[1]?.provenance.payloadSha256
    )
      fail();
    for (const outcome of outcomes) {
      if (
        outcome.caseId === "accepted_canonical" ||
        outcome.caseId === "accepted_exact_replay"
      )
        (outcome as { replayMatched: boolean }).replayMatched = true;
    }

    acceptanceStage = "residue_validation";
    resetDockerFailureDiagnostic();
    await processRunner.verifyNoResidue();
    acceptanceStage = "tool_versions";
    const tools = await toolVersions();
    const accepted = outcomes.filter(
      (outcome) => outcome.observedStatus === "accepted",
    ).length;
    const completedAt = new Date().toISOString();
    acceptanceStage = "evidence_construction";
    const evidence = createFilingParserEvidence({
      caseOutcomes: outcomes,
      checksPassed: FILING_PARSER_EVIDENCE_CHECKS,
      claim: FILING_PARSER_EVIDENCE_CLAIM,
      completedAt,
      evidenceVersion: 1,
      fixtureManifestSha256,
      image: {
        architecture: "amd64",
        baseIndexDigest: BASE_INDEX_DIGEST,
        basePlatformManifestDigest: BASE_PLATFORM_MANIFEST_DIGEST,
        builtImageId: imageId,
        operatingSystem: "linux",
        pythonVersion: "3.12.13",
      },
      notProven: FILING_PARSER_EVIDENCE_NOT_PROVEN,
      repository: environment.repository,
      revision,
      runtime: {
        capabilitiesDropped: ["ALL"],
        containerUser: "65532:65532",
        cpuCount: FILING_PARSER_LIMITS.cpuCount,
        inputMount: "/input/filing.zip:ro",
        memoryBytes: FILING_PARSER_LIMITS.memoryBytes,
        networkMode: "none",
        noNewPrivileges: true,
        noPublishedPorts: true,
        openFiles: FILING_PARSER_LIMITS.openFiles,
        pids: FILING_PARSER_LIMITS.pids,
        readOnlyRootFilesystem: true,
        temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608",
        wallClockMilliseconds: FILING_PARSER_LIMITS.workerWallMilliseconds,
        zeroResidue: true,
      },
      schemaVersion: FILING_PARSER_EVIDENCE_SCHEMA_VERSION,
      sourceHashes,
      startedAt,
      status: "passed",
      summary: {
        accepted,
        exactByteReplayPassed: true,
        quarantined: outcomes.length - accepted,
        total: outcomes.length,
      },
      synthetic: true,
      tools,
      workflow: {
        event: environment.event,
        job: "acceptance",
        ref: environment.ref,
        runAttempt: environment.runAttempt,
        runId: environment.runId,
        workflowName: FILING_PARSER_EVIDENCE_WORKFLOW,
      },
    });

    acceptanceStage = "image_removal";
    resetDockerFailureDiagnostic();
    const imageRemoval = await runCommand(
      "docker",
      ["image", "rm", "--force", imageId],
      30_000,
    );
    if (imageRemoval.exitCode !== 0) fail();
    imageId = null;
    acceptanceStage = "residue_validation";
    await processRunner.verifyNoResidue();

    acceptanceStage = "evidence_write";
    resetDockerFailureDiagnostic();
    const serialized = serializeCanonicalFilingParserEvidence(evidence);
    const temporaryEvidencePath = join(
      environment.runnerTemp,
      `.filing-parser-evidence-${process.pid}.tmp`,
    );
    await writeFile(temporaryEvidencePath, serialized, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryEvidencePath, environment.evidencePath);
    process.stdout.write(
      `filing_parser_acceptance_passed cases=${outcomes.length} evidence_sha256=${filingParserEvidenceSha256(evidence)}\n`,
    );
  } finally {
    if (imageId !== null) {
      await runCommand(
        "docker",
        ["image", "rm", "--force", imageId],
        30_000,
      ).catch(() => undefined);
    }
    await rm(buildDirectory, { recursive: true, force: true });
  }
}

class AuditedDockerProcessRunner implements FilingParserProcessRunner {
  public constructor(private readonly imageId: `sha256:${string}`) {}

  public async run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    if (
      request.command !== "docker" ||
      !Array.isArray(request.args) ||
      !request.args.every((argument) => typeof argument === "string") ||
      !Number.isSafeInteger(request.timeoutMilliseconds) ||
      request.timeoutMilliseconds < 1 ||
      !Number.isSafeInteger(request.stdoutLimitBytes) ||
      request.stdoutLimitBytes < 1 ||
      !Number.isSafeInteger(request.stderrLimitBytes) ||
      request.stderrLimitBytes < 1
    )
      return Promise.reject(processFailure());
    const phase = dockerFailurePhase(request.args);
    try {
      this.verifyCommand(request.args);
      const result = await runDockerBoundaryProcess(request);
      if (dockerResultFailed(phase, result)) latchDockerFailure(phase);
      if (
        request.args[0] === "create" &&
        result.exitCode === 0 &&
        result.stderr.byteLength === 0
      )
        await this.verifyCreatedContainer(request.args, result.stdout);
      return result;
    } catch (error) {
      latchDockerFailure(phase);
      throw error;
    }
  }

  public async verifyNoResidue(): Promise<void> {
    let result: FilingParserProcessResult;
    try {
      result = await runCommand(
        "docker",
        [
          "container",
          "ls",
          "--all",
          "--quiet",
          "--filter",
          `label=${FILING_PARSER_CONTAINER_LABEL}`,
        ],
        FILING_PARSER_LIMITS.dockerControlMilliseconds,
        256,
        FILING_PARSER_LIMITS.stderrBytes,
      );
    } catch (error) {
      latchDockerFailure("label_residue");
      throw error;
    }
    if (
      result.exitCode !== 0 ||
      result.stdout.byteLength !== 0 ||
      result.stderr.byteLength !== 0
    ) {
      latchDockerFailure("label_residue");
      fail();
    }
  }

  private verifyCommand(args: readonly string[]): void {
    if (args[0] === "create") {
      this.verifyCreate(args);
      return;
    }
    const filter = args.at(-1);
    const containerName =
      args[0] === "container" &&
      filter?.startsWith("name=^/") === true &&
      filter.endsWith("$")
        ? filter.slice("name=^/".length, -1)
        : args.at(-1);
    if (
      containerName === undefined ||
      !/^research-cockpit-filing-parser-[0-9a-f-]{36}$/u.test(containerName)
    )
      fail();
    const expected =
      args[0] === "start"
        ? ["start", "--attach", containerName]
        : args[0] === "rm"
          ? ["rm", "--force", containerName]
          : args[0] === "container"
            ? [
                "container",
                "ls",
                "--all",
                "--quiet",
                "--filter",
                `name=^/${containerName}$`,
              ]
            : fail();
    if (canonicalJson(args) !== canonicalJson(expected)) fail();
  }

  private verifyCreate(args: readonly string[]): void {
    const containerName = args[2];
    const mount = args[args.length - 2];
    if (
      containerName === undefined ||
      !/^research-cockpit-filing-parser-[0-9a-f-]{36}$/u.test(containerName) ||
      mount === undefined ||
      mount.includes("\u0000") ||
      !/^type=bind,source=\/[^,\r\n]+\/filing\.zip,destination=\/input\/filing\.zip,readonly$/u.test(
        mount,
      )
    )
      fail();
    const expected = [
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
      mount,
      this.imageId,
    ];
    if (canonicalJson(args) !== canonicalJson(expected)) fail();
  }

  private async verifyCreatedContainer(
    args: readonly string[],
    createStdout: Uint8Array,
  ): Promise<void> {
    const containerName = args[2];
    const mount = args.at(-2);
    const containerId = oneLine(createStdout);
    if (
      containerName === undefined ||
      mount === undefined ||
      !/^[0-9a-f]{64}$/u.test(containerId)
    ) {
      latchDockerFailure("container_inspection", "create_result_shape");
      fail();
    }
    const prefix = "type=bind,source=";
    const suffix = ",destination=/input/filing.zip,readonly";
    if (!mount.startsWith(prefix) || !mount.endsWith(suffix)) {
      latchDockerFailure("container_inspection", "mount_argument_shape");
      fail();
    }
    const inputSource = mount.slice(prefix.length, -suffix.length);
    let inspection: FilingParserProcessResult;
    try {
      inspection = await runCommand(
        "docker",
        ["container", "inspect", containerName],
        FILING_PARSER_LIMITS.dockerControlMilliseconds,
        262_144,
        FILING_PARSER_LIMITS.stderrBytes,
      );
    } catch (error) {
      latchDockerFailure("container_inspection", "inspect_command");
      throw error;
    }
    if (inspection.exitCode !== 0 || inspection.stderr.byteLength !== 0) {
      latchDockerFailure("container_inspection", "inspect_command");
      fail();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder().decode(inspection.stdout),
      ) as unknown;
    } catch {
      latchDockerFailure("container_inspection", "inspect_json");
      return fail();
    }
    if (!Array.isArray(parsed) || parsed.length !== 1) {
      latchDockerFailure("container_inspection", "inspect_result_count");
      fail();
    }
    try {
      validateFilingParserContainerInspection(parsed[0], {
        containerId,
        containerName,
        imageId: this.imageId,
        inputSource,
      });
    } catch (error) {
      latchDockerFailure(
        "container_inspection",
        error instanceof FilingParserContainerInspectionError
          ? error.checkCode
          : "validator_unexpected",
      );
      throw error;
    }
  }
}

function dockerFailurePhase(
  args: readonly string[],
): FilingParserDockerFailurePhase {
  if (args[0] === "create") return "container_create";
  if (args[0] === "start") return "container_start";
  if (args[0] === "rm") return "container_remove";
  if (args[0] === "container") return "name_residue";
  return "none";
}

function dockerResultFailed(
  phase: FilingParserDockerFailurePhase,
  result: FilingParserProcessResult,
): boolean {
  if (phase === "name_residue")
    return (
      result.exitCode !== 0 ||
      result.stdout.byteLength !== 0 ||
      result.stderr.byteLength !== 0
    );
  if (
    phase === "container_create" ||
    phase === "container_remove" ||
    phase === "container_start"
  )
    return result.exitCode !== 0 || result.stderr.byteLength !== 0;
  return false;
}

function latchDockerFailure(
  phase: FilingParserDockerFailurePhase,
  inspectionCheck: FilingParserInspectionDiagnosticCode = "none",
): void {
  if (firstDockerFailurePhase !== "none" || phase === "none") return;
  firstDockerFailurePhase = phase;
  firstInspectionCheck =
    phase === "container_inspection" ? inspectionCheck : "none";
}

function latchImageInspectionFailure(
  inspectionCheck: Exclude<FilingParserInspectionDiagnosticCode, "none">,
): void {
  if (firstInspectionCheck !== "none") return;
  firstInspectionCheck = inspectionCheck;
}

function resetDockerFailureDiagnostic(): void {
  firstDockerFailurePhase = "none";
  firstInspectionCheck = "none";
}

function runDockerBoundaryProcess(
  request: FilingParserProcessRequest,
): Promise<FilingParserProcessResult> {
  return boundedSpawn(
    request.command,
    request.args,
    request.timeoutMilliseconds,
    request.stdoutLimitBytes,
    request.stderrLimitBytes,
    request.signal,
    true,
  );
}

async function committedSourceHashes(
  repositoryPath: string,
  revision: string,
): Promise<FilingParserEvidenceSourceHash[]> {
  const output: FilingParserEvidenceSourceHash[] = [];
  for (const path of FILING_PARSER_EVIDENCE_SOURCE_PATHS) {
    const result = await runCommand(
      "git",
      ["-C", repositoryPath, "show", `${revision}:${path}`],
      10_000,
      MAX_COMMAND_OUTPUT_BYTES,
      16_384,
    );
    if (result.exitCode !== 0 || result.stderr.byteLength !== 0) fail();
    output.push({ path, sha256: sha256(result.stdout) });
  }
  return output;
}

async function verifyFixtureInventory(
  repositoryPath: string,
  cases: ReturnType<typeof buildParserSecurityCases>,
  sourceHashes: readonly FilingParserEvidenceSourceHash[],
): Promise<void> {
  const casesBytes = Uint8Array.from(
    await readFile(
      join(repositoryPath, "fixtures/synthetic/filing-parser/v1/cases.json"),
    ),
  );
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(casesBytes);
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return fail();
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== "1.0.0" ||
    value.synthetic !== true
  )
    fail();
  if (!Array.isArray(value.cases) || value.cases.length !== cases.length)
    fail();
  for (let index = 0; index < cases.length; index += 1) {
    const expected = cases[index];
    const recorded: unknown = value.cases[index];
    if (!expected || !isRecord(recorded)) fail();
    const recordedKeys = Object.keys(recorded).sort();
    if (
      canonicalJson(recordedKeys) !==
      canonicalJson(["archiveSha256", "expected", "id"])
    )
      fail();
    if (
      recorded.id !== expected.id ||
      recorded.archiveSha256 !== sha256(expected.archive) ||
      canonicalJson(recorded.expected) !== canonicalJson(expected.expected)
    )
      fail();
  }
  const manifest = await readJson(
    join(repositoryPath, "fixtures/synthetic/filing-parser/v1/manifest.json"),
  );
  if (!isRecord(manifest)) fail();
  const manifestKeys = Object.keys(manifest).sort();
  if (
    canonicalJson(manifestKeys) !==
      canonicalJson([
        "acceptedCases",
        "caseCount",
        "casesSha256",
        "files",
        "quarantinedCases",
        "schemaVersion",
        "synthetic",
      ]) ||
    manifest.acceptedCases !== 3 ||
    manifest.caseCount !== cases.length ||
    manifest.casesSha256 !== sha256(casesBytes) ||
    manifest.quarantinedCases !== cases.length - 3 ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.synthetic !== true ||
    !Array.isArray(manifest.files)
  )
    fail();
  const expectedFiles = [
    "packages/filing-parser/acceptance/python-image.json",
    "packages/filing-parser/src/test-archive-builder.ts",
    "packages/filing-parser/worker/Dockerfile",
    "packages/filing-parser/worker/parser.py",
    "packages/filing-parser/worker/taxonomy-v1.json",
  ] as const;
  if (manifest.files.length !== expectedFiles.length) fail();
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const path = expectedFiles[index];
    const entry: unknown = manifest.files[index];
    if (
      path === undefined ||
      !isRecord(entry) ||
      canonicalJson(Object.keys(entry).sort()) !==
        canonicalJson(["path", "sha256"]) ||
      entry.path !== path ||
      entry.sha256 !== requiredSourceHash(sourceHashes, path)
    )
      fail();
  }
  const imageConfig = await readJson(
    join(repositoryPath, "packages/filing-parser/acceptance/python-image.json"),
  );
  if (
    !isRecord(imageConfig) ||
    imageConfig.image !== EXPECTED_IMAGE ||
    imageConfig.indexDigest !== BASE_INDEX_DIGEST ||
    imageConfig.platform !== "linux/amd64" ||
    imageConfig.platformManifestDigest !== BASE_PLATFORM_MANIFEST_DIGEST ||
    imageConfig.pythonVersion !== "3.12.13" ||
    imageConfig.containerPackageLicenseInventoryStatus !==
      "not_proven_ci_acceptance_only"
  )
    fail();
}

async function verifyBuiltImage(imageId: `sha256:${string}`): Promise<void> {
  let result: FilingParserProcessResult;
  try {
    result = await runCommand(
      "docker",
      ["image", "inspect", imageId],
      10_000,
      262_144,
      16_384,
    );
  } catch (error) {
    latchImageInspectionFailure("inspect_command");
    throw error;
  }
  try {
    validateFilingParserImageInspection(result, imageId);
  } catch (error) {
    latchImageInspectionFailure(
      error instanceof FilingParserImageInspectionError
        ? error.checkCode
        : "validator_unexpected",
    );
    throw error;
  }
}

function signingHarness(): {
  readonly publicKey: KeyObject;
  readonly signer: FilingParserSigner;
} {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicKey,
    signer: Object.freeze({
      algorithm: "ed25519" as const,
      keyId: SIGNING_KEY_ID,
      sign: (payload: Uint8Array) =>
        Promise.resolve(
          Uint8Array.from(ed25519Sign(null, payload, privateKey)),
        ),
    }),
  };
}

function tamperSignature(
  signed: SignedFilingParserResult,
): SignedFilingParserResult {
  const first = signed.provenance.signature[0];
  if (first === undefined) fail();
  return {
    result: signed.result,
    provenance: {
      ...signed.provenance,
      signature: `${first === "A" ? "B" : "A"}${signed.provenance.signature.slice(1)}`,
    },
  };
}

async function toolVersions(): Promise<{
  dockerClient: string;
  dockerServer: string;
  git: string;
  node: string;
  pnpm: string;
  python: string;
}> {
  const docker = lines(
    await checkedCommandStdout(
      "docker",
      ["version", "--format", "{{.Client.Version}}\n{{.Server.Version}}"],
      10_000,
    ),
    2,
  );
  return {
    dockerClient: `Docker ${docker[0]}`,
    dockerServer: `Docker Engine ${docker[1]}`,
    git: oneLine(await checkedCommandStdout("git", ["--version"], 5_000)),
    node: oneLine(await checkedCommandStdout("node", ["--version"], 5_000)),
    pnpm: oneLine(await checkedCommandStdout("pnpm", ["--version"], 5_000)),
    python: oneLine(await checkedCommandStdout("python", ["--version"], 5_000)),
  };
}

async function checkedCommandStdout(
  command: string,
  args: readonly string[],
  timeoutMilliseconds: number,
): Promise<Uint8Array> {
  const result = await runCommand(
    command,
    args,
    timeoutMilliseconds,
    16_384,
    16_384,
  );
  if (result.exitCode !== 0 || result.stderr.byteLength !== 0) fail();
  return result.stdout;
}

function acceptanceEnvironment(): {
  evidencePath: string;
  event: "pull_request" | "push" | "workflow_dispatch";
  ref: string;
  repository: string;
  revision: string;
  runAttempt: number;
  runId: string;
  runnerTemp: string;
} {
  if (
    process.platform !== "linux" ||
    process.arch !== "x64" ||
    process.env.CI !== "true" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_JOB !== "acceptance" ||
    process.env.GITHUB_WORKFLOW !== FILING_PARSER_EVIDENCE_WORKFLOW
  )
    fail();
  const runnerTemp = requiredEnvironment("RUNNER_TEMP");
  const evidencePath = requiredEnvironment("FILING_PARSER_EVIDENCE_PATH");
  if (
    !isAbsolute(runnerTemp) ||
    !isAbsolute(evidencePath) ||
    resolve(evidencePath) !== resolve(join(runnerTemp, EVIDENCE_FILE_NAME))
  )
    fail();
  const eventValue = requiredEnvironment("GITHUB_EVENT_NAME");
  if (!isWorkflowEvent(eventValue)) fail();
  return {
    evidencePath,
    event: eventValue,
    ref: requiredEnvironment("GITHUB_REF"),
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    revision: requiredEnvironment("GITHUB_SHA"),
    runAttempt: positiveInteger(requiredEnvironment("GITHUB_RUN_ATTEMPT")),
    runId: requiredEnvironment("GITHUB_RUN_ID"),
    runnerTemp,
  };
}

function runCommand(
  command: string,
  args: readonly string[],
  timeoutMilliseconds: number,
  stdoutLimitBytes = 262_144,
  stderrLimitBytes = 262_144,
): Promise<FilingParserProcessResult> {
  return boundedSpawn(
    command,
    args,
    timeoutMilliseconds,
    stdoutLimitBytes,
    stderrLimitBytes,
    undefined,
    false,
  );
}

function boundedSpawn(
  command: string,
  args: readonly string[],
  timeoutMilliseconds: number,
  stdoutLimitBytes: number,
  stderrLimitBytes: number,
  signal: AbortSignal | undefined,
  boundaryErrors: boolean,
): Promise<FilingParserProcessResult> {
  if (signal?.aborted === true) {
    return Promise.reject(
      boundaryErrors
        ? new FilingParserProcessError("FILING_PARSER_PROCESS_ABORTED")
        : new Error("Filing parser isolation acceptance failed."),
    );
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...args], {
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
    const stop = (code: FilingParserProcessErrorCode) => {
      failure ??= code;
      try {
        child.kill("SIGKILL");
      } catch {
        failure = "FILING_PARSER_PROCESS_FAILURE";
      }
    };
    const abort = () => stop("FILING_PARSER_PROCESS_ABORTED");
    const timeout = setTimeout(
      () => stop("FILING_PARSER_PROCESS_TIMEOUT"),
      timeoutMilliseconds,
    );
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > stdoutLimitBytes) {
        stop("FILING_PARSER_PROCESS_OUTPUT_LIMIT");
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > stderrLimitBytes) {
        stop("FILING_PARSER_PROCESS_OUTPUT_LIMIT");
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
      signal?.removeEventListener("abort", abort);
      if (failure !== null || code === null || !Number.isInteger(code)) {
        rejectPromise(
          boundaryErrors
            ? new FilingParserProcessError(
                failure ?? "FILING_PARSER_PROCESS_FAILURE",
              )
            : new Error("Filing parser isolation acceptance failed."),
        );
        return;
      }
      resolvePromise({
        exitCode: code,
        stdout: Uint8Array.from(Buffer.concat(stdout)),
        stderr: Uint8Array.from(Buffer.concat(stderr)),
      });
    });
  });
}

function requiredSourceHash(
  values: readonly FilingParserEvidenceSourceHash[],
  path: FilingParserEvidenceSourceHash["path"],
): `sha256:${string}` {
  return values.find((entry) => entry.path === path)?.sha256 ?? fail();
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return fail();
  }
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return String(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (!isRecord(value)) fail();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function imageIdValue(value: string): `sha256:${string}` {
  const trimmed = value.trim();
  if (!/^sha256:[0-9a-f]{64}$/u.test(trimmed)) fail();
  return trimmed as `sha256:${string}`;
}

function oneLine(value: Uint8Array): string {
  const result = lines(value, 1)[0];
  return result ?? fail();
}

function lines(value: Uint8Array, count: number): string[] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return fail();
  }
  const output = text.trimEnd().split("\n");
  if (
    output.length !== count ||
    output.some((line) => !/^[\x20-\x7e]{1,160}$/u.test(line))
  )
    fail();
  return output;
}

function requiredEnvironment(key: string): string {
  const value = process.env[key];
  if (
    value === undefined ||
    value.length === 0 ||
    /[\r\n]/u.test(value) ||
    value.includes("\u0000")
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

function isWorkflowEvent(
  value: string,
): value is "pull_request" | "push" | "workflow_dispatch" {
  return ["pull_request", "push", "workflow_dispatch"].includes(value);
}

function processFailure(): FilingParserProcessError {
  return new FilingParserProcessError("FILING_PARSER_PROCESS_FAILURE");
}

function fail(): never {
  throw new Error("Filing parser isolation acceptance failed.");
}

await main().catch(() => {
  process.stderr.write(
    `Filing parser isolation diagnostic stage=${acceptanceStage} case=${acceptanceCaseIndex} docker=${firstDockerFailurePhase} inspection=${firstInspectionCheck}.\n`,
  );
  process.stderr.write("Filing parser isolation acceptance failed.\n");
  process.exitCode = 1;
});
