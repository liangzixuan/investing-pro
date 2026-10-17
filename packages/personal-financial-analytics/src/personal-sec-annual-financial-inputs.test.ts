import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualStatementScanDto,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualFinancialInputs as derive } from "./personal-sec-annual-financial-inputs";
import {
  fixture,
  observation,
  setScan,
  type Fixture,
} from "./personal-sec-annual-statements.fixture";
import { resolvePersonalSecAnnualStatements } from "./personal-sec-annual-statements";

const revenueA = "RevenueFromContractWithCustomerExcludingAssessedTax";
const cash = "NetCashProvidedByUsedInOperatingActivities";
function completeScan({
  candidateRows,
  invalidRows = 0,
  duplicateRows = 0,
  uniqueObservations = candidateRows - invalidRows - duplicateRows,
  selected = 0,
  returned = selected > 100 ? 0 : selected,
}: {
  candidateRows: number;
  invalidRows?: number;
  duplicateRows?: number;
  uniqueObservations?: number;
  selected?: number;
  returned?: number;
}): PersonalSecAnnualStatementScanDto {
  return {
    status: "available",
    absence: candidateRows === 0 ? "concept_missing" : null,
    coverage: {
      full: {
        candidateRows,
        inspectedRows: candidateRows,
        invalidRows,
        duplicateRows,
        uniqueObservations,
      },
      selected,
      otherAccessions: uniqueObservations - selected,
      returned,
      omittedSelected: selected - returned,
    },
  };
}
function sourceRows() {
  return [
    observation(revenueA),
    observation("Revenues"),
    observation("SalesRevenueNet"),
    observation("NetIncomeLoss", 0, { value: "-9007199254740993.125" }),
    observation(cash, 0, { value: "-7.125" }),
    observation("PaymentsToAcquirePropertyPlantAndEquipment"),
    observation("AssetsCurrent"),
    observation("LiabilitiesCurrent"),
    observation("OperatingIncomeLoss"),
    observation("Assets"),
    observation("Liabilities"),
    observation("StockholdersEquity", 0, { value: "-8.25" }),
  ];
}

