import { describe, expect, it, vi } from "vitest";
import type { ResearchFollowupsPayload } from "@research-cockpit/contracts";
import {
  assertFollowupsDraftFileSize,
  decodeFollowupsDraftFile,
  formatManagedFollowupsDraftFile,
  isManagedFollowupsDraftFileDocument,
  MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES,
  parseManagedFollowupsDraftFile,
  type ManagedFollowupsDraftFileInput,
} from "./managed-followups-draft-file";

const SCOPE = `sha256:${"a".repeat(64)}`;
const OTHER_SCOPE = `sha256:${"b".repeat(64)}`;
const TIME = "2026-10-22T10:01:02.345Z";
const encoder = new TextEncoder();
function draft(): ResearchFollowupsPayload {
  return {
    schemaVersion: 1,
    entries: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        catalogSnapshotSha256: `sha256:${"c".repeat(64)}`,
        listing: {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "issuer-invented",
          issuerName: "Invented Group",
          listingId: "listing-invented-c",
          securityId: "security-invented-c",
          securityName: "Invented Group Class C",
          shareClassId: "class-invented-c",
          shareClassName: "Class C",
          symbol: "INV",
        },
        check: "Check the stated capacity 🚀 Keep this question complete.",
        dueOn: "2026-10-23",
        result: "Authored result; not a source fact.",
        status: "completed",
        completedOn: "2026-10-22",
      },
    ],
  };
}
function input(): ManagedFollowupsDraftFileInput {
  return {
    accountScope: SCOPE,
    capturedAt: TIME,
    baseVersion: 7,
    draft: draft(),
  };
}
function content() {
  return { format: "investment-followups-draft", version: 1, ...input() };
}
function parse(value: unknown) {
  return parseManagedFollowupsDraftFile(JSON.stringify(value), SCOPE);
}
function format(value: unknown) {
  return formatManagedFollowupsDraftFile(
    value as ManagedFollowupsDraftFileInput,
  );
}

describe("Follow-ups draft file round trips", () => {
  it("preserves complete authored fields, completion and exact listing provenance", () => {
    const original = input();
    const document = formatManagedFollowupsDraftFile(original)!;
    expect(document).toMatchObject({
      filename: "Investment-followups-draft-2026-10-22T10-01-02-345Z.json",
      mime: "application/json",
      accountScope: SCOPE,
      capturedAt: TIME,
      baseVersion: 7,
    });
    expect(document.byteLength).toBe(encoder.encode(document.text).byteLength);
    expect(isManagedFollowupsDraftFileDocument(document)).toBe(true);
    expect(parseManagedFollowupsDraftFile(document.text, SCOPE)).toEqual(
      content(),
    );
    expect(document.text).not.toContain("idempotencyKey");
  });
  it("owns frozen detached entries and listing identities", () => {
    const original = input();
    const document = formatManagedFollowupsDraftFile(original)!;
    const candidate = parseManagedFollowupsDraftFile(document.text, SCOPE)!;
    expect(candidate.draft).not.toBe(original.draft);
    expect(Object.isFrozen(candidate.draft.entries)).toBe(true);
    expect(Object.isFrozen(candidate.draft.entries[0]!.listing)).toBe(true);
    expect(Object.isFrozen(document)).toBe(true);
    (original.draft.entries[0]!.listing as { symbol: string }).symbol = "LATER";
    expect(candidate.draft.entries[0]!.listing.symbol).toBe("INV");
    expect(format(candidate)).toBeNull();
  });
  it("admits an empty draft at an unsaved base and preserves entry order", () => {
    expect(
      format({
        ...input(),
        baseVersion: 0,
        draft: { schemaVersion: 1, entries: [] },
      }),
    ).not.toBeNull();
    const first = draft().entries[0]!;
    const second = {
      ...first,
      id: "22222222-2222-4222-8222-222222222222",
      listing: { ...first.listing, listingId: "listing-invented-d" },
      status: "open",
      completedOn: null,
    };
    const document = format({
      ...input(),
      draft: { schemaVersion: 1, entries: [second, first] },
    })!;
    expect(
      parseManagedFollowupsDraftFile(document.text, SCOPE)!.draft.entries.map(
        (e) => e.id,
      ),
    ).toEqual([second.id, first.id]);
  });
});

