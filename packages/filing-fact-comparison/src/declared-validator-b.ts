import { createHash } from "node:crypto";

export type DeclaredValidatorBInvalidCode =
  "normalized_payload_invalid" | "report_invalid" | "validator_binding_invalid";

export type DeclaredValidatorBResult =
  | {
      readonly amendmentDocumentSha256: `sha256:${string}`;
      readonly normalizedPayloadBytes: Uint8Array;
      readonly originalDocumentSha256: `sha256:${string}`;
      readonly status: "validated";
    }
  | { readonly status: "quarantined" }
  | {
      readonly code: DeclaredValidatorBInvalidCode;
      readonly status: "invalid";
    };

const EXPECTED_BINDING = Object.freeze({
  implementationSha256:
    "sha256:8ae5aae1ecc92b3b71e764deb85d6758e38b1b11eee39f6aed07599bb30ae365",
  role: "declared-validator-b",
  validatorId: "synthetic-filing-fact-validator-b",
  validatorVersion: "1.0.0",
});
const SCHEMA_VERSION = "1.0.0";
const NORMALIZATION_CLAIM =
  "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage";
const PARSER_VERSION = "synthetic-ten-fact-producer-v1";
const TAXONOMY_FAMILY = "rc-synthetic-ten-fact";
const TAXONOMY_VERSION = "1.0.0";
const FACT_KEYS = Object.freeze([
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
type FactKey = (typeof FACT_KEYS)[number];
type Unit = "USD" | "shares";
interface Contract {
  readonly key: FactKey;
  readonly periodKind: "duration" | "instant";
  readonly sourceConcept: string;
  readonly unit: Unit;
}
const CONTRACTS: readonly Contract[] = Object.freeze(
  [
    ["assets", "instant", "rc-synthetic:Assets", "USD"],
    ["cash", "instant", "rc-synthetic:CashAndCashEquivalents", "USD"],
    ["debt", "instant", "rc-synthetic:Debt", "USD"],
    [
      "diluted_shares",
      "duration",
      "rc-synthetic:WeightedAverageDilutedShares",
      "shares",
    ],
    ["free_cash_flow", "duration", "rc-synthetic:FreeCashFlow", "USD"],
    ["gross_profit", "duration", "rc-synthetic:GrossProfit", "USD"],
    ["net_income", "duration", "rc-synthetic:NetIncome", "USD"],
    [
      "operating_cash_flow",
      "duration",
      "rc-synthetic:OperatingCashFlow",
      "USD",
    ],
    ["operating_income", "duration", "rc-synthetic:OperatingIncome", "USD"],
    ["revenue", "duration", "rc-synthetic:Revenue", "USD"],
  ].map(([key, periodKind, sourceConcept, unit]) =>
    Object.freeze({ key, periodKind, sourceConcept, unit }),
  ) as readonly Contract[],
);
const ENVELOPE_KEYS = [
  "implementationSha256",
  "normalizedPayload",
  "role",
  "schemaVersion",
  "status",
  "synthetic",
  "validatorId",
  "validatorVersion",
] as const;
const PAYLOAD_KEYS = [
  "amendmentDocumentSha256",
  "audit",
  "claim",
  "factVersions",
  "lineage",
  "originalDocumentSha256",
  "schemaVersion",
  "sourceDocuments",
  "status",
  "synthetic",
] as const;
const AUDIT_KEYS = ["factVersionCount", "lineageCount", "outcome"] as const;
const SOURCE_DOCUMENT_KEYS = [
  "accession",
  "acceptedAt",
  "amendmentOf",
  "availableAt",
  "contentSha256",
  "documentSha256",
  "entityId",
  "form",
  "instrumentId",
  "parserVersion",
  "schemaVersion",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
] as const;
const FACT_VERSION_KEYS = [
  "dimensions",
  "factId",
  "key",
  "knownFrom",
  "knownToExclusive",
  "parserVersion",
  "periodEnd",
  "periodStart",
  "predecessorFactId",
  "sourceAcceptedAt",
  "sourceAccession",
  "sourceAvailableAt",
  "sourceConcept",
  "sourceContentSha256",
  "sourceDocumentSha256",
  "successorFactId",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
  "unit",
  "value",
] as const;
const LINEAGE_KEYS = [
  "effectiveAt",
  "key",
  "predecessorFactId",
  "successorFactId",
] as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const FACT_ID = /^fact:sha256:[0-9a-f]{64}$/u;
const ACCESSION = /^SYN-([0-9]{10})-([0-9]{2})-[0-9]{6}$/u;
const ENTITY_ID = /^entity\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}$/u;
const INSTRUMENT_ID = /^instrument\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const FACT_ID_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-normalized-filing-fact:v1\u0000",
);
const LIMITS = Object.freeze({
  aggregateStringCodePoints: 131_072,
  depth: 12,
  nodes: 2_048,
});

