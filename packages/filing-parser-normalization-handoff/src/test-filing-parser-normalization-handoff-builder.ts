import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";

import {
  FILING_FACT_CONTRACTS,
  FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  FILING_FACT_PARSER_VERSION,
  FILING_FACT_TAXONOMY_FAMILY,
  FILING_FACT_TAXONOMY_VERSION,
} from "@research-cockpit/filing-fact-normalization";

import {
  FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION,
  type FilingParserNormalizationHandoffOptions,
} from "./filing-parser-normalization-handoff";

export interface SyntheticFilingParserNormalizationHandoffFixture {
  readonly amendmentArchive: Uint8Array;
  readonly amendmentEnvelope: Uint8Array;
  readonly options: FilingParserNormalizationHandoffOptions;
  readonly originalArchive: Uint8Array;
  readonly originalEnvelope: Uint8Array;
  readonly privateKey: KeyObject;
}

export const SYNTHETIC_HANDOFF_IMAGE_SHA256 =
  `sha256:${"a".repeat(64)}` as const;
export const SYNTHETIC_HANDOFF_KEY_ID = "cycle2i-synthetic-ed25519-v1";

const SIGNATURE_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-parser-normalization-handoff-signature:v1\u0000",
);
const textEncoder = new TextEncoder();

export function buildSyntheticFilingParserNormalizationHandoffFixture(): SyntheticFilingParserNormalizationHandoffFixture {
  const originalArchive = textEncoder.encode(
    "research-cockpit synthetic parser archive original v1\n",
  );
  const amendmentArchive = textEncoder.encode(
    "research-cockpit synthetic parser archive amendment v1\n",
  );
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeySpki = Uint8Array.from(
    publicKey.export({ format: "der", type: "spki" }),
  );
  const options = Object.freeze({
    expectedImageSha256: SYNTHETIC_HANDOFF_IMAGE_SHA256,
    expectedKeyId: SYNTHETIC_HANDOFF_KEY_ID,
    publicKeySpki,
  });
  const originalDocument = buildDocument({
    accession: "SYN-0000000001-26-000001",
    acceptedAt: "2026-02-20T20:00:00.000Z",
    amendmentOf: null,
    archive: originalArchive,
    availableAt: "2026-02-20T20:00:01.000Z",
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
  const amendmentDocument = buildDocument({
    accession: "SYN-0000000001-26-000002",
    acceptedAt: "2026-03-15T20:00:00.000Z",
    amendmentOf: "SYN-0000000001-26-000001",
    archive: amendmentArchive,
    availableAt: "2026-03-15T20:00:01.000Z",
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
    amendmentArchive,
    amendmentEnvelope: buildSignedSyntheticHandoffEnvelope(
      amendmentDocument,
      amendmentArchive,
      privateKey,
      options,
    ),
    options,
    originalArchive,
    originalEnvelope: buildSignedSyntheticHandoffEnvelope(
      originalDocument,
      originalArchive,
      privateKey,
      options,
    ),
    privateKey,
  });
}

export function buildSignedSyntheticHandoffEnvelope(
  document: Record<string, unknown>,
  archive: Uint8Array,
  privateKey: KeyObject,
  options: Pick<
    FilingParserNormalizationHandoffOptions,
    "expectedImageSha256" | "expectedKeyId"
  >,
): Uint8Array {
  const payload = {
    algorithm: "ed25519",
    document,
    imageSha256: options.expectedImageSha256,
    keyId: options.expectedKeyId,
    sourceSha256: sha256(archive),
  };
  const payloadBytes = canonicalSyntheticHandoffJsonBytes(payload);
  const signature = sign(
    null,
    concatBytes(SIGNATURE_DOMAIN, payloadBytes),
    privateKey,
  ).toString("base64url");
  return canonicalSyntheticHandoffJsonBytes({
    payload,
    schemaVersion: FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION,
    signature,
    synthetic: true,
  });
}

export function decodeSyntheticHandoffEnvelope(
  bytes: Uint8Array,
): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function canonicalSyntheticHandoffJsonBytes(value: unknown): Uint8Array {
  return textEncoder.encode(`${canonicalJson(value)}\n`);
}

function buildDocument(input: {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly archive: Uint8Array;
  readonly availableAt: string;
  readonly form: "10-K" | "10-K/A";
  readonly values: Readonly<Record<string, string>>;
}): Record<string, unknown> {
  return {
    accession: input.accession,
    acceptedAt: input.acceptedAt,
    amendmentOf: input.amendmentOf,
    availableAt: input.availableAt,
    contentSha256: sha256(input.archive),
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

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  const item = value as Record<string, unknown>;
  return `{${Object.keys(item)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(item[key])}`)
    .join(",")}}`;
}

function concatBytes(...values: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((total, value) => total + value.byteLength, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.byteLength;
  }
  return result;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
