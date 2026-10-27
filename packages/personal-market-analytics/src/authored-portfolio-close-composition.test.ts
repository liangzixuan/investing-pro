import Decimal from "decimal.js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD,
  calculateAuthoredPortfolioCloseReview,
  type AuthoredPortfolioCloseComposition,
  type AuthoredPortfolioCloseCompositionHolding,
  type AuthoredPortfolioCloseReviewInput,
} from "./index";

const date = "2026-10-22";
function input(
  closes: readonly string[] = ["2"],
): AuthoredPortfolioCloseReviewInput {
  return {
    asOfDate: date,
    balancesOn: date,
    cashUsd: "1",
    holdings: closes.map((_, index) => ({
      listingId: `exact-class-${index}`,
      shares: "1",
      confirmedOn: date,
    })),
    prices: closes.map((close, index) => ({
      listingId: `exact-class-${index}`,
      date,
      close,
    })),
  };
}

describe("authored portfolio close composition", () => {
  it("uses displayed cents, fractional shares, cash and exact class order", () => {
    const result = calculateAuthoredPortfolioCloseReview({
      ...input(),
      cashUsd: "10.50",
      holdings: [
        { listingId: "BETB:Class C", shares: "1.234567", confirmedOn: date },
        { listingId: "BETB:Class A", shares: "0.5", confirmedOn: date },
      ],
      prices: [
        { listingId: "BETB:Class A", date, close: "9" },
        { listingId: "BETB:Class C", date, close: "12.345678" },
      ],
    });
    expect(result.composition).toEqual({
      status: "available",
      reason: null,
      totalValueUsd: "30.24",
      cashUsd: "10.50",
      cashPercent: "34.72",
      holdings: [
        { listingId: "BETB:Class C", valueUsd: "15.24", percent: "50.40" },
        { listingId: "BETB:Class A", valueUsd: "4.50", percent: "14.88" },
      ],
      method: AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD,
    });
    expect(result.composition.method).toBe(
      "displayed_usd_cents_over_complete_total_percent_half_up_2dp",
    );
  });

  it("rounds 1.005 to 1.01 before percentage arithmetic, without normalizing 100.01", () => {
    const result = calculateAuthoredPortfolioCloseReview(input(["1.005", "2"]));
    expect(result.composition).toMatchObject({
      totalValueUsd: "4.01",
      cashPercent: "24.94",
      holdings: [
        { valueUsd: "1.01", percent: "25.19" },
        { valueUsd: "2.00", percent: "49.88" },
      ],
    });
  });

  it("leaves independently rounded thirds at 99.99", () => {
    expect(
      calculateAuthoredPortfolioCloseReview(input(["1", "1"])).composition,
    ).toMatchObject({
      totalValueUsd: "3.00",
      cashPercent: "33.33",
      holdings: [{ percent: "33.33" }, { percent: "33.33" }],
    });
  });

  it("rounds exact percentage half ties up at two decimal places", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...input(["0.01"]),
        cashUsd: "199.99",
      }).composition,
    ).toMatchObject({
      totalValueUsd: "200.00",
      cashPercent: "100.00",
      holdings: [{ valueUsd: "0.01", percent: "0.01" }],
    });
  });

  it("keeps known zero cash available at zero percent", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({ ...input(), cashUsd: "0" })
        .composition,
    ).toMatchObject({
      status: "available",
      reason: null,
      cashUsd: "0.00",
      cashPercent: "0.00",
      holdings: [{ percent: "100.00" }],
    });
  });

  it("keeps cash-only composition available at 100 percent", () => {
    expect(
      calculateAuthoredPortfolioCloseReview(input([])).composition,
    ).toEqual({
      status: "available",
      reason: null,
      totalValueUsd: "1.00",
      cashUsd: "1.00",
      cashPercent: "100.00",
      holdings: [],
      method: AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD,
    });
  });

  it("retains a positive holding rounded to zero at zero percent", () => {
    const value = input(["0.000001"]);
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...value,
        holdings: [{ ...value.holdings[0]!, shares: "0.000001" }],
      }).composition,
    ).toMatchObject({
      status: "available",
      cashPercent: "100.00",
      holdings: [{ valueUsd: "0.00", percent: "0.00" }],
    });
  });

  it.each([{ closes: [] }, { closes: ["0.000001"] }])(
    "refuses zero complete totals for %j",
    ({ closes }) => {
      const composition = calculateAuthoredPortfolioCloseReview({
        ...input(closes),
        cashUsd: "0",
      }).composition;
      expect(composition).toMatchObject({
        status: "unavailable",
        reason: "zero_total",
        totalValueUsd: "0.00",
        cashUsd: "0.00",
        cashPercent: null,
      });
      expect(composition.holdings.every((row) => row.percent === null)).toBe(
        true,
      );
    },
  );

  it("does not promote a complete priced subset to 100 percent when cash is unknown", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({ ...input(), cashUsd: null })
        .composition,
    ).toEqual({
      status: "unavailable",
      reason: "unknown_cash",
      totalValueUsd: null,
      cashUsd: null,
      cashPercent: null,
      holdings: [
        { listingId: "exact-class-0", valueUsd: "2.00", percent: null },
      ],
      method: AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD,
    });
  });

  it.each(["1", null])(
    "refuses every weight for missing holdings with cash %s",
    (cashUsd) => {
      const value = input(["2", "3"]);
      expect(
        calculateAuthoredPortfolioCloseReview({
          ...value,
          cashUsd,
          prices: [value.prices[0]!],
        }).composition,
      ).toEqual({
        status: "unavailable",
        reason: "incomplete_holdings",
        totalValueUsd: null,
        cashUsd: cashUsd === null ? null : "1.00",
        cashPercent: null,
        holdings: [
          { listingId: "exact-class-0", valueUsd: "2.00", percent: null },
          { listingId: "exact-class-1", valueUsd: null, percent: null },
        ],
        method: AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD,
      });
    },
  );

  it.each([{ closes: [] }, { closes: ["2", "3"] }])(
    "prioritizes future balance dates over missing values for %j",
    ({ closes }) => {
      const composition = calculateAuthoredPortfolioCloseReview({
        ...input(closes),
        balancesOn: "2026-10-23",
        prices: [],
        cashUsd: null,
      }).composition;
      expect(composition).toMatchObject({
        status: "unavailable",
        reason: "balances_after_close",
        totalValueUsd: null,
        cashPercent: null,
      });
      expect(
        composition.holdings.every(
          (row) => row.valueUsd === null && row.percent === null,
        ),
      ).toBe(true);
    },
  );

  it("prioritizes a late holding confirmation over an earlier missing row and unknown cash", () => {
    const value = input(["2", "3"]);
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...value,
        cashUsd: null,
        prices: [],
        holdings: [
          value.holdings[0]!,
          { ...value.holdings[1]!, confirmedOn: "2026-10-23" },
        ],
      }).composition,
    ).toMatchObject({
      reason: "balances_after_close",
      cashPercent: null,
      holdings: [{ percent: null }, { percent: null }],
    });
  });

  it("keeps unknown cash ahead of a displayed zero holding subtotal", () => {
    expect(
      calculateAuthoredPortfolioCloseReview({
        ...input(["0.000001"]),
        cashUsd: null,
      }).composition,
    ).toMatchObject({
      reason: "unknown_cash",
      totalValueUsd: null,
      holdings: [{ valueUsd: "0.00", percent: null }],
    });
  });

  it("keeps huge exact cent values independent of binary floating-point and global Decimal settings", () => {
    const saved = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      maxE: Decimal.maxE,
    };
    const close = "9".repeat(64);
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN, maxE: 1 });
      const value = input([close, close]);
      const composition = calculateAuthoredPortfolioCloseReview({
        ...value,
        cashUsd: "0",
        holdings: value.holdings.map((row) => ({
          ...row,
          shares: "1000000000",
        })),
      }).composition;
      expect(composition.holdings).toEqual(
        value.holdings.map((row) => ({
          listingId: row.listingId,
          valueUsd: `${close}000000000.00`,
          percent: "50.00",
        })),
      );
      expect(composition.cashPercent).toBe("0.00");
      expect({
        precision: Decimal.precision,
        rounding: Decimal.rounding,
        maxE: Decimal.maxE,
      }).toEqual({ precision: 2, rounding: Decimal.ROUND_DOWN, maxE: 1 });
    } finally {
      Decimal.set(saved);
    }
  });

  it("does not depend on locale rendering or identity collation", () => {
    const format = vi
      .spyOn(Number.prototype, "toLocaleString")
      .mockReturnValue("locale text");
    const compare = vi
      .spyOn(String.prototype, "localeCompare")
      .mockImplementation(() => {
        throw new Error("locale collation is not a calculation");
      });
    try {
      expect(
        calculateAuthoredPortfolioCloseReview(input(["1", "1"])).composition
          .cashPercent,
      ).toBe("33.33");
      expect(format).not.toHaveBeenCalled();
      expect(compare).not.toHaveBeenCalled();
    } finally {
      format.mockRestore();
      compare.mockRestore();
    }
  });

  it("exposes readonly independent frozen composition without freezing caller input", () => {
    const value = input();
    const before = structuredClone(value);
    const result = calculateAuthoredPortfolioCloseReview(value);
    expectTypeOf(
      result.composition,
    ).toEqualTypeOf<AuthoredPortfolioCloseComposition>();
    expectTypeOf(result.composition.holdings).toEqualTypeOf<
      readonly AuthoredPortfolioCloseCompositionHolding[]
    >();
    expect(Object.isFrozen(result.composition)).toBe(true);
    expect(Object.isFrozen(result.composition.holdings)).toBe(true);
    expect(Object.isFrozen(result.composition.holdings[0])).toBe(true);
    expect(result.composition.holdings[0]).not.toBe(result.holdings[0]);
    expect(value).toEqual(before);
    expect(Object.isFrozen(value)).toBe(false);
    expect(Object.isFrozen(value.holdings)).toBe(false);
    expect(() =>
      Object.assign(result.composition.holdings[0]!, { percent: "wrong" }),
    ).toThrow(TypeError);
    expect(() =>
      Object.assign(result.composition, { cashPercent: "wrong" }),
    ).toThrow(TypeError);
  });
});
