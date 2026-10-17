import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualRevenueConcept,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualCanonicalIncome as resolve,
  comparePersonalSecAnnualCanonicalIncome as compare,
  resolvePersonalSecAnnualCanonicalIncomeHistory as history,
} from "./personal-sec-annual-canonical-income";
import { resolvePersonalSecAnnualCanonicalCashGeneration } from "./personal-sec-annual-canonical-cash";
import { resolvePersonalSecAnnualStatements } from "./personal-sec-annual-statements";
import {
  fixture,
  observation,
  setScan,
  type Fixture,
} from "./personal-sec-annual-statements.fixture";

const revenueA = "RevenueFromContractWithCustomerExcludingAssessedTax";
const bases = [revenueA, "Revenues", "SalesRevenueNet"] as const;
function rows(
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
  revenues: readonly string[] = ["120", "100", "80"],
  incomes: readonly string[] = ["15", "10", "-5"],
): PersonalSecAnnualStatementObservationDto[] {
  return ([concept, "NetIncomeLoss"] as const).flatMap((key) =>
    (key === concept ? revenues : incomes).map((value, index) => {
      const year = 2025 - index;
      return observation(key, index, {
        startDate: `${year - 1}-10-01`,
        endDate: `${year}-09-30`,
        filingFocusYear: year,
        value,
      });
    }),
  );
}
function withheld(input: Fixture) {
  const result = resolve(input);
  expect(result).toMatchObject({
    pairs: [],
    selectedReportPairEligible: false,
    currentTargetEligible: false,
    utilityAge: null,
  });
  expect(result.bases.map((b) => b.status)).toEqual([
    "withheld",
    "withheld",
    "withheld",
  ]);
  expect(history(input, "Revenues")).toEqual({
    status: "unavailable",
    reason: "current_report_unavailable",
  });
  expect(compare(input, "Revenues")).toEqual({
    status: "unavailable",
    reason: "current_report_unavailable",
  });
}

