import {
  projectPersonalPortfolioLedger,
  type PersonalMarketOverviewDto,
  type PersonalPortfolioLedgerActivity,
  type PersonalPortfolioLedgerPayload,
  type PersonalPortfolioLedgerPayloadV2,
  type PersonalPortfolioLedgerPayloadV3,
  type PersonalPortfolioLedgerSplit,
  type PersonalPortfolioLedgerTransaction,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import { assessPortfolioHistory } from "./personal-portfolio-history";

type History = PersonalMarketOverviewDto["history"];

function ledger(): PersonalPortfolioLedgerPayloadV2 {
  return {
    schemaVersion: 2,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "issuer-a",
        issuerName: "Issuer A",
        listingId: "listing-a",
        securityId: "security-a",
        securityName: "Security A",
        shareClassId: "class-a",
        shareClassName: "Common",
        symbol: "AAA",
      },
    ],
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
    transactions: [],
  };
}

function splitLedger(
  transactions: readonly PersonalPortfolioLedgerActivity[] = [],
): PersonalPortfolioLedgerPayloadV3 {
  return { ...ledger(), schemaVersion: 3, transactions };
}

function split(
  id = "split-1",
  numerator = "2",
  denominator = "1",
  date = "2026-09-02",
): PersonalPortfolioLedgerSplit {
  return {
    id,
    date,
    type: "split",
    listingId: "listing-a",
    ratioNumerator: numerator,
    ratioDenominator: denominator,
  };
}

function trade(
  id: string,
  type: "buy" | "sell",
  date = "2026-09-02",
  shares = "3",
): PersonalPortfolioLedgerTransaction {
  return {
    id,
    type,
    date,
    listingId: "listing-a",
    shares,
    grossUsd: "30",
    feeUsd: "0",
  };
}

function bar(
  date = "2026-09-02",
  splitFactor = "1",
  dividendCash = "0",
): History["bars"][number] {
  const price = {
    open: "10",
    high: "10",
    low: "10",
    close: "10",
    volume: "100",
  };
  return {
    date,
    splitFactor,
    dividendCash,
    raw: { ...price },
    adjusted: { ...price },
  };
}

function history(
  bars: History["bars"] = [bar()],
  startDate = "2026-09-01",
  endDate = "2026-09-09",
): History {
  return { bars, startDate, endDate, range: "1y" };
}

function assess(
  source: PersonalPortfolioLedgerPayload,
  observations: History = history(),
) {
  const result = assessPortfolioHistory(source, "listing-a", observations);
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected a usable history assessment");
  return result;
}

