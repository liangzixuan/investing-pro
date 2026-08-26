import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL,
  FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS,
  type FilingParserNormalizationExecutionProcessRequest,
} from "@research-cockpit/filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "@research-cockpit/filing-parser-normalization-execution/test";

import {
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN,
  createFilingParserCrossEngineDirectExecutionBoundary,
  type FilingParserCrossEngineDirectExecutionResult,
  type FilingParserCrossEngineDirectExecutionSuccess,
} from "@research-cockpit/filing-parser-cross-engine-execution";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  createFilingParserCrossEngineExecutionEvidenceV3ForAcceptance,
  filingParserCrossEngineExecutionV3RequiredSourcePaths,
  filingParserCrossEngineImplementationSha256,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
  type FilingParserCrossEngineExecutionEvidenceTransitionEntry,
  type FilingParserCrossEngineExecutionEvidenceV3CaseId,
  type FilingParserCrossEngineExecutionEvidenceV3CaseOutcome,
  type FilingParserCrossEngineExecutionEvidenceV3Invocation,
  type FilingParserCrossEngineExecutionEvidenceV3ValidationStage,
  type FilingParserCrossEngineExecutionEvidenceV2ValidationStage,
  type FilingParserCrossEngineExecutionEvidenceValidationStage,
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
const EVIDENCE_FILE =
  "research-cockpit-filing-parser-cross-engine-execution-v3.json";
const UNKNOWN_IMAGE = `sha256:${"0".repeat(64)}` as const;
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

const V3_VALIDATION_PHASES = Object.freeze([
  "evidence_validation_root_contract",
  "evidence_validation_timestamps",
  "evidence_validation_claim_tuples",
  "evidence_validation_historical_evidence",
  "evidence_validation_direct_execution_validation",
  "evidence_validation_case_outcomes",
  "evidence_validation_lifecycle_bindings",
  "evidence_validation_outer_invocation_bindings",
  "evidence_validation_transition",
  "evidence_validation_runtime",
  "evidence_validation_source_hashes",
  "evidence_validation_engines",
  "evidence_validation_fixture_binding",
  "evidence_validation_summary",
  "evidence_validation_tools_contract",
  "evidence_validation_workflow",
  "evidence_validation_canonical_freeze",
] as const);
const LEGACY_VALIDATION_PHASES = Object.freeze([
  "evidence_validation_historical_v1",
  "evidence_validation_binding_validation",
  "evidence_validation_tool_docker_client",
  "evidence_validation_tool_docker_server",
  "evidence_validation_tool_git",
  "evidence_validation_tool_node",
  "evidence_validation_tool_pnpm",
  "evidence_validation_tool_python",
] as const);

