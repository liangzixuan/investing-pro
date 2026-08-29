import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import { PERSONAL_FILING_CORPUS_LIMITS } from "./personal-filing-corpus";
import {
  comparePersonalFilingFactValidation,
  type PersonalFilingFactComparisonInput,
} from "./personal-filing-fact-comparison";
import {
  PERSONAL_FILING_FACT_KEYS,
  PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
  normalizePersonalFilingFacts,
  type PersonalFilingFactNormalizationRecord,
  type PersonalNormalizedFilingFactVersion,
} from "./personal-filing-fact-normalization";

export const PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION =
  "1.0.0" as const;
export const PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM =
  "bounded_repository_pinned_python_raw_ixbrl_ten_fact_projection_agreement_with_frozen_primary_parser_result_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use" as const;
export const PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE =
  "secondary_raw_extractor_receives_no_primary_parser_result_normalized_record_or_digest" as const;

export const PERSONAL_FILING_RAW_FACT_EXTRACTION_CHECKS = Object.freeze([
  "owned_bounded_disjoint_primary_parser_result_and_raw_filing_snapshots",
  "cycle2v_exact_complete_normalization_record_agreement_required_first",
  "raw_byte_count_length_and_sha256_equality_with_exact_manifest_order",
  "repository_pinned_zero_dependency_python_structural_html_ixbrl_extractor",
  "extractor_stdin_contains_only_raw_filing_documents_and_target_qnames",
  "no_primary_parser_result_normalized_record_or_digest_crosses_extractor_boundary",
  "independent_context_period_dimension_classification_and_selected_dimensionless_unit_transform_sign_and_scale_reconstruction",
  "exact_value_agreement_for_ten_primary_selected_dimensionless_raw_coordinates_per_document_including_fcf_operands",
  "equivalent_duplicate_collapse_and_conflicting_duplicate_quarantine",
  "exact_canonical_decimal_value_agreement_without_tolerance_or_binary_float",
  "metadata_only_immutable_agreement_receipt_or_atomic_value_free_quarantine",
  "no_preference_diff_fallback_merge_coercion_repair_or_partial_success",
  "no_network_database_api_web_queue_temp_file_or_application_composition",
] as const);

export const PERSONAL_FILING_RAW_FACT_EXTRACTION_NOT_PROVEN = Object.freeze([
  "correctness_of_the_shared_normalization_plan_qname_mapping_or_fact_selection_specification",
  "completeness_or_correctness_of_primary_selection_among_additional_raw_coordinates",
  "unit_transform_or_value_semantics_of_excluded_dimensional_target_facts",
  "primary_parser_implementation_identity_source_binding_or_code_lineage_independence",
  "general_xbrl_ixbrl_html_taxonomy_transform_dimension_or_unit_coverage",
  "sec_authenticity_source_authority_or_complete_filing_provenance",
  "accounting_fact_free_cash_flow_or_taxonomy_truth",
  "amendment_discovery_global_currentness_or_absence_of_external_corrections",
  "operator_host_key_repository_process_failure_domain_or_runtime_independence",
  "absence_of_common_specification_error_coordinated_defects_collusion_or_malicious_code",
  "python_executable_identity_process_isolation_preflight_to_launch_atomicity_or_runtime_attestation",
  "independently_adjudicated_ground_truth_precision_recall_or_quality_thresholds",
  "multi_user_shared_service_database_api_web_queue_or_production_readiness",
] as const);

export const PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS = Object.freeze({
  extractorOutputBytes: 4_194_304,
  extractorOutputDepth: 7,
  extractorOutputFactsPerDocument: 4_096,
  extractorOutputNodes: 65_536,
  extractorOutputStringCodePoints: 4_194_304,
  rawFilingDocumentBytes: 33_554_432,
  rawFilingDocuments: 2,
  targetConcepts: 10,
});

export const PERSONAL_FILING_RAW_FACT_EXTRACTION_QUARANTINE_CODES =
  Object.freeze([
    "input_invalid",
    "primary_agreement_missing",
    "raw_payload_scope_mismatch",
    "extractor_execution_failure",
    "extractor_output_invalid",
    "extraction_conflict",
    "comparison_failure",
  ] as const);

export type PersonalFilingRawFactExtractionQuarantineCode =
  (typeof PERSONAL_FILING_RAW_FACT_EXTRACTION_QUARANTINE_CODES)[number];

