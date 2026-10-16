import type {
  PersonalSecAnnualEvidenceDto,
  PersonalSecAnnualOperatingObservationDto,
  PersonalSecAnnualResolutionInput,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { resolvePersonalSecAnnualEvidence } from "./personal-sec-annual-evidence";
import { resolvePersonalSecAnnualOperatingResults } from "./personal-sec-annual-operating-results";
import { resolvePersonalSecAnnualCashGeneration } from "./personal-sec-annual-cash-generation";
import { resolvePersonalSecAnnualLiquidity } from "./personal-sec-annual-liquidity";
import { resolvePersonalSecAnnualBalanceSheet } from "./personal-sec-annual-balance-sheet";
import {
  derivePersonalSecAnnualFinancialReview as derive,
  type PersonalSecAnnualFinancialReviewKey,
} from "./personal-sec-annual-financial-review";

type Evidence = PersonalSecAnnualEvidenceDto;
const accessionNumber = "0000999999-26-000001";
const reportDate = "2025-12-31";
const id = (n: number): `sec-fact:${string}` =>
  `sec-fact:${n.toString(16).padStart(64, "0")}`;
const keys: readonly PersonalSecAnnualFinancialReviewKey[] = [
  "operatingIncome",
  "operatingCashFlow",
  "operatingCashFlowLessPpePurchases",
  "workingCapital",
  "shareholdersEquity",
];

function observation(
  n: number,
  value: string,
  concept: string,
  instant = false,
): Omit<PersonalSecAnnualOperatingObservationDto, "metric" | "concept"> {
  return {
    id: id(n),
    taxonomy: "us-gaap",
    unit: "USD",
    value,
    startDate: instant ? null : "2025-01-01",
    endDate: reportDate,
    durationDays: instant ? null : 365,
    periodBasis: "unresolved",
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: null,
    accessionNumber,
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/0`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate,
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accessionNumber}-index.htm`,
    },
  };
}

function metric<T>(row: T) {
  return {
    scan: {
      status: "available" as const,
      absence: null,
      coverage: {
        full: {
          candidateRows: 1,
          inspectedRows: 1,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: 1,
        },
        selected: 1,
        otherAccessions: 0,
        returned: 1,
        omittedSelected: 0,
      },
    },
    observations: [row],
  };
}

