import { describe, expect, it, vi } from "vitest";
import {
  parsePortfolioPayload,
  type ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import {
  assertPortfolioDraftFileSize,
  decodePortfolioDraftFile,
  formatManagedPortfolioDraftFile,
  isManagedPortfolioDraftFileDocument,
  MANAGED_PORTFOLIO_DRAFT_FILE_MAX_BYTES,
  parseManagedPortfolioDraftFile,
  type ManagedPortfolioDraftFileInput,
} from "./managed-portfolio-draft-file";

const SCOPE = `sha256:${"a".repeat(64)}`;
const OTHER_SCOPE = `sha256:${"b".repeat(64)}`;
const TIME = "2026-10-21T10:01:02.345Z";
const encoder = new TextEncoder();
function identity(): ManagedPortfolioPayload["identities"][number] {
  return {
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
  };
}
function activities(): ManagedPortfolioPayload["transactions"] {
  return [
    {
      id: "activity-buy",
      date: "2026-10-02",
      type: "buy",
      listingId: "listing-invented-c",
      shares: "2.000000",
      grossUsd: "200.00",
      feeUsd: "1.00",
    },
    {
      id: "activity-split",
      date: "2026-10-02",
      type: "split",
      listingId: "listing-invented-c",
      ratioNumerator: "2",
      ratioDenominator: "1",
    },
    {
      id: "activity-sell",
      date: "2026-10-02",
      type: "sell",
      listingId: "listing-invented-c",
      shares: "1.000000",
      grossUsd: "150.00",
      feeUsd: "1.00",
    },
  ];
}
function portfolio(): ManagedPortfolioPayload {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"c".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [identity()],
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: null,
      holdings: [
        {
          listingId: "listing-invented-c",
          shares: "10.000000",
          totalCostBasisUsd: null,
          confirmedOn: "2026-09-30",
        },
      ],
    },
    transactions: activities(),
  };
}
function input(): ManagedPortfolioDraftFileInput {
  return {
    accountScope: SCOPE,
    capturedAt: TIME,
    baseVersion: 7,
    draft: portfolio(),
  };
}
function content() {
  return { format: "investment-portfolio-draft", version: 1, ...input() };
}
function parse(value: unknown) {
  return parseManagedPortfolioDraftFile(JSON.stringify(value), SCOPE);
}
function format(value: unknown) {
  return formatManagedPortfolioDraftFile(
    value as ManagedPortfolioDraftFileInput,
  );
}

describe("Portfolio draft file round trips", () => {
  it("preserves activity order, split ratios, raw decimals and unknown cash/basis", () => {
    const original = input();
    expect(parsePortfolioPayload(original.draft)).toEqual(original.draft);
    const document = formatManagedPortfolioDraftFile(original)!;
    expect(document).toMatchObject({
      filename: "Investment-portfolio-draft-2026-10-21T10-01-02-345Z.json",
      mime: "application/json",
      accountScope: SCOPE,
      capturedAt: TIME,
      baseVersion: 7,
    });
    expect(document.byteLength).toBe(encoder.encode(document.text).byteLength);
    expect(isManagedPortfolioDraftFileDocument(document)).toBe(true);
    const candidate = parseManagedPortfolioDraftFile(document.text, SCOPE)!;
    expect(candidate).toEqual(content());
    expect(candidate.draft.transactions.map((row) => row.id)).toEqual([
      "activity-buy",
      "activity-split",
      "activity-sell",
    ]);
    expect(candidate.draft.opening.cashUsd).toBeNull();
    expect(candidate.draft.opening.holdings[0]!.totalCostBasisUsd).toBeNull();
    expect(candidate.draft.transactions[0]).toMatchObject({
      shares: "2.000000",
      grossUsd: "200.00",
      feeUsd: "1.00",
    });
    expect(Object.keys(document)).not.toContain("membershipCount");
  });
  it("owns frozen detached data and keeps later caller edits separate", () => {
    const original = input();
    const document = formatManagedPortfolioDraftFile(original)!;
    const candidate = parseManagedPortfolioDraftFile(document.text, SCOPE)!;
    expect(candidate.draft).not.toBe(original.draft);
    expect(Object.isFrozen(candidate.draft.transactions[1])).toBe(true);
    expect(Object.isFrozen(candidate.draft.opening.holdings)).toBe(true);
    expect(Object.isFrozen(document)).toBe(true);
    (original.draft.identities[0] as { symbol: string }).symbol = "LATER";
    expect(candidate.draft.identities[0]!.symbol).toBe("INV");
    expect(format(candidate)).toBeNull();
  });
  it("admits an explicit empty ledger at an unsaved base", () => {
    const draft = {
      ...portfolio(),
      identities: [],
      opening: { asOfDate: "2026-10-01", cashUsd: null, holdings: [] },
      transactions: [],
    };
    const document = formatManagedPortfolioDraftFile({
      ...input(),
      baseVersion: 0,
      draft,
    })!;
    expect(parseManagedPortfolioDraftFile(document.text, SCOPE)?.draft).toEqual(
      draft,
    );
  });
});

