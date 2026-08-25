import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL } from "@research-cockpit/filing-parser-normalization-execution";

import {
  ACCEPTANCE_PHASES,
  exactCreateArguments,
  filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase,
  filingParserNormalizationExecutionAcceptanceFailureDiagnostic,
  imageIdValue,
  validateContainerInspection,
  validateRequestLimits,
} from "./run-filing-parser-normalization-execution-acceptance";

const IMAGE = `sha256:${"1".repeat(64)}`;
const CONTAINER_ID = "2".repeat(64);
const CONTAINER_NAME =
  "research-cockpit-filing-normalization-00000000-0000-4000-8000-000000000000";
const ARCHIVE_PATH = "/tmp/cycle2j/filing.zip";
const MOUNT = `type=bind,source=${ARCHIVE_PATH},destination=/input/filing.zip,readonly`;
const EXPECTED_FAILURE_DIAGNOSTICS = Object.freeze([
  [
    "environment",
    "filing_parser_normalization_execution_acceptance_failed phase=environment\n",
  ],
  [
    "repository_anchor",
    "filing_parser_normalization_execution_acceptance_failed phase=repository_anchor\n",
  ],
  [
    "source_inventory",
    "filing_parser_normalization_execution_acceptance_failed phase=source_inventory\n",
  ],
  [
    "image_metadata",
    "filing_parser_normalization_execution_acceptance_failed phase=image_metadata\n",
  ],
  [
    "staging",
    "filing_parser_normalization_execution_acceptance_failed phase=staging\n",
  ],
  [
    "image_build",
    "filing_parser_normalization_execution_acceptance_failed phase=image_build\n",
  ],
  [
    "image_inspection",
    "filing_parser_normalization_execution_acceptance_failed phase=image_inspection\n",
  ],
  [
    "audited_setup",
    "filing_parser_normalization_execution_acceptance_failed phase=audited_setup\n",
  ],
  [
    "audited_success",
    "filing_parser_normalization_execution_acceptance_failed phase=audited_success\n",
  ],
  [
    "audited_replay",
    "filing_parser_normalization_execution_acceptance_failed phase=audited_replay\n",
  ],
  [
    "audited_tamper",
    "filing_parser_normalization_execution_acceptance_failed phase=audited_tamper\n",
  ],
  [
    "audited_role_swap",
    "filing_parser_normalization_execution_acceptance_failed phase=audited_role_swap\n",
  ],
  [
    "audited_residue",
    "filing_parser_normalization_execution_acceptance_failed phase=audited_residue\n",
  ],
  [
    "production_setup",
    "filing_parser_normalization_execution_acceptance_failed phase=production_setup\n",
  ],
  [
    "production_success",
    "filing_parser_normalization_execution_acceptance_failed phase=production_success\n",
  ],
  [
    "production_replay",
    "filing_parser_normalization_execution_acceptance_failed phase=production_replay\n",
  ],
  [
    "production_tamper",
    "filing_parser_normalization_execution_acceptance_failed phase=production_tamper\n",
  ],
  [
    "production_residue",
    "filing_parser_normalization_execution_acceptance_failed phase=production_residue\n",
  ],
  [
    "evidence_assembly",
    "filing_parser_normalization_execution_acceptance_failed phase=evidence_assembly\n",
  ],
  [
    "tool_versions",
    "filing_parser_normalization_execution_acceptance_failed phase=tool_versions\n",
  ],
  [
    "image_removal",
    "filing_parser_normalization_execution_acceptance_failed phase=image_removal\n",
  ],
  [
    "evidence_write",
    "filing_parser_normalization_execution_acceptance_failed phase=evidence_write\n",
  ],
  [
    "cleanup",
    "filing_parser_normalization_execution_acceptance_failed phase=cleanup\n",
  ],
] as const);
const INTERNAL_FAILURE_DIAGNOSTIC =
  "filing_parser_normalization_execution_acceptance_failed phase=internal\n";