describe("canonical v6 income and named revenue bases", () => {
  it("keeps all named bases separate and preserves exact signed values, references and original graph", () => {
    const input = fixture([
      observation(revenueA, 0, { value: "100" }),
      observation("Revenues", 0, { value: "200" }),
      observation("SalesRevenueNet", 0, { value: "400" }),
      observation("NetIncomeLoss", 0, { value: "-10" }),
    ]);
    const before = structuredClone(input);
    const result = resolve(input);
    expect(result.bases.map((b) => b.concept)).toEqual(bases);
    expect(result.bases.map((b) => b.status)).toEqual([
      "eligible",
      "eligible",
      "eligible",
    ]);
    expect(result.bases.map((b) => b.pairs[0]!.netMarginPercent)).toEqual([
      "-10",
      "-5",
      "-2.5",
    ]);
    const income = input.facts.observations.find(
      (row) => row.concept === "NetIncomeLoss",
    )!;
    for (const basis of result.bases) {
      const row = input.facts.observations.find(
        (row) => row.concept === basis.concept,
      )!;
      expect(basis.pairs[0]).toMatchObject({
        startDate: row.startDate,
        endDate: row.endDate,
        revenue: row.value,
        netIncome: "-10",
        revenueObservationIds: [row.id],
        incomeObservationIds: [income.id],
      });
    }
    expect(result.currentTargetEligible).toBe(true);
    expect(result.utilityAge).toMatchObject({
      endAgeDays: 125,
      withinWindow: true,
    });
    expect(input).toEqual(before);
    expect(input.generation.definitionVersion).toBe("6.0.0");
    expect(
      input.facts.observations.every((row) => !Object.hasOwn(row, "metric")),
    ).toBe(true);
    expect(Object.isFrozen(input.facts.observations[0])).toBe(false);
    expect(
      Object.isFrozen(result.bases[0]!.pairs[0]!.incomeObservationIds),
    ).toBe(true);
  });
  it("compares exact signed amounts and rounds margin change once", () => {
    const input = fixture(rows());
    const result = compare(input, "Revenues");
    expect(result).toMatchObject({
      status: "available",
      priorStartDate: "2023-10-01",
      priorEndDate: "2024-09-30",
      currentStartDate: "2024-10-01",
      currentEndDate: "2025-09-30",
      revenue: {
        prior: "100",
        current: "120",
        difference: "20",
        percent: { status: "available", value: "20" },
      },
      netIncome: {
        prior: "10",
        current: "15",
        difference: "5",
        percent: { status: "available", value: "50" },
      },
      netMargin: {
        prior: "10",
        current: "12.5",
        difference: "2.5",
        direction: "higher",
      },
    });
  });
  it("preserves changes smaller than Number precision and exact signed unsafe income", () => {
    const input = fixture(
      rows(
        "Revenues",
        ["9007199254740993.125", "9007199254740993.124999999999999999"],
        ["-9007199254740993.125", "-9007199254740993.124999999999999998"],
      ),
    );
    const result = compare(input, "Revenues");
    expect(result).toMatchObject({
      status: "available",
      revenue: {
        difference: "0.000000000000000001",
        percent: { status: "available", value: "0" },
      },
      netIncome: {
        difference: "-0.000000000000000002",
        percent: { status: "unavailable", reason: "negative_prior" },
      },
      netMargin: { direction: "lower" },
    });
  });
  it.each(["0", "-5"])(
    "retains prior revenue %s and signed changes without manufacturing its margin",
    (value) => {
      const input = fixture(rows("Revenues", ["120", value], ["15", "-2"]));
      const result = compare(input, "Revenues");
      expect(result).toMatchObject({
        status: "available",
        revenue: {
          prior: value,
          percent: {
            status: "unavailable",
            reason: value === "0" ? "zero_prior" : "negative_prior",
          },
        },
        netIncome: {
          prior: "-2",
          difference: "17",
          percent: { status: "unavailable", reason: "negative_prior" },
        },
        netMargin: {
          status: "unavailable",
          reason:
            value === "0" ? "zero_prior_revenue" : "negative_prior_revenue",
        },
      });
      const past = history(input, "Revenues");
      if (past.status !== "available") throw Error();
      expect(past.periods[1]!.netMarginPercent).toBeNull();
    },
  );
  it.each(["0", "-1"])(
    "refuses nonpositive current revenue %s without hiding its reported statement cell",
    (value) => {
      const input = fixture(rows("Revenues", [value], ["-2"]));
      const result = resolve(input);
      expect(
        result.bases.find((b) => b.concept === "Revenues")!.pairs[0],
      ).toMatchObject({
        status: "nonpositive_revenue",
        revenue: null,
        netIncome: null,
        netMarginPercent: null,
      });
      expect(history(input, "Revenues")).toEqual({
        status: "unavailable",
        reason: "current_report_unavailable",
      });
      const cell = resolvePersonalSecAnnualStatements(input)
        .statements.flatMap((s) => s.rows)
        .find((r) => r.concept === "Revenues")!.cells[0]!;
      expect(cell).toMatchObject({ status: "available", value });
    },
  );
  it("keeps missing income explicit while cash and negative equity retain their reported values", () => {
    const input = fixture([
      observation("Revenues", 0, { value: "100" }),
      observation("NetCashProvidedByUsedInOperatingActivities", 0, {
        value: "7",
      }),
      observation("PaymentsToAcquirePropertyPlantAndEquipment", 0, {
        value: "2",
      }),
      observation("StockholdersEquity", 0, { value: "-5" }),
    ]);
    const result = resolve(input);
    expect(
      result.bases.find((b) => b.concept === "Revenues")!.pairs[0],
    ).toMatchObject({
      status: "income_missing_same_filing_period",
      revenue: null,
      netIncome: null,
    });
    expect(result.selectedReportPairEligible).toBe(false);
    expect(
      resolvePersonalSecAnnualCanonicalCashGeneration(input)
        .operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "5" });
    const equity = resolvePersonalSecAnnualStatements(input)
      .statements.flatMap((s) => s.rows)
      .find((r) => r.concept === "StockholdersEquity")!.cells[0]!;
    expect(equity).toMatchObject({ status: "available", value: "-5" });
  });
  it("does not borrow income from another exact period", () => {
    const input = fixture([
      observation("Revenues"),
      observation("NetIncomeLoss", 0, { startDate: "2024-09-30" }),
    ]);
    expect(
      resolve(input).bases.find((b) => b.concept === "Revenues")!.pairs[0],
    ).toMatchObject({
      status: "income_missing_same_filing_period",
      subordinateReasons: ["income_only_other_period_or_accession"],
    });
  });
  it.each(["revenue value", "revenue start", "income value"] as const)(
    "refuses a same-period %s conflict with every source ID retained",
    (conflict) => {
      const extra =
        conflict === "income value"
          ? observation("NetIncomeLoss", 3, { value: "999" })
          : observation(
              "Revenues",
              3,
              conflict === "revenue value"
                ? { value: "999" }
                : { startDate: "2024-09-30" },
            );
      const input = fixture([...rows("Revenues", ["120"], ["15"]), extra]);
      const pairs = resolve(input).bases.find(
        (b) => b.concept === "Revenues",
      )!.pairs;
      const pair = pairs[0]!;
      expect(pair.status).toBe(
        conflict === "income value"
          ? "ambiguous_income_value"
          : "ambiguous_revenue_period_or_value",
      );
      expect(
        pairs.flatMap((pair) => [
          ...pair.revenueObservationIds,
          ...pair.incomeObservationIds,
        ]),
      ).toContain(extra.id);
    },
  );
  it.each(["missing FY", "quarter", "conflicted join"] as const)(
    "keeps %s refusal in the selected income pair",
    (kind) => {
      const base = observation("Revenues");
      const change =
        kind === "missing FY"
          ? { filingFocusPeriod: null }
          : kind === "quarter"
            ? { startDate: "2025-07-01" }
            : {
                filing: {
                  ...base.filing,
                  status: "metadata_conflict" as const,
                },
              };
      const input = fixture([
        observation("Revenues", 0, change),
        observation("NetIncomeLoss"),
      ]);
      expect(
        resolve(input).bases.find((b) => b.concept === "Revenues")!.pairs[0]!
          .status,
      ).toBe(
        kind === "missing FY"
          ? "missing_or_non_FY_focus"
          : kind === "quarter"
            ? "invalid_annual_period"
            : "filing_unmatched_or_conflicted",
      );
    },
  );
  it("does not make an unrelated failed statement concept an income gate", () => {
    const input = fixture(rows());
    setScan(input, "GrossProfit", {
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    expect(resolve(input).currentTargetEligible).toBe(true);
    expect(history(input, "Revenues").status).toBe("available");
  });
  it.each(["invalid_response", "candidate_limit"] as const)(
    "withholds the effective income summary after a %s constituent scan",
    (status) => {
      const input = fixture([
        observation("Revenues"),
        observation("NetCashProvidedByUsedInOperatingActivities"),
        observation("PaymentsToAcquirePropertyPlantAndEquipment"),
      ]);
      setScan(input, "NetIncomeLoss", {
        status,
        absence: null,
        coverage: null,
      });
      withheld(input);
      expect(input.facts.observations).toHaveLength(3);
      expect(
        resolvePersonalSecAnnualCanonicalCashGeneration(input).operatingCashFlow
          .status,
      ).toBe("available");
    },
  );
  it("withholds 101 combined revenue rows while preserving every concept's available statement cell", () => {
    const input = fixture([
      ...Array.from({ length: 51 }, (_, i) =>
        observation(revenueA, i, { value: "100" }),
      ),
      ...Array.from({ length: 50 }, (_, i) =>
        observation("Revenues", i, { value: "200" }),
      ),
      observation("NetIncomeLoss"),
    ]);
    withheld(input);
    expect(input.facts.observations).toHaveLength(102);
    const table = resolvePersonalSecAnnualStatements(input).statements.flatMap(
      (s) => s.rows,
    );
    expect(table.find((r) => r.concept === revenueA)!.cells[0]!.status).toBe(
      "available",
    );
    expect(table.find((r) => r.concept === "Revenues")!.cells[0]!.status).toBe(
      "available",
    );
  });
  it.each([20000, 20001])(
    "keeps the effective income candidate ceiling at total %i",
    (total) => {
      const input = fixture(rows("Revenues", ["120"], ["15"]));
      for (const [concept, candidates, selected] of [
        [revenueA, 10000, 0],
        ["Revenues", total - 10001, 1],
      ] as const)
        setScan(input, concept, {
          status: "available",
          absence: null,
          coverage: {
            full: {
              candidateRows: candidates,
              inspectedRows: candidates,
              invalidRows: 0,
              duplicateRows: 0,
              uniqueObservations: candidates,
            },
            selected,
            otherAccessions: candidates - selected,
            returned: selected,
            omittedSelected: 0,
          },
        });
      if (total === 20000)
        expect(resolve(input).currentTargetEligible).toBe(true);
      else withheld(input);
    },
  );
  it("withholds counted invalid income rows instead of treating retained valid rows as complete", () => {
    const input = fixture(rows());
    const scan = input.facts.scans.find(
      (s) => s.concept === "NetIncomeLoss",
    )!.scan;
    if (scan.status !== "available") throw Error();
    scan.coverage.full.candidateRows++;
    scan.coverage.full.inspectedRows++;
    scan.coverage.full.invalidRows++;
    withheld(input);
    expect(input.facts.observations).toHaveLength(6);
  });
  it("stays independent of global Decimal configuration", () => {
    const precision = Decimal.precision,
      rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      const input = fixture(
        rows("Revenues", ["100", "100"], ["1.005", "1.004"]),
      );
      expect(
        resolve(input).bases.find((b) => b.concept === "Revenues")!.pairs[0]!
          .netMarginPercent,
      ).toBe("1.01");
      expect(compare(input, "Revenues")).toMatchObject({
        status: "available",
        netMargin: { direction: "higher" },
      });
    } finally {
      Decimal.set({ precision, rounding });
    }
  });
});

