import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS,
  createFilingParserNormalizationExecutionEvidence,
  filingParserNormalizationExecutionEvidenceSha256,
  serializeCanonicalFilingParserNormalizationExecutionEvidence,
} from "./filing-parser-normalization-execution-evidence";
import {
  cleanGitEnvironment,
  filingParserNormalizationExecutionGitArguments,
  normalizeFilingParserNormalizationExecutionEvidenceReviewOptions,
  verifyFilingParserNormalizationExecutionEvidenceOffline,
} from "./filing-parser-normalization-execution-evidence-verifier";
import { buildFilingParserNormalizationExecutionEvidenceInput } from "./test-filing-parser-normalization-execution-evidence-builder";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("Cycle 2j offline evidence verifier", () => {
  it("reviews one canonical exact-commit record under hostile PATH and Git environment", async () => {
    const fixture = await repositoryFixture();
    const originalEnvironment = { ...process.env };
    const wrapperDirectory = join(fixture.root, "wrapper");
    await mkdir(wrapperDirectory);
    const wrapper = join(
      wrapperDirectory,
      process.platform === "win32" ? "git.cmd" : "git",
    );
    await writeFile(
      wrapper,
      process.platform === "win32" ? "@exit /b 99\r\n" : "#!/bin/sh\nexit 99\n",
    );
    if (process.platform !== "win32") await chmod(wrapper, 0o755);
    Object.assign(process.env, {
      GIT_ALTERNATE_OBJECT_DIRECTORIES: join(fixture.root, "alternate"),
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.fsmonitor",
      GIT_CONFIG_VALUE_0: "malicious",
      GIT_DIR: join(fixture.root, "wrong-git-dir"),
      GIT_GRAFT_FILE: join(fixture.root, "grafts"),
      GIT_INDEX_FILE: join(fixture.root, "index"),
      GIT_NAMESPACE: "malicious",
      GIT_OBJECT_DIRECTORY: join(fixture.root, "objects"),
      GIT_REPLACE_REF_BASE: "refs/replace-malicious/",
      GIT_WORK_TREE: join(fixture.root, "wrong-worktree"),
      PATH: wrapperDirectory,
    });
    try {
      await expect(
        verifyFilingParserNormalizationExecutionEvidenceOffline(
          fixture.options,
        ),
      ).resolves.toMatchObject({ verdict: "offline_consistent" });
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, originalEnvironment);
    }
  }, 30_000);

  it("rejects wrong anchors and a symlinked evidence ancestor", async () => {
    const fixture = await repositoryFixture();
    await expect(
      verifyFilingParserNormalizationExecutionEvidenceOffline({
        ...fixture.options,
        expectedEvidenceSha256: `sha256:${"0".repeat(64)}`,
      }),
    ).rejects.toThrow("evidence review failed");
    if (process.platform !== "win32") {
      const alias = join(fixture.root, "evidence-alias");
      await symlink(fixture.evidenceDirectory, alias, "dir");
      await expect(
        verifyFilingParserNormalizationExecutionEvidenceOffline({
          ...fixture.options,
          evidencePath: join(alias, "evidence.json"),
        }),
      ).rejects.toThrow("evidence review failed");
    }
  }, 30_000);

  it("forces replacement-safe arguments and strips every ambient Git override", () => {
    expect(
      filingParserNormalizationExecutionGitArguments("/repo", [
        "show",
        "HEAD:x",
      ]).slice(0, 5),
    ).toEqual([
      "--no-replace-objects",
      "--no-lazy-fetch",
      "-c",
      "advice.graftFileDeprecated=false",
      "-C",
    ]);
    const environment = cleanGitEnvironment(
      {
        GIT_DIR: "bad",
        git_object_directory: "bad",
        GIT_CONFIG_GLOBAL: "bad",
        LD_AUDIT: "bad",
        LD_PRELOAD: "bad",
        DYLD_FALLBACK_LIBRARY_PATH: "bad",
        PATH: "retained-for-non-git-tools",
      },
      "linux",
    );
    expect(environment.GIT_DIR).toBeUndefined();
    expect(environment.git_object_directory).toBeUndefined();
    expect(environment.GIT_CONFIG_GLOBAL).toBe("/dev/null");
    expect(environment.LD_AUDIT).toBeUndefined();
    expect(environment.LD_PRELOAD).toBeUndefined();
    expect(environment.DYLD_FALLBACK_LIBRARY_PATH).toBeUndefined();
    expect(environment.GIT_GRAFT_FILE).toBe("/dev/null");
    expect(environment.GIT_NO_REPLACE_OBJECTS).toBe("1");
  });

  it("snapshots exact own data anchors and rejects substitution carriers", async () => {
    const fixture = await repositoryFixture();
    const mutable = { ...fixture.options };
    const snapshot =
      normalizeFilingParserNormalizationExecutionEvidenceReviewOptions(mutable);
    mutable.expectedRevision = "0".repeat(40);
    expect(snapshot.expectedRevision).toBe(fixture.options.expectedRevision);
    expect(Object.isFrozen(snapshot)).toBe(true);

    let accessorReads = 0;
    const accessor = { ...fixture.options };
    Object.defineProperty(accessor, "expectedRevision", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return accessorReads === 1
          ? fixture.options.expectedRevision
          : "0".repeat(40);
      },
    });
    const symbolKeyed = Object.assign(
      { ...fixture.options },
      {
        [Symbol("anchor")]: "bad",
      },
    );
    const inherited = Object.create(fixture.options) as typeof fixture.options;
    const proxied = new Proxy({ ...fixture.options }, {});
    for (const candidate of [
      accessor,
      symbolKeyed,
      inherited,
      proxied,
      { ...fixture.options, extra: "bad" },
    ])
      expect(() =>
        normalizeFilingParserNormalizationExecutionEvidenceReviewOptions(
          candidate,
        ),
      ).toThrow("evidence review failed");
    expect(accessorReads).toBe(0);
  }, 30_000);
});