interface SourceDocument {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly contentSha256: `sha256:${string}`;
  readonly documentSha256: `sha256:${string}`;
  readonly entityId: string;
  readonly form: "10-K" | "10-K/A";
  readonly instrumentId: string;
}

interface FactVersion {
  readonly factId: `fact:sha256:${string}`;
  readonly key: FactKey;
  readonly knownFrom: string;
  readonly knownToExclusive: string | null;
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
  readonly unit: Unit;
  readonly value: string;
}

class ValidationFailure extends Error {
  public constructor(public readonly code: DeclaredValidatorBInvalidCode) {
    super("Declared validator B rejected an envelope.");
  }
}

export function validateDeclaredValidatorBEnvelope(
  bytes: Uint8Array,
): DeclaredValidatorBResult {
  try {
    const parsed = parseCanonicalEnvelope(bytes);
    const envelope = exactRecord(parsed, ENVELOPE_KEYS, "report_invalid");
    if (
      envelope.schemaVersion !== SCHEMA_VERSION ||
      envelope.synthetic !== true ||
      envelope.role !== EXPECTED_BINDING.role ||
      envelope.validatorId !== EXPECTED_BINDING.validatorId ||
      envelope.validatorVersion !== EXPECTED_BINDING.validatorVersion ||
      envelope.implementationSha256 !== EXPECTED_BINDING.implementationSha256
    ) {
      invalid("validator_binding_invalid");
    }
    if (envelope.status === "quarantined") {
      if (envelope.normalizedPayload !== null) invalid("report_invalid");
      return Object.freeze({ status: "quarantined" as const });
    }
    if (envelope.status !== "validated") invalid("report_invalid");
    const payload = validateNormalizedPayload(envelope.normalizedPayload);
    return Object.freeze({
      amendmentDocumentSha256: payload.amendmentDocumentSha256,
      normalizedPayloadBytes: new TextEncoder().encode(
        `${canonicalJson(envelope.normalizedPayload)}\n`,
      ),
      originalDocumentSha256: payload.originalDocumentSha256,
      status: "validated" as const,
    });
  } catch (error) {
    return Object.freeze({
      code: error instanceof ValidationFailure ? error.code : "report_invalid",
      status: "invalid" as const,
    });
  }
}

function parseCanonicalEnvelope(bytes: Uint8Array): unknown {
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
    parsed = JSON.parse(text);
  } catch {
    invalid("report_invalid");
  }
  validateCanonicalTree(parsed);
  if (`${canonicalJson(parsed)}\n` !== text) invalid("report_invalid");
  return parsed;
}

function validateNormalizedPayload(value: unknown): {
  readonly amendmentDocumentSha256: `sha256:${string}`;
  readonly originalDocumentSha256: `sha256:${string}`;
} {
  const payload = exactRecord(
    value,
    PAYLOAD_KEYS,
    "normalized_payload_invalid",
  );
  const audit = exactRecord(
    payload.audit,
    AUDIT_KEYS,
    "normalized_payload_invalid",
  );
  if (
    payload.schemaVersion !== SCHEMA_VERSION ||
    payload.synthetic !== true ||
    payload.status !== "normalized" ||
    payload.claim !== NORMALIZATION_CLAIM ||
    audit.factVersionCount !== 20 ||
    audit.lineageCount !== 10 ||
    audit.outcome !== "normalized" ||
    typeof payload.originalDocumentSha256 !== "string" ||
    !SHA256.test(payload.originalDocumentSha256) ||
    typeof payload.amendmentDocumentSha256 !== "string" ||
    !SHA256.test(payload.amendmentDocumentSha256) ||
    payload.originalDocumentSha256 === payload.amendmentDocumentSha256 ||
    !Array.isArray(payload.sourceDocuments) ||
    payload.sourceDocuments.length !== 2 ||
    !Array.isArray(payload.factVersions) ||
    payload.factVersions.length !== 20 ||
    !Array.isArray(payload.lineage) ||
    payload.lineage.length !== 10
  ) {
    invalid("normalized_payload_invalid");
  }
  const original = validateSourceDocument(
    payload.sourceDocuments[0],
    "10-K",
    payload.originalDocumentSha256,
  );
  const amendment = validateSourceDocument(
    payload.sourceDocuments[1],
    "10-K/A",
    payload.amendmentDocumentSha256,
  );
  validateDocumentPair(original, amendment);
  const versions = payload.factVersions.map((fact, index) =>
    validateFactVersion(
      fact,
      index,
      index < 10 ? original : amendment,
      amendment.availableAt,
    ),
  );
  validateFactSet(versions, original, amendment);
  validateLineage(payload.lineage, versions, amendment.availableAt);
  return Object.freeze({
    amendmentDocumentSha256:
      payload.amendmentDocumentSha256 as `sha256:${string}`,
    originalDocumentSha256:
      payload.originalDocumentSha256 as `sha256:${string}`,
  });
}

