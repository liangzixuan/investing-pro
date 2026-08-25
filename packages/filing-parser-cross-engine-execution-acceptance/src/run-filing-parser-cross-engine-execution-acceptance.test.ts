import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL } from "@research-cockpit/filing-parser-normalization-execution";

import {
  ACCEPTANCE_PHASES,
  exactCreateArguments,
  filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase,
  filingParserCrossEngineExecutionAcceptanceFailureDiagnostic,
  imageIdValue,
  validateContainerInspection,
  validateRequestLimits,
} from "./run-filing-parser-cross-engine-execution-acceptance";

const IMAGE = `sha256:${"1".repeat(64)}`;
const CONTAINER_ID = "2".repeat(64);
const CONTAINER_NAME =
  "research-cockpit-filing-normalization-00000000-0000-4000-8000-000000000000";
const ARCHIVE_PATH = "/tmp/cycle2k/filing.zip";
const MOUNT = `type=bind,source=${ARCHIVE_PATH},destination=/input/filing.zip,readonly`;
const PYTHON_ENTRYPOINT = ["python", "-I", "-B", "/worker/parser.py"] as const;
const NODE_ENTRYPOINT = [
  "node",
  "--disable-proto=throw",
  "/worker/parser.mjs",
] as const;
const DIAGNOSTIC_PREFIX =
  "filing_parser_cross_engine_execution_acceptance_failed phase=";
