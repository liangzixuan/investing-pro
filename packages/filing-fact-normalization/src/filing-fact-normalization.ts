import { createHash } from "node:crypto";

export const FILING_FACT_NORMALIZATION_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_FACT_NORMALIZATION_CLAIM =
  "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage" as const;
export const FILING_FACT_PARSER_VERSION =
  "synthetic-ten-fact-producer-v1" as const;
export const FILING_FACT_TAXONOMY_FAMILY = "rc-synthetic-ten-fact" as const;
export const FILING_FACT_TAXONOMY_VERSION = "1.0.0" as const;

export const FILING_FACT_KEYS = Object.freeze([
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

export type FilingFactKey = (typeof FILING_FACT_KEYS)[number];
export type FilingFactUnit = "USD" | "shares";
export type FilingFactPeriodKind = "duration" | "instant";

export interface FilingFactContract {
  readonly key: FilingFactKey;
  readonly periodKind: FilingFactPeriodKind;
  readonly sourceConcept: string;
  readonly unit: FilingFactUnit;
}

export const FILING_FACT_CONTRACTS: readonly FilingFactContract[] =
  Object.freeze(
    (
      [
        {
          key: "assets",
          periodKind: "instant",
          sourceConcept: "rc-synthetic:Assets",
          unit: "USD",
        },
        {
          key: "cash",
          periodKind: "instant",
          sourceConcept: "rc-synthetic:CashAndCashEquivalents",
          unit: "USD",
        },
        {
          key: "debt",
          periodKind: "instant",
          sourceConcept: "rc-synthetic:Debt",
          unit: "USD",
        },
        {
          key: "diluted_shares",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:WeightedAverageDilutedShares",
          unit: "shares",
        },
        {
          key: "free_cash_flow",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:FreeCashFlow",
          unit: "USD",
        },
        {
          key: "gross_profit",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:GrossProfit",
          unit: "USD",
        },
        {
          key: "net_income",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:NetIncome",
          unit: "USD",
        },
        {
          key: "operating_cash_flow",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:OperatingCashFlow",
          unit: "USD",
        },
        {
          key: "operating_income",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:OperatingIncome",
          unit: "USD",
        },
        {
          key: "revenue",
          periodKind: "duration",
          sourceConcept: "rc-synthetic:Revenue",
          unit: "USD",
        },
      ] as const satisfies readonly FilingFactContract[]
    ).map((contract) => Object.freeze(contract)),
  );

export const FILING_FACT_NORMALIZATION_CHECKS = Object.freeze([
  "exact_two_document_original_and_amendment_synthetic_fixture",
  "exact_ten_launch_fact_keys_once_per_document",
  "owned_bounded_canonical_json_byte_snapshot_and_duplicate_key_rejection",
  "closed_accession_form_entity_source_hash_parser_and_taxonomy_metadata",
  "strict_decimal_string_precision_scale_and_no_binary_float",
  "fact_key_unit_instant_duration_period_and_dimension_contract",
  "accepted_available_and_report_period_time_ordering",
  "amendment_predecessor_entity_form_period_and_later_publication_binding",
  "derived_fact_identity_and_single_predecessor_acyclic_supersession",
  "half_open_known_windows_and_pre_post_as_known_projection",
  "unchanged_and_changed_fact_versions_preserve_source_lineage",
  "missing_duplicate_ambiguous_fork_cycle_and_cross_context_rejection",
  "whole_document_pair_atomic_normalization_or_empty_quarantine",
  "exact_byte_replay_determinism_owned_input_snapshot_and_buffer_mutation_safety",
  "aggregate_value_free_quarantine_error_and_ci_output_canary_absence",
  "no_network_raw_parser_custody_corpus_database_api_web_queue_and_cycle2a_cycle2c_schema_check_nonclaim_source_set_artifact_preservation",
] as const);

export const FILING_FACT_NORMALIZATION_NOT_PROVEN = Object.freeze([
  "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
  "real_filing_raw_payload_identity_digest_equality_or_sec_source_authenticity",
  "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
  "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
  "xml_xbrl_ixbrl_parser_worker_or_general_taxonomy_plugin_correctness",
  "raw_payload_custody_retention_kms_backup_deletion_or_cryptographic_erasure",
  "independent_dual_parser_validator_or_cross_engine_conflict_quarantine",
  "independently_adjudicated_ground_truth_or_2000_assertions",
  "precision_recall_document_success_quality_thresholds_or_zero_silent_failures",
  "general_concept_alias_unit_conversion_dimensions_or_fiscal_calendar_coverage",
  "real_amendment_completeness_correction_discovery_or_sec_restated_status",
  "multi_issuer_multi_document_batch_streaming_concurrency_retry_or_crash_recovery",
  "derived_metrics_formulas_evidence_passports_rights_projection_or_valuation",
  "database_api_web_queue_persistence_or_b15_v15_composition",
  "production_identity_secrets_network_load_slo_operations_or_incident_recovery",
  "real_data_admission_full_cycle2_exit_or_production_use",
] as const);

export const FILING_FACT_NORMALIZATION_LIMITS = Object.freeze({
  aggregateStringCodePoints: 65_536,
  decimalIntegerDigits: 26,
  decimalPrecision: 38,
  decimalScale: 12,
  documentBytes: 131_072,
  documentDepth: 8,
  documentNodes: 512,
  documents: 2,
  factVersions: 20,
  factsPerDocument: 10,
  lineageEdges: 10,
});

export const FILING_FACT_NORMALIZATION_QUARANTINE_CODES = Object.freeze([
  "document_invalid",
  "source_metadata_invalid",
  "fact_set_invalid",
  "lineage_invalid",
  "normalization_failure",
] as const);

export type FilingFactNormalizationQuarantineCode =
  (typeof FILING_FACT_NORMALIZATION_QUARANTINE_CODES)[number];

export interface FilingFactNormalizationAudit {
  readonly factVersionCount: number;
  readonly lineageCount: number;
  readonly outcome: "normalized" | "quarantined";
}

export interface NormalizedFilingFactVersion {
  readonly dimensions: Readonly<Record<string, never>>;
  readonly factId: `fact:sha256:${string}`;
  readonly key: FilingFactKey;
  readonly knownFrom: string;
  readonly knownToExclusive: string | null;
  readonly parserVersion: typeof FILING_FACT_PARSER_VERSION;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly predecessorFactId: `fact:sha256:${string}` | null;
  readonly sourceAcceptedAt: string;
  readonly sourceAccession: string;
  readonly sourceAvailableAt: string;
  readonly sourceConcept: string;
  readonly sourceContentSha256: `sha256:${string}`;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly successorFactId: `fact:sha256:${string}` | null;
  readonly synthetic: true;
  readonly taxonomyFamily: typeof FILING_FACT_TAXONOMY_FAMILY;
  readonly taxonomyVersion: typeof FILING_FACT_TAXONOMY_VERSION;
  readonly unit: FilingFactUnit;
  readonly value: string;
}

export interface FilingFactSupersession {
  readonly effectiveAt: string;
  readonly key: FilingFactKey;
  readonly predecessorFactId: `fact:sha256:${string}`;
  readonly successorFactId: `fact:sha256:${string}`;
}

export interface FilingFactNormalizationRecord {
  readonly amendmentDocumentSha256: `sha256:${string}`;
  readonly audit: FilingFactNormalizationAudit;
  readonly claim: typeof FILING_FACT_NORMALIZATION_CLAIM;
  readonly factVersions: readonly NormalizedFilingFactVersion[];
  readonly lineage: readonly FilingFactSupersession[];
  readonly originalDocumentSha256: `sha256:${string}`;
  readonly schemaVersion: typeof FILING_FACT_NORMALIZATION_SCHEMA_VERSION;
  readonly status: "normalized";
  readonly synthetic: true;
}

export interface FilingFactNormalizationQuarantinedResult {
  readonly audit: FilingFactNormalizationAudit;
  readonly claim: typeof FILING_FACT_NORMALIZATION_CLAIM;
  readonly code: FilingFactNormalizationQuarantineCode;
  readonly factVersions: readonly [];
  readonly lineage: readonly [];
  readonly schemaVersion: typeof FILING_FACT_NORMALIZATION_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingFactNormalizationResult =
  FilingFactNormalizationQuarantinedResult | FilingFactNormalizationRecord;

export class FilingFactProjectionError extends Error {
  public constructor() {
    super("Filing fact projection failed.");
    this.name = "FilingFactProjectionError";
  }
}

interface SourceFact {
  readonly concept: string;
  readonly key: FilingFactKey;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: FilingFactUnit;
  readonly value: string;
}

interface SourceDocument {
  readonly accession: string;
  readonly accessionIssuer: string;
  readonly accessionYear: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly contentSha256: `sha256:${string}`;
  readonly documentSha256: `sha256:${string}`;
  readonly entityId: string;
  readonly facts: readonly SourceFact[];
  readonly form: "10-K" | "10-K/A";
  readonly instrumentId: string;
}

class QuarantineSignal extends Error {
  public constructor(
    public readonly code: FilingFactNormalizationQuarantineCode,
  ) {
    super("Filing fact normalization quarantined.");
  }
}

const normalizedRecords = new WeakSet<object>();
const SOURCE_DOCUMENT_KEYS = [
  "accession",
  "acceptedAt",
  "amendmentOf",
  "availableAt",
  "contentSha256",
  "entityId",
  "facts",
  "form",
  "instrumentId",
  "parserVersion",
  "schemaVersion",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
] as const;
const SOURCE_FACT_KEYS = [
  "concept",
  "dimensions",
  "key",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ACCESSION = /^SYN-([0-9]{10})-([0-9]{2})-[0-9]{6}$/u;
const ENTITY_ID = /^entity\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}$/u;
const INSTRUMENT_ID = /^instrument\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const FACT_ID_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-normalized-filing-fact:v1\u0000",
);

export function normalizeSyntheticFilingFactPair(
  originalDocument: unknown,
  amendmentDocument: unknown,
): FilingFactNormalizationResult {
  try {
    if (arguments.length !== FILING_FACT_NORMALIZATION_LIMITS.documents) {
      quarantine("document_invalid");
    }
    const originalBytes = snapshotDocumentBytes(originalDocument);
    const amendmentBytes = snapshotDocumentBytes(amendmentDocument);
    const original = parseSourceDocument(originalBytes, "10-K");
    const amendment = parseSourceDocument(amendmentBytes, "10-K/A");
    validatePair(original, amendment);
    return normalizedResult(original, amendment);
  } catch (error) {
    return quarantinedResult(
      error instanceof QuarantineSignal ? error.code : "normalization_failure",
    );
  }
}

export function projectNormalizedFilingFactsAsKnown(
  record: FilingFactNormalizationRecord,
  knownAt: string,
): readonly NormalizedFilingFactVersion[] {
  try {
    if (
      typeof record !== "object" ||
      record === null ||
      !normalizedRecords.has(record) ||
      typeof knownAt !== "string" ||
      !isUtcInstant(knownAt)
    ) {
      throw new FilingFactProjectionError();
    }
    return Object.freeze(
      record.factVersions.filter(
        (fact) =>
          fact.knownFrom <= knownAt &&
          (fact.knownToExclusive === null || knownAt < fact.knownToExclusive),
      ),
    );
  } catch (error) {
    if (error instanceof FilingFactProjectionError) throw error;
    throw new FilingFactProjectionError();
  }
}

function snapshotDocumentBytes(value: unknown): Uint8Array {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype
    ) {
      quarantine("document_invalid");
    }
    const bytes = value as Uint8Array;
    if (
      Object.getPrototypeOf(bytes.buffer) !== ArrayBuffer.prototype ||
      bytes.byteLength === 0 ||
      bytes.byteLength > FILING_FACT_NORMALIZATION_LIMITS.documentBytes
    ) {
      quarantine("document_invalid");
    }
    return Uint8Array.prototype.slice.call(bytes);
  } catch (error) {
    if (error instanceof QuarantineSignal) throw error;
    quarantine("document_invalid");
  }
}