function validateSourceDocument(
  value: unknown,
  expectedForm: "10-K" | "10-K/A",
  expectedDocumentSha256: string,
): SourceDocument {
  const record = exactRecord(
    value,
    SOURCE_DOCUMENT_KEYS,
    "normalized_payload_invalid",
  );
  const accessionMatch =
    typeof record.accession === "string"
      ? ACCESSION.exec(record.accession)
      : null;
  if (
    record.schemaVersion !== SCHEMA_VERSION ||
    record.synthetic !== true ||
    record.form !== expectedForm ||
    typeof record.accession !== "string" ||
    accessionMatch === null ||
    typeof record.acceptedAt !== "string" ||
    !isUtcInstant(record.acceptedAt) ||
    typeof record.availableAt !== "string" ||
    !isUtcInstant(record.availableAt) ||
    record.acceptedAt > record.availableAt ||
    typeof record.contentSha256 !== "string" ||
    !SHA256.test(record.contentSha256) ||
    record.documentSha256 !== expectedDocumentSha256 ||
    typeof record.entityId !== "string" ||
    !ENTITY_ID.test(record.entityId) ||
    typeof record.instrumentId !== "string" ||
    !INSTRUMENT_ID.test(record.instrumentId) ||
    record.parserVersion !== PARSER_VERSION ||
    record.taxonomyFamily !== TAXONOMY_FAMILY ||
    record.taxonomyVersion !== TAXONOMY_VERSION ||
    (expectedForm === "10-K"
      ? record.amendmentOf !== null
      : typeof record.amendmentOf !== "string" ||
        !ACCESSION.test(record.amendmentOf))
  ) {
    invalid("normalized_payload_invalid");
  }
  const accessionYear = accessionMatch[2];
  if (
    accessionYear === undefined ||
    accessionYear !== record.acceptedAt.slice(2, 4)
  ) {
    invalid("normalized_payload_invalid");
  }
  return Object.freeze({
    accession: record.accession,
    acceptedAt: record.acceptedAt,
    amendmentOf:
      expectedForm === "10-K" ? null : (record.amendmentOf as string),
    availableAt: record.availableAt,
    contentSha256: record.contentSha256 as `sha256:${string}`,
    documentSha256: expectedDocumentSha256 as `sha256:${string}`,
    entityId: record.entityId,
    form: expectedForm,
    instrumentId: record.instrumentId,
  });
}

function validateDocumentPair(
  original: SourceDocument,
  amendment: SourceDocument,
): void {
  const originalMatch = ACCESSION.exec(original.accession);
  const amendmentMatch = ACCESSION.exec(amendment.accession);
  if (
    originalMatch === null ||
    amendmentMatch === null ||
    original.accession === amendment.accession ||
    amendment.amendmentOf !== original.accession ||
    originalMatch[1] !== amendmentMatch[1] ||
    original.entityId !== amendment.entityId ||
    original.instrumentId !== amendment.instrumentId ||
    original.contentSha256 === amendment.contentSha256 ||
    original.documentSha256 === amendment.documentSha256 ||
    original.availableAt >= amendment.acceptedAt
  ) {
    invalid("normalized_payload_invalid");
  }
}

