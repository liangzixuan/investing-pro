import {
  verifyFilingParserEvidenceOffline,
  type FilingParserEvidenceReview,
  type FilingParserEvidenceReviewOptions,
} from "./filing-parser-evidence-verifier";

export async function reviewFilingParserEvidence(
  options: FilingParserEvidenceReviewOptions,
): Promise<FilingParserEvidenceReview> {
  return verifyFilingParserEvidenceOffline(options);
}

export function filingParserEvidenceReviewOptionsFromArguments(
  values: readonly string[],
): FilingParserEvidenceReviewOptions {
  const normalizedValues = values[0] === "--" ? values.slice(1) : values;
  if (normalizedValues.length % 2 !== 0) return invalidArguments();
  const output = new Map<string, string>();
  for (let index = 0; index < normalizedValues.length; index += 2) {
    const key = normalizedValues[index];
    const value = normalizedValues[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      !key.startsWith("--") ||
      key === "--" ||
      output.has(key.slice(2))
    )
      return invalidArguments();
    output.set(key.slice(2), value);
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
    output.size !== expected.length ||
    expected.some((key) => !output.has(key))
  )
    return invalidArguments();
  return Object.freeze({
    evidencePath: required(output, "evidence"),
    expectedEvidenceSha256: required(
      output,
      "evidence-sha256",
    ) as `sha256:${string}`,
    expectedRepository: required(output, "repository"),
    expectedRevision: required(output, "revision"),
    expectedRunAttempt: positiveInteger(required(output, "run-attempt")),
    expectedRunId: required(output, "run-id"),
    repositoryPath: required(output, "repo"),
  });
}

export function filingParserEvidenceReviewStdout(
  review: FilingParserEvidenceReview,
): string {
  if (review.verdict !== "offline_consistent") {
    throw new Error("Offline evidence review failed.");
  }
  return `${JSON.stringify({
    evidenceSha256: review.evidenceSha256,
    repository: review.repository,
    revision: review.revision,
    runAttempt: review.runAttempt,
    runId: review.runId,
    sourceHashCount: review.sourceHashCount,
    verdict: review.verdict,
  })}\n`;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined || value.length === 0) return invalidArguments();
  return value;
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]{0,8}$/.test(value)) return invalidArguments();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return invalidArguments();
  return parsed;
}

function invalidArguments(): never {
  throw new Error("Offline evidence review failed.");
}
