/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- The sealed dependency-free worker is plain JavaScript; exact source guards and adversarial runtime tests cover its untyped protocol boundary. */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const INPUT = "/input/filing.zip";
const TAXONOMY = "/worker/taxonomy-v1.json";
const ENTRIES = ["filing-manifest.json", "filing.xml"];
const MAX = {
  archive: 1_048_576,
  manifest: 16_384,
  xml: 2_097_152,
  total: 2_113_536,
  ratio: 100,
  output: 131_072,
};
const ACCESSION = /^SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}$/;
const IDENTIFIER =
  /^(?:entity|instrument)\.synthetic\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const UTC =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/;
const MANIFEST_KEYS = [
  "accession",
  "acceptedAt",
  "amendmentOf",
  "availableAt",
  "document",
  "entityId",
  "form",
  "instrumentId",
  "schemaVersion",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
];
const TAXONOMY_EXPECTED = {
  family: "rc-synthetic-ten-fact",
  version: "1.0.0",
  namespace: "urn:research-cockpit:synthetic:filing-normalization-execution:v1",
  facts: [
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
    [
      "operating_cash_flow",
      "rc-synthetic:OperatingCashFlow",
      "duration",
      "USD",
    ],
    ["operating_income", "rc-synthetic:OperatingIncome", "duration", "USD"],
    ["revenue", "rc-synthetic:Revenue", "duration", "USD"],
  ].map(([key, concept, periodKind, unit]) => ({
    key,
    concept,
    periodKind,
    unit,
  })),
};

function fail(message) {
  throw new Error(message);
}
function exactKeys(value, keys, label) {
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== null
  )
    fail(`${label}: record required`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    fail(`${label}: unexpected keys`);
}
export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  fail("unsupported JSON value");
}

// A deliberately small JSON reader: duplicate properties are rejected before conversion.
export function parseClosedJson(buffer, label, requireCanonical = false) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.includes(0) ||
    [...buffer].some((byte) => byte > 0x7f)
  )
    fail(`${label}: ASCII JSON required`);
  const source = buffer.toString("ascii");
  let at = 0;
  const ws = () => {
    while (/\s/.test(source[at] ?? "")) at++;
  };
  const value = () => {
    ws();
    const ch = source[at];
    if (ch === '"') return string();
    if (ch === "{") return object();
    if (ch === "[") return array();
    for (const [word, result] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ])
      if (source.startsWith(word, at)) {
        at += word.length;
        return result;
      }
    const match = source
      .slice(at)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!match) fail(`${label}: invalid JSON`);
    at += match[0].length;
    const result = Number(match[0]);
    if (!Number.isSafeInteger(result)) fail(`${label}: integer required`);
    return result;
  };
  const string = () => {
    const start = at++;
    let escaped = false;
    while (at < source.length) {
      const code = source.charCodeAt(at);
      const ch = source[at++];
      if (!escaped && ch === '"') {
        try {
          return JSON.parse(source.slice(start, at));
        } catch {
          fail(`${label}: invalid string`);
        }
      }
      if (!escaped && code < 0x20) fail(`${label}: control character`);
      if (!escaped && ch === "\\") escaped = true;
      else escaped = false;
    }
    fail(`${label}: unterminated string`);
  };
  const object = () => {
    at++;
    const result = Object.create(null);
    const seen = new Set();
    ws();
    if (source[at] === "}") {
      at++;
      return result;
    }
    while (true) {
      ws();
      if (source[at] !== '"') fail(`${label}: property required`);
      const key = string();
      if (seen.has(key)) fail(`${label}: duplicate property`);
      seen.add(key);
      ws();
      if (source[at++] !== ":") fail(`${label}: colon required`);
      result[key] = value();
      ws();
      const separator = source[at++];
      if (separator === "}") return result;
      if (separator !== ",") fail(`${label}: separator required`);
    }
  };
  const array = () => {
    at++;
    const result = [];
    ws();
    if (source[at] === "]") {
      at++;
      return result;
    }
    while (true) {
      result.push(value());
      ws();
      const separator = source[at++];
      if (separator === "]") return result;
      if (separator !== ",") fail(`${label}: separator required`);
    }
  };
  const result = value();
  ws();
  if (at !== source.length) fail(`${label}: trailing input`);
  if (requireCanonical && source !== `${canonicalJson(result)}\n`)
    fail(`${label}: non-canonical encoding`);
  return result;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u16(b, o) {
  if (o + 2 > b.length) fail("ZIP: truncated");
  return b.readUInt16LE(o);
}
function u32(b, o) {
  if (o + 4 > b.length) fail("ZIP: truncated");
  return b.readUInt32LE(o);
}
function validName(name) {
  if (
    !ENTRIES.includes(name) ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    name === "." ||
    name === ".."
  )
    fail("ZIP: unsafe or unexpected path");
}

