import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_OPERATING_LIMITS,
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCoverageDto,
  type PersonalSecAnnualOperatingAbsence,
  type PersonalSecAnnualOperatingMetricEvidenceDto,
  type PersonalSecAnnualOperatingObservationDto,
  type PersonalSecAnnualOperatingResolutionInput,
  type PersonalSecAnnualRevenueConcept,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculatePersonalMarginPercent } from "./personal-margin";
import { resolvePersonalSecAnnualEvidence } from "./personal-sec-annual-evidence";
import {
  resolvePersonalSecAnnualOperatingResults as resolve,
  resolvePersonalSecAnnualOperatingHistory as history,
  comparePersonalSecAnnualOperatingEvidence as compare,
  type PersonalSecAnnualOperatingHistoryReason,
} from "./personal-sec-annual-operating-results";

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
  it("retains full version-5 packet admission before returning an independent operating amount", () => {
    const packet = input();
    Object.assign(packet.generation, { definitionVersion: "6.0.0" });
    expect(() => resolve(packet)).toThrow(TypeError);
    expect(() => history(packet, "Revenues")).toThrow(TypeError);
    expect(() => compare(packet, "Revenues")).toThrow(TypeError);
    packet.observations = [];
    packet.coverage = coverage([]);
    packet.completeness = { status: "refused", reason: "invalid_clock" };
    expect(resolve(packet).operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "invalid_clock",
    });
    expect(resolve(packet).utilityAge).toBeNull();
    expect(history(packet, "Revenues")).toEqual({
      status: "unavailable",
      reason: "invalid_clock",
    });
  });

  it.each([
    "income completeness",
    "income counts",
    "income metric",
    "operating metric",
  ] as const)("retains complete packet admission for %s", (kind) => {
    const packet = input();
    if (kind === "income completeness")
      packet.completeness = { status: "refused", reason: "invalid_clock" };
    if (kind === "income counts") packet.coverage = coverage([]);
    if (kind === "income metric")
      Object.assign(packet.observations[0]!, { metric: "net_income" });
    if (kind === "operating metric")
      Object.assign(packet.operatingResults.operatingIncome.observations[0]!, {
        metric: "revenue",
      });
    expect(() => resolve(packet)).toThrow(TypeError);
    expect(() => history(packet, "Revenues")).toThrow(TypeError);
    expect(() => compare(packet, "Revenues")).toThrow(TypeError);
  });

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

function comparativeRows(count = 3) {
  return Array.from({ length: count }, (_, index) => {
    const year = 2025 - index;
    return operating(index + 1, {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      durationDays: year === 2024 ? 366 : 365,
      value: String(15 - index * 5),
    });
  });
}
function comparativeRevenue(count = 3) {
  return comparativeRows(count).map((row, index) =>
    revenue(101 + index, {
      startDate: row.startDate,
      endDate: row.endDate,
      durationDays: row.durationDays,
      value: String(100 - index * 20),
    }),
  );
}
function historyInput(count = 3) {
  return input(comparativeRows(count), comparativeRevenue(count));
}
function availableHistory(
  packet: Input,
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
) {
  const result = history(packet, concept);
  if (result.status !== "available")
    throw new Error(`History refused: ${result.reason}`);
  return result;
}

function availableComparison(
  packet: Input,
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
) {
  const result = compare(packet, concept);
  if (result.status !== "available")
    throw new Error(`Comparison refused: ${result.stage}/${result.reason}`);
  return result;
}

