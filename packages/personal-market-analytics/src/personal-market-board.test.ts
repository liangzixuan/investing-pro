import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_EOD_REFERENCE_ROUNDING,
  PERSONAL_MARKET_BOARD_ROUNDING,
  calculatePersonalEodReference,
  calculatePersonalMarketBoard,
  type PersonalMarketBoardBar,
  type PersonalMarketBoardIdentity,
  type PersonalMarketBoardInput,
} from "./index";

const unsafeBoard = calculatePersonalMarketBoard as (input: unknown) => unknown;
const unsafeReference = calculatePersonalEodReference as (
  input: unknown,
) => unknown;
const earlier = "2026-09-21";
const previous = "2026-09-23";
const latest = "2026-09-24";

describe("personal market board", () => {
  it("preserves exact source closes and compares the last two actual dates", () => {
    const result = calculatePersonalMarketBoard({
      rows: [
        row("AAA", [
          bar(earlier, "999", "8"),
          bar(previous, "20.000", "10"),
          bar(latest, "25.000", "12.5"),
        ]),
      ],
    });
    expect(result.rows[0]).toEqual({
      identity: identity("AAA"),
      status: "available",
      latestDate: latest,
      rawClose: "25.000",
      adjustedClose: "12.5",
      previousDate: previous,
      adjustedChangePercent: "25.0000",
      changeStatus: "available",
    });
    expect(result.ranking).toEqual({ status: "insufficient_rows" });
  });

  it("uses adjusted changes across splits and dividend adjustments", () => {
    const result = calculatePersonalMarketBoard({
      rows: [
        row("AAA", [
          bar(previous, "200", "100"),
          bar(latest, "101", "101", "2"),
        ]),
        row("BBB", [bar(previous, "100", "98"), bar(latest, "99", "99")]),
      ],
    });
    expect(result.rows).toMatchObject([
      { rawClose: "101", adjustedChangePercent: "1.0000" },
      { rawClose: "99", adjustedChangePercent: "1.0204" },
    ]);
    expect(result.ranking).toMatchObject({
      descendingListingIds: ["listing-BBB", "listing-AAA"],
    });
  });

  it("distinguishes an unloaded row, empty history, one bar and real zero change", () => {
    const result = calculatePersonalMarketBoard({
      rows: [
        { identity: identity("AAA"), history: null },
        row("BBB", []),
        row("CCC", [bar(latest, "4")]),
        row("DDD", [bar(previous, "4"), bar(latest, "4")]),
      ],
    });
    expect(result.rows).toMatchObject([
      { status: "unavailable", reason: "not_loaded" },
      { status: "unavailable", reason: "no_observations" },
      {
        status: "available",
        rawClose: "4",
        previousDate: null,
        adjustedChangePercent: null,
        changeStatus: "insufficient_history",
      },
      {
        status: "available",
        adjustedChangePercent: "0.0000",
        changeStatus: "available",
      },
    ]);
  });

  it("withholds ranking for mixed latest or previous dates without substituting older bars", () => {
    for (const bars of [
      [bar(earlier, "10"), bar(latest, "20")],
      [bar(earlier, "10"), bar(previous, "20")],
    ]) {
      const result = calculatePersonalMarketBoard({
        rows: [
          row("AAA", [bar(previous, "10"), bar(latest, "20")]),
          row("BBB", bars),
        ],
      });
      expect(result.ranking).toEqual({ status: "mixed_dates" });
      expect(result.rows).toMatchObject([
        { adjustedChangePercent: "100.0000" },
        { adjustedChangePercent: "100.0000" },
      ]);
    }
  });

  it("ranks available comparable rows without giving missing rows a zero return", () => {
    const result = calculatePersonalMarketBoard({
      rows: [
        row("CCC", []),
        row("BBB", [bar(previous, "10"), bar(latest, "9")]),
        row("AAA", [bar(previous, "10"), bar(latest, "8")]),
      ],
    });
    expect(result.rows.map((value) => value.identity.symbol)).toEqual([
      "CCC",
      "BBB",
      "AAA",
    ]);
    expect(result.ranking).toEqual({
      status: "available",
      previousDate: previous,
      latestDate: latest,
      descendingListingIds: ["listing-BBB", "listing-AAA"],
      ascendingListingIds: ["listing-AAA", "listing-BBB"],
    });
  });

  it("uses unrounded source ratios for rank and stable symbol ties in both directions", () => {
    const tinyGain = "1.00000000000000000000000000000000000000000000000001";
    const rows = [
      row("ZZZ", [bar(previous, "1"), bar(latest, tinyGain)]),
      row("BBB", [bar(previous, "1"), bar(latest, "1")]),
      row("AAA", [bar(previous, "2"), bar(latest, "2")]),
    ];
    const result = calculatePersonalMarketBoard({ rows });
    expect(result.rows).toMatchObject(
      rows.map(() => ({ adjustedChangePercent: "0.0000" })),
    );
    expect(result.ranking).toMatchObject({
      descendingListingIds: ["listing-ZZZ", "listing-AAA", "listing-BBB"],
      ascendingListingIds: ["listing-AAA", "listing-BBB", "listing-ZZZ"],
    });
    expect(
      calculatePersonalMarketBoard({ rows: [...rows].reverse() }).ranking,
    ).toEqual(result.ranking);
  });

  it("uses half-up four-place percentages and normalizes negative zero", () => {
    expect(
      calculatePersonalMarketBoard({
        rows: [
          row("AAA", [bar(previous, "100"), bar(latest, "100.12345")]),
          row("BBB", [bar(previous, "100"), bar(latest, "99.999999")]),
        ],
      }).rows,
    ).toMatchObject([
      { adjustedChangePercent: "0.1235" },
      { adjustedChangePercent: "0.0000" },
    ]);
    expect(PERSONAL_MARKET_BOARD_ROUNDING).toMatchObject({
      decimalPlaces: 4,
      method: "round_half_up",
    });
  });

  it("accepts six distinct listings and rejects an empty or oversized board", () => {
    const rows = Array.from({ length: 6 }, (_, index) => row(`S${index}`, []));
    expect(calculatePersonalMarketBoard({ rows }).rows).toHaveLength(6);
    expect(() => calculatePersonalMarketBoard({ rows: [] })).toThrow(TypeError);
    expect(() =>
      calculatePersonalMarketBoard({ rows: [...rows, row("S6", [])] }),
    ).toThrow(TypeError);
  });

  it("rejects duplicated listing identities and duplicate venue/symbol aliases", () => {
    const first = row("AAA", []);
    expect(() =>
      calculatePersonalMarketBoard({ rows: [first, first] }),
    ).toThrow(TypeError);
    const second = row("AAA", []);
    second.identity.listingId = "different-listing";
    second.history.security.listingId = "different-listing";
    expect(() =>
      calculatePersonalMarketBoard({ rows: [first, second] }),
    ).toThrow(TypeError);
  });

  it.each([
    "listingId",
    "symbol",
    "exchangeMic",
    "issuerName",
    "securityName",
  ] as const)("rejects a history belonging to a different %s", (key) => {
    const input = row("AAA", []);
    input.history.security[key] = key === "exchangeMic" ? "XNYS" : "OTHER";
    expect(() => calculatePersonalMarketBoard({ rows: [input] })).toThrow(
      TypeError,
    );
  });

  it("validates every original date, including old bars outside the comparison", () => {
    const invalidSequences = [
      [bar(latest, "1"), bar(previous, "2")],
      [bar(previous, "1"), bar(previous, "2")],
      [bar("2026-02-30", "1"), bar(previous, "2"), bar(latest, "3")],
      [bar("2026-9-23", "1")],
      [bar("2026-09-24T00:00:00Z", "1")],
    ];
    for (const bars of invalidSequences)
      expect(() =>
        calculatePersonalMarketBoard({ rows: [row("AAA", bars)] }),
      ).toThrow(TypeError);
    expect(
      calculatePersonalMarketBoard({
        rows: [row("AAA", [bar("2024-02-29", "1")])],
      }).rows[0]?.status,
    ).toBe("available");
  });

  it.each([
    "NaN",
    "Infinity",
    "1e3",
    " 1",
    "01",
    "-0",
    "0",
    "-1",
    "0.0",
    "1.",
    ".1",
    "9".repeat(65),
  ])("rejects invalid/nonpositive close and split decimals: %s", (value) => {
    for (const badBar of [
      bar(latest, value),
      bar(latest, "1", value),
      bar(latest, "1", "1", value),
    ]) {
      expect(() =>
        calculatePersonalMarketBoard({ rows: [row("AAA", [badBar])] }),
      ).toThrow(TypeError);
      expect(() => calculatePersonalEodReference({ bars: [badBar] })).toThrow(
        TypeError,
      );
    }
  });

  it("rejects non-string decimals, sparse inputs, extra keys and oversized histories", () => {
    expect(() =>
      unsafeBoard({ rows: [{ ...row("AAA", []), extra: true }] }),
    ).toThrow(TypeError);
    expect(() => unsafeBoard({ rows: Array(1) })).toThrow(TypeError);
    expect(() =>
      unsafeBoard({ rows: [row("AAA", Array(1) as PersonalMarketBoardBar[])] }),
    ).toThrow(TypeError);
    expect(() =>
      unsafeReference({ bars: [{ ...bar(latest, "1"), raw: { close: 1 } }] }),
    ).toThrow(TypeError);
    expect(() =>
      unsafeReference({ bars: Array(4097).fill(bar(latest, "1")) }),
    ).toThrow(TypeError);
  });

  it("leaves inputs mutable/unchanged and returns independently frozen values", () => {
    const input = {
      rows: [row("AAA", [bar(previous, "1"), bar(latest, "2")])],
    };
    const original = structuredClone(input);
    const result = calculatePersonalMarketBoard(input);
    expect(input).toEqual(original);
    expect(Object.isFrozen(input.rows[0]?.identity)).toBe(false);
    expect(Object.isFrozen(result.rows[0]?.identity)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    input.rows[0]!.identity.issuerName = "Changed";
    input.rows[0]!.history.bars[1]!.raw.close = "999";
    expect(result.rows[0]).toMatchObject({
      identity: { issuerName: "AAA Inc." },
      rawClose: "2",
    });
  });

  it("does not depend on or alter the global decimal configuration", () => {
    const precision = Decimal.precision;
    const rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      expect(
        calculatePersonalMarketBoard({
          rows: [row("AAA", [bar(previous, "3"), bar(latest, "4")])],
        }).rows[0],
      ).toMatchObject({ adjustedChangePercent: "33.3333" });
      expect(Decimal.precision).toBe(2);
      expect(Decimal.rounding).toBe(Decimal.ROUND_DOWN);
    } finally {
      Decimal.set({ precision, rounding });
    }
  });
});

