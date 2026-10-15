import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_OPERATING_LIMITS,
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCoverageDto,
  type PersonalSecAnnualOperatingAbsence,
  type PersonalSecAnnualOperatingMetricEvidenceDto,
  type PersonalSecAnnualOperatingObservationDto,
  type PersonalSecAnnualOperatingResolutionInput,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculatePersonalMarginPercent } from "./personal-margin";
import { resolvePersonalSecAnnualEvidence } from "./personal-sec-annual-evidence";
import { resolvePersonalSecAnnualOperatingResults as resolve } from "./personal-sec-annual-operating-results";

type Input = {
  -readonly [
    Key in keyof PersonalSecAnnualOperatingResolutionInput
  ]: PersonalSecAnnualOperatingResolutionInput[Key];
};
type Row = PersonalSecAnnualOperatingObservationDto;
const accession = "0000999999-26-000001";
function operating(index = 1, changes: Partial<Row> = {}): Row {
  return {
    id: `sec-fact:${index.toString(16).padStart(64, "0")}`,
    taxonomy: "us-gaap",
    metric: "operating_income",
    concept: "OperatingIncomeLoss",
    unit: "USD",
    value: "15",
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
    sourceLocator: `/facts/us-gaap/OperatingIncomeLoss/units/USD/${index - 1}`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accession}-index.htm`,
    },
    ...changes,
  };
}
function revenue(
  index = 101,
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  return {
    ...operating(index),
    metric: "revenue",
    concept: "Revenues",
    value: "100",
    sourceLocator: `/facts/us-gaap/Revenues/units/USD/${index - 101}`,
    ...changes,
  };
}
function metric(
  rows: readonly Row[],
  absence: PersonalSecAnnualOperatingAbsence | null = rows.length
    ? null
    : "empty_usd",
): PersonalSecAnnualOperatingMetricEvidenceDto {
  return {
    scan: {
      status: "available",
      absence,
      coverage: {
        full: {
          candidateRows: rows.length,
          inspectedRows: rows.length,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: rows.length,
        },
        selected: rows.length,
        otherAccessions: 0,
        returned: rows.length,
        omittedSelected: 0,
      },
    },
    observations: rows,
  };
}
function coverage(
  rows: readonly PersonalSecQuarterlyObservationDto[],
): PersonalSecAnnualCoverageDto {
  const selected = {
    observations: rows.length,
    revenue: rows.filter((row) => row.metric === "revenue").length,
    netIncome: rows.filter((row) => row.metric === "net_income").length,
  };
  const zero = { observations: 0, revenue: 0, netIncome: 0 };
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
    otherAccessions: { ...zero },
    returned: { ...selected },
    omittedSelected: { ...zero },
    history: { returned: { ...selected }, truncated: false },
  };
}
function input(op = [operating()], revenues = [revenue()]): Input {
  return {
    cik: "0000000042",
    generation: {
      definitionVersion: PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
      cutoffAt: "2026-09-20T06:00:00.000Z",
      completedAt: "2026-09-20T06:00:03.000Z",
      sha256: `sha256:${"a".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:02.000Z",
          bytes: 1000,
          sha256: `sha256:${"b".repeat(64)}`,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:01.000Z",
          bytes: 500,
          sha256: `sha256:${"c".repeat(64)}`,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: accession,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T16:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    incomeScanStatus: "available",
    completeness: { status: "complete", reason: null },
    coverage: coverage(revenues),
    observations: revenues,
    operatingResults: { operatingIncome: metric(op) },
  };
}
const resultMargin = (packet: Input) => resolve(packet).margins[1]!;

