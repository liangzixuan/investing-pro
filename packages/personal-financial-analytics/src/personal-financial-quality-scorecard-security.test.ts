import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_MAX_SOURCE_REF_CODE_POINTS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_QUARANTINE_REASONS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_UNAVAILABLE_REASONS,
  buildPersonalFinancialQualityScorecard,
  type PersonalFinancialQualityScorecardAnnualPeriodInput,
  type PersonalFinancialQualityScorecardFactInput,
  type PersonalFinancialQualityScorecardFactKey,
  type PersonalFinancialQualityScorecardInput,
  type PersonalFinancialQualityScorecardReadyResult,
} from "./index";

describe("personal financial quality scorecard safety boundaries", () => {
  it.each([
    [
      "invalid as-of",
      { ...validInput(), asOf: "2026-02-30T00:00:00Z" },
      "invalid_as_of",
    ],
    [
      "noncanonical as-of",
      { ...validInput(), asOf: "2026-06-15T12:00:00.00Z" },
      "invalid_as_of",
    ],
    ["invalid year", inputWithPeriods([period(1899)]), "invalid_fiscal_year"],
    [
      "invalid statement date",
      inputWithPeriods([{ ...period(2025), statementDate: "2026-02-30" }]),
      "invalid_statement_date",
    ],
    [
      "future statement",
      {
        asOf: "2026-01-01T00:00:00Z",
        periods: [{ ...period(2025), statementDate: "2026-01-02" }],
      },
      "statement_date_after_as_of",
    ],
    [
      "duplicate year",
      inputWithPeriods([period(2025), period(2025)]),
      "duplicate_fiscal_year",
    ],
    [
      "ascending years",
      inputWithPeriods([period(2024), period(2025)]),
      "periods_not_strictly_descending",
    ],
    [
      "too many years",
      inputWithPeriods(
        Array.from({ length: 11 }, (_, index) => period(2025 - index)),
      ),
      "too_many_periods",
    ],
  ] as const)("quarantines %s", (_name, input, reason) => {
    const result = buildPersonalFinancialQualityScorecard(input);
    expect(result.status).toBe("quarantined");
    if (result.status !== "quarantined") throw new Error("expected quarantine");
    expect(result.issues.map((issue) => issue.reason)).toContain(reason);
    expect("groups" in result).toBe(false);
    expect("counts" in result).toBe(false);
  });

  it("never echoes a noncanonical as-of value from a quarantined carrier", () => {
    const result = buildPersonalFinancialQualityScorecard({
      ...validInput(),
      asOf: "arbitrary attacker-controlled label",
    });
    expect(result.status).toBe("quarantined");
    if (result.status !== "quarantined") {
      throw new Error("expected quarantine");
    }
    expect(result.asOf).toBeNull();
    expect(result.issues).toContainEqual({
      index: null,
      reason: "invalid_as_of",
    });
  });

  it("rejects an over-limit periods array before enumerating its entries", () => {
    let ownKeyCalls = 0;
    const periods = new Proxy(new Array(11), {
      ownKeys() {
        ownKeyCalls += 1;
        throw new Error("period enumeration must not occur");
      },
    });
    const result = buildPersonalFinancialQualityScorecard({
      asOf: "2026-06-15T12:00:00Z",
      periods,
    });

    expect(result.status).toBe("quarantined");
    if (result.status !== "quarantined") {
      throw new Error("expected quarantine");
    }
    expect(result.issues).toEqual([
      { index: null, reason: "too_many_periods" },
    ]);
    expect(ownKeyCalls).toBe(0);
  });

  it("rejects over-limit facts before dense traversal or iteration", () => {
    let ownKeyCalls = 0;
    const facts = new Proxy(new Array(65), {
      ownKeys() {
        ownKeyCalls += 1;
        throw new Error("fact enumeration must not occur");
      },
    });
    const result = buildPersonalFinancialQualityScorecard({
      asOf: "2026-06-15T12:00:00Z",
      periods: [
        {
          facts,
          fiscalYear: 2025,
          statementDate: "2026-02-15",
        },
      ],
    });

    expect(result.status).toBe("quarantined");
    if (result.status !== "quarantined") {
      throw new Error("expected quarantine");
    }
    expect(result.issues).toEqual([{ index: 0, reason: "invalid_shape" }]);
    expect(ownKeyCalls).toBe(0);
  });

  it.each([
    ["primitive root", "hostile"],
    ["array root", []],
    ["extra root key", { ...validInput(), extra: true }],
    ["missing root key", { periods: validInput().periods }],
    ["non-array periods", { ...validInput(), periods: {} }],
    ["sparse periods", { ...validInput(), periods: new Array(1) }],
    [
      "decorated periods",
      {
        ...validInput(),
        periods: Object.assign([period(2025)], { extra: true }),
      },
    ],
    [
      "extra period key",
      inputWithPeriods([
        {
          ...period(2025),
          extra: true,
        } as unknown as PersonalFinancialQualityScorecardAnnualPeriodInput,
      ]),
    ],
    [
      "extra fact key",
      inputWithPeriods([
        {
          ...period(2025),
          facts: [
            {
              ...period(2025).facts[0]!,
              extra: true,
            } as unknown as PersonalFinancialQualityScorecardFactInput,
          ],
        },
      ]),
    ],
    [
      "unknown fact identity",
      inputWithPeriods([
        {
          ...period(2025),
          facts: [
            {
              key: "__proto__" as PersonalFinancialQualityScorecardFactKey,
              sourceRef: "hostile",
              unit: "USD",
              value: "1",
            },
          ],
        },
      ]),
    ],
    [
      "symbol fact key",
      inputWithPeriods([
        {
          ...period(2025),
          facts: [
            Object.assign({}, period(2025).facts[0], {
              [Symbol("extra")]: true,
            }),
          ],
        },
      ]),
    ],
  ] as const)("rejects the %s carrier as invalid_shape", (_name, hostile) => {
    const result = buildPersonalFinancialQualityScorecard(hostile);
    expect(result.status).toBe("quarantined");
    if (result.status !== "quarantined") throw new Error("expected quarantine");
    expect(result.issues.map((issue) => issue.reason)).toContain(
      "invalid_shape",
    );
  });

  it("rejects inherited and accessor-backed records without invoking getters", () => {
    let reads = 0;
    const accessor = {
      periods: validInput().periods,
    } as Record<string, unknown>;
    Object.defineProperty(accessor, "asOf", {
      enumerable: true,
      get() {
        reads += 1;
        return "2026-06-15T12:00:00Z";
      },
    });
    const inherited = Object.create(validInput()) as unknown;

    for (const hostile of [accessor, inherited]) {
      const result = buildPersonalFinancialQualityScorecard(hostile);
      expect(result.status).toBe("quarantined");
      if (result.status !== "quarantined")
        throw new Error("expected quarantine");
      expect(result.issues).toContainEqual({
        index: null,
        reason: "invalid_shape",
      });
    }
    expect(reads).toBe(0);
  });

  it("contains throwing proxy traps as a frozen quarantine result", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("trap");
        },
      },
    );
    const result = buildPersonalFinancialQualityScorecard(hostile);
    expect(result).toMatchObject({
      asOf: null,
      issues: [{ index: null, reason: "invalid_shape" }],
      status: "quarantined",
    });
    expectDeepFrozen(result);
  });

  it.each([
    ["hex", { value: "0xff" }, "invalid_decimal"],
    ["binary", { value: "0b10" }, "invalid_decimal"],
    ["separator", { value: "1_000" }, "invalid_decimal"],
    ["leading dot", { value: ".5" }, "invalid_decimal"],
    ["leading plus", { value: "+1" }, "invalid_decimal"],
    ["exponent", { value: "1e3" }, "invalid_decimal"],
    ["oversized", { value: "1".repeat(65) }, "invalid_decimal"],
    ["wrong unit", { unit: "ratio" }, "invalid_unit"],
    ["empty ref", { sourceRef: "" }, "invalid_source_ref"],
    ["padded ref", { sourceRef: " ref " }, "invalid_source_ref"],
    ["control ref", { sourceRef: "ref\u0000tail" }, "invalid_source_ref"],
    [
      "bidirectional override ref",
      { sourceRef: "ref\u202etail" },
      "invalid_source_ref",
    ],
    ["zero-width ref", { sourceRef: "ref\u200btail" }, "invalid_source_ref"],
    [
      "lone-surrogate ref",
      { sourceRef: "ref\ud800tail" },
      "invalid_source_ref",
    ],
    [
      "oversized ref",
      {
        sourceRef: "r".repeat(
          PERSONAL_FINANCIAL_QUALITY_SCORECARD_MAX_SOURCE_REF_CODE_POINTS + 1,
        ),
      },
      "invalid_source_ref",
    ],
  ] as const)(
    "makes a %s operand locally unavailable",
    (_name, mutation, reason) => {
      const source = period(2025);
      const facts = source.facts.map((candidate) =>
        candidate.key === "shareholders_equity"
          ? { ...candidate, ...mutation }
          : candidate,
      ) as unknown as PersonalFinancialQualityScorecardFactInput[];
      const result = ready(
        buildPersonalFinancialQualityScorecard(
          inputWithPeriods([{ ...source, facts }, period(2024)]),
        ),
      );
      const equity = result.groups
        .flatMap((group) => group.checks)
        .find((item) => item.checkId === "positive_shareholders_equity");
      expect(equity).toMatchObject({ reason, status: "unavailable" });
      expect(result.counts).toMatchObject({ evaluated: 11, unavailable: 1 });
    },
  );

  it("retains precision for every accepted 64-character fixed decimal", () => {
    const maximum = "9".repeat(64);
    const minimum = `0.${"0".repeat(61)}1`;
    expect(maximum).toHaveLength(64);
    expect(minimum).toHaveLength(64);
    const result = ready(
      buildPersonalFinancialQualityScorecard(
        inputWithPeriods([
          period(2025, { gross_profit: maximum, revenue: minimum }),
          period(2024, { gross_profit: maximum, revenue: minimum }),
        ]),
      ),
    );
    const grossMargin = result.groups
      .flatMap((group) => group.checks)
      .find((item) => item.checkId === "gross_margin_not_declining");
    expect(grossMargin?.currentObservation?.value).toBe(
      `${"9".repeat(64)}${"0".repeat(62)}`,
    );
    expect(grossMargin?.status).toBe("met");
  });

  it("does not mutate caller input or Decimal's global configuration", () => {
    const priorPrecision = Decimal.precision;
    Decimal.set({ precision: 37 });
    try {
      const source = deepFreeze(validInput());
      const before = JSON.stringify(source);
      const result = buildPersonalFinancialQualityScorecard(source);
      expect(result.status).toBe("ready");
      expect(JSON.stringify(source)).toBe(before);
      expect(Decimal.precision).toBe(37);
      expect(Object.prototype).not.toHaveProperty("polluted");
    } finally {
      Decimal.set({ precision: priorPrecision });
    }
  });

  it("deep-freezes ready and quarantined results and every exported contract", () => {
    const readyResult = buildPersonalFinancialQualityScorecard(validInput());
    const quarantined = buildPersonalFinancialQualityScorecard({
      ...validInput(),
      extra: true,
    });
    for (const value of [
      readyResult,
      quarantined,
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS,
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS,
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS,
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS,
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_QUARANTINE_REASONS,
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_UNAVAILABLE_REASONS,
    ]) {
      expectDeepFrozen(value);
    }
  });
});

