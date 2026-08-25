import { describe, expect, it } from "vitest";

import { FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL } from "@research-cockpit/filing-parser-normalization-execution";

import {
  exactCreateArguments,
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

describe("filing parser normalization execution live Docker audit", () => {
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
