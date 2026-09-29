import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
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
  runReleaseClassification,
  verifyArchivedRelease,
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

function archiveWorkspace(): string {
  const root = temporaryWorkspace();
  for (const [path, text] of nextOutputs)
    writeFileSync(join(root, path), text, "utf8");
  return root;
}

function archiveReader(
  git: ReleaseGitReader = reader(),
  head = "5".repeat(40),
): ReleaseGitReader {
  return {
    ...git,
    head: () => head,
    ancestor: (ancestor, pin) =>
      (ancestor === closure15 && pin === head) || git.ancestor(ancestor, pin),
  };
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

describe("current default verifies only the retained classification archive", () => {
  it.each(["closure", "descendant", "two-parent merge"])(
    "accepts a %s with evolved current adapters without writing or accepting current execution",
    async (kind) => {
      const root = archiveWorkspace();
      for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS)
        writeFileSync(join(root, path), "current source checked separately\n");
      const git = archiveReader(
        reader(),
        kind === "closure" ? closure15 : "5".repeat(40),
      );
      const current = {
        ...git,
        parents: (pin: string) =>
          pin === git.head() && pin !== closure15
            ? kind === "two-parent merge"
              ? [closure15, "6".repeat(40)]
              : [closure15]
            : git.parents(pin),
      };
      const before = snapshot(root);
      const result = await verifyArchivedRelease(
        root,
        next,
        closure15,
        current,
      );
      expect(result).toContain(`archive cycle3ka15 at ${closure15}`);
      expect(result).toContain(
        "all 9 archived outputs match; check wrote nothing",
      );
      expect(result).toContain(
        "Current source and execution acceptance require their separate gates.",
      );
      expect(snapshot(root)).toEqual(before);
    },
    30_000,
  );

  it.each(["older", "latest", "missing", "extra", "renamed"])(
    "rejects an installed registry with a %s descriptor change without writing",
    async (kind) => {
      const root = archiveWorkspace();
      const older = join(root, prior.descriptorPath);
      const latest = join(root, next.descriptorPath);
      if (kind === "older" || kind === "latest")
        writeFileSync(
          kind === "older" ? older : latest,
          "changed descriptor\n",
        );
      else if (kind === "missing") unlinkSync(latest);
      else if (kind === "extra")
        writeFileSync(join(root, RELEASE_DIRECTORY, "cycle3ka16.json"), "{}\n");
      else renameSync(latest, join(root, RELEASE_DIRECTORY, "renamed.json"));
      const before = snapshot(root);
      await expect(
        verifyArchivedRelease(root, next, closure15, archiveReader()),
      ).rejects.toThrow(
        /installed archived descriptor|archive registry|release registry entry/u,
      );
      expect(snapshot(root)).toEqual(before);
    },
  );

  it.each([...RELEASE_CLASSIFICATION_ADAPTER_PATHS, next.descriptorPath])(
    "rejects changed archived output %s without writing",
    async (path) => {
      const root = archiveWorkspace();
      const git = archiveReader();
      const changed = `${git.blob(closure15, path)}\n`;
      // Let the descriptor pass registry equality so its canonical renderer
      // comparison, like each adapter's comparison, must detect the mutation.
      if (path === next.descriptorPath)
        writeFileSync(join(root, path), changed);
      const before = snapshot(root);
      await expect(
        verifyArchivedRelease(root, next, closure15, {
          ...git,
          blob: (pin, candidate) =>
            pin === closure15 && candidate === path
              ? changed
              : git.blob(pin, candidate),
        }),
      ).rejects.toThrow(/generated archived closure/u);
      expect(snapshot(root)).toEqual(before);
    },
    30_000,
  );

  it.each(["parents", "total count", "first-parent count", "inventory"])(
    "rejects a changed archive closure %s",
    async (kind) => {
      const root = archiveWorkspace();
      const git = archiveReader();
      await expect(
        verifyArchivedRelease(root, next, closure15, {
          ...git,
          parents: (pin) =>
            kind === "parents" && pin === closure15
              ? [feature15, feature14]
              : git.parents(pin),
          count: (baseline, pin, firstParent) =>
            pin === closure15 &&
            ((kind === "total count" && !firstParent) ||
              (kind === "first-parent count" && firstParent))
              ? git.count(baseline, pin, firstParent) + 1
              : git.count(baseline, pin, firstParent),
          changes: (parent, pin) =>
            kind === "inventory" && pin === closure15
              ? next.closureChanges.slice(1)
              : git.changes(parent, pin),
        }),
      ).rejects.toThrow(
        /closure parent|total\/first-parent count|closure inventory/u,
      );
    },
  );

  it("rejects an inherited renderer mutation even if the latest archive is regenerated from it", async () => {
    const path = RELEASE_CLASSIFICATION_ADAPTER_PATHS[0];
    const corruptPrior = new Map(priorOutputs);
    corruptPrior.set(
      path,
      `${priorOutputs.get(path) ?? ""}# inherited mutation\n`,
    );
    const corruptNext = await generateReleaseOutputs(
      adapters(corruptPrior),
      next,
    );
    const root = archiveWorkspace();
    const before = snapshot(root);
    await expect(
      verifyArchivedRelease(
        root,
        next,
        closure15,
        archiveReader(reader(corruptPrior, corruptNext)),
      ),
    ).rejects.toThrow(/generated historical closure/u);
    expect(snapshot(root)).toEqual(before);
  }, 30_000);

  it.each(["missing", "unrelated"])(
    "rejects a %s anchor without falling back to current adapters",
    async (kind) => {
      const root = archiveWorkspace();
      const git = archiveReader();
      const before = snapshot(root);
      await expect(
        verifyArchivedRelease(root, next, closure15, {
          ...git,
          ancestor: () => {
            if (kind === "missing") throw new Error("Missing archive commit");
            return false;
          },
        }),
      ).rejects.toThrow(/Missing archive commit|archive is not an ancestor/u);
      expect(snapshot(root)).toEqual(before);
    },
  );

  it("requires the fixed a89 archive on the no-argument CLI even with no installed descriptors", async () => {
    const root = mkdtempSync(join(ownedTemporaryRoot, temporaryPrefix));
    directories.push(root);
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^(?:GIT_|NODE_OPTIONS$)/iu.test(key),
      ),
    );
    const args = [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "-c",
      "user.name=Release Test",
      "-c",
      "user.email=release-test@example.invalid",
      "-C",
      root,
    ];
    for (const command of [
      ["init", "--quiet"],
      ["commit", "--quiet", "--allow-empty", "-m", "unrelated synthetic root"],
    ])
      execFileSync("git", [...args, ...command], {
        env,
        windowsHide: true,
        stdio: "pipe",
        timeout: 30_000,
      });
    const before = snapshot(root);
    await expect(runReleaseClassification([], root)).rejects.toThrow(
      "65cb08c94dd8767d1a59b01dd1b7a355d5c5667e:scripts/release-classification/releases/cycle3ka89.json",
    );
    expect(snapshot(root)).toEqual(before);
  });
});