describe("canonical financial source inputs", () => {
  it("retains canonical v6 metadata, scans and exact original observation objects in every section", () => {
    const canonical = fixture(sourceRows());
    const before = structuredClone(canonical);
    const result = derive(canonical);
    expect(result.canonical).toBe(canonical);
    expect(result.canonical.generation).toBe(canonical.generation);
    expect(result.canonical.target).toBe(canonical.target);
    expect(result.canonical.facts).toBe(canonical.facts);
    expect(result.canonical.generation.definitionVersion).toBe("6.0.0");
    expect(result.contextReason).toBeNull();
    expect(result.income.reason).toBeNull();
    const metrics = [
      result.cashGeneration.operatingCashFlow,
      result.cashGeneration.ppePurchases,
      result.liquidity.currentAssets,
      result.liquidity.currentLiabilities,
      result.operatingResults.operatingIncome,
      result.balanceSheet.totalAssets,
      result.balanceSheet.totalLiabilities,
      result.balanceSheet.shareholdersEquity,
    ];
    for (const metric of metrics) {
      const row = metric.observations[0]!;
      expect(canonical.facts.observations).toContain(row);
      expect(metric.scan).toBe(
        canonical.facts.scans.find((item) => item.concept === row.concept)!
          .scan,
      );
      expect(Object.hasOwn(row, "metric")).toBe(false);
      expect(Object.isFrozen(metric)).toBe(true);
      expect(Object.isFrozen(metric.observations)).toBe(true);
    }
    for (const row of result.income.observations)
      expect(canonical.facts.observations).toContain(row);
    for (const scan of result.income.scans)
      expect(canonical.facts.scans).toContain(scan);
    expect(result.income.observations).toHaveLength(4);
    expect(result.income.summaryReturned).toEqual({
      observations: 4,
      revenue: 3,
      netIncome: 1,
    });
    expect(result.cashGeneration.operatingCashFlow.observations[0]!.value).toBe(
      "-7.125",
    );
    expect(result.balanceSheet.shareholdersEquity.observations[0]!.value).toBe(
      "-8.25",
    );
    expect(canonical).toEqual(before);
    expect(Object.isFrozen(canonical)).toBe(false);
    expect(Object.isFrozen(canonical.facts.observations[0])).toBe(false);
  });
  it("sums all original source counts exactly, including other accessions and invalid/duplicate rows", () => {
    const input = fixture([
      observation(revenueA, 0),
      observation(revenueA, 1),
      observation("Revenues"),
      observation("SalesRevenueNet"),
      observation("NetIncomeLoss", 0),
      observation("NetIncomeLoss", 1),
    ]);
    setScan(
      input,
      revenueA,
      completeScan({
        candidateRows: 8,
        invalidRows: 1,
        duplicateRows: 2,
        selected: 2,
      }),
    );
    setScan(
      input,
      "Revenues",
      completeScan({ candidateRows: 3, duplicateRows: 1, selected: 1 }),
    );
    setScan(
      input,
      "NetIncomeLoss",
      completeScan({ candidateRows: 4, duplicateRows: 1, selected: 2 }),
    );
    const result = derive(input);
    expect(result.income.coverage).toEqual({
      full: {
        candidateRows: 16,
        inspectedRows: 16,
        invalidRows: 1,
        duplicateRows: 4,
        uniqueObservations: 11,
        observations: 11,
        revenue: 8,
        netIncome: 3,
        conceptsWithoutUsd: [],
      },
      selected: { observations: 6, revenue: 4, netIncome: 2 },
      otherAccessions: { observations: 5, revenue: 4, netIncome: 1 },
      returned: { observations: 6, revenue: 4, netIncome: 2 },
      omittedSelected: { observations: 0, revenue: 0, netIncome: 0 },
    });
    expect(result.income.scanStatus).toBe("available");
    expect(result.income.reason).toBe("invalid_source_rows");
    expect(result.income.observations).toEqual([]);
    expect(result.income.summaryReturned).toEqual({
      observations: 0,
      revenue: 0,
      netIncome: 0,
    });
    expect(result.canonical.facts.observations).toHaveLength(6);
  });
  it("uses only the four income concepts, never other statement scans or observations", () => {
    const input = fixture(sourceRows());
    setScan(input, "GrossProfit", {
      status: "candidate_limit",
      absence: null,
      coverage: null,
    });
    setScan(input, "InterestExpense", {
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    const result = derive(input);
    expect(result.income.scans.map((scan) => scan.concept)).toEqual([
      revenueA,
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
    ]);
    expect(result.income.reason).toBeNull();
    expect(result.income.coverage!.full.candidateRows).toBe(4);
    expect(result.income.observations).toHaveLength(4);
  });
  it("refuses 101 combined revenue rows while retaining every canonical row and independent measure", () => {
    const input = fixture([
      ...Array.from({ length: 51 }, (_, i) => observation(revenueA, i)),
      ...Array.from({ length: 50 }, (_, i) => observation("Revenues", i)),
      observation("NetIncomeLoss"),
      observation(cash),
      observation("StockholdersEquity", 0, { value: "-8" }),
    ]);
    const result = derive(input);
    expect(result.income.scanStatus).toBe("available");
    expect(result.income.reason).toBe("selected_report_overflow");
    expect(result.income.coverage!.selected).toEqual({
      observations: 102,
      revenue: 101,
      netIncome: 1,
    });
    expect(result.income.coverage!.returned).toEqual({
      observations: 102,
      revenue: 101,
      netIncome: 1,
    });
    expect(result.income.coverage!.omittedSelected).toEqual({
      observations: 0,
      revenue: 0,
      netIncome: 0,
    });
    expect(result.income.observations).toHaveLength(0);
    expect(result.income.summaryReturned.observations).toBe(0);
    expect(input.facts.observations).toHaveLength(104);
    expect(result.cashGeneration.operatingCashFlow.observations[0]).toBe(
      input.facts.observations.find((row) => row.concept === cash),
    );
    expect(result.balanceSheet.shareholdersEquity.observations[0]!.value).toBe(
      "-8",
    );
    const statements = resolvePersonalSecAnnualStatements(input);
    expect(
      statements.statements
        .flatMap((s) => s.rows)
        .filter((row) => row.concept === revenueA || row.concept === "Revenues")
        .every((row) => row.cells[0]!.status === "available"),
    ).toBe(true);
  });
  it("allows exactly 100 combined revenues and 100 income observations", () => {
    const input = fixture([
      ...Array.from({ length: 50 }, (_, i) => observation(revenueA, i)),
      ...Array.from({ length: 50 }, (_, i) => observation("Revenues", i)),
      ...Array.from({ length: 100 }, (_, i) => observation("NetIncomeLoss", i)),
    ]);
    const result = derive(input);
    expect(result.income.reason).toBeNull();
    expect(result.income.observations).toHaveLength(200);
    expect(result.income.summaryReturned).toEqual({
      observations: 200,
      revenue: 100,
      netIncome: 100,
    });
  });
  it.each([20000, 20001])(
    "preserves the effective 20000-candidate ceiling at %i",
    (total) => {
      const input = fixture([
        observation("NetIncomeLoss"),
        observation(cash),
        observation("StockholdersEquity", 0, { value: "-9" }),
      ]);
      setScan(input, revenueA, completeScan({ candidateRows: 10000 }));
      setScan(
        input,
        "Revenues",
        completeScan({ candidateRows: total - 10001 }),
      );
      const result = derive(input);
      expect(result.income.coverage!.full.candidateRows).toBe(total);
      expect(result.income.coverage!.full.inspectedRows).toBe(total);
      expect(result.income.coverage!.full.uniqueObservations).toBe(total);
      expect(result.income.coverage!.otherAccessions!.observations).toBe(
        total - 1,
      );
      expect(result.income.reason).toBe(
        total === 20000 ? null : "candidate_limit",
      );
      expect(result.income.scanStatus).toBe(
        total === 20000 ? "available" : "candidate_limit",
      );
      expect(result.income.observations).toHaveLength(total === 20000 ? 1 : 0);
      expect(result.cashGeneration.operatingCashFlow.observations).toHaveLength(
        1,
      );
      expect(
        result.balanceSheet.shareholdersEquity.observations[0]!.value,
      ).toBe("-9");
      expect(
        input.facts.scans.find((s) => s.concept === revenueA)!.scan.status,
      ).toBe("available");
    },
  );
  it("retains per-concept overflow counts even when that concept returned no rows", () => {
    const input = fixture([observation("Revenues"), observation(cash)]);
    setScan(
      input,
      "NetIncomeLoss",
      completeScan({ candidateRows: 103, selected: 101 }),
    );
    const result = derive(input);
    expect(result.income.reason).toBe("selected_report_overflow");
    expect(result.income.coverage!.selected).toEqual({
      observations: 102,
      revenue: 1,
      netIncome: 101,
    });
    expect(result.income.coverage!.returned).toEqual({
      observations: 1,
      revenue: 1,
      netIncome: 0,
    });
    expect(result.income.coverage!.omittedSelected).toEqual({
      observations: 101,
      revenue: 0,
      netIncome: 101,
    });
    expect(result.income.coverage!.otherAccessions).toEqual({
      observations: 2,
      revenue: 0,
      netIncome: 2,
    });
    expect(result.income.observations).toEqual([]);
    expect(result.cashGeneration.operatingCashFlow.observations).toHaveLength(
      1,
    );
  });
  it.each(["invalid_response", "candidate_limit"] as const)(
    "never presents partial complete coverage after a %s income scan",
    (status) => {
      const input = fixture([
        observation("Revenues"),
        observation(cash),
        observation("StockholdersEquity", 0, { value: "-5" }),
      ]);
      setScan(input, "NetIncomeLoss", {
        status,
        absence: null,
        coverage: null,
      });
      const result = derive(input);
      expect(result.contextReason).toBeNull();
      expect(result.income.scanStatus).toBe(status);
      expect(result.income.reason).toBe(status);
      expect(result.income.coverage).toBeNull();
      expect(result.income.observations).toEqual([]);
      expect(result.cashGeneration.operatingCashFlow.observations).toHaveLength(
        1,
      );
      expect(
        result.balanceSheet.shareholdersEquity.observations[0]!.value,
      ).toBe("-5");
      expect(input.generation.sources.companyFacts.status).toBe("available");
      expect(input.facts.observations).toHaveLength(3);
    },
  );
  it("selects failure reasons in fixed registry order", () => {
    const input = fixture();
    setScan(input, "NetIncomeLoss", {
      status: "candidate_limit",
      absence: null,
      coverage: null,
    });
    setScan(input, "Revenues", {
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    const result = derive(input);
    expect(result.income.scanStatus).toBe("invalid_response");
    expect(result.income.reason).toBe("invalid_response");
    expect(result.income.coverage).toBeNull();
  });
  it("keeps successful concept/USD absences separate from failed scans without inventing source values", () => {
    const input = fixture([observation(cash)]);
    for (const [concept, absence] of [
      [revenueA, "concept_missing"],
      ["Revenues", "usd_missing"],
      ["SalesRevenueNet", "empty_usd"],
    ] as const) {
      const scan = input.facts.scans.find((s) => s.concept === concept)!.scan;
      if (scan.status !== "available") throw Error();
      scan.absence = absence;
    }
    const result = derive(input);
    expect(result.income.reason).toBeNull();
    expect(result.income.coverage!.full.conceptsWithoutUsd).toEqual([
      revenueA,
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
    ]);
    expect(result.income.observations).toEqual([]);
    expect(result.cashGeneration.operatingCashFlow.observations[0]!.value).toBe(
      "9007199254740993.125",
    );
  });
  it("retains unresolved selection as null counts rather than inferring an empty selection", () => {
    const input = fixture();
    input.target = {
      status: "unresolved",
      reason: "no_observed_annual_target",
    };
    setScan(input, "Revenues", {
      status: "available",
      absence: null,
      coverage: {
        full: {
          candidateRows: 8,
          inspectedRows: 8,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: 8,
        },
        selected: null,
        otherAccessions: null,
        returned: 0,
        omittedSelected: null,
      },
    });
    for (const item of input.facts.scans)
      if (item.scan.status === "available")
        Object.assign(item.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    const result = derive(input);
    expect(result.contextReason).toBe("target_unresolved");
    expect(result.income.reason).toBe("target_unresolved");
    expect(result.income.coverage!.full.revenue).toBe(8);
    expect(result.income.coverage!.selected).toBeNull();
    expect(result.income.coverage!.otherAccessions).toBeNull();
    expect(result.income.coverage!.omittedSelected).toBeNull();
    expect(result.income.coverage!.returned).toEqual({
      observations: 0,
      revenue: 0,
      netIncome: 0,
    });
    expect(result.utilityAge).toBeNull();
  });
  it("has no invented all-accession history counters, pairs, ratios or metric tags", () => {
    const result = derive(fixture(sourceRows()));
    expect(Object.hasOwn(result.income.coverage!, "history")).toBe(false);
    expect(Object.hasOwn(result.income, "history")).toBe(false);
    expect(Object.hasOwn(result.income, "resolution")).toBe(false);
    expect(Object.hasOwn(result.cashGeneration, "resolution")).toBe(false);
    expect(
      result.income.observations.every((row) => !Object.hasOwn(row, "metric")),
    ).toBe(true);
  });
  it("owns and freezes only new containers without freezing or cloning source evidence", () => {
    const input = fixture(sourceRows());
    const result = derive(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.income)).toBe(true);
    expect(Object.isFrozen(result.income.scans)).toBe(true);
    expect(Object.isFrozen(result.income.coverage!.full)).toBe(true);
    expect(Object.isFrozen(result.utilityAge!.sourceAgeDays)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.generation)).toBe(false);
    expect(Object.isFrozen(result.income.scans[0])).toBe(false);
    expect(Object.isFrozen(result.cashGeneration.operatingCashFlow.scan)).toBe(
      false,
    );
  });
  it("keeps complete shaped source periods before later financial-row admission", () => {
    const input = fixture([
      observation(cash, 0, { startDate: "2025-07-01" }),
      observation("StockholdersEquity", 0, { startDate: "2024-10-01" }),
    ]);
    const result = derive(input);
    expect(result.cashGeneration.operatingCashFlow.observations[0]).toBe(
      input.facts.observations.find((row) => row.concept === cash),
    );
    expect(
      result.cashGeneration.operatingCashFlow.observations[0]!.durationDays,
    ).toBe(92);
    expect(
      result.balanceSheet.shareholdersEquity.observations[0]!.startDate,
    ).toBe("2024-10-01");
  });
});

describe("canonical financial source context", () => {
  it.each([
    [
      "invalid_clock",
      (input: Fixture): void => {
        input.generation.sources.companyFacts.fetchedAt =
          "2026-02-02T05:00:00.000Z";
      },
    ],
    [
      "source_stale",
      (input: Fixture): void => {
        input.generation.completedAt = "2026-02-09T06:00:02.001Z";
      },
    ],
    [
      "future_or_inconsistent_dates",
      (input: Fixture): void => {
        if (input.target.status !== "target") throw Error();
        input.target.acceptedAt = "2026-02-02T07:00:00.000Z";
        for (const row of input.facts.observations)
          row.filing.acceptedAt = input.target.acceptedAt;
      },
    ],
    [
      "cutoff_time_unresolved",
      (input: Fixture): void => {
        if (input.target.status !== "target") throw Error();
        input.target.filedDate = "2026-02-02";
        input.target.acceptedAt = null;
        for (const row of input.facts.observations) {
          row.filedDate = input.target.filedDate;
          row.filing.filedDate = input.target.filedDate;
          row.filing.acceptedAt = null;
        }
      },
    ],
  ] as const)(
    "reuses the existing %s context policy without changing canonical source sections",
    (reason, mutate) => {
      const input = fixture(sourceRows());
      mutate(input);
      const result = derive(input);
      expect(result.contextReason).toBe(reason);
      expect(result.income.reason).toBe(reason);
      expect(result.income.observations).toEqual([]);
      expect(result.cashGeneration.operatingCashFlow.observations).toHaveLength(
        1,
      );
      expect(result.canonical).toBe(input);
      expect(result.canonical.generation.definitionVersion).toBe("6.0.0");
    },
  );
  it("retains original available target age as policy metadata instead of rejecting historical raw evidence", () => {
    for (const days of [485, 486]) {
      const input = fixture(sourceRows());
      const time = new Date(
        Date.parse("2025-09-30") + days * 86400000,
      ).toISOString();
      input.generation.cutoffAt = time;
      input.generation.completedAt = time;
      input.generation.sources.companyFacts.fetchedAt = time;
      input.generation.sources.submissions.fetchedAt = time;
      const result = derive(input);
      expect(result.contextReason).toBeNull();
      expect(result.utilityAge!.endAgeDays).toBe(days);
      expect(result.utilityAge!.withinWindow).toBe(days === 485);
      expect(result.income.observations).toHaveLength(4);
    }
  });
  it("keeps a source failure explicit in the context and original independent scans", () => {
    const input = fixture();
    input.generation.sources.companyFacts = {
      ...input.generation.sources.companyFacts,
      status: "rate_limited",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    for (const item of registry)
      setScan(input, item.concept, {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      });
    const result = derive(input);
    expect(result.contextReason).toBe("source_unavailable");
    expect(result.income.reason).toBe("source_unavailable");
    expect(result.income.coverage).toBeNull();
    expect(result.cashGeneration.operatingCashFlow.scan).toBe(
      input.facts.scans.find((s) => s.concept === cash)!.scan,
    );
    expect(result.utilityAge).toBeNull();
  });
  it("admits v6 with the shared closed-graph validator before projecting", () => {
    const input = fixture(sourceRows());
    Object.assign(input.generation, { definitionVersion: "5.0.0" });
    expect(() => derive(input)).toThrow(TypeError);
    const malformed = fixture();
    Object.assign(malformed, { legacyIncome: [] });
    expect(() => derive(malformed)).toThrow(TypeError);
  });
  it("does not invoke an accessor in canonical evidence", () => {
    const input = fixture();
    let calls = 0;
    Object.defineProperty(input.facts, "observations", {
      enumerable: true,
      get() {
        calls++;
        return [];
      },
    });
    expect(() => derive(input)).toThrow(TypeError);
    expect(calls).toBe(0);
  });
});
