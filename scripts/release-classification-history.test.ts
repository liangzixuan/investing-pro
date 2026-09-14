import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { RELEASE_CLASSIFICATION_ADAPTER_PATHS } from "./release-classification-render.js";
import {
  BOOTSTRAP_PREDECESSOR,
  CLASSIFICATION_BASELINE,
  generateReleaseOutputs,
  inspectRelease,
  parseReleaseDescriptor,
  RELEASE_DIRECTORY,
  verifyGeneratedHistory,
  writeReleaseOutputs,
} from "./release-classification.js";
import type {
  ReleaseDescriptor,
  ReleaseGitReader,
} from "./release-classification.js";

const repository = realpathSync(resolve(import.meta.dirname, ".."));
const ownedTemporaryRoot = realpathSync(tmpdir());
const temporaryPrefix = "release-classification-history-";
const directories: string[] = [];
const feature14 = "1".repeat(40);
const closure14 = "2".repeat(40);
const feature15 = "3".repeat(40);
const closure15 = "4".repeat(40);
const bootstrapSources = new Map<string, string>();
let priorOutputs: Map<string, string>;
let nextOutputs: Map<string, string>;

function descriptor(caseNumber: 14 | 15): ReleaseDescriptor {
  const descriptorPath = `${RELEASE_DIRECTORY}/cycle3ka${caseNumber}.json`;
  return parseReleaseDescriptor(
    JSON.stringify({
      version: 1,
      caseNumber,
      baselineRevision: CLASSIFICATION_BASELINE,
      predecessorRevision:
        caseNumber === 14 ? BOOTSTRAP_PREDECESSOR : closure14,
      featureRevision: caseNumber === 14 ? feature14 : feature15,
      featureCount: 101 + 2 * caseNumber,
      closureCount: 102 + 2 * caseNumber,
      featureChanges: [{ path: "docs/example.md", status: "M" }],
      closureChanges: [
        ...RELEASE_CLASSIFICATION_ADAPTER_PATHS.map((path) => ({
          path,
          status: "M",
        })),
        { path: descriptorPath, status: "A" },
      ].sort((left, right) => (left.path < right.path ? -1 : 1)),
      descriptorPath,
      presentation: {
        featureDescription: "synthetic declared release",
        closureDescription: "synthetic declared release",
        inventoryDescription: "synthetic declared release",
        testBinding: caseNumber === 14 ? "historyBootstrap" : "historyNext",
        routingDescription: "synthetic declared release",
        summaryDescription: "synthetic declared release with preserved history",
      },
    }),
  );
}

const prior = descriptor(14);
const next = descriptor(15);

function adapters(source: ReadonlyMap<string, string>): Map<string, string> {
  return new Map(
    RELEASE_CLASSIFICATION_ADAPTER_PATHS.map((path) => {
      const text = source.get(path);
      if (text === undefined)
        throw new Error(`Missing synthetic adapter ${path}`);
      return [path, text];
    }),
  );
}

function reader(
  previous: ReadonlyMap<string, string> = priorOutputs,
  current: ReadonlyMap<string, string> = nextOutputs,
): ReleaseGitReader {
  const blobs = new Map<string, ReadonlyMap<string, string>>([
    [BOOTSTRAP_PREDECESSOR, bootstrapSources],
    [feature14, bootstrapSources],
    [closure14, previous],
    [feature15, previous],
    [closure15, new Map([...previous, ...current])],
  ]);
  const parents = new Map([
    [feature14, [BOOTSTRAP_PREDECESSOR]],
    [closure14, [feature14]],
    [feature15, [closure14]],
    [closure15, [feature15]],
  ]);
  const counts = new Map([
    [BOOTSTRAP_PREDECESSOR, 128],
    [feature14, 129],
    [closure14, 130],
    [feature15, 131],
    [closure15, 132],
  ]);
  return {
    head: () => feature15,
    status: () => "",
    parents: (pin) => {
      const result = parents.get(pin);
      if (result === undefined) throw new Error("Unexpected synthetic parent");
      return result;
    },
    count: (baseline, pin) => {
      if (baseline !== CLASSIFICATION_BASELINE || !counts.has(pin))
        throw new Error("Unexpected synthetic count");
      return counts.get(pin) ?? -1;
    },
    changes: (parent, pin) => {
      if (parent === BOOTSTRAP_PREDECESSOR && pin === feature14)
        return prior.featureChanges;
      if (parent === feature14 && pin === closure14)
        return prior.closureChanges;
      if (parent === closure14 && pin === feature15) return next.featureChanges;
      if (parent === feature15 && pin === closure15) return next.closureChanges;
      throw new Error("Unexpected synthetic inventory");
    },
    blob: (pin, path) => {
      const source = blobs.get(pin)?.get(path);
      if (source === undefined)
        throw new Error(`Missing synthetic blob ${pin}:${path}`);
      return source;
    },
    ancestor: (ancestor, pin) =>
      ancestor === CLASSIFICATION_BASELINE && counts.has(pin),
  };
}

function temporaryWorkspace(): string {
  const root = mkdtempSync(join(ownedTemporaryRoot, temporaryPrefix));
  directories.push(root);
  for (const [path, text] of priorOutputs) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text, "utf8");
  }
  writeFileSync(join(root, "unrelated.txt"), "preserve this local file\n");
  return root;
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function snapshot(root: string): Map<string, string> {
  const files = new Map<string, string>();
  function visit(relative = ""): void {
    for (const item of readdirSync(join(root, relative), {
      withFileTypes: true,
    })) {
      const path = relative === "" ? item.name : `${relative}/${item.name}`;
      if (item.isDirectory()) visit(path);
      else {
        if (!item.isFile()) throw new Error("Unexpected synthetic file type");
        files.set(path, digest(readFileSync(join(root, path), "utf8")));
      }
    }
  }
  visit();
  return new Map(
    [...files].sort(([left], [right]) => left.localeCompare(right)),
  );
}

