import { describe, expect, it, vi } from "vitest";
import {
  parseValuationAssumptionEntry,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";
import {
  assertValuationDraftFileSize,
  decodeValuationDraftFile,
  formatManagedValuationDraftFile,
  isManagedValuationDraftFileDocument,
  MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES,
  parseManagedValuationDraftFile,
  type ManagedValuationDraftFileInput,
} from "./managed-valuation-draft-file";

const SCOPE = `sha256:${"a".repeat(64)}`;
const OTHER_SCOPE = `sha256:${"b".repeat(64)}`;
const TIME = "2026-10-22T10:01:02.345Z";
const encoder = new TextEncoder();
function entry(): ValuationAssumptionEntry {
  const editor = new ManagedValuationWorkbench();
  editor.activate(eodSelection);
  editor.setDcfField("waccPercent", " 1.. 😀\n");
  editor.setDcfField("dilutedShares", "");
  editor.setExitField("baseRevenue", " 0001.00 ");
  editor.setExitScenario("expansion", "exitMultiple", "invalid");
  return structuredClone(editor.captureInputs()!.entry);
}
function input(): ManagedValuationDraftFileInput {
  return { accountScope: SCOPE, capturedAt: TIME, entry: entry() };
}
function content() {
  return {
    format: "investment-valuation-inputs-draft",
    version: 1,
    ...input(),
  };
}
function parse(value: unknown) {
  return parseManagedValuationDraftFile(JSON.stringify(value), SCOPE);
}
function format(value: unknown) {
  return formatManagedValuationDraftFile(
    value as ManagedValuationDraftFileInput,
  );
}

describe("valuation editor file round trips", () => {
  it("retains both exact raw input maps, listing identity, CIK and model versions without calculating", () => {
    const original = input();
    const document = formatManagedValuationDraftFile(original)!;
    expect(document).toMatchObject({
      filename:
        "Investment-valuation-inputs-draft-2026-10-22T10-01-02-345Z.json",
      mime: "application/json",
      accountScope: SCOPE,
      capturedAt: TIME,
    });
    expect(document.byteLength).toBe(encoder.encode(document.text).byteLength);
    expect(parseManagedValuationDraftFile(document.text, SCOPE)).toEqual(
      content(),
    );
    expect(isManagedValuationDraftFileDocument(document)).toBe(true);
    expect(original.entry.dcf.inputs.waccPercent).toBe(" 1.. 😀\n");
    expect(original.entry.exit.inputs.baseRevenue).toBe(" 0001.00 ");
    expect(
      Object.keys(JSON.parse(document.text) as Record<string, unknown>),
    ).toEqual(["format", "version", "accountScope", "capturedAt", "entry"]);
    expect(Object.keys(document)).not.toContain("baseVersion");
    expect(document.text).not.toContain("calculation");
  });
  it("owns detached deeply frozen inputs and admits exact 512-code-point raw fields", () => {
    const base = input();
    const original = {
      ...base,
      entry: {
        ...base.entry,
        dcf: {
          ...base.entry.dcf,
          inputs: { ...base.entry.dcf.inputs, waccPercent: "😀".repeat(512) },
        },
      },
    };
    const document = formatManagedValuationDraftFile(original)!;
    const candidate = parseManagedValuationDraftFile(document.text, SCOPE)!;
    expect(candidate.entry).not.toBe(original.entry);
    expect(Object.isFrozen(candidate.entry.listing)).toBe(true);
    expect(Object.isFrozen(candidate.entry.dcf.inputs.scenarios.base)).toBe(
      true,
    );
    expect(Object.isFrozen(candidate.entry.exit.inputs)).toBe(true);
    expect(Object.isFrozen(document)).toBe(true);
    (original.entry.exit.inputs as { baseRevenue: string }).baseRevenue =
      "later";
    expect(candidate.entry.exit.inputs.baseRevenue).toBe(" 0001.00 ");
    expect(candidate.entry.dcf.inputs.waccPercent).toBe("😀".repeat(512));
  });
});

describe("strict valuation editor file admission", () => {
  it("separates account/backend scope and unrelated file formats", () => {
    const document = formatManagedValuationDraftFile(input())!;
    expect(
      parseManagedValuationDraftFile(document.text, OTHER_SCOPE),
    ).toBeNull();
    expect(parseManagedValuationDraftFile(document.text, "invalid")).toBeNull();
    for (const name of [
      "investment-followups-draft",
      "investment-portfolio-draft",
      "investment-watchlist-draft",
    ])
      expect(parse({ ...content(), format: name })).toBeNull();
  });
  it.each([
    { version: 2 },
    { extra: true },
    { baseVersion: 3 },
    { capturedAt: "2026-02-30T00:00:00.000Z" },
    { capturedAt: "2026-10-22T10:01:02Z" },
    { accountScope: `sha256:${"A".repeat(64)}` },
  ])("refuses invalid envelope %j", (change) =>
    expect(parse({ ...content(), ...change })).toBeNull(),
  );
  it("refuses malformed identity, model, raw input and calculated-data additions through the entry parser", () => {
    const e = entry();
    for (const value of [
      null,
      { ...e, cik: "1" },
      { ...e, catalogSnapshotSha256: "unknown" },
      { ...e, listing: { ...e.listing, listingId: "" } },
      { ...e, dcf: { ...e.dcf, modelVersion: "future" } },
      { ...e, exit: { ...e.exit, modelVersion: "future" } },
      {
        ...e,
        dcf: {
          ...e.dcf,
          inputs: { ...e.dcf.inputs, waccPercent: "x".repeat(513) },
        },
      },
      {
        ...e,
        exit: {
          ...e.exit,
          inputs: { ...e.exit.inputs, baseRevenue: "\ud800" },
        },
      },
      { ...e, exit: { ...e.exit, inputs: { ...e.exit.inputs, cash: 1 } } },
      { ...e, calculatedValue: "100" },
      {
        ...e,
        exit: { ...e.exit, inputs: { ...e.exit.inputs, scenarios: {} } },
      },
    ]) {
      expect(parseValuationAssumptionEntry(value)).toBeNull();
      expect(parse({ ...content(), entry: value })).toBeNull();
      expect(format({ ...input(), entry: value })).toBeNull();
    }
  });
  it("refuses duplicate decoded keys at envelope, listing and scenario depth", () => {
    const text = JSON.stringify(content());
    for (const duplicate of [
      text.replace('"version":1', '"version":1,"version":1'),
      text.replace('"cik":', '"cik":null,"cik":'),
      text.replace('"waccPercent":', '"wacc\\u0050ercent":"1","waccPercent":'),
      text.replace('"exitMultiple":', '"exitMultiple":"1","exitMultiple":'),
    ])
      expect(parseManagedValuationDraftFile(duplicate, SCOPE)).toBeNull();
  });
  it("refuses missing fields, getters, hidden extras and inherited input without invoking getters", () => {
    for (const key of Object.keys(content())) {
      const value: Record<string, unknown> = { ...content() };
      delete value[key];
      expect(parse(value)).toBeNull();
    }
    const getter = vi.fn();
    const value = input();
    Object.defineProperty(value.entry.dcf.inputs, "waccPercent", {
      enumerable: true,
      get: getter,
    });
    expect(format(value)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    const hidden = input();
    Object.defineProperty(hidden, "extra", { value: true });
    expect(format(hidden)).toBeNull();
    expect(
      format(Object.assign(Object.create({ inherited: true }), input())),
    ).toBeNull();
  });
});

describe("valuation file bytes and canonical delivery", () => {
  it.each([0, -1, 1.5, NaN, Infinity, 131073])(
    "refuses advertised byte size %s",
    (size) => expect(() => assertValuationDraftFileSize(size)).toThrow("size"),
  );
  it("admits exact 128KiB bytes and refuses one more byte", () => {
    expect(MANAGED_VALUATION_DRAFT_FILE_MAX_BYTES).toBe(131072);
    const document = formatManagedValuationDraftFile(input())!;
    const text = document.text + " ".repeat(131072 - document.byteLength);
    const bytes = encoder.encode(text);
    expect(
      decodeValuationDraftFile(bytes.buffer, bytes.byteLength, SCOPE),
    ).not.toBeNull();
    expect(parseManagedValuationDraftFile(text + " ", SCOPE)).toBeNull();
  });
  it("checks actual bytes and rejects malformed UTF-8, BOM and invalid Unicode", () => {
    const document = formatManagedValuationDraftFile(input())!;
    const bytes = encoder.encode(document.text);
    expect(
      decodeValuationDraftFile(bytes.buffer, bytes.byteLength, SCOPE),
    ).toEqual(content());
    expect(
      decodeValuationDraftFile(bytes.buffer, bytes.byteLength - 1, SCOPE),
    ).toBeNull();
    expect(
      decodeValuationDraftFile(new Uint8Array([0xc3, 0x28]).buffer, 2, SCOPE),
    ).toBeNull();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
    expect(
      decodeValuationDraftFile(bom.buffer, bom.byteLength, SCOPE),
    ).toBeNull();
    expect(parseManagedValuationDraftFile("\ud800", SCOPE)).toBeNull();
  });
  it.each([
    { filename: "other.json" },
    { mime: "text/plain" },
    { byteLength: 1 },
    { accountScope: OTHER_SCOPE },
    { capturedAt: "2026-10-23T10:01:02.345Z" },
    { baseVersion: 1 },
    { extra: true },
  ])("refuses wrapper tampering %j", (change) =>
    expect(
      isManagedValuationDraftFileDocument({
        ...formatManagedValuationDraftFile(input())!,
        ...change,
      }),
    ).toBe(false),
  );
  it("admits readable noncanonical JSON for review but not delivery", () => {
    const document = formatManagedValuationDraftFile(input())!;
    const text = JSON.stringify(content(), null, 2);
    expect(parseManagedValuationDraftFile(text, SCOPE)).toEqual(content());
    expect(
      isManagedValuationDraftFileDocument({
        ...document,
        text,
        byteLength: encoder.encode(text).byteLength,
      }),
    ).toBe(false);
    expect(isManagedValuationDraftFileDocument(null)).toBe(false);
  });
});
