import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_OBSERVATIONS,
  calculatePersonalHistoricalMultipleValuation,
  type PersonalHistoricalMultipleValuationInput,
  type PersonalHistoricalMultipleValuationResult,
} from "./personal-historical-multiple-valuation";

const unsafeCalculate = calculatePersonalHistoricalMultipleValuation as (
  input: unknown,
) => PersonalHistoricalMultipleValuationResult;

describe("personal historical-multiple valuation validation boundary", () => {
  it("rejects malformed aggregate, nested, metric, identity, and cell shapes", () => {
    const input = completeInput();
    const invalidInputs: readonly unknown[] = [
      null,
      {},
      { ...input, extra: true },
      { ...input, metric: "enterpriseValue" },
      { ...input, market: [] },
      { ...input, valuation: [] },
      {
        ...input,
        market: { ...input.market!, bars: {} },
      },
      {
        ...input,
        valuation: { ...input.valuation!, points: {} },
      },
      {
        ...input,
        market: {
          ...input.market!,
          security: { ...input.market!.security, extra: true },
        },
      },
      {
        ...input,
        market: {
          ...input.market!,
          security: { ...input.market!.security, exchangeMic: "nasdaq" },
        },
      },
      {
        ...input,
        market: {
          ...input.market!,
          security: { ...input.market!.security, issuerName: " bad" },
        },
      },
      {
        ...input,
        market: {
          ...input.market!,
          security: { ...input.market!.security, listingId: "bad id" },
        },
      },
      {
        ...input,
        valuation: {
          ...input.valuation!,
          points: [
            {
              ...input.valuation!.points[0]!,
              priceToEarnings: {
                extra: true,
                status: "known",
                unit: "ratio",
                value: "10",
              },
            },
            ...input.valuation!.points.slice(1),
          ],
        },
      },
      {
        ...input,
        valuation: {
          ...input.valuation!,
          points: [
            {
              ...input.valuation!.points[0]!,
              priceToEarnings: {
                reason: "withheld",
                status: "unknown",
                unit: "ratio",
                value: null,
              },
            },
            ...input.valuation!.points.slice(1),
          ],
        },
      },
      { ...input, market: null, valuation: {} },
      { ...input, market: new Date(), valuation: input.valuation },
    ];

    for (const candidate of invalidInputs) expectGenericTypeError(candidate);
  });

  it("rejects invalid dates, unsorted observations, and duplicate dates in either series", () => {
    const input = completeInput();
    const invalidInputs: unknown[] = [];
    for (const date of ["2025-02-29", "0000-01-01", "2025-1-01"] as const) {
      invalidInputs.push(replaceFirstBar(input, { date }));
      invalidInputs.push(replaceFirstPoint(input, { date }));
    }
    const firstBar = input.market!.bars[0]!;
    const firstPoint = input.valuation!.points[0]!;
    invalidInputs.push({
      ...input,
      market: {
        ...input.market!,
        bars: [
          input.market!.bars[1]!,
          firstBar,
          ...input.market!.bars.slice(2),
        ],
      },
    });
    invalidInputs.push({
      ...input,
      valuation: {
        ...input.valuation!,
        points: [
          input.valuation!.points[1]!,
          firstPoint,
          ...input.valuation!.points.slice(2),
        ],
      },
    });
    invalidInputs.push(
      replaceFirstBar(input, { date: input.market!.bars[1]!.date }),
    );
    invalidInputs.push(
      replaceFirstPoint(input, { date: input.valuation!.points[1]!.date }),
    );

    for (const candidate of invalidInputs) expectGenericTypeError(candidate);
  });

  it("accepts signed and trailing-zero decimals but rejects noncanonical or unbounded lexemes", () => {
    for (const value of ["20.0", "-0", "-0.0", "-0.5"] as const) {
      const input = replaceFirstSelectedCell(completeInput(), value);
      expect(() =>
        calculatePersonalHistoricalMultipleValuation(input),
      ).not.toThrow();
    }

    const invalidDecimals = [
      "",
      "01",
      ".5",
      "1.",
      "+1",
      "1e2",
      "Infinity",
      " 1",
      "1 ",
      `1${"0".repeat(64)}`,
    ];
    for (const value of invalidDecimals) {
      expectGenericTypeError(replaceFirstRawClose(completeInput(), value));
      expectGenericTypeError(replaceFirstSelectedCell(completeInput(), value));
    }
  });

  it("rejects source arrays above the fixed maximum before calculation", () => {
    const input = completeInput();
    const count =
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MAXIMUM_OBSERVATIONS + 1;
    const oversizedBars = Array.from({ length: count }, (_, index) => ({
      date: dateAt(index, "2010-01-01"),
      raw: { close: "10" },
    }));
    const oversizedPoints = Array.from({ length: count }, (_, index) => ({
      date: dateAt(index, "2010-01-01"),
      priceToBook: known("10"),
      priceToEarnings: known("10"),
    }));

    expectGenericTypeError({
      ...input,
      market: { ...input.market!, bars: oversizedBars },
    });
    expectGenericTypeError({
      ...input,
      valuation: { ...input.valuation!, points: oversizedPoints },
    });
  });

  it("converts hostile accessor failures to the same generic TypeError", () => {
    const input = Object.defineProperty(
      { market: null, metric: "priceToEarnings" },
      "valuation",
      {
        enumerable: true,
        get() {
          throw new RangeError("do not expose validation position");
        },
      },
    );
    expectGenericTypeError(input);
  });

  it("deeply freezes output without freezing or retaining either source array", () => {
    const input = completeInput();
    const marketBars = input.market!.bars as {
      date: string;
      raw: { close: string };
    }[];
    const valuationPoints = input.valuation!.points as {
      date: string;
      priceToBook: ReturnType<typeof known>;
      priceToEarnings: ReturnType<typeof known>;
    }[];
    const result = calculatePersonalHistoricalMultipleValuation(input);
    expect(result.status).toBe("available");
    expectDeepFrozen(result);
    expect(Object.isFrozen(marketBars)).toBe(false);
    expect(Object.isFrozen(valuationPoints)).toBe(false);
    expect(findArrays(result)).toEqual([]);

    marketBars[59]!.raw.close = "999";
    valuationPoints[59]!.priceToEarnings.value = "999";
    expect(result).toMatchObject({
      reference: {
        currentMultiple: "60",
        rawCloseUsd: "120",
      },
    });
  });

  it("keeps its decimal calculation and round-half-up behavior isolated from global settings", () => {
    const prior = {
      maxE: Decimal.maxE,
      minE: Decimal.minE,
      precision: Decimal.precision,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({
        maxE: 1,
        minE: -1,
        precision: 2,
        rounding: Decimal.ROUND_DOWN,
      });
      const result =
        calculatePersonalHistoricalMultipleValuation(completeInput());
      expect(result).toMatchObject({
        currentPercentilePercent: "100.00",
        status: "available",
      });
      if (result.status !== "available") throw new TypeError();
      expect(result.bands.p50).toMatchObject({
        differencePercent: "-49.17",
        impliedPriceUsd: "61.00",
        targetMultiple: "30.5000",
      });
    } finally {
      Decimal.set(prior);
    }
  });
});