describe("Portfolio draft file refusal", () => {
  it("separates account ownership and file formats", () => {
    const document = formatManagedPortfolioDraftFile(input())!;
    expect(
      parseManagedPortfolioDraftFile(document.text, OTHER_SCOPE),
    ).toBeNull();
    expect(
      parse({ ...content(), format: "investment-watchlist-draft" }),
    ).toBeNull();
    expect(
      parseManagedPortfolioDraftFile(document.text, "invalid-scope"),
    ).toBeNull();
  });
  it.each([
    { version: 2 },
    { extra: true },
    { capturedAt: "2026-02-30T00:00:00.000Z" },
    { capturedAt: "2026-10-21T10:01:02Z" },
    { baseVersion: -1 },
    { baseVersion: 0.5 },
    { baseVersion: Number.MAX_SAFE_INTEGER + 1 },
    { accountScope: `sha256:${"A".repeat(64)}` },
  ])("refuses invalid envelope fields %j", (change) => {
    expect(parse({ ...content(), ...change })).toBeNull();
  });
  it.each([
    null,
    { ...portfolio(), schemaVersion: 2 },
    { ...portfolio(), schemaVersion: 1 },
    { ...portfolio(), extra: true },
    { ...portfolio(), basisMethod: "average" },
  ])(
    "delegates malformed and old ledger shapes to the contract %#",
    (draft) => {
      expect(parse({ ...content(), draft })).toBeNull();
      expect(format({ ...input(), draft })).toBeNull();
    },
  );
  it("refuses duplicate decoded keys at envelope, opening and activity boundaries", () => {
    const text = JSON.stringify(content());
    for (const duplicate of [
      text.replace('"version":1', '"version":1,"version":1'),
      text.replace('"cashUsd":null', '"cashUsd":null,"cash\\u0055sd":null'),
      text.replace(
        '"ratioNumerator":"2"',
        '"ratioNumerator":"2","ratioNumerator":"2"',
      ),
    ])
      expect(parseManagedPortfolioDraftFile(duplicate, SCOPE)).toBeNull();
  });
  it("refuses missing envelope fields and unknown nested activity keys", () => {
    for (const key of Object.keys(content())) {
      const value: Record<string, unknown> = { ...content() };
      delete value[key];
      expect(parse(value)).toBeNull();
    }
    const draft = portfolio();
    expect(
      parse({
        ...content(),
        draft: {
          ...draft,
          transactions: [{ ...draft.transactions[0], extra: true }],
        },
      }),
    ).toBeNull();
  });
  it("refuses getters, hidden extras, sparse activities and inherited input", () => {
    const getter = vi.fn();
    const value = input();
    Object.defineProperty(value, "capturedAt", {
      enumerable: true,
      get: getter,
    });
    expect(format(value)).toBeNull();
    const draft = portfolio();
    Object.defineProperty(draft.opening, "cashUsd", {
      enumerable: true,
      get: getter,
    });
    expect(format({ ...input(), draft })).toBeNull();
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
        draft: { ...portfolio(), transactions: new Array(1) },
      }),
    ).toBeNull();
  });
});

describe("Portfolio file byte and canonical delivery bounds", () => {
  it.each([
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    MANAGED_PORTFOLIO_DRAFT_FILE_MAX_BYTES + 1,
  ])("refuses advertised size %s before reading", (size) => {
    expect(() => assertPortfolioDraftFileSize(size)).toThrow("size");
  });
  it("admits exact file bytes at the ceiling and refuses one more byte", () => {
    const document = formatManagedPortfolioDraftFile(input())!;
    const padding =
      MANAGED_PORTFOLIO_DRAFT_FILE_MAX_BYTES - document.byteLength;
    const text = document.text + " ".repeat(padding);
    const bytes = encoder.encode(text);
    expect(() => assertPortfolioDraftFileSize(bytes.byteLength)).not.toThrow();
    expect(
      decodePortfolioDraftFile(bytes.buffer, bytes.byteLength, SCOPE),
    ).not.toBeNull();
    expect(parseManagedPortfolioDraftFile(text + " ", SCOPE)).toBeNull();
    expect(
      decodePortfolioDraftFile(
        encoder.encode(text + " ").buffer,
        bytes.byteLength + 1,
        SCOPE,
      ),
    ).toBeNull();
  });
  it("checks actual byte count and decodes UTF-8 without replacement or BOM removal", () => {
    const document = formatManagedPortfolioDraftFile(input())!;
    const bytes = encoder.encode(document.text);
    expect(
      decodePortfolioDraftFile(bytes.buffer, bytes.byteLength, SCOPE),
    ).toEqual(content());
    expect(
      decodePortfolioDraftFile(bytes.buffer, bytes.byteLength - 1, SCOPE),
    ).toBeNull();
    expect(
      decodePortfolioDraftFile(new Uint8Array([0xc3, 0x28]).buffer, 2, SCOPE),
    ).toBeNull();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
    expect(
      decodePortfolioDraftFile(bom.buffer, bom.byteLength, SCOPE),
    ).toBeNull();
    expect(parseManagedPortfolioDraftFile("\ud800", SCOPE)).toBeNull();
  });
  it.each([
    { filename: "other.json" },
    { mime: "text/plain" },
    { byteLength: 1 },
    { accountScope: OTHER_SCOPE },
    { capturedAt: "2026-10-22T10:01:02.345Z" },
    { baseVersion: 8 },
    { extra: true },
  ])("refuses canonical document tampering %j", (change) => {
    const document = formatManagedPortfolioDraftFile(input())!;
    expect(
      isManagedPortfolioDraftFileDocument({ ...document, ...change }),
    ).toBe(false);
  });
  it("accepts reviewed noncanonical input text but refuses it for delivery", () => {
    const document = formatManagedPortfolioDraftFile(input())!;
    const text = JSON.stringify(content(), null, 2);
    expect(parseManagedPortfolioDraftFile(text, SCOPE)).toEqual(content());
    expect(
      isManagedPortfolioDraftFileDocument({
        ...document,
        text,
        byteLength: encoder.encode(text).byteLength,
      }),
    ).toBe(false);
    expect(isManagedPortfolioDraftFileDocument(null)).toBe(false);
  });
});
