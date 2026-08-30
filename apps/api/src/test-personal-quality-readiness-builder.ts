import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadPersonalQualityReadiness,
  type PersonalQualityReadinessCapability,
  type PersonalQualityReadinessEnvironment,
} from "./personal-quality-readiness";

const COMMITMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-commitment:v1\u0000",
);
const EVALUATION_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-quality-evaluation:v1\u0000",
);
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
const HASH_D = `sha256:${"d".repeat(64)}`;

export interface PublicPersonalQualityReadinessFixture {
  readonly capability: PersonalQualityReadinessCapability;
  readonly directory: string;
  readonly environment: PersonalQualityReadinessEnvironment;
  readonly path: string;
}

export function createValidPersonalQualityReadinessWrapper(
  documentCount = 1,
  bindings: Readonly<{
    candidateObservationsSha256: string;
    inputSetSha256: string;
    ownerReviewedReferenceSha256: string;
    qualityPlanSha256: string;
  }> = {
    candidateObservationsSha256: HASH_A,
    inputSetSha256: HASH_B,
    ownerReviewedReferenceSha256: HASH_C,
    qualityPlanSha256: HASH_D,
  },
): Record<string, unknown> {
  const expectedFactCount = documentCount * 10;
  const counts = {
    conceptMismatchCount: 0,
    criticalAssertionCount: expectedFactCount * 2,
    documentCount,
    emittedFactCount: expectedFactCount,
    expectedFactCount,
    falseNegativeFactCount: 0,
    falsePositiveFactCount: 0,
    missingFactCount: 0,
    periodMismatchCount: 0,
    quarantinedDocumentCount: 0,
    semanticAssertionPassCount: expectedFactCount,
    silentCriticalFailureCount: 0,
    succeededDocumentCount: documentCount,
    truePositiveFactCount: expectedFactCount,
    unitMismatchCount: 0,
    unitPeriodAssertionPassCount: expectedFactCount,
    valueMismatchCount: 0,
  };
  const candidateCommitmentSha256 = domainHash(COMMITMENT_DOMAIN, {
    candidateObservationsSha256: bindings.candidateObservationsSha256,
    inputSetSha256: bindings.inputSetSha256,
    ownerReviewedReferenceSha256: bindings.ownerReviewedReferenceSha256,
    qualityPlanSha256: bindings.qualityPlanSha256,
  });
  const failedThresholds: never[] = [];
  const personalQualityThresholdOutcome = "met";
  const evaluationSha256 = domainHash(EVALUATION_DOMAIN, {
    candidateCommitmentSha256,
    counts,
    failedThresholds,
    personalQualityThresholdOutcome,
  });
  const ratio = (
    numerator: number,
    denominator: number,
    thresholdNumerator: 0 | 1,
    thresholdKind: "maximum" | "minimum",
  ) => ({
    defined: true,
    denominator,
    met: true,
    numerator,
    threshold: { denominator: 1, numerator: thresholdNumerator },
    thresholdKind,
  });
  return {
    result: {
      assurance:
        "candidate_observations_committed_before_owner_reviewed_reference_content_reveal",
      audit: {
        criticalAssertionCount: counts.criticalAssertionCount,
        documentCount,
        emittedFactCount: expectedFactCount,
        expectedFactCount,
        outcome: "evaluated",
        quarantinedDocumentCount: 0,
        succeededDocumentCount: documentCount,
      },
      candidateCommitmentSha256,
      candidateObservationsSha256: bindings.candidateObservationsSha256,
      claim:
        "bounded_owner_reviewed_frozen_reference_personal_filing_quality_measurement_with_predeclared_zero_tolerance_thresholds_and_atomic_value_free_quarantine_for_personal_single_user_local_use",
      counts,
      evaluationSha256,
      failedThresholds,
      inputSetSha256: bindings.inputSetSha256,
      metrics: {
        documentSuccess: ratio(documentCount, documentCount, 1, "minimum"),
        factPrecision: ratio(
          expectedFactCount,
          expectedFactCount,
          1,
          "minimum",
        ),
        factRecall: ratio(expectedFactCount, expectedFactCount, 1, "minimum"),
        quarantineRate: ratio(0, documentCount, 0, "maximum"),
        silentCriticalFailure: {
          count: 0,
          denominator: counts.criticalAssertionCount,
          maximumCount: 0,
          met: true,
        },
        unitDateTolerance: {
          dateToleranceDays: 0,
          met: true,
          periodMismatchCount: 0,
          unitMismatchCount: 0,
          unitTolerancePolicy: "exact_canonical_unit.v1",
        },
      },
      ownerReviewedReferenceSha256: bindings.ownerReviewedReferenceSha256,
      personalQualityThresholdOutcome,
      qualityPlanSha256: bindings.qualityPlanSha256,
      schemaVersion: "1.0.0",
      status: "quality_evaluated_for_personal_use",
      synthetic: false,
    },
    runner: {
      originalAggregateSha256: HASH_A,
      priorCorrectiveResultSha256: HASH_B,
      retryReason: "missing_python_normalization_validator_resource",
      sourceCommit: "39ce73760afe0e5d22063b02a60efe64e83f3747",
      status: "aggregate_only_resource_corrected_terminal_result",
    },
    schemaVersion: "1.0.0",
  };
}

export function encodePersonalQualityReadinessWrapper(
  wrapper: unknown,
): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(wrapper)}\n`);
}

export function personalQualityReadinessEnvironment(
  path: string,
  bytes: Uint8Array,
): PersonalQualityReadinessEnvironment {
  return {
    PERSONAL_FILING_QUALITY_RESULT_PATH: path,
    PERSONAL_FILING_QUALITY_RESULT_SHA256: sha256(bytes),
  };
}

export async function createPublicPersonalQualityReadinessFixture(): Promise<PublicPersonalQualityReadinessFixture> {
  const directory = await mkdtemp(
    join(tmpdir(), "personal-quality-readiness-"),
  );
  const path = join(directory, "quality-result.json");
  const bytes = encodePersonalQualityReadinessWrapper(
    createValidPersonalQualityReadinessWrapper(),
  );
  await writeFile(path, bytes);
  const environment = personalQualityReadinessEnvironment(path, bytes);
  const capability = await loadPersonalQualityReadiness(environment);
  if (capability === undefined)
    throw new Error("Expected the public readiness fixture to be enabled.");
  return { capability, directory, environment, path };
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
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
