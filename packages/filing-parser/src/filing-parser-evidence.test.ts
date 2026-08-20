import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_EVIDENCE_CHECKS,
  FILING_PARSER_EVIDENCE_CLAIM,
  FILING_PARSER_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_EVIDENCE_SOURCE_PATHS,
  FILING_PARSER_EVIDENCE_WORKFLOW,
  createFilingParserEvidence,
  filingParserEvidenceSha256,
  parseCanonicalFilingParserEvidence,
  serializeCanonicalFilingParserEvidence,
  validateFilingParserContainerInspection,
  type FilingParserEvidenceInput,
} from "./filing-parser-evidence";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;

describe("filing parser evidence v1", () => {
  it("freezes the exact claim, 16 checks, 16 nonclaims, and 26 source blobs", () => {
    expect(FILING_PARSER_EVIDENCE_CLAIM).toBe(
      "bounded_synthetic_one_shot_filing_parser_isolation_quarantine_replay_and_provenance_binding",
    );
    expect(FILING_PARSER_EVIDENCE_CHECKS).toHaveLength(16);
    expect(FILING_PARSER_EVIDENCE_NOT_PROVEN).toHaveLength(16);
    expect(FILING_PARSER_EVIDENCE_SOURCE_PATHS).toHaveLength(26);
    expect(new Set(FILING_PARSER_EVIDENCE_SOURCE_PATHS).size).toBe(26);
    expect(FILING_PARSER_EVIDENCE_SOURCE_PATHS.slice(0, 2)).toEqual([
      ".github/workflows/ci.yml",
      ".github/workflows/filing-parser-acceptance.yml",
    ]);
  });

  it("round-trips one exact canonical success-only record", () => {
    const evidence = createFilingParserEvidence(input());
    const serialized = serializeCanonicalFilingParserEvidence(evidence);
    const parsed = parseCanonicalFilingParserEvidence(
      new TextEncoder().encode(serialized),
    );

    expect(parsed).toEqual(evidence);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized.slice(0, -1)).not.toContain("\n");
    expect(filingParserEvidenceSha256(parsed)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.caseOutcomes)).toBe(true);
    expect(Object.isFrozen(parsed.sourceHashes)).toBe(true);
    expect(parsed.summary).toEqual({
      accepted: 2,
      exactByteReplayPassed: true,
      quarantined: 1,
      total: 3,
    });
  });

  it("rejects noncanonical, mixed-image, count, source, check, and nonclaim records", () => {
    const canonical = JSON.parse(
      serializeCanonicalFilingParserEvidence(
        createFilingParserEvidence(input()),
      ),
    ) as Record<string, unknown>;
    const mutations: Record<string, unknown>[] = [];

    mutations.push({ ...canonical, extra: true });
    mutations.push({ ...canonical, status: "failed" });
    mutations.push({
      ...canonical,
      checksPassed: [...FILING_PARSER_EVIDENCE_CHECKS, "extra"],
    });
    mutations.push({
      ...canonical,
      notProven: [...FILING_PARSER_EVIDENCE_NOT_PROVEN].reverse(),
    });
    mutations.push({
      ...canonical,
      sourceHashes: (canonical.sourceHashes as unknown[]).slice(1),
    });
    mutations.push({
      ...canonical,
      summary: {
        accepted: 3,
        exactByteReplayPassed: true,
        quarantined: 0,
        total: 3,
      },
    });
    mutations.push({
      ...canonical,
      caseOutcomes: (canonical.caseOutcomes as Record<string, unknown>[]).map(
        (outcome, index) =>
          index === 0 ? { ...outcome, imageId: HASH_B } : outcome,
      ),
    });

    for (const mutation of mutations) {
      expect(() =>
        createFilingParserEvidence(
          mutation as unknown as FilingParserEvidenceInput,
        ),
      ).toThrow("Filing parser evidence is invalid.");
    }

    const serialized = serializeCanonicalFilingParserEvidence(
      createFilingParserEvidence(input()),
    );
    expect(() =>
      parseCanonicalFilingParserEvidence(
        new TextEncoder().encode(` ${serialized}`),
      ),
    ).toThrow("Filing parser evidence is invalid.");
    expect(() =>
      parseCanonicalFilingParserEvidence(
        new TextEncoder().encode(
          serialized.replace(
            '"schemaVersion":"1.0.0"',
            '"schemaVersion":"1.0.0","schemaVersion":"1.0.0"',
          ),
        ),
      ),
    ).toThrow("Filing parser evidence is invalid.");
  });

  it("requires inspected runtime controls rather than trusting create argv", () => {
    const expected = {
      containerId: "c".repeat(64),
      containerName:
        "research-cockpit-filing-parser-12345678-1234-1234-1234-123456789abc",
      imageId: HASH_A,
      inputSource: "/tmp/research-cockpit-filing-parser-a/filing.zip",
    } as const;
    const inspection = containerInspection(expected);
    expect(() =>
      validateFilingParserContainerInspection(inspection, expected),
    ).not.toThrow();

    const mutations = [
      { ...inspection, Image: HASH_B },
      { ...inspection, Config: { ...inspection.Config, User: "0:0" } },
      {
        ...inspection,
        HostConfig: { ...inspection.HostConfig, NetworkMode: "bridge" },
      },
      {
        ...inspection,
        HostConfig: { ...inspection.HostConfig, ReadonlyRootfs: false },
      },
      {
        ...inspection,
        HostConfig: { ...inspection.HostConfig, CapDrop: [] },
      },
      {
        ...inspection,
        HostConfig: { ...inspection.HostConfig, PidsLimit: 0 },
      },
      {
        ...inspection,
        HostConfig: { ...inspection.HostConfig, Tmpfs: { "/tmp": "rw" } },
      },
      { ...inspection, Mounts: [] },
      {
        ...inspection,
        NetworkSettings: { Ports: { "8080/tcp": [{ HostPort: "8080" }] } },
      },
    ];
    for (const mutation of mutations) {
      expect(() =>
        validateFilingParserContainerInspection(mutation, expected),
      ).toThrow("Filing parser evidence is invalid.");
    }
  });
});

