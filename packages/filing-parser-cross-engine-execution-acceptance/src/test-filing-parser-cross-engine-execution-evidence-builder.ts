import { createHash } from "node:crypto";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_DIRECT_EXECUTION_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  filingParserCrossEngineImplementationSha256,
  filingParserCrossEngineExecutionExpectedTransition,
  filingParserCrossEngineExecutionRequiredSourcePaths,
  filingParserCrossEngineExecutionV2RequiredSourcePaths,
  filingParserCrossEngineExecutionV2AgreementSha256,
  filingParserCrossEngineExecutionV2ExecutionBindingSha256,
  filingParserCrossEngineExecutionV2HandoffPairBindingSha256,
  filingParserCrossEngineExecutionV3InvocationBindingSha256,
  filingParserCrossEngineExecutionV3LifecycleBindingSha256,
  filingParserCrossEngineExecutionV3RequiredSourcePaths,
  filingParserCrossEngineExecutionV4CompositionCommitmentSha256,
  filingParserCrossEngineExecutionV4EvaluationBindingSha256,
  filingParserCrossEngineExecutionV4ProjectionBindingSha256,
  filingParserCrossEngineExecutionV4QualityDocumentSha256,
  filingParserCrossEngineExecutionV4RequiredSourcePaths,
  type FilingParserCrossEngineExecutionEvidence,
  type FilingParserCrossEngineExecutionEvidenceV3,
  type FilingParserCrossEngineExecutionEvidenceV3CaseId,
  type FilingParserCrossEngineExecutionEvidenceV3Invocation,
  type FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt,
  type FilingParserCrossEngineExecutionEvidenceV4,
  type FilingParserCrossEngineExecutionEvidenceV4CaseId,
  type FilingParserCrossEngineExecutionEvidenceV4Invocation,
  type FilingParserCrossEngineExecutionEvidenceV2,
  type FilingParserCrossEngineExecutionEvidenceV2CaseId,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
} from "./filing-parser-cross-engine-execution-evidence";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const HASH_C = `sha256:${"c".repeat(64)}` as const;
const HASH_D = `sha256:${"d".repeat(64)}` as const;
const HASH_E = `sha256:${"e".repeat(64)}` as const;
const HASH_F = `sha256:${"f".repeat(64)}` as const;

export function buildFilingParserCrossEngineExecutionEvidenceInput(): FilingParserCrossEngineExecutionEvidence {
  const transition = filingParserCrossEngineExecutionExpectedTransition();
  const sourcePaths =
    filingParserCrossEngineExecutionRequiredSourcePaths(transition);
  const sourceHashes = Object.freeze(
    sourcePaths.map((path) => Object.freeze({ path, sha256: HASH_A })),
  );
  const pythonSources = implementationSources(
    FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python,
  );
  const nodeSources = implementationSources(
    FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node,
  );
  return {
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
    caseOutcomes: [
      {
        amendmentArchiveSha256: HASH_B,
        agreementSha256: HASH_A,
        caseId: "exact-original-amendment-cross-engine-pair",
        expectedStatus: "agreed",
        factVersionCount: 20,
        lineageCount: 10,
        nodeAmendmentStdoutSha256: HASH_B,
        nodeExecutionBindingSha256: HASH_B,
        nodeOriginalStdoutSha256: HASH_A,
        normalizationSha256: HASH_C,
        observedStatus: "agreed",
        originalArchiveSha256: HASH_A,
        pythonAmendmentStdoutSha256: HASH_B,
        pythonExecutionBindingSha256: HASH_A,
        pythonOriginalStdoutSha256: HASH_A,
        replayMatched: true,
        resultSha256: HASH_C,
      },
      quarantine("cross-engine-normalization-mismatch"),
      quarantine("original-archive-tamper"),
      quarantine("original-amendment-role-swap"),
    ],
    checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS,
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM,
    completedAt: "2026-08-25T18:01:00.000Z",
    engines: [
      {
        architecture: "amd64",
        baseIndexDigest:
          "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
        basePlatformManifestDigest:
          "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
        builtImageId: HASH_A,
        engineId: "python-3.12-primary-v1",
        implementationSha256:
          filingParserCrossEngineImplementationSha256(pythonSources),
        implementationSourceHashes: pythonSources,
        operatingSystem: "linux",
        role: "python-primary",
        runtimeVersion: "Python 3.12.13",
      },
      {
        architecture: "amd64",
        baseIndexDigest:
          "sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df",
        basePlatformManifestDigest:
          "sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174",
        builtImageId: HASH_B,
        engineId: "node-24-secondary-v1",
        implementationSha256:
          filingParserCrossEngineImplementationSha256(nodeSources),
        implementationSourceHashes: nodeSources,
        operatingSystem: "linux",
        role: "node-secondary",
        runtimeVersion: "Node v24.19.0",
      },
    ],
    evidenceVersion: 1,
    failedCorrectiveRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
    failedDiagnosticRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION,
    failedPrecursorRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
    failedRecoveryRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION,
    fixtureManifestSha256: HASH_A,
    notProven: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN,
    repository: "example/research-cockpit",
    revision: "d".repeat(40),
    runtime: {
      auditedContainerCount: 15,
      capabilitiesDropped: ["ALL"],
      containerControlMilliseconds: 5_000,
      containerUser: "65532:65532",
      cpuCount: 0.5,
      engineCount: 2,
      inputMount: "/input/filing.zip:ro",
      memoryBytes: 134_217_728,
      networkMode: "none",
      noNewPrivileges: true,
      noPublishedPorts: true,
      openFiles: 64,
      pids: 32,
      processTerminationMilliseconds: 250,
      productionContainerCount: 9,
      readOnlyRootFilesystem: true,
      signerMilliseconds: 5_000,
      stderrLimitBytes: 4_096,
      stdoutLimitBytes: 262_144,
      successfulPairContainerCount: 4,
      temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608",
      wallClockMilliseconds: 5_000,
      zeroResidue: true,
    },
    schemaVersion: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION,
    sourceHashes,
    startedAt: "2026-08-25T18:00:00.000Z",
    status: "passed",
    summary: { agreed: 1, quarantined: 3, replayMatched: true, total: 4 },
    synthetic: true,
    tools: {
      dockerClient: "Docker version 28.0.4",
      dockerServer: "28.0.4",
      git: "git version 2.51.0",
      node: "v24.19.0",
      pnpm: "11.19.0",
      python: "Python 3.12.13",
    },
    transition: { entries: transition, pathCount: transition.length },
    workflow: {
      artifactName:
        "filing-parser-cross-engine-execution-evidence-v1-dddddddddddddddddddddddddddddddddddddddd-1",
      event: "push",
      job: "acceptance",
      ref: "refs/heads/main",
      runAttempt: 1,
      runId: "123456789",
      workflowName: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW,
    },
  };
}