export interface PersonalFilingRawFactExtractionInput extends PersonalFilingFactComparisonInput {
  readonly rawFilingDocuments: readonly Uint8Array[];
}

export interface PersonalFilingRawFactExtractionAudit {
  readonly comparedCoordinateCount: number;
  readonly extractorCount: number;
  readonly outcome: "agreed" | "quarantined";
  readonly sourceDocumentCount: number;
}

export interface PersonalFilingRawFactExtractorBinding {
  readonly extractorId: "personal-filing-raw-fact-extractor-python-v1";
  readonly extractorVersion: "1.0.0";
  readonly implementationSha256: `sha256:${string}`;
  readonly runtimeFamily: "python-stdlib-html-parser";
}

export interface PersonalFilingRawFactExtractionAgreementReceipt {
  readonly agreementSha256: `sha256:${string}`;
  readonly assurance: typeof PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE;
  readonly audit: PersonalFilingRawFactExtractionAudit;
  readonly claim: typeof PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM;
  readonly extractorBinding: PersonalFilingRawFactExtractorBinding;
  readonly inputSetSha256: `sha256:${string}`;
  readonly normalizationAgreementSha256: `sha256:${string}`;
  readonly projectionSha256: `sha256:${string}`;
  readonly schemaVersion: typeof PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION;
  readonly status: "raw_extraction_agreed_for_personal_use";
  readonly synthetic: false;
}

export interface PersonalFilingRawFactExtractionQuarantinedResult {
  readonly audit: PersonalFilingRawFactExtractionAudit;
  readonly claim: typeof PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM;
  readonly code: PersonalFilingRawFactExtractionQuarantineCode;
  readonly extractorBindings: readonly [];
  readonly facts: readonly [];
  readonly schemaVersion: typeof PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: false;
}

export type PersonalFilingRawFactExtractionResult =
  | PersonalFilingRawFactExtractionAgreementReceipt
  | PersonalFilingRawFactExtractionQuarantinedResult;

export interface PersonalFilingRawFactSuppliedExtractionTestInput extends PersonalFilingRawFactExtractionInput {
  readonly extractorOutput: Uint8Array;
}

export type PersonalFilingRawFactSuppliedExtractionTestResult =
  | { readonly status: "matched_for_testing_only" }
  | PersonalFilingRawFactExtractionQuarantinedResult;

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly rawFilingDocuments: readonly Uint8Array[];
  readonly sourceDocuments: readonly Uint8Array[];
}

interface SuppliedOutputSnapshot extends InputSnapshot {
  readonly extractorOutput: Uint8Array;
}

interface RawFactProjection {
  readonly concept: string;
  readonly dimensionScope: "empty";
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: "USD" | "shares";
  readonly value: string;
}

interface ExtractedRawFact {
  readonly concept: string;
  readonly dimensionScope: "empty" | "nonempty";
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: "USD" | "shares";
  readonly value: string;
}

interface ExpectedProjection {
  readonly documents: readonly (readonly RawFactProjection[])[];
  readonly targetConcepts: readonly string[];
}

interface ExtractorOutput {
  readonly documents: readonly (readonly ExtractedRawFact[])[];
}

class QuarantineSignal extends Error {
  public constructor(
    public readonly code: PersonalFilingRawFactExtractionQuarantineCode,
  ) {
    super();
  }
}

const INPUT_KEYS = [
  "declaration",
  "manifest",
  "normalizationPlan",
  "rawFilingDocuments",
  "sourceDocuments",
] as const;
const SUPPLIED_OUTPUT_INPUT_KEYS = [...INPUT_KEYS, "extractorOutput"] as const;
const OUTPUT_KEYS = ["documents", "schemaVersion", "status"] as const;
const FACT_KEYS = [
  "concept",
  "dimensionScope",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const QNAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}:[A-Za-z_][A-Za-z0-9_.-]{0,127}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DECIMAL = /^(?:0|-?[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const AGREEMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-raw-fact-extraction-agreement:v1\u0000",
);
const INPUT_SET_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-raw-fact-extraction-input-set:v1\u0000",
);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const PYTHON_EXTRACTOR_PATH = fileURLToPath(
  new URL(
    "../validator/personal_filing_raw_fact_extractor.py",
    import.meta.url,
  ),
);

