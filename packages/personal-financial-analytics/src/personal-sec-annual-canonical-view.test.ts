import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";
import { derivePersonalSecAnnualCanonicalView as derive } from "./personal-sec-annual-canonical-view";
import {
  fixture,
  observation,
  setScan,
} from "./personal-sec-annual-statements.fixture";

const amounts: Readonly<Record<string, string>> = {
  RevenueFromContractWithCustomerExcludingAssessedTax: "2000",
  Revenues: "1000",
  SalesRevenueNet: "4000",
  NetIncomeLoss: "-100",
  OperatingIncomeLoss: "200",
  NetCashProvidedByUsedInOperatingActivities: "300",
  PaymentsToAcquirePropertyPlantAndEquipment: "100",
  AssetsCurrent: "500",
  LiabilitiesCurrent: "250",
  Assets: "1000",
  Liabilities: "1200",
  StockholdersEquity: "-200",
};
function rows(): PersonalSecAnnualStatementObservationDto[] {
  return registry.flatMap((entry) =>
    [2025, 2024, 2023].map((year, index) =>
      observation(entry.concept, index, {
        ...(entry.periodType === "duration"
          ? { startDate: `${year - 1}-10-01` }
          : {}),
        endDate: `${year}-09-30`,
        filingFocusYear: year,
        value: amounts[entry.concept] ?? "12.125",
      }),
    ),
  );
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("one canonical Annual financial view", () => {
  it("uses the same exact graph for three statements and all existing calculations", () => {
    const canonical = freeze(fixture(rows()));
    const before = JSON.stringify(canonical);
    const view = derive(canonical);
    expect(view.canonical).toBe(canonical);
    const cells = view.statements.statements.flatMap((statement) =>
      statement.rows.flatMap((row) => row.cells),
    );
    expect(cells).toHaveLength(96);
    expect(cells.every((cell) => cell.status === "available")).toBe(true);
    expect(
      view.income.resolution.bases.map(
        (basis) => basis.pairs[0]!.netMarginPercent,
      ),
    ).toEqual(["-5", "-10", "-2.5"]);
    expect(
      view.cashGeneration.resolution.operatingCashFlowLessPpePurchases,
    ).toMatchObject({
      status: "available",
      value: "200",
      currentUseEligible: true,
    });
    expect(view.liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "250",
    });
    expect(view.operatingResults.resolution.operatingIncome).toMatchObject({
      status: "available",
      value: "200",
    });
    expect(view.balanceSheet.resolution.shareholdersEquity).toMatchObject({
      status: "available",
      value: "-200",
    });
    expect(view.cashMargins.map((basis) => basis.margin)).toMatchObject([
      { status: "available", value: "10.00" },
      { status: "available", value: "20.00" },
      { status: "available", value: "5.00" },
    ]);
    expect(view.financialReview.map((row) => row.sign)).toEqual([
      "positive",
      "positive",
      "positive",
      "positive",
      "negative",
    ]);
    expect(view.cashGeneration.history).toMatchObject({
      status: "available",
      periods: [
        { endDate: "2025-09-30" },
        { endDate: "2024-09-30" },
        { endDate: "2023-09-30" },
      ],
    });
    expect(view.income.bases[1]!.comparison).toMatchObject({
      status: "available",
      revenue: { difference: "0" },
    });
    expect(JSON.stringify(canonical)).toBe(before);
    const ids = new Set(canonical.facts.observations.map((row) => row.id));
    expect(
      cells.every((cell) => cell.observationIds.every((id) => ids.has(id))),
    ).toBe(true);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.income.bases)).toBe(true);
    expect(
      Object.isFrozen(view.cashMargins[0]!.operands.revenue.observationIds),
    ).toBe(true);
  });

  it("withholds a failed income summary without hiding operating, cash, balances or their note facts", () => {
    const canonical = fixture(
      rows().filter((row) => row.concept !== "NetIncomeLoss"),
    );
    setScan(canonical, "NetIncomeLoss", {
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    const view = derive(freeze(canonical));
    expect(view.income.reason).toBe("invalid_response");
    expect(view.income.resolution.pairs).toEqual([]);
    expect(
      view.cashMargins.every((basis) => basis.margin.status === "unavailable"),
    ).toBe(true);
    expect(
      view.financialReview.every((row) => row.value.status === "available"),
    ).toBe(true);
    const netIncome = view.statements.statements[0]!.rows.find(
      (row) => row.concept === "NetIncomeLoss",
    )!;
    expect(netIncome.cells[0]).toMatchObject({
      status: "unavailable",
      reason: "invalid_response",
    });
    expect(view.balanceSheet.resolution.totalAssets).toMatchObject({
      status: "available",
      value: "1000",
    });
  });

  it("keeps revenue margins when net income is absent rather than failed", () => {
    const view = derive(
      freeze(fixture(rows().filter((row) => row.concept !== "NetIncomeLoss"))),
    );
    expect(view.income.resolution.currentTargetEligible).toBe(false);
    expect(view.cashMargins[1]!.margin).toMatchObject({
      status: "available",
      value: "20.00",
    });
    expect(
      view.operatingResults.resolution.margins[1]!.operatingMargin,
    ).toMatchObject({ status: "available", value: "20" });
  });

  it("does not treat noncontiguous statement dates as financial history", () => {
    const view = derive(
      freeze(fixture(rows().filter((row) => row.endDate !== "2024-09-30"))),
    );
    expect(
      view.statements.statements[0]!.columns.map((column) => column.endDate),
    ).toEqual(["2025-09-30", "2023-09-30"]);
    expect(view.cashGeneration.history).toMatchObject({
      status: "available",
      periods: [{ endDate: "2025-09-30" }],
    });
    if (view.cashGeneration.history.status === "available")
      expect(view.cashGeneration.history.periods).toHaveLength(1);
    expect(view.income.bases[1]!.comparison.status).toBe("unavailable");
    if (view.operatingResults.bases[1]!.history.status === "available")
      expect(view.operatingResults.bases[1]!.history.periods).toHaveLength(1);
  });

  it("requires frozen admitted source ownership without freezing caller data", () => {
    const canonical = fixture(rows());
    const before = JSON.stringify(canonical);
    expect(() => derive(canonical)).toThrow("owned frozen evidence");
    expect(Object.isFrozen(canonical)).toBe(false);
    Object.freeze(canonical);
    expect(() => derive(canonical)).toThrow("owned frozen evidence");
    expect(Object.isFrozen(canonical.facts)).toBe(false);
    expect(JSON.stringify(canonical)).toBe(before);
  });

  it("rejects a protocol-shaped getter without invoking it", () => {
    const canonical = fixture(rows());
    const getter = vi.fn(() => canonical.facts);
    Object.defineProperty(canonical, "facts", { get: getter });
    expect(() => derive(canonical)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});