function parseSourceDocument(
  bytes: Uint8Array,
  expectedForm: "10-K" | "10-K/A",
): SourceDocument {
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    parsed = JSON.parse(text);
  } catch {
    quarantine("document_invalid");
  }
  validateCanonicalTree(parsed);
  if (`${canonicalJson(parsed)}\n` !== text) quarantine("document_invalid");
  const record = exactRecord(parsed, SOURCE_DOCUMENT_KEYS, "document_invalid");
  const accessionMatch =
    typeof record.accession === "string"
      ? ACCESSION.exec(record.accession)
      : null;
  if (
    record.schemaVersion !== FILING_FACT_NORMALIZATION_SCHEMA_VERSION ||
    record.synthetic !== true ||
    record.form !== expectedForm ||
    typeof record.accession !== "string" ||
    accessionMatch === null ||
    typeof record.entityId !== "string" ||
    !ENTITY_ID.test(record.entityId) ||
    typeof record.instrumentId !== "string" ||
    !INSTRUMENT_ID.test(record.instrumentId) ||
    typeof record.acceptedAt !== "string" ||
    !isUtcInstant(record.acceptedAt) ||
    typeof record.availableAt !== "string" ||
    !isUtcInstant(record.availableAt) ||
    record.acceptedAt > record.availableAt ||
    typeof record.contentSha256 !== "string" ||
    !SHA256.test(record.contentSha256) ||
    record.parserVersion !== FILING_FACT_PARSER_VERSION ||
    record.taxonomyFamily !== FILING_FACT_TAXONOMY_FAMILY ||
    record.taxonomyVersion !== FILING_FACT_TAXONOMY_VERSION ||
    (expectedForm === "10-K"
      ? record.amendmentOf !== null
      : typeof record.amendmentOf !== "string" ||
        !ACCESSION.test(record.amendmentOf))
  ) {
    quarantine("source_metadata_invalid");
  }
  const accessionIssuer = accessionMatch[1];
  const accessionYear = accessionMatch[2];
  if (
    accessionIssuer === undefined ||
    accessionYear === undefined ||
    accessionYear !== record.acceptedAt.slice(2, 4)
  ) {
    quarantine("source_metadata_invalid");
  }
  let amendmentOf: string | null;
  if (expectedForm === "10-K") {
    amendmentOf = null;
  } else {
    amendmentOf = record.amendmentOf as string;
  }
  if (
    !Array.isArray(record.facts) ||
    record.facts.length !== FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument
  ) {
    quarantine("fact_set_invalid");
  }
  const facts = record.facts.map((fact, index) => parseSourceFact(fact, index));
  return Object.freeze({
    accession: record.accession,
    accessionIssuer,
    accessionYear,
    acceptedAt: record.acceptedAt,
    amendmentOf,
    availableAt: record.availableAt,
    contentSha256: record.contentSha256 as `sha256:${string}`,
    documentSha256: sha256(bytes),
    entityId: record.entityId,
    facts: Object.freeze(facts),
    form: expectedForm,
    instrumentId: record.instrumentId,
  });
}

