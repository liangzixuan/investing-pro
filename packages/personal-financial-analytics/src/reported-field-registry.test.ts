import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
  PERSONAL_FINANCIAL_REPORTED_FIELD_REGISTRY_VERSION,
} from "./index";

describe("reported financial field registry", () => {
  it("publishes the exact fixed, ordered 30-field contract", () => {
    expect(PERSONAL_FINANCIAL_REPORTED_FIELD_REGISTRY_VERSION).toBe("1.0.0");
    expect(PERSONAL_FINANCIAL_REPORTED_FIELDS).toHaveLength(30);
    expect(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map((field) => field.sourceCode),
    ).toEqual([
      "revenue",
      "costRev",
      "grossProfit",
      "rnd",
      "sga",
      "opex",
      "opinc",
      "intexp",
      "ebt",
      "taxExp",
      "netinc",
      "ebitda",
      "cashAndEq",
      "acctRec",
      "inventory",
      "assetsCurrent",
      "ppeq",
      "intangibles",
      "totalAssets",
      "liabilitiesCurrent",
      "debt",
      "totalLiabilities",
      "equity",
      "depamor",
      "sbcomp",
      "ncfo",
      "capex",
      "freeCashFlow",
      "ncfi",
      "ncff",
    ]);
    expect(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.filter(
        (field) => field.statement === "income_statement",
      ),
    ).toHaveLength(12);
    expect(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.filter(
        (field) => field.statement === "balance_sheet",
      ),
    ).toHaveLength(11);
    expect(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.filter(
        (field) => field.statement === "cash_flow",
      ),
    ).toHaveLength(7);
  });

  it("maps exactly nine reported fields into analytics inputs and preserves units", () => {
    expect(
      Object.fromEntries(
        PERSONAL_FINANCIAL_REPORTED_FIELDS.filter(
          (field) => field.analyticsInput !== null,
        ).map((field) => [field.sourceCode, field.analyticsInput]),
      ),
    ).toEqual({
      revenue: "revenue",
      grossProfit: "gross_profit",
      opinc: "operating_income",
      netinc: "net_income",
      cashAndEq: "cash",
      totalAssets: "assets",
      debt: "debt",
      ncfo: "operating_cash_flow",
      freeCashFlow: "free_cash_flow",
    });
    expect(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.every((field) => field.unit === "USD"),
    ).toBe(true);
    expect(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.every((field) =>
        /^[a-z][a-z0-9_]*$/.test(field.fieldKey),
      ),
    ).toBe(true);
  });

  it("is deeply frozen", () => {
    expect(Object.isFrozen(PERSONAL_FINANCIAL_REPORTED_FIELDS)).toBe(true);
    for (const field of PERSONAL_FINANCIAL_REPORTED_FIELDS)
      expect(Object.isFrozen(field)).toBe(true);
  });
});
