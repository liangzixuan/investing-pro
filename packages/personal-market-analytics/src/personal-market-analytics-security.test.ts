import { describe, expect, it } from "vitest";

import {
  calculatePersonalMarketAnalytics,
  type PersonalMarketAnalyticsBar,
  type PersonalMarketAnalyticsResult,
} from "./personal-market-analytics";

const unsafeCalculate = calculatePersonalMarketAnalytics as (
  input: unknown,
) => PersonalMarketAnalyticsResult;

describe("personal market analytics validation and disclosure boundary", () => {
  it("rejects dates after as-of, invalid calendar dates, unsorted bars, and duplicates", () => {
    const invalidInputs: readonly unknown[] = [
      inputWithBars([bar("2025-01-02", "10")], "2025-01-01"),
      inputWithBars([bar("2025-02-29", "10")], "2025-03-01"),
      inputWithBars([bar("0000-01-01", "10")], "2025-03-01"),
      inputWithBars([bar("2025-1-01", "10")], "2025-03-01"),
      inputWithBars(
        [bar("2025-01-02", "10"), bar("2025-01-01", "11")],
        "2025-01-02",
      ),
      inputWithBars(
        [bar("2025-01-01", "10"), bar("2025-01-01", "11")],
        "2025-01-01",
      ),
      { asOfDate: "2025-02-29", bars: [], mode: "adjusted" },
    ];

    for (const input of invalidInputs) expectGenericTypeError(input);
  });

  it("rejects malformed shapes and invalid, nonpositive, or nonfinite closes", () => {
    const tooLarge = `1${"0".repeat(309)}`;
    const invalidDecimals = [
      "0",
      "-1",
      "01",
      ".5",
      "+1",
      "1e2",
      "Infinity",
      " 1",
      tooLarge,
    ];
    const invalidInputs: unknown[] = [
      null,
      {},
      { asOfDate: "2025-01-01", bars: {}, mode: "adjusted" },
      { asOfDate: "2025-01-01", bars: [], mode: "other" },
      { asOfDate: "2025-01-01", bars: [], extra: true, mode: "adjusted" },
      inputWithBars([
        {
          adjusted: { close: "10" },
          date: "2025-01-01",
        },
      ]),
      inputWithBars([
        {
          adjusted: { close: "10", extra: true },
          date: "2025-01-01",
          raw: { close: "10" },
        },
      ]),
      inputWithBars([
        {
          adjusted: { close: 10 },
          date: "2025-01-01",
          raw: { close: "10" },
        },
      ]),
    ];
    for (const decimal of invalidDecimals) {
      invalidInputs.push(inputWithBars([bar("2025-01-01", decimal)]));
      invalidInputs.push(inputWithBars([bar("2025-01-01", "10", decimal)]));
    }

    for (const input of invalidInputs) expectGenericTypeError(input);
  });

  it("accepts positive contract-valid decimals with trailing fractional zeros", () => {
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-02",
      bars: [
        bar("2025-01-01", "100.00", "200.00"),
        bar("2025-01-02", "110.00", "180.00"),
      ],
      mode: "adjusted",
    });

    expect(result.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "10.0000",
    });
  });

  it("converts hostile accessor failures to the same generic TypeError", () => {
    const input = Object.defineProperty(
      { asOfDate: "2025-01-01", mode: "adjusted" },
      "bars",
      {
        enumerable: true,
        get() {
          throw new RangeError("do not disclose this detail");
        },
      },
    );
    expectGenericTypeError(input);
  });

  it("deeply freezes the result without freezing or retaining source objects", () => {
    const bars = [
      {
        adjusted: { close: "101.12345" },
        date: "2025-01-01",
        raw: { close: "201.12345" },
      },
      {
        adjusted: { close: "102.23456" },
        date: "2025-01-02",
        raw: { close: "202.23456" },
      },
    ];
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-02",
      bars,
      mode: "adjusted",
    });

    expectDeepFrozen(result);
    expect(Object.isFrozen(bars)).toBe(false);
    expect(Object.isFrozen(bars[0])).toBe(false);
    const originalReturn = result.metrics.selectedWindowReturn;
    const firstBar = bars[0];
    if (firstBar === undefined) throw new TypeError();
    firstBar.adjusted.close = "999";
    expect(result.metrics.selectedWindowReturn).toBe(originalReturn);
    expect(() => {
      Object.assign(result.inputWindow, { sessionCount: 999 });
    }).toThrow(TypeError);
  });

  it("does not expose prices, source series, or moving-average values", () => {
    const sourceCloses = ["137.15931", "149.26347", "143.98761"];
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-03",
      bars: sourceCloses.map((close, index) =>
        bar(`2025-01-0${index + 1}`, close, `${Number(close) + 100}`),
      ),
      mode: "adjusted",
    });
    const forbiddenKey =
      /^(?:adjusted|raw|close|closes|price|prices|series|sourcePrice|smaValue|movingAverageValue)$/iu;
    const serialized = JSON.stringify(result);

    visit(result, (key) => expect(key).not.toMatch(forbiddenKey));
    for (const close of sourceCloses) expect(serialized).not.toContain(close);
    expect(findArrays(result)).toEqual([]);
  });
});

function bar(
  date: string,
  adjustedClose: string,
  rawClose = adjustedClose,
): PersonalMarketAnalyticsBar {
  return {
    adjusted: { close: adjustedClose },
    date,
    raw: { close: rawClose },
  };
}

function inputWithBars(bars: readonly unknown[], asOfDate = "2025-01-01") {
  return { asOfDate, bars, mode: "adjusted" };
}

function expectGenericTypeError(input: unknown): void {
  try {
    unsafeCalculate(input);
    throw new Error("expected calculation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toBe("");
  }
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested);
}

function visit(
  value: unknown,
  visitor: (key: string, nested: unknown) => void,
): void {
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    visitor(key, nested);
    visit(nested, visitor);
  }
}

function findArrays(value: unknown, path = "result"): string[] {
  if (Array.isArray(value)) return [path];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    findArrays(nested, `${path}.${key}`),
  );
}