/** @internal Test-only additive Cycle 2l evidence carrier. */
export function buildFilingParserCrossEngineExecutionEvidenceV2Input(): FilingParserCrossEngineExecutionEvidenceV2 {
  const v1 = buildFilingParserCrossEngineExecutionEvidenceInput();
  const revision = "e".repeat(40);
  const transition = Object.freeze([
    Object.freeze({
      path: "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
      status: "M" as const,
    }),
  ]);
  const sourceHashes = Object.freeze(
    filingParserCrossEngineExecutionV2RequiredSourcePaths(transition).map(
      (path) => Object.freeze({ path, sha256: HASH_A }),
    ),
  );
  const keyId = "cycle2k-ephemeral-ed25519-v1";
  const pythonHandoffPairBindingSha256 =
    filingParserCrossEngineExecutionV2HandoffPairBindingSha256({
      amendmentDocumentSha256: HASH_D,
      amendmentSourceSha256: HASH_B,
      imageSha256: v1.engines[0].builtImageId,
      keyId,
      originalDocumentSha256: HASH_C,
      originalSourceSha256: HASH_A,
      publicKeySpkiSha256: HASH_A,
    });
  const nodeHandoffPairBindingSha256 =
    filingParserCrossEngineExecutionV2HandoffPairBindingSha256({
      amendmentDocumentSha256: HASH_D,
      amendmentSourceSha256: HASH_B,
      imageSha256: v1.engines[1].builtImageId,
      keyId,
      originalDocumentSha256: HASH_C,
      originalSourceSha256: HASH_A,
      publicKeySpkiSha256: HASH_A,
    });
  const pythonExecutionBindingSha256 =
    filingParserCrossEngineExecutionV2ExecutionBindingSha256({
      amendmentDocumentSha256: HASH_D,
      handoffPairBindingSha256: pythonHandoffPairBindingSha256,
      imageSha256: v1.engines[0].builtImageId,
      keyId,
      originalDocumentSha256: HASH_C,
    });
  const nodeExecutionBindingSha256 =
    filingParserCrossEngineExecutionV2ExecutionBindingSha256({
      amendmentDocumentSha256: HASH_D,
      handoffPairBindingSha256: nodeHandoffPairBindingSha256,
      imageSha256: v1.engines[1].builtImageId,
      keyId,
      originalDocumentSha256: HASH_C,
    });
  const agreementSha256 = filingParserCrossEngineExecutionV2AgreementSha256({
    amendmentArchiveSha256: HASH_B,
    engines: [
      {
        engineId: v1.engines[0].engineId,
        executionBindingSha256: pythonExecutionBindingSha256,
        imageSha256: v1.engines[0].builtImageId,
        implementationSha256: v1.engines[0].implementationSha256,
        role: "python-primary",
      },
      {
        engineId: v1.engines[1].engineId,
        executionBindingSha256: nodeExecutionBindingSha256,
        imageSha256: v1.engines[1].builtImageId,
        implementationSha256: v1.engines[1].implementationSha256,
        role: "node-secondary",
      },
    ],
    normalizationSha256: HASH_C,
    originalArchiveSha256: HASH_A,
  });
  return {
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
    bindingValidation: {
      childReceiptArchiveBinding: "recomputed_exact",
      executionBinding: "recomputed_exact",
      handoffPairBinding: "recomputed_exact",
      injectedBoundaryAuthenticity: "not_established",
      inputFactRoleBinding: "validated_exact",
      lineageReciprocity: "validated_exact",
    },
    caseOutcomes: [
      {
        amendmentArchiveSha256: HASH_B,
        amendmentDocumentSha256: HASH_D,
        agreementSha256,
        caseId: "exact-original-amendment-cross-engine-bound-pair",
        expectedStatus: "agreed",
        factVersionCount: 20,
        lineageCount: 10,
        nodeAmendmentStdoutSha256: HASH_D,
        nodeExecutionBindingSha256,
        nodeHandoffPairBindingSha256,
        nodeKeyId: keyId,
        nodeOriginalStdoutSha256: HASH_C,
        nodePublicKeySpkiSha256: HASH_A,
        normalizationSha256: HASH_C,
        observedStatus: "agreed",
        originalArchiveSha256: HASH_A,
        originalDocumentSha256: HASH_C,
        pythonAmendmentStdoutSha256: HASH_D,
        pythonExecutionBindingSha256,
        pythonHandoffPairBindingSha256,
        pythonKeyId: keyId,
        pythonOriginalStdoutSha256: HASH_C,
        pythonPublicKeySpkiSha256: HASH_A,
        replayMatched: true,
        resultSha256: HASH_C,
      },
      quarantineV2("cached-genuine-child-receipts-under-different-archives"),
      quarantineV2("common-mode-lineage-mutation"),
      quarantineV2("cross-engine-normalization-mismatch"),
      quarantineV2("original-archive-tamper"),
      quarantineV2("original-amendment-role-swap"),
    ],
    checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS,
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CLAIM,
    completedAt: v1.completedAt,
    engines: v1.engines,
    evidenceVersion: 2,
    failedPrecursorRevision:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
    failedRun: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
    fixtureManifestSha256: HASH_A,
    historicalV1: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    notProven: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
    repository: v1.repository,
    revision,
    runtime: v1.runtime,
    schemaVersion:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SCHEMA_VERSION,
    sourceHashes,
    startedAt: v1.startedAt,
    status: "passed",
    summary: { agreed: 1, quarantined: 5, replayMatched: true, total: 6 },
    synthetic: true,
    tools: v1.tools,
    transition: { entries: transition, pathCount: transition.length },
    workflow: {
      artifactName: `filing-parser-cross-engine-execution-evidence-v2-${revision}-1`,
      event: "push",
      job: "acceptance",
      ref: "refs/heads/main",
      runAttempt: 1,
      runId: "123456789",
      workflowName: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_WORKFLOW,
    },
  };
}

