import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  PERSONAL_FILING_CORPUS_LIMITS,
  PERSONAL_FILING_CORPUS_PROFILE,
  PersonalFilingCorpusError,
  verifyPersonalFilingCorpusManifest,
} from "./personal-filing-corpus";

export const PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION =
  "1.0.0" as const;
export const PERSONAL_FILING_FACT_NORMALIZATION_CLAIM =
  "bounded_private_ten_fact_normalization_and_manifest_linked_lineage_for_personal_single_user_local_use" as const;

export const PERSONAL_FILING_FACT_KEYS = Object.freeze([
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
] as const);

export type PersonalFilingFactKey = (typeof PERSONAL_FILING_FACT_KEYS)[number];
export type PersonalFilingFactUnit = "USD" | "shares";
export type PersonalFilingFactPeriodKind = "duration" | "instant";

export interface PersonalFilingFactContract {
  readonly key: PersonalFilingFactKey;
  readonly periodKind: PersonalFilingFactPeriodKind;
  readonly unit: PersonalFilingFactUnit;
}

export const PERSONAL_FILING_FACT_CONTRACTS: readonly PersonalFilingFactContract[] =
  Object.freeze(
    (
      [
        { key: "assets", periodKind: "instant", unit: "USD" },
        { key: "cash", periodKind: "instant", unit: "USD" },
        { key: "debt", periodKind: "instant", unit: "USD" },
        {
          key: "diluted_shares",
          periodKind: "duration",
          unit: "shares",
        },
        { key: "free_cash_flow", periodKind: "duration", unit: "USD" },
        { key: "gross_profit", periodKind: "duration", unit: "USD" },
        { key: "net_income", periodKind: "duration", unit: "USD" },
        {
          key: "operating_cash_flow",
          periodKind: "duration",
          unit: "USD",
        },
        { key: "operating_income", periodKind: "duration", unit: "USD" },
        { key: "revenue", periodKind: "duration", unit: "USD" },
      ] as const satisfies readonly PersonalFilingFactContract[]
    ).map((contract) => Object.freeze(contract)),
  );

export const PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA =
  "operating_cash_flow_minus_capital_expenditures" as const;

export const PERSONAL_FILING_FACT_NORMALIZATION_CHECKS = Object.freeze([
  "owned_bounded_canonical_declaration_manifest_plan_and_parser_result_snapshots",
  "verified_personal_manifest_and_exact_declaration_manifest_plan_digest_binding",
  "exact_one_10k_or_manifest_linked_10k_and_10k_amendment_closed_source_set",
  "exact_manifest_accession_cik_form_time_taxonomy_and_content_digest_binding",
  "exact_ten_fixed_fact_keys_once_per_parser_result",
  "plan_bound_direct_qname_unit_period_and_empty_dimension_contracts",
  "free_cash_flow_only_fixed_subtraction_with_exact_qname_operands",
  "free_cash_flow_operand_context_unit_value_link_and_strict_decimal_recomputation",
  "strict_decimal_numeric_38_12_without_binary_float_or_unit_conversion",
  "deterministic_fact_identity_and_zero_or_exact_ten_one_to_one_lineage_edges",
  "root_only_or_manifest_linked_half_open_corpus_scoped_known_windows",
  "whole_input_atomic_normalization_or_value_free_quarantine",
  "immutable_success_and_quarantine_result_graphs_with_exact_byte_replay",
] as const);

export const PERSONAL_FILING_FACT_NORMALIZATION_NOT_PROVEN = Object.freeze([
  "raw_payload_presence_identity_or_declared_content_digest_byte_equality",
  "sec_authenticity_complete_filing_provenance_or_amendment_discovery",
  "ixbrl_xbrl_parser_extraction_or_taxonomy_mapping_correctness",
  "free_cash_flow_accounting_definition_or_economic_interpretation_correctness",
  "unit_conversion_dimensions_aliases_fiscal_calendar_or_general_taxonomy_coverage",
  "independent_parser_validator_comparison_or_conflict_adjudication",
  "independently_adjudicated_ground_truth_precision_recall_or_quality_thresholds",
  "absence_of_amendments_or_corrections_outside_the_exact_frozen_manifest",
  "legal_rights_external_steward_approval_or_commercial_redistribution",
  "multi_user_shared_service_database_api_web_queue_or_production_readiness",
] as const);

export const PERSONAL_FILING_FACT_NORMALIZATION_LIMITS = Object.freeze({
  aggregateStringCodePoints: 65_536,
  decimalIntegerDigits: 26,
  decimalPrecision: 38,
  decimalScale: 12,
  documentDepth: 9,
  documentNodes: 768,
  factsPerDocument: 10,
  lineageEdges: 10,
  normalizationPlanBytes: 32_768,
  parserResultBytes: 131_072,
  sourceDocuments: 2,
});