beforeAll(async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(?:GIT_|NODE_OPTIONS$)/iu.test(key),
    ),
  );
  for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
    const source = execFileSync(
      "git",
      [
        "--no-replace-objects",
        "-c",
        `safe.directory=${repository.replaceAll("\\", "/")}`,
        "-C",
        repository,
        "show",
        `${BOOTSTRAP_PREDECESSOR}:${path}`,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        env,
        maxBuffer: 2 * 1024 * 1024,
        timeout: 30_000,
      },
    );
    bootstrapSources.set(path, source.replaceAll("\r\n", "\n"));
  }
  priorOutputs = await generateReleaseOutputs(bootstrapSources, prior);
  nextOutputs = await generateReleaseOutputs(adapters(priorOutputs), next);
}, 60_000);

afterEach(() => {
  for (const root of directories.splice(0)) {
    if (
      dirname(root) !== ownedTemporaryRoot ||
      !basename(root).startsWith(temporaryPrefix)
    )
      throw new Error(
        "Cleanup escaped the owned synthetic temporary directory",
      );
    rmSync(root, { recursive: true, force: true });
  }
});

describe("generated history and writes across successive declared releases", () => {
  it("accepts the generated case 14 closure as the exact history of case 15", async () => {
    expect(priorOutputs.size).toBe(9);
    expect(nextOutputs.size).toBe(9);
    await expect(
      verifyGeneratedHistory(next, reader()),
    ).resolves.toBeUndefined();
  }, 30_000);

  it("rejects inherited topology corruption even after regenerating the next release from it", async () => {
    const path =
      "packages/filing-parser/src/filing-parser-evidence-verifier.ts";
    const original = priorOutputs.get(path);
    if (original === undefined) throw new Error("Missing prior verifier");
    const oldFunction = original.match(
      /export function isCycle3ka8FeatureTopologyAllowed\([\s\S]*?\n\}/u,
    )?.[0];
    if (oldFunction === undefined)
      throw new Error("Missing inherited topology");
    const corruptFunction = oldFunction.replace(
      "successorCount ===",
      "successorCount !==",
    );
    expect(corruptFunction).not.toBe(oldFunction);
    const corruptPrior = new Map(priorOutputs);
    corruptPrior.set(path, original.replace(oldFunction, corruptFunction));
    const corruptNext = await generateReleaseOutputs(
      adapters(corruptPrior),
      next,
    );
    expect(corruptNext.get(path)).toContain(corruptFunction);
    const git = reader(corruptPrior, corruptNext);
    // Exact parents/counts/inventories and unchanged feature adapters alone pass.
    expect(inspectRelease(next, git).size).toBe(8);
    await expect(verifyGeneratedHistory(next, git)).rejects.toThrow(
      /generated historical closure/u,
    );
  }, 30_000);

  it("writes exactly nine declared outputs, preserves other files and rejects a repeated write", async () => {
    const root = temporaryWorkspace();
    const before = snapshot(root);
    await writeReleaseOutputs(root, next, nextOutputs, reader());
    const after = snapshot(root);
    const expected = new Map(before);
    for (const [path, text] of nextOutputs) {
      expected.set(path, digest(text));
      expect(readFileSync(join(root, path), "utf8")).toBe(text);
    }
    expect(after).toEqual(
      new Map(
        [...expected].sort(([left], [right]) => left.localeCompare(right)),
      ),
    );
    expect(
      [...after]
        .filter(([path, hash]) => before.get(path) !== hash)
        .map(([path]) => path)
        .sort(),
    ).toEqual(next.closureChanges.map(({ path }) => path));
    await expect(
      writeReleaseOutputs(root, next, nextOutputs, reader()),
    ).rejects.toThrow(/unchanged working adapter|output existence/u);
    expect(snapshot(root)).toEqual(after);
  }, 60_000);

  it("rejects changed physical adapter bytes despite clean Git status before writing any output", async () => {
    const root = temporaryWorkspace();
    const path = RELEASE_CLASSIFICATION_ADAPTER_PATHS[7];
    writeFileSync(
      join(root, path),
      `${priorOutputs.get(path) ?? ""}# local edit\n`,
    );
    const before = snapshot(root);
    const git = reader();
    expect(git.status()).toBe("");
    await expect(
      writeReleaseOutputs(root, next, nextOutputs, git),
    ).rejects.toThrow(/unchanged working adapter/u);
    expect(snapshot(root)).toEqual(before);
    expect(before.has(next.descriptorPath)).toBe(false);
  }, 30_000);

  it("rejects an existing descriptor even when every adapter still matches the feature", async () => {
    const root = temporaryWorkspace();
    writeFileSync(
      join(root, next.descriptorPath),
      "preserve existing descriptor\n",
    );
    const before = snapshot(root);
    await expect(
      writeReleaseOutputs(root, next, nextOutputs, reader()),
    ).rejects.toThrow(/output existence/u);
    expect(snapshot(root)).toEqual(before);
  }, 30_000);

  it("rejects reusing a prior release test binding", async () => {
    await expect(
      generateReleaseOutputs(adapters(priorOutputs), {
        ...next,
        presentation: {
          ...next.presentation,
          testBinding: prior.presentation.testBinding,
        },
      }),
    ).rejects.toThrow(/binding is already used/u);
  });
});
