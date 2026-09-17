import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  calculatePersonalPricePerformanceComparison,
  type PersonalMarketAnalyticsBar,
  type PersonalPricePerformanceComparisonInput,
  type PersonalPricePerformanceComparisonResult,
  type PersonalPricePerformanceComparisonSeries,
} from "./index";

const unsafeCalculate = calculatePersonalPricePerformanceComparison as (
  input: unknown,
) => PersonalPricePerformanceComparisonResult;

describe("personal price performance comparison", () => {
  it("compares adjusted closes over exact dates shared by every selected listing", () => {
    const result = calculatePersonalPricePerformanceComparison({
      series: [
        series("listing-a", [
          bar(1, "40"),
          bar(2, "100", "10"),
          bar(3, "125"),
          bar(5, "150", "5"),
        ]),
        series("listing-b", [
          bar(2, "200", "100"),
          bar(4, "300"),
          bar(5, "180", "200"),
          bar(6, "400"),
        ]),
        series("listing-c", [
          bar(1, "3"),
          bar(2, "10"),
          bar(5, "10"),
          bar(7, "5"),
        ]),
      ],
    });

    expect(result).toMatchObject({
      status: "available",
      firstDate: "2025-01-02",
      lastDate: "2025-01-05",
      sharedDates: ["2025-01-02", "2025-01-05"],
      sharedSessionCount: 2,
      rows: [
        {
          listingId: "listing-a",
          loadedSessionCount: 4,
          excludedSessionCount: 2,
          observedFirstDate: "2025-01-01",
          observedLastDate: "2025-01-05",
          firstAdjustedClose: "100",
          lastAdjustedClose: "150",
          selectedWindowReturn: { valuePercent: "50.0000" },
        },
        {
          listingId: "listing-b",
          loadedSessionCount: 4,
          excludedSessionCount: 2,
          observedFirstDate: "2025-01-02",
          observedLastDate: "2025-01-06",
          firstAdjustedClose: "200",
          lastAdjustedClose: "180",
          selectedWindowReturn: { valuePercent: "-10.0000" },
        },
        {
          listingId: "listing-c",
          loadedSessionCount: 4,
          excludedSessionCount: 2,
          observedFirstDate: "2025-01-01",
          observedLastDate: "2025-01-07",
          firstAdjustedClose: "10",
          lastAdjustedClose: "10",
          selectedWindowReturn: { valuePercent: "0.0000" },
        },
      ],
    });
    if (result.status !== "available") throw new TypeError();
    for (const row of result.rows) {
      expect(row.selectedWindowReturn).toMatchObject({
        formulaId: "selected_window_simple_return_percent",
        formulaVersion: "1.0.0",
        observedSessions: 2,
        sampleFirstDate: result.firstDate,
        sampleLastDate: result.lastDate,
        status: "available",
        parameters: {
          minimumSessions: 2,
          roundingDecimalPlaces: 4,
          sessionPolicy: "observed_sessions_only_no_gap_filling",
        },
      });
    }
  });

  it("does not fill gaps or count one company's extra dates as shared sessions", () => {
    const result = calculatePersonalPricePerformanceComparison({
      series: [
        series("listing-a", [
          bar(1, "100"),
          bar(3, "95"),
          bar(9, "110"),
          bar(20, "120"),
        ]),
        series("listing-b", [bar(1, "100"), bar(9, "100"), bar(20, "90")]),
      ],
    });
    expect(result.sharedDates).toEqual([
      "2025-01-01",
      "2025-01-09",
      "2025-01-20",
    ]);
    expect(result.sharedSessionCount).toBe(3);
    expect(result.rows.map((row) => row.excludedSessionCount)).toEqual([1, 0]);
  });

  it("retains requested and observed bounds when request windows differ", () => {
    const result = calculatePersonalPricePerformanceComparison({
      series: [
        {
          ...series("listing-a", [bar(2, "10"), bar(3, "20"), bar(4, "40")]),
          startDate: "2025-01-01",
          endDate: "2025-01-04",
        },
        {
          ...series("listing-b", [bar(3, "40"), bar(4, "20"), bar(5, "10")]),
          startDate: "2025-01-03",
          endDate: "2025-01-06",
        },
      ],
    });
    expect(result).toMatchObject({
      status: "available",
      firstDate: "2025-01-03",
      lastDate: "2025-01-04",
    });
    expect(result.rows).toMatchObject([
      {
        startDate: "2025-01-01",
        endDate: "2025-01-04",
        observedFirstDate: "2025-01-02",
        observedLastDate: "2025-01-04",
      },
      {
        startDate: "2025-01-03",
        endDate: "2025-01-06",
        observedFirstDate: "2025-01-03",
        observedLastDate: "2025-01-05",
      },
    ]);
  });

  it.each([
    ["empty member", [], [], null],
    ["no common dates", [bar(3, "10"), bar(4, "20")], [], null],
    [
      "one common date",
      [bar(2, "10"), bar(3, "20")],
      ["2025-01-02"],
      "2025-01-02",
    ],
  ] as const)(
    "returns explicit insufficient history for %s",
    (_name, bars, expectedDates, expectedDate) => {
      const result = calculatePersonalPricePerformanceComparison({
        series: [
          series("listing-a", [bar(1, "10"), bar(2, "20")]),
          series("listing-b", bars),
        ],
      });
      expect(result).toMatchObject({
        status: "insufficient_history",
        sharedDates: expectedDates,
        sharedSessionCount: expectedDates.length,
        firstDate: expectedDate,
        lastDate: expectedDate,
      });
      for (const row of result.rows) {
        expect(row).not.toHaveProperty("selectedWindowReturn");
        expect(row).not.toHaveProperty("firstAdjustedClose");
        expect(row).not.toHaveProperty("lastAdjustedClose");
        expect(row.excludedSessionCount).toBe(
          row.loadedSessionCount - expectedDates.length,
        );
      }
      if (bars.length === 0)
        expect(result.rows[1]).toMatchObject({
          observedFirstDate: null,
          observedLastDate: null,
        });
    },
  );

  it("does not silently drop an empty third selection or compare a successful subset", () => {
    const result = calculatePersonalPricePerformanceComparison({
      series: [...validInput().series, series("listing-c", [])],
    });
    expect(result.status).toBe("insufficient_history");
    expect(result.rows).toHaveLength(3);
    expect(result.sharedDates).toEqual([]);
  });

  it.each([
    ["half-up rounding", "100", "100.00005", "0.0001"],
    ["negative half-up rounding", "100", "99.99995", "-0.0001"],
    ["negative zero", "100000", "99999.99999", "0.0000"],
    [
      "precision beyond binary integers",
      "9007199254740993",
      "18014398509481986",
      "100.0000",
    ],
    ["trailing zeros", "100.00", "110.00", "10.0000"],
  ])(
    "reuses admitted decimal arithmetic for %s",
    (_name, first, last, expected) => {
      if (first === undefined || last === undefined) throw new TypeError();
      const result = calculatePersonalPricePerformanceComparison({
        series: [
          series("listing-a", [bar(1, first, "10"), bar(2, last, "1")]),
          validInput().series[1]!,
        ],
      });
      if (result.status !== "available") throw new TypeError();
      expect(result.rows[0]?.selectedWindowReturn.valuePercent).toBe(expected);
    },
  );

  it("is unaffected by external Decimal precision and rounding changes", () => {
    const before = { precision: Decimal.precision, rounding: Decimal.rounding };
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      const result = calculatePersonalPricePerformanceComparison({
        series: [
          series("listing-a", [bar(1, "3"), bar(2, "4")]),
          validInput().series[1]!,
        ],
      });
      if (result.status !== "available") throw new TypeError();
      expect(result.rows[0]?.selectedWindowReturn.valuePercent).toBe("33.3333");
    } finally {
      Decimal.set(before);
    }
  });

  it("keeps selection order and has permutation-invariant common dates", () => {
    const input = validInput();
    const forward = calculatePersonalPricePerformanceComparison(input);
    const reverse = calculatePersonalPricePerformanceComparison({
      series: [...input.series].reverse(),
    });
    expect(reverse.sharedDates).toEqual(forward.sharedDates);
    expect(reverse.rows).toEqual([...forward.rows].reverse());
  });

  it("freezes results while leaving source objects mutable and unretained", () => {
    const input = validInput();
    const result = calculatePersonalPricePerformanceComparison(input);
    const before = JSON.stringify(result);
    expectDeepFrozen(result);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.series[0]?.bars)).toBe(false);
    Object.assign(input.series[0]!.bars[0]!.adjusted, { close: "999" });
    expect(JSON.stringify(result)).toBe(before);
    expect(result).not.toHaveProperty("series");
    for (const row of result.rows) expect(row).not.toHaveProperty("bars");
  });
});

