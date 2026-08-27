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
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  createFilingParserCustodyQualityCompositionProtocol,
  type FilingParserCustodyQualityCompositionCommittedResult,
  type FilingParserCustodyQualityCompositionConfiguration,
  type FilingParserCustodyQualityCompositionEvaluatedResult,
  type FilingParserCustodyQualityCompositionQuarantinedResult,
} from "@research-cockpit/filing-parser-custody-quality-composition";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  filingParserCrossEngineImplementationSha256,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
  type FilingParserCrossEngineExecutionEvidenceTransitionEntry,
  type FilingParserCrossEngineExecutionEvidenceV4ValidationStage,
  type FilingParserCrossEngineExecutionEvidenceV3ValidationStage,
  type FilingParserCrossEngineExecutionEvidenceV2ValidationStage,
  type FilingParserCrossEngineExecutionEvidenceValidationStage,
} from "./filing-parser-cross-engine-execution-evidence";
import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW,
  createFilingParserCrossEngineExecutionEvidenceV5ForAcceptance,
  filingParserCrossEngineExecutionV5RequiredSourcePaths,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5,
  type FilingParserCrossEngineExecutionEvidenceV5CaseId,
  type FilingParserCrossEngineExecutionEvidenceV5CaseOutcome,
  type FilingParserCrossEngineExecutionEvidenceV5Invocation,
  type FilingParserCrossEngineExecutionEvidenceV5ValidationStage,
} from "./filing-parser-cross-engine-execution-evidence-v5";
import { buildCycle2nFilingParserQualityDocuments } from "./test-filing-parser-cross-engine-execution-evidence-builder";

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
  "research-cockpit-filing-parser-cross-engine-execution-v5.json";
const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const MAX_COMMAND_BYTES = 4_194_304;
const CYCLE_2O_TRANSITION_PATH_COUNT = 39;
const CYCLE_2O_TRANSITION_SHA256 =
  "sha256:d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212" as const;

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

