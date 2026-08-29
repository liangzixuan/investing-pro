import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import { PERSONAL_FILING_CORPUS_LIMITS } from "./personal-filing-corpus";
import {
  PERSONAL_FILING_FACT_NORMALIZATION_CLAIM,
  PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
  PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  normalizePersonalFilingFacts,
  type PersonalFilingFactNormalizationInput,
  type PersonalFilingFactNormalizationRecord,
} from "./personal-filing-fact-normalization";

export const PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_FILING_FACT_COMPARISON_CLAIM =
  "bounded_repository_pinned_typescript_python_validator_exact_record_agreement_and_atomic_value_free_conflict_quarantine_for_personal_single_user_local_use" as const;
export const PERSONAL_FILING_FACT_COMPARISON_ASSURANCE =
  "distinct_repository_pinned_implementations_over_one_shared_parser_result_scope" as const;

export type PersonalFilingFactComparisonValidatorRole =
  "typescript-primary" | "python-secondary";
export type PersonalFilingFactComparisonRuntimeFamily =
  "node-typescript" | "python-stdlib";

export interface PersonalFilingFactComparisonImplementationBinding {
  readonly implementationSha256: `sha256:${string}`;
  readonly role: PersonalFilingFactComparisonValidatorRole;
  readonly runtimeFamily: PersonalFilingFactComparisonRuntimeFamily;
  readonly validatorId: string;
  readonly validatorVersion: "1.0.0";
}

export const PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS: readonly [
  PersonalFilingFactComparisonImplementationBinding,
  PersonalFilingFactComparisonImplementationBinding,
] = Object.freeze([
  Object.freeze({
    implementationSha256:
      "sha256:43e3379ac30b540341ec1c8014b2994e0671906a215c8beb027a786c3e96f215",
    role: "typescript-primary",
    runtimeFamily: "node-typescript",
    validatorId: "personal-filing-fact-normalizer-typescript-v1",
    validatorVersion: "1.0.0",
  }),
  Object.freeze({
    implementationSha256:
      "sha256:b76d456d3c92f58a67a10276b15e28d7dc05d5fc2caeb53eab4535e83054e465",
    role: "python-secondary",
    runtimeFamily: "python-stdlib",
    validatorId: "personal-filing-fact-validator-python-v1",
    validatorVersion: "1.0.0",
  }),
]);

export const PERSONAL_FILING_FACT_COMPARISON_CHECKS = Object.freeze([
  "owned_bounded_exact_declaration_manifest_plan_source_and_secondary_record_snapshots",
  "local_typescript_normalizer_reconstruction_precedes_any_agreement_decision",
  "repository_pinned_distinct_typescript_and_python_validator_source_bindings",
  "same_exact_ordered_declaration_manifest_plan_and_parser_result_scope",
  "secondary_validator_receives_no_primary_record_or_primary_record_digest",
  "canonical_utf8_lf_sorted_key_safe_integer_complete_record_serialization",
  "byte_exact_complete_cycle2u_record_agreement_not_digest_or_subset_equality",
  "all_top_level_fact_derivation_operand_lineage_identifier_and_pointer_fields_compared",
  "no_tolerance_coercion_reordering_merge_fallback_preference_or_silent_repair",
  "metadata_only_immutable_agreement_receipt_or_atomic_value_free_quarantine",
  "domain_separated_input_record_and_agreement_sha256_bindings",
  "deterministic_replay_owned_snapshot_mutation_safety_and_deep_immutability",
  "bounded_local_python_stdin_subprocess_with_pinned_source_preflight",
  "no_network_database_api_web_queue_or_application_composition",
] as const);

export const PERSONAL_FILING_FACT_COMPARISON_NOT_PROVEN = Object.freeze([
  "independent_raw_filing_parsing_extraction_or_taxonomy_mapping",
  "correctness_of_the_shared_parser_result_normalization_plan_or_cycle2u_specification",
  "accounting_fact_or_free_cash_flow_interpretation_truth",
  "raw_payload_identity_sec_authenticity_or_complete_provenance_at_comparison_time",
  "operator_host_key_process_failure_domain_or_code_lineage_independence",
  "absence_of_common_input_common_specification_errors_collusion_or_malicious_validators",
  "python_executable_identity_process_isolation_source_preflight_to_launch_atomicity_or_runtime_attestation",
  "amendment_discovery_global_currentness_or_absence_of_external_corrections",
  "independently_adjudicated_ground_truth_precision_recall_or_quality_thresholds",
  "multi_user_shared_service_database_api_web_queue_or_production_readiness",
] as const);