export function readClosedZip(archive) {
  if (
    !Buffer.isBuffer(archive) ||
    archive.length > MAX.archive ||
    archive.length < 22
  )
    fail("ZIP: invalid archive size");
  const eocd = archive.length - 22;
  if (
    u32(archive, eocd) !== 0x06054b50 ||
    u16(archive, eocd + 20) !== 0 ||
    u16(archive, eocd + 4) !== 0 ||
    u16(archive, eocd + 6) !== 0
  )
    fail("ZIP: non-canonical end record");
  const count = u16(archive, eocd + 10),
    centralSize = u32(archive, eocd + 12),
    centralAt = u32(archive, eocd + 16);
  if (
    count !== 2 ||
    u16(archive, eocd + 8) !== 2 ||
    centralAt + centralSize !== eocd
  )
    fail("ZIP: closed two-entry archive required");
  let cursor = centralAt;
  const records = [];
  const names = new Set();
  for (let i = 0; i < count; i++) {
    if (u32(archive, cursor) !== 0x02014b50)
      fail("ZIP: central header required");
    const made = u16(archive, cursor + 4),
      flags = u16(archive, cursor + 8),
      method = u16(archive, cursor + 10),
      crc = u32(archive, cursor + 16),
      compressed = u32(archive, cursor + 20),
      size = u32(archive, cursor + 24),
      nl = u16(archive, cursor + 28),
      extra = u16(archive, cursor + 30),
      comment = u16(archive, cursor + 32),
      disk = u16(archive, cursor + 34),
      attrs = u32(archive, cursor + 38),
      local = u32(archive, cursor + 42);
    if (
      made !== 0x0314 ||
      flags !== 0x0800 ||
      ![0, 8].includes(method) ||
      extra ||
      comment ||
      disk ||
      (attrs & 0xffff) !== 0 ||
      ((attrs >>> 16) & 0o170000) !== 0o100000
    )
      fail("ZIP: unsupported metadata");
    const end = cursor + 46 + nl + extra + comment;
    if (end > eocd) fail("ZIP: truncated central header");
    const name = archive
      .subarray(cursor + 46, cursor + 46 + nl)
      .toString("ascii");
    if (
      !Buffer.from(name, "ascii").equals(
        archive.subarray(cursor + 46, cursor + 46 + nl),
      )
    )
      fail("ZIP: ASCII names required");
    validName(name);
    if (names.has(name)) fail("ZIP: duplicate entry");
    names.add(name);
    records.push({ name, flags, method, crc, compressed, size, local });
    cursor = end;
  }
  if (cursor !== eocd || ENTRIES.some((n) => !names.has(n)))
    fail("ZIP: entry set mismatch");
  records.sort((a, b) => a.local - b.local);
  if (records[0].local !== 0) fail("ZIP: leading bytes");
  const result = Object.create(null);
  let localCursor = 0,
    total = 0;
  for (const r of records) {
    if (r.local !== localCursor || u32(archive, r.local) !== 0x04034b50)
      fail("ZIP: local layout mismatch");
    const flags = u16(archive, r.local + 6),
      method = u16(archive, r.local + 8),
      crc = u32(archive, r.local + 14),
      compressed = u32(archive, r.local + 18),
      size = u32(archive, r.local + 22),
      nl = u16(archive, r.local + 26),
      extra = u16(archive, r.local + 28),
      ns = r.local + 30,
      data = ns + nl + extra,
      end = data + compressed;
    const name = archive.subarray(ns, ns + nl).toString("ascii");
    if (
      name !== r.name ||
      flags !== r.flags ||
      method !== r.method ||
      crc !== r.crc ||
      compressed !== r.compressed ||
      size !== r.size ||
      extra ||
      end > centralAt
    )
      fail("ZIP: local/central disagreement");
    const limit = r.name === ENTRIES[0] ? MAX.manifest : MAX.xml;
    if (
      size > limit ||
      (compressed === 0 ? size !== 0 : size / compressed > MAX.ratio)
    )
      fail("ZIP: entry limit exceeded");
    const payload = archive.subarray(data, end);
    let bytes;
    try {
      if (method === 0) bytes = Buffer.from(payload);
      else {
        const inflated = inflateRawSync(payload, {
          info: true,
          maxOutputLength: size + 1,
        });
        if (inflated.engine.bytesWritten !== payload.length)
          fail("ZIP: trailing deflate data");
        bytes = inflated.buffer;
      }
    } catch {
      fail("ZIP: invalid compressed payload");
    }
    if (
      bytes.length !== size ||
      crc32(bytes) !== crc ||
      bytes.subarray(0, 4).equals(Buffer.from("504b0304", "hex"))
    )
      fail("ZIP: invalid entry content");
    result[name] = bytes;
    total += size;
    localCursor = end;
  }
  if (localCursor !== centralAt || total > MAX.total)
    fail("ZIP: aggregate/layout limit");
  return result;
}

