import { createHash } from "node:crypto";

import {
  FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS,
  FILING_FACT_COMPARISON_SCHEMA_VERSION,
  type FilingFactComparisonDeclaredValidatorBinding,
  type FilingFactComparisonDeclaredValidatorRole,
} from "./filing-fact-comparison";

export interface SyntheticFilingFactComparisonEnvelopes {
  readonly declaredValidatorAEnvelope: Uint8Array;
  readonly declaredValidatorBEnvelope: Uint8Array;
}

const NORMALIZATION_CLAIM =
  "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage";
const PARSER_VERSION = "synthetic-ten-fact-producer-v1";
const TAXONOMY_FAMILY = "rc-synthetic-ten-fact";
const TAXONOMY_VERSION = "1.0.0";
const FACT_ID_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-normalized-filing-fact:v1\u0000",
);
const CONTRACTS = Object.freeze([
  Object.freeze({
    key: "assets",
    periodKind: "instant",
    sourceConcept: "rc-synthetic:Assets",
    unit: "USD",
  }),
  Object.freeze({
    key: "cash",
    periodKind: "instant",
    sourceConcept: "rc-synthetic:CashAndCashEquivalents",
    unit: "USD",
  }),
  Object.freeze({
    key: "debt",
    periodKind: "instant",
    sourceConcept: "rc-synthetic:Debt",
    unit: "USD",
  }),
  Object.freeze({
    key: "diluted_shares",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:WeightedAverageDilutedShares",
    unit: "shares",
  }),
  Object.freeze({
    key: "free_cash_flow",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:FreeCashFlow",
    unit: "USD",
  }),
  Object.freeze({
    key: "gross_profit",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:GrossProfit",
    unit: "USD",
  }),
  Object.freeze({
    key: "net_income",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:NetIncome",
    unit: "USD",
  }),
  Object.freeze({
    key: "operating_cash_flow",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:OperatingCashFlow",
    unit: "USD",
  }),
  Object.freeze({
    key: "operating_income",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:OperatingIncome",
    unit: "USD",
  }),
  Object.freeze({
    key: "revenue",
    periodKind: "duration",
    sourceConcept: "rc-synthetic:Revenue",
    unit: "USD",
  }),
] as const);

type Contract = (typeof CONTRACTS)[number];
interface SyntheticSourceDocument {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly contentSha256: `sha256:${string}`;
  readonly documentSha256: `sha256:${string}`;
  readonly entityId: string;
  readonly form: "10-K" | "10-K/A";
  readonly instrumentId: string;
  readonly parserVersion: typeof PARSER_VERSION;
  readonly schemaVersion: typeof FILING_FACT_COMPARISON_SCHEMA_VERSION;
  readonly synthetic: true;
  readonly taxonomyFamily: typeof TAXONOMY_FAMILY;
  readonly taxonomyVersion: typeof TAXONOMY_VERSION;
}

export function buildSyntheticFilingFactComparisonEnvelopes(): SyntheticFilingFactComparisonEnvelopes {
  const payload = buildNormalizedPayload();
  const first = FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[0];
  const second = FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[1];
  if (first === undefined || second === undefined)
    throw new TypeError("Synthetic validator bindings are incomplete.");
  return Object.freeze({
    declaredValidatorAEnvelope: canonicalEnvelope(
      validatedEnvelope(first, payload),
    ),
    declaredValidatorBEnvelope: canonicalEnvelope(
      validatedEnvelope(second, payload),
    ),
  });
}

export function buildSyntheticFilingFactComparisonQuarantinedEnvelope(
  role: FilingFactComparisonDeclaredValidatorRole,
): Uint8Array {
  const binding = FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS.find(
    (candidate) => candidate.role === role,
  );
  if (binding === undefined)
    throw new TypeError("Synthetic validator role is invalid.");
  return canonicalEnvelope({
    implementationSha256: binding.implementationSha256,
    normalizedPayload: null,
    role: binding.role,
    schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
    validatorId: binding.validatorId,
    validatorVersion: binding.validatorVersion,
  });
}

export function decodeSyntheticFilingFactComparisonEnvelope(
  bytes: Uint8Array,
): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function canonicalSyntheticFilingFactComparisonEnvelope(
  value: unknown,
): Uint8Array {
  return canonicalEnvelope(value);
}

function validatedEnvelope(
  binding: FilingFactComparisonDeclaredValidatorBinding,
  normalizedPayload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    implementationSha256: binding.implementationSha256,
    normalizedPayload,
    role: binding.role,
    schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
    status: "validated",
    synthetic: true,
    validatorId: binding.validatorId,
    validatorVersion: binding.validatorVersion,
  };
}