function parseSourceFact(value: unknown, index: number): SourceFact {
  const record = exactRecord(value, SOURCE_FACT_KEYS, "fact_set_invalid");
  const contract = FILING_FACT_CONTRACTS[index];
  if (
    contract === undefined ||
    record.key !== contract.key ||
    record.concept !== contract.sourceConcept ||
    record.unit !== contract.unit ||
    !isEmptyRecord(record.dimensions) ||
    typeof record.periodEnd !== "string" ||
    !isIsoDate(record.periodEnd) ||
    typeof record.value !== "string" ||
    !isCanonicalDecimal(record.value)
  ) {
    quarantine("fact_set_invalid");
  }
  if (
    contract.periodKind === "instant"
      ? record.periodStart !== null
      : typeof record.periodStart !== "string" ||
        !isIsoDate(record.periodStart) ||
        record.periodStart >= record.periodEnd
  ) {
    quarantine("fact_set_invalid");
  }
  return Object.freeze({
    concept: contract.sourceConcept,
    key: contract.key,
    periodEnd: record.periodEnd,
    periodStart:
      contract.periodKind === "instant" ? null : (record.periodStart as string),
    unit: contract.unit,
    value: record.value,
  });
}

function validatePair(
  original: SourceDocument,
  amendment: SourceDocument,
): void {
  if (
    original.accession === amendment.accession ||
    amendment.amendmentOf !== original.accession ||
    original.entityId !== amendment.entityId ||
    original.instrumentId !== amendment.instrumentId ||
    original.accessionIssuer !== amendment.accessionIssuer ||
    original.contentSha256 === amendment.contentSha256 ||
    original.availableAt >= amendment.acceptedAt
  ) {
    quarantine("lineage_invalid");
  }
  validateDocumentFactContext(original.facts, "lineage_invalid");
  validateDocumentFactContext(amendment.facts, "lineage_invalid");
  let changed = 0;
  let unchanged = 0;
  for (let index = 0; index < FILING_FACT_KEYS.length; index += 1) {
    const predecessor = original.facts[index];
    const successor = amendment.facts[index];
    if (
      predecessor === undefined ||
      successor === undefined ||
      predecessor.key !== successor.key ||
      predecessor.periodStart !== successor.periodStart ||
      predecessor.periodEnd !== successor.periodEnd ||
      predecessor.periodEnd >= original.acceptedAt.slice(0, 10)
    ) {
      quarantine("lineage_invalid");
    }
    if (predecessor.value === successor.value) unchanged += 1;
    else changed += 1;
  }
  if (changed === 0 || unchanged === 0) quarantine("lineage_invalid");
}

