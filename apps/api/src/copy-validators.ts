import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { resolveCleanBuildSourceIdentity } from "./build-source-identity";

const apiDirectory = process.cwd();
const repositoryDirectory = resolve(apiDirectory, "../..");
const expectedSourceCommit = process.argv[2];
if (
  expectedSourceCommit === undefined ||
  resolveCleanBuildSourceIdentity(repositoryDirectory) !== expectedSourceCommit
) {
  throw new TypeError(
    "The API build source identity changed during the build.",
  );
}
const sourceDirectory = resolve(
  apiDirectory,
  "../../packages/personal-filing-corpus/validator",
);
const outputDirectory = resolve(apiDirectory, "dist/validator");
const validatorNames = [
  "personal_filing_fact_validator.py",
  "personal_filing_raw_fact_extractor.py",
];

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  validatorNames.map((name) =>
    copyFile(
      resolve(sourceDirectory, name),
      resolve(outputDirectory, `${name}.pending`),
    ),
  ),
);
if (
  resolveCleanBuildSourceIdentity(repositoryDirectory) !== expectedSourceCommit
) {
  throw new TypeError(
    "The API build source identity changed during the build.",
  );
}
await Promise.all(
  validatorNames.map((name) =>
    rename(
      resolve(outputDirectory, `${name}.pending`),
      resolve(outputDirectory, name),
    ),
  ),
);