export const PERSONAL_FILING_FACT_COMPARISON_LIMITS = Object.freeze({
  aggregateStringCodePoints: 131_072,
  recordBytes: 1_048_576,
  recordDepth: 12,
  recordNodes: 4_096,
  sourceDocuments: 2,
  validators: 2,
});

export const PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES = Object.freeze([
  "input_invalid",
  "normalization_quarantined",
  "validator_execution_failure",
  "validator_output_invalid",
  "validator_conflict",
  "comparison_failure",
] as const);

export type PersonalFilingFactComparisonQuarantineCode =
  (typeof PERSONAL_FILING_FACT_COMPARISON_QUARANTINE_CODES)[number];

export type PersonalFilingFactComparisonInput =
  PersonalFilingFactNormalizationInput;

export interface PersonalFilingFactSuppliedRecordTestInput extends PersonalFilingFactNormalizationInput {
  readonly secondaryRecord: Uint8Array;
}

export interface PersonalFilingFactSuppliedRecordTestMatch {
  readonly status: "matched_for_testing_only";
}

export type PersonalFilingFactSuppliedRecordTestResult =
  | PersonalFilingFactSuppliedRecordTestMatch
  | PersonalFilingFactComparisonQuarantinedResult;

export interface PersonalFilingFactComparisonAudit {
  readonly factVersionCount: number;
  readonly lineageCount: number;
  readonly outcome: "agreed" | "quarantined";
  readonly sourceDocumentCount: number;
  readonly validatorCount: number;
}

export interface PersonalFilingFactComparisonReceiptBinding extends PersonalFilingFactComparisonImplementationBinding {
  readonly normalizedRecordSha256: `sha256:${string}`;
}

export interface PersonalFilingFactComparisonAgreementReceipt {
  readonly agreementSha256: `sha256:${string}`;
  readonly assurance: typeof PERSONAL_FILING_FACT_COMPARISON_ASSURANCE;
  readonly audit: PersonalFilingFactComparisonAudit;
  readonly claim: typeof PERSONAL_FILING_FACT_COMPARISON_CLAIM;
  readonly inputSetSha256: `sha256:${string}`;
  readonly normalizedRecordSha256: `sha256:${string}`;
  readonly schemaVersion: typeof PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION;
  readonly status: "agreed_for_personal_use";
  readonly synthetic: false;
  readonly validatorBindings: readonly [
    PersonalFilingFactComparisonReceiptBinding,
    PersonalFilingFactComparisonReceiptBinding,
  ];
}

export interface PersonalFilingFactComparisonQuarantinedResult {
  readonly audit: PersonalFilingFactComparisonAudit;
  readonly claim: typeof PERSONAL_FILING_FACT_COMPARISON_CLAIM;
  readonly code: PersonalFilingFactComparisonQuarantineCode;
  readonly factVersions: readonly [];
  readonly lineage: readonly [];
  readonly schemaVersion: typeof PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: false;
  readonly validatorBindings: readonly [];
}

export type PersonalFilingFactComparisonResult =
  | PersonalFilingFactComparisonAgreementReceipt
  | PersonalFilingFactComparisonQuarantinedResult;

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly sourceDocuments: readonly Uint8Array[];
}

interface SuppliedRecordSnapshot extends InputSnapshot {
  readonly secondaryRecord: Uint8Array;
}

class QuarantineSignal extends Error {
  public constructor(
    public readonly code: PersonalFilingFactComparisonQuarantineCode,
  ) {
    super();
  }
}

const INPUT_KEYS = [
  "declaration",
  "manifest",
  "normalizationPlan",
  "sourceDocuments",
] as const;
const SUPPLIED_RECORD_TEST_INPUT_KEYS = [
  ...INPUT_KEYS,
  "secondaryRecord",
] as const;
const NORMALIZED_RECORD_KEYS = [
  "audit",
  "claim",
  "corpusId",
  "corpusVersion",
  "declarationSha256",
  "factVersions",
  "lineage",
  "lineageScope",
  "lineageStatus",
  "manifestSha256",
  "normalizationPlanSha256",
  "nullKnownToScope",
  "ownerCorrectionStatus",
  "schemaVersion",
  "sourceDocumentSha256s",
  "status",
  "synthetic",
] as const;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const AGREEMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-fact-validator-agreement:v1\u0000",
);
const INPUT_SET_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-filing-fact-validator-input-set:v1\u0000",
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
const PYTHON_VALIDATOR_PATH = fileURLToPath(
  new URL("../validator/personal_filing_fact_validator.py", import.meta.url),
);