/** Real resolver outputs with no revenue/net income; no decoder is exercised here. */
function evidence(): Evidence {
  const counts = { observations: 0, revenue: 0, netIncome: 0 };
  const input: PersonalSecAnnualResolutionInput = {
    cik: "0000000042",
    generation: {
      definitionVersion: "5.0.0",
      cutoffAt: "2026-09-20T06:00:00.000Z",
      completedAt: "2026-09-20T06:00:03.000Z",
      sha256: `sha256:${"a".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:02.000Z",
          sha256: `sha256:${"b".repeat(64)}`,
          bytes: 1000,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:01.000Z",
          sha256: `sha256:${"c".repeat(64)}`,
          bytes: 500,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate,
      acceptedAt: "2026-02-01T16:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    incomeScanStatus: "available",
    completeness: { status: "complete", reason: null },
    coverage: {
      full: {
        ...counts,
        inspectedRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: 0,
        conceptsWithoutUsd: [],
      },
      selected: counts,
      otherAccessions: counts,
      returned: counts,
      omittedSelected: counts,
      history: { returned: counts, truncated: false },
    },
    observations: [],
  };
  const operatingResults = {
    operatingIncome: metric({
      ...observation(1, "35.125", "OperatingIncomeLoss"),
      metric: "operating_income" as const,
      concept: "OperatingIncomeLoss" as const,
    }),
  };
  const cashGeneration = {
    operatingCashFlow: metric({
      ...observation(
        2,
        "120.125",
        "NetCashProvidedByUsedInOperatingActivities",
      ),
      metric: "operating_cash_flow" as const,
      concept: "NetCashProvidedByUsedInOperatingActivities" as const,
    }),
    ppePurchases: metric({
      ...observation(3, "150.25", "PaymentsToAcquirePropertyPlantAndEquipment"),
      metric: "ppe_purchases" as const,
      concept: "PaymentsToAcquirePropertyPlantAndEquipment" as const,
    }),
  };
  const liquidity = {
    currentAssets: metric({
      ...observation(4, "50.125", "AssetsCurrent", true),
      metric: "current_assets" as const,
      concept: "AssetsCurrent" as const,
    }),
    currentLiabilities: metric({
      ...observation(5, "50.125", "LiabilitiesCurrent", true),
      metric: "current_liabilities" as const,
      concept: "LiabilitiesCurrent" as const,
    }),
  };
  const balanceSheet = {
    totalAssets: metric({
      ...observation(6, "100.125", "Assets", true),
      metric: "total_assets" as const,
      concept: "Assets" as const,
    }),
    totalLiabilities: metric({
      ...observation(7, "120.25", "Liabilities", true),
      metric: "total_liabilities" as const,
      concept: "Liabilities" as const,
    }),
    shareholdersEquity: metric({
      ...observation(8, "-20.125", "StockholdersEquity", true),
      metric: "shareholders_equity" as const,
      concept: "StockholdersEquity" as const,
    }),
  };
  return structuredClone({
    ...input,
    resolution: resolvePersonalSecAnnualEvidence(input),
    operatingResults: {
      ...operatingResults,
      resolution: resolvePersonalSecAnnualOperatingResults({
        ...input,
        operatingResults,
      }),
    },
    cashGeneration: {
      ...cashGeneration,
      resolution: resolvePersonalSecAnnualCashGeneration({
        ...input,
        cashGeneration,
      }),
    },
    liquidity: {
      ...liquidity,
      resolution: resolvePersonalSecAnnualLiquidity({ ...input, liquidity }),
    },
    balanceSheet: {
      ...balanceSheet,
      resolution: resolvePersonalSecAnnualBalanceSheet({
        cik: input.cik,
        generation: input.generation,
        target: input.target,
        balanceSheet,
      }),
    },
  });
}

function objects(value: unknown): object[] {
  if (value === null || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(objects)];
}

describe("financial review from resolved Annual evidence", () => {
  it("keeps five independent exact checks and calculation operands without income-pair eligibility", () => {
    const input = evidence();
    expect(input.resolution.selectedReportPairEligible).toBe(false);
    const rows = derive(input);
    expect(rows.map((row) => [row.key, row.section, row.sign])).toEqual([
      ["operatingIncome", "operating", "positive"],
      ["operatingCashFlow", "cash", "positive"],
      ["operatingCashFlowLessPpePurchases", "cash", "negative"],
      ["workingCapital", "liquidity", "zero"],
      ["shareholdersEquity", "balanceSheet", "negative"],
    ]);
    expect(rows.map((row) => row.value)).toEqual([
      input.operatingResults.resolution.operatingIncome,
      input.cashGeneration.resolution.operatingCashFlow,
      input.cashGeneration.resolution.operatingCashFlowLessPpePurchases,
      input.liquidity.resolution.workingCapital,
      input.balanceSheet.resolution.shareholdersEquity,
    ]);
    expect(rows[2]).toMatchObject({
      unit: "USD",
      value: { value: "-30.125", observationIds: [id(2), id(3)] },
      operands: {
        operatingCashFlow: input.cashGeneration.resolution.operatingCashFlow,
        ppePurchases: input.cashGeneration.resolution.ppePurchases,
      },
    });
    expect(rows[3]).toMatchObject({
      value: { value: "0", observationIds: [id(4), id(5)] },
      operands: {
        currentAssets: input.liquidity.resolution.currentAssets,
        currentLiabilities: input.liquidity.resolution.currentLiabilities,
      },
    });
  });

  it.each(keys)(
    "preserves a refused %s without hiding or changing sibling checks",
    (key) => {
      const input = evidence();
      const original = derive(input);
      const value = {
        status: "unavailable" as const,
        reason: "selected_report_overflow" as const,
        observationIds: [id(91), id(90)],
      };
      // Only resolved cells vary here; raw graph admission belongs to the decoder.
      const resolved =
        key === "operatingIncome"
          ? input.operatingResults.resolution
          : key === "shareholdersEquity"
            ? input.balanceSheet.resolution
            : key === "workingCapital"
              ? input.liquidity.resolution
              : input.cashGeneration.resolution;
      Reflect.set(
        resolved,
        key,
        key === "operatingCashFlow" ||
          key === "operatingCashFlowLessPpePurchases"
          ? value
          : { ...value, unit: "USD" },
      );
      const result = derive(input);
      expect(result.find((row) => row.key === key)).toMatchObject({
        sign: null,
        value,
      });
      expect(
        result
          .filter((row) => row.key !== key)
          .map((row) => [row.key, row.sign, row.value]),
      ).toEqual(
        original
          .filter((row) => row.key !== key)
          .map((row) => [row.key, row.sign, row.value]),
      );
    },
  );

  it("retains separate periods, balance dates, original eligibility and ordered references", () => {
    const input = evidence();
    const operating = input.operatingResults.resolution.operatingIncome;
    const equity = input.balanceSheet.resolution.shareholdersEquity;
    if (operating.status !== "available" || equity.status !== "available")
      throw new Error("Available fixture required");
    Reflect.set(input.operatingResults.resolution, "operatingIncome", {
      ...operating,
      startDate: "2024-12-30",
      currentUseEligible: false,
      observationIds: [id(15), id(1)],
    });
    Reflect.set(input.balanceSheet.resolution, "shareholdersEquity", {
      ...equity,
      asOfDate: "2024-09-30",
      currentUseEligible: false,
    });
    const rows = derive(input);
    expect(rows[0]).toMatchObject({
      sign: "positive",
      value: {
        startDate: "2024-12-30",
        endDate: reportDate,
        currentUseEligible: false,
        accessionNumber,
        observationIds: [id(15), id(1)],
      },
    });
    expect(rows[1]).toMatchObject({
      value: {
        startDate: "2025-01-01",
        endDate: reportDate,
        currentUseEligible: true,
      },
    });
    expect(rows[4]).toMatchObject({
      sign: "negative",
      value: {
        asOfDate: "2024-09-30",
        currentUseEligible: false,
        accessionNumber,
      },
    });
  });

  it.each([
    ["0", "zero"],
    ["9".repeat(64), "positive"],
    ["-" + "9".repeat(63), "negative"],
    ["0." + "0".repeat(61) + "1", "positive"],
    ["-0." + "0".repeat(60) + "1", "negative"],
  ])(
    "classifies %s exactly without replacing its source lexeme",
    (value, expected) => {
      const input = evidence();
      const income = input.operatingResults.resolution.operatingIncome;
      if (income.status !== "available")
        throw new Error("Available fixture required");
      Reflect.set(input.operatingResults.resolution, "operatingIncome", {
        ...income,
        value,
      });
      expect(derive(input)[0]).toMatchObject({
        sign: expected,
        value: { value },
      });
    },
  );

  it("classifies a long resolved calculation independently of global Decimal settings", () => {
    const input = evidence();
    const cash =
      input.cashGeneration.resolution.operatingCashFlowLessPpePurchases;
    if (cash.status !== "available")
      throw new Error("Available fixture required");
    const value = "-" + "9".repeat(127);
    Reflect.set(
      input.cashGeneration.resolution,
      "operatingCashFlowLessPpePurchases",
      { ...cash, value },
    );
    const original = {
      precision: Decimal.precision,
      minE: Decimal.minE,
      maxE: Decimal.maxE,
    };
    try {
      Decimal.set({ precision: 2, minE: -2, maxE: 2 });
      expect(derive(input)[2]).toMatchObject({
        sign: "negative",
        value: { value },
      });
    } finally {
      Decimal.set(original);
    }
  });

  it("owns and freezes every output object while leaving the entire input mutable and unchanged", () => {
    const input = evidence();
    const before = structuredClone(input);
    expect(objects(input).every((value) => !Object.isFrozen(value))).toBe(true);
    const rows = derive(input);
    const inputObjects = new Set(objects(input));
    expect(objects(rows).every((value) => Object.isFrozen(value))).toBe(true);
    expect(objects(rows).every((value) => !inputObjects.has(value))).toBe(true);
    expect(input).toEqual(before);
    expect(objects(input).every((value) => !Object.isFrozen(value))).toBe(true);
    const refs =
      input.cashGeneration.resolution.operatingCashFlow.observationIds;
    expect(Reflect.set(refs, 0, id(99))).toBe(true);
    expect(rows[1]?.value.observationIds).toEqual([id(2)]);
    const calculated = rows[2];
    if (calculated?.key !== "operatingCashFlowLessPpePurchases")
      throw new Error("Cash row required");
    expect(calculated.operands.operatingCashFlow.observationIds).toEqual([
      id(2),
    ]);
    expect(calculated.operands.operatingCashFlow).not.toBe(rows[1]?.value);
    expect(
      Reflect.set(
        calculated.operands.operatingCashFlow.observationIds,
        0,
        id(88),
      ),
    ).toBe(false);
  });
});
