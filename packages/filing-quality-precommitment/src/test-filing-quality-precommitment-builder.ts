import { createHash } from "node:crypto";

import {
  FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_METRICS,
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
} from "@research-cockpit/filing-quality-measurement";

import { FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION } from "./filing-quality-precommitment";

export interface SyntheticFilingQualityPrecommitmentDocuments {
  readonly candidateObservations: Uint8Array;
  readonly declaredReference: Uint8Array;
  readonly plan: Uint8Array;
}

const PLAN_FROZEN_AT = "2026-01-01T00:00:00.000Z";
const REFERENCE_DECLARED_AT = "2026-01-02T00:00:00.000Z";
const POPULATION_ID = "synthetic-filing-quality-reference.v1";
const DOCUMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-quality-document:v1\u0000",
);
const CONCEPTS = Object.freeze({
  assets: "rc-synthetic:Assets",
  cash: "rc-synthetic:CashAndCashEquivalents",
  debt: "rc-synthetic:Debt",
  diluted_shares: "rc-synthetic:WeightedAverageDilutedShares",
  free_cash_flow: "rc-synthetic:FreeCashFlow",
  gross_profit: "rc-synthetic:GrossProfit",
  net_income: "rc-synthetic:NetIncome",
  operating_cash_flow: "rc-synthetic:OperatingCashFlow",
  operating_income: "rc-synthetic:OperatingIncome",
  revenue: "rc-synthetic:Revenue",
});

export function buildSyntheticFilingQualityPrecommitmentDocuments(): SyntheticFilingQualityPrecommitmentDocuments {
  const plan = buildPlan();
  const planBytes = canonicalSyntheticFilingQualityPrecommitmentDocument(plan);
  const planSha256 = sha256(planBytes);
  const referenceDocuments = Array.from({ length: 100 }, (_, index) =>
    buildReferenceDocument(index + 1),
  );
  const declaredReference = {
    criticalAssertionCount: 2_000,
    declaredAdjudicators:
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.declaredAdjudicators,
    declaredAt: REFERENCE_DECLARED_AT,
    declaration: "declared_synthetic_reference_not_independently_adjudicated",
    documentCount: 100,
    documentRole: "declared_reference",
    documents: referenceDocuments,
    factCount: 1_000,
    populationId: POPULATION_ID,
    populationVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    planSha256,
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    synthetic: true,
  };
  const declaredReferenceBytes =
    canonicalSyntheticFilingQualityPrecommitmentDocument(declaredReference);
  const declaredReferenceSha256 = sha256(declaredReferenceBytes);
  const candidateObservations = {
    candidateDeclaration: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
    declaredReferenceSha256,
    documentObservations: Array.from({ length: 100 }, (_, index) =>
      buildCandidateObservation(index + 1),
    ),
    documentRole: "candidate_observations_precommit",
    planSha256,
    populationId: POPULATION_ID,
    populationVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    schemaVersion: FILING_QUALITY_PRECOMMITMENT_SCHEMA_VERSION,
    synthetic: true,
  };
  return Object.freeze({
    candidateObservations: canonicalSyntheticFilingQualityPrecommitmentDocument(
      candidateObservations,
    ),
    declaredReference: declaredReferenceBytes,
    plan: planBytes,
  });
}

export function decodeSyntheticFilingQualityPrecommitmentDocument(
  bytes: Uint8Array,
): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function canonicalSyntheticFilingQualityPrecommitmentDocument(
  value: unknown,
): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function buildPlan(): Record<string, unknown> {
  return {
    assertionKinds: FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
    assertionTarget: 2_000,
    candidateStatuses: ["quarantined", "succeeded"],
    declaredAdjudicators:
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.declaredAdjudicators,
    declaredCandidate: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
    documentRole: "synthetic_pilot_plan",
    documentTarget: 100,
    factKeys: FILING_QUALITY_MEASUREMENT_FACT_KEYS,
    factTarget: 1_000,
    frozenAt: PLAN_FROZEN_AT,
    metrics: FILING_QUALITY_MEASUREMENT_METRICS,
    planId: "synthetic-filing-quality-plan.v1",
    planVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    referenceDeclaration:
      "declared_synthetic_reference_not_independently_adjudicated",
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    synthetic: true,
    thresholds: {
      dateToleranceDays: 0,
      documentSuccessMinimum: "0.95",
      factPrecisionMinimum: "0.99",
      factRecallMinimum: "0.99",
      maximumQuarantineRate: "0.05",
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  };
}

function buildReferenceDocument(ordinal: number): Record<string, unknown> {
  const documentId = documentIdFor(ordinal);
  return {
    documentId,
    documentSha256: documentSha256(documentId),
    facts: buildFacts(ordinal),
  };
}

function buildCandidateObservation(ordinal: number): Record<string, unknown> {
  const documentId = documentIdFor(ordinal);
  if (ordinal === 100) {
    return {
      documentId,
      documentSha256: documentSha256(documentId),
      facts: [],
      quarantineCode: "validator_quarantine",
      status: "quarantined",
    };
  }
  return {
    documentId,
    documentSha256: documentSha256(documentId),
    facts: buildFacts(ordinal),
    status: "succeeded",
  };
}

function buildFacts(ordinal: number): readonly Record<string, unknown>[] {
  return FILING_QUALITY_MEASUREMENT_FACT_KEYS.map((factKey, index) => ({
    concept: CONCEPTS[factKey],
    dimensions: [],
    factKey,
    periodEnd: "2025-12-31",
    periodStart:
      factKey === "assets" || factKey === "cash" || factKey === "debt"
        ? null
        : "2025-01-01",
    unit: factKey === "diluted_shares" ? "shares" : "USD",
    value: String(1_000_000 + ordinal * 100 + index),
  }));
}

function documentIdFor(ordinal: number): string {
  return `synthetic-filing-${String(ordinal).padStart(4, "0")}`;
}

function documentSha256(documentId: string): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(DOCUMENT_DOMAIN)
    .update(new TextEncoder().encode(documentId))
    .digest("hex")}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError("Synthetic quality precommitment fixture is invalid.");
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}
