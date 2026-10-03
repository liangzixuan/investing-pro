import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  admitPackResult,
  classify,
  hasLocalReference,
  LIMITS,
  safePath,
} from "./policy.mjs";
import {
  buildContext,
  hash,
  parseInventory,
  renderPack,
  snapshotFiles,
} from "./pack.mjs";

const blob = "a".repeat(40);
const entry = (name, mode = "100644") => `${mode} ${blob} 0\t${name}\0`;
async function fixture(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(
    path.join(parent, "investment-repomix-test-"),
  );
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith("investment-repomix-test-"));
    await rm(directory, { recursive: true, force: true });
  });
  const root = path.join(directory, "repository");
  const snapshot = path.join(directory, "snapshot");
  await mkdir(root);
  await mkdir(snapshot);
  return { directory, root, snapshot };
}
async function put(root, name, bytes) {
  const file = path.join(root, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
}

test("Git admission rejects links, submodules, conflicts, traversal and duplicates", () => {
  assert.deepEqual(parseInventory(entry("docs/z.md") + entry("README.md")), [
    { path: "README.md", mode: "100644" },
    { path: "docs/z.md", mode: "100644" },
  ]);
  for (const value of [
    entry("../escape.md"),
    entry("docs/link.md", "120000"),
    entry("modules/sub", "160000"),
    entry("README.md") + entry("README.md"),
    `100644 ${blob} 2\tREADME.md\0`,
    entry("docs/a\\b.md"),
  ])
    assert.throws(() => parseInventory(value));
  for (const name of [
    "/absolute",
    "a/../b",
    "a//b",
    "a\n.md",
    "x:y",
    "apps/{nested}.ts",
    "apps/*.ts",
    "",
  ])
    assert.equal(safePath(name), false);
  assert.equal(safePath("a".repeat(LIMITS.path + 1)), false);
});

test("curated omissions are explicit and full mode retains bounded detail", () => {
  for (const name of [
    "docs/history/old.md",
    "apps/web/example.test.ts",
    "fixtures/example.json",
    "pnpm-lock.yaml",
    "THIRD_PARTY_NOTICES.md",
  ]) {
    assert.match(classify(name, "curated", 12), /^detail:/u);
    assert.equal(classify(name, "full", 12), "included");
  }
  assert.equal(
    classify("scripts/large.ts", "curated", LIMITS.curatedFile + 1),
    "detail:large-file",
  );
  assert.throws(() => classify("scripts/large.ts", "full", LIMITS.file + 1));
  for (const name of [
    "apps/web/.env.local",
    "apps/web/credentials.json",
    "apps/web/android/local.properties",
    "docs/key.pem",
    ".owner-local/session.json",
    "tools/repomix/node_modules/a.js",
    "apps/web/dist/main.js",
    "tmp/handoff.md",
  ])
    assert.match(classify(name, "full", 1), /^excluded:/u);
});

test("overview selects current orientation and manifests with explicit source references", () => {
  for (const name of [
    "README.md",
    "AGENTS.md",
    "LICENSE_POLICY.md",
    "package.json",
    ".gitignore",
    "apps/web/package.json",
    "docs/AI_CONTEXT.md",
    "docs/CURRENT_WORK.md",
    "docs/ARCHITECTURE.md",
    "docs/MANAGED_EOD_HISTORY.md",
    "tools/repomix/pack.mjs",
    ".github/workflows/repomix.yml",
  ])
    assert.equal(classify(name, "overview", 100), "included");
  for (const name of [
    "apps/web/src/main.ts",
    "docs/history/README.md",
    "docs/THREAT_MODEL.md",
    "pnpm-lock.yaml",
    "tools/repomix/pnpm-lock.yaml",
    "packages/contracts/src/example.test.ts",
    ".github/workflows/ci.yml",
  ])
    assert.equal(classify(name, "overview", 100), "detail:source-reference");
  assert.equal(
    classify("tools/repomix/node_modules/package.json", "overview", 100),
    "excluded:private-or-generated",
  );
  assert.throws(() => classify("README.md", "unknown", 100));
});

test("only the reviewed synthetic security examples are omitted before reads", async (t) => {
  const excluded = [
    "apps/web/src/clerk-trial/config.test.ts",
    "packages/contracts/src/managed-workspace.test.ts",
    "scripts/verify-boundaries.ts",
  ];
  for (const mode of ["overview", "curated", "full"]) {
    for (const name of excluded)
      assert.equal(
        classify(name, mode, 100),
        "excluded:synthetic-security-example",
      );
  }
  for (const name of [
    "apps/web/src/clerk-trial/config.ts",
    "apps/web/src/clerk-trial/config.extra.test.ts",
    "packages/contracts/src/managed-workspace.ts",
    "packages/contracts/src/managed-workspace.extra.test.ts",
    "scripts/verify-other-boundaries.ts",
  ])
    assert.equal(classify(name, "full", 100), "included");
  const { root, snapshot } = await fixture(t);
  await put(root, "README.md", "# Public fixture\n");
  // These excluded paths deliberately do not exist: admission must not open them.
  const coverage = await snapshotFiles(
    root,
    [{ path: "README.md" }, ...excluded.map((name) => ({ path: name }))],
    "full",
    snapshot,
  );
  assert.deepEqual(coverage.names, ["README.md"]);
  assert.deepEqual(
    coverage.manifest.slice(1).map((row) => row.disposition),
    excluded.map(() => "excluded:synthetic-security-example"),
  );
});

test("snapshot ignores untracked files and never opens excluded private paths", async (t) => {
  const { root, snapshot } = await fixture(t);
  await put(root, "README.md", "# Public\r\nComplete source.\r\n");
  await put(root, "untracked-secret.txt", "not source");
  const coverage = await snapshotFiles(
    root,
    [{ path: "README.md" }, { path: "apps/web/.env.local" }],
    "full",
    snapshot,
  );
  assert.deepEqual(coverage.names, ["README.md"]);
  assert.equal(
    coverage.manifest[1].disposition,
    "excluded:private-or-generated",
  );
  assert.equal(
    await readFile(path.join(snapshot, "README.md"), "utf8"),
    "# Public\nComplete source.\n",
  );
  assert.notEqual(
    coverage.manifest[0].sha256,
    coverage.manifest[0].normalizedSha256,
  );
});

test("working tree directory links cannot escape the admitted repository", async (t) => {
  const { directory, root, snapshot } = await fixture(t);
  const outside = path.join(directory, "outside");
  await mkdir(outside);
  await put(outside, "a.ts", "export const value = 1;\n");
  await symlink(
    outside,
    path.join(root, "apps"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    snapshotFiles(root, [{ path: "apps/a.ts" }], "full", snapshot),
    /link rejected/u,
  );
});

test("binary and malformed UTF-8 text fail instead of silently disappearing", async (t) => {
  for (const [index, bytes] of [
    Buffer.from([0xff]),
    Buffer.from("before\0after"),
  ].entries()) {
    const { root, snapshot } = await fixture(t);
    await put(root, `docs/bad${index}.md`, bytes);
    await assert.rejects(
      snapshotFiles(root, [{ path: `docs/bad${index}.md` }], "full", snapshot),
    );
  }
});

test("local-only documents are reported, and machine references in code fail", async (t) => {
  const { root, snapshot } = await fixture(t);
  const machinePath = ["C:", "Users", "example", "private.md"].join("/");
  assert.equal(hasLocalReference(machinePath), true);
  assert.equal(hasLocalReference("[handoff](../tmp/record.md)"), true);
  assert.equal(hasLocalReference("[checkpoint](../../CURRENT.md)"), true);
  assert.equal(
    hasLocalReference("url.protocol === 'file:' || url.startsWith('file://')"),
    false,
  );
  await put(root, "README.md", "# Portable\n");
  await put(root, "docs/local.md", `See ${machinePath}\n`);
  await put(
    root,
    "apps/link.ts",
    "const invented = '[handoff](../tmp/record.md)';\n",
  );
  await put(root, "docs/handoff.md", "[handoff](../tmp/record.md)\n");
  const coverage = await snapshotFiles(
    root,
    [
      { path: "README.md" },
      { path: "docs/local.md" },
      { path: "apps/link.ts" },
      { path: "docs/handoff.md" },
    ],
    "full",
    snapshot,
  );
  assert.equal(
    coverage.manifest[1].disposition,
    "excluded:local-only-document",
  );
  assert.equal(coverage.manifest[2].disposition, "included");
  assert.equal(
    coverage.manifest[3].disposition,
    "excluded:local-only-document",
  );
  await put(root, "apps/private.ts", `const file = '${machinePath}';\n`);
  await assert.rejects(
    snapshotFiles(root, [{ path: "apps/private.ts" }], "full", snapshot),
    /local machine/u,
  );
});

test("security findings, skipped inputs and forged coverage withhold admission", () => {
  const valid = {
    suspiciousFilesResults: [],
    suspiciousGitDiffResults: [],
    suspiciousGitLogResults: [],
    skippedFiles: [],
    processedFiles: [{ path: "README.md" }],
    totalFiles: 1,
    safeFilePaths: ["README.md"],
  };
  admitPackResult(valid, ["README.md"]);
  for (const change of [
    { suspiciousFilesResults: [{}] },
    { suspiciousGitDiffResults: [{}] },
    { suspiciousGitLogResults: [{}] },
    { skippedFiles: [{}] },
    { processedFiles: [] },
    { totalFiles: 0 },
    { safeFilePaths: ["extra.md"] },
  ])
    assert.throws(() =>
      admitPackResult({ ...valid, ...change }, ["README.md"]),
    );
});

test(
  "actual Repomix keeps complete source and produces deterministic Markdown",
  { timeout: 60000 },
  async (t) => {
    const { directory, root, snapshot } = await fixture(t);
    await put(root, "README.md", "# Example\nA complete public fixture.\n");
    await put(
      root,
      "apps/[listingId]/example.ts",
      "\n// Retained comment\n\nexport const answer = 42;\n// [invented](../tmp/fixture.md)\n\n",
    );
    const coverage = await snapshotFiles(
      root,
      [{ path: "README.md" }, { path: "apps/[listingId]/example.ts" }],
      "full",
      snapshot,
    );
    const first = await renderPack(
      snapshot,
      path.join(directory, "first.md"),
      coverage,
      "Fixed fixture provenance.",
    );
    const second = await renderPack(
      snapshot,
      path.join(directory, "second.md"),
      coverage,
      "Fixed fixture provenance.",
    );
    assert.equal(first.files, 2);
    assert.equal(hash(first.bytes), hash(second.bytes));
    assert.ok(
      first.bytes.includes(
        Buffer.from("// Retained comment\n\nexport const answer = 42;"),
      ),
    );
    assert.ok(first.bytes.includes(Buffer.from("apps/[listingId]/example.ts")));
  },
);

test(
  "actual Repomix secret scanner rejects a credential canary",
  { timeout: 60000 },
  async (t) => {
    const { directory, root, snapshot } = await fixture(t);
    const canary = ["ghp_", "Q7Z2R8N4M6V9T3K5Q7Z2R8N4M6V9T3K5Q7Z2"].join("");
    await put(
      root,
      "apps/example.ts",
      `export const accessKey = '${canary}';\n`,
    );
    const coverage = await snapshotFiles(
      root,
      [{ path: "apps/example.ts" }],
      "full",
      snapshot,
    );
    await assert.rejects(
      renderPack(
        snapshot,
        path.join(directory, "rejected.md"),
        coverage,
        "Invented credential fixture.",
      ),
      /security scan rejected/u,
    );
  },
);

test(
  "end-to-end defaults to overview and rejection leaves no publishable artifact directory",
  { timeout: 60000 },
  async (t) => {
    const { directory, root } = await fixture(t);
    await put(root, "README.md", "# Invented repository\n");
    const git = (args) =>
      execFileSync(
        "git",
        [
          "-c",
          `safe.directory=${root.replaceAll("\\", "/")}`,
          "-C",
          root,
          ...args,
        ],
        { timeout: 10000, stdio: "pipe" },
      );
    git(["init", "--quiet"]);
    git(["add", "README.md"]);
    // This commit belongs only to the test's newly created temporary repository.
    git([
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Fixture",
    ]);
    const defaultDirectory = path.join(directory, "overview");
    const defaultResult = await buildContext({
      repository: root,
      outputDirectory: defaultDirectory,
    });
    assert.equal(defaultResult.mode, "overview");
    assert.equal(defaultResult.output.files, 1);
    const defaultCoverage = JSON.parse(
      await readFile(path.join(defaultDirectory, "coverage.json"), "utf8"),
    );
    assert.deepEqual(
      defaultCoverage.files.map((row) => row.path),
      ["README.md"],
    );
    const canary = ["ghp_", "Q7Z2R8N4M6V9T3K5Q7Z2R8N4M6V9T3K5Q7Z2"].join("");
    await put(
      root,
      "apps/example.ts",
      `export const accessKey = '${canary}';\n`,
    );
    git(["add", "apps/example.ts"]);
    git([
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Canary",
    ]);
    const outputDirectory = path.join(directory, "publish");
    await assert.rejects(
      buildContext({ repository: root, outputDirectory, mode: "full" }),
      /security scan rejected/u,
    );
    await assert.rejects(access(outputDirectory), { code: "ENOENT" });
  },
);

test("worker and cache overrides are rejected before library execution", async () => {
  for (const name of [
    "REPOMIX_WORKER_PATH",
    "REPOMIX_WORKER_TYPE",
    "REPOMIX_WASM_DIR",
    "REPOMIX_TOKEN_CACHE_PATH",
  ]) {
    const previous = process.env[name];
    process.env[name] = "invented-untrusted-override";
    try {
      await assert.rejects(
        renderPack("unused", "unused", { names: [] }, "unused"),
        /unsupported Repomix environment override/u,
      );
    } finally {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
  }
});
