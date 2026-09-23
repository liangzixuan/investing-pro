import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  buildPersonalPriceValuationScreenRow,
  evaluatePersonalPriceValuationScreen,
  validatePersonalPriceValuationScreenCriteria,
  type PersonalPriceValuationScreenCriteria,
  type PersonalPriceValuationScreenInput,
  type PersonalPriceValuationScreenRatioCell,
  type PersonalPriceValuationScreenRow,
  type PersonalPriceValuationScreenRowInput,
} from "./index";

const build = (value: unknown) =>
  buildPersonalPriceValuationScreenRow(
    value as PersonalPriceValuationScreenRowInput,
  );
const evaluate = (value: unknown) =>
  evaluatePersonalPriceValuationScreen(
    value as PersonalPriceValuationScreenInput,
  );
const known = (value: string): PersonalPriceValuationScreenRatioCell => ({
  status: "known",
  unit: "ratio",
  value,
});
const missing = (): PersonalPriceValuationScreenRatioCell => ({
  status: "unknown",
  unit: "ratio",
  value: null,
  reason: "not_supplied_by_provider",
});
function fixture(symbol = "AAA") {
  const identity = {
    country: "US" as const,
    exchangeMic: "XNAS",
    issuerName: `${symbol} Company`,
    listingId: `listing-${symbol}`,
    securityName: `${symbol} Common Stock`,
    symbol,
  };
  const point = {
    date: "2026-09-22",
    priceToEarnings: known("12.5"),
    priceToBook: known("2"),
  };
  return {
    identity,
    loadDate: "2026-09-23",
    market: {
      security: { ...identity },
      range: "1m" as const,
      startDate: "2026-08-23",
      endDate: "2026-09-23",
      bars: [
        { date: "2026-09-20", raw: { close: "10" } },
        { date: "2026-09-22", raw: { close: "25" } },
        { date: "2026-09-23", raw: { close: "40" } },
      ],
    },
    valuation: {
      security: { ...identity },
      range: "1m" as const,
      startDate: "2026-08-23",
      endDate: "2026-09-23",
      latestPoint: { ...point },
      points: [
        {
          date: "2026-09-20",
          priceToEarnings: known("8"),
          priceToBook: known("1"),
        },
        { ...point },
      ],
    },
  };
}
function criteria(): PersonalPriceValuationScreenCriteria {
  return {
    bounds: {
      rawClose: { min: null, max: null },
      priceToEarnings: { min: null, max: null },
      priceToBook: { min: null, max: null },
    },
    sort: { field: "symbol", direction: "asc" },
  };
}
function row(
  symbol: string,
  pe: string | null = "12.5",
  pb: string | null = "2",
): PersonalPriceValuationScreenRow {
  const input = fixture(symbol);
  input.valuation.latestPoint = {
    date: "2026-09-22",
    priceToEarnings: pe === null ? missing() : known(pe),
    priceToBook: pb === null ? missing() : known(pb),
  };
  input.valuation.points[1] = input.valuation.latestPoint;
  return build(input);
}
function withBound(
  field: "rawClose" | "priceToEarnings" | "priceToBook",
  min: string | null,
  max: string | null,
): PersonalPriceValuationScreenCriteria {
  const value = criteria();
  return { ...value, bounds: { ...value.bounds, [field]: { min, max } } };
}