/** @internal Test-only additive Cycle 2m evidence carrier. */
export function buildFilingParserCrossEngineExecutionEvidenceV3Input(): FilingParserCrossEngineExecutionEvidenceV3 {
  const v1 = buildFilingParserCrossEngineExecutionEvidenceInput();
  const revision = "f".repeat(40);
  const transition = Object.freeze([
    Object.freeze({
      path: "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution.ts",
      status: "A" as const,
    }),
  ]);
  const sourceHashes = Object.freeze(
    filingParserCrossEngineExecutionV3RequiredSourcePaths(transition).map(
      (path) => Object.freeze({ path, sha256: HASH_A }),
    ),
  );
  const first = directInvocation(v1, HASH_A, 0, HASH_E);
  const second = directInvocation(v1, HASH_B, 4, HASH_F);
  return {
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
    caseOutcomes: [
      {
        amendmentArchiveSha256: HASH_B,
        caseId: "same-input-direct-docker-distinct-lifecycle-invocations",
        expectedStatus: "agreed",
        factVersionCount: 20,
        invocationBindingsDistinct: true,
        invocations: [first, second],
        lifecycleBindingsDistinct: true,
        lineageCount: 10,
        normalizationStable: true,
        observedStatus: "agreed",
        originalArchiveSha256: HASH_A,
      },
      quarantineV3("unknown-python-image"),
      quarantineV3("pre-aborted-signal"),
      quarantineV3("original-archive-tamper"),
      quarantineV3("original-amendment-role-swap"),
      quarantineV3("identical-archives"),
    ],
    checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM,
    completedAt: v1.completedAt,
    directExecutionValidation: {
      callerInjectionSurface: "none",
      configurationSnapshot: "intrinsic_closed_exact",
      lifecycleBinding: "recomputed_exact",
      outerInvocationBinding: "recomputed_exact",
      processExecution: "package_owned_bounded_shell_false",
      signer: "internally_generated_ephemeral_ed25519",
    },
    engines: v1.engines,
    evidenceVersion: 3,
    fixtureManifestSha256: HASH_A,
    historicalV1: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    historicalV2: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
    notProven: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
    repository: v1.repository,
    revision,
    runtime: {
      capabilitiesDropped: ["ALL"],
      containerControlMilliseconds: 5_000,
      containerUser: "65532:65532",
      cpuCount: 0.5,
      engineCount: 2,
      inputMount: "/input/filing.zip:ro",
      memoryBytes: 134_217_728,
      networkMode: "none",
      noNewPrivileges: true,
      noPublishedPorts: true,
      openFiles: 64,
      pids: 32,
      processTerminationMilliseconds: 250,
      readOnlyRootFilesystem: true,
      signerMilliseconds: 5_000,
      stderrLimitBytes: 4_096,
      stdoutLimitBytes: 262_144,
      successfulContainerCount: 8,
      successfulInvocationCount: 2,
      successfulLifecycleReceiptCount: 8,
      temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608",
      uniqueContainerIdSha256Count: 8,
      wallClockMilliseconds: 5_000,
      zeroResidue: true,
    },
    schemaVersion:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_SCHEMA_VERSION,
    sourceHashes,
    startedAt: v1.startedAt,
    status: "passed",
    summary: {
      agreed: 1,
      invocationBindingsDistinct: true,
      lifecycleBindingsDistinct: true,
      normalizationStable: true,
      quarantined: 5,
      total: 6,
    },
    synthetic: true,
    tools: v1.tools,
    transition: { entries: transition, pathCount: transition.length },
    workflow: {
      artifactName: `filing-parser-cross-engine-execution-evidence-v3-${revision}-1`,
      event: "push",
      job: "acceptance",
      ref: "refs/heads/main",
      runAttempt: 1,
      runId: "123456789",
      workflowName: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_WORKFLOW,
    },
  };
}

