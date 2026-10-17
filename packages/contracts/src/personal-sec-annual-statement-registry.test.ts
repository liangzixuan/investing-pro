import { describe, expect, expectTypeOf, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementId,
  type PersonalSecAnnualStatementLineId,
  type PersonalSecAnnualStatementPeriodType,
  type PersonalSecAnnualStatementRegistryEntry,
  type PersonalSecAnnualStatementRevenueBasis,
} from "./personal-sec-annual-statement-registry";

function concept(name: PersonalSecAnnualStatementConcept) {
  const result = registry.find((entry) => entry.concept === name);
  if (!result) throw new Error(`Missing fixed concept ${name}`);
  return result;
}

describe("fixed annual statement registry", () => {
  it("groups 32 distinct exact concepts into 30 lines across all three statements", () => {
    expect(PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY_VERSION).toBe("1.0.0");
    expect(registry).toHaveLength(32);
    expect(new Set(registry.map((entry) => entry.concept)).size).toBe(32);
    expect(new Set(registry.map((entry) => entry.lineId)).size).toBe(30);
    expect(
      ["income_statement", "balance_sheet", "cash_flow"].map(
        (statement) =>
          registry.filter((entry) => entry.statement === statement).length,
      ),
    ).toEqual([13, 13, 6]);
    for (const entry of registry) {
      expect(entry.taxonomy).toBe("us-gaap");
      expect(entry.unit).toBe("USD");
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.qualification.length).toBeGreaterThan(0);
      expect(Object.hasOwn(entry, "fallback")).toBe(false);
      expect(Object.hasOwn(entry, "replacementConcept")).toBe(false);
    }
  });

  it("keeps three named revenue bases without treating the legacy basis as current", () => {
    const revenue = registry.filter(
      (entry) => entry.lineId === "income.revenue",
    );
    expect(revenue.map((entry) => entry.concept)).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]);
    expect(new Set(revenue.map((entry) => entry.revenueBasis)).size).toBe(3);
    expect(revenue.every((entry) => entry.revenueBasis !== null)).toBe(true);
    expect(
      registry.filter((entry) => entry.revenueBasis !== null),
    ).toHaveLength(3);
    expect(concept("SalesRevenueNet")).toMatchObject({
      taxonomyStatus: "legacy_deprecated",
      verifiedTaxonomyVersion: "2018-01-31",
      deprecatedDate: "2018-01-31",
      periodType: "duration",
    });
    expect(concept("SalesRevenueNet").label).toContain("legacy");
    expect(
      registry.filter((entry) => entry.taxonomyStatus === "legacy_deprecated"),
    ).toHaveLength(1);
    expect(
      registry.filter((entry) => entry.taxonomyStatus === "active_2026"),
    ).toHaveLength(31);
    expect(
      registry
        .filter((entry) => entry.taxonomyStatus === "active_2026")
        .every(
          (entry) =>
            entry.deprecatedDate === null &&
            entry.verifiedTaxonomyVersion === "2026",
        ),
    ).toBe(true);
  });

  it("separates duration flows from instant balances for every line", () => {
    const grouped = new Map<PersonalSecAnnualStatementLineId, Set<string>>();
    for (const entry of registry) {
      const periods = grouped.get(entry.lineId) ?? new Set<string>();
      periods.add(entry.periodType);
      grouped.set(entry.lineId, periods);
      expect(entry.periodType).toBe(
        entry.statement === "balance_sheet" ? "instant" : "duration",
      );
    }
    expect([...grouped.values()].every((periods) => periods.size === 1)).toBe(
      true,
    );
    expect(
      registry.filter((entry) => entry.periodType === "instant"),
    ).toHaveLength(13);
    expect(
      registry.filter((entry) => entry.periodType === "duration"),
    ).toHaveLength(19);
  });

  it("preserves the material taxonomy exclusions instead of broadening the line", () => {
    expect(concept("FiniteLivedIntangibleAssetsNet").qualification).toMatch(
      /goodwill.*software/u,
    );
    expect(concept("ShareBasedCompensation").label).toContain(
      "noncash expense",
    );
    expect(concept("OperatingExpenses").qualification).toMatch(
      /Includes SG&A.*Production costs/u,
    );
    for (const debt of [
      "LongTermDebtCurrent",
      "LongTermDebtNoncurrent",
    ] as const)
      expect(concept(debt).qualification).toMatch(/lease obligations/u);
    expect(concept("StockholdersEquity").qualification).toMatch(
      /temporary equity.*noncontrolling/u,
    );
    expect(concept("NetIncomeLoss").label).toContain("parent");
    expect(concept("IncomeTaxExpenseBenefit").label).toContain(
      "continuing operations",
    );
    expect(concept("AccountsReceivableNetCurrent").label).toContain("Current");
    expect(concept("InterestExpense").label).toContain(
      "operating and nonoperating",
    );
    for (const flow of [
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInInvestingActivities",
      "NetCashProvidedByUsedInFinancingActivities",
    ] as const)
      expect(concept(flow).label).toContain(
        "including discontinued operations",
      );
  });

  it("does not admit neighboring concepts or derived values as aliases", () => {
    const concepts: ReadonlySet<string> = new Set(
      registry.map((entry) => entry.concept),
    );
    for (const neighboring of [
      "SalesRevenueNetMember",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "CostOfGoodsAndServicesSold",
      "OperatingCostsAndExpenses",
      "IntangibleAssetsNetExcludingGoodwill",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
      "ProfitLoss",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ])
      expect(concepts.has(neighboring)).toBe(false);
    expect(
      registry.some((entry) =>
        /ebitda|free_cash_flow|total_debt/u.test(entry.lineId),
      ),
    ).toBe(false);
  });

  it("freezes the registry and every entry at runtime", () => {
    expect(Object.isFrozen(registry)).toBe(true);
    expect(registry.every(Object.isFrozen)).toBe(true);
    expect(Reflect.set(registry, "0", registry[1])).toBe(false);
    expect(Reflect.set(concept("Assets"), "concept", "Liabilities")).toBe(
      false,
    );
    expect(concept("Assets").concept).toBe("Assets");
  });

  it("derives closed literal types from the fixed data", () => {
    expectTypeOf<
      PersonalSecAnnualStatementRegistryEntry["unit"]
    >().toEqualTypeOf<"USD">();
    expectTypeOf<
      PersonalSecAnnualStatementRegistryEntry["taxonomy"]
    >().toEqualTypeOf<"us-gaap">();
    expectTypeOf<PersonalSecAnnualStatementId>().toEqualTypeOf<
      "income_statement" | "balance_sheet" | "cash_flow"
    >();
    expectTypeOf<PersonalSecAnnualStatementPeriodType>().toEqualTypeOf<
      "duration" | "instant"
    >();
    expectTypeOf<PersonalSecAnnualStatementRevenueBasis>().toEqualTypeOf<
      | "customer_contract_excluding_assessed_tax"
      | "reported_revenues"
      | "legacy_net_sales"
    >();
    expectTypeOf<
      Extract<
        PersonalSecAnnualStatementRegistryEntry,
        { concept: "Assets" }
      >["lineId"]
    >().toEqualTypeOf<"balance.total_assets">();
    expectTypeOf<
      Extract<
        PersonalSecAnnualStatementRegistryEntry,
        { concept: "SalesRevenueNet" }
      >["taxonomyStatus"]
    >().toEqualTypeOf<"legacy_deprecated">();
  });
});
