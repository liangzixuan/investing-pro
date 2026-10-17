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
  calculatePersonalRawCloseAnalytics,
  type PersonalMarketAnalyticsBar,
  type PersonalMarketAnalyticsResult,
  type PersonalRawCloseAnalyticsInput,
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

describe("raw-close market analytics", () => {
  it("matches independent metric goldens without an adjusted series", () => {
    const rows = rawRows(252, (index) => String(100 + index));
    const result = calculatePersonalRawCloseAnalytics({
      asOfDate: dateAt(251),
      rows,
    });
    expect(result.mode).toBe("raw");
    expect(result.inputWindow).toEqual({
      firstDate: dateAt(0),
      lastDate: dateAt(251),
      sessionCount: 252,
      sessionPolicy: PERSONAL_MARKET_ANALYTICS_SESSION_POLICY,
    });
    expect(result.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "251.0000",
    });
    expect(result.metrics.maximumDrawdown).toMatchObject({
      status: "available",
      valuePercent: "0.0000",
      peakDate: dateAt(0),
      troughDate: dateAt(0),
    });
    expect(result.metrics.trailing20SessionAnnualizedVolatility).toMatchObject({
      status: "available",
      valuePercent: "0.0808",
      observedSessions: 21,
      sampleFirstDate: dateAt(231),
      sampleLastDate: dateAt(251),
    });
    expect(result.metrics.trailing252SessionCloseRangePosition).toMatchObject({
      status: "available",
      valuePercent: "100.0000",
      observedSessions: 252,
    });
    for (const [metric, distancePercent, observedSessions] of [
      [result.metrics.smaTrend.sma20, "2.7818", 20],
      [result.metrics.smaTrend.sma50, "7.5038", 50],
      [result.metrics.smaTrend.sma200, "39.5626", 200],
    ] as const) {
      expect(metric).toMatchObject({
        status: "available",
        classification: "above",
        distancePercent,
        observedSessions,
        sampleFirstDate: dateAt(252 - observedSessions),
        sampleLastDate: dateAt(251),
      });
    }
    expectFormulaMetadata(result);
    expect(result).toEqual(
      calculatePersonalMarketAnalytics({
        asOfDate: dateAt(251),
        bars: rows.map(({ date, close }) => bar(date, "1", close)),
        mode: "raw",
      }),
    );
  });

  it.each([0, 1, 2, 19, 20, 21, 49, 50, 199, 200, 251, 252, 253])(
    "preserves every metric's history boundary for %i observed sessions",
    (count) => {
      const result = calculatePersonalRawCloseAnalytics({
        asOfDate: dateAt(Math.max(0, count - 1)),
        rows: rawRows(count, () => "42.5"),
      });
      const metrics = [
        [result.metrics.selectedWindowReturn, 2, count],
        [result.metrics.maximumDrawdown, 2, count],
        [result.metrics.trailing20SessionAnnualizedVolatility, 21, 21],
        [result.metrics.trailing252SessionCloseRangePosition, 200, 252],
        [result.metrics.smaTrend.sma20, 20, 20],
        [result.metrics.smaTrend.sma50, 50, 50],
        [result.metrics.smaTrend.sma200, 200, 200],
      ] as const;
      for (const [metric, requiredSessions, window] of metrics) {
        expect(metric).toMatchObject({
          observedSessions: Math.min(count, window),
          sampleFirstDate:
            count === 0 ? null : dateAt(Math.max(0, count - window)),
          sampleLastDate: count === 0 ? null : dateAt(count - 1),
        });
        if (count < requiredSessions) {
          expect(metric).toMatchObject({
            status: "insufficient_history",
            requiredSessions,
          });
          expect(metric).not.toHaveProperty("valuePercent");
          expect(metric).not.toHaveProperty("distancePercent");
        } else if (
          metric === result.metrics.trailing252SessionCloseRangePosition
        ) {
          expect(metric.status).toBe("zero_range");
          expect(metric).not.toHaveProperty("valuePercent");
        } else {
          expect(metric.status).toBe("available");
          if ("valuePercent" in metric)
            expect(metric.valuePercent).toBe("0.0000");
          else
            expect(metric).toMatchObject({
              classification: "at",
              distancePercent: "0.0000",
            });
        }
      }
    },
  );

  it("keeps signed returns, drawdown ties and observed gaps", () => {
    const closes = ["100", "120", "90", "140", "105", "80"];
    const result = calculatePersonalRawCloseAnalytics({
      asOfDate: dateAt(15),
      rows: closes.map((close, index) => ({ close, date: dateAt(index * 3) })),
    });
    expect(result.metrics.selectedWindowReturn).toMatchObject({
      valuePercent: "-20.0000",
    });
    expect(result.metrics.maximumDrawdown).toMatchObject({
      valuePercent: "42.8571",
      peakDate: dateAt(9),
      troughDate: dateAt(15),
    });
    expect(result.inputWindow.sessionCount).toBe(6);
    const tied = calculatePersonalRawCloseAnalytics({
      asOfDate: dateAt(5),
      rows: ["100", "120", "90", "140", "105", "150"].map((close, index) => ({
        close,
        date: dateAt(index),
      })),
    });
    expect(tied.metrics.maximumDrawdown).toMatchObject({
      valuePercent: "25.0000",
      peakDate: dateAt(1),
      troughDate: dateAt(2),
    });
  });

  it("uses the latest 252 closes for range position", () => {
    const result = calculatePersonalRawCloseAnalytics({
      asOfDate: dateAt(252),
      rows: rawRows(253, (index) => (index === 0 ? "1000" : String(index))),
    });
    expect(result.metrics.trailing252SessionCloseRangePosition).toMatchObject({
      status: "available",
      observedSessions: 252,
      sampleFirstDate: dateAt(1),
      valuePercent: "100.0000",
    });
  });

  it("isolates 80-digit arithmetic and retains exact decimal comparisons", () => {
    const priorMaxE = Decimal.maxE;
    const priorPrecision = Decimal.precision;
    const priorRounding = Decimal.rounding;
    try {
      Decimal.set({ maxE: 1, precision: 2, rounding: Decimal.ROUND_DOWN });
      const result = calculatePersonalRawCloseAnalytics({
        asOfDate: dateAt(251),
        rows: rawRows(252, (index) => String(100 + index)),
      });
      expect(
        result.metrics.trailing20SessionAnnualizedVolatility,
      ).toMatchObject({ valuePercent: "0.0808" });
      expect(result.metrics.smaTrend.sma200).toMatchObject({
        distancePercent: "39.5626",
      });
      const precise = calculatePersonalRawCloseAnalytics({
        asOfDate: dateAt(19),
        rows: rawRows(20, (index) =>
          index === 19 ? `1${"0".repeat(63)}` : `1${"0".repeat(62)}1`,
        ),
      });
      expect(precise.metrics.smaTrend.sma20).toMatchObject({
        classification: "below",
        distancePercent: "0.0000",
      });
      const tiny = calculatePersonalRawCloseAnalytics({
        asOfDate: dateAt(1),
        rows: [
          { date: dateAt(0), close: `0.${"0".repeat(61)}1` },
          { date: dateAt(1), close: `0.${"0".repeat(61)}2` },
        ],
      });
      expect(tiny.metrics.selectedWindowReturn).toMatchObject({
        valuePercent: "100.0000",
      });
    } finally {
      Decimal.set({
        maxE: priorMaxE,
        precision: priorPrecision,
        rounding: priorRounding,
      });
    }
    expect(
      calculatePersonalRawCloseAnalytics({
        asOfDate: dateAt(1),
        rows: [
          { date: dateAt(0), close: "100000" },
          { date: dateAt(1), close: "99999.99999" },
        ],
      }).metrics.selectedWindowReturn,
    ).toMatchObject({ valuePercent: "0.0000" });
  });

  it("owns frozen results without retaining or freezing caller input", () => {
    const rows = rawRows(2, (index) => (index === 0 ? "100" : "90"));
    const input: PersonalRawCloseAnalyticsInput = { asOfDate: dateAt(1), rows };
    const result = calculatePersonalRawCloseAnalytics(input);
    expectDeepFrozen(result);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(rows)).toBe(false);
    const first = rows[0];
    if (first === undefined) throw new TypeError();
    expect(Object.isFrozen(first)).toBe(false);
    first.close = "999";
    first.date = dateAt(100);
    rows.pop();
    expect(result.metrics.selectedWindowReturn).toMatchObject({
      valuePercent: "-10.0000",
    });
    expect(result.inputWindow).toMatchObject({
      firstDate: dateAt(0),
      sessionCount: 2,
    });
    expect(JSON.stringify(result)).not.toContain('"close"');
    expect(JSON.stringify(result)).not.toContain('"adjusted"');
  });

  it("refuses malformed, extra or incomplete shapes with a generic TypeError", () => {
    const calculate = calculatePersonalRawCloseAnalytics as (
      input: unknown,
    ) => PersonalMarketAnalyticsResult;
    const valid = {
      asOfDate: dateAt(0),
      rows: [{ date: dateAt(0), close: "10" }],
    };
    const malformed: unknown[] = [
      null,
      [],
      {},
      { ...valid, mode: "raw" },
      { ...valid, adjusted: [] },
      { ...valid, rows: {} },
      { rows: [] },
      { ...valid, rows: [{ date: dateAt(0) }] },
      { ...valid, rows: [{ ...valid.rows[0], extra: true }] },
      { ...valid, rows: [{ date: dateAt(0), close: 10 }] },
    ];
    for (const close of [
      "",
      "0",
      "-0",
      "-1",
      "NaN",
      "Infinity",
      "1e2",
      ".5",
      "01",
      "+1",
      " 1",
      "1 ",
      `1${"0".repeat(64)}`,
    ]) {
      malformed.push({ ...valid, rows: [{ date: dateAt(0), close }] });
    }
    for (const date of [
      "0000-01-01",
      "2025-02-29",
      "2025-1-01",
      "2025-04-31",
      dateAt(1),
    ]) {
      malformed.push({ ...valid, rows: [{ date, close: "10" }] });
    }
    malformed.push({ ...valid, asOfDate: "2025-02-29" });
    malformed.push({
      ...valid,
      asOfDate: dateAt(1),
      rows: [
        { date: dateAt(1), close: "10" },
        { date: dateAt(0), close: "10" },
      ],
    });
    malformed.push({ ...valid, rows: [valid.rows[0], valid.rows[0]] });
    for (const input of malformed) {
      expect(() => calculate(input)).toThrow(new TypeError());
    }
    expect(
      calculatePersonalRawCloseAnalytics({
        asOfDate: "2024-02-29",
        rows: [{ date: "2024-02-29", close: "10.00" }],
      }).inputWindow.sessionCount,
    ).toBe(1);
  });

  it("rejects accessors, hidden fields, symbols, sparse arrays and custom iterators without reading them", () => {
    const calculate = calculatePersonalRawCloseAnalytics as (
      input: unknown,
    ) => PersonalMarketAnalyticsResult;
    let reads = 0;
    const get = () => {
      reads += 1;
      return "10";
    };
    const row = { date: dateAt(0), close: "10" };
    const valid = { asOfDate: dateAt(0), rows: [row] };
    const arrayAccessor = Object.defineProperty([row], "0", {
      enumerable: true,
      get,
    });
    const inputs = [
      Object.defineProperty({ asOfDate: dateAt(0) }, "rows", {
        enumerable: true,
        get,
      }),
      {
        ...valid,
        rows: [
          Object.defineProperty({ date: dateAt(0) }, "close", {
            enumerable: true,
            get,
          }),
        ],
      },
      Object.defineProperty({ ...valid }, "hidden", { value: true }),
      { ...valid, [Symbol("extra")]: true },
      {
        ...valid,
        rows: [Object.defineProperty({ ...row }, "hidden", { value: true })],
      },
      { ...valid, rows: [{ ...row, [Symbol("extra")]: true }] },
      { ...valid, rows: new Array(1) },
      { ...valid, rows: arrayAccessor },
      {
        ...valid,
        rows: Object.defineProperty([row], Symbol.iterator, { get }),
      },
      { ...valid, rows: Object.assign([row], { extra: true }) },
      { ...valid, rows: Object.setPrototypeOf([row], null) as unknown },
      { ...valid, rows: [Object.create(row)] },
    ];
    for (const input of inputs)
      expect(() => calculate(input)).toThrow(new TypeError());
    expect(reads).toBe(0);
  });
});

function rawRows(length: number, closeAt: (index: number) => string) {
  return Array.from({ length }, (_, index) => ({
    date: dateAt(index),
    close: closeAt(index),
  }));
}

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
