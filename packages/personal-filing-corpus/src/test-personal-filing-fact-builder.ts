import { createHash } from "node:crypto";

import {
  PERSONAL_FILING_FACT_CONTRACTS,
  PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
  PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
} from "./personal-filing-fact-normalization";

export type JsonRecord = Record<string, unknown>;

export interface PersonalFilingFactFixture {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly sourceDocuments: readonly Uint8Array[];
}

export function buildPersonalFilingFactFixture(
  withAmendment = false,
): PersonalFilingFactFixture {
  const rootEntry = manifestEntry({
    accession: "0001234567-26-000001",
    acceptedAt: "2026-02-20T20:00:00.000Z",
    amendmentOf: null,
    availableAt: "2026-02-20T20:00:01.000Z",
    contentSha256: `sha256:${"a".repeat(64)}`,
    form: "10-K",
  });
  const amendmentEntry = manifestEntry({
    accession: "0001234567-26-000002",
    acceptedAt: "2026-03-15T20:00:00.000Z",
    amendmentOf: "0001234567-26-000001",
    availableAt: "2026-03-15T20:00:01.000Z",
    contentSha256: `sha256:${"b".repeat(64)}`,
    form: "10-K/A",
  });
  const manifestValue: JsonRecord = {
    corpusId: "personal-generated-example",
    corpusVersion: "1.0.0",
    entries: withAmendment ? [rootEntry, amendmentEntry] : [rootEntry],
    frozenAt: "2026-08-28T18:00:00.000Z",
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
  };
  const manifest = canonicalPersonalFilingFactDocument(manifestValue);
  const declarationValue: JsonRecord = {
    commercialUse: "prohibited",
    corpusId: "personal-generated-example",
    corpusVersion: "1.0.0",
    deleteOnRequest: true,
    deletionMode: "user_managed_local_delete",
    localOnly: true,
    manifestSha256: sha256(manifest),
    profile: "personal_single_user_local",
    purpose: "personal_offline_filing_research_only",
    redistribution: "prohibited",
    retentionDays: 365,
    schemaVersion: "1.0.0",
    singleUser: true,
  };
  const declaration = canonicalPersonalFilingFactDocument(declarationValue);
  const planValue: JsonRecord = {
    corpusId: "personal-generated-example",
    corpusVersion: "1.0.0",
    declarationSha256: sha256(declaration),
    manifestSha256: sha256(manifest),
    mappings: planMappings(),
    parserVersion: "sample-parser-v1",
    profile: "personal_single_user_local",
    schemaVersion: PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    taxonomy: "sample-gaap-2026",
  };
  const normalizationPlan = canonicalPersonalFilingFactDocument(planValue);
  const planSha256 = sha256(normalizationPlan);
  const rootSource = sourceDocument(rootEntry, planSha256, rootValues());
  const amendmentSource = sourceDocument(
    amendmentEntry,
    planSha256,
    amendmentValues(),
  );
  return Object.freeze({
    declaration,
    manifest,
    normalizationPlan,
    sourceDocuments: Object.freeze(
      (withAmendment ? [rootSource, amendmentSource] : [rootSource]).map(
        canonicalPersonalFilingFactDocument,
      ),
    ),
  });
}

export function canonicalPersonalFilingFactDocument(
  value: unknown,
): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

export function decodePersonalFilingFactDocument(
  bytes: Uint8Array,
): JsonRecord {
  return JSON.parse(new TextDecoder().decode(bytes)) as JsonRecord;
}

export function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function manifestEntry(input: {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly contentSha256: string;
  readonly form: "10-K" | "10-K/A";
}): JsonRecord {
  return {
    acceptedAt: input.acceptedAt,
    accession: input.accession,
    amendmentOf: input.amendmentOf,
    availableAt: input.availableAt,
    cik: "0001234567",
    contentBytes: input.form === "10-K" ? 345_678 : 123_456,
    contentSha256: input.contentSha256,
    form: input.form,
    mediaType: "text/html",
    source: "sec_edgar",
    sourceLocator: `sec-edgar:${input.accession}`,
    taxonomy: "sample-gaap-2026",
  };
}

