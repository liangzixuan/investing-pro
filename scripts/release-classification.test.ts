import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertClosure,
  assertWritePreflight,
  BOOTSTRAP_PREDECESSOR,
  CLASSIFICATION_BASELINE,
  createReleaseGitReader,
  descriptorText,
  inspectRelease,
  orderedReleaseRegistry,
  parseGitChanges,
  parseReleaseDescriptor,
  RELEASE_DIRECTORY,
  runReleaseClassification,
  staleOutputs,
  writeReleaseOutputs,
} from "./release-classification.js";
import type {
  ReleaseDescriptor,
  ReleaseGitReader,
} from "./release-classification.js";
import { RELEASE_CLASSIFICATION_ADAPTER_PATHS } from "./release-classification-render.js";

const directories: string[] = [];
function temporary(): string {
  const path = mkdtempSync(join(tmpdir(), "release-classification-"));
  directories.push(path);
  return path;
}
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});

function descriptor(caseNumber = 14): ReleaseDescriptor {
  const descriptorPath = `${RELEASE_DIRECTORY}/cycle3ka${caseNumber}.json`;
  return {
    version: 1,
    caseNumber,
    baselineRevision: CLASSIFICATION_BASELINE,
    predecessorRevision:
      caseNumber === 14 ? BOOTSTRAP_PREDECESSOR : "2".repeat(40),
    featureRevision: (caseNumber === 14 ? "1" : "3").repeat(40),
    featureCount: 101 + 2 * caseNumber,
    closureCount: 102 + 2 * caseNumber,
    featureChanges: [{ path: "docs/example.md", status: "M" }],
    closureChanges: [
      ...RELEASE_CLASSIFICATION_ADAPTER_PATHS.map((path) => ({
        path,
        status: "M" as const,
      })),
      { path: descriptorPath, status: "A" as const },
    ].sort((a, b) => (a.path < b.path ? -1 : 1)),
    descriptorPath,
    presentation: {
      featureDescription: "release classification descriptor generation",
      closureDescription: "release classification descriptor generation",
      inventoryDescription: "release classification descriptor generation",
      testBinding: "releaseClassification",
      routingDescription: "release classification descriptor generation",
      summaryDescription:
        "release classification descriptor generation with unchanged historical classification and evidence gates",
    },
  };
}

function reader(current = descriptor()): ReleaseGitReader {
  const bootstrap = descriptor();
  const next = descriptor(15);
  const count = new Map([
    [BOOTSTRAP_PREDECESSOR, 128],
    [bootstrap.featureRevision, 129],
    [next.predecessorRevision, 130],
    [next.featureRevision, 131],
    ["4".repeat(40), 132],
  ]);
  return {
    head: () => current.featureRevision,
    status: () => "",
    parents: (pin) => {
      if (pin === bootstrap.featureRevision) return [BOOTSTRAP_PREDECESSOR];
      if (pin === next.predecessorRevision) return [bootstrap.featureRevision];
      if (pin === next.featureRevision) return [next.predecessorRevision];
      if (pin === "4".repeat(40)) return [next.featureRevision];
      throw new Error("Unexpected test parent lookup");
    },
    count: (_base, pin) => count.get(pin) ?? -1,
    changes: (_parent, pin) =>
      pin === bootstrap.featureRevision || pin === next.featureRevision
        ? current.featureChanges
        : pin === next.predecessorRevision
          ? bootstrap.closureChanges
          : next.closureChanges,
    blob: (_pin, path) =>
      path === bootstrap.descriptorPath
        ? JSON.stringify(bootstrap)
        : "// frozen adapter\n",
    ancestor: () => true,
  };
}

