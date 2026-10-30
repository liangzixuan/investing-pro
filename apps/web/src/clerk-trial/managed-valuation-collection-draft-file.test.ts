import { expect, it } from "vitest";
import {
  parseValuationAssumptionsPayload,
  type ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";
import {
  formatManagedValuationCollectionDraftFile as format,
  parseManagedValuationCollectionDraftFile as parse,
  decodeValuationCollectionDraftFile as decode,
  isManagedValuationCollectionDraftFileDocument as admitted,
  MANAGED_VALUATION_COLLECTION_DRAFT_FILE_MAX_BYTES as MAX,
} from "./managed-valuation-collection-draft-file";
const scope = `sha256:${"c".repeat(64)}`,
  time = "2026-10-30T00:00:00.000Z",
  enc = new TextEncoder();
function payload(count = 2): ValuationAssumptionsPayload {
  const editor = new ManagedValuationWorkbench();
  editor.activate(eodSelection);
  editor.setDcfField("waccPercent", " 1.. 😀\n");
  return {
    schemaVersion: 1,
    entries: Array.from({ length: count }, (_, i) => ({
      ...structuredClone(editor.captureInputs()!.entry),
      listing: { ...eodSelection.listing, listingId: `invented-${i}` },
    })),
  };
}
function document(p = payload()) {
  return format({ accountScope: scope, capturedAt: time, payload: p })!;
}
it("round trips the entire ordered collection and canonical envelope without editor/calculation data", () => {
  const p = payload(),
    d = document(p);
  expect(d.byteLength).toBe(enc.encode(d.text).length);
  expect(admitted(d)).toBe(true);
  expect(parse(d.text, scope)?.payload).toEqual(p);
  expect(
    decode(enc.encode(d.text).buffer, d.byteLength, scope)?.payload,
  ).toEqual(p);
  expect(d.filename).toBe(
    "Investment-valuation-collection-draft-2026-10-30T00-00-00-000Z.json",
  );
  expect(JSON.parse(d.text)).toHaveProperty(
    "payload.entries.1.listing.listingId",
    "invented-1",
  );
  expect(admitted({ ...d, byteLength: d.byteLength + 1 })).toBe(false);
});
it("accepts empty and maximum-count collections; refuses duplicate listing IDs and overflow", () => {
  expect(document(payload(0))).not.toBeNull();
  expect(
    format({ accountScope: scope, capturedAt: time, payload: payload(20) }),
  ).not.toBeNull();
  expect(
    format({ accountScope: scope, capturedAt: time, payload: payload(21) }),
  ).toBeNull();
  const p = payload();
  expect(
    format({
      accountScope: scope,
      capturedAt: time,
      payload: { ...p, entries: [p.entries[0]!, p.entries[0]!] },
    }),
  ).toBeNull();
});
it("refuses versions, extra fields, malformed model maps, foreign scope and decoded duplicate keys", () => {
  const d = document(),
    raw = {
      format: "investment-valuation-collection-draft",
      version: 1,
      accountScope: scope,
      capturedAt: time,
      payload: payload(),
    },
    entry = raw.payload.entries[0]!;
  const withFirst = (value: unknown) => ({
    ...raw,
    payload: {
      ...raw.payload,
      entries: [value, ...raw.payload.entries.slice(1)],
    },
  });
  for (const invalid of [
    { ...raw, version: 2 },
    { ...raw, extra: 1 },
    { ...raw, payload: { ...raw.payload, extra: 1 } },
    withFirst({ ...entry, dcf: { ...entry.dcf, modelVersion: "future" } }),
    withFirst({
      ...entry,
      exit: {
        ...entry.exit,
        inputs: { ...entry.exit.inputs, baseRevenue: "x".repeat(513) },
      },
    }),
    withFirst({
      ...entry,
      dcf: {
        ...entry.dcf,
        inputs: { ...entry.dcf.inputs, waccPercent: "\ud800" },
      },
    }),
  ])
    expect(parse(JSON.stringify(invalid), scope)).toBeNull();
  expect(parse(d.text, `sha256:${"d".repeat(64)}`)).toBeNull();
  expect(
    parse(
      d.text.replace('"version":1', '"version":1,"ver\\u0073ion":1'),
      scope,
    ),
  ).toBeNull();
  expect(
    parse(
      d.text.replace('"waccPercent":', '"waccPercent":"x","waccPercent":'),
      scope,
    ),
  ).toBeNull();
});
it("checks advertised and actual bytes, fatal UTF-8 and the raw complete-file cap", () => {
  const d = document(),
    bytes = enc.encode(d.text);
  expect(decode(bytes.buffer, bytes.length + 1, scope)).toBeNull();
  expect(decode(new Uint8Array([0xc3, 0x28]).buffer, 2, scope)).toBeNull();
  for (const size of [0, -1, 1.5, MAX + 1])
    expect(decode(bytes.buffer, size, scope)).toBeNull();
  expect(parse(d.text + " ".repeat(MAX), scope)).toBeNull();
});
it("derives the whole-file boundary from a maximum valid canonical payload with no clipping", () => {
  const p = structuredClone(payload(20));
  const fields: { owner: Record<string, unknown>; key: string }[] = [];
  const collect = (o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o))
      if (typeof v === "string") fields.push({ owner: o, key: k });
      else if (v && typeof v === "object")
        collect(v as Record<string, unknown>);
  };
  for (const entry of p.entries) {
    collect(entry.dcf.inputs);
    collect(entry.exit.inputs);
  }
  let lo = 0,
    hi = 512;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    for (const f of fields) f.owner[f.key] = "x".repeat(mid);
    if (enc.encode(JSON.stringify(p)).length <= 262144) lo = mid;
    else hi = mid - 1;
  }
  for (const f of fields) f.owner[f.key] = "x".repeat(lo);
  let remaining = 262144 - enc.encode(JSON.stringify(p)).length;
  for (const f of fields) {
    const text = f.owner[f.key] as string,
      add = Math.min(512 - text.length, remaining);
    f.owner[f.key] = text + "x".repeat(add);
    remaining -= add;
  }
  expect(remaining).toBe(0);
  expect(parseValuationAssumptionsPayload(p)).not.toBeNull();
  const d = document(p);
  expect(d.byteLength).toBe(MAX);
  expect(parse(d.text, scope)?.payload).toEqual(p);
  const spare = fields.find((f) => (f.owner[f.key] as string).length < 512)!;
  spare.owner[spare.key] = (spare.owner[spare.key] as string) + "x";
  expect(
    format({ accountScope: scope, capturedAt: time, payload: p }),
  ).toBeNull();
  expect(parse(d.text + " ", scope)).toBeNull();
});
