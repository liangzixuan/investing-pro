import type {
  PersonalSecAnnualResolutionInput,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  comparePersonalSecAnnualEvidence,
  resolvePersonalSecAnnualHistory,
} from "./personal-sec-annual-comparison";
import { resolvePersonalSecAnnualEvidence } from "./personal-sec-annual-evidence";

const target = {
  status: "target" as const,
  accessionNumber: "0000999999-26-000001",
  form: "10-K" as const,
  filedDate: "2026-02-01",
  reportDate: "2025-12-31",
  acceptedAt: "2026-02-01T16:00:00.000Z",
};
function row(
  id: number,
  prior: boolean,
  income: boolean,
  value: string,
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${id.toString(16).padStart(64, "0")}`,
    metric: income ? "net_income" : "revenue",
    concept: income ? "NetIncomeLoss" : "Revenues",
    taxonomy: "us-gaap",
    unit: "USD",
    value,
    startDate: prior ? "2024-01-01" : "2025-01-01",
    endDate: prior ? "2024-12-31" : "2025-12-31",
    durationDays: prior ? 366 : 365,
    periodBasis: "unresolved",
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: null,
    accessionNumber: target.accessionNumber,
    form: target.form,
    filedDate: target.filedDate,
    sourceLocator: `/facts/us-gaap/${income ? "NetIncomeLoss" : "Revenues"}/units/USD/${id}`,
    filing: {
      status: "matched",
      form: target.form,
      filedDate: target.filedDate,
      reportDate: target.reportDate,
      acceptedAt: target.acceptedAt,
      sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
    },
    ...changes,
  };
}
const rows = () => [
  row(1, false, false, "120"),
  row(2, false, true, "15"),
  row(3, true, false, "100"),
  row(4, true, true, "10"),
];
function packet(observations = rows()): PersonalSecAnnualResolutionInput {
  const counts = {
    observations: observations.length,
    revenue: observations.filter((r) => r.metric === "revenue").length,
    netIncome: observations.filter((r) => r.metric === "net_income").length,
  };
  const empty = { observations: 0, revenue: 0, netIncome: 0 };
  return {
    cik: "0000000042",
    target,
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    completeness: { status: "complete", reason: null },
    observations,
    coverage: {
      full: {
        ...counts,
        inspectedRows: observations.length,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: observations.length,
        conceptsWithoutUsd: [],
      },
      selected: counts,
      returned: counts,
      omittedSelected: empty,
      otherAccessions: empty,
      history: { returned: counts, truncated: false },
    },
    generation: {
      definitionVersion: "1.0.0",
      cutoffAt: "2026-09-20T06:00:00.000Z",
      completedAt: "2026-09-20T06:00:03.000Z",
      sha256: `sha256:${"a".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:01.000Z",
          sha256: `sha256:${"b".repeat(64)}`,
          bytes: 1000,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:02.000Z",
          sha256: `sha256:${"c".repeat(64)}`,
          bytes: 500,
        },
      },
    },
  };
}
const compare = (observations = rows()) =>
  comparePersonalSecAnnualEvidence(packet(observations), "Revenues");

function historyRows() {
  const older = {
    startDate: "2023-01-01",
    endDate: "2023-12-31",
    durationDays: 365,
  };
  return [
    ...rows(),
    row(5, true, false, "80", older),
    row(6, true, true, "4", older),
  ];
}