export const PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES =
  Object.freeze([
    "input_invalid",
    "corpus_invalid",
    "plan_invalid",
    "source_document_invalid",
    "source_metadata_invalid",
    "fact_set_invalid",
    "derivation_invalid",
    "lineage_invalid",
    "normalization_failure",
  ] as const);

export type PersonalFilingFactNormalizationQuarantineCode =
  (typeof PERSONAL_FILING_FACT_NORMALIZATION_QUARANTINE_CODES)[number];

export interface PersonalFilingFactNormalizationInput {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly sourceDocuments: readonly Uint8Array[];
}

export interface PersonalFilingFactNormalizationAudit {
  readonly factVersionCount: number;
  readonly lineageCount: number;
  readonly outcome: "normalized" | "quarantined";
  readonly sourceDocumentCount: number;
}

export interface PersonalFilingFactDerivationOperand {
  readonly concept: string;
  readonly dimensions: Readonly<Record<string, never>>;
  readonly periodEnd: string;
  readonly periodStart: string;
  readonly unit: "USD";
  readonly value: string;
}

export interface PersonalFilingFactSubtractionDerivation {
  readonly formula: typeof PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA;
  readonly minuend: PersonalFilingFactDerivationOperand;
  readonly subtrahend: PersonalFilingFactDerivationOperand;
}

export interface PersonalNormalizedFilingFactVersion {
  readonly derivation: PersonalFilingFactSubtractionDerivation | null;
  readonly dimensions: Readonly<Record<string, never>>;
  readonly factId: `fact:sha256:${string}`;
  readonly key: PersonalFilingFactKey;
  readonly knownFrom: string;
  readonly knownToExclusive: string | null;
  readonly parserVersion: string;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly predecessorFactId: `fact:sha256:${string}` | null;
  readonly sourceAcceptedAt: string;
  readonly sourceAccession: string;
  readonly sourceAvailableAt: string;
  readonly sourceConcept: string | null;
  readonly sourceContentSha256: `sha256:${string}`;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly successorFactId: `fact:sha256:${string}` | null;
  readonly synthetic: false;
  readonly taxonomy: string;
  readonly unit: PersonalFilingFactUnit;
  readonly value: string;
}

export interface PersonalFilingFactSupersession {
  readonly effectiveAt: string;
  readonly key: PersonalFilingFactKey;
  readonly predecessorFactId: `fact:sha256:${string}`;
  readonly successorFactId: `fact:sha256:${string}`;
}

export type PersonalFilingFactLineageStatus =
  "root_only_no_in_corpus_amendment" | "amendment_supersession_observed";

export interface PersonalFilingFactNormalizationRecord {
  readonly audit: PersonalFilingFactNormalizationAudit;
  readonly claim: typeof PERSONAL_FILING_FACT_NORMALIZATION_CLAIM;
  readonly corpusId: string;
  readonly corpusVersion: string;
  readonly declarationSha256: `sha256:${string}`;
  readonly factVersions: readonly PersonalNormalizedFilingFactVersion[];
  readonly lineage: readonly PersonalFilingFactSupersession[];
  readonly lineageScope: "issuer_filing_versions_within_exact_frozen_manifest_only";
  readonly lineageStatus: PersonalFilingFactLineageStatus;
  readonly manifestSha256: `sha256:${string}`;
  readonly normalizationPlanSha256: `sha256:${string}`;
  readonly nullKnownToScope: "no_later_version_within_exact_frozen_manifest_only";
  readonly ownerCorrectionStatus: "not_modeled";
  readonly schemaVersion: typeof PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION;
  readonly sourceDocumentSha256s: readonly `sha256:${string}`[];
  readonly status: "normalized_for_personal_use";
  readonly synthetic: false;
}

export interface PersonalFilingFactNormalizationQuarantinedResult {
  readonly audit: PersonalFilingFactNormalizationAudit;
  readonly claim: typeof PERSONAL_FILING_FACT_NORMALIZATION_CLAIM;
  readonly code: PersonalFilingFactNormalizationQuarantineCode;
  readonly factVersions: readonly [];
  readonly lineage: readonly [];
  readonly schemaVersion: typeof PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: false;
}

export type PersonalFilingFactNormalizationResult =
  | PersonalFilingFactNormalizationQuarantinedResult
  | PersonalFilingFactNormalizationRecord;

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly sourceDocuments: readonly Uint8Array[];
}

interface ManifestEntry {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly cik: string;
  readonly contentSha256: `sha256:${string}`;
  readonly form: "10-K" | "10-K/A";
  readonly taxonomy: string;
}

interface DirectPlanMapping {
  readonly key: Exclude<PersonalFilingFactKey, "free_cash_flow">;
  readonly kind: "direct";
  readonly periodKind: PersonalFilingFactPeriodKind;
  readonly sourceConcept: string;
  readonly unit: PersonalFilingFactUnit;
}