const INTERNAL_DIAGNOSTIC = `${DIAGNOSTIC_PREFIX}internal\n`;
const runnerSource = readFileSync(
  fileURLToPath(
    new URL(
      "./run-filing-parser-cross-engine-execution-acceptance.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("filing parser cross-engine execution live Docker audit", () => {
  it("emits one exact value-free diagnostic for every frozen phase", () => {
    expect(ACCEPTANCE_PHASES).toEqual([
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
    ]);
    expect(Object.isFrozen(ACCEPTANCE_PHASES)).toBe(true);
    for (const phase of ACCEPTANCE_PHASES) {
      const diagnostic =
        filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(phase);
      expect(diagnostic).toBe(`${DIAGNOSTIC_PREFIX}${phase}\n`);
      expect(diagnostic.match(/\n/gu)).toHaveLength(1);
      expect(diagnostic).toMatch(
        /^filing_parser_cross_engine_execution_acceptance_failed phase=[a-z_]+\n$/u,
      );
      expect(diagnostic).not.toMatch(
        /sha256:|github\.com|artifact[_=:]|revision[_=:]|secret[_=:]|token[_=:]|key[_=:]/iu,
      );
    }
  });

  it("never coerces, reads, or reflects a hostile unknown phase", () => {
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        get: () => {
          reads += 1;
          throw new Error("must not inspect input");
        },
        getPrototypeOf: () => {
          reads += 1;
          throw new Error("must not inspect input");
        },
      },
    );
    for (const value of [
      undefined,
      null,
      "audited_mismatch\nsecret=value",
      `sha256:${"a".repeat(64)}`,
      hostile,
    ])
      expect(
        filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(value),
      ).toBe(INTERNAL_DIAGNOSTIC);
    expect(reads).toBe(0);
  });

  it("preserves a primary failure and replaces only a cleanup-primary phase", () => {
    expect(
      filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase(true),
    ).toBe(false);
    expect(
      filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase(
        false,
      ),
    ).toBe(true);
  });

  it("freezes the audited and production execution accounting", () => {
    expect(runnerSource).toContain("[0, 0, 0, 0, 0, 0, 2, 0, 0]");
    expect(runnerSource).toContain("[0, 0, 0, 0, 0, 0]");
    expect(runnerSource).toMatch(/auditedContainerCount:\s*15/u);
    expect(runnerSource).toMatch(/productionContainerCount:\s*9/u);
    expect(runnerSource).toMatch(/successfulPairContainerCount:\s*4/u);
    expect(runnerSource).toContain(
      "this.#createCount !== this.expectedExitCodes.length",
    );
    expect(runnerSource).toMatch(
      /this\.documentOutputs\.length\s*!==\s*this\.expectedExitCodes\s*\.filter\(\(code\) => code === 0\)\.length/u,
    );
  });

  it("requires the baseline's single direct child on both ancestry views", () => {
    expect(runnerSource).toContain('["merge-base", base, revision]');
    expect(runnerSource).toContain('["rev-list", "--count", revisionRange]');
    expect(runnerSource).toContain(
      '["rev-list", "--first-parent", "--count", revisionRange]',
    );
    expect(runnerSource).toContain(
      '["rev-list", "--parents", "--max-count=1", revision]',
    );
    expect(runnerSource).toContain('successorCount !== "1"');
    expect(runnerSource).toContain('firstParentCount !== "1"');
    expect(runnerSource).toContain("parentLine !== `${revision} ${base}`");
  });

  it("keeps evidence writing success-only, atomic, and after image removal", () => {
    const removal = runnerSource.indexOf('markPhase("image_removal")');
    const write = runnerSource.indexOf('markPhase("evidence_write")');
    const temporaryWrite = runnerSource.indexOf("await writeFile(", write);
    const destinationAbsence = runnerSource.indexOf(
      "await assertPathAbsent(environment.evidencePath)",
      temporaryWrite,
    );
    const atomicRename = runnerSource.indexOf(
      "await rename(temporaryEvidencePath, environment.evidencePath)",
      destinationAbsence,
    );
    const committed = runnerSource.indexOf(
      "evidenceWritten = true",
      atomicRename,
    );
    const failureCleanup = runnerSource.indexOf(
      "if (temporaryEvidencePath !== null)",
      committed,
    );
    expect(removal).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(removal);
    expect(temporaryWrite).toBeGreaterThan(write);
    expect(destinationAbsence).toBeGreaterThan(temporaryWrite);
    expect(atomicRename).toBeGreaterThan(destinationAbsence);
    expect(committed).toBeGreaterThan(atomicRename);
    expect(failureCleanup).toBeGreaterThan(committed);
    expect(runnerSource).toContain(
      "A candidate artifact is never written on failure or cancellation.",
    );
  });

  it("accepts only Docker's exact lowercase newline-free IID", () => {
    expect(imageIdValue(IMAGE)).toBe(IMAGE);
    for (const invalid of [
      `${IMAGE}\n`,
      `${IMAGE}\r\n`,
      ` ${IMAGE}`,
      `${IMAGE} `,
      IMAGE.toUpperCase(),
      `sha256:${"0".repeat(63)}`,
      `sha256:${"0".repeat(65)}`,
      "1".repeat(64),
    ])
      expect(() => imageIdValue(invalid)).toThrow();
  });

  it("accepts only the exact Docker create argument vector", () => {
    const args = createArguments();
    expect(exactCreateArguments(args, CONTAINER_NAME, MOUNT, IMAGE)).toBe(true);
    for (const mutate of [
      (value: string[]) => value.splice(4, 2),
      (value: string[]) => {
        value[6] = "bridge";
      },
      (value: string[]) => {
        value[13] = "0:0";
      },
      (value: string[]) => {
        value[value.length - 1] = `sha256:${"3".repeat(64)}`;
      },
      (value: string[]) => value.push("unexpected"),
    ]) {
      const changed = [...args];
      mutate(changed);
      expect(exactCreateArguments(changed, CONTAINER_NAME, MOUNT, IMAGE)).toBe(
        false,
      );
    }
  });

  it("enforces exact per-operation request limits and a live abort signal", () => {
    const signal = new AbortController().signal;
    for (const kind of ["create", "remove", "residue"] as const)
      expect(() =>
        validateRequestLimits(controlRequest(signal), kind),
      ).not.toThrow();
    expect(() =>
      validateRequestLimits(startRequest(signal), "start"),
    ).not.toThrow();

    const failures = [
      { ...startRequest(signal), stdoutLimitBytes: 262_145 },
      { ...startRequest(signal), stderrLimitBytes: 4_095 },
      { ...startRequest(signal), timeoutMilliseconds: 5_001 },
      { ...controlRequest(signal), stdoutLimitBytes: 257 },
      { ...controlRequest(signal), timeoutMilliseconds: 4_999 },
      { ...controlRequest(signal), signal: undefined },
    ];
    for (const request of failures)
      expect(() =>
        validateRequestLimits(
          request as Parameters<typeof validateRequestLimits>[0],
          request.stdoutLimitBytes > 256 ? "start" : "remove",
        ),
      ).toThrow();
    const aborted = new AbortController();
    aborted.abort();
    expect(() =>
      validateRequestLimits(controlRequest(aborted.signal), "remove"),
    ).toThrow();
  });

  it("accepts exact Python and Node created-container snapshots", () => {
    for (const entrypoint of [PYTHON_ENTRYPOINT, NODE_ENTRYPOINT])
      expect(() =>
        validateContainerInspection(
          inspection(entrypoint),
          CONTAINER_ID,
          CONTAINER_NAME,
          IMAGE,
          ARCHIVE_PATH,
          entrypoint,
        ),
      ).not.toThrow();
  });

  it("rejects every material container-isolation substitution", () => {
    const mutations: Array<(value: ReturnType<typeof inspection>) => void> = [
      (value) => {
        value.Config.Cmd = ["sh"];
      },
      (value) => {
        value.Config.Entrypoint = ["sh"];
      },
      (value) => {
        value.Config.Env = ["SECRET=value"];
      },
      (value) => {
        value.HostConfig.NetworkMode = "bridge";
      },
      (value) => {
        value.HostConfig.ReadonlyRootfs = false;
      },
      (value) => {
        value.HostConfig.Privileged = true;
      },
      (value) => {
        value.HostConfig.CapDrop = [];
      },
      (value) => {
        value.HostConfig.SecurityOpt = [];
      },
      (value) => {
        value.HostConfig.PortBindings = { "80/tcp": [{}] };
      },
      (value) => {
        value.NetworkSettings.Ports = { "80/tcp": [{}] };
      },
      (value) => {
        value.HostConfig.Memory = 134_217_729;
      },
      (value) => {
        value.HostConfig.Tmpfs = { "/tmp": "rw,size=8388608" };
      },
      (value) => {
        value.Mounts[0]!.Source = "/tmp/substituted/filing.zip";
      },
      (value) => {
        (
          value.HostConfig.Mounts as Array<Record<string, unknown>>
        )[0]!.ReadOnly = false;
      },
    ];
    for (const mutate of mutations) {
      const value = inspection(PYTHON_ENTRYPOINT);
      mutate(value);
      expect(() =>
        validateContainerInspection(
          value,
          CONTAINER_ID,
          CONTAINER_NAME,
          IMAGE,
          ARCHIVE_PATH,
          PYTHON_ENTRYPOINT,
        ),
      ).toThrow();
    }
  });
});