export function comparePersonalFilingFactValidation(
  input: PersonalFilingFactComparisonInput,
): PersonalFilingFactComparisonResult {
  try {
    if (arguments.length !== 1) quarantine("input_invalid");
    validateImplementationBindings();
    const snapshot = snapshotInput(input);
    const primary = normalizeSnapshot(snapshot);
    const primaryBytes = canonicalRecordBytes(primary);
    const secondaryRecord = runPinnedPythonValidator(snapshot);
    compareSecondaryRecord(primaryBytes, secondaryRecord);
    return agreementReceipt(snapshot, primary, primaryBytes);
  } catch (error) {
    return quarantinedResult(
      error instanceof QuarantineSignal ? error.code : "comparison_failure",
    );
  }
}

export function compareSuppliedPersonalFilingFactRecordForTesting(
  input: PersonalFilingFactSuppliedRecordTestInput,
): PersonalFilingFactSuppliedRecordTestResult {
  try {
    if (arguments.length !== 1) quarantine("input_invalid");
    validateImplementationBindings();
    const snapshot = snapshotSuppliedRecordInput(input);
    const primary = normalizeSnapshot(snapshot);
    compareSecondaryRecord(
      canonicalRecordBytes(primary),
      snapshot.secondaryRecord,
    );
    return Object.freeze({ status: "matched_for_testing_only" as const });
  } catch (error) {
    return quarantinedResult(
      error instanceof QuarantineSignal ? error.code : "comparison_failure",
    );
  }
}