/** @internal Test-only additive Cycle 2n evidence carrier. */
export function buildFilingParserCrossEngineExecutionEvidenceV4Input(): FilingParserCrossEngineExecutionEvidenceV4 {
  const v1 = buildFilingParserCrossEngineExecutionEvidenceInput();
  const revision = "c".repeat(40);
  const transition =
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION;
  const sourceHashes = Object.freeze(
    filingParserCrossEngineExecutionV4RequiredSourcePaths(transition).map(
      (path) => Object.freeze({ path, sha256: HASH_A }),
    ),
  );
  return {
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
    caseOutcomes: [
      {
        candidateCommitmentsStable: true,
        candidateObservationsStable: true,
        caseId: "same-input-quality-evaluation-distinct-lifecycle-invocations",
        compositionBindingsDistinct: true,
        expectedStatus: "evaluated_not_met",
        invocations: [qualityInvocation(0), qualityInvocation(1)],
        lifecycleBindingsDistinct: true,
        measurementStable: true,
        observedStatus: "evaluated_not_met",
      },
      quarantineV4("declared-reference-digest-mismatch"),
      quarantineV4("quality-capability-replay"),
      quarantineV4("reference-content-at-commit"),
      quarantineV4("original-archive-tamper"),
      quarantineV4("original-amendment-role-swap"),
    ],
    checksPassed: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS,
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CLAIM,
    completedAt: v1.completedAt,
    compositionValidation: {
      callerInjectionSurface: "none",
      candidatePopulation: "exact_two_observed_ninety_eight_omitted",
      outerBindings: "recomputed_exact",
      precommitment: "one_shot_reference_digest_only",
      qualityEvaluation: "fixed_denominator_evaluated_not_met",
      sourceExecution: "cycle2m_source_owned_direct_docker",
    },
    engines: v1.engines,
    evidenceVersion: 4,
    fixtureManifestSha256: HASH_A,
    historicalV1: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    historicalV2: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
    historicalV3: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
    notProven: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN,
    repository: v1.repository,
    revision,
    runtime: {
      capabilitiesDropped: ["ALL"],
      compositionCommitCount: 4,
      engineCount: 2,
      networkMode: "none",
      readOnlyRootFilesystem: true,
      successfulEvaluationCount: 3,
      successfulLifecycleReceiptCount: 16,
      successfulTwoDocumentObservationCount: 4,
      zeroResidue: true,
    },
    schemaVersion:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_SCHEMA_VERSION,
    sourceHashes,
    startedAt: v1.startedAt,
    status: "passed",
    summary: {
      candidateCommitmentsStable: true,
      candidateObservationsStable: true,
      compositionBindingsDistinct: true,
      evaluatedNotMet: 1,
      lifecycleBindingsDistinct: true,
      measurementStable: true,
      quarantined: 5,
      total: 6,
    },
    synthetic: true,
    tools: v1.tools,
    transition: { entries: transition, pathCount: transition.length },
    workflow: {
      artifactName: `filing-parser-cross-engine-execution-evidence-v4-${revision}-1`,
      event: "push",
      job: "acceptance",
      ref: "refs/heads/main",
      runAttempt: 1,
      runId: "123456789",
      workflowName: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_WORKFLOW,
    },
  };
}

function qualityInvocation(
  invocationIndex: 0 | 1,
): FilingParserCrossEngineExecutionEvidenceV4Invocation {
  const qualityDocuments = buildCycle2nFilingParserQualityDocuments();
  const planSha256 = cycle2nQualitySha256(qualityDocuments.plan);
  const declaredReferenceSha256 = qualityDocuments.declaredReferenceSha256;
  const qualityAccounting = exactQualityAccounting();
  const innerBindings = cycle2nInnerBindings(
    planSha256,
    declaredReferenceSha256,
    qualityAccounting,
  );
  const lifecycleBindingSha256s = Object.freeze(
    [0, 1, 2, 3].map((offset) =>
      numberedHash(invocationIndex * 4 + offset + 1),
    ),
  ) as unknown as readonly [
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
    `sha256:${string}`,
  ];
  const sourceExecution = Object.freeze({
    agreementSha256: numberedHash(50 + invocationIndex),
    directExecutionClaim:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CLAIM,
    directExecutionSchemaVersion:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_DIRECT_EXECUTION_SCHEMA_VERSION,
    ephemeralPublicKeySpkiSha256: numberedHash(21 + invocationIndex),
    executionMode: "source_owned_direct_docker" as const,
    invocationBindingSha256: numberedHash(23 + invocationIndex),
    lifecycleBindingSha256s,
    normalizationSha256: numberedHash(25),
  });
  const originalPreimage = Object.freeze({
    documentRole: "original" as const,
    factCount: 10 as const,
    observationSha256: cycle2nCandidateObservationSha256(0),
    qualityDocumentId: "synthetic-filing-0001" as const,
    qualityDocumentSha256:
      filingParserCrossEngineExecutionV4QualityDocumentSha256(
        "synthetic-filing-0001",
      ),
    sourceArchiveSha256: numberedHash(38),
    sourceDocumentSha256: numberedHash(39),
    sourceLifecycleBindingSha256s: Object.freeze([
      lifecycleBindingSha256s[0],
      lifecycleBindingSha256s[2],
    ] as const),
  });
  const amendmentPreimage = Object.freeze({
    documentRole: "amendment" as const,
    factCount: 10 as const,
    observationSha256: cycle2nCandidateObservationSha256(1),
    qualityDocumentId: "synthetic-filing-0002" as const,
    qualityDocumentSha256:
      filingParserCrossEngineExecutionV4QualityDocumentSha256(
        "synthetic-filing-0002",
      ),
    sourceArchiveSha256: numberedHash(43),
    sourceDocumentSha256: numberedHash(44),
    sourceLifecycleBindingSha256s: Object.freeze([
      lifecycleBindingSha256s[1],
      lifecycleBindingSha256s[3],
    ] as const),
  });
  const projectionReceipts = Object.freeze([
    Object.freeze({
      ...originalPreimage,
      projectionBindingSha256:
        filingParserCrossEngineExecutionV4ProjectionBindingSha256(
          originalPreimage,
        ),
    }),
    Object.freeze({
      ...amendmentPreimage,
      projectionBindingSha256:
        filingParserCrossEngineExecutionV4ProjectionBindingSha256(
          amendmentPreimage,
        ),
    }),
  ] as const);
  const common = Object.freeze({
    candidateCommitmentSha256: innerBindings.candidateCommitmentSha256,
    candidateObservationsSha256: innerBindings.candidateObservationsSha256,
    declaredReferenceSha256,
    planSha256,
    projectionReceipts,
    sourceExecution,
  });
  const compositionCommitmentSha256 =
    filingParserCrossEngineExecutionV4CompositionCommitmentSha256(common);
  const evaluationPreimage = Object.freeze({
    candidateCommitmentSha256: common.candidateCommitmentSha256,
    compositionCommitmentSha256,
    declaredReferenceSha256: common.declaredReferenceSha256,
    measurementEvaluationSha256: innerBindings.measurementEvaluationSha256,
    qualityEvaluationBindingSha256:
      innerBindings.qualityEvaluationBindingSha256,
  });
  return Object.freeze({
    ...common,
    compositionCommitmentSha256,
    evaluationBindingSha256:
      filingParserCrossEngineExecutionV4EvaluationBindingSha256(
        evaluationPreimage,
      ),
    measurementEvaluationSha256: evaluationPreimage.measurementEvaluationSha256,
    qualityAccounting,
    qualityEvaluationBindingSha256:
      evaluationPreimage.qualityEvaluationBindingSha256,
  });
}