interface DerivedPlanMapping {
  readonly formula: typeof PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA;
  readonly key: "free_cash_flow";
  readonly kind: "subtraction";
  readonly minuendConcept: string;
  readonly periodKind: "duration";
  readonly subtrahendConcept: string;
  readonly unit: "USD";
}

type PlanMapping = DirectPlanMapping | DerivedPlanMapping;

interface NormalizationPlan {
  readonly mappings: readonly PlanMapping[];
  readonly parserVersion: string;
  readonly planSha256: `sha256:${string}`;
  readonly taxonomy: string;
}

interface SourceOperand {
  readonly concept: string;
  readonly periodEnd: string;
  readonly periodStart: string;
  readonly unit: "USD";
  readonly value: string;
}

interface SourceFact {
  readonly derivation: {
    readonly minuend: SourceOperand;
    readonly subtrahend: SourceOperand;
  } | null;
  readonly key: PersonalFilingFactKey;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly sourceConcept: string | null;
  readonly unit: PersonalFilingFactUnit;
  readonly value: string;
}

interface SourceDocument {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly cik: string;
  readonly contentSha256: `sha256:${string}`;
  readonly documentSha256: `sha256:${string}`;
  readonly facts: readonly SourceFact[];
  readonly form: "10-K" | "10-K/A";
}

class QuarantineSignal extends Error {
  public constructor(
    public readonly code: PersonalFilingFactNormalizationQuarantineCode,
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
const PLAN_KEYS = [
  "corpusId",
  "corpusVersion",
  "declarationSha256",
  "manifestSha256",
  "mappings",
  "parserVersion",
  "profile",
  "schemaVersion",
  "taxonomy",
] as const;
const DIRECT_MAPPING_KEYS = [
  "key",
  "kind",
  "periodKind",
  "sourceConcept",
  "unit",
] as const;
const DERIVED_MAPPING_KEYS = [
  "formula",
  "key",
  "kind",
  "minuendConcept",
  "periodKind",
  "subtrahendConcept",
  "unit",
] as const;
const SOURCE_DOCUMENT_KEYS = [
  "accession",
  "acceptedAt",
  "amendmentOf",
  "availableAt",
  "cik",
  "contentSha256",
  "facts",
  "form",
  "normalizationPlanSha256",
  "parserVersion",
  "schemaVersion",
  "synthetic",
  "taxonomy",
] as const;
const SOURCE_FACT_KEYS = [
  "concept",
  "derivation",
  "dimensions",
  "key",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const DERIVATION_KEYS = ["formula", "minuend", "subtrahend"] as const;
const OPERAND_KEYS = [
  "concept",
  "dimensions",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const SAFE_PARSER_VERSION = /^[a-z][a-z0-9._-]{2,63}$/u;
const SAFE_TAXONOMY = /^[a-z][a-z0-9.-]{2,63}$/u;
const QNAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}:[A-Za-z_][A-Za-z0-9_.-]{0,127}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const FACT_ID_DOMAIN = new TextEncoder().encode(
  "research-cockpit:personal-normalized-filing-fact:v1\u0000",
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

export function normalizePersonalFilingFacts(
  input: PersonalFilingFactNormalizationInput,
): PersonalFilingFactNormalizationResult {
  try {
    if (arguments.length !== 1) quarantine("input_invalid");
    const snapshot = snapshotInput(input);
    const corpus = verifyCorpus(snapshot);
    const manifestEntries = parseClosedManifest(snapshot.manifest);
    const plan = parsePlan(snapshot.normalizationPlan, {
      corpusId: corpus.corpusId,
      corpusVersion: corpus.corpusVersion,
      declarationSha256: corpus.declarationSha256,
      manifestEntries,
      manifestSha256: corpus.manifestSha256,
    });
    if (snapshot.sourceDocuments.length !== manifestEntries.length) {
      quarantine("source_metadata_invalid");
    }
    const documents = snapshot.sourceDocuments.map((bytes, index) => {
      const entry = manifestEntries[index];
      if (entry === undefined) quarantine("source_metadata_invalid");
      return parseSourceDocument(bytes, entry, plan);
    });
    validateSourceSet(documents);
    return normalizedResult(
      {
        corpusId: corpus.corpusId,
        corpusVersion: corpus.corpusVersion,
        declarationSha256: corpus.declarationSha256,
        manifestSha256: corpus.manifestSha256,
      },
      plan,
      documents,
    );
  } catch (error) {
    return quarantinedResult(
      error instanceof QuarantineSignal ? error.code : "normalization_failure",
    );
  }
}

function snapshotInput(value: unknown): InputSnapshot {
  try {
    if (isProxy(value)) quarantine("input_invalid");
    const descriptors = exactDataDescriptors(value, INPUT_KEYS);
    if (descriptors === undefined) quarantine("input_invalid");
    return Object.freeze({
      declaration: byteSnapshot(
        descriptors.declaration?.value,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
        "input_invalid",
      ),
      manifest: byteSnapshot(
        descriptors.manifest?.value,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
        "input_invalid",
      ),
      normalizationPlan: byteSnapshot(
        descriptors.normalizationPlan?.value,
        PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.normalizationPlanBytes,
        "input_invalid",
      ),
      sourceDocuments: snapshotDocumentArray(
        descriptors.sourceDocuments?.value,
      ),
    });
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function snapshotDocumentArray(value: unknown): readonly Uint8Array[] {
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
      rawLength > PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.sourceDocuments
    ) {
      quarantine("input_invalid");
    }
    const length = rawLength;
    const expectedKeys = [
      ...Array.from({ length }, (_, index) => String(index)),
      "length",
    ];
    if (!exactKeys(Reflect.ownKeys(value), expectedKeys)) {
      quarantine("input_invalid");
    }
    const snapshots = Array.from({ length }, (_, index) => {
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
        "input_invalid",
      );
    });
    return Object.freeze(snapshots);
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("input_invalid");
  }
}

function byteSnapshot(
  value: unknown,
  maximumBytes: number,
  code: PersonalFilingFactNormalizationQuarantineCode,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null || isProxy(value)) {
      quarantine(code);
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
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      quarantine(code);
    }
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine(code);
  }
}

function verifyCorpus(snapshot: InputSnapshot) {
  try {
    return verifyPersonalFilingCorpusManifest({
      declaration: snapshot.declaration,
      manifest: snapshot.manifest,
    });
  } catch (error) {
    if (error instanceof PersonalFilingCorpusError) {
      quarantine("corpus_invalid");
    }
    quarantine("corpus_invalid");
  }
}

function parseClosedManifest(bytes: Uint8Array): readonly ManifestEntry[] {
  try {
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    ) as unknown;
    if (!isPlainRecord(parsed) || !Array.isArray(parsed.entries)) {
      quarantine("corpus_invalid");
    }
    if (parsed.entries.length < 1 || parsed.entries.length > 2) {
      quarantine("source_metadata_invalid");
    }
    const entries = parsed.entries.map((raw) => {
      if (!isPlainRecord(raw)) quarantine("corpus_invalid");
      if (
        typeof raw.accession !== "string" ||
        typeof raw.acceptedAt !== "string" ||
        (raw.amendmentOf !== null && typeof raw.amendmentOf !== "string") ||
        typeof raw.availableAt !== "string" ||
        typeof raw.cik !== "string" ||
        typeof raw.contentSha256 !== "string" ||
        !SHA256.test(raw.contentSha256) ||
        (raw.form !== "10-K" && raw.form !== "10-K/A") ||
        typeof raw.taxonomy !== "string"
      ) {
        quarantine("source_metadata_invalid");
      }
      return Object.freeze({
        accession: raw.accession,
        acceptedAt: raw.acceptedAt,
        amendmentOf: raw.amendmentOf,
        availableAt: raw.availableAt,
        cik: raw.cik,
        contentSha256: raw.contentSha256 as `sha256:${string}`,
        form: raw.form,
        taxonomy: raw.taxonomy,
      });
    });
    const root = entries[0];
    const amendment = entries[1];
    if (
      root === undefined ||
      root.form !== "10-K" ||
      root.amendmentOf !== null ||
      (amendment !== undefined &&
        (amendment.form !== "10-K/A" ||
          amendment.amendmentOf !== root.accession ||
          amendment.cik !== root.cik))
    ) {
      quarantine("source_metadata_invalid");
    }
    return Object.freeze(entries);
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("corpus_invalid");
  }
}