describe("filing parser normalization execution live Docker audit", () => {
  it("emits an exact value-free diagnostic for every acceptance phase", () => {
    expect(EXPECTED_FAILURE_DIAGNOSTICS).toHaveLength(23);
    expect(ACCEPTANCE_PHASES).toEqual(
      EXPECTED_FAILURE_DIAGNOSTICS.map(([phase]) => phase),
    );
    expect(Object.isFrozen(ACCEPTANCE_PHASES)).toBe(true);
    for (const [phase, expected] of EXPECTED_FAILURE_DIAGNOSTICS) {
      const diagnostic =
        filingParserNormalizationExecutionAcceptanceFailureDiagnostic(phase);
      expect(diagnostic).toBe(expected);
      expect(diagnostic.match(/\n/gu)).toHaveLength(1);
      expect(diagnostic).toMatch(
        /^filing_parser_normalization_execution_acceptance_failed phase=[a-z_]+\n$/u,
      );
    }
  });

  it("does not coerce or reflect hostile unknown diagnostic inputs", () => {
    let propertyReads = 0;
    const hostile = new Proxy(
      {},
      {
        get: () => {
          propertyReads += 1;
          throw new Error("must not inspect diagnostic input");
        },
        getPrototypeOf: () => {
          propertyReads += 1;
          throw new Error("must not inspect diagnostic input");
        },
      },
    );
    for (const unknownPhase of [
      undefined,
      null,
      "image_build\nsecret=value",
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      hostile,
    ])
      expect(
        filingParserNormalizationExecutionAcceptanceFailureDiagnostic(
          unknownPhase,
        ),
      ).toBe(INTERNAL_FAILURE_DIAGNOSTIC);
    expect(propertyReads).toBe(0);
  });

  it("emits only the fixed environment phase through the CLI failure path", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        "--import",
        "tsx",
        fileURLToPath(
          new URL(
            "./run-filing-parser-normalization-execution-acceptance.ts",
            import.meta.url,
          ),
        ),
      ],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        encoding: "utf8",
        env: {
          ...process.env,
          CI: "false",
          CYCLE_2J_HOSTILE_SECRET: "must-not-appear",
          GITHUB_ACTIONS: "false",
        },
        timeout: 10_000,
        windowsHide: true,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(EXPECTED_FAILURE_DIAGNOSTICS[0][1]);
    expect(result.stderr).not.toContain("must-not-appear");
  });

  it.runIf(
    process.platform === "linux" &&
      process.arch === "x64" &&
      process.env.CI === "true",
  )(
    "advances only to repository_anchor before an exact revision mismatch",
    () => {
      const repositoryRoot = fileURLToPath(
        new URL("../../../", import.meta.url),
      );
      const evidencePath = fileURLToPath(
        new URL(
          "../../../research-cockpit-filing-parser-normalization-execution-v1.json",
          import.meta.url,
        ),
      );
      const result = spawnSync(
        process.execPath,
        [
          "--no-warnings",
          "--import",
          "tsx",
          fileURLToPath(
            new URL(
              "./run-filing-parser-normalization-execution-acceptance.ts",
              import.meta.url,
            ),
          ),
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            CI: "true",
            FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_PATH: evidencePath,
            GITHUB_ACTIONS: "true",
            GITHUB_EVENT_NAME: "push",
            GITHUB_JOB: "acceptance",
            GITHUB_REF: "refs/heads/main",
            GITHUB_REPOSITORY: "research-cockpit/research-cockpit",
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_RUN_ID: "1",
            GITHUB_SHA: "0".repeat(40),
            GITHUB_WORKFLOW: "Filing parser normalization execution acceptance",
            RUNNER_TEMP: repositoryRoot,
          },
          timeout: 10_000,
          windowsHide: true,
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(EXPECTED_FAILURE_DIAGNOSTICS[1][1]);
    },
  );

  it("replaces only a cleanup-primary phase", () => {
    expect(
      filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase(
        false,
      ),
    ).toBe(true);
    expect(
      filingParserNormalizationExecutionAcceptanceCleanupShouldReplacePhase(
        true,
      ),
    ).toBe(false);
  });

  it("accepts only Docker's exact newline-free IID file", () => {
    expect(imageIdValue(IMAGE)).toBe(IMAGE);
    for (const substituted of [
      `${IMAGE}\n`,
      `${IMAGE}\r\n`,
      ` ${IMAGE}`,
      `${IMAGE} `,
      IMAGE.toUpperCase(),
      `sha256:${"0".repeat(63)}`,
    ])
      expect(() => imageIdValue(substituted)).toThrow();
  });

  it("accepts only the exact create arguments and request bounds", () => {
    const args = createArguments();
    expect(exactCreateArguments(args, CONTAINER_NAME, MOUNT, IMAGE)).toBe(true);
    const networked = [...args];
    networked[6] = "bridge";
    expect(exactCreateArguments(networked, CONTAINER_NAME, MOUNT, IMAGE)).toBe(
      false,
    );

    const signal = new AbortController().signal;
    expect(() =>
      validateRequestLimits(
        {
          args: ["start", "--attach", CONTAINER_NAME],
          command: "docker",
          signal,
          stderrLimitBytes: 4_096,
          stdoutLimitBytes: 262_144,
          timeoutMilliseconds: 5_000,
        },
        "start",
      ),
    ).not.toThrow();
    expect(() =>
      validateRequestLimits(
        {
          args: ["start", "--attach", CONTAINER_NAME],
          command: "docker",
          signal,
          stderrLimitBytes: 4_096,
          stdoutLimitBytes: 262_145,
          timeoutMilliseconds: 5_000,
        },
        "start",
      ),
    ).toThrow();

    const aborted = new AbortController();
    aborted.abort();
    expect(() =>
      validateRequestLimits(
        {
          args: ["rm", "--force", CONTAINER_NAME],
          command: "docker",
          signal: aborted.signal,
          stderrLimitBytes: 4_096,
          stdoutLimitBytes: 256,
          timeoutMilliseconds: 5_000,
        },
        "remove",
      ),
    ).toThrow();
  });

  it("accepts the exact created-container isolation snapshot", () => {
    expect(() =>
      validateContainerInspection(
        inspection(),
        CONTAINER_ID,
        CONTAINER_NAME,
        IMAGE,
        ARCHIVE_PATH,
      ),
    ).not.toThrow();
  });

  it("rejects port publication, writable roots, and mount substitution", () => {
    const published = inspection();
    published.HostConfig.PortBindings = { "80/tcp": [{}] };
    expect(() =>
      validateContainerInspection(
        published,
        CONTAINER_ID,
        CONTAINER_NAME,
        IMAGE,
        ARCHIVE_PATH,
      ),
    ).toThrow();

    const writable = inspection();
    writable.HostConfig.ReadonlyRootfs = false;
    expect(() =>
      validateContainerInspection(
        writable,
        CONTAINER_ID,
        CONTAINER_NAME,
        IMAGE,
        ARCHIVE_PATH,
      ),
    ).toThrow();

    const substituted = inspection();
    substituted.Mounts[0]!.Source = "/tmp/substituted/filing.zip";
    expect(() =>
      validateContainerInspection(
        substituted,
        CONTAINER_ID,
        CONTAINER_NAME,
        IMAGE,
        ARCHIVE_PATH,
      ),
    ).toThrow();
  });
});

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

function inspection(): {
  Config: Record<string, unknown>;
  HostConfig: Record<string, unknown>;
  Id: string;
  Image: string;
  Mounts: Record<string, unknown>[];
  Name: string;
  NetworkSettings: Record<string, unknown>;
  State: Record<string, unknown>;
} {
  return {
    Config: {
      Cmd: null,
      Entrypoint: ["python", "-I", "-B", "/worker/parser.py"],
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
