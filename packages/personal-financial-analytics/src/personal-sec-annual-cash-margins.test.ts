import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualEvidenceDto,
  type PersonalSecAnnualOperatingObservationDto,
  type PersonalSecAnnualResolutionInput,
  type PersonalSecAnnualCashValueDto,
  type PersonalSecAnnualOperatingValueDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { resolvePersonalSecAnnualEvidence } from "./personal-sec-annual-evidence";
import { resolvePersonalSecAnnualOperatingResults } from "./personal-sec-annual-operating-results";
import { resolvePersonalSecAnnualCashGeneration } from "./personal-sec-annual-cash-generation";
import { resolvePersonalSecAnnualLiquidity } from "./personal-sec-annual-liquidity";
import { resolvePersonalSecAnnualBalanceSheet } from "./personal-sec-annual-balance-sheet";
import { derivePersonalSecAnnualCashMargins as derive } from "./personal-sec-annual-cash-margins";
type Evidence = PersonalSecAnnualEvidenceDto;
const accessionNumber = "0000999999-26-000001",
  reportDate = "2025-12-31";
const id = (n: number): `sec-fact:${string}` =>
  `sec-fact:${n.toString(16).padStart(64, "0")}`;
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

/** Real resolver outputs over invented normalized rows; NOT a wire/strict-decoder fixture. */
function evidence(): Evidence {
  const observations = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map(
    (concept, index) => ({
      ...observation(index + 20, ["1000", "800", "500"][index]!, concept),
      metric: "revenue" as const,
      concept,
    }),
  );
  const counts = { observations: 3, revenue: 3, netIncome: 0 };
  const zero = { observations: 0, revenue: 0, netIncome: 0 };
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
        inspectedRows: 3,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: 3,
        conceptsWithoutUsd: [],
      },
      selected: counts,
      otherAccessions: zero,
      returned: counts,
      omittedSelected: zero,
      history: { returned: counts, truncated: false },
    },
    observations,
  };
  const operatingResults = {
    operatingIncome: {
      scan: {
        status: "available" as const,
        absence: "concept_missing" as const,
        coverage: {
          full: {
            candidateRows: 0,
            inspectedRows: 0,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: 0,
          },
          selected: 0,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: 0,
        },
      },
      observations: [],
    },
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

function withCash(
  input: Evidence,
  values: Partial<Evidence["cashGeneration"]["resolution"]>,
): Evidence {
  return {
    ...input,
    cashGeneration: {
      ...input.cashGeneration,
      resolution: { ...input.cashGeneration.resolution, ...values },
    },
  };
}
function withRevenue(
  input: Evidence,
  value: PersonalSecAnnualOperatingValueDto<"USD">,
  index = 0,
): Evidence {
  return {
    ...input,
    operatingResults: {
      ...input.operatingResults,
      resolution: {
        ...input.operatingResults.resolution,
        margins: input.operatingResults.resolution.margins.map((basis, i) =>
          i === index ? { ...basis, revenue: value } : basis,
        ),
      },
    },
  };
}
function available<T extends { status: string }>(
  value: T,
): Extract<T, { status: "available" }> {
  if (value.status !== "available")
    throw new Error("Expected resolved available fixture value");
  return value as Extract<T, { status: "available" }>;
}
function objects(value: unknown): object[] {
  if (value === null || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(objects)];
}

describe("cash margins from resolved Annual v5 cells", () => {
  it("keeps all exact named revenue bases usable without operating income or net-income eligibility", () => {
    const input = evidence();
    expect(input.resolution.selectedReportPairEligible).toBe(false);
    expect(input.observations.some((row) => row.metric === "net_income")).toBe(
      false,
    );
    expect(input.operatingResults.resolution.operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(
      input.operatingResults.resolution.margins.every(
        (basis) => basis.operatingMargin.status === "unavailable",
      ),
    ).toBe(true);
    const rows = derive(input);
    expect(rows.map((row) => row.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
    );
    expect(rows.map((row) => row.margin)).toEqual(
      ["-3.01", "-3.77", "-6.03"].map((value, i) => ({
        status: "available",
        unit: "percent",
        value,
        startDate: "2025-01-01",
        endDate: reportDate,
        accessionNumber,
        currentUseEligible: true,
        observationIds: [id(2), id(3), id(i + 20)],
      })),
    );
    rows.forEach((row, i) => {
      expect(row.operands.operatingCashFlow).toEqual(
        input.cashGeneration.resolution.operatingCashFlow,
      );
      expect(row.operands.ppePurchases).toEqual(
        input.cashGeneration.resolution.ppePurchases,
      );
      expect(row.operands.revenue).toEqual(
        input.operatingResults.resolution.margins[i]!.revenue,
      );
    });
  });

  it("owns and freezes all returned values and ID arrays without freezing or mutating the input", () => {
    const input = evidence(),
      before = JSON.stringify(input);
    const rows = derive(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(objects(rows).every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    rows.forEach((row, i) => {
      expect(row.operands.operatingCashFlow).not.toBe(
        input.cashGeneration.resolution.operatingCashFlow,
      );
      expect(row.operands.operatingCashFlow.observationIds).not.toBe(
        input.cashGeneration.resolution.operatingCashFlow.observationIds,
      );
      expect(row.operands.ppePurchases).not.toBe(
        input.cashGeneration.resolution.ppePurchases,
      );
      expect(row.operands.revenue).not.toBe(
        input.operatingResults.resolution.margins[i]!.revenue,
      );
    });
    Reflect.set(
      input.cashGeneration.resolution.operatingCashFlow,
      "value",
      "999",
    );
    Reflect.set(
      input.cashGeneration.resolution.operatingCashFlow.observationIds,
      "0",
      id(999),
    );
    expect(rows[0]!.operands.operatingCashFlow).toMatchObject({
      value: "120.125",
      observationIds: [id(2)],
    });
  });

  it("retains complete agreeing references in OCF/PPE/revenue order", () => {
    let input = evidence();
    input = withCash(input, {
      operatingCashFlow: {
        ...available(input.cashGeneration.resolution.operatingCashFlow),
        observationIds: [id(2), id(102)],
      },
      ppePurchases: {
        ...available(input.cashGeneration.resolution.ppePurchases),
        observationIds: [id(3), id(103)],
      },
    });
    input = withRevenue(input, {
      ...available(input.operatingResults.resolution.margins[0]!.revenue),
      observationIds: [id(20), id(120)],
    });
    const first = derive(input)[0]!;
    expect(first.margin.observationIds).toEqual([
      id(2),
      id(102),
      id(3),
      id(103),
      id(20),
      id(120),
    ]);
    expect(first.operands.revenue.observationIds).toEqual([id(20), id(120)]);
  });

  it("uses original raw operands rather than the separately calculated or rounded dollar difference", () => {
    let input = evidence();
    input = withCash(input, {
      operatingCashFlow: {
        ...available(input.cashGeneration.resolution.operatingCashFlow),
        value: "1.00004",
      },
      ppePurchases: {
        ...available(input.cashGeneration.resolution.ppePurchases),
        value: "1",
      },
      operatingCashFlowLessPpePurchases: {
        ...available(
          input.cashGeneration.resolution.operatingCashFlowLessPpePurchases,
        ),
        value: "0",
      },
    });
    input = withRevenue(input, {
      ...available(input.operatingResults.resolution.margins[0]!.revenue),
      value: "0.001",
    });
    expect(derive(input)[0]!.margin).toMatchObject({
      status: "available",
      value: "4.00",
    });
  });

  // The following cases deliberately vary typed resolved cells. They exercise
  // projection joins/refusal priority, not raw packet or strict decoder admission.
  it.each(["revenue", "operatingCashFlow", "ppePurchases"] as const)(
    "keeps original %s refusal/IDs with deterministic operand priority",
    (stage) => {
      let input = evidence();
      const ocf: PersonalSecAnnualCashValueDto = {
        status: "unavailable",
        reason: "candidate_limit",
        observationIds: [id(2)],
      };
      const ppe: PersonalSecAnnualCashValueDto = {
        status: "unavailable",
        reason: "ambiguous_value",
        observationIds: [id(3)],
      };
      input = withCash(input, {
        ppePurchases: ppe,
        ...(stage !== "ppePurchases" ? { operatingCashFlow: ocf } : {}),
      });
      if (stage === "revenue")
        input = withRevenue(input, {
          status: "unavailable",
          unit: "USD",
          reason: "no_report_period",
          observationIds: [id(20)],
        });
      const first = derive(input)[0]!;
      expect(first.margin).toEqual({
        status: "unavailable",
        unit: "percent",
        stage,
        reason:
          stage === "revenue"
            ? "no_report_period"
            : stage === "operatingCashFlow"
              ? "candidate_limit"
              : "ambiguous_value",
        observationIds: [id(2), id(3), id(20)],
      });
      expect(first.operands.ppePurchases).toEqual(ppe);
    },
  );

  it("does not replace a refused revenue concept with a different available basis", () => {
    const input = withRevenue(evidence(), {
      status: "unavailable",
      unit: "USD",
      reason: "ambiguous_value",
      observationIds: [id(20)],
    });
    const rows = derive(input);
    expect(rows[0]!.margin).toMatchObject({
      status: "unavailable",
      stage: "revenue",
      reason: "ambiguous_value",
    });
    expect(
      rows.slice(1).every((row) => row.margin.status === "available"),
    ).toBe(true);
    expect(rows[0]!.concept).toBe(PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS[0]);
  });

  it.each(["operatingCashFlow", "ppePurchases", "revenue"] as const)(
    "rejects a same-end/different-start %s before a filing or sign problem",
    (operand) => {
      let input = evidence();
      if (operand === "revenue")
        input = withRevenue(input, {
          ...available(input.operatingResults.resolution.margins[0]!.revenue),
          startDate: "2025-01-02",
          accessionNumber: "0000999999-26-000002",
          value: "-1",
        });
      else
        input = withCash(input, {
          [operand]: {
            ...available(input.cashGeneration.resolution[operand]),
            startDate: "2025-01-02",
            accessionNumber: "0000999999-26-000002",
            value: "-1",
          },
        });
      expect(derive(input)[0]!.margin).toMatchObject({
        status: "unavailable",
        stage: "calculation",
        reason: "period_mismatch",
      });
    },
  );

  it.each(["operatingCashFlow", "ppePurchases", "revenue"] as const)(
    "rejects a different %s accession without using another filing",
    (operand) => {
      let input = evidence();
      if (operand === "revenue")
        input = withRevenue(input, {
          ...available(input.operatingResults.resolution.margins[0]!.revenue),
          accessionNumber: "0000999999-26-000002",
        });
      else
        input = withCash(input, {
          [operand]: {
            ...available(input.cashGeneration.resolution[operand]),
            accessionNumber: "0000999999-26-000002",
          },
        });
      expect(derive(input)[0]!.margin).toMatchObject({
        status: "unavailable",
        stage: "calculation",
        reason: "filing_mismatch",
      });
    },
  );

  it.each(["0", "-5"])(
    "refuses nonpositive revenue %s while preserving raw operands",
    (value) => {
      const input = withRevenue(evidence(), {
        ...available(
          evidence().operatingResults.resolution.margins[0]!.revenue,
        ),
        value,
      });
      const first = derive(input)[0]!;
      expect(first.margin).toMatchObject({
        status: "unavailable",
        stage: "calculation",
        reason: "nonpositive_revenue",
      });
      expect(first.operands.revenue).toMatchObject({
        status: "available",
        value,
      });
    },
  );

  it("refuses negative purchases before nonpositive revenue without hiding either reported amount", () => {
    let input = evidence();
    input = withCash(input, {
      ppePurchases: {
        ...available(input.cashGeneration.resolution.ppePurchases),
        value: "-5",
      },
    });
    input = withRevenue(input, {
      ...available(input.operatingResults.resolution.margins[0]!.revenue),
      value: "0",
    });
    const first = derive(input)[0]!;
    expect(first.margin).toMatchObject({
      status: "unavailable",
      stage: "calculation",
      reason: "unsupported_sign",
    });
    expect(first.operands.ppePurchases).toMatchObject({ value: "-5" });
    expect(first.operands.revenue).toMatchObject({ value: "0" });
  });

  it.each(["operatingCashFlow", "ppePurchases", "revenue"] as const)(
    "preserves historical %s and its independent original flag",
    (operand) => {
      let input = evidence();
      if (operand === "revenue")
        input = withRevenue(input, {
          ...available(input.operatingResults.resolution.margins[0]!.revenue),
          currentUseEligible: false,
        });
      else
        input = withCash(input, {
          [operand]: {
            ...available(input.cashGeneration.resolution[operand]),
            currentUseEligible: false,
          },
        });
      const first = derive(input)[0]!;
      expect(first.margin).toMatchObject({
        status: "available",
        value: "-3.01",
        currentUseEligible: false,
      });
      expect(first.operands[operand]).toMatchObject({
        currentUseEligible: false,
      });
      expect(first.margin).not.toHaveProperty("preparedAt");
    },
  );

  it("uses fixed concept order even when the resolved list is reordered and refuses a missing typed basis", () => {
    const input = evidence();
    const reversed = {
      ...input,
      operatingResults: {
        ...input.operatingResults,
        resolution: {
          ...input.operatingResults.resolution,
          margins: [...input.operatingResults.resolution.margins].reverse(),
        },
      },
    };
    expect(derive(reversed)).toEqual(derive(input));
    const absent = {
      ...input,
      operatingResults: {
        ...input.operatingResults,
        resolution: {
          ...input.operatingResults.resolution,
          margins: input.operatingResults.resolution.margins.slice(1),
        },
      },
    };
    expect(() => derive(absent)).toThrow(
      "Missing resolved annual revenue basis.",
    );
  });
});
