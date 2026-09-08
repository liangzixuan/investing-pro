import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_ANALYTICS_FORMULAS,
  PERSONAL_FINANCIAL_ANALYTICS_QUARANTINE_REASONS,
  buildPersonalFinancialAnalytics,
  type PersonalFinancialAnalyticsInput,
} from "./index";

describe("personal financial analytics safety boundaries", () => {
  it.each([
    [
      "invalid as-of",
      bad({ asOf: "2026-02-30T00:00:00.000Z" }),
      "invalid_as_of",
    ],
    ["invalid year", bad({ periods: [period(1899)] }), "invalid_fiscal_year"],
    [
      "invalid statement date",
      bad({
        periods: [{ ...period(2025), statementDate: "2026-02-30" }],
      }),
      "invalid_statement_date",
    ],
    [
      "duplicate year",
      bad({ periods: [period(2025), period(2025)] }),
      "duplicate_fiscal_year",
    ],
    [
      "ascending years",
      bad({ periods: [period(2024), period(2025)] }),
      "periods_not_strictly_descending",
    ],
    [
      "too many years",
      bad({
        periods: Array.from({ length: 11 }, (_, index) => period(2025 - index)),
      }),
      "too_many_periods",
    ],
  ] as const)(
    "quarantines %s without producing partial analytics",
    (_name, input, reason) => {
      const result = buildPersonalFinancialAnalytics(input);
      expect(result.status).toBe("quarantined");
      if (result.status !== "quarantined")
        throw new Error("expected quarantine");
      expect(result.issues.map((issue) => issue.reason)).toContain(reason);
      expect("periods" in result).toBe(false);
      expect("growth" in result).toBe(false);
    },
  );

  it("deep-freezes ready and quarantined results plus exported contracts", () => {
    const ready = buildPersonalFinancialAnalytics(
      bad({ periods: [period(2025)] }),
    );
    expectDeepFrozen(ready);
    const quarantined = buildPersonalFinancialAnalytics(
      bad({ periods: [period(2025), period(2025)] }),
    );
    expectDeepFrozen(quarantined);
    expectDeepFrozen(PERSONAL_FINANCIAL_ANALYTICS_FORMULAS);
    expectDeepFrozen(PERSONAL_FINANCIAL_ANALYTICS_QUARANTINE_REASONS);
  });

  it("does not mutate frozen input and ignores unrecognized fact keys", () => {
    const source = period(2025);
    const hostileFact = {
      key: "__proto__",
      sourceRef: "hostile",
      unit: "USD",
      value: "999",
    };
    const input = deepFreeze(
      bad({
        periods: [
          {
            ...source,
            facts: [
              ...source.facts,
              hostileFact,
            ] as unknown as PersonalFinancialAnalyticsInput["periods"][number]["facts"],
          },
        ],
      }),
    );
    const before = JSON.stringify(input);
    const result = buildPersonalFinancialAnalytics(input);
    expect(result.status).toBe("ready");
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.prototype).not.toHaveProperty("hostile");
  });

  it.each(["0xff", "0b101", "1_000", ".5", "+12", "1e1000", "1".repeat(65)])(
    "rejects noncanonical or oversized decimal input %s",
    (value) => {
      const source = period(2025);
      const result = buildPersonalFinancialAnalytics(
        bad({
          periods: [
            {
              ...source,
              facts: source.facts.map((fact) =>
                fact.key === "revenue" ? { ...fact, value } : fact,
              ),
            },
          ],
        }),
      );

      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("expected ready result");
      expect(result.periods[0]?.metrics.grossMargin).toMatchObject({
        reason: "invalid_decimal",
        status: "unavailable",
      });
      expect(result.periods[0]?.statements.income.lineItems[0]).toMatchObject({
        reason: "invalid_decimal",
        status: "unavailable",
      });
    },
  );
});

function period(fiscalYear: number) {
  return {
    facts: [
      {
        key: "revenue" as const,
        sourceRef: `filing-${fiscalYear}-revenue`,
        unit: "USD" as const,
        value: "100",
      },
      {
        key: "gross_profit" as const,
        sourceRef: `filing-${fiscalYear}-gross`,
        unit: "USD" as const,
        value: "40",
      },
    ],
    fiscalYear,
    statementDate: `${fiscalYear + 1}-02-15`,
  };
}
function bad(
  overrides: Partial<PersonalFinancialAnalyticsInput>,
): PersonalFinancialAnalyticsInput {
  return { asOf: "2026-02-15T12:00:00.000Z", periods: [], ...overrides };
}
function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