export const PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING: PersonalFilingRawFactExtractorBinding =
  Object.freeze({
    extractorId: "personal-filing-raw-fact-extractor-python-v1",
    extractorVersion: "1.0.0",
    implementationSha256:
      "sha256:8b4fe9b8d8894bec80c4124fe34f6d39b8cb5d34f6981da717f48a7890e91f10",
    runtimeFamily: "python-stdlib-html-parser",
  });

export function comparePersonalFilingRawFactExtraction(
  input: PersonalFilingRawFactExtractionInput,
): PersonalFilingRawFactExtractionResult {
  try {
    if (arguments.length !== 1) quarantine("input_invalid");
    const snapshot = snapshotInput(input);
    const primary = requirePrimaryAgreement(snapshot);
    requireRawPayloadScope(snapshot);
    const projection = expectedProjection(primary.record);
    const output = runPinnedPythonExtractor(
      snapshot,
      projection.targetConcepts,
    );
    const extracted = parseExtractorOutput(
      output,
      snapshot.rawFilingDocuments.length,
    );
    compareProjection(projection.documents, extracted.documents);
    return agreementReceipt(snapshot, primary.agreementSha256, projection);
  } catch (error) {
    return quarantinedResult(
      error instanceof QuarantineSignal ? error.code : "comparison_failure",
    );
  }
}

/** @internal Test-only conflict seam; deliberately not re-exported. */
export function compareSuppliedPersonalFilingRawFactExtractionForTesting(
  input: PersonalFilingRawFactSuppliedExtractionTestInput,
): PersonalFilingRawFactSuppliedExtractionTestResult {
  try {
    if (arguments.length !== 1) quarantine("input_invalid");
    const snapshot = snapshotSuppliedOutput(input);
    const primary = requirePrimaryAgreement(snapshot);
    requireRawPayloadScope(snapshot);
    const projection = expectedProjection(primary.record);
    const extracted = parseExtractorOutput(
      snapshot.extractorOutput,
      snapshot.rawFilingDocuments.length,
    );
    compareProjection(projection.documents, extracted.documents);
    return Object.freeze({ status: "matched_for_testing_only" as const });
  } catch (error) {
    return quarantinedResult(
      error instanceof QuarantineSignal ? error.code : "comparison_failure",
    );
  }
}

function snapshotInput(value: unknown): InputSnapshot {
  return snapshotExactInput(value, INPUT_KEYS, false);
}

function snapshotSuppliedOutput(value: unknown): SuppliedOutputSnapshot {
  return snapshotExactInput(value, SUPPLIED_OUTPUT_INPUT_KEYS, true);
}

function snapshotExactInput(
  value: unknown,
  keys: readonly string[],
  withOutput: false,
): InputSnapshot;
function snapshotExactInput(
  value: unknown,
  keys: readonly string[],
  withOutput: true,
): SuppliedOutputSnapshot;
function snapshotExactInput(
  value: unknown,
  keys: readonly string[],
  withOutput: boolean,
): InputSnapshot | SuppliedOutputSnapshot {
  try {
    if (isProxy(value)) quarantine("input_invalid");
    const descriptors = exactDataDescriptors(value, keys);
    if (descriptors === undefined) quarantine("input_invalid");
    const seenBuffers = new Set<object>();
    const base: InputSnapshot = Object.freeze({
      declaration: byteSnapshot(
        descriptors.declaration?.value,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
        seenBuffers,
      ),
      manifest: byteSnapshot(
        descriptors.manifest?.value,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
        seenBuffers,
      ),
      normalizationPlan: byteSnapshot(
        descriptors.normalizationPlan?.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.normalizationPlanBytes,
        seenBuffers,
      ),
      rawFilingDocuments: snapshotDocumentArray(
        descriptors.rawFilingDocuments?.value,
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.rawFilingDocumentBytes,
        seenBuffers,
      ),
      sourceDocuments: snapshotDocumentArray(
        descriptors.sourceDocuments?.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.parserResultBytes,
        seenBuffers,
      ),
    });
    if (!withOutput) return base;
    return Object.freeze({
      ...base,
      extractorOutput: byteSnapshot(
        descriptors.extractorOutput?.value,
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputBytes,
        seenBuffers,
      ),
    });
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function exactDataDescriptors(
  value: unknown,
  keys: readonly string[],
): PropertyDescriptorMap | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return undefined;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!exactKeys(Reflect.ownKeys(value), keys)) return undefined;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
  }
  return descriptors;
}

