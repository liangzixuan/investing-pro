import { describe, expect, it } from "vitest";

import {
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS,
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION,
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METHODOLOGY,
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS,
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING,
  PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SCHEMA_VERSION,
  calculatePersonalHistoricalMultipleValuation,
  type PersonalHistoricalMultipleValuationInput,
  type PersonalHistoricalMultipleValuationMetric,
  type PersonalHistoricalMultipleValuationRatioCell,
} from "./personal-historical-multiple-valuation";

describe("personal historical-multiple valuation", () => {
  it("publishes frozen, versioned R-7, weak-CDF, formula, and rounding metadata", () => {
    expect(PERSONAL_HISTORICAL_MULTIPLE_VALUATION_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULA_SET_VERSION).toBe(
      "1.0.0",
    );
    expect(PERSONAL_HISTORICAL_MULTIPLE_VALUATION_MINIMUM_OBSERVATIONS).toBe(
      60,
    );
    expect(
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS.quantile.parameters
        .method,
    ).toBe("R-7");
    expect(
      PERSONAL_HISTORICAL_MULTIPLE_VALUATION_FORMULAS.currentPercentile
        .parameters.comparison,
    ).toContain("less_than_or_equal");
    expect(PERSONAL_HISTORICAL_MULTIPLE_VALUATION_ROUNDING).toEqual({
      currentPercentileDecimalPlaces: 2,
      impliedPriceDecimalPlaces: 2,
      method: "round_half_up",
      multipleDecimalPlaces: 4,
      negativeZero: "normalize_to_positive_zero",
      percentDifferenceDecimalPlaces: 2,
    });
    expectDeepFrozen(PERSONAL_HISTORICAL_MULTIPLE_VALUATION_METHODOLOGY);
  });

  it.each(["priceToEarnings", "priceToBook"] as const)(
    "calculates exact R-7 quartiles and implied prices for %s",
    (metric) => {
      const result = calculatePersonalHistoricalMultipleValuation(
        completeInput(metric),
      );

      expect(result).toMatchObject({
        coverage: {
          minimumRequiredObservations: 60,
          nonpositiveExcludedObservations: 0,
          sampleFirstDate: "2025-01-01",
          sampleLastDate: "2025-03-01",
          totalObservations: 60,
          unknownExcludedObservations: 0,
          validPositiveObservations: 60,
        },
        currentPercentilePercent: "100.00",
        formulaSetVersion: "1.0.0",
        metric,
        reference: {
          currentMultiple: "60",
          date: "2025-03-01",
          rawCloseUsd: "120",
        },
        schemaVersion: "1.0.0",
        status: "available",
      });
      if (result.status !== "available") throw new TypeError();
      expect(result.bands).toEqual({
        p25: {
          differencePercent: "-73.75",
          impliedPriceUsd: "31.50",
          quantilePercent: 25,
          targetMultiple: "15.7500",
        },
        p50: {
          differencePercent: "-49.17",
          impliedPriceUsd: "61.00",
          quantilePercent: 50,
          targetMultiple: "30.5000",
        },
        p75: {
          differencePercent: "-24.58",
          impliedPriceUsd: "90.50",
          quantilePercent: 75,
          targetMultiple: "45.2500",
        },
      });
      expectDeepFrozen(result);
    },
  );

  it("uses the weak empirical CDF, including observations equal to the current multiple", () => {
    const input = completeInput("priceToEarnings");
    const last = input.valuation?.points.at(-1);
    if (last === undefined) throw new TypeError();
    const result = calculatePersonalHistoricalMultipleValuation({
      ...input,
      valuation: {
        ...input.valuation!,
        points: [
          ...input.valuation!.points.slice(0, -1),
          { ...last, priceToEarnings: known("30") },
        ],
      },
    });

    expect(result).toMatchObject({
      currentPercentilePercent: "51.67",
      reference: { currentMultiple: "30" },
      status: "available",
    });
  });

  it("counts unknown and nonpositive observations while excluding them from the sample", () => {
    const input = completeInput("priceToBook", 62);
    const points = input.valuation!.points.map((point, index) => {
      if (index === 0) return { ...point, priceToBook: unknown() };
      if (index === 1) return { ...point, priceToBook: known("-0.5") };
      return point;
    });
    const result = calculatePersonalHistoricalMultipleValuation({
      ...input,
      valuation: { ...input.valuation!, points },
    });

    expect(result).toMatchObject({
      coverage: {
        nonpositiveExcludedObservations: 1,
        sampleFirstDate: "2025-01-03",
        sampleLastDate: "2025-03-03",
        totalObservations: 62,
        unknownExcludedObservations: 1,
        validPositiveObservations: 60,
      },
      status: "available",
    });
  });

  it("admits trailing-zero and negative-zero lexemes, then visibly excludes nonpositive values", () => {
    const input = completeInput("priceToEarnings", 62);
    const points = input.valuation!.points.map((point, index) => {
      if (index === 0) return { ...point, priceToEarnings: known("-0.0") };
      if (index === 1) return { ...point, priceToEarnings: known("20.0") };
      return point;
    });
    const result = calculatePersonalHistoricalMultipleValuation({
      ...input,
      valuation: { ...input.valuation!, points },
    });

    expect(result).toMatchObject({
      coverage: {
        nonpositiveExcludedObservations: 1,
        sampleFirstDate: "2025-01-02",
        validPositiveObservations: 61,
      },
      status: "available",
    });
  });

  it("excludes valuation observations newer than the latest common raw-close date", () => {
    const input = completeInput("priceToEarnings", 62);
    const result = calculatePersonalHistoricalMultipleValuation({
      ...input,
      market: { ...input.market!, bars: input.market!.bars.slice(0, 60) },
    });

    expect(result).toMatchObject({
      coverage: {
        sampleLastDate: "2025-03-01",
        totalObservations: 60,
        validPositiveObservations: 60,
      },
      currentPercentilePercent: "100.00",
      reference: { currentMultiple: "60", date: "2025-03-01" },
      status: "available",
    });
    if (result.status !== "available") throw new TypeError();
    expect(result.bands.p50.targetMultiple).toBe("30.5000");
  });

  it.each([
    ["market_not_loaded", () => ({ ...completeInput(), market: null })],
    [
      "valuation_history_not_loaded",
      () => ({ ...completeInput(), valuation: null }),
    ],
    [
      "identity_mismatch",
      () => {
        const input = completeInput();
        return {
          ...input,
          valuation: {
            ...input.valuation!,
            security: { ...input.valuation!.security, listingId: "lst-other" },
          },
        };
      },
    ],
    [
      "range_mismatch",
      () => {
        const input = completeInput();
        return {
          ...input,
          valuation: { ...input.valuation!, range: "5y" as const },
        };
      },
    ],
    [
      "no_common_date",
      () => {
        const input = completeInput();
        return {
          ...input,
          market: {
            ...input.market!,
            bars: input.market!.bars.map((bar, index) => ({
              ...bar,
              date: dateAt(index + 400),
            })),
          },
        };
      },
    ],
    [
      "current_multiple_unavailable",
      () => replaceLatestSelectedCell(completeInput(), unknown()),
    ],
    [
      "current_multiple_nonpositive",
      () => replaceLatestSelectedCell(completeInput(), known("0")),
    ],
    [
      "reference_price_nonpositive",
      () => replaceLatestRawClose(completeInput(), "0"),
    ],
    [
      "insufficient_positive_observations",
      () => completeInput("priceToEarnings", 59),
    ],
  ] as const)("returns typed unavailable reason %s", (reason, build) => {
    const result = calculatePersonalHistoricalMultipleValuation(build());
    expect(result).toMatchObject({ reason, status: "unavailable" });
  });

  it("uses the latest exact date shared by the two ordered series", () => {
    const input = completeInput("priceToEarnings", 61);
    const result = calculatePersonalHistoricalMultipleValuation({
      ...input,
      market: {
        ...input.market!,
        bars: input.market!.bars.slice(0, -1),
      },
    });

    expect(result).toMatchObject({
      reference: {
        currentMultiple: "60",
        date: "2025-03-01",
        rawCloseUsd: "120",
      },
      status: "available",
    });
  });
});

