import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { preProcessFile } from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = resolve(import.meta.dirname);
const CONNECTED_ENTRY = resolve(SOURCE_DIRECTORY, "connected-server.ts");

describe("connected startup static graph", () => {
  it("contains only the bounded connected administration and owner-session modules", async () => {
    const graph = await staticGraph(CONNECTED_ENTRY);
    expect([...graph.files].sort()).toEqual([
      "connected-app.ts",
      "connected-composition-root.ts",
      "connected-server.ts",
      "connected-source-policy-composition.ts",
      "connected-source-policy-routes.ts",
      "listen-options.ts",
      "personal-owner-session-routes.ts",
      "personal-owner-session.ts",
    ]);
    for (const forbiddenSpecifier of [
      "node:child_process",
      "@research-cockpit/personal-filing-corpus",
      "@research-cockpit/research-core",
      "@research-cockpit/research-state",
    ]) {
      expect([...graph.specifiers]).not.toContain(forbiddenSpecifier);
    }
    for (const forbiddenFile of [
      "app.ts",
      "composition-root.ts",
      "demo-research-state.ts",
      "personal-dossier-release.ts",
      "personal-selected-fact-release.ts",
      "research-state-routes.ts",
    ]) {
      expect([...graph.files]).not.toContain(forbiddenFile);
    }
  });

  it("publishes a distinct non-splitting connected build and start surface", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(SOURCE_DIRECTORY, "../package.json"), "utf8"),
    ) as { scripts?: Record<string, unknown> };
    const buildConfig = await readFile(
      resolve(SOURCE_DIRECTORY, "../tsup.config.ts"),
      "utf8",
    );
    expect(packageJson.scripts?.["dev:connected"]).toBe(
      "tsx watch src/connected-server.ts",
    );
    expect(packageJson.scripts?.["start:connected"]).toBe(
      "node dist/src/connected-server.js",
    );
    expect(buildConfig).toContain('"src/connected-server.ts"');
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
      const dependency = resolve(
        dirname(path),
        imported.fileName.endsWith(".ts")
          ? imported.fileName
          : `${imported.fileName}.ts`,
      );
      pending.push(dependency);
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