function parsePlan(
  bytes: Uint8Array,
  expected: {
    readonly corpusId: string;
    readonly corpusVersion: string;
    readonly declarationSha256: `sha256:${string}`;
    readonly manifestEntries: readonly ManifestEntry[];
    readonly manifestSha256: `sha256:${string}`;
  },
): NormalizationPlan {
  const record = exactRecord(
    parseCanonicalDocument(bytes, "plan_invalid"),
    PLAN_KEYS,
    "plan_invalid",
  );
  const taxonomy = expected.manifestEntries[0]?.taxonomy;
  if (
    record.schemaVersion !==
      PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION ||
    record.profile !== PERSONAL_FILING_CORPUS_PROFILE ||
    record.corpusId !== expected.corpusId ||
    record.corpusVersion !== expected.corpusVersion ||
    record.declarationSha256 !== expected.declarationSha256 ||
    record.manifestSha256 !== expected.manifestSha256 ||
    typeof record.parserVersion !== "string" ||
    !SAFE_PARSER_VERSION.test(record.parserVersion) ||
    typeof record.taxonomy !== "string" ||
    !SAFE_TAXONOMY.test(record.taxonomy) ||
    record.taxonomy !== taxonomy ||
    expected.manifestEntries.some(
      (entry) => entry.taxonomy !== record.taxonomy,
    ) ||
    !Array.isArray(record.mappings) ||
    record.mappings.length !== PERSONAL_FILING_FACT_KEYS.length
  ) {
    quarantine("plan_invalid");
  }
  const mappings = record.mappings.map((value, index) =>
    parsePlanMapping(value, index),
  );
  const operatingCashFlow = mappings[7];
  const freeCashFlow = mappings[4];
  const directConcepts = mappings.flatMap((mapping) =>
    mapping.kind === "direct" ? [mapping.sourceConcept] : [],
  );
  if (
    operatingCashFlow === undefined ||
    operatingCashFlow.kind !== "direct" ||
    freeCashFlow === undefined ||
    freeCashFlow.kind !== "subtraction" ||
    freeCashFlow.minuendConcept !== operatingCashFlow.sourceConcept ||
    freeCashFlow.subtrahendConcept === freeCashFlow.minuendConcept ||
    new Set(directConcepts).size !== directConcepts.length ||
    directConcepts.includes(freeCashFlow.subtrahendConcept)
  ) {
    quarantine("plan_invalid");
  }
  return Object.freeze({
    mappings: Object.freeze(mappings),
    parserVersion: record.parserVersion,
    planSha256: sha256(bytes),
    taxonomy: record.taxonomy,
  });
}