describe("canonical income contiguous history", () => {
  it.each([1, 2, 3, 4])(
    "retains up to three adjacent periods from %i supplied",
    (count) => {
      const input = fixture(
        rows(
          "Revenues",
          ["120", "100", "80", "60"].slice(0, count),
          ["15", "10", "-5", "0"].slice(0, count),
        ),
      );
      const before = structuredClone(input);
      const result = history(input, "Revenues");
      expect(result.status).toBe("available");
      if (result.status !== "available") throw Error();
      expect(result.periods).toHaveLength(Math.min(count, 3));
      expect(result.comparisons).toHaveLength(Math.min(count, 3) - 1);
      expect(result.stoppedReason).toBe(
        count < 3 ? "previous_period_missing" : null,
      );
      expect(result.periods[0]).toMatchObject({
        startDate: "2024-10-01",
        endDate: "2025-09-30",
        revenue: "120",
        netIncome: "15",
        netMarginPercent: "12.5",
      });
      expect(Object.isFrozen(result.periods[0]!.observationIds)).toBe(true);
      expect(input).toEqual(before);
    },
  );
  it("does not fill a missing middle year with an older filing period", () => {
    const input = fixture(
      rows().filter(
        (row) =>
          !(row.concept === "NetIncomeLoss" && row.endDate === "2024-09-30"),
      ),
    );
    const result = history(input, "Revenues");
    expect(result).toMatchObject({
      status: "available",
      stoppedReason: "previous_period_missing",
    });
    if (result.status !== "available") throw Error();
    expect(result.periods).toHaveLength(1);
  });
  it("does not use the statement table's latest-date axes to select contiguous history", () => {
    const input = fixture([
      ...rows(),
      observation("Revenues", 3, {
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        value: "500",
      }),
      observation("NetIncomeLoss", 3, {
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        value: "50",
      }),
    ]);
    const table = resolvePersonalSecAnnualStatements(input).statements.find(
      (s) => s.id === "income_statement",
    )!;
    expect(table.columns.map((c) => c.endDate)).toEqual([
      "2025-09-30",
      "2025-03-31",
      "2024-09-30",
    ]);
    const result = history(input, "Revenues");
    if (result.status !== "available") throw Error();
    expect(result.periods.map((p) => p.endDate)).toEqual([
      "2025-09-30",
      "2024-09-30",
      "2023-09-30",
    ]);
  });
  it("preserves actual 52/53-week starts and original selected-filing metadata", () => {
    const periods = [
      ["2024-09-29", "2025-09-27"],
      ["2023-10-01", "2024-09-28"],
      ["2022-09-25", "2023-09-30"],
    ] as const;
    const input = fixture(
      (["Revenues", "NetIncomeLoss"] as const).flatMap((concept) =>
        periods.map(([startDate, endDate], i) =>
          observation(concept, i, {
            startDate,
            endDate,
            value: concept === "Revenues" ? "100" : "10",
          }),
        ),
      ),
    );
    if (input.target.status !== "target") throw Error();
    input.target.reportDate = "2025-09-27";
    for (const row of input.facts.observations)
      row.filing.reportDate = "2025-09-27";
    const result = history(input, "Revenues");
    if (result.status !== "available") throw Error();
    expect(result.periods.map((p) => p.startDate)).toEqual(
      periods.map((p) => p[0]),
    );
    expect(
      input.facts.observations.find((r) => r.endDate === "2023-09-30")!
        .durationDays,
    ).toBe(371);
    expect(
      input.facts.observations.every(
        (r) => r.filing.reportDate === "2025-09-27",
      ),
    ).toBe(true);
  });
  it.each(["value", "start", "filing"] as const)(
    "stops at a prior %s conflict without changing current values",
    (conflict) => {
      const input = fixture([
        ...rows(),
        observation("Revenues", 3, {
          startDate: conflict === "start" ? "2023-09-30" : "2023-10-01",
          endDate: "2024-09-30",
          value: conflict === "value" ? "999" : "100",
          ...(conflict === "filing"
            ? {
                filing: {
                  ...observation("Revenues").filing,
                  status: "metadata_conflict" as const,
                },
              }
            : {}),
        }),
      ]);
      const result = history(input, "Revenues");
      expect(result).toMatchObject({
        status: "available",
        stoppedReason:
          conflict === "value"
            ? "previous_values_conflicted"
            : conflict === "start"
              ? "previous_period_ambiguous"
              : "previous_period_invalid",
      });
      if (result.status !== "available") throw Error();
      expect(result.periods).toHaveLength(1);
      expect(resolve(input).currentTargetEligible).toBe(true);
    },
  );
  it("retains current historical pairs but withholds history outside current-use age", () => {
    const input = fixture(rows());
    const time = "2027-02-02T06:00:00.000Z";
    input.generation.cutoffAt = time;
    input.generation.completedAt = time;
    input.generation.sources.companyFacts.fetchedAt = time;
    input.generation.sources.submissions.fetchedAt = time;
    const result = resolve(input);
    expect(result.selectedReportPairEligible).toBe(true);
    expect(result.currentTargetEligible).toBe(false);
    expect(result.utilityAge!.withinWindow).toBe(false);
    expect(history(input, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
    expect(compare(input, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
  });
  it("rejects an old accession rather than using it as a fallback", () => {
    const input = fixture([
      ...rows(),
      observation("NetIncomeLoss", 5, {
        accessionNumber: "0000999999-25-000001",
      }),
    ]);
    expect(() => resolve(input)).toThrow(TypeError);
    expect(() => history(input, "Revenues")).toThrow(TypeError);
  });
});

describe("canonical income source/context admission", () => {
  it.each(["invalid_clock", "source_stale"] as const)(
    "withholds %s before comparing values",
    (reason) => {
      const input = fixture(rows());
      if (reason === "invalid_clock")
        input.generation.completedAt = "2026-02-02T05:00:00.000Z";
      else input.generation.completedAt = "2026-02-10T06:00:00.000Z";
      withheld(input);
    },
  );
  it("keeps unresolved target counts and context without selecting older values", () => {
    const input = fixture();
    input.target = { status: "unresolved", reason: "target_ambiguous" };
    for (const item of input.facts.scans)
      if (item.scan.status === "available")
        Object.assign(item.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    withheld(input);
  });
  it("keeps source-unavailable context explicit", () => {
    const input = fixture();
    input.generation.sources.companyFacts = {
      ...input.generation.sources.companyFacts,
      status: "rate_limited",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    for (const entry of registry)
      setScan(input, entry.concept, {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      });
    withheld(input);
  });
  it("does not accept another definition or malformed graph as a v6 fallback", () => {
    const input = fixture(rows());
    Object.assign(input.generation, { definitionVersion: "5.0.0" });
    expect(() => resolve(input)).toThrow(TypeError);
    expect(() => compare(input, "Revenues")).toThrow(TypeError);
    const malformed = fixture(rows());
    Object.assign(malformed, { coverage: { history: { returned: 0 } } });
    expect(() => history(malformed, "Revenues")).toThrow(TypeError);
  });
  it("rejects canonical accessors without invoking them", () => {
    const input = fixture(rows());
    let calls = 0;
    Object.defineProperty(input.facts, "observations", {
      enumerable: true,
      get() {
        calls++;
        return [];
      },
    });
    expect(() => resolve(input)).toThrow(TypeError);
    expect(calls).toBe(0);
  });
});
