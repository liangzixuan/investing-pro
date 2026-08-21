import {
  filingParserEvidenceReviewOptionsFromArguments,
  filingParserEvidenceReviewStdout,
  reviewFilingParserEvidence,
} from "./filing-parser-evidence-review";

try {
  const review = await reviewFilingParserEvidence(
    filingParserEvidenceReviewOptionsFromArguments(process.argv.slice(2)),
  );
  process.stdout.write(filingParserEvidenceReviewStdout(review));
} catch {
  process.stderr.write("Offline filing parser evidence review failed.\n");
  process.exitCode = 1;
}
