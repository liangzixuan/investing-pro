import { describe, expect, it, vi } from "vitest";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import {
  formatManagedFinancialScreenRecipe,
  isManagedFinancialScreenRecipeDocument,
  MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES,
  parseManagedFinancialScreenRecipe,
  type ManagedFinancialScreenRecipeInput,
} from "./managed-financial-screen-recipe";

const TIME = "2026-10-23T01:02:03.456Z";
const HASH = `sha256:${"a".repeat(64)}`;
const encoder = new TextEncoder();
function listing(index: number): ManagedEodIdentity {
  return {
    ...eodSelection.listing,
    issuerId: `issuer-${index}`,
    listingId: `listing-${index}`,
    securityId: `security-${index}`,
    shareClassId: `class-${index}`,
    symbol: `S${index}`,
  };
}
function input(): ManagedFinancialScreenRecipeInput {
  return {
    name: "  Cash discipline 東京 📈  ",
    capturedAt: TIME,
    catalogSnapshotSha256: HASH,
    criteria: {
      clauses: [
        { field: "operatingIncome", operator: "gte", value: "0.000" },
        { field: "workingCapital", operator: "lte", value: "-12.3400" },
        {
          field: "currentRatio",
          operator: "gte",
          value: "0.000000000000000001",
        },
      ],
      sort: { field: "operatingCashFlow", direction: "desc" },
    },
    listings: [listing(2), listing(1)],
  };
}
function content() {
  return {
    format: "investment-financial-screen-recipe",
    version: 1,
    ...input(),
  };
}
function format(value: unknown) {
  return formatManagedFinancialScreenRecipe(
    value as ManagedFinancialScreenRecipeInput,
  );
}
function parse(value: unknown) {
  return parseManagedFinancialScreenRecipe(JSON.stringify(value));
}
function withGetter(value: object, key: string, getter: () => unknown) {
  return Object.defineProperty(value, key, {
    enumerable: true,
    configurable: true,
    get: getter,
  });
}