function planMappings(): readonly JsonRecord[] {
  const concepts: Readonly<Record<Exclude<string, "free_cash_flow">, string>> =
    {
      assets: "sample:Assets",
      cash: "sample:Cash",
      debt: "sample:Debt",
      diluted_shares: "sample:DilutedShares",
      gross_profit: "sample:GrossProfit",
      net_income: "sample:NetIncome",
      operating_cash_flow: "sample:OperatingCashFlow",
      operating_income: "sample:OperatingIncome",
      revenue: "sample:Revenue",
    };
  return PERSONAL_FILING_FACT_CONTRACTS.map((contract) =>
    contract.key === "free_cash_flow"
      ? {
          formula: PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
          key: contract.key,
          kind: "subtraction",
          minuendConcept: "sample:OperatingCashFlow",
          periodKind: contract.periodKind,
          subtrahendConcept: "sample:CapitalExpenditures",
          unit: contract.unit,
        }
      : {
          key: contract.key,
          kind: "direct",
          periodKind: contract.periodKind,
          sourceConcept: concepts[contract.key],
          unit: contract.unit,
        },
  );
}

function sourceDocument(
  entry: JsonRecord,
  normalizationPlanSha256: string,
  values: Readonly<Record<string, string>>,
): JsonRecord {
  const operatingCashFlow = values.operating_cash_flow;
  const capitalExpenditures = values.capital_expenditures;
  if (operatingCashFlow === undefined || capitalExpenditures === undefined) {
    throw new TypeError("Personal filing fact fixture is incomplete.");
  }
  const mappings = planMappings();
  return {
    accession: entry.accession,
    acceptedAt: entry.acceptedAt,
    amendmentOf: entry.amendmentOf,
    availableAt: entry.availableAt,
    cik: entry.cik,
    contentSha256: entry.contentSha256,
    facts: PERSONAL_FILING_FACT_CONTRACTS.map((contract, index) => {
      const mapping = mappings[index];
      const periodStart =
        contract.periodKind === "instant" ? null : "2025-01-01";
      if (contract.key === "free_cash_flow") {
        return {
          concept: null,
          derivation: {
            formula: PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
            minuend: {
              concept: "sample:OperatingCashFlow",
              dimensions: {},
              periodEnd: "2025-12-31",
              periodStart,
              unit: "USD",
              value: operatingCashFlow,
            },
            subtrahend: {
              concept: "sample:CapitalExpenditures",
              dimensions: {},
              periodEnd: "2025-12-31",
              periodStart,
              unit: "USD",
              value: capitalExpenditures,
            },
          },
          dimensions: {},
          key: contract.key,
          periodEnd: "2025-12-31",
          periodStart,
          unit: contract.unit,
          value: values[contract.key],
        };
      }
      return {
        concept: mapping?.sourceConcept,
        derivation: null,
        dimensions: {},
        key: contract.key,
        periodEnd: "2025-12-31",
        periodStart,
        unit: contract.unit,
        value: values[contract.key],
      };
    }),
    form: entry.form,
    normalizationPlanSha256,
    parserVersion: "sample-parser-v1",
    schemaVersion: PERSONAL_FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
    synthetic: false,
    taxonomy: "sample-gaap-2026",
  };
}

function rootValues(): Readonly<Record<string, string>> {
  return {
    assets: "250000000",
    capital_expenditures: "5000000",
    cash: "24000000",
    debt: "40000000",
    diluted_shares: "25000000",
    free_cash_flow: "15000000",
    gross_profit: "60000000",
    net_income: "12000000",
    operating_cash_flow: "20000000",
    operating_income: "18000000",
    revenue: "120000000",
  };
}

function amendmentValues(): Readonly<Record<string, string>> {
  return {
    ...rootValues(),
    capital_expenditures: "6000000",
    free_cash_flow: "14000000",
    gross_profit: "57000000",
    net_income: "10000000",
    operating_income: "16000000",
    revenue: "116400000",
  };
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
    throw new TypeError("Personal filing fact fixture is invalid.");
  }
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
