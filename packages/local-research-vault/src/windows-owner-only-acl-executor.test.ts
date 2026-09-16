import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GithubActionsReporter } from "vitest/reporters";

import { LocalResearchVaultError } from "./errors";
import { createNativeWindowsOwnerOnlyAclPort } from "./windows-owner-only-acl";

type ChildFailure = Error & {
  code?: string | number | null;
  killed?: boolean;
  signal?: string | null;
  cmd?: string;
  stderr?: string;
};
type ChildOptions = {
  encoding: string;
  env: NodeJS.ProcessEnv;
  maxBuffer: number;
  windowsHide: boolean;
  timeout: number;
};
type ChildCallback = (
  error: ChildFailure | null,
  stdout: string,
  stderr: string,
) => void;

const { execFileMock } = vi.hoisted(() => ({
  execFileMock:
    vi.fn<
      (
        executable: string,
        args: string[],
        options: ChildOptions,
        callback: ChildCallback,
      ) => void
    >(),
}));

// Only this test file replaces the child transport. The existing native ACL
// tests continue to exercise real Windows processes and filesystem ACLs.
vi.mock("node:child_process", () => ({ execFile: execFileMock }));

const systemRoot = "C:\\Windows";
const ownerSid = "S-1-5-21-1000";
const privatePathCanary = "C:\\private-path-canary\\vault";
const requestKey = "RESEARCH_COCKPIT_WINDOWS_ACL_REQUEST_BASE64";
const target = {
  canonicalRootPath: privatePathCanary,
  targetPaths: [privatePathCanary, `${privatePathCanary}\\vault.sqlite3`],
};

