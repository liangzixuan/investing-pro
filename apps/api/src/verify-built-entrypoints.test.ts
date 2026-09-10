import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyBuiltApiEntrypoints } from "./verify-built-entrypoints";

const directories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("built API entrypoint smoke", () => {
  it("resolves native SQLite for both entrypoints without inherited application configuration", async () => {
    for (const key of [
      "RESEARCH_COCKPIT_MODE",
      "RESEARCH_COCKPIT_VAULT_ROOT",
      "RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET",
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH",
      "PERSONAL_SEC_USER_AGENT",
      "PERSONAL_MARKET_DATA_TIINGO_TOKEN",
      "NODE_OPTIONS",
    ]) {
      vi.stubEnv(key, "parent-only-canary");
    }
    const directory = await fixture();
    const checkEnvironment = `
      import { DatabaseSync, backup, constants } from "node:sqlite";
      if (typeof DatabaseSync !== "function" || typeof backup !== "function" || !constants) {
        throw new Error("Native SQLite exports are missing.");
      }
      if (Object.values(process.env).includes("parent-only-canary")) {
        throw new Error("Parent environment leaked.");
      }
    `;
    await writeEntry(
      directory,
      "workspace",
      checkEnvironment + failure("workspace"),
    );
    await writeEntry(directory, "vault", checkEnvironment + failure("vault"));

    expect(() => verifyBuiltApiEntrypoints(directory)).not.toThrow();
  });

  it.each([
    ["bare SQLite import", 'import "sqlite";'],
    [
      "wrong exit code",
      failure("vault").replace("exitCode = 1", "exitCode = 0"),
    ],
    [
      "unexpected stdout",
      'process.stdout.write("unexpected");' + failure("vault"),
    ],
    [
      "unexpected diagnostics",
      'process.stderr.write("private-output-canary");' + failure("vault"),
    ],
    [
      "excessive output",
      'process.stderr.write("x".repeat(16_384));' + failure("vault"),
    ],
  ])("rejects %s without exposing child diagnostics", async (_name, source) => {
    const directory = await fixture();
    await writeEntry(directory, "vault", source);

    expect(() => verifyBuiltApiEntrypoints(directory)).toThrow(
      "The built personal vault API entrypoint failed its isolated startup smoke.",
    );
  });

  it("terminates an entrypoint that does not exit", async () => {
    const directory = await fixture();
    await writeEntry(directory, "workspace", "setInterval(() => {}, 1_000);");

    expect(() => verifyBuiltApiEntrypoints(directory)).toThrow(
      "The built personal workspace API entrypoint failed its isolated startup smoke.",
    );
  }, 15_000);
});

async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "api-entry-smoke-"));
  directories.push(directory);
  await mkdir(join(directory, "dist/src"), { recursive: true });
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  await writeEntry(directory, "workspace", failure("workspace"));
  await writeEntry(directory, "vault", failure("vault"));
  return directory;
}

async function writeEntry(
  directory: string,
  mode: "workspace" | "vault",
  source: string,
) {
  await writeFile(join(directory, "dist/src", `${mode}-server.js`), source);
}

function failure(mode: "workspace" | "vault"): string {
  return `process.stderr.write("Research Cockpit personal ${mode} API failed to start.\\n"); process.exitCode = 1;`;
}
