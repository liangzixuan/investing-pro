import {
  filingPayloadCustodyEvidenceReviewOptionsFromArguments,
  filingPayloadCustodyEvidenceReviewStdout,
  reviewFilingPayloadCustodyEvidence,
} from "./filing-payload-custody-evidence-review";

try {
  const review = await reviewFilingPayloadCustodyEvidence(
    filingPayloadCustodyEvidenceReviewOptionsFromArguments(
      process.argv.slice(2),
    ),
  );
  process.stdout.write(filingPayloadCustodyEvidenceReviewStdout(review));
} catch {
  process.stderr.write(
    "Offline filing payload custody evidence review failed.\n",
  );
  process.exitCode = 1;
}