function normalizedResult(
  original: SourceDocument,
  amendment: SourceDocument,
): FilingFactNormalizationRecord {
  const predecessorIds = original.facts.map((fact) =>
    normalizedFactId(original, fact),
  );
  const successorIds = amendment.facts.map((fact) =>
    normalizedFactId(amendment, fact),
  );
  const predecessors = original.facts.map((fact, index) =>
    normalizedFactVersion(
      original,
      fact,
      predecessorIds[index] as `fact:sha256:${string}`,
      null,
      successorIds[index] as `fact:sha256:${string}`,
      amendment.availableAt,
    ),
  );
  const successors = amendment.facts.map((fact, index) =>
    normalizedFactVersion(
      amendment,
      fact,
      successorIds[index] as `fact:sha256:${string}`,
      predecessorIds[index] as `fact:sha256:${string}`,
      null,
      null,
    ),
  );
  const lineage = FILING_FACT_KEYS.map((key, index) =>
    Object.freeze({
      effectiveAt: amendment.availableAt,
      key,
      predecessorFactId: predecessorIds[index] as `fact:sha256:${string}`,
      successorFactId: successorIds[index] as `fact:sha256:${string}`,
    }),
  );
  const record = Object.freeze({
    amendmentDocumentSha256: amendment.documentSha256,
    audit: Object.freeze({
      factVersionCount: FILING_FACT_NORMALIZATION_LIMITS.factVersions,
      lineageCount: FILING_FACT_NORMALIZATION_LIMITS.lineageEdges,
      outcome: "normalized" as const,
    }),
    claim: FILING_FACT_NORMALIZATION_CLAIM,
    factVersions: Object.freeze([...predecessors, ...successors]),
    lineage: Object.freeze(lineage),
    originalDocumentSha256: original.documentSha256,
    schemaVersion: FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    status: "normalized" as const,
    synthetic: true as const,
  });
  normalizedRecords.add(record);
  return record;
}

