import {
  FILING_FACT_CONTRACTS,
  FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  FILING_FACT_PARSER_VERSION,
  FILING_FACT_TAXONOMY_FAMILY,
  FILING_FACT_TAXONOMY_VERSION,
} from "./filing-fact-normalization";

export interface SyntheticFilingFactDocuments {
  readonly amendmentDocument: Uint8Array;
  readonly originalDocument: Uint8Array;
}

export function buildSyntheticFilingFactDocuments(): SyntheticFilingFactDocuments {
  const original = buildDocument({
    accession: "SYN-0000000001-26-000001",
    acceptedAt: "2026-02-20T20:00:00.000Z",
    amendmentOf: null,
    availableAt: "2026-02-20T20:00:01.000Z",
    contentSha256: `sha256:${"1".repeat(64)}`,
    form: "10-K",
    values: {
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
    },
  });
  const amendment = buildDocument({
    accession: "SYN-0000000001-26-000002",
    acceptedAt: "2026-03-15T20:00:00.000Z",
    amendmentOf: "SYN-0000000001-26-000001",
    availableAt: "2026-03-15T20:00:01.000Z",
    contentSha256: `sha256:${"2".repeat(64)}`,
    form: "10-K/A",
    values: {
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
    },
  });
  return Object.freeze({
    amendmentDocument: canonicalDocumentBytes(amendment),
    originalDocument: canonicalDocumentBytes(original),
  });
}

export function decodeSyntheticFilingFactDocument(
  bytes: Uint8Array,
): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function canonicalSyntheticFilingFactDocument(
  value: unknown,
): Uint8Array {
  return canonicalDocumentBytes(value);
}

function buildDocument(input: {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly contentSha256: string;
  readonly form: "10-K" | "10-K/A";
  readonly values: Readonly<Record<string, string>>;
}): Record<string, unknown> {
  return {
    accession: input.accession,
    acceptedAt: input.acceptedAt,
    amendmentOf: input.amendmentOf,
    availableAt: input.availableAt,
    contentSha256: input.contentSha256,
    entityId: "entity.synthetic.syn1",
    facts: FILING_FACT_CONTRACTS.map((contract) => ({
      concept: contract.sourceConcept,
      dimensions: {},
      key: contract.key,
      periodEnd: "2025-12-31",
      periodStart: contract.periodKind === "instant" ? null : "2025-01-01",
      unit: contract.unit,
      value: input.values[contract.key],
    })),
    form: input.form,
    instrumentId: "instrument.synthetic.syn1",
    parserVersion: FILING_FACT_PARSER_VERSION,
    schemaVersion: FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    synthetic: true,
    taxonomyFamily: FILING_FACT_TAXONOMY_FAMILY,
    taxonomyVersion: FILING_FACT_TAXONOMY_VERSION,
  };
}

function canonicalDocumentBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null)
    throw new TypeError("Synthetic filing fact fixture is invalid.");
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
