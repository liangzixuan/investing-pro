import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL } from "@research-cockpit/filing-parser-normalization-execution";

import { FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES } from "./filing-parser-cross-engine-execution-evidence";

import {
  ACCEPTANCE_PHASES,
  NODE_IMAGE_INSPECTION_PROFILE,
  PYTHON_IMAGE_INSPECTION_PROFILE,
  exactCreateArguments,
  filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase,
  filingParserCrossEngineExecutionAcceptanceFailureDiagnostic,
  filingParserCrossEngineExecutionEvidenceValidationPhase,
  imageIdValue,
  validateBuiltImageInspection,
  validateContainerInspection,
  validateRequestLimits,
} from "./run-filing-parser-cross-engine-execution-acceptance";

const IMAGE: `sha256:${string}` = `sha256:${"1".repeat(64)}`;
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
      "evidence_validation_root_contract",
      "evidence_validation_timestamps",
      "evidence_validation_claim_tuples",
      "evidence_validation_case_outcomes",
      "evidence_validation_transition",
      "evidence_validation_runtime",
      "evidence_validation_source_hashes",
      "evidence_validation_engines",
      "evidence_validation_fixture_binding",
      "evidence_validation_summary",
      "evidence_validation_tools_contract",
      "evidence_validation_tool_docker_client",
      "evidence_validation_tool_docker_server",
      "evidence_validation_tool_git",
      "evidence_validation_tool_node",
      "evidence_validation_tool_pnpm",
      "evidence_validation_tool_python",
      "evidence_validation_workflow",
      "evidence_validation_canonical_freeze",
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

  it("maps every closed evidence stage to one value-free acceptance phase", () => {
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES) {
      const phase =
        filingParserCrossEngineExecutionEvidenceValidationPhase(stage);
      expect(phase).toBe(`evidence_validation_${stage}`);
      expect(ACCEPTANCE_PHASES).toContain(phase);
      expect(
        filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(phase),
      ).toBe(`${DIAGNOSTIC_PREFIX}${phase}\n`);
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

  it("requires the exact linear five-commit diagnostic recovery chain on both ancestry views", () => {
    expect(runnerSource).toContain('["merge-base", base, revision]');
    expect(runnerSource).toContain('["rev-list", "--count", revisionRange]');
    expect(runnerSource).toContain(
      '["rev-list", "--first-parent", "--count", revisionRange]',
    );
    expect(runnerSource).toContain(
      '["rev-list", "--parents", "--max-count=1", revision]',
    );
    expect(runnerSource).toContain(
      '["rev-list", "--parents", "--max-count=1", failedPrecursor]',
    );
    expect(runnerSource).toContain(
      '["rev-list", "--parents", "--max-count=1", failedCorrective]',
    );
    expect(runnerSource).toContain(
      '["rev-list", "--parents", "--max-count=1", failedRecovery]',
    );
    expect(runnerSource).toContain(
      '["rev-list", "--parents", "--max-count=1", failedDiagnostic]',
    );
    expect(runnerSource).toContain('successorCount !== "5"');
    expect(runnerSource).toContain('firstParentCount !== "5"');
    expect(runnerSource).toContain(
      "parentLine !== `${revision} ${failedDiagnostic}`",
    );
    expect(runnerSource).toContain(
      "failedDiagnosticParentLine !== `${failedDiagnostic} ${failedRecovery}`",
    );
    expect(runnerSource).toContain(
      "failedRecoveryParentLine !== `${failedRecovery} ${failedCorrective}`",
    );
    expect(runnerSource).toContain(
      "failedCorrectiveParentLine !== `${failedCorrective} ${failedPrecursor}`",
    );
    expect(runnerSource).toContain(
      "failedPrecursorParentLine !== `${failedPrecursor} ${base}`",
    );
  });

  it("constructs Git transition entries in canonical path-status order", () => {
    expect(runnerSource).toMatch(
      /Object\.freeze\(\{\s*path: match\[2\],\s*status: match\[1\] as "A" \| "M",\s*\}\)/u,
    );
  });

  it("uses the model validator once and maps only its closed stage", () => {
    const validation = runnerSource.indexOf(
      "createFilingParserCrossEngineExecutionEvidenceForAcceptance(",
    );
    const stageMapping = runnerSource.indexOf(
      "filingParserCrossEngineExecutionEvidenceValidationPhase(stage)",
      validation,
    );
    const removal = runnerSource.indexOf('markPhase("image_removal")');
    expect(validation).toBeGreaterThan(0);
    expect(stageMapping).toBeGreaterThan(validation);
    expect(removal).toBeGreaterThan(stageMapping);
  });

  it("derives the complete source-hash inventory from the exact transition", () => {
    const transition = runnerSource.indexOf(
      "const transition = await exactCorrectiveChainTransition(revision)",
    );
    const requiredPaths = runnerSource.indexOf(
      "filingParserCrossEngineExecutionRequiredSourcePaths(transition)",
      transition,
    );
    const hashes = runnerSource.indexOf(
      "await committedSourceHashes(",
      requiredPaths,
    );
    expect(transition).toBeGreaterThan(0);
    expect(requiredPaths).toBeGreaterThan(transition);
    expect(hashes).toBeGreaterThan(requiredPaths);
    expect(runnerSource).toContain("for (const path of paths)");
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
    for (const profile of [
      PYTHON_IMAGE_INSPECTION_PROFILE,
      NODE_IMAGE_INSPECTION_PROFILE,
    ])
      expect(() =>
        validateContainerInspection(
          inspection(profile.entrypoint, profile.workingDirectory),
          CONTAINER_ID,
          CONTAINER_NAME,
          IMAGE,
          ARCHIVE_PATH,
          profile,
        ),
      ).not.toThrow();
  });

  it("accepts only each engine's exact built-image inspection profile", () => {
    expect(() =>
      validateBuiltImageInspection(
        [imageInspection(PYTHON_ENTRYPOINT, "/worker")],
        IMAGE,
        PYTHON_IMAGE_INSPECTION_PROFILE,
      ),
    ).not.toThrow();
    expect(() =>
      validateBuiltImageInspection(
        [imageInspection(NODE_ENTRYPOINT, "/input")],
        IMAGE,
        NODE_IMAGE_INSPECTION_PROFILE,
      ),
    ).not.toThrow();

    for (const [value, profile] of [
      [
        imageInspection(PYTHON_ENTRYPOINT, "/worker"),
        NODE_IMAGE_INSPECTION_PROFILE,
      ],
      [
        imageInspection(NODE_ENTRYPOINT, "/input"),
        PYTHON_IMAGE_INSPECTION_PROFILE,
      ],
      [
        imageInspection(PYTHON_ENTRYPOINT, "/input"),
        PYTHON_IMAGE_INSPECTION_PROFILE,
      ],
    ] as const)
      expect(() =>
        validateBuiltImageInspection([value], IMAGE, profile),
      ).toThrow();

    const criticalMutations: Array<
      (value: ReturnType<typeof imageInspection>) => void
    > = [
      (value) => {
        value.Id = `sha256:${"3".repeat(64)}`;
      },
      (value) => {
        value.Os = "windows";
      },
      (value) => {
        value.Architecture = "arm64";
      },
      (value) => {
        value.Config.User = "0:0";
      },
      (value) => {
        value.Config.Cmd = ["sh"];
      },
      (value) => {
        value.Config.ExposedPorts = { "80/tcp": {} };
      },
      (value) => {
        value.Config.Env = ["TOKEN=value"];
      },
    ];
    for (const mutate of criticalMutations) {
      const value = imageInspection(PYTHON_ENTRYPOINT, "/worker");
      mutate(value);
      expect(() =>
        validateBuiltImageInspection(
          [value],
          IMAGE,
          PYTHON_IMAGE_INSPECTION_PROFILE,
        ),
      ).toThrow();
    }
  });

  it("freezes the role-specific image profile call sites", () => {
    expect(Object.isFrozen(PYTHON_IMAGE_INSPECTION_PROFILE)).toBe(true);
    expect(Object.isFrozen(PYTHON_IMAGE_INSPECTION_PROFILE.entrypoint)).toBe(
      true,
    );
    expect(Object.isFrozen(NODE_IMAGE_INSPECTION_PROFILE)).toBe(true);
    expect(Object.isFrozen(NODE_IMAGE_INSPECTION_PROFILE.entrypoint)).toBe(
      true,
    );
    expect(runnerSource).toContain(
      "verifyBuiltImage(pythonImageId, PYTHON_IMAGE_INSPECTION_PROFILE)",
    );
    expect(runnerSource).toContain(
      "verifyBuiltImage(nodeImageId, NODE_IMAGE_INSPECTION_PROFILE)",
    );
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
      const value = inspection(PYTHON_ENTRYPOINT, "/worker");
      mutate(value);
      expect(() =>
        validateContainerInspection(
          value,
          CONTAINER_ID,
          CONTAINER_NAME,
          IMAGE,
          ARCHIVE_PATH,
          PYTHON_IMAGE_INSPECTION_PROFILE,
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

function inspection(
  entrypoint: readonly string[],
  workingDirectory: string,
): {
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
      WorkingDir: workingDirectory,
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

function imageInspection(
  entrypoint: readonly string[],
  workingDirectory: string,
): {
  Architecture: string;
  Config: Record<string, unknown>;
  Id: string;
  Os: string;
} {
  return {
    Architecture: "amd64",
    Config: {
      Cmd: null,
      Entrypoint: [...entrypoint],
      Env: ["PATH=/usr/local/bin:/usr/bin:/bin"],
      ExposedPorts: null,
      User: "65532:65532",
      WorkingDir: workingDirectory,
    },
    Id: IMAGE,
    Os: "linux",
  };
}
