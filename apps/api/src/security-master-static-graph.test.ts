import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { preProcessFile } from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = resolve(import.meta.dirname);
const SECURITY_MASTER_ENTRY = resolve(
  SOURCE_DIRECTORY,
  "security-master-server.ts",
);

describe("personal security-master startup static graph", () => {
  it("contains only security-master, owner-session, and loopback composition modules", async () => {
    const graph = await staticGraph(SECURITY_MASTER_ENTRY);
    expect([...graph.files].sort()).toEqual([
      "listen-options.ts",
      "personal-owner-session-routes.ts",
      "personal-owner-session.ts",
      "personal-security-master-routes.ts",
      "security-master-app.ts",
      "security-master-composition-root.ts",
      "security-master-server.ts",
    ]);
    expect([...graph.specifiers]).toContain(
      "@research-cockpit/personal-security-master",
    );
    for (const forbiddenSpecifier of [
      "node:child_process",
      "dns",
      "http",
      "https",
      "net",
      "node:dns",
      "node:http",
      "node:http2",
      "node:https",
      "node:net",
      "node:tls",
      "tls",
      "undici",
      "@research-cockpit/connected-source-policy",
      "@research-cockpit/local-research-vault",
      "@research-cockpit/personal-filing-corpus",
      "@research-cockpit/research-core",
      "@research-cockpit/research-state",
    ]) {
      expect([...graph.specifiers]).not.toContain(forbiddenSpecifier);
    }
    for (const forbiddenFile of [
      "app.ts",
      "connected-app.ts",
      "connected-composition-root.ts",
      "demo-research-state.ts",
      "personal-dossier-release.ts",
      "personal-selected-fact-release.ts",
      "personal-vault-routes.ts",
      "research-state-routes.ts",
      "vault-app.ts",
      "vault-composition-root.ts",
    ]) {
      expect([...graph.files]).not.toContain(forbiddenFile);
    }
    expect(graph.source).not.toMatch(/\bfetch\s*\(/u);
    expect(graph.source).not.toContain("providerSecurityId");
    expect([...graph.processFiles]).toEqual(["security-master-server.ts"]);
  });

  it("publishes a distinct non-splitting security-master build and start surface", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(SOURCE_DIRECTORY, "../package.json"), "utf8"),
    ) as { scripts?: Record<string, unknown> };
    const buildConfig = await readFile(
      resolve(SOURCE_DIRECTORY, "../tsup.config.ts"),
      "utf8",
    );
    expect(packageJson.scripts?.["dev:security-master"]).toBe(
      "tsx watch src/security-master-server.ts",
    );
    expect(packageJson.scripts?.["start:security-master"]).toBe(
      "node dist/src/security-master-server.js",
    );
    expect(buildConfig).toContain('"src/security-master-server.ts"');
    expect(buildConfig).toContain("splitting: false");
  });

  it("retains snapshot-byte ownership until the stable descriptor closes", async () => {
    const source = await readFile(
      resolve(SOURCE_DIRECTORY, "security-master-composition-root.ts"),
      "utf8",
    );
    const closeIndex = source.indexOf("await handle.close();");
    const transferIndex = source.indexOf("const owned = bytes;");
    const clearIndex = source.indexOf("bytes = undefined;", transferIndex);
    const returnIndex = source.indexOf("return owned;", clearIndex);
    const wipeIndex = source.indexOf("bytes?.fill(0);", returnIndex);

    expect(closeIndex).toBeGreaterThan(-1);
    expect(transferIndex).toBeGreaterThan(closeIndex);
    expect(clearIndex).toBeGreaterThan(transferIndex);
    expect(returnIndex).toBeGreaterThan(clearIndex);
    expect(wipeIndex).toBeGreaterThan(returnIndex);
  });
});

async function staticGraph(entry: string) {
  const pending = [entry];
  const visited = new Set<string>();
  const specifiers = new Set<string>();
  const sources: string[] = [];
  const processPaths = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(path, "utf8");
    sources.push(source);
    if (/\bprocess\./u.test(source)) processPaths.add(path);
    for (const imported of preProcessFile(source, true, true).importedFiles) {
      specifiers.add(imported.fileName);
      if (!imported.fileName.startsWith(".")) continue;
      pending.push(
        resolve(
          dirname(path),
          imported.fileName.endsWith(".ts")
            ? imported.fileName
            : `${imported.fileName}.ts`,
        ),
      );
    }
  }
  return {
    files: new Set(
      [...visited].map((path) =>
        relative(SOURCE_DIRECTORY, path).replaceAll("\\", "/"),
      ),
    ),
    processFiles: new Set(
      [...processPaths].map((path) =>
        relative(SOURCE_DIRECTORY, path).replaceAll("\\", "/"),
      ),
    ),
    specifiers,
    source: sources.join("\n"),
  };
}