function containerInspection(expected: {
  containerId: string;
  containerName: string;
  imageId: string;
  inputSource: string;
}) {
  return {
    Config: {
      Cmd: null,
      Entrypoint: ["python", "-I", "-B", "/worker/parser.py"],
      Env: ["LANG=C.UTF-8"],
      ExposedPorts: null,
      Image: expected.imageId,
      User: "65532:65532",
    },
    HostConfig: {
      CapAdd: null,
      CapDrop: ["ALL"],
      IpcMode: "none",
      Memory: 134_217_728,
      MemorySwap: 134_217_728,
      Mounts: [
        {
          ReadOnly: true,
          Source: expected.inputSource,
          Target: "/input/filing.zip",
          Type: "bind",
        },
      ],
      NanoCpus: 500_000_000,
      NetworkMode: "none",
      PidsLimit: 32,
      PortBindings: {},
      Privileged: false,
      PublishAllPorts: false,
      ReadonlyRootfs: true,
      SecurityOpt: ["no-new-privileges=true"],
      Tmpfs: { "/tmp": "rw,noexec,nosuid,nodev,size=8388608" },
      Ulimits: [{ Hard: 64, Name: "nofile", Soft: 64 }],
    },
    Id: expected.containerId,
    Image: expected.imageId,
    Mounts: [
      {
        Destination: "/input/filing.zip",
        Mode: "ro",
        RW: false,
        Source: expected.inputSource,
        Type: "bind",
      },
    ],
    Name: `/${expected.containerName}`,
    NetworkSettings: { Ports: {} },
    State: { Status: "created" },
  };
}

function input(): FilingParserEvidenceInput {
  return {
    caseOutcomes: [
      {
        caseId: "accepted_canonical",
        expectedStatus: "accepted",
        factCount: 2,
        imageId: HASH_A,
        observedStatus: "accepted",
        provenanceAlgorithm: "ed25519",
        provenanceKeyId: "cycle2a-ephemeral-ed25519-v1",
        provenancePayloadSha256: HASH_A,
        provenanceVerified: true,
        quarantineCode: null,
        replayMatched: true,
        resultSha256: HASH_A,
        signatureSha256: HASH_A,
        sourceSha256: HASH_A,
        tamperRejected: true,
      },
      {
        caseId: "accepted_exact_replay",
        expectedStatus: "accepted",
        factCount: 2,
        imageId: HASH_A,
        observedStatus: "accepted",
        provenanceAlgorithm: "ed25519",
        provenanceKeyId: "cycle2a-ephemeral-ed25519-v1",
        provenancePayloadSha256: HASH_A,
        provenanceVerified: true,
        quarantineCode: null,
        replayMatched: true,
        resultSha256: HASH_A,
        signatureSha256: HASH_A,
        sourceSha256: HASH_A,
        tamperRejected: true,
      },
      {
        caseId: "archive_empty",
        expectedStatus: "quarantined",
        factCount: 0,
        imageId: HASH_A,
        observedStatus: "quarantined",
        provenanceAlgorithm: "ed25519",
        provenanceKeyId: "cycle2a-ephemeral-ed25519-v1",
        provenancePayloadSha256: HASH_A,
        provenanceVerified: true,
        quarantineCode: "archive_invalid",
        replayMatched: false,
        resultSha256: HASH_A,
        signatureSha256: HASH_A,
        sourceSha256: HASH_A,
        tamperRejected: true,
      },
    ],
    checksPassed: FILING_PARSER_EVIDENCE_CHECKS,
    claim: FILING_PARSER_EVIDENCE_CLAIM,
    completedAt: "2026-08-20T20:01:00.000Z",
    evidenceVersion: 1,
    fixtureManifestSha256: HASH_A,
    image: {
      architecture: "amd64",
      baseIndexDigest:
        "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
      basePlatformManifestDigest:
        "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af",
      builtImageId: HASH_A,
      operatingSystem: "linux",
      pythonVersion: "3.12.13",
    },
    notProven: FILING_PARSER_EVIDENCE_NOT_PROVEN,
    repository: "example/research-cockpit",
    revision: "c".repeat(40),
    runtime: {
      capabilitiesDropped: ["ALL"],
      containerUser: "65532:65532",
      cpuCount: 0.5,
      inputMount: "/input/filing.zip:ro",
      memoryBytes: 134_217_728,
      networkMode: "none",
      noNewPrivileges: true,
      noPublishedPorts: true,
      openFiles: 64,
      pids: 32,
      readOnlyRootFilesystem: true,
      temporaryFilesystem: "/tmp:rw,noexec,nosuid,nodev,size=8388608",
      wallClockMilliseconds: 5_000,
      zeroResidue: true,
    },
    schemaVersion: FILING_PARSER_EVIDENCE_SCHEMA_VERSION,
    sourceHashes: FILING_PARSER_EVIDENCE_SOURCE_PATHS.map((path) => ({
      path,
      sha256: HASH_A,
    })),
    startedAt: "2026-08-20T20:00:00.000Z",
    status: "passed",
    summary: {
      accepted: 2,
      exactByteReplayPassed: true,
      quarantined: 1,
      total: 3,
    },
    synthetic: true,
    tools: {
      dockerClient: "Docker version 28.0.0",
      dockerServer: "Docker Engine 28.0.0",
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
      workflowName: FILING_PARSER_EVIDENCE_WORKFLOW,
    },
  };
}
