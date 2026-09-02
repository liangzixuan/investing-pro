import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { preProcessFile } from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = resolve(import.meta.dirname);
const VAULT_ENTRY = resolve(SOURCE_DIRECTORY, "vault-server.ts");

describe("personal vault startup static graph", () => {
  it("contains only vault, owner-session, and loopback composition modules", async () => {
    const graph = await staticGraph(VAULT_ENTRY);
    expect([...graph.files].sort()).toEqual([
      "listen-options.ts",
      "personal-owner-session-routes.ts",
      "personal-owner-session.ts",
      "personal-vault-routes.ts",
      "vault-app.ts",
      "vault-composition-root.ts",
      "vault-server.ts",
    ]);
    expect([...graph.specifiers]).toContain(
      "@research-cockpit/local-research-vault",
    );
    for (const forbiddenSpecifier of [
      "@research-cockpit/connected-source-policy",
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
      "research-state-routes.ts",
    ]) {
      expect([...graph.files]).not.toContain(forbiddenFile);
    }
  });

  it("publishes a distinct non-splitting vault build and start surface", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(SOURCE_DIRECTORY, "../package.json"), "utf8"),
    ) as { scripts?: Record<string, unknown> };
    const buildConfig = await readFile(
      resolve(SOURCE_DIRECTORY, "../tsup.config.ts"),
      "utf8",
    );
    expect(packageJson.scripts?.["dev:vault"]).toBe(
      "tsx watch src/vault-server.ts",
    );
    expect(packageJson.scripts?.["start:vault"]).toBe(
      "node dist/src/vault-server.js",
    );
    expect(buildConfig).toContain('"src/vault-server.ts"');
    expect(buildConfig).toContain("splitting: false");
  });
});

async function staticGraph(entry: string) {
  const pending = [entry];
  const visited = new Set<string>();
  const specifiers = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(path, "utf8");
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
    specifiers,
  };
}
