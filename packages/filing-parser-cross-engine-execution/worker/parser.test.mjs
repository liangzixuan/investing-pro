/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- The sealed dependency-free worker test exercises intentionally untyped hostile inputs under exact source guards. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  canonicalJson,
  parseArchiveBytes,
  parseClosedJson,
  readClosedZip,
} from "./parser.mjs";

const taxonomy = await readFile(new URL("./taxonomy-v1.json", import.meta.url));
const contracts = JSON.parse(taxonomy).facts;
const manifest = {
  accession: "SYN-0000000001-24-000001",
  acceptedAt: "2024-02-20T14:30:00.000Z",
  amendmentOf: null,
  availableAt: "2024-02-20T14:31:00.000Z",
  document: "filing.xml",
  entityId: "entity.synthetic.example",
  form: "10-K",
  instrumentId: "instrument.synthetic.example",
  schemaVersion: "1.0.0",
  synthetic: true,
  taxonomyFamily: "rc-synthetic-ten-fact",
  taxonomyVersion: "1.0.0",
};
const values = ["100", "10", "25", "5", "30", "50", "20", "35", "27", "120"];
const xmlFor = (facts = contracts, change = () => ({})) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<filing xmlns="urn:research-cockpit:synthetic:filing-normalization-execution:v1" taxonomyFamily="rc-synthetic-ten-fact" taxonomyVersion="1.0.0">${facts
    .map((f, i) => {
      const x = {
        key: f.key,
        concept: f.concept,
        dimensions: "none",
        periodEnd: "2023-12-31",
        periodStart: f.periodKind === "duration" ? "2023-01-01" : "none",
        unit: f.unit,
        value: values[i] ?? "1",
        ...change(f, i),
      };
      return `<fact key="${x.key}" concept="${x.concept}" dimensions="${x.dimensions}" periodEnd="${x.periodEnd}" periodStart="${x.periodStart}" unit="${x.unit}">${x.value}</fact>`;
    })
    .join("")}</filing>\n`;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(entries, compress = false) {
  const locals = [],
    centrals = [];
  let offset = 0;
  for (const [nameText, contentText] of entries) {
    const name = Buffer.from(nameText),
      content = Buffer.from(contentText),
      payload = compress ? deflateRawSync(content, { level: 9 }) : content,
      method = compress ? 8 : 0,
      crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, payload);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + payload.length;
  }
  const centralBytes = Buffer.concat(centrals),
    eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}
const archive = (xml = xmlFor(), manifestValue = manifest) =>
  zip([
    ["filing-manifest.json", `${canonicalJson(manifestValue)}\n`],
    ["filing.xml", xml],
  ]);

void test("emits the canonical ten-fact protocol deterministically", () => {
  const one = parseArchiveBytes(archive(), taxonomy),
    two = parseArchiveBytes(archive(), taxonomy);
  assert.deepEqual(one, two);
  const result = JSON.parse(one);
  assert.equal(result.parserVersion, "synthetic-ten-fact-producer-v1");
  assert.equal(result.facts.length, 10);
  assert.equal(one.toString(), `${canonicalJson(result)}\n`);
});
void test("rejects malformed ZIP and unsafe paths", () => {
  assert.throws(() => readClosedZip(Buffer.from("not zip")));
  assert.throws(
    () =>
      readClosedZip(
        zip([
          ["filing-manifest.json", `${canonicalJson(manifest)}\n`],
          ["../filing.xml", xmlFor()],
        ]),
      ),
    /path/,
  );
});
void test("rejects excessive compression ratio", () => {
  assert.throws(
    () =>
      readClosedZip(
        zip(
          [
            ["filing-manifest.json", `${canonicalJson(manifest)}\n`],
            ["filing.xml", "a".repeat(20_000)],
          ],
          true,
        ),
      ),
    /limit/,
  );
});
void test("rejects duplicate manifest properties", () => {
  const duplicate = `${canonicalJson(manifest).replace("{", '{"form":"10-K",')}\n`;
  assert.throws(
    () =>
      parseArchiveBytes(
        zip([
          ["filing-manifest.json", duplicate],
          ["filing.xml", xmlFor()],
        ]),
        taxonomy,
      ),
    /duplicate/,
  );
});
void test("rejects XML directives, entities, comments, and processing instructions", () => {
  for (const payload of [
    "<!DOCTYPE filing>",
    "<!ENTITY x 'x'>",
    "<!--x-->",
    "<?work x?>",
  ]) {
    assert.throws(
      () =>
        parseArchiveBytes(
          archive(xmlFor().replace("<filing", `${payload}<filing`)),
          taxonomy,
        ),
      /XML/,
    );
  }
});
void test("rejects partial and duplicate fact sets", () => {
  assert.throws(
    () => parseArchiveBytes(archive(xmlFor(contracts.slice(0, 9))), taxonomy),
    /fact count/,
  );
  const duplicated = [...contracts.slice(0, 9), contracts[0]];
  assert.throws(
    () => parseArchiveBytes(archive(xmlFor(duplicated)), taxonomy),
    /duplicate/,
  );
});
void test("rejects wrong unit", () => {
  assert.throws(
    () =>
      parseArchiveBytes(
        archive(
          xmlFor(contracts, (f, i) => (i === 0 ? { unit: "shares" } : {})),
        ),
        taxonomy,
      ),
    /contract/,
  );
});
void test("rejects mixed periods and negative zero", () => {
  assert.throws(
    () =>
      parseArchiveBytes(
        archive(
          xmlFor(contracts, (f, i) =>
            i === 1 ? { periodEnd: "2023-12-30" } : {},
          ),
        ),
        taxonomy,
      ),
    /periodEnd/,
  );
  assert.throws(
    () =>
      parseArchiveBytes(
        archive(
          xmlFor(contracts, (f, i) =>
            i === 4 ? { periodStart: "2023-02-01" } : {},
          ),
        ),
        taxonomy,
      ),
    /periodStart/,
  );
  assert.throws(
    () =>
      parseArchiveBytes(
        archive(xmlFor(contracts, (f, i) => (i === 0 ? { value: "-0" } : {}))),
        taxonomy,
      ),
    /decimal/,
  );
});
void test("rejects altered taxonomy", () => {
  const changed = Buffer.from(
    taxonomy.toString().replace("rc-synthetic-ten-fact", "other"),
  );
  assert.throws(() => parseArchiveBytes(archive(), changed), /taxonomy/);
});
void test("rejects noncanonical manifest and dangerous JSON duplicates", () => {
  assert.throws(
    () =>
      parseArchiveBytes(
        zip([
          ["filing-manifest.json", JSON.stringify(manifest)],
          ["filing.xml", xmlFor()],
        ]),
        taxonomy,
      ),
    /non-canonical/,
  );
  assert.throws(
    () =>
      parseClosedJson(Buffer.from('{"__proto__":1,"__proto__":2}'), "probe"),
    /duplicate/,
  );
});