function snapshotInput(value: unknown): InputSnapshot {
  try {
    if (isProxy(value)) quarantine("input_invalid");
    const descriptors = exactDataDescriptors(value, INPUT_KEYS);
    if (descriptors === undefined) quarantine("input_invalid");
    const seenBuffers = new Set<object>();
    return Object.freeze({
      declaration: byteSnapshot(
        descriptors.declaration.value,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
        seenBuffers,
      ),
      manifest: byteSnapshot(
        descriptors.manifest.value,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
        seenBuffers,
      ),
      normalizationPlan: byteSnapshot(
        descriptors.normalizationPlan.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.normalizationPlanBytes,
        seenBuffers,
      ),
      sourceDocuments: snapshotDocumentArray(
        descriptors.sourceDocuments.value,
        seenBuffers,
      ),
    });
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function snapshotSuppliedRecordInput(value: unknown): SuppliedRecordSnapshot {
  try {
    if (isProxy(value)) quarantine("input_invalid");
    const descriptors = exactDataDescriptors(
      value,
      SUPPLIED_RECORD_TEST_INPUT_KEYS,
    );
    if (descriptors === undefined) quarantine("input_invalid");
    const seenBuffers = new Set<object>();
    return Object.freeze({
      declaration: byteSnapshot(
        descriptors.declaration.value,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
        seenBuffers,
      ),
      manifest: byteSnapshot(
        descriptors.manifest.value,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
        seenBuffers,
      ),
      normalizationPlan: byteSnapshot(
        descriptors.normalizationPlan.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.normalizationPlanBytes,
        seenBuffers,
      ),
      secondaryRecord: byteSnapshot(
        descriptors.secondaryRecord.value,
        PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordBytes,
        seenBuffers,
      ),
      sourceDocuments: snapshotDocumentArray(
        descriptors.sourceDocuments.value,
        seenBuffers,
      ),
    });
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function snapshotDocumentArray(
  value: unknown,
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
    const lengthDescriptor = descriptors.length;
    const rawLength = lengthDescriptor?.value as unknown;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof rawLength !== "number" ||
      !Number.isInteger(rawLength) ||
      rawLength < 1 ||
      rawLength > PERSONAL_FILING_FACT_COMPARISON_LIMITS.sourceDocuments
    ) {
      quarantine("input_invalid");
    }
    const expectedKeys = [
      ...Array.from({ length: rawLength }, (_, index) => String(index)),
      "length",
    ];
    if (!exactKeys(Reflect.ownKeys(value), expectedKeys)) {
      quarantine("input_invalid");
    }
    return Object.freeze(
      Array.from({ length: rawLength }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          quarantine("input_invalid");
        }
        return byteSnapshot(
          descriptor.value,
          PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.parserResultBytes,
          seenBuffers,
        );
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

function normalizeSnapshot(
  snapshot: InputSnapshot,
): PersonalFilingFactNormalizationRecord {
  const primary = normalizePersonalFilingFacts({
    declaration: snapshot.declaration,
    manifest: snapshot.manifest,
    normalizationPlan: snapshot.normalizationPlan,
    sourceDocuments: snapshot.sourceDocuments,
  });
  if (primary.status !== "normalized_for_personal_use") {
    quarantine("normalization_quarantined");
  }
  return primary;
}

function runPinnedPythonValidator(snapshot: InputSnapshot): Uint8Array {
  try {
    const source = readFileSync(PYTHON_VALIDATOR_PATH, "utf8").replace(
      /\r\n/gu,
      "\n",
    );
    const binding = PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[1];
    if (
      sha256(new TextEncoder().encode(source)) !== binding.implementationSha256
    ) {
      quarantine("validator_execution_failure");
    }
    const request = new TextEncoder().encode(
      `${canonicalJson({
        declaration: base64(snapshot.declaration),
        manifest: base64(snapshot.manifest),
        normalizationPlan: base64(snapshot.normalizationPlan),
        sourceDocuments: snapshot.sourceDocuments.map(base64),
      })}\n`,
    );
    const result = spawnSync("python", ["-B", PYTHON_VALIDATOR_PATH], {
      input: request,
      maxBuffer: PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordBytes + 1,
      timeout: 10_000,
      windowsHide: true,
    });
    if (
      result.error !== undefined ||
      result.status !== 0 ||
      result.signal !== null ||
      result.stderr.byteLength !== 0 ||
      result.stdout.byteLength < 3 ||
      result.stdout.byteLength >
        PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordBytes
    ) {
      quarantine("validator_execution_failure");
    }
    return Uint8Array.from(result.stdout);
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("validator_execution_failure");
  }
}

function compareSecondaryRecord(
  primaryBytes: Uint8Array,
  secondaryRecord: Uint8Array,
): void {
  parseSecondaryRecord(secondaryRecord);
  if (!exactBytes(primaryBytes, secondaryRecord)) {
    quarantine("validator_conflict");
  }
}

function parseSecondaryRecord(bytes: Uint8Array): void {
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    parsed = JSON.parse(text) as unknown;
  } catch {
    quarantine("validator_output_invalid");
  }
  validateCanonicalTree(parsed);
  if (`${canonicalJson(parsed)}\n` !== text) {
    quarantine("validator_output_invalid");
  }
  const record = exactRecord(parsed, NORMALIZED_RECORD_KEYS);
  if (
    record.schemaVersion !==
      PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION ||
    record.claim !== PERSONAL_FILING_FACT_NORMALIZATION_CLAIM ||
    record.status !== "normalized_for_personal_use" ||
    record.synthetic !== false ||
    !Array.isArray(record.factVersions) ||
    !Array.isArray(record.lineage) ||
    !Array.isArray(record.sourceDocumentSha256s)
  ) {
    quarantine("validator_output_invalid");
  }
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function canonicalRecordBytes(
  record: PersonalFilingFactNormalizationRecord,
): Uint8Array {
  const bytes = new TextEncoder().encode(`${canonicalJson(record)}\n`);
  if (bytes.byteLength > PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordBytes) {
    quarantine("comparison_failure");
  }
  return bytes;
}

function agreementReceipt(
  snapshot: InputSnapshot,
  record: PersonalFilingFactNormalizationRecord,
  recordBytes: Uint8Array,
): PersonalFilingFactComparisonAgreementReceipt {
  const normalizedRecordSha256 = sha256(recordBytes);
  const inputSetSha256 = inputSetSha(snapshot);
  const validatorBindings = receiptBindings(normalizedRecordSha256);
  const agreementSha256 = domainSha(
    AGREEMENT_DOMAIN,
    new TextEncoder().encode(
      canonicalJson({
        assurance: PERSONAL_FILING_FACT_COMPARISON_ASSURANCE,
        claim: PERSONAL_FILING_FACT_COMPARISON_CLAIM,
        inputSetSha256,
        normalizedRecordSha256,
        schemaVersion: PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION,
        validatorBindings,
      }),
    ),
  );
  return Object.freeze({
    agreementSha256,
    assurance: PERSONAL_FILING_FACT_COMPARISON_ASSURANCE,
    audit: Object.freeze({
      factVersionCount: record.audit.factVersionCount,
      lineageCount: record.audit.lineageCount,
      outcome: "agreed" as const,
      sourceDocumentCount: record.audit.sourceDocumentCount,
      validatorCount: PERSONAL_FILING_FACT_COMPARISON_LIMITS.validators,
    }),
    claim: PERSONAL_FILING_FACT_COMPARISON_CLAIM,
    inputSetSha256,
    normalizedRecordSha256,
    schemaVersion: PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION,
    status: "agreed_for_personal_use" as const,
    synthetic: false as const,
    validatorBindings,
  });
}

function inputSetSha(snapshot: InputSnapshot): `sha256:${string}` {
  return domainSha(
    INPUT_SET_DOMAIN,
    new TextEncoder().encode(
      canonicalJson({
        declarationSha256: sha256(snapshot.declaration),
        manifestSha256: sha256(snapshot.manifest),
        normalizationPlanSha256: sha256(snapshot.normalizationPlan),
        sourceDocumentSha256s: snapshot.sourceDocuments.map(sha256),
      }),
    ),
  );
}

function receiptBindings(
  normalizedRecordSha256: `sha256:${string}`,
): readonly [
  PersonalFilingFactComparisonReceiptBinding,
  PersonalFilingFactComparisonReceiptBinding,
] {
  const first = PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[0];
  const second = PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS[1];
  return Object.freeze([
    Object.freeze({ ...first, normalizedRecordSha256 }),
    Object.freeze({ ...second, normalizedRecordSha256 }),
  ]);
}

function validateImplementationBindings(): void {
  const [first, second] = PERSONAL_FILING_FACT_COMPARISON_IMPLEMENTATIONS;
  if (
    first.role !== "typescript-primary" ||
    second.role !== "python-secondary" ||
    first.runtimeFamily !== "node-typescript" ||
    second.runtimeFamily !== "python-stdlib" ||
    first.validatorId === second.validatorId ||
    first.implementationSha256 === second.implementationSha256 ||
    !HASH.test(first.implementationSha256) ||
    !HASH.test(second.implementationSha256)
  ) {
    quarantine("comparison_failure");
  }
}

function quarantinedResult(
  code: PersonalFilingFactComparisonQuarantineCode,
): PersonalFilingFactComparisonQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      factVersionCount: 0,
      lineageCount: 0,
      outcome: "quarantined" as const,
      sourceDocumentCount: 0,
      validatorCount: 0,
    }),
    claim: PERSONAL_FILING_FACT_COMPARISON_CLAIM,
    code,
    factVersions: Object.freeze([] as const),
    lineage: Object.freeze([] as const),
    schemaVersion: PERSONAL_FILING_FACT_COMPARISON_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: false as const,
    validatorBindings: Object.freeze([] as const),
  });
}