function parsePlanMapping(value: unknown, index: number): PlanMapping {
  const contract = PERSONAL_FILING_FACT_CONTRACTS[index];
  if (contract === undefined) quarantine("plan_invalid");
  if (contract.key === "free_cash_flow") {
    const record = exactRecord(value, DERIVED_MAPPING_KEYS, "plan_invalid");
    if (
      record.key !== contract.key ||
      record.kind !== "subtraction" ||
      record.formula !== PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA ||
      record.periodKind !== contract.periodKind ||
      record.unit !== contract.unit ||
      typeof record.minuendConcept !== "string" ||
      !QNAME.test(record.minuendConcept) ||
      typeof record.subtrahendConcept !== "string" ||
      !QNAME.test(record.subtrahendConcept)
    ) {
      quarantine("plan_invalid");
    }
    return Object.freeze({
      formula: PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
      key: "free_cash_flow",
      kind: "subtraction",
      minuendConcept: record.minuendConcept,
      periodKind: "duration",
      subtrahendConcept: record.subtrahendConcept,
      unit: "USD",
    });
  }
  const record = exactRecord(value, DIRECT_MAPPING_KEYS, "plan_invalid");
  if (
    record.key !== contract.key ||
    record.kind !== "direct" ||
    record.periodKind !== contract.periodKind ||
    record.unit !== contract.unit ||
    typeof record.sourceConcept !== "string" ||
    !QNAME.test(record.sourceConcept)
  ) {
    quarantine("plan_invalid");
  }
  return Object.freeze({
    key: contract.key,
    kind: "direct",
    periodKind: contract.periodKind,
    sourceConcept: record.sourceConcept,
    unit: contract.unit,
  });
}

function parseSourceDocument(
  bytes: Uint8Array,
  manifest: ManifestEntry,
  plan: NormalizationPlan,
): SourceDocument {
  const record = exactRecord(
    parseCanonicalDocument(bytes, "source_document_invalid"),
    SOURCE_DOCUMENT_KEYS,
    "source_document_invalid",
  );
  if (
    record.schemaVersion !==
      PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION ||
    record.synthetic !== false ||
    record.accession !== manifest.accession ||
    record.cik !== manifest.cik ||
    record.form !== manifest.form ||
    record.amendmentOf !== manifest.amendmentOf ||
    record.acceptedAt !== manifest.acceptedAt ||
    record.availableAt !== manifest.availableAt ||
    record.contentSha256 !== manifest.contentSha256 ||
    record.parserVersion !== plan.parserVersion ||
    record.taxonomy !== plan.taxonomy ||
    record.normalizationPlanSha256 !== plan.planSha256
  ) {
    quarantine("source_metadata_invalid");
  }
  if (
    !Array.isArray(record.facts) ||
    record.facts.length !==
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument
  ) {
    quarantine("fact_set_invalid");
  }
  const facts = record.facts.map((fact, index) =>
    parseSourceFact(fact, index, plan),
  );
  validateDocumentFactContext(facts, manifest.acceptedAt);
  return Object.freeze({
    accession: manifest.accession,
    acceptedAt: manifest.acceptedAt,
    amendmentOf: manifest.amendmentOf,
    availableAt: manifest.availableAt,
    cik: manifest.cik,
    contentSha256: manifest.contentSha256,
    documentSha256: sha256(bytes),
    facts: Object.freeze(facts),
    form: manifest.form,
  });
}

