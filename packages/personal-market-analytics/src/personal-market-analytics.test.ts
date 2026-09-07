import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_MARKET_ANALYTICS_FORMULAS,
  PERSONAL_MARKET_ANALYTICS_FORMULA_SET_VERSION,
  PERSONAL_MARKET_ANALYTICS_METRIC_STATUSES,
  PERSONAL_MARKET_ANALYTICS_MODES,
  PERSONAL_MARKET_ANALYTICS_ROUNDING,
  PERSONAL_MARKET_ANALYTICS_SCHEMA_VERSION,
  PERSONAL_MARKET_ANALYTICS_SESSION_POLICY,
  PERSONAL_MARKET_ANALYTICS_TREND_CLASSIFICATIONS,
  calculatePersonalMarketAnalytics,
  type PersonalMarketAnalyticsBar,
  type PersonalMarketAnalyticsResult,
} from "./index";

const DAY_MILLISECONDS = 86_400_000;

describe("personal market analytics", () => {
  it("publishes a frozen, versioned formula contract", () => {
    expect(PERSONAL_MARKET_ANALYTICS_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_MARKET_ANALYTICS_FORMULA_SET_VERSION).toBe("1.0.0");
    expect(PERSONAL_MARKET_ANALYTICS_SESSION_POLICY).toBe(
      "observed_sessions_only_no_gap_filling",
    );
    expect(PERSONAL_MARKET_ANALYTICS_MODES).toEqual(["adjusted", "raw"]);
    expect(PERSONAL_MARKET_ANALYTICS_METRIC_STATUSES).toEqual([
      "available",
      "insufficient_history",
      "zero_range",
    ]);
    expect(PERSONAL_MARKET_ANALYTICS_TREND_CLASSIFICATIONS).toEqual([
      "above",
      "below",
      "at",
    ]);
    expect(PERSONAL_MARKET_ANALYTICS_ROUNDING).toEqual({
      decimalPlaces: 4,
      method: "round_half_up",
      negativeZero: "normalize_to_positive_zero",
      unit: "percent",
    });
    expectDeepFrozen(PERSONAL_MARKET_ANALYTICS_FORMULAS);
    expectDeepFrozen(PERSONAL_MARKET_ANALYTICS_ROUNDING);
  });

  it("matches golden calculations for every metric", () => {
    const bars = consecutiveBars(252, (index) => String(100 + index));
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-09-09",
      bars,
      mode: "adjusted",
    });

    expect(result).toMatchObject({
      asOfDate: "2025-09-09",
      formulaSetVersion: "1.0.0",
      inputWindow: {
        firstDate: "2025-01-01",
        lastDate: "2025-09-09",
        sessionCount: 252,
        sessionPolicy: "observed_sessions_only_no_gap_filling",
      },
      mode: "adjusted",
      schemaVersion: "1.0.0",
    });
    expect(result.metrics.selectedWindowReturn).toMatchObject({
      observedSessions: 252,
      sampleFirstDate: "2025-01-01",
      sampleLastDate: "2025-09-09",
      status: "available",
      valuePercent: "251.0000",
    });
    expect(result.metrics.trailing20SessionAnnualizedVolatility).toMatchObject({
      observedSessions: 21,
      sampleFirstDate: "2025-08-20",
      sampleLastDate: "2025-09-09",
      status: "available",
      valuePercent: "0.0808",
    });
    expect(result.metrics.maximumDrawdown).toMatchObject({
      observedSessions: 252,
      peakDate: "2025-01-01",
      sampleFirstDate: "2025-01-01",
      sampleLastDate: "2025-09-09",
      status: "available",
      troughDate: "2025-01-01",
      valuePercent: "0.0000",
    });
    expect(result.metrics.trailing252SessionCloseRangePosition).toMatchObject({
      observedSessions: 252,
      sampleFirstDate: "2025-01-01",
      sampleLastDate: "2025-09-09",
      status: "available",
      valuePercent: "100.0000",
    });
    expect(result.metrics.smaTrend).toEqual({
      sma20: {
        ...PERSONAL_MARKET_ANALYTICS_FORMULAS.sma20,
        classification: "above",
        distancePercent: "2.7818",
        observedSessions: 20,
        sampleFirstDate: "2025-08-21",
        sampleLastDate: "2025-09-09",
        status: "available",
      },
      sma50: {
        ...PERSONAL_MARKET_ANALYTICS_FORMULAS.sma50,
        classification: "above",
        distancePercent: "7.5038",
        observedSessions: 50,
        sampleFirstDate: "2025-07-22",
        sampleLastDate: "2025-09-09",
        status: "available",
      },
      sma200: {
        ...PERSONAL_MARKET_ANALYTICS_FORMULAS.sma200,
        classification: "above",
        distancePercent: "39.5626",
        observedSessions: 200,
        sampleFirstDate: "2025-02-22",
        sampleLastDate: "2025-09-09",
        status: "available",
      },
    });
    expectFormulaMetadata(result);
  });

  it("returns explicit insufficient-history metrics, including for an empty window", () => {
    const empty = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-01",
      bars: [],
      mode: "adjusted",
    });
    expect(empty.inputWindow).toEqual({
      firstDate: null,
      lastDate: null,
      sessionCount: 0,
      sessionPolicy: "observed_sessions_only_no_gap_filling",
    });
    expect(empty.metrics.selectedWindowReturn).toMatchObject({
      observedSessions: 0,
      requiredSessions: 2,
      sampleFirstDate: null,
      sampleLastDate: null,
      status: "insufficient_history",
    });

    const oneSession = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-01",
      bars: [bar("2025-01-01", "101")],
      mode: "adjusted",
    });
    for (const metric of metricLeaves(oneSession)) {
      expect(metric).toMatchObject({
        observedSessions: 1,
        sampleFirstDate: "2025-01-01",
        sampleLastDate: "2025-01-01",
        status: "insufficient_history",
      });
    }
    expect(oneSession.metrics.maximumDrawdown).toMatchObject({
      observedSessions: 1,
      requiredSessions: 2,
      status: "insufficient_history",
    });
    expect(
      oneSession.metrics.trailing20SessionAnnualizedVolatility,
    ).toMatchObject({
      observedSessions: 1,
      requiredSessions: 21,
      status: "insufficient_history",
    });
    expect(
      oneSession.metrics.trailing252SessionCloseRangePosition,
    ).toMatchObject({
      observedSessions: 1,
      requiredSessions: 200,
      status: "insufficient_history",
    });
    expect(oneSession.metrics.smaTrend.sma20).toMatchObject({
      observedSessions: 1,
      requiredSessions: 20,
      status: "insufficient_history",
    });
    expect(oneSession.metrics.smaTrend.sma50).toMatchObject({
      observedSessions: 1,
      requiredSessions: 50,
      status: "insufficient_history",
    });
    expect(oneSession.metrics.smaTrend.sma200).toMatchObject({
      observedSessions: 1,
      requiredSessions: 200,
      status: "insufficient_history",
    });
  });

  it("handles constant prices, zero range, exact at-SMA states, and zero normalization", () => {
    const bars = consecutiveBars(200, () => "42.5");
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-07-19",
      bars,
      mode: "adjusted",
    });

    expect(result.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "0.0000",
    });
    expect(result.metrics.trailing20SessionAnnualizedVolatility).toMatchObject({
      status: "available",
      valuePercent: "0.0000",
    });
    expect(result.metrics.maximumDrawdown).toMatchObject({
      peakDate: "2025-01-01",
      status: "available",
      troughDate: "2025-01-01",
      valuePercent: "0.0000",
    });
    expect(result.metrics.trailing252SessionCloseRangePosition).toMatchObject({
      observedSessions: 200,
      sampleFirstDate: "2025-01-01",
      sampleLastDate: "2025-07-19",
      status: "zero_range",
    });
    for (const metric of [
      result.metrics.smaTrend.sma20,
      result.metrics.smaTrend.sma50,
      result.metrics.smaTrend.sma200,
    ]) {
      expect(metric).toMatchObject({
        classification: "at",
        distancePercent: "0.0000",
        status: "available",
      });
    }

    const roundedNegativeZero = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-02",
      bars: [bar("2025-01-01", "100000"), bar("2025-01-02", "99999.99999")],
      mode: "adjusted",
    });
    expect(roundedNegativeZero.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "0.0000",
    });
  });

  it("selects adjusted or raw closes without mixing the two series", () => {
    const bars = [
      bar("2025-01-01", "100", "100"),
      bar("2025-01-02", "110", "90"),
    ];
    const adjusted = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-02",
      bars,
      mode: "adjusted",
    });
    const raw = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-02",
      bars,
      mode: "raw",
    });

    expect(adjusted.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "10.0000",
    });
    expect(adjusted.metrics.maximumDrawdown).toMatchObject({
      valuePercent: "0.0000",
    });
    expect(raw.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "-10.0000",
    });
    expect(raw.metrics.maximumDrawdown).toMatchObject({
      peakDate: "2025-01-01",
      troughDate: "2025-01-02",
      valuePercent: "10.0000",
    });
  });

  it("reports maximum-drawdown peak and trough dates with deterministic ties", () => {
    const closes = ["100", "120", "90", "140", "105", "150"];
    const bars = consecutiveBars(
      closes.length,
      (index) => closes[index] ?? "1",
    );
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-06",
      bars,
      mode: "adjusted",
    });

    expect(result.metrics.maximumDrawdown).toMatchObject({
      peakDate: "2025-01-02",
      status: "available",
      troughDate: "2025-01-03",
      valuePercent: "25.0000",
    });
  });

  it("counts only observed sessions even when calendar dates have gaps", () => {
    const bars = Array.from({ length: 21 }, (_, index) =>
      bar(dateAt(index * 3), index % 2 === 0 ? "100" : "101"),
    );
    const lastDate = bars.at(-1)?.date;
    if (lastDate === undefined) throw new TypeError();
    const result = calculatePersonalMarketAnalytics({
      asOfDate: lastDate,
      bars,
      mode: "adjusted",
    });

    expect(result.inputWindow).toMatchObject({
      firstDate: "2025-01-01",
      lastDate: "2025-03-02",
      sessionCount: 21,
      sessionPolicy: "observed_sessions_only_no_gap_filling",
    });
    expect(result.metrics.trailing20SessionAnnualizedVolatility).toMatchObject({
      observedSessions: 21,
      sampleFirstDate: "2025-01-01",
      sampleLastDate: "2025-03-02",
      status: "available",
    });
    expect(result.metrics.smaTrend.sma20).toMatchObject({
      observedSessions: 20,
      sampleFirstDate: "2025-01-04",
      sampleLastDate: "2025-03-02",
      status: "available",
    });
  });

  it("caps the close-range sample at the latest 252 observed sessions", () => {
    const bars = consecutiveBars(253, (index) =>
      index === 0 ? "1000" : String(index),
    );
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-09-10",
      bars,
      mode: "adjusted",
    });

    expect(result.metrics.trailing252SessionCloseRangePosition).toMatchObject({
      observedSessions: 252,
      sampleFirstDate: "2025-01-02",
      sampleLastDate: "2025-09-10",
      status: "available",
      valuePercent: "100.0000",
    });
  });

  it("keeps its 80-digit calculation context isolated from global Decimal settings", () => {
    const priorMaxE = Decimal.maxE;
    const priorPrecision = Decimal.precision;
    try {
      Decimal.set({ maxE: 1, precision: 2 });
      const bars = consecutiveBars(252, (index) => String(100 + index));
      const result = calculatePersonalMarketAnalytics({
        asOfDate: "2025-09-09",
        bars,
        mode: "adjusted",
      });
      expect(
        result.metrics.trailing20SessionAnnualizedVolatility,
      ).toMatchObject({
        status: "available",
        valuePercent: "0.0808",
      });
      expect(result.metrics.smaTrend.sma200).toMatchObject({
        distancePercent: "39.5626",
        status: "available",
      });
    } finally {
      Decimal.set({ maxE: priorMaxE, precision: priorPrecision });
    }
  });

  it("uses high-precision decimal comparison for an at-or-trend decision", () => {
    const bars = consecutiveBars(20, (index) =>
      index === 19 ? "100000000000000000000" : "100000000000000000001",
    );
    const result = calculatePersonalMarketAnalytics({
      asOfDate: "2025-01-20",
      bars,
      mode: "adjusted",
    });
    expect(result.metrics.smaTrend.sma20).toMatchObject({
      classification: "below",
      distancePercent: "0.0000",
      status: "available",
    });
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

function consecutiveBars(
  length: number,
  closeAt: (index: number) => string,
): PersonalMarketAnalyticsBar[] {
  return Array.from({ length }, (_, index) =>
    bar(dateAt(index), closeAt(index)),
  );
}

function dateAt(dayOffset: number): string {
  return new Date(Date.UTC(2025, 0, 1) + dayOffset * DAY_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function expectFormulaMetadata(result: PersonalMarketAnalyticsResult): void {
  for (const metric of metricLeaves(result)) {
    expect(metric.formulaId).toBeTypeOf("string");
    expect(metric.formulaVersion).toBe("1.0.0");
    expect(metric.parameters.roundingDecimalPlaces).toBe(4);
    expect(metric.parameters.sessionPolicy).toBe(
      "observed_sessions_only_no_gap_filling",
    );
    expectDeepFrozen(metric.parameters);
  }
}

type MetricLeaf =
  | PersonalMarketAnalyticsResult["metrics"]["selectedWindowReturn"]
  | PersonalMarketAnalyticsResult["metrics"]["trailing20SessionAnnualizedVolatility"]
  | PersonalMarketAnalyticsResult["metrics"]["maximumDrawdown"]
  | PersonalMarketAnalyticsResult["metrics"]["trailing252SessionCloseRangePosition"]
  | PersonalMarketAnalyticsResult["metrics"]["smaTrend"][keyof PersonalMarketAnalyticsResult["metrics"]["smaTrend"]];

function metricLeaves(result: PersonalMarketAnalyticsResult): MetricLeaf[] {
  return [
    result.metrics.selectedWindowReturn,
    result.metrics.trailing20SessionAnnualizedVolatility,
    result.metrics.maximumDrawdown,
    result.metrics.trailing252SessionCloseRangePosition,
    result.metrics.smaTrend.sma20,
    result.metrics.smaTrend.sma50,
    result.metrics.smaTrend.sma200,
  ];
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested);
}