function normalizedFactVersion(
  document: SourceDocument,
  fact: SourceFact,
  factId: `fact:sha256:${string}`,
  predecessorFactId: `fact:sha256:${string}` | null,
  successorFactId: `fact:sha256:${string}` | null,
  knownToExclusive: string | null,
): NormalizedFilingFactVersion {
  return Object.freeze({
    dimensions: Object.freeze({}),
    factId,
    key: fact.key,
    knownFrom: document.availableAt,
    knownToExclusive,
    parserVersion: FILING_FACT_PARSER_VERSION,
    periodEnd: fact.periodEnd,
    periodStart: fact.periodStart,
    predecessorFactId,
    sourceAcceptedAt: document.acceptedAt,
    sourceAccession: document.accession,
    sourceAvailableAt: document.availableAt,
    sourceConcept: fact.concept,
    sourceContentSha256: document.contentSha256,
    sourceDocumentSha256: document.documentSha256,
    successorFactId,
    synthetic: true,
    taxonomyFamily: FILING_FACT_TAXONOMY_FAMILY,
    taxonomyVersion: FILING_FACT_TAXONOMY_VERSION,
    unit: fact.unit,
    value: fact.value,
  });
}

function normalizedFactId(
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
      documentSha256: document.documentSha256,
      entityId: document.entityId,
      form: document.form,
      instrumentId: document.instrumentId,
      key: fact.key,
      periodEnd: fact.periodEnd,
      periodStart: fact.periodStart,
      parserVersion: FILING_FACT_PARSER_VERSION,
      sourceConcept: fact.concept,
      taxonomyFamily: FILING_FACT_TAXONOMY_FAMILY,
      taxonomyVersion: FILING_FACT_TAXONOMY_VERSION,
      unit: fact.unit,
      value: fact.value,
    }),
  );
  const digest = createHash("sha256")
    .update(FACT_ID_DOMAIN)
    .update(payload)
    .digest("hex");
  return `fact:sha256:${digest}`;
}