function parseSourceFact(
  value: unknown,
  index: number,
  plan: NormalizationPlan,
): SourceFact {
  const record = exactRecord(value, SOURCE_FACT_KEYS, "fact_set_invalid");
  const contract = PERSONAL_FILING_FACT_CONTRACTS[index];
  const mapping = plan.mappings[index];
  if (
    contract === undefined ||
    mapping === undefined ||
    record.key !== contract.key ||
    record.unit !== contract.unit ||
    !isEmptyRecord(record.dimensions) ||
    typeof record.periodEnd !== "string" ||
    !isIsoDate(record.periodEnd) ||
    typeof record.value !== "string" ||
    !isCanonicalDecimal(record.value)
  ) {
    quarantine("fact_set_invalid");
  }
  const periodStart = parsePeriodStart(
    record.periodStart,
    contract.periodKind,
    record.periodEnd,
  );
  if (mapping.kind === "direct") {
    if (
      record.concept !== mapping.sourceConcept ||
      record.derivation !== null
    ) {
      quarantine("fact_set_invalid");
    }
    return Object.freeze({
      derivation: null,
      key: contract.key,
      periodEnd: record.periodEnd,
      periodStart,
      sourceConcept: mapping.sourceConcept,
      unit: contract.unit,
      value: record.value,
    });
  }
  if (record.concept !== null) quarantine("derivation_invalid");
  const derivation = exactRecord(
    record.derivation,
    DERIVATION_KEYS,
    "derivation_invalid",
  );
  if (derivation.formula !== PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA) {
    quarantine("derivation_invalid");
  }
  const minuend = parseOperand(
    derivation.minuend,
    mapping.minuendConcept,
    record.periodEnd,
    periodStart,
  );
  const subtrahend = parseOperand(
    derivation.subtrahend,
    mapping.subtrahendConcept,
    record.periodEnd,
    periodStart,
  );
  if (
    subtractCanonicalDecimals(minuend.value, subtrahend.value) !== record.value
  ) {
    quarantine("derivation_invalid");
  }
  return Object.freeze({
    derivation: Object.freeze({ minuend, subtrahend }),
    key: "free_cash_flow",
    periodEnd: record.periodEnd,
    periodStart,
    sourceConcept: null,
    unit: "USD",
    value: record.value,
  });
}

function parseOperand(
  value: unknown,
  concept: string,
  periodEnd: string,
  periodStart: string | null,
): SourceOperand {
  const record = exactRecord(value, OPERAND_KEYS, "derivation_invalid");
  if (
    periodStart === null ||
    record.concept !== concept ||
    !isEmptyRecord(record.dimensions) ||
    record.periodEnd !== periodEnd ||
    record.periodStart !== periodStart ||
    record.unit !== "USD" ||
    typeof record.value !== "string" ||
    !isCanonicalDecimal(record.value)
  ) {
    quarantine("derivation_invalid");
  }
  return Object.freeze({
    concept,
    periodEnd,
    periodStart,
    unit: "USD",
    value: record.value,
  });
}

function parsePeriodStart(
  value: unknown,
  periodKind: PersonalFilingFactPeriodKind,
  periodEnd: string,
): string | null {
  if (periodKind === "instant") {
    if (value !== null) quarantine("fact_set_invalid");
    return null;
  }
  if (typeof value !== "string" || !isIsoDate(value) || value >= periodEnd) {
    quarantine("fact_set_invalid");
  }
  return value;
}

function validateDocumentFactContext(
  facts: readonly SourceFact[],
  acceptedAt: string,
): void {
  const instant = facts[0];
  const duration = facts[3];
  const operatingCashFlow = facts[7];
  const freeCashFlow = facts[4];
  if (
    instant === undefined ||
    duration === undefined ||
    operatingCashFlow === undefined ||
    freeCashFlow === undefined ||
    instant.periodStart !== null ||
    duration.periodStart === null ||
    instant.periodEnd !== duration.periodEnd ||
    instant.periodEnd >= acceptedAt.slice(0, 10) ||
    freeCashFlow.derivation === null ||
    freeCashFlow.derivation.minuend.value !== operatingCashFlow.value ||
    freeCashFlow.derivation.minuend.concept !== operatingCashFlow.sourceConcept
  ) {
    quarantine("derivation_invalid");
  }
  for (let index = 0; index < facts.length; index += 1) {
    const fact = facts[index];
    const contract = PERSONAL_FILING_FACT_CONTRACTS[index];
    if (
      fact === undefined ||
      contract === undefined ||
      fact.periodEnd !== instant.periodEnd ||
      (contract.periodKind === "instant"
        ? fact.periodStart !== null
        : fact.periodStart !== duration.periodStart)
    ) {
      quarantine("fact_set_invalid");
    }
  }
}

function validateSourceSet(documents: readonly SourceDocument[]): void {
  const original = documents[0];
  const amendment = documents[1];
  if (
    original === undefined ||
    original.form !== "10-K" ||
    original.amendmentOf !== null
  ) {
    quarantine("lineage_invalid");
  }
  if (amendment === undefined) return;
  if (
    amendment.form !== "10-K/A" ||
    amendment.amendmentOf !== original.accession ||
    amendment.cik !== original.cik ||
    original.availableAt >= amendment.availableAt ||
    original.contentSha256 === amendment.contentSha256
  ) {
    quarantine("lineage_invalid");
  }
  for (let index = 0; index < PERSONAL_FILING_FACT_KEYS.length; index += 1) {
    const predecessor = original.facts[index];
    const successor = amendment.facts[index];
    if (
      predecessor === undefined ||
      successor === undefined ||
      predecessor.key !== successor.key ||
      predecessor.periodStart !== successor.periodStart ||
      predecessor.periodEnd !== successor.periodEnd
    ) {
      quarantine("lineage_invalid");
    }
  }
}

