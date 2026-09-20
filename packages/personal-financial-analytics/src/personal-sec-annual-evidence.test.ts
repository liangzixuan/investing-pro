import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCoverageDto,
  type PersonalSecAnnualFilingDto,
  type PersonalSecAnnualResolutionInput,
  type PersonalSecAnnualTargetDto,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
  selectPersonalSecAnnualTarget,
  serializePersonalSecAnnualGeneration,
} from "./personal-sec-annual-evidence";

const accession = "0000999999-26-000001";
const cutoffAt = "2026-09-20T06:00:00.000Z";
const fetchedAt = "2026-09-20T06:00:01.000Z";
const completedAt = "2026-09-20T06:00:03.000Z";
const filing = (
  changes: Partial<PersonalSecAnnualFilingDto> = {},
): PersonalSecAnnualFilingDto => ({
  accessionNumber: accession,
  form: "10-K",
  filedDate: "2026-02-01",
  reportDate: "2025-12-31",
  acceptedAt: "2026-02-01T16:00:00.000Z",
  ...changes,
});
function observation(
  index: number,
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${index.toString(16).padStart(64, "0")}`,
    metric: "revenue",
    taxonomy: "us-gaap",
    concept: "Revenues",
    unit: "USD",
    value: "100",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    durationDays: 365,
    periodBasis: "unresolved",
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: null,
    accessionNumber: accession,
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/Revenues/units/USD/${String(index)}`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
    },
    ...changes,
  };
}
const income = (
  index = 2,
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
) =>
  observation(index, {
    metric: "net_income",
    concept: "NetIncomeLoss",
    value: "12",
    sourceLocator: `/facts/us-gaap/NetIncomeLoss/units/USD/${String(index)}`,
    ...changes,
  });
function coverage(
  rows: readonly PersonalSecQuarterlyObservationDto[],
): PersonalSecAnnualCoverageDto {
  const revenue = rows.filter((r) => r.metric === "revenue").length;
  const selected = {
    observations: rows.length,
    revenue,
    netIncome: rows.length - revenue,
  };
  return {
    full: {
      ...selected,
      inspectedRows: rows.length,
      invalidRows: 0,
      duplicateRows: 0,
      uniqueObservations: rows.length,
      conceptsWithoutUsd: [],
    },
    selected,
    otherAccessions: { observations: 0, revenue: 0, netIncome: 0 },
    returned: { ...selected },
    omittedSelected: { observations: 0, revenue: 0, netIncome: 0 },
    history: { returned: { ...selected }, truncated: false },
  };
}
function input(
  rows = [observation(1), income()],
  changes: Partial<PersonalSecAnnualResolutionInput> = {},
): PersonalSecAnnualResolutionInput {
  const target = selectPersonalSecAnnualTarget([filing()], cutoffAt, fetchedAt);
  return {
    cik: "0000000042",
    generation: {
      definitionVersion: "1.0.0",
      cutoffAt,
      completedAt,
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
          fetchedAt,
          sha256: `sha256:${"c".repeat(64)}`,
          bytes: 500,
        },
      },
    },
    target,
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    completeness: { status: "complete", reason: null },
    coverage: coverage(rows),
    observations: rows,
    ...changes,
  };
}
const resolve = (rows = [observation(1), income()]) =>
  resolvePersonalSecAnnualEvidence(input(rows));
const revenues = (result: ReturnType<typeof resolve>) => result.bases[1]!;
const rejected = (
  rows: PersonalSecQuarterlyObservationDto[],
  reason: string,
) => {
  const result = resolve(rows);
  expect(revenues(result).status).toBe("rejected");
  expect(revenues(result).pairs[0]?.status).toBe(reason);
  expect(revenues(result).pairs[0]?.netMarginPercent).toBeNull();
  expect(result.currentTargetEligible).toBe(false);
  return result;
};

