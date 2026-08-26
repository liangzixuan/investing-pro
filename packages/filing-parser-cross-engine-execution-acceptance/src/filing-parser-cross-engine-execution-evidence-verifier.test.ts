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
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  createFilingParserCrossEngineExecutionEvidenceV2,
  createFilingParserCrossEngineExecutionEvidenceV3,
  filingParserCrossEngineExecutionEvidenceV2Sha256,
  filingParserCrossEngineExecutionEvidenceV3Sha256,
  filingParserCrossEngineExecutionV2AgreementSha256,
  filingParserCrossEngineExecutionV2RequiredSourcePaths,
  filingParserCrossEngineExecutionV3InvocationBindingSha256,
  filingParserCrossEngineExecutionV3LifecycleBindingSha256,
  filingParserCrossEngineExecutionV3RequiredSourcePaths,
  filingParserCrossEngineImplementationSha256,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
  type FilingParserCrossEngineExecutionEvidenceV3,
  type FilingParserCrossEngineExecutionEvidenceV3Invocation,
} from "./filing-parser-cross-engine-execution-evidence";

import {
  cleanFilingParserCrossEngineExecutionGitEnvironment,
  filingParserCrossEngineExecutionCorrectiveChainAllowed,
  filingParserCrossEngineExecutionFileSizeAllowed,
  filingParserCrossEngineExecutionGitArguments,
  filingParserCrossEngineExecutionV2ChainAllowed,
  filingParserCrossEngineExecutionV3ChainAllowed,
  repositoryRelativePathIsContained,
  verifyFilingParserCrossEngineExecutionEvidenceOffline,
} from "./filing-parser-cross-engine-execution-evidence-verifier";
import {
  buildFilingParserCrossEngineExecutionEvidenceV2Input,
  buildFilingParserCrossEngineExecutionEvidenceV3Input,
} from "./test-filing-parser-cross-engine-execution-evidence-builder";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("offline cross-engine evidence verifier hardening", () => {
  it("reviews a canonical v3 direct-child artifact end to end and rejects local drift", async () => {
    const fixture = await v3RepositoryFixture();
    await expect(
      verifyFilingParserCrossEngineExecutionEvidenceOffline(fixture.options),
    ).resolves.toMatchObject({
      baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
      evidenceVersion: 3,
      historicalV2: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
      verdict: "offline_consistent",
    });
    await writeFile(
      join(
        fixture.repository,
        "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-direct-execution.ts",
      ),
      "source mutation\n",
    );
    await expect(
      verifyFilingParserCrossEngineExecutionEvidenceOffline(fixture.options),
    ).rejects.toThrow(
      "Offline filing parser cross-engine execution evidence review failed.",
    );
  }, 30_000);

  it("reviews a canonical v2 artifact end to end and rejects a local source mutation", async () => {
    const fixture = await v2RepositoryFixture();
    await expect(
      verifyFilingParserCrossEngineExecutionEvidenceOffline(fixture.options),
    ).resolves.toMatchObject({
      baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
      evidenceVersion: 2,
      failedPrecursorRevision:
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
      failedRun: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
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
  it("requires the exact two-commit v2 corrective chain rooted at the Cycle 2k baseline", () => {
    const baseline = FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE;
    const failedPrecursor =
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION;
    const revision = "c".repeat(40);
    expect(
      filingParserCrossEngineExecutionV2ChainAllowed(
        baseline,
        "2",
        "2",
        revision,
        `${revision} ${failedPrecursor}`,
        `${failedPrecursor} ${baseline}`,
      ),
    ).toBe(true);
    for (const values of [
      [
        "a".repeat(40),
        "2",
        "2",
        revision,
        `${revision} ${failedPrecursor}`,
        `${failedPrecursor} ${baseline}`,
      ],
      [
        baseline,
        "1",
        "2",
        revision,
        `${revision} ${failedPrecursor}`,
        `${failedPrecursor} ${baseline}`,
      ],
      [
        baseline,
        "2",
        "1",
        revision,
        `${revision} ${failedPrecursor}`,
        `${failedPrecursor} ${baseline}`,
      ],
      [
        baseline,
        "2",
        "2",
        revision,
        `${revision} ${baseline}`,
        `${failedPrecursor} ${baseline}`,
      ],
      [
        baseline,
        "2",
        "2",
        revision,
        `${revision} ${failedPrecursor}`,
        `${failedPrecursor} ${baseline} ${baseline}`,
      ],
      [
        baseline,
        "2",
        "2",
        "not-a-revision",
        `not-a-revision ${failedPrecursor}`,
        `${failedPrecursor} ${baseline}`,
      ],
    ] as const)
      expect(
        filingParserCrossEngineExecutionV2ChainAllowed(
          ...(values as Parameters<
            typeof filingParserCrossEngineExecutionV2ChainAllowed
          >),
        ),
      ).toBe(false);
  });

  it("requires the exact one-commit v3 direct child of the promoted Cycle 2l baseline", () => {
    const baseline = FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE;
    const revision = "d".repeat(40);
    const valid = [
      baseline,
      "1",
      "1",
      revision,
      `${revision} ${baseline}`,
    ] as const;
    expect(filingParserCrossEngineExecutionV3ChainAllowed(...valid)).toBe(true);
    for (const mutate of [
      (values: string[]) => {
        values[0] = "a".repeat(40);
      },
      (values: string[]) => {
        values[1] = "2";
      },
      (values: string[]) => {
        values[2] = "2";
      },
      (values: string[]) => {
        values[3] = baseline;
      },
      (values: string[]) => {
        values[3] = "not-a-commit";
      },
      (values: string[]) => {
        values[4] = `${revision} ${"a".repeat(40)}`;
      },
      (values: string[]) => {
        values[4] = `${revision} ${baseline} ${baseline}`;
      },
      (values: string[]) => {
        values[4] += " ";
      },
    ]) {
      const values = [...valid];
      mutate(values);
      expect(
        filingParserCrossEngineExecutionV3ChainAllowed(
          ...(values as Parameters<
            typeof filingParserCrossEngineExecutionV3ChainAllowed
          >),
        ),
      ).toBe(false);
    }
  });
});

async function v3RepositoryFixture() {
  const root = await mkdtemp(
    join(await realpath(tmpdir()), "cycle2m-cross-engine-review-"),
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
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
  ]);
  for (const path of candidateOverlayPaths(git, sourceRepository)) {
    const source = join(sourceRepository, ...path.split("/"));
    const destination = join(repository, ...path.split("/"));
    await mkdir(join(destination, ".."), { recursive: true });
    await cp(source, destination, { force: true, recursive: true });
  }
  runGit(git, repository, ["add", "--all"]);
  runGit(git, repository, [
    "-c",
    "user.name=Cycle2m Test",
    "-c",
    "user.email=cycle2m@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  ]);
  const revision = runGit(git, repository, ["rev-parse", "HEAD"]).trim();
  const transition = Object.freeze(
    runGit(git, repository, [
      "diff",
      "--name-status",
      "--no-renames",
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
      revision,
      "--",
    ])
      .trimEnd()
      .split("\n")
      .map((line) => {
        const match = /^(A|M)\t([^\t\r\n]+)$/u.exec(line);
        if (match?.[1] === undefined || match[2] === undefined)
          throw new Error("fixture setup failed");
        return Object.freeze({
          path: match[2].replaceAll("\\", "/"),
          status: match[1] as "A" | "M",
        });
      })
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      ),
  );
  const sourcePaths =
    filingParserCrossEngineExecutionV3RequiredSourcePaths(transition);
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
  const input = buildFilingParserCrossEngineExecutionEvidenceV3Input();
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
    success.invocations === null ||
    success.originalArchiveSha256 === null ||
    success.amendmentArchiveSha256 === null
  )
    throw new Error("fixture setup failed");
  const invocations = Object.freeze(
    success.invocations.map((invocation) =>
      rebindV3Invocation(
        invocation,
        engines,
        success.originalArchiveSha256 as `sha256:${string}`,
        success.amendmentArchiveSha256 as `sha256:${string}`,
      ),
    ),
  ) as unknown as FilingParserCrossEngineExecutionEvidenceV3["caseOutcomes"][number]["invocations"];
  const caseOutcomes = Object.freeze([
    Object.freeze({ ...success, invocations }),
    ...input.caseOutcomes.slice(1),
  ]);
  const manifest = sourceHashes.find(
    ({ path }) =>
      path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v3/manifest.json",
  );
  if (manifest === undefined) throw new Error("fixture setup failed");
  const artifactName = `filing-parser-cross-engine-execution-evidence-v3-${revision}-1`;
  const evidence = createFilingParserCrossEngineExecutionEvidenceV3({
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
    serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(evidence),
  );
  return {
    options: {
      evidencePath,
      expectedArtifactName: artifactName,
      expectedEvidenceSha256:
        filingParserCrossEngineExecutionEvidenceV3Sha256(evidence),
      expectedRepository: evidence.repository,
      expectedRevision: revision,
      expectedRunAttempt: evidence.workflow.runAttempt,
      expectedRunId: evidence.workflow.runId,
      repositoryPath: repository,
    },
    repository,
  };
}

function candidateOverlayPaths(
  git: string,
  sourceRepository: string,
): string[] {
  const diff = runAnchoredGit(git, sourceRepository, [
    "diff",
    "--name-status",
    "--no-renames",
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
    "--",
  ])
    .trimEnd()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^(A|M)\t([^\t\r\n]+)$/u.exec(line);
      if (match?.[2] === undefined) throw new Error("fixture setup failed");
      return match[2].replaceAll("\\", "/");
    });
  const untracked = runAnchoredGit(git, sourceRepository, [
    "ls-files",
    "--others",
    "--exclude-standard",
  ])
    .trimEnd()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((path) => path.replaceAll("\\", "/"));
  return [...new Set([...diff, ...untracked])].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function rebindV3Invocation(
  invocation: FilingParserCrossEngineExecutionEvidenceV3Invocation,
  engines: FilingParserCrossEngineExecutionEvidenceV3["engines"],
  originalArchiveSha256: `sha256:${string}`,
  amendmentArchiveSha256: `sha256:${string}`,
): FilingParserCrossEngineExecutionEvidenceV3Invocation {
  const lifecycleReceipts = Object.freeze(
    invocation.lifecycleReceipts.map((receipt) => {
      const engine =
        receipt.role === "python-primary" ? engines[0] : engines[1];
      const preimage = Object.freeze({
        archiveSha256: receipt.archiveSha256,
        containerIdSha256: receipt.containerIdSha256,
        documentRole: receipt.documentRole,
        documentSha256: receipt.documentSha256,
        engineId: engine.engineId,
        imageSha256: engine.builtImageId,
        implementationSha256: engine.implementationSha256,
        keyId: receipt.keyId,
        publicKeySpkiSha256: receipt.publicKeySpkiSha256,
        role: receipt.role,
        zeroResidue: true as const,
      });
      return Object.freeze({
        ...preimage,
        lifecycleBindingSha256:
          filingParserCrossEngineExecutionV3LifecycleBindingSha256(preimage),
      });
    }),
  ) as unknown as FilingParserCrossEngineExecutionEvidenceV3Invocation["lifecycleReceipts"];
  const agreementEngines = Object.freeze([
    Object.freeze({
      ...invocation.agreementEngines[0],
      engineId: engines[0].engineId,
      imageSha256: engines[0].builtImageId,
      implementationSha256: engines[0].implementationSha256,
      role: "python-primary" as const,
    }),
    Object.freeze({
      ...invocation.agreementEngines[1],
      engineId: engines[1].engineId,
      imageSha256: engines[1].builtImageId,
      implementationSha256: engines[1].implementationSha256,
      role: "node-secondary" as const,
    }),
  ] as const);
  const agreementSha256 = filingParserCrossEngineExecutionV2AgreementSha256({
    amendmentArchiveSha256,
    engines: agreementEngines,
    normalizationSha256: invocation.normalizationSha256,
    originalArchiveSha256,
  });
  const invocationBindingSha256 =
    filingParserCrossEngineExecutionV3InvocationBindingSha256({
      agreementSha256,
      executionMode: invocation.executionMode,
      keyId: invocation.keyId,
      lifecycleReceipts,
      normalizationSha256: invocation.normalizationSha256,
      publicKeySpkiSha256: invocation.publicKeySpkiSha256,
    });
  return Object.freeze({
    ...invocation,
    agreementEngines,
    agreementSha256,
    invocationBindingSha256,
    lifecycleReceipts,
  });
}

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
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
  ]);
  const correctivePath = join(
    repository,
    "packages/filing-parser-cross-engine-execution/src/filing-parser-cross-engine-execution.ts",
  );
  await writeFile(
    correctivePath,
    Buffer.concat([
      await readFile(correctivePath),
      Buffer.from("\n// Cycle 2l verifier fixture.\n", "utf8"),
    ]),
  );
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
  const transition = Object.freeze(
    runGit(git, repository, [
      "diff",
      "--name-status",
      "--no-renames",
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
      revision,
      "--",
    ])
      .trimEnd()
      .split("\n")
      .map((line) => {
        const match = /^(A|M)\t([^\t\r\n]+)$/u.exec(line);
        if (match?.[1] === undefined || match[2] === undefined)
          throw new Error("fixture setup failed");
        return Object.freeze({
          path: match[2].replaceAll("\\", "/"),
          status: match[1] as "A" | "M",
        });
      })
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      ),
  );
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

function runAnchoredGit(
  git: string,
  repository: string,
  args: readonly string[],
): string {
  return execFileSync(
    git,
    [
      "--no-replace-objects",
      "--no-lazy-fetch",
      "-c",
      "advice.graftFileDeprecated=false",
      "-C",
      repository,
      `--git-dir=${join(repository, ".git")}`,
      `--work-tree=${repository}`,
      ...args,
    ],
    {
      encoding: "utf8",
      env: cleanFilingParserCrossEngineExecutionGitEnvironment(process.env),
    },
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
