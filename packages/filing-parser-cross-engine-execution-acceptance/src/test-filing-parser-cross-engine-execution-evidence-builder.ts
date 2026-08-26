import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_WORKFLOW,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  filingParserCrossEngineImplementationSha256,
  filingParserCrossEngineExecutionExpectedTransition,
  filingParserCrossEngineExecutionRequiredSourcePaths,
  type FilingParserCrossEngineExecutionEvidence,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
} from "./filing-parser-cross-engine-execution-evidence";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const HASH_C = `sha256:${"c".repeat(64)}` as const;

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