const VALIDATION_PHASES = Object.freeze([
  "evidence_validation_root_contract",
  "evidence_validation_timestamps",
  "evidence_validation_claim_tuples",
  "evidence_validation_historical_evidence",
  "evidence_validation_composition_validation",
  "evidence_validation_direct_execution_validation",
  "evidence_validation_case_outcomes",
  "evidence_validation_source_bindings",
  "evidence_validation_quality_bindings",
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
  "quality_setup",
  "quality_success_first",
  "quality_success_second",
  "quality_success_validation",
  "adversarial_declared_reference_digest_mismatch",
  "adversarial_quality_capability_replay",
  "adversarial_reference_content_at_commit",
  "adversarial_original_archive_tamper",
  "adversarial_original_amendment_role_swap",
  "quality_residue",
  "tool_versions",
  "evidence_assembly",
  ...VALIDATION_PHASES,
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

export function filingParserCrossEngineExecutionEvidenceV4ValidationPhase(
  stage: FilingParserCrossEngineExecutionEvidenceV4ValidationStage,
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
    case "composition_validation":
      return "evidence_validation_composition_validation";
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
    case "source_bindings":
      return "evidence_validation_source_bindings";
    case "quality_bindings":
      return "evidence_validation_quality_bindings";
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

export function filingParserCrossEngineExecutionEvidenceV5ValidationPhase(
  stage: FilingParserCrossEngineExecutionEvidenceV5ValidationStage,
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
    case "case_outcomes":
      return "evidence_validation_case_outcomes";
    case "custody_bindings":
      return "evidence_validation_composition_validation";
    case "quality_bindings":
      return "evidence_validation_quality_bindings";
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
  const transition = await exactCycle2oTransition(revision);
  const requiredSourcePaths =
    filingParserCrossEngineExecutionV5RequiredSourcePaths(transition);
  const sourceHashes = await committedSourceHashes(
    revision,
    requiredSourcePaths,
  );
  const fixtureManifestSha256 = requiredSourceHash(
    sourceHashes,
    "fixtures/synthetic/filing-parser-cross-engine-execution/v5/manifest.json",
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
    join(environment.runnerTemp, "filing-quality-composition-"),
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

    markPhase("quality_setup");
    assertCustodyQualityCompositionEvidenceConstants();
    const archives = buildSyntheticFilingParserNormalizationExecutionFixture();
    const quality = buildCycle2nFilingParserQualityDocuments();
    const configuration = Object.freeze({
      nodeSecondary: Object.freeze({
        engineId: NODE_ENGINE_ID,
        imageSha256: nodeImageId,
        implementationSha256: nodeImplementationSha256,
        role: "node-secondary" as const,
      }),
      pythonPrimary: Object.freeze({
        engineId: PYTHON_ENGINE_ID,
        imageSha256: pythonImageId,
        implementationSha256: pythonImplementationSha256,
        role: "python-primary" as const,
      }),
    });

    markPhase("quality_success_first");
    const firstRun = await runQualityEvaluation(
      configuration,
      quality.plan,
      quality.declaredReferenceSha256,
      quality.declaredReference,
      archives.originalArchive,
      archives.amendmentArchive,
    );
    markPhase("quality_success_second");
    const secondRun = await runQualityEvaluation(
      configuration,
      quality.plan,
      quality.declaredReferenceSha256,
      quality.declaredReference,
      archives.originalArchive,
      archives.amendmentArchive,
    );
    markPhase("quality_success_validation");
    const successOutcome = qualitySuccessOutcome(
      firstRun.evaluated,
      secondRun.evaluated,
    );

    markPhase("adversarial_declared_reference_digest_mismatch");
    const mismatchProtocol =
      createFilingParserCustodyQualityCompositionProtocol(configuration);
    const mismatchCommitted = await mismatchProtocol.commit(
      quality.plan,
      quality.declaredReferenceSha256,
      archives.originalArchive,
      archives.amendmentArchive,
    );
    assertQualityCommitted(mismatchCommitted);
    const mismatchedReference = Uint8Array.from(quality.declaredReference);
    const mismatchedIndex = mismatchedReference.length - 1;
    mismatchedReference[mismatchedIndex] =
      (mismatchedReference[mismatchedIndex] ?? 0) ^ 0xff;
    const mismatchResult = mismatchProtocol.reveal(
      mismatchCommitted.capability,
      mismatchedReference,
    );
    const mismatchOutcome = qualityQuarantineOutcome(
      "declared-reference-digest-mismatch",
      mismatchResult,
    );

    markPhase("adversarial_quality_capability_replay");
    const replayProtocol =
      createFilingParserCustodyQualityCompositionProtocol(configuration);
    const replayCommitted = await replayProtocol.commit(
      quality.plan,
      quality.declaredReferenceSha256,
      archives.originalArchive,
      archives.amendmentArchive,
    );
    assertQualityCommitted(replayCommitted);
    const replayFirst = replayProtocol.reveal(
      replayCommitted.capability,
      quality.declaredReference,
    );
    assertQualityEvaluated(replayFirst);
    const replayResult = replayProtocol.reveal(
      replayCommitted.capability,
      quality.declaredReference,
    );
    const replayOutcome = qualityQuarantineOutcome(
      "custody-quality-capability-replay",
      replayResult,
    );

    markPhase("adversarial_reference_content_at_commit");
    const contentAtCommitProtocol =
      createFilingParserCustodyQualityCompositionProtocol(configuration);
    const commitWithUnexpectedArguments: (
      ...values: readonly unknown[]
    ) => ReturnType<typeof contentAtCommitProtocol.commit> =
      contentAtCommitProtocol.commit;
    const contentAtCommit = await Reflect.apply(
      commitWithUnexpectedArguments,
      contentAtCommitProtocol,
      [
        quality.plan,
        quality.declaredReferenceSha256,
        archives.originalArchive,
        archives.amendmentArchive,
        quality.declaredReference,
      ],
    );
    const contentAtCommitOutcome = qualityQuarantineOutcome(
      "reference-content-at-commit",
      contentAtCommit,
    );

    markPhase("adversarial_original_archive_tamper");
    const tamperedOriginal = Uint8Array.from(archives.originalArchive);
    tamperedOriginal[0] = (tamperedOriginal[0] ?? 0) ^ 0xff;
    const tampered = await createFilingParserCustodyQualityCompositionProtocol(
      configuration,
    ).commit(
      quality.plan,
      quality.declaredReferenceSha256,
      tamperedOriginal,
      archives.amendmentArchive,
    );
    const tamperedOutcome = qualityQuarantineOutcome(
      "original-archive-tamper",
      tampered,
    );

    markPhase("adversarial_original_amendment_role_swap");
    const swapped = await createFilingParserCustodyQualityCompositionProtocol(
      configuration,
    ).commit(
      quality.plan,
      quality.declaredReferenceSha256,
      archives.amendmentArchive,
      archives.originalArchive,
    );
    const swappedOutcome = qualityQuarantineOutcome(
      "original-amendment-role-swap",
      swapped,
    );

    if (
      [
        firstRun.committed,
        secondRun.committed,
        mismatchCommitted,
        replayCommitted,
      ].some(
        (result) =>
          result.audit.directExecutionCount !== 1 ||
          result.audit.authenticatedReadbackCount !== 2 ||
          result.audit.stagedArchiveCount !== 2 ||
          result.audit.cleanupCount !== 1 ||
          result.audit.emittedFactCount !== 20 ||
          result.audit.zeroResidue !== true,
      )
    )
      fail();
    markPhase("quality_residue");
    await assertZeroResidue();

    markPhase("tool_versions");
    const tools = await toolVersions();
    const completedAt = new Date().toISOString();
    markPhase("evidence_assembly");
    const outcomes = Object.freeze([
      successOutcome,
      mismatchOutcome,
      replayOutcome,
      contentAtCommitOutcome,
      tamperedOutcome,
      swappedOutcome,
    ] as const);
    const evidence =
      createFilingParserCrossEngineExecutionEvidenceV5ForAcceptance(
        {
          baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
          caseOutcomes: outcomes,
          checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS,
          claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM,
          completedAt,
          custodyValidation: Object.freeze({
            archivePair: "exact_frozen_original_amendment_pair" as const,
            authenticatedReadback:
              "only_owned_readback_enters_cycle2n" as const,
            cleanup: "complete_before_publication" as const,
            outerBindings: "custody_pair_and_unchanged_cycle2n_bound" as const,
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
          evidenceVersion: 5 as const,
          fixtureManifestSha256,
          historicalV1:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
          historicalV2:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
          historicalV3:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
          historicalV4:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY,
          notProven:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN,
          repository: environment.repository,
          revision,
          runtime: Object.freeze({
            authenticatedReadbackCount: 8 as const,
            capabilitiesDropped: Object.freeze(["ALL"] as const),
            custodyCommitCount: 4 as const,
            custodyCleanupCount: 4 as const,
            directExecutionCount: 4 as const,
            engineCount: 2 as const,
            networkMode: "none" as const,
            readOnlyRootFilesystem: true as const,
            successfulEvaluationCount: 3 as const,
            successfulLifecycleReceiptCount: 16 as const,
            zeroResidue: true as const,
          }),
          schemaVersion:
            FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION,
          sourceHashes,
          startedAt,
          status: "passed" as const,
          summary: Object.freeze({
            candidateCommitmentsStable: true as const,
            candidateObservationsStable: true as const,
            custodyBindingsDistinct: true as const,
            evaluatedNotMet: 1 as const,
            measurementStable: true as const,
            quarantined: 5 as const,
            sourceBindingsStable: true as const,
            total: 6 as const,
          }),
          synthetic: true as const,
          tools,
          transition: Object.freeze({
            entries: transition,
            pathCount: transition.length,
          }),
          workflow: Object.freeze({
            artifactName: `filing-parser-cross-engine-execution-evidence-v5-${revision}-${environment.runAttempt}`,
            event: environment.event,
            job: "acceptance" as const,
            ref: environment.ref,
            runAttempt: environment.runAttempt,
            runId: environment.runId,
            workflowName:
              FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW,
          }),
        },
        (stage) => {
          markPhase(
            filingParserCrossEngineExecutionEvidenceV5ValidationPhase(stage),
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
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5(evidence),
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

function assertCustodyQualityCompositionEvidenceConstants(): void {
  if (
    FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION !== "1.0.0" ||
    FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM ||
    canonicalJson(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS) ||
    canonicalJson(FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN) !==
      canonicalJson(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN,
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

async function runQualityEvaluation(
  configuration: FilingParserCustodyQualityCompositionConfiguration,
  plan: Uint8Array,
  declaredReferenceSha256: `sha256:${string}`,
  declaredReference: Uint8Array,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
): Promise<{
  readonly committed: FilingParserCustodyQualityCompositionCommittedResult;
  readonly evaluated: FilingParserCustodyQualityCompositionEvaluatedResult;
}> {
  const protocol =
    createFilingParserCustodyQualityCompositionProtocol(configuration);
  const committed = await protocol.commit(
    plan,
    declaredReferenceSha256,
    originalArchive,
    amendmentArchive,
  );
  assertQualityCommitted(committed);
  const evaluated = protocol.reveal(committed.capability, declaredReference);
  assertQualityEvaluated(evaluated);
  return Object.freeze({ committed, evaluated });
}

function assertQualityCommitted(
  result:
    | FilingParserCustodyQualityCompositionCommittedResult
    | FilingParserCustodyQualityCompositionQuarantinedResult,
): asserts result is FilingParserCustodyQualityCompositionCommittedResult {
  if (
    result.status !== "candidate_committed" ||
    result.claim !== FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM ||
    result.schemaVersion !==
      FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION ||
    result.synthetic !== true ||
    Object.keys(result).sort().join("|") !==
      "audit|candidateCommitmentSha256|candidateObservationsSha256|capability|claim|custody|custodyCompositionCommitmentSha256|declaredReferenceSha256|planSha256|quality|qualityCompositionCommitmentSha256|schemaVersion|status|synthetic" ||
    result.audit.directExecutionCount !== 1 ||
    result.audit.authenticatedReadbackCount !== 2 ||
    result.audit.cleanupCount !== 1 ||
    result.audit.emittedFactCount !== 20 ||
    result.audit.stagedArchiveCount !== 2 ||
    result.audit.zeroResidue !== true ||
    !Object.isFrozen(result) ||
    !Object.isFrozen(result.audit) ||
    !Object.isFrozen(result.capability) ||
    Object.getPrototypeOf(result.capability) !== null ||
    !Object.isFrozen(result.custody) ||
    !Object.isFrozen(result.custody.receipts) ||
    !Object.isFrozen(result.quality) ||
    !Object.isFrozen(result.quality.projectionReceipts) ||
    !Object.isFrozen(result.quality.sourceExecution) ||
    result.custody.receipts.length !== 2 ||
    [
      result.candidateCommitmentSha256,
      result.candidateObservationsSha256,
      result.custody.custodyPairBindingSha256,
      result.custody.sourceContextSha256,
      result.custodyCompositionCommitmentSha256,
      result.declaredReferenceSha256,
      result.planSha256,
      result.qualityCompositionCommitmentSha256,
      ...result.custody.receipts.flatMap((receipt) => [
        receipt.aadSha256,
        receipt.ciphertextSha256,
        receipt.contentSha256,
        receipt.readbackSha256,
        receipt.receiptSha256,
        receipt.sourceBindingSha256,
      ]),
    ].some((value) => !HASH.test(value))
  )
    fail();
}

function assertQualityEvaluated(
  result:
    | FilingParserCustodyQualityCompositionEvaluatedResult
    | FilingParserCustodyQualityCompositionQuarantinedResult,
): asserts result is FilingParserCustodyQualityCompositionEvaluatedResult {
  if (
    result.status !== "evaluated" ||
    result.claim !== FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM ||
    result.schemaVersion !==
      FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION ||
    result.synthetic !== true ||
    Object.keys(result).sort().join("|") !==
      "candidateCommitmentSha256|candidateObservationsSha256|claim|custody|custodyCompositionCommitmentSha256|custodyCompositionEvaluationBindingSha256|declaredReferenceSha256|measurement|planSha256|quality|qualityCompositionCommitmentSha256|qualityCompositionEvaluationBindingSha256|qualityEvaluationBindingSha256|schemaVersion|status|synthetic" ||
    !Object.isFrozen(result) ||
    !Object.isFrozen(result.measurement) ||
    !Object.isFrozen(result.custody) ||
    !Object.isFrozen(result.custody.receipts) ||
    !Object.isFrozen(result.quality) ||
    !Object.isFrozen(result.quality.projectionReceipts) ||
    !Object.isFrozen(result.quality.sourceExecution) ||
    !exactQualityMeasurement(result) ||
    [
      result.candidateCommitmentSha256,
      result.candidateObservationsSha256,
      result.custody.custodyPairBindingSha256,
      result.custody.sourceContextSha256,
      result.custodyCompositionCommitmentSha256,
      result.custodyCompositionEvaluationBindingSha256,
      result.declaredReferenceSha256,
      result.planSha256,
      result.qualityCompositionCommitmentSha256,
      result.qualityCompositionEvaluationBindingSha256,
      result.qualityEvaluationBindingSha256,
      result.measurement.evaluationSha256,
    ].some((value) => !HASH.test(value))
  )
    fail();
}

function exactQualityMeasurement(
  result: FilingParserCustodyQualityCompositionEvaluatedResult,
): boolean {
  return (
    result.measurement.status === "evaluated" &&
    result.measurement.synthetic === true &&
    result.measurement.syntheticPilotThresholdOutcome === "not_met" &&
    canonicalJson(result.measurement.counts) ===
      canonicalJson({
        conceptMismatchCount: 0,
        criticalAssertionCount: 2_000,
        dimensionMismatchCount: 0,
        documentCount: 100,
        emittedFactCount: 20,
        expectedFactCount: 1_000,
        falseNegativeFactCount: 980,
        falsePositiveFactCount: 0,
        missingDocumentCount: 98,
        missingFactCount: 980,
        periodMismatchCount: 0,
        quarantinedDocumentCount: 0,
        semanticAssertionPassCount: 20,
        silentCriticalFailureCount: 1_960,
        succeededDocumentCount: 2,
        truePositiveFactCount: 20,
        unitMismatchCount: 0,
        unitPeriodAssertionPassCount: 20,
        valueMismatchCount: 0,
      }) &&
    canonicalJson(result.measurement.metrics) ===
      canonicalJson({
        documentSuccess: qualityRatio(2, 100, false, 95, "minimum"),
        factPrecision: qualityRatio(20, 20, true, 99, "minimum"),
        factRecall: qualityRatio(20, 1_000, false, 99, "minimum"),
        quarantineRate: qualityRatio(0, 100, true, 5, "maximum"),
        silentCriticalFailure: {
          count: 1_960,
          denominator: 2_000,
          maximumCount: 0,
          met: false,
        },
        unitDateTolerance: {
          dateToleranceDays: 0,
          periodMismatchCount: 0,
          unitMismatchCount: 0,
          unitTolerancePolicy: "exact_canonical_unit.v1",
        },
      }) &&
    canonicalJson(result.measurement.failedThresholds) ===
      canonicalJson([
        "document_success_minimum",
        "fact_recall_minimum",
        "maximum_silent_critical_failures",
      ])
  );
}

function qualityRatio(
  numerator: number,
  denominator: number,
  met: boolean,
  thresholdNumerator: number,
  thresholdKind: "maximum" | "minimum",
): object {
  return {
    defined: true,
    denominator,
    met,
    numerator,
    threshold: { denominator: 100, numerator: thresholdNumerator },
    thresholdKind,
  };
}

function qualitySuccessOutcome(
  first: FilingParserCustodyQualityCompositionEvaluatedResult,
  second: FilingParserCustodyQualityCompositionEvaluatedResult,
): FilingParserCrossEngineExecutionEvidenceV5CaseOutcome {
  assertQualityEvaluated(first);
  assertQualityEvaluated(second);
  const invocations = Object.freeze([
    qualityInvocation(first),
    qualityInvocation(second),
  ] as const);
  if (
    first.candidateCommitmentSha256 !== second.candidateCommitmentSha256 ||
    first.candidateObservationsSha256 !== second.candidateObservationsSha256 ||
    first.measurement.evaluationSha256 !==
      second.measurement.evaluationSha256 ||
    first.qualityEvaluationBindingSha256 !==
      second.qualityEvaluationBindingSha256 ||
    first.planSha256 !== second.planSha256 ||
    first.declaredReferenceSha256 !== second.declaredReferenceSha256 ||
    canonicalJson(first.measurement) !== canonicalJson(second.measurement) ||
    first.custody.sourceContextSha256 !== second.custody.sourceContextSha256 ||
    first.custody.custodyPairBindingSha256 ===
      second.custody.custodyPairBindingSha256 ||
    first.custodyCompositionCommitmentSha256 ===
      second.custodyCompositionCommitmentSha256 ||
    first.custodyCompositionEvaluationBindingSha256 ===
      second.custodyCompositionEvaluationBindingSha256 ||
    first.qualityCompositionCommitmentSha256 ===
      second.qualityCompositionCommitmentSha256 ||
    first.qualityCompositionEvaluationBindingSha256 ===
      second.qualityCompositionEvaluationBindingSha256
  )
    fail();
  for (let index = 0; index < 2; index += 1) {
    const left = first.custody.receipts[index];
    const right = second.custody.receipts[index];
    if (
      left === undefined ||
      right === undefined ||
      left.role !== right.role ||
      left.contentSha256 !== right.contentSha256 ||
      left.readbackSha256 !== right.readbackSha256 ||
      left.sourceBindingSha256 !== right.sourceBindingSha256 ||
      left.aadSha256 !== right.aadSha256 ||
      left.ciphertextSha256 === right.ciphertextSha256 ||
      left.receiptSha256 === right.receiptSha256
    )
      fail();
  }
  return Object.freeze({
    caseId:
      "same-input-custody-quality-evaluation-distinct-custody-invocations" as const,
    expectedStatus: "evaluated_not_met" as const,
    invocations,
    observedStatus: "evaluated_not_met" as const,
  });
}

function qualityInvocation(
  result: FilingParserCustodyQualityCompositionEvaluatedResult,
): FilingParserCrossEngineExecutionEvidenceV5Invocation {
  return Object.freeze({
    audit: Object.freeze({
      authenticatedReadbackCount: 2 as const,
      cleanupCount: 1 as const,
      directExecutionCount: 1 as const,
      emittedFactCount: 20 as const,
      stagedArchiveCount: 2 as const,
      zeroResidue: true as const,
    }),
    candidateCommitmentSha256: result.candidateCommitmentSha256,
    candidateObservationsSha256: result.candidateObservationsSha256,
    custody: result.custody,
    custodyCompositionCommitmentSha256:
      result.custodyCompositionCommitmentSha256,
    custodyCompositionEvaluationBindingSha256:
      result.custodyCompositionEvaluationBindingSha256,
    declaredReferenceSha256: result.declaredReferenceSha256,
    measurement: result.measurement,
    planSha256: result.planSha256,
    quality: result.quality,
    qualityCompositionCommitmentSha256:
      result.qualityCompositionCommitmentSha256,
    qualityCompositionEvaluationBindingSha256:
      result.qualityCompositionEvaluationBindingSha256,
    qualityEvaluationBindingSha256: result.qualityEvaluationBindingSha256,
  });
}

function qualityQuarantineOutcome(
  caseId: Exclude<
    FilingParserCrossEngineExecutionEvidenceV5CaseId,
    "same-input-custody-quality-evaluation-distinct-custody-invocations"
  >,
  result:
    | FilingParserCustodyQualityCompositionCommittedResult
    | FilingParserCustodyQualityCompositionEvaluatedResult
    | FilingParserCustodyQualityCompositionQuarantinedResult,
): FilingParserCrossEngineExecutionEvidenceV5CaseOutcome {
  if (
    result.status !== "quarantined" ||
    result.claim !== FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM ||
    result.code !== "custody_quality_composition_quarantined" ||
    result.schemaVersion !==
      FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION ||
    result.synthetic !== true ||
    !Object.isFrozen(result) ||
    Object.keys(result).sort().join("|") !==
      "claim|code|schemaVersion|status|synthetic"
  )
    fail();
  return Object.freeze({
    caseId,
    expectedStatus: "quarantined" as const,
    invocations: null,
    observedStatus: "quarantined" as const,
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

async function exactCycle2oTransition(
  revision: string,
): Promise<readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[]> {
  return exactOneCommitTransition(
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
    revision,
  );
}

async function exactOneCommitTransition(
  base: string,
  revision: string,
): Promise<readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[]> {
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
      ["diff", "--name-status", "--no-renames", "-z", base, revision, "--"],
      10_000,
      MAX_COMMAND_BYTES,
      65_536,
    )
  ).stdout;
  const entries = parseFilingParserCrossEngineExecutionNulTransition(output);
  if (
    entries.length !== CYCLE_2O_TRANSITION_PATH_COUNT ||
    sha256(output) !== CYCLE_2O_TRANSITION_SHA256
  )
    fail();
  return entries;
}

export function parseFilingParserCrossEngineExecutionNulTransition(
  bytes: Uint8Array,
): readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[] {
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail();
  }
  if (decoded.length === 0 || !decoded.endsWith("\0")) fail();
  const fields = decoded.slice(0, -1).split("\0");
  if (fields.length % 2 !== 0 || fields.some((field) => field.length === 0))
    fail();
  const entries: FilingParserCrossEngineExecutionEvidenceTransitionEntry[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if ((status !== "A" && status !== "M") || path === undefined) fail();
    entries.push(Object.freeze({ path, status }));
  }
  entries.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
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
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW
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
