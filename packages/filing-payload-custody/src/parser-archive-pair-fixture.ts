import { createHash } from "node:crypto";

import { FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES } from "./parser-archive-pair-custody";

export interface SyntheticFilingParserArchivePairFixture {
  readonly amendmentArchive: Uint8Array;
  readonly originalArchive: Uint8Array;
}

interface ArchiveSource {
  readonly accession: string;
  readonly acceptedAt: string;
  readonly amendmentOf: string | null;
  readonly availableAt: string;
  readonly form: "10-K" | "10-K/A";
  readonly values: Readonly<Record<FactKey, string>>;
}

const FACT_CONTRACTS = [
  ["assets", "rc-synthetic:Assets", "instant", "USD"],
  ["cash", "rc-synthetic:CashAndCashEquivalents", "instant", "USD"],
  ["debt", "rc-synthetic:Debt", "instant", "USD"],
  [
    "diluted_shares",
    "rc-synthetic:WeightedAverageDilutedShares",
    "duration",
    "shares",
  ],
  ["free_cash_flow", "rc-synthetic:FreeCashFlow", "duration", "USD"],
  ["gross_profit", "rc-synthetic:GrossProfit", "duration", "USD"],
  ["net_income", "rc-synthetic:NetIncome", "duration", "USD"],
  ["operating_cash_flow", "rc-synthetic:OperatingCashFlow", "duration", "USD"],
  ["operating_income", "rc-synthetic:OperatingIncome", "duration", "USD"],
  ["revenue", "rc-synthetic:Revenue", "duration", "USD"],
] as const;
type FactKey = (typeof FACT_CONTRACTS)[number][0];

const NAMESPACE =
  "urn:research-cockpit:synthetic:filing-normalization-execution:v1";
const TEXT_ENCODER = new TextEncoder();

export function createSyntheticFilingParserArchivePairFixture(): SyntheticFilingParserArchivePairFixture {
  const originalSource: ArchiveSource = Object.freeze({
    accession: "SYN-0000000001-26-000001",
    acceptedAt: "2026-02-20T20:00:00.000Z",
    amendmentOf: null,
    availableAt: "2026-02-20T20:00:01.000Z",
    form: "10-K",
    values: Object.freeze({
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
    }),
  });
  const amendmentSource: ArchiveSource = Object.freeze({
    accession: "SYN-0000000001-26-000002",
    acceptedAt: "2026-03-15T20:00:00.000Z",
    amendmentOf: originalSource.accession,
    availableAt: "2026-03-15T20:00:01.000Z",
    form: "10-K/A",
    values: Object.freeze({
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
    }),
  });
  const originalArchive = buildArchive(originalSource);
  const amendmentArchive = buildArchive(amendmentSource);
  assertFixture(originalArchive, "original");
  assertFixture(amendmentArchive, "amendment");
  return Object.freeze({ amendmentArchive, originalArchive });
}

function buildArchive(source: ArchiveSource): Uint8Array {
  const manifest = canonicalBytes({
    accession: source.accession,
    acceptedAt: source.acceptedAt,
    amendmentOf: source.amendmentOf,
    availableAt: source.availableAt,
    document: "filing.xml",
    entityId: "entity.synthetic.syn1",
    form: source.form,
    instrumentId: "instrument.synthetic.syn1",
    schemaVersion: "1.0.0",
    synthetic: true,
    taxonomyFamily: "rc-synthetic-ten-fact",
    taxonomyVersion: "1.0.0",
  });
  const facts = FACT_CONTRACTS.map(
    ([key, concept, periodKind, unit]) =>
      `<fact key="${key}" concept="${concept}" dimensions="none" periodEnd="2025-12-31" periodStart="${periodKind === "instant" ? "none" : "2025-01-01"}" unit="${unit}">${source.values[key]}</fact>`,
  ).join("");
  const xml = TEXT_ENCODER.encode(
    `<?xml version="1.0" encoding="UTF-8"?>\n<filing xmlns="${NAMESPACE}" taxonomyFamily="rc-synthetic-ten-fact" taxonomyVersion="1.0.0">${facts}</filing>\n`,
  );
  return buildStoredZip([
    ["filing-manifest.json", manifest],
    ["filing.xml", xml],
  ]);
}

function buildStoredZip(
  entries: readonly (readonly [name: string, content: Uint8Array])[],
): Uint8Array {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;
  for (const [nameValue, contentValue] of entries) {
    const name = Buffer.from(nameValue, "ascii");
    const content = Buffer.from(contentValue);
    const checksum = crc32(content);
    const local = Buffer.alloc(30 + name.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    content.copy(local, 30 + name.length);
    localRecords.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralRecords.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Uint8Array.from(Buffer.concat([...localRecords, central, end]));
}

function canonicalBytes(value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function crc32(value: Uint8Array): number {
  let checksum = 0xffffffff;
  for (const byte of value) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(checksum & 1);
      checksum = (checksum >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function assertFixture(
  value: Uint8Array,
  role: "amendment" | "original",
): void {
  const fixture = FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES[role];
  const digest = `sha256:${createHash("sha256").update(value).digest("hex")}`;
  if (
    value.byteLength !== fixture.byteLength ||
    digest !== fixture.contentSha256
  )
    throw new TypeError("FILING_PARSER_ARCHIVE_PAIR_FIXTURE_FAILURE");
}