function snapshotDocumentArray(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
): readonly Uint8Array[] {
  try {
    if (
      isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      quarantine("input_invalid");
    }
    const descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as PropertyDescriptorMap;
    const length = descriptors.length?.value as unknown;
    if (
      typeof length !== "number" ||
      !Number.isInteger(length) ||
      length < 1 ||
      length > PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.rawFilingDocuments ||
      !exactKeys(Reflect.ownKeys(value), [
        ...Array.from({ length }, (_, index) => String(index)),
        "length",
      ])
    ) {
      quarantine("input_invalid");
    }
    return Object.freeze(
      Array.from({ length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          quarantine("input_invalid");
        }
        return byteSnapshot(descriptor.value, maximumBytes, seenBuffers);
      }),
    );
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function byteSnapshot(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null || isProxy(value)) {
      quarantine("input_invalid");
    }
    const bytes = value as Uint8Array;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      byteLength < 3 ||
      byteLength > maximumBytes ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      seenBuffers.has(buffer as object)
    ) {
      quarantine("input_invalid");
    }
    seenBuffers.add(buffer as object);
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function requirePrimaryAgreement(snapshot: InputSnapshot): {
  readonly agreementSha256: `sha256:${string}`;
  readonly record: PersonalFilingFactNormalizationRecord;
} {
  const input = primaryInput(snapshot);
  const agreement = comparePersonalFilingFactValidation(input);
  if (agreement.status !== "agreed_for_personal_use") {
    quarantine("primary_agreement_missing");
  }
  const record = normalizePersonalFilingFacts(input);
  if (record.status !== "normalized_for_personal_use") {
    quarantine("primary_agreement_missing");
  }
  if (sha256(canonicalBytes(record)) !== agreement.normalizedRecordSha256) {
    quarantine("primary_agreement_missing");
  }
  return Object.freeze({ agreementSha256: agreement.agreementSha256, record });
}

function primaryInput(
  snapshot: InputSnapshot,
): PersonalFilingFactComparisonInput {
  return {
    declaration: snapshot.declaration,
    manifest: snapshot.manifest,
    normalizationPlan: snapshot.normalizationPlan,
    sourceDocuments: snapshot.sourceDocuments,
  };
}

function requireRawPayloadScope(snapshot: InputSnapshot): void {
  try {
    const manifest = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        snapshot.manifest,
      ),
    ) as unknown;
    const record = exactRecord(manifest, [
      "corpusId",
      "corpusVersion",
      "entries",
      "frozenAt",
      "profile",
      "schemaVersion",
    ]);
    if (
      !Array.isArray(record.entries) ||
      record.entries.length !== snapshot.rawFilingDocuments.length ||
      record.entries.length !== snapshot.sourceDocuments.length
    ) {
      quarantine("raw_payload_scope_mismatch");
    }
    for (const [index, entryValue] of record.entries.entries()) {
      const entry = entryValue as Record<string, unknown>;
      const raw = snapshot.rawFilingDocuments[index];
      if (
        raw === undefined ||
        !Number.isSafeInteger(entry.contentBytes) ||
        entry.contentBytes !== raw.byteLength ||
        typeof entry.contentSha256 !== "string" ||
        entry.contentSha256 !== sha256(raw)
      ) {
        quarantine("raw_payload_scope_mismatch");
      }
    }
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("raw_payload_scope_mismatch");
  }
}

