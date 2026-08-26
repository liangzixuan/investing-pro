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
  type FilingParserNormalizationExecutionBoundary,
} from "@research-cockpit/filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "@research-cockpit/filing-parser-normalization-execution/test";

import {
  createFilingParserCrossEngineExecutionBoundary,
  type FilingParserCrossEngineExecutionResult,
} from "@research-cockpit/filing-parser-cross-engine-execution";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  createFilingParserCrossEngineExecutionEvidence,
  filingParserCrossEngineExecutionRequiredSourcePaths,
  filingParserCrossEngineImplementationSha256,
  serializeCanonicalFilingParserCrossEngineExecutionEvidence,
  type FilingParserCrossEngineExecutionEvidenceCaseOutcome,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
  type FilingParserCrossEngineExecutionEvidenceTransitionEntry,
} from "./filing-parser-cross-engine-execution-evidence";

const PYTHON_BASE_INDEX_DIGEST =
  "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2" as const;
const PYTHON_BASE_PLATFORM_MANIFEST_DIGEST =
  "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af" as const;
const PYTHON_BASE_IMAGE =
  "docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2" as const;
const NODE_BASE_INDEX_DIGEST =
  "sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df" as const;
const NODE_BASE_PLATFORM_MANIFEST_DIGEST =
  "sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174" as const;
const NODE_BASE_IMAGE =
  "docker.io/library/node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df" as const;
const PYTHON_ENGINE_ID = "python-3.12-primary-v1";
const NODE_ENGINE_ID = "node-24-secondary-v1";
const KEY_ID = "cycle2k-ephemeral-ed25519-v1";
const EVIDENCE_FILE =
  "research-cockpit-filing-parser-cross-engine-execution-v1.json";
const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const MAX_COMMAND_BYTES = 4_194_304;
export interface FilingParserCrossEngineImageInspectionProfile {
  readonly entrypoint: readonly string[];
  readonly workingDirectory: "/input" | "/worker";
}
export const PYTHON_IMAGE_INSPECTION_PROFILE = Object.freeze({
  entrypoint: Object.freeze(["python", "-I", "-B", "/worker/parser.py"]),
  workingDirectory: "/worker" as const,
});
export const NODE_IMAGE_INSPECTION_PROFILE = Object.freeze({
  entrypoint: Object.freeze([
    "node",
    "--disable-proto=throw",
    "/worker/parser.mjs",
  ]),
  workingDirectory: "/input" as const,
});
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
  "audited_mismatch",
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

export function filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(
  phase: unknown,
): string {
  const prefix =
    "filing_parser_cross_engine_execution_acceptance_failed phase=";
  switch (phase) {
    case "environment":
      return `${prefix}environment\n`;
    case "repository_anchor":
      return `${prefix}repository_anchor\n`;
    case "source_inventory":
      return `${prefix}source_inventory\n`;
    case "image_metadata":
      return `${prefix}image_metadata\n`;
    case "staging":
      return `${prefix}staging\n`;
    case "image_build":
      return `${prefix}image_build\n`;
    case "image_inspection":
      return `${prefix}image_inspection\n`;
    case "audited_setup":
      return `${prefix}audited_setup\n`;
    case "audited_success":
      return `${prefix}audited_success\n`;
    case "audited_replay":
      return `${prefix}audited_replay\n`;
    case "audited_mismatch":
      return `${prefix}audited_mismatch\n`;
    case "audited_tamper":
      return `${prefix}audited_tamper\n`;
    case "audited_role_swap":
      return `${prefix}audited_role_swap\n`;
    case "audited_residue":
      return `${prefix}audited_residue\n`;
    case "production_setup":
      return `${prefix}production_setup\n`;
    case "production_success":
      return `${prefix}production_success\n`;
    case "production_replay":
      return `${prefix}production_replay\n`;
    case "production_tamper":
      return `${prefix}production_tamper\n`;
    case "production_residue":
      return `${prefix}production_residue\n`;
    case "evidence_assembly":
      return `${prefix}evidence_assembly\n`;
    case "tool_versions":
      return `${prefix}tool_versions\n`;
    case "image_removal":
      return `${prefix}image_removal\n`;
    case "evidence_write":
      return `${prefix}evidence_write\n`;
    case "cleanup":
      return `${prefix}cleanup\n`;
    default:
      return `${prefix}internal\n`;
  }
}