beforeEach(() => {
  execFileMock.mockReset();
  vi.spyOn(performance, "now").mockReturnValue(1_000);
  vi.stubGlobal("process", {
    ...process,
    platform: "win32",
    env: { ...process.env, SystemRoot: systemRoot },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  execFileMock.mockReset();
});

async function rejectedVerification() {
  const result: unknown = await createNativeWindowsOwnerOnlyAclPort()
    .verifyOwnerOnly(target)
    .catch((error: unknown) => error);
  expect(result).toBeInstanceOf(LocalResearchVaultError);
  const error = result as LocalResearchVaultError;
  expect(error.code).toBe("VAULT_SECURITY_BOUNDARY_REJECTED");
  expect(execFileMock).toHaveBeenCalledTimes(1);
  if (error.cause !== undefined) {
    expect(error.cause).toBeInstanceOf(Error);
    expect(Object.keys(error.cause as Error).sort()).toEqual([
      "code",
      "elapsedMs",
      "killed",
      "name",
      "signal",
      "stage",
    ]);
  }
  return error;
}

describe("native Windows ACL child transport", () => {
  it.each([
    {
      name: "timeout with SIGTERM",
      code: null,
      killed: true,
      signal: "SIGTERM",
    },
    { name: "exit 1", code: 1, killed: false, signal: null },
    {
      name: "output bound failure",
      code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
      killed: false,
      signal: null,
    },
  ])("rejects $name even when stdout contains a valid SID", async (failure) => {
    execFileMock.mockImplementation(
      (_executable, _args, _options, callback) => {
        callback(
          Object.assign(new Error("synthetic native failure"), failure),
          ownerSid,
          "acl:script_started\r\nacl:target_started\r\n",
        );
      },
    );

    const error = await rejectedVerification();
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.cause).toMatchObject({
      name: "NativeWindowsAclCommandError",
      stage: "target_started",
      code: failure.code,
      killed: failure.killed,
      signal: failure.signal,
      elapsedMs: 0,
    });
    expect(error).not.toHaveProperty("verifiedPaths");
    expect(execFileMock.mock.calls[0]![2]).toMatchObject({
      timeout: 15_000,
      maxBuffer: 16 * 1024,
      windowsHide: true,
    });
  });

  it("retains only allowlisted stage and process fields from private-looking errors", async () => {
    let requestCanary = "";
    execFileMock.mockImplementation((_executable, _args, options, callback) => {
      requestCanary = options.env[requestKey]!;
      const stderr = [
        `arbitrary stderr ${privatePathCanary} ${ownerSid} ${requestCanary}`,
        "acl:script_started",
        "acl:request_decoded",
        "acl:identity_resolved",
        "acl:target_started",
        "acl:target_verified",
        "acl:not_an_allowlisted_stage",
        "prefix acl:script_started",
        "acl:target_started trailing data",
        "",
      ].join("\r\n");
      callback(
        Object.assign(new Error(stderr), {
          code: 1,
          killed: false,
          signal: null,
          cmd: `${privatePathCanary} ${requestCanary}`,
          stderr,
        }),
        ownerSid,
        stderr,
      );
    });

    const error = await rejectedVerification();
    expect(error.cause).toMatchObject({
      stage: "target_verified",
      code: 1,
      killed: false,
      signal: null,
      elapsedMs: 0,
    });
    const cause = error.cause as Error;
    const retained = `${error.message}\n${error.stack}\n${cause.message}\n${cause.stack}\n${JSON.stringify(cause)}`;
    for (const canary of [
      privatePathCanary,
      ownerSid,
      requestCanary,
      "arbitrary stderr",
      "not_an_allowlisted_stage",
    ]) {
      expect(retained).not.toContain(canary);
    }
  });

  it("reports process_start when no exact allowlisted stage was emitted", async () => {
    execFileMock.mockImplementation(
      (_executable, _args, _options, callback) => {
        callback(
          Object.assign(new Error(privatePathCanary), {
            code: null,
            killed: true,
            signal: "SIGTERM",
          }),
          ownerSid,
          `#< CLIXML\nacl:unknown\nprefix acl:script_started\nacl:request_decoded ${privatePathCanary}\n`,
        );
      },
    );

    const error = await rejectedVerification();
    expect(error.cause).toMatchObject({
      stage: "process_start",
      code: null,
      killed: true,
      signal: "SIGTERM",
      elapsedMs: 0,
    });
  });

  it("discards arbitrary text placed in child code and signal fields", async () => {
    execFileMock.mockImplementation((_executable, _args, options, callback) => {
      callback(
        Object.assign(new Error(privatePathCanary), {
          code: privatePathCanary,
          killed: false,
          signal: options.env[requestKey]!,
        }),
        ownerSid,
        "acl:script_started\n",
      );
    });
    const error = await rejectedVerification();
    expect(error.cause).toMatchObject({
      stage: "script_started",
      code: null,
      killed: false,
      signal: null,
      elapsedMs: 0,
    });
  });

  it("prints safe child diagnostics in the pinned CI reporter without disclosing native output", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(16_246.4);
    let requestCanary = "";
    execFileMock.mockImplementation((_executable, _args, options, callback) => {
      requestCanary = options.env[requestKey]!;
      callback(
        Object.assign(new Error(privatePathCanary), {
          code: null,
          killed: true,
          signal: "SIGTERM",
          cmd: requestCanary,
        }),
        ownerSid,
        `private stderr ${privatePathCanary}\nacl:identity_resolved\n`,
      );
    });

    const error = await rejectedVerification();
    expect(error.message).toBe(
      "The local research vault operation was rejected.",
    );
    expect(error.cause).toMatchObject({ elapsedMs: 15_246 });
    const output = renderCiFailure(error);
    expect(output).toContain("::error");
    expect(output).toContain("VAULT_SECURITY_BOUNDARY_REJECTED");
    expect(output).toContain("Caused by: NativeWindowsAclCommandError");
    expect(output).toContain("stage: 'identity_resolved'");
    expect(output).toContain("code: null");
    expect(output).toContain("killed: true");
    expect(output).toContain("signal: 'SIGTERM'");
    expect(output).toContain("elapsedMs: 15246");
    for (const canary of [
      privatePathCanary,
      ownerSid,
      requestCanary,
      "private stderr",
    ]) {
      expect(output).not.toContain(canary);
    }
  });

  it("uses one fixed hidden command while transferring each request only in the environment", async () => {
    execFileMock.mockImplementation(
      (_executable, _args, _options, callback) => {
        callback(null, `${ownerSid}\r\n`, "acl:target_verified\r\n");
      },
    );
    const port = createNativeWindowsOwnerOnlyAclPort();
    await expect(
      port.provisionAndVerifyOwnerOnly(target),
    ).resolves.toMatchObject({
      ownerIdentity: ownerSid,
      verifiedPaths: target.targetPaths,
      ownerOnly: true,
      inheritanceProtected: true,
    });
    await expect(port.verifyOwnerOnly(target)).resolves.toMatchObject({
      ownerIdentity: ownerSid,
      verifiedPaths: target.targetPaths,
    });

    expect(execFileMock).toHaveBeenCalledTimes(2);
    const [provision, verification] = execFileMock.mock.calls;
    expect(provision![0]).toBe(
      join(
        systemRoot,
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      ),
    );
    expect(verification![0]).toBe(provision![0]);
    expect(provision![1]).toHaveLength(5);
    expect(provision![1].slice(0, 4)).toEqual([
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
    ]);
    expect(verification![1]).toEqual(provision![1]);
    const encodedCommand = provision![1][4]!;
    const decodedCommand = Buffer.from(encodedCommand, "base64").toString(
      "utf16le",
    );
    expect(Buffer.from(decodedCommand, "utf16le").toString("base64")).toBe(
      encodedCommand,
    );
    expect(decodedCommand).toContain("Assert-OwnerOnlyAcl");
    for (const [index, call] of execFileMock.mock.calls.entries()) {
      const { env, ...transportOptions } = call[2];
      expect(transportOptions).toEqual({
        encoding: "utf8",
        maxBuffer: 16 * 1024,
        windowsHide: true,
        timeout: 15_000,
      });
      expect(env["SystemRoot"]).toBe(systemRoot);
      const encodedRequest = call[2].env[requestKey]!;
      expect(
        Buffer.from(encodedRequest, "base64").toString("utf8").split("\0"),
      ).toEqual([index === 0 ? "provision" : "verify", ...target.targetPaths]);
      expect(call[1].join(" ")).not.toContain(encodedRequest);
      expect(decodedCommand).not.toContain(privatePathCanary);
      expect(decodedCommand).not.toContain(ownerSid);
    }
  });

  it("rejects a successful child whose SID stdout is mixed with diagnostic text", async () => {
    execFileMock.mockImplementation(
      (_executable, _args, _options, callback) => {
        callback(null, `acl:target_verified\n${ownerSid}`, "");
      },
    );
    const error = await rejectedVerification();
    expect(error.cause).toBeUndefined();
  });
});

function renderCiFailure(error: LocalResearchVaultError): string {
  const output: string[] = [];
  const file = fileURLToPath(import.meta.url);
  // Supply only the reporter's transformed-source lookup and output sink.
  // This exercises its actual nested-cause formatting without starting Vite
  // or a second test runner, and never executes a native child.
  const project = {
    config: { root: process.cwd() },
    _vite: {
      environments: {
        test: {
          moduleGraph: {
            getModulesByFile: () => new Set([{ transformResult: {} }]),
          },
        },
      },
    },
  };
  const reporter = new GithubActionsReporter({
    jobSummary: { enabled: false },
  });
  reporter.onInit({
    getRootProject: () => project,
    logger: {
      highlight: (_path: string, source: string) => source,
      log: (message: string) => output.push(message),
    },
  } as unknown as Parameters<GithubActionsReporter["onInit"]>[0]);
  const reported = Object.assign(error, {
    stacks: [{ file, line: 1, column: 1, method: "syntheticAclFailure" }],
  });
  reporter.onTestRunEnd(
    [],
    [
      reported as unknown as Parameters<
        GithubActionsReporter["onTestRunEnd"]
      >[1][number],
    ],
  );
  return output.join("\n");
}
