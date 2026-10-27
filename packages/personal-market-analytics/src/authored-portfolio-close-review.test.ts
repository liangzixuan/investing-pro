import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  calculateAuthoredPortfolioCloseReview,
  type AuthoredPortfolioCloseReviewHolding,
  type AuthoredPortfolioCloseReviewInput,
} from "./authored-portfolio-close-review";

const asOfDate = "2026-10-22";
function holding(
  listingId = "listing-a",
  shares = "1",
): AuthoredPortfolioCloseReviewHolding {
  return { listingId, shares, confirmedOn: "2026-10-20" };
}
function input(
  holdings: readonly AuthoredPortfolioCloseReviewHolding[] = [holding()],
): AuthoredPortfolioCloseReviewInput {
  return {
    holdings,
    cashUsd: "10.5",
    balancesOn: "2026-10-21",
    asOfDate,
    prices: holdings.map(({ listingId }) => ({
      listingId,
      date: asOfDate,
      close: "2",
    })),
  };
}
function calculateUnknown(value: unknown) {
  return calculateAuthoredPortfolioCloseReview(
    value as AuthoredPortfolioCloseReviewInput,
  );
}

describe("authored portfolio close review", () => {
  it("values fractional shares and exact decimal prices with authored cash", () => {
    const value = input([holding("listing-a", "1.234567")]);
    const result = calculateAuthoredPortfolioCloseReview({
      ...value,
      prices: [{ listingId: "listing-a", date: asOfDate, close: "12.345678" }],
    });
    expect(result).toEqual({
      asOfDate,
      balancesOn: "2026-10-21",
      holdings: [
        {
          ...value.holdings[0],
          status: "priced",
          reason: null,
          close: "12.345678",
          valueUsd: "15.24",
        },
      ],
      pricedHoldings: 1,
      totalHoldings: 1,
      pricedHoldingsSubtotalUsd: "15.24",
      holdingsValueUsd: "15.24",
      cashUsd: "10.50",
      totalValueUsd: "25.74",
      composition: {
        status: "available",
        reason: null,
        totalValueUsd: "25.74",
        cashUsd: "10.50",
        cashPercent: "40.79",
        holdings: [
          { listingId: "listing-a", valueUsd: "15.24", percent: "59.21" },
        ],
        method: "displayed_usd_cents_over_complete_total_percent_half_up_2dp",
      },
      method: "each_holding_round_half_up_to_cents_then_sum",
    });
  });

  it("rounds each half cent up before summing the displayed values", () => {
    const value = input([holding("a"), holding("b"), holding("c")]);
    const result = calculateAuthoredPortfolioCloseReview({
      ...value,
      cashUsd: "0",
      prices: value.prices.map((price) => ({ ...price, close: "1.005" })),
    });
    expect(result.holdings.map((row) => row.valueUsd)).toEqual([
      "1.01",
      "1.01",
      "1.01",
    ]);
    expect(result.pricedHoldingsSubtotalUsd).toBe("3.03");
    expect(result.holdingsValueUsd).toBe("3.03");
    expect(result.totalValueUsd).toBe("3.03");
  });

  it("retains subcent positive holdings as priced zero without signed zero", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...input([holding("a", "0.000001")]),
        prices: [{ listingId: "a", date: asOfDate, close: "0.000001" }],
      }),
    ).toMatchObject({
      pricedHoldings: 1,
      holdings: [{ status: "priced", valueUsd: "0.00" }],
      holdingsValueUsd: "0.00",
      totalValueUsd: "10.50",
    });
  });

  it("calculates the largest permitted operands without Number precision loss", () => {
    const value = input([holding("a", "1000000000.000000")]);
    const close = "9".repeat(64);
    const expected = `${close}000000000.00`;
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...value,
        cashUsd: "0.00",
        prices: [{ listingId: "a", date: asOfDate, close }],
      }).totalValueUsd,
    ).toBe(expected);
    const twenty = input(
      Array.from({ length: 20 }, (_, index) =>
        holding(`l${index}`, "1000000000"),
      ),
    );
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...twenty,
        cashUsd: "1000000000000.00",
        prices: twenty.prices.map((price) => ({
          ...price,
          close: "999999999.99",
        })),
      }).totalValueUsd,
    ).toBe("20000000999800000000.00");
  });

  it("keeps unknown cash separate from complete holding values", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({ ...input(), cashUsd: null }),
    ).toMatchObject({
      cashUsd: null,
      holdingsValueUsd: "2.00",
      totalValueUsd: null,
    });
  });

  it("keeps a displayed subtotal separate from incomplete portfolio totals", () => {
    const value = input([holding("a"), holding("b")]);
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...value,
        prices: [value.prices[0]!],
      }),
    ).toMatchObject({
      pricedHoldings: 1,
      totalHoldings: 2,
      pricedHoldingsSubtotalUsd: "2.00",
      holdingsValueUsd: null,
      cashUsd: "10.50",
      totalValueUsd: null,
      holdings: [
        { listingId: "a", status: "priced", valueUsd: "2.00" },
        {
          listingId: "b",
          status: "unavailable",
          reason: "close_not_loaded",
          close: null,
          valueUsd: null,
        },
      ],
    });
  });

  it.each(["0", "12.34", null])(
    "keeps empty holdings and cash %s distinct",
    (cashUsd) => {
      expect(
        calculateAuthoredPortfolioCloseReview({ ...input([]), cashUsd }),
      ).toMatchObject({
        holdings: [],
        totalHoldings: 0,
        pricedHoldings: 0,
        pricedHoldingsSubtotalUsd: "0.00",
        holdingsValueUsd: "0.00",
        totalValueUsd: cashUsd === "0" ? "0.00" : cashUsd,
      });
    },
  );

  it("refuses complete and empty totals before the authored balance date", () => {
    for (const value of [input(), input([])]) {
      const result = calculateAuthoredPortfolioCloseReview({
        ...value,
        balancesOn: "2026-10-23",
      });
      expect(result).toMatchObject({
        pricedHoldings: 0,
        pricedHoldingsSubtotalUsd: "0.00",
        holdingsValueUsd: null,
        cashUsd: "10.50",
        totalValueUsd: null,
      });
      for (const row of result.holdings) {
        expect(row).toMatchObject({
          reason: "balance_after_close",
          close: null,
        });
      }
    }
  });

  it("refuses a holding confirmed after the selected close even without its price", () => {
    const value = input([
      holding("a"),
      { ...holding("b"), confirmedOn: "2026-10-23" },
    ]);
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...value,
        prices: [value.prices[0]!],
      }),
    ).toMatchObject({
      pricedHoldings: 1,
      pricedHoldingsSubtotalUsd: "2.00",
      holdingsValueUsd: null,
      totalValueUsd: null,
      holdings: [{ status: "priced" }, { reason: "balance_after_close" }],
    });
  });

  it("accepts matching balance and confirmation dates inclusively", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...input([{ ...holding(), confirmedOn: asOfDate }]),
        balancesOn: asOfDate,
      }).totalValueUsd,
    ).toBe("12.50");
  });

  it("uses the exact listing and selected date without history fallback", () => {
    const value = input([holding("a"), holding("b")]);
    const result = calculateAuthoredPortfolioCloseReview({
      ...value,
      prices: [
        { listingId: "a", date: "2026-10-21", close: "999" },
        { listingId: "b", date: asOfDate, close: "3.00" },
        { listingId: "a", date: "2026-10-23", close: "888" },
        { listingId: "other", date: asOfDate, close: "777" },
      ],
    });
    expect(result.holdings).toMatchObject([
      { listingId: "a", reason: "close_not_loaded", close: null },
      { listingId: "b", close: "3.00", valueUsd: "3.00" },
    ]);
    expect(result.holdingsValueUsd).toBeNull();
    expect(result.pricedHoldingsSubtotalUsd).toBe("3.00");
  });

  it("accepts a real leap date and preserves null-prototype structural records", () => {
    expect(
      calculateUnknown(
        Object.assign(Object.create(null), {
          ...input([]),
          balancesOn: "2000-02-29",
          asOfDate: "2000-02-29",
        }),
      ).totalValueUsd,
    ).toBe("10.50");
  });

  it.each([
    null,
    undefined,
    [],
    "input",
    1,
    { ...input(), cashUsd: undefined },
    { ...input(), holdings: null },
    { ...input(), prices: null },
    { ...input(), holdings: [null] },
    { ...input(), prices: [null] },
    { ...input(), holdings: [holding(), holding()] },
    {
      ...input(),
      holdings: Array.from({ length: 21 }, (_, i) => holding(`l${i}`)),
    },
    { ...input(), prices: [...input().prices, ...input().prices] },
    { ...input(), holdings: [{ ...holding(), listingId: "   " }] },
    { ...input(), prices: [{ listingId: "", date: asOfDate, close: "1" }] },
  ])("rejects malformed containers and duplicate identities %j", (value) => {
    expect(() => calculateUnknown(value)).toThrow(TypeError);
  });

  it.each([
    "0",
    "0.000000",
    "-0",
    "-1",
    "1e2",
    "NaN",
    "Infinity",
    "01",
    "1.",
    ".1",
    "+1",
    " 1",
    "1 ",
    "1.0000001",
    "1000000000.000001",
    1,
    null,
  ])("rejects malformed or out-of-bounds shares %s", (shares) => {
    expect(() =>
      calculateUnknown({
        ...input(),
        holdings: [{ ...holding(), shares }],
      }),
    ).toThrow(TypeError);
  });

  it.each([
    "-0",
    "-1",
    "1e2",
    "01",
    "1.",
    ".1",
    "0.001",
    "1000000000000.01",
    1,
    undefined,
  ])("rejects malformed or out-of-bounds cash %s", (cashUsd) => {
    expect(() => calculateUnknown({ ...input(), cashUsd })).toThrow(TypeError);
  });

  it.each([
    "0",
    "-1",
    "1e2",
    "NaN",
    "Infinity",
    "01",
    "1.",
    " 1",
    "9".repeat(65),
    1,
    null,
  ])("rejects every malformed close including unused histories %s", (close) => {
    expect(() =>
      calculateUnknown({
        ...input(),
        prices: [{ listingId: "unused", date: "2026-10-20", close }],
      }),
    ).toThrow(TypeError);
  });

  it.each([
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-00-01",
    "2026-10-32",
    "2026-1-01",
    "0000-01-01",
    "2026-10-22T00:00:00.000Z",
    " 2026-10-22",
    20261022,
    null,
  ])("rejects noncalendar dates in every date field %s", (date) => {
    for (const value of [
      { ...input(), asOfDate: date },
      { ...input(), balancesOn: date },
      { ...input(), holdings: [{ ...holding(), confirmedOn: date }] },
      { ...input(), prices: [{ listingId: "unused", date, close: "1" }] },
    ])
      expect(() => calculateUnknown(value)).toThrow(TypeError);
  });

  it("leaves input records mutable and freezes only independent output", () => {
    const value = input();
    const before = structuredClone(value);
    const result = calculateAuthoredPortfolioCloseReview(value);
    expect(value).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.holdings)).toBe(true);
    expect(Object.isFrozen(result.holdings[0])).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
    expect(Object.isFrozen(value.holdings)).toBe(false);
    expect(Object.isFrozen(value.holdings[0])).toBe(false);
    expect(Object.isFrozen(value.prices[0])).toBe(false);
    expect(result.holdings[0]).not.toBe(value.holdings[0]);
  });

  it("isolates exact calculations from global Decimal configuration", () => {
    const saved = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      maxE: Decimal.maxE,
    };
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN, maxE: 1 });
      expect(
        calculateAuthoredPortfolioCloseReview({
          ...input([holding("a", "1.5")]),
          cashUsd: "1000000000000",
          prices: [{ listingId: "a", date: asOfDate, close: "10.01" }],
        }).totalValueUsd,
      ).toBe("1000000000015.02");
    } finally {
      Decimal.set(saved);
    }
  });
});