function completeInput(
  metric: PersonalHistoricalMultipleValuationMetric = "priceToEarnings",
  observationCount = 60,
): PersonalHistoricalMultipleValuationInput {
  const points = Array.from({ length: observationCount }, (_, index) => ({
    date: dateAt(index),
    priceToBook: known(String(index + 1)),
    priceToEarnings: known(String(index + 1)),
  }));
  return {
    market: {
      bars: Array.from({ length: observationCount }, (_, index) => ({
        date: dateAt(index),
        raw: { close: String((index + 1) * 2) },
      })),
      range: "1y",
      security: identity(),
    },
    metric,
    valuation: {
      points,
      range: "1y",
      security: identity(),
    },
  };
}

function replaceLatestSelectedCell(
  input: PersonalHistoricalMultipleValuationInput,
  cell: PersonalHistoricalMultipleValuationRatioCell,
): PersonalHistoricalMultipleValuationInput {
  const points = input.valuation!.points;
  const latest = points.at(-1);
  if (latest === undefined) throw new TypeError();
  return {
    ...input,
    valuation: {
      ...input.valuation!,
      points: [...points.slice(0, -1), { ...latest, [input.metric]: cell }],
    },
  };
}

function replaceLatestRawClose(
  input: PersonalHistoricalMultipleValuationInput,
  close: string,
): PersonalHistoricalMultipleValuationInput {
  const bars = input.market!.bars;
  const latest = bars.at(-1);
  if (latest === undefined) throw new TypeError();
  return {
    ...input,
    market: {
      ...input.market!,
      bars: [...bars.slice(0, -1), { ...latest, raw: { close } }],
    },
  };
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

function known(value: string): PersonalHistoricalMultipleValuationRatioCell {
  return { status: "known", unit: "ratio", value };
}

function unknown(): PersonalHistoricalMultipleValuationRatioCell {
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    unit: "ratio",
    value: null,
  };
}

function dateAt(dayOffset: number): string {
  return new Date(Date.UTC(2025, 0, 1) + dayOffset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested);
}