describe("portable managed financial screen definitions", () => {
  it("round-trips the full definition, exact decimal spellings and selected listing order only", () => {
    const original = input();
    const document = formatManagedFinancialScreenRecipe(original)!;
    expect(document).toMatchObject({
      filename:
        "Investment-financial-screen-recipe-2026-10-23T01-02-03-456Z.json",
      mime: "application/json",
      capturedAt: TIME,
    });
    expect(document.byteLength).toBe(encoder.encode(document.text).byteLength);
    expect(parseManagedFinancialScreenRecipe(document.text)).toEqual(content());
    expect(isManagedFinancialScreenRecipeDocument(document)).toBe(true);
    expect(Object.keys(JSON.parse(document.text) as object)).toEqual([
      "format",
      "version",
      "name",
      "capturedAt",
      "catalogSnapshotSha256",
      "criteria",
      "listings",
    ]);
    expect(document.text.endsWith("\n")).toBe(true);
    expect(Object.keys(document)).toEqual([
      "filename",
      "mime",
      "text",
      "byteLength",
      "capturedAt",
    ]);
  });
  it("owns detached deeply frozen values without freezing or rewriting the input", () => {
    const original = input();
    const document = formatManagedFinancialScreenRecipe(original)!;
    const decoded = parseManagedFinancialScreenRecipe(document.text)!;
    for (const value of [
      decoded,
      decoded.criteria,
      decoded.criteria.clauses,
      ...decoded.criteria.clauses,
      decoded.criteria.sort,
      decoded.listings,
      ...decoded.listings,
      document,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(decoded.criteria).not.toBe(original.criteria);
    expect(decoded.listings[0]).not.toBe(original.listings[0]);
    expect(Object.isFrozen(original)).toBe(false);
    Reflect.set(original.listings[0]!, "issuerName", "Later name");
    Reflect.set(original.criteria.clauses[0]!, "value", "99");
    expect(decoded.listings[0]?.issuerName).toBe("Zero Company");
    expect(decoded.criteria.clauses[0]?.value).toBe("0.000");
  });
  it("accepts all 17 distinct issuers, zero clauses and an exact 80-UTF16-unit name", () => {
    const original = {
      ...input(),
      name: "😀".repeat(40),
      criteria: { clauses: [], sort: { field: "symbol", direction: "asc" } },
      listings: Array.from({ length: 17 }, (_, index) => listing(17 - index)),
    };
    const decoded = parseManagedFinancialScreenRecipe(format(original)!.text)!;
    expect(decoded.name).toBe(original.name);
    expect(decoded.listings.map((item) => item.listingId)).toEqual(
      original.listings.map((item) => item.listingId),
    );
    expect(decoded.criteria).toEqual(original.criteria);
  });
  it("canonicalizes object field order without sorting clauses or listings", () => {
    const original = content();
    const reversed = Object.fromEntries(Object.entries(original).reverse());
    const first = original.listings[0]!;
    const fieldsReversed = Object.fromEntries(Object.entries(first).reverse());
    const document = format({
      ...input(),
      listings: [fieldsReversed, original.listings[1]],
    });
    expect(document).toEqual(formatManagedFinancialScreenRecipe(input()));
    expect(parse(reversed)).toEqual(original);
  });
});

describe("closed recipe fields and existing semantic validators", () => {
  it.each([
    "",
    "   ",
    "a".repeat(81),
    "😀".repeat(41),
    "line\nline",
    "line\rline",
    "a\tname",
    "a\u2028b",
    "a\u2029b",
    "a\u200bb",
    "\ud800",
  ])("refuses a blank, oversized, multiline or invalid name %j", (name) => {
    expect(format({ ...input(), name })).toBeNull();
    expect(parse({ ...content(), name })).toBeNull();
  });
  it.each([
    { format: "investment-watchlist-draft" },
    { version: 0 },
    { version: 2 },
    { version: "1" },
    { capturedAt: "2026-02-30T00:00:00.000Z" },
    { capturedAt: "2026-10-23T01:02:03Z" },
    { capturedAt: "2026-10-23T01:02:03.456+00:00" },
    { catalogSnapshotSha256: `sha256:${"A".repeat(64)}` },
    { catalogSnapshotSha256: "invalid" },
    { results: [] },
    { shortlist: [] },
    { note: "private" },
    { accountScope: HASH },
    { baseVersion: 1 },
  ])("refuses unsupported envelope content %j", (change) =>
    expect(parse({ ...content(), ...change })).toBeNull(),
  );
  it.each([
    { clauses: [], sort: { field: "price", direction: "asc" } },
    { clauses: [], sort: { field: "symbol", direction: "up" } },
    { clauses: [], sort: { field: "symbol", direction: "asc", extra: true } },
    {
      clauses: [{ field: "price", operator: "gte", value: "1" }],
      sort: input().criteria.sort,
    },
    {
      clauses: [{ field: "workingCapital", operator: "eq", value: "1" }],
      sort: input().criteria.sort,
    },
    {
      clauses: [{ field: "workingCapital", operator: "gte", value: "1e3" }],
      sort: input().criteria.sort,
    },
    {
      clauses: [{ field: "workingCapital", operator: "gte", value: "01" }],
      sort: input().criteria.sort,
    },
    {
      clauses: [{ field: "workingCapital", operator: "gte", value: " 1" }],
      sort: input().criteria.sort,
    },
    {
      clauses: [
        {
          field: "workingCapital",
          operator: "gte",
          value: "1",
          result: "match",
        },
      ],
      sort: input().criteria.sort,
    },
    {
      clauses: Array.from({ length: 8 }, () => input().criteria.clauses[0]),
      sort: input().criteria.sort,
    },
  ])(
    "uses the existing closed criteria and decimal rules for %j",
    (criteria) => {
      expect(format({ ...input(), criteria })).toBeNull();
      expect(parse({ ...content(), criteria })).toBeNull();
    },
  );
  it.each([
    { country: "GB" },
    { exchangeMic: "X" },
    { instrumentType: "option" },
    { issuerId: "" },
    { issuerName: " leading" },
    { listingId: "" },
    { securityId: "" },
    { securityName: "\ud800" },
    { shareClassId: "" },
    { shareClassName: "" },
    { symbol: "lower" },
    { cik: "0000000001" },
    { note: "authored" },
  ])(
    "validates every full listing identity field and rejects extras %j",
    (change) => {
      const listings = [{ ...listing(1), ...change }];
      expect(format({ ...input(), listings })).toBeNull();
      expect(parse({ ...content(), listings })).toBeNull();
    },
  );
  it("refuses missing identities, repeated listings, repeated issuers and an eighteenth selection", () => {
    const sameIssuer = { ...listing(2), issuerId: listing(1).issuerId };
    for (const listings of [
      [],
      [listing(1), listing(1)],
      [listing(1), sameIssuer],
      Array.from({ length: 18 }, (_, i) => listing(i)),
    ]) {
      expect(format({ ...input(), listings })).toBeNull();
      expect(parse({ ...content(), listings })).toBeNull();
    }
    const incomplete = { ...listing(1) };
    Reflect.deleteProperty(incomplete, "securityId");
    expect(format({ ...input(), listings: [incomplete] })).toBeNull();
  });
});

describe("safe object and raw JSON admission", () => {
  it("refuses getters at every definition depth without invoking them", () => {
    const getter = vi.fn(() => {
      throw new Error("Must not read getters");
    });
    const examples = [
      withGetter(input(), "name", getter),
      {
        ...input(),
        criteria: withGetter({ ...input().criteria }, "clauses", getter),
      },
      {
        ...input(),
        criteria: {
          clauses: [],
          sort: withGetter({ ...input().criteria.sort }, "field", getter),
        },
      },
      {
        ...input(),
        criteria: {
          clauses: [
            withGetter({ ...input().criteria.clauses[0] }, "value", getter),
          ],
          sort: input().criteria.sort,
        },
      },
      {
        ...input(),
        listings: [withGetter({ ...listing(1) }, "issuerName", getter)],
      },
      { ...input(), listings: withGetter([listing(1)], "0", getter) },
    ];
    for (const value of examples) expect(format(value)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
  it("requires dense plain arrays and plain own-data records throughout", () => {
    const sparse = new Array<ManagedEodIdentity>(1);
    const extra = Object.assign([listing(1)], { metadata: true });
    const symbolic = { ...input(), [Symbol("extra")]: true };
    const hidden = Object.defineProperty(input(), "extra", { value: true });
    const inherited = Object.create(input()) as unknown;
    const nullRecord = Object.assign(Object.create(null) as object, input());
    const nestedNull = Object.assign(
      Object.create(null) as object,
      input().criteria,
    );
    for (const value of [
      symbolic,
      hidden,
      inherited,
      nullRecord,
      { ...input(), listings: sparse },
      { ...input(), listings: extra },
      {
        ...input(),
        listings: Object.setPrototypeOf([listing(1)], null) as unknown,
      },
      { ...input(), criteria: nestedNull },
      { ...input(), criteria: { ...input().criteria, clauses: new Array(1) } },
    ])
      expect(format(value)).toBeNull();
  });
  it("rejects malformed JSON, duplicate decoded keys and escaped invalid Unicode", () => {
    const text = formatManagedFinancialScreenRecipe(input())!.text;
    for (const raw of [
      "",
      "null",
      "[]",
      "{",
      "\ufeff" + text,
      text + "\ud800",
      text.replace('"version":1', '"version":1,"version":1'),
      text.replace('"name":', '"na\\u006de":"hidden","name":'),
      text.replace(
        '"direction":"desc"',
        '"direction":"desc","direction":"asc"',
      ),
      text.replace(
        '"listingId":"listing-2"',
        '"listingId":"listing-2","listingId":"other"',
      ),
      text.replace('"name":', '"__proto__":{},"name":'),
      JSON.stringify({ ...content(), name: "\ud800" }),
    ])
      expect(parseManagedFinancialScreenRecipe(raw)).toBeNull();
  });
  it("bounds actual UTF-8 bytes including otherwise valid surrounding whitespace", () => {
    const text = formatManagedFinancialScreenRecipe(input())!.text;
    const exact =
      text +
      " ".repeat(
        MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES -
          encoder.encode(text).byteLength,
      );
    expect(encoder.encode(exact)).toHaveLength(64 * 1024);
    expect(parseManagedFinancialScreenRecipe(exact)).toEqual(content());
    expect(parseManagedFinancialScreenRecipe(exact + " ")).toBeNull();
    const largeListings = Array.from({ length: 17 }, (_, i) => ({
      ...listing(i),
      issuerName: "😀".repeat(512),
      securityName: "😀".repeat(512),
      shareClassName: "😀".repeat(512),
    }));
    expect(format({ ...input(), listings: largeListings })).toBeNull();
    expect(parse({ ...content(), listings: largeListings })).toBeNull();
  });
});

describe("canonical recipe delivery documents", () => {
  it("requires exact text and all wrapper fields without accepting content authority", () => {
    const document = formatManagedFinancialScreenRecipe(input())!;
    for (const change of [
      { filename: "other.json" },
      { mime: "text/plain" },
      { capturedAt: TIME.replace("456", "457") },
      { byteLength: document.byteLength + 1 },
      { text: document.text.trimEnd() },
      { extra: true },
    ])
      expect(
        isManagedFinancialScreenRecipeDocument({ ...document, ...change }),
      ).toBe(false);
    const pretty = JSON.stringify(content(), null, 2) + "\n";
    expect(parseManagedFinancialScreenRecipe(pretty)).toEqual(content());
    expect(
      isManagedFinancialScreenRecipeDocument({
        ...document,
        text: pretty,
        byteLength: encoder.encode(pretty).byteLength,
      }),
    ).toBe(false);
    expect(isManagedFinancialScreenRecipeDocument(content())).toBe(false);
    const getter = vi.fn(() => document.text);
    expect(
      isManagedFinancialScreenRecipeDocument(
        withGetter({ ...document }, "text", getter),
      ),
    ).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });
  it("accepts a structurally valid foreign catalog as untrusted metadata for later review", () => {
    const foreign = {
      ...input(),
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      capturedAt: "2001-01-01T00:00:00.000Z",
    };
    const document = formatManagedFinancialScreenRecipe(foreign)!;
    expect(parseManagedFinancialScreenRecipe(document.text)).toMatchObject(
      foreign,
    );
    expect(isManagedFinancialScreenRecipeDocument(document)).toBe(true);
  });
});