function validateCanonicalTree(value: unknown): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) quarantine("validator_output_invalid");
    nodes += 1;
    if (
      nodes > PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordNodes ||
      entry.depth > PERSONAL_FILING_FACT_COMPARISON_LIMITS.recordDepth
    ) {
      quarantine("validator_output_invalid");
    }
    if (typeof entry.value === "string") {
      stringCodePoints += [...entry.value].length;
    } else if (
      entry.value === null ||
      typeof entry.value === "boolean" ||
      (typeof entry.value === "number" && Number.isSafeInteger(entry.value))
    ) {
      // Primitive size is also bounded by the owned byte limit.
    } else if (Array.isArray(entry.value)) {
      for (const item of entry.value) {
        stack.push({ depth: entry.depth + 1, value: item });
      }
    } else if (isPlainRecord(entry.value)) {
      for (const [key, item] of Object.entries(entry.value)) {
        stringCodePoints += [...key].length;
        stack.push({ depth: entry.depth + 1, value: item });
      }
    } else {
      quarantine("validator_output_invalid");
    }
    if (
      stringCodePoints >
      PERSONAL_FILING_FACT_COMPARISON_LIMITS.aggregateStringCodePoints
    ) {
      quarantine("validator_output_invalid");
    }
  }
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Record<TKeys[number], unknown> {
  if (!isPlainRecord(value) || !exactKeys(Object.keys(value), keys)) {
    quarantine("validator_output_invalid");
  }
  return value;
}

function exactDataDescriptors<const TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys,
): Record<TKeys[number], PropertyDescriptor> | undefined {
  if (!isPlainRecord(value)) return undefined;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  if (
    !exactKeys(Reflect.ownKeys(value), keys) ||
    !exactKeys(Object.keys(descriptors), keys)
  ) {
    return undefined;
  }
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
  return descriptors as Record<TKeys[number], PropertyDescriptor>;
}

function exactKeys(
  actual: readonly PropertyKey[],
  expected: readonly string[],
): boolean {
  if (
    actual.length !== expected.length ||
    actual.some((key) => typeof key !== "string")
  ) {
    return false;
  }
  const sortedActual = (actual as readonly string[]).slice().sort();
  const sortedExpected = [...expected].sort();
  return sortedExpected.every((key, index) => sortedActual[index] === key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
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
  if (!isPlainRecord(value))
    throw new TypeError("Canonical record is invalid.");
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function exactBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  for (let index = 0; index < first.byteLength; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
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

function quarantine(code: PersonalFilingFactComparisonQuarantineCode): never {
  throw new QuarantineSignal(code);
}