describe("strict release descriptor", () => {
  it("accepts and deterministically serializes one explicit declaration", async () => {
    const expected = descriptor();
    expect(parseReleaseDescriptor(JSON.stringify(expected))).toEqual(expected);
    expect(await descriptorText(expected)).toBe(
      await descriptorText(
        parseReleaseDescriptor(await descriptorText(expected)),
      ),
    );
  });

  it.each([
    ["version", 2],
    ["caseNumber", 13],
    ["caseNumber", Number.MAX_SAFE_INTEGER],
    ["caseNumber", 14.5],
    ["baselineRevision", "a".repeat(40)],
    ["predecessorRevision", "b".repeat(40)],
    ["featureRevision", "ABC123"],
    ["featureRevision", BOOTSTRAP_PREDECESSOR],
    ["featureRevision", "0".repeat(40)],
    ["featureCount", 130],
    ["closureCount", 131],
    [
      "descriptorPath",
      "scripts/release-classification/releases/cycle3ka15.json",
    ],
    ["unexpected", true],
  ])("rejects changed %s: %s", (key, value) => {
    expect(() =>
      parseReleaseDescriptor(JSON.stringify({ ...descriptor(), [key]: value })),
    ).toThrow();
  });

  it.each([64, 65, 66, 99, 100, 101])(
    "accepts case %s with its exact counts and installed filename",
    (caseNumber) => {
      const expected = descriptor(caseNumber);
      expect(
        parseReleaseDescriptor(
          JSON.stringify(expected),
          expected.descriptorPath,
        ),
      ).toEqual(expected);
    },
  );

  it("keeps every rendered count exact at the arithmetic boundary", () => {
    const last = {
      ...descriptor(4_503_599_627_370_444),
      featureCount: 9_007_199_254_740_989,
      closureCount: 9_007_199_254_740_990,
    };
    expect(parseReleaseDescriptor(JSON.stringify(last))).toEqual(last);
    expect(() =>
      parseReleaseDescriptor(JSON.stringify(descriptor(4_503_599_627_370_445))),
    ).toThrow(/Unsupported release case/u);
    for (const caseNumber of [
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(() =>
        parseReleaseDescriptor(JSON.stringify(descriptor(caseNumber))),
      ).toThrow(/Unsupported release case/u);
    expect(() =>
      parseReleaseDescriptor(
        JSON.stringify({ ...last, closureCount: last.closureCount + 1 }),
      ),
    ).toThrow(/release counts/u);
  });

  it.each([
    "apps/web/app/company/[listingId]/page.tsx",
    "apps/web/app/[market]/company/[_listing2]/page.tsx",
  ])("accepts complete dynamic identifier segments in %s", (path) => {
    const expected = {
      ...descriptor(),
      featureChanges: [{ path, status: "A" as const }],
    };
    expect(parseReleaseDescriptor(JSON.stringify(expected))).toEqual(expected);
    expect(parseGitChanges(`A\0${path}\0`)).toEqual(expected.featureChanges);
  });

  it.each([
    "apps/web/app/company/[]/page.tsx",
    "apps/web/app/company/[9id]/page.tsx",
    "apps/web/app/company/[listing-id]/page.tsx",
    "apps/web/app/company/[...listingId]/page.tsx",
    "apps/web/app/company/[[listingId]]/page.tsx",
    "apps/web/app/company/[[...listingId]]/page.tsx",
    "apps/web/app/company/prefix[listingId]/page.tsx",
    "apps/web/app/company/[listingId]suffix/page.tsx",
    "apps/web/app/company/[listingId].tsx",
    "apps/web/app/company/[listingId/page.tsx",
    "apps/web/app/company/listingId]/page.tsx",
    "apps/web/app/company/[$id]/page.tsx",
    "apps/web/app/company/[.git]/page.tsx",
    "apps/web/app/company/[listingId]/../page.tsx",
    "apps/web/app/company/[listingId]/.GIT/config",
    "apps/web/app/company/[listingId]/CON.txt",
    "apps/web/app/company/[listingId]/file.",
    "apps/web/app/company/[listingId]//page.tsx",
    "apps/web/app/company/[listingId]\\page.tsx",
    `apps/web/app/[${"i".repeat(240)}]/page.tsx`,
    "../escape.ts",
    "/outside.ts",
    "C:/outside.ts",
    "x\\y.ts",
    "x/.git/config",
    "x/CON.txt",
    "x/file.",
    "x/./y.ts",
    "x/a b.ts",
    "x/$value.ts",
  ])("rejects unsafe inventory path %s", (path) => {
    expect(() =>
      parseReleaseDescriptor(
        JSON.stringify({
          ...descriptor(),
          featureChanges: [{ path, status: "M" }],
        }),
      ),
    ).toThrow();
  });

  it.each(["R100", "C100", "D", "T", "U", "", "m"])(
    "rejects unsupported status %s",
    (status) => {
      expect(() =>
        parseReleaseDescriptor(
          JSON.stringify({
            ...descriptor(),
            featureChanges: [{ path: "docs/example.md", status }],
          }),
        ),
      ).toThrow();
    },
  );

  it("rejects duplicate JSON keys including escaped aliases", () => {
    const text = JSON.stringify(descriptor());
    expect(() =>
      parseReleaseDescriptor(
        text.replace('"version":1', '"version":1,"version":1'),
      ),
    ).toThrow(/Duplicate/u);
    expect(() =>
      parseReleaseDescriptor(
        text.replace('"version":1', '"version":1,"ver\\u0073ion":1'),
      ),
    ).toThrow(/Duplicate/u);
    expect(() =>
      parseReleaseDescriptor(
        text.replace('"status":"M"', '"status":"M","status":"M"'),
      ),
    ).toThrow(/Duplicate/u);
  });

  it("rejects a duplicate old descriptor under a newer installed filename", () => {
    expect(() =>
      parseReleaseDescriptor(
        JSON.stringify(descriptor()),
        `${RELEASE_DIRECTORY}/cycle3ka15.json`,
      ),
    ).toThrow(/filename/u);
  });

  it("rejects missing/extra/renamed outputs, duplicates, status drift and ordering drift", () => {
    const original = descriptor();
    for (let index = 0; index < original.closureChanges.length; index++) {
      const removed = original.closureChanges.filter((_, i) => index !== i);
      const changed = original.closureChanges.map((entry, i) =>
        i === index
          ? { ...entry, status: entry.status === "M" ? "A" : "M" }
          : entry,
      );
      const renamed = original.closureChanges.map((entry, i) =>
        i === index ? { ...entry, path: `${entry.path}.renamed` } : entry,
      );
      for (const closureChanges of [removed, changed, renamed])
        expect(() =>
          parseReleaseDescriptor(
            JSON.stringify({ ...original, closureChanges }),
          ),
        ).toThrow();
    }
    for (const closureChanges of [
      [...original.closureChanges].reverse(),
      [...original.closureChanges, original.closureChanges[0]],
      [...original.closureChanges, { path: "unreviewed.ts", status: "A" }],
    ])
      expect(() =>
        parseReleaseDescriptor(JSON.stringify({ ...original, closureChanges })),
      ).toThrow();
    for (const featureChanges of [
      [],
      [
        { path: "docs/A.md", status: "M" },
        { path: "docs/a.md", status: "M" },
      ],
      [...original.closureChanges],
      [{ ...original.featureChanges[0], extra: true }],
    ])
      expect(() =>
        parseReleaseDescriptor(JSON.stringify({ ...original, featureChanges })),
      ).toThrow();
  });

  it("keeps dynamic paths case-unique and strictly ordered", () => {
    for (const paths of [
      ["apps/[Id]/page.tsx", "apps/[id]/page.tsx"],
      ["apps/[z]/page.tsx", "apps/[a]/page.tsx"],
    ])
      expect(() =>
        parseReleaseDescriptor(
          JSON.stringify({
            ...descriptor(),
            featureChanges: paths.map((path) => ({ path, status: "A" })),
          }),
        ),
      ).toThrow(/unique and ordered/u);
  });

  it("rejects shell/comment interpolation and malformed binding metadata", () => {
    for (const bad of [
      "$(echo bad)",
      "x\ny",
      'x"y',
      "x`y",
      "x */ y",
      "x; y",
      " x",
    ])
      expect(() =>
        parseReleaseDescriptor(
          JSON.stringify({
            ...descriptor(),
            presentation: {
              ...descriptor().presentation,
              routingDescription: bad,
            },
          }),
        ),
      ).toThrow();
    expect(() =>
      parseReleaseDescriptor(
        JSON.stringify({
          ...descriptor(),
          presentation: {
            ...descriptor().presentation,
            testBinding: "not a binding",
          },
        }),
      ),
    ).toThrow();
    expect(() => parseReleaseDescriptor(" ".repeat(64_001))).toThrow(/size/u);
  });
});

describe("installed release registry", () => {
  const through100 = Array.from(
    { length: 87 },
    (_, index) => `cycle3ka${14 + index}.json`,
  );

  it("orders a contiguous registry numerically beyond a64 and across three digits", () => {
    expect(orderedReleaseRegistry([...through100].reverse())).toEqual(
      through100,
    );
    expect(orderedReleaseRegistry([])).toEqual([]);
  });

  it.each([
    "cycle3ka13.json",
    "cycle3ka065.json",
    "cycle3ka+65.json",
    "cycle3ka6.5e1.json",
    "cycle3ka65.0.json",
    "cycle3ka65.json.bak",
    "Cycle3ka65.json",
    "cycle3ka4503599627370445.json",
    "cycle3ka9007199254740992.json",
    "cycle3ka999999999999999999999999999999.json",
  ])("rejects noncanonical or unsafe registry entry %s", (name) => {
    expect(() => orderedReleaseRegistry([...through100, name])).toThrow(
      /Unexpected release registry entry/u,
    );
  });

  it("rejects gaps, duplicates and missing bootstrap entries above the old limit", () => {
    for (const names of [
      through100.filter((name) => name !== "cycle3ka65.json"),
      [...through100, "cycle3ka65.json"],
      through100.slice(1),
    ])
      expect(() => orderedReleaseRegistry(names)).toThrow(/contiguous/u);
  });
});

describe("independent declared Git history", () => {
  it("admits the feature and exact closure, including the nested bootstrap", () => {
    expect(inspectRelease(descriptor(), reader()).size).toBe(8);
    const next = descriptor(15);
    expect(inspectRelease(next, reader(next)).size).toBe(8);
    expect(() =>
      assertClosure(next, "4".repeat(40), reader(next)),
    ).not.toThrow();
    expect(() => assertWritePreflight(next, reader(next))).not.toThrow();
  });

  it.each([false, true])(
    "rejects wrong total/first-parent counts (%s)",
    (firstParent) => {
      const next = descriptor(15);
      const git = reader(next);
      for (const target of [
        BOOTSTRAP_PREDECESSOR,
        descriptor().featureRevision,
        next.predecessorRevision,
        next.featureRevision,
      ])
        expect(() =>
          inspectRelease(next, {
            ...git,
            count: (base, pin, first) =>
              git.count(base, pin, first) +
              (pin === target && first === firstParent ? 1 : 0),
          }),
        ).toThrow(/count/u);
      expect(() =>
        assertClosure(next, "4".repeat(40), {
          ...git,
          count: () => next.closureCount + 1,
        }),
      ).toThrow(/count/u);
    },
  );

  it("rejects wrong parents and merges at every nested transition", () => {
    const next = descriptor(15);
    const git = reader(next);
    for (const target of [
      descriptor().featureRevision,
      next.predecessorRevision,
      next.featureRevision,
    ])
      for (const parents of [
        ["e".repeat(40)],
        [...git.parents(target), "e".repeat(40)],
      ])
        expect(() =>
          inspectRelease(next, {
            ...git,
            parents: (pin) => (pin === target ? parents : git.parents(pin)),
          }),
        ).toThrow(/parent/u);
    expect(() =>
      assertClosure(next, "4".repeat(40), {
        ...git,
        parents: () => [next.featureRevision, "e".repeat(40)],
      }),
    ).toThrow(/parent/u);
  });

  it("rejects missing, extra, renamed and wrong-status feature/closure changes", () => {
    const current = descriptor();
    const git = reader();
    for (const actual of [
      [],
      [...current.featureChanges, { path: "extra.ts", status: "A" as const }],
      [{ path: "docs/renamed.md", status: "M" as const }],
      [{ path: "docs/example.md", status: "A" as const }],
    ])
      expect(() =>
        inspectRelease(current, { ...git, changes: () => actual }),
      ).toThrow(/inventory/u);
    const next = descriptor(15);
    expect(() =>
      assertClosure(next, "4".repeat(40), {
        ...reader(next),
        changes: () => next.closureChanges.slice(1),
      }),
    ).toThrow(/inventory/u);
    expect(() =>
      assertClosure(next, next.featureRevision, reader(next)),
    ).toThrow();
  });

  it("rejects changed adapter blobs, replaced nested pins, and non-ancestor baselines", () => {
    const current = descriptor();
    expect(() =>
      inspectRelease(current, {
        ...reader(),
        blob: (pin) => (pin === current.featureRevision ? "changed" : "before"),
      }),
    ).toThrow(/adapter/u);
    const next = descriptor(15);
    const git = reader(next);
    expect(() =>
      inspectRelease(next, {
        ...git,
        blob: (pin, path) =>
          path.endsWith(".json")
            ? JSON.stringify({
                ...current,
                predecessorRevision: "b".repeat(40),
              })
            : git.blob(pin, path),
      }),
    ).toThrow(/bootstrap/u);
    expect(() =>
      inspectRelease(next, {
        ...git,
        changes: (parent, pin) =>
          pin === current.featureRevision ? [] : git.changes(parent, pin),
      }),
    ).toThrow(/nested feature inventory/u);
    expect(() =>
      inspectRelease(current, { ...reader(), ancestor: () => false }),
    ).toThrow(/ancestor/u);
  });

  it("refuses its own bootstrap, wrong HEAD, dirty work, and generator self-updates", () => {
    expect(() => assertWritePreflight(descriptor(), reader())).toThrow(
      /bootstrap/u,
    );
    const next = descriptor(15);
    expect(() =>
      assertWritePreflight(next, {
        ...reader(next),
        head: () => next.predecessorRevision,
      }),
    ).toThrow(/HEAD/u);
    for (const status of [
      " M tracked.ts\0",
      "?? untracked.json\0",
      "M  staged.ts\0",
    ])
      expect(() =>
        assertWritePreflight(next, { ...reader(next), status: () => status }),
      ).toThrow(/clean/u);
    expect(() =>
      assertWritePreflight(
        {
          ...next,
          featureChanges: [
            { path: "scripts/release-classification.ts", status: "M" },
          ],
        },
        reader(next),
      ),
    ).toThrow(/manual/u);
  });
});

describe("bounded checking and writing", () => {
  function files(
    root: string,
    current: ReleaseDescriptor,
  ): Map<string, string> {
    const output = new Map<string, string>();
    for (const { path } of current.closureChanges) {
      output.set(path, "generated\n");
      if (path === current.descriptorPath) continue;
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), "frozen\n");
    }
    return output;
  }

  it("check detects every stale pin/inventory/block without touching bytes or timestamps", () => {
    const root = temporary();
    const current = descriptor();
    const output = files(root, current);
    const path = join(root, RELEASE_CLASSIFICATION_ADAPTER_PATHS[0]);
    const modified = statSync(path).mtimeMs;
    expect(staleOutputs(root, output).sort()).toEqual(
      current.closureChanges.map(({ path }) => path),
    );
    expect(readFileSync(path, "utf8")).toBe("frozen\n");
    expect(statSync(path).mtimeMs).toBe(modified);
    expect(existsSync(join(root, current.descriptorPath))).toBe(false);
    for (const { path } of current.closureChanges) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), "generated\n");
    }
    expect(staleOutputs(root, output)).toEqual([]);
    for (const { path } of current.closureChanges) {
      writeFileSync(
        join(root, path),
        "tampered pin or inventory or orchestration\n",
      );
      expect(staleOutputs(root, output)).toEqual([path]);
      writeFileSync(join(root, path), "generated\n");
    }
  });

  it("failed preflight and undeclared outputs cause no writes", async () => {
    const root = temporary();
    const next = descriptor(15);
    const output = files(root, next);
    await expect(
      writeReleaseOutputs(root, next, output, {
        ...reader(next),
        status: () => "?? private.txt\0",
      }),
    ).rejects.toThrow();
    await expect(
      writeReleaseOutputs(
        root,
        next,
        new Map([...output, ["outside.txt", "bad"]]),
        reader(next),
      ),
    ).rejects.toThrow(/allowlist/u);
    expect(
      readFileSync(join(root, RELEASE_CLASSIFICATION_ADAPTER_PATHS[0]), "utf8"),
    ).toBe("frozen\n");
    expect(existsSync(join(root, next.descriptorPath))).toBe(false);
  });

  it("rejects incomplete frozen source before any write", async () => {
    const root = temporary();
    const next = descriptor(15);
    const output = files(root, next);
    mkdirSync(join(root, next.descriptorPath), { recursive: true });
    await expect(
      writeReleaseOutputs(root, next, output, reader(next)),
    ).rejects.toThrow();
    expect(
      readFileSync(join(root, RELEASE_CLASSIFICATION_ADAPTER_PATHS[0]), "utf8"),
    ).toBe("frozen\n");
    expect(() => staleOutputs(root, new Map([["../escape", "bad"]]))).toThrow(
      /path/u,
    );
  });

  it("rejects malformed CLI arguments before Git or file access", async () => {
    for (const args of [
      ["--write"],
      ["--descriptor"],
      ["--descriptor", "a", "--force"],
      ["--unknown", "a"],
    ])
      await expect(
        runReleaseClassification(args, "nonexistent"),
      ).rejects.toThrow(/Usage/u);
  });
});

