import {
  filingParserNormalizationExecutionEvidenceReviewOptionsFromArguments,
  filingParserNormalizationExecutionEvidenceReviewStdout,
  reviewFilingParserNormalizationExecutionEvidence,
} from "./filing-parser-normalization-execution-evidence-review";

try {
  const review = await reviewFilingParserNormalizationExecutionEvidence(
    filingParserNormalizationExecutionEvidenceReviewOptionsFromArguments(
      process.argv.slice(2),
    ),
  );
  process.stdout.write(
    filingParserNormalizationExecutionEvidenceReviewStdout(review),
  );
} catch {
  process.stderr.write(
    "Offline filing parser normalization execution evidence review failed.\n",
  );
  process.exitCode = 1;
}