describe("watchlist price and valuation projection", () => {
  it.each(["x".repeat(257), "x".repeat(512), "𐐀".repeat(512)])(
    "retains valid saved identity display names without provider sources (%#)",
    (name) => {
      const input = fixture();
      const identity = {
        ...input.identity,
        issuerName: name,
        securityName: name,
      };
      const projected = build({
        identity,
        loadDate: input.loadDate,
        market: null,
        valuation: null,
      });
      expect(projected.identity).toEqual(identity);
      expect(projected.metrics.rawClose.status).toBe("unknown");
      expect(
        evaluate({ rows: [projected], criteria: criteria() }).counts.total,
      ).toBe(1);
    },
  );

  it("rejects saved display names beyond the 512-codepoint contract", () => {
    const input = fixture();
    for (const field of ["issuerName", "securityName"] as const) {
      expect(() =>
        build({
          identity: { ...input.identity, [field]: "𐐀".repeat(513) },
          loadDate: input.loadDate,
          market: null,
          valuation: null,
        }),
      ).toThrow(TypeError);
    }
  });

  it("anchors all three cells at the latest valuation date, ignoring a newer EOD close", () => {
    const result = build(fixture());
    expect(result).toEqual({
      identity: fixture().identity,
      loadDate: "2026-09-23",
      observationDate: "2026-09-22",
      ageDays: 1,
      metrics: {
        rawClose: { status: "known", value: "25" },
        priceToEarnings: { status: "known", value: "12.5" },
        priceToBook: { status: "known", value: "2" },
      },
    });
    expect(Object.keys(result).sort()).toEqual([
      "ageDays",
      "identity",
      "loadDate",
      "metrics",
      "observationDate",
    ]);
  });
  it("withholds the entire paired row instead of falling back to an older complete pair", () => {
    const input = fixture();
    input.market.bars = input.market.bars.filter(
      (bar) => bar.date !== "2026-09-22",
    );
    const result = build(input);
    expect(result).toMatchObject({ observationDate: "2026-09-22", ageDays: 1 });
    for (const cell of Object.values(result.metrics))
      expect(cell).toEqual({
        status: "unknown",
        value: null,
        reason: "latest_date_close_missing",
      });
  });
  it("keeps the latest anchor when both latest ratios are unknown", () => {
    const result = row("AAA", null, null);
    expect(result.observationDate).toBe("2026-09-22");
    expect(result.metrics.rawClose).toEqual({ status: "known", value: "25" });
    expect(result.metrics.priceToEarnings).toEqual({
      status: "unknown",
      value: null,
      reason: "not_supplied_by_provider",
    });
  });
  it("preserves signed, zero and long exact ratio strings", () => {
    const result = row("AAA", "-123456789012345678901234567890.123456789", "0");
    expect(result.metrics.priceToEarnings).toEqual({
      status: "known",
      value: "-123456789012345678901234567890.123456789",
    });
    expect(result.metrics.priceToBook).toEqual({ status: "known", value: "0" });
  });
  it.each([
    ["101.50", "101.5"],
    ["1.0", "1"],
    [
      "123456789012345678901234567890.123456789000",
      "123456789012345678901234567890.123456789",
    ],
  ])(
    "normalizes accepted source raw-close spelling %s exactly",
    (close, expected) => {
      const input = fixture();
      input.market.bars[1] = { date: "2026-09-22", raw: { close } };
      const projected = build(input);
      expect(projected.metrics.rawClose).toEqual({
        status: "known",
        value: expected,
      });
      expect(
        evaluate({
          rows: [projected],
          criteria: withBound("rawClose", expected, expected),
        }).counts.matches,
      ).toBe(1);
    },
  );
  it.each([
    [null, null, "valuation_not_loaded", null],
    [fixture().market, null, "valuation_not_loaded", null],
    [null, fixture().valuation, "market_not_loaded", "2026-09-22"],
  ])(
    "represents missing source combination %# without invented values",
    (market, valuation, reason, observationDate) => {
      const result = build({ ...fixture(), market, valuation });
      expect(result.observationDate).toBe(observationDate);
      expect(result.ageDays).toBe(observationDate === null ? null : 1);
      for (const cell of Object.values(result.metrics))
        expect(cell).toEqual({ status: "unknown", value: null, reason });
    },
  );
  it("accepts empty valid price history as a missing exact-date close", () => {
    const input = fixture();
    input.market.bars = [];
    expect(build(input).metrics.rawClose).toMatchObject({
      status: "unknown",
      reason: "latest_date_close_missing",
    });
  });
  it("reports age in UTC calendar days without a freshness cutoff", () => {
    const input = fixture();
    input.loadDate = "2026-11-02";
    expect(build(input).ageDays).toBe(41);
    input.loadDate = "2026-09-23";
    input.valuation.points[1] = {
      ...input.valuation.latestPoint,
      date: "2026-09-23",
    };
    input.valuation.latestPoint = input.valuation.points[1];
    expect(build(input).ageDays).toBe(0);
  });
  it("accepts a clamped month and leap-day date", () => {
    const input = fixture();
    input.loadDate = "2024-03-31";
    const point = { ...input.valuation.latestPoint, date: "2024-02-29" };
    const market = {
      ...input.market,
      startDate: "2024-02-29",
      endDate: "2024-03-31",
      bars: [{ date: "2024-02-29", raw: { close: "1" } }],
    };
    const valuation = {
      ...input.valuation,
      startDate: "2024-02-29",
      endDate: "2024-03-31",
      latestPoint: point,
      points: [point],
    };
    expect(build({ ...input, market, valuation }).ageDays).toBe(31);
  });
  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ])("rejects changed %s on either provider source", (field) => {
    for (const source of ["market", "valuation"] as const) {
      const input = fixture();
      const security = {
        ...input[source].security,
        [field]:
          field === "country"
            ? "CA"
            : field === "exchangeMic"
              ? "XNYS"
              : "DIFFERENT",
      };
      expect(() =>
        build({ ...input, [source]: { ...input[source], security } }),
      ).toThrow(TypeError);
    }
  });
  it.each([
    "2026-02-29",
    "2026-09-31",
    "2026-9-23",
    "2026-09-23T00:00:00Z",
    "1899-12-31",
    "not-a-date",
  ])("rejects malformed frozen load date %s", (loadDate) => {
    expect(() => build({ ...fixture(), loadDate })).toThrow(TypeError);
  });
  it.each(["2026-09-24", "2026-02-30", "2026-08-22"])(
    "rejects future, invalid or out-of-window source observation %s",
    (date) => {
      const input = fixture();
      expect(() =>
        build({
          ...input,
          market: { ...input.market, bars: [{ date, raw: { close: "1" } }] },
        }),
      ).toThrow(TypeError);
      const point = { ...input.valuation.latestPoint, date };
      expect(() =>
        build({
          ...input,
          valuation: {
            ...input.valuation,
            points: [point],
            latestPoint: point,
          },
        }),
      ).toThrow(TypeError);
    },
  );
  it.each(["3m", "1y"])(
    "rejects a %s source masquerading as the fixed window",
    (range) => {
      const input = fixture();
      expect(() =>
        build({ ...input, market: { ...input.market, range } }),
      ).toThrow(TypeError);
      expect(() =>
        build({ ...input, valuation: { ...input.valuation, range } }),
      ).toThrow(TypeError);
    },
  );
  it("rejects inconsistent one-month bounds and source end after frozen day", () => {
    const input = fixture();
    for (const source of ["market", "valuation"] as const) {
      expect(() =>
        build({
          ...input,
          [source]: { ...input[source], startDate: "2026-08-22" },
        }),
      ).toThrow(TypeError);
      expect(() =>
        build({
          ...input,
          [source]: {
            ...input[source],
            startDate: "2026-08-24",
            endDate: "2026-09-24",
          },
        }),
      ).toThrow(TypeError);
    }
  });
  it.each(["0", "-1", "1e2", "NaN", "Infinity", "01", "-0", "9".repeat(65)])(
    "rejects unusable or noncanonical raw close %s",
    (close) => {
      const input = fixture();
      input.market.bars[0] = { date: "2026-09-20", raw: { close } };
      expect(() => build(input)).toThrow(TypeError);
    },
  );
  it("validates malformed historical cells even when they are not selected", () => {
    const input = fixture();
    const points = [
      {
        date: "2026-09-20",
        priceToEarnings: { status: "known", unit: "USD", value: "1" },
        priceToBook: known("1"),
      },
      input.valuation.latestPoint,
    ];
    expect(() =>
      build({ ...input, valuation: { ...input.valuation, points } }),
    ).toThrow(TypeError);
    expect(() =>
      build({
        ...input,
        valuation: null,
        market: {
          ...input.market,
          bars: [{ date: "bad", raw: { close: "1" } }],
        },
      }),
    ).toThrow(TypeError);
  });
  it("requires latestPoint to exactly match the final ordered observation", () => {
    const input = fixture();
    for (const latestPoint of [
      input.valuation.points[0],
      { ...input.valuation.latestPoint, priceToEarnings: missing() },
      { ...input.valuation.latestPoint, priceToBook: known("3") },
    ]) {
      expect(() =>
        build({ ...input, valuation: { ...input.valuation, latestPoint } }),
      ).toThrow(TypeError);
    }
  });
  it("rejects empty, unordered, duplicate, sparse or excessive valuation histories", () => {
    const input = fixture();
    const malformed: unknown[] = [
      [],
      [...input.valuation.points].reverse(),
      [input.valuation.latestPoint, input.valuation.latestPoint],
      new Array<unknown>(2),
      Array.from({ length: 4097 }, () => input.valuation.latestPoint),
    ];
    for (const points of malformed)
      expect(() =>
        build({ ...input, valuation: { ...input.valuation, points } }),
      ).toThrow(TypeError);
  });
  it("rejects unordered, duplicate, sparse or excessive price histories", () => {
    const input = fixture();
    const malformed: unknown[] = [
      [...input.market.bars].reverse(),
      [input.market.bars[1], input.market.bars[1]],
      new Array<unknown>(2),
      Array.from({ length: 4097 }, () => input.market.bars[0]),
    ];
    for (const bars of malformed)
      expect(() =>
        build({ ...input, market: { ...input.market, bars } }),
      ).toThrow(TypeError);
  });
  it("rejects extra quote and adjusted-close fields instead of using them", () => {
    const input = fixture();
    expect(() =>
      build({
        ...input,
        market: { ...input.market, quote: { price: "1000" } },
      }),
    ).toThrow(TypeError);
    expect(() =>
      build({
        ...input,
        market: {
          ...input.market,
          bars: input.market.bars.map((bar) => ({
            ...bar,
            adjusted: { close: "1000" },
          })),
        },
      }),
    ).toThrow(TypeError);
  });
  it("copies and freezes its narrow output without retaining or freezing inputs", () => {
    const input = fixture();
    const result = build(input);
    input.identity.issuerName = "Changed";
    input.market.bars.length = 0;
    expect(result.identity.issuerName).toBe("AAA Company");
    expect(result.metrics.rawClose).toEqual({ status: "known", value: "25" });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.identity)).toBe(true);
    expect(Object.isFrozen(result.metrics.rawClose)).toBe(true);
    expect(Object.isFrozen(input.identity)).toBe(false);
  });
});