function normalizedResult(
  corpus: {
    readonly corpusId: string;
    readonly corpusVersion: string;
    readonly declarationSha256: `sha256:${string}`;
    readonly manifestSha256: `sha256:${string}`;
  },
  plan: NormalizationPlan,
  documents: readonly SourceDocument[],
): PersonalFilingFactNormalizationRecord {
  const original = documents[0];
  if (original === undefined) quarantine("normalization_failure");
  const amendment = documents[1];
  const predecessorIds = original.facts.map((fact) =>
    normalizedFactId(plan, original, fact),
  );
  const successorIds =
    amendment === undefined
      ? undefined
      : amendment.facts.map((fact) => normalizedFactId(plan, amendment, fact));
  const predecessors = original.facts.map((fact, index) =>
    normalizedFactVersion(
      plan,
      original,
      fact,
      predecessorIds[index] as `fact:sha256:${string}`,
      null,
      successorIds?.[index] ?? null,
      amendment?.availableAt ?? null,
    ),
  );
  const successors =
    amendment === undefined || successorIds === undefined
      ? []
      : amendment.facts.map((fact, index) =>
          normalizedFactVersion(
            plan,
            amendment,
            fact,
            successorIds[index] as `fact:sha256:${string}`,
            predecessorIds[index] as `fact:sha256:${string}`,
            null,
            null,
          ),
        );
  const lineage =
    amendment === undefined || successorIds === undefined
      ? []
      : PERSONAL_FILING_FACT_KEYS.map((key, index) =>
          Object.freeze({
            effectiveAt: amendment.availableAt,
            key,
            predecessorFactId: predecessorIds[index] as `fact:sha256:${string}`,
            successorFactId: successorIds[index] as `fact:sha256:${string}`,
          }),
        );
  const factVersions = Object.freeze([...predecessors, ...successors]);
  return Object.freeze({
    audit: Object.freeze({
      factVersionCount: factVersions.length,
      lineageCount: lineage.length,
      outcome: "normalized" as const,
      sourceDocumentCount: documents.length,
    }),
    claim: PERSONAL_FILING_FACT_NORMALIZATION_CLAIM,
    corpusId: corpus.corpusId,
    corpusVersion: corpus.corpusVersion,
    declarationSha256: corpus.declarationSha256,
    factVersions,
    lineage: Object.freeze(lineage),
    lineageScope: "issuer_filing_versions_within_exact_frozen_manifest_only",
    lineageStatus:
      amendment === undefined
        ? ("root_only_no_in_corpus_amendment" as const)
        : ("amendment_supersession_observed" as const),
    manifestSha256: corpus.manifestSha256,
    normalizationPlanSha256: plan.planSha256,
    nullKnownToScope: "no_later_version_within_exact_frozen_manifest_only",
    ownerCorrectionStatus: "not_modeled",
    schemaVersion: PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    sourceDocumentSha256s: Object.freeze(
      documents.map((document) => document.documentSha256),
    ),
    status: "normalized_for_personal_use",
    synthetic: false,
  });
}

function normalizedFactVersion(
  plan: NormalizationPlan,
  document: SourceDocument,
  fact: SourceFact,
  factId: `fact:sha256:${string}`,
  predecessorFactId: `fact:sha256:${string}` | null,
  successorFactId: `fact:sha256:${string}` | null,
  knownToExclusive: string | null,
): PersonalNormalizedFilingFactVersion {
  return Object.freeze({
    derivation:
      fact.derivation === null
        ? null
        : Object.freeze({
            formula: PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
            minuend: normalizedOperand(fact.derivation.minuend),
            subtrahend: normalizedOperand(fact.derivation.subtrahend),
          }),
    dimensions: Object.freeze({}),
    factId,
    key: fact.key,
    knownFrom: document.availableAt,
    knownToExclusive,
    parserVersion: plan.parserVersion,
    periodEnd: fact.periodEnd,
    periodStart: fact.periodStart,
    predecessorFactId,
    sourceAcceptedAt: document.acceptedAt,
    sourceAccession: document.accession,
    sourceAvailableAt: document.availableAt,
    sourceConcept: fact.sourceConcept,
    sourceContentSha256: document.contentSha256,
    sourceDocumentSha256: document.documentSha256,
    successorFactId,
    synthetic: false,
    taxonomy: plan.taxonomy,
    unit: fact.unit,
    value: fact.value,
  });
}