async function repositoryFixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "cycle2j-review-"));
  temporaryDirectories.push(root);
  const repository = join(root, "repo");
  const evidenceDirectory = join(root, "evidence");
  await mkdir(repository);
  await mkdir(evidenceDirectory);
  for (const path of FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS) {
    const target = join(repository, ...path.split("/"));
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, `source:${path}\n`);
  }
  const git = trustedGitPath();
  runGit(git, repository, ["init"]);
  runGit(git, repository, ["add", "--all"]);
  runGit(git, repository, [
    "-c",
    "user.name=Cycle2j Test",
    "-c",
    "user.email=cycle2j@example.invalid",
    "commit",
    "-m",
    "fixture",
  ]);
  const revision = runGit(git, repository, ["rev-parse", "HEAD"]).trim();
  const sourceHashes =
    FILING_PARSER_NORMALIZATION_EXECUTION_EVIDENCE_SOURCE_PATHS.map((path) => ({
      path,
      sha256: sha256(Buffer.from(`source:${path}\n`, "utf8")),
    }));
  const manifest = sourceHashes.find(({ path }) =>
    path.endsWith("/manifest.json"),
  );
  if (manifest === undefined) throw new Error("missing manifest");
  const input = buildFilingParserNormalizationExecutionEvidenceInput();
  const evidence = createFilingParserNormalizationExecutionEvidence({
    ...input,
    fixtureManifestSha256: manifest.sha256,
    revision,
    sourceHashes,
  });
  const evidencePath = join(evidenceDirectory, "evidence.json");
  await writeFile(
    evidencePath,
    serializeCanonicalFilingParserNormalizationExecutionEvidence(evidence),
  );
  return {
    evidenceDirectory,
    evidencePath,
    options: {
      evidencePath,
      expectedEvidenceSha256:
        filingParserNormalizationExecutionEvidenceSha256(evidence),
      expectedRepository: evidence.repository,
      expectedRevision: revision,
      expectedRunAttempt: evidence.workflow.runAttempt,
      expectedRunId: evidence.workflow.runId,
      repositoryPath: repository,
    },
    root,
  };
}

function trustedGitPath(): string {
  return process.platform === "win32"
    ? "C:\\Program Files\\Git\\cmd\\git.exe"
    : "/usr/bin/git";
}

function runGit(
  git: string,
  repository: string,
  args: readonly string[],
): string {
  return execFileSync(git, ["-C", repository, ...args], {
    encoding: "utf8",
    env: cleanGitEnvironment(process.env),
  });
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