describe("real bounded Git reader", () => {
  function graftRepository() {
    const directory = temporary();
    const root = join(directory, "repository");
    mkdirSync(root);
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^(?:GIT_|NODE_OPTIONS$)/iu.test(key),
      ),
    );
    Object.assign(env, {
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_TERMINAL_PROMPT: "0",
    });
    function git(...args: string[]): string {
      return execFileSync(
        "git",
        [
          "--no-replace-objects",
          "-c",
          `safe.directory=${root.replaceAll("\\", "/")}`,
          "-c",
          "user.name=Release Graft Test",
          "-c",
          "user.email=release-graft-test@example.invalid",
          "-C",
          root,
          ...args,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          env,
          maxBuffer: 64_000,
          timeout: 10_000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ).trim();
    }
    git("init", "--quiet");
    const tree = git("write-tree");
    const base = git("commit-tree", tree, "-m", "baseline");
    const parent = git("commit-tree", tree, "-p", base, "-m", "middle");
    const head = git("commit-tree", tree, "-p", parent, "-m", "feature");
    git("update-ref", "refs/heads/graft-test", head);
    git("symbolic-ref", "HEAD", "refs/heads/graft-test");
    const graftPath = git(
      "rev-parse",
      "--path-format=absolute",
      "--git-path",
      "info/grafts",
    );
    return { directory, root, git, base, parent, head, graftPath };
  }

  it("reads dynamic paths literally and excludes Git glob near-misses", () => {
    const { root, git } = graftRepository();
    const route = "apps/web/app/company/[listingId]/page.tsx";
    const nearMiss = "apps/web/app/company/l/page.tsx";
    for (const path of [route, nearMiss]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), "before\n");
    }
    git("add", "--", "apps");
    git("commit", "--quiet", "-m", "synthetic route baseline");
    const base = git("rev-parse", "HEAD");
    writeFileSync(join(root, route), "route changed\n");
    git("add", "--", "apps");
    git("commit", "--quiet", "-m", "synthetic dynamic route");
    const routeHead = git("rev-parse", "HEAD");
    const actual = createReleaseGitReader(root);
    expect(actual.changes(base, routeHead)).toEqual([
      { path: route, status: "M" },
    ]);
    expect(actual.blob(routeHead, route)).toBe("route changed\n");
    const diff = ["diff", "--name-only", "--no-renames", "-z"];
    expect(
      git("--literal-pathspecs", ...diff, base, routeHead, "--", route),
    ).toBe(`${route}\0`);
    writeFileSync(join(root, nearMiss), "near miss changed\n");
    git("add", "--", "apps");
    git("commit", "--quiet", "-m", "synthetic route near miss");
    const nearHead = git("rev-parse", "HEAD");
    expect(git(...diff, routeHead, nearHead, "--", route)).toBe(
      `${nearMiss}\0`,
    );
    expect(
      git("--literal-pathspecs", ...diff, routeHead, nearHead, "--", route),
    ).toBe("");
    expect(actual.changes(routeHead, nearHead)).toEqual([
      { path: nearMiss, status: "M" },
    ]);
  });

  it("rejects on-disk grafts even when replacement objects are disabled", () => {
    const { root, git, base, parent, head, graftPath } = graftRepository();
    const reader = createReleaseGitReader(root);
    expect(reader.parents(head)).toEqual([parent]);
    expect(reader.count(base, head, false)).toBe(2);
    expect(reader.count(base, head, true)).toBe(2);
    const raw = git("cat-file", "commit", head);
    expect(
      raw.split("\n").filter((line) => line.startsWith("parent ")),
    ).toEqual([`parent ${parent}`]);
    writeFileSync(graftPath, `${head} ${base}\n`);
    expect(git("cat-file", "commit", head)).toBe(raw);
    expect(git("rev-list", "--parents", "-n", "1", head)).toBe(
      `${head} ${base}`,
    );
    expect(git("rev-list", "--count", `${base}..${head}`)).toBe("1");
    expect(() => createReleaseGitReader(root)).toThrow(/Git graft/u);
  });

  it.each(["empty file", "directory", "dangling link"])(
    "rejects an existing graft path: %s",
    (kind) => {
      const { directory, root, graftPath } = graftRepository();
      if (kind === "empty file") writeFileSync(graftPath, "");
      else if (kind === "directory") mkdirSync(graftPath);
      else {
        symlinkSync(
          join(directory, "missing-graft-target"),
          graftPath,
          process.platform === "win32" ? "junction" : "file",
        );
        expect(lstatSync(graftPath).isSymbolicLink()).toBe(true);
        expect(existsSync(graftPath)).toBe(false);
      }
      expect(() => createReleaseGitReader(root)).toThrow(/Git graft/u);
    },
  );

  it.each(["file", "dangling link"])(
    "rejects a shared common-directory graft %s from a linked worktree",
    (kind) => {
      const { directory, root, git, base, parent, head, graftPath } =
        graftRepository();
      const linked = join(directory, "linked");
      git("worktree", "add", "--quiet", "--detach", linked, head);
      // Native resolution expands Windows 8.3 aliases on existing directories.
      expect(
        realpathSync.native(
          git(
            "-C",
            linked,
            "rev-parse",
            "--path-format=absolute",
            "--git-common-dir",
          ),
        ),
      ).toBe(realpathSync.native(join(root, ".git")));
      expect(realpathSync.native(dirname(graftPath))).toBe(
        realpathSync.native(join(root, ".git", "info")),
      );
      expect(basename(graftPath)).toBe("grafts");
      expect(createReleaseGitReader(linked).parents(head)).toEqual([parent]);
      if (kind === "file") writeFileSync(graftPath, `${head} ${base}\n`);
      else {
        symlinkSync(
          join(directory, "missing-graft-target"),
          graftPath,
          process.platform === "win32" ? "junction" : "file",
        );
        expect(lstatSync(graftPath).isSymbolicLink()).toBe(true);
        expect(existsSync(graftPath)).toBe(false);
      }
      expect(() => createReleaseGitReader(root)).toThrow(/Git graft/u);
      expect(() => createReleaseGitReader(linked)).toThrow(/Git graft/u);
    },
  );

  it.each(["file", "dangling link"])(
    "rejects a graft %s introduced after the reader was created",
    (kind) => {
      const { directory, root, base, head, graftPath } = graftRepository();
      const reader = createReleaseGitReader(root);
      if (kind === "file") writeFileSync(graftPath, `${head} ${base}\n`);
      else
        symlinkSync(
          join(directory, "missing-graft-target"),
          graftPath,
          process.platform === "win32" ? "junction" : "file",
        );
      expect(() => reader.parents(head)).toThrow(/Git graft/u);
      expect(() => reader.count(base, head, false)).toThrow(/Git graft/u);
      expect(() => reader.count(base, head, true)).toThrow(/Git graft/u);
      expect(() => reader.ancestor(base, head)).toThrow(/Git graft/u);
    },
  );

  it("reads NUL inventories and exact parents/counts/status using a fresh local repository", () => {
    const root = temporary();
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
    );
    function git(...args: string[]): string {
      return execFileSync(
        "git",
        [
          "-c",
          `safe.directory=${root.replaceAll("\\", "/")}`,
          "-c",
          "user.name=Release Test",
          "-c",
          "user.email=release-test@example.invalid",
          "-C",
          root,
          ...args,
        ],
        { encoding: "utf8", windowsHide: true, env, maxBuffer: 64_000 },
      );
    }
    git("init", "--quiet");
    writeFileSync(join(root, "sample.txt"), "before\n");
    git("add", "sample.txt");
    git("commit", "--quiet", "-m", "baseline");
    const base = git("rev-parse", "HEAD").trim();
    writeFileSync(join(root, "sample.txt"), "after\n");
    git("add", "sample.txt");
    git("commit", "--quiet", "-m", "feature");
    const actual = createReleaseGitReader(root);
    const feature = actual.head();
    expect(actual.parents(feature)).toEqual([base]);
    expect(actual.count(base, feature, false)).toBe(1);
    expect(actual.count(base, feature, true)).toBe(1);
    expect(actual.changes(base, feature)).toEqual([
      { path: "sample.txt", status: "M" },
    ]);
    expect(actual.blob(base, "sample.txt")).toBe("before\n");
    expect(actual.ancestor(base, feature)).toBe(true);
    expect(actual.status()).toBe("");
    for (const flag of ["assume-unchanged", "skip-worktree"]) {
      git("update-index", `--${flag}`, "sample.txt");
      expect(() => actual.status()).toThrow(/Suppressed Git index/u);
      git("update-index", `--no-${flag}`, "sample.txt");
    }
    writeFileSync(join(root, "untracked.txt"), "untracked\n");
    expect(actual.status()).toBe("?? untracked.txt\0");
  });

  it("rejects truncated, renamed and malformed NUL-delimited inventories", () => {
    expect(parseGitChanges("M\0docs/example.md\0")).toEqual([
      { path: "docs/example.md", status: "M" },
    ]);
    for (const output of [
      "M\0docs/example.md",
      "R100\0before.ts\0after.ts\0",
      "D\0removed.ts\0",
      "M\0../outside\0",
      "M\0a.ts\0M\0a.ts\0",
    ])
      expect(() => parseGitChanges(output)).toThrow();
  });
});