function validateFactVersion(
  value: unknown,
  index: number,
  source: SourceDocument,
  amendmentAvailableAt: string,
): FactVersion {
  const record = exactRecord(
    value,
    FACT_VERSION_KEYS,
    "normalized_payload_invalid",
  );
  const contract = CONTRACTS[index % 10];
  const predecessor = index < 10;
  if (
    contract === undefined ||
    record.key !== contract.key ||
    record.sourceConcept !== contract.sourceConcept ||
    record.unit !== contract.unit ||
    !isEmptyRecord(record.dimensions) ||
    typeof record.factId !== "string" ||
    !FACT_ID.test(record.factId) ||
    record.knownFrom !== source.availableAt ||
    record.knownToExclusive !== (predecessor ? amendmentAvailableAt : null) ||
    record.parserVersion !== PARSER_VERSION ||
    typeof record.periodEnd !== "string" ||
    !isIsoDate(record.periodEnd) ||
    record.sourceAcceptedAt !== source.acceptedAt ||
    record.sourceAccession !== source.accession ||
    record.sourceAvailableAt !== source.availableAt ||
    record.sourceContentSha256 !== source.contentSha256 ||
    record.sourceDocumentSha256 !== source.documentSha256 ||
    record.synthetic !== true ||
    record.taxonomyFamily !== TAXONOMY_FAMILY ||
    record.taxonomyVersion !== TAXONOMY_VERSION ||
    typeof record.value !== "string" ||
    !isCanonicalDecimal(record.value) ||
    (predecessor
      ? record.predecessorFactId !== null ||
        typeof record.successorFactId !== "string" ||
        !FACT_ID.test(record.successorFactId)
      : typeof record.predecessorFactId !== "string" ||
        !FACT_ID.test(record.predecessorFactId) ||
        record.successorFactId !== null)
  ) {
    invalid("normalized_payload_invalid");
  }
  if (
    contract.periodKind === "instant"
      ? record.periodStart !== null
      : typeof record.periodStart !== "string" ||
        !isIsoDate(record.periodStart) ||
        record.periodStart >= record.periodEnd
  ) {
    invalid("normalized_payload_invalid");
  }
  const expectedFactId = normalizedFactId(source, {
    key: contract.key,
    periodEnd: record.periodEnd,
    periodStart:
      contract.periodKind === "instant" ? null : (record.periodStart as string),
    sourceConcept: contract.sourceConcept,
    unit: contract.unit,
    value: record.value,
  });
  if (record.factId !== expectedFactId) invalid("normalized_payload_invalid");
  return Object.freeze({
    factId: record.factId,
    key: contract.key,
    knownFrom: record.knownFrom,
    knownToExclusive: record.knownToExclusive as string | null,
    periodEnd: record.periodEnd,
    periodStart:
      contract.periodKind === "instant" ? null : (record.periodStart as string),
    predecessorFactId: record.predecessorFactId as
      `fact:sha256:${string}` | null,
    sourceAcceptedAt: record.sourceAcceptedAt,
    sourceAccession: record.sourceAccession,
    sourceAvailableAt: record.sourceAvailableAt,
    sourceConcept: contract.sourceConcept,
    sourceContentSha256: record.sourceContentSha256,
    sourceDocumentSha256: record.sourceDocumentSha256,
    successorFactId: record.successorFactId as `fact:sha256:${string}` | null,
    unit: contract.unit,
    value: record.value,
  });
}

