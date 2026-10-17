import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS,
  serializePersonalSecAnnualStatementObservation as serialize,
  type PersonalSecAnnualStatementObservationDto,
} from "./personal-sec-annual-statement-facts";
import { PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY } from "./personal-sec-annual-statement-registry";

type Source = Omit<
  PersonalSecAnnualStatementObservationDto,
  "id" | "sourceLocator" | "filing"
>;
const source: Source = {
  taxonomy: "us-gaap",
  concept: "Revenues",
  unit: "USD",
  value: "-9007199254740993.125",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  durationDays: 365,
  periodBasis: "unresolved",
  filingFocusYear: 2025,
  filingFocusPeriod: "FY",
  frame: "CY2025",
  accessionNumber: "0000000001-26-000001",
  form: "10-K",
  filedDate: "2026-02-01",
};

describe("canonical statement source identity", () => {
  it("keeps exact signed decimals and distinguishes the reported source fields", () => {
    const original = serialize(source);
    expect(original).toContain('"-9007199254740993.125"');
    const alternatives: readonly Partial<Source>[] = [
      { concept: "SalesRevenueNet" },
      { value: "9007199254740993.125" },
      { startDate: "2025-01-02", durationDays: 364 },
      { endDate: "2025-12-30", durationDays: 364 },
      { filingFocusYear: 2024 },
      { filingFocusPeriod: "Q4" },
      { frame: null },
      { accessionNumber: "0000000001-26-000002" },
      { form: "10-K/A" },
      { filedDate: "2026-02-02" },
    ];
    for (const change of alternatives)
      expect(serialize({ ...source, ...change })).not.toBe(original);
  });

  it("does not change source identity with property order, pointer or filing join", () => {
    const reversed = Object.fromEntries(
      Object.entries(source).reverse(),
    ) as Source;
    expect(serialize(reversed)).toBe(serialize(source));
    const located = {
      ...source,
      id: `sec-fact:${"0".repeat(64)}`,
      sourceLocator: "/facts/us-gaap/Revenues/units/USD/0",
      filing: { status: "not_in_current_submissions" },
    };
    const relocated = {
      ...located,
      id: `sec-fact:${"1".repeat(64)}`,
      sourceLocator: "/facts/us-gaap/Revenues/units/USD/99",
      filing: { status: "metadata_conflict" },
    };
    expect(serialize(located)).toBe(serialize(relocated));
    expect(serialize(located)).toBe(serialize(source));
  });

  it("bounds the complete fixed graph independently of decimal or source limits", () => {
    expect(PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.concepts).toBe(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.length,
    );
    expect(PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.observations).toBe(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.length *
        PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.observationsPerConcept,
    );
    expect(PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.decimalCharacters).toBe(
      64,
    );
    expect(Object.isFrozen(PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS)).toBe(
      true,
    );
  });
});