describe("portfolio history split assessment", () => {
  it.each([
    ["2", "1", "2", "matched", false],
    ["1", "4", "0.25", "matched", false],
    ["3", "2", "1.5000", "matched", false],
    ["1", "3", "0.3333333333333333", "review_difference", true],
    ["2", "1", "1", "review_difference", true],
    ["2", "1", "2.0000000000000001", "review_difference", true],
  ] as const)(
    "compares %s:%s with provider factor %s exactly",
    (numerator, denominator, factor, status, requiresSplitReview) => {
      const result = assess(
        splitLedger([split("manual", numerator, denominator)]),
        history([bar("2026-09-02", factor)]),
      );
      expect(result.actions).toEqual([
        {
          date: "2026-09-02",
          providerFactor: factor,
          recordedRatio: `${numerator}:${denominator}`,
          dividendCash: null,
          status,
        },
      ]);
      expect(result.requiresSplitReview).toBe(requiresSplitReview);
      expect(result.observedDates).toEqual(["2026-09-02"]);
      expect(result.splitReviewDates).toEqual(
        requiresSplitReview ? ["2026-09-02"] : [],
      );
    },
  );

  it("compares the product of multiple same-day ratios, including a net factor of one", () => {
    const combined = assess(
      splitLedger([split("first"), split("second", "3", "2")]),
      history([bar("2026-09-02", "3")]),
    );
    expect(combined.actions[0]).toMatchObject({
      recordedRatio: "6:2",
      status: "matched",
    });
    expect(combined.requiresSplitReview).toBe(false);
    const reversed = assess(
      splitLedger([split("first"), split("undo", "1", "2")]),
    );
    expect(reversed.actions[0]).toMatchObject({
      providerFactor: "1",
      recordedRatio: "2:2",
      status: "matched",
    });
  });

  it("flags an unrecorded observed split only while shares were held before its ex-date", () => {
    const result = assess(ledger(), history([bar("2026-09-02", "2")]));
    expect(result.actions[0]).toMatchObject({
      status: "unrecorded",
      recordedRatio: null,
    });
    expect(result.requiresSplitReview).toBe(true);
  });

  it("does not apply a split again to shares first purchased on the ex-date", () => {
    const base = ledger();
    const source: PersonalPortfolioLedgerPayloadV2 = {
      ...base,
      opening: { ...base.opening, holdings: [] },
      transactions: [trade("buy", "buy")],
    };
    const result = assess(source, history([bar("2026-09-02", "2")]));
    expect(result.actions[0]?.status).toBe("no_prior_position");
    expect(result.requiresSplitReview).toBe(false);
    expect(
      assess(source, history([bar("2026-09-03", "2")])).actions[0]?.status,
    ).toBe("unrecorded");
  });

  it("distinguishes prior-day liquidation from a sale on the ex-date", () => {
    const source = { ...ledger(), transactions: [trade("sell", "sell")] };
    const afterSale = assess(source, history([bar("2026-09-03", "2")]));
    expect(afterSale.actions[0]?.status).toBe("no_prior_position");
    expect(afterSale.requiresSplitReview).toBe(false);
    expect(
      assess(source, history([bar("2026-09-02", "2")])).actions[0]?.status,
    ).toBe("unrecorded");
  });

  it("processes earlier manual splits before assessing later prior-day exposure", () => {
    const source = splitLedger([
      split(),
      trade("sell-adjusted", "sell", "2026-09-03", "6"),
      trade("buy-on-ex-date", "buy", "2026-09-04", "1"),
    ]);
    const result = assess(
      source,
      history([bar("2026-09-04", "2")], "2026-09-04"),
    );
    expect(result.actions[0]?.status).toBe("no_prior_position");
    expect(result.manualSplitsOutsideWindow).toBe(1);
    expect(result.requiresSplitReview).toBe(false);
  });

  it("compares an explicitly recorded ratio even when there was no prior-day position", () => {
    const base = splitLedger([trade("buy", "buy"), split()]);
    const result = assess({
      ...base,
      opening: { ...base.opening, holdings: [] },
    });
    expect(result.actions[0]?.status).toBe("review_difference");
    expect(result.requiresSplitReview).toBe(true);
  });

  it("ignores actions already included in the opening end-of-day balance", () => {
    const result = assess(
      ledger(),
      history(
        [bar("2026-08-31", "2", "0.5"), bar("2026-09-01", "3", "1"), bar()],
        "2026-08-31",
      ),
    );
    expect(result.actions).toEqual([]);
    expect(result.requiresSplitReview).toBe(false);
    expect(result.openingDateObserved).toBe(true);
    expect(result.observationCount).toBe(3);
    expect(result.observedDates).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
    expect(result.splitReviewDates).toEqual([]);
  });

  it("reports absent split dates without interpolation or an unsupported current-price block", () => {
    const result = assess(
      splitLedger([split("manual", "2", "1", "2026-09-03")]),
      history([bar("2026-09-02"), bar("2026-09-04")]),
    );
    expect(result).toMatchObject({
      firstObservedDate: "2026-09-02",
      lastObservedDate: "2026-09-04",
      observationCount: 2,
      openingDateObserved: false,
      activityDateCount: 1,
      observedActivityDateCount: 0,
      requiresSplitReview: false,
    });
    expect(result.actions).toEqual([
      {
        date: "2026-09-03",
        providerFactor: null,
        recordedRatio: "2:1",
        dividendCash: null,
        status: "no_observation",
      },
    ]);
  });

  it("counts manual split rows outside the requested window without inventing comparisons", () => {
    const source = splitLedger([
      split("before", "2", "1", "2026-09-02"),
      split("inside", "2", "1", "2026-09-04"),
      split("after", "2", "1", "2026-09-08"),
    ]);
    const result = assess(
      source,
      history(
        [bar("2026-09-03"), bar("2026-09-07")],
        "2026-09-03",
        "2026-09-07",
      ),
    );
    expect(result.manualSplitsOutsideWindow).toBe(2);
    expect(result.actions).toEqual([
      {
        date: "2026-09-04",
        providerFactor: null,
        recordedRatio: "2:1",
        dividendCash: null,
        status: "no_observation",
      },
    ]);
  });

  it("counts distinct listing activity dates and only their exact observed dates", () => {
    const source = splitLedger([
      trade("first", "buy", "2026-09-02", "1"),
      trade("second", "buy", "2026-09-02", "1"),
      trade("third", "sell", "2026-09-03", "1"),
      {
        id: "deposit",
        date: "2026-09-04",
        type: "deposit",
        listingId: null,
        shares: null,
        grossUsd: "1",
        feeUsd: "0",
      },
    ]);
    expect(
      assess(source, history([bar("2026-09-02"), bar("2026-09-04")])),
    ).toMatchObject({ activityDateCount: 2, observedActivityDateCount: 1 });
  });

  it("reports dividend observations without crediting or comparing ledger cash receipts", () => {
    const source = splitLedger([
      {
        id: "recorded-dividend",
        date: "2026-09-02",
        type: "dividend",
        listingId: "listing-a",
        shares: null,
        grossUsd: "10",
        feeUsd: "0",
      },
    ]);
    const before = projectPersonalPortfolioLedger(source);
    const result = assess(source, history([bar("2026-09-02", "1", "0.125")]));
    expect(result.actions).toEqual([
      {
        date: "2026-09-02",
        providerFactor: null,
        recordedRatio: null,
        dividendCash: "0.125",
        status: "dividend_observation",
      },
    ]);
    expect(result.requiresSplitReview).toBe(false);
    expect(projectPersonalPortfolioLedger(source)).toEqual(before);
  });

  it("retains simultaneous dividend observations on a split comparison", () => {
    const result = assess(
      splitLedger([split()]),
      history([bar("2026-09-02", "2", "0.1")]),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      status: "matched",
      dividendCash: "0.1",
    });
  });

  it("reports an empty observation set explicitly and preserves recorded missing dates", () => {
    const result = assess(splitLedger([split()]), history([]));
    expect(result).toMatchObject({
      firstObservedDate: null,
      lastObservedDate: null,
      observationCount: 0,
      openingDateObserved: false,
      observedActivityDateCount: 0,
      requiresSplitReview: false,
    });
    expect(result.actions[0]?.status).toBe("no_observation");
    expect(result.observedDates).toEqual([]);
    expect(result.splitReviewDates).toEqual([]);
    expect(assess(ledger(), history([])).actions).toEqual([]);
  });

  it("returns immutable observations without changing or freezing source data", () => {
    const source = splitLedger([split()]);
    const observations = history([bar("2026-09-02", "2")]);
    const before = structuredClone({ source, observations });
    const result = assess(source, observations);
    expect({ source, observations }).toEqual(before);
    expect(Object.isFrozen(source.transactions[0])).toBe(false);
    expect(Object.isFrozen(observations.bars[0])).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.actions)).toBe(true);
    expect(Object.isFrozen(result.actions[0])).toBe(true);
    expect(Object.isFrozen(result.observedDates)).toBe(true);
    expect(Object.isFrozen(result.splitReviewDates)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("separates exact observed dates from ordered split-review dates", () => {
    const source = splitLedger([
      split("mismatch"),
      split("missing", "3", "1", "2026-09-04"),
    ]);
    const result = assess(
      source,
      history([
        bar("2026-09-02"),
        bar("2026-09-03", "2"),
        bar("2026-09-05", "1", "0.1"),
      ]),
    );
    expect(result.observedDates).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-05",
    ]);
    expect(result.splitReviewDates).toEqual(["2026-09-02", "2026-09-03"]);
    expect(
      result.actions.map((action) => [action.date, action.status]),
    ).toEqual([
      ["2026-09-02", "review_difference"],
      ["2026-09-03", "unrecorded"],
      ["2026-09-04", "no_observation"],
      ["2026-09-05", "dividend_observation"],
    ]);
  });
});