describe("Annual operating results", () => {
  it("resolves every separate revenue basis without net income and owns frozen result references", () => {
    const packet = input(
      [operating()],
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept, i) =>
        revenue(101 + i, { concept, value: String(100 * (i + 1)) }),
      ),
    );
    const before = structuredClone(packet);
    expect(
      resolvePersonalSecAnnualEvidence(packet).selectedReportPairEligible,
    ).toBe(false);
    const result = resolve(packet);
    expect(result.operatingIncome).toMatchObject({
      status: "available",
      unit: "USD",
      value: "15",
      currentUseEligible: true,
      observationIds: [operating().id],
    });
    expect(result.margins.map((row) => row.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
    );
    expect(result.margins.map((row) => row.operatingMargin)).toEqual(
      ["15", "7.5", "5"].map((value, i) => ({
        status: "available",
        unit: "percent",
        value,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        accessionNumber: accession,
        currentUseEligible: true,
        observationIds: [operating().id, revenue(101 + i).id],
      })),
    );
    expect(result.utilityAge).toMatchObject({
      endAgeDays: 263,
      withinWindow: true,
    });
    expect(packet).toEqual(before);
    expect(Object.isFrozen(packet)).toBe(false);
    expect(
      Object.isFrozen(result.margins[0]!.operatingMargin.observationIds),
    ).toBe(true);
    expect(result.margins[0]!.operatingMargin.observationIds).not.toBe(
      result.operatingIncome.observationIds,
    );
  });

  it.each([
    ["-15", "-15"],
    ["0", "0"],
    ["-0.000", "0"],
    ["0.00001", "0"],
    ["-0.00001", "0"],
  ])(
    "preserves signed operating amount %s and checked margin %s",
    (value, expected) => {
      const result = resolve(input([operating(1, { value })]));
      expect(result.operatingIncome).toMatchObject({
        status: "available",
        value: new Decimal(value).isZero() ? "0" : new Decimal(value).toFixed(),
      });
      expect(result.margins[1]!.operatingMargin).toMatchObject({
        status: "available",
        value: expected,
      });
    },
  );
  it.each(["0", "-1", "-0.00"])(
    "shows reported revenue %s but refuses its margin",
    (value) => {
      const result = resultMargin(
        input([operating()], [revenue(101, { value })]),
      );
      expect(result.revenue).toMatchObject({ status: "available" });
      expect(result.operatingMargin).toMatchObject({
        status: "unavailable",
        reason: "nonpositive_revenue",
        observationIds: [operating().id, revenue().id],
      });
    },
  );
  it("keeps an independent operating amount with no revenue and never borrows another basis", () => {
    const result = resolve(input([operating()], []));
    expect(result.operatingIncome).toMatchObject({
      status: "available",
      value: "15",
    });
    expect(
      result.margins.every((row) => row.revenue.status === "unavailable"),
    ).toBe(true);
    const onlyRevenues = resolve(input());
    expect(onlyRevenues.margins[0]!.operatingMargin).toMatchObject({
      status: "unavailable",
      reason: "no_report_period",
    });
    expect(onlyRevenues.margins[1]!.operatingMargin).toMatchObject({
      status: "available",
      value: "15",
    });
  });
  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "keeps revenue readable when operating scan says %s",
    (absence) => {
      const packet = input([]);
      packet.operatingResults = { operatingIncome: metric([], absence) };
      const result = resolve(packet);
      expect(result.operatingIncome).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
      expect(result.margins[1]!.revenue).toMatchObject({
        status: "available",
        value: "100",
      });
      expect(result.margins[1]!.operatingMargin).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
    },
  );
  it.each(["invalid_response", "candidate_limit"] as const)(
    "contains the isolated operating scan failure %s",
    (status) => {
      const packet = input();
      packet.operatingResults = {
        operatingIncome: {
          scan: { status, absence: null, coverage: null },
          observations: [],
        },
      };
      expect(resolve(packet).operatingIncome).toMatchObject({
        status: "unavailable",
        reason: status,
      });
      expect(resultMargin(packet).revenue).toMatchObject({
        status: "available",
      });
    },
  );
  it("keeps operating income when the complete income scan is unavailable", () => {
    const packet = input();
    packet.incomeScanStatus = "invalid_response";
    packet.coverage = null;
    packet.observations = [];
    packet.completeness = { status: "refused", reason: "source_unavailable" };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "available",
      value: "15",
    });
    expect(resultMargin(packet).operatingMargin).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
  });

  it.each(["invalid_source_rows", "selected_report_overflow"] as const)(
    "withholds refused revenue for %s while preserving the independent operating amount",
    (reason) => {
      const packet = input();
      const original = packet.coverage!;
      packet.observations = [];
      packet.completeness = { status: "refused", reason };
      packet.coverage =
        reason === "invalid_source_rows"
          ? {
              ...original,
              full: { ...original.full, inspectedRows: 2, invalidRows: 1 },
              returned: { observations: 0, revenue: 0, netIncome: 0 },
              omittedSelected: original.selected,
            }
          : {
              ...coverage(
                Array.from({ length: 101 }, (_, i) => revenue(101 + i)),
              ),
              returned: { observations: 0, revenue: 0, netIncome: 0 },
              omittedSelected: {
                observations: 101,
                revenue: 101,
                netIncome: 0,
              },
              history: {
                returned: { observations: 100, revenue: 100, netIncome: 0 },
                truncated: true,
              },
            };
      expect(resolve(packet).operatingIncome).toMatchObject({
        status: "available",
        value: "15",
      });
      expect(resultMargin(packet).operatingMargin).toMatchObject({
        status: "unavailable",
        reason,
      });
    },
  );

  it("refuses both results when the shared Company Facts source was not captured", () => {
    const packet = input([]);
    packet.generation = {
      ...packet.generation,
      sources: {
        ...packet.generation.sources,
        companyFacts: {
          ...packet.generation.sources.companyFacts,
          status: "upstream_unavailable",
          fetchedAt: null,
          sha256: null,
          bytes: null,
        },
      },
    };
    packet.incomeScanStatus = "source_unavailable";
    packet.coverage = null;
    packet.observations = [];
    packet.completeness = { status: "refused", reason: "source_unavailable" };
    packet.operatingResults = {
      operatingIncome: {
        scan: { status: "source_unavailable", absence: null, coverage: null },
        observations: [],
      },
    };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
    expect(resultMargin(packet).operatingMargin).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
  });

  it("retains all numerically agreeing references and counts duplicates without inventing observations", () => {
    const packet = input(
      [operating(), operating(2, { value: "15.000" })],
      [revenue(), revenue(102, { value: "100.00" })],
    );
    const m = packet.operatingResults.operatingIncome;
    if (m.scan.status !== "available") throw new Error();
    packet.operatingResults = {
      operatingIncome: {
        ...m,
        scan: {
          ...m.scan,
          coverage: {
            ...m.scan.coverage,
            full: {
              ...m.scan.coverage.full,
              candidateRows: 3,
              inspectedRows: 3,
              duplicateRows: 1,
            },
          },
        },
      },
    };
    expect(resultMargin(packet).operatingMargin).toMatchObject({
      status: "available",
      value: "15",
      observationIds: [
        operating().id,
        operating(2).id,
        revenue().id,
        revenue(102).id,
      ],
    });
  });
  it.each(["operating", "revenue"] as const)(
    "refuses conflicting %s values without hiding the independent operand",
    (side) => {
      const packet =
        side === "operating"
          ? input([operating(), operating(2, { value: "16" })])
          : input([operating()], [revenue(), revenue(102, { value: "101" })]);
      const result = resolve(packet);
      expect(result.margins[1]!.operatingMargin).toMatchObject({
        status: "unavailable",
        reason: "ambiguous_value",
      });
      expect(
        side === "operating"
          ? result.margins[1]!.revenue.status
          : result.operatingIncome.status,
      ).toBe("available");
    },
  );
  it.each(["operating", "revenue"] as const)(
    "refuses competing annual starts in %s",
    (side) => {
      const change = { startDate: "2025-01-02", durationDays: 364 };
      const packet =
        side === "operating"
          ? input([operating(), operating(2, change)])
          : input([operating()], [revenue(), revenue(102, change)]);
      expect(resultMargin(packet).operatingMargin).toMatchObject({
        status: "unavailable",
        reason: "ambiguous_period",
      });
    },
  );
  it("keeps both annual amounts but refuses their unequal start dates", () => {
    const result = resolve(
      input(
        [operating()],
        [revenue(101, { startDate: "2025-01-02", durationDays: 364 })],
      ),
    );
    expect(result.operatingIncome.status).toBe("available");
    expect(result.margins[1]!.revenue.status).toBe("available");
    expect(result.margins[1]!.operatingMargin).toMatchObject({
      status: "unavailable",
      reason: "period_mismatch",
    });
  });
  it("does not replace a missing report-end operating amount with a comparative period", () => {
    const result = resolve(
      input([
        operating(1, {
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          durationDays: 366,
        }),
      ]),
    );
    expect(result.operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "no_report_period",
    });
  });
  it.each([
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ filingFocusPeriod: "Q4" }, "missing_or_non_FY_focus"],
    [{ startDate: null, durationDays: null }, "invalid_annual_period"],
    [{ startDate: "2025-02-01", durationDays: 334 }, "invalid_annual_period"],
    [{ startDate: "2024-12-01", durationDays: 396 }, "invalid_annual_period"],
    [{ durationDays: 364 }, "invalid_annual_period"],
    [
      { filing: { ...operating().filing, status: "metadata_conflict" } },
      "filing_unmatched_or_conflicted",
    ],
    [
      {
        filing: {
          ...operating().filing,
          sourceUrl: "https://example.test/filing",
        },
      },
      "filing_unmatched_or_conflicted",
    ],
    [
      { filing: { ...operating().filing, reportDate: "2024-12-31" } },
      "report_end_mismatch",
    ],
  ] as const)("retains structural annual refusal %#", (changes, reason) => {
    expect(
      resolve(input([operating(1, changes)])).operatingIncome,
    ).toMatchObject({ status: "unavailable", reason });
  });
  it.each([
    ["2025-01-31", 335],
    ["2024-12-02", 395],
  ] as const)(
    "admits the inclusive annual duration boundary %i",
    (startDate, durationDays) => {
      expect(
        resultMargin(
          input(
            [operating(1, { startDate, durationDays })],
            [revenue(101, { startDate, durationDays })],
          ),
        ).operatingMargin,
      ).toMatchObject({ status: "available", value: "15" });
    },
  );

  it("admits exactly 100 selected observations in a full 10,000-candidate scan", () => {
    const packet = input(
      Array.from({ length: 100 }, (_, i) => operating(i + 1)),
    );
    const m = packet.operatingResults.operatingIncome;
    if (m.scan.status !== "available") throw new Error();
    packet.operatingResults = {
      operatingIncome: {
        ...m,
        scan: {
          ...m.scan,
          coverage: {
            ...m.scan.coverage,
            full: {
              candidateRows: 10_000,
              inspectedRows: 10_000,
              invalidRows: 0,
              duplicateRows: 9_899,
              uniqueObservations: 101,
            },
            otherAccessions: 1,
          },
        },
      },
    };
    expect(resolve(packet).operatingIncome.observationIds).toHaveLength(100);
    expect(resultMargin(packet).operatingMargin).toMatchObject({
      status: "available",
      value: "15",
    });
  });
  it("refuses selected overflow without clipping or spending revenue's allowance", () => {
    const packet = input([]);
    packet.operatingResults = {
      operatingIncome: {
        scan: {
          status: "available",
          absence: null,
          coverage: {
            full: {
              candidateRows: 101,
              inspectedRows: 101,
              invalidRows: 0,
              duplicateRows: 0,
              uniqueObservations: 101,
            },
            selected: 101,
            otherAccessions: 0,
            returned: 0,
            omittedSelected: 101,
          },
        },
        observations: [],
      },
    };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "selected_report_overflow",
      observationIds: [],
    });
    expect(resultMargin(packet).revenue.status).toBe("available");
  });
  it("refuses counted invalid operating rows while retaining their valid references", () => {
    const packet = input();
    const m = packet.operatingResults.operatingIncome;
    if (m.scan.status !== "available") throw new Error();
    packet.operatingResults = {
      operatingIncome: {
        ...m,
        scan: {
          ...m.scan,
          coverage: {
            ...m.scan.coverage,
            full: {
              ...m.scan.coverage.full,
              candidateRows: 2,
              inspectedRows: 2,
              invalidRows: 1,
            },
          },
        },
      },
    };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "invalid_source_rows",
      observationIds: [operating().id],
    });
    expect(resultMargin(packet).revenue.status).toBe("available");
  });
  it("keeps historical amounts and margins beyond report-age policy without relabelling them current", () => {
    const packet = input();
    packet.generation = {
      ...packet.generation,
      cutoffAt: "2027-09-20T06:00:00.000Z",
      completedAt: "2027-09-20T06:00:03.000Z",
      sources: {
        companyFacts: {
          ...packet.generation.sources.companyFacts,
          fetchedAt: "2027-09-20T06:00:02.000Z",
        },
        submissions: {
          ...packet.generation.sources.submissions,
          fetchedAt: "2027-09-20T06:00:01.000Z",
        },
      },
    };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "available",
      currentUseEligible: false,
    });
    expect(resultMargin(packet).operatingMargin).toMatchObject({
      status: "available",
      value: "15",
      currentUseEligible: false,
    });
  });
  it("refuses stale captures and an invalid clock instead of treating them as historical amounts", () => {
    for (const [completedAt, reason] of [
      ["2026-09-28T06:00:03.000Z", "source_stale"],
      ["2026-09-19T06:00:00.000Z", "invalid_clock"],
    ] as const) {
      const packet = input();
      packet.generation = { ...packet.generation, completedAt };
      packet.observations = [];
      packet.coverage = coverage([]);
      packet.completeness = { status: "refused", reason };
      expect(resolve(packet).operatingIncome).toMatchObject({
        status: "unavailable",
        reason,
      });
    }
  });
  it("does not choose a fact when the observed filing target is unresolved", () => {
    const packet = input([]);
    packet.target = {
      status: "unresolved",
      reason: "no_observed_annual_target",
    };
    packet.observations = [];
    packet.completeness = { status: "refused", reason: "target_unresolved" };
    packet.coverage = {
      ...coverage([]),
      selected: null,
      otherAccessions: null,
      omittedSelected: null,
    };
    const m = metric([]);
    if (m.scan.status !== "available") throw new Error();
    packet.operatingResults = {
      operatingIncome: {
        ...m,
        scan: {
          ...m.scan,
          coverage: {
            ...m.scan.coverage,
            selected: null,
            otherAccessions: null,
            omittedSelected: null,
          },
        },
      },
    };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "target_unresolved",
    });
  });
  it.each([
    (p: Input) => {
      p.operatingResults = {
        operatingIncome: metric([operating(), operating()]),
      };
    },
    (p: Input) => {
      p.operatingResults = { operatingIncome: metric([operating(101)]) };
    },
    (p: Input) => {
      p.operatingResults = {
        operatingIncome: metric([
          operating(1, { accessionNumber: "0000999999-25-000001" }),
        ]),
      };
    },
    (p: Input) => {
      p.operatingResults = {
        operatingIncome: metric([operating(1, { value: "9".repeat(65) })]),
      };
    },
    (p: Input) => {
      p.operatingResults = {
        operatingIncome: metric([operating(1, { value: "1e3" })]),
      };
    },
    (p: Input) => {
      const m = p.operatingResults.operatingIncome;
      if (m.scan.status !== "available") throw new Error();
      p.operatingResults = {
        operatingIncome: {
          ...m,
          scan: { ...m.scan, coverage: { ...m.scan.coverage, returned: 0 } },
        },
      };
    },
    (p: Input) => {
      const m = p.operatingResults.operatingIncome;
      if (m.scan.status !== "available") throw new Error();
      p.operatingResults = {
        operatingIncome: {
          ...m,
          scan: {
            ...m.scan,
            coverage: {
              ...m.scan.coverage,
              full: {
                ...m.scan.coverage.full,
                candidateRows: 10_001,
                inspectedRows: 10_001,
                duplicateRows: 10_000,
              },
            },
          },
        },
      };
    },
  ])(
    "rejects contradictory counts, duplicate IDs, foreign accessions and unsafe decimals %#",
    (change) => {
      const packet = input();
      change(packet);
      expect(() => resolve(packet)).toThrow(TypeError);
    },
  );
});