describe("bounded same-filing annual history", () => {
  it("returns three contiguous dated periods with exact signed amounts and all references", () => {
    const result = resolvePersonalSecAnnualHistory(
      packet(historyRows().reverse()),
      "Revenues",
    );
    expect(result).toMatchObject({
      status: "available",
      accessionNumber: target.accessionNumber,
      stoppedReason: null,
      periods: [
        {
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          revenue: "120",
          netIncome: "15",
          netMarginPercent: "12.5",
        },
        {
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          revenue: "100",
          netIncome: "10",
          netMarginPercent: "10",
        },
        {
          startDate: "2023-01-01",
          endDate: "2023-12-31",
          revenue: "80",
          netIncome: "4",
          netMarginPercent: "5",
        },
      ],
    });
    if (result.status !== "available") throw new Error("Expected history");
    expect(new Set(result.periods.flatMap((p) => p.observationIds))).toEqual(
      new Set(historyRows().map((r) => r.id)),
    );
    expect(Object.isFrozen(result.periods)).toBe(true);
    expect(
      result.periods.every(
        (p) => Object.isFrozen(p) && Object.isFrozen(p.observationIds),
      ),
    ).toBe(true);
  });

  it("stops at three without adding an older fourth period", () => {
    const oldest = {
      startDate: "2022-01-01",
      endDate: "2022-12-31",
      durationDays: 365,
    };
    const result = resolvePersonalSecAnnualHistory(
      packet([
        ...historyRows(),
        row(7, true, false, "60", oldest),
        row(8, true, true, "3", oldest),
      ]),
      "Revenues",
    );
    expect(result).toMatchObject({ status: "available", stoppedReason: null });
    if (result.status !== "available") throw new Error("Expected history");
    expect(result.periods.map((p) => p.endDate)).toEqual([
      "2025-12-31",
      "2024-12-31",
      "2023-12-31",
    ]);
  });

  it.each(["0", "-80"])(
    "keeps older revenue %s and signed income without fabricating margin",
    (revenue) => {
      const input = packet(
        historyRows().map((r) =>
          r.id === row(5, true, false, "80").id ? { ...r, value: revenue } : r,
        ),
      );
      const result = resolvePersonalSecAnnualHistory(input, "Revenues");
      expect(result).toMatchObject({
        status: "available",
        periods: [{}, {}, { revenue, netIncome: "4", netMarginPercent: null }],
      });
    },
  );

  it("retains two admitted periods when third income is missing", () => {
    const input = packet(
      historyRows().filter((r) => r.id !== row(6, true, true, "4").id),
    );
    const result = resolvePersonalSecAnnualHistory(input, "Revenues");
    expect(result).toMatchObject({
      status: "available",
      stoppedReason: "previous_period_missing",
    });
    if (result.status !== "available") throw new Error("Expected history");
    expect(result.periods).toHaveLength(2);
    expect(comparePersonalSecAnnualEvidence(input, "Revenues")).toMatchObject({
      status: "available",
      revenue: { difference: "20" },
    });
  });

  it("does not skip a missing middle period or mix revenue bases", () => {
    for (const input of [
      packet(historyRows().filter((r) => r.endDate !== "2024-12-31")),
      packet(
        historyRows().map((r) =>
          r.endDate === "2024-12-31" && r.metric === "revenue"
            ? { ...r, concept: "SalesRevenueNet" as const }
            : r,
        ),
      ),
    ]) {
      const result = resolvePersonalSecAnnualHistory(input, "Revenues");
      expect(result).toMatchObject({
        status: "available",
        stoppedReason: "previous_period_missing",
      });
      if (result.status !== "available") throw new Error("Expected history");
      expect(result.periods).toHaveLength(1);
    }
  });

  it.each([
    [{ value: "999" }, "previous_values_conflicted"],
    [
      { startDate: "2023-01-02", durationDays: 364 },
      "previous_period_ambiguous",
    ],
    [{ filedDate: "2026-01-31" }, "previous_period_invalid"],
  ] as const)(
    "stops before a conflicting or invalid third period %o",
    (changes, reason) => {
      const input = packet([
        ...historyRows(),
        row(7, true, false, "80", {
          startDate: "2023-01-01",
          endDate: "2023-12-31",
          durationDays: 365,
          ...changes,
        }),
      ]);
      const result = resolvePersonalSecAnnualHistory(input, "Revenues");
      expect(result).toMatchObject({
        status: "available",
        stoppedReason: reason,
      });
      if (result.status !== "available") throw new Error("Expected history");
      expect(result.periods).toHaveLength(2);
      expect(comparePersonalSecAnnualEvidence(input, "Revenues").status).toBe(
        "available",
      );
    },
  );

  it("keeps agreeing older references and refuses an invalid whole packet", () => {
    const extra = row(7, true, false, "80", {
      startDate: "2023-01-01",
      endDate: "2023-12-31",
      durationDays: 365,
      frame: "CY2023",
    });
    const result = resolvePersonalSecAnnualHistory(
      packet([...historyRows(), extra]),
      "Revenues",
    );
    if (result.status !== "available") throw new Error("Expected history");
    expect(result.periods[2]!.observationIds).toContain(extra.id);
    expect(() =>
      resolvePersonalSecAnnualHistory(
        packet([
          ...historyRows(),
          { ...extra, accessionNumber: "0000999999-25-000002" },
        ]),
        "Revenues",
      ),
    ).toThrow("Invalid annual SEC evidence input");
  });

  it("uses actual adjacent 52/53-week dates instead of filing-focus years", () => {
    const dates = [
      ["2024-09-29", "2025-09-27", 364],
      ["2023-10-01", "2024-09-28", 364],
      ["2022-09-25", "2023-09-30", 371],
    ] as const;
    const observations = historyRows().map((r, i) => ({
      ...r,
      startDate: dates[Math.floor(i / 2)]![0],
      endDate: dates[Math.floor(i / 2)]![1],
      durationDays: dates[Math.floor(i / 2)]![2],
      filing: { ...r.filing, reportDate: "2025-09-27" },
    }));
    const input = {
      ...packet(observations),
      target: { ...target, reportDate: "2025-09-27" },
    };
    const result = resolvePersonalSecAnnualHistory(input, "Revenues");
    expect(result).toMatchObject({ status: "available", stoppedReason: null });
    if (result.status !== "available") throw new Error("Expected history");
    expect(result.periods.map((p) => p.endDate)).toEqual(
      dates.map((d) => d[1]),
    );
  });

  it("honors current-use eligibility and preserves large exact older decimals", () => {
    const input = packet(
      historyRows().map((r) =>
        r.endDate === "2023-12-31"
          ? {
              ...r,
              value:
                r.metric === "revenue"
                  ? "9007199254740993123.0000000001"
                  : "-1.0000000001",
            }
          : r,
      ),
    );
    expect(resolvePersonalSecAnnualHistory(input, "Revenues")).toMatchObject({
      status: "available",
      periods: [
        {},
        {},
        {
          revenue: "9007199254740993123.0000000001",
          netIncome: "-1.0000000001",
        },
      ],
    });
    const stale = {
      ...input,
      generation: {
        ...input.generation,
        cutoffAt: "2027-09-20T06:00:00.000Z",
        completedAt: "2027-09-20T06:00:03.000Z",
        sources: {
          companyFacts: {
            ...input.generation.sources.companyFacts,
            fetchedAt: "2027-09-20T06:00:01.000Z",
          },
          submissions: {
            ...input.generation.sources.submissions,
            fetchedAt: "2027-09-20T06:00:02.000Z",
          },
        },
      },
    };
    expect(resolvePersonalSecAnnualHistory(stale, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
  });
});

describe("same-filing reported annual comparison", () => {
  it.each([
    ["120", "15", "100", "10", "12.5", "10", "2.5", "higher"],
    ["120", "15", "100", "-10", "12.5", "-10", "22.5", "higher"],
    ["120", "-15", "100", "10", "-12.5", "10", "-22.5", "lower"],
    ["120", "0", "100", "0", "0", "0", "0", "unchanged"],
    ["120", "12", "100", "10", "10", "10", "0", "unchanged"],
    ["100", "1.004", "100", "0.999", "1", "1", "0.01", "higher"],
    ["100", "0.999", "100", "1.004", "1", "1", "-0.01", "lower"],
    ["100", "1.005", "100", "1.004", "1.01", "1", "0", "higher"],
    ["100", "1.004", "100", "1.005", "1", "1.01", "0", "lower"],
  ])(
    "compares unrounded reported margins for current %s/%s and prior %s/%s",
    (
      currentRevenue,
      currentIncome,
      priorRevenue,
      priorIncome,
      current,
      prior,
      difference,
      direction,
    ) => {
      const result = compare([
        row(1, false, false, currentRevenue),
        row(2, false, true, currentIncome),
        row(3, true, false, priorRevenue),
        row(4, true, true, priorIncome),
      ]);
      expect(result).toMatchObject({
        status: "available",
        netMargin: {
          status: "available",
          prior,
          current,
          difference,
          direction,
        },
      });
      if (result.status !== "available") throw new Error("Expected comparison");
      expect(Object.isFrozen(result.netMargin)).toBe(true);
    },
  );

  it("keeps a ratio change beyond Number precision and preserves its direction", () => {
    const result = compare([
      row(1, false, false, "9007199254740993123.0000000001"),
      row(2, false, true, "9007199254740993123.0000000002"),
      row(3, true, false, "9007199254740993123.0000000001"),
      row(4, true, true, "9007199254740993123.0000000001"),
    ]);
    expect(result).toMatchObject({
      status: "available",
      netMargin: {
        status: "available",
        prior: "100",
        current: "100",
        difference: "0",
        direction: "higher",
      },
    });
  });

  it("uses each named revenue basis for both margins", () => {
    const input = packet([
      ...rows(),
      row(5, false, false, "60", { concept: "SalesRevenueNet" }),
      row(6, true, false, "60", { concept: "SalesRevenueNet" }),
    ]);
    expect(comparePersonalSecAnnualEvidence(input, "Revenues")).toMatchObject({
      netMargin: { current: "12.5", prior: "10", difference: "2.5" },
    });
    expect(
      comparePersonalSecAnnualEvidence(input, "SalesRevenueNet"),
    ).toMatchObject({
      netMargin: { current: "25", prior: "16.67", difference: "8.33" },
    });
  });

  it("compares adjacent leap/calendar years, retains all operand references and leaves prior rows ineligible as current pairs", () => {
    const input = packet();
    const original = JSON.stringify(input);
    const result = comparePersonalSecAnnualEvidence(input, "Revenues");
    expect(result).toMatchObject({
      status: "available",
      priorStartDate: "2024-01-01",
      priorEndDate: "2024-12-31",
      currentStartDate: "2025-01-01",
      currentEndDate: "2025-12-31",
      revenue: {
        prior: "100",
        current: "120",
        difference: "20",
        percent: { status: "available", value: "20" },
      },
      netIncome: {
        difference: "5",
        percent: { status: "available", value: "50" },
      },
    });
    if (result.status !== "available") throw new Error("Expected comparison");
    expect(new Set(result.observationIds)).toEqual(
      new Set(input.observations.map((r) => r.id)),
    );
    expect(Object.isFrozen(result.revenue.percent)).toBe(true);
    expect(JSON.stringify(input)).toBe(original);
    const resolution = resolvePersonalSecAnnualEvidence(input);
    expect(
      resolution.pairs.find((pair) => pair.endDate === "2024-12-31")?.status,
    ).toBe("report_end_mismatch");
    expect(
      resolution.bases.find((basis) => basis.concept === "Revenues")?.status,
    ).toBe("eligible");
  });

  it("accepts consecutive 52/53-week annual periods without equating filing focus to observation year", () => {
    const input = {
      ...packet(
        rows().map((r, i) => ({
          ...r,
          startDate: i < 2 ? "2024-12-29" : "2023-12-24",
          endDate: i < 2 ? "2025-12-27" : "2024-12-28",
          durationDays: i < 2 ? 364 : 371,
          filing: { ...r.filing, reportDate: "2025-12-27" },
        })),
      ),
      target: { ...target, reportDate: "2025-12-27" },
    };
    expect(comparePersonalSecAnnualEvidence(input, "Revenues")).toMatchObject({
      status: "available",
      priorEndDate: "2024-12-28",
      currentStartDate: "2024-12-29",
    });
  });

  it("preserves decimals beyond Number precision and rounds one exact division half up", () => {
    const result = compare([
      row(1, false, false, "9007199254740993123.0000000002"),
      row(2, false, true, "1.00005"),
      row(3, true, false, "9007199254740993123.0000000001"),
      row(4, true, true, "1"),
    ]);
    expect(result).toMatchObject({
      status: "available",
      revenue: {
        difference: "0.0000000001",
        percent: { status: "available", value: "0" },
      },
      netIncome: { percent: { status: "available", value: "0.01" } },
    });
  });

  it.each(["0", "-10"])(
    "keeps amounts and exact difference while withholding percentage for prior %s",
    (prior) => {
      const result = compare([
        row(1, false, false, "120"),
        row(2, false, true, "-15"),
        row(3, true, false, prior),
        row(4, true, true, prior),
      ]);
      expect(result).toMatchObject({
        status: "available",
        revenue: {
          prior,
          percent: {
            status: "unavailable",
            reason: prior === "0" ? "zero_prior" : "negative_prior",
          },
        },
        netIncome: {
          current: "-15",
          difference: prior === "0" ? "-15" : "-5",
          percent: { status: "unavailable" },
        },
        netMargin: {
          status: "unavailable",
          current: "-12.5",
          reason:
            prior === "0" ? "zero_prior_revenue" : "negative_prior_revenue",
        },
      });
    },
  );

  it("reports signed loss change against a positive prior without replacing NetIncomeLoss", () => {
    expect(
      compare([
        row(1, false, false, "120"),
        row(2, false, true, "-5"),
        row(3, true, false, "100"),
        row(4, true, true, "10"),
      ]),
    ).toMatchObject({
      status: "available",
      netIncome: {
        difference: "-15",
        percent: { status: "available", value: "-150" },
      },
    });
  });

  it("retains agreeing duplicate references but refuses conflicting revenue or income", () => {
    expect(
      compare([...rows(), row(5, true, false, "100", { frame: "CY2024" })]),
    ).toMatchObject({ status: "available" });
    for (const income of [false, true])
      expect(compare([...rows(), row(5, true, income, "999")])).toEqual({
        status: "unavailable",
        reason: "previous_values_conflicted",
      });
  });

  it("keeps revenue bases separate and refuses missing or nonadjacent periods without an older fallback", () => {
    const input = packet();
    expect(comparePersonalSecAnnualEvidence(input, "SalesRevenueNet")).toEqual({
      status: "unavailable",
      reason: "current_report_unavailable",
    });
    expect(
      compare(
        rows().filter(
          (r) => r.metric !== "revenue" || r.endDate !== "2024-12-31",
        ),
      ),
    ).toEqual({ status: "unavailable", reason: "previous_period_missing" });
    expect(
      compare(
        rows().map((r, i) =>
          i < 2 ? r : { ...r, endDate: "2024-12-30", durationDays: 365 },
        ),
      ),
    ).toEqual({ status: "unavailable", reason: "previous_period_missing" });
    expect(
      compare(
        rows().map((r, i) =>
          i !== 2 ? r : { ...r, concept: "SalesRevenueNet" },
        ),
      ),
    ).toEqual({ status: "unavailable", reason: "previous_period_missing" });
  });

  it("rejects distinct annual starts even if values agree", () => {
    expect(
      compare([
        ...rows(),
        row(5, true, false, "100", {
          startDate: "2024-01-02",
          durationDays: 365,
        }),
      ]),
    ).toEqual({ status: "unavailable", reason: "previous_period_ambiguous" });
  });

  it.each([
    { filingFocusPeriod: "Q4" as const },
    { form: "10-K/A" },
    { durationDays: 365 },
    { filing: { ...rows()[2]!.filing, status: "metadata_conflict" as const } },
    { filing: { ...rows()[2]!.filing, reportDate: "2024-12-31" } },
  ])("refuses invalid prior annual metadata %j", (changes) => {
    expect(
      compare(rows().map((r, i) => (i === 2 ? { ...r, ...changes } : r))),
    ).toEqual({ status: "unavailable", reason: "previous_period_invalid" });
  });

  it("requires the selected filing's accepted time for both current and comparative inputs", () => {
    for (const index of [0, 2])
      expect(
        compare(
          rows().map((r, i) =>
            i === index
              ? {
                  ...r,
                  filing: {
                    ...r.filing,
                    acceptedAt: "2026-02-01T17:00:00.000Z",
                  },
                }
              : r,
          ),
        ),
      ).toEqual({ status: "unavailable", reason: "filing_metadata_mismatch" });
  });

  it("withholds old current-use reports and refused source packets", () => {
    const original = packet();
    const input = {
      ...original,
      generation: {
        ...original.generation,
        cutoffAt: "2027-09-20T06:00:00.000Z",
        completedAt: "2027-09-20T06:00:03.000Z",
        sources: {
          companyFacts: {
            ...original.generation.sources.companyFacts,
            fetchedAt: "2027-09-20T06:00:01.000Z",
          },
          submissions: {
            ...original.generation.sources.submissions,
            fetchedAt: "2027-09-20T06:00:02.000Z",
          },
        },
      },
    };
    expect(comparePersonalSecAnnualEvidence(input, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
    const empty = packet([]);
    const refused: PersonalSecAnnualResolutionInput = {
      ...empty,
      generation: {
        ...empty.generation,
        sources: {
          ...empty.generation.sources,
          companyFacts: {
            ...empty.generation.sources.companyFacts,
            status: "upstream_unavailable",
            fetchedAt: null,
            sha256: null,
            bytes: null,
          },
        },
      },
      coverage: null,
      completeness: { status: "refused", reason: "source_unavailable" },
    };
    expect(comparePersonalSecAnnualEvidence(refused, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_report_unavailable",
    });
  });

  it("does not accept another accession or incomplete structural input", () => {
    expect(() =>
      compare(
        rows().map((r, i) =>
          i === 2 ? { ...r, accessionNumber: "0000999999-25-000001" } : r,
        ),
      ),
    ).toThrow("Invalid annual SEC evidence input");
    const input: PersonalSecAnnualResolutionInput = {
      ...packet(),
      completeness: { status: "refused", reason: "selected_report_overflow" },
    };
    expect(() => comparePersonalSecAnnualEvidence(input, "Revenues")).toThrow(
      "Invalid annual SEC evidence input",
    );
  });
});
