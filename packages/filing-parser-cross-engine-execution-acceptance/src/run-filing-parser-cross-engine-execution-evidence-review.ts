import {
  filingParserCrossEngineExecutionEvidenceReviewOptionsFromArguments,
  filingParserCrossEngineExecutionEvidenceReviewStdout,
  reviewFilingParserCrossEngineExecutionEvidence,
} from "./filing-parser-cross-engine-execution-evidence-review";

try {
  const review = await reviewFilingParserCrossEngineExecutionEvidence(
    filingParserCrossEngineExecutionEvidenceReviewOptionsFromArguments(
      process.argv.slice(2),
    ),
  );
  process.stdout.write(
    filingParserCrossEngineExecutionEvidenceReviewStdout(review),
  );
} catch {
  process.stderr.write(
    "Offline filing parser cross-engine execution evidence review failed.\n",
  );
  process.exitCode = 1;
}
