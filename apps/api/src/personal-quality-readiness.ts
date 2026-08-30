import { createHash, timingSafeEqual } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute } from "node:path";

const RESULT_PATH_KEY = "PERSONAL_FILING_QUALITY_RESULT_PATH" as const;
const RESULT_SHA256_KEY = "PERSONAL_FILING_QUALITY_RESULT_SHA256" as const;
const MAX_RESULT_BYTES = 1024 * 1024;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const ERROR_MESSAGE = "Personal filing quality readiness is unavailable.";
const QUALITY_SCHEMA_VERSION = "1.0.0" as const;
const QUALITY_CLAIM =
  "bounded_owner_reviewed_frozen_reference_personal_filing_quality_measurement_with_predeclared_zero_tolerance_thresholds_and_atomic_value_free_quarantine_for_personal_single_user_local_use" as const;
const QUALITY_ASSURANCE =
  "candidate_observations_committed_before_owner_reviewed_reference_content_reveal" as const;
const RUNNER_STATUS =
  "aggregate_only_resource_corrected_terminal_result" as const;
const RETRY_REASON = "missing_python_normalization_validator_resource" as const;
const SOURCE_COMMIT = "39ce73760afe0e5d22063b02a60efe64e83f3747" as const;
const COMMITMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-commitment:v1\u0000",
);
const EVALUATION_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-evaluation:v1\u0000",
);

declare const readinessCapabilityBrand: unique symbol;

export type PersonalQualityReadinessCapability = Readonly<{
  [readinessCapabilityBrand]: true;
}>;

export type PersonalQualityReadinessEnvironment = Readonly<
  Record<string, string | undefined>
>;

export interface ValidatedPersonalQualityBindings {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly evaluationSha256: `sha256:${string}`;
  readonly inputSetSha256: `sha256:${string}`;
  readonly ownerReviewedReferenceSha256: `sha256:${string}`;
  readonly qualityPlanSha256: `sha256:${string}`;
}

export interface ValidatedPersonalQualityAdmission {
  readonly bindings: ValidatedPersonalQualityBindings;
  readonly capability: PersonalQualityReadinessCapability;
}

const readinessCapabilities = new WeakSet<object>();

export class PersonalQualityReadinessError extends Error {
  public constructor() {
    super(ERROR_MESSAGE);
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "PersonalQualityReadinessError",
    });
  }
}

export async function loadPersonalQualityReadiness(
  environment: PersonalQualityReadinessEnvironment,
): Promise<PersonalQualityReadinessCapability | undefined> {
  const admission = await loadValidatedPersonalQualityAdmission(environment);
  return admission?.capability;
}

export async function loadValidatedPersonalQualityAdmission(
  environment: PersonalQualityReadinessEnvironment,
): Promise<ValidatedPersonalQualityAdmission | undefined> {
  const path = environment[RESULT_PATH_KEY];
  const expectedSha256 = environment[RESULT_SHA256_KEY];
  if (path === undefined && expectedSha256 === undefined) return undefined;

  let bytes: Uint8Array | undefined;
  try {
    if (
      typeof path !== "string" ||
      path.length === 0 ||
      path.length > 32_767 ||
      !isAbsolute(path) ||
      typeof expectedSha256 !== "string" ||
      !HASH.test(expectedSha256)
    ) {
      fail();
    }
    bytes = await readStableRegularFile(path);
    const actualSha256 = sha256(bytes);
    if (!equalAscii(actualSha256, expectedSha256)) fail();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    if (text !== `${canonicalJson(parsed)}\n`) fail();
    const bindings = validateWrapper(parsed);

    const capability = Object.freeze({}) as PersonalQualityReadinessCapability;
    readinessCapabilities.add(capability);
    return Object.freeze({ bindings, capability });
  } catch {
    throw new PersonalQualityReadinessError();
  } finally {
    bytes?.fill(0);
  }
}

export function isPersonalQualityReadinessCapability(
  value: unknown,
): value is PersonalQualityReadinessCapability {
  if (typeof value !== "object" || value === null) return false;
  try {
    return Object.isFrozen(value) && readinessCapabilities.has(value);
  } catch {
    return false;
  }
}

async function readStableRegularFile(path: string): Promise<Uint8Array> {
  const pathBefore = await lstat(path, { bigint: true });
  if (
    !pathBefore.isFile() ||
    pathBefore.isSymbolicLink() ||
    pathBefore.nlink !== 1n
  )
    fail();
  const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  let buffer: Buffer | undefined;
  try {
    const handleBefore = await handle.stat({ bigint: true });
    if (
      !handleBefore.isFile() ||
      !sameFileState(pathBefore, handleBefore) ||
      handleBefore.size <= 0n ||
      handleBefore.size > BigInt(MAX_RESULT_BYTES)
    ) {
      fail();
    }
    buffer = Buffer.alloc(Number(handleBefore.size));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (bytesRead === 0) fail();
      offset += bytesRead;
    }
    const handleAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(path, { bigint: true });
    if (
      !handleAfter.isFile() ||
      !pathAfter.isFile() ||
      pathAfter.isSymbolicLink() ||
      !sameFileState(handleBefore, handleAfter) ||
      !sameFileState(handleAfter, pathAfter)
    ) {
      fail();
    }
    const snapshot = Uint8Array.from(buffer);
    return snapshot;
  } finally {
    buffer?.fill(0);
    await handle.close();
  }
}

