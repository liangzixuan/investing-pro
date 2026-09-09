import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  calculatePersonalPortfolioOverview,
  type PersonalPortfolioOverviewInput,
} from "./personal-portfolio-overview";

type Holding = PersonalPortfolioOverviewInput["portfolio"]["holdings"][number];
type QuoteEntry = PersonalPortfolioOverviewInput["quotes"][number];
const evaluatedAt = "2026-09-09T16:00:00.000Z";

function holding(
  suffix = "a",
  shares = "1",
  basis: string | null = "1",
): Holding {
  return {
    identity: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: `Issuer ${suffix}`,
      listingId: `listing-${suffix}`,
      securityName: `Stock ${suffix}`,
      symbol: suffix.toUpperCase(),
    },
    shares,
    totalCostBasisUsd: basis,
    confirmedOn: "2026-09-09",
  };
}

function entry(position: Holding, price = "2"): QuoteEntry {
  return {
    security: { ...position.identity },
    quote: {
      change: "1",
      changePercent: "100",
      currency: "USD",
      freshness: "current",
      ingestedAt: evaluatedAt,
      kind: "derived_realtime_reference",
      previousClose: "1",
      price,
      sourceTime: "2026-09-09T15:59:00.000Z",
    },
  };
}

function input(
  holdings: readonly Holding[] = [holding()],
): PersonalPortfolioOverviewInput {
  return {
    portfolio: { currency: "USD", cashUsd: "0", holdings },
    quotes: holdings.map((position) => entry(position)),
    evaluatedAt,
  };
}