describe("Reported operating change", () => {
  it.each([2, 3, 4])(
    "uses only the first two admitted periods from %i supplied, independent of net income",
    (count) => {
      const packet = historyInput(count);
      const before = JSON.stringify(packet);
      const currentBefore = JSON.stringify(resolve(packet));
      const historyBefore = JSON.stringify(history(packet, "Revenues"));
      expect(
        resolvePersonalSecAnnualEvidence(packet).selectedReportPairEligible,
      ).toBe(false);
      const result = availableComparison(packet);
      expect(result).toEqual({
        status: "available",
        concept: "Revenues",
        accessionNumber: accession,
        current: availableHistory(packet).periods[0],
        prior: availableHistory(packet).periods[1],
        operatingIncomeDifference: "5",
        operatingMarginChange: {
          status: "available",
          prior: "12.5",
          current: "15",
          difference: "2.5",
          direction: "higher",
        },
        observationIds: [
          operating(1).id,
          revenue(101).id,
          operating(2).id,
          revenue(102).id,
        ],
      });
      expect(JSON.stringify(packet)).toBe(before);
      expect(JSON.stringify(resolve(packet))).toBe(currentBefore);
      expect(JSON.stringify(history(packet, "Revenues"))).toBe(historyBefore);
      expect(Object.hasOwn(result, "percentGrowth")).toBe(false);
      expect(Object.hasOwn(result.current, "currentUseEligible")).toBe(false);
    },
  );

  it("owns deep-frozen periods and every agreeing ID, leaving input and original filing/clocks unchanged", () => {
    const op = comparativeRows(),
      rev = comparativeRevenue();
    const packet = input(
      [
        ...op,
        { ...op[0]!, id: operating(9).id, value: "15.000" },
        { ...op[1]!, id: operating(10).id, value: "10.0" },
      ],
      [...rev, { ...rev[1]!, id: revenue(109).id, value: "80.000" }],
    );
    const before = structuredClone(packet);
    const result = availableComparison(packet);
    expect(result.observationIds).toEqual([
      operating(1).id,
      operating(9).id,
      revenue(101).id,
      operating(2).id,
      operating(10).id,
      revenue(102).id,
      revenue(109).id,
    ]);
    for (const value of [
      result,
      result.current,
      result.prior,
      result.current.observationIds,
      result.prior.observationIds,
      result.observationIds,
      result.operatingMarginChange,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(result.observationIds).not.toBe(result.current.observationIds);
    expect(packet).toEqual(before);
    expect(Object.isFrozen(packet)).toBe(false);
    expect(
      Object.isFrozen(packet.operatingResults.operatingIncome.observations),
    ).toBe(false);
    expect(packet.target).toEqual(before.target);
    expect(packet.generation).toEqual(before.generation);
    expect(op.every((row) => row.filing.reportDate === "2025-12-31")).toBe(
      true,
    );
    function freezeInput(value: unknown): void {
      if (value !== null && typeof value === "object") {
        Object.values(value).forEach(freezeInput);
        Object.freeze(value);
      }
    }
    freezeInput(packet);
    expect(compare(packet, "Revenues")).toEqual(result);
  });

  it("never borrows another named basis or skips a missing middle period", () => {
    const revenues = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.flatMap(
      (concept, basis) =>
        comparativeRevenue()
          .filter((_, i) => basis !== 2 || i !== 1)
          .map((row, i) => ({
            ...row,
            id: revenue(101 + basis * 10 + i).id,
            concept,
            value: String(100 * (basis + 1)),
          })),
    );
    const packet = input(comparativeRows(), revenues);
    expect(
      availableComparison(packet, PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS[0])
        .operatingMarginChange,
    ).toMatchObject({ current: "15", prior: "10", difference: "5" });
    expect(
      availableComparison(packet, "Revenues").operatingMarginChange,
    ).toMatchObject({ current: "7.5", prior: "5", difference: "2.5" });
    expect(compare(packet, "SalesRevenueNet")).toEqual({
      status: "unavailable",
      stage: "prior_pair",
      reason: "no_report_period",
    });
    expect(compare(historyInput(), "SalesRevenueNet")).toEqual({
      status: "unavailable",
      stage: "current_pair",
      reason: "no_report_period",
    });
    expect(() =>
      compare(packet, "Unknown" as PersonalSecAnnualRevenueConcept),
    ).toThrow(TypeError);
  });

  it("returns the actual stopped reason for one period and ignores a refused third pair", () => {
    expect(compare(historyInput(1), "Revenues")).toEqual({
      status: "unavailable",
      stage: "prior_pair",
      reason: "no_report_period",
    });
    const revenues = comparativeRevenue();
    revenues[2] = { ...revenues[2]!, value: "0" };
    const packet = input(comparativeRows(), revenues);
    expect(availableHistory(packet).stoppedReason).toBe("nonpositive_revenue");
    expect(availableComparison(packet).operatingIncomeDifference).toBe("5");
  });

  it.each([
    ["-15", "10", "-25", "-27.5", "lower"],
    ["15", "-10", "25", "27.5", "higher"],
    ["-15", "-10", "-5", "-2.5", "lower"],
    ["0", "10", "-10", "-12.5", "lower"],
    ["-0.000", "0.00", "0", "0", "unchanged"],
  ])(
    "keeps signed USD change for current %s and prior %s without income growth",
    (c, p, usd, pp, direction) => {
      const op = comparativeRows(2);
      op[0] = { ...op[0]!, value: c };
      op[1] = { ...op[1]!, value: p };
      expect(
        availableComparison(input(op, comparativeRevenue(2))),
      ).toMatchObject({
        operatingIncomeDifference: usd,
        operatingMarginChange: { difference: pp, direction },
      });
    },
  );

  it("computes margin direction from full operands rather than the rounded history values", () => {
    const op = comparativeRows(2);
    op[0] = { ...op[0]!, value: "1.005" };
    op[1] = { ...op[1]!, value: "1.004" };
    const result = availableComparison(
      input(
        op,
        comparativeRevenue(2).map((row) => ({ ...row, value: "100" })),
      ),
    );
    expect(result).toMatchObject({
      current: { operatingMarginPercent: "1.01" },
      prior: { operatingMarginPercent: "1" },
      operatingIncomeDifference: "0.001",
      operatingMarginChange: {
        current: "1.01",
        prior: "1",
        difference: "0",
        direction: "higher",
      },
    });
  });

  it("admits exact 128-character USD differences at both signed extremes", () => {
    const large = "9".repeat(64),
      tiny = `0.${"0".repeat(61)}1`;
    const op = comparativeRows(2);
    op[0] = { ...op[0]!, value: tiny };
    op[1] = { ...op[1]!, value: large };
    const result = availableComparison(input(op, comparativeRevenue(2)));
    expect(result.operatingIncomeDifference).toBe(
      `-${"9".repeat(63)}8.${"9".repeat(62)}`,
    );
    expect(result.operatingIncomeDifference).toHaveLength(128);
    const reversed = op.map((row, i) => ({
      ...row,
      value: i === 0 ? large : tiny,
    }));
    expect(
      availableComparison(input(reversed, comparativeRevenue(2)))
        .operatingIncomeDifference,
    ).toBe(`${"9".repeat(63)}8.${"9".repeat(62)}`);
    // A carry to 65 integral digits has fewer available fractional characters.
    op[0] = { ...op[0], value: `-1.${"1".repeat(61)}` };
    op[1] = { ...op[1], value: large };
    const carry = availableComparison(
      input(op, comparativeRevenue(2)),
    ).operatingIncomeDifference;
    expect(carry).toBe(`-1${"0".repeat(64)}.${"1".repeat(61)}`);
    expect(carry).toHaveLength(128);
  });

  it.each([0, 1])(
    "retains the precise stage for refused revenue in period %i",
    (index) => {
      for (const value of ["0", "-1"]) {
        const revenues = comparativeRevenue();
        revenues[index] = { ...revenues[index]!, value };
        const packet = input(comparativeRows(), revenues);
        expect(compare(packet, "Revenues")).toEqual({
          status: "unavailable",
          stage: index === 0 ? "current_pair" : "prior_pair",
          reason: "nonpositive_revenue",
        });
        expect(resolve(packet).operatingIncome.status).toBe("available");
      }
    },
  );

  it.each([
    [{ value: "999" }, "ambiguous_value"],
    [{ startDate: "2024-01-02", durationDays: 365 }, "ambiguous_period"],
    [{ durationDays: 90 }, "invalid_annual_period"],
    [
      { filing: { ...operating().filing, reportDate: "2024-12-31" } },
      "report_end_mismatch",
    ],
  ] satisfies readonly (readonly [
    Partial<Row>,
    PersonalSecAnnualOperatingHistoryReason,
  ])[])(
    "does not skip refused prior evidence %# to an older valid pair",
    (changes, reason) => {
      const op = comparativeRows();
      const packet = input(
        [...op, { ...op[1]!, id: operating(9).id, ...changes }],
        comparativeRevenue(),
      );
      expect(compare(packet, "Revenues")).toEqual({
        status: "unavailable",
        stage: "prior_pair",
        reason,
      });
      expect(availableHistory(packet).stoppedReason).toBe(reason);
    },
  );

  it("retains a mismatched prior pair's actual period refusal", () => {
    const revenues = comparativeRevenue();
    revenues[1] = {
      ...revenues[1]!,
      startDate: "2024-01-02",
      durationDays: 365,
    };
    expect(compare(input(comparativeRows(), revenues), "Revenues")).toEqual({
      status: "unavailable",
      stage: "prior_pair",
      reason: "period_mismatch",
    });
  });
});

describe("Reported annual operating history", () => {
  it.each([1, 2, 3, 4])(
    "owns at most three adjacent periods from %i supplied years without changing current resolution or input",
    (count) => {
      const packet = historyInput(count);
      const before = JSON.stringify(packet);
      const currentBefore = JSON.stringify(resolve(packet));
      expect(
        resolvePersonalSecAnnualEvidence(packet).selectedReportPairEligible,
      ).toBe(false);
      const result = availableHistory(packet);
      expect(result).toMatchObject({
        concept: "Revenues",
        accessionNumber: accession,
        stoppedReason: count < 3 ? "no_report_period" : null,
      });
      expect(result.periods).toEqual(
        [
          {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
            operatingIncome: "15",
            revenue: "100",
            operatingMarginPercent: "15",
            observationIds: [operating(1).id, revenue(101).id],
          },
          {
            startDate: "2024-01-01",
            endDate: "2024-12-31",
            operatingIncome: "10",
            revenue: "80",
            operatingMarginPercent: "12.5",
            observationIds: [operating(2).id, revenue(102).id],
          },
          {
            startDate: "2023-01-01",
            endDate: "2023-12-31",
            operatingIncome: "5",
            revenue: "60",
            operatingMarginPercent: "8.33",
            observationIds: [operating(3).id, revenue(103).id],
          },
        ].slice(0, count),
      );
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.periods)).toBe(true);
      for (const period of result.periods) {
        expect(Object.isFrozen(period)).toBe(true);
        expect(Object.isFrozen(period.observationIds)).toBe(true);
        expect(Object.hasOwn(period, "currentUseEligible")).toBe(false);
      }
      expect(JSON.stringify(packet)).toBe(before);
      expect(JSON.stringify(resolve(packet))).toBe(currentBefore);
      expect(Object.isFrozen(packet)).toBe(false);
      expect(
        Object.isFrozen(packet.operatingResults.operatingIncome.observations),
      ).toBe(false);
    },
  );

  it("keeps all named bases and their different history lengths independent without net income", () => {
    const rows = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.flatMap(
      (concept, basis) =>
        comparativeRevenue(3 - basis).map((row, index) => ({
          ...row,
          id: revenue(101 + basis * 10 + index).id,
          concept,
          value: String(100 * (basis + 1)),
        })),
    );
    const packet = input(comparativeRows(), rows);
    expect(packet.observations.every((row) => row.metric === "revenue")).toBe(
      true,
    );
    const results = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) =>
      availableHistory(packet, concept),
    );
    expect(results.map((result) => result.periods.length)).toEqual([3, 2, 1]);
    expect(
      results.map((result) => result.periods[0]!.operatingMarginPercent),
    ).toEqual(["15", "7.5", "5"]);
    expect(results.map((result) => result.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
    );
    expect(history(historyInput(), "SalesRevenueNet")).toEqual({
      status: "unavailable",
      reason: "no_report_period",
    });
    expect(() =>
      history(packet, "UnknownRevenue" as PersonalSecAnnualRevenueConcept),
    ).toThrow(TypeError);
  });

  it.each(["operating", "revenue"] as const)(
    "stops at a missing %s period without borrowing the older year",
    (side) => {
      const result = availableHistory(
        input(
          comparativeRows().filter(
            (_, index) => side !== "operating" || index !== 1,
          ),
          comparativeRevenue().filter(
            (_, index) => side !== "revenue" || index !== 1,
          ),
        ),
      );
      expect(result.periods).toHaveLength(1);
      expect(result.stoppedReason).toBe("no_report_period");
    },
  );

  it("keeps two accepted periods when the third revenue is absent", () => {
    const result = availableHistory(
      input(comparativeRows(), comparativeRevenue(2)),
    );
    expect(result.periods).toHaveLength(2);
    expect(result.stoppedReason).toBe("no_report_period");
  });

  it("accepts adjacent 53-week fiscal periods while preserving the filing's original report date", () => {
    const periods = [
      { startDate: "2024-12-29", endDate: "2025-12-27", durationDays: 364 },
      { startDate: "2023-12-24", endDate: "2024-12-28", durationDays: 371 },
    ];
    const op = comparativeRows(2).map((row, index) => ({
      ...row,
      ...periods[index]!,
      filing: { ...row.filing, reportDate: "2025-12-27" },
    }));
    const revenues = comparativeRevenue(2).map((row, index) => ({
      ...row,
      ...periods[index]!,
      filing: { ...row.filing, reportDate: "2025-12-27" },
    }));
    const packet = input(op, revenues);
    if (packet.target.status !== "target") throw new Error();
    packet.target = { ...packet.target, reportDate: "2025-12-27" };
    const before = structuredClone(packet);
    expect(
      availableHistory(packet).periods.map(({ startDate, endDate }) => ({
        startDate,
        endDate,
      })),
    ).toEqual(
      periods.map(({ startDate, endDate }) => ({ startDate, endDate })),
    );
    expect(packet).toEqual(before);
    const change = availableComparison(packet);
    expect([change.current.endDate, change.prior.endDate]).toEqual([
      "2025-12-27",
      "2024-12-28",
    ]);
    expect(change.operatingIncomeDifference).toBe("5");
  });

  it("uses exact decimal equality and preserves every agreeing prior observation reference", () => {
    const op = comparativeRows();
    op[1] = { ...op[1]!, value: "9007199254740993.005" };
    const revenues = comparativeRevenue();
    revenues[1] = { ...revenues[1]!, value: "100" };
    const result = availableHistory(
      input(
        [
          ...op,
          { ...op[1], id: operating(9).id, value: "9007199254740993.0050" },
        ],
        [...revenues, { ...revenues[1], id: revenue(109).id, value: "100.00" }],
      ),
    );
    expect(result.periods[1]).toMatchObject({
      operatingIncome: "9007199254740993.005",
      revenue: "100",
      operatingMarginPercent: "9007199254740993.01",
      observationIds: [
        operating(2).id,
        operating(9).id,
        revenue(102).id,
        revenue(109).id,
      ],
    });
  });

  it.each([
    ["-1", "32", "-3.13"],
    ["-0.000", "3", "0"],
    ["-0.00001", "100", "0"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(64)}`,
    ],
  ])(
    "retains prior %s / %s with exact half-up arithmetic and no growth inference",
    (value, denominator, expected) => {
      const op = comparativeRows();
      op[1] = { ...op[1]!, value };
      const revenues = comparativeRevenue();
      revenues[1] = { ...revenues[1]!, value: denominator };
      const result = availableHistory(input(op, revenues));
      expect(result.periods[1]!.operatingMarginPercent).toBe(expected);
      expect(result.periods[1]!.operatingIncome).toBe(
        value === "-0.000" ? "0" : value,
      );
      expect(Object.keys(result.periods[1]!)).toEqual([
        "startDate",
        "endDate",
        "operatingIncome",
        "revenue",
        "operatingMarginPercent",
        "observationIds",
      ]);
    },
  );

  it.each(["0", "-1"])(
    "stops at prior nonpositive revenue %s and retains current resolution",
    (value) => {
      const revenues = comparativeRevenue();
      revenues[1] = { ...revenues[1]!, value };
      const packet = input(comparativeRows(), revenues);
      const current = resolve(packet);
      expect(availableHistory(packet)).toMatchObject({
        periods: [expect.anything()],
        stoppedReason: "nonpositive_revenue",
      });
      expect(resolve(packet)).toEqual(current);
    },
  );

  it.each([
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ filingFocusPeriod: "Q4" }, "missing_or_non_FY_focus"],
    [{ startDate: null, durationDays: null }, "invalid_annual_period"],
    [{ startDate: "2024-02-02", durationDays: 334 }, "invalid_annual_period"],
    [{ startDate: "2023-12-02", durationDays: 396 }, "invalid_annual_period"],
    [{ durationDays: 365 }, "invalid_annual_period"],
    [
      { filing: { ...operating().filing, status: "metadata_conflict" } },
      "filing_unmatched_or_conflicted",
    ],
    [
      { filing: { ...operating().filing, reportDate: "2024-12-31" } },
      "report_end_mismatch",
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
      {
        filing: {
          ...operating().filing,
          acceptedAt: "2026-02-01T17:00:00.000Z",
        },
      },
      "filing_unmatched_or_conflicted",
    ],
  ] satisfies readonly (readonly [
    Partial<Row>,
    PersonalSecAnnualOperatingHistoryReason,
  ])[])(
    "stops at refused prior metadata %# without rewriting the filing",
    (changes, reason) => {
      const op = comparativeRows();
      op[1] = { ...op[1]!, ...changes };
      const result = availableHistory(input(op, comparativeRevenue()));
      expect(result.periods).toHaveLength(1);
      expect(result.stoppedReason).toBe(reason);
    },
  );

  it.each(["operating", "revenue"] as const)(
    "does not discard an invalid same-end %s row to select a valid alternative",
    (side) => {
      const op = comparativeRows();
      const revenues = comparativeRevenue();
      if (side === "operating")
        op.push({ ...op[1]!, id: operating(9).id, durationDays: 90 });
      else
        revenues.push({
          ...revenues[1]!,
          id: revenue(109).id,
          durationDays: 90,
        });
      expect(availableHistory(input(op, revenues))).toMatchObject({
        periods: [expect.anything()],
        stoppedReason: "invalid_annual_period",
      });
    },
  );

  it.each(["operating", "revenue"] as const)(
    "stops on conflicting prior %s values or annual starts",
    (side) => {
      for (const change of [
        { value: "999" },
        { startDate: "2024-01-02", durationDays: 365 },
      ]) {
        const op = comparativeRows();
        const revenues = comparativeRevenue();
        if (side === "operating")
          op.push({ ...op[1]!, id: operating(9).id, ...change });
        else revenues.push({ ...revenues[1]!, id: revenue(109).id, ...change });
        expect(availableHistory(input(op, revenues))).toMatchObject({
          periods: [expect.anything()],
          stoppedReason:
            "value" in change ? "ambiguous_value" : "ambiguous_period",
        });
      }
    },
  );

  it("refuses individually valid prior operands with unequal periods", () => {
    const revenues = comparativeRevenue();
    revenues[1] = {
      ...revenues[1]!,
      startDate: "2024-01-02",
      durationDays: 365,
    };
    expect(availableHistory(input(comparativeRows(), revenues))).toMatchObject({
      periods: [expect.anything()],
      stoppedReason: "period_mismatch",
    });
  });

  it.each([
    "duplicate operating ID",
    "cross-metric ID",
    "foreign accession",
    "invalid coverage",
  ])(
    "revalidates the complete packet for %s before returning any history",
    (kind) => {
      const op = comparativeRows();
      if (kind === "duplicate operating ID")
        op[1] = { ...op[1]!, id: op[0]!.id };
      if (kind === "cross-metric ID")
        op[1] = { ...op[1]!, id: revenue(101).id };
      if (kind === "foreign accession")
        op[1] = { ...op[1]!, accessionNumber: "0000999999-25-000001" };
      const packet = input(op, comparativeRevenue());
      if (kind === "invalid coverage") {
        const m = packet.operatingResults.operatingIncome;
        if (m.scan.status !== "available") throw new Error();
        packet.operatingResults = {
          operatingIncome: {
            ...m,
            scan: { ...m.scan, coverage: { ...m.scan.coverage, returned: 2 } },
          },
        };
      }
      expect(() => history(packet, "Revenues")).toThrow(TypeError);
      expect(() => compare(packet, "Revenues")).toThrow(TypeError);
    },
  );

  it.each(["invalid_response", "candidate_limit"] as const)(
    "preserves the independent operating scan refusal %s",
    (status) => {
      const packet = historyInput();
      packet.operatingResults = {
        operatingIncome: {
          scan: { status, absence: null, coverage: null },
          observations: [],
        },
      };
      expect(history(packet, "Revenues")).toEqual({
        status: "unavailable",
        reason: status,
      });
      expect(compare(packet, "Revenues")).toEqual({
        status: "unavailable",
        stage: "current_pair",
        reason: status,
      });
      expect(resultMargin(packet).revenue.status).toBe("available");
    },
  );

  it("admits 100 selected operating rows and refuses a complete 101-row overflow", () => {
    const op = comparativeRows();
    const atCap = input(
      [
        ...op,
        ...Array.from({ length: 97 }, (_, i) => ({
          ...op[1]!,
          id: operating(1001 + i).id,
        })),
      ],
      comparativeRevenue(),
    );
    expect(availableHistory(atCap).periods[1]!.observationIds).toHaveLength(99);
    const packet = historyInput();
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
    expect(history(packet, "Revenues")).toEqual({
      status: "unavailable",
      reason: "selected_report_overflow",
    });
    expect(compare(packet, "Revenues")).toEqual({
      status: "unavailable",
      stage: "current_pair",
      reason: "selected_report_overflow",
    });
  });

  it("does not calculate from the retained valid subset when the operating scan counts an invalid row", () => {
    const packet = historyInput();
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
              candidateRows: 4,
              inspectedRows: 4,
              invalidRows: 1,
            },
          },
        },
      },
    };
    expect(history(packet, "Revenues")).toEqual({
      status: "unavailable",
      reason: "invalid_source_rows",
    });
    expect(compare(packet, "Revenues")).toEqual({
      status: "unavailable",
      stage: "current_pair",
      reason: "invalid_source_rows",
    });
  });

  it.each([
    "source_unavailable",
    "invalid_source_rows",
    "selected_report_overflow",
  ] as const)(
    "does not bypass a refused combined revenue/income scan for %s",
    (reason) => {
      const packet = historyInput();
      packet.observations = [];
      packet.completeness = { status: "refused", reason };
      if (reason === "source_unavailable") {
        packet.incomeScanStatus = "invalid_response";
        packet.coverage = null;
      } else if (reason === "invalid_source_rows") {
        const c = packet.coverage!;
        packet.coverage = {
          ...c,
          full: { ...c.full, inspectedRows: 4, invalidRows: 1 },
          returned: { observations: 0, revenue: 0, netIncome: 0 },
          omittedSelected: c.selected,
        };
      } else {
        const c = coverage(
          Array.from({ length: 101 }, (_, i) => revenue(101 + i)),
        );
        packet.coverage = {
          ...c,
          returned: { observations: 0, revenue: 0, netIncome: 0 },
          omittedSelected: c.selected,
          history: {
            returned: { observations: 100, revenue: 100, netIncome: 0 },
            truncated: true,
          },
        };
      }
      expect(history(packet, "Revenues")).toEqual({
        status: "unavailable",
        reason,
      });
      expect(compare(packet, "Revenues")).toEqual({
        status: "unavailable",
        stage: "current_pair",
        reason,
      });
      expect(resolve(packet).operatingIncome.status).toBe("available");
    },
  );

  it("withholds history for an old selected filing but preserves its independent historical current amounts", () => {
    const packet = JSON.parse(
      JSON.stringify(historyInput()).replaceAll("2026-09-20", "2027-09-20"),
    ) as Input;
    expect(history(packet, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
    expect(compare(packet, "Revenues")).toEqual({
      status: "unavailable",
      stage: "current_pair",
      reason: "current_use_unavailable",
    });
    expect(resultMargin(packet).operatingMargin).toMatchObject({
      status: "available",
      currentUseEligible: false,
    });
  });

  it.each([
    ["2026-09-19T06:00:00.000Z", "invalid_clock"],
    ["2026-09-28T06:00:03.000Z", "source_stale"],
  ] as const)(
    "preserves source-clock refusal %s before traversing history",
    (completedAt, reason) => {
      const packet = historyInput();
      packet.generation = { ...packet.generation, completedAt };
      packet.observations = [];
      packet.coverage = coverage([]);
      packet.completeness = { status: "refused", reason };
      expect(history(packet, "Revenues")).toEqual({
        status: "unavailable",
        reason,
      });
      expect(compare(packet, "Revenues")).toEqual({
        status: "unavailable",
        stage: "current_pair",
        reason,
      });
    },
  );
});