function sameFileState(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function validateWrapper(value: unknown): ValidatedPersonalQualityBindings {
  const wrapper = exactRecord(value, ["result", "runner", "schemaVersion"]);
  if (wrapper.schemaVersion !== QUALITY_SCHEMA_VERSION) fail();
  const runner = exactRecord(wrapper.runner, [
    "originalAggregateSha256",
    "priorCorrectiveResultSha256",
    "retryReason",
    "sourceCommit",
    "status",
  ]);
  if (
    typeof runner.originalAggregateSha256 !== "string" ||
    !HASH.test(runner.originalAggregateSha256) ||
    typeof runner.priorCorrectiveResultSha256 !== "string" ||
    !HASH.test(runner.priorCorrectiveResultSha256) ||
    runner.status !== RUNNER_STATUS ||
    runner.retryReason !== RETRY_REASON ||
    runner.sourceCommit !== SOURCE_COMMIT
  ) {
    fail();
  }
  return validateEvaluatedResult(wrapper.result);
}

function validateEvaluatedResult(
  value: unknown,
): ValidatedPersonalQualityBindings {
  const result = exactRecord(value, [
    "assurance",
    "audit",
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "claim",
    "counts",
    "evaluationSha256",
    "failedThresholds",
    "inputSetSha256",
    "metrics",
    "ownerReviewedReferenceSha256",
    "personalQualityThresholdOutcome",
    "qualityPlanSha256",
    "schemaVersion",
    "status",
    "synthetic",
  ]);
  if (
    result.assurance !== QUALITY_ASSURANCE ||
    result.claim !== QUALITY_CLAIM ||
    result.schemaVersion !== QUALITY_SCHEMA_VERSION ||
    result.status !== "quality_evaluated_for_personal_use" ||
    result.synthetic !== false ||
    result.personalQualityThresholdOutcome !== "met" ||
    !Array.isArray(result.failedThresholds) ||
    result.failedThresholds.length !== 0
  ) {
    fail();
  }
  for (const key of [
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "evaluationSha256",
    "inputSetSha256",
    "ownerReviewedReferenceSha256",
    "qualityPlanSha256",
  ] as const) {
    if (typeof result[key] !== "string" || !HASH.test(result[key])) fail();
  }

  const counts = validateCounts(result.counts);
  validateAudit(result.audit, counts);
  validateMetrics(result.metrics, counts);

  const expectedCommitment = domainHash(COMMITMENT_DOMAIN, {
    candidateObservationsSha256: result.candidateObservationsSha256,
    inputSetSha256: result.inputSetSha256,
    ownerReviewedReferenceSha256: result.ownerReviewedReferenceSha256,
    qualityPlanSha256: result.qualityPlanSha256,
  });
  const expectedEvaluation = domainHash(EVALUATION_DOMAIN, {
    candidateCommitmentSha256: result.candidateCommitmentSha256,
    counts,
    failedThresholds: result.failedThresholds,
    personalQualityThresholdOutcome: result.personalQualityThresholdOutcome,
  });
  if (
    result.candidateCommitmentSha256 !== expectedCommitment ||
    result.evaluationSha256 !== expectedEvaluation
  ) {
    fail();
  }
  return Object.freeze({
    candidateCommitmentSha256: result.candidateCommitmentSha256,
    candidateObservationsSha256: result.candidateObservationsSha256,
    evaluationSha256: result.evaluationSha256,
    inputSetSha256: result.inputSetSha256,
    ownerReviewedReferenceSha256: result.ownerReviewedReferenceSha256,
    qualityPlanSha256: result.qualityPlanSha256,
  }) as ValidatedPersonalQualityBindings;
}

type Counts = Readonly<Record<CountKey, number>>;
type CountKey = (typeof COUNT_KEYS)[number];
const COUNT_KEYS = [
  "conceptMismatchCount",
  "criticalAssertionCount",
  "documentCount",
  "emittedFactCount",
  "expectedFactCount",
  "falseNegativeFactCount",
  "falsePositiveFactCount",
  "missingFactCount",
  "periodMismatchCount",
  "quarantinedDocumentCount",
  "semanticAssertionPassCount",
  "silentCriticalFailureCount",
  "succeededDocumentCount",
  "truePositiveFactCount",
  "unitMismatchCount",
  "unitPeriodAssertionPassCount",
  "valueMismatchCount",
] as const;

function validateCounts(value: unknown): Counts {
  const record = exactRecord(value, COUNT_KEYS);
  for (const key of COUNT_KEYS) {
    if (!isNonnegativeSafeInteger(record[key])) fail();
  }
  const counts = record as Counts;
  const expectedFacts = counts.documentCount * 10;
  if (
    counts.documentCount < 1 ||
    counts.documentCount > 2 ||
    counts.expectedFactCount !== expectedFacts ||
    counts.succeededDocumentCount !== counts.documentCount ||
    counts.quarantinedDocumentCount !== 0 ||
    counts.emittedFactCount !== expectedFacts ||
    counts.truePositiveFactCount !== expectedFacts ||
    counts.falseNegativeFactCount !== 0 ||
    counts.falsePositiveFactCount !== 0 ||
    counts.missingFactCount !== 0 ||
    counts.conceptMismatchCount !== 0 ||
    counts.valueMismatchCount !== 0 ||
    counts.unitMismatchCount !== 0 ||
    counts.periodMismatchCount !== 0 ||
    counts.semanticAssertionPassCount !== expectedFacts ||
    counts.unitPeriodAssertionPassCount !== expectedFacts ||
    counts.criticalAssertionCount !== expectedFacts * 2 ||
    counts.silentCriticalFailureCount !== 0
  ) {
    fail();
  }
  return counts;
}

function validateAudit(value: unknown, counts: Counts): void {
  const audit = exactRecord(value, [
    "criticalAssertionCount",
    "documentCount",
    "emittedFactCount",
    "expectedFactCount",
    "outcome",
    "quarantinedDocumentCount",
    "succeededDocumentCount",
  ]);
  if (
    audit.outcome !== "evaluated" ||
    audit.criticalAssertionCount !== counts.criticalAssertionCount ||
    audit.documentCount !== counts.documentCount ||
    audit.emittedFactCount !== counts.emittedFactCount ||
    audit.expectedFactCount !== counts.expectedFactCount ||
    audit.quarantinedDocumentCount !== counts.quarantinedDocumentCount ||
    audit.succeededDocumentCount !== counts.succeededDocumentCount
  ) {
    fail();
  }
}

function validateMetrics(value: unknown, counts: Counts): void {
  const metrics = exactRecord(value, [
    "documentSuccess",
    "factPrecision",
    "factRecall",
    "quarantineRate",
    "silentCriticalFailure",
    "unitDateTolerance",
  ]);
  validateRatio(metrics.documentSuccess, {
    denominator: counts.documentCount,
    numerator: counts.succeededDocumentCount,
    thresholdDenominator: 1,
    thresholdKind: "minimum",
    thresholdNumerator: 1,
  });
  validateRatio(metrics.factPrecision, {
    denominator: counts.emittedFactCount,
    numerator: counts.truePositiveFactCount,
    thresholdDenominator: 1,
    thresholdKind: "minimum",
    thresholdNumerator: 1,
  });
  validateRatio(metrics.factRecall, {
    denominator: counts.expectedFactCount,
    numerator: counts.truePositiveFactCount,
    thresholdDenominator: 1,
    thresholdKind: "minimum",
    thresholdNumerator: 1,
  });
  validateRatio(metrics.quarantineRate, {
    denominator: counts.documentCount,
    numerator: counts.quarantinedDocumentCount,
    thresholdDenominator: 1,
    thresholdKind: "maximum",
    thresholdNumerator: 0,
  });
  const silent = exactRecord(metrics.silentCriticalFailure, [
    "count",
    "denominator",
    "maximumCount",
    "met",
  ]);
  if (
    silent.count !== 0 ||
    silent.denominator !== counts.criticalAssertionCount ||
    silent.maximumCount !== 0 ||
    silent.met !== true
  ) {
    fail();
  }
  const tolerance = exactRecord(metrics.unitDateTolerance, [
    "dateToleranceDays",
    "met",
    "periodMismatchCount",
    "unitMismatchCount",
    "unitTolerancePolicy",
  ]);
  if (
    tolerance.dateToleranceDays !== 0 ||
    tolerance.met !== true ||
    tolerance.periodMismatchCount !== 0 ||
    tolerance.unitMismatchCount !== 0 ||
    tolerance.unitTolerancePolicy !== "exact_canonical_unit.v1"
  ) {
    fail();
  }
}

interface ExpectedRatio {
  readonly denominator: number;
  readonly numerator: number;
  readonly thresholdDenominator: 1;
  readonly thresholdKind: "maximum" | "minimum";
  readonly thresholdNumerator: 0 | 1;
}

function validateRatio(value: unknown, expected: ExpectedRatio): void {
  const ratio = exactRecord(value, [
    "defined",
    "denominator",
    "met",
    "numerator",
    "threshold",
    "thresholdKind",
  ]);
  const threshold = exactRecord(ratio.threshold, ["denominator", "numerator"]);
  if (
    ratio.defined !== true ||
    ratio.met !== true ||
    ratio.denominator !== expected.denominator ||
    ratio.numerator !== expected.numerator ||
    ratio.thresholdKind !== expected.thresholdKind ||
    threshold.denominator !== expected.thresholdDenominator ||
    threshold.numerator !== expected.thresholdNumerator
  ) {
    fail();
  }
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...keys].sort())
  ) {
    fail();
  }
  return value as Record<Keys[number], unknown>;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function equalAscii(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "ascii");
  const rightBytes = Buffer.from(right, "ascii");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainHash(domain: Uint8Array, value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(new TextEncoder().encode(canonicalJson(value)))
    .digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function fail(): never {
  throw new PersonalQualityReadinessError();
}