function completeInput(): PersonalHistoricalMultipleValuationInput {
  return {
    market: {
      bars: Array.from({ length: 60 }, (_, index) => ({
        date: dateAt(index),
        raw: { close: String((index + 1) * 2) },
      })),
      range: "1y",
      security: identity(),
    },
    metric: "priceToEarnings",
    valuation: {
      points: Array.from({ length: 60 }, (_, index) => ({
        date: dateAt(index),
        priceToBook: known(String(index + 1)),
        priceToEarnings: known(String(index + 1)),
      })),
      range: "1y",
      security: identity(),
    },
  };
}

function replaceFirstBar(
  input: PersonalHistoricalMultipleValuationInput,
  replacement: Partial<{ date: string; raw: { close: string } }>,
): PersonalHistoricalMultipleValuationInput {
  return {
    ...input,
    market: {
      ...input.market!,
      bars: [
        { ...input.market!.bars[0]!, ...replacement },
        ...input.market!.bars.slice(1),
      ],
    },
  };
}

function replaceFirstRawClose(
  input: PersonalHistoricalMultipleValuationInput,
  close: string,
): PersonalHistoricalMultipleValuationInput {
  return replaceFirstBar(input, { raw: { close } });
}

function replaceFirstPoint(
  input: PersonalHistoricalMultipleValuationInput,
  replacement: Partial<{
    date: string;
    priceToBook: ReturnType<typeof known>;
    priceToEarnings: ReturnType<typeof known>;
  }>,
): PersonalHistoricalMultipleValuationInput {
  return {
    ...input,
    valuation: {
      ...input.valuation!,
      points: [
        { ...input.valuation!.points[0]!, ...replacement },
        ...input.valuation!.points.slice(1),
      ],
    },
  };
}

function replaceFirstSelectedCell(
  input: PersonalHistoricalMultipleValuationInput,
  value: string,
): PersonalHistoricalMultipleValuationInput {
  return replaceFirstPoint(input, { priceToEarnings: known(value) });
}

function identity() {
  return {
    country: "US" as const,
    exchangeMic: "XNAS",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
  };
}

function known(value: string) {
  return { status: "known" as const, unit: "ratio" as const, value };
}

function dateAt(dayOffset: number, start = "2025-01-01"): string {
  return new Date(Date.parse(`${start}T00:00:00.000Z`) + dayOffset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function expectGenericTypeError(input: unknown): void {
  let thrown: unknown;
  try {
    unsafeCalculate(input);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(TypeError);
  expect((thrown as TypeError).message).toBe("");
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested);
}

function findArrays(value: unknown, path = "result"): string[] {
  if (Array.isArray(value)) return [path];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    findArrays(nested, `${path}.${key}`),
  );
}
