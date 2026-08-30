import { execFileSync } from "node:child_process";

const SOURCE_COMMIT = /^[0-9a-f]{40}$/u;
const ERROR_MESSAGE = "The API build source identity is unavailable.";

export interface BuildSourceIdentityReader {
  readonly readHead: (repositoryDirectory: string) => string;
  readonly readStatus: (repositoryDirectory: string) => string;
}

const gitReader: BuildSourceIdentityReader = Object.freeze({
  readHead(repositoryDirectory: string) {
    return runGit(repositoryDirectory, ["rev-parse", "HEAD"]);
  },
  readStatus(repositoryDirectory: string) {
    return runGit(repositoryDirectory, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]);
  },
});

export function resolveCleanBuildSourceIdentity(
  repositoryDirectory: string,
  reader: BuildSourceIdentityReader = gitReader,
): string {
  try {
    if (reader.readStatus(repositoryDirectory) !== "") fail();
    const sourceCommit = reader.readHead(repositoryDirectory);
    if (!SOURCE_COMMIT.test(sourceCommit)) fail();
    if (reader.readStatus(repositoryDirectory) !== "") fail();
    return sourceCommit;
  } catch {
    fail();
  }
}

function runGit(
  repositoryDirectory: string,
  command: readonly string[],
): string {
  return execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${repositoryDirectory.replaceAll("\\", "/")}`,
      ...command,
    ],
    {
      cwd: repositoryDirectory,
      encoding: "utf8",
    },
  ).trim();
}

function fail(): never {
  throw new TypeError(ERROR_MESSAGE);
}