describe("personal portfolio overview", () => {
  it("values fractional shares, entered basis and cash with exact decimal operands", () => {
    const position = holding("a", "1.5", "12");
    const result = calculatePersonalPortfolioOverview({
      ...input([position]),
      portfolio: { ...input([position]).portfolio, cashUsd: "10" },
      quotes: [entry(position, "10.01")],
    });
    expect(result.holdings[0]).toMatchObject({
      marketValueUsd: "15.02",
      unrealizedGainUsd: "3.02",
      unrealizedGainPercent: "25.13",
      allocationPercent: "60.02",
    });
    expect(result).toMatchObject({
      pricedHoldingsValueUsd: "15.02",
      holdingsValueUsd: "15.02",
      totalValueUsd: "25.02",
      totalCostBasisUsd: "12.00",
      unrealizedGainUsd: "3.02",
      unrealizedGainPercent: "25.13",
      cashAllocationPercent: "39.98",
    });
    const fractional = holding("b", "0.1", "0");
    expect(
      calculatePersonalPortfolioOverview({
        ...input([fractional]),
        quotes: [entry(fractional, "0.2")],
      }).totalValueUsd,
    ).toBe("0.02");
  });

  it("aggregates unrounded products and derives allocations before money rounding", () => {
    const positions = [holding("a"), holding("b"), holding("c")];
    const result = calculatePersonalPortfolioOverview({
      ...input(positions),
      quotes: positions.map((position) => entry(position, "1.005")),
    });
    expect(result.holdings.map((row) => row.marketValueUsd)).toEqual([
      "1.01",
      "1.01",
      "1.01",
    ]);
    expect(result.totalValueUsd).toBe("3.02");
    expect(result.unrealizedGainUsd).toBe("0.02");
    expect(result.unrealizedGainPercent).toBe("0.50");
    expect(result.holdings.map((row) => row.allocationPercent)).toEqual([
      "33.33",
      "33.33",
      "33.33",
    ]);
  });

  it("keeps a priced subtotal without presenting partial coverage as the portfolio", () => {
    const positions = [holding("a", "2", "1"), holding("b", "1", "999")];
    const result = calculatePersonalPortfolioOverview({
      ...input(positions),
      quotes: [entry(positions[0]!, "3")],
    });
    expect(result.coverage).toEqual({
      totalHoldings: 2,
      pricedHoldings: 1,
      staleHoldings: 0,
      unavailableHoldings: 1,
      knownCostBasisHoldings: 2,
    });
    expect(result.pricedHoldingsValueUsd).toBe("6.00");
    expect(result.pricedHoldingsCostBasisUsd).toBe("1.00");
    expect(result.pricedHoldingsUnrealizedGainUsd).toBe("5.00");
    expect(result.pricedHoldingsUnrealizedGainPercent).toBe("500.00");
    expect(result.totalCostBasisUsd).toBe("1000.00");
    expect(result.holdingsValueUsd).toBeNull();
    expect(result.totalValueUsd).toBeNull();
    expect(result.unrealizedGainUsd).toBeNull();
    expect(result.unrealizedGainPercent).toBeNull();
    expect(result.cashAllocationPercent).toBeNull();
    expect(result.holdings[0]).toMatchObject({
      unrealizedGainUsd: "5.00",
      allocationPercent: null,
    });
    expect(result.holdings[1]).toMatchObject({
      unavailableReason: "quote_not_loaded",
      marketValueUsd: null,
    });
  });

  it("preserves unknown cash independently from holdings valuation and basis", () => {
    const value = input();
    const result = calculatePersonalPortfolioOverview({
      ...value,
      portfolio: { ...value.portfolio, cashUsd: null },
    });
    expect(result.cashUsd).toBeNull();
    expect(result.holdingsValueUsd).toBe("2.00");
    expect(result.totalValueUsd).toBeNull();
    expect(result.holdings[0]?.allocationPercent).toBeNull();
    expect(result.unrealizedGainUsd).toBe("1.00");
  });

  it("preserves unknown cost basis while retaining complete market values", () => {
    const result = calculatePersonalPortfolioOverview(
      input([holding("a", "1", null), holding("b", "1", "1")]),
    );
    expect(result.totalValueUsd).toBe("4.00");
    expect(result.knownCostBasisSubtotalUsd).toBe("1.00");
    expect(result.totalCostBasisUsd).toBeNull();
    expect(result.unrealizedGainUsd).toBeNull();
    expect(result.holdings[0]).toMatchObject({
      unrealizedGainUsd: null,
      unrealizedGainPercent: null,
      allocationPercent: "50.00",
    });
    expect(result.pricedHoldingsCostBasisUsd).toBeNull();
    expect(result.pricedHoldingsUnrealizedGainUsd).toBeNull();
    expect(result.holdings[1]?.unrealizedGainUsd).toBe("1.00");
  });

  it("permits zero basis dollar gains without inventing a percentage", () => {
    const result = calculatePersonalPortfolioOverview(
      input([holding("a", "1", "0")]),
    );
    expect(result.unrealizedGainUsd).toBe("2.00");
    expect(result.unrealizedGainPercent).toBeNull();
    expect(result.holdings[0]?.unrealizedGainPercent).toBeNull();
  });

  it("handles cash-only, empty and unknown-cash portfolios", () => {
    expect(calculatePersonalPortfolioOverview(input([]))).toMatchObject({
      totalValueUsd: "0.00",
      holdingsValueUsd: "0.00",
      unrealizedGainUsd: "0.00",
      unrealizedGainPercent: null,
      cashAllocationPercent: null,
    });
    expect(
      calculatePersonalPortfolioOverview({
        ...input([]),
        portfolio: { currency: "USD", cashUsd: "100", holdings: [] },
      }),
    ).toMatchObject({
      totalValueUsd: "100.00",
      cashAllocationPercent: "100.00",
    });
    expect(
      calculatePersonalPortfolioOverview({
        ...input([]),
        portfolio: { currency: "USD", cashUsd: null, holdings: [] },
      }).totalValueUsd,
    ).toBeNull();
  });

  it("ages a previously current quote at the 36-hour boundary", () => {
    const value = input();
    const quote = {
      ...value.quotes[0]!.quote,
      sourceTime: "2026-09-08T04:00:00.000Z",
    };
    const exact = calculatePersonalPortfolioOverview({
      ...value,
      quotes: [{ security: holding().identity, quote }],
    });
    expect(exact.holdings[0]?.priceStatus).toBe("priced");
    const stale = calculatePersonalPortfolioOverview({
      ...value,
      evaluatedAt: "2026-09-09T16:00:00.001Z",
      quotes: [{ security: holding().identity, quote }],
    });
    expect(stale.holdings[0]).toMatchObject({
      priceStatus: "stale",
      unavailableReason: "older_than_36_hours",
      marketValueUsd: null,
      quote,
    });
    expect(stale.pricedHoldingsValueUsd).toBe("0.00");
    expect(stale.totalValueUsd).toBeNull();
    expect(stale.coverage.staleHoldings).toBe(1);
  });

  it("retains explicit stale status and end-of-day labels without using previous close", () => {
    const value = input();
    const quote = {
      ...value.quotes[0]!.quote,
      kind: "end_of_day_close" as const,
      price: "7",
      previousClose: "99",
    };
    const result = calculatePersonalPortfolioOverview({
      ...value,
      quotes: [{ security: holding().identity, quote }],
    });
    expect(result.totalValueUsd).toBe("7.00");
    expect(result.holdings[0]?.quote?.kind).toBe("end_of_day_close");
    expect(
      calculatePersonalPortfolioOverview({
        ...value,
        quotes: [
          {
            security: holding().identity,
            quote: { ...quote, freshness: "older_than_36_hours" },
          },
        ],
      }).totalValueUsd,
    ).toBeNull();
  });

  it("quarantines contradictory identity and duplicate quotes", () => {
    const value = input();
    const candidate = value.quotes[0]!;
    expect(
      calculatePersonalPortfolioOverview({
        ...value,
        quotes: [
          {
            ...candidate,
            security: { ...candidate.security, symbol: "OTHER" },
          },
        ],
      }).holdings[0]?.unavailableReason,
    ).toBe("identity_mismatch");
    expect(
      calculatePersonalPortfolioOverview({
        ...value,
        quotes: [candidate, candidate],
      }).holdings[0]?.unavailableReason,
    ).toBe("duplicate_quote");
  });

  it.each([
    { currency: "EUR" },
    { price: "0" },
    { price: "-1" },
    { price: "1e2" },
    { sourceTime: "2026-09-09T16:05:00.001Z" },
    { ingestedAt: "2026-09-09T16:05:00.001Z" },
    { sourceTime: "2026-02-30T15:00:00.000Z" },
  ])("quarantines invalid quote fields %j", (changed) => {
    const value = input();
    const candidate = value.quotes[0]!;
    const mutated = {
      ...value,
      quotes: [{ ...candidate, quote: { ...candidate.quote, ...changed } }],
    } as unknown as PersonalPortfolioOverviewInput;
    expect(
      calculatePersonalPortfolioOverview(mutated).holdings[0]
        ?.unavailableReason,
    ).toBe("invalid_quote");
  });

  it("rejects malformed manual inputs and duplicate holdings with a generic error", () => {
    const original = input();
    for (const portfolio of [
      { ...original.portfolio, cashUsd: "-1" },
      { ...original.portfolio, currency: "EUR" },
      { ...original.portfolio, holdings: [holding("a", "0")] },
      { ...original.portfolio, holdings: [holding("a", "1000000000.000001")] },
      { ...original.portfolio, holdings: [holding("a", "1", "0.001")] },
      { ...original.portfolio, holdings: [holding(), holding()] },
      {
        ...original.portfolio,
        holdings: [{ ...holding(), confirmedOn: "2026-09-10" }],
      },
    ]) {
      expect(() =>
        calculatePersonalPortfolioOverview({
          ...original,
          portfolio,
        } as PersonalPortfolioOverviewInput),
      ).toThrow("Portfolio overview input is invalid.");
    }
  });

  it("normalizes negative zero, isolates Decimal settings, and freezes only copied output", () => {
    const position = holding("a", "1", "0.01");
    const value = { ...input([position]), quotes: [entry(position, "0.009")] };
    const saved = {
      precision: Decimal.precision,
      maxE: Decimal.maxE,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({ precision: 2, maxE: 1, rounding: Decimal.ROUND_DOWN });
      const result = calculatePersonalPortfolioOverview(value);
      expect(result.unrealizedGainUsd).toBe("0.00");
      expect(result.unrealizedGainPercent).toBe("-10.00");
      expect(Object.isFrozen(result.holdings[0]?.quote)).toBe(true);
      expect(Object.isFrozen(value.quotes[0]?.quote)).toBe(false);
      expect(
        calculatePersonalPortfolioOverview(
          input([holding("a", "1000000000", "1000000000000")]),
        ).totalValueUsd,
      ).toBe("2000000000.00");
    } finally {
      Decimal.set(saved);
    }
  });
});