describe("observed annual target selection", () => {
  it("chooses greatest report date then filed date, independent of input order or financial availability", () => {
    const later = filing({
      accessionNumber: "0000999999-26-000002",
      reportDate: "2026-06-30",
      filedDate: "2026-08-01",
      acceptedAt: "2026-08-01T16:00:00.000Z",
    });
    const laterFiled = {
      ...later,
      accessionNumber: "0000999999-26-000003",
      filedDate: "2026-08-02",
      acceptedAt: "2026-08-02T16:00:00.000Z",
    };
    const expected = { status: "target", ...laterFiled };
    expect(
      selectPersonalSecAnnualTarget(
        [laterFiled, filing(), later],
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual(expected);
    expect(
      selectPersonalSecAnnualTarget(
        [later, laterFiled, filing()],
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual(expected);
  });
  it("keeps an exact metadata tie unresolved rather than taking first", () => {
    expect(
      selectPersonalSecAnnualTarget(
        [filing(), filing({ accessionNumber: "0000999999-26-000002" })],
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual({ status: "unresolved", reason: "target_ambiguous" });
  });
  it("supports unamended20-F while ignoring amendments and quarterly rows", () => {
    const selected = filing({ form: "20-F" });
    expect(
      selectPersonalSecAnnualTarget(
        [
          selected,
          filing({ accessionNumber: "0000999999-26-000002", form: "10-K/A" }),
          filing({ accessionNumber: "0000999999-26-000003", form: "10-Q" }),
        ],
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual({ status: "target", ...selected });
  });
  it("retains unresolved annual report metadata even when an older convenient report exists", () => {
    expect(
      selectPersonalSecAnnualTarget(
        [
          filing(),
          filing({ accessionNumber: "0000999999-26-000002", reportDate: null }),
        ],
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual({ status: "unresolved", reason: "target_missing_report_date" });
  });
  it("does not treat unknown same-day acceptance as before the cutoff", () => {
    expect(
      selectPersonalSecAnnualTarget(
        [filing({ filedDate: "2026-09-20", acceptedAt: null })],
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual({ status: "unresolved", reason: "cutoff_time_unresolved" });
  });
  it("excludes known after-cutoff acceptance before selecting the observed target", () => {
    const future = filing({
      accessionNumber: "0000999999-26-000002",
      filedDate: "2026-09-20",
      reportDate: "2026-06-30",
      acceptedAt: "2026-09-20T07:00:00.000Z",
    });
    expect(
      selectPersonalSecAnnualTarget([future, filing()], cutoffAt, fetchedAt),
    ).toEqual({ status: "target", ...filing() });
    expect(
      selectPersonalSecAnnualTarget([future], cutoffAt, fetchedAt),
    ).toEqual({ status: "unresolved", reason: "no_observed_annual_target" });
  });
  it.each(["2026-02-30", "2026-2-01"])(
    "rejects malformed normalized metadata date%s",
    (filedDate) => {
      expect(
        selectPersonalSecAnnualTarget(
          [filing({ filedDate })],
          cutoffAt,
          fetchedAt,
        ),
      ).toEqual({ status: "unresolved", reason: "invalid_submissions" });
    },
  );
  it("rejects duplicate accession inputs and more than10000 normalized filings", () => {
    expect(
      selectPersonalSecAnnualTarget([filing(), filing()], cutoffAt, fetchedAt),
    ).toEqual({ status: "unresolved", reason: "invalid_submissions" });
    expect(
      selectPersonalSecAnnualTarget(
        Array.from({ length: 10001 }, () => filing()),
        cutoffAt,
        fetchedAt,
      ),
    ).toEqual({ status: "unresolved", reason: "invalid_submissions" });
  });
  it("distinguishes unavailable source from empty current annual coverage", () => {
    expect(selectPersonalSecAnnualTarget(null, cutoffAt, fetchedAt)).toEqual({
      status: "unresolved",
      reason: "submissions_unavailable",
    });
    expect(selectPersonalSecAnnualTarget([], cutoffAt, fetchedAt)).toEqual({
      status: "unresolved",
      reason: "no_observed_annual_target",
    });
  });
  it("rejects a capture preceding the operation cutoff", () => {
    expect(
      selectPersonalSecAnnualTarget(
        [filing()],
        cutoffAt,
        "2026-09-20T05:59:59.000Z",
      ),
    ).toEqual({ status: "unresolved", reason: "invalid_clock" });
  });
  it("rejects acceptance before the report period without falling back, while admitting report-date midnight", () => {
    const latest = filing({
      accessionNumber: "0000999999-26-000002",
      reportDate: "2026-06-30",
      filedDate: "2026-08-01",
      acceptedAt: "2026-06-29T23:59:59.999Z",
    });
    expect(
      selectPersonalSecAnnualTarget([filing(), latest], cutoffAt, fetchedAt),
    ).toEqual({ status: "unresolved", reason: "future_or_inconsistent_dates" });
    const boundary = { ...latest, acceptedAt: "2026-06-30T00:00:00.000Z" };
    expect(
      selectPersonalSecAnnualTarget([filing(), boundary], cutoffAt, fetchedAt),
    ).toEqual({ status: "target", ...boundary });
  });
});

describe("bounded annual pair resolution", () => {
  it.each(["revenue", "net_income"] as const)(
    "rejects acceptance before report end in a non-first %s reference",
    (metric) => {
      const bad = metric === "revenue" ? observation(3) : income(3);
      const result = rejected(
        [
          observation(1),
          income(),
          {
            ...bad,
            filing: {
              ...bad.filing,
              acceptedAt: "2025-12-30T23:59:59.999Z",
            },
          },
        ],
        metric === "revenue"
          ? "future_or_inconsistent_dates"
          : "income_metadata_or_period_invalid",
      );
      expect(revenues(result).pairs[0]?.subordinateReasons).toContain(
        "future_or_inconsistent_dates",
      );
      expect(revenues(result).pairs[0]?.revenueObservationIds).toHaveLength(
        metric === "revenue" ? 2 : 1,
      );
      expect(revenues(result).pairs[0]?.incomeObservationIds).toHaveLength(
        metric === "net_income" ? 2 : 1,
      );
    },
  );
  it("returns all three bases and exact ordered reference identities", () => {
    const result = resolve([
      observation(1),
      observation(3, { frame: "CY2025" }),
      income(),
    ]);
    expect(result.bases.map((b) => b.status)).toEqual([
      "missing",
      "eligible",
      "missing",
    ]);
    expect(result.bases.map((b) => b.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
    );
    expect(revenues(result).pairs[0]).toMatchObject({
      revenue: "100",
      netIncome: "12",
      netMarginPercent: "12",
      revenueObservationIds: [observation(1).id, observation(3).id],
      incomeObservationIds: [income().id],
    });
    expect(result.currentTargetEligible).toBe(true);
  });
  it("different revenue bases stay separate, including signed margins", () => {
    const result = resolve([
      observation(1, { value: "3" }),
      observation(3, {
        concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
        value: "4",
      }),
      observation(4, { concept: "SalesRevenueNet", value: "8" }),
      income(2, { value: "-1" }),
    ]);
    expect(result.bases.map((b) => b.pairs[0]?.netMarginPercent)).toEqual([
      "-25",
      "-33.33",
      "-12.5",
    ]);
  });
  it.each([
    ["9007199254740993", "9007199254740993", "100"],
    ["200", "1.01", "0.51"],
    ["200", "-1.01", "-0.51"],
    ["100", "0", "0"],
    ["3", "-1", "-33.33"],
  ])(
    "computes%s/%s with exact decimal half-up result%s",
    (revenue, netIncome, expected) => {
      expect(
        revenues(
          resolve([
            observation(1, { value: revenue }),
            income(2, { value: netIncome }),
          ]),
        ).pairs[0]?.netMarginPercent,
      ).toBe(expected);
    },
  );
  it.each(["0", "-1"])(
    "rejects nonpositive revenue%s without numeric admission",
    (value) => {
      rejected([observation(1, { value }), income()], "nonpositive_revenue");
    },
  );
  it("missing income preserves the selected report rather than inventing zero", () => {
    const result = rejected(
      [observation(1)],
      "income_missing_same_filing_period",
    );
    expect(revenues(result).pairs[0]?.subordinateReasons).toContain(
      "no_income_observations",
    );
  });
  it("comparative periods remain inspectable but cannot supply selected report income", () => {
    const result = rejected(
      [
        observation(1),
        income(2, {
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          durationDays: 366,
        }),
      ],
      "income_missing_same_filing_period",
    );
    expect(revenues(result).pairs[0]?.subordinateReasons).toContain(
      "income_only_other_period_or_accession",
    );
  });
  it("rejects a late conflicting value with every reference retained", () => {
    const result = rejected(
      [observation(1), observation(3, { value: "101" }), income()],
      "ambiguous_revenue_period_or_value",
    );
    expect(revenues(result).pairs[0]?.revenueObservationIds).toHaveLength(2);
  });
  it("distinct annual starts prevent first-start selection", () => {
    const result = rejected(
      [
        observation(1),
        observation(3, { startDate: "2024-12-30", durationDays: 367 }),
        income(),
      ],
      "ambiguous_revenue_period_or_value",
    );
    expect(
      result.pairs.every(
        (p) => p.status === "ambiguous_revenue_period_or_value",
      ),
    ).toBe(true);
  });
  it("non-first revenue FY/form/filing metadata cannot hide behind a good row", () => {
    for (const changes of [
      { filingFocusPeriod: "Q4" },
      { form: "10-K/A" },
      { filedDate: "2026-02-02" },
    ] as const) {
      const result = resolve([
        observation(1),
        observation(3, changes),
        income(),
      ]);
      expect(revenues(result).status).toBe("rejected");
      expect(result.currentTargetEligible).toBe(false);
    }
  });
  it("all matching income references are checked before value conflicts/domain", () => {
    const result = rejected(
      [
        observation(1, { value: "0" }),
        income(),
        income(3, { filingFocusPeriod: "Q4", value: "13" }),
      ],
      "income_metadata_or_period_invalid",
    );
    expect(revenues(result).pairs[0]?.incomeObservationIds).toHaveLength(2);
    expect(revenues(result).pairs[0]?.subordinateReasons).toContain(
      "missing_or_non_FY_focus",
    );
  });
  it("income value disagreement refuses numeric values", () => {
    rejected(
      [observation(1), income(), income(3, { value: "13" })],
      "ambiguous_income_value",
    );
  });
  it("period and filing mismatch take precedence over nonpositive revenue", () => {
    rejected(
      [observation(1, { value: "0", durationDays: 364 }), income()],
      "invalid_annual_period",
    );
    rejected(
      [
        observation(1, {
          value: "0",
          filing: { ...observation(1).filing, status: "metadata_conflict" },
        }),
        income(),
      ],
      "filing_unmatched_or_conflicted",
    );
  });
  it.each([334, 396])(
    "rejects duration%d outside335-395 without inferring annual basis",
    (durationDays) => {
      rejected(
        [observation(1, { durationDays }), income()],
        "invalid_annual_period",
      );
    },
  );
  it("keeps comparative rejected pairs while selected-end pair remains independent", () => {
    const result = resolve([
      observation(1),
      income(),
      observation(3, {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      }),
      income(4, {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      }),
    ]);
    expect(result.pairs).toHaveLength(2);
    expect(revenues(result).pairs).toHaveLength(1);
    expect(result.pairs[1]?.status).toBe("report_end_mismatch");
    expect(result.currentTargetEligible).toBe(true);
  });
  it("complete empty evidence means three missing bases, not three zeros", () => {
    const result = resolve([]);
    expect(result.bases.map((b) => b.status)).toEqual([
      "missing",
      "missing",
      "missing",
    ]);
    expect(result.pairs).toEqual([]);
    expect(result.currentTargetEligible).toBe(false);
  });
  it("same-period exact report may be valid yet older than485 days", () => {
    const base = input();
    const old = resolvePersonalSecAnnualEvidence({
      ...base,
      generation: {
        ...base.generation,
        cutoffAt: "2027-09-20T06:00:00.000Z",
        completedAt: "2027-09-20T06:00:03.000Z",
        sources: {
          companyFacts: {
            ...base.generation.sources.companyFacts,
            fetchedAt: "2027-09-20T06:00:02.000Z",
          },
          submissions: {
            ...base.generation.sources.submissions,
            fetchedAt: "2027-09-20T06:00:01.000Z",
          },
        },
      },
    });
    expect(old.selectedReportPairEligible).toBe(true);
    expect(old.utilityAge?.withinWindow).toBe(false);
    expect(old.currentTargetEligible).toBe(false);
  });
  it("does not mutate or freeze caller-owned references", () => {
    const rows = [observation(1), income()];
    const result = resolve(rows);
    expect(Object.isFrozen(rows)).toBe(false);
    expect(Object.isFrozen(rows[0])).toBe(false);
    expect(
      Object.isFrozen(revenues(result).pairs[0]?.revenueObservationIds),
    ).toBe(true);
    expect(Object.isFrozen(result.utilityAge?.sourceAgeDays)).toBe(true);
  });
});

describe("global refusal and immutable generation", () => {
  it("source failure withholds all pairs regardless of otherwise available rows", () => {
    const original = input();
    const value = {
      ...original,
      observations: [],
      generation: {
        ...original.generation,
        sources: {
          ...original.generation.sources,
          companyFacts: {
            ...original.generation.sources.companyFacts,
            status: "invalid_response" as const,
          },
        },
      },
      completeness: {
        status: "refused" as const,
        reason: "source_unavailable" as const,
      },
    };
    const result = resolvePersonalSecAnnualEvidence(value);
    expect(result.pairs).toEqual([]);
    expect(result.bases.map((b) => b.status)).toEqual([
      "withheld",
      "withheld",
      "withheld",
    ]);
    expect(() =>
      resolvePersonalSecAnnualEvidence({
        ...value,
        observations: original.observations,
      }),
    ).toThrow();
  });
  it("any invalid full-scan row blocks even if selected rows are good", () => {
    const original = input();
    const value = {
      ...original,
      observations: [],
      coverage: {
        ...original.coverage!,
        full: { ...original.coverage!.full, inspectedRows: 3, invalidRows: 1 },
      },
      completeness: {
        status: "refused" as const,
        reason: "invalid_source_rows" as const,
      },
    };
    expect(getPersonalSecAnnualRefusalReason(value)).toBe(
      "invalid_source_rows",
    );
    expect(
      resolvePersonalSecAnnualEvidence(value).selectedReportPairEligible,
    ).toBe(false);
  });
  it("unresolved metadata target never triggers older-pair resolution", () => {
    const value = input([], {
      target: { status: "unresolved", reason: "target_ambiguous" },
      completeness: { status: "refused", reason: "target_unresolved" },
    });
    expect(
      resolvePersonalSecAnnualEvidence(value).bases.every(
        (b) => b.status === "withheld",
      ),
    ).toBe(true);
  });
  it("all selected rows count collectively toward100revenue and100income caps", () => {
    const original = input();
    for (const metric of ["revenue", "netIncome"] as const) {
      const value = {
        ...original,
        observations: [],
        coverage: {
          ...original.coverage!,
          selected: {
            observations: 102,
            revenue: metric === "revenue" ? 101 : 1,
            netIncome: metric === "netIncome" ? 101 : 1,
          },
        },
        completeness: {
          status: "refused" as const,
          reason: "selected_report_overflow" as const,
        },
      };
      expect(resolvePersonalSecAnnualEvidence(value).pairs).toEqual([]);
    }
  });
  it("forged complete status and foreign accession/duplicate IDs are rejected", () => {
    const base = input();
    expect(() =>
      resolvePersonalSecAnnualEvidence({ ...base, coverage: null }),
    ).toThrow();
    expect(() =>
      resolvePersonalSecAnnualEvidence(
        input([
          observation(1),
          income(2, { accessionNumber: "0000999999-26-000002" }),
        ]),
      ),
    ).toThrow();
    expect(() =>
      resolvePersonalSecAnnualEvidence(input([observation(1), income(1)])),
    ).toThrow();
  });
  it("history truncation is truthful but is not selected-report incompleteness", () => {
    const base = input();
    const result = resolvePersonalSecAnnualEvidence({
      ...base,
      coverage: {
        ...base.coverage!,
        history: {
          returned: { observations: 100, revenue: 99, netIncome: 1 },
          truncated: true,
        },
        full: {
          ...base.coverage!.full,
          observations: 150,
          revenue: 149,
          netIncome: 1,
          inspectedRows: 150,
          uniqueObservations: 150,
        },
        otherAccessions: { observations: 148, revenue: 148, netIncome: 0 },
      },
    });
    expect(result.currentTargetEligible).toBe(true);
  });
  it.each(["2026-09-20T05:59:59.000Z", "2026-09-20T06:00:04.000Z"])(
    "capture%s outside load interval refuses",
    (capture) => {
      const base = input();
      const value = {
        ...base,
        generation: {
          ...base.generation,
          sources: {
            ...base.generation.sources,
            companyFacts: {
              ...base.generation.sources.companyFacts,
              fetchedAt: capture,
            },
          },
        },
      };
      expect(getPersonalSecAnnualRefusalReason(value)).toBe("invalid_clock");
      expect(() => resolvePersonalSecAnnualEvidence(value)).toThrow();
    },
  );
  it("generation serialization uses fixed scalar order and changes with either source or target", () => {
    const base = input();
    const serialized = serializePersonalSecAnnualGeneration(base);
    expect(
      serializePersonalSecAnnualGeneration({
        targetScan: base.targetScan,
        target: base.target,
        generation: base.generation,
        cik: base.cik,
      }),
    ).toBe(serialized);
    const changedDigest: PersonalSecAnnualResolutionInput = {
      ...base,
      generation: { ...base.generation, sha256: `sha256:${"d".repeat(64)}` },
    };
    expect(serializePersonalSecAnnualGeneration(changedDigest)).toBe(
      serialized,
    );
    for (const name of ["companyFacts", "submissions"] as const) {
      expect(
        serializePersonalSecAnnualGeneration({
          ...base,
          generation: {
            ...base.generation,
            sources: {
              ...base.generation.sources,
              [name]: {
                ...base.generation.sources[name],
                sha256: `sha256:${"d".repeat(64)}`,
              },
            },
          },
        }),
      ).not.toBe(serialized);
    }
    const target: PersonalSecAnnualTargetDto = {
      status: "unresolved",
      reason: "target_ambiguous",
    };
    expect(serializePersonalSecAnnualGeneration({ ...base, target })).not.toBe(
      serialized,
    );
    expect(serialized.startsWith('["personal-sec-annual-evidence",')).toBe(
      true,
    );
  });
});