describe("price performance comparison admission", () => {
  it.each([2, 3])("rejects sparse selection arrays of length %i", (length) => {
    const sparse = new Array<PersonalPricePerformanceComparisonSeries>(length);
    sparse[0] = validInput().series[0]!;
    if (length === 3) sparse[2] = validInput().series[1]!;
    expectGenericTypeError({ series: sparse });
  });

  it.each([
    ["null", null],
    ["array input", []],
    ["missing series", {}],
    ["extra input property", { ...validInput(), unexpected: true }],
    ["series object", { series: {} }],
    ["one series", { series: [validInput().series[0]] }],
    [
      "four series",
      {
        series: [
          ...validInput().series,
          series("listing-c", []),
          series("listing-d", []),
        ],
      },
    ],
    [
      "duplicate listing",
      { series: [validInput().series[0], validInput().series[0]] },
    ],
  ])("rejects %s with a generic error", (_name, input) =>
    expectGenericTypeError(input),
  );

  it.each([
    ["empty listing ID", { listingId: "" }],
    ["overlong listing ID", { listingId: "x".repeat(129) }],
    ["non-string listing ID", { listingId: 123 }],
    ["unrecognized series property", { extra: true }],
    ["invalid start date", { startDate: "2025-02-29" }],
    ["invalid end date", { endDate: "2025-02-29" }],
    ["noncanonical start date", { startDate: "2025-1-01" }],
    ["year zero", { startDate: "0000-01-01" }],
    ["reversed request window", { startDate: "2025-02-01" }],
    ["bar before request window", { startDate: "2025-01-02" }],
    ["bar after request window", { endDate: "2025-01-01" }],
    ["non-array bars", { bars: {} }],
    [
      "too many bars",
      { bars: Array.from({ length: 4_097 }, () => bar(1, "1")) },
    ],
    ["unsorted hidden bars", { bars: [bar(2, "10"), bar(1, "20")] }],
    [
      "duplicate hidden date",
      { bars: [bar(1, "10"), bar(1, "20"), bar(2, "30")] },
    ],
    [
      "invalid hidden calendar date",
      {
        bars: [
          bar(1, "10"),
          bar(2, "20"),
          { ...bar(3, "10"), date: "2025-01-32" },
        ],
      },
    ],
    [
      "zero adjusted close on excluded date",
      { bars: [bar(1, "10"), bar(2, "20"), bar(3, "0")] },
    ],
    [
      "zero raw close on excluded date",
      { bars: [bar(1, "10"), bar(2, "20"), bar(3, "10", "0")] },
    ],
    ["scientific notation close", { bars: [bar(1, "1e2"), bar(2, "20")] }],
    [
      "extra bar field",
      { bars: [{ ...bar(1, "10"), extra: true }, bar(2, "20")] },
    ],
    [
      "extra adjusted field",
      {
        bars: [
          { ...bar(1, "10"), adjusted: { close: "10", extra: true } },
          bar(2, "20"),
        ],
      },
    ],
  ])("rejects %s before taking an intersection", (_name, change) => {
    expectGenericTypeError({
      series: [
        { ...validInput().series[0], ...change },
        validInput().series[1],
      ],
    });
  });

  it("validates every original member even when another member has no history", () => {
    expectGenericTypeError({
      series: [series("listing-a", []), series("listing-b", [bar(3, "0")])],
    });
  });

  it("does not coerce listing IDs or close values", () => {
    let coercions = 0;
    const hostile = {
      toString() {
        coercions += 1;
        return "listing-a";
      },
    };
    expectGenericTypeError({
      series: [
        { ...validInput().series[0], listingId: hostile },
        validInput().series[1],
      ],
    });
    expectGenericTypeError({
      series: [
        {
          ...validInput().series[0],
          bars: [{ ...bar(1, "10"), adjusted: { close: hostile } }],
        },
        validInput().series[1],
      ],
    });
    expect(coercions).toBe(0);
  });

  it("normalizes accessor failures without disclosing their text", () => {
    const input = Object.defineProperty({}, "series", {
      enumerable: true,
      get() {
        throw new Error("sensitive source detail");
      },
    });
    expectGenericTypeError(input);
  });

  it("validates a copied snapshot rather than rereading changing bar properties", () => {
    let reads = 0;
    const changing = Object.defineProperty(bar(1, "10"), "date", {
      enumerable: true,
      get() {
        reads += 1;
        return reads === 1 ? "2025-01-01" : "2025-02-31";
      },
    });
    const result = calculatePersonalPricePerformanceComparison({
      series: [
        series("listing-a", [changing, bar(2, "20")]),
        validInput().series[1]!,
      ],
    });
    expect(reads).toBe(1);
    expect(result.status).toBe("available");
  });

  it("admits valid leap days and the maximum 4096 observed sessions", () => {
    const bars = Array.from({ length: 4_096 }, (_value, index) => ({
      ...bar(1, "10"),
      date: new Date(Date.UTC(2016, 0, 1 + index)).toISOString().slice(0, 10),
    }));
    const result = calculatePersonalPricePerformanceComparison({
      series: ["listing-a", "listing-b"].map((listingId) => ({
        listingId,
        startDate: "2016-01-01",
        endDate: bars.at(-1)!.date,
        bars,
      })),
    });
    expect(result.status).toBe("available");
    expect(result.sharedSessionCount).toBe(4_096);
    expect(result.sharedDates).toContain("2016-02-29");
    expect(result.rows.map((row) => row.excludedSessionCount)).toEqual([0, 0]);
  });
});

function bar(
  day: number,
  adjustedClose: string,
  rawClose = adjustedClose,
): PersonalMarketAnalyticsBar {
  return {
    date: `2025-01-${String(day).padStart(2, "0")}`,
    adjusted: { close: adjustedClose },
    raw: { close: rawClose },
  };
}

function series(
  listingId: string,
  bars: readonly PersonalMarketAnalyticsBar[],
): PersonalPricePerformanceComparisonSeries {
  return { listingId, startDate: "2025-01-01", endDate: "2025-01-31", bars };
}

function validInput(): PersonalPricePerformanceComparisonInput {
  return {
    series: [
      series("listing-a", [bar(1, "10"), bar(2, "20")]),
      series("listing-b", [bar(1, "20"), bar(2, "30")]),
    ],
  };
}

function expectGenericTypeError(input: unknown): void {
  try {
    unsafeCalculate(input);
    expect.fail("Expected the input to be rejected");
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toBe("");
  }
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
