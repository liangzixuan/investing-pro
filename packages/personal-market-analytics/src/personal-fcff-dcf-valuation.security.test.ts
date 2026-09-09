import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  PERSONAL_FCFF_DCF_MAXIMUM_ANNUAL_PERIODS,
  PERSONAL_FCFF_DCF_MAXIMUM_MARKET_OBSERVATIONS,
  calculatePersonalFcffDcfValuation,
  type PersonalFcffDcfInput,
  type PersonalFcffDcfResult,
} from "./personal-fcff-dcf-valuation";

const unsafeCalculate = calculatePersonalFcffDcfValuation as (
  input: unknown,
) => PersonalFcffDcfResult;

describe("personal starting-unlevered-FCF-proxy DCF validation boundary", () => {
  it("rejects malformed aggregate, selection, source, assumption, and cell shapes", () => {
    const input = completeInput();
    const invalidInputs: readonly unknown[] = [
      null,
      {},
      { ...input, extra: true },
      { ...input, selection: [] },
      { ...input, assumptions: { ...input.assumptions, extra: true } },
      {
        ...input,
        assumptions: {
          ...input.assumptions,
          scenarios: { ...input.assumptions.scenarios, extra: true },
        },
      },
      {
        ...input,
        assumptions: {
          ...input.assumptions,
          scenarios: {
            ...input.assumptions.scenarios,
            base: {
              ...input.assumptions.scenarios.base,
              extra: true,
            },
          },
        },
      },
      { ...input, market: { ...input.market!, extra: true } },
      { ...input, market: { ...input.market!, priceCurrency: "EUR" } },
      { ...input, valuation: { ...input.valuation!, extra: true } },
      { ...input, annuals: { ...input.annuals!, extra: true } },
      {
        ...input,
        annuals: { ...input.annuals!, valueCurrency: "EUR" },
      },
      {
        ...input,
        market: {
          ...input.market!,
          bars: [{ ...input.market!.bars[0]!, extra: true }],
        },
      },
      {
        ...input,
        valuation: {
          ...input.valuation!,
          points: [{ ...input.valuation!.points[0]!, extra: true }],
        },
      },
      {
        ...input,
        annuals: {
          ...input.annuals!,
          years: [{ ...input.annuals!.years[0]!, extra: true }],
        },
      },
      replaceMarketCap(input, {
        extra: true,
        status: "known",
        unit: "USD",
        value: "900",
      }),
      replaceMarketCap(input, {
        reason: "withheld",
        status: "unknown",
        unit: "USD",
        value: null,
      }),
      replaceAnnualFcf(input, {
        reason: "withheld",
        status: "unknown",
        value: null,
      }),
      { ...input, market: new Date() },
      Object.create(null) as unknown,
    ];

    for (const candidate of invalidInputs) expectGenericTypeError(candidate);
  });

  it("rejects noncanonical and unbounded decimal lexemes everywhere", () => {
    const invalid = [
      "",
      "01",
      ".5",
      "1.",
      "+1",
      "1e2",
      "Infinity",
      "NaN",
      " 1",
      "1 ",
      `1${"0".repeat(64)}`,
    ];
    for (const value of invalid) {
      expectGenericTypeError(replaceRawClose(completeInput(), value));
      expectGenericTypeError(
        replaceMarketCap(completeInput(), knownMoney(value)),
      );
      expectGenericTypeError(
        replaceAnnualFcf(completeInput(), knownAnnual(value)),
      );
      expectGenericTypeError({
        ...completeInput(),
        assumptions: {
          ...completeInput().assumptions,
          waccPercent: value,
        },
      });
    }
    expectGenericTypeError({
      ...completeInput(),
      assumptions: {
        ...completeInput().assumptions,
        waccPercent: "5.00001",
      },
    });
  });

  it("accepts signed zero and trailing-zero syntax before semantic evaluation", () => {
    expect(
      unsafeCalculate(replaceRawClose(completeInput(), "-0.0")),
    ).toMatchObject({
      reason: "reference_price_nonpositive",
      status: "unavailable",
    });
    expect(
      calculatePersonalFcffDcfValuation({
        ...completeInput(),
        assumptions: {
          ...completeInput().assumptions,
          taxShieldRatePercent: "20.0000",
        },
      }),
    ).toMatchObject({ status: "available" });
  });

  it("rejects invalid dates, timestamps, chronology, and annual ordering", () => {
    const input = completeInput();
    for (const date of ["2025-02-29", "0000-01-01", "2025-1-01"] as const) {
      expectGenericTypeError({
        ...input,
        market: {
          ...input.market!,
          bars: [{ ...input.market!.bars[0]!, date }],
        },
      });
      expectGenericTypeError({
        ...input,
        annuals: {
          ...input.annuals!,
          years: [{ ...input.annuals!.years[0]!, statementDate: date }],
        },
      });
    }
    expectGenericTypeError({
      ...input,
      valuation: { ...input.valuation!, asOf: "2026-01-02" },
    });
    expectGenericTypeError({
      ...input,
      valuation: {
        ...input.valuation!,
        points: [{ ...input.valuation!.points[0]!, date: "2026-01-03" }],
      },
    });
    expectGenericTypeError({
      ...input,
      annuals: {
        ...input.annuals!,
        years: [{ ...input.annuals!.years[0]!, statementDate: "2026-01-03" }],
      },
    });
    expectGenericTypeError({
      ...input,
      market: {
        ...input.market!,
        bars: [
          { date: "2025-12-31", raw: { close: "90" } },
          { date: "2025-12-30", raw: { close: "80" } },
        ],
      },
    });
    expectGenericTypeError({
      ...input,
      annuals: {
        ...input.annuals!,
        years: [input.annuals!.years[0]!, input.annuals!.years[0]!],
      },
    });
  });

  it("rejects source arrays above their fixed limits before calculation", () => {
    const input = completeInput();
    const oversizedBars = Array.from(
      { length: PERSONAL_FCFF_DCF_MAXIMUM_MARKET_OBSERVATIONS + 1 },
      (_, index) => ({
        date: dateAt(index),
        raw: { close: "90" },
      }),
    );
    const oversizedYears = Array.from(
      { length: PERSONAL_FCFF_DCF_MAXIMUM_ANNUAL_PERIODS + 1 },
      (_, index) => ({
        fiscalYear: 2025 - index,
        reported: {
          free_cash_flow: knownAnnual("100"),
          interest_expense: knownAnnual("0"),
        },
        statementDate: `${String(2025 - index)}-12-31`,
      }),
    );

    expectGenericTypeError({
      ...input,
      market: { ...input.market!, bars: oversizedBars },
    });
    expectGenericTypeError({
      ...input,
      annuals: { ...input.annuals!, years: oversizedYears },
    });
  });

  it("converts hostile accessor failures to one generic TypeError", () => {
    const input = Object.defineProperty(
      {
        annuals: null,
        assumptions: PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
        market: null,
        selection: null,
      },
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

  it("deeply freezes output without freezing or retaining mutable inputs", () => {
    const input = completeInput();
    const bars = input.market!.bars as Array<{
      date: string;
      raw: { close: string };
    }>;
    const points = input.valuation!.points as Array<{
      date: string;
      enterpriseValue: ReturnType<typeof knownMoney>;
      marketCapitalization: ReturnType<typeof knownMoney>;
    }>;
    const years = input.annuals!.years as Array<{
      fiscalYear: number;
      reported: {
        free_cash_flow: ReturnType<typeof knownAnnual>;
        interest_expense: ReturnType<typeof knownAnnual>;
      };
      statementDate: string;
    }>;
    const result = calculatePersonalFcffDcfValuation(input);
    expect(result.status).toBe("available");
    expectDeepFrozen(result);
    expect(Object.isFrozen(bars)).toBe(false);
    expect(Object.isFrozen(points)).toBe(false);
    expect(Object.isFrozen(years)).toBe(false);

    bars[0]!.raw.close = "999";
    points[0]!.enterpriseValue.value = "999999";
    years[0]!.reported.free_cash_flow.value = "999999";
    expect(result).toMatchObject({
      reference: {
        enterpriseValueUsd: "1000.00",
        rawCloseUsd: "90.00",
        reportedFreeCashFlowUsd: "100.00",
      },
      status: "available",
    });
  });

  it("isolates Decimal precision and round-half-up behavior from global settings", () => {
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
      const result = calculatePersonalFcffDcfValuation(completeInput());
      expect(result).toMatchObject({
        reference: {
          impliedShareCount: "10.000000",
          startingUnleveredFcfProxyUsd: "100.00",
        },
        status: "available",
      });
    } finally {
      Decimal.set(prior);
    }
  });
});

function completeInput(): PersonalFcffDcfInput {
  const selected = identity();
  return {
    annuals: {
      asOf: "2026-01-02T00:00:00.000Z",
      security: identity(),
      valueCurrency: "USD",
      years: [
        {
          fiscalYear: 2025,
          reported: {
            free_cash_flow: knownAnnual("100"),
            interest_expense: knownAnnual("0"),
          },
          statementDate: "2025-12-31",
        },
      ],
    },
    assumptions: structuredClone(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
    market: {
      bars: [{ date: "2025-12-31", raw: { close: "90" } }],
      priceCurrency: "USD",
      range: "1y",
      security: identity(),
    },
    selection: selected,
    valuation: {
      asOf: "2026-01-02T00:00:00.000Z",
      points: [
        {
          date: "2025-12-31",
          enterpriseValue: knownMoney("1000"),
          marketCapitalization: knownMoney("900"),
        },
      ],
      range: "1y",
      security: identity(),
    },
  };
}

function identity() {
  return {
    country: "US" as const,
    exchangeMic: "XNYS",
    issuerName: "Example Corporation",
    listingId: "lst-example",
    securityName: "Example common stock",
    symbol: "EXM",
  };
}

function knownMoney(value: string) {
  return { status: "known" as const, unit: "USD" as const, value };
}

function knownAnnual(value: string) {
  return { status: "known" as const, value };
}

function replaceRawClose(input: PersonalFcffDcfInput, close: string): unknown {
  return {
    ...input,
    market: {
      ...input.market!,
      bars: [{ ...input.market!.bars[0]!, raw: { close } }],
    },
  };
}

function replaceMarketCap(
  input: PersonalFcffDcfInput,
  marketCapitalization: unknown,
): unknown {
  const point = input.valuation!.points[0]!;
  return {
    ...input,
    valuation: {
      ...input.valuation!,
      points: [{ ...point, marketCapitalization }],
    },
  };
}

function replaceAnnualFcf(
  input: PersonalFcffDcfInput,
  freeCashFlow: unknown,
): unknown {
  const year = input.annuals!.years[0]!;
  return {
    ...input,
    annuals: {
      ...input.annuals!,
      years: [
        {
          ...year,
          reported: {
            ...year.reported,
            free_cash_flow: freeCashFlow,
          },
        },
      ],
    },
  };
}

function expectGenericTypeError(input: unknown): void {
  try {
    unsafeCalculate(input);
    throw new Error("Expected calculation to reject malformed input.");
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe("");
  }
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

function dateAt(index: number): string {
  const date = new Date(Date.UTC(2010, 0, 1 + index));
  return date.toISOString().slice(0, 10);
}