describe("personal EOD reference", () => {
  it("returns unavailable for no observations and no invented change for one bar", () => {
    expect(calculatePersonalEodReference({ bars: [] })).toEqual({
      status: "unavailable",
      reason: "no_observations",
    });
    expect(
      calculatePersonalEodReference({ bars: [bar(latest, "1.2300")] }),
    ).toEqual({
      status: "available",
      sourceDate: latest,
      price: "1.2300",
      previousDate: null,
      previousClose: null,
      change: null,
      changePercent: null,
    });
  });

  it.each([
    ["200", "101", "2", "100", "1", "1"],
    ["10", "105", "0.1", "100", "5", "5"],
    ["100", "99", "1", "100", "-1", "-1"],
    ["100", "100", "1", "100", "0", "0"],
  ])(
    "corrects raw reference prices for split %s/%s/%s",
    (before, after, split, previousClose, change, changePercent) => {
      expect(
        calculatePersonalEodReference({
          bars: [bar(previous, before), bar(latest, after, after, split)],
        }),
      ).toEqual({
        status: "available",
        sourceDate: latest,
        price: after,
        previousDate: previous,
        previousClose,
        change,
        changePercent,
      });
    },
  );

  it("rounds computed reference fields to fifteen significant digits without binary arithmetic", () => {
    const result = calculatePersonalEodReference({
      bars: [bar(previous, "1"), bar(latest, "0.5", "0.5", "3")],
    });
    expect(result).toMatchObject({
      previousClose: "0.333333333333333",
      change: "0.166666666666667",
      changePercent: "50",
    });
    expect(PERSONAL_EOD_REFERENCE_ROUNDING.changeSignificantDigits).toBe(15);
    expect(PERSONAL_EOD_REFERENCE_ROUNDING.previousClose).toBe(
      "round_half_up_at_15_significant_digits",
    );
    expect(result).not.toHaveProperty("sourceTime");
    expect(result).not.toHaveProperty("freshness");
    expect(result).not.toHaveProperty("currency");
  });
});

function identity(symbol: string): {
  -readonly [
    K in keyof PersonalMarketBoardIdentity
  ]: PersonalMarketBoardIdentity[K];
} {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerName: `${symbol} Inc.`,
    listingId: `listing-${symbol}`,
    securityName: `${symbol} common stock`,
    symbol,
  };
}
function bar(
  date: string,
  rawClose: string,
  adjustedClose = rawClose,
  splitFactor = "1",
) {
  return {
    date,
    raw: { close: rawClose },
    adjusted: { close: adjustedClose },
    splitFactor,
  };
}
function row(symbol: string, bars: ReturnType<typeof bar>[]) {
  return {
    identity: identity(symbol),
    history: { security: identity(symbol), bars },
  } satisfies PersonalMarketBoardInput["rows"][number];
}
