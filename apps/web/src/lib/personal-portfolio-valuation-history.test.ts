import type {
  PersonalMarketDataRangeDto,
  PersonalMarketOverviewDto,
  PersonalPortfolioIdentity,
  PersonalPortfolioLedgerActivity,
  PersonalPortfolioLedgerPayloadV3,
  PersonalPortfolioLedgerSplit,
  PersonalPortfolioLedgerTransaction,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import {
  calculatePersonalPortfolioValuationHistory,
  getPersonalPortfolioValuationWindow,
  type PersonalPortfolioValuationHistoryInput,
  type PersonalPortfolioValuationHistoryResult,
} from "./personal-portfolio-valuation-history";

type History = PersonalMarketOverviewDto["history"];

function identity(suffix = "a"): PersonalPortfolioIdentity {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Security ${suffix}`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common",
    symbol: suffix.toUpperCase(),
  };
}

function ledger(
  transactions: readonly PersonalPortfolioLedgerActivity[] = [],
): PersonalPortfolioLedgerPayloadV3 {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [identity()],
    opening: {
      asOfDate: "2026-09-01",
      cashUsd: "100",
      holdings: [
        {
          listingId: "listing-a",
          shares: "3",
          totalCostBasisUsd: "30",
          confirmedOn: "2026-09-01",
        },
      ],
    },
    transactions,
  };
}

function trade(
  id: string,
  type: "buy" | "sell",
  date: string,
  shares = "3",
  grossUsd = "30",
  feeUsd = "0",
): PersonalPortfolioLedgerTransaction {
  return { id, type, date, listingId: "listing-a", shares, grossUsd, feeUsd };
}

function cash(
  id: string,
  type: "deposit" | "withdrawal" | "dividend" | "fee",
  date: string,
  grossUsd: string,
): PersonalPortfolioLedgerTransaction {
  return {
    id,
    type,
    date,
    listingId: type === "dividend" ? "listing-a" : null,
    shares: null,
    grossUsd,
    feeUsd: "0",
  };
}

function split(
  id = "split",
  date = "2026-09-02",
  ratioNumerator = "2",
  ratioDenominator = "1",
): PersonalPortfolioLedgerSplit {
  return {
    id,
    date,
    type: "split",
    listingId: "listing-a",
    ratioNumerator,
    ratioDenominator,
  };
}

function bar(
  date: string,
  close = "10",
  splitFactor = "1",
  dividendCash = "0",
): History["bars"][number] {
  return {
    date,
    splitFactor,
    dividendCash,
    raw: { open: close, high: close, low: close, close, volume: "100" },
    adjusted: {
      open: "999",
      high: "999",
      low: "999",
      close: "999",
      volume: "100",
    },
  };
}

function history(
  bars: History["bars"] = [
    bar("2026-09-01"),
    bar("2026-09-02", "11"),
    bar("2026-09-03", "12"),
    bar("2026-09-04", "13"),
  ],
  startDate = "2026-09-01",
  endDate = "2026-09-04",
): History {
  return { range: "1m", startDate, endDate, bars };
}

function input(
  source = ledger(),
  observations = history(),
): PersonalPortfolioValuationHistoryInput {
  return {
    ledger: source,
    startDate: "2026-09-01",
    endDate: "2026-09-04",
    histories: [{ identity: identity(), history: observations }],
  };
}

function valid(
  value: PersonalPortfolioValuationHistoryInput,
): Extract<PersonalPortfolioValuationHistoryResult, { status: "available" }> {
  const result = calculatePersonalPortfolioValuationHistory(value);
  expect(result.status).toBe("available");
  if (result.status !== "available") throw new Error(result.reason);
  return result;
}

describe("portfolio end-of-day valuation history", () => {
  it("values raw closes and EOD balances without using adjusted or current prices", () => {
    const result = valid(input());
    expect(result.points.map((point) => point.totalValueUsd)).toEqual([
      "130.00",
      "133.00",
      "136.00",
      "139.00",
    ]);
    expect(result.coverage).toEqual({
      totalDates: 4,
      completeDates: 4,
      missingPriceDates: 0,
      unknownCashDates: 0,
      splitReviewDates: 0,
    });
    expect(result.comparison).toEqual({
      firstDate: "2026-09-01",
      lastDate: "2026-09-04",
      firstValueUsd: "130.00",
      lastValueUsd: "139.00",
      netExternalFlowsUsd: "0.00",
      changeAfterExternalFlowsUsd: "9.00",
      endpointReturn: { status: "available", percent: "6.92" },
      modifiedDietzReturn: { status: "available", percent: "6.92" },
    });
  });

  it("applies all same-day trades and cash movements before that day's close", () => {
    const source = ledger([
      cash("deposit", "deposit", "2026-09-02", "20"),
      trade("buy", "buy", "2026-09-02", "1", "10", "1"),
      trade("sell", "sell", "2026-09-02", "2", "24", "2"),
    ]);
    const result = valid({
      ...input(source, history([bar("2026-09-01"), bar("2026-09-02", "12")])),
      endDate: "2026-09-02",
    });
    expect(result.points[1]).toMatchObject({
      cashUsd: "131.00",
      holdingsValueUsd: "24.00",
      totalValueUsd: "155.00",
      netExternalFlowUsd: "20.00",
    });
    expect(result.comparison).toMatchObject({
      netExternalFlowsUsd: "20.00",
      changeAfterExternalFlowsUsd: "5.00",
    });
  });

  it("calculates cash-only dates without a price history and treats only deposits and withdrawals as external", () => {
    const base = ledger([
      cash("deposit", "deposit", "2026-09-02", "20"),
      cash("withdrawal", "withdrawal", "2026-09-03", "5"),
      cash("dividend", "dividend", "2026-09-03", "3"),
      cash("fee", "fee", "2026-09-04", "1"),
    ]);
    const result = valid({
      ...input({ ...base, opening: { ...base.opening, holdings: [] } }),
      histories: [],
    });
    expect(result.points.map((point) => point.totalValueUsd)).toEqual([
      "100.00",
      "120.00",
      "118.00",
      "117.00",
    ]);
    expect(result.points.map((point) => point.netExternalFlowUsd)).toEqual([
      "0.00",
      "20.00",
      "-5.00",
      "0.00",
    ]);
    expect(result.comparison).toMatchObject({
      netExternalFlowsUsd: "15.00",
      changeAfterExternalFlowsUsd: "2.00",
    });
  });

  it("replays pre-window activities without misreporting them as first-day flows", () => {
    const source = ledger([
      cash("deposit", "deposit", "2026-09-02", "20"),
      trade("buy", "buy", "2026-09-02", "1", "10"),
    ]);
    const result = valid({ ...input(source), startDate: "2026-09-03" });
    expect(result.points[0]).toMatchObject({
      cashUsd: "110.00",
      holdingsValueUsd: "48.00",
      netExternalFlowUsd: "0.00",
    });
    expect(result.comparison).toMatchObject({
      netExternalFlowsUsd: "0.00",
      changeAfterExternalFlowsUsd: "4.00",
    });
  });

  it("clips to the opening EOD balance without valuing earlier observations", () => {
    const result = valid({ ...input(), startDate: "2026-08-01" });
    expect(result.startDate).toBe("2026-08-01");
    expect(result.effectiveStartDate).toBe("2026-09-01");
    expect(result.points).toHaveLength(4);
  });

  it("preserves unknown cash while exposing complete observed holdings values", () => {
    const base = ledger([cash("deposit", "deposit", "2026-09-02", "20")]);
    const result = valid(
      input({ ...base, opening: { ...base.opening, cashUsd: null } }),
    );
    expect(result.points.map((point) => point.holdingsValueUsd)).toEqual([
      "30.00",
      "33.00",
      "36.00",
      "39.00",
    ]);
    expect(
      result.points.every(
        (point) => point.cashUsd === null && point.totalValueUsd === null,
      ),
    ).toBe(true);
    expect(result.coverage).toMatchObject({
      completeDates: 0,
      unknownCashDates: 4,
    });
    expect(result.comparison).toEqual({
      firstDate: null,
      lastDate: null,
      firstValueUsd: null,
      lastValueUsd: null,
      netExternalFlowsUsd: null,
      changeAfterExternalFlowsUsd: null,
      endpointReturn: {
        status: "unavailable",
        reason: "insufficient_complete_dates",
      },
      modifiedDietzReturn: {
        status: "unavailable",
        reason: "insufficient_complete_dates",
      },
    });
  });

  it("does not carry prices over an absent date or interpolate between observations", () => {
    const result = valid(
      input(ledger(), history([bar("2026-09-01"), bar("2026-09-04", "13")])),
    );
    expect(result.points.map((point) => point.totalValueUsd)).toEqual([
      "130.00",
      null,
      null,
      "139.00",
    ]);
    expect(result.points[1]).toMatchObject({
      pricedHoldingsValueUsd: "0.00",
      holdingsValueUsd: null,
      activeHoldings: 1,
      pricedHoldings: 0,
      missingPriceListingIds: ["listing-a"],
    });
    expect(result.coverage).toMatchObject({
      completeDates: 2,
      missingPriceDates: 2,
    });
  });

  it("retains an unaffected priced subtotal while an active listing has no observed close", () => {
    const base = ledger();
    const source = {
      ...base,
      identities: [...base.identities, identity("b")],
      opening: {
        ...base.opening,
        holdings: [
          ...base.opening.holdings,
          { ...base.opening.holdings[0]!, listingId: "listing-b" },
        ],
      },
    };
    expect(valid(input(source)).points[0]).toMatchObject({
      pricedHoldingsValueUsd: "30.00",
      totalValueUsd: null,
      activeHoldings: 2,
      pricedHoldings: 1,
      missingPriceListingIds: ["listing-b"],
    });
  });

  it("requires no price after a clean position is sold out", () => {
    const result = valid(
      input(
        ledger([trade("close", "sell", "2026-09-02")]),
        history([bar("2026-09-01")]),
      ),
    );
    expect(result.points.map((point) => point.totalValueUsd)).toEqual([
      "130.00",
      "130.00",
      "130.00",
      "130.00",
    ]);
    expect(result.points[2]).toMatchObject({
      activeHoldings: 0,
      pricedHoldings: 0,
      holdingsValueUsd: "0.00",
      missingPriceListingIds: [],
    });
  });

  it("sums exact position values before cent rounding", () => {
    const base = ledger();
    const identities = [identity(), identity("b")];
    const source = {
      ...base,
      identities,
      opening: {
        ...base.opening,
        cashUsd: "0",
        holdings: identities.map((entry) => ({
          listingId: entry.listingId,
          shares: "1",
          totalCostBasisUsd: null,
          confirmedOn: "2026-09-01",
        })),
      },
    };
    const result = valid({
      ...input(source),
      endDate: "2026-09-01",
      histories: identities.map((entry) => ({
        identity: entry,
        history: history([bar("2026-09-01", "0.004")]),
      })),
    });
    expect(result.points[0]).toMatchObject({
      holdingsValueUsd: "0.01",
      totalValueUsd: "0.01",
      pricedHoldings: 2,
    });
  });

  it("uses millionth-share precision at the half-cent boundary", () => {
    const base = ledger();
    const source = {
      ...base,
      opening: {
        ...base.opening,
        cashUsd: "0",
        holdings: [{ ...base.opening.holdings[0]!, shares: "0.000001" }],
      },
    };
    expect(
      valid({
        ...input(source, history([bar("2026-09-01", "5000")])),
        endDate: "2026-09-01",
      }).points[0]?.totalValueUsd,
    ).toBe("0.01");
  });

  it("reconciles comparison to displayed endpoint cents, including subcent endpoints", () => {
    const base = ledger();
    const source = {
      ...base,
      opening: {
        ...base.opening,
        cashUsd: "0",
        holdings: [{ ...base.opening.holdings[0]!, shares: "1" }],
      },
    };
    const result = valid({
      ...input(
        source,
        history([bar("2026-09-01", "0.01"), bar("2026-09-02", "0.005")]),
      ),
      endDate: "2026-09-02",
    });
    expect(result.comparison).toMatchObject({
      firstValueUsd: "0.01",
      lastValueUsd: "0.01",
      netExternalFlowsUsd: "0.00",
      changeAfterExternalFlowsUsd: "0.00",
      endpointReturn: { status: "available", percent: "0.00" },
      modifiedDietzReturn: { status: "available", percent: "0.00" },
    });
  });

  it("uses actual complete endpoint dates and includes flows across intervening gaps", () => {
    const source = ledger([
      cash("first-day", "deposit", "2026-09-02", "10"),
      cash("gap", "withdrawal", "2026-09-03", "3"),
      cash("last-day", "deposit", "2026-09-04", "5"),
    ]);
    const result = valid(
      input(source, history([bar("2026-09-02"), bar("2026-09-04", "12")])),
    );
    expect(result.comparison).toEqual({
      firstDate: "2026-09-02",
      lastDate: "2026-09-04",
      firstValueUsd: "140.00",
      lastValueUsd: "148.00",
      netExternalFlowsUsd: "2.00",
      changeAfterExternalFlowsUsd: "6.00",
      endpointReturn: { status: "unavailable", reason: "external_flows" },
      modifiedDietzReturn: { status: "available", percent: "4.33" },
    });
  });

  it("withholds comparison amounts and return with fewer than two complete dates", () => {
    for (const observations of [history([]), history([bar("2026-09-02")])]) {
      const comparison = valid(input(ledger(), observations)).comparison;
      expect(comparison).toEqual({
        firstDate: null,
        lastDate: null,
        firstValueUsd: null,
        lastValueUsd: null,
        netExternalFlowsUsd: null,
        changeAfterExternalFlowsUsd: null,
        endpointReturn: {
          status: "unavailable",
          reason: "insufficient_complete_dates",
        },
        modifiedDietzReturn: {
          status: "unavailable",
          reason: "insufficient_complete_dates",
        },
      });
      expect(Object.isFrozen(comparison.endpointReturn)).toBe(true);
      expect(Object.isFrozen(comparison.modifiedDietzReturn)).toBe(true);
    }
  });

  it("does not credit provider dividend observations as ledger cash", () => {
    const result = valid(
      input(
        ledger(),
        history([
          bar("2026-09-01", "10", "1", "999"),
          bar("2026-09-02", "10", "1", "999"),
        ]),
      ),
    );
    expect(result.points[1]).toMatchObject({
      cashUsd: "100.00",
      totalValueUsd: "130.00",
      netExternalFlowUsd: "0.00",
    });
    expect(result.comparison.endpointReturn).toEqual({
      status: "available",
      percent: "0.00",
    });
    expect(result.comparison.modifiedDietzReturn).toEqual({
      status: "available",
      percent: "0.00",
    });
  });

  it("supports unchanged V2 financial ledgers and immutable JSON-safe output", () => {
    const value = input();
    const before = structuredClone(value);
    const result = valid(value);
    expect(
      valid({
        ...value,
        ledger: { ...value.ledger, schemaVersion: 2, transactions: [] },
      }),
    ).toEqual(result);
    expect(value).toEqual(before);
    expect(Object.isFrozen(value.histories[0]?.history.bars)).toBe(false);
    expect(Object.isFrozen(result.points[0]?.missingPriceListingIds)).toBe(
      true,
    );
    expect(Object.isFrozen(result.points)).toBe(true);
    expect(Object.isFrozen(result.coverage)).toBe(true);
    expect(Object.isFrozen(result.comparison)).toBe(true);
    expect(Object.isFrozen(result.comparison.endpointReturn)).toBe(true);
    expect(Object.isFrozen(result.comparison.modifiedDietzReturn)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe("portfolio endpoint percentage returns", () => {
  it.each([
    ["100", "125", "25.00"],
    ["100", "75", "-25.00"],
    ["100", "100", "0.00"],
    ["10000", "10000.50", "0.01"],
    ["10000", "9999.50", "-0.01"],
    ["10000", "9999.51", "0.00"],
    ["10000", "10000.49", "0.00"],
  ])(
    "rounds the return from %s to %s to %s percent without negative zero",
    (startingPrice, endingPrice, percent) => {
      const base = ledger();
      const source = {
        ...base,
        opening: {
          ...base.opening,
          cashUsd: "0",
          holdings: [{ ...base.opening.holdings[0]!, shares: "1" }],
        },
      };
      const result = valid(
        input(
          source,
          history([
            bar("2026-09-01", startingPrice),
            bar("2026-09-04", endingPrice),
          ]),
        ),
      );
      expect(result.coverage).toMatchObject({
        completeDates: 2,
        missingPriceDates: 2,
      });
      expect(result.comparison.endpointReturn).toEqual({
        status: "available",
        percent,
      });
      expect(result.comparison.modifiedDietzReturn).toEqual({
        status: "available",
        percent,
      });
    },
  );

  it.each([
    [`100004${"9".repeat(45)}`, "0.00"],
    [`100005${"0".repeat(45)}`, "0.01"],
    [`99995${"0".repeat(45)}`, "-0.01"],
  ])(
    "preserves exact percentage boundaries for huge values %s",
    (end, percent) => {
      const base = ledger();
      const source = {
        ...base,
        opening: {
          ...base.opening,
          cashUsd: "0",
          holdings: [{ ...base.opening.holdings[0]!, shares: "1000000000" }],
        },
      };
      const result = valid(
        input(
          source,
          history([
            bar("2026-09-01", `1${"0".repeat(50)}`),
            bar("2026-09-04", end),
          ]),
        ),
      );
      expect(result.comparison.firstValueUsd).toBe(`1${"0".repeat(59)}.00`);
      expect(result.comparison.endpointReturn).toEqual({
        status: "available",
        percent,
      });
      expect(result.comparison.modifiedDietzReturn).toEqual({
        status: "available",
        percent,
      });
    },
  );

  it("reports a total loss when recorded internal costs exhaust the portfolio", () => {
    const base = ledger([cash("fee", "fee", "2026-09-02", "100")]);
    const source = { ...base, opening: { ...base.opening, holdings: [] } };
    const result = valid({ ...input(source), histories: [] });
    expect(result.comparison).toMatchObject({
      firstValueUsd: "100.00",
      lastValueUsd: "0.00",
      changeAfterExternalFlowsUsd: "-100.00",
      endpointReturn: { status: "available", percent: "-100.00" },
      modifiedDietzReturn: { status: "available", percent: "-100.00" },
    });
  });

  it.each(["0", "0.004"])(
    "withholds a return when the displayed starting value is zero (%s exact)",
    (startingValue) => {
      const base = ledger();
      const source = {
        ...base,
        opening: {
          ...base.opening,
          cashUsd: "0",
          holdings:
            startingValue === "0"
              ? []
              : [{ ...base.opening.holdings[0]!, shares: "1" }],
        },
      };
      const result = valid(
        input(
          source,
          history([bar("2026-09-01", "0.004"), bar("2026-09-04", "0.01")]),
        ),
      );
      expect(result.comparison).toMatchObject({
        firstValueUsd: "0.00",
        endpointReturn: {
          status: "unavailable",
          reason: "non_positive_starting_value",
        },
        modifiedDietzReturn: {
          status: "unavailable",
          reason: "non_positive_starting_value",
        },
      });
      expect(result.comparison.changeAfterExternalFlowsUsd).toBe(
        startingValue === "0" ? "0.00" : "0.01",
      );
    },
  );

  it.each(["deposit", "withdrawal"] as const)(
    "excludes first-date and later-than-last %s activities from eligibility",
    (type) => {
      const source = ledger([
        cash("first", type, "2026-09-02", "10"),
        cash("after-last", type, "2026-09-04", "10"),
      ]);
      const result = valid(
        input(source, history([bar("2026-09-02"), bar("2026-09-03")])),
      );
      expect(result.comparison).toMatchObject({
        firstDate: "2026-09-02",
        lastDate: "2026-09-03",
        netExternalFlowsUsd: "0.00",
        endpointReturn: { status: "available", percent: "0.00" },
      });
      expect(result.points[3]?.netExternalFlowUsd).toBe(
        type === "deposit" ? "10.00" : "-10.00",
      );
    },
  );

  it("excludes pre-window external activities while retaining their cash in the baseline", () => {
    const source = ledger([
      cash("deposit", "deposit", "2026-09-02", "20"),
      cash("withdrawal", "withdrawal", "2026-09-02", "5"),
    ]);
    const result = valid({
      ...input(source, history([bar("2026-09-03"), bar("2026-09-04")])),
      startDate: "2026-09-03",
    });
    expect(result.comparison).toMatchObject({
      firstValueUsd: "145.00",
      lastValueUsd: "145.00",
      netExternalFlowsUsd: "0.00",
      endpointReturn: { status: "available", percent: "0.00" },
    });
  });

  it.each(["deposit", "withdrawal"] as const)(
    "blocks a %s on the last complete date while keeping the dollar bridge",
    (type) => {
      const result = valid(
        input(
          ledger([cash("last-date", type, "2026-09-03", "10")]),
          history([bar("2026-09-02"), bar("2026-09-03", "11")]),
        ),
      );
      expect(result.comparison).toMatchObject({
        firstDate: "2026-09-02",
        lastDate: "2026-09-03",
        changeAfterExternalFlowsUsd: "3.00",
        endpointReturn: { status: "unavailable", reason: "external_flows" },
      });
    },
  );

  it.each(["2026-09-02", "2026-09-03"])(
    "blocks offsetting flows with a withdrawal on %s, including missing-price dates",
    (withdrawalDate) => {
      const source = ledger([
        cash("deposit", "deposit", "2026-09-02", "10"),
        cash("withdrawal", "withdrawal", withdrawalDate, "10"),
      ]);
      const result = valid(
        input(source, history([bar("2026-09-01"), bar("2026-09-04", "11")])),
      );
      expect(result.comparison).toMatchObject({
        netExternalFlowsUsd: "0.00",
        changeAfterExternalFlowsUsd: "3.00",
        endpointReturn: { status: "unavailable", reason: "external_flows" },
      });
      expect(result.coverage.missingPriceDates).toBe(2);
    },
  );

  it("retains internal trades, trade fees, recorded dividends and fees in the return", () => {
    const source = ledger([
      trade("buy", "buy", "2026-09-02", "1", "10", "1"),
      trade("sell", "sell", "2026-09-02", "2", "24", "2"),
      cash("dividend", "dividend", "2026-09-03", "3"),
      cash("fee", "fee", "2026-09-04", "1"),
    ]);
    const result = valid(
      input(source, history([bar("2026-09-01"), bar("2026-09-04", "12")])),
    );
    expect(result.comparison).toMatchObject({
      firstValueUsd: "130.00",
      lastValueUsd: "137.00",
      netExternalFlowsUsd: "0.00",
      changeAfterExternalFlowsUsd: "7.00",
      endpointReturn: { status: "available", percent: "5.38" },
      modifiedDietzReturn: { status: "available", percent: "5.38" },
    });
  });

  it.each([
    ["2", "1", "2", "5"],
    ["1", "4", "0.25", "40"],
  ])(
    "uses reconciled %s:%s shares and raw closes without inventing split returns",
    (numerator, denominator, factor, close) => {
      const result = valid(
        input(
          ledger([split("action", "2026-09-02", numerator, denominator)]),
          history([bar("2026-09-01"), bar("2026-09-02", close, factor)]),
        ),
      );
      expect(result.comparison).toMatchObject({
        firstValueUsd: "130.00",
        lastValueUsd: "130.00",
        endpointReturn: { status: "available", percent: "0.00" },
        modifiedDietzReturn: { status: "available", percent: "0.00" },
      });
    },
  );
});

describe("portfolio Modified Dietz period estimates", () => {
  function flowPortfolio(
    transactions: readonly PersonalPortfolioLedgerActivity[],
  ) {
    const base = ledger(transactions);
    return {
      ...base,
      opening: {
        ...base.opening,
        cashUsd: "90",
        holdings: [{ ...base.opening.holdings[0]!, shares: "1" }],
      },
    };
  }

  function cashPortfolio(
    transactions: readonly PersonalPortfolioLedgerActivity[],
    cashUsd = "100",
  ) {
    const base = ledger(transactions);
    return { ...base, opening: { ...base.opening, cashUsd, holdings: [] } };
  }

  it.each([
    ["deposit", "100", "6.00"],
    ["withdrawal", "50", "15.00"],
  ] as const)(
    "weights a %s by the calendar days remaining after its date",
    (type, amount, percent) => {
      const result = valid(
        input(
          flowPortfolio([cash("flow", type, "2026-09-02", amount)]),
          history([bar("2026-09-01"), bar("2026-09-04", "20")]),
        ),
      );
      expect(result.comparison).toMatchObject({
        firstValueUsd: "100.00",
        changeAfterExternalFlowsUsd: "10.00",
        endpointReturn: { status: "unavailable", reason: "external_flows" },
        modifiedDietzReturn: { status: "available", percent },
      });
      expect(result.coverage.missingPriceDates).toBe(2);
    },
  );

  it.each([
    ["deposit", "withdrawal", "2026-09-02", "10.00"],
    ["deposit", "withdrawal", "2026-09-03", "8.57"],
    ["withdrawal", "deposit", "2026-09-03", "12.00"],
  ] as const)(
    "retains timing for offsetting %s and %s on %s",
    (firstType, secondType, secondDate, percent) => {
      const source = flowPortfolio([
        cash("first-flow", firstType, "2026-09-02", "50"),
        cash("second-flow", secondType, secondDate, "50"),
      ]);
      const result = valid(
        input(source, history([bar("2026-09-01"), bar("2026-09-04", "20")])),
      );
      expect(result.comparison).toMatchObject({
        netExternalFlowsUsd: "0.00",
        changeAfterExternalFlowsUsd: "10.00",
        endpointReturn: { status: "unavailable", reason: "external_flows" },
        modifiedDietzReturn: { status: "available", percent },
      });
    },
  );

  it.each(["deposit", "withdrawal"] as const)(
    "gives a last-date %s zero weight while subtracting it from the gain",
    (type) => {
      const result = valid(
        input(
          flowPortfolio([cash("last-flow", type, "2026-09-04", "50")]),
          history([bar("2026-09-01"), bar("2026-09-04", "20")]),
        ),
      );
      expect(result.comparison).toMatchObject({
        changeAfterExternalFlowsUsd: "10.00",
        modifiedDietzReturn: { status: "available", percent: "10.00" },
      });
    },
  );

  it("uses actual complete endpoints and excludes first-date and later flows", () => {
    const source = flowPortfolio([
      cash("first-flow", "deposit", "2026-09-02", "10"),
      cash("later-flow", "withdrawal", "2026-09-04", "50"),
    ]);
    const result = valid(
      input(source, history([bar("2026-09-02"), bar("2026-09-03", "21")])),
    );
    expect(result.comparison).toMatchObject({
      firstDate: "2026-09-02",
      lastDate: "2026-09-03",
      firstValueUsd: "110.00",
      lastValueUsd: "121.00",
      netExternalFlowsUsd: "0.00",
      modifiedDietzReturn: { status: "available", percent: "10.00" },
    });
  });

  it("excludes pre-window flow amounts and weights from the selected comparison", () => {
    const source = flowPortfolio([
      cash("deposit", "deposit", "2026-09-02", "20"),
      cash("withdrawal", "withdrawal", "2026-09-02", "5"),
    ]);
    const result = valid({
      ...input(source, history([bar("2026-09-03"), bar("2026-09-04", "21")])),
      startDate: "2026-09-03",
    });
    expect(result.comparison).toMatchObject({
      firstValueUsd: "115.00",
      lastValueUsd: "126.00",
      netExternalFlowsUsd: "0.00",
      modifiedDietzReturn: { status: "available", percent: "9.57" },
    });
  });

  it("counts leap days and uses end-of-day weights for a cash-only portfolio", () => {
    const source = cashPortfolio([
      cash("deposit", "deposit", "2024-02-28", "100"),
      cash("fee", "fee", "2024-03-01", "10"),
    ]);
    const result = valid({
      ledger: {
        ...source,
        opening: { ...source.opening, asOfDate: "2024-02-27" },
      },
      startDate: "2024-02-27",
      endDate: "2024-03-01",
      histories: [],
    });
    expect(result.points).toHaveLength(4);
    expect(result.comparison).toMatchObject({
      firstValueUsd: "100.00",
      lastValueUsd: "190.00",
      netExternalFlowsUsd: "100.00",
      changeAfterExternalFlowsUsd: "-10.00",
      modifiedDietzReturn: { status: "available", percent: "-6.00" },
    });
  });

  it.each([
    ["dividend", "0.75", "0.01"],
    ["fee", "0.75", "-0.01"],
    ["fee", "0.74", "0.00"],
  ] as const)(
    "rounds the weighted estimate after a %s of %s without negative zero",
    (type, amount, percent) => {
      const source = cashPortfolio(
        [
          cash("deposit", "deposit", "2026-09-02", "10000"),
          cash("internal", type, "2026-09-03", amount),
        ],
        "10000",
      );
      const result = valid({
        ...input(source),
        histories: [],
        endDate: "2026-09-03",
      });
      expect(result.comparison.modifiedDietzReturn).toEqual({
        status: "available",
        percent,
      });
    },
  );

  it("keeps positive fractional-cent weighted capital exact without rounding it to zero", () => {
    const source = cashPortfolio(
      [cash("withdrawal", "withdrawal", "2026-09-02", "0.01")],
      "0.01",
    );
    const result = valid({ ...input(source), histories: [] });
    expect(result.comparison).toMatchObject({
      firstValueUsd: "0.01",
      lastValueUsd: "0.00",
      netExternalFlowsUsd: "-0.01",
      modifiedDietzReturn: { status: "available", percent: "0.00" },
    });
  });

  it.each([
    ["50", "150"],
    ["200", "300"],
  ])(
    "withholds zero or negative weighted capital despite a valid ledger (%s gain)",
    (dividend, withdrawal) => {
      const source = cashPortfolio([
        cash("dividend", "dividend", "2026-09-02", dividend),
        cash("withdrawal", "withdrawal", "2026-09-02", withdrawal),
      ]);
      const result = valid({ ...input(source), histories: [] });
      expect(result.comparison).toMatchObject({
        firstValueUsd: "100.00",
        lastValueUsd: "0.00",
        changeAfterExternalFlowsUsd: `${dividend}.00`,
        modifiedDietzReturn: {
          status: "unavailable",
          reason: "non_positive_weighted_capital",
        },
      });
    },
  );

  it("uses starting-value eligibility before capital or loss checks", () => {
    const source = cashPortfolio(
      [cash("deposit", "deposit", "2026-09-02", "100")],
      "0",
    );
    const result = valid({ ...input(source), histories: [] });
    expect(result.comparison.modifiedDietzReturn).toEqual({
      status: "unavailable",
      reason: "non_positive_starting_value",
    });
  });

  it.each([
    ["20000", { status: "available", percent: "-100.00" }],
    [
      "20000.01",
      { status: "unavailable", reason: "estimate_below_total_loss" },
    ],
    ["30000", { status: "unavailable", reason: "estimate_below_total_loss" }],
  ] as const)(
    "checks the exact total-loss cutoff before rounding a fee of %s",
    (fee, expected) => {
      const source = cashPortfolio(
        [
          cash("empty", "withdrawal", "2026-09-02", "100000"),
          cash("refill", "deposit", "2026-09-10", "100000"),
          cash("fee", "fee", "2026-09-11", fee),
        ],
        "100000",
      );
      const result = valid({
        ...input(source),
        histories: [],
        endDate: "2026-09-11",
      });
      expect(result.comparison.modifiedDietzReturn).toEqual(expected);
      expect(result.comparison.changeAfterExternalFlowsUsd).toBe(
        `-${fee.includes(".") ? fee : `${fee}.00`}`,
      );
    },
  );

  it.each([
    [[], "0.00"],
    [[cash("gain", "dividend", "2026-09-11", "100")], "500.00"],
  ] as const)(
    "supports emptied and refilled periods without a blanket exclusion or gain cap %#",
    (ending, percent) => {
      const source = cashPortfolio([
        cash("empty", "withdrawal", "2026-09-02", "100"),
        cash("refill", "deposit", "2026-09-10", "100"),
        ...ending,
      ]);
      const result = valid({
        ...input(source),
        histories: [],
        endDate: "2026-09-11",
      });
      expect(result.points[1]?.totalValueUsd).toBe("0.00");
      expect(result.comparison.modifiedDietzReturn).toEqual({
        status: "available",
        percent,
      });
    },
  );

  it("cancels large early flow weights exactly without changing the comparison", () => {
    const currentFlows = [cash("current", "deposit", "2026-09-02", "50")];
    const base = flowPortfolio(currentFlows);
    const source = {
      ...base,
      opening: {
        ...base.opening,
        asOfDate: "2000-01-01",
        cashUsd: "999999999900",
        holdings: [{ ...base.opening.holdings[0]!, confirmedOn: "2000-01-01" }],
      },
    };
    // A large withdrawal/deposit pair years before the selected window leaves
    // the baseline unchanged but contributes large, unequal historical weights.
    const historical = {
      ...source,
      transactions: [
        cash("old-out", "withdrawal", "2000-01-02", "999999999900"),
        cash("old-in", "deposit", "2000-01-03", "999999999900"),
        ...currentFlows,
      ],
    };
    const observations = history([
      bar("2026-09-01"),
      bar("2026-09-04", "100000000010"),
    ]);
    const result = valid(input(historical, observations));
    expect(result.comparison.modifiedDietzReturn).toEqual({
      status: "available",
      percent: "10.00",
    });
    expect(result).toEqual(valid(input(source, observations)));
  });
});

describe("portfolio valuation split lineage", () => {
  it.each([
    ["2", "1", "2", "5"],
    ["1", "3", "0.3333333333333333", "30"],
  ])(
    "uses manually adjusted quantities and exact provider factor comparison for %s:%s",
    (numerator, denominator, factor, close) => {
      const result = valid(
        input(
          ledger([split("action", "2026-09-02", numerator, denominator)]),
          history([bar("2026-09-01"), bar("2026-09-02", close, factor)]),
        ),
      );
      expect(result.points[0]?.totalValueUsd).toBe("130.00");
      expect(result.points[1]?.totalValueUsd).toBe(
        denominator === "1" ? "130.00" : null,
      );
      expect(result.points[1]?.splitReviewListingIds).toEqual(
        denominator === "1" ? [] : ["listing-a"],
      );
    },
  );

  it("retains exact reverse split fractions when the provider ratio matches", () => {
    const result = valid(
      input(
        ledger([split("reverse", "2026-09-02", "1", "4")]),
        history([bar("2026-09-02", "40", "0.25")]),
      ),
    );
    expect(result.points[1]).toMatchObject({
      holdingsValueUsd: "30.00",
      totalValueUsd: "130.00",
      splitReviewListingIds: [],
    });
  });

  it("blocks an unrecorded split from its ex-date onward without blocking preceding dates", () => {
    const result = valid(
      input(
        ledger(),
        history([
          bar("2026-09-01"),
          bar("2026-09-02", "5", "2"),
          bar("2026-09-03", "6"),
        ]),
      ),
    );
    expect(result.points.map((point) => point.totalValueUsd)).toEqual([
      "130.00",
      null,
      null,
      null,
    ]);
    expect(result.points[1]).toMatchObject({
      pricedHoldingsValueUsd: "0.00",
      missingPriceListingIds: [],
      splitReviewListingIds: ["listing-a"],
    });
    expect(result.coverage.splitReviewDates).toBe(3);
  });

  it("does not create a split issue for shares first bought on the ex-date", () => {
    const base = ledger([trade("buy", "buy", "2026-09-02")]);
    const source = { ...base, opening: { ...base.opening, holdings: [] } };
    expect(
      valid(input(source, history([bar("2026-09-02", "5", "2")]))).points[1],
    ).toMatchObject({ totalValueUsd: "85.00", splitReviewListingIds: [] });
  });

  it("blocks manual splits with no exact observation, including actions before the displayed window", () => {
    const result = valid({
      ...input(
        ledger([split()]),
        history([bar("2026-09-03", "5"), bar("2026-09-04", "5")], "2026-09-03"),
      ),
      startDate: "2026-09-03",
    });
    expect(
      result.points.every(
        (point) =>
          point.totalValueUsd === null &&
          point.splitReviewListingIds[0] === "listing-a",
      ),
    ).toBe(true);
    expect(result.coverage).toMatchObject({
      splitReviewDates: 2,
      missingPriceDates: 0,
    });
  });

  it("keeps unresolved split lineage after an apparent position closure", () => {
    const result = valid(
      input(
        ledger([trade("apparent-close", "sell", "2026-09-03")]),
        history([bar("2026-09-01"), bar("2026-09-02", "5", "2")]),
      ),
    );
    expect(result.points[3]).toMatchObject({
      activeHoldings: 0,
      missingPriceListingIds: [],
      splitReviewListingIds: ["listing-a"],
      holdingsValueUsd: null,
      totalValueUsd: null,
    });
    const manual = valid(
      input(
        ledger([split(), trade("close", "sell", "2026-09-03", "6")]),
        history([bar("2026-09-01")]),
      ),
    );
    expect(manual.points[3]?.totalValueUsd).toBeNull();
  });

  it("retains prior flags outside a narrower reload, even through a newer opening date", () => {
    const result = valid({
      ...input(),
      priorSplitReviewDates: { "listing-a": ["2026-08-31"] },
    });
    expect(result.points.every((point) => point.totalValueUsd === null)).toBe(
      true,
    );
    const observed = valid({
      ...input(
        ledger(),
        history(
          [bar("2026-08-31"), bar("2026-09-01"), bar("2026-09-04")],
          "2026-08-31",
        ),
      ),
      priorSplitReviewDates: { "listing-a": ["2026-08-31"] },
    });
    expect(observed.points[0]?.totalValueUsd).toBe("130.00");
  });

  it("clears a prior warning only through exact re-observation and re-adds a current mismatch", () => {
    const base = input(
      ledger([split()]),
      history([bar("2026-09-02", "5", "2")]),
    );
    const priorSplitReviewDates = { "listing-a": ["2026-09-02"] };
    expect(
      valid({ ...base, priorSplitReviewDates }).points[1]?.totalValueUsd,
    ).toBe("130.00");
    expect(
      valid({
        ...base,
        histories: [
          { identity: identity(), history: history([bar("2026-09-02", "5")]) },
        ],
        priorSplitReviewDates,
      }).points[1]?.totalValueUsd,
    ).toBeNull();
  });

  it("ignores orphan retained warning IDs while preserving warnings for registered identities", () => {
    const priorSplitReviewDates = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [
        `removed-${String(index)}`,
        ["malformed-ignored-date"],
      ]),
    );
    expect(
      valid({ ...input(), priorSplitReviewDates }).coverage.completeDates,
    ).toBe(4);
    expect(
      calculatePersonalPortfolioValuationHistory({
        ...input(),
        priorSplitReviewDates: {
          ...priorSplitReviewDates,
          "listing-a": ["malformed-date"],
        },
      }),
    ).toEqual({ status: "invalid", reason: "invalid_split_reviews" });
  });
});

describe("valuation history input bounds and UTC windows", () => {
  it.each([
    ["1m", "2026-03-31", "2026-02-28"],
    ["3m", "2026-05-31", "2026-02-28"],
    ["1y", "2024-02-29", "2023-02-28"],
    ["5y", "2026-09-09", "2021-09-09"],
    ["10y", "2026-09-09", "2016-09-09"],
    ["ytd", "2026-09-09", "2026-01-01"],
    ["1m", "2024-03-31", "2024-02-29"],
    ["3m", "2026-01-31", "2025-10-31"],
  ] as const)("clamps %s ending %s to %s", (range, date, startDate) => {
    expect(getPersonalPortfolioValuationWindow(range, date)).toEqual({
      startDate,
      endDate: date,
    });
  });

  it("rejects invalid dates, unsupported ranges and unavailable ledger windows", () => {
    expect(getPersonalPortfolioValuationWindow("1m", "0099-03-31")).toBeNull();
    expect(getPersonalPortfolioValuationWindow("10y", "0010-01-01")).toBeNull();
    expect(getPersonalPortfolioValuationWindow("1m", "2026-02-30")).toBeNull();
    expect(
      getPersonalPortfolioValuationWindow(
        "bad" as PersonalMarketDataRangeDto,
        "2026-09-09",
      ),
    ).toBeNull();
    for (const patch of [
      { startDate: "2026-02-30" },
      { endDate: "2026-08-31" },
      { startDate: "2026-08-01", endDate: "2026-08-31" },
      { startDate: "2000-01-01" },
    ])
      expect(
        calculatePersonalPortfolioValuationHistory({ ...input(), ...patch })
          .status,
      ).toBe("invalid");
  });

  it.each([
    null,
    { ...input(), ledger: { ...ledger(), schemaVersion: 1 } },
    {
      ...input(),
      ledger: ledger([trade("oversell", "sell", "2026-09-02", "4")]),
    },
    { ...input(), histories: null },
    { ...input(), histories: new Array(1) },
    { ...input(), histories: [input().histories[0], input().histories[0]] },
    {
      ...input(),
      histories: [{ identity: identity("other"), history: history() }],
    },
    {
      ...input(),
      histories: [
        {
          identity: { ...identity(), shareClassId: "different-class" },
          history: history(),
        },
      ],
    },
    {
      ...input(),
      histories: [
        {
          identity: identity(),
          history: history([bar("2026-09-02"), bar("2026-09-01")]),
        },
      ],
    },
    {
      ...input(),
      histories: [
        {
          identity: identity(),
          history: history([bar("2026-09-02", "1", "2e0")]),
        },
      ],
    },
    {
      ...input(),
      histories: [
        {
          identity: identity(),
          history: history([bar("2026-09-02", "1", "1", "-1")]),
        },
      ],
    },
    ...["0", "-1", "1e2", "NaN", "1".repeat(65)].map((close) => ({
      ...input(),
      histories: [
        { identity: identity(), history: history([bar("2026-09-02", close)]) },
      ],
    })),
  ])("rejects malformed input without throwing %#", (value) => {
    expect(
      calculatePersonalPortfolioValuationHistory(
        value as unknown as PersonalPortfolioValuationHistoryInput,
      ).status,
    ).toBe("invalid");
  });

  it("accepts bounded empty histories without claiming price coverage", () => {
    expect(valid({ ...input(), histories: [] }).coverage).toMatchObject({
      completeDates: 0,
      missingPriceDates: 4,
    });
  });

  it("bounds calendar rows, loaded listings and observations", () => {
    const base = ledger();
    const source = {
      ...base,
      opening: { asOfDate: "2016-09-09", cashUsd: "1", holdings: [] },
    };
    const result = valid({
      ledger: source,
      startDate: "2016-09-09",
      endDate: "2026-09-09",
      histories: [],
    });
    expect(result.points).toHaveLength(3653);
    expect(result.coverage.completeDates).toBe(3653);
    expect(
      calculatePersonalPortfolioValuationHistory({
        ...input(),
        histories: Array.from({ length: 21 }, () => input().histories[0]!),
      }).status,
    ).toBe("invalid");
    expect(
      calculatePersonalPortfolioValuationHistory(
        input(
          ledger(),
          history(Array.from({ length: 4097 }, () => bar("2026-09-01"))),
        ),
      ).status,
    ).toBe("invalid");
  });

  it("handles twenty listings and 250 activities over a full ten-year calendar", () => {
    const identities = Array.from({ length: 20 }, (_, index) =>
      identity(`a${String(index)}`),
    );
    const bars = Array.from({ length: 3653 }, (_, index) =>
      bar(new Date(Date.UTC(2016, 8, 9 + index)).toISOString().slice(0, 10)),
    );
    const base = ledger(
      Array.from({ length: 250 }, (_, index) =>
        cash(`deposit-${String(index)}`, "deposit", "2026-09-02", "1"),
      ),
    );
    const source: PersonalPortfolioLedgerPayloadV3 = {
      ...base,
      identities,
      opening: {
        asOfDate: "2016-09-09",
        cashUsd: "1000",
        holdings: identities.map((entry) => ({
          listingId: entry.listingId,
          shares: "1",
          totalCostBasisUsd: "10",
          confirmedOn: "2016-09-09",
        })),
      },
    };
    const result = valid({
      ledger: source,
      startDate: "2016-09-09",
      endDate: "2026-09-09",
      histories: identities.map((entry) => ({
        identity: entry,
        history: { ...history(bars, "2016-09-09", "2026-09-09"), range: "10y" },
      })),
    });
    expect(result.coverage).toEqual({
      totalDates: 3653,
      completeDates: 3653,
      missingPriceDates: 0,
      unknownCashDates: 0,
      splitReviewDates: 0,
    });
    expect(result.comparison).toMatchObject({
      firstValueUsd: "1200.00",
      lastValueUsd: "1450.00",
      netExternalFlowsUsd: "250.00",
      changeAfterExternalFlowsUsd: "0.00",
    });
  });
});
