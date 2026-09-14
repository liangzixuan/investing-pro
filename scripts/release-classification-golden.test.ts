import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import { format, resolveConfig } from "prettier";
import { beforeAll, describe, expect, it } from "vitest";

import {
  RELEASE_CLASSIFICATION_ADAPTER_PATHS,
  renderReleaseClassification,
} from "./release-classification-render";
import type {
  ReleaseClassificationChange,
  ReleaseClassificationRenderDescriptor,
} from "./release-classification-render";
import golden from "./release-classification/fixtures/ppe-golden.json";

const repository = realpathSync(resolve(import.meta.dirname, ".."));
const gitEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => {
    const normalized = name.toUpperCase();
    return !normalized.startsWith("GIT_") && normalized !== "NODE_OPTIONS";
  }),
);
const sources = new Map<string, string>();
const expectedSources = new Map<string, string>();

function git(...args: readonly string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${repository.replaceAll("\\", "/")}`,
      "-c",
      "core.fsmonitor=false",
      "--no-optional-locks",
      "-C",
      repository,
      ...args,
    ],
    {
      cwd: repository,
      env: { ...gitEnvironment, LC_ALL: "C", LANG: "C" },
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 30_000,
    },
  );
}

function sha256(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

function readBlob(blob: string, expectedHash: string): string {
  expect(blob).toMatch(/^[0-9a-f]{40}$/u);
  const source = git("cat-file", "blob", blob).replaceAll("\r\n", "\n");
  expect(sha256(source), `Immutable Git blob ${blob}`).toBe(expectedHash);
  expect(source.endsWith("\n"), `Final newline of ${blob}`).toBe(true);
  return source;
}

function changes(
  entries: readonly { readonly path: string; readonly status: string }[],
): readonly ReleaseClassificationChange[] {
  return entries.map(({ path, status }) => {
    if (status !== "A" && status !== "M")
      throw new Error("Unsupported golden inventory status");
    return { path, status };
  });
}

const descriptor: ReleaseClassificationRenderDescriptor = {
  version: 1,
  caseNumber: 10,
  baselineRevision: golden.baselineRevision,
  predecessorRevision: golden.predecessorRevision,
  featureRevision: golden.featureRevision,
  featureCount: golden.counts.feature.total,
  closureCount: golden.counts.closure.total,
  featureChanges: changes(golden.featureInventory),
  closureChanges: changes(golden.closureInventory),
  presentation: golden.presentation,
};

function inventory(before: string, after: string) {
  const values = git(
    "diff",
    "--name-status",
    "--no-renames",
    "-z",
    before,
    after,
    "--",
  ).split("\0");
  expect(values.pop()).toBe("");
  expect(values.length % 2).toBe(0);
  const entries: { path: string; status: string }[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const status = values[index];
    const path = values[index + 1];
    if (status === undefined || path === undefined)
      throw new Error("Incomplete historical Git inventory");
    entries.push({ path, status });
  }
  return entries;
}

beforeAll(() => {
  // The fixture pins accepted Git objects independently of this renderer. Never
  // read current adapters or regenerate expected files to update this golden.
  for (const output of golden.outputs) {
    expect(
      git("rev-parse", `${golden.predecessorRevision}:${output.path}`).trim(),
    ).toBe(output.predecessorBlob);
    expect(
      git("rev-parse", `${golden.featureRevision}:${output.path}`).trim(),
    ).toBe(output.beforeBlob);
    expect(
      git("rev-parse", `${golden.closureRevision}:${output.path}`).trim(),
    ).toBe(output.afterBlob);
    expect(output.predecessorBlob).toBe(output.beforeBlob);
    expect(output.predecessorSha256).toBe(output.beforeSha256);
    sources.set(output.path, readBlob(output.beforeBlob, output.beforeSha256));
    expectedSources.set(
      output.path,
      readBlob(output.afterBlob, output.afterSha256),
    );
  }
}, 60_000);

describe("independent accepted PP&E release-classification golden", () => {
  it("binds the exact immutable feature, closure, parents and inventories", () => {
    expect(golden.featureRevision).toBe(
      "662ba389ed467667e00273ff9614f423ac70e48a",
    );
    expect(golden.closureRevision).toBe(
      "8810d9923283efa534fa69ea3cb6da3d4136f97e",
    );
    expect(
      git("rev-list", "--parents", "-n", "1", golden.featureRevision).trim(),
    ).toBe(`${golden.featureRevision} ${golden.predecessorRevision}`);
    expect(
      git("rev-list", "--parents", "-n", "1", golden.closureRevision).trim(),
    ).toBe(`${golden.closureRevision} ${golden.featureRevision}`);
    for (const [revision, counts] of [
      [golden.predecessorRevision, golden.counts.predecessor],
      [golden.featureRevision, golden.counts.feature],
      [golden.closureRevision, golden.counts.closure],
    ] as const) {
      const range = `${golden.baselineRevision}..${revision}`;
      expect(git("rev-list", "--count", range).trim()).toBe(
        String(counts.total),
      );
      expect(git("rev-list", "--first-parent", "--count", range).trim()).toBe(
        String(counts.firstParent),
      );
    }
    expect(golden.featureInventory).toHaveLength(15);
    expect(golden.closureInventory).toHaveLength(8);
    expect(
      inventory(golden.predecessorRevision, golden.featureRevision),
    ).toEqual(golden.featureInventory);
    expect(inventory(golden.featureRevision, golden.closureRevision)).toEqual(
      golden.closureInventory,
    );
    expect(golden.outputs.map(({ path }) => path)).toEqual(
      RELEASE_CLASSIFICATION_ADAPTER_PATHS,
    );
  });

  it("reproduces all eight full historical files and preserves the source map", async () => {
    const original = [...sources];
    const generated = renderReleaseClassification(sources, descriptor);
    expect([...generated.keys()]).toEqual(
      golden.outputs.map(({ path }) => path),
    );
    expect([...sources]).toEqual(original);
    for (const output of golden.outputs) {
      const source = generated.get(output.path);
      if (source === undefined)
        throw new Error(`Missing output: ${output.path}`);
      const filepath = resolve(repository, output.path);
      const actual = output.path.endsWith(".sh")
        ? source
        : await format(source, {
            ...(await resolveConfig(filepath, { editorconfig: true })),
            filepath,
          });
      expect(sha256(actual), `${output.path}: independent golden digest`).toBe(
        output.afterSha256,
      );
      expect(actual, `${output.path}: complete immutable closure text`).toBe(
        expectedSources.get(output.path),
      );
    }
  }, 30_000);

  it("produces identical complete output on two independent render calls", () => {
    const first = renderReleaseClassification(new Map(sources), descriptor);
    const second = renderReleaseClassification(new Map(sources), descriptor);
    expect([...first.keys()]).toEqual([...second.keys()]);
    for (const path of first.keys()) {
      expect(first.get(path) === second.get(path), path).toBe(true);
    }
  });

  it.each(golden.outputs.map(({ path }) => path))(
    "rejects a missing predecessor adapter: %s",
    (path) => {
      const changed = new Map(sources);
      changed.delete(path);
      expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
    },
  );

  it("rejects an additional map entry", () => {
    const changed = new Map(sources);
    changed.set("unreviewed.ts", "export {};\n");
    expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
  });

  it("rejects a substituted map entry even when its count is eight", () => {
    const changed = new Map(sources);
    changed.delete(RELEASE_CLASSIFICATION_ADAPTER_PATHS[0]);
    changed.set("unreviewed.yml", "name: unreviewed\n");
    expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
  });

  const tsPaths = golden.outputs
    .map(({ path }) => path)
    .filter((path) => path.endsWith(".ts"));
  it.each(tsPaths)("rejects a missing prior feature anchor in %s", (path) => {
    const source = sources.get(path);
    if (source === undefined)
      throw new Error("Missing golden TypeScript source");
    const changed = new Map(sources);
    changed.set(
      path,
      source.replace(
        "const CYCLE_3K_A9_FEATURE_REVISION =",
        "const REMOVED_FEATURE_REVISION =",
      ),
    );
    expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
  });

  it.each(tsPaths)(
    "rejects an ambiguous prior feature anchor in %s",
    (path) => {
      const source = sources.get(path);
      if (source === undefined)
        throw new Error("Missing golden TypeScript source");
      const declaration = source.match(
        /const CYCLE_3K_A9_FEATURE_REVISION =\n {2}"[0-9a-f]{40}" as const;/u,
      )?.[0];
      if (declaration === undefined)
        throw new Error("Missing historical anchor");
      const changed = new Map(sources);
      changed.set(path, `${source}\n${declaration}\n`);
      expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
    },
  );

  it("rejects a changed cross-engine caller guard", () => {
    const path = RELEASE_CLASSIFICATION_ADAPTER_PATHS[1];
    const source = sources.get(path);
    if (source === undefined)
      throw new Error("Missing golden cross-engine YAML");
    const changed = new Map(sources);
    changed.set(
      path,
      source.replace(
        "id: cycle3e_source\n        if: ${{ success() }}",
        "id: cycle3e_source\n        if: ${{ always() }}",
      ),
    );
    expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
  });

  it("rejects a Bash source without its required final LF", () => {
    const path = RELEASE_CLASSIFICATION_ADAPTER_PATHS[7];
    const source = sources.get(path);
    if (source === undefined) throw new Error("Missing golden Bash source");
    const changed = new Map(sources);
    changed.set(path, source.slice(0, -1));
    expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
  });

  it("rejects unnormalized CRLF in an input adapter", () => {
    const path = RELEASE_CLASSIFICATION_ADAPTER_PATHS[0];
    const source = sources.get(path);
    if (source === undefined) throw new Error("Missing golden YAML source");
    const changed = new Map(sources);
    changed.set(path, source.replaceAll("\n", "\r\n"));
    expect(() => renderReleaseClassification(changed, descriptor)).toThrow();
  });
});