function expectedProjection(
  record: PersonalFilingFactNormalizationRecord,
): ExpectedProjection {
  try {
    const documentCount = record.audit.sourceDocumentCount;
    if (
      documentCount < 1 ||
      documentCount > 2 ||
      record.factVersions.length !==
        documentCount * PERSONAL_FILING_FACT_KEYS.length
    ) {
      quarantine("comparison_failure");
    }
    const documents: RawFactProjection[][] = [];
    for (
      let documentIndex = 0;
      documentIndex < documentCount;
      documentIndex += 1
    ) {
      const versions = record.factVersions.slice(
        documentIndex * PERSONAL_FILING_FACT_KEYS.length,
        (documentIndex + 1) * PERSONAL_FILING_FACT_KEYS.length,
      );
      const facts = rawCoordinatesForDocument(versions);
      if (
        facts.length !==
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.targetConcepts
      ) {
        quarantine("comparison_failure");
      }
      documents.push(facts);
    }
    const targetConcepts = Object.freeze(
      [
        ...new Set(
          documents.flatMap((document) => document.map((fact) => fact.concept)),
        ),
      ].sort(),
    );
    if (
      targetConcepts.length !==
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.targetConcepts ||
      documents.some((document) =>
        document.some((fact) => !targetConcepts.includes(fact.concept)),
      )
    ) {
      quarantine("comparison_failure");
    }
    return Object.freeze({
      documents: Object.freeze(
        documents.map((document) => Object.freeze(document)),
      ),
      targetConcepts,
    });
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("comparison_failure");
  }
}

function rawCoordinatesForDocument(
  versions: readonly PersonalNormalizedFilingFactVersion[],
): RawFactProjection[] {
  const byCoordinate = new Map<string, RawFactProjection>();
  for (const [index, version] of versions.entries()) {
    if (version.key !== PERSONAL_FILING_FACT_KEYS[index]) {
      quarantine("comparison_failure");
    }
    if (version.key === "free_cash_flow") {
      if (version.derivation === null || version.sourceConcept !== null) {
        quarantine("comparison_failure");
      }
      addExpectedCoordinate(byCoordinate, {
        concept: version.derivation.minuend.concept,
        dimensionScope: "empty",
        periodEnd: version.derivation.minuend.periodEnd,
        periodStart: version.derivation.minuend.periodStart,
        unit: version.derivation.minuend.unit,
        value: version.derivation.minuend.value,
      });
      addExpectedCoordinate(byCoordinate, {
        concept: version.derivation.subtrahend.concept,
        dimensionScope: "empty",
        periodEnd: version.derivation.subtrahend.periodEnd,
        periodStart: version.derivation.subtrahend.periodStart,
        unit: version.derivation.subtrahend.unit,
        value: version.derivation.subtrahend.value,
      });
    } else {
      if (version.derivation !== null || version.sourceConcept === null) {
        quarantine("comparison_failure");
      }
      addExpectedCoordinate(byCoordinate, {
        concept: version.sourceConcept,
        dimensionScope: "empty",
        periodEnd: version.periodEnd,
        periodStart: version.periodStart,
        unit: version.unit,
        value: version.value,
      });
    }
  }
  return [...byCoordinate.values()].sort(compareFacts);
}

function addExpectedCoordinate(
  coordinates: Map<string, RawFactProjection>,
  fact: RawFactProjection,
): void {
  const key = coordinateKey(fact);
  const existing = coordinates.get(key);
  if (existing !== undefined && existing.value !== fact.value) {
    quarantine("comparison_failure");
  }
  coordinates.set(key, Object.freeze(fact));
}

function runPinnedPythonExtractor(
  snapshot: InputSnapshot,
  targetConcepts: readonly string[],
): Uint8Array {
  try {
    const source = readFileSync(PYTHON_EXTRACTOR_PATH, "utf8").replace(
      /\r\n/gu,
      "\n",
    );
    if (
      sha256(new TextEncoder().encode(source)) !==
      PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING.implementationSha256
    ) {
      quarantine("extractor_execution_failure");
    }
    const request = canonicalBytes({
      rawFilingDocuments: snapshot.rawFilingDocuments.map(base64),
      targetConcepts,
    });
    const result = spawnSync("python", ["-I", "-B", PYTHON_EXTRACTOR_PATH], {
      input: request,
      maxBuffer:
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputBytes + 1,
      timeout: 20_000,
      windowsHide: true,
    });
    if (
      result.error !== undefined ||
      result.status !== 0 ||
      result.signal !== null ||
      result.stderr.byteLength !== 0 ||
      result.stdout.byteLength < 3 ||
      result.stdout.byteLength >
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputBytes
    ) {
      quarantine("extractor_execution_failure");
    }
    return Uint8Array.from(result.stdout);
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("extractor_execution_failure");
  }
}

