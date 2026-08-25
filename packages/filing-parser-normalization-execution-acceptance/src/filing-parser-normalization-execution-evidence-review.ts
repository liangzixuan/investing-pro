import {
  verifyFilingParserNormalizationExecutionEvidenceOffline,
  type FilingParserNormalizationExecutionEvidenceReview,
  type FilingParserNormalizationExecutionEvidenceReviewOptions,
} from "./filing-parser-normalization-execution-evidence-verifier";

export async function reviewFilingParserNormalizationExecutionEvidence(
  options: FilingParserNormalizationExecutionEvidenceReviewOptions,
): Promise<FilingParserNormalizationExecutionEvidenceReview> {
  return verifyFilingParserNormalizationExecutionEvidenceOffline(options);
}

export function filingParserNormalizationExecutionEvidenceReviewOptionsFromArguments(
  values: readonly string[],
): FilingParserNormalizationExecutionEvidenceReviewOptions {
  const args = values[0] === "--" ? values.slice(1) : values;
  if (args.length % 2 !== 0) return invalid();
  const parsed = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      !key.startsWith("--") ||
      key === "--" ||
      parsed.has(key.slice(2))
    )
      return invalid();
    parsed.set(key.slice(2), value);
  }
  const expected = [
    "evidence",
    "evidence-sha256",
    "repo",
    "repository",
    "revision",
    "run-attempt",
    "run-id",
  ] as const;
  if (
    parsed.size !== expected.length ||
    expected.some((key) => !parsed.has(key))
  )
    return invalid();
  return Object.freeze({
    evidencePath: required(parsed, "evidence"),
    expectedEvidenceSha256: required(
      parsed,
      "evidence-sha256",
    ) as `sha256:${string}`,
    expectedRepository: required(parsed, "repository"),
    expectedRevision: required(parsed, "revision"),
    expectedRunAttempt: positiveInteger(required(parsed, "run-attempt")),
    expectedRunId: required(parsed, "run-id"),
    repositoryPath: required(parsed, "repo"),
  });
}

export function filingParserNormalizationExecutionEvidenceReviewStdout(
  review: FilingParserNormalizationExecutionEvidenceReview,
): string {
  if (review.verdict !== "offline_consistent") return invalid();
  return `${JSON.stringify(review)}\n`;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined || value.length === 0) return invalid();
  return value;
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]{0,8}$/u.test(value)) return invalid();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return invalid();
  return parsed;
}

function invalid(): never {
  throw new Error(
    "Offline filing parser normalization execution evidence review failed.",
  );
}