describe("portfolio history assessment input limits", () => {
  it("requires a valid projected ledger and a registered listing", () => {
    expect(
      assessPortfolioHistory(ledger(), "listing-unknown", history()),
    ).toBeNull();
    expect(
      assessPortfolioHistory(
        {
          ...ledger(),
          transactions: [trade("oversell", "sell", "2026-09-02", "4")],
        },
        "listing-a",
        history(),
      ),
    ).toBeNull();
  });

  it.each([
    null,
    {},
    { ...history(), bars: null },
    { ...history(), startDate: "2026-02-30" },
    { ...history(), endDate: "2026-08-31" },
    history([bar("2026-08-31")]),
    history([bar("2026-09-10")]),
    history([bar("2026-09-03"), bar("2026-09-02")]),
    history([bar(), bar()]),
    history([bar("2026-09-31")]),
    history([bar("2026-09-02", "0")]),
    history([bar("2026-09-02", "2e0")]),
    history([bar("2026-09-02", "-2")]),
    history([bar("2026-09-02", "NaN")]),
    history([bar("2026-09-02", "2".repeat(65))]),
    history([bar("2026-09-02", "2", "-1")]),
    history([bar("2026-09-02", "2", "1e2")]),
    { ...history(), bars: [null] },
    { ...history(), bars: new Array(1) },
  ])("returns null for malformed consumed history fields %#", (value) => {
    expect(
      assessPortfolioHistory(
        ledger(),
        "listing-a",
        value as unknown as History,
      ),
    ).toBeNull();
  });

  it("accepts at most 4096 ordered observations", () => {
    const bars = Array.from({ length: 4096 }, (_, index) => {
      const date = new Date(Date.UTC(2010, 0, index + 1))
        .toISOString()
        .slice(0, 10);
      return bar(date);
    });
    const observations = history(bars, bars[0]!.date, "2026-09-09");
    expect(assess(ledger(), observations).observationCount).toBe(4096);
    expect(
      assessPortfolioHistory(ledger(), "listing-a", {
        ...observations,
        bars: [...bars, bar()],
      }),
    ).toBeNull();
  });
});