function normalizedOperand(
  operand: SourceOperand,
): PersonalFilingFactDerivationOperand {
  return Object.freeze({
    concept: operand.concept,
    dimensions: Object.freeze({}),
    periodEnd: operand.periodEnd,
    periodStart: operand.periodStart,
    unit: "USD",
    value: operand.value,
  });
}

function normalizedFactId(
  plan: NormalizationPlan,
  document: SourceDocument,
  fact: SourceFact,
): `fact:sha256:${string}` {
  const payload = new TextEncoder().encode(
    canonicalJson({
      accession: document.accession,
      acceptedAt: document.acceptedAt,
      amendmentOf: document.amendmentOf,
      availableAt: document.availableAt,
      contentSha256: document.contentSha256,
      derivation: fact.derivation,
      documentSha256: document.documentSha256,
      key: fact.key,
      normalizationPlanSha256: plan.planSha256,
      periodEnd: fact.periodEnd,
      periodStart: fact.periodStart,
      sourceConcept: fact.sourceConcept,
      taxonomy: plan.taxonomy,
      unit: fact.unit,
      value: fact.value,
    }),
  );
  return `fact:sha256:${createHash("sha256")
    .update(FACT_ID_DOMAIN)
    .update(payload)
    .digest("hex")}`;
}

function quarantinedResult(
  code: PersonalFilingFactNormalizationQuarantineCode,
): PersonalFilingFactNormalizationQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      factVersionCount: 0,
      lineageCount: 0,
      outcome: "quarantined" as const,
      sourceDocumentCount: 0,
    }),
    claim: PERSONAL_FILING_FACT_NORMALIZATION_CLAIM,
    code,
    factVersions: Object.freeze([] as const),
    lineage: Object.freeze([] as const),
    schemaVersion: PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: false as const,
  });
}

function parseCanonicalDocument(
  bytes: Uint8Array,
  code: PersonalFilingFactNormalizationQuarantineCode,
): unknown {
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    parsed = JSON.parse(text) as unknown;
  } catch {
    quarantine(code);
  }
  validateCanonicalTree(parsed, code);
  if (`${canonicalJson(parsed)}\n` !== text) quarantine(code);
  return parsed;
}

function validateCanonicalTree(
  value: unknown,
  code: PersonalFilingFactNormalizationQuarantineCode,
): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) quarantine(code);
    nodes += 1;
    if (
      nodes > PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.documentNodes ||
      entry.depth > PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.documentDepth
    ) {
      quarantine(code);
    }
    if (typeof entry.value === "string") {
      stringCodePoints += [...entry.value].length;
    } else if (
      entry.value === null ||
      typeof entry.value === "boolean" ||
      (typeof entry.value === "number" && Number.isSafeInteger(entry.value))
    ) {
      // Canonical primitives are bounded by the byte limit.
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
      quarantine(code);
    }
    if (
      stringCodePoints >
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.aggregateStringCodePoints
    ) {
      quarantine(code);
    }
  }
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
  code: PersonalFilingFactNormalizationQuarantineCode,
): Record<TKeys[number], unknown> {
  if (!isPlainRecord(value) || !exactKeys(Object.keys(value), expectedKeys)) {
    quarantine(code);
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

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function subtractCanonicalDecimals(
  minuend: string,
  subtrahend: string,
): string {
  const left = decimalParts(minuend);
  const right = decimalParts(subtrahend);
  const scale = Math.max(left.scale, right.scale);
  const result =
    left.coefficient * 10n ** BigInt(scale - left.scale) -
    right.coefficient * 10n ** BigInt(scale - right.scale);
  const formatted = formatDecimal(result, scale);
  if (!isCanonicalDecimal(formatted)) quarantine("derivation_invalid");
  return formatted;
}

function decimalParts(value: string): {
  readonly coefficient: bigint;
  readonly scale: number;
} {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "", fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${integer}${fraction}`);
  return {
    coefficient: negative ? -coefficient : coefficient,
    scale: fraction.length,
  };
}

function formatDecimal(coefficient: bigint, scale: number): string {
  if (coefficient === 0n) return "0";
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient)
    .toString()
    .padStart(scale + 1, "0");
  if (scale === 0) return `${negative ? "-" : ""}${digits}`;
  const integer = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${integer}${
    fraction.length === 0 ? "" : `.${fraction}`
  }`;
}

function isCanonicalDecimal(value: string): boolean {
  if (!DECIMAL.test(value) || value === "-0") return false;
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const [integer = "", fraction = ""] = unsigned.split(".");
  return (
    integer.length <=
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.decimalIntegerDigits &&
    fraction.length <= PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.decimalScale &&
    integer.length + fraction.length <=
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.decimalPrecision
  );
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString() === `${value}T00:00:00.000Z`
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
  if (!isPlainRecord(value)) quarantine("normalization_failure");
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function quarantine(
  code: PersonalFilingFactNormalizationQuarantineCode,
): never {
  throw new QuarantineSignal(code);
}