function buildNormalizedPayload(): Record<string, unknown> {
  const original = sourceDocument({
    accession: "SYN-0000000001-26-000001",
    acceptedAt: "2026-02-20T20:00:00.000Z",
    amendmentOf: null,
    availableAt: "2026-02-20T20:00:01.000Z",
    contentLabel: "cycle2e-original-content",
    documentLabel: "cycle2e-original-document",
    form: "10-K",
  });
  const amendment = sourceDocument({
    accession: "SYN-0000000001-26-000002",
    acceptedAt: "2026-03-15T20:00:00.000Z",
    amendmentOf: original.accession,
    availableAt: "2026-03-15T20:00:01.000Z",
    contentLabel: "cycle2e-amendment-content",
    documentLabel: "cycle2e-amendment-document",
    form: "10-K/A",
  });
  const originalValues = Object.freeze({
    assets: "250000000",
    cash: "24000000",
    debt: "40000000",
    diluted_shares: "25000000",
    free_cash_flow: "15000000",
    gross_profit: "60000000",
    net_income: "12000000",
    operating_cash_flow: "20000000",
    operating_income: "18000000",
    revenue: "120000000",
  });
  const amendmentValues = Object.freeze({
    assets: "250000000",
    cash: "24000000",
    debt: "40000000",
    diluted_shares: "25000000",
    free_cash_flow: "14000000",
    gross_profit: "57000000",
    net_income: "10000000",
    operating_cash_flow: "20000000",
    operating_income: "16000000",
    revenue: "116400000",
  });
  const originalIds = CONTRACTS.map((contract) =>
    factId(original, contract, originalValues[contract.key]),
  );
  const amendmentIds = CONTRACTS.map((contract) =>
    factId(amendment, contract, amendmentValues[contract.key]),
  );
  const originalVersions = CONTRACTS.map((contract, index) =>
    factVersion({
      contract,
      factId: requiredId(originalIds, index),
      knownToExclusive: amendment.availableAt,
      predecessorFactId: null,
      source: original,
      successorFactId: requiredId(amendmentIds, index),
      value: originalValues[contract.key],
    }),
  );
  const amendmentVersions = CONTRACTS.map((contract, index) =>
    factVersion({
      contract,
      factId: requiredId(amendmentIds, index),
      knownToExclusive: null,
      predecessorFactId: requiredId(originalIds, index),
      source: amendment,
      successorFactId: null,
      value: amendmentValues[contract.key],
    }),
  );
  const lineage = CONTRACTS.map((contract, index) => ({
    effectiveAt: amendment.availableAt,
    key: contract.key,
    predecessorFactId: requiredId(originalIds, index),
    successorFactId: requiredId(amendmentIds, index),
  }));
  return {
    amendmentDocumentSha256: amendment.documentSha256,
    audit: {
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "normalized",
    },
    claim: NORMALIZATION_CLAIM,
    factVersions: [...originalVersions, ...amendmentVersions],
    lineage,
    originalDocumentSha256: original.documentSha256,
    schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
    sourceDocuments: [original, amendment],
    status: "normalized",
    synthetic: true,
  };
}

function sourceDocument(input: {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly contentLabel: string;
  readonly documentLabel: string;
  readonly form: "10-K" | "10-K/A";
}): SyntheticSourceDocument {
  return Object.freeze({
    accession: input.accession,
    acceptedAt: input.acceptedAt,
    amendmentOf: input.amendmentOf,
    availableAt: input.availableAt,
    contentSha256: sha256(new TextEncoder().encode(input.contentLabel)),
    documentSha256: sha256(new TextEncoder().encode(input.documentLabel)),
    entityId: "entity.synthetic.syn1",
    form: input.form,
    instrumentId: "instrument.synthetic.syn1",
    parserVersion: PARSER_VERSION,
    schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
    synthetic: true,
    taxonomyFamily: TAXONOMY_FAMILY,
    taxonomyVersion: TAXONOMY_VERSION,
  });
}

function factVersion(input: {
  readonly contract: Contract;
  readonly factId: `fact:sha256:${string}`;
  readonly knownToExclusive: string | null;
  readonly predecessorFactId: `fact:sha256:${string}` | null;
  readonly source: SyntheticSourceDocument;
  readonly successorFactId: `fact:sha256:${string}` | null;
  readonly value: string;
}): Record<string, unknown> {
  return {
    dimensions: {},
    factId: input.factId,
    key: input.contract.key,
    knownFrom: input.source.availableAt,
    knownToExclusive: input.knownToExclusive,
    parserVersion: PARSER_VERSION,
    periodEnd: "2025-12-31",
    periodStart: input.contract.periodKind === "instant" ? null : "2025-01-01",
    predecessorFactId: input.predecessorFactId,
    sourceAcceptedAt: input.source.acceptedAt,
    sourceAccession: input.source.accession,
    sourceAvailableAt: input.source.availableAt,
    sourceConcept: input.contract.sourceConcept,
    sourceContentSha256: input.source.contentSha256,
    sourceDocumentSha256: input.source.documentSha256,
    successorFactId: input.successorFactId,
    synthetic: true,
    taxonomyFamily: TAXONOMY_FAMILY,
    taxonomyVersion: TAXONOMY_VERSION,
    unit: input.contract.unit,
    value: input.value,
  };
}

function factId(
  document: SyntheticSourceDocument,
  contract: Contract,
  value: string,
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
      key: contract.key,
      periodEnd: "2025-12-31",
      periodStart: contract.periodKind === "instant" ? null : "2025-01-01",
      parserVersion: PARSER_VERSION,
      sourceConcept: contract.sourceConcept,
      taxonomyFamily: TAXONOMY_FAMILY,
      taxonomyVersion: TAXONOMY_VERSION,
      unit: contract.unit,
      value,
    }),
  );
  return `fact:sha256:${createHash("sha256")
    .update(FACT_ID_DOMAIN)
    .update(payload)
    .digest("hex")}`;
}

function requiredId(
  ids: readonly `fact:sha256:${string}`[],
  index: number,
): `fact:sha256:${string}` {
  const id = ids[index];
  if (id === undefined) throw new TypeError("Synthetic fact ID is missing.");
  return id;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalEnvelope(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null)
    throw new TypeError("Synthetic comparison fixture is invalid.");
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