function parseExtractorOutput(
  bytes: Uint8Array,
  expectedDocuments: number,
): ExtractorOutput {
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const value = JSON.parse(text) as unknown;
    validateCanonicalTree(value);
    if (`${canonicalJson(value)}\n` !== text) {
      quarantine("extractor_output_invalid");
    }
    const record = exactRecord(value, OUTPUT_KEYS);
    if (
      record.schemaVersion !==
        PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION ||
      record.status !== "extracted" ||
      !Array.isArray(record.documents) ||
      record.documents.length !== expectedDocuments
    ) {
      quarantine("extractor_output_invalid");
    }
    const documents = record.documents.map((documentValue) => {
      const document = exactRecord(documentValue, ["facts"]);
      if (
        !Array.isArray(document.facts) ||
        document.facts.length < 1 ||
        document.facts.length >
          PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputFactsPerDocument
      ) {
        quarantine("extractor_output_invalid");
      }
      const byCoordinate = new Map<string, ExtractedRawFact>();
      for (const factValue of document.facts) {
        const fact = validateExtractedFact(factValue);
        const key = coordinateKey(fact);
        const existing = byCoordinate.get(key);
        if (existing !== undefined && existing.value !== fact.value) {
          quarantine("extractor_output_invalid");
        }
        byCoordinate.set(key, fact);
      }
      const facts = [...byCoordinate.values()].sort(compareFacts);
      if (canonicalJson(facts) !== canonicalJson(document.facts)) {
        quarantine("extractor_output_invalid");
      }
      return Object.freeze(facts);
    });
    return Object.freeze({ documents: Object.freeze(documents) });
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("extractor_output_invalid");
  }
}

function validateExtractedFact(value: unknown): ExtractedRawFact {
  const fact = exactRecord(value, FACT_KEYS);
  if (
    typeof fact.concept !== "string" ||
    !QNAME.test(fact.concept) ||
    (fact.dimensionScope !== "empty" && fact.dimensionScope !== "nonempty") ||
    typeof fact.periodEnd !== "string" ||
    !ISO_DATE.test(fact.periodEnd) ||
    (fact.periodStart !== null &&
      (typeof fact.periodStart !== "string" ||
        !ISO_DATE.test(fact.periodStart))) ||
    (fact.unit !== "USD" && fact.unit !== "shares") ||
    typeof fact.value !== "string" ||
    !DECIMAL.test(fact.value)
  ) {
    quarantine("extractor_output_invalid");
  }
  return Object.freeze({
    concept: fact.concept,
    dimensionScope: fact.dimensionScope,
    periodEnd: fact.periodEnd,
    periodStart: fact.periodStart,
    unit: fact.unit,
    value: fact.value,
  });
}

function compareProjection(
  expectedDocuments: readonly (readonly RawFactProjection[])[],
  extractedDocuments: readonly (readonly ExtractedRawFact[])[],
): void {
  if (expectedDocuments.length !== extractedDocuments.length) {
    quarantine("extraction_conflict");
  }
  for (const [index, expected] of expectedDocuments.entries()) {
    const extracted = extractedDocuments[index];
    if (extracted === undefined) quarantine("extraction_conflict");
    const byCoordinate = new Map(
      extracted.map((fact) => [coordinateKey(fact), fact] as const),
    );
    for (const expectedFact of expected) {
      const actual = byCoordinate.get(coordinateKey(expectedFact));
      if (actual === undefined || actual.value !== expectedFact.value) {
        quarantine("extraction_conflict");
      }
    }
  }
}

function agreementReceipt(
  snapshot: InputSnapshot,
  normalizationAgreementSha256: `sha256:${string}`,
  projection: ExpectedProjection,
): PersonalFilingRawFactExtractionAgreementReceipt {
  const projectionSha256 = sha256(
    canonicalBytes({
      documents: projection.documents.map((facts) => ({ facts })),
      schemaVersion: PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION,
    }),
  );
  const inputSetSha256 = inputSetSha(snapshot);
  const agreementSha256 = domainSha(
    AGREEMENT_DOMAIN,
    canonicalBytes({
      assurance: PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE,
      claim: PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
      extractorBinding: PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING,
      inputSetSha256,
      normalizationAgreementSha256,
      projectionSha256,
      schemaVersion: PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION,
    }),
  );
  return Object.freeze({
    agreementSha256,
    assurance: PERSONAL_FILING_RAW_FACT_EXTRACTION_ASSURANCE,
    audit: Object.freeze({
      comparedCoordinateCount:
        projection.documents.length *
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.targetConcepts,
      extractorCount: 1,
      outcome: "agreed" as const,
      sourceDocumentCount: projection.documents.length,
    }),
    claim: PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
    extractorBinding: PERSONAL_FILING_RAW_FACT_EXTRACTOR_BINDING,
    inputSetSha256,
    normalizationAgreementSha256,
    projectionSha256,
    schemaVersion: PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION,
    status: "raw_extraction_agreed_for_personal_use" as const,
    synthetic: false as const,
  });
}