export const ACCEPTANCE_PHASES = Object.freeze([
  "environment",
  "repository_anchor",
  "source_inventory",
  "image_metadata",
  "staging",
  "image_build",
  "image_inspection",
  "direct_setup",
  "direct_success_first",
  "direct_success_second",
  "direct_success_validation",
  "adversarial_unknown_python_image",
  "adversarial_pre_aborted_signal",
  "adversarial_original_archive_tamper",
  "adversarial_original_amendment_role_swap",
  "adversarial_identical_archives",
  "direct_residue",
  "tool_versions",
  "evidence_assembly",
  ...V3_VALIDATION_PHASES,
  ...LEGACY_VALIDATION_PHASES,
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
  if (
    typeof phase === "string" &&
    (ACCEPTANCE_PHASES as readonly string[]).includes(phase)
  )
    return `${prefix}${phase}\n`;
  return `${prefix}internal\n`;
}

export function filingParserCrossEngineExecutionEvidenceV3ValidationPhase(
  stage: FilingParserCrossEngineExecutionEvidenceV3ValidationStage,
): AcceptancePhase {
  switch (stage) {
    case "root_contract":
      return "evidence_validation_root_contract";
    case "timestamps":
      return "evidence_validation_timestamps";
    case "claim_tuples":
      return "evidence_validation_claim_tuples";
    case "historical_evidence":
      return "evidence_validation_historical_evidence";
    case "direct_execution_validation":
      return "evidence_validation_direct_execution_validation";
    case "case_outcomes":
      return "evidence_validation_case_outcomes";
    case "lifecycle_bindings":
      return "evidence_validation_lifecycle_bindings";
    case "outer_invocation_bindings":
      return "evidence_validation_outer_invocation_bindings";
    case "transition":
      return "evidence_validation_transition";
    case "runtime":
      return "evidence_validation_runtime";
    case "source_hashes":
      return "evidence_validation_source_hashes";
    case "engines":
      return "evidence_validation_engines";
    case "fixture_binding":
      return "evidence_validation_fixture_binding";
    case "summary":
      return "evidence_validation_summary";
    case "tools_contract":
      return "evidence_validation_tools_contract";
    case "workflow":
      return "evidence_validation_workflow";
    case "canonical_freeze":
      return "evidence_validation_canonical_freeze";
  }
}

/** Historical v2 diagnostic mapper retained for offline v2 review tests. */
export function filingParserCrossEngineExecutionEvidenceV2ValidationPhase(
  stage: FilingParserCrossEngineExecutionEvidenceV2ValidationStage,
): AcceptancePhase {
  switch (stage) {
    case "root_contract":
      return "evidence_validation_root_contract";
    case "timestamps":
      return "evidence_validation_timestamps";
    case "claim_tuples":
      return "evidence_validation_claim_tuples";
    case "historical_v1":
      return "evidence_validation_historical_v1";
    case "binding_validation":
      return "evidence_validation_binding_validation";
    case "case_outcomes":
      return "evidence_validation_case_outcomes";
    case "transition":
      return "evidence_validation_transition";
    case "runtime":
      return "evidence_validation_runtime";
    case "source_hashes":
      return "evidence_validation_source_hashes";
    case "engines":
      return "evidence_validation_engines";
    case "fixture_binding":
      return "evidence_validation_fixture_binding";
    case "summary":
      return "evidence_validation_summary";
    case "tools_contract":
      return "evidence_validation_tools_contract";
    case "workflow":
      return "evidence_validation_workflow";
    case "canonical_freeze":
      return "evidence_validation_canonical_freeze";
  }
}

/** Historical v1 diagnostic mapper retained for offline v1 review tests. */
export function filingParserCrossEngineExecutionEvidenceValidationPhase(
  stage: FilingParserCrossEngineExecutionEvidenceValidationStage,
): AcceptancePhase {
  switch (stage) {
    case "root_contract":
      return "evidence_validation_root_contract";
    case "timestamps":
      return "evidence_validation_timestamps";
    case "claim_tuples":
      return "evidence_validation_claim_tuples";
    case "case_outcomes":
      return "evidence_validation_case_outcomes";
    case "transition":
      return "evidence_validation_transition";
    case "runtime":
      return "evidence_validation_runtime";
    case "source_hashes":
      return "evidence_validation_source_hashes";
    case "engines":
      return "evidence_validation_engines";
    case "fixture_binding":
      return "evidence_validation_fixture_binding";
    case "summary":
      return "evidence_validation_summary";
    case "tools_contract":
      return "evidence_validation_tools_contract";
    case "tool_docker_client":
      return "evidence_validation_tool_docker_client";
    case "tool_docker_server":
      return "evidence_validation_tool_docker_server";
    case "tool_git":
      return "evidence_validation_tool_git";
    case "tool_node":
      return "evidence_validation_tool_node";
    case "tool_pnpm":
      return "evidence_validation_tool_pnpm";
    case "tool_python":
      return "evidence_validation_tool_python";
    case "workflow":
      return "evidence_validation_workflow";
    case "canonical_freeze":
      return "evidence_validation_canonical_freeze";
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
  const transition = await exactCycle2mTransition(revision);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionV3RequiredSourcePaths(transition);
  const sourceHashes = await committedSourceHashes(
    revision,
    requiredSourcePaths,
  );
  const fixtureManifestSha256 = requiredSourceHash(
    sourceHashes,
    "fixtures/synthetic/filing-parser-cross-engine-execution/v3/manifest.json",
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
    join(environment.runnerTemp, "filing-cross-engine-direct-execution-"),
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
    await assertZeroResidue();

    markPhase("direct_setup");
    assertDirectEvidenceConstants();
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const boundary = createDirectBoundary(
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );
    markPhase("direct_success_first");
    const first = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    assertDirectAgreed(first);
    markPhase("direct_success_second");
    const second = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    assertDirectAgreed(second);
    markPhase("direct_success_validation");
    const successOutcome = directSuccessOutcome(
      first,
      second,
      fixture.originalArchive,
      fixture.amendmentArchive,
      pythonImageId,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    );

    markPhase("adversarial_unknown_python_image");
    const unknownImage = await createDirectBoundary(
      UNKNOWN_IMAGE,
      nodeImageId,
      pythonImplementationSha256,
      nodeImplementationSha256,
    ).execute(fixture.originalArchive, fixture.amendmentArchive);
    const unknownImageOutcome = directQuarantineOutcome(
      "unknown-python-image",
      unknownImage,
    );
    markPhase("adversarial_pre_aborted_signal");
    const abortController = new AbortController();
    abortController.abort();
    const preAborted = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
      Object.freeze({ signal: abortController.signal }),
    );
    const preAbortedOutcome = directQuarantineOutcome(
      "pre-aborted-signal",
      preAborted,
    );
    markPhase("adversarial_original_archive_tamper");
    const tamperedOriginal = Uint8Array.from(fixture.originalArchive);
    tamperedOriginal[0] = (tamperedOriginal[0] ?? 0) ^ 0xff;
    const tampered = await boundary.execute(
      tamperedOriginal,
      fixture.amendmentArchive,
    );
    const tamperedOutcome = directQuarantineOutcome(
      "original-archive-tamper",
      tampered,
    );
    markPhase("adversarial_original_amendment_role_swap");
    const swapped = await boundary.execute(
      fixture.amendmentArchive,
      fixture.originalArchive,
    );
    const swappedOutcome = directQuarantineOutcome(
      "original-amendment-role-swap",
      swapped,
    );
    markPhase("adversarial_identical_archives");
    const identical = await boundary.execute(
      fixture.originalArchive,
      fixture.originalArchive,
    );
    const identicalOutcome = directQuarantineOutcome(
      "identical-archives",
      identical,
    );
    markPhase("direct_residue");
    await assertZeroResidue();

    markPhase("tool_versions");
    const tools = await toolVersions();
    const completedAt = new Date().toISOString();
    markPhase("evidence_assembly");
    const outcomes = Object.freeze([
      successOutcome,
      unknownImageOutcome,
      preAbortedOutcome,
      tamperedOutcome,
      swappedOutcome,
      identicalOutcome,
    ] as const);
    const evidence =
      createFilingParserCrossEngineExecutionEvidenceV3ForAcceptance(
        {
          baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
          caseOutcomes: outcomes,
          checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
          claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM,
          completedAt,
          directExecutionValidation: Object.freeze({
            callerInjectionSurface: "none" as const,
            configurationSnapshot: "intrinsic_closed_exact" as const,
            lifecycleBinding: "recomputed_exact" as const,
            outerInvocationBinding: "recomputed_exact" as const,
            processExecution: "package_owned_bounded_shell_false" as const,
            signer: "internally_generated_ephemeral_ed25519" as const,
          }),
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
          ] as const),
          evidenceVersion: 3 as const,
          fixtureManifestSha256,
          historicalV1:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
          historicalV2:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
          notProven:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
          repository: environment.repository,
          revision,
          runtime: Object.freeze({
            capabilitiesDropped: Object.freeze(["ALL"] as const),
            containerControlMilliseconds: 5_000 as const,
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
            readOnlyRootFilesystem: true as const,
            signerMilliseconds: 5_000 as const,
            stderrLimitBytes: 4_096 as const,
            stdoutLimitBytes: 262_144 as const,
            successfulContainerCount: 8 as const,
            successfulInvocationCount: 2 as const,
            successfulLifecycleReceiptCount: 8 as const,
            temporaryFilesystem:
              "/tmp:rw,noexec,nosuid,nodev,size=8388608" as const,
            uniqueContainerIdSha256Count: 8 as const,
            wallClockMilliseconds: 5_000 as const,
            zeroResidue: true as const,
          }),
          schemaVersion:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION,
          sourceHashes,
          startedAt,
          status: "passed" as const,
          summary: Object.freeze({
            agreed: 1 as const,
            invocationBindingsDistinct: true as const,
            lifecycleBindingsDistinct: true as const,
            normalizationStable: true as const,
            quarantined: 5 as const,
            total: 6 as const,
          }),
          synthetic: true as const,
          tools,
          transition: Object.freeze({
            entries: transition,
            pathCount: transition.length,
          }),
          workflow: Object.freeze({
            artifactName: `filing-parser-cross-engine-execution-evidence-v3-${revision}-${environment.runAttempt}`,
            event: environment.event,
            job: "acceptance" as const,
            ref: environment.ref,
            runAttempt: environment.runAttempt,
            runId: environment.runId,
            workflowName:
              FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW,
          }),
        },
        (stage) => {
          markPhase(
            filingParserCrossEngineExecutionEvidenceV3ValidationPhase(stage),
          );
        },
      );

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
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(evidence),
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

function createDirectBoundary(
  pythonImageSha256: `sha256:${string}`,
  nodeImageSha256: `sha256:${string}`,
  pythonImplementationSha256: `sha256:${string}`,
  nodeImplementationSha256: `sha256:${string}`,
) {
  return createFilingParserCrossEngineDirectExecutionBoundary({
    nodeSecondary: Object.freeze({
      engineId: NODE_ENGINE_ID,
      imageSha256: nodeImageSha256,
      implementationSha256: nodeImplementationSha256,
      role: "node-secondary" as const,
    }),
    pythonPrimary: Object.freeze({
      engineId: PYTHON_ENGINE_ID,
      imageSha256: pythonImageSha256,
      implementationSha256: pythonImplementationSha256,
      role: "python-primary" as const,
    }),
  });
}

function assertDirectEvidenceConstants(): void {
  if (
    FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM ||
    canonicalJson(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS) ||
    canonicalJson(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN) !==
      canonicalJson(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
      ) ||
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.containerControlMilliseconds !==
      5_000 ||
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.processTerminationMilliseconds !==
      250 ||
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.signerMilliseconds !== 5_000 ||
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stderrBytes !== 4_096 ||
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.stdoutBytes !== 262_144 ||
    FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS.workerWallMilliseconds !==
      5_000
  )
    fail();
}

function assertDirectAgreed(
  result: FilingParserCrossEngineDirectExecutionResult,
): asserts result is FilingParserCrossEngineDirectExecutionSuccess {
  if (
    result.status !== "agreed" ||
    result.claim !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM ||
    result.normalization.factVersions.length !== 20 ||
    result.normalization.lineage.length !== 10 ||
    result.provenance.engineLifecycles[0].role !== "python-primary" ||
    result.provenance.engineLifecycles[1].role !== "node-secondary" ||
    result.provenance.engineLifecycles.some(
      ({ lifecycles }) => lifecycles.length !== 2,
    )
  )
    fail();
}

function directSuccessOutcome(
  first: FilingParserCrossEngineDirectExecutionSuccess,
  second: FilingParserCrossEngineDirectExecutionSuccess,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
  pythonImageSha256: `sha256:${string}`,
  nodeImageSha256: `sha256:${string}`,
  pythonImplementationSha256: `sha256:${string}`,
  nodeImplementationSha256: `sha256:${string}`,
): FilingParserCrossEngineExecutionEvidenceV3CaseOutcome {
  const invocations = Object.freeze([
    directInvocation(first),
    directInvocation(second),
  ] as const);
  const receipts = invocations.flatMap(
    (invocation) => invocation.lifecycleReceipts,
  );
  const containerIds = new Set(
    receipts.map((receipt) => receipt.containerIdSha256),
  );
  const lifecycleBindings = new Set(
    receipts.map((receipt) => receipt.lifecycleBindingSha256),
  );
  if (
    canonicalJson(first.normalization) !==
      canonicalJson(second.normalization) ||
    first.provenance.normalizationSha256 !==
      second.provenance.normalizationSha256 ||
    first.provenance.ephemeralPublicKeySpkiSha256 ===
      second.provenance.ephemeralPublicKeySpkiSha256 ||
    first.provenance.invocationBindingSha256 ===
      second.provenance.invocationBindingSha256 ||
    invocations[0].resultSha256 === invocations[1].resultSha256 ||
    containerIds.size !== 8 ||
    lifecycleBindings.size !== 8
  )
    fail();
  for (const success of [first, second]) {
    const agreement = success.provenance.agreement;
    if (
      agreement.originalArchiveSha256 !== sha256(originalArchive) ||
      agreement.amendmentArchiveSha256 !== sha256(amendmentArchive) ||
      agreement.engines[0]?.role !== "python-primary" ||
      agreement.engines[0].imageSha256 !== pythonImageSha256 ||
      agreement.engines[0].implementationSha256 !==
        pythonImplementationSha256 ||
      agreement.engines[1]?.role !== "node-secondary" ||
      agreement.engines[1].imageSha256 !== nodeImageSha256 ||
      agreement.engines[1].implementationSha256 !== nodeImplementationSha256
    )
      fail();
  }
  return Object.freeze({
    amendmentArchiveSha256: sha256(amendmentArchive),
    caseId: "same-input-direct-docker-distinct-lifecycle-invocations" as const,
    expectedStatus: "agreed" as const,
    factVersionCount: 20 as const,
    invocationBindingsDistinct: true,
    invocations,
    lifecycleBindingsDistinct: true,
    lineageCount: 10 as const,
    normalizationStable: true,
    observedStatus: "agreed" as const,
    originalArchiveSha256: sha256(originalArchive),
  });
}

function directInvocation(
  success: FilingParserCrossEngineDirectExecutionSuccess,
): FilingParserCrossEngineExecutionEvidenceV3Invocation {
  const agreement = success.provenance.agreement;
  const python = success.provenance.engineLifecycles[0];
  const node = success.provenance.engineLifecycles[1];
  if (
    python.role !== "python-primary" ||
    node.role !== "node-secondary" ||
    agreement.engines[0]?.role !== "python-primary" ||
    agreement.engines[1]?.role !== "node-secondary"
  )
    fail();
  return Object.freeze({
    agreementEngines: Object.freeze([
      Object.freeze({
        ...agreement.engines[0],
        role: "python-primary" as const,
      }),
      Object.freeze({
        ...agreement.engines[1],
        role: "node-secondary" as const,
      }),
    ] as const),
    agreementSha256: agreement.agreementSha256,
    executionMode: success.provenance.executionMode,
    invocationBindingSha256: success.provenance.invocationBindingSha256,
    keyId: success.provenance.keyId,
    lifecycleReceipts: Object.freeze([
      Object.freeze({ ...python.lifecycles[0] }),
      Object.freeze({ ...python.lifecycles[1] }),
      Object.freeze({ ...node.lifecycles[0] }),
      Object.freeze({ ...node.lifecycles[1] }),
    ] as const),
    normalizationSha256: success.provenance.normalizationSha256,
    publicKeySpkiSha256: success.provenance.ephemeralPublicKeySpkiSha256,
    resultSha256: sha256(text(canonicalJson(success))),
  });
}

function directQuarantineOutcome(
  caseId: Exclude<
    FilingParserCrossEngineExecutionEvidenceV3CaseId,
    "same-input-direct-docker-distinct-lifecycle-invocations"
  >,
  result: FilingParserCrossEngineDirectExecutionResult,
): FilingParserCrossEngineExecutionEvidenceV3CaseOutcome {
  if (
    result.status !== "quarantined" ||
    result.code !== "direct_execution_quarantined" ||
    Object.keys(result).sort().join("|") !==
      "claim|code|schemaVersion|status|synthetic"
  )
    fail();
  return Object.freeze({
    amendmentArchiveSha256: null,
    caseId,
    expectedStatus: "quarantined" as const,
    factVersionCount: null,
    invocationBindingsDistinct: false,
    invocations: null,
    lifecycleBindingsDistinct: false,
    lineageCount: null,
    normalizationStable: false,
    observedStatus: "quarantined" as const,
    originalArchiveSha256: null,
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

async function exactCycle2mTransition(
  revision: string,
): Promise<readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[]> {
  const base = FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE;
  const range = `${base}..${revision}`;
  const mergeBase = decodeExactLine(
    (await checkedCommand("git", ["merge-base", base, revision], 5_000)).stdout,
  );
  const successorCount = decodeExactLine(
    (await checkedCommand("git", ["rev-list", "--count", range], 5_000)).stdout,
  );
  const firstParentCount = decodeExactLine(
    (
      await checkedCommand(
        "git",
        ["rev-list", "--first-parent", "--count", range],
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
  if (
    mergeBase !== base ||
    successorCount !== "1" ||
    firstParentCount !== "1" ||
    parentLine !== `${revision} ${base}`
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
      return Object.freeze({
        path: match[2].replaceAll("\\", "/"),
        status: match[1] as "A" | "M",
      });
    })
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  if (entries.length === 0) fail();
  return Object.freeze(entries);
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
  const path =
    engine === "node"
      ? "packages/filing-parser-cross-engine-execution/acceptance/node-image.json"
      : "packages/filing-parser-normalization-execution/acceptance/python-image.json";
  const textValue = await readFile(path, "utf8");
  const value = JSON.parse(textValue) as unknown;
  const expected =
    engine === "node"
      ? {
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
          nodeLicenseUrl:
            "https://github.com/nodejs/node/blob/v24.19.0/LICENSE",
          containerPackageLicenseInventoryStatus:
            "not_proven_ci_acceptance_only",
        }
      : {
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
          containerPackageLicenseInventoryStatus:
            "not_proven_ci_acceptance_only",
        };
  if (
    `${JSON.stringify(value, null, 2)}\n` !== textValue ||
    canonicalJson(value) !== canonicalJson(expected)
  )
    fail();
  return engine === "node"
    ? Object.freeze({
        indexDigest: NODE_BASE_INDEX_DIGEST,
        platformManifestDigest: NODE_BASE_PLATFORM_MANIFEST_DIGEST,
      })
    : Object.freeze({
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

/** Historical v2 test seam retained for exact request-limit review. */
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

/** Historical v2 test seam retained for exact Docker-create review. */
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

/** Historical v2 test seam retained for exact created-container review. */
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

/** @internal Exported for fail-closed Docker image inspection tests. */
export function validateBuiltImageInspection(
  value: unknown,
  imageId: `sha256:${string}`,
  expectedProfile: FilingParserCrossEngineImageInspectionProfile,
): void {
  validateImageProfile(expectedProfile);
  if (!Array.isArray(value) || value.length !== 1) fail();
  const image = recordAtLeast(value[0], ["Architecture", "Config", "Id", "Os"]);
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
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW
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