function validDate(value, label) {
  if (
    typeof value !== "string" ||
    !DATE.test(value) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail(`${label}: date`);
}
function validUtc(value, label) {
  if (
    typeof value !== "string" ||
    !UTC.test(value) ||
    new Date(value).toISOString() !== value
  )
    fail(`${label}: timestamp`);
}
function parseAttrs(source, label) {
  const attrs = Object.create(null);
  let at = 0;
  while (at < source.length) {
    const ws = source.slice(at).match(/^\s+/);
    if (!ws) fail(`${label}: attribute spacing`);
    at += ws[0].length;
    if (at === source.length) break;
    const keyMatch = source.slice(at).match(/^[A-Za-z_][A-Za-z0-9_.:-]*/);
    if (!keyMatch) fail(`${label}: attribute name`);
    const key = keyMatch[0];
    at += key.length;
    if (source.slice(at, at + 2) !== '="') fail(`${label}: attribute syntax`);
    at += 2;
    const end = source.indexOf('"', at);
    if (end < 0) fail(`${label}: quote`);
    const value = source.slice(at, end);
    if (value.includes("&") || Object.hasOwn(attrs, key))
      fail(`${label}: duplicate/entity attribute`);
    attrs[key] = value;
    at = end + 1;
    if (Object.keys(attrs).length > 16) fail(`${label}: too many attributes`);
  }
  return attrs;
}

export function parseClosedXml(buffer, taxonomy) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.includes(0) ||
    [...buffer].some((b) => b > 0x7f)
  )
    fail("XML: ASCII required");
  const xml = buffer.toString("ascii");
  const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
  if (!xml.startsWith(declaration)) fail("XML: declaration");
  const lower = xml.toLowerCase();
  for (const marker of [
    "<!doctype",
    "<!entity",
    "<![cdata[",
    "<!--",
    "<?xml-stylesheet",
    "xinclude",
    ":include",
  ])
    if (lower.includes(marker)) fail("XML: forbidden directive");
  if (xml.slice(declaration.length).includes("<?") || xml.includes("&"))
    fail("XML: processing instruction/entity");
  let rest = xml.slice(declaration.length);
  const root = rest.match(/^<filing([^>]*)>/);
  if (!root) fail("XML: root");
  const rootAttrs = parseAttrs(root[1], "XML root");
  exactKeys(
    rootAttrs,
    ["xmlns", "taxonomyFamily", "taxonomyVersion"],
    "XML root",
  );
  if (
    rootAttrs.xmlns !== taxonomy.namespace ||
    rootAttrs.taxonomyFamily !== taxonomy.family ||
    rootAttrs.taxonomyVersion !== taxonomy.version
  )
    fail("XML: taxonomy");
  rest = rest.slice(root[0].length);
  const facts = [];
  while (true) {
    const whitespace = rest.match(/^\s*/)[0];
    rest = rest.slice(whitespace.length);
    if (rest.startsWith("</filing>")) {
      rest = rest.slice(10);
      break;
    }
    const opening = rest.match(/^<fact([^>]*)>/);
    if (!opening) fail("XML: fact element");
    const attrs = parseAttrs(opening[1], "XML fact");
    exactKeys(
      attrs,
      ["key", "concept", "dimensions", "periodEnd", "periodStart", "unit"],
      "XML fact",
    );
    const close = rest.indexOf("</fact>", opening[0].length);
    if (close < 0) fail("XML: unclosed fact");
    const value = rest.slice(opening[0].length, close);
    if (value.includes("<") || value.includes(">") || value.includes("&"))
      fail("XML: nested fact content");
    facts.push({ ...attrs, value });
    if (facts.length > 10) fail("XML: fact count");
    rest = rest.slice(close + 7);
  }
  if (!/^\s*$/.test(rest) || facts.length !== 10 || xml.length > 1_048_576)
    fail("XML: trailing content/fact count");
  return facts;
}