describe("Follow-ups draft file refusal", () => {
  it("separates account/backend ownership and other draft formats", () => {
    const document = formatManagedFollowupsDraftFile(input())!;
    expect(
      parseManagedFollowupsDraftFile(document.text, OTHER_SCOPE),
    ).toBeNull();
    expect(
      parseManagedFollowupsDraftFile(document.text, "invalid-scope"),
    ).toBeNull();
    for (const name of [
      "investment-watchlist-draft",
      "investment-portfolio-draft",
    ])
      expect(parse({ ...content(), format: name })).toBeNull();
  });
  it.each([
    { version: 2 },
    { extra: true },
    { capturedAt: "2026-02-30T00:00:00.000Z" },
    { capturedAt: "2026-10-22T10:01:02Z" },
    { baseVersion: -1 },
    { baseVersion: 0.5 },
    { baseVersion: Number.MAX_SAFE_INTEGER + 1 },
    { accountScope: `sha256:${"A".repeat(64)}` },
  ])("refuses invalid envelope fields %j", (change) =>
    expect(parse({ ...content(), ...change })).toBeNull(),
  );
  it.each([
    { check: "" },
    { check: " x " },
    { check: "x".repeat(501) },
    { result: "x".repeat(2001) },
    { dueOn: "2026-02-30" },
    { dueOn: "2026-2-03" },
    { status: "open", completedOn: "2026-10-22" },
    { completedOn: null },
    { check: "\ud800" },
    { extra: true },
  ])(
    "refuses invalid raw fields without normalization or clipping %j",
    (change) => {
      const value = {
        schemaVersion: 1,
        entries: [{ ...draft().entries[0], ...change }],
      };
      expect(format({ ...input(), draft: value })).toBeNull();
      expect(parse({ ...content(), draft: value })).toBeNull();
    },
  );
  it("refuses duplicate entries, malformed containers and unknown schemas", () => {
    for (const value of [
      null,
      { ...draft(), schemaVersion: 2 },
      { ...draft(), extra: true },
      { schemaVersion: 1, entries: [draft().entries[0], draft().entries[0]] },
    ])
      expect(format({ ...input(), draft: value })).toBeNull();
  });
  it("refuses duplicate decoded keys at envelope, entry and identity boundaries", () => {
    const text = JSON.stringify(content());
    for (const duplicate of [
      text.replace('"version":1', '"version":1,"version":1'),
      text.replace(
        '"dueOn":"2026-10-23"',
        '"dueOn":"2026-10-23","due\\u004fn":"2026-10-23"',
      ),
      text.replace('"symbol":"INV"', '"symbol":"INV","symbol":"INV"'),
    ])
      expect(parseManagedFollowupsDraftFile(duplicate, SCOPE)).toBeNull();
  });
  it("refuses missing envelope fields, getters, hidden extras, sparse arrays and inherited input", () => {
    for (const key of Object.keys(content())) {
      const value: Record<string, unknown> = { ...content() };
      delete value[key];
      expect(parse(value)).toBeNull();
    }
    const getter = vi.fn();
    const value = input();
    Object.defineProperty(value.draft.entries[0], "check", {
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
    expect(
      format({
        ...input(),
        draft: { schemaVersion: 1, entries: new Array(1) },
      }),
    ).toBeNull();
  });
});

describe("Follow-ups byte and canonical delivery bounds", () => {
  it.each([
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES + 1,
  ])("refuses advertised size %s", (size) =>
    expect(() => assertFollowupsDraftFileSize(size)).toThrow("size"),
  );
  it("admits exact bytes at the ceiling and refuses one more byte", () => {
    const document = formatManagedFollowupsDraftFile(input())!;
    const text =
      document.text +
      " ".repeat(MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES - document.byteLength);
    const bytes = encoder.encode(text);
    expect(
      decodeFollowupsDraftFile(bytes.buffer, bytes.byteLength, SCOPE),
    ).not.toBeNull();
    expect(parseManagedFollowupsDraftFile(text + " ", SCOPE)).toBeNull();
  });
  it("checks actual bytes and rejects malformed UTF-8, BOM and invalid Unicode", () => {
    const document = formatManagedFollowupsDraftFile(input())!;
    const bytes = encoder.encode(document.text);
    expect(
      decodeFollowupsDraftFile(bytes.buffer, bytes.byteLength, SCOPE),
    ).toEqual(content());
    expect(
      decodeFollowupsDraftFile(bytes.buffer, bytes.byteLength - 1, SCOPE),
    ).toBeNull();
    expect(
      decodeFollowupsDraftFile(new Uint8Array([0xc3, 0x28]).buffer, 2, SCOPE),
    ).toBeNull();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
    expect(
      decodeFollowupsDraftFile(bom.buffer, bom.byteLength, SCOPE),
    ).toBeNull();
    expect(parseManagedFollowupsDraftFile("\ud800", SCOPE)).toBeNull();
  });
  it.each([
    { filename: "other.json" },
    { mime: "text/plain" },
    { byteLength: 1 },
    { accountScope: OTHER_SCOPE },
    { capturedAt: "2026-10-23T10:01:02.345Z" },
    { baseVersion: 8 },
    { extra: true },
  ])("refuses wrapper tampering %j", (change) =>
    expect(
      isManagedFollowupsDraftFileDocument({
        ...formatManagedFollowupsDraftFile(input())!,
        ...change,
      }),
    ).toBe(false),
  );
  it("accepts readable noncanonical JSON for review but not canonical delivery", () => {
    const document = formatManagedFollowupsDraftFile(input())!;
    const text = JSON.stringify(content(), null, 2);
    expect(parseManagedFollowupsDraftFile(text, SCOPE)).toEqual(content());
    expect(
      isManagedFollowupsDraftFileDocument({
        ...document,
        text,
        byteLength: encoder.encode(text).byteLength,
      }),
    ).toBe(false);
    expect(isManagedFollowupsDraftFileDocument(null)).toBe(false);
  });
});
