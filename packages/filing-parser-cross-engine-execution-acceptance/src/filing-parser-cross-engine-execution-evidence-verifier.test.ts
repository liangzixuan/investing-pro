import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  createFilingParserCrossEngineExecutionEvidenceV2,
  filingParserCrossEngineExecutionEvidenceV2Sha256,
  filingParserCrossEngineExecutionV2AgreementSha256,
  filingParserCrossEngineExecutionV2RequiredSourcePaths,
  filingParserCrossEngineImplementationSha256,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
} from "./filing-parser-cross-engine-execution-evidence";

import {
  cleanFilingParserCrossEngineExecutionGitEnvironment,
  filingParserCrossEngineExecutionCorrectiveChainAllowed,
  filingParserCrossEngineExecutionFileSizeAllowed,
  filingParserCrossEngineExecutionGitArguments,
  filingParserCrossEngineExecutionV2ChainAllowed,
  repositoryRelativePathIsContained,
  verifyFilingParserCrossEngineExecutionEvidenceOffline,
} from "./filing-parser-cross-engine-execution-evidence-verifier";
import { buildFilingParserCrossEngineExecutionEvidenceV2Input } from "./test-filing-parser-cross-engine-execution-evidence-builder";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("offline cross-engine evidence verifier hardening", () => {
  it("reviews a canonical v2 artifact end to end and rejects a local source mutation", async () => {
    const fixture = await v2RepositoryFixture();
    await expect(
      verifyFilingParserCrossEngineExecutionEvidenceOffline(fixture.options),
    ).resolves.toMatchObject({
      baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
      evidenceVersion: 2,
      verdict: "offline_consistent",
    });

    await writeFile(
      join(
        fixture.repository,
        "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
      ),
      "source mutation\n",
    );
    await expect(
      verifyFilingParserCrossEngineExecutionEvidenceOffline(fixture.options),
    ).rejects.toThrow(
      "Offline filing parser cross-engine execution evidence review failed.",
    );
  }, 30_000);

  it("uses fixed replacement/lazy-fetch/config-resistant Git arguments", () => {
    expect(
      filingParserCrossEngineExecutionGitArguments("/repo", ["show", "a:b"]),
    ).toEqual([
      "--no-replace-objects",
      "--no-lazy-fetch",
      "-c",
      "advice.graftFileDeprecated=false",
      "-C",
      "/repo",
      "show",
      "a:b",
    ]);
  });
  it("scrubs hostile Git, loader, credential and prompt variables", () => {
    const clean = cleanFilingParserCrossEngineExecutionGitEnvironment(
      {
        PATH: "/bin",
        GIT_DIR: "evil",
        Git_Config_Global: "evil",
        GCM_INTERACTIVE: "Always",
        LD_PRELOAD: "evil",
        DYLD_INSERT_LIBRARIES: "evil",
      },
      "linux",
    );
    expect(clean.PATH).toBe("/bin");
    expect(clean.GIT_DIR).toBeUndefined();
    expect(clean.LD_PRELOAD).toBeUndefined();
    expect(clean.GIT_CONFIG_GLOBAL).toBe("/dev/null");
    expect(clean.GIT_NO_REPLACE_OBJECTS).toBe("1");
    expect(clean.GIT_NO_LAZY_FETCH).toBe("1");
    expect(clean.GIT_TERMINAL_PROMPT).toBe("0");
    expect(clean.GCM_INTERACTIVE).toBe("Never");
  });
  it("rejects POSIX, Windows and UNC escapes", () => {
    for (const value of [
      "../x",
      "..\\x",
      "/x",
      "\\\\server\\share",
      "C:\\x",
      "",
    ])
      expect(repositoryRelativePathIsContained(value)).toBe(false);
    expect(repositoryRelativePathIsContained("packages/x.ts")).toBe(true);
  });
  it("requires the exact five-commit corrective chain and rejects ancestry drift", () => {
    const baseline = "962a00f65835fc6126e4da98e0e0d5998e8d59cc";
    const failedPrecursor = "14b4ecf41806dca7759a06bebf7ef8da96374f76";
    const failedCorrective = "061944f8f770e8a08b2a38d1e2fedf8b8e2de348";
    const failedRecovery = "f29e39cea40e76d500df833fd8e0e94e0c86a68c";
    const failedDiagnostic = "abd65313705282dab8071f5d36c78d31b1720ee3";
    const revision = "b".repeat(40);
    const validArguments = [
      baseline,
      "5",
      "5",
      revision,
      `${revision} ${failedDiagnostic}`,
      `${failedDiagnostic} ${failedRecovery}`,
      `${failedRecovery} ${failedCorrective}`,
      `${failedCorrective} ${failedPrecursor}`,
      `${failedPrecursor} ${baseline}`,
    ] as const;
    expect(
      filingParserCrossEngineExecutionCorrectiveChainAllowed(...validArguments),
    ).toBe(true);
    const mutations: Array<(values: string[]) => void> = [
      (values) => {
        values[0] = "a".repeat(40);
      },
      (values) => {
        values[1] = "4";
      },
      (values) => {
        values[2] = "4";
      },
      (values) => {
        values[4] = `${revision} ${failedRecovery}`;
      },
      (values) => {
        values[4] = `${revision} ${failedDiagnostic} ${failedRecovery}`;
      },
      (values) => {
        values[4] = `${revision} ${failedRecovery} ${failedDiagnostic}`;
      },
      (values) => {
        values[5] = `${failedDiagnostic} ${failedCorrective}`;
      },
      (values) => {
        values[5] = `${failedDiagnostic} ${failedRecovery} ${failedCorrective}`;
      },
      (values) => {
        values[5] = `${failedDiagnostic} ${failedCorrective} ${failedRecovery}`;
      },
      (values) => {
        values[6] = `${failedRecovery} ${failedPrecursor}`;
      },
      (values) => {
        values[6] = `${failedRecovery} ${failedCorrective} ${failedPrecursor}`;
      },
      (values) => {
        values[6] = `${failedRecovery} ${failedPrecursor} ${failedCorrective}`;
      },
      (values) => {
        values[7] = `${failedCorrective} ${baseline}`;
      },
      (values) => {
        values[7] = `${failedCorrective} ${failedPrecursor} ${baseline}`;
      },
      (values) => {
        values[7] = `${failedCorrective} ${baseline} ${failedPrecursor}`;
      },
      (values) => {
        values[8] = `${failedPrecursor} ${"a".repeat(40)}`;
      },
      (values) => {
        values[8] = `${failedPrecursor} ${baseline} ${"a".repeat(40)}`;
      },
      (values) => {
        values[8] = `${failedPrecursor} ${"a".repeat(40)} ${baseline}`;
      },
      (values) => {
        values[4] += " ";
      },
      (values) => {
        values[5] += " ";
      },
      (values) => {
        values[6] += " ";
      },
      (values) => {
        values[7] += " ";
      },
      (values) => {
        values[8] += " ";
      },
    ];
    for (const mutate of mutations) {
      const values = [...validArguments];
      mutate(values);
      expect(
        filingParserCrossEngineExecutionCorrectiveChainAllowed(
          ...(values as Parameters<
            typeof filingParserCrossEngineExecutionCorrectiveChainAllowed
          >),
        ),
      ).toBe(false);
    }
  });
  it("rejects empty, oversized, fractional, and unsafe file sizes", () => {
    expect(filingParserCrossEngineExecutionFileSizeAllowed(1, 10)).toBe(true);
    expect(filingParserCrossEngineExecutionFileSizeAllowed(10, 10)).toBe(true);
    for (const size of [0, 11, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(filingParserCrossEngineExecutionFileSizeAllowed(size, 10)).toBe(
        false,
      );
  });
  it("requires the exact one-commit v2 transition rooted at the Cycle 2k baseline", () => {
    const baseline = "b9b7dd19996f0c5bb1e073ab5522c42e06dee397";
    const revision = "c".repeat(40);
    expect(
      filingParserCrossEngineExecutionV2ChainAllowed(
        baseline,
        "1",
        "1",
        revision,
        `${revision} ${baseline}`,
      ),
    ).toBe(true);
    for (const values of [
      ["a".repeat(40), "1", "1", revision, `${revision} ${baseline}`],
      [baseline, "2", "1", revision, `${revision} ${baseline}`],
      [baseline, "1", "2", revision, `${revision} ${baseline}`],
      [baseline, "1", "1", revision, `${revision} ${baseline} ${baseline}`],
      [baseline, "1", "1", "not-a-revision", `not-a-revision ${baseline}`],
    ] as const)
      expect(
        filingParserCrossEngineExecutionV2ChainAllowed(
          ...(values as Parameters<
            typeof filingParserCrossEngineExecutionV2ChainAllowed
          >),
        ),
      ).toBe(false);
  });
});

async function v2RepositoryFixture() {
  const root = await mkdtemp(
    join(await realpath(tmpdir()), "cycle2l-cross-engine-review-"),
  );
  temporaryDirectories.push(root);
  const repository = join(root, "repo");
  const evidenceDirectory = join(root, "evidence");
  const sourceRepository = await realpath(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const git = trustedGitPath();
  await mkdir(repository, { recursive: true });
  runGit(git, repository, ["init", "--quiet"]);
  const fixtureObjectDirectory = join(repository, ".git", "objects");
  await rm(fixtureObjectDirectory, { force: true, recursive: true });
  await cp(join(sourceRepository, ".git", "objects"), fixtureObjectDirectory, {
    recursive: true,
  });
  runGit(git, repository, [
    "checkout",
    "--quiet",
    "--detach",
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
  ]);
  const transition = Object.freeze(
    [
      {
        path: "fixtures/synthetic/filing-parser-cross-engine-execution/v2/cases.json",
        status: "A" as const,
      },
      {
        path: "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
        status: "A" as const,
      },
      {
        path: "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
        status: "M" as const,
      },
    ].sort((left, right) => left.path.localeCompare(right.path)),
  );
  for (const entry of transition) {
    const target = join(repository, ...entry.path.split("/"));
    await mkdir(dirname(target), { recursive: true });
    if (entry.status === "A") await writeFile(target, `source:${entry.path}\n`);
    else {
      const existing = await readFile(target);
      await writeFile(
        target,
        Buffer.concat([
          existing,
          Buffer.from("\n// Cycle 2l verifier fixture.\n", "utf8"),
        ]),
      );
    }
  }
  runGit(git, repository, ["add", "--all"]);
  runGit(git, repository, [
    "-c",
    "user.name=Cycle2l Test",
    "-c",
    "user.email=cycle2l@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  ]);
  const revision = runGit(git, repository, ["rev-parse", "HEAD"]).trim();
  const sourcePaths =
    filingParserCrossEngineExecutionV2RequiredSourcePaths(transition);
  const sourceHashes = Object.freeze(
    await Promise.all(
      sourcePaths.map(async (path) =>
        Object.freeze({
          path,
          sha256: sha256(await readFile(join(repository, ...path.split("/")))),
        }),
      ),
    ),
  );
  const input = buildFilingParserCrossEngineExecutionEvidenceV2Input();
  const pythonSources = implementationSourcesForFixture(
    sourceHashes,
    FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python,
  );
  const nodeSources = implementationSourcesForFixture(
    sourceHashes,
    FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node,
  );
  const engines = Object.freeze([
    Object.freeze({
      ...input.engines[0],
      implementationSha256:
        filingParserCrossEngineImplementationSha256(pythonSources),
      implementationSourceHashes: pythonSources,
    }),
    Object.freeze({
      ...input.engines[1],
      implementationSha256:
        filingParserCrossEngineImplementationSha256(nodeSources),
      implementationSourceHashes: nodeSources,
    }),
  ] as const);
  const success = input.caseOutcomes[0];
  if (
    success === undefined ||
    success.amendmentArchiveSha256 === null ||
    success.normalizationSha256 === null ||
    success.originalArchiveSha256 === null ||
    success.pythonExecutionBindingSha256 === null ||
    success.nodeExecutionBindingSha256 === null
  )
    throw new Error("fixture setup failed");
  const caseOutcomes = Object.freeze([
    Object.freeze({
      ...success,
      agreementSha256: filingParserCrossEngineExecutionV2AgreementSha256({
        amendmentArchiveSha256: success.amendmentArchiveSha256,
        engines: [
          {
            engineId: engines[0].engineId,
            executionBindingSha256: success.pythonExecutionBindingSha256,
            imageSha256: engines[0].builtImageId,
            implementationSha256: engines[0].implementationSha256,
            role: "python-primary",
          },
          {
            engineId: engines[1].engineId,
            executionBindingSha256: success.nodeExecutionBindingSha256,
            imageSha256: engines[1].builtImageId,
            implementationSha256: engines[1].implementationSha256,
            role: "node-secondary",
          },
        ],
        normalizationSha256: success.normalizationSha256,
        originalArchiveSha256: success.originalArchiveSha256,
      }),
    }),
    ...input.caseOutcomes.slice(1),
  ]);
  const manifest = sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
  );
  if (manifest === undefined) throw new Error("fixture setup failed");
  const artifactName = `filing-parser-cross-engine-execution-evidence-v2-${revision}-1`;
  const evidence = createFilingParserCrossEngineExecutionEvidenceV2({
    ...input,
    caseOutcomes,
    engines,
    fixtureManifestSha256: manifest.sha256,
    revision,
    sourceHashes,
    transition: { entries: transition, pathCount: transition.length },
    workflow: { ...input.workflow, artifactName },
  });
  await mkdir(evidenceDirectory);
  const evidencePath = join(evidenceDirectory, "evidence.json");
  await writeFile(
    evidencePath,
    serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2(evidence),
  );
  return {
    options: {
      evidencePath,
      expectedArtifactName: artifactName,
      expectedEvidenceSha256:
        filingParserCrossEngineExecutionEvidenceV2Sha256(evidence),
      expectedRepository: evidence.repository,
      expectedRevision: revision,
      expectedRunAttempt: evidence.workflow.runAttempt,
      expectedRunId: evidence.workflow.runId,
      repositoryPath: repository,
    },
    repository,
  };
}

function implementationSourcesForFixture(
  sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[],
  paths: readonly string[],
): readonly FilingParserCrossEngineExecutionEvidenceSourceHash[] {
  return Object.freeze(
    paths.map((path) => {
      const source = sourceHashes.find((candidate) => candidate.path === path);
      if (source === undefined) throw new Error("fixture setup failed");
      return source;
    }),
  );
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
  return execFileSync(
    git,
    ["-c", "advice.graftFileDeprecated=false", "-C", repository, ...args],
    {
      encoding: "utf8",
      env: cleanFilingParserCrossEngineExecutionGitEnvironment(process.env),
    },
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
