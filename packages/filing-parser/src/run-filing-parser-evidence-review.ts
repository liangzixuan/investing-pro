import {
  filingParserEvidenceReviewStdout,
  reviewFilingParserEvidence,
} from "./filing-parser-evidence-review";

try {
  const args = parseArguments(process.argv.slice(2));
  const review = await reviewFilingParserEvidence({
    evidencePath: required(args, "evidence"),
    expectedEvidenceSha256: required(
      args,
      "evidence-sha256",
    ) as `sha256:${string}`,
    expectedRepository: required(args, "repository"),
    expectedRevision: required(args, "revision"),
    expectedRunAttempt: positiveInteger(required(args, "run-attempt")),
    expectedRunId: required(args, "run-id"),
    repositoryPath: required(args, "repo"),
  });
  process.stdout.write(filingParserEvidenceReviewStdout(review));
} catch {
  process.stderr.write("Offline filing parser evidence review failed.\n");
  process.exitCode = 1;
}

function parseArguments(
  values: readonly string[],
): ReadonlyMap<string, string> {
  if (values.length % 2 !== 0) throw new Error();
  const output = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      !key.startsWith("--") ||
      output.has(key.slice(2))
    )
      throw new Error();
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
  ];
  if (
    output.size !== expected.length ||
    expected.some((key) => !output.has(key))
  )
    throw new Error();
  return output;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined || value.length === 0) throw new Error();
  return value;
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]{0,8}$/.test(value)) throw new Error();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error();
  return parsed;
}