function validateFactSet(
  versions: readonly FactVersion[],
  original: SourceDocument,
  amendment: SourceDocument,
): void {
  const ids = new Set(versions.map((fact) => fact.factId));
  if (ids.size !== 20) invalid("normalized_payload_invalid");
  const originalFirst = versions[0];
  const originalDuration = versions[3];
  const amendmentFirst = versions[10];
  const amendmentDuration = versions[13];
  if (
    originalFirst === undefined ||
    originalDuration === undefined ||
    amendmentFirst === undefined ||
    amendmentDuration === undefined ||
    originalFirst.periodEnd >= original.acceptedAt.slice(0, 10) ||
    amendmentFirst.periodEnd >= amendment.acceptedAt.slice(0, 10) ||
    originalFirst.periodEnd !== amendmentFirst.periodEnd ||
    originalDuration.periodStart === null ||
    amendmentDuration.periodStart === null ||
    originalDuration.periodStart !== amendmentDuration.periodStart
  ) {
    invalid("normalized_payload_invalid");
  }
  let changed = 0;
  let unchanged = 0;
  for (let index = 0; index < 10; index += 1) {
    const predecessor = versions[index];
    const successor = versions[index + 10];
    const contract = CONTRACTS[index];
    if (
      predecessor === undefined ||
      successor === undefined ||
      contract === undefined ||
      predecessor.periodEnd !== originalFirst.periodEnd ||
      successor.periodEnd !== amendmentFirst.periodEnd ||
      predecessor.periodStart !==
        (contract.periodKind === "instant"
          ? null
          : originalDuration.periodStart) ||
      successor.periodStart !==
        (contract.periodKind === "instant"
          ? null
          : amendmentDuration.periodStart) ||
      predecessor.successorFactId !== successor.factId ||
      successor.predecessorFactId !== predecessor.factId ||
      predecessor.knownToExclusive !== successor.knownFrom
    ) {
      invalid("normalized_payload_invalid");
    }
    if (predecessor.value === successor.value) unchanged += 1;
    else changed += 1;
  }
  if (changed === 0 || unchanged === 0) invalid("normalized_payload_invalid");
}

function validateLineage(
  values: readonly unknown[],
  versions: readonly FactVersion[],
  amendmentAvailableAt: string,
): void {
  const predecessorIds = new Set<string>();
  const successorIds = new Set<string>();
  for (let index = 0; index < 10; index += 1) {
    const record = exactRecord(
      values[index],
      LINEAGE_KEYS,
      "normalized_payload_invalid",
    );
    const predecessor = versions[index];
    const successor = versions[index + 10];
    const key = FACT_KEYS[index];
    if (
      predecessor === undefined ||
      successor === undefined ||
      key === undefined ||
      record.effectiveAt !== amendmentAvailableAt ||
      record.key !== key ||
      record.predecessorFactId !== predecessor.factId ||
      record.successorFactId !== successor.factId ||
      predecessorIds.has(predecessor.factId) ||
      successorIds.has(successor.factId) ||
      predecessor.factId === successor.factId
    ) {
      invalid("normalized_payload_invalid");
    }
    predecessorIds.add(predecessor.factId);
    successorIds.add(successor.factId);
  }
}

function normalizedFactId(
  document: SourceDocument,
  fact: {
    readonly key: FactKey;
    readonly periodEnd: string;
    readonly periodStart: string | null;
    readonly sourceConcept: string;
    readonly unit: Unit;
    readonly value: string;
  },
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
      parserVersion: PARSER_VERSION,
      sourceConcept: fact.sourceConcept,
      taxonomyFamily: TAXONOMY_FAMILY,
      taxonomyVersion: TAXONOMY_VERSION,
      unit: fact.unit,
      value: fact.value,
    }),
  );
  return `fact:sha256:${createHash("sha256")
    .update(FACT_ID_DOMAIN)
    .update(payload)
    .digest("hex")}`;
}

function exactRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
  code: DeclaredValidatorBInvalidCode,
): Record<TKeys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid(code);
  }
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    invalid(code);
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
    if (entry === undefined) invalid("report_invalid");
    nodes += 1;
    if (nodes > LIMITS.nodes || entry.depth > LIMITS.depth)
      invalid("report_invalid");
    if (typeof entry.value === "string") {
      stringCodePoints += [...entry.value].length;
    } else if (
      entry.value === null ||
      typeof entry.value === "boolean" ||
      (typeof entry.value === "number" && Number.isSafeInteger(entry.value))
    ) {
      // Primitive size is bounded by the owned report byte limit.
    } else if (Array.isArray(entry.value)) {
      for (const item of entry.value)
        stack.push({ depth: entry.depth + 1, value: item });
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
      invalid("report_invalid");
    }
    if (stringCodePoints > LIMITS.aggregateStringCodePoints)
      invalid("report_invalid");
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
    invalid("report_invalid");
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function isCanonicalDecimal(value: string): boolean {
  if (!DECIMAL.test(value) || value === "-0") return false;
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const [integer = "", fraction = ""] = unsigned.split(".");
  return (
    integer.length <= 26 &&
    fraction.length <= 12 &&
    integer.length + fraction.length <= 38
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

function invalid(code: DeclaredValidatorBInvalidCode): never {
  throw new ValidationFailure(code);
}
