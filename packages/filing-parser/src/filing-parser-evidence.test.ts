import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_CONTAINER_INSPECTION_CHECK_CODES,
  FILING_PARSER_EVIDENCE_CHECKS,
  FILING_PARSER_EVIDENCE_CLAIM,
  FILING_PARSER_EVIDENCE_NOT_PROVEN,
  FILING_PARSER_EVIDENCE_SCHEMA_VERSION,
  FILING_PARSER_EVIDENCE_SOURCE_PATHS,
  FILING_PARSER_EVIDENCE_WORKFLOW,
  FILING_PARSER_IMAGE_INSPECTION_CHECK_CODES,
  FilingParserContainerInspectionError,
  FilingParserImageInspectionError,
  createFilingParserEvidence,
  filingParserEvidenceSha256,
  parseCanonicalFilingParserEvidence,
  serializeCanonicalFilingParserEvidence,
  validateFilingParserContainerInspection,
  validateFilingParserImageInspection,
  type FilingParserContainerInspectionCheckCode,
  type FilingParserEvidenceInput,
  type FilingParserImageInspectionCheckCode,
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

  it("classifies every strict built-image inspection failure in exact order", () => {
    const image = builtImageInspection(HASH_A);
    const inspection = imageInspectionCommand([image]);
    expect(() =>
      validateFilingParserImageInspection(inspection, HASH_A),
    ).not.toThrow();

    const omittedEmptyConfig = { ...image.Config } as Record<string, unknown>;
    delete omittedEmptyConfig.Cmd;
    delete omittedEmptyConfig.ExposedPorts;
    expect(() =>
      validateFilingParserImageInspection(
        imageInspectionCommand([{ ...image, Config: omittedEmptyConfig }]),
        HASH_A,
      ),
    ).not.toThrow();
    expect(() =>
      validateFilingParserImageInspection(
        imageInspectionCommand([
          { ...image, Config: { ...image.Config, Cmd: [], ExposedPorts: {} } },
        ]),
        HASH_A,
      ),
    ).not.toThrow();

    const failures: Array<
      readonly [
        FilingParserImageInspectionCheckCode,
        ReturnType<typeof imageInspectionCommand>,
      ]
    > = [
      ["inspect_command", { ...inspection, exitCode: 1 }],
      [
        "inspect_json",
        { ...inspection, stdout: new TextEncoder().encode("{") },
      ],
      ["inspect_result_count", imageInspectionCommand([])],
      ["image_id", imageInspectionCommand([{ ...image, Id: HASH_B }])],
      ["image_os", imageInspectionCommand([{ ...image, Os: "windows" }])],
      [
        "image_architecture",
        imageInspectionCommand([{ ...image, Architecture: "arm64" }]),
      ],
      ["config_shape", imageInspectionCommand([{ ...image, Config: null }])],
      [
        "config_user",
        imageInspectionCommand([
          { ...image, Config: { ...image.Config, User: "0:0" } },
        ]),
      ],
      [
        "config_working_directory",
        imageInspectionCommand([
          { ...image, Config: { ...image.Config, WorkingDir: "/input" } },
        ]),
      ],
      [
        "config_cmd",
        imageInspectionCommand([
          { ...image, Config: { ...image.Config, Cmd: ["python3"] } },
        ]),
      ],
      [
        "config_exposed_ports",
        imageInspectionCommand([
          {
            ...image,
            Config: {
              ...image.Config,
              ExposedPorts: { "8080/tcp": {} },
            },
          },
        ]),
      ],
      [
        "config_entrypoint",
        imageInspectionCommand([
          { ...image, Config: { ...image.Config, Entrypoint: ["python3"] } },
        ]),
      ],
      [
        "config_env",
        imageInspectionCommand([
          { ...image, Config: { ...image.Config, Env: ["TOKEN=x"] } },
        ]),
      ],
    ];

    expect(failures.map(([checkCode]) => checkCode)).toEqual(
      FILING_PARSER_IMAGE_INSPECTION_CHECK_CODES,
    );
    for (const [checkCode, failure] of failures) {
      let observed: unknown;
      try {
        validateFilingParserImageInspection(failure, HASH_A);
      } catch (error) {
        observed = error;
      }
      expect(observed).toBeInstanceOf(FilingParserImageInspectionError);
      expect((observed as FilingParserImageInspectionError).checkCode).toBe(
        checkCode,
      );
      expect((observed as Error).message).toBe(
        "Filing parser evidence is invalid.",
      );
    }
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
    const omittedEmptyConfig = { ...inspection.Config } as Record<
      string,
      unknown
    >;
    delete omittedEmptyConfig.Cmd;
    delete omittedEmptyConfig.ExposedPorts;
    expect(() =>
      validateFilingParserContainerInspection(
        { ...inspection, Config: omittedEmptyConfig },
        expected,
      ),
    ).not.toThrow();
    expect(() =>
      validateFilingParserContainerInspection(
        {
          ...inspection,
          Config: { ...inspection.Config, Cmd: [], ExposedPorts: {} },
        },
        expected,
      ),
    ).not.toThrow();

    const failures: Array<
      readonly [FilingParserContainerInspectionCheckCode, unknown]
    > = [
      ["container_shape", withoutKey(inspection, "Config")],
      ["container_id", { ...inspection, Id: "d".repeat(64) }],
      ["container_image", { ...inspection, Image: HASH_B }],
      ["container_name", { ...inspection, Name: "/unexpected" }],
      ["state_shape", { ...inspection, State: {} }],
      ["state_status", { ...inspection, State: { Status: "running" } }],
      ["config_shape", { ...inspection, Config: {} }],
      [
        "config_image",
        { ...inspection, Config: { ...inspection.Config, Image: HASH_B } },
      ],
      [
        "config_user",
        { ...inspection, Config: { ...inspection.Config, User: "0:0" } },
      ],
      [
        "config_cmd",
        { ...inspection, Config: { ...inspection.Config, Cmd: ["python3"] } },
      ],
      [
        "config_exposed_ports",
        {
          ...inspection,
          Config: { ...inspection.Config, ExposedPorts: { "8080/tcp": {} } },
        },
      ],
      [
        "config_entrypoint",
        {
          ...inspection,
          Config: { ...inspection.Config, Entrypoint: ["python3"] },
        },
      ],
      [
        "config_env",
        { ...inspection, Config: { ...inspection.Config, Env: ["TOKEN=x"] } },
      ],
      ["host_shape", { ...inspection, HostConfig: {} }],
      [
        "host_network_mode",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, NetworkMode: "bridge" },
        },
      ],
      [
        "host_read_only_root",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, ReadonlyRootfs: false },
        },
      ],
      [
        "host_privileged",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Privileged: true },
        },
      ],
      [
        "host_publish_all_ports",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, PublishAllPorts: true },
        },
      ],
      [
        "host_cap_add",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, CapAdd: ["NET_ADMIN"] },
        },
      ],
      [
        "host_cap_drop",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, CapDrop: [] },
        },
      ],
      [
        "host_security_options",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, SecurityOpt: [] },
        },
      ],
      [
        "host_pids",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, PidsLimit: 0 },
        },
      ],
      [
        "host_memory",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Memory: 0 },
        },
      ],
      [
        "host_memory_swap",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, MemorySwap: 0 },
        },
      ],
      [
        "host_cpu",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, NanoCpus: 0 },
        },
      ],
      [
        "host_ipc",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, IpcMode: "private" },
        },
      ],
      [
        "host_port_bindings",
        {
          ...inspection,
          HostConfig: {
            ...inspection.HostConfig,
            PortBindings: { "8080/tcp": [] },
          },
        },
      ],
      ["network_shape", { ...inspection, NetworkSettings: {} }],
      [
        "network_ports",
        {
          ...inspection,
          NetworkSettings: { Ports: { "8080/tcp": [{ HostPort: "8080" }] } },
        },
      ],
      [
        "ulimit_shape",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Ulimits: [] },
        },
      ],
      [
        "ulimit_nofile",
        {
          ...inspection,
          HostConfig: {
            ...inspection.HostConfig,
            Ulimits: [{ Hard: 65, Name: "nofile", Soft: 64 }],
          },
        },
      ],
      [
        "tmpfs_shape",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Tmpfs: {} },
        },
      ],
      [
        "tmpfs_options",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Tmpfs: { "/tmp": "rw" } },
        },
      ],
      ["mount_count", { ...inspection, Mounts: [] }],
      ["mount_shape", { ...inspection, Mounts: [{}] }],
      [
        "mount_type",
        {
          ...inspection,
          Mounts: [{ ...inspection.Mounts[0], Type: "volume" }],
        },
      ],
      [
        "mount_source",
        {
          ...inspection,
          Mounts: [{ ...inspection.Mounts[0], Source: "/tmp/x" }],
        },
      ],
      [
        "mount_destination",
        {
          ...inspection,
          Mounts: [{ ...inspection.Mounts[0], Destination: "/x" }],
        },
      ],
      [
        "mount_mode",
        { ...inspection, Mounts: [{ ...inspection.Mounts[0], Mode: "ro" }] },
      ],
      [
        "mount_read_only",
        { ...inspection, Mounts: [{ ...inspection.Mounts[0], RW: true }] },
      ],
      [
        "host_mount_count",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Mounts: [] },
        },
      ],
      [
        "host_mount_shape",
        {
          ...inspection,
          HostConfig: { ...inspection.HostConfig, Mounts: [{}] },
        },
      ],
      [
        "host_mount_type",
        {
          ...inspection,
          HostConfig: {
            ...inspection.HostConfig,
            Mounts: [{ ...inspection.HostConfig.Mounts[0], Type: "volume" }],
          },
        },
      ],
      [
        "host_mount_source",
        {
          ...inspection,
          HostConfig: {
            ...inspection.HostConfig,
            Mounts: [{ ...inspection.HostConfig.Mounts[0], Source: "/tmp/x" }],
          },
        },
      ],
      [
        "host_mount_target",
        {
          ...inspection,
          HostConfig: {
            ...inspection.HostConfig,
            Mounts: [{ ...inspection.HostConfig.Mounts[0], Target: "/x" }],
          },
        },
      ],
      [
        "host_mount_read_only",
        {
          ...inspection,
          HostConfig: {
            ...inspection.HostConfig,
            Mounts: [{ ...inspection.HostConfig.Mounts[0], ReadOnly: false }],
          },
        },
      ],
    ];
    expect(failures.map(([checkCode]) => checkCode)).toEqual(
      FILING_PARSER_CONTAINER_INSPECTION_CHECK_CODES,
    );
    for (const [checkCode, mutation] of failures) {
      let observed: unknown;
      try {
        validateFilingParserContainerInspection(mutation, expected);
      } catch (error) {
        observed = error;
      }
      expect(observed).toBeInstanceOf(FilingParserContainerInspectionError);
      expect((observed as FilingParserContainerInspectionError).checkCode).toBe(
        checkCode,
      );
      expect((observed as Error).message).toBe(
        "Filing parser evidence is invalid.",
      );
    }
  });
});

function withoutKey<T extends Record<string, unknown>>(
  value: T,
  key: keyof T,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...value };
  delete output[String(key)];
  return output;
}

function builtImageInspection(imageId: `sha256:${string}`) {
  return {
    Architecture: "amd64",
    Config: {
      Cmd: null,
      Entrypoint: ["python", "-I", "-B", "/worker/parser.py"],
      Env: ["LANG=C.UTF-8"],
      ExposedPorts: null,
      User: "65532:65532",
      WorkingDir: "/worker",
    },
    Id: imageId,
    Os: "linux",
  };
}

function imageInspectionCommand(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Invalid test fixture.");
  return {
    exitCode: 0,
    stderr: new Uint8Array(),
    stdout: new TextEncoder().encode(serialized),
  };
}

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
        Mode: "",
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
