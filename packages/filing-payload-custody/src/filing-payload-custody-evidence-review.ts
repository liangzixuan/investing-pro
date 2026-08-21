import {
  verifyFilingPayloadCustodyEvidenceOffline,
  type FilingPayloadCustodyEvidenceReview,
  type FilingPayloadCustodyEvidenceReviewOptions,
} from "./filing-payload-custody-evidence-verifier";

export async function reviewFilingPayloadCustodyEvidence(
  options: FilingPayloadCustodyEvidenceReviewOptions,
): Promise<FilingPayloadCustodyEvidenceReview> {
  return verifyFilingPayloadCustodyEvidenceOffline(options);
}

export function filingPayloadCustodyEvidenceReviewOptionsFromArguments(
  values: readonly string[],
): FilingPayloadCustodyEvidenceReviewOptions {
  const normalized = values[0] === "--" ? values.slice(1) : values;
  if (normalized.length % 2 !== 0) invalid();
  const parsed = new Map<string, string>();
  for (let index = 0; index < normalized.length; index += 2) {
    const key = normalized[index];
    const value = normalized[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      !key.startsWith("--") ||
      key === "--" ||
      parsed.has(key.slice(2))
    )
      invalid();
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
    invalid();
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

export function filingPayloadCustodyEvidenceReviewStdout(
  review: FilingPayloadCustodyEvidenceReview,
): string {
  if (review.verdict !== "offline_consistent") invalid();
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
  return value === undefined || value.length === 0 ? invalid() : value;
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]{0,8}$/u.test(value)) invalid();
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : invalid();
}

function invalid(): never {
  throw new Error("Offline filing payload custody evidence review failed.");
}
