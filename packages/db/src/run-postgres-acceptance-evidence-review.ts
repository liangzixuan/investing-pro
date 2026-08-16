import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PostgresAcceptanceEvidenceReviewError,
  reviewPostgresAcceptanceEvidence,
  type PostgresAcceptanceEvidenceReviewInput,
} from "./postgres-acceptance-evidence-review";
import type { VerifiedPostgresAcceptanceEvidence } from "./postgres-acceptance-evidence-verifier";

const FLAG_TO_FIELD = Object.freeze({
  "--evidence": "evidencePath",
  "--repo": "repositoryPath",
  "--expected-evidence-sha256": "expectedEvidenceSha256",
  "--expected-repository": "expectedRepository",
  "--expected-repository-id": "expectedRepositoryId",
  "--expected-commit": "expectedCommit",
  "--expected-run-id": "expectedRunId",
  "--expected-run-attempt": "expectedRunAttempt",
} as const);

const REQUIRED_FLAGS = Object.keys(FLAG_TO_FIELD);
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;

export interface PostgresAcceptanceEvidenceReviewCliOutput {
  readonly stdout: { write(value: string): unknown };
  readonly stderr: { write(value: string): unknown };
}

/** Parses the closed CLI surface. Every trust anchor is explicit and required. */
export function parsePostgresAcceptanceEvidenceReviewArguments(
  arguments_: readonly string[],
): PostgresAcceptanceEvidenceReviewInput {
  try {
    if (
      Object.getPrototypeOf(arguments_) !== Array.prototype ||
      arguments_.length !== REQUIRED_FLAGS.length * 2
    ) {
      invalid();
    }
    const values = new Map<string, string>();
    for (let index = 0; index < arguments_.length; index += 2) {
      const flag = arguments_[index];
      const value = arguments_[index + 1];
      if (
        typeof flag !== "string" ||
        !Object.hasOwn(FLAG_TO_FIELD, flag) ||
        values.has(flag) ||
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 4_096 ||
        value.trim() !== value ||
        value.startsWith("--") ||
        containsControlCharacter(value)
      ) {
        invalid();
      }
      values.set(flag, value);
    }
    if (REQUIRED_FLAGS.some((flag) => !values.has(flag))) invalid();

    const evidencePath = requiredValue(values, "--evidence");
    const repositoryPath = requiredValue(values, "--repo");
    if (!isAbsolute(evidencePath) || !isAbsolute(repositoryPath)) invalid();

    const runAttemptText = requiredValue(values, "--expected-run-attempt");
    if (!POSITIVE_DECIMAL.test(runAttemptText)) invalid();
    const expectedRunAttempt = Number(runAttemptText);
    if (!Number.isSafeInteger(expectedRunAttempt)) invalid();

    return Object.freeze({
      evidencePath,
      repositoryPath,
      expectedEvidenceSha256: requiredValue(
        values,
        "--expected-evidence-sha256",
      ),
      expectedRepository: requiredValue(values, "--expected-repository"),
      expectedRepositoryId: requiredValue(values, "--expected-repository-id"),
      expectedCommit: requiredValue(values, "--expected-commit"),
      expectedRunId: requiredValue(values, "--expected-run-id"),
      expectedRunAttempt,
    });
  } catch {
    throw new PostgresAcceptanceEvidenceReviewError();
  }
}

/** Runs the CLI without terminating the process, making stdout/exit behavior testable. */
export async function runPostgresAcceptanceEvidenceReviewCli(
  arguments_: readonly string[],
  output: PostgresAcceptanceEvidenceReviewCliOutput = process,
): Promise<number> {
  try {
    const input = parsePostgresAcceptanceEvidenceReviewArguments(arguments_);
    const result = await reviewPostgresAcceptanceEvidence(input);
    output.stdout.write(serializeSafeResult(result));
    return 0;
  } catch {
    output.stderr.write("PostgreSQL acceptance evidence review failed.\n");
    return 1;
  }
}

function serializeSafeResult(
  value: VerifiedPostgresAcceptanceEvidence,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function requiredValue(
  values: ReadonlyMap<string, string>,
  flag: string,
): string {
  const value = values.get(flag);
  if (value === undefined) invalid();
  return value;
}

function invalid(): never {
  throw new Error("invalid");
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f)) {
      return true;
    }
  }
  return false;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (isDirectExecution()) {
  process.exitCode = await runPostgresAcceptanceEvidenceReviewCli(
    process.argv.slice(2),
  );
}