function inputSetSha(snapshot: InputSnapshot): `sha256:${string}` {
  return domainSha(
    INPUT_SET_DOMAIN,
    canonicalBytes({
      declarationSha256: sha256(snapshot.declaration),
      manifestSha256: sha256(snapshot.manifest),
      normalizationPlanSha256: sha256(snapshot.normalizationPlan),
      rawFilingDocumentSha256s: snapshot.rawFilingDocuments.map(sha256),
      sourceDocumentSha256s: snapshot.sourceDocuments.map(sha256),
    }),
  );
}

function quarantinedResult(
  code: PersonalFilingRawFactExtractionQuarantineCode,
): PersonalFilingRawFactExtractionQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      comparedCoordinateCount: 0,
      extractorCount: 0,
      outcome: "quarantined" as const,
      sourceDocumentCount: 0,
    }),
    claim: PERSONAL_FILING_RAW_FACT_EXTRACTION_CLAIM,
    code,
    extractorBindings: Object.freeze([] as const),
    facts: Object.freeze([] as const),
    schemaVersion: PERSONAL_FILING_RAW_FACT_EXTRACTION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: false as const,
  });
}

function coordinateKey(
  fact: Omit<ExtractedRawFact, "value"> | ExtractedRawFact,
): string {
  return canonicalJson({
    concept: fact.concept,
    dimensionScope: fact.dimensionScope,
    periodEnd: fact.periodEnd,
    periodStart: fact.periodStart,
    unit: fact.unit,
  });
}

function compareFacts(
  left: Omit<ExtractedRawFact, "value"> & { readonly value: string },
  right: Omit<ExtractedRawFact, "value"> & { readonly value: string },
): number {
  const leftKey = [
    left.concept,
    left.periodEnd,
    left.periodStart ?? "",
    left.unit,
    left.dimensionScope,
    left.value,
  ];
  const rightKey = [
    right.concept,
    right.periodEnd,
    right.periodStart ?? "",
    right.unit,
    right.dimensionScope,
    right.value,
  ];
  for (const [index, value] of leftKey.entries()) {
    const other = rightKey[index] as string;
    if (value < other) return -1;
    if (value > other) return 1;
  }
  return 0;
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(Reflect.ownKeys(value), keys)
  ) {
    quarantine("extractor_output_invalid");
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  actual: readonly PropertyKey[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((key) => actual.includes(key))
  );
}

function validateCanonicalTree(root: unknown): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value: root },
  ];
  let nodes = 0;
  let strings = 0;
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) quarantine("extractor_output_invalid");
    nodes += 1;
    if (
      nodes > PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputNodes ||
      item.depth >
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputDepth
    ) {
      quarantine("extractor_output_invalid");
    }
    const value = item.value;
    if (typeof value === "string") {
      strings += [...value].length;
      if (
        strings >
        PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.extractorOutputStringCodePoints
      ) {
        quarantine("extractor_output_invalid");
      }
    } else if (Array.isArray(value)) {
      for (const child of value)
        stack.push({ depth: item.depth + 1, value: child });
    } else if (typeof value === "object" && value !== null) {
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        quarantine("extractor_output_invalid");
      }
      for (const [key, child] of Object.entries(value)) {
        strings += [...key].length;
        stack.push({ depth: item.depth + 1, value: child });
      }
    } else if (
      value !== null &&
      typeof value !== "boolean" &&
      !(typeof value === "number" && Number.isSafeInteger(value))
    ) {
      quarantine("extractor_output_invalid");
    }
  }
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) {
    quarantine("comparison_failure");
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainSha(domain: Uint8Array, bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(bytes)
    .digest("hex")}`;
}

function quarantine(
  code: PersonalFilingRawFactExtractionQuarantineCode,
): never {
  throw new QuarantineSignal(code);
}