function exactQualityAccounting(): FilingParserCrossEngineExecutionEvidenceV4Invocation["qualityAccounting"] {
  return Object.freeze({
    counts: Object.freeze({
      conceptMismatchCount: 0 as const,
      criticalAssertionCount: 2_000 as const,
      dimensionMismatchCount: 0 as const,
      documentCount: 100 as const,
      emittedFactCount: 20 as const,
      expectedFactCount: 1_000 as const,
      falseNegativeFactCount: 980 as const,
      falsePositiveFactCount: 0 as const,
      missingDocumentCount: 98 as const,
      missingFactCount: 980 as const,
      periodMismatchCount: 0 as const,
      quarantinedDocumentCount: 0 as const,
      semanticAssertionPassCount: 20 as const,
      silentCriticalFailureCount: 1_960 as const,
      succeededDocumentCount: 2 as const,
      truePositiveFactCount: 20 as const,
      unitMismatchCount: 0 as const,
      unitPeriodAssertionPassCount: 20 as const,
      valueMismatchCount: 0 as const,
    }),
    failedThresholds: Object.freeze([
      "document_success_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ] as const),
    metrics: Object.freeze({
      documentSuccess: ratioMetric(2, 100, false, 95, "minimum"),
      factPrecision: ratioMetric(20, 20, true, 99, "minimum"),
      factRecall: ratioMetric(20, 1_000, false, 99, "minimum"),
      quarantineRate: ratioMetric(0, 100, true, 5, "maximum"),
      silentCriticalFailure: Object.freeze({
        count: 1_960 as const,
        denominator: 2_000 as const,
        maximumCount: 0 as const,
        met: false as const,
      }),
      unitDateTolerance: Object.freeze({
        dateToleranceDays: 0 as const,
        periodMismatchCount: 0 as const,
        unitMismatchCount: 0 as const,
        unitTolerancePolicy: "exact_canonical_unit.v1" as const,
      }),
    }),
    syntheticPilotThresholdOutcome: "not_met" as const,
  });
}

function cycle2nCandidateDocument(index: 0 | 1): object {
  const documentId =
    index === 0 ? "synthetic-filing-0001" : "synthetic-filing-0002";
  const values =
    index === 0 ? CYCLE2N_ORIGINAL_VALUES : CYCLE2N_AMENDMENT_VALUES;
  return {
    documentId,
    documentSha256: cycle2nQualityDocumentSha256(documentId),
    facts: CYCLE2N_FACT_KEYS.map((factKey) => {
      const contract = CYCLE2N_FACT_CONTRACTS[factKey];
      return {
        concept: contract.concept,
        dimensions: [],
        factKey,
        periodEnd: "2025-12-31",
        periodStart: contract.periodStart,
        unit: contract.unit,
        value: values[factKey],
      };
    }),
    status: "succeeded",
  };
}

function cycle2nCandidateObservationSha256(index: 0 | 1): `sha256:${string}` {
  return cycle2nQualitySha256(
    new TextEncoder().encode(
      canonicalCycle2nJson(cycle2nCandidateDocument(index)),
    ),
  );
}

function cycle2nInnerBindings(
  planSha256: `sha256:${string}`,
  declaredReferenceSha256: `sha256:${string}`,
  qualityAccounting: FilingParserCrossEngineExecutionEvidenceV4Invocation["qualityAccounting"],
): Readonly<{
  candidateCommitmentSha256: `sha256:${string}`;
  candidateObservationsSha256: `sha256:${string}`;
  measurementEvaluationSha256: `sha256:${string}`;
  qualityEvaluationBindingSha256: `sha256:${string}`;
}> {
  const documentObservations = [
    cycle2nCandidateDocument(0),
    cycle2nCandidateDocument(1),
  ];
  const commonCandidate = {
    candidateDeclaration: CYCLE2N_DECLARED_CANDIDATE,
    declaredReferenceSha256,
    documentObservations,
    planSha256,
    populationId: "synthetic-filing-quality-reference.v1",
    populationVersion: "1.0.0",
    schemaVersion: "1.0.0",
    synthetic: true,
  };
  const candidateObservationsSha256 = cycle2nQualitySha256(
    canonicalCycle2nQualityDocument({
      ...commonCandidate,
      documentRole: "candidate_observations_precommit",
    }),
  );
  const candidateCommitmentSha256 = cycle2nDomainCanonicalSha256(
    "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000",
    {
      candidateObservationsSha256,
      claim:
        "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation",
      declaredReferenceSha256,
      planSha256,
      schemaVersion: "1.0.0",
    },
    true,
  );
  const measurementCandidateSha256 = cycle2nQualitySha256(
    canonicalCycle2nQualityDocument({
      ...commonCandidate,
      documentRole: "candidate_observations",
      producedAt: "2026-01-03T00:00:00.000Z",
    }),
  );
  const measurementEvaluationSha256 = cycle2nDomainCanonicalSha256(
    "research-cockpit:synthetic-filing-quality-measurement:v1\u0000",
    {
      candidateSha256: measurementCandidateSha256,
      counts: qualityAccounting.counts,
      declaredReferenceSha256,
      failedThresholds: qualityAccounting.failedThresholds,
      planSha256,
      syntheticPilotThresholdOutcome:
        qualityAccounting.syntheticPilotThresholdOutcome,
    },
    false,
  );
  const qualityEvaluationBindingSha256 = cycle2nDomainCanonicalSha256(
    "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000",
    {
      candidateCommitmentSha256,
      candidateObservationsSha256,
      measurementEvaluationSha256,
      planSha256,
    },
    true,
  );
  return Object.freeze({
    candidateCommitmentSha256,
    candidateObservationsSha256,
    measurementEvaluationSha256,
    qualityEvaluationBindingSha256,
  });
}

function cycle2nDomainCanonicalSha256(
  domain: string,
  value: unknown,
  newline: boolean,
): `sha256:${string}` {
  const hash = createHash("sha256");
  hash.update(domain, "utf8");
  hash.update(`${canonicalCycle2nJson(value)}${newline ? "\n" : ""}`, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function ratioMetric<
  const Numerator extends number,
  const Denominator extends number,
  const Met extends boolean,
  const ThresholdNumerator extends number,
  const ThresholdKind extends "maximum" | "minimum",
>(
  numerator: Numerator,
  denominator: Denominator,
  met: Met,
  thresholdNumerator: ThresholdNumerator,
  thresholdKind: ThresholdKind,
) {
  return Object.freeze({
    defined: true as const,
    denominator,
    met,
    numerator,
    threshold: Object.freeze({
      denominator: 100 as const,
      numerator: thresholdNumerator,
    }),
    thresholdKind,
  });
}

function quarantineV4(
  caseId: Exclude<
    FilingParserCrossEngineExecutionEvidenceV4CaseId,
    "same-input-quality-evaluation-distinct-lifecycle-invocations"
  >,
) {
  return {
    candidateCommitmentsStable: false,
    candidateObservationsStable: false,
    caseId,
    compositionBindingsDistinct: false,
    expectedStatus: "quarantined" as const,
    invocations: null,
    lifecycleBindingsDistinct: false,
    measurementStable: false,
    observedStatus: "quarantined" as const,
  };
}

function numberedHash(value: number): `sha256:${string}` {
  return `sha256:${value.toString(16).padStart(64, "0")}`;
}

export interface Cycle2nFilingParserQualityDocuments {
  readonly declaredReference: Uint8Array;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly plan: Uint8Array;
}

const CYCLE2N_FACT_KEYS = Object.freeze([
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
type Cycle2nFactKey = (typeof CYCLE2N_FACT_KEYS)[number];
const CYCLE2N_ORIGINAL_VALUES: Readonly<Record<Cycle2nFactKey, string>> =
  Object.freeze({
    assets: "250000000",
    cash: "24000000",
    debt: "40000000",
    diluted_shares: "25000000",
    free_cash_flow: "15000000",
    gross_profit: "60000000",
    net_income: "12000000",
    operating_cash_flow: "20000000",
    operating_income: "18000000",
    revenue: "120000000",
  });
const CYCLE2N_AMENDMENT_VALUES: Readonly<Record<Cycle2nFactKey, string>> =
  Object.freeze({
    assets: "250000000",
    cash: "24000000",
    debt: "40000000",
    diluted_shares: "25000000",
    free_cash_flow: "14000000",
    gross_profit: "57000000",
    net_income: "10000000",
    operating_cash_flow: "20000000",
    operating_income: "16000000",
    revenue: "116400000",
  });
const CYCLE2N_FACT_CONTRACTS = Object.freeze({
  assets: Object.freeze({
    concept: "rc-synthetic:Assets",
    periodStart: null,
    unit: "USD",
  }),
  cash: Object.freeze({
    concept: "rc-synthetic:CashAndCashEquivalents",
    periodStart: null,
    unit: "USD",
  }),
  debt: Object.freeze({
    concept: "rc-synthetic:Debt",
    periodStart: null,
    unit: "USD",
  }),
  diluted_shares: Object.freeze({
    concept: "rc-synthetic:WeightedAverageDilutedShares",
    periodStart: "2025-01-01",
    unit: "shares",
  }),
  free_cash_flow: Object.freeze({
    concept: "rc-synthetic:FreeCashFlow",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  gross_profit: Object.freeze({
    concept: "rc-synthetic:GrossProfit",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  net_income: Object.freeze({
    concept: "rc-synthetic:NetIncome",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  operating_cash_flow: Object.freeze({
    concept: "rc-synthetic:OperatingCashFlow",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  operating_income: Object.freeze({
    concept: "rc-synthetic:OperatingIncome",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  revenue: Object.freeze({
    concept: "rc-synthetic:Revenue",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
} satisfies Readonly<
  Record<
    Cycle2nFactKey,
    Readonly<{ concept: string; periodStart: string | null; unit: string }>
  >
>);
const CYCLE2N_DECLARED_ADJUDICATORS = Object.freeze([
  Object.freeze({
    declarationSha256:
      "sha256:2e13475902f4e9a22a4b7c74b4bf07a4104fc91349909b32105f17750ce91d1c",
    id: "synthetic-filing-quality-adjudicator-a",
    role: "declared-adjudicator-a",
    version: "1.0.0",
  }),
  Object.freeze({
    declarationSha256:
      "sha256:11525b220ae5b8bc1c28a8cf9398b870c210008f96835062c1ef02016ad25a47",
    id: "synthetic-filing-quality-adjudicator-b",
    role: "declared-adjudicator-b",
    version: "1.0.0",
  }),
] as const);
const CYCLE2N_DECLARED_CANDIDATE = Object.freeze({
  declarationSha256:
    "sha256:c254e5f327be470a72f9feb206a7c34341b5020cf425592199a17fb4122e4b2a",
  id: "synthetic-filing-quality-candidate",
  role: "declared-candidate",
  version: "1.0.0",
} as const);

/** Source-controlled Cycle 2n plan/reference; only documents 0001/0002 match Cycle 2m. */
export function buildCycle2nFilingParserQualityDocuments(): Cycle2nFilingParserQualityDocuments {
  const plan = canonicalCycle2nQualityDocument({
    assertionKinds: ["semantic_value_presence", "exact_unit_period"],
    assertionTarget: 2_000,
    candidateStatuses: ["quarantined", "succeeded"],
    declaredAdjudicators: CYCLE2N_DECLARED_ADJUDICATORS,
    declaredCandidate: CYCLE2N_DECLARED_CANDIDATE,
    documentRole: "synthetic_pilot_plan",
    documentTarget: 100,
    factKeys: CYCLE2N_FACT_KEYS,
    factTarget: 1_000,
    frozenAt: "2026-01-01T00:00:00.000Z",
    metrics: [
      "document_success",
      "fact_precision",
      "fact_recall",
      "unit_date_tolerance",
      "silent_critical_failure",
      "quarantine_rate",
    ],
    planId: "synthetic-filing-quality-plan.v1",
    planVersion: "1.0.0",
    referenceDeclaration:
      "declared_synthetic_reference_not_independently_adjudicated",
    schemaVersion: "1.0.0",
    synthetic: true,
    thresholds: {
      dateToleranceDays: 0,
      documentSuccessMinimum: "0.95",
      factPrecisionMinimum: "0.99",
      factRecallMinimum: "0.99",
      maximumQuarantineRate: "0.05",
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  });
  const planSha256 = cycle2nQualitySha256(plan);
  const documents = Array.from({ length: 100 }, (_, index) => {
    const ordinal = index + 1;
    const documentId = `synthetic-filing-${String(ordinal).padStart(4, "0")}`;
    const values =
      ordinal === 1
        ? CYCLE2N_ORIGINAL_VALUES
        : ordinal === 2
          ? CYCLE2N_AMENDMENT_VALUES
          : undefined;
    return Object.freeze({
      documentId,
      documentSha256: cycle2nQualityDocumentSha256(documentId),
      facts: Object.freeze(
        CYCLE2N_FACT_KEYS.map((factKey, factIndex) => {
          const contract = CYCLE2N_FACT_CONTRACTS[factKey];
          return Object.freeze({
            concept: contract.concept,
            dimensions: Object.freeze([] as const),
            factKey,
            periodEnd: "2025-12-31",
            periodStart: contract.periodStart,
            unit: contract.unit,
            value:
              values?.[factKey] ??
              String(1_000_000 + ordinal * 100 + factIndex),
          });
        }),
      ),
    });
  });
  const declaredReference = canonicalCycle2nQualityDocument({
    criticalAssertionCount: 2_000,
    declaredAdjudicators: CYCLE2N_DECLARED_ADJUDICATORS,
    declaredAt: "2026-01-02T00:00:00.000Z",
    declaration: "declared_synthetic_reference_not_independently_adjudicated",
    documentCount: 100,
    documentRole: "declared_reference",
    documents,
    factCount: 1_000,
    populationId: "synthetic-filing-quality-reference.v1",
    populationVersion: "1.0.0",
    planSha256,
    schemaVersion: "1.0.0",
    synthetic: true,
  });
  return Object.freeze({
    declaredReference,
    declaredReferenceSha256: cycle2nQualitySha256(declaredReference),
    plan,
  });
}

function canonicalCycle2nQualityDocument(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalCycle2nJson(value)}\n`);
}

function cycle2nQualityDocumentSha256(documentId: string): `sha256:${string}` {
  const hash = createHash("sha256");
  hash.update(
    "research-cockpit:synthetic-filing-quality-document:v1\u0000",
    "utf8",
  );
  hash.update(documentId, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function cycle2nQualitySha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalCycle2nJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalCycle2nJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalCycle2nJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

function directInvocation(
  v1: FilingParserCrossEngineExecutionEvidence,
  publicKeySpkiSha256: `sha256:${string}`,
  containerOffset: number,
  resultSha256: `sha256:${string}`,
): FilingParserCrossEngineExecutionEvidenceV3Invocation {
  const keyId = "cycle2m-ephemeral-ed25519-v1";
  const agreementEngines = directAgreementEngines(
    v1,
    publicKeySpkiSha256,
    keyId,
  );
  const agreementSha256 = filingParserCrossEngineExecutionV2AgreementSha256({
    amendmentArchiveSha256: HASH_B,
    engines: agreementEngines,
    normalizationSha256: HASH_C,
    originalArchiveSha256: HASH_A,
  });
  const lifecycleReceipts = Object.freeze([
    directLifecycle(
      v1.engines[0],
      "original",
      HASH_A,
      HASH_C,
      publicKeySpkiSha256,
      containerOffset,
    ),
    directLifecycle(
      v1.engines[0],
      "amendment",
      HASH_B,
      HASH_D,
      publicKeySpkiSha256,
      containerOffset + 1,
    ),
    directLifecycle(
      v1.engines[1],
      "original",
      HASH_A,
      HASH_C,
      publicKeySpkiSha256,
      containerOffset + 2,
    ),
    directLifecycle(
      v1.engines[1],
      "amendment",
      HASH_B,
      HASH_D,
      publicKeySpkiSha256,
      containerOffset + 3,
    ),
  ] as const);
  const invocationBindingSha256 =
    filingParserCrossEngineExecutionV3InvocationBindingSha256({
      agreementSha256,
      executionMode: "source_owned_direct_docker",
      keyId,
      lifecycleReceipts,
      normalizationSha256: HASH_C,
      publicKeySpkiSha256,
    });
  return Object.freeze({
    agreementEngines,
    agreementSha256,
    executionMode: "source_owned_direct_docker" as const,
    invocationBindingSha256,
    keyId,
    lifecycleReceipts,
    normalizationSha256: HASH_C,
    publicKeySpkiSha256,
    resultSha256,
  });
}

function directAgreementEngines(
  v1: FilingParserCrossEngineExecutionEvidence,
  publicKeySpkiSha256: `sha256:${string}`,
  keyId: string,
): FilingParserCrossEngineExecutionEvidenceV3Invocation["agreementEngines"] {
  const pairBindings = v1.engines.map((engine) =>
    filingParserCrossEngineExecutionV2HandoffPairBindingSha256({
      amendmentDocumentSha256: HASH_D,
      amendmentSourceSha256: HASH_B,
      imageSha256: engine.builtImageId,
      keyId,
      originalDocumentSha256: HASH_C,
      originalSourceSha256: HASH_A,
      publicKeySpkiSha256,
    }),
  );
  return Object.freeze([
    {
      engineId: v1.engines[0].engineId,
      executionBindingSha256:
        filingParserCrossEngineExecutionV2ExecutionBindingSha256({
          amendmentDocumentSha256: HASH_D,
          handoffPairBindingSha256: pairBindings[0] as `sha256:${string}`,
          imageSha256: v1.engines[0].builtImageId,
          keyId,
          originalDocumentSha256: HASH_C,
        }),
      imageSha256: v1.engines[0].builtImageId,
      implementationSha256: v1.engines[0].implementationSha256,
      role: "python-primary" as const,
    },
    {
      engineId: v1.engines[1].engineId,
      executionBindingSha256:
        filingParserCrossEngineExecutionV2ExecutionBindingSha256({
          amendmentDocumentSha256: HASH_D,
          handoffPairBindingSha256: pairBindings[1] as `sha256:${string}`,
          imageSha256: v1.engines[1].builtImageId,
          keyId,
          originalDocumentSha256: HASH_C,
        }),
      imageSha256: v1.engines[1].builtImageId,
      implementationSha256: v1.engines[1].implementationSha256,
      role: "node-secondary" as const,
    },
  ]);
}

function directLifecycle(
  engine: FilingParserCrossEngineExecutionEvidence["engines"][number],
  documentRole: "amendment" | "original",
  archiveSha256: `sha256:${string}`,
  documentSha256: `sha256:${string}`,
  publicKeySpkiSha256: `sha256:${string}`,
  containerIndex: number,
): FilingParserCrossEngineExecutionEvidenceV3LifecycleReceipt {
  const preimage = Object.freeze({
    archiveSha256,
    containerIdSha256: `sha256:${(containerIndex + 1).toString(16).repeat(64)}`,
    documentRole,
    documentSha256,
    engineId: engine.engineId,
    imageSha256: engine.builtImageId,
    implementationSha256: engine.implementationSha256,
    keyId: "cycle2m-ephemeral-ed25519-v1",
    publicKeySpkiSha256,
    role: engine.role,
    zeroResidue: true as const,
  });
  return Object.freeze({
    ...preimage,
    lifecycleBindingSha256:
      filingParserCrossEngineExecutionV3LifecycleBindingSha256(preimage),
  });
}

function quarantineV3(
  caseId: Exclude<
    FilingParserCrossEngineExecutionEvidenceV3CaseId,
    "same-input-direct-docker-distinct-lifecycle-invocations"
  >,
) {
  return {
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
  };
}

function implementationSources(
  paths: readonly string[],
): readonly FilingParserCrossEngineExecutionEvidenceSourceHash[] {
  return Object.freeze(
    paths.map((path) => Object.freeze({ path, sha256: HASH_A })),
  );
}

function quarantine(
  caseId:
    | "cross-engine-normalization-mismatch"
    | "original-amendment-role-swap"
    | "original-archive-tamper",
) {
  return {
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
  };
}

function quarantineV2(
  caseId: Exclude<
    FilingParserCrossEngineExecutionEvidenceV2CaseId,
    "exact-original-amendment-cross-engine-bound-pair"
  >,
) {
  return {
    ...quarantine("cross-engine-normalization-mismatch"),
    amendmentDocumentSha256: null,
    caseId,
    nodeHandoffPairBindingSha256: null,
    nodeKeyId: null,
    nodePublicKeySpkiSha256: null,
    originalDocumentSha256: null,
    pythonHandoffPairBindingSha256: null,
    pythonKeyId: null,
    pythonPublicKeySpkiSha256: null,
  };
}