export function filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase(
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
  const transition = await exactCorrectiveChainTransition(revision);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionRequiredSourcePaths(transition);
  const sourceHashes = await committedSourceHashes(
    revision,
    requiredSourcePaths,
  );
  const fixtureManifestSha256 = requiredSourceHash(
    sourceHashes,
    "fixtures/synthetic/filing-parser-cross-engine-execution/v1/manifest.json",
  );
  const pythonSources = implementationSources(
    sourceHashes,
    FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python,
  );
  const nodeSources = implementationSources(
    sourceHashes,
    FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node,
  );
  const pythonImplementationSha256 =
    filingParserCrossEngineImplementationSha256(pythonSources);
  const nodeImplementationSha256 =
    filingParserCrossEngineImplementationSha256(nodeSources);
  markPhase("image_metadata");
  const pythonMetadata = await readPinnedImageMetadata("python");
  const nodeMetadata = await readPinnedImageMetadata("node");
  markPhase("staging");
  const temporaryDirectory = await mkdtemp(
    join(environment.runnerTemp, "filing-cross-engine-execution-"),
  );
  const pythonImageIdFile = join(temporaryDirectory, "python-image-id.txt");
  const nodeImageIdFile = join(temporaryDirectory, "node-image-id.txt");
  let pythonImageId: `sha256:${string}` | null = null;
  let nodeImageId: `sha256:${string}` | null = null;
  let temporaryEvidencePath: string | null = null;
  let evidenceWritten = false;
  let primaryFailure = false;
  try {
    markPhase("image_build");
    pythonImageId = await buildImage(
      "packages/filing-parser-normalization-execution",
      pythonImageIdFile,
    );
    nodeImageId = await buildImage(
      "packages/filing-parser-cross-engine-execution",
      nodeImageIdFile,
    );
    markPhase("image_inspection");
    await verifyBuiltImage(pythonImageId, PYTHON_IMAGE_INSPECTION_PROFILE);
    await verifyBuiltImage(nodeImageId, NODE_IMAGE_INSPECTION_PROFILE);

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
    const pythonRecorder = new RecordingDockerProcessRunner(
      [0, 0, 0, 0, 0, 0, 2, 0, 0],
      PYTHON_IMAGE_INSPECTION_PROFILE,
    );
    const nodeRecorder = new RecordingDockerProcessRunner(
      [0, 0, 0, 0, 0, 0],
      NODE_IMAGE_INSPECTION_PROFILE,
    );
    const pythonBoundary = createFilingParserNormalizationExecutionBoundary({
      imageSha256: pythonImageId,
      processRunner: Object.freeze({
        run: pythonRecorder.run.bind(pythonRecorder),
      }),
      publicKeySpki,
      signer,
    });
    const nodeBoundary = createFilingParserNormalizationExecutionBoundary({
      imageSha256: nodeImageId,
      processRunner: Object.freeze({
        run: nodeRecorder.run.bind(nodeRecorder),
      }),
      publicKeySpki,
      signer,
    });
    const boundary = crossBoundary(
      pythonBoundary,
      nodeBoundary,
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );

    markPhase("audited_success");
    const pythonSuccessStart = pythonRecorder.documentOutputs.length;
    const nodeSuccessStart = nodeRecorder.documentOutputs.length;
    const success = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    const pythonSuccessDocuments =
      pythonRecorder.documentOutputs.slice(pythonSuccessStart);
    const nodeSuccessDocuments =
      nodeRecorder.documentOutputs.slice(nodeSuccessStart);
    assertAgreed(
      success,
      pythonSuccessDocuments,
      nodeSuccessDocuments,
      fixture,
    );
    assertEngineAnchors(
      success,
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );

    markPhase("audited_replay");
    const pythonReplayStart = pythonRecorder.documentOutputs.length;
    const nodeReplayStart = nodeRecorder.documentOutputs.length;
    const replay = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    const pythonReplayDocuments =
      pythonRecorder.documentOutputs.slice(pythonReplayStart);
    const nodeReplayDocuments =
      nodeRecorder.documentOutputs.slice(nodeReplayStart);
    assertAgreed(replay, pythonReplayDocuments, nodeReplayDocuments, fixture);
    assertEngineAnchors(
      replay,
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );
    if (
      canonicalJson(success) !== canonicalJson(replay) ||
      !exactDocumentOutputs(pythonSuccessDocuments, pythonReplayDocuments) ||
      !exactDocumentOutputs(nodeSuccessDocuments, nodeReplayDocuments)
    )
      fail();

    markPhase("audited_mismatch");
    const pythonMismatchStart = pythonRecorder.documentOutputs.length;
    const nodeMismatchStart = nodeRecorder.documentOutputs.length;
    const mismatchBoundary = crossBoundary(
      pythonBoundary,
      mismatchingBoundary(nodeBoundary),
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );
    const mismatch = await mismatchBoundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    assertCrossQuarantined(mismatch);
    assertObservedPair(
      pythonRecorder.documentOutputs.slice(pythonMismatchStart),
      nodeRecorder.documentOutputs.slice(nodeMismatchStart),
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
    );

    markPhase("audited_tamper");
    const tamperedOriginal = Uint8Array.from(fixture.originalArchive);
    tamperedOriginal[0] = (tamperedOriginal[0] ?? 0) ^ 0xff;
    const tampered = await boundary.execute(
      tamperedOriginal,
      fixture.amendmentArchive,
    );
    assertCrossQuarantined(tampered);
    markPhase("audited_role_swap");
    const swapStart = pythonRecorder.documentOutputs.length;
    const swapped = await boundary.execute(
      fixture.amendmentArchive,
      fixture.originalArchive,
    );
    assertCrossQuarantined(swapped);
    const swapDocuments = pythonRecorder.documentOutputs.slice(swapStart);
    if (
      swapDocuments.length !== 2 ||
      !exactBytes(swapDocuments[0], fixture.amendmentDocumentBytes) ||
      !exactBytes(swapDocuments[1], fixture.originalDocumentBytes)
    )
      fail();
    markPhase("audited_residue");
    pythonRecorder.assertComplete();
    nodeRecorder.assertComplete();
    await assertZeroResidue();

    // The recorder proves the inspected Docker configuration. This second
    // pass exercises the shipped default process runner itself so a surrogate
    // runner cannot produce the live artifact on its behalf.
    markPhase("production_setup");
    const productionPython = createFilingParserNormalizationExecutionBoundary({
      imageSha256: pythonImageId,
      publicKeySpki,
      signer,
    });
    const productionNode = createFilingParserNormalizationExecutionBoundary({
      imageSha256: nodeImageId,
      publicKeySpki,
      signer,
    });
    const productionBoundary = crossBoundary(
      productionPython,
      productionNode,
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );
    markPhase("production_success");
    const productionSuccess = await productionBoundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    if (
      productionSuccess.status !== "agreed" ||
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
    assertCrossQuarantined(productionRejected);
    markPhase("production_residue");
    await assertZeroResidue();

    markPhase("evidence_assembly");
    const outcomes: readonly FilingParserCrossEngineExecutionEvidenceCaseOutcome[] =
      Object.freeze([
        Object.freeze({
          amendmentArchiveSha256: sha256(fixture.amendmentArchive),
          agreementSha256: success.provenance.agreementSha256,
          caseId: "exact-original-amendment-cross-engine-pair" as const,
          expectedStatus: "agreed" as const,
          factVersionCount: 20 as const,
          lineageCount: 10 as const,
          nodeAmendmentStdoutSha256: sha256(
            nodeSuccessDocuments[1] as Uint8Array,
          ),
          nodeExecutionBindingSha256:
            success.provenance.engines[1].executionBindingSha256,
          nodeOriginalStdoutSha256: sha256(
            nodeSuccessDocuments[0] as Uint8Array,
          ),
          normalizationSha256: sha256(
            text(canonicalJson(success.normalization)),
          ),
          observedStatus: "agreed" as const,
          originalArchiveSha256: sha256(fixture.originalArchive),
          pythonAmendmentStdoutSha256: sha256(
            pythonSuccessDocuments[1] as Uint8Array,
          ),
          pythonExecutionBindingSha256:
            success.provenance.engines[0].executionBindingSha256,
          pythonOriginalStdoutSha256: sha256(
            pythonSuccessDocuments[0] as Uint8Array,
          ),
          replayMatched: true,
          resultSha256: sha256(text(canonicalJson(success))),
        }),
        crossQuarantineOutcome("cross-engine-normalization-mismatch", mismatch),
        crossQuarantineOutcome("original-archive-tamper", tampered),
        crossQuarantineOutcome("original-amendment-role-swap", swapped),
      ]);

    markPhase("tool_versions");
    const tools = await toolVersions();
    const completedAt = new Date().toISOString();
    markPhase("evidence_assembly");
    const evidence = createFilingParserCrossEngineExecutionEvidence({
      baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
      caseOutcomes: outcomes,
      checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS,
      claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM,
      completedAt,
      evidenceVersion: 1,
      failedCorrectiveRevision:
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
      failedPrecursorRevision:
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
      fixtureManifestSha256,
      engines: Object.freeze([
        Object.freeze({
          architecture: "amd64" as const,
          baseIndexDigest: pythonMetadata.indexDigest,
          basePlatformManifestDigest: pythonMetadata.platformManifestDigest,
          builtImageId: pythonImageId,
          engineId: PYTHON_ENGINE_ID,
          implementationSha256: pythonImplementationSha256,
          implementationSourceHashes: pythonSources,
          operatingSystem: "linux" as const,
          role: "python-primary" as const,
          runtimeVersion: "Python 3.12.13",
        }),
        Object.freeze({
          architecture: "amd64" as const,
          baseIndexDigest: nodeMetadata.indexDigest,
          basePlatformManifestDigest: nodeMetadata.platformManifestDigest,
          builtImageId: nodeImageId,
          engineId: NODE_ENGINE_ID,
          implementationSha256: nodeImplementationSha256,
          implementationSourceHashes: nodeSources,
          operatingSystem: "linux" as const,
          role: "node-secondary" as const,
          runtimeVersion: "Node v24.19.0",
        }),
      ]),
      notProven: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN,
      repository: environment.repository,
      revision,
      runtime: Object.freeze({
        capabilitiesDropped: Object.freeze(["ALL"] as const),
        containerControlMilliseconds: 5_000 as const,
        auditedContainerCount: 15,
        containerUser: "65532:65532" as const,
        cpuCount: 0.5 as const,
        engineCount: 2 as const,
        inputMount: "/input/filing.zip:ro" as const,
        memoryBytes: 134_217_728 as const,
        networkMode: "none" as const,
        noNewPrivileges: true as const,
        noPublishedPorts: true as const,
        openFiles: 64 as const,
        pids: 32 as const,
        processTerminationMilliseconds: 250 as const,
        productionContainerCount: 9,
        readOnlyRootFilesystem: true as const,
        signerMilliseconds: 5_000 as const,
        stderrLimitBytes: 4_096 as const,
        stdoutLimitBytes: 262_144 as const,
        successfulPairContainerCount: 4 as const,
        temporaryFilesystem:
          "/tmp:rw,noexec,nosuid,nodev,size=8388608" as const,
        wallClockMilliseconds: 5_000 as const,
        zeroResidue: true as const,
      }),
      schemaVersion:
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION,
      sourceHashes,
      startedAt,
      status: "passed" as const,
      summary: Object.freeze({
        agreed: 1 as const,
        quarantined: 3 as const,
        replayMatched: true as const,
        total: 4 as const,
      }),
      synthetic: true as const,
      tools,
      workflow: Object.freeze({
        artifactName: `filing-parser-cross-engine-execution-evidence-v1-${revision}-${environment.runAttempt}`,
        event: environment.event,
        job: "acceptance" as const,
        ref: environment.ref,
        runAttempt: environment.runAttempt,
        runId: environment.runId,
        workflowName: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW,
      }),
      transition: Object.freeze({
        entries: transition,
        pathCount: transition.length,
      }),
    });
    markPhase("image_removal");
    await removeImage(pythonImageId);
    pythonImageId = null;
    await removeImage(nodeImageId);
    nodeImageId = null;
    markPhase("evidence_write");
    temporaryEvidencePath = `${environment.evidencePath}.tmp`;
    await assertPathAbsent(temporaryEvidencePath);
    await writeFile(
      temporaryEvidencePath,
      serializeCanonicalFilingParserCrossEngineExecutionEvidence(evidence),
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
      if (pythonImageId !== null)
        await removeImage(pythonImageId).catch(() => undefined);
      if (nodeImageId !== null)
        await removeImage(nodeImageId).catch(() => undefined);
      if (temporaryEvidencePath !== null)
        await rm(temporaryEvidencePath, { force: true });
      await rm(temporaryDirectory, { force: true, recursive: true });
      if (!evidenceWritten) {
        // A candidate artifact is never written on failure or cancellation.
      }
    } catch (error) {
      if (
        filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase(
          primaryFailure,
        )
      )
        markPhase("cleanup");
      if (!primaryFailure)
        await Promise.reject(
          error instanceof Error ? error : new Error("acceptance failed"),
        );
    }
  }
}

function crossBoundary(
  pythonBoundary: FilingParserNormalizationExecutionBoundary,
  nodeBoundary: FilingParserNormalizationExecutionBoundary,
  pythonImageSha256: `sha256:${string}`,
  nodeImageSha256: `sha256:${string}`,
  pythonImplementationSha256: `sha256:${string}`,
  nodeImplementationSha256: `sha256:${string}`,
) {
  return createFilingParserCrossEngineExecutionBoundary({
    pythonPrimary: Object.freeze({
      boundary: pythonBoundary,
      engineId: PYTHON_ENGINE_ID,
      imageSha256: pythonImageSha256,
      implementationSha256: pythonImplementationSha256,
      role: "python-primary" as const,
    }),
    nodeSecondary: Object.freeze({
      boundary: nodeBoundary,
      engineId: NODE_ENGINE_ID,
      imageSha256: nodeImageSha256,
      implementationSha256: nodeImplementationSha256,
      role: "node-secondary" as const,
    }),
  });
}

function mismatchingBoundary(
  boundary: FilingParserNormalizationExecutionBoundary,
): FilingParserNormalizationExecutionBoundary {
  return Object.freeze({
    async execute(
      originalArchive: unknown,
      amendmentArchive: unknown,
      options?: { readonly signal?: AbortSignal },
    ) {
      const result = await boundary.execute(
        originalArchive,
        amendmentArchive,
        options,
      );
      if (result.status !== "normalized") return result;
      const copied = JSON.parse(
        JSON.stringify(result),
      ) as FilingParserNormalizationExecutionResult;
      if (copied.status !== "normalized") fail();
      const first = copied.normalization.factVersions[0];
      if (first === undefined) fail();
      (first as { value: string }).value = `${first.value}1`;
      return copied;
    },
  });
}

async function buildImage(
  context: string,
  imageIdFile: string,
): Promise<`sha256:${string}`> {
  const result = await command(
    "docker",
    [
      "build",
      "--pull",
      "--platform",
      "linux/amd64",
      "--file",
      `${context}/worker/Dockerfile`,
      "--iidfile",
      imageIdFile,
      context,
    ],
    300_000,
    2_097_152,
    2_097_152,
  );
  if (result.exitCode !== 0) fail();
  return imageIdValue(await readFile(imageIdFile, "utf8"));
}

function implementationSources(
  sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[],
  paths: readonly string[],
): readonly FilingParserCrossEngineExecutionEvidenceSourceHash[] {
  return Object.freeze(
    paths.map((path) => {
      const source = sourceHashes.find((candidate) => candidate.path === path);
      if (source === undefined) fail();
      return source;
    }),
  );
}

async function exactCorrectiveChainTransition(
  revision: string,
): Promise<readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[]> {
  const base = FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE;
  const failedPrecursor =
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION;
  const failedCorrective =
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION;
  const mergeBase = decodeExactLine(
    (await checkedCommand("git", ["merge-base", base, revision], 5_000)).stdout,
  );
  const revisionRange = `${base}..${revision}`;
  const successorCount = decodeExactLine(
    (await checkedCommand("git", ["rev-list", "--count", revisionRange], 5_000))
      .stdout,
  );
  const firstParentCount = decodeExactLine(
    (
      await checkedCommand(
        "git",
        ["rev-list", "--first-parent", "--count", revisionRange],
        5_000,
      )
    ).stdout,
  );
  const parentLine = decodeExactLine(
    (
      await checkedCommand(
        "git",
        ["rev-list", "--parents", "--max-count=1", revision],
        5_000,
      )
    ).stdout,
  );
  const failedPrecursorParentLine = decodeExactLine(
    (
      await checkedCommand(
        "git",
        ["rev-list", "--parents", "--max-count=1", failedPrecursor],
        5_000,
      )
    ).stdout,
  );
  const failedCorrectiveParentLine = decodeExactLine(
    (
      await checkedCommand(
        "git",
        ["rev-list", "--parents", "--max-count=1", failedCorrective],
        5_000,
      )
    ).stdout,
  );
  if (
    mergeBase !== base ||
    successorCount !== "3" ||
    firstParentCount !== "3" ||
    parentLine !== `${revision} ${failedCorrective}` ||
    failedCorrectiveParentLine !== `${failedCorrective} ${failedPrecursor}` ||
    failedPrecursorParentLine !== `${failedPrecursor} ${base}`
  )
    fail();
  const output = (
    await checkedCommand(
      "git",
      ["diff", "--name-status", "--no-renames", base, revision],
      10_000,
      MAX_COMMAND_BYTES,
      65_536,
    )
  ).stdout;
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(output);
  if (!decoded.endsWith("\n")) fail();
  const entries = decoded
    .slice(0, -1)
    .split("\n")
    .map((line) => {
      const match = /^(A|M)\t([^\t\r\n]+)$/u.exec(line);
      if (match?.[1] === undefined || match[2] === undefined) fail();
      return Object.freeze({ status: match[1] as "A" | "M", path: match[2] });
    });
  if (entries.length === 0) fail();
  return Object.freeze(entries);
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

  public constructor(
    private readonly expectedExitCodes: readonly number[],
    private readonly expectedImageProfile: FilingParserCrossEngineImageInspectionProfile,
  ) {}

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
      this.#createCount !== this.expectedExitCodes.length ||
      this.#removeCount !== this.expectedExitCodes.length ||
      this.#residueCount !== this.expectedExitCodes.length ||
      this.documentOutputs.length !==
        this.expectedExitCodes.filter((code) => code === 0).length ||
      JSON.stringify(this.#startExitCodes) !==
        JSON.stringify(this.expectedExitCodes)
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
      this.expectedImageProfile,
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
  expectedProfile: FilingParserCrossEngineImageInspectionProfile = PYTHON_IMAGE_INSPECTION_PROFILE,
): void {
  validateImageProfile(expectedProfile);
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
    "WorkingDir",
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
      JSON.stringify(expectedProfile.entrypoint) ||
    config.WorkingDir !== expectedProfile.workingDirectory ||
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

function assertAgreed(
  result: FilingParserCrossEngineExecutionResult,
  pythonDocuments: readonly Uint8Array[],
  nodeDocuments: readonly Uint8Array[],
  fixture: ReturnType<
    typeof buildSyntheticFilingParserNormalizationExecutionFixture
  >,
): asserts result is Extract<
  FilingParserCrossEngineExecutionResult,
  { status: "agreed" }
> {
  if (
    result.status !== "agreed" ||
    result.normalization.factVersions.length !== 20 ||
    result.normalization.lineage.length !== 10 ||
    result.provenance.engineCount !== 2 ||
    result.provenance.engines[0].role !== "python-primary" ||
    result.provenance.engines[0].engineId !== PYTHON_ENGINE_ID ||
    result.provenance.engines[1].role !== "node-secondary" ||
    result.provenance.engines[1].engineId !== NODE_ENGINE_ID ||
    pythonDocuments.length !== 2 ||
    nodeDocuments.length !== 2 ||
    !exactDocumentOutputs(pythonDocuments, nodeDocuments) ||
    !exactBytes(pythonDocuments[0], fixture.originalDocumentBytes) ||
    !exactBytes(pythonDocuments[1], fixture.amendmentDocumentBytes) ||
    result.normalization.originalDocumentSha256 !==
      sha256(pythonDocuments[0] as Uint8Array) ||
    result.normalization.amendmentDocumentSha256 !==
      sha256(pythonDocuments[1] as Uint8Array)
  )
    fail();
}

function assertObservedPair(
  pythonDocuments: readonly Uint8Array[],
  nodeDocuments: readonly Uint8Array[],
  originalDocument: Uint8Array,
  amendmentDocument: Uint8Array,
): void {
  if (
    pythonDocuments.length !== 2 ||
    nodeDocuments.length !== 2 ||
    !exactDocumentOutputs(pythonDocuments, nodeDocuments) ||
    !exactBytes(pythonDocuments[0], originalDocument) ||
    !exactBytes(pythonDocuments[1], amendmentDocument)
  )
    fail();
}

function assertEngineAnchors(
  result: Extract<FilingParserCrossEngineExecutionResult, { status: "agreed" }>,
  pythonImageSha256: `sha256:${string}`,
  nodeImageSha256: `sha256:${string}`,
  pythonImplementationSha256: `sha256:${string}`,
  nodeImplementationSha256: `sha256:${string}`,
): void {
  const [python, node] = result.provenance.engines;
  if (
    python.imageSha256 !== pythonImageSha256 ||
    python.implementationSha256 !== pythonImplementationSha256 ||
    node.imageSha256 !== nodeImageSha256 ||
    node.implementationSha256 !== nodeImplementationSha256 ||
    python.imageSha256 === node.imageSha256 ||
    python.implementationSha256 === node.implementationSha256
  )
    fail();
}

function assertCrossQuarantined(
  result: FilingParserCrossEngineExecutionResult,
): void {
  if (
    result.status !== "quarantined" ||
    result.code !== "agreement_quarantined" ||
    result.normalization !== null ||
    result.provenance !== null
  )
    fail();
}

function crossQuarantineOutcome(
  caseId:
    | "cross-engine-normalization-mismatch"
    | "original-amendment-role-swap"
    | "original-archive-tamper",
  result: FilingParserCrossEngineExecutionResult,
): FilingParserCrossEngineExecutionEvidenceCaseOutcome {
  assertCrossQuarantined(result);
  return Object.freeze({
    amendmentArchiveSha256: null,
    agreementSha256: null,
    caseId,
    expectedStatus: "quarantined" as const,
    factVersionCount: null,
    lineageCount: null,
    nodeAmendmentStdoutSha256: null,
    nodeExecutionBindingSha256: null,
    nodeOriginalStdoutSha256: null,
    normalizationSha256: null,
    observedStatus: "quarantined" as const,
    originalArchiveSha256: null,
    pythonAmendmentStdoutSha256: null,
    pythonExecutionBindingSha256: null,
    pythonOriginalStdoutSha256: null,
    replayMatched: false,
    resultSha256: null,
  });
}

async function committedSourceHashes(
  revision: string,
  paths: readonly string[],
): Promise<readonly FilingParserCrossEngineExecutionEvidenceSourceHash[]> {
  const output: FilingParserCrossEngineExecutionEvidenceSourceHash[] = [];
  for (const path of paths) {
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

async function readPinnedImageMetadata(engine: "node" | "python"): Promise<{
  readonly indexDigest: `sha256:${string}`;
  readonly platformManifestDigest: `sha256:${string}`;
}> {
  if (engine === "node") {
    const textValue = await readFile(
      "packages/filing-parser-cross-engine-execution/acceptance/node-image.json",
      "utf8",
    );
    const value = JSON.parse(textValue) as unknown;
    const expected = {
      schemaVersion: 1,
      image: NODE_BASE_IMAGE,
      tag: "24.19.0-bookworm-slim",
      indexDigest: NODE_BASE_INDEX_DIGEST,
      platform: "linux/amd64",
      platformManifestDigest: NODE_BASE_PLATFORM_MANIFEST_DIGEST,
      nodeVersion: "24.19.0",
      distribution: "Debian GNU/Linux 12 (bookworm) slim",
      officialRegistryManifestUrl:
        "https://registry-1.docker.io/v2/library/node/manifests/24.19.0-bookworm-slim",
      officialImageDefinitionUrl:
        "https://github.com/docker-library/official-images/blob/master/library/node",
      nodeLicense: "MIT License",
      nodeLicenseUrl: "https://github.com/nodejs/node/blob/v24.19.0/LICENSE",
      containerPackageLicenseInventoryStatus: "not_proven_ci_acceptance_only",
    } as const;
    if (
      `${JSON.stringify(value, null, 2)}\n` !== textValue ||
      canonicalJson(value) !== canonicalJson(expected)
    )
      fail();
    return Object.freeze({
      indexDigest: NODE_BASE_INDEX_DIGEST,
      platformManifestDigest: NODE_BASE_PLATFORM_MANIFEST_DIGEST,
    });
  }
  const textValue = await readFile(
    "packages/filing-parser-normalization-execution/acceptance/python-image.json",
    "utf8",
  );
  const value = JSON.parse(textValue) as unknown;
  const expected = {
    schemaVersion: 1,
    image: PYTHON_BASE_IMAGE,
    tag: "3.12.13-slim-bookworm",
    indexDigest: PYTHON_BASE_INDEX_DIGEST,
    platform: "linux/amd64",
    platformManifestDigest: PYTHON_BASE_PLATFORM_MANIFEST_DIGEST,
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
    indexDigest: PYTHON_BASE_INDEX_DIGEST,
    platformManifestDigest: PYTHON_BASE_PLATFORM_MANIFEST_DIGEST,
  });
}

async function verifyBuiltImage(
  imageId: `sha256:${string}`,
  expectedProfile: FilingParserCrossEngineImageInspectionProfile,
): Promise<void> {
  const inspected = await checkedCommand(
    "docker",
    ["image", "inspect", imageId],
    10_000,
    1_048_576,
    65_536,
  );
  const value = JSON.parse(
    new TextDecoder().decode(inspected.stdout),
  ) as unknown;
  validateBuiltImageInspection(value, imageId, expectedProfile);
}

/** @internal Exported for fail-closed Docker image inspection tests. */
export function validateBuiltImageInspection(
  value: unknown,
  imageId: `sha256:${string}`,
  expectedProfile: FilingParserCrossEngineImageInspectionProfile,
): void {
  validateImageProfile(expectedProfile);
  const values = value;
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
    config.WorkingDir !== expectedProfile.workingDirectory ||
    !absentNullOrEmptyArray(config.Cmd) ||
    !absentNullOrEmptyRecord(config.ExposedPorts) ||
    JSON.stringify(config.Entrypoint) !==
      JSON.stringify(expectedProfile.entrypoint) ||
    !safeImageEnvironment(config.Env)
  )
    fail();
}

function validateImageProfile(
  profile: FilingParserCrossEngineImageInspectionProfile,
): void {
  const canonical = JSON.stringify(profile);
  if (
    canonical !== JSON.stringify(PYTHON_IMAGE_INSPECTION_PROFILE) &&
    canonical !== JSON.stringify(NODE_IMAGE_INSPECTION_PROFILE)
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
  readonly event: "push" | "workflow_dispatch";
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
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW
  )
    fail();
  const evidencePath = requiredEnvironment(
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_PATH",
  );
  const event = requiredEnvironment("GITHUB_EVENT_NAME");
  const runnerTemp = requiredEnvironment("RUNNER_TEMP");
  if (
    !isAbsolute(evidencePath) ||
    !isAbsolute(runnerTemp) ||
    resolve(evidencePath) !== resolve(join(runnerTemp, EVIDENCE_FILE)) ||
    !["push", "workflow_dispatch"].includes(event)
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
  sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[],
  path: string,
): `sha256:${string}` {
  const source = sourceHashes.find((entry) => entry.path === path);
  if (source === undefined) fail();
  return source.sha256;
}

function fail(): never {
  throw new Error("acceptance failed");
}

// Keep direct execution last so every runtime class binding is initialized.
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
      filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(
        acceptancePhase,
      ),
    );
    process.exitCode = 1;
  });
}
