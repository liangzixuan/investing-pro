import {
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS,
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW,
  type FilingParserNormalizationExecutionEvidence,
} from "./filing-parser-normalization-execution-evidence";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;

export function buildFilingParserNormalizationExecutionEvidenceInput(): FilingParserNormalizationExecutionEvidence {
  return {
    caseOutcomes: [
      {
        amendmentArchiveSha256: HASH_A,
        amendmentDocumentSha256: HASH_B,
        caseId: "exact-original-amendment-pair",
        expectedStatus: "normalized",
        factVersionCount: 20,
        lineageCount: 10,
        observedStatus: "normalized",
        originalArchiveSha256: HASH_A,
        originalDocumentSha256: HASH_B,
        pairBindingSha256: HASH_A,
        replayMatched: true,
        resultSha256: HASH_B,
      },
      quarantine("original-archive-tamper"),
      quarantine("original-amendment-role-swap"),
    ],
    checksPassed: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CHECKS,
    claim: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_CLAIM,
    completedAt: "2026-08-25T16:01:00.000Z",
    evidenceVersion: 1,
    fixtureManifestSha256: HASH_A,
    image: {
      architecture: "amd64",
      baseIndexDigest:
        "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
      basePlatformManifestDigest:
        "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
      builtImageId: HASH_B,
      operatingSystem: "linux",
      pythonVersion: "3.12.13",
    },
    notProven: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_NOT_PROVEN,
    repository: "example/research-cockpit",
    revision: "a".repeat(40),
    runtime: {
      capabilitiesDropped: ["ALL"],
      containerControlMilliseconds: 5_000,
      containerCount: 2,
      containerUser: "65532:65532",
      cpuCount: 0.5,
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
      temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608",
      wallClockMilliseconds: 5_000,
      zeroResidue: true,
    },
    schemaVersion:
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SCHEMA_VERSION,
    sourceHashes:
      FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS.map(
        (path) => ({ path, sha256: HASH_A }),
      ),
    startedAt: "2026-08-25T16:00:00.000Z",
    status: "passed",
    summary: {
      normalized: 1,
      quarantined: 2,
      replayMatched: true,
      total: 3,
    },
    synthetic: true,
    tools: {
      dockerClient: "29.0.0",
      dockerServer: "29.0.0",
      git: "git version 2.51.0",
      node: "v24.19.0",
      pnpm: "11.19.0",
      python: "Python 3.12.13",
    },
    workflow: {
      event: "push",
      job: "acceptance",
      ref: "refs/heads/main",
      runAttempt: 1,
      runId: "123456789",
      workflowName: FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_WORKFLOW,
    },
  };
}

function quarantine(
  caseId: "original-amendment-role-swap" | "original-archive-tamper",
) {
  return {
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
    resultSha256: HASH_B,
  };
}