describe("shared exact margin arithmetic", () => {
  it.each([
    ["1", "32", "3.13"],
    ["-1", "32", "-3.13"],
    ["0", "3", "0"],
    ["-0.00001", "100", "0"],
    ["750000", "5000000", "15"],
  ])(
    "computes %s / %s with one half-up rounding",
    (numerator, denominator, expected) => {
      expect(calculatePersonalMarginPercent(numerator, denominator)).toBe(
        expected,
      );
    },
  );
  it("supports maximum source decimals and ignores mutable global Decimal defaults", () => {
    const precision = Decimal.precision;
    const rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      expect(calculatePersonalMarginPercent("1", "32")).toBe("3.13");
      const numerator = "9".repeat(64);
      const denominator = `0.${"0".repeat(61)}1`;
      const result = calculatePersonalMarginPercent(numerator, denominator);
      expect(result).toBe(`${numerator}${"0".repeat(64)}`);
      expect(result.length).toBeLessThanOrEqual(
        PERSONAL_SEC_ANNUAL_OPERATING_LIMITS.marginCharacters,
      );
    } finally {
      Decimal.set({ precision, rounding });
    }
  });
  it.each(["", "01", "1e3", "NaN", "Infinity", " 1", "+1", "9".repeat(65)])(
    "rejects unsafe arithmetic input %s",
    (value) => {
      expect(() => calculatePersonalMarginPercent(value, "100")).toThrow(
        TypeError,
      );
      expect(() => calculatePersonalMarginPercent("1", value)).toThrow(
        TypeError,
      );
    },
  );
  it.each(["0", "-0.0", "-1"])("rejects nonpositive revenue %s", (value) => {
    expect(() => calculatePersonalMarginPercent("1", value)).toThrow(TypeError);
  });
});
