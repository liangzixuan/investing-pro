import {
  normalizePersonalFilingFacts,
  type PersonalFilingFactSubtractionDerivation,
  type PersonalNormalizedFilingFactVersion,
} from "./personal-filing-fact-normalization";
import type { PersonalFilingQualityMeasurementCommitInput } from "./personal-filing-quality-measurement";
import {
  buildPersonalFilingRawFactExtractionFixture,
  type PersonalFilingRawFactExtractionFixture,
} from "./test-personal-filing-raw-fact-extraction-builder";
import {
  canonicalPersonalFilingFactDocument,
  decodePersonalFilingFactDocument,
  sha256,
  type JsonRecord,
} from "./test-personal-filing-fact-builder";

export interface PersonalFilingQualityMeasurementFixture {
  readonly candidateObservations: Uint8Array;
  readonly commitInput: PersonalFilingQualityMeasurementCommitInput;
  readonly ownerReviewedReference: Uint8Array;
  readonly rawFixture: PersonalFilingRawFactExtractionFixture;
}

export function buildPersonalFilingQualityMeasurementFixture(
  withAmendment = false,
): PersonalFilingQualityMeasurementFixture {
  const rawFixture = buildPersonalFilingRawFactExtractionFixture(withAmendment);
  const normalized = normalizePersonalFilingFacts({
    declaration: rawFixture.input.declaration,
    manifest: rawFixture.input.manifest,
    normalizationPlan: rawFixture.input.normalizationPlan,
    sourceDocuments: rawFixture.input.sourceDocuments,
  });
  if (normalized.status !== "normalized_for_personal_use")
    throw new TypeError("Generated quality fixture did not normalize.");
  const rawDocumentSha256s = rawFixture.input.rawFilingDocuments.map(sha256);
  const documents = rawDocumentSha256s.map(
    (rawDocumentSha256, documentIndex) => {
      const start = documentIndex * 10;
      const versions = normalized.factVersions.slice(start, start + 10);
      if (versions.length !== 10)
        throw new TypeError("Generated quality fixture is incomplete.");
      return {
        documentIndex,
        facts: versions.map(projectFact),
        rawDocumentSha256,
        status: "succeeded",
      };
    },
  );
  const ownerReviewedReference = canonicalPersonalFilingFactDocument({
    documentCount: documents.length,
    documentRole: "owner_reviewed_reference",
    documents,
    factCount: documents.length * 10,
    profile: "personal_single_user_local",
    referenceDeclaration:
      "owner_reviewed_reference_not_independently_adjudicated",
    schemaVersion: "1.0.0",
    synthetic: false,
  });
  const qualityPlan = qualityPlanBytes(rawFixture, ownerReviewedReference);
  const candidateObservations = canonicalPersonalFilingFactDocument({
    documents,
    schemaVersion: "1.0.0",
    status: "candidate_observations_for_testing_only",
  });
  return Object.freeze({
    candidateObservations,
    commitInput: Object.freeze({
      ...rawFixture.input,
      qualityPlan,
    }),
    ownerReviewedReference,
    rawFixture,
  });
}

export function rebindPersonalFilingQualityReference(
  fixture: PersonalFilingQualityMeasurementFixture,
  referenceValue: JsonRecord,
): PersonalFilingQualityMeasurementFixture {
  const ownerReviewedReference =
    canonicalPersonalFilingFactDocument(referenceValue);
  return Object.freeze({
    ...fixture,
    commitInput: Object.freeze({
      ...fixture.commitInput,
      qualityPlan: qualityPlanBytes(fixture.rawFixture, ownerReviewedReference),
    }),
    ownerReviewedReference,
  });
}

export function decodePersonalFilingQualityDocument(
  bytes: Uint8Array,
): JsonRecord {
  return decodePersonalFilingFactDocument(bytes);
}

export function canonicalPersonalFilingQualityDocument(
  value: unknown,
): Uint8Array {
  return canonicalPersonalFilingFactDocument(value);
}

function qualityPlanBytes(
  rawFixture: PersonalFilingRawFactExtractionFixture,
  ownerReviewedReference: Uint8Array,
): Uint8Array {
  const rawDocumentSha256s = rawFixture.input.rawFilingDocuments.map(sha256);
  return canonicalPersonalFilingFactDocument({
    assertionKinds: ["semantic_value_presence", "exact_unit_period"],
    documentCount: rawDocumentSha256s.length,
    documentRole: "personal_quality_plan",
    factCount: rawDocumentSha256s.length * 10,
    factKeys: [
      "assets",
      "cash",
      "debt",
      "diluted_shares",
      "free_cash_flow",
      "gross_profit",
      "net_income",
      "operating_cash_flow",
      "operating_income",
      "revenue",
    ],
    manifestSha256: sha256(rawFixture.input.manifest),
    metrics: [
      "document_success",
      "fact_precision",
      "fact_recall",
      "unit_date_tolerance",
      "silent_critical_failure",
      "quarantine_rate",
    ],
    normalizationPlanSha256: sha256(rawFixture.input.normalizationPlan),
    ownerReviewedReferenceSha256: sha256(ownerReviewedReference),
    profile: "personal_single_user_local",
    rawDocumentSha256s,
    schemaVersion: "1.0.0",
    selectionRule:
      "exact_manifest_order_all_source_documents_and_ten_fixed_launch_fact_keys.v1",
    synthetic: false,
    thresholds: {
      dateToleranceDays: 0,
      documentSuccessMinimum: "1.0",
      factPrecisionMinimum: "1.0",
      factRecallMinimum: "1.0",
      maximumQuarantineRate: "0.0",
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  });
}

function projectFact(version: PersonalNormalizedFilingFactVersion): JsonRecord {
  return {
    derivation: projectDerivation(version.derivation),
    dimensions: {},
    factKey: version.key,
    periodEnd: version.periodEnd,
    periodStart: version.periodStart,
    sourceConcept: version.sourceConcept,
    unit: version.unit,
    value: version.value,
  };
}

function projectDerivation(
  derivation: PersonalFilingFactSubtractionDerivation | null,
): JsonRecord | null {
  if (derivation === null) return null;
  return {
    formula: derivation.formula,
    minuend: projectOperand(derivation.minuend),
    subtrahend: projectOperand(derivation.subtrahend),
  };
}

function projectOperand(
  operand: PersonalFilingFactSubtractionDerivation["minuend"],
): JsonRecord {
  return {
    concept: operand.concept,
    periodEnd: operand.periodEnd,
    periodStart: operand.periodStart,
    unit: operand.unit,
    value: operand.value,
  };
}