function quarantinedResult(
  code: FilingFactNormalizationQuarantineCode,
): FilingFactNormalizationQuarantinedResult {
  return Object.freeze({
    audit: Object.freeze({
      factVersionCount: 0,
      lineageCount: 0,
      outcome: "quarantined" as const,
    }),
    claim: FILING_FACT_NORMALIZATION_CLAIM,
    code,
    factVersions: Object.freeze([] as const),
    lineage: Object.freeze([] as const),
    schemaVersion: FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
  code: FilingFactNormalizationQuarantineCode,
): Record<TKeys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    quarantine(code);
  }
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    quarantine(code);
  }
  return value as Record<TKeys[number], unknown>;
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 0
  );
}

function validateCanonicalTree(value: unknown): void {
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [
    { depth: 0, value },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) quarantine("document_invalid");
    nodes += 1;
    if (
      nodes > FILING_FACT_NORMALIZATION_LIMITS.documentNodes ||
      entry.depth > FILING_FACT_NORMALIZATION_LIMITS.documentDepth
    ) {
      quarantine("document_invalid");
    }
    if (typeof entry.value === "string") {
      stringCodePoints += [...entry.value].length;
    } else if (
      entry.value === null ||
      typeof entry.value === "boolean" ||
      (typeof entry.value === "number" && Number.isSafeInteger(entry.value))
    ) {
      // Canonical JSON primitives are bounded by the byte limit.
    } else if (Array.isArray(entry.value)) {
      for (const item of entry.value) {
        stack.push({ depth: entry.depth + 1, value: item });
      }
    } else if (
      typeof entry.value === "object" &&
      entry.value !== null &&
      Object.getPrototypeOf(entry.value) === Object.prototype
    ) {
      for (const [key, item] of Object.entries(entry.value)) {
        stringCodePoints += [...key].length;
        stack.push({ depth: entry.depth + 1, value: item });
      }
    } else {
      quarantine("document_invalid");
    }
    if (
      stringCodePoints >
      FILING_FACT_NORMALIZATION_LIMITS.aggregateStringCodePoints
    ) {
      quarantine("document_invalid");
    }
  }
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
    quarantine("document_invalid");
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function validateDocumentFactContext(
  facts: readonly SourceFact[],
  code: FilingFactNormalizationQuarantineCode,
): void {
  const first = facts[0];
  const firstDuration = facts[3];
  if (
    first === undefined ||
    firstDuration === undefined ||
    first.periodStart !== null ||
    firstDuration.periodStart === null ||
    first.periodEnd !== firstDuration.periodEnd
  ) {
    quarantine(code);
  }
  for (let index = 0; index < facts.length; index += 1) {
    const fact = facts[index];
    const contract = FILING_FACT_CONTRACTS[index];
    if (
      fact === undefined ||
      contract === undefined ||
      fact.periodEnd !== first.periodEnd ||
      (contract.periodKind === "instant"
        ? fact.periodStart !== null
        : fact.periodStart !== firstDuration.periodStart)
    ) {
      quarantine(code);
    }
  }
}

function isCanonicalDecimal(value: string): boolean {
  if (!DECIMAL.test(value) || value === "-0") return false;
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const [integer = "", fraction = ""] = unsigned.split(".");
  return (
    integer.length <= FILING_FACT_NORMALIZATION_LIMITS.decimalIntegerDigits &&
    fraction.length <= FILING_FACT_NORMALIZATION_LIMITS.decimalScale &&
    integer.length + fraction.length <=
      FILING_FACT_NORMALIZATION_LIMITS.decimalPrecision
  );
}

function isUtcInstant(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString() === `${value}T00:00:00.000Z`
  );
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function quarantine(code: FilingFactNormalizationQuarantineCode): never {
  throw new QuarantineSignal(code);
}
