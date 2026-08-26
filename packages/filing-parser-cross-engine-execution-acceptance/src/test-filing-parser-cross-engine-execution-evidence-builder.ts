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
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  filingParserCrossEngineImplementationSha256,
  filingParserCrossEngineExecutionExpectedTransition,
  filingParserCrossEngineExecutionRequiredSourcePaths,
  filingParserCrossEngineExecutionV2RequiredSourcePaths,
  filingParserCrossEngineExecutionV2AgreementSha256,
  filingParserCrossEngineExecutionV2ExecutionBindingSha256,
  filingParserCrossEngineExecutionV2HandoffPairBindingSha256,
  type FilingParserCrossEngineExecutionEvidence,
  type FilingParserCrossEngineExecutionEvidenceV2,
  type FilingParserCrossEngineExecutionEvidenceV2CaseId,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
} from "./filing-parser-cross-engine-execution-evidence";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const HASH_C = `sha256:${"c".repeat(64)}` as const;
const HASH_D = `sha256:${"d".repeat(64)}` as const;

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