describe("price and valuation criteria and screening", () => {
  it("normalizes ordinary decimal threshold spellings without rounding", () => {
    expect(
      validatePersonalPriceValuationScreenCriteria(
        withBound("priceToEarnings", "-.50", "0012.5000"),
      )?.bounds.priceToEarnings,
    ).toEqual({ min: "-0.5", max: "12.5" });
    expect(
      validatePersonalPriceValuationScreenCriteria(
        withBound("rawClose", "-0", "1."),
      )?.bounds.rawClose,
    ).toEqual({ min: "0", max: "1" });
  });
  it.each([
    "",
    " ",
    "1,000",
    "1e2",
    "+1",
    "NaN",
    "Infinity",
    "--1",
    "9".repeat(65),
  ])("rejects malformed threshold %s", (min) => {
    expect(
      validatePersonalPriceValuationScreenCriteria(
        withBound("rawClose", min, null),
      ),
    ).toBeNull();
  });
  it("rejects reversed bounds, unknown fields, absent bounds and invalid sort", () => {
    const valid = criteria();
    for (const invalid of [
      withBound("rawClose", "2", "1"),
      { ...valid, extra: true },
      { ...valid, bounds: {} },
      { ...valid, sort: { field: "currentQuote", direction: "asc" } },
      { ...valid, sort: { field: "symbol", direction: ["asc"] } },
      {
        ...valid,
        bounds: { ...valid.bounds, rawClose: { min: 1, max: null } },
      },
    ]) {
      expect(validatePersonalPriceValuationScreenCriteria(invalid)).toBeNull();
      expect(() => evaluate({ rows: [], criteria: invalid })).toThrow(
        TypeError,
      );
    }
  });
  it("compares values beyond binary and default decimal precision at inclusive boundaries", () => {
    const value = "123456789012345678901234567890.123456789012345678901";
    const rows = [
      row("AAA", value),
      row("BBB", "123456789012345678901234567890.1234567890123456789"),
    ];
    const result = evaluate({
      rows,
      criteria: withBound("priceToEarnings", value, value),
    });
    expect(result.rows.map((r) => r.outcome)).toEqual(["match", "non_match"]);
  });
  it("uses literal signed and zero ratio comparisons", () => {
    const rows = [row("NEG", "-2"), row("ZERO", "0"), row("POS", "0.0001")];
    expect(
      evaluate({ rows, criteria: withBound("priceToEarnings", "0", null) })
        .counts,
    ).toEqual({ total: 3, matches: 2, nonMatches: 1, unknown: 0 });
    expect(
      evaluate({ rows, criteria: withBound("priceToEarnings", "0.0001", null) })
        .counts.matches,
    ).toBe(1);
    expect(
      evaluate({ rows, criteria: withBound("priceToEarnings", null, "0") })
        .counts.matches,
    ).toBe(2);
  });
  it("lets false dominate unknown and keeps missing required fields separate", () => {
    const base = withBound("priceToEarnings", "10", null);
    const query = {
      ...base,
      bounds: { ...base.bounds, priceToBook: { min: null, max: "3" } },
    };
    const result = evaluate({
      rows: [
        row("AAA", null, "5"),
        row("BBB", null, "2"),
        row("CCC", "12", "2"),
      ],
      criteria: query,
    });
    expect(result.rows.map((r) => r.outcome)).toEqual([
      "non_match",
      "unknown",
      "match",
    ]);
    expect(result.counts).toEqual({
      total: 3,
      matches: 1,
      nonMatches: 1,
      unknown: 1,
    });
    expect(result.metricCoverage).toEqual({
      rawClose: { known: 3, unknown: 0 },
      priceToEarnings: { known: 1, unknown: 2 },
      priceToBook: { known: 3, unknown: 0 },
    });
  });
  it("matches every selected row when no bound is active without claiming known inputs", () => {
    const empty = build({ ...fixture(), market: null, valuation: null });
    const result = evaluate({ rows: [empty], criteria: criteria() });
    expect(result.counts).toEqual({
      total: 1,
      matches: 1,
      nonMatches: 0,
      unknown: 0,
    });
    expect(result.metricCoverage.rawClose).toEqual({ known: 0, unknown: 1 });
  });
  it.each(["asc", "desc"] as const)(
    "puts unknown numeric cells last in %s order, with stable identity ties",
    (direction) => {
      const sameSymbol = {
        ...row("AAA", "2"),
        identity: { ...row("AAA").identity, listingId: "listing-AAA-2" },
      };
      const rows = [
        row("DDD", null),
        row("CCC", "3"),
        sameSymbol,
        row("AAA", "2"),
        row("BBB", null),
      ];
      const result = evaluate({
        rows,
        criteria: {
          ...criteria(),
          sort: { field: "priceToEarnings", direction },
        },
      });
      expect(result.rows.map((r) => r.identity.listingId)).toEqual(
        direction === "asc"
          ? [
              "listing-AAA",
              "listing-AAA-2",
              "listing-CCC",
              "listing-BBB",
              "listing-DDD",
            ]
          : [
              "listing-CCC",
              "listing-AAA",
              "listing-AAA-2",
              "listing-BBB",
              "listing-DDD",
            ],
      );
      expect(
        evaluate({
          rows: [...rows].reverse(),
          criteria: {
            ...criteria(),
            sort: { field: "priceToEarnings", direction },
          },
        }),
      ).toEqual(result);
    },
  );
  it("sorts symbols literally with listing identity as a stable tiebreaker", () => {
    const rows = [row("AA"), row("A"), row("Z")];
    expect(
      evaluate({
        rows,
        criteria: {
          ...criteria(),
          sort: { field: "symbol", direction: "desc" },
        },
      }).rows.map((r) => r.identity.symbol),
    ).toEqual(["Z", "AA", "A"]);
  });
  it("accepts zero through twenty rows and rejects duplicates or a twenty-first", () => {
    expect(evaluate({ rows: [], criteria: criteria() }).counts.total).toBe(0);
    const rows = Array.from({ length: 20 }, (_, i) => row(`A${i}`));
    expect(evaluate({ rows, criteria: criteria() }).counts.total).toBe(20);
    expect(() =>
      evaluate({ rows: [...rows, row("Z")], criteria: criteria() }),
    ).toThrow(TypeError);
    expect(() =>
      evaluate({ rows: [rows[0], rows[0]], criteria: criteria() }),
    ).toThrow(TypeError);
  });
  it("rejects mixed batch dates, fabricated ages and incoherent paired-row cells", () => {
    const good = row("AAA");
    const absent = build({ ...fixture("BBB"), market: null, valuation: null });
    for (const invalid of [
      { ...good, ageDays: 2 },
      { ...good, observationDate: null, ageDays: null },
      {
        ...good,
        metrics: { ...good.metrics, rawClose: { status: "known", value: "0" } },
      },
      {
        ...absent,
        metrics: {
          ...absent.metrics,
          priceToBook: { status: "known", value: "2" },
        },
      },
      { ...absent, observationDate: "2026-09-22", ageDays: 1 },
    ]) {
      expect(() => evaluate({ rows: [invalid], criteria: criteria() })).toThrow(
        TypeError,
      );
    }
    expect(() =>
      evaluate({
        rows: [good, { ...row("BBB"), loadDate: "2026-09-24", ageDays: 2 }],
        criteria: criteria(),
      }),
    ).toThrow(TypeError);
  });
  it("rejects sparse rows, non-plain records and extra metadata", () => {
    expect(() =>
      evaluate({ rows: new Array<unknown>(1), criteria: criteria() }),
    ).toThrow(TypeError);
    expect(() =>
      evaluate({
        rows: [{ ...row("AAA"), quote: "100" }],
        criteria: criteria(),
      }),
    ).toThrow(TypeError);
    expect(validatePersonalPriceValuationScreenCriteria(new Date())).toBeNull();
    expect(() => build(Object.create(fixture()))).toThrow(TypeError);
    const input = fixture();
    Object.defineProperty(input, Symbol("hidden"), { value: true });
    expect(() => build(input)).toThrow(TypeError);
  });
  it("keeps comparison exact under foreign Decimal global configuration", () => {
    const original = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      toExpNeg: Decimal.toExpNeg,
      toExpPos: Decimal.toExpPos,
    };
    try {
      Decimal.set({
        precision: 2,
        rounding: Decimal.ROUND_DOWN,
        toExpNeg: 0,
        toExpPos: 1,
      });
      const result = evaluate({
        rows: [row("AAA", "10.000000000000000000000000001")],
        criteria: withBound(
          "priceToEarnings",
          "10.000000000000000000000000001",
          null,
        ),
      });
      expect(result.counts.matches).toBe(1);
      expect(
        validatePersonalPriceValuationScreenCriteria(
          withBound(
            "priceToEarnings",
            "00010.000000000000000000000000001",
            null,
          ),
        )?.bounds.priceToEarnings.min,
      ).toBe("10.000000000000000000000000001");
    } finally {
      Decimal.set(original);
    }
  });
  it("returns frozen copies and leaves input ordering and criteria untouched", () => {
    const rows = [row("BBB"), row("AAA")];
    const query = criteria();
    const result = evaluate({ rows, criteria: query });
    expect(rows.map((r) => r.identity.symbol)).toEqual(["BBB", "AAA"]);
    expect(Object.isFrozen(rows)).toBe(false);
    expect(Object.isFrozen(query)).toBe(false);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.counts)).toBe(true);
    expect(result.rows[0]?.identity).not.toBe(rows[1]?.identity);
  });
});