export function parseArchiveBytes(archive, taxonomyBytes) {
  const taxonomy = parseClosedJson(taxonomyBytes, "taxonomy");
  if (canonicalJson(taxonomy) !== canonicalJson(TAXONOMY_EXPECTED))
    fail("taxonomy: unsupported");
  const entries = readClosedZip(archive);
  const manifest = parseClosedJson(entries[ENTRIES[0]], "manifest", true);
  exactKeys(manifest, MANIFEST_KEYS, "manifest");
  if (
    manifest.schemaVersion !== "1.0.0" ||
    !ACCESSION.test(manifest.accession) ||
    !IDENTIFIER.test(manifest.entityId) ||
    !IDENTIFIER.test(manifest.instrumentId) ||
    manifest.document !== "filing.xml" ||
    manifest.synthetic !== true ||
    manifest.taxonomyFamily !== taxonomy.family ||
    manifest.taxonomyVersion !== taxonomy.version
  )
    fail("manifest: identifiers/contract");
  validUtc(manifest.acceptedAt, "manifest acceptedAt");
  validUtc(manifest.availableAt, "manifest availableAt");
  if (manifest.availableAt < manifest.acceptedAt)
    fail("manifest: availability");
  if (
    !["10-K", "10-K/A"].includes(manifest.form) ||
    (manifest.form === "10-K"
      ? manifest.amendmentOf !== null
      : typeof manifest.amendmentOf !== "string" ||
        !ACCESSION.test(manifest.amendmentOf) ||
        manifest.amendmentOf === manifest.accession)
  )
    fail("manifest: form/amendment");
  const facts = parseClosedXml(entries[ENTRIES[1]], taxonomy);
  const contracts = new Map(taxonomy.facts.map((f) => [f.key, f]));
  const seen = new Set();
  let durationStart = null;
  for (const [index, fact] of facts.entries()) {
    const contract = taxonomy.facts[index];
    if (
      !contract ||
      fact.key !== contract.key ||
      seen.has(fact.key) ||
      fact.concept !== contract.concept ||
      fact.unit !== contract.unit ||
      fact.dimensions !== "none"
    )
      fail("facts: duplicate/order/contract");
    seen.add(fact.key);
    validDate(fact.periodEnd, "fact periodEnd");
    if (index === 0) manifest.periodEnd = fact.periodEnd;
    else if (fact.periodEnd !== manifest.periodEnd)
      fail("facts: mixed periodEnd");
    if (
      contract.periodKind === "instant"
        ? fact.periodStart !== "none"
        : fact.periodStart === "none"
    )
      fail("facts: period kind");
    if (contract.periodKind === "duration") {
      validDate(fact.periodStart, "fact periodStart");
      if (fact.periodStart >= fact.periodEnd) fail("facts: duration range");
      if (durationStart === null) durationStart = fact.periodStart;
      else if (durationStart !== fact.periodStart)
        fail("facts: mixed periodStart");
    }
    if (
      fact.value !== fact.value.trim() ||
      !DECIMAL.test(fact.value) ||
      fact.value === "-0"
    )
      fail("facts: decimal");
  }
  if (seen.size !== contracts.size) fail("facts: incomplete");
  const document = {
    accession: manifest.accession,
    acceptedAt: manifest.acceptedAt,
    amendmentOf: manifest.amendmentOf,
    availableAt: manifest.availableAt,
    contentSha256: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
    entityId: manifest.entityId,
    facts: facts.map((f) => ({
      concept: f.concept,
      dimensions: {},
      key: f.key,
      periodEnd: f.periodEnd,
      periodStart: f.periodStart === "none" ? null : f.periodStart,
      unit: f.unit,
      value: f.value,
    })),
    form: manifest.form,
    instrumentId: manifest.instrumentId,
    parserVersion: "synthetic-ten-fact-producer-v1",
    schemaVersion: "1.0.0",
    synthetic: true,
    taxonomyFamily: taxonomy.family,
    taxonomyVersion: taxonomy.version,
  };
  const output = Buffer.from(`${canonicalJson(document)}\n`);
  if (output.length > MAX.output) fail("output: limit");
  return output;
}

async function main() {
  const [archive, taxonomy] = await Promise.all([
    readFile(INPUT),
    readFile(TAXONOMY),
  ]);
  process.stdout.write(parseArchiveBytes(archive, taxonomy));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main().catch(() => {
    process.exitCode = 2;
  });