function startRequest(
  signal: AbortSignal,
): Parameters<typeof validateRequestLimits>[0] {
  return {
    args: ["start", "--attach", CONTAINER_NAME],
    command: "docker",
    signal,
    stderrLimitBytes: 4_096,
    stdoutLimitBytes: 262_144,
    timeoutMilliseconds: 5_000,
  };
}

function controlRequest(
  signal: AbortSignal,
): Parameters<typeof validateRequestLimits>[0] {
  return {
    args: ["rm", "--force", CONTAINER_NAME],
    command: "docker",
    signal,
    stderrLimitBytes: 4_096,
    stdoutLimitBytes: 256,
    timeoutMilliseconds: 5_000,
  };
}

function createArguments(): string[] {
  return [
    "create",
    "--name",
    CONTAINER_NAME,
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
    MOUNT,
    IMAGE,
  ];
}

function inspection(entrypoint: readonly string[]): {
  Config: Record<string, unknown>;
  HostConfig: Record<string, unknown>;
  Id: string;
  Image: string;
  Mounts: Array<Record<string, unknown>>;
  Name: string;
  NetworkSettings: Record<string, unknown>;
  State: Record<string, unknown>;
} {
  return {
    Config: {
      Cmd: null,
      Entrypoint: [...entrypoint],
      Env: ["PATH=/usr/local/bin:/usr/bin:/bin"],
      ExposedPorts: null,
      Image: IMAGE,
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
          Source: ARCHIVE_PATH,
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
    Id: CONTAINER_ID,
    Image: IMAGE,
    Mounts: [
      {
        Destination: "/input/filing.zip",
        RW: false,
        Source: ARCHIVE_PATH,
        Type: "bind",
      },
    ],
    Name: `/${CONTAINER_NAME}`,
    NetworkSettings: { Ports: {} },
    State: { Status: "created" },
  };
}