function validInput(): PersonalFinancialQualityScorecardInput {
  return inputWithPeriods([period(2025), period(2024)]);
}

function inputWithPeriods(
  periods: readonly PersonalFinancialQualityScorecardAnnualPeriodInput[],
): PersonalFinancialQualityScorecardInput {
  return { asOf: "2026-06-15T12:00:00Z", periods };
}

function period(
  fiscalYear: number,
  overrides: Partial<
    Record<PersonalFinancialQualityScorecardFactKey, string>
  > = {},
): PersonalFinancialQualityScorecardAnnualPeriodInput {
  const values: Record<PersonalFinancialQualityScorecardFactKey, string> = {
    assets: fiscalYear === 2025 ? "1000" : "900",
    current_assets: fiscalYear === 2025 ? "300" : "240",
    current_liabilities: "200",
    debt: fiscalYear === 2025 ? "200" : "225",
    free_cash_flow: fiscalYear === 2025 ? "120" : "100",
    gross_profit: fiscalYear === 2025 ? "500" : "450",
    net_income: fiscalYear === 2025 ? "100" : "80",
    operating_cash_flow: fiscalYear === 2025 ? "150" : "130",
    operating_income: fiscalYear === 2025 ? "200" : "171",
    revenue: fiscalYear === 2025 ? "1000" : "900",
    shareholders_equity: fiscalYear === 2025 ? "600" : "550",
    ...overrides,
  };
  return {
    facts: Object.entries(values).map(([key, value]) => ({
      key: key as PersonalFinancialQualityScorecardFactKey,
      sourceRef: `filing-${fiscalYear}-${key}`,
      unit: "USD",
      value,
    })) satisfies PersonalFinancialQualityScorecardFactInput[],
    fiscalYear,
    statementDate: `${fiscalYear + 1}-02-15`,
  };
}

function ready(
  result: ReturnType<typeof buildPersonalFinancialQualityScorecard>,
): PersonalFinancialQualityScorecardReadyResult {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("expected ready result");
  return result;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
