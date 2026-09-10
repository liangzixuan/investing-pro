import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { preProcessFile } from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = resolve(import.meta.dirname);
const WORKSPACE_ENTRY = resolve(SOURCE_DIRECTORY, "workspace-server.ts");

describe("personal workspace startup static graph", () => {
  it("combines only catalog, vault, owner-session, market-data, SEC evidence and shared scheduling, and loopback modules", async () => {
    const graph = await staticGraph(WORKSPACE_ENTRY);
    expect([...graph.files].sort()).toEqual([
      "listen-options.ts",
      "personal-market-data-provider.ts",
      "personal-owner-session-routes.ts",
      "personal-owner-session.ts",
      "personal-sec-filing-context-parser.ts",
      "personal-sec-filing-context-provider.ts",
      "personal-sec-filings-provider.ts",
      "personal-sec-financial-provider.ts",
      "personal-sec-quarterly-evidence-provider.ts",
      "personal-sec-request-scheduler.ts",
      "personal-security-master-routes.ts",
      "personal-vault-routes.ts",
      "security-master-app.ts",
      "security-master-composition-root.ts",
      "vault-app.ts",
      "vault-composition-root.ts",
      "workspace-app.ts",
      "workspace-composition-root.ts",
      "workspace-financial-screen-routes.ts",
      "workspace-market-data-routes.ts",
      "workspace-portfolio-routes.ts",
      "workspace-screener-routes.ts",
      "workspace-sec-filing-context-routes.ts",
      "workspace-sec-quarterly-evidence-routes.ts",
      "workspace-server.ts",
      "workspace-watchlist-filings-routes.ts",
      "workspace-watchlist-routes.ts",
    ]);
    expect(
      [...graph.specifiers]
        .filter((specifier) => !specifier.startsWith("."))
        .sort(),
    ).toEqual([
      "@fastify/cors",
      "@fastify/helmet",
      "@research-cockpit/contracts",
      "@research-cockpit/local-research-vault",
      "@research-cockpit/personal-financial-analytics",
      "@research-cockpit/personal-security-master",
      "fastify",
      "node:child_process",
      "node:crypto",
      "node:fs",
      "node:fs/promises",
      "node:path",
      "node:perf_hooks",
      "node:url",
    ]);
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
    expect([...graph.processFiles].sort()).toEqual([
      "personal-sec-filing-context-parser.ts",
      "workspace-server.ts",
    ]);
  });

  it("publishes a distinct non-splitting workspace build and start surface", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(SOURCE_DIRECTORY, "../package.json"), "utf8"),
    ) as { scripts?: Record<string, unknown> };
    const buildConfig = await readFile(
      resolve(SOURCE_DIRECTORY, "../tsup.config.ts"),
      "utf8",
    );
    expect(packageJson.scripts?.["dev:workspace"]).toBe(
      "tsx watch src/workspace-server.ts",
    );
    expect(packageJson.scripts?.["start:workspace"]).toBe(
      "node dist/src/workspace-server.js",
    );
    expect(buildConfig).toContain('"src/workspace-server.ts"');
    expect(buildConfig).toContain("splitting: false");
    expect(buildConfig).toContain("removeNodeProtocol: false");
    expect(buildConfig).toContain("tsx src/copy-validators.ts ${sourceCommit}");
    const buildCompletion = await readFile(
      resolve(SOURCE_DIRECTORY, "copy-validators.ts"),
      "utf8",
    );
    expect(buildCompletion).toContain(
      "verifyBuiltApiEntrypoints(apiDirectory)",
    );
  });
});

async function staticGraph(entry: string) {
  const pending = [entry];
  const visited = new Set<string>();
  const specifiers = new Set<string>();
  const processPaths = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(path, "utf8");
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
  };
}
