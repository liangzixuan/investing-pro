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
